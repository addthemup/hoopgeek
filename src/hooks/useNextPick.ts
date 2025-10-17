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
      
      // First get the next pick from fantasy_draft_order
      const { data: draftPick, error: draftError } = await supabase
        .from('fantasy_draft_order')
        .select(`
          pick_number,
          round,
          team_position,
          is_completed,
          fantasy_team_id,
          fantasy_teams!fantasy_draft_order_fantasy_team_id_fkey (
            id,
            team_name
          )
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

      const nextPick: NextPick = {
        pickNumber: draftPick.pick_number,
        round: draftPick.round,
        teamId: draftPick.fantasy_team_id,
        teamName: draftPick.fantasy_teams.team_name,
        isCompleted: draftPick.is_completed
      };

      console.log('✅ Found next pick:', nextPick);
      return nextPick;
    },
    enabled: !!leagueId,
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  });
}
