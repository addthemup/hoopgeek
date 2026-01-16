import { createClient } from '@supabase/supabase-js'

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
  
  // Remove special characters but keep spaces (handles Vučević -> Vucevic)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
  normalized = normalized.replace(/[^\w\s]/g, ' ') // Replace special chars with space
  
  // Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  return normalized
}

/**
 * Find potential matches for an unmatched player name
 */
async function findPotentialMatches(propPlayerName: string, limit: number = 10) {
  const normalizedPropName = normalizePlayerName(propPlayerName)
  const propNameParts = normalizedPropName.split(' ')
  
  // Try multiple matching strategies
  const allMatches = new Map<string, any>()
  
  // Strategy 1: Exact normalized match
  const { data: allPlayers } = await supabase
    .from('nba_players')
    .select('id, nba_player_id, name, team_abbreviation')
    .limit(5000)
  
  if (allPlayers) {
    allPlayers.forEach(p => {
      const normalizedDbName = normalizePlayerName(p.name)
      if (normalizedDbName === normalizedPropName) {
        allMatches.set(p.id, p)
      }
    })
  }
  
  // Strategy 2: First and last name match
  if (propNameParts.length >= 2) {
    const firstName = propNameParts[0]
    const lastName = propNameParts[propNameParts.length - 1]
    
    if (allPlayers) {
      allPlayers.forEach(p => {
        const normalizedDbName = normalizePlayerName(p.name)
        const dbParts = normalizedDbName.split(' ')
        if (dbParts.length >= 2) {
          const dbFirstName = dbParts[0]
          const dbLastName = dbParts[dbParts.length - 1]
          
          if (firstName === dbFirstName && lastName === dbLastName) {
            if (!allMatches.has(p.id)) {
              allMatches.set(p.id, p)
            }
          }
        }
      })
    }
  }
  
  // Strategy 3: Last name match (common for matching)
  if (propNameParts.length >= 1) {
    const lastName = propNameParts[propNameParts.length - 1]
    
    if (allPlayers && lastName.length > 2) {
      allPlayers.forEach(p => {
        const normalizedDbName = normalizePlayerName(p.name)
        const dbParts = normalizedDbName.split(' ')
        const dbLastName = dbParts[dbParts.length - 1]
        
        if (lastName === dbLastName && propNameParts.length === dbParts.length) {
          if (!allMatches.has(p.id)) {
            allMatches.set(p.id, p)
          }
        }
      })
    }
  }
  
  return Array.from(allMatches.values()).slice(0, limit)
}

/**
 * Update player props with matched player IDs
 */
async function updatePlayerProp(propId: string, playerId: string, nbaPlayerId: number) {
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
 * Match specific players
 */
async function matchSpecificPlayers() {
  const playersToMatch = [
    { propName: 'Nikola Vucevic', searchName: 'Nikola Vucevic' },
    { propName: 'Jabari Smith', searchName: 'Jabari Smith' }
  ]
  
  for (const { propName, searchName } of playersToMatch) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Matching: ${propName}`)
    console.log(`${'='.repeat(60)}`)
    
    // Find props with this name (case-insensitive)
    const { data: props, error: propsError } = await supabase
      .from('player_props')
      .select('id, player_name, game_id, game_date, bet_type, player_id, nba_player_id')
      .ilike('player_name', `%${propName}%`)
      .limit(100)
    
    if (propsError) {
      console.error(`❌ Error fetching props:`, propsError)
      continue
    }
    
    if (!props || props.length === 0) {
      console.log(`  ⚠️  No props found for "${propName}"`)
      continue
    }
    
    // Filter to only unmatched props
    const unmatchedProps = props.filter(p => !p.player_id && !p.nba_player_id)
    const matchedProps = props.filter(p => p.player_id || p.nba_player_id)
    
    console.log(`  📊 Total props: ${props.length}`)
    console.log(`  ✅ Already matched: ${matchedProps.length}`)
    console.log(`  ❌ Unmatched: ${unmatchedProps.length}`)
    
    if (unmatchedProps.length === 0) {
      console.log(`  ✅ All props are already matched!`)
      continue
    }
    
    // Find potential matches
    console.log(`\n  🔍 Searching for matches...`)
    const matches = await findPotentialMatches(searchName, 10)
    
    if (matches.length === 0) {
      console.log(`  ❌ No potential matches found`)
      continue
    }
    
    console.log(`\n  📋 Potential matches (${matches.length}):`)
    matches.forEach((match, idx) => {
      console.log(`  ${idx + 1}. ${match.name} (${match.team_abbreviation || 'N/A'})`)
      console.log(`     ID: ${match.id}`)
      console.log(`     NBA ID: ${match.nba_player_id}`)
      console.log(`     Normalized: ${normalizePlayerName(match.name)}`)
      console.log(`     vs Prop: ${normalizePlayerName(propName)}`)
      console.log('')
    })
    
    // Show the best match
    const bestMatch = matches[0]
    if (bestMatch) {
      console.log(`  ✅ Best match: ${bestMatch.name}`)
      console.log(`  💡 To update all ${unmatchedProps.length} props:`)
      console.log(`     unmatchedProps.forEach(prop => updatePlayerProp(prop.id, '${bestMatch.id}', ${bestMatch.nba_player_id}))`)
      
      // Ask if we should auto-match (for now, just show the command)
      console.log(`\n  ⚠️  Run the update command manually to match these props`)
    }
  }
}

// Run
matchSpecificPlayers().catch(console.error)
