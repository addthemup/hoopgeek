import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface WeeklyMatchup {
  id: string;
  week_number: number;
  matchup_date: string;
  status: 'scheduled' | 'live' | 'completed';
  season_type: 'regular' | 'playoff' | 'championship';
  fantasy_team1_id: string;
  fantasy_team2_id: string;
  fantasy_team1_score: number | null;
  fantasy_team2_score: number | null;
  team1: {
    id: string;
    team_name: string;
    user_id: string | null;
    wins: number;
    losses: number;
  };
  team2: {
    id: string;
    team_name: string;
    user_id: string | null;
    wins: number;
    losses: number;
  };
}

export function useWeeklyMatchups(leagueId: string, weekNumber?: number) {
  return useQuery({
    queryKey: ['weekly-matchups', leagueId, weekNumber],
    queryFn: async (): Promise<WeeklyMatchup[]> => {
      if (!leagueId) return [];

      let query = supabase
        .from('weekly_matchups')
        .select(`
          id,
          week_number,
          matchup_date,
          status,
          season_type,
          fantasy_team1_id,
          fantasy_team2_id,
          fantasy_team1_score,
          fantasy_team2_score,
          team1:fantasy_teams!fantasy_team1_id(id, team_name, user_id, wins, losses),
          team2:fantasy_teams!fantasy_team2_id(id, team_name, user_id, wins, losses)
        `)
        .eq('league_id', leagueId)
        .order('matchup_date', { ascending: true });

      if (weekNumber !== undefined) {
        query = query.eq('week_number', weekNumber);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching weekly matchups:', error);
        throw error;
      }

      return (data || []).map((matchup: any) => ({
        id: matchup.id,
        week_number: matchup.week_number,
        matchup_date: matchup.matchup_date,
        status: matchup.status,
        season_type: matchup.season_type,
        fantasy_team1_id: matchup.fantasy_team1_id,
        fantasy_team2_id: matchup.fantasy_team2_id,
        fantasy_team1_score: matchup.fantasy_team1_score,
        fantasy_team2_score: matchup.fantasy_team2_score,
        team1: Array.isArray(matchup.team1) ? matchup.team1[0] : matchup.team1,
        team2: Array.isArray(matchup.team2) ? matchup.team2[0] : matchup.team2,
      }));
    },
    enabled: !!leagueId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useCurrentWeek(leagueId: string) {
  return useQuery({
    queryKey: ['current-week', leagueId],
    queryFn: async (): Promise<number> => {
      if (!leagueId) return 1;

      // Get the league's season year
      const { data: league } = await supabase
        .from('leagues')
        .select('season_year')
        .eq('id', leagueId)
        .single();

      const seasonYear = league?.season_year || new Date().getFullYear();

      // Get current date
      const today = new Date();

      // Fetch all fantasy season weeks for this season
      const { data: weeks, error } = await supabase
        .from('fantasy_season_weeks')
        .select('week_number, start_date, end_date')
        .eq('season_year', seasonYear)
        .order('week_number', { ascending: true });

      if (error || !weeks) {
        console.error('Error fetching season weeks:', error);
        return 1;
      }

      // Find the current week
      for (const week of weeks) {
        const startDate = new Date(week.start_date);
        const endDate = new Date(week.end_date);
        
        if (today >= startDate && today <= endDate) {
          return week.week_number;
        }
      }

      // If no current week found, return the first week with scheduled matchups
      const { data: matchups } = await supabase
        .from('weekly_matchups')
        .select('week_number')
        .eq('league_id', leagueId)
        .eq('status', 'scheduled')
        .order('week_number', { ascending: true })
        .limit(1);

      return matchups?.[0]?.week_number || 1;
    },
    enabled: !!leagueId,
  });
}

