import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface LineupSettings {
  roster_positions: Record<string, number>;
  starters_count: number;
  starters_multiplier: number;
  rotation_count: number;
  rotation_multiplier: number;
  bench_count: number;
  bench_multiplier: number;
  scoring_type: string;
  lineup_deadline: string;
  lineup_lock_time: string;
  fantasy_scoring_format: string;
  custom_scoring_categories: Record<string, number> | null;
  scoring_categories: Record<string, number>;
  position_unit_assignments: {
    starters: Record<string, number>;
    rotation: Record<string, number>;
    bench: Record<string, number>;
  };
}

export function useLineupSettings(leagueId: string) {
  return useQuery<LineupSettings | null, Error>({
    queryKey: ['lineup-settings', leagueId],
    queryFn: async () => {
      if (!leagueId) return null;
      
      console.log('🔧 useLineupSettings: Fetching settings for leagueId:', leagueId);
      
      // Query fantasy_leagues table for basic league settings
      const { data: leagueData, error: leagueError } = await supabase
        .from('fantasy_leagues')
        .select('*')
        .eq('id', leagueId)
        .single();
      
      if (leagueError) {
        console.error('Error fetching league data:', leagueError);
        throw leagueError;
      }
      
      if (!leagueData) {
        console.log('🔧 useLineupSettings: No league found');
        return null;
      }

      // Query fantasy_league_seasons table for season-specific settings
      const { data: seasonData, error: seasonError } = await supabase
        .from('fantasy_league_seasons')
        .select('*')
        .eq('league_id', leagueId)
        .eq('is_active', true)
        .single();
      
      console.log('🔧 useLineupSettings: League data:', leagueData);
      console.log('🔧 useLineupSettings: Season data:', seasonData);
      console.log('🔧 useLineupSettings: Season error:', seasonError);
      
      // Map the database fields to our interface
      const result: LineupSettings = {
        roster_positions: seasonData?.roster_positions || {},
        starters_count: seasonData?.starters_count || 5,
        starters_multiplier: seasonData?.starters_multiplier || 1.0,
        rotation_count: seasonData?.rotation_count || 5,
        rotation_multiplier: seasonData?.rotation_multiplier || 0.75,
        bench_count: seasonData?.bench_count || 3,
        bench_multiplier: seasonData?.bench_multiplier || 0.5,
        scoring_type: leagueData.scoring_type || 'H2H_Weekly',
        lineup_deadline: seasonData?.lineup_deadline || 'daily',
        lineup_lock_time: seasonData?.lineup_lock_time || '00:00',
        fantasy_scoring_format: leagueData.fantasy_scoring_format || 'FanDuel',
        custom_scoring_categories: seasonData?.custom_scoring_categories,
        scoring_categories: seasonData?.scoring_categories || {},
        position_unit_assignments: seasonData?.position_unit_assignments || {
          starters: {},
          rotation: {},
          bench: {}
        }
      };
      
      console.log('🔧 useLineupSettings: Mapped result:', result);
      
      return result;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
