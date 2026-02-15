import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractPDFText } from 'https://esm.sh/unpdf@0.6.1'

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
 * Uses unpdf (esm.sh) - serverless PDF.js build that works in Deno Edge
 */
async function parsePdfText(pdfBytes: Uint8Array): Promise<string> {
  try {
    const { text } = await extractPDFText(pdfBytes, { mergePages: true })
    return text ?? ''
  } catch (error: any) {
    console.error('❌ Error parsing PDF:', error)
    throw new Error(`PDF parsing failed: ${error.message}`)
  }
}

// Status values from NBA injury report PDF (exact token match)
const STATUS_TOKENS = new Set(['Out', 'Doubtful', 'Questionable', 'Probable', 'Available'])

// Team names that can appear in PDF (multi-word: try longest first)
const TEAM_NAMES = [
  'Portland Trail Blazers', 'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder',
  'Golden State Warriors', 'San Antonio Spurs', 'Minnesota Timberwolves', 'Los Angeles Lakers',
  'Washington Wizards', 'Philadelphia 76ers', 'Toronto Raptors', 'Memphis Grizzlies',
  'Cleveland Cavaliers', 'Indiana Pacers', 'Charlotte Hornets', 'Atlanta Hawks', 'Brooklyn Nets',
  'Chicago Bulls', 'Detroit Pistons', 'Milwaukee Bucks', 'Sacramento Kings', 'Houston Rockets',
  'Miami Heat', 'Dallas Mavericks', 'Phoenix Suns', 'Utah Jazz', 'Orlando Magic', 'LA Clippers',
  'Boston Celtics', 'Denver Nuggets',
]

function matchTeamAt(tokens: string[], i: number): { name: string; wordCount: number } | null {
  for (const team of TEAM_NAMES) {
    const words = team.split(' ')
    if (i + words.length > tokens.length) continue
    const slice = tokens.slice(i, i + words.length).join(' ')
    if (slice === team) return { name: team, wordCount: words.length }
  }
  return null
}

function isStatusToken(t: string): boolean {
  return STATUS_TOKENS.has(t)
}

/**
 * Parse injury data from PDF text.
 * The NBA PDF extractor (unpdf) returns one word per line, so we parse a stream of tokens:
 * ... Team PlayerLast, PlayerFirst Status ReasonTokens NextPlayerLast ...
 */
function parseInjuryData(text: string, _reportDate: Date): InjuryData[] {
  const injuries: InjuryData[] = []
  const tokens = text.split(/\r?\n/).map((t) => t.trim()).filter((t) => t.length > 0)

  let currentGameDate: string | null = null
  let currentGameTime: string | null = null
  let currentMatchup: string | null = null
  let currentTeam: string | null = null
  let rowStart = 0

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    // Skip header / page footer tokens
    if (t === 'Injury' || t === 'Report:' || t === 'Page' || t === 'of' || t === 'Game' || t === 'Date' || t === 'Time' || t === 'Matchup' || t === 'Team' || t === 'Player' || t === 'Name' || t === 'Current' || t === 'Status' || t === 'Reason') {
      continue
    }

    // Game date (MM/DD/YYYY only; skip 02/09/26 style)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) {
      currentGameDate = t
      continue
    }

    // Game time: "07:00" followed by "(ET)"
    if (/^\d{1,2}:\d{2}$/.test(t) && tokens[i + 1] === '(ET)') {
      currentGameTime = t
      i += 1
      continue
    }

    // Matchup: DET@CHA
    if (/^[A-Z]{3}@[A-Z]{3}$/i.test(t)) {
      currentMatchup = t
      continue
    }

    // Team name (multi-word)
    const teamAt = matchTeamAt(tokens, i)
    if (teamAt) {
      currentTeam = teamAt.name
      rowStart = i + teamAt.wordCount
      i += teamAt.wordCount - 1
      continue
    }

    // Status token → one injury row: player = tokens[rowStart..i), reason = tokens[i+1..j)
    if (isStatusToken(t) && currentTeam) {
      const playerName = tokens.slice(rowStart, i).join(' ').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
      if (!playerName || playerName.includes('NOT') && tokens[rowStart] === 'NOT') {
        i++
        continue
      }

      let j = i + 1
      while (j < tokens.length) {
        const next = tokens[j]
        if (isStatusToken(next)) break
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(next)) break
        if (/^\d{1,2}:\d{2}$/.test(next) && tokens[j + 1] === '(ET)') break
        if (/^[A-Z]{3}@[A-Z]{3}$/i.test(next)) break
        if (matchTeamAt(tokens, j)) break
        if (next === 'Injury' && tokens[j + 1] === 'Report:') break
        j++
      }

      const reason = tokens.slice(i + 1, j).join(' ').trim()
      if (!playerName.includes('NOT YET SUBMITTED')) {
        injuries.push({
          playerName,
          team: currentTeam,
          status: t,
          reason,
          gameDate: currentGameDate ?? undefined,
          gameTime: currentGameTime ?? undefined,
          matchup: currentMatchup ?? undefined,
        })
      }

      if (j < tokens.length && tokens[j] === 'Injury' && tokens[j + 1] === 'Report:') {
        j += 2
        while (j < tokens.length) {
          if (isStatusToken(tokens[j]) || /^\d{2}\/\d{2}\/\d{4}$/.test(tokens[j]) || matchTeamAt(tokens, j) || /^[A-Z]{3}@[A-Z]{3}$/i.test(tokens[j])) break
          if (tokens[j] === 'Game' && tokens[j + 1] === 'Date') j += 10
          else j++
        }
        // After page header, extraction order may put reason text first. Skip until we see a player last name (PDF uses "Last,").
        while (j < tokens.length && !tokens[j].endsWith(',')) {
          if (tokens[j] === 'Game' && tokens[j + 1] === 'Date') j += 10
          else j++
        }
      }
      if (j < tokens.length && isStatusToken(tokens[j])) {
        rowStart = j + 1
      } else if (j < tokens.length) {
        const nextTeam = matchTeamAt(tokens, j)
        if (nextTeam) rowStart = j + nextTeam.wordCount
        else rowStart = j
      }
      i = j - 1
      continue
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
 * PDF gives "Last, First" → we normalize to "Last First". DB stores "First Last".
 * Return [original, flipped] so we can try both.
 */
function searchNamesForLookup(playerName: string): string[] {
  const parts = playerName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return [playerName]
  const flipped = [...parts].reverse().join(' ')
  return [playerName, flipped]
}

/**
 * Find NBA player ID from name and team.
 * Tries both "Last First" (PDF format) and "First Last" (DB format).
 */
async function findPlayerId(
  supabase: any,
  playerName: string,
  teamAbbreviation: string
): Promise<number | null> {
  const namesToTry = searchNamesForLookup(playerName)
  try {
    for (const searchName of namesToTry) {
      let { data, error } = await supabase
        .from('nba_players')
        .select('nba_player_id, name')
        .ilike('name', `%${searchName}%`)
        .eq('team_abbreviation', teamAbbreviation)
        .eq('is_active', true)
        .limit(5)

      if (error) throw error

      if (data && data.length > 0) {
        if (data.length === 1) return data[0].nba_player_id
        const normalizedSearch = searchName.toLowerCase().replace(/[.,]/g, '').trim()
        for (const player of data) {
          const normalizedName = player.name.toLowerCase().replace(/[.,]/g, '').trim()
          if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName.split(' ')[0])) {
            return player.nba_player_id
          }
        }
        return data[0].nba_player_id
      }
    }

    for (const searchName of namesToTry) {
      const { data: data2, error: error2 } = await supabase
        .from('nba_players')
        .select('nba_player_id, name')
        .ilike('name', `%${searchName}%`)
        .eq('is_active', true)
        .limit(1)

      if (error2) throw error2
      if (data2 && data2.length > 0) return data2[0].nba_player_id
    }

    // Fallback: try first name only + team (e.g. "Cade" on DET for "Cunningham Cade")
    const parts = playerName.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const firstName = parts[parts.length - 1]
      const { data: data3, error: error3 } = await supabase
        .from('nba_players')
        .select('nba_player_id, name')
        .ilike('name', `%${firstName}%`)
        .eq('team_abbreviation', teamAbbreviation)
        .eq('is_active', true)
        .limit(5)
      if (!error3 && data3 && data3.length === 1) return data3[0].nba_player_id
      if (!error3 && data3 && data3.length > 1) {
        const fullFlipped = [...parts].reverse().join(' ')
        const match = data3.find((p: { name: string }) => p.name.toLowerCase().includes(fullFlipped.toLowerCase()) || fullFlipped.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]))
        if (match) return match.nba_player_id
        return data3[0].nba_player_id
      }
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
 * Store injuries in database.
 * When historical=false (default): mark all current as not current, then insert/update with is_current=true.
 * When historical=true: delete existing records for this report date, then insert all with is_current=false (no touch to "current").
 */
async function storeInjuries(supabase: any, injuries: InjuryData[], reportDate: Date, historical: boolean = false) {
  console.log(`💾 Processing ${injuries.length} injuries from report dated ${reportDate.toISOString().split('T')[0]}${historical ? ' (historical)' : ''}...`)
  
  const reportTimestamp = new Date().toISOString()
  const reportDateStr = reportDate.toISOString().split('T')[0]
  const dayStart = `${reportDateStr}T00:00:00.000Z`
  const dayEnd = `${reportDateStr}T23:59:59.999Z`

  if (historical) {
    console.log('   📋 Removing existing injuries for this report date (historical overwrite)...')
    try {
      const { error: deleteError } = await supabase
        .from('nba_injuries')
        .delete()
        .gte('date_updated', dayStart)
        .lte('date_updated', dayEnd)
        .eq('source', 'nba_official_pdf')
      if (deleteError) console.log(`   ⚠️  Delete warning: ${deleteError.message}`)
    } catch (e: any) {
      console.log(`   ⚠️  Delete warning: ${e.message}`)
    }
  } else {
    // Step 1: Mark all existing injuries as not current (they're from older reports)
    console.log('   📋 Marking old injuries as not current...')
    try {
      const { error: updateError } = await supabase
        .from('nba_injuries')
        .update({ is_current: false })
        .eq('is_current', true)
      if (updateError) {
        console.log(`   ⚠️  Warning: Could not mark old injuries as not current: ${updateError.message}`)
      } else {
        console.log('   ✅ Marked existing injuries as not current')
      }
    } catch (error: any) {
      console.log(`   ⚠️  Warning: Could not mark old injuries as not current: ${error.message}`)
    }
  }

  const currentReportPlayerIds = new Set<number>()
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
        is_current: historical ? false : true,
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

      if (historical) {
        const { error: insertError } = await supabase.from('nba_injuries').insert(injuryData)
        if (insertError) {
          console.error(`❌ Error storing injury for ${injury.playerName}:`, insertError)
          errors++
        } else {
          stored++
        }
        continue
      }
      
      const { data: existingData, error: checkError } = await supabase
        .from('nba_injuries')
        .select('id')
        .eq('nba_player_id', nbaPlayerId)
        .eq('is_current', true)
        .limit(1)
      
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
  
  if (historical) {
    console.log(`   ✅ Historical: stored ${stored}, skipped ${skipped}, errors ${errors}`)
    return { stored, updated, skipped, errors }
  }

  // Step 4: For players NOT on the current report, ensure their injuries are marked as not current
  console.log('   🏥 Checking players not on current report...')
  try {
    // Get all players with current injuries
    const { data: allCurrentInjuries, error: fetchError } = await supabase
      .from('nba_injuries')
      .select('nba_player_id')
      .eq('is_current', true)
    
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

    const url = new URL(req.url)
    const targetDateParam = url.searchParams.get('date')
    const targetDate = targetDateParam 
      ? new Date(targetDateParam)
      : new Date()
    const historical = url.searchParams.get('historical') === 'true'

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
      const sample = pdfText.slice(0, 4000)
      const lineCount = pdfText.split(/\r?\n/).length
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No injuries found in PDF. PDF format may have changed.',
          debug: {
            pdfTextLength: pdfText.length,
            lineCount,
            sampleLines: pdfText.split(/\r?\n/).slice(0, 120).filter((l) => l.trim()),
            sampleRaw: sample,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const result = await storeInjuries(supabase, injuries, targetDate, historical)

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

