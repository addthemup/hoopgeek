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
            nba_player_id,
            name,
            position,
            team_name,
            team_abbreviation,
            jersey_number,
            salary,
            salary_2025_26,
            espn_player_projections (
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
            )
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
