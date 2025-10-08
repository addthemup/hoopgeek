import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export function usePlayerFavorites() {
  return useQuery({
    queryKey: ['player-favorites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_favorites')
        .select(`
          id,
          player_id,
          added_at,
          notes,
          players (
            id,
            name,
            position,
            team_name,
            team_abbreviation
          )
        `)
        .order('added_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

export function useAddToFavorites() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ playerId, notes }: { playerId: number; notes?: string }) => {
      const { error } = await supabase
        .from('player_favorites')
        .insert({
          player_id: playerId,
          notes: notes || null
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-favorites'] })
    },
  })
}

export function useRemoveFromFavorites() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ playerId }: { playerId: number }) => {
      const { error } = await supabase
        .from('player_favorites')
        .delete()
        .eq('player_id', playerId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-favorites'] })
    },
  })
}

export function useIsPlayerFavorite(playerId: number) {
  return useQuery({
    queryKey: ['player-favorite-check', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_favorites')
        .select('id')
        .eq('player_id', playerId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return !!data
    },
    enabled: !!playerId,
  })
}
