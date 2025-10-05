import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { Player, FantasyTeamPlayer } from '../types';

export function useAddPlayerToRoster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      playerId, 
      fantasyTeamId
    }: { 
      playerId: number; 
      fantasyTeamId: string; 
    }) => {
      console.log(`🏀 Adding player ${playerId} to team ${fantasyTeamId}...`);
      
      // Find the first available roster spot (empty slot)
      const { data: availableSpot, error: spotError } = await supabase
        .from('fantasy_team_players')
        .select('id, roster_spot_id')
        .eq('fantasy_team_id', fantasyTeamId)
        .is('player_id', null)
        .limit(1)
        .single();

      if (spotError || !availableSpot) {
        console.error('❌ No available roster spots:', spotError);
        throw new Error('No available roster spots on your team');
      }

      // Add player to the available spot
      const { data, error } = await supabase
        .from('fantasy_team_players')
        .update({ 
          player_id: playerId
        })
        .eq('id', availableSpot.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error adding player to roster:', error);
        throw new Error(`Failed to add player to roster: ${error.message}`);
      }

      console.log('✅ Successfully added player to roster');
      return data as FantasyTeamPlayer;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch team roster
      queryClient.invalidateQueries({ queryKey: ['team-roster', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      console.log('✅ Roster queries invalidated');
    },
    onError: (error) => {
      console.error('❌ Failed to add player to roster:', error);
    }
  });
}

export function useRemovePlayerFromRoster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      fantasyTeamId, 
      rosterSpotId 
    }: { 
      fantasyTeamId: string; 
      rosterSpotId: string; 
    }) => {
      console.log(`🏀 Removing player from roster spot ${rosterSpotId} for team ${fantasyTeamId}...`);
      
      const { data, error } = await supabase
        .from('fantasy_team_players')
        .update({ 
          player_id: null
        })
        .eq('fantasy_team_id', fantasyTeamId)
        .eq('roster_spot_id', rosterSpotId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error removing player from roster:', error);
        throw new Error(`Failed to remove player from roster: ${error.message}`);
      }

      console.log('✅ Successfully removed player from roster');
      return data as FantasyTeamPlayer;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch team roster
      queryClient.invalidateQueries({ queryKey: ['team-roster', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      console.log('✅ Roster queries invalidated');
    },
    onError: (error) => {
      console.error('❌ Failed to remove player from roster:', error);
    }
  });
}

export function useRoster(leagueId: string) {
  return useQuery<FantasyTeamPlayer[], Error>({
    queryKey: ['roster', leagueId],
    queryFn: async () => {
      console.log(`🏀 Fetching roster for league ${leagueId}...`);
      
      // First get all teams in the league, then get their rosters
      const { data: teams, error: teamsError } = await supabase
        .from('fantasy_teams')
        .select('id')
        .eq('league_id', leagueId);

      if (teamsError) {
        console.error('❌ Error fetching teams:', teamsError);
        throw new Error(`Failed to fetch teams: ${teamsError.message}`);
      }

      if (!teams || teams.length === 0) {
        return [];
      }

      const teamIds = teams.map(team => team.id);

      const { data, error } = await supabase
        .from('fantasy_team_players')
        .select(`
          *,
          player:player_id (
            id,
            name,
            position,
            team_abbreviation,
            jersey_number
          )
        `)
        .in('fantasy_team_id', teamIds)
        .not('player_id', 'is', null); // Only get spots with players

      if (error) {
        console.error('❌ Error fetching roster:', error);
        throw new Error(`Failed to fetch roster: ${error.message}`);
      }

      console.log('✅ Successfully fetched roster');
      return data as FantasyTeamPlayer[];
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
