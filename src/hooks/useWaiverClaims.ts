import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

// Submit a waiver claim
export function useSubmitWaiverClaim() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leagueId,
      seasonId,
      fantasyTeamId,
      playerId,
      playerToDropId,
      bidAmount,
      priority,
    }: {
      leagueId: string;
      seasonId: string;
      fantasyTeamId: string;
      playerId: string;
      playerToDropId?: string | null;
      bidAmount?: number;
      priority?: number;
    }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('📝 Submitting waiver claim:', {
        leagueId,
        seasonId,
        fantasyTeamId,
        playerId,
        playerToDropId,
        bidAmount,
        priority,
      });

      const { data, error } = await supabase.rpc('submit_waiver_claim', {
        p_league_id: leagueId,
        p_season_id: seasonId,
        p_fantasy_team_id: fantasyTeamId,
        p_player_id: playerId,
        p_player_to_drop_id: playerToDropId || null,
        p_submitted_by: user.id,
        p_bid_amount: bidAmount || 0,
        p_priority: priority || 1,
      });

      if (error) {
        console.error('❌ Error submitting waiver claim:', error);
        throw error;
      }

      console.log('✅ Waiver claim submitted:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate pending claims query
      queryClient.invalidateQueries({ queryKey: ['pending-waiver-claims', variables.leagueId, variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['team-waiver-budget', variables.leagueId, variables.fantasyTeamId] });
    },
  });
}

// Cancel a pending waiver claim
export function useCancelWaiverClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      claimId,
      leagueId,
      fantasyTeamId,
    }: {
      claimId: string;
      leagueId: string;
      fantasyTeamId: string;
    }) => {
      console.log('🗑️ Canceling waiver claim:', claimId);

      const { data, error } = await supabase.rpc('cancel_waiver_claim', {
        p_claim_id: claimId,
      });

      if (error) {
        console.error('❌ Error canceling waiver claim:', error);
        throw error;
      }

      console.log('✅ Waiver claim canceled:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-waiver-claims', variables.leagueId, variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['team-waiver-budget', variables.leagueId, variables.fantasyTeamId] });
    },
  });
}

// Get team's pending waiver claims
export function usePendingWaiverClaims(leagueId: string, fantasyTeamId: string) {
  return useQuery({
    queryKey: ['pending-waiver-claims', leagueId, fantasyTeamId],
    queryFn: async () => {
      console.log('📋 Fetching pending waiver claims for team:', fantasyTeamId);

      const { data, error } = await supabase
        .from('fantasy_waiver_claims')
        .select(`
          id,
          player_id,
          player_to_drop_id,
          bid_amount,
          priority,
          status,
          submitted_at,
          nba_players!player_id(
            id,
            name,
            position,
            team_abbreviation,
            nba_player_id
          ),
          player_to_drop:nba_players!player_to_drop_id(
            id,
            name,
            position,
            team_abbreviation
          )
        `)
        .eq('league_id', leagueId)
        .eq('fantasy_team_id', fantasyTeamId)
        .eq('status', 'pending')
        .order('priority', { ascending: true });

      if (error) {
        console.error('❌ Error fetching pending claims:', error);
        throw error;
      }

      console.log('✅ Pending claims fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!leagueId && !!fantasyTeamId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// Get team's waiver budget (FAAB)
export function useTeamWaiverBudget(leagueId: string, fantasyTeamId: string, seasonId: string) {
  return useQuery({
    queryKey: ['team-waiver-budget', leagueId, fantasyTeamId, seasonId],
    queryFn: async () => {
      console.log('💰 Fetching waiver budget for team:', fantasyTeamId);

      const { data, error } = await supabase
        .from('fantasy_waiver_order')
        .select('remaining_budget, total_spent, waiver_priority')
        .eq('league_id', leagueId)
        .eq('season_id', seasonId)
        .eq('fantasy_team_id', fantasyTeamId)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching waiver budget:', error);
        throw error;
      }

      console.log('✅ Waiver budget fetched:', data);
      return data;
    },
    enabled: !!leagueId && !!fantasyTeamId && !!seasonId,
    staleTime: 1000 * 60, // 1 minute
  });
}

