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
        // Call Supabase Edge Function with query parameters
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const url = new URL(`${supabaseUrl}/functions/v1/live-scoreboard`);
        if (gameDate) {
          url.searchParams.set('gameDate', gameDate);
        }
        url.searchParams.set('dayOffset', '0');
        
        // Get the current session for authentication
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
        console.log('🏀 Frontend received scoreboard data:', {
          gamesCount: data.games?.length || 0,
          gameDate: data.gameDate,
          lastUpdated: data.lastUpdated,
          source: data.source,
          firstGame: data.games?.[0] ? {
            gameId: data.games[0].gameId,
            homeTeam: data.games[0].homeTeam.name,
            awayTeam: data.games[0].awayTeam.name,
            status: data.games[0].gameStatusText
          } : null
        });
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
