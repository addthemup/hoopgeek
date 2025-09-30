import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create a client with the user's JWT
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    // Get the current user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const body = await req.json()
    const { name, description, maxTeams, scoringType, teamName } = body

    // Validate required fields
    if (!name || !teamName || !maxTeams || !scoringType) {
      throw new Error('Missing required fields')
    }

    // Generate unique invite code
    const generateInviteCode = () => {
      return Math.random().toString(36).substring(2, 10).toUpperCase()
    }

    let inviteCode = generateInviteCode()
    let isUnique = false
    let attempts = 0

    // Ensure invite code is unique
    while (!isUnique && attempts < 10) {
      const { data: existingLeague } = await supabase
        .from('leagues')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()

      if (!existingLeague) {
        isUnique = true
      } else {
        inviteCode = generateInviteCode()
        attempts++
      }
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique invite code')
    }

    // Create league using the database function
    const { data: leagueId, error: leagueError } = await supabase
      .rpc('create_league_with_commissioner', {
        league_name: name,
        league_description: description || null,
        max_teams_count: maxTeams,
        scoring_type_val: scoringType,
        team_name_val: teamName
      })

    if (leagueError) {
      console.error('League creation error:', leagueError)
      throw new Error(`Failed to create league: ${leagueError.message}`)
    }

    // Get the created league details
    const { data: league, error: fetchError } = await supabase
      .from('leagues')
      .select(`
        *,
        league_members (
          id,
          team_name,
          is_commissioner,
          user_id
        )
      `)
      .eq('id', leagueId)
      .single()

    if (fetchError) {
      console.error('League fetch error:', fetchError)
      throw new Error(`Failed to fetch created league: ${fetchError.message}`)
    }

    console.log('Successfully created league:', league)

    return new Response(
      JSON.stringify({
        message: 'League created successfully',
        league: league
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Function error:', error)
  return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})