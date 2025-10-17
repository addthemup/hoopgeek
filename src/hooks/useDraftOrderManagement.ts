import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface DraftOrderPick {
  id: string
  league_id: string
  round: number
  pick_number: number
  team_position: number
  player_id?: number
  is_completed: boolean
  created_at: string
}

export function useRegenerateDraftOrder() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      leagueId, 
      totalRounds = 15 
    }: { 
      leagueId: string; 
      totalRounds?: number 
    }) => {
      const { data, error } = await supabase
        .rpc('regenerate_draft_order', {
          league_id_param: leagueId,
          total_rounds: totalRounds
        })

      if (error) throw error
      return data
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['draft-order', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['league-teams', leagueId] })
    },
  })
}

export function useUpdateDraftOrder() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      leagueId, 
      picks 
    }: { 
      leagueId: string; 
      picks: Array<{
        round: number;
        pick_number: number;
        team_position: number;
      }>
    }) => {
      // First, clear existing draft order
      const { error: deleteError } = await supabase
        .from('fantasy_draft_order')
        .delete()
        .eq('league_id', leagueId)

      if (deleteError) throw deleteError

      // Then insert new draft order
      const { data, error } = await supabase
        .from('fantasy_draft_order')
        .insert(
          picks.map(pick => ({
            league_id: leagueId,
            round: pick.round,
            pick_number: pick.pick_number,
            team_position: pick.team_position,
            is_completed: false
          }))
        )
        .select()

      if (error) throw error
      return data
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['draft-order', leagueId] })
      queryClient.invalidateQueries({ queryKey: ['league-teams', leagueId] })
    },
  })
}

export function useSwapDraftPicks() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      leagueId, 
      pick1Id, 
      pick2Id 
    }: { 
      leagueId: string; 
      pick1Id: string; 
      pick2Id: string 
    }) => {
      // Get both picks
      const { data: picks, error: fetchError } = await supabase
        .from('fantasy_draft_order')
        .select('*')
        .in('id', [pick1Id, pick2Id])
        .eq('league_id', leagueId)

      if (fetchError) throw fetchError

      if (!picks || picks.length !== 2) {
        throw new Error('Could not find both picks to swap')
      }

      const [pick1, pick2] = picks

      // Swap the team positions
      const { error: updateError } = await supabase
        .from('fantasy_draft_order')
        .update([
          { team_position: pick2.team_position },
          { team_position: pick1.team_position }
        ])
        .in('id', [pick1Id, pick2Id])

      if (updateError) throw updateError
      return true
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['draft-order', leagueId] })
    },
  })
}
