import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface AvailableDraftPick {
  pick_number: number;
  round: number;
  team_position: number;
  is_completed: boolean;
  current_team_id?: string | null; // Current owner of the pick (may be different from original if traded)
}

export function useAvailableDraftPicks(leagueId: string, teamId: string, options?: { refetchInterval?: number; staleTime?: number }) {
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
      // This includes:
      // 1. Original picks (where current_team_id is null or matches fantasy_team_id)
      // 2. Traded picks (where current_team_id matches this team)
      const { data, error } = await supabase
        .from('fantasy_draft_order')
        .select(`
          pick_number,
          round,
          team_position,
          is_completed,
          fantasy_team_id,
          current_team_id
        `)
        .eq('league_id', leagueId)
        .eq('is_completed', false) // Only get picks that haven't been used
        .order('pick_number');

      if (error) {
        console.error('❌ Error fetching available draft picks:', error);
        throw new Error(`Failed to fetch available draft picks: ${error.message}`);
      }

      // Filter picks that belong to this team (either as original owner or current owner)
      const teamPicks = data.filter(pick => {
        // If current_team_id is set, use that (pick was traded)
        if (pick.current_team_id) {
          return pick.current_team_id === teamId;
        }
        // Otherwise, use fantasy_team_id (original owner)
        return pick.fantasy_team_id === teamId;
      });

      console.log(`✅ Successfully fetched ${teamPicks.length} available draft picks for team (${data.length} total picks checked)`);
      console.log('🏀 Team picks:', teamPicks);
      
      return teamPicks.map(pick => ({
        pick_number: pick.pick_number,
        round: pick.round,
        team_position: pick.team_position,
        is_completed: pick.is_completed,
        current_team_id: pick.current_team_id || pick.fantasy_team_id
      })) as AvailableDraftPick[];
    },
    enabled: !!leagueId && !!teamId,
    staleTime: options?.staleTime || 1000, // Consider data stale after 1 second
    refetchInterval: options?.refetchInterval || 2000, // Refetch every 2 seconds for live updates
  });
}
