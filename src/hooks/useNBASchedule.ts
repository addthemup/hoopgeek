import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface NBAGame {
  id: number;
  league_id: number;
  season_year: number;
  game_date: string;
  game_id: string;
  game_code: string;
  game_status: number;
  game_status_text: string;
  game_sequence: number;
  home_team_id: number;
  home_team_name: string;
  home_team_city: string;
  home_team_tricode: string;
  home_team_score: number;
  away_team_id: number;
  away_team_name: string;
  away_team_city: string;
  away_team_tricode: string;
  away_team_score: number;
  week_number: number;
  week_name: string;
  arena_name: string;
  arena_city: string;
  arena_state: string;
  created_at: string;
  updated_at: string;
}

export interface SeasonWeek {
  id: number;
  league_id: number;
  season_year: number;
  week_number: number;
  week_name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface WeekSchedule {
  weekNumber: number;
  weekName: string;
  startDate: string;
  endDate: string;
  games: NBAGame[];
  gamesByDay: {
    [dayName: string]: NBAGame[];
  };
}

// Mock current date to simulate being in the first week of the season
const MOCK_CURRENT_DATE = new Date('2025-10-25'); // First week of 2025-26 regular season

export function useNBASchedule() {
  return useQuery({
    queryKey: ['nba-schedule'],
    queryFn: async () => {
      // Get all NBA games for the 2025-26 season
      const { data: games, error: gamesError } = await supabase
        .from('nba_games')
        .select('*')
        .eq('season_year', 2026)
        .order('game_date', { ascending: true });

      if (gamesError) throw gamesError;

      // Get season weeks
      const { data: weeks, error: weeksError } = await supabase
        .from('nba_season_weeks')
        .select('*')
        .eq('season_year', 2026)
        .order('week_number', { ascending: true });

      if (weeksError) throw weeksError;

      return { games: games as NBAGame[], weeks: weeks as SeasonWeek[] };
    },
  });
}

export function useWeekSchedule(weekNumber: number) {
  return useQuery({
    queryKey: ['nba-week-schedule', weekNumber],
    queryFn: async () => {
      // Get games for specific week
      const { data: games, error: gamesError } = await supabase
        .from('nba_games')
        .select('*')
        .eq('season_year', 2026)
        .eq('week_number', weekNumber)
        .order('game_date', { ascending: true });

      if (gamesError) throw gamesError;

      // Get week info
      const { data: week, error: weekError } = await supabase
        .from('nba_season_weeks')
        .select('*')
        .eq('season_year', 2026)
        .eq('week_number', weekNumber)
        .single();

      if (weekError) throw weekError;

      // Group games by day of week (Monday first)
      const gamesByDay: { [dayName: string]: NBAGame[] } = {};
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      (games as NBAGame[]).forEach(game => {
        const gameDate = new Date(game.game_date);
        const dayIndex = gameDate.getDay(); // 0=Sunday, 1=Monday, etc.
        // Convert to Monday-first: Sunday (0) becomes 6, Monday (1) becomes 0, etc.
        const mondayFirstIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        const dayName = dayNames[mondayFirstIndex];
        
        if (!gamesByDay[dayName]) {
          gamesByDay[dayName] = [];
        }
        gamesByDay[dayName].push(game);
      });

      // Sort games within each day by game time
      Object.keys(gamesByDay).forEach(dayName => {
        gamesByDay[dayName].sort((a, b) => {
          const timeA = new Date(a.game_date).getTime();
          const timeB = new Date(b.game_date).getTime();
          return timeA - timeB;
        });
      });

      return {
        weekNumber: week.week_number,
        weekName: week.week_name,
        startDate: week.start_date,
        endDate: week.end_date,
        games: games as NBAGame[],
        gamesByDay
      } as WeekSchedule;
    },
    enabled: !!weekNumber,
  });
}

export function useCurrentSeasonInfo() {
  return useQuery({
    queryKey: ['nba-current-season'],
    queryFn: async () => {
      // Get total weeks in season
      const { data: weeks, error: weeksError } = await supabase
        .from('nba_season_weeks')
        .select('week_number')
        .eq('season_year', 2026)
        .order('week_number', { ascending: false })
        .limit(1);

      if (weeksError) throw weeksError;

      const totalWeeks = weeks?.[0]?.week_number || 26;

      // Calculate current week based on mock date
      const currentDate = MOCK_CURRENT_DATE;
      const seasonStartDate = new Date('2025-10-23'); // 2025-26 season start (21 days from when we created it)
      
      // Calculate weeks since season start
      const weeksSinceStart = Math.floor(
        (currentDate.getTime() - seasonStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      
      // Handle All-Star break (typically around week 15-16)
      const allStarWeek = 15;
      const allStarBreakWeeks = 2; // 2 weeks off for All-Star break
      
      let currentWeek = Math.min(weeksSinceStart + 1, totalWeeks);
      
      // If we're past the All-Star break, add the break weeks
      if (currentWeek > allStarWeek) {
        currentWeek = Math.min(currentWeek + allStarBreakWeeks, totalWeeks);
      }

      // Ensure we're in a valid range
      currentWeek = Math.max(1, Math.min(currentWeek, totalWeeks));
      
      // Debug logging
      console.log('Season calculation:', {
        currentDate: currentDate.toISOString(),
        seasonStartDate: seasonStartDate.toISOString(),
        weeksSinceStart,
        currentWeek,
        totalWeeks
      });

      return {
        currentWeek,
        totalWeeks,
        seasonYear: 2026,
        seasonStartDate: seasonStartDate.toISOString(),
        isAllStarWeek: currentWeek >= allStarWeek && currentWeek < allStarWeek + allStarBreakWeeks,
        isPlayoffs: currentWeek > 22, // Assuming playoffs start after week 22
        mockCurrentDate: MOCK_CURRENT_DATE.toISOString(),
      };
    },
  });
}

// Helper function to determine if a game is completed
export function isGameCompleted(game: NBAGame): boolean {
  return game.game_status === 3; // 3 = Final
}

// Helper function to get game time in local timezone
export function getGameTime(game: NBAGame): string {
  const gameDate = new Date(game.game_date);
  return gameDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

// Helper function to get day name from date
export function getDayName(date: string): string {
  const gameDate = new Date(date);
  return gameDate.toLocaleDateString('en-US', { weekday: 'long' });
}
