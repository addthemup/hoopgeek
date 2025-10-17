import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export function useDraftState(leagueId: string) {
  return useQuery({
    queryKey: ['draft-state', leagueId],
    queryFn: async () => {
      // Fetch both draft state AND season info (for draft_date and draft_status)
      const [stateResult, seasonResult] = await Promise.all([
        supabase
          .from('fantasy_draft_current_state')
          .select('*')
          .eq('league_id', leagueId)
          .maybeSingle(),
        supabase
          .from('fantasy_league_seasons')
          .select('draft_date, draft_status, season_year')
          .eq('league_id', leagueId)
          .eq('is_active', true)
          .maybeSingle()
      ])

      const { data: stateData, error: stateError } = stateResult
      const { data: seasonData, error: seasonError } = seasonResult

      if (stateError) {
        console.error('Error fetching draft state:', stateError)
        throw new Error(`Failed to fetch draft state: ${stateError.message}`)
      }

      if (seasonError) {
        console.error('Error fetching season data:', seasonError)
        // Don't throw, just log - season data is supplementary
      }

      // Merge state data with season data
      const mergedData = {
        // From fantasy_draft_current_state
        ...stateData,
        // From fantasy_league_seasons (overwrites if exists)
        draft_date: seasonData?.draft_date || null,
        draft_status: seasonData?.draft_status || stateData?.draft_status || 'scheduled',
        season_year: seasonData?.season_year || null,
      }

      // Return default state if no record exists
      if (!stateData) {
        return {
          id: null,
          league_id: leagueId,
          season_id: null,
          current_pick_id: null,
          current_pick_number: null,
          current_round: null,
          draft_status: seasonData?.draft_status || 'scheduled',
          draft_date: seasonData?.draft_date || null,
          season_year: seasonData?.season_year || null,
          is_auto_pick_active: true,
          draft_started_at: null,
          draft_completed_at: null,
          last_activity_at: new Date().toISOString(),
          total_picks: 0,
          completed_picks: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }

      return mergedData
    },
    enabled: !!leagueId,
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  })
}

export function useToggleAutoPick() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ leagueId, isAutoPickActive }: { leagueId: string; isAutoPickActive: boolean }) => {
      const { data, error } = await supabase
        .from('fantasy_draft_current_state')
        .update({ is_auto_pick_active: isAutoPickActive })
        .eq('league_id', leagueId)
        .select()
        .maybeSingle()

      if (error) {
        console.error('Error toggling auto pick:', error)
        throw new Error(`Failed to toggle auto pick: ${error.message}`)
      }

      return data
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch draft state
      queryClient.invalidateQueries({ queryKey: ['draft-state', variables.leagueId] })
    },
  })
}

export function useToggleTeamAutoDraft() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ teamId, enabled }: { teamId: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('fantasy_teams')
        .update({ autodraft_enabled: enabled })
        .eq('id', teamId)
        .select()
        .single()

      if (error) {
        console.error('Error toggling team auto draft:', error)
        throw new Error(`Failed to toggle team auto draft: ${error.message}`)
      }

      return data
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch draft order to update team autodraft status
      queryClient.invalidateQueries({ queryKey: ['draft-order'] })
      // Also invalidate teams data
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}
