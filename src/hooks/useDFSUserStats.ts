import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DFSUserStats {
  totalWinnings: number;
  contestsWon: number;
  contestsEntered: number;
  activeLineups: number;
  totalPoints: number;
  winRate: number;
}

export function useDFSUserStats(userId: string | undefined) {
  return useQuery<DFSUserStats>({
    queryKey: ['dfs-user-stats', userId],
    queryFn: async () => {
      if (!userId) {
        return {
          totalWinnings: 0,
          contestsWon: 0,
          contestsEntered: 0,
          activeLineups: 0,
          totalPoints: 0,
          winRate: 0,
        };
      }

      // Get user's entries
      const { data: entries, error } = await supabase
        .from('dfs_entries')
        .select(`
          id,
          total_points,
          final_rank,
          prize_won,
          is_submitted,
          pool_id,
          dfs_pools!inner(status)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const totalWinnings = entries?.reduce((sum, e) => sum + (e.prize_won || 0), 0) || 0;
      const contestsWon = entries?.filter(e => (e.prize_won || 0) > 0).length || 0;
      const contestsEntered = entries?.filter(e => e.is_submitted).length || 0;
      const activeLineups = entries?.filter(e => 
        e.is_submitted && (e.dfs_pools as any)?.status === 'live'
      ).length || 0;
      const totalPoints = entries?.reduce((sum, e) => sum + (e.total_points || 0), 0) || 0;
      const winRate = contestsEntered > 0 ? (contestsWon / contestsEntered) * 100 : 0;

      return {
        totalWinnings,
        contestsWon,
        contestsEntered,
        activeLineups,
        totalPoints,
        winRate,
      };
    },
    enabled: !!userId,
  });
}

