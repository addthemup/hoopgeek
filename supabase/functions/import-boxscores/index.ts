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

    // Get target date from query params or process today + last 2 days
    const url = new URL(req.url)
    const targetDate = url.searchParams.get('date') || null

    console.log('📊 Starting box score import...')
    
    // Get current season
    const currentDate = new Date()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const season = month >= 10 
      ? `${year}-${(year + 1).toString().slice(-2)}`
      : `${year - 1}-${year.toString().slice(-2)}`

    // Calculate dates to process: today + last 2 days (or single date if specified)
    let datesToProcess: string[] = []
    if (targetDate) {
      datesToProcess = [targetDate]
      console.log(`📅 Processing single date: ${targetDate}`)
    } else {
      // Process today and last 2 days (3 days total)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const dayBefore = new Date(today)
      dayBefore.setDate(dayBefore.getDate() - 2)
      
      datesToProcess = [
        today.toISOString().split('T')[0],
        yesterday.toISOString().split('T')[0],
        dayBefore.toISOString().split('T')[0]
      ]
      console.log(`📅 Processing dates: ${datesToProcess.join(', ')} (today + last 2 days)`)
    }

    console.log(`📅 Season: ${season}`)

    const allResults: any[] = []
    let totalPlayersImported = 0
    let totalSuccessfulGames = 0
    let totalSkippedGames = 0
    let totalGamesFound = 0

    // Process each date
    for (const processDate of datesToProcess) {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`📅 Processing date: ${processDate}`)
      console.log(`${'='.repeat(80)}`)

      // Get games from database for this date
      const { data: games, error: gamesError } = await supabaseAdmin
        .from('nba_games')
        .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_id, away_team_id, game_status, game_status_text')
        .eq('season_year', parseInt(season.split('-')[0]))
        .gte('game_date', `${processDate}T00:00:00`)
        .lte('game_date', `${processDate}T23:59:59`)
        .order('game_date', { ascending: true })

      if (gamesError) {
        console.error(`❌ Error fetching games for ${processDate}: ${gamesError.message}`)
        allResults.push({
          date: processDate,
          success: false,
          error: gamesError.message,
          gamesProcessed: 0,
          playersImported: 0
        })
        continue
      }

      if (!games || games.length === 0) {
        console.log(`ℹ️  No games found for ${processDate}`)
        allResults.push({
          date: processDate,
          success: true,
          message: 'No games found',
          gamesProcessed: 0,
          playersImported: 0
        })
        continue
      }

      console.log(`🎮 Found ${games.length} games for ${processDate}`)
      totalGamesFound += games.length

      let datePlayersImported = 0
      let dateSuccessfulGames = 0
      let dateSkippedGames = 0

      // Process each game
      for (const game of games) {
        const gameId = game.game_id
        const gameDate = game.game_date.split('T')[0]
        const matchup = `${game.away_team_tricode} @ ${game.home_team_tricode}`

        console.log(`\n🎮 Processing game: ${gameId} - ${matchup}`)

        // Check if box score already exists
        const { data: existingBoxScore } = await supabaseAdmin
          .from('nba_boxscores')
          .select('game_id')
          .eq('game_id', gameId)
          .limit(1)

        if (existingBoxScore && existingBoxScore.length > 0) {
          console.log(`⏭️  Box score already exists for ${gameId}, updating scores only...`)
          dateSkippedGames++
          // Still update game scores
          await updateGameScores(supabaseAdmin, gameId)
          continue
        }

        try {
          // Fetch box score from NBA API
          const boxScoreData = await fetchBoxScore(gameId)
          
          if (!boxScoreData) {
            console.log(`⚠️  No box score data available for ${gameId}`)
            continue
          }

          // Update game scores
          await updateGameScores(supabaseAdmin, gameId, boxScoreData.awayScore, boxScoreData.homeScore)

          // Store player stats
          const playersImported = await storeBoxScoreData(
            supabaseAdmin,
            boxScoreData,
            {
              gameId,
              date: gameDate,
              awayTeam: game.away_team_tricode,
              homeTeam: game.home_team_tricode,
              season
            }
          )

          datePlayersImported += playersImported
          dateSuccessfulGames++

          console.log(`✅ Imported ${playersImported} players for game ${gameId}`)

        } catch (error) {
          console.error(`❌ Error processing game ${gameId}:`, error)
        }
      }

      totalPlayersImported += datePlayersImported
      totalSuccessfulGames += dateSuccessfulGames
      totalSkippedGames += dateSkippedGames

      allResults.push({
        date: processDate,
        success: true,
        totalGames: games.length,
        successfulGames: dateSuccessfulGames,
        skippedGames: dateSkippedGames,
        playersImported: datePlayersImported
      })

      console.log(`\n✅ Completed ${processDate}: ${dateSuccessfulGames} games, ${datePlayersImported} players`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Box score import completed for ${datesToProcess.length} date(s)`,
        datesProcessed: datesToProcess,
        totalGames: totalGamesFound,
        totalSuccessfulGames,
        totalSkippedGames,
        totalPlayersImported,
        results: allResults
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error importing box scores:', error)
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

async function fetchBoxScore(gameId: string) {
  try {
    const url = `https://stats.nba.com/stats/boxscoretraditionalv3?GameID=${gameId}`
    
    console.log(`📊 Fetching box score for game ${gameId}...`)

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
      return null
    }

    // Find player stats result set
    const playerStatsSet = data.resultSets.find((rs: any) => rs.name === 'PlayerStats')
    const teamStatsSet = data.resultSets.find((rs: any) => rs.name === 'TeamStats')

    if (!playerStatsSet || !playerStatsSet.rowSet) {
      return null
    }

    const headers = playerStatsSet.headers
    const rows = playerStatsSet.rowSet

    // Map headers to indices
    const headerMap: Record<string, number> = {}
    headers.forEach((header: string, index: number) => {
      headerMap[header] = index
    })

    // Extract team scores
    let awayScore = 0
    let homeScore = 0
    if (teamStatsSet && teamStatsSet.rowSet && teamStatsSet.rowSet.length >= 2) {
      const teamHeaders = teamStatsSet.headers
      const teamHeaderMap: Record<string, number> = {}
      teamHeaders.forEach((header: string, index: number) => {
        teamHeaderMap[header] = index
      })
      
      const awayTeamRow = teamStatsSet.rowSet[0]
      const homeTeamRow = teamStatsSet.rowSet[1]
      
      if (teamHeaderMap['PTS'] !== undefined) {
        awayScore = awayTeamRow[teamHeaderMap['PTS']] || 0
        homeScore = homeTeamRow[teamHeaderMap['PTS']] || 0
      }
    }

    // Transform player stats
    const playerStats = rows.map((row: any[]) => ({
      personId: row[headerMap['personId']],
      nameI: row[headerMap['nameI']] || row[headerMap['name']],
      teamId: row[headerMap['teamId']],
      teamTricode: row[headerMap['teamTricode']],
      teamName: row[headerMap['teamName']],
      teamCity: row[headerMap['teamCity']],
      jerseyNum: row[headerMap['jerseyNum']],
      position: row[headerMap['position']],
      minutes: row[headerMap['minutes']],
      fieldGoalsMade: row[headerMap['fieldGoalsMade']] || 0,
      fieldGoalsAttempted: row[headerMap['fieldGoalsAttempted']] || 0,
      fieldGoalsPercentage: row[headerMap['fieldGoalsPercentage']],
      threePointersMade: row[headerMap['threePointersMade']] || 0,
      threePointersAttempted: row[headerMap['threePointersAttempted']] || 0,
      threePointersPercentage: row[headerMap['threePointersPercentage']],
      freeThrowsMade: row[headerMap['freeThrowsMade']] || 0,
      freeThrowsAttempted: row[headerMap['freeThrowsAttempted']] || 0,
      freeThrowsPercentage: row[headerMap['freeThrowsPercentage']],
      reboundsOffensive: row[headerMap['reboundsOffensive']] || 0,
      reboundsDefensive: row[headerMap['reboundsDefensive']] || 0,
      reboundsTotal: row[headerMap['reboundsTotal']] || 0,
      assists: row[headerMap['assists']] || 0,
      steals: row[headerMap['steals']] || 0,
      blocks: row[headerMap['blocks']] || 0,
      turnovers: row[headerMap['turnovers']] || 0,
      foulsPersonal: row[headerMap['foulsPersonal']] || 0,
      points: row[headerMap['points']] || 0,
      plusMinusPoints: row[headerMap['plusMinusPoints']] || 0,
    }))

    console.log(`✅ Retrieved ${playerStats.length} players from NBA API`)

    return {
      gameId,
      playerStats,
      awayScore,
      homeScore
    }

  } catch (error) {
    console.error(`❌ Error fetching box score for game ${gameId}:`, error)
    return null
  }
}

async function updateGameScores(supabaseAdmin: any, gameId: string, awayScore?: number, homeScore?: number) {
  try {
    // If scores provided, update them and mark game as Final (so "last 10 completed games" includes it)
    if (awayScore !== undefined && homeScore !== undefined) {
      const { error } = await supabaseAdmin
        .from('nba_games')
        .update({
          away_team_score: awayScore,
          home_team_score: homeScore,
          game_status: 3,
          game_status_text: 'Final',
        })
        .eq('game_id', gameId)

      if (error) {
        console.error(`Error updating game scores: ${error.message}`)
      } else {
        console.log(`✅ Updated scores and status=Final: ${awayScore}-${homeScore}`)
      }
    }
  } catch (error) {
    console.error(`Error updating game scores:`, error)
  }
}

async function storeBoxScoreData(supabaseAdmin: any, boxScoreData: any, gameInfo: any) {
  try {
    let storedCount = 0

    for (const playerStat of boxScoreData.playerStats) {
      const nbaPlayerId = parseInt(playerStat.personId)
      const playerName = playerStat.nameI
      const teamId = parseInt(playerStat.teamId)

      // Get or create player
      let playerId: string | null = null
      
      const { data: existingPlayer } = await supabaseAdmin
        .from('nba_players')
        .select('id')
        .eq('nba_player_id', nbaPlayerId)
        .limit(1)

      if (existingPlayer && existingPlayer.length > 0) {
        playerId = existingPlayer[0].id
      } else {
        // Create new player
        const { data: newPlayer } = await supabaseAdmin
          .from('nba_players')
          .insert({
            nba_player_id: nbaPlayerId,
            name: playerName,
            team_id: teamId,
            is_active: true
          })
          .select('id')
          .single()

        if (newPlayer) {
          playerId = newPlayer.id
        }
      }

      // Convert minutes to integer
      let minutesPlayed: number | null = null
      if (playerStat.minutes) {
        const minutesStr = String(playerStat.minutes)
        if (minutesStr.includes(':')) {
          const parts = minutesStr.split(':')
          const mins = parseInt(parts[0]) || 0
          const secs = parseInt(parts[1]) || 0
          minutesPlayed = Math.round(mins + (secs / 60.0))
        } else {
          minutesPlayed = parseInt(minutesStr) || null
        }
      }

      // Helper to convert to int or null
      const toIntOrNull = (value: any): number | null => {
        if (value === null || value === undefined || value === '') {
          return null
        }
        try {
          return parseInt(String(value))
        } catch {
          return null
        }
      }

      // Prepare box score entry
      const boxScoreEntry: any = {
        player_id: playerId,
        nba_player_id: nbaPlayerId,
        game_id: gameInfo.gameId,
        game_date: gameInfo.date,
        season_year: gameInfo.season,
        player_name: playerName,
        matchup: `${gameInfo.awayTeam} @ ${gameInfo.homeTeam}`,
        jersey_num: toIntOrNull(playerStat.jerseyNum),
        position: playerStat.position || null,
        team_id: teamId,
        team_abbreviation: playerStat.teamTricode || null,
        team_name: playerStat.teamName || null,
        team_city: playerStat.teamCity || null,
        team_tricode: playerStat.teamTricode || null,
        min: minutesPlayed,
        fgm: toIntOrNull(playerStat.fieldGoalsMade),
        fga: toIntOrNull(playerStat.fieldGoalsAttempted),
        fg_pct: playerStat.fieldGoalsPercentage || null,
        fg3m: toIntOrNull(playerStat.threePointersMade),
        fg3a: toIntOrNull(playerStat.threePointersAttempted),
        fg3_pct: playerStat.threePointersPercentage || null,
        ftm: toIntOrNull(playerStat.freeThrowsMade),
        fta: toIntOrNull(playerStat.freeThrowsAttempted),
        ft_pct: playerStat.freeThrowsPercentage || null,
        oreb: toIntOrNull(playerStat.reboundsOffensive),
        dreb: toIntOrNull(playerStat.reboundsDefensive),
        reb: toIntOrNull(playerStat.reboundsTotal),
        ast: toIntOrNull(playerStat.assists),
        stl: toIntOrNull(playerStat.steals),
        blk: toIntOrNull(playerStat.blocks),
        tov: toIntOrNull(playerStat.turnovers),
        fouls_personal: toIntOrNull(playerStat.foulsPersonal),
        pts: toIntOrNull(playerStat.points),
        plus_minus_points: toIntOrNull(playerStat.plusMinusPoints),
      }

      // Upsert box score
      const { error } = await supabaseAdmin
        .from('nba_boxscores')
        .upsert(boxScoreEntry, {
          onConflict: 'nba_player_id,game_id'
        })

      if (error) {
        console.error(`❌ Database error for ${playerName}: ${error.message}`)
      } else {
        storedCount++
      }
    }

    console.log(`📊 Successfully stored ${storedCount}/${boxScoreData.playerStats.length} players`)
    return storedCount

  } catch (error) {
    console.error(`❌ Error storing box score data:`, error)
    return 0
  }
}
