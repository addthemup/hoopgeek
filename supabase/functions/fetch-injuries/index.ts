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

interface ResolvedInjury extends InjuryData {
  teamAbbreviation: string
  nbaPlayerId: number
  matchedWith: string
}

interface UnmatchedInjury extends InjuryData {
  teamAbbreviation: string
  attemptedNames: string[]
}

interface TeamAuditRow {
  parsed: number
  matched: number
  stored: number
  updated: number
  unmatched: number
}

interface IngestAudit {
  parsedCount: number
  matchedCount: number
  unmatchedCount: number
  deactivatedCount: number
  parsedRows: InjuryData[]
  unmatched: UnmatchedInjury[]
  teamCounts: Record<string, TeamAuditRow>
}

interface ParseQuality {
  suspiciousNameCount: number
  suspiciousNames: string[]
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
  
  // Common times NBA publishes injury reports.
  // Always try the latest likely report first so we ingest the newest statuses.
  const timesOldFormat = [
    '06PM', '05PM', '04PM', '12PM', '10AM', '08AM'
  ]
  const timesNewFormat = [
    '06_00PM', '05_00PM', '04_00PM', '12_00PM', '10_00AM', '08_00AM'
  ]
  
  // Generate URLs in newest-to-oldest order.
  const urls: string[] = []
  // Try new format first.
  timesNewFormat.forEach(time => {
    urls.push(`${baseUrl}/Injury-Report_${dateStr}_${time}.pdf`)
  })
  // Then old format as fallback.
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

function normalizeApostrophes(s: string): string {
  return s.replace(/[’`]/g, "'")
}

function canonicalName(s: string): string {
  return normalizeApostrophes(s)
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function removeSuffixTokens(name: string): string {
  return name
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)))
}

function normalizePdfPlayerName(rawName: string): string {
  const cleaned = normalizeApostrophes(rawName).replace(/\s+/g, ' ').trim()
  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length < 2) return cleaned
  const normalized = parts.join(' ')
  return normalized
}

function extractLikelyPlayerTokens(tokens: string[]): string[] {
  if (tokens.length === 0) return tokens
  const commaIndexes = tokens
    .map((tok, idx) => ({ tok, idx }))
    .filter(({ tok }) => /[A-Za-z'’`.-]+,$/.test(tok))
    .map(({ idx }) => idx)
  if (commaIndexes.length > 0) {
    let start = commaIndexes[commaIndexes.length - 1]
    const suffixWithComma = /^(Jr|Sr|II|III|IV|V),$/i
    if (suffixWithComma.test(tokens[start]) && start > 0) {
      // Handle "Harper Jr., Ron" style, where suffix token holds the comma.
      start -= 1
    }
    return tokens.slice(start)
  }
  return tokens
}

function looksLikePlayerStartAt(tokens: string[], i: number): boolean {
  const t = tokens[i] || ''
  const t1 = tokens[i + 1] || ''
  const t2 = tokens[i + 2] || ''
  const t3 = tokens[i + 3] || ''
  // "Last, First Status" or "Last, First Jr. Status"
  if (/[A-Za-z'’`.-]+,$/.test(t)) {
    if (isStatusToken(t2)) return true
    if (/^(Jr\.?|Sr\.?|II|III|IV|V)$/i.test(t1) && isStatusToken(t3)) return true
  }
  // "Last Jr., First Status" (suffix carries comma token)
  if (/^[A-Za-z'’`.-]+$/.test(t) && /^(Jr|Sr|II|III|IV|V),$/i.test(t1) && isStatusToken(t3)) {
    return true
  }
  // "LastPart- LastPart, First Status"
  if (t.endsWith('-') && /[A-Za-z'’`.-]+,$/.test(t1) && isStatusToken(tokens[i + 3] || '')) {
    return true
  }
  return false
}

function sanitizeReason(reason: string): string {
  return reason
    .replace(/Injury Report:\s*\d{2}\/\d{2}\/\d{2}\s+\d{2}:\d{2}\s+[AP]M\s+Page\s+\d+\s+of\s+\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function evaluateParseQuality(injuries: InjuryData[]): ParseQuality {
  const suspicious: string[] = []
  const badStart = /^(Jr\.?|Sr\.?|II|III|IV|V)\b/i
  for (const injury of injuries) {
    const name = injury.playerName.trim()
    if (!name) continue
    if (badStart.test(name)) suspicious.push(name)
  }
  return {
    suspiciousNameCount: suspicious.length,
    suspiciousNames: Array.from(new Set(suspicious)).slice(0, 20),
  }
}

function buildSearchNames(playerName: string): string[] {
  const normalized = normalizePdfPlayerName(playerName)
  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return [normalized]

  const flipped = [...parts].reverse().join(' ')
  const withoutSuffix = removeSuffixTokens(normalized)
  const withoutSuffixParts = withoutSuffix.split(/\s+/).filter(Boolean)
  const withoutSuffixFlipped =
    withoutSuffixParts.length > 1 ? [...withoutSuffixParts].reverse().join(' ') : withoutSuffix

  return dedupeStrings([normalized, flipped, withoutSuffix, withoutSuffixFlipped])
}

/**
 * Parse injury data from PDF text.
 * The NBA PDF extractor (unpdf) returns one word per line, so we parse a stream of tokens:
 * ... Team PlayerLast, PlayerFirst Status ReasonTokens NextPlayerLast ...
 */
function parseInjuryData(text: string, _reportDate: Date): InjuryData[] {
  const injuries: InjuryData[] = []
  const lines = text.split(/\r?\n/).map((t) => t.trim()).filter((t) => t.length > 0)
  const statuses = new Set(['Out', 'Questionable', 'Probable', 'Available'])
  const nameWordRe = /^[A-Z][A-Za-z'’`.-]*$/

  const isNameWord = (token: string): boolean => nameWordRe.test(token)
  const cleanReason = (value: string): string => sanitizeReason(value)
  const teamNames = TEAM_NAMES

  const looksLikePlayerStartAtLine = (idx: number): boolean => {
    if (idx + 2 >= lines.length) return false
    const a = lines[idx]
    const b = lines[idx + 1]
    const c = lines[idx + 2]
    if (a.endsWith(',') && isNameWord(a.replace(/,$/, '')) && isNameWord(b) && statuses.has(c)) return true
    if (idx + 3 < lines.length) {
      const d = lines[idx + 3]
      if (
        a.endsWith(',') &&
        isNameWord(a.replace(/,$/, '')) &&
        ['Jr.', 'Jr', 'III', 'II', 'IV', 'Sr.', 'Sr'].includes(b) &&
        isNameWord(c) &&
        statuses.has(d)
      ) {
        return true
      }
      if (a.endsWith('-') && b.endsWith(',') && isNameWord(c) && statuses.has(d)) return true
    }
    return false
  }

  let currentGameDate: string | null = null
  let currentGameTime: string | null = null
  let currentMatchup: string | null = null
  let currentTeam: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) {
      currentGameDate = line
      continue
    }
    if (/^\d{1,2}:\d{2}$/.test(line) && i + 1 < lines.length && lines[i + 1] === '(ET)') {
      currentGameTime = line
      i += 1
      continue
    }
    if (/^[A-Z]{3}@[A-Z]{3}$/i.test(line)) {
      currentMatchup = line
      continue
    }

    let matchedTeam = false
    for (const teamName of teamNames) {
      const teamWords = teamName.split(' ')
      if (i + teamWords.length <= lines.length) {
        const maybeTeam = lines.slice(i, i + teamWords.length).join(' ')
        if (maybeTeam === teamName) {
          currentTeam = teamName
          i += teamWords.length - 1
          matchedTeam = true
          break
        }
      }
    }
    if (matchedTeam || !currentTeam) continue

    if (i + 2 >= lines.length) continue
    const firstWord = lines[i]
    const secondWord = lines[i + 1] || ''
    const thirdWord = lines[i + 2] || ''

    let status = ''
    let playerName = ''
    let j: number | null = null

    // Pattern 1: LastPart-, LastPart, First Status
    if (
      i + 3 < lines.length &&
      firstWord.endsWith('-') &&
      secondWord.endsWith(',') &&
      isNameWord(thirdWord) &&
      statuses.has(lines[i + 3])
    ) {
      const lastNamePart1 = firstWord.slice(0, -1)
      const lastNamePart2 = secondWord.replace(/,$/, '')
      const firstName = thirdWord
      status = lines[i + 3]
      playerName = `${firstName} ${lastNamePart1}-${lastNamePart2}`
      j = i + 4
    }
    // Pattern 2: Last Jr., First Status
    else if (
      i + 3 < lines.length &&
      isNameWord(firstWord) &&
      secondWord.endsWith(',') &&
      ['Jr.,', 'Jr,', 'III,', 'II,', 'IV,', 'Sr.,', 'Sr,'].includes(secondWord) &&
      isNameWord(thirdWord) &&
      statuses.has(lines[i + 3])
    ) {
      const suffix = secondWord.replace(/,$/, '')
      status = lines[i + 3]
      playerName = `${thirdWord} ${firstWord} ${suffix}`
      j = i + 4
    }
    // Pattern 3: Last, First Status
    else if (
      firstWord.endsWith(',') &&
      isNameWord(firstWord.replace(/,$/, '')) &&
      isNameWord(secondWord) &&
      !secondWord.endsWith(',') &&
      statuses.has(thirdWord)
    ) {
      const lastName = firstWord.replace(/,$/, '')
      status = thirdWord
      playerName = `${secondWord} ${lastName}`
      j = i + 3
    }
    // Pattern 4: First Last Status
    else if (isNameWord(firstWord) && isNameWord(secondWord) && statuses.has(thirdWord)) {
      status = thirdWord
      playerName = `${firstWord} ${secondWord}`
      j = i + 3
      if (j < lines.length && ['Jr.', 'Jr', 'III', 'II', 'IV'].includes(lines[j])) {
        playerName = `${playerName} ${lines[j]}`
        j += 1
        if (j < lines.length && statuses.has(lines[j])) {
          status = lines[j]
          j += 1
        }
      }
    }

    if (j === null) continue

    const reasonParts: string[] = []
    while (j < lines.length && j < i + 25) {
      if (looksLikePlayerStartAtLine(j)) break
      const maybeTeamSlice = lines.slice(j, Math.min(j + 4, lines.length)).join(' ')
      if (teamNames.some((teamName) => maybeTeamSlice.includes(teamName))) break
      const word = lines[j]
      if (word === 'Injury' && j + 1 < lines.length && lines[j + 1] === 'Illness') {
        reasonParts.push('Injury/Illness')
        j += 2
        continue
      }
      reasonParts.push(word)
      j += 1
    }

    const reason = cleanReason(reasonParts.join(' ').trim())
    if (playerName.length > 2 && !playerName.includes('NOT YET SUBMITTED')) {
      injuries.push({
        playerName: normalizePdfPlayerName(playerName),
        team: currentTeam,
        status,
        reason,
        gameDate: currentGameDate ?? undefined,
        gameTime: currentGameTime ?? undefined,
        matchup: currentMatchup ?? undefined,
      })
    }

    i = j - 1
  }

  const seen = new Set<string>()
  const deduped: InjuryData[] = []
  for (const injury of injuries) {
    const key = `${injury.team}|${injury.playerName.toLowerCase()}|${injury.status}|${injury.reason}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(injury)
  }

  return deduped
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
  return buildSearchNames(playerName)
}

/**
 * Find NBA player ID from name and team.
 * Tries both "Last First" (PDF format) and "First Last" (DB format).
 */
async function findPlayerId(
  supabase: any,
  playerName: string,
  teamAbbreviation: string
): Promise<{ playerId: number | null; matchedWith: string; attemptedNames: string[] }> {
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
        if (data.length === 1) return { playerId: data[0].nba_player_id, matchedWith: searchName, attemptedNames: namesToTry }
        const normalizedSearch = canonicalName(searchName)
        for (const player of data) {
          const normalizedName = canonicalName(player.name)
          if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName.split(' ')[0])) {
            return { playerId: player.nba_player_id, matchedWith: searchName, attemptedNames: namesToTry }
          }
        }
        return { playerId: data[0].nba_player_id, matchedWith: searchName, attemptedNames: namesToTry }
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
      if (data2 && data2.length > 0) return { playerId: data2[0].nba_player_id, matchedWith: searchName, attemptedNames: namesToTry }
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
      if (!error3 && data3 && data3.length === 1) {
        return { playerId: data3[0].nba_player_id, matchedWith: firstName, attemptedNames: namesToTry }
      }
      if (!error3 && data3 && data3.length > 1) {
        const fullFlipped = [...parts].reverse().join(' ')
        const fullFlippedCanonical = canonicalName(fullFlipped)
        const match = data3.find((p: { name: string }) => {
          const canonical = canonicalName(p.name)
          return canonical.includes(fullFlippedCanonical) || fullFlippedCanonical.includes(canonical.split(' ')[0])
        })
        if (match) return { playerId: match.nba_player_id, matchedWith: firstName, attemptedNames: namesToTry }
        return { playerId: data3[0].nba_player_id, matchedWith: firstName, attemptedNames: namesToTry }
      }
    }

    return { playerId: null, matchedWith: '', attemptedNames: namesToTry }
  } catch (error) {
    console.error(`❌ Error finding player ${playerName}:`, error)
    return { playerId: null, matchedWith: '', attemptedNames: namesToTry }
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
async function storeInjuries(
  supabase: any,
  injuries: InjuryData[],
  reportDate: Date,
  historical: boolean = false,
  auditOnly: boolean = false,
) {
  console.log(`💾 Processing ${injuries.length} injuries from report dated ${reportDate.toISOString().split('T')[0]}${historical ? ' (historical)' : ''}...`)
  
  const reportTimestamp = new Date().toISOString()
  const reportDateStr = reportDate.toISOString().split('T')[0]
  const dayStart = `${reportDateStr}T00:00:00.000Z`
  const dayEnd = `${reportDateStr}T23:59:59.999Z`

  const teamCounts: Record<string, TeamAuditRow> = {}
  for (const injury of injuries) {
    const teamAbbreviation = normalizeTeamName(injury.team)
    if (!teamCounts[teamAbbreviation]) {
      teamCounts[teamAbbreviation] = { parsed: 0, matched: 0, stored: 0, updated: 0, unmatched: 0 }
    }
    teamCounts[teamAbbreviation].parsed += 1
  }

  if (historical && !auditOnly) {
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
  }

  const currentReportPlayerIds = new Set<number>()
  const unmatchedInjuries: UnmatchedInjury[] = []
  const resolvedInjuries: ResolvedInjury[] = []
  let stored = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  let deactivatedCount = 0

  let previousCurrentPlayerIds = new Set<number>()
  if (!historical) {
    const { data: previousCurrentRows, error: previousCurrentErr } = await supabase
      .from('nba_injuries')
      .select('nba_player_id')
      .eq('is_current', true)
    if (previousCurrentErr) {
      console.log(`   ⚠️  Warning: Could not fetch pre-run current injuries: ${previousCurrentErr.message}`)
    } else {
      previousCurrentPlayerIds = new Set((previousCurrentRows || []).map((r: { nba_player_id: number }) => r.nba_player_id))
      console.log(`   📋 Found ${previousCurrentPlayerIds.size} pre-run current injury players`)
    }
  }

  for (const injury of injuries) {
    try {
      const teamAbbreviation = normalizeTeamName(injury.team)
      const teamRow = teamCounts[teamAbbreviation] || { parsed: 0, matched: 0, stored: 0, updated: 0, unmatched: 0 }
      if (!teamCounts[teamAbbreviation]) teamCounts[teamAbbreviation] = teamRow
      const matchResult = await findPlayerId(supabase, injury.playerName, teamAbbreviation)
      const nbaPlayerId = matchResult.playerId
      
      if (!nbaPlayerId) {
        console.log(`⚠️  Could not find player: ${injury.playerName} (${teamAbbreviation})`)
        teamRow.unmatched += 1
        unmatchedInjuries.push({
          ...injury,
          teamAbbreviation,
          attemptedNames: matchResult.attemptedNames,
        })
        skipped++
        continue
      }
      
      currentReportPlayerIds.add(nbaPlayerId)
      teamRow.matched += 1
      resolvedInjuries.push({
        ...injury,
        teamAbbreviation,
        nbaPlayerId,
        matchedWith: matchResult.matchedWith || injury.playerName,
      })

      if (!historical && !auditOnly) {
        // Keep roster team assignment aligned with official report team for current runs.
        await supabase
          .from('nba_players')
          .update({ team_abbreviation: teamAbbreviation })
          .eq('nba_player_id', nbaPlayerId)
          .neq('team_abbreviation', teamAbbreviation)
      }
      
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

      if (auditOnly) {
        continue
      }

      if (historical) {
        const { error: insertError } = await supabase.from('nba_injuries').insert(injuryData)
        if (insertError) {
          console.error(`❌ Error storing injury for ${injury.playerName}:`, insertError)
          errors++
        } else {
          stored++
          teamRow.stored += 1
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
          teamRow.updated += 1
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
          teamRow.stored += 1
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

  // Step 4: For players NOT on this report, mark prior current injuries as not current.
  if (!historical && !auditOnly) {
    console.log('   🏥 Reconciling players not on current report...')
    try {
      const playersToMarkHealthy = Array.from(previousCurrentPlayerIds).filter(
        (playerId) => !currentReportPlayerIds.has(playerId),
      )
      if (playersToMarkHealthy.length > 0) {
        const { error: markError } = await supabase
          .from('nba_injuries')
          .update({ is_current: false })
          .in('nba_player_id', playersToMarkHealthy)
          .eq('is_current', true)
        if (markError) {
          console.log(`   ⚠️  Warning: Could not mark players as healthy: ${markError.message}`)
        } else {
          deactivatedCount = playersToMarkHealthy.length
          console.log(`   ✅ Marked ${playersToMarkHealthy.length} players as no longer on injury report`)
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️  Warning: Could not reconcile players not on report: ${error.message}`)
    }
  }
  
  console.log(`\n📊 Storage Summary:`)
  console.log(`   Stored: ${stored}`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Errors: ${errors}`)
  
  const audit: IngestAudit = {
    parsedCount: injuries.length,
    matchedCount: resolvedInjuries.length,
    unmatchedCount: unmatchedInjuries.length,
    deactivatedCount,
    parsedRows: injuries,
    unmatched: unmatchedInjuries,
    teamCounts,
  }

  return { stored, updated, skipped, errors, audit }
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
    const auditOnly = url.searchParams.get('audit') === 'true' || url.searchParams.get('dry_run') === 'true'

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

    const quality = evaluateParseQuality(injuries)
    if (quality.suspiciousNameCount > 0) {
      console.error('❌ Parse quality gate failed', quality)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Parse quality gate failed; refusing to write potentially corrupted injuries.',
          quality,
          hint: 'Run with ?audit=true to inspect parsed rows safely.',
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

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

    if (auditOnly) {
      const auditResult = await storeInjuries(supabase, injuries, targetDate, false, true)
      return new Response(
        JSON.stringify({
          success: true,
          audit_only: true,
          date: targetDate.toISOString().split('T')[0],
          injuries_found: injuries.length,
          audit: auditResult.audit,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        audit: result.audit,
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

