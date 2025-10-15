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
      
      // Query league_settings table directly instead of using RPC functions
      const { data: settingsData, error: settingsError } = await supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', leagueId)
        .single();
      
      console.log('🔧 useLineupSettings: Settings data:', settingsData);
      console.log('🔧 useLineupSettings: Settings error:', settingsError);
      
      if (settingsError) {
        console.error('Error fetching lineup settings:', settingsError);
        throw settingsError;
      }
      
      if (!settingsData) {
        console.log('🔧 useLineupSettings: No settings found for league');
        return null;
      }
      
      // Map the database fields to our interface
      const result: LineupSettings = {
        roster_positions: settingsData.roster_positions || {},
        starters_count: settingsData.starters_count || 5,
        starters_multiplier: settingsData.starters_multiplier || 1.0,
        rotation_count: settingsData.rotation_count || 5,
        rotation_multiplier: settingsData.rotation_multiplier || 0.75,
        bench_count: settingsData.bench_count || 3,
        bench_multiplier: settingsData.bench_multiplier || 0.5,
        scoring_type: settingsData.scoring_type || 'H2H_Points',
        lineup_deadline: settingsData.lineup_deadline || 'daily',
        lineup_lock_time: settingsData.lineup_lock_time || '00:00',
        fantasy_scoring_format: settingsData.fantasy_scoring_format || 'FanDuel',
        custom_scoring_categories: settingsData.custom_scoring_categories,
        scoring_categories: settingsData.scoring_categories || {},
        position_unit_assignments: settingsData.position_unit_assignments || {
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
