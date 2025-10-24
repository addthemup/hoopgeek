import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface PlayerFavorite {
  id: string
  player_id: string
  added_at: string
  notes: string | null
  nba_players: {
    id: string
    nba_player_id: number
    name: string
    position: string | null
    team_name: string | null
    team_abbreviation: string | null
  }
}

export function usePlayerFavorites() {
  return useQuery({
    queryKey: ['player-favorites'],
    queryFn: async () => {
      console.log('🌟 Fetching player favorites...')
      const { data, error } = await supabase
        .from('player_favorites')
        .select(`
          id,
          player_id,
          added_at,
          notes,
          nba_players (
            id,
            nba_player_id,
            name,
            position,
            team_name,
            team_abbreviation
          )
        `)
        .order('added_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching favorites:', error)
        throw error
      }
      
      console.log(`✅ Found ${data?.length || 0} favorite players`)
      return data as PlayerFavorite[]
    },
  })
}

export function useAddToFavorites() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ playerId, notes }: { playerId: string; notes?: string }) => {
      console.log(`🌟 Adding player ${playerId} to favorites`)
      const { error } = await supabase
        .from('player_favorites')
        .insert({
          player_id: playerId,
          notes: notes || null
        })

      if (error) {
        console.error('❌ Error adding to favorites:', error)
        throw error
      }
      console.log('✅ Added to favorites successfully')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-favorites'] })
      queryClient.invalidateQueries({ queryKey: ['player-favorite-check'] })
    },
  })
}

export function useRemoveFromFavorites() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ playerId }: { playerId: string }) => {
      console.log(`🌟 Removing player ${playerId} from favorites`)
      const { error } = await supabase
        .from('player_favorites')
        .delete()
        .eq('player_id', playerId)

      if (error) {
        console.error('❌ Error removing from favorites:', error)
        throw error
      }
      console.log('✅ Removed from favorites successfully')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-favorites'] })
      queryClient.invalidateQueries({ queryKey: ['player-favorite-check'] })
    },
  })
}

export function useIsPlayerFavorite(playerId: string) {
  return useQuery({
    queryKey: ['player-favorite-check', playerId],
    queryFn: async () => {
      if (!playerId) return false
      
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
