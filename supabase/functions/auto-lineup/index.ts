import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutoLineupRequest {
  leagueId: string;
  teamId: string;
  weekNumber: number;
  seasonYear: number;
  seasonId: string;
  matchupId: string;
}

interface Player {
  id: string;
  name: string;
  nba_player_id: number;
  position: string;
  team_abbreviation: string;
  jersey_number: string;
}

interface LineupSettings {
  position_unit_assignments: {
    starters: Record<string, number>;
    rotation: Record<string, number>;
    bench: Record<string, number>;
  };
  starters_count: number;
  rotation_count: number;
  bench_count: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🤖 Auto-lineup function called');
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing Supabase environment variables' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { leagueId, teamId, weekNumber, seasonYear, seasonId, matchupId }: AutoLineupRequest = await req.json()
    
    console.log('🤖 Auto-lineup request:', {
      leagueId,
      teamId,
      weekNumber,
      seasonYear,
      seasonId,
      matchupId
    })
    
    console.log('🔍 Parameter validation check:', {
      leagueId: !!leagueId,
      teamId: !!teamId,
      weekNumber,
      weekNumberType: typeof weekNumber,
      weekNumberIsUndefined: weekNumber === undefined,
      weekNumberIsNull: weekNumber === null,
      seasonYear: !!seasonYear,
      seasonId: !!seasonId,
      matchupId: !!matchupId
    })

    // Validate required parameters
    if (!leagueId || !teamId || weekNumber === undefined || weekNumber === null || !seasonYear || !seasonId || !matchupId) {
      console.error('❌ Missing required parameters:', {
        leagueId: !!leagueId,
        teamId: !!teamId,
        weekNumber,
        seasonYear: !!seasonYear,
        seasonId: !!seasonId,
        matchupId: !!matchupId
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 1. Get lineup settings from fantasy_league_seasons
    console.log('🤖 Fetching lineup settings from fantasy_league_seasons...');
    console.log('🤖 Query params:', { leagueId, seasonYear });
    const { data: lineupSettings, error: settingsError } = await supabase
      .from('fantasy_league_seasons')
      .select('position_unit_assignments, starters_count, rotation_count, bench_count')
      .eq('league_id', leagueId)
      .eq('season_year', seasonYear)
      .single();

    if (settingsError) {
      console.error('❌ Error fetching lineup settings:', settingsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to fetch lineup settings: ${settingsError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Lineup settings:', lineupSettings);

    // 2. Get current roster players
    console.log('🤖 Fetching current roster players...');
    const { data: rosterPlayers, error: rosterError } = await supabase
      .from('fantasy_roster_spots')
      .select(`
        id,
        player_id,
        nba_players!inner(
          id,
          name,
          nba_player_id,
          position,
          team_abbreviation,
          jersey_number
        )
      `)
      .eq('fantasy_team_id', teamId)
      .not('player_id', 'is', null);

    if (rosterError) {
      console.error('❌ Error fetching roster players:', rosterError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to fetch roster players: ${rosterError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Roster players:', rosterPlayers?.length || 0);

    // 3. Get current lineup positions
    console.log('🤖 Fetching current lineup positions...');
    const { data: currentLineups, error: lineupError } = await supabase
      .from('fantasy_lineups')
      .select('*')
      .eq('league_id', leagueId)
      .eq('fantasy_team_id', teamId)
      .eq('week_number', weekNumber)
      .eq('season_year', seasonYear);

    if (lineupError) {
      console.error('❌ Error fetching current lineups:', lineupError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to fetch current lineups: ${lineupError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Current lineups:', currentLineups?.length || 0);

    // 4. Clean up invalid lineup positions (players no longer on roster)
    console.log('🤖 Cleaning up invalid lineup positions...');
    const validPlayerIds = new Set(rosterPlayers?.map(rp => rp.player_id) || []);
    const invalidLineups = currentLineups?.filter(lineup => 
      lineup.player_id && !validPlayerIds.has(lineup.player_id)
    ) || [];

    if (invalidLineups.length > 0) {
      console.log(`🤖 Removing ${invalidLineups.length} invalid lineup positions`);
      const { error: deleteError } = await supabase
        .from('fantasy_lineups')
        .delete()
        .in('id', invalidLineups.map(l => l.id));

      if (deleteError) {
        console.error('❌ Error deleting invalid lineups:', deleteError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to delete invalid lineups: ${deleteError.message}` 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // 5. Transform roster players
    const players: Player[] = rosterPlayers?.map(rp => ({
      id: rp.nba_players.id,
      name: rp.nba_players.name,
      nba_player_id: rp.nba_players.nba_player_id,
      position: rp.nba_players.position,
      team_abbreviation: rp.nba_players.team_abbreviation,
      jersey_number: rp.nba_players.jersey_number
    })) || [];

    // 6. For now, just use players as-is (we'll add fantasy points calculation later)
    const playersWithPoints = players.map(player => ({
      ...player,
      fantasyPoints: 0 // Placeholder for future fantasy points calculation
    }));

    console.log('✅ Players sorted by fantasy points:', playersWithPoints.length);

    // 8. Generate optimal lineup
    const positionAssignments = lineupSettings.position_unit_assignments;
    const optimalLineup = generateOptimalLineup(playersWithPoints, positionAssignments);

    console.log('✅ Optimal lineup generated:', optimalLineup);

    // 9. Clear existing valid lineups for this week
    const validLineups = currentLineups?.filter(lineup => 
      !lineup.player_id || validPlayerIds.has(lineup.player_id)
    ) || [];

    if (validLineups.length > 0) {
      console.log(`🤖 Clearing ${validLineups.length} existing valid lineups`);
      const { error: clearError } = await supabase
        .from('fantasy_lineups')
        .delete()
        .in('id', validLineups.map(l => l.id));

      if (clearError) {
        console.error('❌ Error clearing existing lineups:', clearError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to clear existing lineups: ${clearError.message}` 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // 10. Insert new optimal lineup with proper positioning
    console.log('🤖 Inserting new optimal lineup...');
    const lineupEntries = [];

    for (const [unit, positions] of Object.entries(optimalLineup)) {
      for (let i = 0; i < positions.length; i++) {
        const player = positions[i];
        if (player) {
          const position = getPositionFromIndex(i, unit, positionAssignments[unit as keyof typeof positionAssignments]);
          const { x, y } = getPositionCoordinates(position, unit, i, positionAssignments[unit as keyof typeof positionAssignments]);
          
          lineupEntries.push({
            league_id: leagueId,
            season_id: seasonId,
            fantasy_team_id: teamId,
            matchup_id: matchupId,
            week_number: weekNumber,
            season_year: seasonYear,
            lineup_type: unit,
            position: position,
            position_order: i + 1,
            player_id: player.id,
            position_x: x,
            position_y: y,
            created_by: null // Will be set by RLS
          });
        }
      }
    }

    if (lineupEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('fantasy_lineups')
        .insert(lineupEntries);

      if (insertError) {
        console.error('❌ Error inserting new lineup:', insertError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to insert new lineup: ${insertError.message}` 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    console.log('✅ Auto-lineup completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Auto-lineup generated successfully',
        lineupEntries: lineupEntries.length,
        removedInvalid: invalidLineups.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Auto-lineup function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to generate optimal lineup based on position requirements
function generateOptimalLineup(players: (Player & { fantasyPoints: number })[], positionAssignments: any) {
  const lineup = {
    starters: [] as (Player & { fantasyPoints: number })[],
    rotation: [] as (Player & { fantasyPoints: number })[],
    bench: [] as (Player & { fantasyPoints: number })[]
  };

  const usedPlayers = new Set<string>();

  // Helper function to check if player is eligible for position
  function isPlayerEligibleForPosition(player: Player, position: string): boolean {
    if (position === 'UTIL') return true;
    
    const playerPositions = player.position.split('-').map(p => p.trim());
    return playerPositions.some(p => 
      (position === 'G' && (p.toLowerCase().includes('guard'))) ||
      (position === 'F' && (p.toLowerCase().includes('forward'))) ||
      (position === 'C' && (p.toLowerCase().includes('center')))
    );
  }

  // Helper function to find best available player for a position
  function findBestPlayerForPosition(position: string, unit: string): (Player & { fantasyPoints: number }) | null {
    // First try to find a player who exactly matches the position
    let player = players.find(p => 
      !usedPlayers.has(p.id) && 
      isPlayerEligibleForPosition(p, position)
    );
    
    // If no exact match and position is not UTIL, try UTIL players
    if (!player && position !== 'UTIL') {
      player = players.find(p => 
        !usedPlayers.has(p.id) && 
        isPlayerEligibleForPosition(p, 'UTIL')
      );
    }
    
    return player || null;
  }

  // Fill starters
  console.log('🤖 Filling starters with requirements:', positionAssignments.starters);
  for (const [position, count] of Object.entries(positionAssignments.starters)) {
    for (let i = 0; i < count; i++) {
      const player = findBestPlayerForPosition(position, 'starters');
      if (player) {
        lineup.starters.push(player);
        usedPlayers.add(player.id);
        console.log(`✅ Added ${player.name} to starters for position ${position}`);
      } else {
        console.log(`❌ No available player for starters position ${position}`);
      }
    }
  }

  // Fill rotation
  console.log('🤖 Filling rotation with requirements:', positionAssignments.rotation);
  for (const [position, count] of Object.entries(positionAssignments.rotation)) {
    for (let i = 0; i < count; i++) {
      const player = findBestPlayerForPosition(position, 'rotation');
      if (player) {
        lineup.rotation.push(player);
        usedPlayers.add(player.id);
        console.log(`✅ Added ${player.name} to rotation for position ${position}`);
      } else {
        console.log(`❌ No available player for rotation position ${position}`);
      }
    }
  }

  // Fill bench
  console.log('🤖 Filling bench with requirements:', positionAssignments.bench);
  for (const [position, count] of Object.entries(positionAssignments.bench)) {
    for (let i = 0; i < count; i++) {
      const player = findBestPlayerForPosition(position, 'bench');
      if (player) {
        lineup.bench.push(player);
        usedPlayers.add(player.id);
        console.log(`✅ Added ${player.name} to bench for position ${position}`);
      } else {
        console.log(`❌ No available player for bench position ${position}`);
      }
    }
  }

  console.log('✅ Final lineup generated:', {
    starters: lineup.starters.length,
    rotation: lineup.rotation.length,
    bench: lineup.bench.length
  });

  return lineup;
}

// Helper function to get position from index
function getPositionFromIndex(index: number, unit: string, positionAssignments: Record<string, number>): string {
  let currentIndex = 0;
  
  for (const [position, count] of Object.entries(positionAssignments)) {
    if (index < currentIndex + count) {
      return position;
    }
    currentIndex += count;
  }
  
  return 'UTIL'; // Fallback
}

// Helper function to get position coordinates on the court
function getPositionCoordinates(position: string, unit: string, index: number, positionAssignments: Record<string, number>): { x: number, y: number } {
  // Court layout:
  // Top: Forwards (F) - left and right
  // Middle: Center (C) - center
  // Bottom: Guards (G) - left and right
  // UTIL: Can be placed anywhere
  
  const baseCoordinates = {
    // Guards - bottom left and right
    G: [
      { x: 25, y: 80 }, // Bottom left
      { x: 75, y: 80 }  // Bottom right
    ],
    // Forwards - top left and right  
    F: [
      { x: 25, y: 20 }, // Top left
      { x: 75, y: 20 }  // Top right
    ],
    // Center - middle top
    C: [
      { x: 50, y: 30 }  // Center top
    ],
    // UTIL - flexible positioning
    UTIL: [
      { x: 20, y: 50 }, // Left side
      { x: 50, y: 50 }, // Center
      { x: 80, y: 50 }  // Right side
    ]
  };

  // Get the position type and count for this unit
  const positionCount = positionAssignments[position] || 1;
  const positionIndex = index % positionCount;
  
  // Get coordinates for this position
  const coords = baseCoordinates[position as keyof typeof baseCoordinates] || baseCoordinates.UTIL;
  
  // If we have more players than coordinates, distribute them evenly
  if (positionCount > coords.length) {
    // For multiple players of the same position, spread them out
    const spacing = 100 / (positionCount + 1);
    const x = spacing * (positionIndex + 1);
    
    // Determine Y based on position
    let y = 50; // Default middle
    if (position === 'G') y = 80; // Bottom
    else if (position === 'F') y = 20; // Top  
    else if (position === 'C') y = 30; // Center top
    
    return { x, y };
  }
  
  // Use predefined coordinates
  return coords[positionIndex] || coords[0];
}
