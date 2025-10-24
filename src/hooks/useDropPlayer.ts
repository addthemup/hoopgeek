import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

interface DropPlayerParams {
  leagueId: string;
  seasonId: string;
  fantasyTeamId: string;
  playerId: string;
  notes?: string;
}

export function useDropPlayer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: DropPlayerParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('🔪 Dropping player:', params);

      // Call the drop_player database function
      const { data, error } = await supabase.rpc('drop_player', {
        league_id_param: params.leagueId,
        season_id_param: params.seasonId,
        fantasy_team_id_param: params.fantasyTeamId,
        player_id_param: params.playerId,
        user_id_param: user.id,
        notes_param: params.notes || null
      });

      if (error) {
        console.error('❌ Error dropping player:', error);
        throw new Error(error.message || 'Failed to drop player');
      }

      if (!data?.success) {
        console.error('❌ Drop player failed:', data);
        throw new Error(data?.error || 'Failed to drop player');
      }

      console.log('✅ Player dropped successfully:', data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log('✅ Drop player mutation successful, invalidating queries...');
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['roster', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['user-team-roster', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['available-roster-spots', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['roster-spots', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['player-roster-status'] });
      queryClient.invalidateQueries({ queryKey: ['available-players', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['players-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['players-on-waivers', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['league-waivers'] }); // LeagueHome waivers list
      queryClient.invalidateQueries({ queryKey: ['team-transactions', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['league-transactions', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions', variables.leagueId] }); // LeagueHome recent transactions
    },
    onError: (error) => {
      console.error('❌ Drop player mutation error:', error);
    }
  });
}

