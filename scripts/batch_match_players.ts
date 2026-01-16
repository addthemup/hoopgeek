import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'

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
 * Find potential matches for a player name
 */
async function findPlayerMatches(propPlayerName: string) {
  const normalizedPropName = normalizePlayerName(propPlayerName)
  const nameParts = normalizedPropName.split(' ').filter(p => p.length > 0)
  
  if (nameParts.length < 2) {
    return []
  }
  
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]
  
  const { data: players, error } = await supabase
    .from('nba_players')
    .select('id, nba_player_id, name, team_abbreviation')
    .ilike('name', `${firstName}%`)
    .limit(200)
  
  if (error || !players) return []
  
  const matches = players.filter(p => {
    const normalizedPlayerName = normalizePlayerName(p.name)
    const playerParts = normalizedPlayerName.split(' ').filter(p => p.length > 0)
    
    if (normalizedPlayerName === normalizedPropName) return true
    
    if (playerParts.length >= 2 && nameParts.length >= 2) {
      const playerFirstName = playerParts[0]
      const playerLastName = playerParts[playerParts.length - 1]
      
      if (firstName === playerFirstName && lastName === playerLastName) {
        return true
      }
    }
    
    if (normalizedPlayerName.includes(normalizedPropName) || normalizedPropName.includes(normalizedPlayerName)) {
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
 * Determine if a match is confident enough to auto-match
 */
function isConfidentMatch(propName: string, matches: any[]): { confident: boolean; bestMatch?: any; reason?: string } {
  if (matches.length === 0) {
    return { confident: false, reason: 'No matches found' }
  }
  
  if (matches.length === 1) {
    return { confident: true, bestMatch: matches[0] }
  }
  
  // Check for exact normalized match
  const normalizedPropName = normalizePlayerName(propName)
  const exactMatch = matches.find(m => normalizePlayerName(m.name) === normalizedPropName)
  if (exactMatch) {
    return { confident: true, bestMatch: exactMatch }
  }
  
  // If multiple matches, prefer one with team info
  const withTeam = matches.filter(m => m.team_abbreviation)
  if (withTeam.length === 1) {
    return { confident: true, bestMatch: withTeam[0] }
  }
  
  // If all matches have same normalized name, pick first
  const allNormalized = matches.map(m => normalizePlayerName(m.name))
  const uniqueNormalized = [...new Set(allNormalized)]
  if (uniqueNormalized.length === 1) {
    return { confident: true, bestMatch: matches[0] }
  }
  
  return { confident: false, reason: `Multiple different matches (${matches.length})` }
}

/**
 * Process all unmatched players
 */
async function batchMatchPlayers() {
  console.log('🚀 Starting batch player matching...\n')
  
  // Read unmatched players
  const data = JSON.parse(await readFile('scripts/unmatched_players.json', 'utf-8'))
  const players = data.players as Array<{ name: string; count: number }>
  
  console.log(`📊 Processing ${players.length} unmatched players\n`)
  
  const results = {
    matched: [] as Array<{ propName: string; dbName: string; propsUpdated: number; playerId: string; nbaPlayerId: number }>,
    needsReview: [] as Array<{ propName: string; matches: any[]; reason: string }>,
    notFound: [] as Array<{ propName: string; count: number }>
  }
  
  for (let i = 0; i < players.length; i++) {
    const { name: propName, count } = players[i]
    
    console.log(`[${i + 1}/${players.length}] ${propName} (${count} props)...`)
    
    const matches = await findPlayerMatches(propName)
    
    if (matches.length === 0) {
      console.log(`  ❌ No matches found`)
      results.notFound.push({ propName, count })
      continue
    }
    
    const { confident, bestMatch, reason } = isConfidentMatch(propName, matches)
    
    if (confident && bestMatch) {
      console.log(`  ✅ Confident match: ${bestMatch.name} (${bestMatch.team_abbreviation || 'N/A'})`)
      
      const updateResult = await updatePlayerProps(propName, bestMatch.id, bestMatch.nba_player_id)
      
      if (updateResult.success > 0) {
        console.log(`  ✅ Updated ${updateResult.success} props`)
        results.matched.push({
          propName,
          dbName: bestMatch.name,
          propsUpdated: updateResult.success,
          playerId: bestMatch.id,
          nbaPlayerId: bestMatch.nba_player_id
        })
      } else {
        console.log(`  ⚠️  No props updated (may already be matched)`)
      }
    } else {
      console.log(`  ⚠️  Needs review: ${reason || 'Multiple matches'}`)
      console.log(`     Matches: ${matches.map(m => `${m.name} (${m.team_abbreviation || 'N/A'})`).join(', ')}`)
      results.needsReview.push({
        propName,
        matches,
        reason: reason || 'Multiple matches'
      })
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Print summary
  console.log(`\n\n${'='.repeat(70)}`)
  console.log('📊 BATCH MATCHING SUMMARY')
  console.log(`${'='.repeat(70)}\n`)
  
  console.log(`✅ Successfully Matched: ${results.matched.length}`)
  const totalMatchedProps = results.matched.reduce((sum, r) => sum + r.propsUpdated, 0)
  console.log(`   Total props updated: ${totalMatchedProps}`)
  if (results.matched.length > 0) {
    console.log(`\n   Matched players:`)
    results.matched.forEach(r => {
      console.log(`     - ${r.propName} → ${r.dbName} (${r.propsUpdated} props)`)
    })
  }
  
  console.log(`\n⚠️  Needs Manual Review: ${results.needsReview.length}`)
  if (results.needsReview.length > 0) {
    console.log(`\n   Players needing review:`)
    results.needsReview.forEach(r => {
      console.log(`     - ${r.propName} (${r.reason})`)
      r.matches.forEach((m, idx) => {
        console.log(`       ${idx + 1}. ${m.name} (${m.team_abbreviation || 'N/A'}) - ID: ${m.id}`)
      })
    })
  }
  
  console.log(`\n❌ No Matches Found: ${results.notFound.length}`)
  if (results.notFound.length > 0) {
    console.log(`\n   Players with no matches:`)
    results.notFound.forEach(r => {
      console.log(`     - ${r.propName} (${r.count} props)`)
    })
  }
  
  // Save results
  const fs = await import('fs/promises')
  await fs.writeFile(
    'scripts/batch_match_results.json',
    JSON.stringify(results, null, 2)
  )
  
  console.log(`\n💾 Results saved to scripts/batch_match_results.json`)
}

batchMatchPlayers().catch(console.error)
