import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qbznyaimnrpibmahisue.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Normalize player name for matching - handles special characters, casing, etc.
 * This handles cases like "Nikola Vucevic" vs "Nikola Vučević"
 */
export function normalizePlayerName(name: string): string {
  if (!name) return ''
  
  // Convert to lowercase and trim
  let normalized = name.trim().toLowerCase()
  
  // Remove common suffixes
  normalized = normalized.replace(/\b(jr\.?|sr\.?|ii|iii|iv)\b/g, '')
  
  // Remove diacritics (handles Vučević -> Vucevic, etc.)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  // Remove special characters but keep spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ')
  
  // Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  return normalized
}

/**
 * Find potential matches for a player name in nba_players
 */
export async function findPlayerMatches(dbPlayerName: string) {
  const normalizedDbName = normalizePlayerName(dbPlayerName)
  const nameParts = normalizedDbName.split(' ')
  
  if (nameParts.length < 2) {
    return []
  }
  
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]
  
  // Search by first name (more reliable with special characters in last names)
  // Then filter by last name in code
  const { data: players, error } = await supabase
    .from('nba_players')
    .select('id, nba_player_id, name, team_abbreviation')
    .ilike('name', `${firstName}%`)
    .limit(100)
  
  if (error) {
    console.error('Error searching players:', error)
    return []
  }
  
  if (!players) return []
  
  // Filter to matches - check if normalized names match or if first+last match
  const matches = players.filter(p => {
    const normalizedPlayerName = normalizePlayerName(p.name)
    const playerParts = normalizedPlayerName.split(' ')
    
    // Exact normalized match
    if (normalizedPlayerName === normalizedDbName) return true
    
    // First and last name match (handles "Jabari Smith" matching "Jabari Smith Jr.")
    if (playerParts.length >= 2 && nameParts.length >= 2) {
      const playerFirstName = playerParts[0]
      const playerLastName = playerParts[playerParts.length - 1]
      
      if (firstName === playerFirstName && lastName === playerLastName) {
        return true
      }
    }
    
    // Check if one name contains the other (handles variations)
    if (normalizedPlayerName.includes(normalizedDbName) || normalizedDbName.includes(normalizedPlayerName)) {
      return true
    }
    
    return false
  })
  
  return matches
}

/**
 * Find unmatched props for a specific player name
 */
export async function findUnmatchedProps(playerName: string, limit: number = 100) {
  const { data: props, error } = await supabase
    .from('player_props')
    .select('id, player_name, game_id, game_date, bet_type, player_id, nba_player_id')
    .ilike('player_name', playerName)
    .is('player_id', null)
    .is('nba_player_id', null)
    .limit(limit)
  
  if (error) {
    console.error('Error fetching props:', error)
    return []
  }
  
  return props || []
}

/**
 * Update a single player prop with matched IDs
 */
export async function updatePlayerProp(propId: string, playerId: string, nbaPlayerId: number) {
  const { error } = await supabase
    .from('player_props')
    .update({
      player_id: playerId,
      nba_player_id: nbaPlayerId
    })
    .eq('id', propId)
  
  if (error) {
    console.error(`❌ Error updating prop ${propId}:`, error)
    return false
  }
  
  return true
}

/**
 * Match and update all props for a player
 */
export async function matchAndUpdatePlayer(propPlayerName: string, dbPlayerName: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Matching: ${propPlayerName} → ${dbPlayerName}`)
  console.log(`${'='.repeat(60)}`)
  
  // Find unmatched props
  const props = await findUnmatchedProps(propPlayerName)
  console.log(`📊 Found ${props.length} unmatched props`)
  
  if (props.length === 0) {
    console.log('✅ No unmatched props found')
    return
  }
  
  // Find the player in database
  const matches = await findPlayerMatches(dbPlayerName)
  
  if (matches.length === 0) {
    console.log(`❌ No matches found for "${dbPlayerName}"`)
    return
  }
  
  // Find exact match, preferring players with team info
  let exactMatch = matches.find(m => 
    normalizePlayerName(m.name) === normalizePlayerName(dbPlayerName) && m.team_abbreviation
  ) || matches.find(m => 
    normalizePlayerName(m.name) === normalizePlayerName(dbPlayerName)
  )
  
  // If no exact match, try to match by normalized name (handles "Jabari Smith" -> "Jabari Smith Jr.")
  if (!exactMatch) {
    const normalizedDbName = normalizePlayerName(dbPlayerName)
    exactMatch = matches.find(m => {
      const normalizedMatchName = normalizePlayerName(m.name)
      // Check if dbPlayerName is contained in match name or vice versa
      return normalizedMatchName.includes(normalizedDbName) || normalizedDbName.includes(normalizedMatchName)
    })
  }
  
  // Fallback to first match
  if (!exactMatch) {
    exactMatch = matches[0]
  }
  
  console.log(`✅ Found match: ${exactMatch.name} (${exactMatch.team_abbreviation || 'N/A'})`)
  console.log(`   ID: ${exactMatch.id}`)
  console.log(`   NBA ID: ${exactMatch.nba_player_id}`)
  
  // Update all props
  console.log(`\n🔄 Updating ${props.length} props...`)
  let successCount = 0
  let errorCount = 0
  
  for (const prop of props) {
    const success = await updatePlayerProp(prop.id, exactMatch.id, exactMatch.nba_player_id)
    if (success) {
      successCount++
    } else {
      errorCount++
    }
  }
  
  console.log(`\n✅ Updated ${successCount} props`)
  if (errorCount > 0) {
    console.log(`❌ Failed to update ${errorCount} props`)
  }
}

/**
 * Main function - match specific players
 */
async function main() {
  console.log('🔍 Player Matching Utility\n')
  
  // Match Vucevic (prop name: "Nikola Vucevic" → db name: "Nikola Vučević")
  console.log('\n1. Matching Vucevic...')
  await matchAndUpdatePlayer('Nikola Vucevic', 'Nikola Vučević')
  
  // Match Jabari Smith (prop name: "Jabari Smith" → db name: "Jabari Smith Jr." for HOU)
  console.log('\n2. Matching Jabari Smith...')
  await matchAndUpdatePlayer('Jabari Smith', 'Jabari Smith Jr.')
  
  console.log('\n✅ Done!')
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
