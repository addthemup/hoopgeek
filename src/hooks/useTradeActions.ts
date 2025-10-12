import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface AcceptTradeParams {
  tradeId: string;
  acceptingTeamId: string;
  isCommissioner?: boolean;
}

interface RejectTradeParams {
  tradeId: string;
  rejectingTeamId: string;
  isCommissioner?: boolean;
}

export function useAcceptTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tradeId, acceptingTeamId, isCommissioner = false }: AcceptTradeParams) => {
      console.log('✅ Accepting trade:', { tradeId, acceptingTeamId, isCommissioner });

      const { data, error } = await supabase.rpc('accept_trade_offer', {
        trade_id_param: tradeId,
        accepting_team_id_param: acceptingTeamId,
        is_commissioner_param: isCommissioner,
      });

      if (error) {
        console.error('❌ Error accepting trade:', error);
        throw new Error(error.message || 'Failed to accept trade');
      }

      console.log('✅ Trade accepted successfully:', data);
      return data;
    },
    onSuccess: () => {
      console.log('🔄 Trade accepted! Refetching all trade-related data...');
      
      // Invalidate and refetch all relevant queries immediately
      queryClient.invalidateQueries({ queryKey: ['pending-trades'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['draft-order'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['team-drafted-players'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['available-draft-picks'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['pending-trades-count'], refetchType: 'active' });
      
      // Force refetch after a slight delay to ensure DB has been updated
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['team-drafted-players'] });
        queryClient.refetchQueries({ queryKey: ['available-draft-picks'] });
        queryClient.refetchQueries({ queryKey: ['draft-order'] });
      }, 500);
    },
  });
}

export function useRejectTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tradeId, rejectingTeamId, isCommissioner = false }: RejectTradeParams) => {
      console.log('❌ Rejecting trade:', { tradeId, rejectingTeamId, isCommissioner });

      const { data, error } = await supabase.rpc('reject_trade_offer', {
        trade_id_param: tradeId,
        rejecting_team_id_param: rejectingTeamId,
        is_commissioner_param: isCommissioner,
      });

      if (error) {
        console.error('❌ Error rejecting trade:', error);
        throw new Error(error.message || 'Failed to reject trade');
      }

      console.log('✅ Trade rejected successfully:', data);
      return data;
    },
    onSuccess: () => {
      console.log('🔄 Trade rejected! Refetching trade data...');
      
      // Invalidate and refetch all relevant queries immediately
      queryClient.invalidateQueries({ queryKey: ['pending-trades'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['pending-trades-count'], refetchType: 'active' });
    },
  });
}

