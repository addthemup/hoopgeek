import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  team_abbreviation: string;
  jersey_number?: number;
  nba_player_id?: number;
  roster_spot_id: string;
  fantasy_team_id: string;
}

export function useUserTeamRoster(leagueId: string) {
  const { user } = useAuth();

  return useQuery<RosterPlayer[], Error>({
    queryKey: ['user-team-roster', leagueId, user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log(`🏀 Fetching user team roster for league ${leagueId}...`);
      
      // First get the user's team in this league
      const { data: userTeam, error: teamError } = await supabase
        .from('fantasy_teams')
        .select('id, team_name')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .single();

      if (teamError || !userTeam) {
        console.error('❌ Error fetching user team:', teamError);
        throw new Error('User team not found in this league');
      }

      // Get the roster for this team
      const { data, error } = await supabase
        .from('fantasy_team_players')
        .select(`
          roster_spot_id,
          fantasy_team_id,
          player:player_id (
            id,
            name,
            position,
            team_abbreviation,
            jersey_number,
            nba_player_id
          )
        `)
        .eq('fantasy_team_id', userTeam.id)
        .not('player_id', 'is', null); // Only get spots with players

      if (error) {
        console.error('❌ Error fetching roster:', error);
        throw new Error(`Failed to fetch roster: ${error.message}`);
      }

      const rosterPlayers = data.map(item => ({
        id: item.player.id,
        name: item.player.name,
        position: item.player.position,
        team_abbreviation: item.player.team_abbreviation,
        jersey_number: item.player.jersey_number,
        nba_player_id: item.player.nba_player_id,
        roster_spot_id: item.roster_spot_id,
        fantasy_team_id: item.fantasy_team_id,
      })) as RosterPlayer[];

      console.log(`✅ Successfully fetched ${rosterPlayers.length} players for user team`);
      return rosterPlayers;
    },
    enabled: !!leagueId && !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
