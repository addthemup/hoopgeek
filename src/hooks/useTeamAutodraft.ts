import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface ToggleAutodraftParams {
  teamId: string;
  enabled: boolean;
  leagueId: string;
}

/**
 * Hook for toggling team autodraft on/off
 * Can be used by team owners or commissioners
 */
export function useToggleTeamAutodraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, enabled, leagueId }: ToggleAutodraftParams) => {
      const { data, error } = await supabase
        .from('fantasy_teams')
        .update({ autodraft_enabled: enabled })
        .eq('id', teamId)
        .select()
        .single();

      if (error) {
        console.error('Error toggling team autodraft:', error);
        throw new Error(`Failed to toggle autodraft: ${error.message}`);
      }

      // Add a system message to draft chat about autodraft being toggled
      try {
        const { data: team } = await supabase
          .from('fantasy_teams')
          .select('team_name, league_id')
          .eq('id', teamId)
          .single();

        if (team) {
          // Get the current season
          const { data: season } = await supabase
            .from('fantasy_league_seasons')
            .select('id')
            .eq('league_id', team.league_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (season) {
            await supabase
              .from('fantasy_draft_chat_messages')
              .insert({
                league_id: team.league_id,
                season_id: season.id,
                user_id: null, // System message
                fantasy_team_id: teamId,
                message: `🤖 Auto-draft ${enabled ? 'enabled' : 'disabled'} for ${team.team_name}`,
                message_type: 'system'
              });
          }
        }
      } catch (chatError) {
        console.warn('Failed to add autodraft toggle message to chat:', chatError);
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['teams', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft-order', variables.leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft-chat', variables.leagueId] });
    },
  });
}