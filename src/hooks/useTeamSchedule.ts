import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface TeamMatchup {
  id: string;
  week: number;
  week_name: string;
  start_date: string;
  end_date: string;
  opponent: {
    id: string;
    team_name: string;
    user_id: string | null;
    wins: number;
    losses: number;
    points_for: number;
    points_against: number;
  };
  is_home: boolean;
  team_score: number;
  opponent_score: number;
  status: 'scheduled' | 'live' | 'completed';
  matchup_type: 'regular' | 'playoff' | 'championship';
  division_game: boolean;
  is_preseason?: boolean;
}

export function useTeamSchedule(teamId: string) {
  return useQuery({
    queryKey: ['team-schedule', teamId],
    queryFn: async (): Promise<TeamMatchup[]> => {
      if (!teamId) return [];

      try {
        // First get the league and season from the team
        const { data: team } = await supabase
          .from('fantasy_teams')
          .select('league_id')
          .eq('id', teamId)
          .single();

        if (!team) return [];

        const { data: league } = await supabase
          .from('fantasy_leagues')
          .select('season_year')
          .eq('id', team.league_id)
          .single();

        const seasonYear = league?.season_year || new Date().getFullYear();

        // Fetch all matchups for this team
        const { data: matchups, error } = await supabase
          .from('fantasy_matchups')
          .select(`
            id,
            week_number,
            fantasy_team1_id,
            fantasy_team2_id,
            team1_score,
            team2_score,
            status,
            is_playoff_matchup,
            matchup_start_date,
            matchup_end_date
          `)
          .or(`fantasy_team1_id.eq.${teamId},fantasy_team2_id.eq.${teamId}`)
          .order('week_number', { ascending: true });

        if (error) {
          console.error('Error fetching team schedule:', error);
          throw error;
        }

        if (!matchups) return [];

        // Fetch team details for opponents
        const teamIds = matchups.map(m => 
          m.fantasy_team1_id === teamId ? m.fantasy_team2_id : m.fantasy_team1_id
        ).filter(Boolean);

        const { data: teams, error: teamsError } = await supabase
          .from('fantasy_teams')
          .select('id, team_name, user_id, wins, losses, points_for, points_against')
          .in('id', teamIds);

        if (teamsError) {
          console.error('Error fetching opponent teams:', teamsError);
          throw teamsError;
        }

        // Fetch week details from fantasy_season_weeks
        const weekNumbers = matchups.map(m => m.week_number);
        const { data: weeks, error: weeksError } = await supabase
          .from('fantasy_season_weeks')
          .select('week_number, week_name, start_date, end_date')
          .eq('season_year', seasonYear)
          .in('week_number', weekNumbers);

        if (weeksError) {
          console.error('Error fetching week details:', weeksError);
          throw weeksError;
        }

        // Note: Division logic removed since division_id column doesn't exist in fantasy_teams

        // Transform the data
        const schedule: TeamMatchup[] = matchups.map(matchup => {
          const isHome = matchup.fantasy_team1_id === teamId;
          const opponentId = isHome ? matchup.fantasy_team2_id : matchup.fantasy_team1_id;
          const opponent = teams?.find(t => t.id === opponentId);
          
          // Get week info from fantasy_season_weeks
          const weekInfo = weeks?.find(w => w.week_number === matchup.week_number);
          const weekName = weekInfo?.week_name || `Week ${matchup.week_number}`;
          const startDate = weekInfo?.start_date || matchup.matchup_start_date;
          const endDate = weekInfo?.end_date || matchup.matchup_end_date;
          
          // Division games not supported yet (no division_id column)
          const isDivisionGame = false;
          
          return {
            id: matchup.id,
            week: matchup.week_number,
            week_name: weekName,
            start_date: startDate,
            end_date: endDate,
            opponent: opponent ? {
              id: opponent.id,
              team_name: opponent.team_name,
              user_id: opponent.user_id,
              wins: opponent.wins,
              losses: opponent.losses,
              points_for: opponent.points_for,
              points_against: opponent.points_against,
            } : {
              id: opponentId || '',
              team_name: 'Unknown Team',
              user_id: null,
              wins: 0,
              losses: 0,
              points_for: 0,
              points_against: 0,
            },
            is_home: isHome,
            team_score: isHome ? (matchup.team1_score || 0) : (matchup.team2_score || 0),
            opponent_score: isHome ? (matchup.team2_score || 0) : (matchup.team1_score || 0),
            status: matchup.status as 'scheduled' | 'live' | 'completed',
            matchup_type: matchup.is_playoff_matchup ? 'playoff' : 'regular',
            division_game: isDivisionGame,
            is_preseason: matchup.week_number === 0 // Week 0 is preseason
          };
        });

        return schedule;
      } catch (error) {
        console.error('Error in useTeamSchedule:', error);
        throw error;
      }
    },
    enabled: !!teamId,
  });
}
