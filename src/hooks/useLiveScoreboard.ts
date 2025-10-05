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

// Mock live data for now - in production this would call the NBA API
const mockLiveGames: LiveGame[] = [
  {
    gameId: "0022500001",
    gameDate: "2025-10-25",
    gameStatus: 2, // Live
    gameStatusText: "Live",
    homeTeam: {
      id: 1610612747,
      abbreviation: "LAL",
      city: "Los Angeles",
      name: "Lakers",
      wins: 2,
      losses: 1,
      points: 98,
      quarters: [28, 25, 22, 23]
    },
    awayTeam: {
      id: 1610612744,
      abbreviation: "GSW",
      city: "Golden State",
      name: "Warriors",
      wins: 1,
      losses: 2,
      points: 95,
      quarters: [24, 26, 20, 25]
    },
    arena: "Crypto.com Arena",
    livePeriod: 4,
    liveTime: "2:34",
    nationalTV: "ESPN"
  },
  {
    gameId: "0022500002",
    gameDate: "2025-10-25",
    gameStatus: 1, // Scheduled
    gameStatusText: "Scheduled",
    homeTeam: {
      id: 1610612738,
      abbreviation: "BOS",
      city: "Boston",
      name: "Celtics",
      wins: 3,
      losses: 0,
      points: 0,
      quarters: []
    },
    awayTeam: {
      id: 1610612751,
      abbreviation: "BKN",
      city: "Brooklyn",
      name: "Nets",
      wins: 1,
      losses: 2,
      points: 0,
      quarters: []
    },
    arena: "TD Garden",
    nationalTV: "TNT"
  },
  {
    gameId: "0022500003",
    gameDate: "2025-10-25",
    gameStatus: 3, // Final
    gameStatusText: "Final",
    homeTeam: {
      id: 1610612743,
      abbreviation: "DEN",
      city: "Denver",
      name: "Nuggets",
      wins: 2,
      losses: 1,
      points: 112,
      quarters: [30, 28, 26, 28]
    },
    awayTeam: {
      id: 1610612762,
      abbreviation: "UTA",
      city: "Utah",
      name: "Jazz",
      wins: 0,
      losses: 3,
      points: 98,
      quarters: [22, 25, 24, 27]
    },
    arena: "Ball Arena"
  }
];

export function useLiveScoreboard(gameDate?: string) {
  return useQuery({
    queryKey: ['live-scoreboard', gameDate],
    queryFn: async (): Promise<LiveScoreboardData> => {
      try {
        // Call Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('nba-api-proxy', {
          body: {
            endpoint: 'scoreboard',
            gameDate,
            dayOffset: 0
          }
        });

        if (error) {
          console.error('Error calling NBA API proxy:', error);
          throw error;
        }

        return data;
      } catch (error) {
        console.error('Error fetching live scoreboard:', error);
        
        // Fallback to mock data
        const games = gameDate 
          ? mockLiveGames.filter(game => game.gameDate === gameDate)
          : mockLiveGames;
        
        return {
          games,
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
