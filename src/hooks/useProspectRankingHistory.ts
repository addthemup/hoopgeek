import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface ProspectRankingRow {
  source: string;
  snapshot_week: string;
  rank: number;
}

/**
 * Fetches draft_rankings history for a single prospect: all (source, snapshot_week, rank)
 * ordered by snapshot_week ascending for ranking-over-time display.
 */
export function useProspectRankingHistory(prospectId: string | undefined) {
  return useQuery<ProspectRankingRow[]>({
    queryKey: ['prospect-ranking-history', prospectId],
    queryFn: async () => {
      if (!prospectId) return [];
      const { data, error } = await supabase
        .from('draft_rankings')
        .select('source, snapshot_week, rank')
        .eq('draft_prospect_id', prospectId)
        .order('snapshot_week', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProspectRankingRow[];
    },
    enabled: !!prospectId,
    staleTime: 2 * 60 * 1000,
  });
}
