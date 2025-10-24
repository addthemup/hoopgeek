import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export function useDeleteDFSPool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (poolId: string) => {
      console.log('🗑️ Deleting DFS pool:', poolId);

      if (!user) {
        throw new Error('Must be logged in to delete pools');
      }

      // Use database function to delete pool (bypasses RLS)
      const { data, error } = await supabase.rpc('delete_dfs_pool', {
        p_pool_id: poolId,
        p_user_id: user.id,
      });

      if (error) {
        console.error('❌ Failed to delete DFS pool:', error);
        throw new Error(error.message || 'Failed to delete pool');
      }

      // Check the result from the function
      if (data && data.length > 0) {
        const result = data[0];
        if (!result.success) {
          throw new Error(result.message || 'Failed to delete pool');
        }
        console.log('✅ Pool deleted successfully:', result.message);
      } else {
        console.log('✅ Pool deleted successfully');
      }
    },
    onSuccess: () => {
      console.log('✅ Pool deleted, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['dfs-admin-pools'] });
      queryClient.invalidateQueries({ queryKey: ['dfs-todays-contests'] });
    },
    onError: (error) => {
      console.error('❌ Delete pool mutation error:', error);
    },
  });
}

