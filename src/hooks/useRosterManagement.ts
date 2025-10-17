import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { FantasyTeamPlayer } from '../types';
import { useAuth } from './useAuth';

export function useAddPlayerToRoster() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
        .select('league_id, season_id')
        .eq('id', fantasyTeamId)
        .single();

      if (teamError || !teamData) {
        console.error('❌ Team not found:', teamError);
        throw new Error('Team not found');
      }

      // Check if roster spots exist for this team
      const { data: rosterSpots, error: rosterSpotsError } = await supabase
        .from('fantasy_roster_spots')
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

        // Get roster spots for this league - we'll create default roster spots
        // For now, create a standard 13-player roster
        const defaultRosterSpots = [
          { position: 'PG', position_order: 1 },
          { position: 'SG', position_order: 2 },
          { position: 'SF', position_order: 3 },
          { position: 'PF', position_order: 4 },
          { position: 'C', position_order: 5 },
          { position: 'G', position_order: 6 },
          { position: 'F', position_order: 7 },
          { position: 'UTIL', position_order: 8 },
          { position: 'UTIL', position_order: 9 },
          { position: 'UTIL', position_order: 10 },
          { position: 'BENCH', position_order: 11 },
          { position: 'BENCH', position_order: 12 },
          { position: 'BENCH', position_order: 13 }
        ];

        // Create fantasy_roster_spots entries for each roster spot
        const rosterEntries = defaultRosterSpots.map(() => ({
          fantasy_team_id: fantasyTeamId,
          season_id: teamData.season_id,
          player_id: null,
          is_injured_reserve: false,
          assigned_at: null,
          assigned_by: null,
          draft_round: null,
          draft_pick: null
        }));

        console.log('🔧 Creating roster entries:', rosterEntries);

        const { data: createdEntries, error: createError } = await supabase
          .from('fantasy_roster_spots')
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
        .from('fantasy_roster_spots')
        .select('id, player_id, fantasy_team_id')
        .eq('fantasy_team_id', fantasyTeamId)
        .is('player_id', null)
        .limit(1)
        .maybeSingle();

      console.log('🔍 Available spot query result:', { availableSpot, spotError });
      console.log('🔍 Available spot details:', {
        id: availableSpot?.id,
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
        .from('nba_players')
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
        .from('fantasy_roster_spots')
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
          .from('fantasy_roster_spots')
          .update({ 
            player_id: playerId,
            assigned_at: new Date().toISOString()
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
          .from('fantasy_roster_spots')
          .select('id, player_id')
          .eq('id', availableSpot.id)
          .single();
          
        console.log('🔍 Spot verification result:', { spotCheck, spotCheckError });
        
        throw new Error('Failed to add player to roster: No rows were updated');
      }

      console.log('✅ Successfully added player to roster:', updateData);

      // Create a transaction record for the add move
      console.log('📝 Creating transaction record for add move...');
      const { data: transactionResult, error: transactionError } = await supabase
        .rpc('create_fantasy_transaction', {
          league_id_param: teamData.league_id,
          season_id_param: teamData.season_id,
          transaction_type_param: 'add',
          fantasy_team_id_param: fantasyTeamId,
          player_id_param: playerId,
          notes_param: `Added ${playerData.name} to roster`,
          processed_by_param: user?.id || null
        });

      if (transactionError) {
        console.error('❌ Error creating transaction record:', transactionError);
        // Don't throw here - the player was successfully added, just the transaction record failed
        console.warn('⚠️ Player added successfully but transaction record creation failed');
      } else {
        console.log('✅ Transaction record created:', transactionResult);
      }

      return { success: true, playerId, fantasyTeamId, updatedData: updateData };
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch team roster
      queryClient.invalidateQueries({ queryKey: ['team-roster', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-transactions', variables.fantasyTeamId] });
      console.log('✅ Roster and transaction queries invalidated');
    },
    onError: (error) => {
      console.error('❌ Failed to add player to roster:', error);
    }
  });
}

export function useRemovePlayerFromRoster() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      fantasyTeamId, 
      rosterSpotId 
    }: { 
      fantasyTeamId: string; 
      rosterSpotId: string; 
    }) => {
      console.log(`🏀 Removing player from roster spot ${rosterSpotId} for team ${fantasyTeamId}...`);
      
      // First, get the player information before removing them
      const { data: rosterSpot, error: spotError } = await supabase
        .from('fantasy_roster_spots')
        .select(`
          player_id,
          player:player_id (
            id,
            name
          )
        `)
        .eq('fantasy_team_id', fantasyTeamId)
        .eq('id', rosterSpotId)
        .single();

      if (spotError || !rosterSpot) {
        console.error('❌ Error finding roster spot:', spotError);
        throw new Error(`Failed to find roster spot: ${spotError?.message || 'Roster spot not found'}`);
      }

      if (!rosterSpot.player_id) {
        console.error('❌ No player found in this roster spot');
        throw new Error('No player found in this roster spot');
      }

      // Get team information for transaction record
      const { data: teamData, error: teamError } = await supabase
        .from('fantasy_teams')
        .select('league_id, season_id')
        .eq('id', fantasyTeamId)
        .single();

      if (teamError || !teamData) {
        console.error('❌ Team not found:', teamError);
        throw new Error('Team not found');
      }
      
      const { error } = await supabase
        .from('fantasy_roster_spots')
        .update({ 
          player_id: null,
          assigned_at: null
        })
        .eq('fantasy_team_id', fantasyTeamId)
        .eq('id', rosterSpotId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('❌ Error removing player from roster:', error);
        throw new Error(`Failed to remove player from roster: ${error.message}`);
      }

      console.log('✅ Successfully removed player from roster');

      // Create a transaction record for the cut move
      console.log('📝 Creating transaction record for cut move...');
      const { data: transactionResult, error: transactionError } = await supabase
        .rpc('create_fantasy_transaction', {
          league_id_param: teamData.league_id,
          season_id_param: teamData.season_id,
          transaction_type_param: 'cut',
          fantasy_team_id_param: fantasyTeamId,
          player_id_param: rosterSpot.player_id,
          notes_param: `Cut ${(rosterSpot.player as any)?.name || 'player'} from roster`,
          processed_by_param: user?.id || null
        });

      if (transactionError) {
        console.error('❌ Error creating transaction record:', transactionError);
        // Don't throw here - the player was successfully removed, just the transaction record failed
        console.warn('⚠️ Player removed successfully but transaction record creation failed');
      } else {
        console.log('✅ Transaction record created:', transactionResult);
      }

      return { success: true, fantasyTeamId, rosterSpotId };
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch team roster
      queryClient.invalidateQueries({ queryKey: ['team-roster', variables.fantasyTeamId] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['team-transactions', variables.fantasyTeamId] });
      console.log('✅ Roster and transaction queries invalidated');
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
        .from('fantasy_roster_spots')
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
