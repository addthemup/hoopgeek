import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { RosterSpot } from '../types';

export function useLeagueRosterSpots(leagueId: string) {
  return useQuery({
    queryKey: ['league-roster-spots', leagueId],
    queryFn: async () => {
      console.log(`🏀 Fetching roster spots for league ${leagueId}...`);
      
      const { data, error } = await supabase
        .from('roster_spots')
        .select('*')
        .eq('league_id', leagueId)
        .order('position_order', { ascending: true });

      if (error) {
        console.error('❌ Error fetching roster spots:', error);
        throw new Error(`Error fetching roster spots: ${error.message}`);
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} roster spots`);
      return data as RosterSpot[];
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
