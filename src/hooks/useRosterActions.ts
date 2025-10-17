import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export function useAddPlayerToRoster() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      fantasyTeamId, 
      playerId, 
      position = 'BENCH' 
    }: { 
      fantasyTeamId: string; 
      playerId: string; 
      position?: string 
    }) => {
      // Find an available roster spot
      const { data: availableSpot, error: spotError } = await supabase
        .from('fantasy_roster_spots')
        .select('id')
        .eq('fantasy_team_id', fantasyTeamId)
        .is('player_id', null)
        .limit(1)
        .maybeSingle()

      if (spotError) {
        throw new Error('No available roster spot found')
      }

      // Add player to the roster spot
      const { error } = await supabase
        .from('fantasy_roster_spots')
        .update({ player_id: playerId })
        .eq('id', availableSpot.id)

      if (error) throw error
    },
    onSuccess: (_, { fantasyTeamId }) => {
      queryClient.invalidateQueries({ queryKey: ['fantasy-team-players', fantasyTeamId] })
      queryClient.invalidateQueries({ queryKey: ['fantasy-teams'] })
    },
  })
}

export function useRemovePlayerFromRoster() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      fantasyTeamId, 
      playerId 
    }: { 
      fantasyTeamId: string; 
      playerId: number 
    }) => {
      const { error } = await supabase
        .from('fantasy_roster_spots')
        .update({ player_id: null })
        .eq('fantasy_team_id', fantasyTeamId)
        .eq('player_id', playerId)

      if (error) throw error
    },
    onSuccess: (_, { fantasyTeamId }) => {
      queryClient.invalidateQueries({ queryKey: ['fantasy-team-players', fantasyTeamId] })
      queryClient.invalidateQueries({ queryKey: ['fantasy-teams'] })
    },
  })
}

export function useIsPlayerOnRoster(fantasyTeamId: string, playerId: string) {
  return useQuery({
    queryKey: ['player-roster-check', fantasyTeamId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_roster_spots')
        .select('id')
        .eq('fantasy_team_id', fantasyTeamId)
        .eq('player_id', playerId)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return data ? { isOnRoster: true, position: null } : { isOnRoster: false, position: null }
    },
    enabled: !!fantasyTeamId && !!playerId,
  })
}

export function useGetPlayerRosterInfo(playerId: string) {
  return useQuery({
    queryKey: ['player-roster-info', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_roster_spots')
        .select(`
          id,
          fantasy_teams (
            id,
            team_name,
            user_id,
            leagues (
              id,
              name
            )
          )
        `)
        .eq('player_id', playerId)
        .not('fantasy_teams.user_id', 'is', null)

      if (error) throw error
      return data?.[0] || null
    },
    enabled: !!playerId,
  })
}
