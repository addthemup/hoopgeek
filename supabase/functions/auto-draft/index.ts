import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 Auto-draft function called with method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📋 Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('📥 Parsing request body...');
    const { leagueId, playerId, teamId, pickNumber } = await req.json()
    console.log('📋 Request parameters:', { leagueId, playerId, teamId, pickNumber });

    if (!leagueId || !playerId || !teamId || !pickNumber) {
      console.error('❌ Missing required parameters:', { leagueId, playerId, teamId, pickNumber });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters', details: { leagueId, playerId, teamId, pickNumber } }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate playerId (should be a UUID string)
    if (typeof playerId !== 'string' || !playerId || playerId.trim() === '') {
      console.error('❌ Invalid playerId:', playerId, 'type:', typeof playerId);
      return new Response(
        JSON.stringify({ error: 'Invalid player ID - must be a non-empty string', details: { playerId, type: typeof playerId } }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Auto-drafting player ${playerId} to team ${teamId} at pick ${pickNumber}`)

    // Create Supabase client
    console.log('🔧 Creating Supabase client...');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('✅ Supabase client created successfully');

    // First get the draft order data including season_id and draft_order_id
    console.log('🔍 Fetching draft order data...');
    const { data: draftOrderData, error: draftOrderError } = await supabase
      .from('fantasy_draft_order')
      .select('id, round, season_id, team_position')
      .eq('league_id', leagueId)
      .eq('pick_number', pickNumber)
      .single()

    if (draftOrderError) {
      console.error('❌ Error fetching draft order:', draftOrderError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch draft order', details: draftOrderError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('✅ Draft order data fetched:', draftOrderData);

    // Start a transaction to ensure data consistency
    console.log('📝 Creating draft pick record...');
    const { data: draftPick, error: draftPickError } = await supabase
      .from('fantasy_draft_picks')
      .insert({
        league_id: leagueId,
        season_id: draftOrderData.season_id,
        draft_order_id: draftOrderData.id,
        pick_number: pickNumber,
        round: draftOrderData.round,
        team_position: draftOrderData.team_position,
        player_id: playerId,
        fantasy_team_id: teamId,
        is_auto_pick: true,
        auto_pick_reason: 'Commissioner auto-draft'
      })
      .select()
      .single()

    if (draftPickError) {
      console.error('❌ Error creating draft pick:', draftPickError)
      return new Response(
        JSON.stringify({ error: 'Failed to create draft pick', details: draftPickError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('✅ Draft pick created successfully:', draftPick);

    // Mark the pick as completed in fantasy_draft_order
    console.log('✅ Marking pick as completed...');
    const { error: updateOrderError } = await supabase
      .from('fantasy_draft_order')
      .update({ 
        is_completed: true,
        time_started: new Date().toISOString()
      })
      .eq('id', draftOrderData.id)

    if (updateOrderError) {
      console.error('⚠️ Error updating draft order:', updateOrderError)
      // Don't fail the request, just log the error
    } else {
      console.log('✅ Pick marked as completed');
    }

    // Ensure team has roster spots, create them if they don't exist
    console.log('🔍 Checking if team has roster spots...');
    const { data: existingSpots, error: checkError } = await supabase
      .from('fantasy_roster_spots')
      .select('id')
      .eq('fantasy_team_id', teamId)
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking roster spots:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check roster spots', details: checkError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // If no roster spots exist, create them
    if (!existingSpots || existingSpots.length === 0) {
      console.log('🔧 No roster spots found, creating them...');
      
      // Get team data to get season_id
      const { data: teamData, error: teamError } = await supabase
        .from('fantasy_teams')
        .select('season_id')
        .eq('id', teamId)
        .single();

      if (teamError || !teamData) {
        console.error('❌ Team not found:', teamError);
        return new Response(
          JSON.stringify({ error: 'Team not found', details: teamError?.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Create default 13-player roster spots (no position/position_order columns)
      const rosterEntries = Array.from({ length: 13 }, () => ({
        fantasy_team_id: teamId,
        season_id: teamData.season_id,
        player_id: null,
        is_injured_reserve: false,
        assigned_at: null,
        assigned_by: null,
        draft_round: null,
        draft_pick: null
      }));

      const { error: createError } = await supabase
        .from('fantasy_roster_spots')
        .insert(rosterEntries);

      if (createError) {
        console.error('❌ Error creating roster spots:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create roster spots', details: createError.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('✅ Created roster spots for team');
    }

    // Add player to team roster (find first available roster spot)
    console.log('🔍 Finding available roster spot...');
    const { data: availableSpots, error: spotError } = await supabase
      .from('fantasy_roster_spots')
      .select('id')
      .eq('fantasy_team_id', teamId)
      .is('player_id', null)
      .limit(1);

    if (spotError) {
      console.error('❌ Error finding roster spots:', spotError);
      return new Response(
        JSON.stringify({ error: 'Failed to find roster spots', details: spotError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!availableSpots || availableSpots.length === 0) {
      console.error('⚠️ No available roster spots found for team:', teamId);
      return new Response(
        JSON.stringify({ error: 'No available roster spots', details: 'Team roster is full' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const availableSpot = availableSpots[0];
    console.log('✅ Found available roster spot:', availableSpot);
    
    const { error: rosterError } = await supabase
      .from('fantasy_roster_spots')
      .update({ 
        player_id: playerId,
        assigned_at: new Date().toISOString()
      })
      .eq('id', availableSpot.id);

    if (rosterError) {
      console.error('❌ Error adding player to roster:', rosterError);
      return new Response(
        JSON.stringify({ error: 'Failed to add player to roster', details: rosterError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Player added to roster successfully');

    console.log('✅ Auto-draft completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true, 
        draftPick,
        message: 'Player auto-drafted successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in auto-draft:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to auto-draft player', 
        details: error.message,
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
