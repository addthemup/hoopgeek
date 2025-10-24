import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DFSPlayer {
  id: string;
  pool_id: string;
  player_id: string;
  nba_player_id: number;
  player_name: string;
  player_team: string;
  player_position: string;
  salary: number;
  projected_points: number;
  is_active: boolean;
  is_playing: boolean;
}

export function useDFSPlayers(poolId: string | undefined) {
  return useQuery<DFSPlayer[]>({
    queryKey: ['dfs-players', poolId],
    queryFn: async () => {
      if (!poolId) throw new Error('Pool ID is required');

      const { data, error } = await supabase
        .from('dfs_player_salaries')
        .select('*')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('salary', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!poolId,
  });
}

