import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface TeamDraftPick {
  pick_number: number;
  round: number;
  is_completed: boolean;
  player_id?: number;
  player_name?: string;
  position?: string;
  team_abbreviation?: string;
}

export interface TeamDraftedPlayer {
  id: number;
  name: string;
  position: string;
  team_abbreviation: string;
  jersey_number?: number;
  pick_number: number;
  round: number;
}

export function useTeamDraftPicks(leagueId: string, teamId: string) {
  return useQuery<TeamDraftPick[], Error>({
    queryKey: ['team-draft-picks', leagueId, teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_order')
        .select(`
          pick_number,
          round,
          is_completed,
          draft_picks!left (
            player_id,
            players!left (
              name,
              position,
              team_abbreviation
            )
          )
        `)
        .eq('league_id', leagueId)
        .eq('team_position', 
          // Get team position by finding the team's index in the league
          supabase
            .from('fantasy_teams')
            .select('id')
            .eq('league_id', leagueId)
            .order('id')
            .then(teams => {
              const teamIndex = teams.data?.findIndex(t => t.id === teamId);
              return teamIndex !== undefined ? teamIndex + 1 : 1;
            })
        )
        .order('pick_number');

      if (error) {
        console.error('Error fetching team draft picks:', error);
        throw new Error(`Failed to fetch team draft picks: ${error.message}`);
      }

      return data.map(pick => ({
        pick_number: pick.pick_number,
        round: pick.round,
        is_completed: pick.is_completed,
        player_id: pick.draft_picks?.player_id,
        player_name: pick.draft_picks?.players?.name,
        position: pick.draft_picks?.players?.position,
        team_abbreviation: pick.draft_picks?.players?.team_abbreviation,
      })) as TeamDraftPick[];
    },
    enabled: !!leagueId && !!teamId,
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  });
}

export function useTeamDraftedPlayers(leagueId: string, teamId: string) {
  return useQuery<TeamDraftedPlayer[], Error>({
    queryKey: ['team-drafted-players', leagueId, teamId],
    queryFn: async () => {
      console.log(`🏀 Fetching drafted players for team ${teamId} in league ${leagueId}...`);
      
      const { data, error } = await supabase
        .from('draft_picks')
        .select(`
          pick_number,
          round,
          players!inner (
            id,
            name,
            position,
            team_abbreviation,
            jersey_number
          )
        `)
        .eq('league_id', leagueId)
        .eq('fantasy_team_id', teamId)
        .order('pick_number');

      if (error) {
        console.error('❌ Error fetching team drafted players:', error);
        throw new Error(`Failed to fetch team drafted players: ${error.message}`);
      }

      console.log(`✅ Successfully fetched ${data.length} drafted players for team`);
      return data.map(pick => ({
        id: pick.players.id,
        name: pick.players.name,
        position: pick.players.position,
        team_abbreviation: pick.players.team_abbreviation,
        jersey_number: pick.players.jersey_number,
        pick_number: pick.pick_number,
        round: pick.round,
      })) as TeamDraftedPlayer[];
    },
    enabled: !!leagueId && !!teamId,
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  });
}
