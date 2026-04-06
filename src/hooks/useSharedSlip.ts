import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface PublicSlipRow {
  id: string;
  stake_cents: number;
  total_odds_decimal: number;
  potential_payout_cents: number;
  status: string;
  game_date: string | null;
  created_at: string;
  share_token: string;
  is_shared: boolean;
}

export function usePublicSlipByShareToken(token: string | undefined) {
  return useQuery({
    queryKey: ['public-slip', token],
    queryFn: async (): Promise<PublicSlipRow | null> => {
      if (!token) return null;
      const { data, error } = await supabase
        .from('user_slips')
        .select('id, stake_cents, total_odds_decimal, potential_payout_cents, status, game_date, created_at, share_token, is_shared')
        .eq('share_token', token)
        .eq('is_shared', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PublicSlipRow | null;
    },
    enabled: !!token,
  });
}

export function usePublicSlipLegs(slipId: string | undefined) {
  return useQuery({
    queryKey: ['public-slip-legs', slipId],
    queryFn: async () => {
      if (!slipId) return [];
      const { data, error } = await supabase
        .from('slip_legs')
        .select('id, player_name, bet_type, line, side, odds_american, display_order')
        .eq('slip_id', slipId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!slipId,
  });
}

export function useToggleSlipShare() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { slipId: string; isShared: boolean }) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('user_slips')
        .update({ is_shared: args.isShared, updated_at: new Date().toISOString() })
        .eq('id', args.slipId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-slips-history'] });
      queryClient.invalidateQueries({ queryKey: ['public-slip'] });
    },
  });
}
