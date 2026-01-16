import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface UpdateDFSPoolParams {
  pool_id: string;
  pool_name?: string;
  description?: string;
  entry_fee?: number;
  max_entries?: number;
  status?: string;
  is_guaranteed?: boolean;
  is_featured?: boolean;
  icon_name?: string;
  html_color_primary?: string;
  html_color_secondary?: string;
}

export function useUpdateDFSPool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateDFSPoolParams>({
    mutationFn: async (params) => {
      console.log('✏️ Updating DFS pool:', params);

      if (!user) {
        throw new Error('Must be logged in to update pools');
      }

      const { pool_id, ...updateData } = params;

      // Build the update object with only defined fields
      const updates: any = {};
      if (updateData.pool_name !== undefined) updates.name = updateData.pool_name;
      if (updateData.description !== undefined) updates.description = updateData.description;
      if (updateData.entry_fee !== undefined) updates.entry_fee = updateData.entry_fee;
      if (updateData.max_entries !== undefined) updates.max_entries = updateData.max_entries;
      if (updateData.status !== undefined) updates.status = updateData.status;
      if (updateData.is_guaranteed !== undefined) updates.is_guaranteed = updateData.is_guaranteed;
      if (updateData.is_featured !== undefined) updates.is_featured = updateData.is_featured;
      if (updateData.icon_name !== undefined) updates.icon_name = updateData.icon_name;
      if (updateData.html_color_primary !== undefined) updates.html_color_primary = updateData.html_color_primary;
      if (updateData.html_color_secondary !== undefined) updates.html_color_secondary = updateData.html_color_secondary;

      const { error } = await supabase
        .from('dfs_pools')
        .update(updates)
        .eq('id', pool_id);

      if (error) {
        console.error('❌ Failed to update DFS pool:', error);
        throw new Error(error.message || 'Failed to update pool');
      }

      console.log('✅ Pool updated successfully');
    },
    onSuccess: () => {
      console.log('✅ Pool updated, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['dfs-admin-pools'] });
      queryClient.invalidateQueries({ queryKey: ['dfs-todays-contests'] });
    },
    onError: (error) => {
      console.error('❌ Update pool mutation error:', error);
    },
  });
}

