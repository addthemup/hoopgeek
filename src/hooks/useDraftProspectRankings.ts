import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DraftProspectWithRanking {
  id: string;
  draft_year: number;
  player_name_full: string;
  player_slug: string;
  school_team: string | null;
  position_primary: string | null;
  /** Average rank across sources (lower = better). Null if no rankings in latest week. */
  aggregate_rank_avg: number | null;
  /** 1-based consensus rank (by aggregate_rank_avg). Null if unranked. */
  consensus_rank: number | null;
  /** Number of sources that ranked this prospect in the latest week. */
  source_count: number;
}

interface RankingsRow {
  draft_prospect_id: string | null;
  rank: number;
}

/**
 * Fetches draft prospects with aggregate ranking from the latest snapshot_week.
 * Aggregate = average of rank across sources (tankathon, nbadraft_net, espn, the_athletic).
 * Optionally limit to top N for the drawer module.
 */
export function useDraftProspectRankings(options?: { limit?: number; includeUnranked?: boolean }) {
  const { limit, includeUnranked = false } = options ?? {};

  return useQuery({
    queryKey: ['draft-prospect-rankings', limit ?? 'all', includeUnranked],
    queryFn: async () => {
      // 1. Get latest snapshot_week
      const { data: latestWeekData, error: weekError } = await supabase
        .from('draft_rankings')
        .select('snapshot_week')
        .not('draft_prospect_id', 'is', null)
        .order('snapshot_week', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (weekError) throw weekError;
      const latestWeek = latestWeekData?.snapshot_week;
      if (!latestWeek) {
        // No rankings yet; return all prospects with null aggregate if includeUnranked, else []
        if (!includeUnranked) return [];
        const { data: prospects, error: pErr } = await supabase
          .from('draft_prospects')
          .select('id, draft_year, player_name_full, player_slug, school_team, position_primary')
          .order('player_name_full');
        if (pErr) throw pErr;
        return (prospects ?? []).map((p) => ({
          ...p,
          aggregate_rank_avg: null,
          consensus_rank: null,
          source_count: 0,
        })) as DraftProspectWithRanking[];
      }

      // 2. Get all rankings for that week with prospect id
      const { data: rankingsData, error: rankError } = await supabase
        .from('draft_rankings')
        .select('draft_prospect_id, rank')
        .eq('snapshot_week', latestWeek)
        .not('draft_prospect_id', 'is', null);

      if (rankError) throw rankError;
      const rows = (rankingsData ?? []) as RankingsRow[];

      // 3. Aggregate by draft_prospect_id: average rank
      const byProspect = new Map<string, number[]>();
      for (const r of rows) {
        const id = r.draft_prospect_id!;
        if (!byProspect.has(id)) byProspect.set(id, []);
        byProspect.get(id)!.push(r.rank);
      }

      const prospectIds = Array.from(byProspect.keys());
      const avgRanks = new Map<string, { avg: number; count: number }>();
      for (const id of prospectIds) {
        const ranks = byProspect.get(id)!;
        const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
        avgRanks.set(id, { avg, count: ranks.length });
      }

      // Sort by avg ascending (best first), assign consensus_rank 1, 2, 3...
      const sortedIds = prospectIds.sort(
        (a, b) => avgRanks.get(a)!.avg - avgRanks.get(b)!.avg
      );

      const rankedProspectIds = limit != null ? sortedIds.slice(0, limit) : sortedIds;

      if (rankedProspectIds.length === 0 && !includeUnranked) return [];

      // 4. Fetch draft_prospects for ranked ids (and optionally all for includeUnranked)
      const idsToFetch = includeUnranked ? undefined : rankedProspectIds;
      let query = supabase
        .from('draft_prospects')
        .select('id, draft_year, player_name_full, player_slug, school_team, position_primary');
      if (idsToFetch != null && idsToFetch.length > 0) {
        query = query.in('id', idsToFetch);
      }
      const { data: prospectsData, error: prospectsError } = await query.order('player_name_full');
      if (prospectsError) throw prospectsError;
      const prospects = prospectsData ?? [];

      const consensusRankById = new Map<string, number>();
      sortedIds.forEach((id, i) => consensusRankById.set(id, i + 1));

      const result: DraftProspectWithRanking[] = prospects.map((p: Record<string, unknown>) => {
        const id = p.id as string;
        const info = avgRanks.get(id);
        const consensusRank = consensusRankById.get(id) ?? null;
        return {
          ...p,
          aggregate_rank_avg: info ? info.avg : null,
          consensus_rank: consensusRank,
          source_count: info ? info.count : 0,
        };
      });

      // If includeUnranked, we already have all prospects; sort so ranked first (by consensus), then unranked by name
      if (includeUnranked) {
        result.sort((a, b) => {
          const ar = a.consensus_rank ?? 1e9;
          const br = b.consensus_rank ?? 1e9;
          if (ar !== br) return ar - br;
          return (a.player_name_full || '').localeCompare(b.player_name_full || '');
        });
        return result as DraftProspectWithRanking[];
      }

      // Else return in consensus order (ranked only)
      const orderMap = new Map(rankedProspectIds.map((id, i) => [id, i]));
      result.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      return result as DraftProspectWithRanking[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
