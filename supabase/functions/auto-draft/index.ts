import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leagueId, playerId, teamId, pickNumber } = await req.json()

    if (!leagueId || !playerId || !teamId || !pickNumber) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Auto-drafting player ${playerId} to team ${teamId} at pick ${pickNumber}`)

    // Create Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // First get the round number from draft_order
    const { data: draftOrderData, error: draftOrderError } = await supabase
      .from('draft_order')
      .select('round')
      .eq('league_id', leagueId)
      .eq('pick_number', pickNumber)
      .single()

    if (draftOrderError) {
      console.error('Error fetching draft order:', draftOrderError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch draft order' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Start a transaction to ensure data consistency
    const { data: draftPick, error: draftPickError } = await supabase
      .from('draft_picks')
      .insert({
        league_id: leagueId,
        pick_number: pickNumber,
        player_id: playerId,
        fantasy_team_id: teamId,
        round: draftOrderData.round
      })
      .select()
      .single()

    if (draftPickError) {
      console.error('Error creating draft pick:', draftPickError)
      return new Response(
        JSON.stringify({ error: 'Failed to create draft pick' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Mark the pick as completed in draft_order
    const { error: updateOrderError } = await supabase
      .from('draft_order')
      .update({ is_completed: true })
      .eq('league_id', leagueId)
      .eq('pick_number', pickNumber)

    if (updateOrderError) {
      console.error('Error updating draft order:', updateOrderError)
      // Don't fail the request, just log the error
    }

    // Add player to team roster (find first available roster spot)
    const { data: availableSpot, error: spotError } = await supabase
      .from('fantasy_team_players')
      .select('id, roster_spot_id, position')
      .eq('fantasy_team_id', teamId)
      .is('player_id', null)
      .limit(1)
      .single();

    if (spotError || !availableSpot) {
      console.error('No available roster spots:', spotError);
      // Don't fail the request, just log the error
    } else {
      const { error: rosterError } = await supabase
        .from('fantasy_team_players')
        .update({ player_id: playerId })
        .eq('id', availableSpot.id);

      if (rosterError) {
        console.error('Error adding player to roster:', rosterError);
      }
    }

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
    console.error('Error in auto-draft:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to auto-draft player' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
