import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface FantasyWeek {
  week_number: number;
  week_name: string;
  start_date: string;
  end_date: string;
  is_regular_season: boolean;
  is_playoff_week: boolean;
  playoff_round: number | null;
  is_active: boolean;
}

export function useFantasyWeek(weekNumber: number) {
  return useQuery<FantasyWeek | null, Error>({
    queryKey: ['fantasy-week', weekNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_season_weeks')
        .select('*')
        .eq('week_number', weekNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw new Error(`Error fetching fantasy week: ${error.message}`);
      }
      return data;
    },
    enabled: weekNumber >= 0,
  });
}

export function useFantasyWeekDates(weekNumber: number) {
  return useQuery<{ startDate: string; endDate: string; weekName: string } | null, Error>({
    queryKey: ['fantasy-week-dates', weekNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_season_weeks')
        .select('start_date, end_date, week_name')
        .eq('week_number', weekNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        throw new Error(`Error fetching fantasy week dates: ${error.message}`);
      }
      
      return {
        startDate: data.start_date,
        endDate: data.end_date,
        weekName: data.week_name
      };
    },
    enabled: weekNumber >= 0,
  });
}
