/**
 * Hook to fetch NBA games for a specific date
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { isDateInEST } from '../utils/nbaDateUtils';

export interface GameByDate {
  game_id: string;
  game_date: string;
  home_team_tricode: string;
  away_team_tricode: string;
  home_team_name: string;
  away_team_name: string;
  home_team_score: number;
  away_team_score: number;
  game_status_text: string;
  /** Spread for home team (e.g. -5.5). Away spread is typically the opposite. */
  home_spread?: number | null;
  away_spread?: number | null;
  over_under?: number | null;
}

/**
 * Convert a date string (YYYY-MM-DD) to EST/EDT date range in UTC
 * Automatically handles EST (UTC-5) and EDT (UTC-4) based on the date
 * 
 * Since EST/EDT offset varies (UTC-5 or UTC-4), we use a wide UTC range
 * that definitely covers the entire EST/EDT day, then filter by EST date.
 */
function getESTDateRange(dateStr: string): { startUTC: string; endUTC: string } {
  // EST/EDT is UTC-5 or UTC-4, so an EST/EDT day spans:
  // - Earliest possible start: date at 00:00 EST = date at 05:00 UTC (if EST, UTC-5)
  // - Latest possible start: date at 00:00 EDT = date at 04:00 UTC (if EDT, UTC-4)
  // - Earliest possible end: date+1 at 03:59 UTC (if EDT, UTC-4)
  // - Latest possible end: date+1 at 04:59 UTC (if EST, UTC-5)
  
  // Use a safe wide range: from 6 hours before date 00:00 UTC to 6 hours after date+1 00:00 UTC
  // This ensures we capture the entire EST/EDT day regardless of DST
  const date = new Date(`${dateStr}T00:00:00Z`);
  const startUTC = new Date(date.getTime() - (6 * 60 * 60 * 1000)); // 6 hours before
  const endUTC = new Date(date.getTime() + (30 * 60 * 60 * 1000)); // 30 hours after (covers next day + buffer)
  
  return {
    startUTC: startUTC.toISOString(),
    endUTC: endUTC.toISOString(),
  };
}

export function useGamesByDate(date: string | null) {
  return useQuery({
    queryKey: ['games-by-date', date],
    queryFn: async (): Promise<GameByDate[]> => {
      if (!date) return [];

      // Convert EST date to UTC range
      // EST date "2025-12-05" should include games from:
      // - 2025-12-05 00:00:00 EST = 2025-12-05 05:00:00 UTC
      // - 2025-12-05 23:59:59 EST = 2025-12-06 04:59:59 UTC
      const { startUTC, endUTC } = getESTDateRange(date);

      const { data, error } = await supabase
        .from('nba_games')
        .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name, home_team_score, away_team_score, game_status_text, home_spread, away_spread, over_under')
        .gte('game_date', startUTC)
        .lte('game_date', endUTC)
        .not('home_team_tricode', 'is', null)
        .not('away_team_tricode', 'is', null)
        .order('game_date', { ascending: true });

      if (error) {
        console.error('Error fetching games by date:', error);
        throw error;
      }

      // Filter results to ensure they're actually on the EST date
      // Convert each game_date to EST and check if it matches
      // Also filter out invalid games (same team for both, missing tricodes)
      const filtered = (data || []).filter((game) => {
        // Date check using utility function
        const dateMatches = isDateInEST(game.game_date, date);
        
        // Data validation check
        const hasValidTeams = game.home_team_tricode && 
                             game.away_team_tricode && 
                             game.home_team_tricode.trim() !== '' && 
                             game.away_team_tricode.trim() !== '' &&
                             game.home_team_tricode !== game.away_team_tricode;
        
        if (!hasValidTeams && dateMatches) {
          console.warn('Filtering out invalid game:', game.game_id, {
            home: game.home_team_tricode,
            away: game.away_team_tricode
          });
        }
        
        return dateMatches && hasValidTeams;
      });

      return filtered as GameByDate[];
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

