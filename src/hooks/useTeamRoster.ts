import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { FantasyTeamPlayer } from '../types'

export function useTeamRoster(teamId: string) {
  return useQuery({
    queryKey: ['team-roster', teamId],
    queryFn: async () => {
      console.log(`🏀 Fetching roster for team ${teamId}...`)
      
      // Get roster spots for this team with player data and salary information
      const { data: rosterSpots, error: spotsError } = await supabase
        .from('fantasy_roster_spots')
        .select(`
          *,
          player:player_id (
            id,
            nba_player_id,
            name,
            position,
            team_name,
            team_abbreviation,
            jersey_number,
            salary,
            height,
            weight,
            age,
            years_pro,
            college,
            draft_year,
            draft_round,
            draft_number,
            birth_city,
            birth_state,
            birth_country,
            country,
            is_active,
            is_rookie,
            roster_status,
            team_city,
            team_slug,
            player_slug,
            nba_hoopshype_salaries (
              salary_2025_26,
              salary_2026_27,
              salary_2027_28,
              salary_2028_29,
              contract_years_remaining
            )
          )
        `)
        .eq('fantasy_team_id', teamId)
        .order('created_at', { ascending: true })

      if (spotsError) {
        console.error('❌ Error fetching roster spots:', spotsError)
        throw new Error(`Error fetching roster spots: ${spotsError.message}`)
      }

      // Transform the data to match the expected interface
      const transformedRoster = rosterSpots?.map(spot => {
        return {
          id: spot.id,
          roster_spot_id: spot.id,
          fantasy_team_id: teamId,
          player: spot.player || null,
          roster_spot: {
            id: spot.id,
            is_injured_reserve: spot.is_injured_reserve,
            assigned_at: spot.assigned_at,
            assigned_by: spot.assigned_by,
            draft_round: spot.draft_round,
            draft_pick: spot.draft_pick
          },
          is_starter: false, // This will be determined by lineup logic later
          is_bench: !spot.is_injured_reserve, // Non-IR spots are bench by default
          is_injured_reserve: spot.is_injured_reserve,
          position: spot.player?.position || null,
          assigned_at: spot.assigned_at,
          assigned_by: spot.assigned_by,
          draft_round: spot.draft_round,
          draft_pick: spot.draft_pick
        };
      }) || [];

      console.log(`✅ Successfully fetched ${transformedRoster.length} roster spots (${transformedRoster.filter(r => r.player).length} with players)`)
      return transformedRoster as FantasyTeamPlayer[]
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
      
      // Get all teams in the league first
      const { data: teams, error: teamsError } = await supabase
        .from('fantasy_teams')
        .select('id')
        .eq('league_id', leagueId)

      if (teamsError) {
        console.error('❌ Error fetching teams:', teamsError)
        throw new Error(`Error fetching teams: ${teamsError.message}`)
      }

      if (!teams || teams.length === 0) {
        return []
      }

      const teamIds = teams.map(t => t.id)

      // Get all roster spots for teams in this league
      const { data, error } = await supabase
        .from('fantasy_roster_spots')
        .select('*')
        .in('fantasy_team_id', teamIds)
        .order('created_at', { ascending: true })

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
