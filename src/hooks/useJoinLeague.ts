import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface JoinLeagueResponse {
  success: boolean;
  message: string;
  team_id: string;
  league_id: string;
  team_name?: string;
  is_new_team: boolean;
}

interface JoinLeagueParams {
  inviteCode: string;
  teamName?: string;
}

export function useJoinLeague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inviteCode, teamName }: JoinLeagueParams): Promise<JoinLeagueResponse> => {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('You must be logged in to join a league');
      }

      console.log('🏀 Attempting to join league with invite code:', inviteCode);
      console.log('🏀 User ID:', user.id);
      console.log('🏀 Team name:', teamName);

      // Call the database function
      const { data, error } = await supabase.rpc('join_league_via_invite', {
        invite_code_param: inviteCode,
        user_id_param: user.id,
        team_name_param: teamName || null,
      });

      console.log('🏀 Join league response:', { data, error });

      if (error) {
        console.error('Error joining league:', error);
        throw new Error(error.message || 'Failed to join league');
      }

      if (!data || !data.success) {
        console.error('Join league failed:', data);
        throw new Error(data?.message || 'Failed to join league');
      }

      return data as JoinLeagueResponse;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      queryClient.invalidateQueries({ queryKey: ['league', data.league_id] });
      queryClient.invalidateQueries({ queryKey: ['league-teams', data.league_id] });
      queryClient.invalidateQueries({ queryKey: ['user-teams'] });
    },
  });
}


