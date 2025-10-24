import { useQuery } from '@tanstack/react-query'

export interface BettingOutcome {
  odds_field_id: number
  type: string
  odds: string
  opening_odds: string
  odds_trend: string
  spread?: string | null
  opening_spread?: number | null
}

export interface BettingBook {
  id: string
  name: string
  outcomes: BettingOutcome[]
  url: string
  countryCode: string
}

export interface BettingMarket {
  name: string
  odds_type_id: number
  group_name: string
  books: BettingBook[]
}

export interface BettingGame {
  gameId: string
  sr_id: string
  srMatchId: string
  homeTeamId: string
  awayTeamId: string
  markets: BettingMarket[]
}

export interface BettingOddsData {
  games: BettingGame[]
}

export function useBettingOdds() {
  return useQuery({
    queryKey: ['betting-odds'],
    queryFn: async (): Promise<BettingOddsData> => {
      try {
        console.log('🎲 Fetching betting odds via Edge Function...')
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const url = `${supabaseUrl}/functions/v1/betting-odds`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
        })

        console.log('🎲 Response status:', response.status)
        console.log('🎲 Response ok:', response.ok)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log('🎲 Betting odds data received:', {
          hasGames: !!data.games,
          gamesCount: data.games?.length || 0,
          timestamp: new Date().toISOString(),
          firstGame: data.games?.[0]?.gameId || 'none',
          sampleData: data.games?.[0] || null
        })
        
        return data
      } catch (error) {
        console.error('❌ Error fetching betting odds:', error)
        console.error('❌ Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        })
        
        // Return empty data on error
        return {
          games: []
        }
      }
    },
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 3, // Retry failed requests
  })
}

// Helper function to convert decimal odds to American odds
export function decimalToAmerican(decimal: string): string {
  const dec = parseFloat(decimal)
  if (dec >= 2.0) {
    return `+${Math.round((dec - 1) * 100)}`
  } else {
    return `-${Math.round(100 / (dec - 1))}`
  }
}

// Helper function to get odds trend icon
export function getOddsTrendIcon(trend: string): string {
  switch (trend) {
    case 'up':
      return '📈'
    case 'down':
      return '📉'
    default:
      return '➡️'
  }
}

// Helper function to format odds display
export function formatOdds(odds: string, format: 'decimal' | 'american' = 'american'): string {
  if (format === 'american') {
    return decimalToAmerican(odds)
  }
  return parseFloat(odds).toFixed(2)
}

