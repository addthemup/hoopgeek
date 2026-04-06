import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface DraftUserRanking {
  id: string;
  user_id: string;
  draft_prospect_id: string;
  draft_year: number;
  rank: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftUserRankingHistoryRow {
  id: string;
  user_id: string;
  draft_prospect_id: string;
  draft_year: number;
  rank: number;
  changed_at: string;
}

export interface DraftUserAggregateRow {
  draft_prospect_id: string;
  draft_year: number;
  user_rank_avg: number;
  user_rank_count: number;
}

export function useDraftUserRankings(draftYear?: number | null) {
  const { user } = useAuth();

  return useQuery<DraftUserRanking[]>({
    queryKey: ['draft-user-rankings', user?.id, draftYear ?? 'all'],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('user_draft_rankings')
        .select('id, user_id, draft_prospect_id, draft_year, rank, notes, created_at, updated_at')
        .order('rank', { ascending: true });
      if (draftYear != null) query = query.eq('draft_year', draftYear);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DraftUserRanking[];
    },
    enabled: !!user?.id,
  });
}

export function useDraftUserAggregate(draftYear?: number | null) {
  return useQuery<DraftUserAggregateRow[]>({
    queryKey: ['draft-user-aggregate', draftYear ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('draft_user_rank_aggregates')
        .select('draft_prospect_id, draft_year, user_rank_avg, user_rank_count');
      if (draftYear != null) query = query.eq('draft_year', draftYear);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DraftUserAggregateRow[];
    },
    staleTime: 60 * 1000,
  });
}

export function useDraftUserRankingHistory(prospectId?: string, draftYear?: number | null) {
  const { user } = useAuth();
  return useQuery<DraftUserRankingHistoryRow[]>({
    queryKey: ['draft-user-ranking-history', user?.id, prospectId ?? 'none', draftYear ?? 'all'],
    queryFn: async () => {
      if (!user?.id || !prospectId) return [];
      let query = supabase
        .from('user_draft_ranking_history')
        .select('id, user_id, draft_prospect_id, draft_year, rank, changed_at')
        .eq('draft_prospect_id', prospectId)
        .order('changed_at', { ascending: true });
      if (draftYear != null) query = query.eq('draft_year', draftYear);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DraftUserRankingHistoryRow[];
    },
    enabled: !!user?.id && !!prospectId,
    staleTime: 30 * 1000,
  });
}

export function useUpsertDraftUserRanking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { draftProspectId: string; draftYear: number; rank: number; notes?: string | null }) => {
      if (!user?.id) throw new Error('Must be logged in to update mock draft rankings');
      const { data, error } = await supabase
        .from('user_draft_rankings')
        .upsert(
          {
            user_id: user.id,
            draft_prospect_id: payload.draftProspectId,
            draft_year: payload.draftYear,
            rank: payload.rank,
            notes: payload.notes ?? null,
          },
          { onConflict: 'user_id,draft_year,draft_prospect_id' }
        )
        .select('id, user_id, draft_prospect_id, draft_year, rank, notes, created_at, updated_at')
        .single();
      if (error) throw error;
      return data as DraftUserRanking;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-user-rankings'] });
      queryClient.invalidateQueries({ queryKey: ['draft-user-aggregate'] });
      queryClient.invalidateQueries({
        queryKey: ['draft-user-ranking-history', user?.id, variables.draftProspectId],
      });
    },
  });
}
