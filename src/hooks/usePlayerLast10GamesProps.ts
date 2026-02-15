import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { supabase } from '../utils/supabase';
import { calculatePropResult } from '../utils/playerPropsCalculator';
import { matchPropsGamesToNbaGames } from '../utils/matchPropsGamesToNbaGames';
import { filterFullGameProps } from '../utils/playerPropsFilter';
import { utcToESTDate } from '../utils/nbaDateUtils';

export interface PlayerLast10GamesPropsData {
  nbaPlayerId: number;
  playerName: string;
  betType: string;
  last10Games: Array<{
    gameId: string;
    gameDate: string;
    line: number | null;
    actualValue: number;
    result: 'over' | 'under' | 'push' | null;
    hit: boolean | null;
  }>;
  hits: number;
  total: number;
  hitRate: number | null; // Percentage (0-100)
}

/** Map our tab betType to possible player_props.bet_type values in DB (same as useOpponentTeamPropsPerformance) */
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
    blocks_steals: ['blocks_steals', 'blocks+steals', 'stocks'],
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
 * Hook to fetch a player's last 10 games prop performance for a specific bet type.
 * Uses nba_games for the last 10 games before tomorrow's date, and actual player_props
 * (via player_props_games, with fallback when nba_game_id is null) so each game is
 * compared to that game's actual prop line, not a static line.
 */
export function usePlayerLast10GamesProps(
  nbaPlayerId: number | null,
  betType: string,
  enabled: boolean = true,
  _currentLine: number | null = null // kept for API compatibility; no longer used
) {
  return useQuery({
    queryKey: ['player-last-10-games-props', nbaPlayerId, betType],
    queryFn: async (): Promise<PlayerLast10GamesPropsData | null> => {
      console.log('[Last10] queryFn called:', { nbaPlayerId, betType });
      if (!nbaPlayerId || !betType) {
        console.log('[Last10] early return: missing nbaPlayerId or betType');
        return null;
      }

      // Last 10 games: before today's date + 1 (tomorrow)
      const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
      const cutoff = tomorrow + 'T00:00:00.000Z';

      // Get player name
      const { data: player, error: playerError } = await supabase
        .from('nba_players')
        .select('nba_player_id, name')
        .eq('nba_player_id', nbaPlayerId)
        .single();

      if (!player) return null;

      // Get last 10 games for this player before tomorrow (from boxscores)
      const { data: boxscores, error: boxscoreError } = await supabase
        .from('nba_boxscores')
        .select('game_id, game_date, pts, reb, ast, stl, blk, tov, fg3m, ftm, fgm, fga, fg3a, fta')
        .eq('nba_player_id', nbaPlayerId)
        .lt('game_date', cutoff)
        .order('game_date', { ascending: false })
        .limit(10);

      if (boxscoreError || !boxscores || boxscores.length === 0) {
        return {
          nbaPlayerId,
          playerName: player.name,
          betType,
          last10Games: [],
          hits: 0,
          total: 0,
          hitRate: null,
        };
      }

      const gameIds = [...new Set(boxscores.map(bs => bs.game_id))];

      // Fetch nba_games for these games (for matcher when ppg.nba_game_id is null)
      const { data: nbaGamesRows } = await supabase
        .from('nba_games')
        .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name')
        .in('game_id', gameIds);

      const nbaGamesForMatching = (nbaGamesRows || []).map(g => ({
        game_id: g.game_id,
        game_date: g.game_date,
        home_team_tricode: g.home_team_tricode ?? null,
        away_team_tricode: g.away_team_tricode ?? null,
        home_team_name: (g as any).home_team_name ?? null,
        away_team_name: (g as any).away_team_name ?? null,
      }));

      // Fetch player_props_games for these nba games
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

      // Fallback: player_props_games often has nba_game_id = null; match by date + teams.
      // Use EST. Fetch by date range (min-2 to max+2) with limit 3000 so we don't truncate at 1000.
      const dateStrings = boxscores.map(bs => utcToESTDate(bs.game_date));
      const datesFromGames = [...new Set(dateStrings)].filter(Boolean);

      if (datesFromGames.length > 0) {
        const sorted = datesFromGames.slice().sort();
        const minDate = sorted[0];
        const maxDate = sorted[sorted.length - 1];
        const [minY, minM, minD] = minDate.split('-').map(Number);
        const [maxY, maxM, maxD] = maxDate.split('-').map(Number);
        const minDt = new Date(minY, minM - 1, minD - 2);
        const maxDt = new Date(maxY, maxM - 1, maxD + 2);
        const rangeMin = `${minDt.getFullYear()}-${String(minDt.getMonth() + 1).padStart(2, '0')}-${String(minDt.getDate()).padStart(2, '0')}`;
        const rangeMax = `${maxDt.getFullYear()}-${String(maxDt.getMonth() + 1).padStart(2, '0')}-${String(maxDt.getDate()).padStart(2, '0')}`;

        const { data: ppgByDate, error: ppgDateError } = await supabase
          .from('player_props_games')
          .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, event_id')
          .gte('game_date', rangeMin)
          .lte('game_date', rangeMax)
          .limit(3000);

        if (!ppgDateError && ppgByDate?.length) {
          const needMatch = ppgByDate.filter(pg => !pg.nba_game_id || !gameIds.includes(pg.nba_game_id));
          const alreadyHave = ppgByDate.filter(pg => pg.nba_game_id && gameIds.includes(pg.nba_game_id));
          alreadyHave.forEach(pg => ppgIdToNbaGameId.set(pg.id, pg.nba_game_id));

          if (needMatch.length > 0 && nbaGamesForMatching.length > 0) {
            const matches = matchPropsGamesToNbaGames(needMatch, nbaGamesForMatching);
            matches.forEach((nbaGame, ppgId) => {
              if (gameIds.includes(nbaGame.game_id)) ppgIdToNbaGameId.set(ppgId, nbaGame.game_id);
            });
          }
        }
      }

      const ppgIds = Array.from(ppgIdToNbaGameId.keys());
      const betTypeValues = getBetTypeQueryValues(betType);
      const actualLineByGame = new Map<string, number>(); // nba_game_id -> line

      if (ppgIds.length > 0) {
        const { data: propsRaw, error: propsError } = await supabase
          .from('player_props')
          .select('game_id, nba_player_id, line, raw_odd_data')
          .in('game_id', ppgIds)
          .eq('nba_player_id', nbaPlayerId)
          .in('bet_type', betTypeValues)
          .limit(5000);

        const props = filterFullGameProps(propsRaw ?? []);

        if (!propsError && props?.length) {
          for (const p of props) {
            const nbaGameId = ppgIdToNbaGameId.get(p.game_id);
            if (nbaGameId != null && p.line != null) {
              const line = Number(p.line);
              if (!actualLineByGame.has(nbaGameId)) actualLineByGame.set(nbaGameId, line);
            }
          }
        }
      }

      // Build last10Games: only include games where we have an actual player_props line
      const last10Games: PlayerLast10GamesPropsData['last10Games'] = [];
      for (const bs of boxscores) {
        const line = actualLineByGame.get(bs.game_id);
        if (line == null) continue;

        const boxscore = {
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
        };

        const gameDate = utcToESTDate(bs.game_date);

        const result = calculatePropResult(betType, line, boxscore);
        if (!result) {
          last10Games.push({
            gameId: bs.game_id,
            gameDate,
            line,
            actualValue: 0,
            result: null,
            hit: null,
          });
          continue;
        }
        const hit = result.result === 'over';
        last10Games.push({
          gameId: bs.game_id,
          gameDate,
          line,
          actualValue: result.actualValue,
          result: result.result,
          hit,
        });
      }

      const gamesWithResults = last10Games.filter(g => g.result !== null && g.result !== 'push');
      const total = gamesWithResults.length;
      const hits = gamesWithResults.filter(g => g.hit === true).length;
      const hitRate = total > 0 ? (hits / total) * 100 : null;

      return {
        nbaPlayerId,
        playerName: player.name,
        betType,
        last10Games,
        hits,
        total,
        hitRate,
      };
    },
    enabled: enabled && !!nbaPlayerId && !!betType,
    staleTime: 5 * 60 * 1000,
  });
}
