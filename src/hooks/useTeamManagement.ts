import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export function useAddTeam() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      leagueId, 
      teamName 
    }: { 
      leagueId: string; 
      teamName: string 
    }) => {
      const { data, error } = await supabase
        .from('fantasy_teams')
        .insert({
          league_id: leagueId,
          team_name: teamName,
          is_commissioner: false,
          wins: 0,
          losses: 0,
          ties: 0,
          points_for: 0,
          points_against: 0,
          salary_cap_used: 0,
          salary_cap_max: 100000000
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['league-teams', leagueId] })
    },
  })
}

export function useUpdateTeam() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      teamId, 
      updates 
    }: { 
      teamId: string; 
      updates: Partial<{
        team_name: string;
        team_abbreviation: string;
        draft_position: number;
      }>
    }) => {
      const { data, error } = await supabase
        .from('fantasy_teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['league-teams', data.league_id] })
      queryClient.invalidateQueries({ queryKey: ['team', data.id] })
    },
  })
}

export function useDeleteTeam() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ teamId }: { teamId: string }) => {
      const { error } = await supabase
        .from('fantasy_teams')
        .delete()
        .eq('id', teamId)

      if (error) throw error
    },
    onSuccess: (_, { teamId }) => {
      // Invalidate all team-related queries
      queryClient.invalidateQueries({ queryKey: ['league-teams'] })
      queryClient.invalidateQueries({ queryKey: ['team', teamId] })
    },
  })
}
