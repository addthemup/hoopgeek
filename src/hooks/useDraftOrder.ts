import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface DraftOrderPick {
  pick_number: number
  round: number
  team_position: number
  team_id: string
  team_name: string
  is_completed: boolean
  autodraft_enabled?: boolean
  time_expires?: string
  time_started?: string
  auto_pick_reason?: string
  player_id?: number
  nba_player_id?: number
  player_name?: string
  position?: string
  team_abbreviation?: string
  salary_2025_26?: number
  pick_made_at?: string // NEW: Timestamp when pick was actually made
  // Trade information
  original_team_id?: string
  original_team_name?: string
  current_owner_id?: string
  current_owner_name?: string
  is_traded?: boolean
}

export function useDraftOrder(leagueId: string) {
  return useQuery({
    queryKey: ['draft-order', leagueId],
    queryFn: async () => {
      // Get draft order data directly from fantasy_draft_order table
      const { data: draftOrderData, error: orderError } = await supabase
        .from('fantasy_draft_order')
        .select(`
          pick_number,
          round,
          team_position,
          fantasy_team_id,
          is_completed,
          is_traded,
          time_expires,
          time_started,
          auto_pick_reason,
          fantasy_teams!inner (
            id,
            team_name
          )
        `)
        .eq('league_id', leagueId)
        .order('pick_number')

      if (orderError) {
        console.error('Error fetching draft order data:', orderError)
        throw new Error(`Failed to fetch draft order: ${orderError.message}`)
      }

      // Get completed picks with player data and salary information
      const { data: completedPicks, error: picksError } = await supabase
        .from('fantasy_draft_picks')
        .select(`
          pick_number,
          player_id,
          fantasy_team_id,
          created_at,
          nba_players!inner (
            id,
            nba_player_id,
            name,
            position,
            team_abbreviation
          ),
          nba_hoopshype_salaries!left (
            salary_2025_26
          )
        `)
        .eq('league_id', leagueId)

      if (picksError) {
        console.error('Error fetching completed picks:', picksError)
        // Don't throw error, just continue without player data
      }

      // Transform the data to match the expected interface
      const picksWithPlayers: DraftOrderPick[] = (draftOrderData || []).map((pick: any) => {
        const completedPick = completedPicks?.find(p => p.pick_number === pick.pick_number)
        
        return {
          pick_number: pick.pick_number,
          round: pick.round,
          team_position: pick.team_position,
          team_id: pick.fantasy_team_id,
          team_name: pick.fantasy_teams?.team_name || 'Unknown Team',
          is_completed: pick.is_completed,
          player_id: completedPick?.player_id,
          nba_player_id: completedPick?.nba_players?.nba_player_id,
          player_name: completedPick?.nba_players?.name,
          position: completedPick?.nba_players?.position,
          team_abbreviation: completedPick?.nba_players?.team_abbreviation,
          salary_2025_26: completedPick?.nba_hoopshype_salaries?.salary_2025_26,
          time_expires: pick.time_expires,
          time_started: pick.time_started,
          auto_pick_reason: pick.auto_pick_reason,
          pick_made_at: completedPick?.created_at,
          // Trade information
          original_team_id: pick.fantasy_team_id,
          original_team_name: pick.fantasy_teams?.team_name || 'Unknown Team',
          current_owner_id: pick.fantasy_team_id,
          current_owner_name: pick.fantasy_teams?.team_name || 'Unknown Team',
          is_traded: pick.is_traded || false
        }
      })

      return picksWithPlayers
    },
    enabled: !!leagueId,
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  })
}
