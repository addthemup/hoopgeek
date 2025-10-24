import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface TradingBlockPlayer {
  id: string;
  league_id: string;
  season_id: string;
  fantasy_team_id: string;
  player_id: string;
  player_name: string;
  player_position: string;
  player_team: string;
  player_avatar: string;
  status: 'available' | 'listening' | 'untouchable' | 'inactive';
  trade_notes?: string;
  preferred_positions?: string[];
  asking_price?: string;
  trade_priority: number;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// Fetch trading block for a team
export function useTeamTradingBlock(leagueId: string, teamId: string) {
  return useQuery({
    queryKey: ['trading-block', leagueId, teamId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_trading_block', {
        p_league_id: leagueId,
        p_fantasy_team_id: teamId
      });

      if (error) {
        console.error('Error fetching trading block:', error);
        throw error;
      }

      return (data || []) as TradingBlockPlayer[];
    },
    enabled: !!leagueId && !!teamId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// Fetch all trading blocks in a league
export function useLeagueTradingBlocks(leagueId: string) {
  return useQuery({
    queryKey: ['trading-blocks', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_trading_block', {
        p_league_id: leagueId,
        p_fantasy_team_id: null
      });

      if (error) {
        console.error('Error fetching league trading blocks:', error);
        throw error;
      }

      return (data || []) as TradingBlockPlayer[];
    },
    enabled: !!leagueId,
    staleTime: 1000 * 30,
  });
}

// Add player to trading block
export function useAddToTradingBlock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leagueId,
      seasonId,
      fantasyTeamId,
      playerId,
      status = 'available',
      tradeNotes,
      askingPrice,
      tradePriority = 5,
    }: {
      leagueId: string;
      seasonId: string;
      fantasyTeamId: string;
      playerId: string;
      status?: 'available' | 'listening' | 'untouchable' | 'inactive';
      tradeNotes?: string;
      askingPrice?: string;
      tradePriority?: number;
    }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('add_player_to_trading_block', {
        p_league_id: leagueId,
        p_season_id: seasonId,
        p_fantasy_team_id: fantasyTeamId,
        p_player_id: playerId,
        p_status: status,
        p_trade_notes: tradeNotes || null,
        p_preferred_positions: null,
        p_preferred_teams: null,
        p_asking_price: askingPrice || null,
        p_trade_priority: tradePriority,
        p_expires_at: null,
        p_created_by: user.id,
      });

      if (error) {
        console.error('Error adding to trading block:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to add player to trading block');
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trading-block', variables.leagueId, variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['trading-blocks', variables.leagueId] });
    },
  });
}

// Remove player from trading block
export function useRemoveFromTradingBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tradingBlockId,
      leagueId,
      fantasyTeamId,
    }: {
      tradingBlockId: string;
      leagueId: string;
      fantasyTeamId: string;
    }) => {
      const { error } = await supabase
        .from('fantasy_trading_block')
        .delete()
        .eq('id', tradingBlockId);

      if (error) {
        console.error('Error removing from trading block:', error);
        throw error;
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trading-block', variables.leagueId, variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['trading-blocks', variables.leagueId] });
    },
  });
}

