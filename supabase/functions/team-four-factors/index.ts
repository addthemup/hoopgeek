import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get query parameters
    const url = new URL(req.url)
    const teamId = url.searchParams.get('teamId')
    const season = url.searchParams.get('season') || getCurrentSeason()
    const seasonType = url.searchParams.get('seasonType') || 'Regular Season'
    const perMode = url.searchParams.get('perMode') || 'PerGame'

    if (!teamId) {
      return new Response(
        JSON.stringify({ error: 'teamId parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`🏀 Fetching four factors for team ${teamId}, season ${season}`)

    // Fetch team four factors from NBA API
    const fourFactorsData = await fetchTeamFourFactors(teamId, season, seasonType, perMode)

    return new Response(
      JSON.stringify(fourFactorsData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in team-four-factors function:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function getCurrentSeason(): string {
  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  
  // NBA season starts in October
  if (month >= 10) {
    return `${year}-${(year + 1).toString().slice(-2)}`
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`
  }
}

async function fetchTeamFourFactors(teamId: string, season: string, seasonType: string, perMode: string) {
  try {
    // Use leaguedashteamstats endpoint with Four Factors measure type
    const baseUrl = 'https://stats.nba.com/stats/leaguedashteamstats'
    const params = new URLSearchParams({
      'MeasureType': 'Four Factors',
      'PerMode': perMode,
      'PlusMinus': 'N',
      'PaceAdjust': 'N',
      'Rank': 'N',
      'LeagueID': '00',
      'Season': season,
      'SeasonType': seasonType,
      'TeamID': teamId,
      'Outcome': '',
      'Location': '',
      'Month': '0',
      'SeasonSegment': '',
      'DateFrom': '',
      'DateTo': '',
      'OpponentTeamID': '0',
      'VsConference': '',
      'VsDivision': '',
      'GameSegment': '',
      'Period': '0',
      'LastNGames': '0'
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(`${baseUrl}?${params}`, {
      headers: NBA_HEADERS,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()

    if (!data.resultSets || data.resultSets.length === 0) {
      throw new Error('No data returned from NBA API')
    }

    // Find the LeagueDashTeamStats result set
    const statsSet = data.resultSets.find((rs: any) => rs.name === 'LeagueDashTeamStats')
    
    if (!statsSet || !statsSet.rowSet || statsSet.rowSet.length === 0) {
      throw new Error('No team stats found')
    }

    const headers = statsSet.headers
    const row = statsSet.rowSet[0] // Should only be one team

    // Map headers to indices
    const headerMap: Record<string, number> = {}
    headers.forEach((header: string, index: number) => {
      headerMap[header] = index
    })

    // Extract four factors data
    const fourFactors = {
      teamId: parseInt(teamId),
      teamName: row[headerMap['TEAM_NAME']] || '',
      teamAbbreviation: row[headerMap['TEAM_ABBREVIATION']] || '',
      gamesPlayed: row[headerMap['GP']] || 0,
      // Offensive Four Factors
      effectiveFieldGoalPercentage: row[headerMap['EFG_PCT']] || 0,
      freeThrowAttemptRate: row[headerMap['FTA_RATE']] || 0,
      turnoverPercentage: row[headerMap['TM_TOV_PCT']] || 0,
      offensiveReboundPercentage: row[headerMap['OREB_PCT']] || 0,
      // Defensive Four Factors (opponent stats)
      oppEffectiveFieldGoalPercentage: row[headerMap['OPP_EFG_PCT']] || 0,
      oppFreeThrowAttemptRate: row[headerMap['OPP_FTA_RATE']] || 0,
      oppTurnoverPercentage: row[headerMap['OPP_TOV_PCT']] || 0,
      oppOffensiveReboundPercentage: row[headerMap['OPP_OREB_PCT']] || 0,
      season,
      seasonType,
      perMode
    }

    console.log(`✅ Successfully fetched four factors for team ${teamId}`)
    return fourFactors

  } catch (error) {
    console.error('❌ Error fetching team four factors:', error)
    throw error
  }
}
