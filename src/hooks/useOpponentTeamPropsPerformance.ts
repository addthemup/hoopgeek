import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { calculatePropResult } from '../utils/playerPropsCalculator';
import { matchPropsGamesToNbaGames, matchPropsGameToNbaGame } from '../utils/matchPropsGamesToNbaGames';
import { filterFullGameProps } from '../utils/playerPropsFilter';
import { utcToESTDate } from '../utils/nbaDateUtils';

export interface OpponentTeamPropsPerformanceData {
  opponentTeamTricode: string;
  betType: string;
  last10Games: Array<{
    gameId: string;
    gameDate: string;
    opponentPlayerName: string;
    opponentPlayerId: number;
    line: number | null;
    actualValue: number;
    result: 'over' | 'under' | 'push' | null;
    hit: boolean | null;
  }>;
  totalProps: number; // Total number of props (only those with actual player_props lines)
  hits: number;
  hitRate: number | null; // 0-100, only over actual props
  averageActualValue: number | null;
}

/** Map our tab betType to possible player_props.bet_type values in DB */
function getBetTypeQueryValues(betType: string): string[] {
  const norm = betType.toLowerCase().trim().replace(/\s+/g, '_');
  const aliases: Record<string, string[]> = {
    points: ['points', 'pts', 'point'],
    rebounds: ['rebounds', 'reb', 'rebound'],
    assists: ['assists', 'ast', 'assist'],
    threes: ['threes', 'three-pointers', '3pm', '3pt', 'threepointersmade'],
    steals: ['steals', 'stl', 'steal'],
    blocks: ['blocks', 'blk', 'block'],
    turnovers: ['turnovers', 'tov', 'turnover'],
    blocks_steals: ['blocks_steals', 'blocks+steals', 'stocks', 'stl+blk', 'blocks + steals'],
    points_rebounds: ['points_rebounds', 'points+rebounds', 'pts+reb'],
    points_assists: ['points_assists', 'points+assists', 'pts+ast'],
    rebounds_assists: ['rebounds_assists', 'rebounds+assists', 'reb+ast'],
    points_rebounds_assists: ['points_rebounds_assists', 'points+rebounds+assists', 'par'],
    freethrowsmade: ['freethrowsmade', 'free-throws-made', 'ftm'],
    fieldgoalsmade: ['fieldgoalsmade', 'field-goals-made', 'fgm'],
    fieldgoalsattempted: ['fieldgoalsattempted', 'field-goals-attempted', 'fga'],
    threepointersattempted: ['threepointersattempted', '3-pointers-attempted', '3pa'],
    twopointersmade: ['twopointersmade', 'two-pointers-made', '2pm'],
  };
  return aliases[norm] ?? [norm, betType];
}

/**
 * Hook to fetch how players have fared against an opponent team in props over the last 10 games
 * This shows the opponent team's defensive performance against props
 */
export function useOpponentTeamPropsPerformance(
  opponentTeamTricode: string | null,
  betType: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['opponent-team-props-performance', opponentTeamTricode, betType],
    queryFn: async (): Promise<OpponentTeamPropsPerformanceData | null> => {
      console.log('[VsTeam] queryFn called:', { opponentTeamTricode, betType });
      if (!opponentTeamTricode || !betType) {
        console.log('[VsTeam] early return: missing opponentTeamTricode or betType');
        return null;
      }

      // Get opponent team's last 10 *completed* games (include team names + city for matching when ppg.nba_game_id is null)
      const { data: teamGames, error: gamesError } = await supabase
        .from('nba_games')
        .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name, home_team_city, away_team_city')
        .eq('game_status', 3) // 3 = Final (finished)
        .or(`home_team_tricode.eq.${opponentTeamTricode},away_team_tricode.eq.${opponentTeamTricode}`)
        .order('game_date', { ascending: false })
        .limit(10);

      console.log('[VsTeam] nba_games for team:', { opponentTeamTricode, count: teamGames?.length ?? 0, error: gamesError?.message, sample: teamGames?.slice(0, 2) });
      if (gamesError || !teamGames || teamGames.length === 0) {
        console.log('[VsTeam] no team games, returning empty');
        return {
          opponentTeamTricode,
          betType,
          last10Games: [],
          totalProps: 0,
          hits: 0,
          hitRate: null,
          averageActualValue: null,
        };
      }

      // For each game, get boxscores of players who played AGAINST the opponent team
      // (i.e., players from the other team in each game)
      const allBoxscores: Array<{
        gameId: string;
        gameDate: string;
        nbaPlayerId: number;
        playerName: string;
        stats: any;
      }> = [];

      for (const game of teamGames) {
        // Determine which team is the opponent (the one that's NOT the opponentTeamTricode)
        const opponentTeam = game.home_team_tricode === opponentTeamTricode 
          ? game.away_team_tricode 
          : game.home_team_tricode;

        if (!opponentTeam) continue;

        // Get boxscores for players from the opponent team (players who played AGAINST opponentTeamTricode)
        const { data: boxscores, error: boxscoreError } = await supabase
          .from('nba_boxscores')
          .select('game_id, game_date, nba_player_id, player_name, min, pts, reb, ast, stl, blk, tov, fg3m, ftm, fgm, fga, fg3a, fta, team_tricode, team_abbreviation')
          .eq('game_id', game.game_id)
          .or(`team_tricode.eq.${opponentTeam},team_abbreviation.eq.${opponentTeam}`)
          .gt('min', 0);

        if (!boxscoreError && boxscores) {
          const gameDate = utcToESTDate(game.game_date);
          if (allBoxscores.length < 3) {
            console.log('[VsTeam] boxscores for game', game.game_id, 'opponentTeam', opponentTeam, ':', boxscores.length, 'rows');
          }
          // Include all players with min > 0 so we can match any player who has a player_props line (no 10+ min filter)
          boxscores.forEach(bs => {
            allBoxscores.push({
              gameId: game.game_id,
              gameDate,
              nbaPlayerId: bs.nba_player_id,
              playerName: bs.player_name || '',
              stats: {
                pts: bs.pts || 0,
                reb: bs.reb || 0,
                ast: bs.ast || 0,
                stl: bs.stl || 0,
                blk: bs.blk || 0,
                tov: bs.tov || 0,
                fg3m: bs.fg3m || 0,
                ftm: bs.ftm || 0,
                fgm: bs.fgm || 0,
                fga: bs.fga || 0,
                fg3a: bs.fg3a || 0,
                fta: bs.fta || 0,
              },
            });
          });
        }
      }

      console.log('[VsTeam] allBoxscores total:', allBoxscores.length);
      if (allBoxscores.length === 0) {
        console.log('[VsTeam] no boxscores, returning empty');
        return {
          opponentTeamTricode,
          betType,
          last10Games: [],
          totalProps: 0,
          hits: 0,
          hitRate: null,
          averageActualValue: null,
        };
      }

      const gameIds = teamGames.map(g => g.game_id);

      // Fetch player_props_games for these nba games (link props to nba_game_id)
      const { data: propsGames, error: ppgError } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id')
        .in('nba_game_id', gameIds);

      const ppgIdToNbaGameId = new Map<string, string>();
      if (!ppgError && propsGames?.length) {
        propsGames.forEach(pg => {
          if (pg.nba_game_id) ppgIdToNbaGameId.set(pg.id, pg.nba_game_id);
        });
      }

      // Fallback: player_props_games often has nba_game_id = null. Fetch by date range and match by date + teams.
      // Use EST. Range min-2 to max+2 so we don't miss games; limit 3000 so we don't truncate at PostgREST default 1000.
      const dateStrings = teamGames.map(g => utcToESTDate(g.game_date));
      const datesFromTeamGames = [...new Set(dateStrings)].filter(Boolean);

      if (datesFromTeamGames.length > 0) {
        const sorted = datesFromTeamGames.slice().sort();
        const minDate = sorted[0];
        const maxDate = sorted[sorted.length - 1];
        const [minY, minM, minD] = minDate.split('-').map(Number);
        const [maxY, maxM, maxD] = maxDate.split('-').map(Number);
        const minDt = new Date(minY, minM - 1, minD - 2);
        const maxDt = new Date(maxY, maxM - 1, maxD + 2);
        const rangeMin = `${minDt.getFullYear()}-${String(minDt.getMonth() + 1).padStart(2, '0')}-${String(minDt.getDate()).padStart(2, '0')}`;
        const rangeMax = `${maxDt.getFullYear()}-${String(maxDt.getMonth() + 1).padStart(2, '0')}-${String(maxDt.getDate()).padStart(2, '0')}`;

        // Order by game_date desc so we get the most recent games first (our "last 10" are recent)
        const { data: ppgByDate, error: ppgDateError } = await supabase
          .from('player_props_games')
          .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, event_id')
          .gte('game_date', rangeMin)
          .lte('game_date', rangeMax)
          .order('game_date', { ascending: false })
          .limit(5000);

        if (!ppgDateError && ppgByDate?.length) {
          const needMatch = ppgByDate.filter(pg => !pg.nba_game_id || !gameIds.includes(pg.nba_game_id));
          const alreadyHave = ppgByDate.filter(pg => pg.nba_game_id && gameIds.includes(pg.nba_game_id));
          alreadyHave.forEach(pg => ppgIdToNbaGameId.set(pg.id, pg.nba_game_id));

          const nbaGamesForMatching = teamGames.map(g => ({
            game_id: g.game_id,
            game_date: g.game_date,
            home_team_tricode: g.home_team_tricode ?? null,
            away_team_tricode: g.away_team_tricode ?? null,
            home_team_name: (g as any).home_team_name ?? null,
            away_team_name: (g as any).away_team_name ?? null,
            home_team_city: (g as any).home_team_city ?? null,
            away_team_city: (g as any).away_team_city ?? null,
          }));

          if (needMatch.length > 0) {
            const matches = matchPropsGamesToNbaGames(needMatch, nbaGamesForMatching);
            matches.forEach((nbaGame, ppgId) => {
              if (gameIds.includes(nbaGame.game_id)) ppgIdToNbaGameId.set(ppgId, nbaGame.game_id);
            });
            console.log('[VsTeam] fallback match by date+teams:', { needMatch: needMatch.length, matched: matches.size, ppgIdToNbaGameIdSize: ppgIdToNbaGameId.size });
          }

          // Per-game pass: for each of our 10 games that still has no ppg, try to find any ppg in set that matches
          const matchedGameIds = new Set(ppgIdToNbaGameId.values());
          const missingGameIds = gameIds.filter(id => !matchedGameIds.has(id));
          if (missingGameIds.length > 0) {
            for (const gameId of missingGameIds) {
              const nbaGame = nbaGamesForMatching.find(g => g.game_id === gameId);
              if (!nbaGame) continue;
              const candidate = ppgByDate.find(pg => {
                const matched = matchPropsGameToNbaGame(pg, [nbaGame]);
                return matched?.game_id === gameId && !ppgIdToNbaGameId.has(pg.id);
              });
              if (candidate) {
                ppgIdToNbaGameId.set(candidate.id, gameId);
                console.log('[VsTeam] per-game match:', { gameId, ppgId: candidate.id });
              }
            }
          }
        }
      }

      // Fetch actual player_props for those games and this bet type (use actual lines)
      const betTypeValues = getBetTypeQueryValues(betType);
      const ppgIds = Array.from(ppgIdToNbaGameId.keys());
      const actualLineByGamePlayer = new Map<string, number>(); // key: `${nba_game_id}|${nba_player_id}` -> line

      if (ppgIds.length > 0) {
        const { data: propsRaw, error: propsError } = await supabase
          .from('player_props')
          .select('game_id, nba_player_id, line, raw_odd_data')
          .in('game_id', ppgIds)
          .in('bet_type', betTypeValues)
          .limit(5000);

        const props = filterFullGameProps(propsRaw ?? []);

        if (!propsError && props?.length) {
          for (const p of props) {
            const nbaGameId = ppgIdToNbaGameId.get(p.game_id);
            if (nbaGameId != null && p.nba_player_id != null && p.line != null) {
              const key = `${nbaGameId}|${p.nba_player_id}`;
              // Keep first line (over/under same number); avoid overwriting with null
              if (!actualLineByGamePlayer.has(key)) {
                actualLineByGamePlayer.set(key, Number(p.line));
              }
            }
          }
        }
        console.log('[VsTeam] actual props for betType:', { betType, ppgIds: ppgIds.length, propsCount: props?.length ?? 0, uniqueLines: actualLineByGamePlayer.size });
      }

      // Only use actual player_props lines (from player_props + player_props_games). Do not use
      // static default lines (e.g. 20 pts, 5 reb) for every player with minutes — only count
      // players who had a real prop for that game and compare to their actual line.
      const last10Games: OpponentTeamPropsPerformanceData['last10Games'] = [];
      for (const bs of allBoxscores) {
        const key = `${bs.gameId}|${bs.nbaPlayerId}`;
        const line = actualLineByGamePlayer.get(key);
        if (line == null) continue; // only include players who have a player_props line for this game

        const result = calculatePropResult(betType, line, bs.stats);
        const actualValue = result?.actualValue ?? 0;
        if (!result) {
          last10Games.push({
            gameId: bs.gameId,
            gameDate: bs.gameDate,
            opponentPlayerName: bs.playerName,
            opponentPlayerId: bs.nbaPlayerId,
            line,
            actualValue: 0,
            result: null,
            hit: null,
          });
          continue;
        }
        const hit = result.result === 'over';
        last10Games.push({
          gameId: bs.gameId,
          gameDate: bs.gameDate,
          opponentPlayerName: bs.playerName,
          opponentPlayerId: bs.nbaPlayerId,
          line,
          actualValue,
          result: result.result,
          hit,
        });
      }

      const gamesWithResults = last10Games.filter(g => g.result !== null && g.result !== 'push');
      const totalProps = gamesWithResults.length;
      const hits = gamesWithResults.filter(g => g.hit === true).length;
      const hitRate = totalProps > 0 ? (hits / totalProps) * 100 : null;

      const actualValues = last10Games.map(g => g.actualValue).filter(v => v !== null && v !== undefined);
      const averageActualValue = actualValues.length > 0
        ? actualValues.reduce((sum, val) => sum + val, 0) / actualValues.length
        : null;

      console.log('[VsTeam] result:', { opponentTeamTricode, betType, totalProps, hits, hitRate, averageActualValue });
      return {
        opponentTeamTricode,
        betType,
        last10Games,
        totalProps,
        hits,
        hitRate,
        averageActualValue,
      };
    },
    enabled: enabled && !!opponentTeamTricode && !!betType,
    staleTime: 60 * 1000, // 1 minute so Shield picks up backfilled nba_game_id quickly
  });
}
