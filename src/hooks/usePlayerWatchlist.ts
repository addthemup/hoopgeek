import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export function usePlayerWatchlist(leagueId: string) {
  return useQuery({
    queryKey: ['player-watchlist', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_watchlist')
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
        .eq('league_id', leagueId)
        .order('added_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!leagueId,
  })
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ leagueId, playerId, notes }: { leagueId: string; playerId: number; notes?: string }) => {
      const { error } = await supabase
        .from('player_watchlist')
        .insert({
          league_id: leagueId,
          player_id: playerId,
          notes: notes || null
        })

      if (error) throw error
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['player-watchlist', leagueId] })
    },
  })
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ leagueId, playerId }: { leagueId: string; playerId: number }) => {
      const { error } = await supabase
        .from('player_watchlist')
        .delete()
        .eq('league_id', leagueId)
        .eq('player_id', playerId)

      if (error) throw error
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['player-watchlist', leagueId] })
    },
  })
}

export function useIsPlayerOnWatchlist(leagueId: string, playerId: number) {
  return useQuery({
    queryKey: ['player-watchlist-check', leagueId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_watchlist')
        .select('id')
        .eq('league_id', leagueId)
        .eq('player_id', playerId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return !!data
    },
    enabled: !!leagueId && !!playerId,
  })
}
