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
      console.log('✅ Auto-draft successful, invalidating queries...');
      
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['draft-order', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft-state', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['next-pick', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['roster', variables.leagueId] });
      
      // Invalidate available players queries (used in DraftPicks modal)
      queryClient.invalidateQueries({ queryKey: ['available-players', variables.leagueId] });
      
      // Invalidate paginated players queries (used in DraftBestAvailable)
      queryClient.invalidateQueries({ queryKey: ['players-paginated'] });
      
      // Invalidate accepted trades
      queryClient.invalidateQueries({ queryKey: ['accepted-trades', variables.leagueId] });
      
      console.log('🔄 All queries invalidated, UI should refresh');
    },
  });
}
