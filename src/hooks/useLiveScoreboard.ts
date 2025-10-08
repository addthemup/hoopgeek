import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface LiveGame {
  gameId: string;
  gameDate: string;
  gameStatus: number;
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
  livePeriod?: number;
  liveTime?: string;
  nationalTV?: string;
}

export interface LiveScoreboardData {
  games: LiveGame[];
  eastStandings: any[];
  westStandings: any[];
  lastUpdated: string;
}

export function useLiveScoreboard(gameDate?: string) {
  return useQuery({
    queryKey: ['live-scoreboard', gameDate],
    queryFn: async (): Promise<LiveScoreboardData> => {
      try {
        // Call Supabase Edge Function (live-scoreboard) with query params
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const url = new URL(`${supabaseUrl}/functions/v1/live-scoreboard`);
        if (gameDate) {
          url.searchParams.set('gameDate', gameDate);
        }
        url.searchParams.set('dayOffset', '0');

        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching live scoreboard:', error);
        
        return {
          games: [],
          eastStandings: [],
          westStandings: [],
          lastUpdated: new Date().toISOString()
        };
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds for live games
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

// Helper function to get game status color
export function getGameStatusColor(status: number): string {
  switch (status) {
    case 1: return '#666'; // Scheduled
    case 2: return '#e94560'; // Live
    case 3: return '#28a745'; // Final
    default: return '#666';
  }
}

// Helper function to format game time
export function formatGameTime(game: LiveGame): string {
  if (game.gameStatus === 2 && game.liveTime) {
    return `Q${game.livePeriod} ${game.liveTime}`;
  }
  if (game.gameStatus === 1) {
    return '8:00 PM'; // Would get from game date
  }
  return game.gameStatusText;
}
