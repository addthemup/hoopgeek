import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface MatchupPlayer {
  id: number;
  name: string;
  position: string;
  team_abbreviation: string;
  jersey_number?: string;
  nba_player_id: number;
  salary_2025_26: number;
  // Stats would be calculated based on games played during the week
  games_played?: number;
  total_points?: number;
  points_per_game?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
}

export interface MatchupDetailsData {
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
    roster: MatchupPlayer[];
  };
  team2: {
    id: string;
    team_name: string;
    user_id: string | null;
    wins: number;
    losses: number;
    roster: MatchupPlayer[];
  };
  week_info: {
    week_name: string;
    start_date: string;
    end_date: string;
  };
}

export function useMatchupDetails(matchupId: string) {
  return useQuery({
    queryKey: ['matchup-details', matchupId],
    queryFn: async (): Promise<MatchupDetailsData | null> => {
      if (!matchupId) return null;

      // Fetch the matchup
      const { data: matchup, error: matchupError } = await supabase
        .from('fantasy_matchups')
        .select(`
          id,
          fantasy_week,
          matchup_date,
          status,
          season_type,
          season_year,
          fantasy_team1_id,
          fantasy_team2_id,
          fantasy_team1_score,
          fantasy_team2_score,
          league_id,
          team1:fantasy_teams!fantasy_team1_id(id, team_name, user_id, wins, losses),
          team2:fantasy_teams!fantasy_team2_id(id, team_name, user_id, wins, losses)
        `)
        .eq('id', matchupId)
        .single();

      if (matchupError || !matchup) {
        console.error('Error fetching matchup:', matchupError);
        throw matchupError;
      }

      // Get week info from fantasy_season_weeks
      const { data: weekInfo } = await supabase
        .from('fantasy_season_weeks')
        .select('week_name, start_date, end_date')
        .eq('season_year', matchup.season_year)
        .eq('fantasy_week', matchup.fantasy_week)
        .single();

      // Fetch team1 roster
      const { data: team1Roster, error: team1Error } = await supabase
        .from('fantasy_rosters')
        .select(`
          player_id,
          players:players(
            id,
            name,
            position,
            team_abbreviation,
            jersey_number,
            nba_player_id,
            salary_2025_26
          )
        `)
        .eq('fantasy_team_id', matchup.fantasy_team1_id);

      if (team1Error) {
        console.error('Error fetching team1 roster:', team1Error);
      }

      // Fetch team2 roster
      const { data: team2Roster, error: team2Error } = await supabase
        .from('fantasy_rosters')
        .select(`
          player_id,
          players:players(
            id,
            name,
            position,
            team_abbreviation,
            jersey_number,
            nba_player_id,
            salary_2025_26
          )
        `)
        .eq('fantasy_team_id', matchup.fantasy_team2_id);

      if (team2Error) {
        console.error('Error fetching team2 roster:', team2Error);
      }

      // Transform roster data
      const team1Players: MatchupPlayer[] = (team1Roster || [])
        .map((item: any) => {
          const player = Array.isArray(item.players) ? item.players[0] : item.players;
          return player ? {
            id: player.id,
            name: player.name,
            position: player.position,
            team_abbreviation: player.team_abbreviation,
            jersey_number: player.jersey_number,
            nba_player_id: player.nba_player_id,
            salary_2025_26: player.salary_2025_26,
          } : null;
        })
        .filter(Boolean) as MatchupPlayer[];

      const team2Players: MatchupPlayer[] = (team2Roster || [])
        .map((item: any) => {
          const player = Array.isArray(item.players) ? item.players[0] : item.players;
          return player ? {
            id: player.id,
            name: player.name,
            position: player.position,
            team_abbreviation: player.team_abbreviation,
            jersey_number: player.jersey_number,
            nba_player_id: player.nba_player_id,
            salary_2025_26: player.salary_2025_26,
          } : null;
        })
        .filter(Boolean) as MatchupPlayer[];

      const team1Info = Array.isArray(matchup.team1) ? matchup.team1[0] : matchup.team1;
      const team2Info = Array.isArray(matchup.team2) ? matchup.team2[0] : matchup.team2;

      return {
        id: matchup.id,
        week_number: matchup.week_number,
        matchup_date: matchup.matchup_date,
        status: matchup.status,
        season_type: matchup.season_type,
        fantasy_team1_id: matchup.fantasy_team1_id,
        fantasy_team2_id: matchup.fantasy_team2_id,
        fantasy_team1_score: matchup.fantasy_team1_score,
        fantasy_team2_score: matchup.fantasy_team2_score,
        team1: {
          ...team1Info,
          roster: team1Players,
        },
        team2: {
          ...team2Info,
          roster: team2Players,
        },
        week_info: weekInfo || {
          week_name: `Week ${matchup.week_number}`,
          start_date: matchup.matchup_date,
          end_date: matchup.matchup_date,
        },
      };
    },
    enabled: !!matchupId,
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });
}

