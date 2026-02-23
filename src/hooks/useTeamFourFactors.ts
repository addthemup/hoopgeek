import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface TeamFourFactors {
  teamId: number
  teamName: string
  teamAbbreviation: string
  gamesPlayed: number
  // Offensive Four Factors
  effectiveFieldGoalPercentage: number
  freeThrowAttemptRate: number
  turnoverPercentage: number
  offensiveReboundPercentage: number
  // Defensive Four Factors (opponent stats)
  oppEffectiveFieldGoalPercentage: number
  oppFreeThrowAttemptRate: number
  oppTurnoverPercentage: number
  oppOffensiveReboundPercentage: number
  season: string
  seasonType: string
  perMode: string
}

export function useTeamFourFactors(teamId: number | string | undefined, season?: string) {
  return useQuery<TeamFourFactors, Error>({
    queryKey: ['team-four-factors', teamId, season],
    queryFn: async () => {
      if (!teamId) {
        throw new Error('Team ID is required')
      }

      console.log(`🏀 Fetching four factors for team ${teamId}...`)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      // Build URL with query parameters
      const url = new URL(`${supabaseUrl}/functions/v1/team-four-factors`)
      url.searchParams.set('teamId', teamId.toString())
      if (season) {
        url.searchParams.set('season', season)
      }

      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to fetch team four factors: ${errorData.error || response.statusText}`)
      }

      const data = await response.json()
      console.log(`✅ Successfully fetched four factors for team ${teamId}`)
      return data as TeamFourFactors
    },
    enabled: !!teamId,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: 2,
  })
}
