import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface DraftOrderPick {
  pick_number: number
  round: number
  team_position: number
  team_id: string
  team_name: string
  is_completed: boolean
  player_id?: number
  player_name?: string
  position?: string
  team_abbreviation?: string
}

export function useDraftOrder(leagueId: string) {
  return useQuery({
    queryKey: ['draft-order', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_draft_order', { league_id_param: leagueId })

      if (error) {
        console.error('Error fetching draft order:', error)
        throw new Error(`Failed to fetch draft order: ${error.message}`)
      }

      // Get completed picks with player data
      const { data: completedPicks, error: picksError } = await supabase
        .from('draft_picks')
        .select(`
          pick_number,
          player_id,
          players!inner (
            id,
            name,
            position,
            team_abbreviation
          )
        `)
        .eq('league_id', leagueId)

      if (picksError) {
        console.error('Error fetching completed picks:', picksError)
        // Don't throw error, just continue without player data
      }

      // Merge draft order with completed picks
      const picksWithPlayers: DraftOrderPick[] = data.map((pick: any) => {
        const completedPick = completedPicks?.find(p => p.pick_number === pick.pick_number)
        
        return {
          ...pick,
          player_id: completedPick?.player_id,
          player_name: completedPick?.players?.name,
          position: completedPick?.players?.position,
          team_abbreviation: completedPick?.players?.team_abbreviation,
          is_completed: !!completedPick
        }
      })

      return picksWithPlayers
    },
    enabled: !!leagueId,
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  })
}
