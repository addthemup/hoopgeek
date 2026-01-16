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
  // Injury data (optional)
  injury_status?: string | null;
  injury_type?: string | null;
  injury_description?: string | null;
}

export function useDFSPlayers(poolId: string | undefined) {
  return useQuery<DFSPlayer[]>({
    queryKey: ['dfs-players', poolId],
    queryFn: async () => {
      if (!poolId) throw new Error('Pool ID is required');

      // Fetch players with their current injury status
      const { data: players, error: playersError } = await supabase
        .from('dfs_player_salaries')
        .select('*')
        .eq('pool_id', poolId)
        .eq('is_active', true)
        .order('salary', { ascending: false });

      if (playersError) throw playersError;
      if (!players || players.length === 0) return [];

      // Get nba_player_ids to fetch injuries
      const nbaPlayerIds = players
        .map(p => p.nba_player_id)
        .filter(id => id != null);

      // Fetch current injuries for these players
      let injuriesMap = new Map<number, any>();
      if (nbaPlayerIds.length > 0) {
        const { data: injuries, error: injuriesError } = await supabase
          .from('nba_injuries')
          .select('nba_player_id, injury_status, injury_type, injury_description')
          .in('nba_player_id', nbaPlayerIds)
          .eq('is_current', true)
          .in('injury_status', ['Out', 'Questionable', 'Day-to-Day']);

        if (!injuriesError && injuries) {
          injuries.forEach(injury => {
            injuriesMap.set(injury.nba_player_id, injury);
          });
        }
      }

      // Merge injury data into players
      return players.map(player => ({
        ...player,
        injury_status: injuriesMap.get(player.nba_player_id)?.injury_status || null,
        injury_type: injuriesMap.get(player.nba_player_id)?.injury_type || null,
        injury_description: injuriesMap.get(player.nba_player_id)?.injury_description || null,
      }));
    },
    enabled: !!poolId,
  });
}

