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
  nba_player_id: number;
  jersey_number?: number;
  pick_number: number;
  round: number;
  salary_2025_26?: number;
}

export function useTeamDraftPicks(leagueId: string, teamId: string) {
  return useQuery<TeamDraftPick[], Error>({
    queryKey: ['team-draft-picks', leagueId, teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_draft_order')
        .select(`
          pick_number,
          round,
          is_completed,
          fantasy_draft_picks!left (
            player_id,
            nba_players!left (
              name,
              position,
              team_abbreviation
            )
          )
        `)
        .eq('league_id', leagueId)
        .eq('fantasy_team_id', teamId)
        .order('pick_number');

      if (error) {
        console.error('Error fetching team draft picks:', error);
        throw new Error(`Failed to fetch team draft picks: ${error.message}`);
      }

      return data.map(pick => ({
        pick_number: pick.pick_number,
        round: pick.round,
        is_completed: pick.is_completed,
        player_id: pick.fantasy_draft_picks?.player_id,
        player_name: pick.fantasy_draft_picks?.nba_players?.name,
        position: pick.fantasy_draft_picks?.nba_players?.position,
        team_abbreviation: pick.fantasy_draft_picks?.nba_players?.team_abbreviation,
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
      const { data, error } = await supabase
        .from('fantasy_draft_picks')
        .select(`
          pick_number,
          round,
          nba_players!inner (
            id,
            name,
            position,
            team_abbreviation,
            nba_player_id,
            jersey_number
          ),
          nba_hoopshype_salaries!left (
            salary_2025_26
          )
        `)
        .eq('league_id', leagueId)
        .eq('fantasy_team_id', teamId)
        .order('pick_number');

      if (error) {
        console.error('Error fetching team drafted players:', error);
        throw new Error(`Failed to fetch team drafted players: ${error.message}`);
      }

      return data.map(pick => ({
        id: pick.nba_players.id,
        name: pick.nba_players.name,
        position: pick.nba_players.position,
        team_abbreviation: pick.nba_players.team_abbreviation,
        nba_player_id: pick.nba_players.nba_player_id,
        jersey_number: pick.nba_players.jersey_number,
        pick_number: pick.pick_number,
        round: pick.round,
        salary_2025_26: pick.nba_hoopshype_salaries?.salary_2025_26,
      })) as TeamDraftedPlayer[];
    },
    enabled: !!leagueId && !!teamId,
    refetchInterval: 2000, // Refetch every 2 seconds for live updates
  });
}
