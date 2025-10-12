import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export function usePendingTradesCount(teamId: string | undefined) {
  return useQuery({
    queryKey: ['pending-trades-count', teamId],
    queryFn: async () => {
      if (!teamId) return 0

      const { data, error } = await supabase
        .rpc('get_pending_trades_count', { team_id_param: teamId })

      if (error) {
        console.error('Error fetching pending trades count:', error)
        return 0
      }

      return data as number
    },
    enabled: !!teamId,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  })
}

