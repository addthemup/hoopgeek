import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface TradeItem {
  type: 'player' | 'pick';
  playerId?: number;
  playerName?: string;
  playerPosition?: string;
  playerTeam?: string;
  pickNumber?: number;
  pickRound?: number;
  pickYear?: number;
  fromTeam: string;
  toTeam: string;
}

export interface Trade {
  id: string;
  league_id: string;
  proposing_team_id: string;
  receiving_team_id: string;
  proposing_team_name: string;
  receiving_team_name: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
  trade_items: TradeItem[];
  message?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  rejected_at?: string;
  cancelled_at?: string;
}

export function useTrades(leagueId: string) {
  return useQuery<Trade[], Error>({
    queryKey: ['trades', leagueId],
    queryFn: async () => {
      console.log(`🏀 Fetching trades for league ${leagueId}...`);
      
      const { data, error } = await supabase
        .from('trades')
        .select(`
          *,
          proposing_team:proposing_team_id (
            team_name
          ),
          receiving_team:receiving_team_id (
            team_name
          )
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching trades:', error);
        throw new Error(`Failed to fetch trades: ${error.message}`);
      }

      console.log(`✅ Successfully fetched ${data.length} trades`);
      return data.map(trade => ({
        ...trade,
        proposing_team_name: trade.proposing_team?.team_name || 'Unknown Team',
        receiving_team_name: trade.receiving_team?.team_name || 'Unknown Team',
      })) as Trade[];
    },
    enabled: !!leagueId,
    refetchInterval: 5000, // Refetch every 5 seconds for live updates
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tradeData: {
      leagueId: string;
      proposingTeamId: string;
      receivingTeamId: string;
      tradeItems: TradeItem[];
      message?: string;
    }) => {
      console.log('🏀 Creating trade proposal...', tradeData);
      
      const { data, error } = await supabase
        .from('trades')
        .insert({
          league_id: tradeData.leagueId,
          proposing_team_id: tradeData.proposingTeamId,
          receiving_team_id: tradeData.receivingTeamId,
          trade_items: tradeData.tradeItems,
          message: tradeData.message,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating trade:', error);
        throw new Error(`Failed to create trade: ${error.message}`);
      }

      console.log('✅ Trade created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch trades
      queryClient.invalidateQueries({ queryKey: ['trades', data.league_id] });
    },
  });
}

export function useUpdateTradeStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updateData: {
      tradeId: string;
      status: 'accepted' | 'rejected' | 'cancelled';
    }) => {
      console.log('🏀 Updating trade status...', updateData);
      
      const updateFields: any = {
        status: updateData.status,
        updated_at: new Date().toISOString(),
      };
      
      // Set the appropriate timestamp based on status
      if (updateData.status === 'accepted') {
        updateFields.accepted_at = new Date().toISOString();
      } else if (updateData.status === 'rejected') {
        updateFields.rejected_at = new Date().toISOString();
      } else if (updateData.status === 'cancelled') {
        updateFields.cancelled_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('trades')
        .update(updateFields)
        .eq('id', updateData.tradeId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating trade status:', error);
        throw new Error(`Failed to update trade status: ${error.message}`);
      }

      console.log('✅ Trade status updated successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      // Invalidate and refetch trades
      queryClient.invalidateQueries({ queryKey: ['trades', data.league_id] });
    },
  });
}
