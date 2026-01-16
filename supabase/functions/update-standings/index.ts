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
    // Initialize Supabase client with service role for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('🏀 Fetching NBA standings...')

    // Fetch standings from NBA API
    const standingsData = await fetchStandings()
    
    if (!standingsData || !standingsData.east || !standingsData.west) {
      throw new Error('Failed to fetch standings data')
    }

    // Get current season (e.g., "2024-25")
    const currentDate = new Date()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    // NBA season starts in October, so if month >= 10, season is year-year+1, else year-1-year
    const season = month >= 10 
      ? `${year}-${(year + 1).toString().slice(-2)}`
      : `${year - 1}-${year.toString().slice(-2)}`

    console.log(`📅 Season: ${season}`)
    console.log(`📊 East teams: ${standingsData.east.length}, West teams: ${standingsData.west.length}`)

    // Combine east and west standings
    const allStandings = [...standingsData.east, ...standingsData.west]

    // Delete existing standings for this season
    const { error: deleteError } = await supabaseAdmin
      .from('nba_standings')
      .delete()
      .eq('season', season)

    if (deleteError) {
      console.error('Error deleting old standings:', deleteError)
      throw deleteError
    }

    // Insert new standings
    const standingsToInsert = allStandings.map(team => ({
      team_id: team.teamId,
      team_abbreviation: team.teamAbbreviation,
      team_name: team.teamName,
      conference: team.conference,
      wins: team.wins,
      losses: team.losses,
      win_percentage: team.winPercentage,
      games_behind: team.gamesBehind || 0.0,
      conference_rank: team.conferenceRank,
      division: team.division || null,
      division_rank: team.divisionRank || null,
      home_wins: team.homeWins || 0,
      home_losses: team.homeLosses || 0,
      away_wins: team.awayWins || 0,
      away_losses: team.awayLosses || 0,
      last_10_wins: team.last10Wins || 0,
      last_10_losses: team.last10Losses || 0,
      streak: team.streak || null,
      season: season,
      updated_at: new Date().toISOString(),
    }))

    const { error: insertError } = await supabaseAdmin
      .from('nba_standings')
      .insert(standingsToInsert)

    if (insertError) {
      console.error('Error inserting standings:', insertError)
      throw insertError
    }

    console.log(`✅ Successfully updated ${standingsToInsert.length} team standings`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${standingsToInsert.length} team standings`,
        season,
        eastCount: standingsData.east.length,
        westCount: standingsData.west.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error updating standings:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function fetchStandings() {
  try {
    // Get current season
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const season = month >= 10 
      ? `${year}-${(year + 1).toString().slice(-2)}`
      : `${year - 1}-${year.toString().slice(-2)}`;

    // Use NBA.com standings endpoint
    const url = `https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=${season}&SeasonType=Regular%20Season`
    
    console.log(`🏀 Fetching standings for season: ${season}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com'
      }
    })

    if (!response.ok) {
      throw new Error(`NBA API responded with status: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.resultSets || data.resultSets.length === 0) {
      throw new Error('No standings data in response')
    }

    const standings = data.resultSets[0].rowSet
    const headers = data.resultSets[0].headers

    // Map headers to indices
    const headerMap: Record<string, number> = {}
    headers.forEach((header: string, index: number) => {
      headerMap[header] = index
    })

    // Team ID to abbreviation mapping (NBA team IDs)
    const teamIdToAbbr: Record<number, string> = {
      1610612737: 'ATL', 1610612738: 'BOS', 1610612751: 'BKN', 1610612766: 'CHA',
      1610612741: 'CHI', 1610612739: 'CLE', 1610612742: 'DAL', 1610612743: 'DEN',
      1610612765: 'DET', 1610612744: 'GSW', 1610612745: 'HOU', 1610612754: 'IND',
      1610612746: 'LAC', 1610612747: 'LAL', 1610612763: 'MEM', 1610612748: 'MIA',
      1610612749: 'MIL', 1610612750: 'MIN', 1610612740: 'NOP', 1610612752: 'NYK',
      1610612760: 'OKC', 1610612753: 'ORL', 1610612755: 'PHI', 1610612756: 'PHX',
      1610612757: 'POR', 1610612758: 'SAC', 1610612759: 'SAS', 1610612761: 'TOR',
      1610612762: 'UTA', 1610612764: 'WAS'
    }

    // Process standings
    const eastStandings: any[] = []
    const westStandings: any[] = []

    standings.forEach((row: any[]) => {
      const teamId = row[headerMap['TeamID']]
      const teamAbbreviation = teamIdToAbbr[teamId] || 'UNK'
      const teamName = row[headerMap['TeamName']] || ''
      const conference = row[headerMap['Conference']] || ''
      const wins = row[headerMap['WINS']] || 0
      const losses = row[headerMap['LOSSES']] || 0
      const winPercentage = row[headerMap['WinPCT']] || 0
      const gamesBehind = row[headerMap['ConferenceGamesBack']] || 0
      const conferenceRank = row[headerMap['ConferenceRank']] || 0
      const division = row[headerMap['Division']] || ''
      const divisionRank = row[headerMap['DivisionRank']] || null
      const homeWins = row[headerMap['HOME']]?.split('-')[0] || 0
      const homeLosses = row[headerMap['HOME']]?.split('-')[1] || 0
      const awayWins = row[headerMap['ROAD']]?.split('-')[0] || 0
      const awayLosses = row[headerMap['ROAD']]?.split('-')[1] || 0
      const last10 = row[headerMap['L10']] || '0-0'
      const last10Wins = parseInt(last10.split('-')[0]) || 0
      const last10Losses = parseInt(last10.split('-')[1]) || 0
      const streak = row[headerMap['STRK']] || null

      const teamData = {
        teamId,
        teamAbbreviation,
        teamName,
        conference,
        wins,
        losses,
        winPercentage: parseFloat(winPercentage.toFixed(3)),
        gamesBehind: parseFloat(gamesBehind.toFixed(1)),
        conferenceRank,
        division,
        divisionRank,
        homeWins: parseInt(homeWins),
        homeLosses: parseInt(homeLosses),
        awayWins: parseInt(awayWins),
        awayLosses: parseInt(awayLosses),
        last10Wins,
        last10Losses,
        streak,
      }

      if (conference === 'East') {
        eastStandings.push(teamData)
      } else if (conference === 'West') {
        westStandings.push(teamData)
      }
    })

    // Sort by conference rank
    eastStandings.sort((a, b) => a.conferenceRank - b.conferenceRank)
    westStandings.sort((a, b) => a.conferenceRank - b.conferenceRank)

    return {
      east: eastStandings,
      west: westStandings,
    }

  } catch (error) {
    console.error('Error fetching standings:', error)
    throw error
  }
}

