import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface CreateDFSPoolParams {
  pool_name: string;
  slate_name: string;
  description?: string;
  slate_date: string;
  game_ids: string[];
  entry_fee: number;
  max_entries: number;
  difficulty: 'elite' | 'pro' | 'standard';
  prize_type?: 'top_n' | 'top_percent' | '50_50' | 'winner_take_all' | 'satellites';
  is_guaranteed?: boolean;
  guaranteed_amount?: number;
  roster_config?: 'compact' | 'full';
  scoring_format?: 'FanDuel' | 'DraftKings' | 'Yahoo' | 'ESPN' | 'Custom';
}

export interface CreateDFSPoolResult {
  pool_id: string;
  message: string;
  players_added: number;
  games_added: number;
}

export function useCreateDFSPool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<CreateDFSPoolResult, Error, CreateDFSPoolParams>({
    mutationFn: async (params) => {
      console.log('🏀 Creating DFS pool:', params);

      if (!user) {
        throw new Error('Must be logged in to create pools');
      }

      // Determine roster counts based on configuration
      const rosterConfig = params.roster_config || 'compact';
      const [startersCount, rotationCount, benchCount] = 
        rosterConfig === 'full' 
          ? [5, 5, 3]  // Full: G G F F C / G G F F C / UTIL UTIL UTIL
          : [5, 3, 2]; // Compact: G G F F C / G F C / UTIL UTIL

      const { data, error } = await supabase.rpc('create_dfs_pool_from_games', {
        // Required parameters
        p_pool_name: params.pool_name,
        p_slate_name: params.slate_name,
        p_slate_date: params.slate_date,
        p_game_ids: params.game_ids,
        // Optional parameters
        p_description: params.description || '',
        p_entry_fee: params.entry_fee,
        p_max_entries: params.max_entries,
        p_difficulty_tier: params.difficulty,
        p_starters_count: startersCount,
        p_rotation_count: rotationCount,
        p_bench_count: benchCount,
        p_scoring_format: params.scoring_format || 'FanDuel',
      });

      if (error) {
        console.error('❌ Failed to create DFS pool:', error);
        throw new Error(error.message || 'Failed to create pool');
      }

      console.log('✅ Pool created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Pool created, invalidating queries');
      // Invalidate admin pools query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['dfs-admin-pools'] });
      queryClient.invalidateQueries({ queryKey: ['dfs-pools'] });
    },
    onError: (error) => {
      console.error('❌ Create pool mutation error:', error);
    },
  });
}

