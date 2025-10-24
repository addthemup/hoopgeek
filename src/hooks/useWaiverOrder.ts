import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

// Get waiver order for all teams in a league
export function useLeagueWaiverOrder(leagueId: string, seasonId: string) {
  return useQuery({
    queryKey: ['league-waiver-order', leagueId, seasonId],
    queryFn: async () => {
      console.log('📋 Fetching waiver order for league:', { leagueId, seasonId });

      const { data, error } = await supabase
        .from('fantasy_waiver_order')
        .select(`
          id,
          fantasy_team_id,
          waiver_priority,
          remaining_budget,
          total_spent,
          fantasy_teams!fantasy_team_id(
            id,
            team_name,
            user_id
          )
        `)
        .eq('league_id', leagueId)
        .eq('season_id', seasonId)
        .order('waiver_priority', { ascending: true });

      if (error) {
        console.error('❌ Error fetching waiver order:', error);
        throw error;
      }

      console.log('✅ Waiver order fetched:', data?.length || 0, 'teams');
      return data || [];
    },
    enabled: !!leagueId && !!seasonId,
    staleTime: 1000 * 60, // 1 minute
  });
}

