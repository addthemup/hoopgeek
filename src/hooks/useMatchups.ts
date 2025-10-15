import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { FantasyTeam } from '../types';

export interface Matchup {
  id: string;
  league_id: string;
  fantasy_team1_id: string;
  fantasy_team2_id: string;
  week_number: number;
  season_year: number;
  season_type: 'regular' | 'playoff' | 'championship';
  playoff_round?: number;
  matchup_date?: string;
  fantasy_team1_score: number;
  fantasy_team2_score: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  is_manual_override: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined team data
  team1?: FantasyTeam;
  team2?: FantasyTeam;
}

export function useMatchups(leagueId: string, week?: number) {
  return useQuery({
    queryKey: ['matchups', leagueId, week],
    queryFn: async () => {
      console.log(`🏀 Fetching matchups for league ${leagueId}, week ${week || 'all'}...`);
      
      let query = supabase
        .from('fantasy_matchups')
        .select(`
          *,
          team1:fantasy_team1_id (
            id,
            team_name,
            wins,
            losses,
            ties,
            points_for,
            points_against,
            user_id
          ),
          team2:fantasy_team2_id (
            id,
            team_name,
            wins,
            losses,
            ties,
            points_for,
            points_against,
            user_id
          )
        `)
        .eq('league_id', leagueId)
        .order('week_number', { ascending: true });

      if (week) {
        query = query.eq('week_number', week);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching matchups:', error);
        throw new Error(`Error fetching matchups: ${error.message}`);
      }

      console.log(`✅ Successfully fetched ${data?.length || 0} matchups`);
      return data as Matchup[];
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCurrentWeekMatchups(leagueId: string) {
  return useMatchups(leagueId, 1); // For now, hardcode to week 1
}
