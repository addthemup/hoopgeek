import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { calculatePropResult } from '../utils/playerPropsCalculator';

export interface PropResultWithCategory {
  betType: string;
  displayName: string;
  line: number;
  overUnder: 'O' | 'U';
  actualValue: number;
  hit: boolean; // true if over hit, false if under hit
  result: 'over' | 'under' | 'push';
  gameDate: string;
  gameId: string;
}

export interface PreviousGamePropHitRate {
  gameDate: string;
  gameId: string;
  totalProps: number;
  hits: number;
  misses: number;
  hitRate: number; // Percentage (0-100)
  propResults: PropResultWithCategory[];
}

/**
 * Hook to fetch previous games with props and calculate hit rates
 * Returns the most recent game with props and boxscore data
 */
export function usePlayerPreviousGameProps(playerId: string, playerName: string) {
  return useQuery({
    queryKey: ['player-previous-game-props', playerId],
    queryFn: async (): Promise<PreviousGamePropHitRate | null> => {
      console.log(`🎲 Fetching previous game props for ${playerName} (${playerId})...`);
      
      // First, get the player's nba_player_id
      const { data: playerData, error: playerError } = await supabase
        .from('nba_players')
        .select('nba_player_id, name')
        .eq('id', playerId)
        .single();
      
      if (playerError || !playerData || !playerData.nba_player_id) {
        console.error('❌ Error fetching player data:', playerError);
        return null;
      }
      
      const nbaPlayerId = playerData.nba_player_id;
      
      // Find previous games where player has props (excluding today)
      const today = new Date();
      const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      // Query for props from previous games
      const { data: propsData, error: propsError } = await supabase
        .from('player_props')
        .select(`
          id,
          bet_type,
          bet_type_id,
          line,
          game_date,
          game_id,
          player_props_games!inner (
            id,
            game_date
          )
        `)
        .or(`player_id.eq.${playerId},nba_player_id.eq.${nbaPlayerId},player_name.ilike.%${playerName}%`)
        .lt('game_date', todayDateStr)
        .order('game_date', { ascending: false })
        .order('bet_type', { ascending: true })
        .limit(100); // Get recent props
      
      if (propsError || !propsData || propsData.length === 0) {
        console.log('ℹ️ No previous props found for this player');
        return null;
      }
      
      // Group props by game_date to find the most recent game
      const propsByDate = new Map<string, typeof propsData>();
      propsData.forEach(prop => {
        const gameDate = prop.game_date;
        if (!propsByDate.has(gameDate)) {
          propsByDate.set(gameDate, []);
        }
        propsByDate.get(gameDate)!.push(prop);
      });
      
      // Get the most recent game date
      const sortedDates = Array.from(propsByDate.keys()).sort((a, b) => b.localeCompare(a));
      if (sortedDates.length === 0) {
        return null;
      }
      
      const mostRecentDate = sortedDates[0];
      const mostRecentProps = propsByDate.get(mostRecentDate)!;
      
      // Get unique player_props_games IDs for this date
      const propsGameIds = [...new Set(mostRecentProps.map(p => p.game_id))];
      
      // Fetch player_props_games to get game info
      const { data: propsGames, error: propsGamesError } = await supabase
        .from('player_props_games')
        .select('id, game_date, home_team_tricode, away_team_tricode')
        .in('id', propsGameIds);
      
      if (propsGamesError || !propsGames || propsGames.length === 0) {
        console.log('ℹ️ No props games found');
        return null;
      }
      
      // Find matching nba_games by date and teams
      const nbaGameIds: string[] = [];
      const propsGameIdToNbaGameId = new Map<string, string>();
      
      for (const propsGame of propsGames) {
        const gameDate = propsGame.game_date;
        const homeTricode = propsGame.home_team_tricode;
        const awayTricode = propsGame.away_team_tricode;
        
        // Query nba_games for matching game (game_date is a timestamp, so use date range)
        const gameDateStart = `${gameDate}T00:00:00`;
        const gameDateEnd = `${gameDate}T23:59:59`;
        
        const { data: nbaGames, error: nbaGamesError } = await supabase
          .from('nba_games')
          .select('game_id, home_team_tricode, away_team_tricode')
          .gte('game_date', gameDateStart)
          .lte('game_date', gameDateEnd)
          .eq('home_team_tricode', homeTricode)
          .eq('away_team_tricode', awayTricode)
          .limit(1);
        
        if (!nbaGamesError && nbaGames && nbaGames.length > 0) {
          const nbaGameId = nbaGames[0].game_id;
          nbaGameIds.push(nbaGameId);
          propsGameIdToNbaGameId.set(propsGame.id, nbaGameId);
        }
      }
      
      if (nbaGameIds.length === 0) {
        console.log('ℹ️ No matching NBA games found for props games');
        return null;
      }
      
      // Fetch boxscores for these NBA games
      const { data: boxscores, error: boxscoreError } = await supabase
        .from('nba_boxscores')
        .select('game_id, pts, reb, ast, stl, blk, tov, fg3m, ftm')
        .eq('nba_player_id', nbaPlayerId)
        .in('game_id', nbaGameIds);
      
      if (boxscoreError || !boxscores || boxscores.length === 0) {
        console.log('ℹ️ No boxscore data available for previous games');
        return null;
      }
      
      // Create a map of props game_id to boxscore (via nba game_id)
      const boxscoreMap = new Map<string, typeof boxscores[0]>();
      boxscores.forEach(bs => {
        // Find which props_game_id this boxscore corresponds to
        for (const [propsGameId, nbaGameId] of propsGameIdToNbaGameId.entries()) {
          if (nbaGameId === bs.game_id) {
            boxscoreMap.set(propsGameId, bs);
            break;
          }
        }
      });
      
      // Calculate results for each prop
      const propResults: PropResultWithCategory[] = [];
      let hits = 0;
      let misses = 0;
      
      // Format bet type name
      const formatBetType = (betType: string): string => {
        const betTypeMap: Record<string, string> = {
          'points': 'PTS',
          'point': 'PTS',
          'pts': 'PTS',
          'rebounds': 'REB',
          'rebound': 'REB',
          'reb': 'REB',
          'assists': 'AST',
          'assist': 'AST',
          'ast': 'AST',
          'steals': 'STL',
          'steal': 'STL',
          'stl': 'STL',
          'blocks': 'BLK',
          'block': 'BLK',
          'blk': 'BLK',
          'threes': '3PM',
          'three': '3PM',
          '3pt': '3PM',
          '3-pointer': '3PM',
          '3pm': '3PM',
          'turnovers': 'TOV',
          'turnover': 'TOV',
          'tov': 'TOV',
        };
        
        const normalized = betType.toLowerCase().replace(/\s+/g, '');
        return betTypeMap[normalized] || betType.toUpperCase();
      };
      
      // Group props by bet type and get the best one (prefer over, then highest line)
      const propsByType = new Map<string, typeof mostRecentProps>();
      mostRecentProps.forEach(prop => {
        const betType = prop.bet_type.toLowerCase();
        if (!propsByType.has(betType)) {
          propsByType.set(betType, []);
        }
        propsByType.get(betType)!.push(prop);
      });
      
      // Process each bet type
      propsByType.forEach((props, betType) => {
        // Find boxscore for any of these props (they should all be from the same game)
        const firstProp = props[0];
        const boxscore = boxscoreMap.get(firstProp.game_id);
        
        if (!boxscore) {
          return; // No boxscore for this game
        }
        
        // Get the NBA game_id for this prop
        const nbaGameId = propsGameIdToNbaGameId.get(firstProp.game_id);
        if (!nbaGameId) {
          return; // No matching NBA game
        }
        
        // Determine if this is an over or under prop
        const betTypeId = firstProp.bet_type_id || '';
        const isOver = betTypeId.includes('-over') || betTypeId.endsWith('over') || 
                      betTypeId.toLowerCase().includes('over');
        const isUnder = betTypeId.includes('-under') || betTypeId.endsWith('under') || 
                       betTypeId.toLowerCase().includes('under');
        
        // Get the best prop (prefer over, then highest line for over, lowest for under)
        let bestProp = props[0];
        if (isOver) {
          bestProp = props.reduce((best, current) => {
            const currentLine = current.line || 0;
            const bestLine = best.line || 0;
            return currentLine > bestLine ? current : best;
          });
        } else if (isUnder) {
          bestProp = props.reduce((best, current) => {
            const currentLine = current.line || Infinity;
            const bestLine = best.line || Infinity;
            return currentLine < bestLine ? current : best;
          });
        }
        
        // Calculate result
        const result = calculatePropResult(bestProp.bet_type, bestProp.line || 0, boxscore);
        
        if (!result) {
          return; // Couldn't calculate result
        }
        
        // Determine if this was a hit or miss
        // Over = hit if actual > line, Under = hit if actual < line
        const hit = isOver ? result.result === 'over' : result.result === 'under';
        
        if (hit) {
          hits++;
        } else if (result.result !== 'push') {
          misses++;
        }
        
        propResults.push({
          betType: bestProp.bet_type,
          displayName: formatBetType(bestProp.bet_type),
          line: bestProp.line || 0,
          overUnder: isOver ? 'O' : isUnder ? 'U' : 'O',
          actualValue: result.actualValue,
          hit,
          result: result.result,
          gameDate: mostRecentDate,
          gameId: nbaGameId,
        });
      });
      
      if (propResults.length === 0) {
        return null;
      }
      
      // Calculate hit rate
      const totalProps = hits + misses; // Exclude pushes
      const hitRate = totalProps > 0 ? (hits / totalProps) * 100 : 0;
      
      return {
        gameDate: mostRecentDate,
        gameId: propResults[0].gameId,
        totalProps,
        hits,
        misses,
        hitRate,
        propResults,
      };
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

