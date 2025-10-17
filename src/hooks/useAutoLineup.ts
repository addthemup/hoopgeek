import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface AutoLineupRequest {
  leagueId: string;
  teamId: string;
  weekNumber: number;
  seasonYear: number;
  seasonId: string;
  matchupId: string;
}

interface AutoLineupResponse {
  success: boolean;
  message?: string;
  error?: string;
  lineupEntries?: number;
  removedInvalid?: number;
}

export function useAutoLineup() {
  const queryClient = useQueryClient();

  return useMutation<AutoLineupResponse, Error, AutoLineupRequest>({
    mutationFn: async (request: AutoLineupRequest) => {
      console.log('🤖 Calling auto-lineup function with:', request);
      
      const { data, error } = await supabase.functions.invoke('auto-lineup', {
        body: request
      });

      if (error) {
        console.error('❌ Auto-lineup function error:', error);
        throw new Error(`Auto-lineup failed: ${error.message}`);
      }

      console.log('✅ Auto-lineup function response:', data);
      return data as AutoLineupResponse;
    },
    onSuccess: (data, variables) => {
      // Invalidate lineup positions query to refresh the UI
      queryClient.invalidateQueries({ 
        queryKey: ['lineup-positions', variables.leagueId, variables.teamId] 
      });
      
      console.log('✅ Auto-lineup completed:', {
        lineupEntries: data.lineupEntries,
        removedInvalid: data.removedInvalid
      });
    },
    onError: (error) => {
      console.error('❌ Auto-lineup mutation error:', error);
    }
  });
}
