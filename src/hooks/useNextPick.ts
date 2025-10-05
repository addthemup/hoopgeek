import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface NextPick {
  pickNumber: number;
  round: number;
  teamId: string;
  teamName: string;
  isCompleted: boolean;
}

export function useNextPick(leagueId: string) {
  return useQuery<NextPick | null, Error>({
    queryKey: ['nextPick', leagueId],
    queryFn: async () => {
      console.log(`🔍 Finding next pick for league ${leagueId}...`);
      
      // First get the next pick from draft_order
      const { data: draftPick, error: draftError } = await supabase
        .from('draft_order')
        .select(`
          pick_number,
          round,
          team_position,
          is_completed
        `)
        .eq('league_id', leagueId)
        .eq('is_completed', false)
        .order('pick_number', { ascending: true })
        .limit(1)
        .single();

      if (draftError) {
        if (draftError.code === 'PGRST116') {
          // No more picks available
          console.log('✅ No more picks available - draft complete');
          return null;
        }
        console.error('❌ Error fetching next pick:', draftError);
        throw new Error(`Failed to fetch next pick: ${draftError.message}`);
      }

      // Then get the team information based on team_position
      const { data: teams, error: teamsError } = await supabase
        .from('fantasy_teams')
        .select('id, team_name')
        .eq('league_id', leagueId)
        .order('id', { ascending: true });

      if (teamsError) {
        throw teamsError;
      }

      // Find the team at the specified position (1-based)
      const team = teams[draftPick.team_position - 1];
      if (!team) {
        throw new Error('Team not found for draft position');
      }

      const data = {
        ...draftPick,
        fantasy_teams: team
      };

      const nextPick: NextPick = {
        pickNumber: data.pick_number,
        round: data.round,
        teamId: data.fantasy_teams.id,
        teamName: data.fantasy_teams.team_name,
        isCompleted: data.is_completed
      };

      console.log('✅ Found next pick:', nextPick);
      return nextPick;
    },
    enabled: !!leagueId,
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  });
}
