import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DFSUserPoints {
  id: string;
  user_id: string;
  total_points: number;
  lifetime_points: number;
  total_entries: number;
  total_wins: number;
  total_top_10: number;
  total_top_25: number;
  created_at: string;
  updated_at: string;
}

export interface DFSPointTransaction {
  id: string;
  user_id: string;
  points: number;
  transaction_type: string;
  description: string | null;
  pool_id: string | null;
  entry_id: string | null;
  rank: number | null;
  percentile: number | null;
  placement_tier: string | null;
  created_at: string;
}

export interface DFSAchievement {
  id: string;
  name: string;
  description: string;
  achievement_type: string;
  icon_name: string | null;
  icon_color: string;
  requirement_value: number;
  points_reward: number;
  rarity: string;
  display_order: number;
}

export interface DFSUserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  achievement: DFSAchievement;
}

// Fetch user points
export function useDFSPoints(userId: string | undefined) {
  return useQuery<DFSUserPoints | null>({
    queryKey: ['dfs-user-points', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('dfs_user_points')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;
    },
    enabled: !!userId,
  });
}

// Fetch point transactions
export function useDFSPointTransactions(userId: string | undefined, limit: number = 50) {
  return useQuery<DFSPointTransaction[]>({
    queryKey: ['dfs-point-transactions', userId, limit],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('dfs_point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

// Fetch user achievements
export function useDFSAchievements(userId: string | undefined) {
  return useQuery<DFSUserAchievement[]>({
    queryKey: ['dfs-user-achievements', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('dfs_user_achievements')
        .select(`
          *,
          dfs_achievements (*)
        `)
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        achievement: item.dfs_achievements,
      }));
    },
    enabled: !!userId,
  });
}

// Fetch all achievements (for display)
export function useDFSAchievementsList() {
  return useQuery<DFSAchievement[]>({
    queryKey: ['dfs-achievements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_achievements')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}

