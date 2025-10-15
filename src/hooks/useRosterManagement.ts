import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { FantasyTeamPlayer } from '../types';

export function useAddPlayerToRoster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      playerId, 
      fantasyTeamId
    }: { 
      playerId: string; 
      fantasyTeamId: string; 
    }) => {
      console.log(`🏀 Adding player ${playerId} to team ${fantasyTeamId}...`);
      
      // First, check if the team has any roster spots at all
      const { data: teamData, error: teamError } = await supabase
        .from('fantasy_teams')
        .select('league_id')
        .eq('id', fantasyTeamId)
        .single();

      if (teamError || !teamData) {
        console.error('❌ Team not found:', teamError);
        throw new Error('Team not found');
      }

      // Check if roster spots exist for this team
      const { data: rosterSpots, error: rosterSpotsError } = await supabase
        .from('fantasy_team_players')
        .select('id')
        .eq('fantasy_team_id', fantasyTeamId)
        .limit(1);

      if (rosterSpotsError) {
        console.error('❌ Error checking roster spots:', rosterSpotsError);
        throw new Error('Error checking roster spots');
      }

      // If no roster spots exist, create them
      if (!rosterSpots || rosterSpots.length === 0) {
        console.log('🔧 No roster spots found, creating them...');
        
        // Get roster spots configuration from the league
        const { error: leagueError } = await supabase
          .from('fantasy_leagues')
          .select('roster_positions')
          .eq('id', teamData.league_id)
          .single();

        if (leagueError) {
          console.error('❌ League roster configuration not found:', leagueError);
          throw new Error('League roster configuration not found');
        }

        // Get roster spots for this league
        const { data: leagueRosterSpots, error: leagueRosterSpotsError } = await supabase
          .from('roster_spots')
          .select('id, position, position_order')
          .eq('league_id', teamData.league_id)
          .order('position_order');

        if (leagueRosterSpotsError || !leagueRosterSpots || leagueRosterSpots.length === 0) {
          console.error('❌ No roster spots configured for this league:', leagueRosterSpotsError);
          throw new Error('No roster spots configured for this league. Please contact the commissioner.');
        }

        // Create fantasy_team_players entries for each roster spot
        const rosterEntries = leagueRosterSpots.map(spot => ({
          league_id: teamData.league_id,
          fantasy_team_id: fantasyTeamId,
          roster_spot_id: spot.id,
          player_id: null,
          is_starter: false,
          is_bench: false,
          is_injured_reserve: false,
          is_taxi_squad: false,
          acquired_via: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        console.log('🔧 Creating roster entries:', rosterEntries);

        const { data: createdEntries, error: createError } = await supabase
          .from('fantasy_team_players')
          .insert(rosterEntries)
          .select();

        if (createError) {
          console.error('❌ Error creating roster spots:', createError);
          throw new Error('Failed to create roster spots for your team');
        }

        console.log('✅ Created roster spots for team:', createdEntries);
      }
      
      // Find the first available roster spot (empty slot) for this specific team
      console.log('🔍 Looking for available roster spots for team:', fantasyTeamId);
      
      const { data: availableSpot, error: spotError } = await supabase
        .from('fantasy_team_players')
        .select('id, roster_spot_id, player_id, fantasy_team_id')
        .eq('fantasy_team_id', fantasyTeamId)
        .is('player_id', null)
        .limit(1)
        .maybeSingle();

      console.log('🔍 Available spot query result:', { availableSpot, spotError });
      console.log('🔍 Available spot details:', {
        id: availableSpot?.id,
        roster_spot_id: availableSpot?.roster_spot_id,
        player_id: availableSpot?.player_id,
        fantasy_team_id: availableSpot?.fantasy_team_id,
        type: typeof availableSpot?.id,
        id_length: availableSpot?.id?.length,
        is_uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(availableSpot?.id || '')
      });

      if (spotError) {
        console.error('❌ Error finding available roster spots:', spotError);
        throw new Error(`Error finding available roster spots: ${spotError.message}`);
      }

      if (!availableSpot) {
        console.error('❌ No available roster spots found for team:', fantasyTeamId);
        throw new Error('No available roster spots on your team. All roster spots are filled.');
      }

      // Verify this spot belongs to the correct team
      if (availableSpot.fantasy_team_id !== fantasyTeamId) {
        console.error('❌ Roster spot does not belong to the correct team:', {
          expected: fantasyTeamId,
          actual: availableSpot.fantasy_team_id
        });
        throw new Error('Roster spot does not belong to the correct team');
      }

      // First, verify the player exists
      console.log('🔍 Verifying player exists:', playerId);
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id, name')
        .eq('id', playerId)
        .single();

      if (playerError || !playerData) {
        console.error('❌ Player not found:', playerError);
        throw new Error(`Player not found: ${playerError?.message || 'Player does not exist'}`);
      }

      console.log('✅ Player found:', playerData);

      // Add player to the available spot
      console.log('🔧 Updating roster spot:', availableSpot.id, 'with player:', playerId);
      
      // Check current state before update
      console.log('🔧 Current roster spot state:', availableSpot);
      
      // Test if we can read the roster spot with full details
      console.log('🔧 Testing read permissions...');
      const { data: testRead, error: testReadError } = await supabase
        .from('fantasy_team_players')
        .select('*')
        .eq('id', availableSpot.id)
        .single();
        
      console.log('🔧 Test read result:', { testRead, testReadError });
      
      // Try a simple update first without updated_at
      console.log('🔧 Attempting update with data:', {
        player_id: playerId,
        spot_id: availableSpot.id,
        player_id_type: typeof playerId,
        spot_id_type: typeof availableSpot.id
      });
      
      // Try the update with better error handling
      let updateData, error;
      
      try {
        console.log('🔧 Attempting direct update of player_id...');
        
        // Try a direct update with select to get immediate feedback
        const updateResult = await supabase
          .from('fantasy_team_players')
          .update({ 
            player_id: playerId
          })
          .eq('id', availableSpot.id)
          .eq('fantasy_team_id', fantasyTeamId) // Double-check team ownership
          .select()
          .single();
          
        console.log('🔧 Direct update result:', { 
          data: updateResult.data, 
          error: updateResult.error,
          count: updateResult.count,
          status: updateResult.status,
          statusText: updateResult.statusText
        });
        
        updateData = updateResult.data;
        error = updateResult.error;
        
        // If the update succeeded, verify the player_id was actually set
        if (updateData && updateData.player_id !== playerId) {
          console.error('❌ Update succeeded but player_id was not set correctly:', {
            expected: playerId,
            actual: updateData.player_id
          });
          throw new Error('Update succeeded but player_id was not set correctly');
        }
        
      } catch (updateError) {
        console.error('❌ Update threw an exception:', updateError);
        error = updateError;
        updateData = null;
      }

      if (error) {
        console.error('❌ Error adding player to roster:', error);
        console.error('❌ Error details:', {
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          code: (error as any)?.code
        });
        throw new Error(`Failed to add player to roster: ${(error as any)?.message || 'Unknown error'}`);
      }

      if (!updateData) {
        console.error('❌ No rows were updated. Available spot might not exist:', availableSpot.id);
        
        // Try to verify the spot still exists
        console.log('🔍 Verifying spot still exists...');
        const { data: spotCheck, error: spotCheckError } = await supabase
          .from('fantasy_team_players')
          .select('id, player_id')
          .eq('id', availableSpot.id)
          .single();
          
        console.log('🔍 Spot verification result:', { spotCheck, spotCheckError });
        
        throw new Error('Failed to add player to roster: No rows were updated');
      }

      console.log('✅ Successfully added player to roster:', updateData);
      return { success: true, playerId, fantasyTeamId, updatedData: updateData };
    },
    onSuccess: (_, variables) => {
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
      
      const { error } = await supabase
        .from('fantasy_team_players')
        .update({ 
          player_id: null
        })
        .eq('fantasy_team_id', fantasyTeamId)
        .eq('roster_spot_id', rosterSpotId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('❌ Error removing player from roster:', error);
        throw new Error(`Failed to remove player from roster: ${error.message}`);
      }

      console.log('✅ Successfully removed player from roster');
      return { success: true, fantasyTeamId, rosterSpotId };
    },
    onSuccess: (_, variables) => {
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
