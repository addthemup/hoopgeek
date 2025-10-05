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
      JSON.stringify(nbaData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in live-scoreboard function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function fetchNBAScoreboard(gameDate?: string, dayOffset: number = 0) {
  // For now, return mock data immediately since NBA API is having issues
  // TODO: Fix NBA API integration later
  console.log('Using mock NBA data for now - NBA API integration pending')
  return getMockScoreboardData(gameDate)
  
  /* NBA API code - commented out until we fix the timeout issues
  try {
    // Build NBA API URL
    const baseUrl = 'https://stats.nba.com/stats/scoreboardv2'
    const params = new URLSearchParams({
      'DayOffset': dayOffset.toString(),
      'LeagueID': '00',
      'gameDate': gameDate || new Date().toISOString().split('T')[0]
    })

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${baseUrl}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()
    
    // Transform NBA API response to our format
    return transformScoreboardData(data, gameDate)

  } catch (error) {
    console.error('Error fetching NBA data:', error)
    // Return mock data as fallback
    return getMockScoreboardData(gameDate)
  }
  */
}

function transformScoreboardData(apiData: any, gameDate?: string) {
  try {
    const { resultSets } = apiData
    
    // Find the GameHeader result set
    const gameHeaderIndex = resultSets.findIndex((rs: any) => rs.name === 'GameHeader')
    const lineScoreIndex = resultSets.findIndex((rs: any) => rs.name === 'LineScore')
    
    if (gameHeaderIndex === -1 || lineScoreIndex === -1) {
      throw new Error('Required data sets not found')
    }

    const gameHeaders = resultSets[gameHeaderIndex].rowSet
    const lineScores = resultSets[lineScoreIndex].rowSet

    const games = gameHeaders.map((game: any[]) => {
      const gameId = game[2] // GAME_ID
      const gameDate = game[0] // GAME_DATE_EST
      const gameStatus = game[3] // GAME_STATUS_ID
      const gameStatusText = game[4] // GAME_STATUS_TEXT
      const homeTeamId = game[6] // HOME_TEAM_ID
      const awayTeamId = game[7] // VISITOR_TEAM_ID
      const arena = game[16] // ARENA_NAME
      const nationalTV = game[11] // NATL_TV_BROADCASTER_ABBREVIATION

      // Find team data in line scores
      const homeTeamData = lineScores.find((ls: any[]) => ls[3] === homeTeamId)
      const awayTeamData = lineScores.find((ls: any[]) => ls[3] === awayTeamId)

      if (!homeTeamData || !awayTeamData) {
        return null
      }

      return {
        gameId: gameId.toString(),
        gameDate,
        gameStatus,
        gameStatusText,
        homeTeam: {
          id: homeTeamId,
          abbreviation: homeTeamData[4], // TEAM_ABBREVIATION
          city: homeTeamData[5], // TEAM_CITY_NAME
          name: homeTeamData[6], // TEAM_NAME
          wins: parseInt(homeTeamData[7]?.split('-')[0] || '0'),
          losses: parseInt(homeTeamData[7]?.split('-')[1] || '0'),
          points: homeTeamData[23] || 0, // PTS
          quarters: [
            homeTeamData[8] || 0,  // PTS_QTR1
            homeTeamData[9] || 0,  // PTS_QTR2
            homeTeamData[10] || 0, // PTS_QTR3
            homeTeamData[11] || 0  // PTS_QTR4
          ]
        },
        awayTeam: {
          id: awayTeamId,
          abbreviation: awayTeamData[4],
          city: awayTeamData[5],
          name: awayTeamData[6],
          wins: parseInt(awayTeamData[7]?.split('-')[0] || '0'),
          losses: parseInt(awayTeamData[7]?.split('-')[1] || '0'),
          points: awayTeamData[23] || 0,
          quarters: [
            awayTeamData[8] || 0,
            awayTeamData[9] || 0,
            awayTeamData[10] || 0,
            awayTeamData[11] || 0
          ]
        },
        arena: arena || 'Unknown Arena',
        nationalTV: nationalTV || null
      }
    }).filter(Boolean)

    return {
      games,
      eastStandings: [],
      westStandings: [],
      lastUpdated: new Date().toISOString(),
      gameDate: gameHeaders[0]?.[0] || new Date().toISOString().split('T')[0]
    }

  } catch (error) {
    console.error('Error transforming scoreboard data:', error)
    throw error
  }
}

function getMockScoreboardData(gameDate?: string) {
  return {
    games: [
      {
        gameId: "0022500001",
        gameDate: gameDate || new Date().toISOString().split('T')[0],
        gameStatus: 1,
        gameStatusText: "5:30 AM ET",
        homeTeam: {
          id: 1610612740,
          abbreviation: "NOP",
          city: "New Orleans",
          name: "Pelicans",
          wins: 0,
          losses: 0,
          points: 0,
          quarters: []
        },
        awayTeam: {
          id: 15016,
          abbreviation: "MEL",
          city: "Melbourne",
          name: "United",
          wins: 0,
          losses: 0,
          points: 0,
          quarters: []
        },
        arena: "Smoothie King Center",
        nationalTV: null
      },
      {
        gameId: "0022500002",
        gameDate: gameDate || new Date().toISOString().split('T')[0],
        gameStatus: 1,
        gameStatusText: "10:00 PM ET",
        homeTeam: {
          id: 1610612747,
          abbreviation: "LAL",
          city: "Los Angeles",
          name: "Lakers",
          wins: 0,
          losses: 0,
          points: 0,
          quarters: []
        },
        awayTeam: {
          id: 1610612756,
          abbreviation: "PHX",
          city: "Phoenix",
          name: "Suns",
          wins: 0,
          losses: 0,
          points: 0,
          quarters: []
        },
        arena: "Crypto.com Arena",
        nationalTV: null
      }
    ],
    eastStandings: [],
    westStandings: [],
    lastUpdated: new Date().toISOString(),
    gameDate: gameDate || new Date().toISOString().split('T')[0]
  }
}

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
