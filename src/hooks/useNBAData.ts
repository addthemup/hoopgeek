import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { Player } from '../types'

export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      console.log('🏀 Fetching players from database...')
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name')

      if (error) {
        console.error('❌ Error fetching players:', error)
        throw new Error(`Error fetching players: ${error.message}`)
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} players`)
      console.log('📊 Sample player data:', data?.slice(0, 3))
      
      return data as Player[]
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  })
}

export function usePlayerStats(playerId: string) {
  return useQuery({
    queryKey: ['nba-player', playerId],
    queryFn: () => nbaApi.getPlayerStats(playerId),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 15, // 15 minutes
  })
}

export function useSyncPlayers() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-nba-players', {
        method: 'POST',
      })

      if (error) {
        throw new Error(`Edge Function returned an error: ${error.message}`)
      }

      if (data.error) {
        throw new Error(`Edge Function error: ${data.error}`)
      }

      return data
    },
    onSuccess: () => {
      // Invalidate and refetch players data
      queryClient.invalidateQueries({ queryKey: ['players'] })
    },
  })
}

export function usePlayersByPosition() {
  const { data: players, ...rest } = usePlayers()
  
  const playersByPosition = players?.reduce((acc, player) => {
    const position = player.position || 'Unknown'
    if (!acc[position]) {
      acc[position] = []
    }
    acc[position].push(player)
    return acc
  }, {} as Record<string, Player[]>)
  
  return {
    playersByPosition,
    ...rest
  }
}

export function usePlayersByTeam() {
  const { data: players, ...rest } = usePlayers()
  
  const playersByTeam = players?.reduce((acc, player) => {
    const team = player.team_name || 'Unknown'
    if (!acc[team]) {
      acc[team] = []
    }
    acc[team].push(player)
    return acc
  }, {} as Record<string, Player[]>)
  
  return {
    playersByTeam,
    ...rest
  }
}
