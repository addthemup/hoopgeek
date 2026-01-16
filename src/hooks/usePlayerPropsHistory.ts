import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerPropHistoryData {
  game_date: string;
  bet_type: string;
  line?: number; // Optional - only present if props exist for this date+type
  displayName: string;
  actualValue?: number; // Actual performance value for this prop type on this date
}

/**
 * Hook to fetch all player props history for a player
 * Groups by bet_type and game_date to show prop lines over time
 */
export function usePlayerPropsHistory(playerId: string, playerName: string) {
  return useQuery({
    queryKey: ['player-props-history', playerId, playerName],
    queryFn: async (): Promise<PlayerPropHistoryData[]> => {
      if (!playerId) return [];

      // Get player's nba_player_id
      const { data: playerData } = await supabase
        .from('nba_players')
        .select('nba_player_id, name')
        .eq('id', playerId)
        .single();

      if (!playerData?.nba_player_id) return [];

      const nbaPlayerId = playerData.nba_player_id;
      const playerNameMatch = playerData.name || playerName || '';

      // Build query conditions
      const orConditions: string[] = [];
      if (playerId) {
        orConditions.push(`player_id.eq.${playerId}`);
      }
      if (nbaPlayerId) {
        orConditions.push(`nba_player_id.eq.${nbaPlayerId}`);
      }
      if (playerNameMatch) {
        orConditions.push(`player_name.ilike.%${playerNameMatch}%`);
      }

      if (orConditions.length === 0) return [];

      // Fetch all props for this player, ordered by date
      const { data: propsData, error } = await supabase
        .from('player_props')
        .select('bet_type, line, game_date')
        .or(orConditions.join(','))
        .order('game_date', { ascending: true })
        .order('bet_type', { ascending: true });

      if (error || !propsData) {
        console.error('Error fetching player props history:', error);
        return [];
      }

      // Format bet type names
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
          'threepointersmade': '3PM',
          'turnovers': 'TOV',
          'turnover': 'TOV',
          'tov': 'TOV',
          'points_rebounds': 'PTS+REB',
          'points+rebounds': 'PTS+REB',
          'points_assists': 'PTS+AST',
          'points+assists': 'PTS+AST',
          'rebounds_assists': 'REB+AST',
          'rebounds+assists': 'REB+AST',
          'points_rebounds_assists': 'PAR',
          'points+rebounds+assists': 'PAR',
          'blocks+steals': 'STOCKS',
          'blocks_steals': 'STOCKS',
          'steals+blocks': 'STOCKS',
          'steals_blocks': 'STOCKS',
          'stocks': 'STOCKS',
        };

        const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+');
        return betTypeMap[normalized] || betType.toUpperCase();
      };

      // FIRST: Fetch ALL boxscores for this player (regardless of props)
      // This is the source of truth - we want to plot all games
      let allBoxscores = null;
      let boxscoreError = null;
      
      // First try with player_id (UUID) - same as PlayerPage game logs
      if (playerId) {
        const { data, error } = await supabase
          .from('nba_boxscores')
          .select('game_date, pts, reb, ast, stl, blk, tov, fg3m, ftm, game_id')
          .eq('player_id', playerId)
          .order('game_date', { ascending: true });
        
        if (!error && data && data.length > 0) {
          allBoxscores = data;
        } else {
          boxscoreError = error;
        }
      }
      
      // If no results with player_id, try nba_player_id
      if ((!allBoxscores || allBoxscores.length === 0) && nbaPlayerId) {
        const { data, error } = await supabase
          .from('nba_boxscores')
          .select('game_date, pts, reb, ast, stl, blk, tov, fg3m, ftm, game_id')
          .eq('nba_player_id', nbaPlayerId)
          .order('game_date', { ascending: true });
        
        if (!error && data) {
          allBoxscores = data;
          boxscoreError = null;
        } else if (error) {
          boxscoreError = error;
        }
      }
      
      console.log('📊 All boxscores for player:', allBoxscores?.length || 0);
      
      if (boxscoreError) {
        console.error('❌ Error fetching boxscores:', boxscoreError);
      }

      // Process props: Group by game_date and bet_type, average lines for same type on same date
      const propsByDateAndType = new Map<string, { game_date: string; bet_type: string; lines: number[]; displayName: string }>();
      
      propsData
        .filter(prop => prop.line !== null && prop.line !== undefined)
        .forEach(prop => {
          const dateKey = typeof prop.game_date === 'string' 
            ? prop.game_date.split('T')[0] 
            : String(prop.game_date).split('T')[0];
          const key = `${dateKey}_${prop.bet_type}`;
          const displayName = formatBetType(prop.bet_type);
          
          if (!propsByDateAndType.has(key)) {
            propsByDateAndType.set(key, {
              game_date: dateKey,
              bet_type: prop.bet_type,
              lines: [],
              displayName,
            });
          }
          
          propsByDateAndType.get(key)!.lines.push(Number(prop.line));
        });
      
      console.log('📊 Props found:', propsByDateAndType.size, 'unique date+type combinations');

      // Get all unique bet types from props (to know what to calculate)
      const allBetTypes = [...new Set(propsData.map(p => p.bet_type))];
      console.log('📊 Unique bet types found in props:', allBetTypes);
      
      // If no boxscores, return empty array
      if (!allBoxscores || allBoxscores.length === 0) {
        console.log('⚠️ No boxscores found for player');
        return [];
      }
      
      // Create a map of game_date -> boxscore stats
      // Normalize dates to YYYY-MM-DD format for matching
      const boxscoreMap = new Map<string, { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fg3m: number; ftm: number }>();
      allBoxscores.forEach(bs => {
        // Normalize date to YYYY-MM-DD format
        const dateKey = typeof bs.game_date === 'string' 
          ? bs.game_date.split('T')[0] 
          : String(bs.game_date).split('T')[0];
        
        boxscoreMap.set(dateKey, {
          pts: Number(bs.pts) || 0,
          reb: Number(bs.reb) || 0,
          ast: Number(bs.ast) || 0,
          stl: Number(bs.stl) || 0,
          blk: Number(bs.blk) || 0,
          tov: Number(bs.tov) || 0,
          fg3m: Number(bs.fg3m) || 0,
          ftm: Number(bs.ftm) || 0,
        });
      });
      
      console.log('📊 Boxscore map size:', boxscoreMap.size, 'keys:', Array.from(boxscoreMap.keys()).slice(0, 5), '...');

      // Calculate actual value for each prop type
      const calculateActualValue = (betType: string, stats: { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fg3m: number; ftm: number }): number | null => {
        const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+');
        
        // Combined props
        if (normalized.includes('points+rebounds+assists') || normalized.includes('par')) {
          return stats.pts + stats.reb + stats.ast;
        } else if (normalized.includes('points+rebounds') || normalized.includes('pts+reb')) {
          return stats.pts + stats.reb;
        } else if (normalized.includes('points+assists') || normalized.includes('pts+ast')) {
          return stats.pts + stats.ast;
        } else if (normalized.includes('rebounds+assists') || normalized.includes('reb+ast')) {
          return stats.reb + stats.ast;
        } else if (normalized.includes('blocks+steals') || normalized.includes('stocks')) {
          return stats.blk + stats.stl;
        } else {
          // Single stat props
          const betTypeMap: Record<string, keyof typeof stats> = {
            'points': 'pts',
            'point': 'pts',
            'pts': 'pts',
            'rebounds': 'reb',
            'rebound': 'reb',
            'reb': 'reb',
            'assists': 'ast',
            'assist': 'ast',
            'ast': 'ast',
            'steals': 'stl',
            'steal': 'stl',
            'stl': 'stl',
            'blocks': 'blk',
            'block': 'blk',
            'blk': 'blk',
            'turnovers': 'tov',
            'turnover': 'tov',
            'tov': 'tov',
            'threes': 'fg3m',
            'three': 'fg3m',
            '3pt': 'fg3m',
            '3-pointer': 'fg3m',
            '3pm': 'fg3m',
            'threepointersmade': 'fg3m',
            'free-throws': 'ftm',
            'free-throw': 'ftm',
            'ftm': 'ftm',
          };
          
          const field = betTypeMap[normalized];
          if (!field) return null;
          
          return stats[field] ?? 0;
        }
      };

      // Build result: For EACH boxscore game, calculate actual values for ALL bet types
      // Then add prop lines where they exist
      const result: PlayerPropHistoryData[] = [];
      
      // Get all unique dates from boxscores (this is our source of truth)
      const allGameDates = Array.from(boxscoreMap.keys()).sort();
      console.log('📊 Processing', allGameDates.length, 'games from boxscores');
      
      // For each game date, create entries for all bet types we've seen in props
      allGameDates.forEach(gameDate => {
        const stats = boxscoreMap.get(gameDate);
        if (!stats) return;
        
        // For each bet type we've seen in props, calculate actual value
        allBetTypes.forEach(betType => {
          const actualValue = calculateActualValue(betType, stats);
          const displayName = formatBetType(betType);
          
          // Check if we have props for this date+type
          const propKey = `${gameDate}_${betType}`;
          const propData = propsByDateAndType.get(propKey);
          
          result.push({
            game_date: gameDate,
            bet_type: betType,
            line: propData ? propData.lines.reduce((sum, line) => sum + line, 0) / propData.lines.length : undefined, // Average if props exist
            displayName,
            actualValue: actualValue ?? undefined,
          });
        });
      });
      
      console.log('📊 Final result:', result.length, 'entries');
      console.log('📊 Entries with actual values:', result.filter(r => r.actualValue !== undefined).length);
      console.log('📊 Entries with prop lines:', result.filter(r => r.line !== undefined).length);
      
      return result;
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

