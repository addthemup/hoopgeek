import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

/**
 * Hook for auto-completing a draft (DEVELOPMENT TOOL)
 * Starts the draft and enables auto-draft for all teams
 * WARNING: This is for testing purposes only
 */
export function useStartDraft() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (leagueId: string) => {
      console.log('🚀 useStartDraft called with leagueId:', leagueId);
      
      // Start the draft
      const { data, error } = await supabase
        .rpc('start_draft_manually', {
          league_id_param: leagueId
        })

      if (error) {
        console.error('Error auto-completing draft:', error)
        throw new Error(`Failed to auto-complete draft: ${error.message}`)
      }

      // Trigger draft-manager to start processing immediately
      console.log('🚀 Triggering draft-manager to start processing...')
      try {
        const { data: managerData, error: managerError } = await supabase.functions.invoke('draft-manager', {
          body: { trigger: 'manual_start', league_id: leagueId }
        })
        
        if (managerError) {
          console.warn('⚠️ Draft-manager trigger failed (this is normal):', managerError)
        } else {
          console.log('✅ Draft-manager triggered successfully:', managerData)
        }
      } catch (triggerError) {
        console.warn('⚠️ Draft-manager trigger failed (this is normal):', triggerError)
      }

      return data
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch draft state and order
      queryClient.invalidateQueries({ queryKey: ['draft-state', variables] })
      queryClient.invalidateQueries({ queryKey: ['draft-order', variables] })
      queryClient.invalidateQueries({ queryKey: ['league', variables] })
      queryClient.invalidateQueries({ queryKey: ['teams', variables] })
    },
  })
}
