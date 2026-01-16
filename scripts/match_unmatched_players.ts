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
  
  // Remove special characters but keep spaces
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
  const strategies = [
    // 1. Exact normalized match
    async () => {
      const { data } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, team_abbreviation')
        .limit(limit)
      
      if (!data) return []
      
      return data.filter(p => normalizePlayerName(p.name) === normalizedPropName)
    },
    
    // 2. First and last name match
    async () => {
      if (propNameParts.length < 2) return []
      
      const firstName = propNameParts[0]
      const lastName = propNameParts[propNameParts.length - 1]
      
      const { data } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, team_abbreviation')
        .ilike('name', `%${firstName}%`)
        .ilike('name', `%${lastName}%`)
        .limit(limit)
      
      return data || []
    },
    
    // 3. Last name match (common for matching)
    async () => {
      if (propNameParts.length < 1) return []
      
      const lastName = propNameParts[propNameParts.length - 1]
      
      const { data } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, team_abbreviation')
        .ilike('name', `%${lastName}%`)
        .limit(limit)
      
      return data || []
    }
  ]
  
  const allMatches = new Map<string, any>()
  
  for (const strategy of strategies) {
    const matches = await strategy()
    for (const match of matches) {
      if (!allMatches.has(match.id)) {
        allMatches.set(match.id, match)
      }
    }
  }
  
  return Array.from(allMatches.values())
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
 * Main function to find and match unmatched players
 */
async function matchUnmatchedPlayers() {
  console.log('🔍 Finding unmatched player props...\n')
  
  // Get all props where both player_id and nba_player_id are null
  const { data: unmatchedProps, error } = await supabase
    .from('player_props')
    .select('id, player_name, game_id, game_date, bet_type')
    .is('player_id', null)
    .is('nba_player_id', null)
    .order('player_name')
    .limit(100)
  
  if (error) {
    console.error('❌ Error fetching unmatched props:', error)
    return
  }
  
  if (!unmatchedProps || unmatchedProps.length === 0) {
    console.log('✅ No unmatched props found!')
    return
  }
  
  console.log(`📊 Found ${unmatchedProps.length} unmatched props\n`)
  
  // Group by player name
  const propsByPlayerName = new Map<string, any[]>()
  unmatchedProps.forEach(prop => {
    const name = prop.player_name
    if (!propsByPlayerName.has(name)) {
      propsByPlayerName.set(name, [])
    }
    propsByPlayerName.get(name)!.push(prop)
  })
  
  console.log(`📊 Unique unmatched player names: ${propsByPlayerName.size}\n`)
  
  // Process each unique player name
  for (const [playerName, props] of propsByPlayerName.entries()) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Player: ${playerName}`)
    console.log(`Props count: ${props.length}`)
    console.log(`Normalized: ${normalizePlayerName(playerName)}`)
    console.log(`${'='.repeat(60)}`)
    
    // Find potential matches
    const matches = await findPotentialMatches(playerName, 10)
    
    if (matches.length === 0) {
      console.log('  ❌ No potential matches found')
      continue
    }
    
    console.log(`\n  📋 Potential matches (${matches.length}):`)
    matches.forEach((match, idx) => {
      console.log(`  ${idx + 1}. ${match.name} (${match.team_abbreviation || 'N/A'})`)
      console.log(`     ID: ${match.id}`)
      console.log(`     NBA ID: ${match.nba_player_id}`)
      console.log(`     Normalized: ${normalizePlayerName(match.name)}`)
      console.log('')
    })
    
    // For now, just show the matches
    // In a UI, you would let the user select which match is correct
    console.log(`  💡 To match, use: updatePlayerProp(propId, '${matches[0]?.id}', ${matches[0]?.nba_player_id})`)
  }
  
  // Example: Match specific players
  console.log(`\n\n${'='.repeat(60)}`)
  console.log('EXAMPLES FOR MANUAL MATCHING:')
  console.log(`${'='.repeat(60)}\n`)
  
  // Find Vucevic
  const vucevicProps = unmatchedProps.filter(p => 
    normalizePlayerName(p.player_name).includes('vucevic')
  )
  if (vucevicProps.length > 0) {
    const vucevicMatches = await findPotentialMatches('Nikola Vucevic')
    if (vucevicMatches.length > 0) {
      console.log('Vucevic matches:')
      vucevicMatches.forEach(m => {
        console.log(`  - ${m.name} (${m.id}, ${m.nba_player_id})`)
      })
      console.log(`\n  To update all Vucevic props:`)
      console.log(`  vucevicProps.forEach(prop => updatePlayerProp(prop.id, '${vucevicMatches[0].id}', ${vucevicMatches[0].nba_player_id}))`)
    }
  }
  
  // Find Jabari Smith
  const jabariProps = unmatchedProps.filter(p => 
    normalizePlayerName(p.player_name).includes('jabari') && 
    normalizePlayerName(p.player_name).includes('smith')
  )
  if (jabariProps.length > 0) {
    const jabariMatches = await findPotentialMatches('Jabari Smith')
    if (jabariMatches.length > 0) {
      console.log('\nJabari Smith matches:')
      jabariMatches.forEach(m => {
        console.log(`  - ${m.name} (${m.id}, ${m.nba_player_id})`)
      })
      console.log(`\n  To update all Jabari Smith props:`)
      console.log(`  jabariProps.forEach(prop => updatePlayerProp(prop.id, '${jabariMatches[0].id}', ${jabariMatches[0].nba_player_id}))`)
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  matchUnmatchedPlayers().catch(console.error)
}

export { matchUnmatchedPlayers, findPotentialMatches, updatePlayerProp, normalizePlayerName }
