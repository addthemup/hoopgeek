import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DFSLineupSalaryData {
  totalSalary: number;
  salaryCap: number;
  remainingSalary: number;
  percentUsed: number;
  isOverCap: boolean;
  playerCount: number;
}

export function useDFSLineupSalary(
  poolId: string | undefined,
  userId: string | undefined,
  entryId?: string | undefined
) {
  return useQuery<DFSLineupSalaryData>({
    queryKey: ['dfs-lineup-salary', poolId, userId, entryId],
    queryFn: async () => {
      console.log('💰 Calculating lineup salary...');
      
      if (!poolId || !userId) {
        return {
          totalSalary: 0,
          salaryCap: 0,
          remainingSalary: 0,
          percentUsed: 0,
          isOverCap: false,
          playerCount: 0,
        };
      }

      // Get pool salary cap
      const { data: pool, error: poolError } = await supabase
        .from('dfs_pools')
        .select('salary_cap')
        .eq('id', poolId)
        .single();

      if (poolError) throw poolError;
      if (!pool) throw new Error('Pool not found');

      const salaryCap = pool.salary_cap;

      let entry;

      // If entryId is provided, fetch that specific entry
      if (entryId) {
        const { data, error: entryError } = await supabase
          .from('dfs_entries')
          .select('id')
          .eq('id', entryId)
          .eq('user_id', userId)
          .maybeSingle();

        if (entryError) throw entryError;
        entry = data;
      } else {
        // Otherwise, get user's entry for this pool
        const { data, error: entryError } = await supabase
          .from('dfs_entries')
          .select('id')
          .eq('pool_id', poolId)
          .eq('user_id', userId)
          .maybeSingle();

        if (entryError) throw entryError;
        entry = data;
      }

      if (!entry) {
        return {
          totalSalary: 0,
          salaryCap,
          remainingSalary: salaryCap,
          percentUsed: 0,
          isOverCap: false,
          playerCount: 0,
        };
      }

      // Get lineup for this entry
      const { data: lineup, error: lineupError } = await supabase
        .from('dfs_lineups')
        .select('id')
        .eq('entry_id', entry.id)
        .eq('pool_id', poolId)
        .maybeSingle();

      if (lineupError) throw lineupError;

      if (!lineup) {
        return {
          totalSalary: 0,
          salaryCap,
          remainingSalary: salaryCap,
          percentUsed: 0,
          isOverCap: false,
          playerCount: 0,
        };
      }

      // Get lineup positions and calculate total salary directly from player_salary column
      const { data: positions, error: positionsError } = await supabase
        .from('dfs_lineup_positions')
        .select('player_salary')
        .eq('lineup_id', lineup.id)
        .eq('pool_id', poolId);

      if (positionsError) throw positionsError;

      const totalSalary = positions?.reduce((sum, pos) => {
        return sum + (pos.player_salary || 0);
      }, 0) || 0;

      const remainingSalary = salaryCap - totalSalary;
      const percentUsed = salaryCap > 0 ? (totalSalary / salaryCap) * 100 : 0;
      const isOverCap = totalSalary > salaryCap;
      const playerCount = positions?.length || 0;

      const result = {
        totalSalary,
        salaryCap,
        remainingSalary,
        percentUsed,
        isOverCap,
        playerCount,
      };

      console.log('💰 Salary calculation result:', result);
      return result;
    },
    enabled: !!poolId && !!userId,
    staleTime: 0, // Always fresh
  });
}

export function formatSalary(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount}`;
}

