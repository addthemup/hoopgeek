import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { League, LeagueMember } from '../types'

export interface CreateLeagueData {
  name: string
  description?: string
  maxTeams: number
  scoringType: string
  teamName: string
}

export function useLeagues() {
  return useQuery({
    queryKey: ['leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select(`
          *,
          league_members (
            id,
            team_name,
            is_commissioner,
            user_id
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as (League & { league_members: LeagueMember[] })[]
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useCreateLeague() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (leagueData: CreateLeagueData) => {
      const { data, error } = await supabase.functions.invoke('create-league', {
        body: leagueData
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidate and refetch leagues data
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
      queryClient.invalidateQueries({ queryKey: ['userLeagues'] })
    },
  })
}

export function useLeague(leagueId: string) {
  return useQuery({
    queryKey: ['league', leagueId],
    queryFn: async () => {
      console.log('useLeague: Fetching league with ID:', leagueId);
      
      const { data, error } = await supabase
        .from('leagues')
        .select(`
          *,
          league_members (
            id,
            team_name,
            is_commissioner,
            user_id,
            joined_at
          )
        `)
        .eq('id', leagueId)
        .single()

      console.log('useLeague: Supabase response:', { data, error });

      if (error) {
        console.error('useLeague: Error fetching league:', error);
        throw error;
      }
      
      console.log('useLeague: Successfully fetched league:', data);
      return data as League & { league_members: LeagueMember[] }
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

export function useJoinLeague() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ inviteCode, teamName }: { inviteCode: string; teamName: string }) => {
      const { data, error } = await supabase.functions.invoke('join-league', {
        body: { inviteCode, teamName }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

export function useLeaveLeague() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (leagueId: string) => {
      const { error } = await supabase
        .from('league_members')
        .delete()
        .eq('league_id', leagueId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}
