import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Boxscore {
  nba_player_id: number;
  game_id: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg3m: number;
  ftm: number;
}

interface PlayerProp {
  id: string;
  nba_player_id: number | null;
  player_id: string | null;
  bet_type: string;
  bet_type_id: string;
  line: number;
  raw_odd_data: any;
}

// Map bet types to boxscore fields
const betTypeMap: Record<string, keyof Boxscore> = {
  'points': 'pts',
  'point': 'pts',
  'pts': 'pts',
  'rebounds': 'reb',
  'rebound': 'reb',
  'reb': 'reb',
  'assists': 'ast',
  'assist': 'ast',
  'ast': 'ast',
  'steals': 'stl',
  'steal': 'stl',
  'stl': 'stl',
  'blocks': 'blk',
  'block': 'blk',
  'blk': 'blk',
  'turnovers': 'tov',
  'turnover': 'tov',
  'tov': 'tov',
  'three-pointers': 'fg3m',
  'three-pointer': 'fg3m',
  '3-pointers': 'fg3m',
  '3-pointer': 'fg3m',
  '3pt': 'fg3m',
  '3pm': 'fg3m',
  'threes': 'fg3m',
  'threepointersmade': 'fg3m',
  'free-throws': 'ftm',
  'free-throw': 'ftm',
  'ftm': 'ftm',
};

// Calculate if a prop hit or missed
function calculatePropResult(
  betType: string,
  line: number,
  boxscore: Boxscore
): { actualValue: number; result: 'over' | 'under' | 'push' } | null {
  const normalizedBetType = betType.toLowerCase().trim();
  
  // Handle combined props
  const normalized = normalizedBetType.replace(/\s+/g, '').replace(/_/g, '+');
  let actualValue = 0;
  
  if (normalized.includes('points+rebounds+assists') || normalized.includes('par')) {
    actualValue = (boxscore.pts || 0) + (boxscore.reb || 0) + (boxscore.ast || 0);
  } else if (normalized.includes('points+rebounds') || normalized.includes('pts+reb')) {
    actualValue = (boxscore.pts || 0) + (boxscore.reb || 0);
  } else if (normalized.includes('points+assists') || normalized.includes('pts+ast')) {
    actualValue = (boxscore.pts || 0) + (boxscore.ast || 0);
  } else if (normalized.includes('rebounds+assists') || normalized.includes('reb+ast')) {
    actualValue = (boxscore.reb || 0) + (boxscore.ast || 0);
  } else if (normalized.includes('blocks+steals') || normalized.includes('stocks')) {
    actualValue = (boxscore.blk || 0) + (boxscore.stl || 0);
  } else {
    // Single stat props
    const field = betTypeMap[normalizedBetType];
    if (!field) {
      return null;
    }
    actualValue = boxscore[field] ?? 0;
  }
  
  // Determine result
  if (actualValue > line) {
    return { actualValue, result: 'over' };
  } else if (actualValue < line) {
    return { actualValue, result: 'under' };
  } else {
    return { actualValue, result: 'push' };
  }
}

// Determine if prop is over or under
function isOverProp(prop: PlayerProp): boolean {
  const betTypeId = prop.bet_type_id || '';
  const rawData = prop.raw_odd_data || {};
  
  // Check bet_type_id
  if (betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over')) {
    return true;
  }
  if (betTypeId.includes('-under') || betTypeId.endsWith('under') || betTypeId.toLowerCase().includes('under')) {
    return false;
  }
  
  // Check raw_odd_data
  const side = rawData.overUnder || rawData.sideID || rawData.sideId || '';
  if (side === 'over' || side === 'Over' || side === 'O') {
    return true;
  }
  if (side === 'under' || side === 'Under' || side === 'U') {
    return false;
  }
  
  // Default to over if unclear
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get yesterday's date (games that finished yesterday)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    // Also check today in case we're running early
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    console.log(`📊 Calculating prop hit rates for games on ${yesterdayStr} and ${todayStr}`)

    // Find all final games from yesterday and today
    const { data: finalGames, error: gamesError } = await supabase
      .from('nba_games')
      .select('game_id, game_date, game_status_text')
      .in('game_date', [yesterdayStr, todayStr])
      .in('game_status_text', ['Final', 'Final/OT', 'Final/2OT', 'Final/3OT'])

    if (gamesError) {
      throw new Error(`Error fetching games: ${gamesError.message}`)
    }

    if (!finalGames || finalGames.length === 0) {
      console.log('ℹ️ No final games found')
      return new Response(
        JSON.stringify({ message: 'No final games found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`✅ Found ${finalGames.length} final games`)

    const gameIds = finalGames.map(g => g.game_id)
    let totalProcessed = 0
    let totalErrors = 0

    // For each game, get all boxscores
    for (const game of finalGames) {
      const { data: boxscores, error: boxscoreError } = await supabase
        .from('nba_boxscores')
        .select('nba_player_id, game_id, pts, reb, ast, stl, blk, tov, fg3m, ftm')
        .eq('game_id', game.game_id)

      if (boxscoreError) {
        console.error(`❌ Error fetching boxscores for game ${game.game_id}:`, boxscoreError)
        totalErrors++
        continue
      }

      if (!boxscores || boxscores.length === 0) {
        console.log(`⚠️ No boxscores found for game ${game.game_id}`)
        continue
      }

      // Create a map of player_id -> boxscore for quick lookup
      const boxscoreMap = new Map<number, Boxscore>()
      boxscores.forEach(bs => {
        boxscoreMap.set(bs.nba_player_id, bs as Boxscore)
      })

      // Get all props for this game date
      const gameDateStr = game.game_date ? new Date(game.game_date).toISOString().split('T')[0] : yesterdayStr
      
      const { data: props, error: propsError } = await supabase
        .from('player_props')
        .select('id, nba_player_id, player_id, bet_type, bet_type_id, line, raw_odd_data')
        .eq('game_date', gameDateStr)

      if (propsError) {
        console.error(`❌ Error fetching props for game date ${gameDateStr}:`, propsError)
        totalErrors++
        continue
      }

      if (!props || props.length === 0) {
        console.log(`⚠️ No props found for game date ${gameDateStr}`)
        continue
      }

      // Group props by player
      const propsByPlayer = new Map<number, PlayerProp[]>()
      props.forEach(prop => {
        if (prop.nba_player_id) {
          if (!propsByPlayer.has(prop.nba_player_id)) {
            propsByPlayer.set(prop.nba_player_id, [])
          }
          propsByPlayer.get(prop.nba_player_id)!.push(prop as PlayerProp)
        }
      })

      // Calculate hit rate for each player
      for (const [nbaPlayerId, playerProps] of propsByPlayer) {
        const boxscore = boxscoreMap.get(nbaPlayerId)
        if (!boxscore) {
          continue // No boxscore for this player
        }

        let totalProps = 0
        let oversHit = 0
        let undersHit = 0
        let pushes = 0

        // Process each prop
        for (const prop of playerProps) {
          if (!prop.line) continue

          const result = calculatePropResult(prop.bet_type, prop.line, boxscore)
          if (!result) continue

          totalProps++
          
          const isOver = isOverProp(prop)
          
          if (result.result === 'push') {
            pushes++
          } else if (isOver && result.result === 'over') {
            oversHit++
          } else if (!isOver && result.result === 'under') {
            undersHit++
          }
        }

        if (totalProps === 0) continue

        // Calculate hit rate (percentage of overs hit)
        const hitRate = totalProps > 0 ? (oversHit / totalProps) * 100 : 0

        // Get player_id if available
        const firstProp = playerProps[0]
        const playerId = firstProp.player_id || null

        // Upsert result
        const { error: upsertError } = await supabase
          .from('player_prop_results')
          .upsert({
            nba_player_id: nbaPlayerId,
            player_id: playerId,
            game_id: game.game_id,
            game_date: gameDateStr,
            total_props: totalProps,
            overs_hit: oversHit,
            unders_hit: undersHit,
            pushes: pushes,
            hit_rate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
            calculated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'nba_player_id,game_id'
          })

        if (upsertError) {
          console.error(`❌ Error upserting result for player ${nbaPlayerId}, game ${game.game_id}:`, upsertError)
          totalErrors++
        } else {
          totalProcessed++
          console.log(`✅ Processed player ${nbaPlayerId} for game ${game.game_id}: ${oversHit}/${totalProps} overs hit (${hitRate.toFixed(1)}%)`)
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Hit rates calculated successfully',
        gamesProcessed: finalGames.length,
        playersProcessed: totalProcessed,
        errors: totalErrors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

