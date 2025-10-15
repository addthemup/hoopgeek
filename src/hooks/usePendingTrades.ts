import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface TradePlayer {
  id: number;
  name: string;
  position: string;
  team_abbreviation: string;
  nba_player_id: number;
  salary_2025_26: number;
}

export interface TradePick {
  pick_number: number;
  round: number;
  team_position: number;
  is_completed: boolean;
}

export interface PendingTrade {
  id: string;
  league_id: string;
  from_team_id: string;
  from_team_name: string;
  to_team_id: string;
  to_team_name: string;
  offered_players: TradePlayer[];
  offered_picks: TradePick[];
  requested_players: TradePlayer[];
  requested_picks: TradePick[];
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
  created_at: string;
  expires_at: string;
  responded_at?: string; // NEW: When trade was accepted/rejected
  is_expired: boolean;
}

export function usePendingTrades(
  teamId?: string, 
  leagueId?: string, 
  isCommissioner: boolean = false
) {
  return useQuery({
    queryKey: ['pending-trades', teamId, leagueId, isCommissioner],
    queryFn: async (): Promise<PendingTrade[]> => {
      if (!teamId || !leagueId) {
        return [];
      }

      const { data, error } = await supabase.rpc('get_pending_draft_trades', {
        p_team_id: teamId,
        p_league_id: leagueId,
      });

      if (error) {
        console.error('Error fetching pending trades:', error);
        throw new Error(`Failed to fetch pending trades: ${error.message}`);
      }

      console.log('📩 Fetched pending trades:', data?.length || 0);
      return data || [];
    },
    enabled: !!teamId && !!leagueId,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 2000, // Consider data stale after 2 seconds
  });
}

