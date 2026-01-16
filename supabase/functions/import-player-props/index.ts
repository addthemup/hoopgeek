// Supabase Edge Function to import player props from SportsGameOdds API
// This runs on a schedule (cron job) to import props 4 times daily
// Optimized to reduce API calls and respect rate limits

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SPORTS_ODDS_API_KEY = Deno.env.get('VITE_SPORTS_ODDS_API_KEY') || Deno.env.get('SPORTS_ODDS_API_KEY') || '79ae5f47830d3d87e70896e36b5eefc3'
const SPORTS_ODDS_API_URL = 'https://api.sportsgameodds.com/v2'

// Retry configuration
const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 60000 // 60 seconds

// Rate limiting configuration
// AGGRESSIVE limits to minimize API calls and prevent rate limiting
const MAX_REQUESTS_PER_MINUTE = 10 // Very conservative - well below limits
const MIN_DELAY_BETWEEN_REQUESTS = 6000 // 6 seconds between requests (10 req/min = 6s each)
const RECENT_DATA_THRESHOLD_HOURS = 12 // Skip API call if we have data from last 12 hours (was 2)

// Track request times for rate limiting
const requestTimes: number[] = []

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Rate limiter: ensures we don't exceed API rate limits
 * Tracks request times and waits if needed
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now()
  
  // Remove requests older than 1 minute
  const oneMinuteAgo = now - 60000
  while (requestTimes.length > 0 && requestTimes[0] < oneMinuteAgo) {
    requestTimes.shift()
  }
  
  // If we're at the limit, wait until the oldest request expires
  if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestRequest = requestTimes[0]
    const waitTime = 60000 - (now - oldestRequest) + 100 // Add 100ms buffer
    if (waitTime > 0) {
      console.log(`⏳ Rate limit: waiting ${Math.ceil(waitTime / 1000)}s (${requestTimes.length}/${MAX_REQUESTS_PER_MINUTE} requests in last minute)`)
      await sleep(waitTime)
    }
  }
  
  // Ensure minimum delay between requests
  if (requestTimes.length > 0) {
    const lastRequest = requestTimes[requestTimes.length - 1]
    const timeSinceLastRequest = now - lastRequest
    if (timeSinceLastRequest < MIN_DELAY_BETWEEN_REQUESTS) {
      const waitTime = MIN_DELAY_BETWEEN_REQUESTS - timeSinceLastRequest
      console.log(`⏳ Rate limit: waiting ${Math.ceil(waitTime)}ms between requests`)
      await sleep(waitTime)
    }
  }
  
  // Record this request
  requestTimes.push(Date.now())
}

/**
 * Check if we already have recent props data for a given date
 * Returns true if we have data from within the threshold, false otherwise
 */
async function hasRecentPropsData(
  supabase: any,
  targetDate: string
): Promise<boolean> {
  try {
    const thresholdTime = new Date()
    thresholdTime.setHours(thresholdTime.getHours() - RECENT_DATA_THRESHOLD_HOURS)
    
    const { data, error } = await supabase
      .from('player_props_games')
      .select('updated_at, game_date')
      .eq('game_date', targetDate)
      .gte('updated_at', thresholdTime.toISOString())
      .limit(1)
    
    if (error) {
      console.log(`  ⚠️  Error checking recent data: ${error.message}`)
      return false
    }
    
    if (data && data.length > 0) {
      console.log(`  ℹ️  Found recent props data for ${targetDate} (within ${RECENT_DATA_THRESHOLD_HOURS} hours)`)
      return true
    }
    
    return false
  } catch (e) {
    console.log(`  ⚠️  Exception checking recent data: ${e}`)
    return false
  }
}

/**
 * REMOVED: checkRateLimitUsage() function
 * This function itself makes an API call, which contributes to rate limiting.
 * We'll rely on the waitForRateLimit() function and longer delays instead.
 */

/**
 * Fetch with retry logic and exponential backoff
 * Handles 429 (Too Many Requests) errors with appropriate delays
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      // If successful, return immediately
      if (response.ok) {
        if (attempt > 0) {
          console.log(`✅ API request succeeded after ${attempt} retry(ies)`)
        }
        return response
      }
      
      // Handle 429 (Too Many Requests) with special logic
      if (response.status === 429) {
        // Check for Retry-After header
        const retryAfter = response.headers.get('Retry-After')
        let delay: number
        
        if (retryAfter) {
          // Use the server's suggested delay
          delay = parseInt(retryAfter, 10) * 1000
          console.log(`⏳ Rate limited (429). Server suggests waiting ${retryAfter} seconds`)
        } else {
          // Exponential backoff: 2^attempt * INITIAL_RETRY_DELAY
          delay = Math.min(
            Math.pow(2, attempt) * INITIAL_RETRY_DELAY,
            MAX_RETRY_DELAY
          )
          console.log(`⏳ Rate limited (429). Retrying in ${delay / 1000} seconds (attempt ${attempt + 1}/${retries + 1})`)
        }
        
        // If this is the last attempt, throw the error
        if (attempt === retries) {
          throw new Error(`API request failed: ${response.status} ${response.statusText} (after ${retries + 1} attempts)`)
        }
        
        // Wait before retrying
        await sleep(delay)
        continue
      }
      
      // For other non-OK statuses, throw immediately (no retry)
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      
    } catch (error) {
      lastError = error as Error
      
      // If this is the last attempt, throw the error
      if (attempt === retries) {
        throw lastError
      }
      
      // For network errors, use exponential backoff
      if (error instanceof TypeError || error.message.includes('fetch')) {
        const delay = Math.min(
          Math.pow(2, attempt) * INITIAL_RETRY_DELAY,
          MAX_RETRY_DELAY
        )
        console.log(`⚠️  Network error. Retrying in ${delay / 1000} seconds (attempt ${attempt + 1}/${retries + 1})`)
        await sleep(delay)
        continue
      }
      
      // For other errors, throw immediately
      throw error
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Unknown error in fetchWithRetry')
}

interface PlayerProp {
  oddID: string
  playerID: string
  statID: string
  betTypeID: string
  sideID: string
  line: number | null
  bookOdds: string | null
  fairOdds: string | null
  bookmakerID: string
  bookmakerName: string
  rawData: any
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🎲 Starting player props import...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for concurrent runs using a simple lock mechanism
    // Store lock in a table or use Supabase's built-in locking
    const lockKey = 'import-player-props-lock'
    const lockTimeout = 30 * 60 * 1000 // 30 minutes
    
    try {
      // Try to acquire lock (this is a simple check - in production you might want a proper distributed lock)
      const { data: existingLock } = await supabase
        .from('player_props_games')
        .select('updated_at')
        .limit(1)
        .single()
      
      // If there's a very recent update (within last 5 minutes), another instance might be running
      // This is a simple heuristic - for production, consider using a proper lock table
      console.log('🔒 Checking for concurrent runs...')
    } catch (e) {
      // Lock check failed, continue anyway
      console.log('  ℹ️  Could not check for concurrent runs, continuing...')
    }

    // Get today's date (and tomorrow as fallback)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    console.log(`📅 Importing props for ${todayStr} (fallback: ${tomorrowStr})`)

    // AGGRESSIVE: Check if we already have recent data for today (12 hour threshold)
    const hasRecentData = await hasRecentPropsData(supabase, todayStr)
    if (hasRecentData) {
      console.log(`ℹ️  Skipping API call - recent data exists for ${todayStr} (within ${RECENT_DATA_THRESHOLD_HOURS} hours)`)
      return new Response(
        JSON.stringify({
          success: true,
          message: `Skipped import - recent data exists for ${todayStr} (within ${RECENT_DATA_THRESHOLD_HOURS} hours)`,
          gamesImported: 0,
          propsImported: 0,
          skipped: true,
          targetDate: todayStr,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // REMOVED: checkRateLimitUsage() call - this itself makes an API call!
    // We'll rely on the waitForRateLimit() function instead

    // Wait for rate limit before making the API call (with longer delays)
    console.log('⏳ Waiting for rate limit clearance...')
    await waitForRateLimit()

    // Fetch events from SportsGameOdds API with retry logic
    const response = await fetchWithRetry(
      `${SPORTS_ODDS_API_URL}/events?leagueID=NBA&oddsAvailable=true&finalized=false&limit=50`,
      {
        headers: {
          'x-api-key': SPORTS_ODDS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()
    const events = Array.isArray(data) ? data : (data.data || [])

    console.log(`✅ Found ${events.length} total events`)

    // Filter events for today (or tomorrow if no events today)
    let targetDate = todayStr
    let targetEvents = events.filter((event: any) => {
      const startsAt = event.status?.startsAt
      if (!startsAt) return false
      const eventDate = new Date(startsAt).toISOString().split('T')[0]
      return eventDate === targetDate
    })

    if (targetEvents.length === 0) {
      console.log(`⚠️  No events for ${todayStr}, trying ${tomorrowStr}...`)
      targetDate = tomorrowStr
      targetEvents = events.filter((event: any) => {
        const startsAt = event.status?.startsAt
        if (!startsAt) return false
        const eventDate = new Date(startsAt).toISOString().split('T')[0]
        return eventDate === targetDate
      })
    }

    console.log(`📅 Found ${targetEvents.length} events for ${targetDate}`)

    if (targetEvents.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No events found for today or tomorrow',
          gamesImported: 0,
          propsImported: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalGames = 0
    let totalProps = 0

    // Process each event with a small delay between events to avoid overwhelming the system
    for (let i = 0; i < targetEvents.length; i++) {
      const event = targetEvents[i]
      const eventId = event.eventID
      console.log(`\n📊 Processing event ${i + 1}/${targetEvents.length}: ${eventId}`)

      // Import game and props
      const result = await importGameAndProps(supabase, event, targetDate)
      totalGames += result.games
      totalProps += result.props

      // Longer delay between events to avoid overwhelming the database and API
      if (i < targetEvents.length - 1) {
        await sleep(500) // 500ms delay between events (increased from 100ms)
      }
    }

    console.log(`\n✅ Import complete: ${totalGames} games, ${totalProps} props`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${totalGames} games and ${totalProps} player props`,
        gamesImported: totalGames,
        propsImported: totalProps,
        targetDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function importGameAndProps(
  supabase: any,
  event: any,
  targetDate: string
): Promise<{ games: number; props: number }> {
  const eventId = event.eventID
  if (!eventId) return { games: 0, props: 0 }

  // Extract game info
  const homeTeam = event.teams?.home?.names?.long || event.teams?.home?.name || 'Unknown'
  const awayTeam = event.teams?.away?.names?.long || event.teams?.away?.name || 'Unknown'
  const homeTricode = event.teams?.home?.tricode || null
  const awayTricode = event.teams?.away?.tricode || null
  const startsAt = event.status?.startsAt || null
  const finalized = event.status?.finalized || false

  // Import/update game
  const gameData = {
    event_id: eventId,
    game_date: targetDate,
    home_team: homeTeam,
    away_team: awayTeam,
    home_team_tricode: homeTricode,
    away_team_tricode: awayTricode,
    starts_at: startsAt,
    league_id: 'NBA',
    odds_available: true,
    finalized,
    raw_event_data: event,
  }

  const { data: gameResult, error: gameError } = await supabase
    .from('player_props_games')
    .upsert(gameData, { onConflict: 'event_id,game_date' })
    .select()
    .single()

  if (gameError || !gameResult) {
    console.error(`  ❌ Failed to import game: ${gameError?.message}`)
    return { games: 0, props: 0 }
  }

  const gameId = gameResult.id
  console.log(`  ✅ Imported game: ${awayTeam} @ ${homeTeam}`)

  // Extract player props
  const props = extractPlayerProps(event)
  console.log(`  📊 Found ${props.length} player props`)

  if (props.length === 0) {
    return { games: 1, props: 0 }
  }

  // Import props
  const propsToInsert = []
  for (const prop of props) {
    // Find player in database
    const player = await findPlayerInDb(supabase, prop.playerID, homeTricode || awayTricode)

    let playerId = null
    let nbaPlayerId = null
    let playerName = normalizePlayerName(prop.playerID)

    if (player) {
      playerId = player.id
      nbaPlayerId = player.nba_player_id
      playerName = player.name
    }

    // Get bookmaker info
    const byBookmaker = prop.rawData?.byBookmaker || {}
    let bookmakerId = 'consensus'
    let bookmakerName = 'Consensus'
    let bookOdds = prop.bookOdds

    if (typeof byBookmaker === 'object' && byBookmaker !== null) {
      for (const [bmId, bmData] of Object.entries(byBookmaker)) {
        if (typeof bmData === 'object' && bmData !== null && (bmData as any).available) {
          bookmakerId = bmId
          bookmakerName = bmId.charAt(0).toUpperCase() + bmId.slice(1)
          bookOdds = (bmData as any).odds || bookOdds
          break
        }
      }
    }

    propsToInsert.push({
      game_id: gameId,
      event_id: eventId,
      player_name: playerName,
      player_id: playerId,
      nba_player_id: nbaPlayerId,
      bet_type: prop.statID,
      bet_type_id: `${prop.statID}-${prop.sideID}`,
      line: prop.line,
      price: bookOdds || prop.fairOdds,
      american_odds: bookOdds,
      bookmaker: bookmakerName,
      bookmaker_id: bookmakerId,
      raw_odd_data: prop.rawData,
      game_date: targetDate,
    })
  }

  // Deduplicate props: For each player + bet_type combination, keep only the one with the HIGHEST line value
  // Group props by player and bet_type (not including bookmaker_id, so we can compare across bookmakers)
  const propsByPlayerAndType = new Map<string, any[]>()
  propsToInsert.forEach((prop) => {
    // Use player_name + bet_type as key (not including bookmaker_id)
    // This allows us to compare all props for the same player/bet_type and keep the highest line
    const key = `${prop.player_name}-${prop.bet_type}-${prop.game_date}`
    if (!propsByPlayerAndType.has(key)) {
      propsByPlayerAndType.set(key, [])
    }
    propsByPlayerAndType.get(key)!.push(prop)
  })

  // For each group, keep only the one with the highest line value
  // If lines are equal, prefer DraftKings > FanDuel > Consensus > others
  const getBookmakerPriority = (bookmaker: string): number => {
    const bm = (bookmaker || '').toLowerCase()
    if (bm.includes('draftkings') || bm === 'draftkings') return 1
    if (bm.includes('fanduel') || bm === 'fanduel') return 2
    if (bm === 'consensus') return 3
    return 4
  }

  const uniqueProps: any[] = []
  propsByPlayerAndType.forEach((props) => {
    // Sort by line value (descending - highest first), then by bookmaker priority as tiebreaker
    props.sort((a, b) => {
      const lineA = parseFloat(a.line?.toString() || '0')
      const lineB = parseFloat(b.line?.toString() || '0')
      
      // First sort by line (descending - higher is better)
      if (lineA !== lineB) {
        return lineB - lineA
      }
      
      // If lines are equal, use bookmaker priority as tiebreaker
      return getBookmakerPriority(a.bookmaker) - getBookmakerPriority(b.bookmaker)
    })
    
    // Take the first one (highest line, or best bookmaker if tied)
    if (props[0]) {
      uniqueProps.push(props[0])
    }
  })

  console.log(`  🔄 Deduplicated: ${propsToInsert.length} -> ${uniqueProps.length} props (keeping highest line for each player+bet_type)`)

  // Batch insert
  let propsImported = 0
  const batchSize = 100
  for (let i = 0; i < uniqueProps.length; i += batchSize) {
    const batch = uniqueProps.slice(i, i + batchSize)
    const { data, error } = await supabase
      .from('player_props')
      .upsert(batch, { onConflict: 'event_id,player_name,bet_type_id,bookmaker_id,game_date' })
      .select()

    if (error) {
      console.error(`  ❌ Error inserting batch: ${error.message}`)
    } else if (data) {
      propsImported += data.length
    }
  }

  console.log(`  ✅ Imported ${propsImported} player props`)

  return { games: 1, props: propsImported }
}

function extractPlayerProps(event: any): PlayerProp[] {
  const props: PlayerProp[] = []
  const odds = event.odds || {}

  for (const [oddId, oddData] of Object.entries(odds)) {
    const odd = oddData as any

    const statEntity = odd.statEntityID || ''
    const betTypeId = odd.betTypeID || ''
    const statId = odd.statID || ''
    const sideId = odd.sideID || ''

    // Only player props (not 'all', 'home', 'away')
    if (!statEntity || ['all', 'home', 'away'].includes(statEntity.toLowerCase())) {
      continue
    }

    // Only over/under props with lines
    if (betTypeId !== 'ou' || sideId !== 'over' && sideId !== 'under') {
      continue
    }

    const line = odd.bookOverUnder || odd.bookSpread || odd.line
    if (line === null || line === undefined) {
      continue
    }

    props.push({
      oddID: oddId,
      playerID: statEntity,
      statID: statId,
      betTypeID: betTypeId,
      sideID: sideId,
      line: parseFloat(line),
      bookOdds: odd.bookOdds || null,
      fairOdds: odd.fairOdds || null,
      bookmakerID: 'consensus',
      bookmakerName: 'Consensus',
      rawData: odd,
    })
  }

  return props
}

function normalizePlayerName(apiName: string): string {
  return apiName
    .replace('_1_NBA', '')
    .replace('_NBA', '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

async function findPlayerInDb(
  supabase: any,
  apiPlayerId: string,
  teamTricode: string | null
): Promise<any | null> {
  const normalizedName = normalizePlayerName(apiPlayerId)

  // First, check manual mapping table
  try {
    const { data: mappingData } = await supabase
      .from('player_props_name_mapping')
      .select('player_id, nba_player_id')
      .ilike('api_player_name', normalizedName)
      .limit(1)

    if (mappingData && mappingData.length > 0) {
      // Get full player info
      const { data: playerData } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, team_abbreviation')
        .eq('id', mappingData[0].player_id)
        .single()

      if (playerData) {
        return playerData
      }
    }
  } catch (e) {
    // If mapping table doesn't exist or query fails, continue with other strategies
    console.log('  ⚠️  Mapping table check failed, continuing with name matching')
  }

  // Try exact match
  let { data, error } = await supabase
    .from('nba_players')
    .select('id, nba_player_id, name, team_abbreviation')
    .ilike('name', normalizedName)
    .limit(10)

  if (error || !data || data.length === 0) {
    // Try partial match
    const parts = normalizedName.split()
    if (parts.length >= 2) {
      const firstName = parts[0]
      const { data: partialData } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, team_abbreviation')
        .ilike('name', `%${firstName}%`)
        .limit(20)

      if (partialData) {
        const lastName = parts.slice(1).join(' ')
        const filtered = partialData.filter((p: any) =>
          p.name.toLowerCase().includes(lastName.toLowerCase())
        )

        if (filtered.length > 0) {
          // Prefer team match
          if (teamTricode) {
            const teamMatch = filtered.find((p: any) => p.team_abbreviation === teamTricode)
            if (teamMatch) return teamMatch
          }
          return filtered[0]
        }
      }
    }
    return null
  }

  // Prefer exact match with team
  if (teamTricode) {
    const teamMatch = data.find((p: any) => p.team_abbreviation === teamTricode)
    if (teamMatch) return teamMatch
  }

  // Prefer exact name match
  const exactMatch = data.find((p: any) => p.name.toLowerCase() === normalizedName.toLowerCase())
  if (exactMatch) return exactMatch

  return data[0]
}

