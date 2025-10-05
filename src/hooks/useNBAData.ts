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

export function usePlayersPaginated(page: number = 1, pageSize: number = 25, filters: { search?: string; position?: string; team?: string; showInactive?: boolean; leagueId?: string } = {}) {
  return useQuery({
    queryKey: ['players-paginated', page, pageSize, filters, filters.leagueId],
    queryFn: async () => {
      console.log(`🏀 Fetching players page ${page} (${pageSize} per page)...`)
      
      let query = supabase
        .from('players')
        .select('*', { count: 'exact' })
        .order('name')

      // Apply search filter
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,team_name.ilike.%${filters.search}%,team_abbreviation.ilike.%${filters.search}%`)
      }

      // Apply position filter
      if (filters.position) {
        query = query.eq('position', filters.position)
      }

      // Apply team filter
      if (filters.team) {
        query = query.eq('team_abbreviation', filters.team)
      }

      // Apply active/inactive filter - by default only show active players
      if (filters.showInactive === false || filters.showInactive === undefined) {
        query = query.eq('is_active', true)
      }

      // Exclude drafted players if leagueId is provided
      if (filters.leagueId) {
        // Get list of drafted player IDs for this league
        const { data: draftedPlayers, error: draftedError } = await supabase
          .from('draft_picks')
          .select('player_id')
          .eq('league_id', filters.leagueId)

        if (draftedError) {
          console.error('Error fetching drafted players:', draftedError)
        } else if (draftedPlayers && draftedPlayers.length > 0) {
          const draftedPlayerIds = draftedPlayers.map(dp => dp.player_id)
          query = query.not('id', 'in', `(${draftedPlayerIds.join(',')})`)
          console.log(`🚫 Excluding ${draftedPlayerIds.length} drafted players from pool`)
        }
      }

      // Apply pagination
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error('❌ Error fetching paginated players:', error)
        throw new Error(`Error fetching players: ${error.message}`)
      }

      const totalPages = Math.ceil((count || 0) / pageSize)

      console.log(`✅ Successfully fetched page ${page}/${totalPages} (${data?.length || 0} players)`)
      
      return {
        players: data as Player[],
        totalCount: count || 0,
        totalPages,
        currentPage: page,
        hasMore: page < totalPages,
        hasPreviousPage: page > 1
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes for paginated data
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
