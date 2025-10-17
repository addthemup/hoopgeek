import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface FantasyWeek {
  id: string;
  season_year: number;
  week_number: number;
  week_name: string;
  start_date: string;
  end_date: string;
  is_regular_season: boolean;
  is_playoff_week: boolean;
  playoff_round: number | null;
  is_active: boolean;
}

export interface CurrentFantasyWeekData {
  currentWeek: FantasyWeek | null;
  seasonPhase: 'preseason' | 'regular_season' | 'playoffs' | 'offseason';
  isLoading: boolean;
  error: Error | null;
}

export function useCurrentFantasyWeek(): CurrentFantasyWeekData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['current-fantasy-week'],
    queryFn: async (): Promise<CurrentFantasyWeekData> => {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log('🗓️ useCurrentFantasyWeek: Current date:', today);
      
      // Get all fantasy weeks for the current season (2025)
      const { data: weeks, error: weeksError } = await supabase
        .from('fantasy_season_weeks')
        .select('*')
        .eq('season_year', 2025)
        .eq('is_active', true)
        .order('week_number', { ascending: true });

      if (weeksError) {
        throw new Error(`Failed to fetch fantasy weeks: ${weeksError.message}`);
      }

      if (!weeks || weeks.length === 0) {
        console.log('⚠️ useCurrentFantasyWeek: No weeks found for season 2025');
        return {
          currentWeek: null,
          seasonPhase: 'offseason',
          isLoading: false,
          error: null
        };
      }

      console.log('📅 useCurrentFantasyWeek: Found weeks:', weeks.map(w => `${w.week_name} (${w.start_date} - ${w.end_date})`));

      // Find the current week based on today's date
      let currentWeek: FantasyWeek | null = null;
      let seasonPhase: 'preseason' | 'regular_season' | 'playoffs' | 'offseason' = 'offseason';

      for (const week of weeks) {
        const startDate = new Date(week.start_date);
        const endDate = new Date(week.end_date);
        const todayDate = new Date(today);

        // Check if today falls within this week's date range
        if (todayDate >= startDate && todayDate <= endDate) {
          currentWeek = week;
          
          // Determine season phase
          if (week.week_number === 0) {
            seasonPhase = 'preseason';
          } else if (week.is_playoff_week) {
            seasonPhase = 'playoffs';
          } else if (week.is_regular_season) {
            seasonPhase = 'regular_season';
          }
          
          console.log(`✅ useCurrentFantasyWeek: Found current week: ${week.week_name} (${week.week_number}) - Phase: ${seasonPhase}`);
          break;
        }
      }

      // If no current week found, determine if we're before season, between weeks, or after season
      if (!currentWeek) {
        const firstWeek = weeks[0];
        const lastWeek = weeks[weeks.length - 1];
        const todayDate = new Date(today);
        const firstWeekStart = new Date(firstWeek.start_date);
        const lastWeekEnd = new Date(lastWeek.end_date);

        if (todayDate < firstWeekStart) {
          seasonPhase = 'offseason'; // Before preseason
        } else if (todayDate > lastWeekEnd) {
          seasonPhase = 'offseason'; // After season
        } else {
          // We're between weeks, find the most recent completed week
          for (let i = weeks.length - 1; i >= 0; i--) {
            const week = weeks[i];
            const endDate = new Date(week.end_date);
            if (todayDate > endDate) {
              currentWeek = week;
              if (week.week_number === 0) {
                seasonPhase = 'preseason';
              } else if (week.is_playoff_week) {
                seasonPhase = 'playoffs';
              } else if (week.is_regular_season) {
                seasonPhase = 'regular_season';
              }
              break;
            }
          }
        }
      }

      console.log('🎯 useCurrentFantasyWeek: Final result:', {
        currentWeek: currentWeek ? `${currentWeek.week_name} (${currentWeek.week_number})` : 'null',
        seasonPhase
      });

      return {
        currentWeek,
        seasonPhase,
        isLoading: false,
        error: null
      };
    },
    staleTime: 1000 * 60 * 60, // 1 hour - fantasy weeks don't change often
    refetchOnWindowFocus: false,
  });

  return {
    currentWeek: data?.currentWeek || null,
    seasonPhase: data?.seasonPhase || 'offseason',
    isLoading,
    error: error as Error | null,
  };
}

// Helper function to get week display text
export function getWeekDisplayText(week: FantasyWeek | null, seasonPhase: string): string {
  if (!week) {
    switch (seasonPhase) {
      case 'offseason':
        return 'Offseason';
      default:
        return 'Season Loading...';
    }
  }

  if (week.week_number === 0) {
    return 'Preseason';
  }

  if (week.is_playoff_week && week.playoff_round) {
    return `Playoffs - Round ${week.playoff_round}`;
  }

  return week.week_name;
}

// Helper function to get season phase color for UI
export function getSeasonPhaseColor(seasonPhase: string): 'warning' | 'primary' | 'success' | 'neutral' {
  switch (seasonPhase) {
    case 'preseason':
      return 'warning';
    case 'regular_season':
      return 'primary';
    case 'playoffs':
      return 'success';
    case 'offseason':
      return 'neutral';
    default:
      return 'neutral';
  }
}
