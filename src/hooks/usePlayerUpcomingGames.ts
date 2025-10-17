import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface UpcomingGame {
  id: number
  game_id: string
  game_date: string
  game_time_est?: string
  game_status_text: string
  home_team_name: string
  home_team_tricode: string
  away_team_name: string
  away_team_tricode: string
  arena_name?: string
  arena_city?: string
  week_number?: number
  week_name?: string
  is_week_start: boolean
  is_week_end: boolean
  fantasy_week_name?: string
}

export function usePlayerUpcomingGames(playerId: string) {
  return useQuery({
    queryKey: ['player-upcoming-games', playerId],
    queryFn: async () => {
      console.log(`🏀 Fetching upcoming games for player ${playerId}...`)
      
      // First get the player's team information
      const { data: playerData, error: playerError } = await supabase
        .from('nba_players')
        .select('team_abbreviation, team_name')
        .eq('id', playerId)
        .single()

      if (playerError || !playerData) {
        console.error('❌ Error fetching player team:', playerError)
        throw new Error(`Failed to fetch player team: ${playerError?.message}`)
      }

      if (!playerData.team_abbreviation) {
        console.log('⚠️ Player has no team assigned')
        return []
      }

      // Get fantasy season weeks for 2025-26 (season_year = 2025 in the database)
      const { data: fantasyWeeks, error: weeksError } = await supabase
        .from('fantasy_season_weeks')
        .select('week_number, week_name, start_date, end_date')
        .eq('season_year', 2025)
        .eq('is_active', true)
        .order('week_number')

      if (weeksError) {
        console.error('❌ Error fetching fantasy weeks:', weeksError)
        throw new Error(`Failed to fetch fantasy weeks: ${weeksError.message}`)
      }

      console.log(`📅 Found ${fantasyWeeks?.length || 0} fantasy weeks`)

      // Get upcoming games for the player's team in 2025-26 season
      const { data: games, error: gamesError } = await supabase
        .from('nba_games')
        .select(`
          id,
          game_id,
          game_date,
          game_time_est,
          game_status_text,
          home_team_name,
          home_team_tricode,
          away_team_name,
          away_team_tricode,
          arena_name,
          arena_city,
          week_number,
          week_name
        `)
        .eq('season_year', 2026)
        .or(`home_team_tricode.eq.${playerData.team_abbreviation},away_team_tricode.eq.${playerData.team_abbreviation}`)
        .gte('game_date', new Date().toISOString().split('T')[0]) // Only future games
        .order('game_date')

      if (gamesError) {
        console.error('❌ Error fetching upcoming games:', gamesError)
        throw new Error(`Failed to fetch upcoming games: ${gamesError.message}`)
      }

      console.log(`🏀 Found ${games?.length || 0} upcoming games for ${playerData.team_abbreviation}`)

      // Process games to add fantasy week information
      const processedGames: UpcomingGame[] = (games || []).map((game, index) => {
        const gameDate = new Date(game.game_date)
        
        // Find which fantasy week this game falls into
        const fantasyWeek = fantasyWeeks?.find(week => {
          const weekStart = new Date(week.start_date)
          const weekEnd = new Date(week.end_date)
          return gameDate >= weekStart && gameDate <= weekEnd
        })

        // Check if this game is at the start or end of a fantasy week
        const isWeekStart = fantasyWeek ? 
          gameDate.toDateString() === new Date(fantasyWeek.start_date).toDateString() : false
        const isWeekEnd = fantasyWeek ? 
          gameDate.toDateString() === new Date(fantasyWeek.end_date).toDateString() : false

        // Debug logging for first few games
        if (index < 3) {
          console.log(`🎯 Game: ${game.game_date} (${gameDate.toDateString()})`)
          console.log(`   Fantasy Week: ${fantasyWeek?.week_name || 'None found'}`)
          console.log(`   Week Start: ${isWeekStart}, Week End: ${isWeekEnd}`)
        }

        return {
          ...game,
          is_week_start: isWeekStart,
          is_week_end: isWeekEnd,
          fantasy_week_name: fantasyWeek?.week_name
        }
      })

      console.log(`✅ Found ${processedGames.length} upcoming games for ${playerData.team_abbreviation}`)
      return processedGames
    },
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
