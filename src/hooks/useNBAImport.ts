import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

interface ImportStats {
  total: number
  imported: number
  updated: number
  errors: number
}

interface ImportResponse {
  message: string
  stats: ImportStats
}

export const useImportNBAPlayers = () => {
  const queryClient = useQueryClient()

  return useMutation<ImportResponse, Error, void>({
    mutationFn: async () => {
      console.log('🚀 Starting NBA players import...')
      
      const { data, error } = await supabase.functions.invoke('import-nba-players', {
        method: 'POST',
      })

      if (error) {
        console.error('❌ Supabase Function Error:', error)
        throw new Error(`Edge Function returned an error: ${error.message}`)
      }

      if (data.error) {
        console.error('❌ Edge Function returned error data:', data.error)
        throw new Error(`Edge Function error: ${data.error}`)
      }

      console.log('✅ Import successful:', data)
      return data as ImportResponse
    },
    onSuccess: () => {
      // Invalidate and refetch players data
      queryClient.invalidateQueries({ queryKey: ['players'] })
      queryClient.invalidateQueries({ queryKey: ['nbaPlayers'] })
    },
  })
}
