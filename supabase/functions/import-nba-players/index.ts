import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NBAPlayer {
  PERSON_ID: number
  DISPLAY_FIRST_LAST: string
  DISPLAY_LAST_COMMA_FIRST: string
  DISPLAY_FI_LAST: string
  PLAYER_SLUG: string
  BIRTHDATE: string
  SCHOOL: string
  COUNTRY: string
  LAST_AFFILIATION: string
  HEIGHT: string
  WEIGHT: string
  SEASON_EXP: number
  JERSEY: string
  POSITION: string
  ROSTERSTATUS: string
  GAMES_PLAYED_CURRENT_SEASON_FLAG: string
  TEAM_ID: number
  TEAM_NAME: string
  TEAM_ABBREVIATION: string
  TEAM_CODE: string
  TEAM_CITY: string
  PLAYERCODE: string
  FROM_YEAR: number
  TO_YEAR: number
  DLEAGUE_FLAG: string
  NBA_FLAG: string
  GAMES_PLAYED_FLAG: string
  DRAFT_YEAR: string
  DRAFT_ROUND: string
  DRAFT_NUMBER: string
}

interface NBAPlayersResponse {
  resultSets: Array<{
    name: string
    headers: string[]
    rowSet: any[][]
  }>
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Starting NBA players import...')

    // Fetch all players from NBA API
    const nbaApiUrl = 'https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=0'
    
    const response = await fetch(nbaApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com'
      }
    })

    if (!response.ok) {
      throw new Error(`NBA API request failed: ${response.status} ${response.statusText}`)
    }

    const data: NBAPlayersResponse = await response.json()
    
    if (!data.resultSets || data.resultSets.length === 0) {
      throw new Error('No player data received from NBA API')
    }

    const playersData = data.resultSets[0]
    const headers = playersData.headers
    const rows = playersData.rowSet

    console.log(`Found ${rows.length} players from NBA API`)

    // Map NBA API data to our database structure
    const players = rows.map((row: any[]) => {
      const player: any = {}
      headers.forEach((header, index) => {
        player[header] = row[index]
      })
      return player as NBAPlayer
    })

    let importedCount = 0
    let updatedCount = 0
    let errorCount = 0

    // Process players in batches
    const batchSize = 50
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize)
      
      for (const player of batch) {
        try {
          // Parse birth date
          let birthDate = null
          if (player.BIRTHDATE) {
            const dateStr = player.BIRTHDATE.split('T')[0] // Remove time part
            birthDate = dateStr
          }

          // Parse height (format: "6-8" -> convert to inches or keep as string)
          const height = player.HEIGHT || null

          // Parse weight
          const weight = player.WEIGHT ? parseInt(player.WEIGHT) : null

          // Parse draft information
          const draftYear = player.DRAFT_YEAR ? parseInt(player.DRAFT_YEAR) : null
          const draftRound = player.DRAFT_ROUND ? parseInt(player.DRAFT_ROUND) : null
          const draftNumber = player.DRAFT_NUMBER ? parseInt(player.DRAFT_NUMBER) : null

          // Determine if player is active
          const isActive = player.TO_YEAR === null || player.TO_YEAR >= 2024

          // Determine if player is rookie
          const isRookie = player.SEASON_EXP === 0

          // Call the upsert function
          const { data: playerId, error } = await supabase.rpc('upsert_player', {
            p_nba_player_id: player.PERSON_ID,
            p_name: player.DISPLAY_FIRST_LAST,
            p_first_name: player.DISPLAY_FIRST_LAST.split(' ')[0],
            p_last_name: player.DISPLAY_FIRST_LAST.split(' ').slice(1).join(' '),
            p_position: player.POSITION || null,
            p_team_id: player.TEAM_ID || null,
            p_team_name: player.TEAM_NAME || null,
            p_team_abbreviation: player.TEAM_ABBREVIATION || null,
            p_jersey_number: player.JERSEY || null,
            p_height: height,
            p_weight: weight,
            p_age: null, // Will be calculated based on birth date
            p_birth_date: birthDate,
            p_birth_city: null, // Not available in this endpoint
            p_birth_state: null, // Not available in this endpoint
            p_birth_country: player.COUNTRY || null,
            p_college: player.SCHOOL || null,
            p_draft_year: draftYear,
            p_draft_round: draftRound,
            p_draft_number: draftNumber,
            p_salary: 0, // Will be updated separately with salary data
            p_is_active: isActive,
            p_is_rookie: isRookie,
            p_years_pro: player.SEASON_EXP || 0,
            p_from_year: player.FROM_YEAR || null,
            p_to_year: player.TO_YEAR || null
          })

          if (error) {
            console.error(`Error upserting player ${player.DISPLAY_FIRST_LAST}:`, error)
            errorCount++
          } else {
            // Check if this was an insert or update by checking if player already existed
            const { data: existingPlayer } = await supabase
              .from('players')
              .select('id')
              .eq('nba_player_id', player.PERSON_ID)
              .single()

            if (existingPlayer) {
              updatedCount++
            } else {
              importedCount++
            }
          }
        } catch (err) {
          console.error(`Error processing player ${player.DISPLAY_FIRST_LAST}:`, err)
          errorCount++
        }
      }

      // Add a small delay between batches to avoid overwhelming the database
      if (i + batchSize < players.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`Import completed: ${importedCount} imported, ${updatedCount} updated, ${errorCount} errors`)

    return new Response(
      JSON.stringify({
        message: 'NBA players import completed',
        stats: {
          total: players.length,
          imported: importedCount,
          updated: updatedCount,
          errors: errorCount
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Import error:', error)
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
