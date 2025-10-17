import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface AutoDraftRequest {
  leagueId: string;
  playerId: string;
  teamId: string;
  pickNumber: number;
}

export function useAutoDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leagueId, playerId, teamId, pickNumber }: AutoDraftRequest) => {
      console.log(`🤖 Auto-drafting player ${playerId} to team ${teamId} at pick ${pickNumber}`);
      console.log('📤 Sending request to auto-draft function with:', { leagueId, playerId, teamId, pickNumber });
      
      const { data, error } = await supabase.functions.invoke('auto-draft', {
        body: {
          leagueId,
          playerId,
          teamId,
          pickNumber
        }
      });
      
      console.log('📥 Auto-draft response:', { data, error });

      if (error) {
        console.error('❌ Auto-draft error:', error);
        throw new Error(`Failed to auto-draft player: ${error.message}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('✅ Auto-draft successful');
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['draftOrder', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['nextPick', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['players-paginated'] }); // This will refresh the players list
      queryClient.invalidateQueries({ queryKey: ['teams', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['roster', variables.leagueId] });
    },
  });
}
