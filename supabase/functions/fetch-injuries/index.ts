import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InjuryData {
  playerName: string
  team: string
  status: string
  reason: string
  gameDate?: string
  gameTime?: string
  matchup?: string
}

/**
 * Generate possible PDF URLs for today
 * NBA publishes injury reports multiple times per day (typically 8AM, 4PM, etc.)
 */
function generatePdfUrls(date: Date): string[] {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`
  
  const baseUrl = 'https://ak-static.cms.nba.com/referee/injury'
  
  // Common times NBA publishes injury reports
  // Prioritize 8:00 AM and 5:00 PM formats (08_00AM, 05_00PM) as these have been successful
  // Format uses HH_MMAM/PM (e.g., 08_00AM, 05_00PM)
  // Try both old format (for backwards compatibility) and new format
  const timesOldFormat = [
    '08AM', '05PM', '04PM', '12PM', '10AM', '06PM'
  ]
  const timesNewFormat = [
    '08_00AM', '05_00PM', '10_00AM', '12_00PM', '04_00PM', '06_00PM'
  ]
  
  // Generate URLs - prioritize 08_00AM and 05_00PM by trying them first
  const urls: string[] = []
  // Try new format first (prioritize 08_00AM and 05_00PM)
  timesNewFormat.forEach(time => {
    urls.push(`${baseUrl}/Injury-Report_${dateStr}_${time}.pdf`)
  })
  // Then try old format as fallback
  timesOldFormat.forEach(time => {
    urls.push(`${baseUrl}/Injury-Report_${dateStr}_${time}.pdf`)
  })
  
  return urls
}

/**
 * Try to fetch PDF from multiple possible URLs
 */
async function fetchInjuryPdf(date: Date): Promise<Uint8Array | null> {
  const urls = generatePdfUrls(date)
  
  for (const url of urls) {
    try {
      console.log(`📄 Trying to fetch: ${url}`)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf',
        }
      })
      
      if (response.ok && response.headers.get('content-type')?.includes('pdf')) {
        console.log(`✅ Found PDF at: ${url}`)
        const arrayBuffer = await response.arrayBuffer()
        return new Uint8Array(arrayBuffer)
      }
    } catch (error) {
      console.log(`⚠️  Failed to fetch ${url}: ${error.message}`)
      continue
    }
  }
  
  return null
}

/**
 * Parse PDF text content
 * Uses Deno-compatible PDF.js library
 */
async function parsePdfText(pdfBytes: Uint8Array): Promise<string> {
  try {
    // Use Deno-compatible PDF.js library
    const { getDocument } = await import('https://deno.land/x/pdfjs@2.10.377/build/pdf.js')
    
    // Load the PDF document
    const pdf = await getDocument({ data: pdfBytes }).promise
    let fullText = ''
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      
      // Combine all text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      
      fullText += pageText + '\n'
    }
    
    return fullText
  } catch (error: any) {
    console.error('❌ Error parsing PDF:', error)
    throw new Error(`PDF parsing failed: ${error.message}`)
  }
}

/**
 * Parse injury data from PDF text
 * The PDF contains a table with: Game Date | Game Time | Matchup | Team | Player Name | Current Status | Reason
 */
function parseInjuryData(text: string, reportDate: Date): InjuryData[] {
  const injuries: InjuryData[] = []
  const lines = text.split('\n')
  
  let currentGameDate: string | null = null
  let currentGameTime: string | null = null
  let currentMatchup: string | null = null
  let currentTeam: string | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty lines and headers
    if (!line || line.includes('Injury Report') || line.includes('Game Date') || line.includes('---')) {
      continue
    }
    
    // Try to detect game date (format: MM/DD/YYYY)
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/)
    if (dateMatch) {
      currentGameDate = dateMatch[1]
      continue
    }
    
    // Try to detect game time (format: HH:MM (ET))
    const timeMatch = line.match(/(\d{1,2}:\d{2})\s*\(ET\)/)
    if (timeMatch) {
      currentGameTime = timeMatch[1]
      continue
    }
    
    // Try to detect matchup (format: TEAM@TEAM or TEAM vs TEAM)
    const matchupMatch = line.match(/([A-Z]{3}@[A-Z]{3}|[A-Z]{3}\s+vs\s+[A-Z]{3})/i)
    if (matchupMatch) {
      currentMatchup = matchupMatch[1]
      continue
    }
    
    // Try to detect team name (common team patterns)
    const teamMatch = line.match(/(Washington Wizards|Philadelphia 76ers|Portland Trail Blazers|Toronto Raptors|Memphis Grizzlies|San Antonio Spurs|Minnesota Timberwolves|New Orleans Pelicans|New York Knicks|Boston Celtics|Oklahoma City Thunder|Golden State Warriors|Denver Nuggets|Indiana Pacers|Cleveland Cavaliers|Orlando Magic|Charlotte Hornets|LA Clippers|Atlanta Hawks|Brooklyn Nets|Chicago Bulls|Detroit Pistons|Milwaukee Bucks|Sacramento Kings|Houston Rockets|Miami Heat|Dallas Mavericks|Los Angeles Lakers|Phoenix Suns|Utah Jazz)/i)
    if (teamMatch) {
      currentTeam = teamMatch[1]
      continue
    }
    
    // Try to parse injury row
    // Pattern: Player Name | Status | Reason
    // Status can be: Out, Questionable, Probable, Available
    const statusMatch = line.match(/(Out|Questionable|Probable|Available)/i)
    if (statusMatch && currentTeam) {
      // Try to extract player name and reason
      const parts = line.split(/\s+(Out|Questionable|Probable|Available)\s+/i)
      if (parts.length >= 2) {
        const playerName = parts[0].trim()
        const status = statusMatch[1]
        const reason = parts.slice(2).join(' ').trim() || line.split(status)[1]?.trim() || ''
        
        if (playerName && playerName.length > 1 && !playerName.includes('NOT YET SUBMITTED')) {
          injuries.push({
            playerName: playerName.replace(/,/g, '').trim(), // Remove commas from names like "Drummond, Andre"
            team: currentTeam,
            status: status,
            reason: reason,
            gameDate: currentGameDate || undefined,
            gameTime: currentGameTime || undefined,
            matchup: currentMatchup || undefined,
          })
        }
      }
    }
    
    // Alternative pattern: Look for player name followed by status
    // Format: "Last, First | Status | Reason"
    const playerStatusPattern = /^([A-Z][a-z]+(?:,\s*[A-Z][a-z]+(?:\s+[A-Z]\.?)?)?)\s+(Out|Questionable|Probable|Available)\s+(.+)$/i
    const playerMatch = line.match(playerStatusPattern)
    if (playerMatch && currentTeam) {
      const [, playerName, status, reason] = playerMatch
      if (playerName && !playerName.includes('NOT YET SUBMITTED')) {
        injuries.push({
          playerName: playerName.replace(/,/g, '').trim(),
          team: currentTeam,
          status: status,
          reason: reason.trim(),
          gameDate: currentGameDate || undefined,
          gameTime: currentGameTime || undefined,
          matchup: currentMatchup || undefined,
        })
      }
    }
  }
  
  return injuries
}

/**
 * Normalize team name to abbreviation
 */
function normalizeTeamName(teamName: string): string {
  const teamMap: Record<string, string> = {
    'Washington Wizards': 'WAS',
    'Philadelphia 76ers': 'PHI',
    'Portland Trail Blazers': 'POR',
    'Toronto Raptors': 'TOR',
    'Memphis Grizzlies': 'MEM',
    'San Antonio Spurs': 'SAS',
    'Minnesota Timberwolves': 'MIN',
    'New Orleans Pelicans': 'NOP',
    'New York Knicks': 'NYK',
    'Boston Celtics': 'BOS',
    'Oklahoma City Thunder': 'OKC',
    'Golden State Warriors': 'GSW',
    'Denver Nuggets': 'DEN',
    'Indiana Pacers': 'IND',
    'Cleveland Cavaliers': 'CLE',
    'Orlando Magic': 'ORL',
    'Charlotte Hornets': 'CHA',
    'LA Clippers': 'LAC',
    'Los Angeles Clippers': 'LAC',
    'Atlanta Hawks': 'ATL',
    'Brooklyn Nets': 'BKN',
    'Chicago Bulls': 'CHI',
    'Detroit Pistons': 'DET',
    'Milwaukee Bucks': 'MIL',
    'Sacramento Kings': 'SAC',
    'Houston Rockets': 'HOU',
    'Miami Heat': 'MIA',
    'Dallas Mavericks': 'DAL',
    'Los Angeles Lakers': 'LAL',
    'Phoenix Suns': 'PHX',
    'Utah Jazz': 'UTA',
  }
  
  return teamMap[teamName] || teamName
}

/**
 * Find NBA player ID from name and team
 */
async function findPlayerId(
  supabase: any,
  playerName: string,
  teamAbbreviation: string
): Promise<number | null> {
  try {
    // Try exact match first
    let { data, error } = await supabase
      .from('nba_players')
      .select('nba_player_id, name')
      .ilike('name', `%${playerName}%`)
      .eq('team_abbreviation', teamAbbreviation)
      .eq('is_active', true)
      .limit(5)
      .execute()
    
    if (error) throw error
    
    if (data && data.length > 0) {
      // If multiple matches, try to find best match
      if (data.length === 1) {
        return data[0].nba_player_id
      }
      
      // Try to match more precisely
      const normalizedSearch = playerName.toLowerCase().replace(/[.,]/g, '').trim()
      for (const player of data) {
        const normalizedName = player.name.toLowerCase().replace(/[.,]/g, '').trim()
        if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName.split(' ')[0])) {
          return player.nba_player_id
        }
      }
      
      // Return first match if no better match found
      return data[0].nba_player_id
    }
    
    // Try without team filter
    const { data: data2, error: error2 } = await supabase
      .from('nba_players')
      .select('nba_player_id, name')
      .ilike('name', `%${playerName}%`)
      .eq('is_active', true)
      .limit(1)
      .execute()
    
    if (error2) throw error2
    
    if (data2 && data2.length > 0) {
      return data2[0].nba_player_id
    }
    
    return null
  } catch (error) {
    console.error(`❌ Error finding player ${playerName}:`, error)
    return null
  }
}

/**
 * Normalize injury status
 */
function normalizeInjuryStatus(status: string): string {
  const statusLower = status.toLowerCase().trim()
  if (statusLower === 'out') return 'Out'
  if (statusLower === 'questionable') return 'Questionable'
  if (statusLower === 'probable') return 'Probable'
  if (statusLower === 'available') return 'Healthy'
  return 'Unknown'
}

/**
 * Store injuries in database
 * This function:
 * 1. Marks all existing current injuries as not current (they're from older reports)
 * 2. Inserts new injury records for players on the current report (marked as current)
 * 3. Ensures players NOT on the current report have their injuries marked as not current
 */
async function storeInjuries(supabase: any, injuries: InjuryData[], reportDate: Date) {
  console.log(`💾 Processing ${injuries.length} injuries from report dated ${reportDate.toISOString().split('T')[0]}...`)
  
  const reportTimestamp = new Date().toISOString()
  
  // Step 1: Mark all existing injuries as not current (they're from older reports)
  console.log('   📋 Marking old injuries as not current...')
  try {
    const { error: updateError } = await supabase
      .from('nba_injuries')
      .update({ is_current: false })
      .eq('is_current', true)
      .execute()
    
    if (updateError) {
      console.log(`   ⚠️  Warning: Could not mark old injuries as not current: ${updateError.message}`)
    } else {
      console.log('   ✅ Marked existing injuries as not current')
    }
  } catch (error: any) {
    console.log(`   ⚠️  Warning: Could not mark old injuries as not current: ${error.message}`)
  }
  
  // Step 2: Track which players are on the current report
  const currentReportPlayerIds = new Set<number>()
  
  // Step 3: Process each injury from the current report
  let stored = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  
  for (const injury of injuries) {
    try {
      const teamAbbreviation = normalizeTeamName(injury.team)
      const nbaPlayerId = await findPlayerId(supabase, injury.playerName, teamAbbreviation)
      
      if (!nbaPlayerId) {
        console.log(`⚠️  Could not find player: ${injury.playerName} (${teamAbbreviation})`)
        skipped++
        continue
      }
      
      currentReportPlayerIds.add(nbaPlayerId)
      
      // Parse injury type and description from reason
      const reasonParts = injury.reason.split(';')
      const injuryType = reasonParts[0]?.trim() || null
      const injuryDescription = reasonParts.slice(1).join(';').trim() || injury.reason
      
      const injuryData = {
        nba_player_id: nbaPlayerId,
        injury_type: injuryType,
        injury_description: injuryDescription || injury.reason,
        injury_status: normalizeInjuryStatus(injury.status),
        date_updated: reportDate.toISOString(),
        report_timestamp: reportTimestamp,
        is_current: true, // Mark as current since it's on this report
        source: 'nba_official_pdf',
        source_url: `https://ak-static.cms.nba.com/referee/injury/Injury-Report_${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${String(reportDate.getDate()).padStart(2, '0')}_*.pdf`,
        raw_data: {
          player_name: injury.playerName,
          team: injury.team,
          game_date: injury.gameDate,
          game_time: injury.gameTime,
          matchup: injury.matchup,
        }
      }
      
      // Check if player already has a current injury record
      const { data: existingData, error: checkError } = await supabase
        .from('nba_injuries')
        .select('id')
        .eq('nba_player_id', nbaPlayerId)
        .eq('is_current', true)
        .limit(1)
        .execute()
      
      if (checkError) {
        console.error(`❌ Error checking existing injury for ${injury.playerName}:`, checkError)
        errors++
        continue
      }
      
      if (existingData && existingData.length > 0) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('nba_injuries')
          .update(injuryData)
          .eq('id', existingData[0].id)
          .execute()
        
        if (updateError) {
          console.error(`❌ Error updating injury for ${injury.playerName}:`, updateError)
          errors++
        } else {
          updated++
          console.log(`✅ Updated: ${injury.playerName} (${injury.status})`)
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('nba_injuries')
          .insert(injuryData)
          .execute()
        
        if (insertError) {
          console.error(`❌ Error storing injury for ${injury.playerName}:`, insertError)
          errors++
        } else {
          stored++
          console.log(`✅ Stored: ${injury.playerName} (${injury.status})`)
        }
      }
    } catch (error: any) {
      console.error(`❌ Error processing injury for ${injury.playerName}:`, error)
      errors++
    }
  }
  
  // Step 4: For players NOT on the current report, ensure their injuries are marked as not current
  // (This handles cases where a player was on a previous report but is now healthy)
  console.log('   🏥 Checking players not on current report...')
  try {
    // Get all players with current injuries
    const { data: allCurrentInjuries, error: fetchError } = await supabase
      .from('nba_injuries')
      .select('nba_player_id')
      .eq('is_current', true)
      .execute()
    
    if (fetchError) {
      console.log(`   ⚠️  Warning: Could not fetch current injuries: ${fetchError.message}`)
    } else if (allCurrentInjuries) {
      const playersToMarkHealthy = allCurrentInjuries
        .filter((inj: any) => !currentReportPlayerIds.has(inj.nba_player_id))
        .map((inj: any) => inj.nba_player_id)
      
      if (playersToMarkHealthy.length > 0) {
        // Mark these players' injuries as not current (they're no longer on the report)
        const { error: markError } = await supabase
          .from('nba_injuries')
          .update({ is_current: false })
          .in('nba_player_id', playersToMarkHealthy)
          .eq('is_current', true)
          .execute()
        
        if (markError) {
          console.log(`   ⚠️  Warning: Could not mark players as healthy: ${markError.message}`)
        } else {
          console.log(`   ✅ Marked ${playersToMarkHealthy.length} players as no longer on injury report`)
        }
      }
    }
  } catch (error: any) {
    console.log(`   ⚠️  Warning: Could not check players not on report: ${error.message}`)
  }
  
  console.log(`\n📊 Storage Summary:`)
  console.log(`   Stored: ${stored}`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Errors: ${errors}`)
  
  return { stored, updated, skipped, errors }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get target date from query params or use today
    const url = new URL(req.url)
    const targetDateParam = url.searchParams.get('date')
    const targetDate = targetDateParam 
      ? new Date(targetDateParam)
      : new Date()

    console.log('🏀 Starting NBA Injury Report Fetch...')
    console.log(`📅 Target date: ${targetDate.toISOString().split('T')[0]}`)

    // Fetch PDF
    const pdfBytes = await fetchInjuryPdf(targetDate)
    
    if (!pdfBytes) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not fetch injury report PDF for today. PDF may not be published yet or URL pattern changed.' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`✅ Fetched PDF (${pdfBytes.length} bytes)`)

    // Parse PDF
    const pdfText = await parsePdfText(pdfBytes)
    console.log(`✅ Parsed PDF text (${pdfText.length} characters)`)

    // Extract injury data
    const injuries = parseInjuryData(pdfText, targetDate)
    console.log(`✅ Extracted ${injuries.length} injuries from PDF`)

    if (injuries.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No injuries found in PDF. PDF format may have changed.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Store injuries
    const result = await storeInjuries(supabase, injuries, targetDate)

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate.toISOString().split('T')[0],
        injuries_found: injuries.length,
        stored: result.stored,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

