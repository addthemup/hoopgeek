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
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Get query parameters
    const url = new URL(req.url)
    const gameDate = url.searchParams.get('gameDate')
    const dayOffset = url.searchParams.get('dayOffset') || '0'

    // Fetch NBA data from external API
    const nbaData = await fetchNBAScoreboard(gameDate, parseInt(dayOffset))

    if (!nbaData) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch NBA data' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Store in database for caching (optional)
    if (nbaData.games.length > 0) {
      await cacheScoreboardData(supabaseClient, nbaData)
    }

    return new Response(
      JSON.stringify({ ...nbaData, source: 'nba' }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          // Avoid CDN/browser caching stale scoreboard
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        } 
      }
    )

  } catch (error) {
    console.error('Error in live-scoreboard function:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function fetchNBAScoreboard(gameDate?: string, dayOffset: number = 0) {
  try {
    // Use NBA Live API which is more reliable
    const baseUrl = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json'
    
    console.log('🏀 NBA Live API Request:', {
      gameDate,
      dayOffset,
      url: baseUrl
    })

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NBA Live API responded with status: ${response.status}`)
    }

    const data = await response.json()
    
    console.log('🏀 NBA Live API Response:', {
      status: response.status,
      hasData: !!data,
      gamesCount: data?.scoreboard?.games?.length || 0,
      gameDate: data?.scoreboard?.gameDate
    })
    
    // Transform NBA Live API response to our format
    const transformedData = transformLiveScoreboardData(data, gameDate)
    console.log('🏀 Transformed Data:', {
      gamesCount: transformedData.games.length,
      gameDate: transformedData.gameDate,
      firstGame: transformedData.games[0] ? {
        gameId: transformedData.games[0].gameId,
        homeTeam: transformedData.games[0].homeTeam.name,
        awayTeam: transformedData.games[0].awayTeam.name,
        status: transformedData.games[0].gameStatusText
      } : null
    })
    
    return transformedData

  } catch (error) {
    console.error('❌ Error fetching NBA data:', error)
    // Surface the error up so caller can handle it; do NOT return mock
    throw error
  }
}

// NBA API requires MM/DD/YYYY. If no date is provided, default to current date in ET.
function formatNBAApiDate(isoDate?: string): string {
  try {
    if (isoDate) {
      // Handle formats like YYYY-MM-DD
      const parts = isoDate.split('-')
      if (parts.length === 3) {
        const [y, m, d] = parts
        return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`
      }
    }

    // Default: today's date in America/New_York (NBA uses ET)
    const nowET = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    )
    const month = nowET.getMonth() + 1
    const day = nowET.getDate()
    const year = nowET.getFullYear()
    return `${month}/${day}/${year}`
  } catch (_) {
    // Fallback to UTC today if any error
    const now = new Date()
    const month = now.getUTCMonth() + 1
    const day = now.getUTCDate()
    const year = now.getUTCFullYear()
    return `${month}/${day}/${year}`
  }
}

function transformLiveScoreboardData(apiData: any, gameDate?: string) {
  try {
    const { scoreboard } = apiData
    
    if (!scoreboard || !scoreboard.games) {
      throw new Error('No games data found in scoreboard')
    }

    const games = scoreboard.games.map((game: any) => {
      const { gameId, gameTimeUTC, gameStatus, gameStatusText, homeTeam, awayTeam, arena } = game

      return {
        gameId: gameId.toString(),
        gameDate: gameTimeUTC ? gameTimeUTC.split('T')[0] : new Date().toISOString().split('T')[0],
        gameStatus: gameStatus || 1,
        gameStatusText: gameStatusText || 'Scheduled',
        homeTeam: {
          id: homeTeam.teamId,
          abbreviation: homeTeam.teamTricode,
          city: homeTeam.teamCity,
          name: homeTeam.teamName,
          wins: homeTeam.wins || 0,
          losses: homeTeam.losses || 0,
          points: homeTeam.score || 0,
          quarters: homeTeam.periods ? homeTeam.periods.map((p: any) => p.score || 0) : [0, 0, 0, 0]
        },
        awayTeam: {
          id: awayTeam.teamId,
          abbreviation: awayTeam.teamTricode,
          city: awayTeam.teamCity,
          name: awayTeam.teamName,
          wins: awayTeam.wins || 0,
          losses: awayTeam.losses || 0,
          points: awayTeam.score || 0,
          quarters: awayTeam.periods ? awayTeam.periods.map((p: any) => p.score || 0) : [0, 0, 0, 0]
        },
        arena: arena?.arenaName || 'Unknown Arena',
        nationalTV: null // NBA Live API doesn't provide this
      }
    })

    return {
      games,
      eastStandings: [],
      westStandings: [],
      lastUpdated: new Date().toISOString(),
      gameDate: scoreboard.gameDate || new Date().toISOString().split('T')[0]
    }

  } catch (error) {
    console.error('Error transforming live scoreboard data:', error)
    throw error
  }
}

// Note: No mock fallback. Fail fast so clients can handle errors explicitly.

async function cacheScoreboardData(supabase: any, data: any) {
  try {
    // Store scoreboard data in database for caching
    const { error } = await supabase
      .from('scoreboard_cache')
      .upsert({
        game_date: data.gameDate,
        data: data,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error caching scoreboard data:', error)
    }
  } catch (error) {
    console.error('Error in cache function:', error)
  }
}
