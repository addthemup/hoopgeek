import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export function useDeleteLeague() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (leagueId: string) => {
      console.log('🗑️ Deleting league:', leagueId)
      
      // Delete the league - this will cascade delete all related data due to foreign key constraints
      const { error } = await supabase
        .from('fantasy_leagues')
        .delete()
        .eq('id', leagueId)

      if (error) {
        console.error('❌ Error deleting league:', error)
        throw new Error(`Failed to delete league: ${error.message}`)
      }

      console.log('✅ League deleted successfully')
    },
    onSuccess: () => {
      // Invalidate all league-related queries
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
      queryClient.invalidateQueries({ queryKey: ['userLeagues'] })
      queryClient.invalidateQueries({ queryKey: ['league-members'] })
      queryClient.invalidateQueries({ queryKey: ['league-settings'] })
    },
  })
}
