import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { UpdateLeagueSettingsFormData } from '../types/leagueSettings'

export function useUpdateLeagueSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ leagueId, settings }: { leagueId: string; settings: UpdateLeagueSettingsFormData }) => {
      console.log('🏀 Updating league settings...', { leagueId, settings })
      
      // Update the league with the new settings
      const { data, error } = await supabase
        .from('leagues')
        .update(settings)
        .eq('id', leagueId)
        .select()
        .single()

      if (error) {
        console.error('❌ Error updating league settings:', error)
        throw new Error(`Failed to update league settings: ${error.message}`)
      }

      console.log('✅ League settings updated successfully:', data)
      return data
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['league', variables.leagueId] })
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}
