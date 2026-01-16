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
      const { data, error } = await supabase
        .from('player_favorites')
        .insert({
          player_id: playerId,
          notes: notes || null
        })
        .select()
        .single()

      if (error) {
        // Check if it's a unique constraint violation (duplicate insert)
        // Error code 23505 is PostgreSQL unique_violation
        // Also check error message for duplicate/unique constraint keywords
        const isDuplicateError = 
          error.code === '23505' || 
          error.code === 'PGRST116' ||
          error.message?.toLowerCase().includes('duplicate') ||
          error.message?.toLowerCase().includes('unique constraint') ||
          error.message?.toLowerCase().includes('already exists')
        
        if (isDuplicateError) {
          console.log('✅ Player already in favorites (duplicate insert ignored)', { error })
          // Treat as success - player is already favorited
          return { id: 'duplicate', player_id: playerId } // Return a mock object so mutation succeeds
        }
        console.error('❌ Error adding to favorites:', error)
        throw error
      }
      console.log('✅ Added to favorites successfully')
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['player-favorites'] })
      queryClient.invalidateQueries({ queryKey: ['player-favorite-check'] })
      queryClient.invalidateQueries({ queryKey: ['player-favorite-count', variables.playerId] })
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['player-favorites'] })
      queryClient.invalidateQueries({ queryKey: ['player-favorite-check'] })
      queryClient.invalidateQueries({ queryKey: ['player-favorite-count', variables.playerId] })
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

export function usePlayerFavoriteCount(playerId: string) {
  return useQuery({
    queryKey: ['player-favorite-count', playerId],
    queryFn: async () => {
      if (!playerId) return 0
      
      // Try the database function first, but fallback to direct query if it doesn't exist
      const { data, error } = await supabase
        .rpc('get_player_favorite_count', { p_player_id: playerId })

      // If function doesn't exist (PGRST202) or any other error, use fallback
      if (error) {
        // Only log if it's not a "function not found" error
        if (error.code !== 'PGRST202') {
          console.error('❌ Error fetching favorite count:', error)
        }
        // Fallback to direct query
        const { count } = await supabase
          .from('player_favorites')
          .select('*', { count: 'exact', head: true })
          .eq('player_id', playerId)
        return count || 0
      }
      
      return data || 0
    },
    enabled: !!playerId,
  })
}
