import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DFSUserEntry {
  id: string;
  pool_id: string;
  pool_name: string;
  pool_status: string;
  slate_date: string;
  entry_fee: number;
  is_submitted: boolean;
  lineup_locked: boolean;
  total_salary: number;
  final_points: number;
  final_rank: number | null;
  prize_won: number | null;
  difficulty_tier: string;
  lineup: {
    player_id: string;
    nba_player_id: number;
    player_name: string;
    player_team: string;
    player_position: string;
    player_salary: number;
    unit: string;
    unit_position: number;
  }[];
}

export function useDFSUserEntries(userId: string | undefined) {
  return useQuery<DFSUserEntry[]>({
    queryKey: ['dfs-user-entries', userId],
    queryFn: async () => {
      if (!userId) return [];

      console.log('📊 Fetching user entries for:', userId);

      // Get user's entries with pool details
      const { data: entries, error: entriesError } = await supabase
        .from('dfs_entries')
        .select(`
          id,
          pool_id,
          is_submitted,
          lineup_locked,
          total_salary,
          final_points,
          final_rank,
          prize_won,
          dfs_pools!inner(
            name,
            status,
            slate_date,
            entry_fee,
            difficulty_tier
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (entriesError) {
        console.error('❌ Error fetching entries:', entriesError);
        throw entriesError;
      }

      console.log('✅ Found entries:', entries?.length);

      // For each entry, get the lineup
      const entriesWithLineups = await Promise.all(
        (entries || []).map(async (entry) => {
          // Get lineup for this entry
          const { data: lineup, error: lineupError } = await supabase
            .from('dfs_lineups')
            .select('id')
            .eq('entry_id', entry.id)
            .maybeSingle();

          if (lineupError || !lineup) {
            console.log('No lineup found for entry:', entry.id);
            return {
              ...entry,
              pool_name: (entry.dfs_pools as any).name,
              pool_status: (entry.dfs_pools as any).status,
              slate_date: (entry.dfs_pools as any).slate_date,
              entry_fee: (entry.dfs_pools as any).entry_fee,
              difficulty_tier: (entry.dfs_pools as any).difficulty_tier,
              lineup: [],
            };
          }

          // Get lineup positions
          const { data: positions, error: positionsError } = await supabase
            .from('dfs_lineup_positions')
            .select('player_id, nba_player_id, player_name, player_team, player_position, player_salary, unit, unit_position')
            .eq('lineup_id', lineup.id)
            .order('unit')
            .order('unit_position');

          if (positionsError) {
            console.error('❌ Error fetching lineup positions:', positionsError);
          }

          return {
            ...entry,
            pool_name: (entry.dfs_pools as any).name,
            pool_status: (entry.dfs_pools as any).status,
            slate_date: (entry.dfs_pools as any).slate_date,
            entry_fee: (entry.dfs_pools as any).entry_fee,
            difficulty_tier: (entry.dfs_pools as any).difficulty_tier,
            lineup: positions || [],
          };
        })
      );

      console.log('✅ Entries with lineups:', entriesWithLineups.length);
      return entriesWithLineups;
    },
    enabled: !!userId,
  });
}

