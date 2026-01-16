/**
 * React Hook for Player Name Matching
 * 
 * Provides a React hook interface for matching player names.
 * Uses React Query for caching and state management.
 * 
 * Usage:
 *   import { usePlayerNameMatch } from '@/hooks/usePlayerNameMatcher'
 *   
 *   const { data: match, isLoading } = usePlayerNameMatch('Nikola Vucevic')
 *   if (match) {
 *     console.log(match.player_id, match.nba_player_id)
 *   }
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'
import { matchPlayerName, matchPlayerNames, type PlayerMatch, type MatchOptions } from '../utils/playerNameMatcher'

/**
 * Hook to match a single player name
 */
export function usePlayerNameMatch(
  propPlayerName: string | null | undefined,
  options: MatchOptions = {}
) {
  return useQuery<PlayerMatch | null>({
    queryKey: ['player-name-match', propPlayerName, options.teamTricode],
    queryFn: async () => {
      if (!propPlayerName) return null
      return matchPlayerName(supabase, propPlayerName, options)
    },
    enabled: !!propPlayerName,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  })
}

/**
 * Hook to match multiple player names
 */
export function usePlayerNameMatches(
  propPlayerNames: string[],
  options: MatchOptions = {}
) {
  return useQuery<Map<string, PlayerMatch | null>>({
    queryKey: ['player-name-matches', propPlayerNames.sort().join(','), options.teamTricode],
    queryFn: async () => {
      if (!propPlayerNames || propPlayerNames.length === 0) {
        return new Map()
      }
      return matchPlayerNames(supabase, propPlayerNames, options)
    },
    enabled: propPlayerNames.length > 0,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
  })
}
