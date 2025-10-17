import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export function usePendingTradesCount(teamId: string | undefined, leagueId?: string) {
  return useQuery({
    queryKey: ['pending-trades-count', teamId, leagueId],
    queryFn: async () => {
      if (!teamId || !leagueId) return 0

      console.log('🔢 Fetching pending trades count for team:', teamId, 'league:', leagueId)

      // Use the same RPC function as usePendingTrades for consistency
      const { data, error } = await supabase.rpc('get_pending_draft_trades', {
        p_team_id: teamId,
        p_league_id: leagueId,
      });

      if (error) {
        console.error('❌ Error fetching pending trades count:', error)
        return 0
      }

      const count = data?.length || 0
      console.log('🔢 Pending trades count result:', count, 'data length:', data?.length)
      return count
    },
    enabled: !!teamId && !!leagueId,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  })
}

