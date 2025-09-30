import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { nbaApi, NBAPlayer } from '../utils/nbaApi'

export function usePlayers() {
  return useQuery({
    queryKey: ['nba-players'],
    queryFn: () => nbaApi.getPlayers(),
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
    mutationFn: () => nbaApi.syncPlayers(),
    onSuccess: () => {
      // Invalidate and refetch players data
      queryClient.invalidateQueries({ queryKey: ['nba-players'] })
    },
  })
}

export function usePlayersByPosition() {
  const { data: players, ...rest } = usePlayers()
  
  const playersByPosition = players?.reduce((acc, player) => {
    const position = player.position
    if (!acc[position]) {
      acc[position] = []
    }
    acc[position].push(player)
    return acc
  }, {} as Record<string, NBAPlayer[]>)
  
  return {
    playersByPosition,
    ...rest
  }
}

export function usePlayersByTeam() {
  const { data: players, ...rest } = usePlayers()
  
  const playersByTeam = players?.reduce((acc, player) => {
    const team = player.team
    if (!acc[team]) {
      acc[team] = []
    }
    acc[team].push(player)
    return acc
  }, {} as Record<string, NBAPlayer[]>)
  
  return {
    playersByTeam,
    ...rest
  }
}
