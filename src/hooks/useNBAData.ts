import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { Player } from '../types'

export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      console.log('🏀 Fetching players from database...')
      
      const { data, error } = await supabase
        .from('nba_players')
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

// Updated to include salary filter and proper pagination
export function usePlayersPaginated(
  page: number = 1, 
  pageSize: number = 25, 
  filters: { 
    search?: string; 
    position?: string; 
    team?: string; 
    salary?: string; 
    showInactive?: boolean; 
    leagueId?: string 
  } = {}
) {
  return useQuery({
    queryKey: ['players-paginated', page, pageSize, filters, filters.leagueId],
    queryFn: async () => {
      console.log(`🏀 Fetching players page ${page} (${pageSize} per page)...`)
      console.log('🔍 Filters:', filters)
      
      let query = supabase
        .from('nba_players')
        .select(`
          *,
          nba_espn_projections (
            proj_2026_pts,
            proj_2026_reb,
            proj_2026_ast,
            proj_2026_stl,
            proj_2026_blk,
            proj_2026_to,
            proj_2026_gp,
            proj_2026_min,
            proj_2026_fg_pct,
            proj_2026_ft_pct,
            proj_2026_3pm,
            stats_2025_pts,
            stats_2025_reb,
            stats_2025_ast,
            stats_2025_stl,
            stats_2025_blk,
            stats_2025_to,
            stats_2025_gp,
            stats_2025_min,
            stats_2025_fg_pct,
            stats_2025_ft_pct,
            stats_2025_3pm
          ),
          nba_hoopshype_salaries (
            salary_2025_26,
            salary_2026_27,
            salary_2027_28,
            salary_2028_29
          )
        `, { count: 'exact' })

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

      // Apply salary filter (using nba_hoopshype_salaries table)
      if (filters.salary) {
        // Note: Salary filtering would need to be done via a join with nba_hoopshype_salaries
        // For now, we'll skip salary filtering as it requires a more complex query
        console.log('⚠️ Salary filtering not implemented yet - requires join with nba_hoopshype_salaries')
      }

      // Apply active/inactive filter - by default only show active players
      if (filters.showInactive !== true) {
        query = query.eq('is_active', true)
        console.log('✅ Filtering to active players only')
      } else {
        console.log('⚠️ Showing both active and inactive players')
      }

      // Exclude drafted players if leagueId is provided
      if (filters.leagueId) {
        // Get list of drafted player IDs for this league
        const { data: draftedPlayers, error: draftedError } = await supabase
          .from('fantasy_draft_picks')
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

      // Apply pagination - always use server-side pagination for consistent results
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
      console.log(`📊 Total players matching filters: ${count || 0}`)
      
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
