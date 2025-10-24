import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface TeamTransaction {
  transaction_id: string;
  transaction_type: 'add' | 'cut';
  status: 'pending' | 'completed' | 'cancelled';
  fantasy_team_id: string;
  fantasy_team_name: string;
  player_id: string;
  player_name: string;
  player_position: string;
  player_team: string;
  transaction_date: string;
  notes: string | null;
}

// Fetch transactions for a specific team
export function useTeamTransactions(leagueId: string, teamId: string, limit: number = 10) {
  return useQuery({
    queryKey: ['team-transactions', leagueId, teamId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_league_transactions', {
        league_id_param: leagueId,
        season_id_param: null, // Get all seasons
        limit_param: limit,
        offset_param: 0,
      });

      if (error) {
        console.error('Error fetching team transactions:', error);
        throw error;
      }

      // Filter for this specific team
      const teamTransactions = (data || []).filter(
        (transaction: TeamTransaction) => transaction.fantasy_team_id === teamId
      );

      return teamTransactions as TeamTransaction[];
    },
    enabled: !!leagueId && !!teamId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// Fetch all league transactions
export function useLeagueTransactions(leagueId: string, seasonId?: string, limit: number = 50) {
  return useQuery({
    queryKey: ['league-transactions', leagueId, seasonId, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_league_transactions', {
        league_id_param: leagueId,
        season_id_param: seasonId || null,
        limit_param: limit,
        offset_param: 0,
      });

      if (error) {
        console.error('Error fetching league transactions:', error);
        throw error;
      }

      return (data || []) as TeamTransaction[];
    },
    enabled: !!leagueId,
    staleTime: 1000 * 30,
  });
}

