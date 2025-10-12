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
      const { data, error } = await supabase
        .rpc('get_draft_order', { league_id_param: leagueId })

      if (error) {
        console.error('Error fetching draft order:', error)
        throw new Error(`Failed to fetch draft order: ${error.message}`)
      }

      // Get additional draft order data (time_expires, auto_pick_reason, fantasy_team_id for trades)
      const { data: draftOrderData, error: orderError } = await supabase
        .from('draft_order')
        .select('pick_number, time_expires, time_started, auto_pick_reason, is_completed, fantasy_team_id')
        .eq('league_id', leagueId)

      if (orderError) {
        console.error('Error fetching draft order data:', orderError)
      }

      // Get team autodraft status and team names
      const { data: teamsData, error: teamsError } = await supabase
        .from('fantasy_teams')
        .select('id, autodraft_enabled, team_name')
        .eq('league_id', leagueId)
        .order('id')

      if (teamsError) {
        console.error('Error fetching teams data:', teamsError)
      }

      // Get completed picks with player data AND current owner (fantasy_team_id tracks player trades)
      const { data: completedPicks, error: picksError } = await supabase
        .from('draft_picks')
        .select(`
          pick_number,
          player_id,
          fantasy_team_id,
          created_at,
          players!inner (
            id,
            nba_player_id,
            name,
            position,
            team_abbreviation,
            salary_2025_26
          )
        `)
        .eq('league_id', leagueId)

      if (picksError) {
        console.error('Error fetching completed picks:', picksError)
        // Don't throw error, just continue without player data
      }

      // Merge draft order with completed picks, time data, and team data
      const picksWithPlayers: DraftOrderPick[] = data.map((pick: any) => {
        const completedPick = completedPicks?.find(p => p.pick_number === pick.pick_number)
        const orderData = draftOrderData?.find(d => d.pick_number === pick.pick_number)
        
        // Original team (based on team_position from get_draft_order RPC)
        const originalTeamData = teamsData?.find(t => t.id === pick.team_id)
        
        // Determine current owner:
        // - fantasy_team_id = NULL means "belongs to original owner" (no trade)
        // - fantasy_team_id = set means "has been traded to this team"
        let currentOwnerId: string;
        let isTraded: boolean;
        
        if (completedPick && completedPick.player_id) {
          // Pick is completed - check if PLAYER was traded
          // NULL fantasy_team_id means player belongs to original owner
          if (completedPick.fantasy_team_id && completedPick.fantasy_team_id !== pick.team_id) {
            currentOwnerId = completedPick.fantasy_team_id;
            isTraded = true;
          } else {
            currentOwnerId = pick.team_id;
            isTraded = false;
          }
        } else {
          // Pick is not completed - check if PICK was traded
          // NULL fantasy_team_id means pick belongs to original owner
          if (orderData?.fantasy_team_id && orderData.fantasy_team_id !== pick.team_id) {
            currentOwnerId = orderData.fantasy_team_id;
            isTraded = true;
          } else {
            currentOwnerId = pick.team_id;
            isTraded = false;
          }
        }
        
        const currentOwnerData = teamsData?.find(t => t.id === currentOwnerId)
        
        return {
          ...pick,
          player_id: completedPick?.player_id,
          nba_player_id: completedPick?.players?.nba_player_id,
          player_name: completedPick?.players?.name,
          position: completedPick?.players?.position,
          team_abbreviation: completedPick?.players?.team_abbreviation,
          salary_2025_26: completedPick?.players?.salary_2025_26,
          is_completed: orderData?.is_completed || !!completedPick,
          time_expires: orderData?.time_expires,
          time_started: orderData?.time_started,
          auto_pick_reason: orderData?.auto_pick_reason,
          autodraft_enabled: currentOwnerData?.autodraft_enabled,
          pick_made_at: completedPick?.created_at, // NEW: When pick was actually made
          // Trade information
          original_team_id: pick.team_id,
          original_team_name: pick.team_name,
          current_owner_id: currentOwnerId,
          current_owner_name: currentOwnerData?.team_name || pick.team_name,
          is_traded: isTraded
        }
      })

      return picksWithPlayers
    },
    enabled: !!leagueId,
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  })
}
