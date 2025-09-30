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

    // Mock NBA players data (in production, you'd call a Python service or use NBA API)
    const playersData = [
      {
        id: "203999",
        name: "Nikola Jokić",
        position: "C",
        team: "DEN",
        salary: 47607350,
        stats: {
          points: 24.5,
          rebounds: 11.8,
          assists: 9.8,
          steals: 1.3,
          blocks: 0.9,
          field_goal_percentage: 0.583,
          free_throw_percentage: 0.821,
          three_point_percentage: 0.338
        }
      },
      {
        id: "201939",
        name: "Stephen Curry",
        position: "PG",
        team: "GSW",
        salary: 51915615,
        stats: {
          points: 26.4,
          rebounds: 4.5,
          assists: 5.1,
          steals: 1.0,
          blocks: 0.4,
          field_goal_percentage: 0.430,
          free_throw_percentage: 0.915,
          three_point_percentage: 0.357
        }
      },
      {
        id: "201142",
        name: "Kevin Durant",
        position: "PF",
        team: "PHX",
        salary: 46400000,
        stats: {
          points: 27.1,
          rebounds: 6.7,
          assists: 5.0,
          steals: 0.9,
          blocks: 1.2,
          field_goal_percentage: 0.529,
          free_throw_percentage: 0.853,
          three_point_percentage: 0.410
        }
      },
      {
        id: "201942",
        name: "Giannis Antetokounmpo",
        position: "PF",
        team: "MIL",
        salary: 45640000,
        stats: {
          points: 31.1,
          rebounds: 11.8,
          assists: 5.7,
          steals: 0.8,
          blocks: 0.8,
          field_goal_percentage: 0.553,
          free_throw_percentage: 0.655,
          three_point_percentage: 0.275
        }
      },
      {
        id: "203999",
        name: "Luka Dončić",
        position: "PG",
        team: "DAL",
        salary: 40000000,
        stats: {
          points: 32.4,
          rebounds: 8.2,
          assists: 9.1,
          steals: 1.4,
          blocks: 0.5,
          field_goal_percentage: 0.490,
          free_throw_percentage: 0.742,
          three_point_percentage: 0.340
        }
      }
    ]

    // Insert/update players in Supabase
    const { data, error } = await supabase
      .from('players')
      .upsert(playersData, { onConflict: 'id' })

    if (error) {
      console.error('Supabase error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    console.log('Successfully upserted players:', data)

    return new Response(
      JSON.stringify({
        message: `Successfully synced ${playersData.length} players`,
        players_count: playersData.length,
        data: data
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