import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

// New interfaces for the simplified roster system
export interface FantasyRosterConfig {
  id: string;
  league_id: string;
  pg_count: number;
  sg_count: number;
  sf_count: number;
  pf_count: number;
  c_count: number;
  g_count: number;
  f_count: number;
  util_count: number;
  bench_count: number;
  ir_count: number;
  taxi_count: number;
  total_roster_size: number;
  max_starters: number;
  max_bench: number;
  max_ir: number;
  max_taxi: number;
  created_at: string;
  updated_at: string;
}

export interface FantasyTeamRosterSpot {
  id: string;
  league_id: string;
  fantasy_team_id: string;
  position: string;
  position_number: number;
  position_order: number;
  player_id: string | null;
  is_starter: boolean;
  is_bench: boolean;
  is_injured_reserve: boolean;
  is_taxi_squad: boolean;
  acquired_via: string;
  acquired_date: string;
  created_at: string;
  updated_at: string;
  player?: {
    id: string;
    name: string;
    position: string;
    team_abbreviation: string;
    jersey_number?: string;
    salary_2025_26?: number;
    nba_player_id?: number;
    nba_espn_projections?: any[];
  };
}

// Hook to get roster configuration for a league
export function useRosterConfig(leagueId: string) {
  return useQuery({
    queryKey: ['rosterConfig', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_roster_config')
        .select('*')
        .eq('league_id', leagueId)
        .single();

      if (error) {
        console.error('Error fetching roster config:', error);
        throw new Error(`Failed to fetch roster config: ${error.message}`);
      }

      return data as FantasyRosterConfig;
    },
    enabled: !!leagueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to get team roster spots
export function useTeamRosterSpots(teamId: string) {
  return useQuery({
    queryKey: ['teamRosterSpots', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_team_roster_spots')
        .select(`
          *,
          player:player_id (
            id,
            name,
            position,
            team_abbreviation,
            jersey_number,
            salary_2025_26,
            nba_player_id,
            nba_espn_projections
          )
        `)
        .eq('fantasy_team_id', teamId)
        .order('position_order');

      if (error) {
        console.error('Error fetching team roster spots:', error);
        throw new Error(`Failed to fetch team roster spots: ${error.message}`);
      }

      return data as FantasyTeamRosterSpot[];
    },
    enabled: !!teamId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Hook to add a player to a roster spot
export function useAddPlayerToRosterSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      teamId, 
      playerId, 
      position, 
      positionNumber 
    }: { 
      teamId: string; 
      playerId: string; 
      position: string; 
      positionNumber: number; 
    }) => {
      console.log('🔍 Adding player to roster spot:', { teamId, playerId, position, positionNumber });

      // First, verify the player exists
      const { data: playerData, error: playerError } = await supabase
        .from('nba_players')
        .select('id, name')
        .eq('id', playerId)
        .single();

      if (playerError || !playerData) {
        console.error('❌ Player not found:', playerError);
        throw new Error(`Player not found: ${playerError?.message || 'Unknown error'}`);
      }

      console.log('✅ Player verified:', playerData);

      // Find the specific roster spot
      const { data: rosterSpot, error: spotError } = await supabase
        .from('fantasy_team_roster_spots')
        .select('*')
        .eq('fantasy_team_id', teamId)
        .eq('position', position)
        .eq('position_number', positionNumber)
        .single();

      if (spotError || !rosterSpot) {
        console.error('❌ Roster spot not found:', spotError);
        throw new Error(`Roster spot not found: ${spotError?.message || 'Unknown error'}`);
      }

      console.log('✅ Roster spot found:', rosterSpot);

      // Check if the spot is already occupied
      if (rosterSpot.player_id) {
        console.error('❌ Roster spot already occupied');
        throw new Error('This roster spot is already occupied');
      }

      // Update the roster spot with the player
      const { data: updatedSpot, error: updateError } = await supabase
        .from('fantasy_team_roster_spots')
        .update({
          player_id: playerId,
          acquired_via: 'free_agent',
          acquired_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', rosterSpot.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to update roster spot:', updateError);
        throw new Error(`Failed to add player to roster: ${updateError.message}`);
      }

      console.log('✅ Player added to roster spot:', updatedSpot);

      return { success: true, rosterSpot: updatedSpot };
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch team roster spots
      queryClient.invalidateQueries({ queryKey: ['teamRosterSpots', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['playerRosterStatus'] });
    },
  });
}

// Hook to remove a player from a roster spot
export function useRemovePlayerFromRosterSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      teamId, 
      playerId 
    }: { 
      teamId: string; 
      playerId: string; 
    }) => {
      console.log('🔍 Removing player from roster:', { teamId, playerId });

      // Find the roster spot with this player
      const { data: rosterSpot, error: spotError } = await supabase
        .from('fantasy_team_roster_spots')
        .select('*')
        .eq('fantasy_team_id', teamId)
        .eq('player_id', playerId)
        .single();

      if (spotError || !rosterSpot) {
        console.error('❌ Roster spot not found:', spotError);
        throw new Error(`Player not found on roster: ${spotError?.message || 'Unknown error'}`);
      }

      console.log('✅ Roster spot found:', rosterSpot);

      // Clear the player from the roster spot
      const { data: updatedSpot, error: updateError } = await supabase
        .from('fantasy_team_roster_spots')
        .update({
          player_id: null,
          acquired_via: 'draft',
          acquired_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', rosterSpot.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to remove player from roster spot:', updateError);
        throw new Error(`Failed to remove player from roster: ${updateError.message}`);
      }

      console.log('✅ Player removed from roster spot:', updatedSpot);

      return { success: true, rosterSpot: updatedSpot };
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch team roster spots
      queryClient.invalidateQueries({ queryKey: ['teamRosterSpots', variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['playerRosterStatus'] });
    },
  });
}

// Hook to find the first available roster spot for a team
export function useFindAvailableRosterSpot(teamId: string) {
  return useQuery({
    queryKey: ['availableRosterSpot', teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_team_roster_spots')
        .select('*')
        .eq('fantasy_team_id', teamId)
        .is('player_id', null)
        .order('position_order')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error finding available roster spot:', error);
        throw new Error(`Failed to find available roster spot: ${error.message}`);
      }

      return data as FantasyTeamRosterSpot | null;
    },
    enabled: !!teamId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// Hook to check if a player is on a roster
export function useIsPlayerOnRoster(playerId: string, leagueId: string) {
  return useQuery({
    queryKey: ['isPlayerOnRoster', playerId, leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_team_roster_spots')
        .select(`
          id,
          fantasy_team_id,
          position,
          position_number,
          fantasy_teams (
            team_name
          )
        `)
        .eq('player_id', playerId)
        .eq('league_id', leagueId)
        .maybeSingle();

      if (error) {
        console.error('Error checking player roster status:', error);
        throw new Error(`Failed to check player roster status: ${error.message}`);
      }

      return {
        isOnRoster: !!data,
        teamId: data?.fantasy_team_id || null,
        teamName: data?.fantasy_teams?.team_name || null,
        position: data?.position || null,
        positionNumber: data?.position_number || null
      };
    },
    enabled: !!playerId && !!leagueId,
    staleTime: 1000 * 60, // 1 minute
  });
}
