import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qbznyaimnrpibmahisue.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Normalize player name for matching
 */
function normalizePlayerName(name: string): string {
  if (!name) return ''
  
  let normalized = name.trim().toLowerCase()
  normalized = normalized.replace(/\b(jr\.?|sr\.?|ii|iii|iv)\b/g, '')
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  normalized = normalized.replace(/[^\w\s]/g, ' ')
  normalized = normalized.replace(/[-']/g, ' ')
  normalized = normalized.replace(/\s+/g, ' ').trim()
  
  return normalized
}

/**
 * Find players by various name patterns
 */
async function findPlayerVariations(propName: string, knownVariations: string[] = []) {
  const allVariations = [propName, ...knownVariations]
  const allMatches = new Map<string, any>()
  
  for (const searchName of allVariations) {
    const normalized = normalizePlayerName(searchName)
    const parts = normalized.split(' ').filter(p => p.length > 0)
    
    if (parts.length === 0) continue
    
    const firstName = parts[0]
    const lastName = parts[parts.length - 1]
    
    // Try searching by first name
    const { data: players1 } = await supabase
      .from('nba_players')
      .select('id, nba_player_id, name, team_abbreviation')
      .ilike('name', `${firstName}%`)
      .limit(100)
    
    // Try searching by last name
    const { data: players2 } = await supabase
      .from('nba_players')
      .select('id, nba_player_id, name, team_abbreviation')
      .ilike('name', `%${lastName}%`)
      .limit(100)
    
    const allPlayers = [...(players1 || []), ...(players2 || [])]
    
    // Filter to matches
    allPlayers.forEach(p => {
      const normalizedPlayerName = normalizePlayerName(p.name)
      const playerParts = normalizedPlayerName.split(' ').filter(p => p.length > 0)
      
      // Exact normalized match
      if (normalizedPlayerName === normalized) {
        allMatches.set(p.id, p)
        return
      }
      
      // First and last name match
      if (playerParts.length >= 2 && parts.length >= 2) {
        const playerFirstName = playerParts[0]
        const playerLastName = playerParts[playerParts.length - 1]
        
        if (firstName === playerFirstName && lastName === playerLastName) {
          allMatches.set(p.id, p)
          return
        }
      }
      
      // Partial match (one contains the other)
      if (normalizedPlayerName.includes(normalized) || normalized.includes(normalizedPlayerName)) {
        if (playerParts.length >= 2 && parts.length >= 2) {
          const playerFirstName = playerParts[0]
          const playerLastName = playerParts[playerParts.length - 1]
          if (firstName === playerFirstName || lastName === playerLastName) {
            allMatches.set(p.id, p)
          }
        }
      }
    })
  }
  
  return Array.from(allMatches.values())
}

/**
 * Update player props
 */
async function updatePlayerProps(propPlayerName: string, playerId: string, nbaPlayerId: number) {
  const { data: props, error: fetchError } = await supabase
    .from('player_props')
    .select('id')
    .eq('player_name', propPlayerName)
    .is('player_id', null)
    .limit(10000)
  
  if (fetchError || !props || props.length === 0) {
    return { success: 0, error: 0 }
  }
  
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
      errorCount += batch.length
    } else {
      successCount += batch.length
    }
  }
  
  return { success: successCount, error: errorCount }
}

/**
 * Match a specific player with variations
 */
async function matchPlayerWithVariations(propName: string, knownVariations: string[] = []) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`Matching: "${propName}"`)
  if (knownVariations.length > 0) {
    console.log(`Variations: ${knownVariations.join(', ')}`)
  }
  console.log(`${'='.repeat(70)}`)
  
  const matches = await findPlayerVariations(propName, knownVariations)
  
  if (matches.length === 0) {
    console.log(`❌ No matches found`)
    return { matched: false, propName }
  }
  
  console.log(`\n📋 Found ${matches.length} potential match(es):`)
  matches.forEach((match, idx) => {
    console.log(`  ${idx + 1}. ${match.name} (${match.team_abbreviation || 'N/A'})`)
    console.log(`     ID: ${match.id}`)
    console.log(`     NBA ID: ${match.nba_player_id}`)
    console.log(`     Normalized: ${normalizePlayerName(match.name)}`)
    console.log(`     vs Prop: ${normalizePlayerName(propName)}`)
    console.log('')
  })
  
  // Select best match
  const normalizedPropName = normalizePlayerName(propName)
  let bestMatch = matches.find(m => 
    normalizePlayerName(m.name) === normalizedPropName && m.team_abbreviation
  ) || matches.find(m => 
    normalizePlayerName(m.name) === normalizedPropName
  ) || matches[0]
  
  console.log(`✅ Selected match: ${bestMatch.name} (${bestMatch.team_abbreviation || 'N/A'})`)
  console.log(`   ID: ${bestMatch.id}`)
  console.log(`   NBA ID: ${bestMatch.nba_player_id}`)
  
  // Update props
  console.log(`\n🔄 Updating props...`)
  const result = await updatePlayerProps(propName, bestMatch.id, bestMatch.nba_player_id)
  
  console.log(`\n✅ Updated ${result.success} props`)
  if (result.error > 0) {
    console.log(`❌ Failed to update ${result.error} props`)
  }
  
  return { 
    matched: result.success > 0, 
    propName, 
    dbName: bestMatch.name,
    propsUpdated: result.success,
    playerId: bestMatch.id,
    nbaPlayerId: bestMatch.nba_player_id
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Matching specific players from list...\n')
  
  const playersToMatch = [
    { propName: 'Q Post', variations: ['Quentin Post', 'Q. Post'] },
    { propName: 'Alexandre Sarr', variations: ['Alex Sarr', 'Alexandre Sarr'] },
    { propName: 'Airious Bailey', variations: ['Ace Bailey', 'Airious Bailey'] },
    { propName: 'Ron Holland', variations: ['Ron Holland II', 'Ron Holland', 'Ronald Holland'] },
    { propName: 'Daniel Wolf', variations: ['Danny Wolf', 'Daniel Wolf'] },
    { propName: 'Collin Murrayboyles', variations: ['Collin Murray-Boyles', 'Collin Murray Boyles'] },
    { propName: 'Kentavious Caldwellpope', variations: ['Kentavious Caldwell-Pope', 'KCP'] },
    { propName: 'Dayron Sharpe', variations: ["Day'Ron Sharpe", "Dayron Sharpe", "Day Ron Sharpe"] },
    { propName: 'Trayce Jacksondavis', variations: ['Trayce Jackson-Davis', 'Trayce Jackson Davis'] },
    { propName: 'C Flagg', variations: ['Cooper Flagg', 'C. Flagg'] }
  ]
  
  const results = {
    matched: [] as any[],
    notFound: [] as string[]
  }
  
  for (const { propName, variations } of playersToMatch) {
    const result = await matchPlayerWithVariations(propName, variations)
    
    if (result.matched) {
      results.matched.push(result)
    } else {
      results.notFound.push(propName)
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(70)}`)
  console.log('📊 MATCHING SUMMARY')
  console.log(`${'='.repeat(70)}\n`)
  
  console.log(`✅ Successfully Matched: ${results.matched.length}`)
  const totalProps = results.matched.reduce((sum, r) => sum + (r.propsUpdated || 0), 0)
  console.log(`   Total props updated: ${totalProps}`)
  
  if (results.matched.length > 0) {
    console.log(`\n   Matched players:`)
    results.matched.forEach(r => {
      console.log(`     - ${r.propName} → ${r.dbName} (${r.propsUpdated || 0} props)`)
    })
  }
  
  console.log(`\n❌ Not Found: ${results.notFound.length}`)
  if (results.notFound.length > 0) {
    console.log(`\n   Players not found:`)
    results.notFound.forEach(name => {
      console.log(`     - ${name}`)
    })
  }
}

main().catch(console.error)
