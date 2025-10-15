import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface WeeklyTeamScore {
  total_score: number;
  starters_score: number;
  rotation_score: number;
  bench_score: number;
  player_count: number;
}

export function useWeeklyTeamScore(leagueId: string, teamId: string, weekNumber: number) {
  return useQuery<WeeklyTeamScore | null, Error>({
    queryKey: ['weekly-team-score', leagueId, teamId, weekNumber],
    queryFn: async () => {
      if (!leagueId || !teamId || weekNumber < 0) return null;
      
      const { data, error } = await supabase.rpc('calculate_weekly_team_score', {
        p_league_id: leagueId,
        p_fantasy_team_id: teamId,
        p_week_number: weekNumber
      });
      
      if (error) {
        console.error('Error calculating weekly team score:', error);
        throw error;
      }
      
      return data?.[0] || null;
    },
    enabled: !!leagueId && !!teamId && weekNumber >= 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
