import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerWeekGame {
  game_id: string;
  game_date: string;
  home_team_tricode: string;
  away_team_tricode: string;
  game_status_text: string;
  week_number: number | null;
}

/**
 * Fetch games for a specific player's team for a specific week
 * Uses direct game queries like the player page does
 */
export function usePlayerWeekGames(
  playerTeam: string | undefined,
  weekNumber: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['player-week-games', playerTeam, weekNumber],
    queryFn: async () => {
      if (!playerTeam) return [];

      console.log(`🎯 usePlayerWeekGames: Fetching games for ${playerTeam}, week ${weekNumber}`);

      // Get week dates from nba_season_weeks
      const { data: weekData, error: weekError } = await supabase
        .from('nba_season_weeks')
        .select('start_date, end_date')
        .eq('season_year', 2026)
        .eq('week_number', weekNumber)
        .single();

      if (weekError) {
        console.error(`❌ Error fetching week ${weekNumber} dates:`, weekError);
        
        // Fallback: calculate dates
        if (weekNumber === 0) {
          // Preseason
          const startDate = '2025-10-02';
          const endDate = '2025-10-19';
          const games = await fetchGamesForDateRange(playerTeam, startDate, endDate);
          console.log(`✅ usePlayerWeekGames (fallback preseason) returning ${games?.length || 0} games for ${playerTeam}`);
          return games;
        } else {
          // Regular season - Week 1 starts Oct 20, 2025 (Monday)
          const week1Start = new Date(2025, 9, 20); // Oct 20, 2025
          const weekStart = new Date(week1Start);
          weekStart.setDate(week1Start.getDate() + (weekNumber - 1) * 7);
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          const startDate = formatDate(weekStart);
          const endDate = formatDate(weekEnd);
          
          console.log(`📅 Calculated fallback dates for week ${weekNumber}:`, { startDate, endDate });
          const games = await fetchGamesForDateRange(playerTeam, startDate, endDate);
          console.log(`✅ usePlayerWeekGames (fallback regular) returning ${games?.length || 0} games for ${playerTeam}`);
          return games;
        }
      }

      const startDate = weekData.start_date;
      const endDate = weekData.end_date;
      
      console.log(`✅ Using nba_season_weeks dates for week ${weekNumber}:`, { startDate, endDate });
      
      try {
        const games = await fetchGamesForDateRange(playerTeam, startDate, endDate);
        console.log(`✅ usePlayerWeekGames returning ${games?.length || 0} games for ${playerTeam}`);
        return games;
      } catch (error) {
        console.error(`❌ usePlayerWeekGames error for ${playerTeam}:`, error);
        throw error;
      }
    },
    enabled: enabled && !!playerTeam,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

async function fetchGamesForDateRange(
  playerTeam: string,
  startDate: string,
  endDate: string
): Promise<PlayerWeekGame[]> {
  console.log(`🔍 Fetching games for ${playerTeam} between ${startDate} and ${endDate}`);
  
  // First, let's see what games exist in this date range (without team filter)
  console.log(`📊 About to query all games in range...`);
  const { data: allGamesInRange, error: allGamesError } = await supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode')
    .eq('season_year', 2026)
    .gte('game_date', startDate)
    .lte('game_date', endDate + 'T23:59:59')
    .order('game_date', { ascending: true })
    .limit(10);
  
  console.log(`📊 Query completed. Total games in date range (${startDate} to ${endDate}):`, allGamesInRange?.length || 0);
  if (allGamesError) {
    console.error(`❌ Error querying all games:`, allGamesError);
  }
  if (allGamesInRange && allGamesInRange.length > 0) {
    console.log(`📊 Sample games:`, allGamesInRange.slice(0, 3));
  }
  
  // Now fetch games for this specific team
  console.log(`🎯 Querying games for ${playerTeam}...`);
  const { data, error } = await supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode, game_status_text, week_number')
    .eq('season_year', 2026)
    .gte('game_date', startDate)
    .lte('game_date', endDate + 'T23:59:59')
    .or(`home_team_tricode.eq.${playerTeam},away_team_tricode.eq.${playerTeam}`)
    .order('game_date', { ascending: true });
  
  console.log(`🎯 Query for ${playerTeam} completed:`, { dataLength: data?.length, error });

  if (error) {
    console.error('❌ Error fetching games:', error);
    throw error;
  }

  console.log(`✅ Found ${data?.length || 0} games for ${playerTeam}:`, data);
  if (data && data.length === 0 && allGamesInRange && allGamesInRange.length > 0) {
    console.warn(`⚠️ No games found for team "${playerTeam}" but ${allGamesInRange.length} games exist in this date range. Check team tricode!`);
  }
  
  return (data || []) as PlayerWeekGame[];
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the week dates (for the schedule header)
 */
export function useWeekDates(weekNumber: number) {
  return useQuery({
    queryKey: ['week-dates', weekNumber],
    queryFn: async () => {
      console.log(`📅 useWeekDates: Fetching dates for week ${weekNumber}`);
      
      // Try to get from nba_season_weeks
      const { data: weekData, error: weekError } = await supabase
        .from('nba_season_weeks')
        .select('start_date, end_date, week_name')
        .eq('season_year', 2026)
        .eq('week_number', weekNumber)
        .single();

      if (!weekError && weekData) {
        console.log(`✅ Got week dates from DB:`, weekData);
        return {
          startDate: weekData.start_date,
          endDate: weekData.end_date,
          weekName: weekData.week_name
        };
      }

      // Fallback calculation
      console.log(`⚠️ Using fallback calculation for week ${weekNumber}`);
      
      if (weekNumber === 0) {
        return {
          startDate: '2025-10-02',
          endDate: '2025-10-19',
          weekName: 'Preseason'
        };
      } else {
        // Week 1 starts Oct 20, 2025 (Monday)
        const week1Start = new Date(2025, 9, 20);
        const weekStart = new Date(week1Start);
        weekStart.setDate(week1Start.getDate() + (weekNumber - 1) * 7);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        return {
          startDate: formatDate(weekStart),
          endDate: formatDate(weekEnd),
          weekName: `Week ${weekNumber}`
        };
      }
    },
    enabled: weekNumber >= 0,
  });
}

