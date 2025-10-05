import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface NBAGame {
  gameId: string;
  gameDate: string;
  gameStatus: number; // 1: Scheduled, 2: Live, 3: Final
  gameStatusText: string;
  homeTeam: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    wins: number;
    losses: number;
    points: number;
    quarters: number[];
  };
  awayTeam: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    wins: number;
    losses: number;
    points: number;
    quarters: number[];
  };
  arena: string;
  nationalTV?: string;
}

export interface NBAScoreboardData {
  games: NBAGame[];
  eastStandings: any[];
  westStandings: any[];
  lastUpdated: string;
  gameDate: string;
}

export function useNBAScoreboard(gameDate?: string) {
  return useQuery({
    queryKey: ['nba-scoreboard', gameDate],
    queryFn: async (): Promise<NBAScoreboardData> => {
      try {
        // Call Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('live-scoreboard', {
          body: {
            gameDate,
            dayOffset: 0
          }
        });

        if (error) {
          console.error('Error calling NBA scoreboard function:', error);
          throw error;
        }

        return data;
      } catch (error) {
        console.error('Error fetching NBA scoreboard:', error);
        
        // Fallback to empty data
        return {
          games: [],
          eastStandings: [],
          westStandings: [],
          lastUpdated: new Date().toISOString(),
          gameDate: gameDate || new Date().toISOString().split('T')[0]
        };
      }
    },
    refetchInterval: 60000, // Refetch every minute for live games
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}
