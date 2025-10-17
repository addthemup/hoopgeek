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

export function useTeamDraftedPlayers(leagueId: string, teamId: string, options?: { refetchInterval?: number; staleTime?: number }) {
  return useQuery<TeamDraftedPlayer[], Error>({
    queryKey: ['team-drafted-players', leagueId, teamId],
    queryFn: async () => {
      // Get players from fantasy_roster_spots (current roster) instead of fantasy_draft_picks (draft history)
      const { data, error } = await supabase
        .from('fantasy_roster_spots')
        .select(`
          draft_round,
          draft_pick,
          nba_players!inner (
            id,
            name,
            position,
            team_abbreviation,
            nba_player_id,
            jersey_number,
            nba_hoopshype_salaries (
              salary_2025_26
            )
          )
        `)
        .eq('fantasy_team_id', teamId)
        .not('player_id', 'is', null) // Only get spots with players
        .order('draft_pick');

      if (error) {
        console.error('Error fetching team drafted players:', error);
        throw new Error(`Failed to fetch team drafted players: ${error.message}`);
      }

      return data.map(spot => ({
        id: spot.nba_players.id,
        name: spot.nba_players.name,
        position: spot.nba_players.position,
        team_abbreviation: spot.nba_players.team_abbreviation,
        nba_player_id: spot.nba_players.nba_player_id,
        jersey_number: spot.nba_players.jersey_number,
        pick_number: spot.draft_pick || 0,
        round: spot.draft_round || 1,
        salary_2025_26: spot.nba_players?.nba_hoopshype_salaries?.[0]?.salary_2025_26,
      })) as TeamDraftedPlayer[];
    },
    enabled: !!leagueId && !!teamId,
    refetchInterval: options?.refetchInterval || 2000, // Refetch every 2 seconds for live updates
    staleTime: options?.staleTime || 1000, // Consider data stale after 1 second
  });
}
