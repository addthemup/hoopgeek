import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DFSPool {
  id: string;
  name: string;
  description?: string;
  slate_name: string;
  slate_date: string;
  start_time: string;
  lock_time: string;
  end_time: string;
  entry_fee: number;
  prize_pool: number;
  current_entries: number;
  max_entries: number;
  salary_cap: number;
  difficulty_tier: 'elite' | 'pro' | 'standard';
  prize_type: string;
  is_guaranteed: boolean;
  is_featured: boolean;
  status: string;
}

export function useDFSPool(poolId: string | undefined) {
  return useQuery<DFSPool>({
    queryKey: ['dfs-pool', poolId],
    queryFn: async () => {
      if (!poolId) throw new Error('Pool ID is required');

      const { data, error } = await supabase
        .from('dfs_pools')
        .select('*')
        .eq('id', poolId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!poolId,
  });
}

