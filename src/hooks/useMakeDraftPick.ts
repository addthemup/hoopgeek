import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface MakeDraftPickParams {
  leagueId: string;
  playerId: string;
  teamId: string;
  pickNumber: number;
}

export function useMakeDraftPick() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leagueId, playerId, teamId, pickNumber }: MakeDraftPickParams) => {
      // First, get the current draft order for this pick
      const { data: draftOrder, error: orderError } = await supabase
        .from('fantasy_draft_order')
        .select('id')
        .eq('league_id', leagueId)
        .eq('pick_number', pickNumber)
        .single();

      if (orderError || !draftOrder) {
        throw new Error('Could not find draft order for this pick');
      }

      // Make the draft pick using the database function
      const { data, error } = await supabase
        .rpc('make_draft_pick', {
          league_id_param: leagueId,
          draft_order_id_param: draftOrder.id,
          player_id_param: playerId
        });

      if (error) {
        console.error('Error making draft pick:', error);
        throw new Error(`Failed to make draft pick: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to make draft pick');
      }

      // Trigger draft-manager to move to next pick
      console.log('🚀 Triggering draft-manager to move to next pick...');
      try {
        const { error: managerError } = await supabase.functions.invoke('draft-manager', {
          body: { 
            trigger: 'pick_made', 
            league_id: leagueId,
            pick_number: pickNumber
          }
        });

        if (managerError) {
          console.warn('⚠️ Draft-manager trigger failed (this is normal):', managerError);
        } else {
          console.log('✅ Draft-manager triggered successfully');
        }
      } catch (triggerError) {
        console.warn('⚠️ Draft-manager trigger failed (this is normal):', triggerError);
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['draft-order', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft-state', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['next-pick', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.leagueId] });
    },
  });
}
