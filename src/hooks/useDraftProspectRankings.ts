import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DraftProspectWithRanking {
  id: string;
  draft_year: number;
  player_name_full: string;
  player_slug: string;
  school_team: string | null;
  position_primary: string | null;
  /** URL to player headshot (e.g. ESPN, European team). */
  image_url: string | null;
  /** Average rank across sources (lower = better). Null if no rankings in latest week. */
  aggregate_rank_avg: number | null;
  /** 1-based consensus rank (by aggregate_rank_avg). Null if unranked. */
  consensus_rank: number | null;
  /** Number of sources that ranked this prospect in the latest week. */
  source_count: number;
  /** Change vs previous snapshot: positive = moved up (improved), negative = moved down, null = no previous data. */
  rank_delta: number | null;
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
      // 1. Get latest and previous snapshot_week (for rank delta)
      const { data: weeksData, error: weekError } = await supabase
        .from('draft_rankings')
        .select('snapshot_week')
        .not('draft_prospect_id', 'is', null)
        .order('snapshot_week', { ascending: false });

      if (weekError) throw weekError;
      const distinctWeeks = [...new Set((weeksData ?? []).map((r) => (r as { snapshot_week: string }).snapshot_week))];
      const latestWeek = distinctWeeks[0] ?? null;
      const previousWeek = distinctWeeks.length > 1 ? distinctWeeks[1]! : null;

      if (!latestWeek) {
        if (!includeUnranked) return [];
        const { data: prospects, error: pErr } = await supabase
          .from('draft_prospects')
          .select('id, draft_year, player_name_full, player_slug, school_team, position_primary, image_url')
          .order('player_name_full');
        if (pErr) throw pErr;
        return (prospects ?? []).map((p) => ({
          ...p,
          aggregate_rank_avg: null,
          consensus_rank: null,
          source_count: 0,
          rank_delta: null,
        })) as DraftProspectWithRanking[];
      }

      // 2. Get all rankings for latest week
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

      const sortedIds = [...prospectIds].sort(
        (a, b) => avgRanks.get(a)!.avg - avgRanks.get(b)!.avg
      );
      const consensusRankById = new Map<string, number>();
      sortedIds.forEach((id, i) => consensusRankById.set(id, i + 1));

      // 4. Previous week consensus (for rank_delta)
      let previousConsensusById = new Map<string, number>();
      if (previousWeek) {
        const { data: prevData } = await supabase
          .from('draft_rankings')
          .select('draft_prospect_id, rank')
          .eq('snapshot_week', previousWeek)
          .not('draft_prospect_id', 'is', null);
        const prevRows = (prevData ?? []) as RankingsRow[];
        const prevByProspect = new Map<string, number[]>();
        for (const r of prevRows) {
          const id = r.draft_prospect_id!;
          if (!prevByProspect.has(id)) prevByProspect.set(id, []);
          prevByProspect.get(id)!.push(r.rank);
        }
        const prevIds = Array.from(prevByProspect.keys());
        const prevAvgRanks = new Map<string, number>();
        for (const id of prevIds) {
          const ranks = prevByProspect.get(id)!;
          prevAvgRanks.set(id, ranks.reduce((a, b) => a + b, 0) / ranks.length);
        }
        const prevSortedIds = [...prevIds].sort((a, b) => prevAvgRanks.get(a)! - prevAvgRanks.get(b)!);
        prevSortedIds.forEach((id, i) => previousConsensusById.set(id, i + 1));
      }

      const rankedProspectIds = limit != null ? sortedIds.slice(0, limit) : sortedIds;

      if (rankedProspectIds.length === 0 && !includeUnranked) return [];

      // 5. Fetch draft_prospects
      const idsToFetch = includeUnranked ? undefined : rankedProspectIds;
      let query = supabase
        .from('draft_prospects')
        .select('id, draft_year, player_name_full, player_slug, school_team, position_primary, image_url');
      if (idsToFetch != null && idsToFetch.length > 0) {
        query = query.in('id', idsToFetch);
      }
      const { data: prospectsData, error: prospectsError } = await query.order('player_name_full');
      if (prospectsError) throw prospectsError;
      const prospects = prospectsData ?? [];

      const result: DraftProspectWithRanking[] = prospects.map((p: Record<string, unknown>) => {
        const id = p.id as string;
        const info = avgRanks.get(id);
        const consensusRank = consensusRankById.get(id) ?? null;
        const prevRank = previousConsensusById.get(id) ?? null;
        const rank_delta =
          consensusRank != null && prevRank != null ? prevRank - consensusRank : null;
        return {
          ...p,
          aggregate_rank_avg: info ? info.avg : null,
          consensus_rank: consensusRank,
          source_count: info ? info.count : 0,
          rank_delta,
        };
      });

      if (includeUnranked) {
        result.sort((a, b) => {
          const ar = a.consensus_rank ?? 1e9;
          const br = b.consensus_rank ?? 1e9;
          if (ar !== br) return ar - br;
          return (a.player_name_full || '').localeCompare(b.player_name_full || '');
        });
        return result as DraftProspectWithRanking[];
      }

      const orderMap = new Map(rankedProspectIds.map((id, i) => [id, i]));
      result.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      return result as DraftProspectWithRanking[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface DraftProspectAvatar {
  id: string;
  image_url: string | null;
  player_name_full: string;
}

/**
 * Fetches draft_prospects by id for avatar/thumbnail use (e.g. draft post card thumbnails).
 * Returns array in the same order as the input ids.
 */
export function useDraftProspectsByIds(ids: string[]) {
  return useQuery({
    queryKey: ['draft-prospects-by-ids', ids.length > 0 ? ids.slice().sort().join(',') : ''],
    queryFn: async (): Promise<DraftProspectAvatar[]> => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('draft_prospects')
        .select('id, image_url, player_name_full')
        .in('id', ids);
      if (error) throw error;
      const byId = new Map((data ?? []).map((r) => [r.id, { id: r.id, image_url: r.image_url ?? null, player_name_full: r.player_name_full ?? '' }]));
      return ids.map((id) => byId.get(id) ?? { id, image_url: null, player_name_full: '' });
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
