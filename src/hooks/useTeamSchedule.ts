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
}

export function useTeamSchedule(teamId: string) {
  return useQuery({
    queryKey: ['team-schedule', teamId],
    queryFn: async (): Promise<TeamMatchup[]> => {
      if (!teamId) return [];

      try {
        // Fetch all matchups for this team
        const { data: matchups, error } = await supabase
          .from('weekly_matchups')
          .select(`
            id,
            week_number,
            fantasy_team1_id,
            fantasy_team2_id,
            fantasy_team1_score,
            fantasy_team2_score,
            status,
            season_type,
            matchup_date
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

        // Transform the data
        const schedule: TeamMatchup[] = matchups.map(matchup => {
          const isHome = matchup.fantasy_team1_id === teamId;
          const opponentId = isHome ? matchup.fantasy_team2_id : matchup.fantasy_team1_id;
          const opponent = teams?.find(t => t.id === opponentId);
          
          // Create week name from week number
          const weekName = `Week ${matchup.week_number}`;
          
          // Create date range from matchup date (simplified)
          const matchupDate = new Date(matchup.matchup_date);
          const startDate = matchupDate.toISOString().split('T')[0];
          const endDate = new Date(matchupDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
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
            team_score: isHome ? matchup.fantasy_team1_score : matchup.fantasy_team2_score,
            opponent_score: isHome ? matchup.fantasy_team2_score : matchup.fantasy_team1_score,
            status: matchup.status as 'scheduled' | 'live' | 'completed',
            matchup_type: matchup.season_type as 'regular' | 'playoff' | 'championship',
            division_game: false, // We don't have division info in current schema
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
