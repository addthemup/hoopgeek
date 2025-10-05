import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface AvailableDraftPick {
  pick_number: number;
  round: number;
  team_position: number;
  is_completed: boolean;
}

export function useAvailableDraftPicks(leagueId: string, teamId: string) {
  return useQuery<AvailableDraftPick[], Error>({
    queryKey: ['available-draft-picks', leagueId, teamId],
    queryFn: async () => {
      if (!teamId) {
        return [];
      }

      console.log(`🏀 Fetching available draft picks for team ${teamId} in league ${leagueId}...`);
      
      // Get the team's position in the draft order
      const { data: teams, error: teamsError } = await supabase
        .from('fantasy_teams')
        .select('id')
        .eq('league_id', leagueId)
        .order('id');

      if (teamsError) {
        console.error('❌ Error fetching teams for draft order:', teamsError);
        throw new Error(`Failed to fetch teams: ${teamsError.message}`);
      }

      const teamIndex = teams.findIndex(t => t.id === teamId);
      if (teamIndex === -1) {
        console.error('❌ Team not found in league');
        return [];
      }

      const teamPosition = teamIndex + 1; // 1-based position

      // Get all draft picks for this team that haven't been completed yet
      const { data, error } = await supabase
        .from('draft_order')
        .select(`
          pick_number,
          round,
          team_position,
          is_completed
        `)
        .eq('league_id', leagueId)
        .eq('team_position', teamPosition)
        .eq('is_completed', false) // Only get picks that haven't been used
        .order('pick_number');

      if (error) {
        console.error('❌ Error fetching available draft picks:', error);
        throw new Error(`Failed to fetch available draft picks: ${error.message}`);
      }

      console.log(`✅ Successfully fetched ${data.length} available draft picks for team`);
      return data as AvailableDraftPick[];
    },
    enabled: !!leagueId && !!teamId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 5000, // Refetch every 5 seconds for live updates
  });
}
