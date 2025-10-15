import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface Division {
  id: string
  league_id: string
  name: string
  description?: string
  division_order: number
  created_at: string
  updated_at: string
}

export interface CreateDivisionData {
  league_id: string
  name: string
  description?: string
  division_order: number
}

export interface UpdateDivisionData {
  id: string
  name?: string
  description?: string
  division_order?: number
}

// Hook to fetch divisions for a league
export function useDivisions(leagueId: string) {
  return useQuery({
    queryKey: ['divisions', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('league_divisions')
        .select('*')
        .eq('league_id', leagueId)
        .order('division_order', { ascending: true })

      if (error) throw error
      return data as Division[]
    },
    enabled: !!leagueId
  })
}

// Hook to create a new division
export function useCreateDivision() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateDivisionData) => {
      const { data: result, error } = await supabase
        .from('league_divisions')
        .insert([data])
        .select()
        .single()

      if (error) throw error
      return result as Division
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['divisions', variables.league_id] })
    }
  })
}

// Hook to update a division
export function useUpdateDivision() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateDivisionData) => {
      const { id, ...updateData } = data
      const { data: result, error } = await supabase
        .from('league_divisions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return result as Division
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['divisions', result.league_id] })
    }
  })
}

// Hook to delete a division
export function useDeleteDivision() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, leagueId }: { id: string; leagueId: string }) => {
      const { error } = await supabase
        .from('league_divisions')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { id, leagueId }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['divisions', variables.leagueId] })
    }
  })
}

// Hook to assign teams to divisions
export function useAssignTeamsToDivisions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      teamAssignments, 
      leagueId 
    }: { 
      teamAssignments: Array<{ teamId: string; divisionId: string | null }>
      leagueId: string 
    }) => {
      const updates = teamAssignments.map(({ teamId, divisionId }) =>
        supabase
          .from('fantasy_teams')
          .update({ division_id: divisionId })
          .eq('id', teamId)
      )

      const results = await Promise.all(updates)
      
      // Check for any errors
      for (const result of results) {
        if (result.error) throw result.error
      }

      return { teamAssignments, leagueId }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', variables.leagueId] })
      queryClient.invalidateQueries({ queryKey: ['divisions', variables.leagueId] })
    }
  })
}
