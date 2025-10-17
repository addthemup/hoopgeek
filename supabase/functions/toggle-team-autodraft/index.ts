import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ToggleTeamAutodraftRequest {
  teamId: string;
  enabled: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🤖 Toggle team autodraft function called');
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { teamId, enabled }: ToggleTeamAutodraftRequest = await req.json()
    
    console.log('🤖 Toggle team autodraft request:', {
      teamId,
      enabled
    })

    // Validate required parameters
    if (!teamId || enabled === undefined || enabled === null) {
      console.error('❌ Missing required parameters:', {
        teamId: !!teamId,
        enabled
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: teamId and enabled are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update the team's autodraft setting
    const { data, error } = await supabase
      .from('fantasy_teams')
      .update({ 
        autodraft_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', teamId)
      .select('id, team_name, autodraft_enabled')
      .single();

    if (error) {
      console.error('❌ Error updating team autodraft:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to update team autodraft: ${error.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Team autodraft updated successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          teamId: data.id,
          teamName: data.team_name,
          autodraftEnabled: data.autodraft_enabled
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Toggle team autodraft function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
