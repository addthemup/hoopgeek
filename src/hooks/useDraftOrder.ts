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
  // Player trade information (after being drafted)
  player_was_traded?: boolean
  player_traded_to_team?: string
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
          original_team_id,
          current_team_id,
          trade_count,
          time_expires,
          time_started,
          auto_pick_reason
        `)
        .eq('league_id', leagueId)
        .order('pick_number')

      if (orderError) {
        console.error('Error fetching draft order data:', orderError)
        throw new Error(`Failed to fetch draft order: ${orderError.message}`)
      }

      // Get team data separately
      const { data: teamsData, error: teamsError } = await supabase
        .from('fantasy_teams')
        .select('id, team_name, autodraft_enabled')
        .eq('league_id', leagueId)

      if (teamsError) {
        console.error('Error fetching teams data:', teamsError)
        // Don't throw error, just continue without team data
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
            team_abbreviation,
            nba_hoopshype_salaries (
              salary_2025_26
            )
          )
        `)
        .eq('league_id', leagueId)

      if (picksError) {
        console.error('Error fetching completed picks:', picksError)
        // Don't throw error, just continue without player data
      }

      // Get trade data to check for player trades
      const { data: tradeData, error: tradeError } = await supabase
        .from('draft_trade_offers')
        .select(`
          offered_players,
          requested_players,
          from_team_id,
          to_team_id,
          status
        `)
        .eq('league_id', leagueId)
        .eq('status', 'accepted')

      if (tradeError) {
        console.error('Error fetching trade data:', tradeError)
        // Don't throw error, just continue without trade data
      }

      // Transform the data to match the expected interface
      const picksWithPlayers: DraftOrderPick[] = (draftOrderData || []).map((pick: any) => {
        const completedPick = completedPicks?.find(p => p.pick_number === pick.pick_number)
        const team = teamsData?.find(t => t.id === pick.fantasy_team_id)
        
        // Check if this player was traded after being drafted
        let playerWasTraded = false
        let playerTradedToTeam = ''
        
        if (completedPick?.player_id && tradeData) {
          // Check if this player was involved in any accepted trades
          const playerTrades = tradeData.filter(trade => 
            trade.offered_players?.includes(completedPick.player_id) || 
            trade.requested_players?.includes(completedPick.player_id)
          )
          
          if (playerTrades.length > 0) {
            playerWasTraded = true
            // Find the most recent trade for this player
            const mostRecentTrade = playerTrades[playerTrades.length - 1]
            
            // Determine which team the player was traded to
            if (mostRecentTrade.offered_players?.includes(completedPick.player_id)) {
              // Player was offered, so they went to the receiving team
              const receivingTeam = teamsData?.find(t => t.id === mostRecentTrade.to_team_id)
              playerTradedToTeam = receivingTeam?.team_name || 'Unknown Team'
            } else if (mostRecentTrade.requested_players?.includes(completedPick.player_id)) {
              // Player was requested, so they went to the offering team
              const offeringTeam = teamsData?.find(t => t.id === mostRecentTrade.from_team_id)
              playerTradedToTeam = offeringTeam?.team_name || 'Unknown Team'
            }
          }
        }
        
        const transformedPick = {
          pick_number: pick.pick_number,
          round: pick.round,
          team_position: pick.team_position,
          team_id: pick.fantasy_team_id,
          team_name: team?.team_name || 'Unknown Team',
          is_completed: pick.is_completed,
          autodraft_enabled: team?.autodraft_enabled || false,
          player_id: completedPick?.player_id,
          nba_player_id: completedPick?.nba_players?.nba_player_id,
          player_name: completedPick?.nba_players?.name,
          position: completedPick?.nba_players?.position,
          team_abbreviation: completedPick?.nba_players?.team_abbreviation,
          salary_2025_26: completedPick?.nba_players?.nba_hoopshype_salaries?.[0]?.salary_2025_26,
          time_expires: pick.time_expires,
          time_started: pick.time_started,
          auto_pick_reason: pick.auto_pick_reason,
          pick_made_at: completedPick?.created_at,
          // Trade information
          original_team_id: pick.original_team_id || pick.fantasy_team_id,
          original_team_name: teamsData?.find(t => t.id === (pick.original_team_id || pick.fantasy_team_id))?.team_name || 'Unknown Team',
          current_owner_id: pick.current_team_id || pick.fantasy_team_id,
          current_owner_name: teamsData?.find(t => t.id === (pick.current_team_id || pick.fantasy_team_id))?.team_name || 'Unknown Team',
          is_traded: pick.is_traded || false,
          // Player trade information (after being drafted)
          player_was_traded: playerWasTraded,
          player_traded_to_team: playerTradedToTeam
        }
        
        // Debug logging for trade data
        if (pick.is_traded || pick.original_team_id || pick.current_team_id || playerWasTraded) {
          console.log('🔍 useDraftOrder - Trade Debug:', {
            pickNumber: pick.pick_number,
            playerName: transformedPick.player_name,
            rawPick: {
              is_traded: pick.is_traded,
              original_team_id: pick.original_team_id,
              current_team_id: pick.current_team_id,
              fantasy_team_id: pick.fantasy_team_id
            },
            transformedPick: {
              is_traded: transformedPick.is_traded,
              original_team_name: transformedPick.original_team_name,
              current_owner_name: transformedPick.current_owner_name,
              team_name: transformedPick.team_name,
              player_was_traded: transformedPick.player_was_traded,
              player_traded_to_team: transformedPick.player_traded_to_team
            }
          });
        }
        
        return transformedPick;
      })

      return picksWithPlayers
    },
    enabled: !!leagueId,
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  })
}
