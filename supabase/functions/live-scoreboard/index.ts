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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Get query parameters
    const url = new URL(req.url)
    const gameDate = url.searchParams.get('gameDate')
    const dayOffset = url.searchParams.get('dayOffset') || '0'

    // Fetch NBA data from external API
    const nbaData = await fetchNBAScoreboard(gameDate, parseInt(dayOffset))

    if (!nbaData) {
      const fallbackData = await getFallbackScoreboardData(supabaseClient, gameDate)
      return new Response(
        JSON.stringify({ ...fallbackData, source: 'fallback' }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
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
    const baseUrl = 'https://stats.nba.com/stats/scoreboardv2'
    const params = new URLSearchParams({
      DayOffset: String(dayOffset),
      GameDate: gameDate || new Date().toISOString().split('T')[0],
      LeagueID: '00',
    })
    const requestUrl = `${baseUrl}?${params.toString()}`
    
    console.log('🏀 NBA ScoreboardV2 Request:', {
      gameDate,
      dayOffset,
      url: requestUrl
    })

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // keep request responsive, then use fallback

    const response = await fetch(requestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NBA ScoreboardV2 responded with status: ${response.status}`)
    }

    const data = await response.json()
    
    console.log('🏀 NBA ScoreboardV2 Response:', {
      status: response.status,
      hasData: !!data,
      hasResultSets: Array.isArray(data?.resultSets),
      resultSetsCount: data?.resultSets?.length || 0
    })
    
    // Transform NBA ScoreboardV2 response to our format
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
    // Return null so caller can serve fallback instead of HTTP 500.
    return null
  }
}

function transformLiveScoreboardData(apiData: any, gameDate?: string) {
  try {
    const resultSets = apiData?.resultSets
    if (!Array.isArray(resultSets)) {
      throw new Error('No resultSets found in ScoreboardV2 response')
    }

    const gameHeader = resultSets.find((rs: any) => rs?.name === 'GameHeader')
    const lineScore = resultSets.find((rs: any) => rs?.name === 'LineScore')
    const eastStandings = resultSets.find((rs: any) => rs?.name === 'EastConfStandingsByDay')
    const westStandings = resultSets.find((rs: any) => rs?.name === 'WestConfStandingsByDay')

    if (!gameHeader?.rowSet || !lineScore?.rowSet) {
      throw new Error('Required ScoreboardV2 datasets (GameHeader/LineScore) are missing')
    }

    const games = gameHeader.rowSet
      .map((row: any[]) => {
        const gameId = String(row[2] ?? '')
        const gameDateEstRaw = row[0]
        const gameStatus = Number(row[3] ?? 1)
        const gameStatusText = String(row[4] ?? 'Scheduled')
        const homeTeamId = Number(row[6] ?? 0)
        const awayTeamId = Number(row[7] ?? 0)
        const livePeriod = row[9] != null ? Number(row[9]) : undefined
        const liveTime = row[10] != null ? String(row[10]) : undefined
        const nationalTV = row[11] != null ? String(row[11]) : null
        const arenaName = row[15] != null ? String(row[15]) : 'Unknown Arena'

        const gameLineScores = lineScore.rowSet.filter((ls: any[]) => String(ls[2]) === gameId)
        const homeTeamData = gameLineScores.find((ls: any[]) => Number(ls[3]) === homeTeamId)
        const awayTeamData = gameLineScores.find((ls: any[]) => Number(ls[3]) === awayTeamId)

        if (!homeTeamData || !awayTeamData) return null

        const parseWinsLosses = (winsLosses: unknown): { wins: number; losses: number } => {
          const raw = String(winsLosses ?? '')
          const [winsRaw, lossesRaw] = raw.split('-')
          const wins = Number.parseInt(winsRaw ?? '0', 10)
          const losses = Number.parseInt(lossesRaw ?? '0', 10)
          return {
            wins: Number.isFinite(wins) ? wins : 0,
            losses: Number.isFinite(losses) ? losses : 0,
          }
        }

        const homeRecord = parseWinsLosses(homeTeamData[7])
        const awayRecord = parseWinsLosses(awayTeamData[7])
        const normalizedGameDate =
          typeof gameDateEstRaw === 'string' && gameDateEstRaw.includes('T')
            ? gameDateEstRaw.split('T')[0]
            : (String(gameDateEstRaw || gameDate || new Date().toISOString().split('T')[0]))

        return {
          gameId,
          gameDate: normalizedGameDate,
          gameStatus,
          gameStatusText,
          homeTeam: {
            id: homeTeamId,
            abbreviation: String(homeTeamData[4] ?? ''),
            city: String(homeTeamData[5] ?? ''),
            name: String(homeTeamData[6] ?? ''),
            wins: homeRecord.wins,
            losses: homeRecord.losses,
            points: Number(homeTeamData[22] ?? 0),
            quarters: [
              Number(homeTeamData[8] ?? 0),
              Number(homeTeamData[9] ?? 0),
              Number(homeTeamData[10] ?? 0),
              Number(homeTeamData[11] ?? 0),
            ],
          },
          awayTeam: {
            id: awayTeamId,
            abbreviation: String(awayTeamData[4] ?? ''),
            city: String(awayTeamData[5] ?? ''),
            name: String(awayTeamData[6] ?? ''),
            wins: awayRecord.wins,
            losses: awayRecord.losses,
            points: Number(awayTeamData[22] ?? 0),
            quarters: [
              Number(awayTeamData[8] ?? 0),
              Number(awayTeamData[9] ?? 0),
              Number(awayTeamData[10] ?? 0),
              Number(awayTeamData[11] ?? 0),
            ],
          },
          arena: arenaName,
          livePeriod,
          liveTime,
          nationalTV,
        }
      })
      .filter(Boolean)

    return {
      games,
      eastStandings: eastStandings?.rowSet ?? [],
      westStandings: westStandings?.rowSet ?? [],
      lastUpdated: new Date().toISOString(),
      gameDate: gameDate || new Date().toISOString().split('T')[0],
    }

  } catch (error) {
    console.error('Error transforming live scoreboard data:', error)
    throw error
  }
}

// Note: No mock fallback. Fail fast so clients can handle errors explicitly.

async function getFallbackScoreboardData(supabase: any, gameDate?: string) {
  const dateKey = gameDate || new Date().toISOString().split('T')[0]
  try {
    const { data: cachedRows } = await supabase
      .from('scoreboard_cache')
      .select('data, updated_at')
      .eq('game_date', dateKey)
      .order('updated_at', { ascending: false })
      .limit(1)

    const cached = cachedRows?.[0]?.data
    if (cached && Array.isArray(cached.games)) {
      return {
        ...cached,
        gameDate: cached.gameDate || dateKey,
        lastUpdated: cached.lastUpdated || cachedRows?.[0]?.updated_at || new Date().toISOString(),
      }
    }
  } catch (error) {
    console.error('Error reading fallback scoreboard cache:', error)
  }

  try {
    const getESTDateKey = (value: string | Date): string => {
      const date = value instanceof Date ? value : new Date(value)
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date)
      const year = parts.find((p) => p.type === 'year')?.value
      const month = parts.find((p) => p.type === 'month')?.value
      const day = parts.find((p) => p.type === 'day')?.value
      return `${year}-${month}-${day}`
    }

    // Fetch a two-day UTC window, then filter by EST date.
    const startUtc = `${dateKey}T00:00:00Z`
    const endUtcDate = new Date(`${dateKey}T00:00:00Z`)
    endUtcDate.setUTCDate(endUtcDate.getUTCDate() + 2)
    const endUtc = endUtcDate.toISOString().slice(0, 19) + 'Z'

    const { data: dbGames } = await supabase
      .from('nba_games')
      .select(`
        game_id,
        game_date,
        game_status,
        game_status_text,
        home_team_tricode,
        away_team_tricode,
        home_team_name,
        away_team_name,
        home_team_score,
        away_team_score
      `)
      .gte('game_date', startUtc)
      .lt('game_date', endUtc)

    if (Array.isArray(dbGames) && dbGames.length > 0) {
      const games = dbGames
        .filter((g: any) => getESTDateKey(g?.game_date) === dateKey)
        .filter((g: any) => g?.game_id && g?.home_team_tricode && g?.away_team_tricode)
        .map((g: any) => ({
          gameId: String(g.game_id),
          gameDate: dateKey,
          gameStatus: Number(g.game_status ?? 1),
          gameStatusText: String(g.game_status_text ?? 'Scheduled'),
          homeTeam: {
            id: 0,
            abbreviation: String(g.home_team_tricode ?? ''),
            city: '',
            name: String(g.home_team_name ?? g.home_team_tricode ?? ''),
            wins: 0,
            losses: 0,
            points: Number(g.home_team_score ?? 0),
            quarters: [0, 0, 0, 0],
          },
          awayTeam: {
            id: 0,
            abbreviation: String(g.away_team_tricode ?? ''),
            city: '',
            name: String(g.away_team_name ?? g.away_team_tricode ?? ''),
            wins: 0,
            losses: 0,
            points: Number(g.away_team_score ?? 0),
            quarters: [0, 0, 0, 0],
          },
          arena: '',
          livePeriod: undefined,
          liveTime: undefined,
          nationalTV: null,
        }))

      return {
        games,
        eastStandings: [],
        westStandings: [],
        lastUpdated: new Date().toISOString(),
        gameDate: dateKey,
      }
    }
  } catch (error) {
    console.error('Error building fallback scoreboard from nba_games:', error)
  }

  return {
    games: [],
    eastStandings: [],
    westStandings: [],
    lastUpdated: new Date().toISOString(),
    gameDate: dateKey,
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
