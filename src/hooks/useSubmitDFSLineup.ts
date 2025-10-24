import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface SubmitDFSLineupResult {
  success: boolean;
  message: string;
  entry_id: string | null;
  total_salary: number;
  projected_points: number;
}

export function useSubmitDFSLineup() {
  const queryClient = useQueryClient();

  return useMutation<SubmitDFSLineupResult, Error, { poolId: string; userId: string }>({
    mutationFn: async ({ poolId, userId }) => {
      console.log('📤 Submitting DFS lineup:', { poolId, userId });

      const { data, error } = await supabase.rpc('submit_dfs_lineup', {
        p_pool_id: poolId,
        p_user_id: userId,
      });

      if (error) {
        console.error('❌ Submit lineup error:', error);
        throw new Error(error.message || 'Failed to submit lineup');
      }

      if (!data || data.length === 0) {
        throw new Error('No response from server');
      }

      const result = data[0];
      console.log('✅ Lineup submitted:', result);

      if (!result.success) {
        throw new Error(result.message);
      }

      return result;
    },
    onSuccess: (data, variables) => {
      console.log('✅ Lineup submission successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['dfs-lineup', variables.poolId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-lineup-salary', variables.poolId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-user-entries', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-todays-contests'] });
    },
    onError: (error) => {
      console.error('❌ Submit lineup mutation error:', error);
    },
  });
}

export function useUnsubmitDFSLineup() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error, { poolId: string; userId: string }>({
    mutationFn: async ({ poolId, userId }) => {
      console.log('↩️ Unsubmitting DFS lineup:', { poolId, userId });

      const { data, error } = await supabase.rpc('unsubmit_dfs_lineup', {
        p_pool_id: poolId,
        p_user_id: userId,
      });

      if (error) {
        console.error('❌ Unsubmit lineup error:', error);
        throw new Error(error.message || 'Failed to unsubmit lineup');
      }

      if (!data || data.length === 0) {
        throw new Error('No response from server');
      }

      const result = data[0];
      console.log('✅ Lineup unsubmitted:', result);

      if (!result.success) {
        throw new Error(result.message);
      }

      return result;
    },
    onSuccess: (data, variables) => {
      console.log('✅ Lineup unsubmit successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['dfs-lineup', variables.poolId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-lineup-salary', variables.poolId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-user-entries', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-todays-contests'] });
    },
    onError: (error) => {
      console.error('❌ Unsubmit lineup mutation error:', error);
    },
  });
}

