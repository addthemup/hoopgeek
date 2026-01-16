import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('🏀 Starting NBA team roster import...')

    // Get current season
    const currentDate = new Date()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const season = month >= 10 
      ? `${year}-${(year + 1).toString().slice(-2)}`
      : `${year - 1}-${year.toString().slice(-2)}`

    console.log(`📅 Season: ${season}`)

    // Get all teams from database
    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('nba_teams')
      .select('team_id, abbreviation')

    if (teamsError) {
      throw new Error(`Failed to fetch teams: ${teamsError.message}`)
    }

    if (!teams || teams.length === 0) {
      throw new Error('No teams found in database')
    }

    console.log(`📋 Found ${teams.length} teams`)

    let totalImported = 0
    let totalErrors = 0

    // Import roster for each team
    for (const team of teams) {
      const teamId = team.team_id
      const teamAbbr = team.abbreviation

      console.log(`\n🏀 Processing ${teamAbbr} (ID: ${teamId})...`)

      try {
        const imported = await importTeamRoster(supabaseAdmin, teamId, season)
        
        if (imported > 0) {
          totalImported += imported
        } else {
          totalErrors++
        }
      } catch (error) {
        console.error(`❌ Error processing team ${teamAbbr}:`, error)
        totalErrors++
      }
    }

    // After importing all rosters, sync player teams and mark free agents
    console.log(`\n🔄 Syncing player team assignments from roster data...`)
    const syncResult = await syncPlayerTeamsFromRoster(supabaseAdmin, season)
    
    if (!syncResult.success) {
      console.error(`⚠️  Warning: Team sync had issues: ${syncResult.error}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Team roster import completed`,
        season,
        totalTeams: teams.length,
        totalPlayersImported: totalImported,
        teamsWithErrors: totalErrors,
        syncResult: syncResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error importing team rosters:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function importTeamRoster(supabaseAdmin: any, teamId: number, season: string) {
  try {
    console.log(`📋 Fetching roster for team ${teamId} (season ${season})...`)

    // Fetch roster from NBA API
    const url = `https://stats.nba.com/stats/commonteamroster?TeamID=${teamId}&Season=${season}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(url, {
      headers: NBA_HEADERS,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()

    if (!data.resultSets || data.resultSets.length === 0) {
      console.log(`⚠️  No roster data for team ${teamId}`)
      return 0
    }

    // Find the roster result set
    const rosterSet = data.resultSets.find((rs: any) => rs.name === 'CommonTeamRoster')
    
    if (!rosterSet || !rosterSet.rowSet || rosterSet.rowSet.length === 0) {
      console.log(`⚠️  No roster data for team ${teamId}`)
      return 0
    }

    const headers = rosterSet.headers
    const rows = rosterSet.rowSet

    // Map headers to indices
    const headerMap: Record<string, number> = {}
    headers.forEach((header: string, index: number) => {
      headerMap[header] = index
    })

    let importedCount = 0
    const errors: string[] = []

    // Process each player in the roster
    for (const row of rows) {
      try {
        const nbaPlayerId = parseInt(row[headerMap['PLAYER_ID']])
        const playerName = row[headerMap['PLAYER']] || ''
        const playerSlug = row[headerMap['PLAYER_SLUG']] || ''
        const jerseyNumber = row[headerMap['NUM']] ? String(row[headerMap['NUM']]) : null
        const position = row[headerMap['POSITION']] || null
        const height = row[headerMap['HEIGHT']] || null
        const weight = row[headerMap['WEIGHT']] ? parseInt(row[headerMap['WEIGHT']]) : null
        const birthDate = row[headerMap['BIRTH_DATE']] || null
        const age = row[headerMap['AGE']] ? parseInt(row[headerMap['AGE']]) : null
        // Handle rookies - NBA API returns 'R' for rookies
        let experienceYears: number | null = null
        if (row[headerMap['EXP']]) {
          const expValue = String(row[headerMap['EXP']]).trim()
          if (expValue.toUpperCase() === 'R') {
            experienceYears = 0  // Rookie = 0 years experience
          } else {
            const parsed = parseInt(expValue)
            if (!isNaN(parsed)) {
              experienceYears = parsed
            }
          }
        }
        const school = row[headerMap['SCHOOL']] || null

        // Parse birth date
        let parsedBirthDate: string | null = null
        if (birthDate) {
          try {
            // NBA API format is typically "YYYY-MM-DD" or "MM/DD/YYYY"
            if (birthDate.includes('/')) {
              const parts = birthDate.split('/')
              if (parts.length === 3) {
                const month = parts[0].padStart(2, '0')
                const day = parts[1].padStart(2, '0')
                const year = parts[2]
                parsedBirthDate = `${year}-${month}-${day}`
              }
            } else if (birthDate.includes('-')) {
              parsedBirthDate = birthDate
            }
          } catch (e) {
            // Invalid date format, skip
          }
        }

        // Find player in our database
        let playerId: string | null = null
        
        const { data: existingPlayer } = await supabaseAdmin
          .from('nba_players')
          .select('id')
          .eq('nba_player_id', nbaPlayerId)
          .limit(1)

        if (existingPlayer && existingPlayer.length > 0) {
          playerId = existingPlayer[0].id
        }

        // Prepare roster entry
        const rosterEntry: any = {
          team_id: teamId,
          season: season,
          nba_player_id: nbaPlayerId,
          player_name: playerName,
          player_slug: playerSlug,
          jersey_number: jerseyNumber,
          position: position,
          height: height,
          weight: weight,
          birth_date: parsedBirthDate,
          age: age,
          experience_years: experienceYears,
          school: school,
        }

        // Add player_id if found
        if (playerId) {
          rosterEntry.player_id = playerId
        }

        // Upsert roster entry
        const { error } = await supabaseAdmin
          .from('nba_team_roster')
          .upsert(rosterEntry, {
            onConflict: 'team_id,season,nba_player_id'
          })

        if (error) {
          const errorMsg = `Error processing player ${playerName}: ${error.message}`
          errors.push(errorMsg)
          console.error(`⚠️  ${errorMsg}`)
        } else {
          importedCount++
          
          // Update nba_players.team_id from roster data (more accurate than commonallplayers endpoint)
          if (playerId) {
            // Get team info from nba_teams
            const { data: teamInfo } = await supabaseAdmin
              .from('nba_teams')
              .select('team_id, abbreviation, city, nickname')
              .eq('team_id', teamId)
              .single()
            
            if (teamInfo) {
              const { error: updateError } = await supabaseAdmin
                .from('nba_players')
                .update({
                  team_id: teamId,
                  team_name: `${teamInfo.city} ${teamInfo.nickname}`,
                  team_abbreviation: teamInfo.abbreviation,
                  team_city: teamInfo.city,
                  updated_at: new Date().toISOString()
                })
                .eq('id', playerId)
              
              if (updateError) {
                console.error(`⚠️  Error updating player team info for ${playerName}: ${updateError.message}`)
              }
            }
          }
        }

      } catch (error) {
        const errorMsg = `Error processing player: ${error.message}`
        errors.push(errorMsg)
        console.error(`⚠️  ${errorMsg}`)
      }
    }

    console.log(`✅ Imported ${importedCount} players for team ${teamId}`)
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors occurred`)
    }

    return importedCount

  } catch (error) {
    console.error(`❌ Error importing roster for team ${teamId}:`, error)
    return 0
  }
}

async function syncPlayerTeamsFromRoster(supabaseAdmin: any, season: string) {
  console.log(`\n🔄 Syncing player teams from roster data...`)
  
  try {
    // Call the database function which handles both updating players on teams AND clearing free agents
    const { data: syncResult, error: syncError } = await supabaseAdmin.rpc(
      'sync_player_teams_from_roster',
      { p_season: season }
    )
    
    if (syncError) {
      console.error(`❌ Error syncing player teams: ${syncError.message}`)
      return { success: false, error: syncError.message }
    }
    
    if (!syncResult || !syncResult.success) {
      return { 
        success: false, 
        error: syncResult?.error || 'Unknown error in sync function' 
      }
    }
    
    const playersUpdated = syncResult?.players_updated || 0
    const freeAgentsCleared = syncResult?.free_agents_cleared || 0
    
    console.log(`✅ Updated ${playersUpdated} players with team info from rosters`)
    console.log(`✅ Cleared team info for ${freeAgentsCleared} free agents (players not on any roster)`)
    
    return {
      success: true,
      playersUpdated,
      freeAgentsCleared,
      message: `Synced ${playersUpdated} players and cleared ${freeAgentsCleared} free agents`
    }
  } catch (error) {
    console.error(`❌ Error in sync function: ${error.message}`)
    return { success: false, error: error.message }
  }
}

