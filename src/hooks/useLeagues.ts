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
        .from('fantasy_leagues')
        .select(`
          *,
          fantasy_teams (
            id,
            team_name,
            user_id,
            created_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as (League & { fantasy_teams: any[] })[]
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
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Use the function to get league data
      const { data, error } = await supabase.rpc('get_league_data', {
        league_id_param: leagueId,
        user_id_param: user.id
      });

      console.log('useLeague: Supabase response:', { data, error });

      if (error) {
        console.error('useLeague: Error fetching league:', error);
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to fetch league');
      }
      
      console.log('useLeague: Successfully fetched league:', data.data);
      return data.data.league as League & { league_members: LeagueMember[] }
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
        .from('fantasy_teams')
        .delete()
        .eq('league_id', leagueId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}
