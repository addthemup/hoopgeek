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
      console.log(`🤖 Toggling autodraft for team ${teamId}: ${enabled}`);
      
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

      // If disabling autodraft, extend the timer for current pick if this team is on the clock
      if (!enabled) {
        console.log('⏱️ Autodraft disabled - checking if team is on the clock...');
        
        // Get the team's league_id
        const { data: team } = await supabase
          .from('fantasy_teams')
          .select('league_id')
          .eq('id', teamId)
          .single();
        
        if (team) {
          // Get current draft state
          const { data: draftState } = await supabase
            .from('fantasy_draft_current_state')
            .select('current_pick_id')
            .eq('league_id', team.league_id)
            .single();
          
          if (draftState?.current_pick_id) {
            // Check if this pick belongs to the team we're toggling
            const { data: currentPick } = await supabase
              .from('fantasy_draft_order')
              .select('fantasy_team_id, time_expires')
              .eq('id', draftState.current_pick_id)
              .single();
            
            if (currentPick && currentPick.fantasy_team_id === teamId && currentPick.time_expires) {
              console.log('⏱️ Team is on the clock! Extending timer...');
              
              // Get league settings for full time
              const { data: league } = await supabase
                .from('fantasy_leagues')
                .select('draft_time_per_pick')
                .eq('id', team.league_id)
                .single();
              
              const fullTime = league?.draft_time_per_pick || 60;
              const newExpiresAt = new Date(Date.now() + fullTime * 1000);
              
              // Extend the timer
              await supabase
                .from('fantasy_draft_order')
                .update({
                  time_started: new Date().toISOString(),
                  time_expires: newExpiresAt.toISOString()
                })
                .eq('id', draftState.current_pick_id);
              
              console.log(`✅ Timer extended to ${fullTime}s for team ${teamId}`);
            }
          }
        }
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
