import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface ProspectFavorite {
  id: string;
  draft_prospect_id: string;
  created_at: string;
  draft_prospects: {
    id: string;
    draft_year: number;
    player_name_full: string;
    player_slug: string;
    school_team: string | null;
    position_primary: string | null;
    image_url: string | null;
  };
}

export function useProspectFavorites() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['prospect-favorites', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_favorite_prospects')
        .select(
          `
          id,
          draft_prospect_id,
          created_at,
          draft_prospects (
            id,
            draft_year,
            player_name_full,
            player_slug,
            school_team,
            position_primary,
            image_url
          )
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ProspectFavorite[];
    },
    enabled: !!user?.id,
  });
}

export function useAddToProspectFavorites() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ draftProspectId }: { draftProspectId: string }) => {
      if (!user?.id) throw new Error('Must be logged in to add favorite prospect');
      const { data, error } = await supabase
        .from('user_favorite_prospects')
        .insert({
          user_id: user.id,
          draft_prospect_id: draftProspectId,
        })
        .select()
        .single();

      if (error) {
        const isDuplicate =
          error.code === '23505' ||
          error.message?.toLowerCase().includes('duplicate') ||
          error.message?.toLowerCase().includes('unique constraint');
        if (isDuplicate) return { id: 'duplicate', draft_prospect_id: draftProspectId };
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-favorites'] });
    },
  });
}

export function useRemoveFromProspectFavorites() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ draftProspectId }: { draftProspectId: string }) => {
      if (!user?.id) throw new Error('Must be logged in to remove favorite prospect');
      const { error } = await supabase
        .from('user_favorite_prospects')
        .delete()
        .eq('user_id', user.id)
        .eq('draft_prospect_id', draftProspectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospect-favorites'] });
    },
  });
}
