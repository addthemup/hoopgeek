import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'

const SUPABASE_URL = 'https://qbznyaimnrpibmahisue.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Normalize player name for matching - handles special characters, casing, etc.
 */
function normalizePlayerName(name: string): string {
  if (!name) return ''
  
  // Convert to lowercase and trim
  let normalized = name.trim().toLowerCase()
  
  // Remove common suffixes
  normalized = normalized.replace(/\b(jr\.?|sr\.?|ii|iii|iv)\b/g, '')
  
  // Remove diacritics (handles Vučević -> Vucevic, etc.)
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
 * Find potential matches for a player name in nba_players
 */
async function findPlayerMatches(propPlayerName: string) {
  const normalizedPropName = normalizePlayerName(propPlayerName)
  const nameParts = normalizedPropName.split(' ').filter(p => p.length > 0)
  
  if (nameParts.length < 2) {
    return []
  }
  
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]
  
  // Search by first name (more reliable with special characters)
  const { data: players, error } = await supabase
    .from('nba_players')
    .select('id, nba_player_id, name, team_abbreviation')
    .ilike('name', `${firstName}%`)
    .limit(200)
  
  if (error) {
    console.error('Error searching players:', error)
    return []
  }
  
  if (!players) return []
  
  // Filter to matches using normalized names
  const matches = players.filter(p => {
    const normalizedPlayerName = normalizePlayerName(p.name)
    const playerParts = normalizedPlayerName.split(' ').filter(p => p.length > 0)
    
    // Exact normalized match
    if (normalizedPlayerName === normalizedPropName) return true
    
    // First and last name match (handles "Jabari Smith" matching "Jabari Smith Jr.")
    if (playerParts.length >= 2 && nameParts.length >= 2) {
      const playerFirstName = playerParts[0]
      const playerLastName = playerParts[playerParts.length - 1]
      
      if (firstName === playerFirstName && lastName === playerLastName) {
        return true
      }
    }
    
    // Check if normalized names are similar (one contains the other)
    if (normalizedPlayerName.includes(normalizedPropName) || normalizedPropName.includes(normalizedPlayerName)) {
      // Make sure it's not too different (at least first and last name match)
      if (playerParts.length >= 2 && nameParts.length >= 2) {
        const playerFirstName = playerParts[0]
        const playerLastName = playerParts[playerParts.length - 1]
        if (firstName === playerFirstName || lastName === playerLastName) {
          return true
        }
      }
    }
    
    return false
  })
  
  return matches
}

/**
 * Update player props with matched player IDs
 */
async function updatePlayerProps(propPlayerName: string, playerId: string, nbaPlayerId: number) {
  const { data: props, error: fetchError } = await supabase
    .from('player_props')
    .select('id')
    .eq('player_name', propPlayerName)
    .is('player_id', null)
    .limit(10000)
  
  if (fetchError) {
    console.error('Error fetching props:', fetchError)
    return { success: 0, error: 1 }
  }
  
  if (!props || props.length === 0) {
    return { success: 0, error: 0 }
  }
  
  // Update in batches
  const batchSize = 100
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < props.length; i += batchSize) {
    const batch = props.slice(i, i + batchSize)
    const propIds = batch.map(p => p.id)
    
    const { error: updateError } = await supabase
      .from('player_props')
      .update({
        player_id: playerId,
        nba_player_id: nbaPlayerId
      })
      .in('id', propIds)
    
    if (updateError) {
      console.error(`Error updating batch ${i / batchSize + 1}:`, updateError)
      errorCount += batch.length
    } else {
      successCount += batch.length
    }
  }
  
  return { success: successCount, error: errorCount }
}

/**
 * Match a specific player
 */
async function matchPlayer(propPlayerName: string, dbPlayerName?: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Matching: "${propPlayerName}"`)
  if (dbPlayerName) {
    console.log(`Target: "${dbPlayerName}"`)
  }
  console.log(`${'='.repeat(70)}`)
  
  // Find potential matches
  const searchName = dbPlayerName || propPlayerName
  const matches = await findPlayerMatches(searchName)
  
  if (matches.length === 0) {
    console.log(`❌ No matches found`)
    return false
  }
  
  console.log(`\n📋 Found ${matches.length} potential match(es):`)
  matches.forEach((match, idx) => {
    console.log(`  ${idx + 1}. ${match.name} (${match.team_abbreviation || 'N/A'})`)
    console.log(`     ID: ${match.id}`)
    console.log(`     NBA ID: ${match.nba_player_id}`)
    console.log(`     Normalized: ${normalizePlayerName(match.name)}`)
    console.log(`     vs Prop: ${normalizePlayerName(propPlayerName)}`)
    console.log('')
  })
  
  // Select best match (prefer exact match, then prefer players with team info)
  let bestMatch = matches.find(m => 
    normalizePlayerName(m.name) === normalizePlayerName(searchName) && m.team_abbreviation
  ) || matches.find(m => 
    normalizePlayerName(m.name) === normalizePlayerName(searchName)
  ) || matches[0]
  
  console.log(`✅ Selected match: ${bestMatch.name} (${bestMatch.team_abbreviation || 'N/A'})`)
  console.log(`   ID: ${bestMatch.id}`)
  console.log(`   NBA ID: ${bestMatch.nba_player_id}`)
  
  // Update props
  console.log(`\n🔄 Updating props...`)
  const result = await updatePlayerProps(propPlayerName, bestMatch.id, bestMatch.nba_player_id)
  
  console.log(`\n✅ Updated ${result.success} props`)
  if (result.error > 0) {
    console.log(`❌ Failed to update ${result.error} props`)
  }
  
  return result.success > 0
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/match_unmatched_player.ts <prop_player_name> [db_player_name]')
    console.log('\nExamples:')
    console.log('  npx tsx scripts/match_unmatched_player.ts "Nikola Vucevic" "Nikola Vučević"')
    console.log('  npx tsx scripts/match_unmatched_player.ts "Jabari Smith" "Jabari Smith Jr."')
    console.log('\nOr run without args to see unmatched players:')
    
    // Show top unmatched players
    try {
      const data = JSON.parse(await readFile('scripts/unmatched_players.json', 'utf-8'))
      console.log(`\n📊 Top 10 unmatched players:`)
      data.players.slice(0, 10).forEach((p: any, idx: number) => {
        console.log(`  ${idx + 1}. ${p.name} (${p.count} props)`)
      })
    } catch (e) {
      console.log('  (Run find_unmatched_players.ts first to see the list)')
    }
    return
  }
  
  const propPlayerName = args[0]
  const dbPlayerName = args[1]
  
  await matchPlayer(propPlayerName, dbPlayerName)
}

main().catch(console.error)
