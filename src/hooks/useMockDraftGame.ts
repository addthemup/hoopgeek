import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface UserMockDraftRow {
  id: string;
  user_id: string;
  draft_year: number;
  status: string;
  draft_order_id: string | null;
  created_at: string;
  updated_at: string;
  share_token?: string;
  is_shared?: boolean;
}

export interface UserMockDraftPickRow {
  id: string;
  user_mock_draft_id: string;
  pick_number: number;
  team_abbreviation: string;
  draft_prospect_id: string;
  created_at: string;
}

export function useUserMockDraft(draftYear: number | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-mock-draft', user?.id, draftYear],
    queryFn: async (): Promise<UserMockDraftRow | null> => {
      if (!user?.id || !draftYear) return null;
      const { data, error } = await supabase
        .from('user_mock_drafts')
        .select('*')
        .eq('user_id', user.id)
        .eq('draft_year', draftYear)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as UserMockDraftRow | null;
    },
    enabled: !!user?.id && !!draftYear,
  });
}

export function useUserMockDraftPicks(mockDraftId: string | undefined) {
  return useQuery({
    queryKey: ['user-mock-draft-picks', mockDraftId],
    queryFn: async (): Promise<UserMockDraftPickRow[]> => {
      if (!mockDraftId) return [];
      const { data, error } = await supabase
        .from('user_mock_draft_picks')
        .select('*')
        .eq('user_mock_draft_id', mockDraftId)
        .order('pick_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserMockDraftPickRow[];
    },
    enabled: !!mockDraftId,
  });
}

/** Public view: shared mock by URL token (anon RLS). */
export function usePublicMockDraftByShareToken(shareToken: string | undefined) {
  return useQuery({
    queryKey: ['public-mock-draft', shareToken],
    queryFn: async (): Promise<UserMockDraftRow | null> => {
      if (!shareToken) return null;
      const { data, error } = await supabase
        .from('user_mock_drafts')
        .select('*')
        .eq('share_token', shareToken)
        .eq('is_shared', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as UserMockDraftRow | null;
    },
    enabled: !!shareToken,
  });
}

export function useToggleMockDraftShare() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { mockDraftId: string; draftYear: number; isShared: boolean }) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { error } = await supabase
        .from('user_mock_drafts')
        .update({ is_shared: args.isShared, updated_at: new Date().toISOString() })
        .eq('id', args.mockDraftId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: (_d, args) => {
      queryClient.invalidateQueries({ queryKey: ['user-mock-draft', user?.id, args.draftYear] });
      queryClient.invalidateQueries({ queryKey: ['public-mock-draft'] });
    },
  });
}

export function useMockDraftScore(draftYear: number | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['mock-draft-score', user?.id, draftYear],
    queryFn: async () => {
      if (!user?.id || !draftYear) return null;
      const { data, error } = await supabase
        .from('mock_draft_scores')
        .select('points_total, breakdown, computed_at')
        .eq('user_id', user.id)
        .eq('draft_year', draftYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!draftYear,
  });
}

export function useEnsureUserMockDraft() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { draftYear: number; draftOrderId: string | null }) => {
      if (!user?.id) throw new Error('Must be logged in');
      const { data: existing, error: findErr } = await supabase
        .from('user_mock_drafts')
        .select('id')
        .eq('user_id', user.id)
        .eq('draft_year', payload.draftYear)
        .maybeSingle();
      if (findErr) throw findErr;
      if (existing?.id) return existing.id as string;

      const { data: inserted, error: insErr } = await supabase
        .from('user_mock_drafts')
        .insert({
          user_id: user.id,
          draft_year: payload.draftYear,
          status: 'in_progress',
          draft_order_id: payload.draftOrderId,
        })
        .select('id')
        .maybeSingle();

      if (!insErr && inserted?.id) return inserted.id as string;

      // Race: another tab inserted first
      if (insErr && (insErr.code === '23505' || insErr.message?.includes('unique'))) {
        const { data: again, error: e2 } = await supabase
          .from('user_mock_drafts')
          .select('id')
          .eq('user_id', user.id)
          .eq('draft_year', payload.draftYear)
          .single();
        if (e2) throw e2;
        return again.id as string;
      }
      if (insErr) throw insErr;
      throw new Error('Failed to create mock draft');
    },
    onSuccess: (_id, v) => {
      queryClient.invalidateQueries({ queryKey: ['user-mock-draft', user?.id, v.draftYear] });
    },
  });
}

export function useSetMockDraftPick() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      userMockDraftId: string;
      draftYear: number;
      pickNumber: number;
      teamAbbreviation: string;
      draftProspectId: string;
      totalSlots: number;
    }) => {
      const { userMockDraftId, pickNumber, teamAbbreviation, draftProspectId, totalSlots } = args;

      const { error: delErr } = await supabase
        .from('user_mock_draft_picks')
        .delete()
        .eq('user_mock_draft_id', userMockDraftId)
        .eq('pick_number', pickNumber);
      if (delErr) throw delErr;

      const { error: dupErr } = await supabase
        .from('user_mock_draft_picks')
        .delete()
        .eq('user_mock_draft_id', userMockDraftId)
        .eq('draft_prospect_id', draftProspectId);
      if (dupErr) throw dupErr;

      const { error: insErr } = await supabase.from('user_mock_draft_picks').insert({
        user_mock_draft_id: userMockDraftId,
        pick_number: pickNumber,
        team_abbreviation: teamAbbreviation,
        draft_prospect_id: draftProspectId,
      });
      if (insErr) throw insErr;

      const { count, error: countErr } = await supabase
        .from('user_mock_draft_picks')
        .select('*', { count: 'exact', head: true })
        .eq('user_mock_draft_id', userMockDraftId);
      if (countErr) throw countErr;

      const nextStatus = (count ?? 0) >= totalSlots ? 'completed' : 'in_progress';
      const { error: upErr } = await supabase
        .from('user_mock_drafts')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', userMockDraftId);
      if (upErr) throw upErr;
    },
    onSuccess: (_res, args) => {
      queryClient.invalidateQueries({ queryKey: ['user-mock-draft-picks', args.userMockDraftId] });
      queryClient.invalidateQueries({ queryKey: ['user-mock-draft', user?.id, args.draftYear] });
    },
  });
}
