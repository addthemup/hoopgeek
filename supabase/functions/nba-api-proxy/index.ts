import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    // Prefer POST body (supabase.functions.invoke sends JSON body), fallback to query params
    const url = new URL(req.url)
    let endpoint = url.searchParams.get('endpoint') || 'scoreboard'
    let gameDate = url.searchParams.get('gameDate')
    let dayOffset = url.searchParams.get('dayOffset') || '0'
    let teamId = url.searchParams.get('teamId')
    let season = url.searchParams.get('season') || new Date().getFullYear().toString()
    let playerId = url.searchParams.get('playerId')

    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = (await req.json()) as Record<string, unknown>
        if (body?.endpoint != null) endpoint = String(body.endpoint)
        if (body?.gameDate != null) gameDate = String(body.gameDate)
        if (body?.dayOffset != null) dayOffset = String(body.dayOffset)
        if (body?.teamId != null) teamId = String(body.teamId)
        if (body?.season != null) season = String(body.season)
        if (body?.playerId != null) playerId = String(body.playerId)
      } catch (_) {
        // ignore body parse errors, use query params
      }
    }

    let nbaData

    switch (endpoint) {
      case 'scoreboard':
        nbaData = await fetchScoreboard(gameDate, parseInt(dayOffset))
        break
      case 'standings':
        nbaData = await fetchStandings()
        break
      case 'player-stats':
        nbaData = await fetchPlayerStats(playerId)
        break
      case 'team-rebound-dashboard': {
        if (!teamId) {
          return new Response(
            JSON.stringify({ error: 'teamId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        try {
          nbaData = await fetchTeamReboundDashboard(parseInt(teamId), season)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch team rebounding data'
          return new Response(
            JSON.stringify({ ok: false, error: msg }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break
      }
      case 'team-gamelogs': {
        if (!teamId) {
          return new Response(
            JSON.stringify({ error: 'teamId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        try {
          nbaData = await fetchTeamGameLogs(parseInt(teamId), season)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch team game logs'
          return new Response(
            JSON.stringify({ ok: false, error: msg }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break
      }
      case 'team-dashptshots': {
        if (!teamId) {
          return new Response(
            JSON.stringify({ error: 'teamId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        try {
          nbaData = await fetchTeamDashPtShots(parseInt(teamId), season)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch team shot dashboard'
          return new Response(
            JSON.stringify({ ok: false, error: msg }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break
      }
      case 'team-estimated-metrics': {
        try {
          nbaData = await fetchTeamEstimatedMetrics(season)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch team estimated metrics'
          return new Response(
            JSON.stringify({ ok: false, error: msg }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break
      }
      case 'team-player-dashboard': {
        if (!teamId) {
          return new Response(
            JSON.stringify({ error: 'teamId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        try {
          nbaData = await fetchTeamPlayerDashboard(parseInt(teamId), season)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch team player dashboard'
          return new Response(
            JSON.stringify({ ok: false, error: msg }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        break
      }
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid endpoint' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

    if (!nbaData) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch NBA data' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify(nbaData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Error in nba-api-proxy function:', error)
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function fetchScoreboard(gameDate?: string, dayOffset: number = 0) {
  try {
    // Build NBA API URL
    const baseUrl = 'https://stats.nba.com/stats/scoreboardv2'
    const params = new URLSearchParams({
      'DayOffset': dayOffset.toString(),
      'LeagueID': '00',
      'gameDate': gameDate || new Date().toISOString().split('T')[0]
    })

    const response = await fetch(`${baseUrl}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com'
      }
    })

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()
    
    // Transform NBA API response to our format
    return transformScoreboardData(data)

  } catch (error) {
    console.error('Error fetching scoreboard:', error)
    // Return mock data as fallback
    return getMockScoreboardData(gameDate)
  }
}

const NBA_FETCH_TIMEOUT_MS = 55_000

async function fetchTeamReboundDashboard(teamId: number, season: string) {
  try {
    const baseUrl = 'https://stats.nba.com/stats/teamdashptreb'
    
    const params = new URLSearchParams({
      TeamID: teamId.toString(),
      Season: season,
      SeasonType: 'Regular Season',
      PerMode: 'PerGame',
      LeagueID: '00',
      Month: '0',
      OpponentTeamID: '0',
      Period: '0',
      LastNGames: '0',
      DateFrom: '',
      DateTo: '',
      GameSegment: '',
      Location: '',
      Outcome: '',
      SeasonSegment: '',
      VsConference: '',
      VsDivision: '',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), NBA_FETCH_TIMEOUT_MS)

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return {
      teamId,
      season,
      raw: data,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = message.includes('abort') || message.includes('timeout')
    console.error('Error fetching team rebound dashboard:', error)
    throw new Error(isTimeout ? 'NBA API request timed out' : message)
  }
}

async function fetchTeamGameLogs(teamId: number, season: string) {
  try {
    const baseUrl = 'https://stats.nba.com/stats/teamgamelogs'
    const params = new URLSearchParams({
      TeamID: teamId.toString(),
      Season: season,
      SeasonType: 'Regular Season',
      PerMode: 'Totals',
      LeagueID: '00',
      DateFrom: '',
      DateTo: '',
      GameSegment: '',
      LastNGames: '0',
      Location: '',
      Month: '0',
      Outcome: '',
      Period: '0',
      SeasonSegment: '',
      VsConference: '',
      VsDivision: '',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), NBA_FETCH_TIMEOUT_MS)

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return {
      teamId,
      season,
      raw: data,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = message.includes('abort') || message.includes('timeout')
    console.error('Error fetching team game logs:', error)
    throw new Error(isTimeout ? 'NBA API request timed out' : message)
  }
}

async function fetchTeamDashPtShots(teamId: number, season: string) {
  try {
    const baseUrl = 'https://stats.nba.com/stats/teamdashptshots'
    const params = new URLSearchParams({
      TeamID: teamId.toString(),
      Season: season,
      SeasonType: 'Regular Season',
      PerMode: 'PerGame',
      LeagueID: '00',
      Month: '0',
      OpponentTeamID: '0',
      Period: '0',
      LastNGames: '0',
      DateFrom: '',
      DateTo: '',
      GameSegment: '',
      Location: '',
      Outcome: '',
      SeasonSegment: '',
      VsConference: '',
      VsDivision: '',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), NBA_FETCH_TIMEOUT_MS)

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return {
      teamId,
      season,
      raw: data,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = message.includes('abort') || message.includes('timeout')
    console.error('Error fetching team dash pt shots:', error)
    throw new Error(isTimeout ? 'NBA API request timed out' : message)
  }
}

async function fetchTeamEstimatedMetrics(season: string) {
  try {
    const baseUrl = 'https://stats.nba.com/stats/teamestimatedmetrics'
    const params = new URLSearchParams({
      LeagueID: '00',
      Season: season,
      SeasonType: 'Regular Season',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), NBA_FETCH_TIMEOUT_MS)

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return {
      season,
      raw: data,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = message.includes('abort') || message.includes('timeout')
    console.error('Error fetching team estimated metrics:', error)
    throw new Error(isTimeout ? 'NBA API request timed out' : message)
  }
}

async function fetchTeamPlayerDashboard(teamId: number, season: string) {
  try {
    const baseUrl = 'https://stats.nba.com/stats/teamplayerdashboard'
    const params = new URLSearchParams({
      TeamID: teamId.toString(),
      Season: season,
      SeasonType: 'Regular Season',
      LeagueID: '00',
      LastNGames: '0',
      MeasureType: 'Base',
      Month: '0',
      OpponentTeamID: '0',
      PaceAdjust: 'N',
      PerMode: 'Totals',
      Period: '0',
      PlusMinus: 'N',
      Rank: 'N',
      DateFrom: '',
      DateTo: '',
      GameSegment: '',
      Location: '',
      Outcome: '',
      PORound: '0',
      SeasonSegment: '',
      ShotClockRange: '',
      VsConference: '',
      VsDivision: '',
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), NBA_FETCH_TIMEOUT_MS)

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return {
      teamId,
      season,
      raw: data,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = message.includes('abort') || message.includes('timeout')
    console.error('Error fetching team player dashboard:', error)
    throw new Error(isTimeout ? 'NBA API request timed out' : message)
  }
}

function transformScoreboardData(apiData: any) {
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
        gameStatus: 2,
        gameStatusText: "Live",
        homeTeam: {
          id: 1610612747,
          abbreviation: "LAL",
          city: "Los Angeles",
          name: "Lakers",
          wins: 2,
          losses: 1,
          points: 98,
          quarters: [28, 25, 22, 23]
        },
        awayTeam: {
          id: 1610612744,
          abbreviation: "GSW",
          city: "Golden State",
          name: "Warriors",
          wins: 1,
          losses: 2,
          points: 95,
          quarters: [24, 26, 20, 25]
        },
        arena: "Crypto.com Arena",
        livePeriod: 4,
        liveTime: "2:34",
        nationalTV: "ESPN"
      }
    ],
    eastStandings: [],
    westStandings: [],
    lastUpdated: new Date().toISOString(),
    gameDate: gameDate || new Date().toISOString().split('T')[0]
  }
}

async function fetchStandings() {
  // Implementation for standings endpoint
  return { message: 'Standings endpoint not implemented yet' }
}

async function fetchPlayerStats(playerId: string) {
  // Implementation for player stats endpoint
  return { message: 'Player stats endpoint not implemented yet' }
}
