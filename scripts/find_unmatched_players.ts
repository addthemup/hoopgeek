import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qbznyaimnrpibmahisue.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function findUnmatchedPlayers() {
  console.log('🔍 Finding all unmatched player names in player_props...\n')
  
  // Get all unique player names where player_id is null
  // We'll need to do this in chunks since Supabase has limits
  const unmatchedNames = new Set<string>()
  let offset = 0
  const limit = 1000
  let hasMore = true
  
  while (hasMore) {
    const { data: props, error } = await supabase
      .from('player_props')
      .select('player_name')
      .is('player_id', null)
      .order('player_name')
      .range(offset, offset + limit - 1)
    
    if (error) {
      console.error('❌ Error fetching props:', error)
      break
    }
    
    if (!props || props.length === 0) {
      hasMore = false
      break
    }
    
    props.forEach(prop => {
      if (prop.player_name) {
        unmatchedNames.add(prop.player_name)
      }
    })
    
    console.log(`  Processed ${offset + props.length} props, found ${unmatchedNames.size} unique unmatched names...`)
    
    if (props.length < limit) {
      hasMore = false
    } else {
      offset += limit
    }
  }
  
  console.log(`\n✅ Found ${unmatchedNames.size} unique unmatched player names\n`)
  
  // Count props for each unmatched name
  const nameCounts = new Map<string, number>()
  
  for (const name of unmatchedNames) {
    const { count, error } = await supabase
      .from('player_props')
      .select('*', { count: 'exact', head: true })
      .eq('player_name', name)
      .is('player_id', null)
    
    if (!error && count !== null) {
      nameCounts.set(name, count)
    }
  }
  
  // Sort by count (descending)
  const sortedNames = Array.from(nameCounts.entries())
    .sort((a, b) => b[1] - a[1])
  
  console.log('📊 Unmatched players sorted by prop count:\n')
  console.log('Player Name'.padEnd(40), 'Props Count')
  console.log('-'.repeat(60))
  
  sortedNames.forEach(([name, count]) => {
    console.log(name.padEnd(40), count.toString().padStart(10))
  })
  
  console.log(`\n📈 Summary:`)
  console.log(`   Total unique unmatched names: ${unmatchedNames.size}`)
  console.log(`   Total unmatched props: ${Array.from(nameCounts.values()).reduce((a, b) => a + b, 0)}`)
  
  // Save to file for easy reference
  const fs = await import('fs/promises')
  const output = {
    totalUniqueNames: unmatchedNames.size,
    totalProps: Array.from(nameCounts.values()).reduce((a, b) => a + b, 0),
    players: sortedNames.map(([name, count]) => ({ name, count }))
  }
  
  await fs.writeFile(
    'scripts/unmatched_players.json',
    JSON.stringify(output, null, 2)
  )
  
  console.log(`\n💾 Saved results to scripts/unmatched_players.json`)
  
  return sortedNames
}

findUnmatchedPlayers().catch(console.error)
