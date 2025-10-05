import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { FantasyTeamPlayer } from '../types'

export function useTeamRoster(teamId: string) {
  return useQuery({
    queryKey: ['team-roster', teamId],
    queryFn: async () => {
      console.log(`🏀 Fetching roster for team ${teamId}...`)
      
      const { data, error } = await supabase
        .from('fantasy_team_players')
        .select(`
          *,
          player:player_id (
            id,
            name,
            position,
            team_name,
            team_abbreviation,
            jersey_number,
            salary
          ),
          roster_spot:roster_spot_id (
            id,
            position,
            position_order,
            is_starter,
            is_bench,
            is_injured_reserve
          )
        `)
        .eq('fantasy_team_id', teamId)

      if (error) {
        console.error('❌ Error fetching team roster:', error)
        throw new Error(`Error fetching team roster: ${error.message}`)
      }

      // Sort by roster spot position order on the client side
      const sortedData = data?.sort((a, b) => {
        const orderA = a.roster_spot?.position_order || 999;
        const orderB = b.roster_spot?.position_order || 999;
        return orderA - orderB;
      });

      console.log(`✅ Successfully fetched ${sortedData?.length || 0} roster spots`)
      return sortedData as FantasyTeamPlayer[]
    },
    enabled: !!teamId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useLeagueRosterSpots(leagueId: string) {
  return useQuery({
    queryKey: ['league-roster-spots', leagueId],
    queryFn: async () => {
      console.log(`🏀 Fetching roster spots for league ${leagueId}...`)
      
      const { data, error } = await supabase
        .from('roster_spots')
        .select('*')
        .eq('league_id', leagueId)
        .order('position_order', { ascending: true })

      if (error) {
        console.error('❌ Error fetching roster spots:', error)
        throw new Error(`Error fetching roster spots: ${error.message}`)
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} roster spots`)
      return data
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 10, // 10 minutes (roster spots don't change often)
  })
}
