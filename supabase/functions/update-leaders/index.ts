import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('🏀 Fetching NBA leaders...')

    const leadersData = await fetchLeaders()
    
    if (!leadersData || leadersData.length === 0) {
      throw new Error('Failed to fetch leaders data')
    }

    // Get current season
    const currentDate = new Date()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const season = month >= 10 
      ? `${year}-${(year + 1).toString().slice(-2)}`
      : `${year - 1}-${year.toString().slice(-2)}`

    console.log(`📅 Season: ${season}`)
    console.log(`📊 Total leader records: ${leadersData.length}`)

    // Delete existing leaders for this season
    const { error: deleteError } = await supabaseAdmin
      .from('nba_leaders')
      .delete()
      .eq('season', season)

    if (deleteError) {
      console.error('Error deleting old leaders:', deleteError)
      throw deleteError
    }

    // Insert new leaders
    const { error: insertError } = await supabaseAdmin
      .from('nba_leaders')
      .insert(leadersData.map(leader => ({
        ...leader,
        season,
        updated_at: new Date().toISOString(),
      })))

    if (insertError) {
      console.error('Error inserting leaders:', insertError)
      throw insertError
    }

    console.log(`✅ Successfully updated ${leadersData.length} leader records`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${leadersData.length} leader records`,
        season,
        count: leadersData.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error updating leaders:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function fetchLeaders() {
  try {
    // Get current season
    const currentDate = new Date()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const season = month >= 10 
      ? `${year}-${(year + 1).toString().slice(-2)}`
      : `${year - 1}-${year.toString().slice(-2)}`

    // NBA API endpoint for season leaders
    const url = `https://stats.nba.com/stats/leagueleaders?LeagueID=00&PerMode=Totals&Season=${season}&SeasonType=Regular%20Season&StatCategory=PTS`
    
    console.log(`🏀 Fetching leaders for season: ${season}`)
    
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
      throw new Error('No leaders data in response')
    }

    // Fetch leaders for multiple categories
    const categories = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT']
    const allLeaders: any[] = []

    for (const category of categories) {
      const categoryUrl = `https://stats.nba.com/stats/leagueleaders?LeagueID=00&PerMode=Totals&Season=${season}&SeasonType=Regular%20Season&StatCategory=${category}`
      
      const categoryResponse = await fetch(categoryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.nba.com/',
          'Origin': 'https://www.nba.com'
        }
      })

      if (!categoryResponse.ok) {
        console.warn(`Failed to fetch ${category} leaders: ${categoryResponse.status}`)
        continue
      }

      const categoryData = await categoryResponse.json()
      
      if (!categoryData.resultSets || categoryData.resultSets.length === 0) {
        continue
      }

      const standings = categoryData.resultSets[0].rowSet
      const headers = categoryData.resultSets[0].headers

      const headerMap: Record<string, number> = {}
      headers.forEach((header: string, index: number) => {
        headerMap[header] = index
      })

      // Get top 10 for each category
      standings.slice(0, 10).forEach((row: any[], index: number) => {
        const playerId = row[headerMap['PLAYER_ID']]
        const teamId = row[headerMap['TEAM_ID']]
        const value = parseFloat(row[headerMap[category]] || 0)
        const gamesPlayed = parseInt(row[headerMap['GP']] || 0)

        allLeaders.push({
          nba_player_id: playerId,
          team_id: teamId,
          category,
          value,
          rank: index + 1,
          games_played: gamesPlayed,
        })
      })
    }

    // Now we need to map nba_player_id to our player_id (UUID)
    // Fetch all players to get the mapping
    const { data: players, error: playersError } = await supabaseAdmin
      .from('nba_players')
      .select('id, nba_player_id')
      .in('nba_player_id', allLeaders.map(l => l.nba_player_id))

    if (playersError) {
      console.error('Error fetching players:', playersError)
      throw playersError
    }

    const playerIdMap = new Map(players?.map(p => [p.nba_player_id, p.id]) || [])

    // Map nba_player_id to player_id (UUID)
    const leadersWithPlayerIds = allLeaders.map(leader => {
      const playerId = playerIdMap.get(leader.nba_player_id)
      if (!playerId) {
        console.warn(`Player not found for nba_player_id: ${leader.nba_player_id}`)
        return null
      }
      return {
        player_id: playerId,
        nba_player_id: leader.nba_player_id,
        team_id: leader.team_id,
        category: leader.category,
        value: leader.value,
        rank: leader.rank,
        games_played: leader.games_played,
      }
    }).filter(Boolean)

    return leadersWithPlayerIds

  } catch (error) {
    console.error('Error fetching leaders:', error)
    throw error
  }
}

