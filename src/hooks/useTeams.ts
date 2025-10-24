import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { FantasyTeam } from '../types'

export function useTeams(leagueId: string) {
  return useQuery({
    queryKey: ['league-teams', leagueId],
    queryFn: async () => {
      console.log(`🏀 Fetching teams for league ${leagueId}...`)
      
      const { data, error } = await supabase
        .from('fantasy_teams')
        .select(`
          *,
          fantasy_league_seasons!inner(
            salary_cap_amount
          )
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Error fetching teams:', error)
        throw new Error(`Error fetching teams: ${error.message}`)
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} teams`)
      console.log('📊 Teams data:', data?.map(t => ({ 
        id: t.id, 
        name: t.team_name, 
        user_id: t.user_id,
        league_id: t.league_id 
      })))
      return data as FantasyTeam[]
    },
    enabled: !!leagueId,
    staleTime: 1000 * 30, // Reduced to 30 seconds for better freshness
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      console.log(`🏀 Fetching team ${teamId}...`)
      
      const { data, error } = await supabase
        .from('fantasy_teams')
        .select('*')
        .eq('id', teamId)
        .single()

      if (error) {
        console.error('❌ Error fetching team:', error)
        throw new Error(`Error fetching team: ${error.message}`)
      }

      console.log(`✅ Successfully fetched team: ${data?.team_name}`)
      return data as FantasyTeam
    },
    enabled: !!teamId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
