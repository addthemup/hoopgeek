/**
 * Player Name Matcher Utility
 * 
 * Centralized utility for matching player names from player_props to nba_players.
 * Handles name normalization, special characters, casing, and variations.
 * 
 * Usage:
 *   import { matchPlayerName } from '@/utils/playerNameMatcher'
 *   
 *   const match = await matchPlayerName(supabase, 'Nikola Vucevic')
 *   if (match) {
 *     console.log(match.player_id, match.nba_player_id)
 *   }
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

export interface PlayerMatch {
  player_id: string
  nba_player_id: number
  name: string
  team_abbreviation?: string
}

export interface MatchOptions {
  /**
   * Team tricode to help disambiguate when multiple matches exist
   */
  teamTricode?: string
  
  /**
   * Whether to use cached results (default: true)
   */
  useCache?: boolean
  
  /**
   * Maximum number of matches to return (default: 10)
   */
  maxMatches?: number
}

// In-memory cache for matches (key: normalized name, value: PlayerMatch)
const matchCache = new Map<string, PlayerMatch>()

/**
 * Normalize player name for matching
 * Handles:
 * - Case differences
 * - Special characters (Vučević → Vucevic)
 * - Hyphens and apostrophes
 * - Jr/Sr suffixes
 * - Extra whitespace
 */
export function normalizePlayerName(name: string): string {
  if (!name) return ''
  
  // Convert to lowercase and trim
  let normalized = name.trim().toLowerCase()
  
  // Remove common suffixes (Jr, Sr, II, III, IV)
  normalized = normalized.replace(/\b(jr\.?|sr\.?|ii|iii|iv)\b/g, '')
  
  // Remove diacritics (handles Vučević → Vucevic, etc.)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  // Remove special characters but keep spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ')
  
  // Remove hyphens and apostrophes (treat as spaces)
  normalized = normalized.replace(/[-']/g, ' ')
  
  // Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  return normalized
}

/**
 * Find potential player matches in nba_players table
 */
async function findPlayerMatches(
  supabase: SupabaseClient,
  propPlayerName: string,
  options: MatchOptions = {}
): Promise<PlayerMatch[]> {
  const normalizedPropName = normalizePlayerName(propPlayerName)
  const nameParts = normalizedPropName.split(' ').filter(p => p.length > 0)
  
  if (nameParts.length < 2) {
    return []
  }
  
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]
  const maxMatches = options.maxMatches || 10
  
  // Search by first name (more reliable with special characters in last names)
  const { data: players, error } = await supabase
    .from('nba_players')
    .select('id, nba_player_id, name, team_abbreviation')
    .ilike('name', `${firstName}%`)
    .limit(200)
  
  if (error || !players) {
    console.error('Error searching players:', error)
    return []
  }
  
  // Filter to matches using normalized names
  const matches: PlayerMatch[] = []
  const seenIds = new Set<string>()
  
  for (const player of players) {
    if (seenIds.has(player.id)) continue
    
    const normalizedPlayerName = normalizePlayerName(player.name)
    const playerParts = normalizedPlayerName.split(' ').filter(p => p.length > 0)
    
    // Exact normalized match
    if (normalizedPlayerName === normalizedPropName) {
      matches.push({
        player_id: player.id,
        nba_player_id: player.nba_player_id,
        name: player.name,
        team_abbreviation: player.team_abbreviation || undefined
      })
      seenIds.add(player.id)
      continue
    }
    
    // First and last name match (handles "Jabari Smith" matching "Jabari Smith Jr.")
    if (playerParts.length >= 2 && nameParts.length >= 2) {
      const playerFirstName = playerParts[0]
      const playerLastName = playerParts[playerParts.length - 1]
      
      if (firstName === playerFirstName && lastName === playerLastName) {
        matches.push({
          player_id: player.id,
          nba_player_id: player.nba_player_id,
          name: player.name,
          team_abbreviation: player.team_abbreviation || undefined
        })
        seenIds.add(player.id)
        continue
      }
    }
    
    // Partial match (one contains the other)
    if (normalizedPlayerName.includes(normalizedPropName) || normalizedPropName.includes(normalizedPlayerName)) {
      if (playerParts.length >= 2 && nameParts.length >= 2) {
        const playerFirstName = playerParts[0]
        const playerLastName = playerParts[playerParts.length - 1]
        if (firstName === playerFirstName || lastName === playerLastName) {
          matches.push({
            player_id: player.id,
            nba_player_id: player.nba_player_id,
            name: player.name,
            team_abbreviation: player.team_abbreviation || undefined
          })
          seenIds.add(player.id)
        }
      }
    }
  }
  
  // If team tricode provided, prefer matches with that team
  if (options.teamTricode && matches.length > 1) {
    const teamMatches = matches.filter(m => m.team_abbreviation === options.teamTricode)
    if (teamMatches.length > 0) {
      return teamMatches.slice(0, maxMatches)
    }
  }
  
  return matches.slice(0, maxMatches)
}

/**
 * Match a player name from player_props to nba_players
 * 
 * @param supabase - Supabase client instance
 * @param propPlayerName - Player name from player_props table
 * @param options - Matching options
 * @returns PlayerMatch if found, null otherwise
 * 
 * @example
 * ```typescript
 * import { matchPlayerName } from '@/utils/playerNameMatcher'
 * import { supabase } from '@/utils/supabase'
 * 
 * const match = await matchPlayerName(supabase, 'Nikola Vucevic')
 * if (match) {
 *   console.log(`Found: ${match.name} (${match.player_id})`)
 * }
 * ```
 */
export async function matchPlayerName(
  supabase: SupabaseClient,
  propPlayerName: string,
  options: MatchOptions = {}
): Promise<PlayerMatch | null> {
  if (!propPlayerName) return null
  
  const useCache = options.useCache !== false
  const cacheKey = `${normalizePlayerName(propPlayerName)}:${options.teamTricode || ''}`
  
  // Check cache
  if (useCache && matchCache.has(cacheKey)) {
    return matchCache.get(cacheKey) || null
  }
  
  // Find matches
  const matches = await findPlayerMatches(supabase, propPlayerName, options)
  
  if (matches.length === 0) {
    return null
  }
  
  // Select best match
  const normalizedPropName = normalizePlayerName(propPlayerName)
  
  // Prefer exact normalized match with team info
  let bestMatch = matches.find(m => 
    normalizePlayerName(m.name) === normalizedPropName && m.team_abbreviation
  )
  
  // Fallback to exact normalized match
  if (!bestMatch) {
    bestMatch = matches.find(m => 
      normalizePlayerName(m.name) === normalizedPropName
    )
  }
  
  // Fallback to first match with team info
  if (!bestMatch) {
    bestMatch = matches.find(m => m.team_abbreviation)
  }
  
  // Final fallback to first match
  if (!bestMatch) {
    bestMatch = matches[0]
  }
  
  // Cache the result
  if (useCache && bestMatch) {
    matchCache.set(cacheKey, bestMatch)
  }
  
  return bestMatch
}

/**
 * Match multiple player names at once
 * 
 * @param supabase - Supabase client instance
 * @param propPlayerNames - Array of player names from player_props
 * @param options - Matching options
 * @returns Map of propPlayerName -> PlayerMatch (or null if not found)
 * 
 * @example
 * ```typescript
 * const names = ['Nikola Vucevic', 'Luka Doncic', 'Unknown Player']
 * const matches = await matchPlayerNames(supabase, names)
 * 
 * matches.forEach((match, name) => {
 *   if (match) {
 *     console.log(`${name} → ${match.name}`)
 *   } else {
 *     console.log(`${name} → Not found`)
 *   }
 * })
 * ```
 */
export async function matchPlayerNames(
  supabase: SupabaseClient,
  propPlayerNames: string[],
  options: MatchOptions = {}
): Promise<Map<string, PlayerMatch | null>> {
  const results = new Map<string, PlayerMatch | null>()
  
  // Process in parallel (with small delay to avoid rate limiting)
  const promises = propPlayerNames.map(async (name, index) => {
    // Small delay to avoid overwhelming the database
    if (index > 0) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    const match = await matchPlayerName(supabase, name, options)
    return { name, match }
  })
  
  const resolved = await Promise.all(promises)
  
  resolved.forEach(({ name, match }) => {
    results.set(name, match)
  })
  
  return results
}

/**
 * Clear the match cache
 * Useful when player data is updated
 */
export function clearMatchCache(): void {
  matchCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: matchCache.size,
    keys: Array.from(matchCache.keys())
  }
}
