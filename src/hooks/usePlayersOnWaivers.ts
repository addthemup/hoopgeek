import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface PlayerOnWaivers {
  player_id: string;
  player_name: string;
  player_position: string;
  player_team: string;
  waiver_status: 'on_waivers' | 'free_agent' | 'claimed';
  becomes_free_agent_at: string;
  dropped_by_team_name: string;
  dropped_at: string;
}

export function usePlayersOnWaivers(leagueId: string, seasonId: string) {
  return useQuery({
    queryKey: ['players-on-waivers', leagueId, seasonId],
    queryFn: async () => {
      console.log('🔍 Fetching players on waivers for league:', leagueId);

      const { data, error } = await supabase.rpc('get_available_players_for_league', {
        league_id_param: leagueId,
        season_id_param: seasonId
      });

      if (error) {
        console.error('❌ Error fetching players on waivers:', error);
        throw new Error(error.message || 'Failed to fetch players on waivers');
      }

      console.log('✅ Players on waivers fetched:', data);
      return data as PlayerOnWaivers[];
    },
    enabled: !!leagueId && !!seasonId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// Hook to check if a specific player is on waivers
export function usePlayerWaiverStatus(playerId: string, leagueId: string, seasonId: string) {
  return useQuery({
    queryKey: ['player-waiver-status', playerId, leagueId, seasonId],
    queryFn: async () => {
      if (!playerId || !leagueId || !seasonId) return null;

      console.log('🔍 Checking waiver status for player:', playerId);

      const { data, error } = await supabase
        .from('fantasy_players_on_waivers')
        .select('*')
        .eq('player_id', playerId)
        .eq('league_id', leagueId)
        .eq('season_id', seasonId)
        .in('waiver_status', ['on_waivers', 'free_agent'])
        .maybeSingle();

      if (error) {
        console.error('❌ Error checking player waiver status:', error);
        return null;
      }

      console.log('✅ Player waiver status:', data);
      return data;
    },
    enabled: !!playerId && !!leagueId && !!seasonId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

