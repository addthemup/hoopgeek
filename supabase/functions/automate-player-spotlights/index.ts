/**
 * Automate player_spotlight feed posts from game JSON in Storage (game-data bucket: {gameId}.json at root by default).
 * Only creates posts for players with ≥1 MP4 in playByPlay (matches Post Creator "available" players).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import {
  collectAllPlayerSpotlightPlaysWithMp4,
  parseAssistPlayerFromDescription,
  findPersonIdByNameFromAggregatedStats,
} from '../../../src/utils/playerSpotlightPlays.ts'
import {
  buildSpotlightAutomationExtraSections,
  snapshotAggregatedStatsForMetadata,
  buildSpotlightMetricBarSection,
} from '../../../src/utils/spotlightAutomationSections.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Object key inside the bucket: root `0022501002.json` or `feed/0022501002.json` if FEED_JSON_PREFIX=feed */
function storageObjectPath(prefix: string, gameId: string): string {
  const p = prefix.replace(/\/$/, '')
  return p ? `${p}/${gameId}.json` : `${gameId}.json`
}

function generateSourceRef(
  postType: string,
  gameId: string | undefined,
  _gameDate: string | undefined,
  disambiguator: string | number,
): string {
  const base = gameId ? `${postType}:${gameId}` : `${postType}:${Date.now()}`
  const safe = String(disambiguator).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  return `${base}:${safe}`
}

function randomSlugSuffix(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10)
}

interface ParsedGame {
  gameId: string
  gameDate: string | null
  matchup: string
  finalScore: string
  homeAbbr: string
  awayAbbr: string
  teamTricodes: string[]
  story: Record<string, unknown>
  scoreForGame: Record<string, unknown>
  funScore: number | null
  meta: Record<string, unknown>
  playerStats: Array<Record<string, unknown>>
  /** Keyed by personId string; optional merge source when PlayerStats row is thin or missing fields */
  aggregatedPlayerStats: Record<string, Record<string, unknown>> | null
  allPlays: Array<Record<string, unknown>>
  raw: Record<string, unknown>
}

/** Normalized + extended stats for sections, subtitles, and metadata.spotlight_player_stats */
interface SpotlightStatSnapshot {
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
  min: string | number
  plusMinus: number | null
  efgPct: number | null
  tsPct: number | null
  pie: number | null
}

function parseGameJson(raw: Record<string, unknown>): ParsedGame | null {
  const gameId = String(raw.gameId ?? '')
  if (!/^\d{10}$/.test(gameId)) return null
  const meta = (raw.gameMetadata ?? {}) as Record<string, unknown>
  const home = (meta.homeTeam ?? {}) as Record<string, unknown>
  const away = (meta.awayTeam ?? {}) as Record<string, unknown>
  const ha = String(home.abbreviation ?? '')
  const aa = String(away.abbreviation ?? '')
  if (!ha && !aa) return null

  const dateRaw = String(meta.date ?? '')
  const gameDate = dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw || null
  const story = (raw.story ?? {}) as Record<string, unknown>
  const matchup = String(story.matchup ?? '')
  const awayPts = away.points
  const homePts = home.points
  const finalScore =
    String(story.final_score ?? '') ||
    (awayPts != null && homePts != null ? `${aa} ${awayPts} - ${ha} ${homePts}` : '')

  const scoreRoot = (raw.score ?? {}) as Record<string, unknown>
  const scoreForGame = (scoreRoot[gameId] ?? {}) as Record<string, unknown>
  const funScore = typeof scoreForGame.fun_score === 'number' ? scoreForGame.fun_score : null

  const pbpRoot = raw.playByPlay as Record<string, unknown> | undefined
  const allPlays = (pbpRoot?.allPlays ?? raw.playByPlay ?? []) as Array<Record<string, unknown>>
  const ps = raw.playerStats ?? raw.PlayerStats
  const playerStats = Array.isArray(ps) ? (ps as Array<Record<string, unknown>>) : []

  const aggRoot = raw.AggregatedPlayerStats as Record<string, unknown> | undefined
  let aggregatedPlayerStats: Record<string, Record<string, unknown>> | null = null
  if (aggRoot && typeof aggRoot === 'object' && !Array.isArray(aggRoot)) {
    aggregatedPlayerStats = {}
    for (const [k, v] of Object.entries(aggRoot)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        aggregatedPlayerStats[k] = v as Record<string, unknown>
      }
    }
  }

  return {
    gameId,
    gameDate,
    matchup,
    finalScore,
    homeAbbr: ha,
    awayAbbr: aa,
    teamTricodes: [aa, ha].filter(Boolean),
    story,
    scoreForGame,
    funScore,
    meta,
    playerStats,
    aggregatedPlayerStats,
    allPlays: Array.isArray(allPlays) ? allPlays : [],
    raw,
  }
}

function playerNameFromStat(p: Record<string, unknown>): string {
  const n = [p.firstName, p.familyName].filter(Boolean).join(' ')
  if (n) return n
  return String(p.name ?? p.playerName ?? p.nameI ?? 'Player')
}

function num(v: unknown): number {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Fill canonical PlayerStats field names from AggregatedPlayerStats traditional_/advanced_ when missing on array row. */
function mergePlayerStatSources(
  arrayRow: Record<string, unknown> | undefined,
  agg: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const m: Record<string, unknown> = { ...(arrayRow ?? {}) }
  if (!agg) return m
  const fill = (canon: string, trad: string, adv?: string) => {
    const cur = m[canon]
    if (cur != null && cur !== '') return
    const t = agg[trad]
    if (t != null && t !== '') m[canon] = t
    else if (adv) {
      const a = agg[adv]
      if (a != null && a !== '') m[canon] = a
    }
  }
  fill('points', 'traditional_points')
  fill('reboundsTotal', 'traditional_reboundsTotal')
  fill('assists', 'traditional_assists')
  fill('steals', 'traditional_steals')
  fill('blocks', 'traditional_blocks')
  fill('turnovers', 'traditional_turnovers')
  fill('foulsPersonal', 'traditional_foulsPersonal')
  fill('fieldGoalsMade', 'traditional_fieldGoalsMade')
  fill('fieldGoalsAttempted', 'traditional_fieldGoalsAttempted')
  fill('threePointersMade', 'traditional_threePointersMade')
  fill('threePointersAttempted', 'traditional_threePointersAttempted')
  fill('freeThrowsMade', 'traditional_freeThrowsMade')
  fill('freeThrowsAttempted', 'traditional_freeThrowsAttempted')
  fill('minutes', 'traditional_minutes')
  fill('plusMinusPoints', 'traditional_plusMinusPoints')
  fill('effectiveFieldGoalPercentage', 'advanced_effectiveFieldGoalPercentage')
  fill('trueShootingPercentage', 'advanced_trueShootingPercentage')
  fill('PIE', 'advanced_PIE')
  return m
}

function buildSpotlightStatSnapshot(m: Record<string, unknown>): SpotlightStatSnapshot {
  return {
    pts: num(m.points ?? m.pts),
    reb: num(m.reboundsTotal ?? m.reb),
    ast: num(m.assists ?? m.ast),
    stl: num(m.steals ?? m.stl),
    blk: num(m.blocks ?? m.blk),
    tov: num(m.turnovers ?? m.tov),
    pf: num(m.foulsPersonal ?? m.pf),
    fgm: num(m.fieldGoalsMade ?? m.fgm),
    fga: num(m.fieldGoalsAttempted ?? m.fga),
    fg3m: num(m.threePointersMade ?? m.fg3m),
    fg3a: num(m.threePointersAttempted ?? m.fg3a),
    ftm: num(m.freeThrowsMade ?? m.ftm),
    fta: num(m.freeThrowsAttempted ?? m.fta),
    min: (m.minutes ?? m.min ?? '') as string | number,
    plusMinus: numOrNull(m.plusMinusPoints ?? m.plus_minus),
    efgPct: numOrNull(m.effectiveFieldGoalPercentage),
    tsPct: numOrNull(m.trueShootingPercentage),
    pie: numOrNull(m.PIE),
  }
}

function spotlightPlayerStatsMetadata(
  personId: number,
  teamTricode: string,
  s: SpotlightStatSnapshot,
): Record<string, unknown> {
  return {
    personId,
    teamTricode,
    minutes: s.min === '' ? null : s.min,
    pts: s.pts,
    reb: s.reb,
    ast: s.ast,
    stl: s.stl,
    blk: s.blk,
    tov: s.tov,
    pf: s.pf,
    fgm: s.fgm,
    fga: s.fga,
    fg3m: s.fg3m,
    fg3a: s.fg3a,
    ftm: s.ftm,
    fta: s.fta,
    plusMinus: s.plusMinus,
    efgPct: s.efgPct,
    tsPct: s.tsPct,
    pie: s.pie,
  }
}

/** Feed post subtitle: core line + compact shooting; trim if very long. */
function buildSpotlightSubtitle(s: SpotlightStatSnapshot): string {
  const core = [`${s.pts} PTS`, `${s.reb} REB`, `${s.ast} AST`].join(' · ')
  const parts: string[] = [core]
  if (s.fga > 0) parts.push(`${s.fgm}-${s.fga} FG`)
  if (s.fg3a > 0) parts.push(`${s.fg3m}-${s.fg3a} 3PT`)
  if (s.min !== '' && s.min != null) parts.push(String(s.min).trim() + ' MIN')
  if (s.plusMinus != null) {
    const pm = s.plusMinus
    parts.push((pm > 0 ? `+${pm}` : String(pm)) + ' +/-')
  }
  let line = parts.join(' · ')
  if (line.length > 118) {
    line = [core, s.fga > 0 ? `${s.fgm}-${s.fga} FG` : '', s.plusMinus != null ? (s.plusMinus > 0 ? `+${s.plusMinus}` : String(s.plusMinus)) + ' +/-' : '']
      .filter(Boolean)
      .join(' · ')
  }
  return line
}

function clipsToCarousel(
  clips: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return clips.map((c) => ({
    mp4: c.mp4,
    description: c.description ?? '',
    action_type: c.actionType ?? '',
    period: c.period ?? 0,
    clock: c.clock ?? '',
  }))
}

function buildHeroAndOverlayStats(stat: SpotlightStatSnapshot): Record<string, string | number> {
  const heroStats: Record<string, string | number> = {}
  heroStats.PTS = stat.pts
  heroStats.REB = stat.reb
  heroStats.AST = stat.ast
  if (stat.fga > 0) heroStats.FG = `${stat.fgm}-${stat.fga}`
  if (stat.fg3a > 0) heroStats['3PT'] = `${stat.fg3m}-${stat.fg3a}`
  if (stat.fta > 0) heroStats.FT = `${stat.ftm}-${stat.fta}`
  if (stat.min !== '' && stat.min != null) heroStats.MIN = String(stat.min).trim()
  if (stat.plusMinus != null) heroStats['+/-'] = stat.plusMinus > 0 ? `+${stat.plusMinus}` : String(stat.plusMinus)
  if (stat.efgPct != null) heroStats.eFG = `${Math.round(stat.efgPct * 1000) / 10}%`
  if (stat.tsPct != null) heroStats.TS = `${Math.round(stat.tsPct * 1000) / 10}%`
  return heroStats
}

function buildDataOverlays(stat: SpotlightStatSnapshot): { label: string; value: string }[] {
  const dataOverlays: { label: string; value: string }[] = []
  dataOverlays.push({ label: 'PTS', value: String(stat.pts) })
  dataOverlays.push({ label: 'REB', value: String(stat.reb) })
  dataOverlays.push({ label: 'AST', value: String(stat.ast) })
  if (stat.fga > 0) dataOverlays.push({ label: 'FG', value: `${stat.fgm}-${stat.fga}` })
  if (stat.fg3a > 0) dataOverlays.push({ label: '3PT', value: `${stat.fg3m}-${stat.fg3a}` })
  if (stat.fta > 0) dataOverlays.push({ label: 'FT', value: `${stat.ftm}-${stat.fta}` })
  if (stat.stl > 0) dataOverlays.push({ label: 'STL', value: String(stat.stl) })
  if (stat.blk > 0) dataOverlays.push({ label: 'BLK', value: String(stat.blk) })
  if (stat.tov > 0) dataOverlays.push({ label: 'TOV', value: String(stat.tov) })
  if (stat.pf > 0) dataOverlays.push({ label: 'PF', value: String(stat.pf) })
  if (stat.min !== '' && stat.min != null) dataOverlays.push({ label: 'MIN', value: String(stat.min).trim() })
  if (stat.plusMinus != null) {
    const pm = stat.plusMinus
    dataOverlays.push({ label: '+/-', value: pm > 0 ? `+${pm}` : String(pm) })
  }
  return dataOverlays
}

function buildSections(
  game: ParsedGame,
  personId: number,
  playerName: string,
  teamTricode: string,
  stat: SpotlightStatSnapshot,
): Array<{
  section_type: string
  title: string | null
  content: Record<string, unknown>
  player_id: number | null
  team_tricode: string | null
}> {
  const clipsRaw = collectAllPlayerSpotlightPlaysWithMp4(personId, game.allPlays as never, game.aggregatedPlayerStats)
  const clips = clipsToCarousel(clipsRaw as Array<Record<string, unknown>>)
  const heroImageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${personId}.png`
  const heroStats = buildHeroAndOverlayStats(stat)
  const subtitle = buildSpotlightSubtitle(stat)

  const title = `${playerName} — ${game.matchup || `${game.awayAbbr} @ ${game.homeAbbr}`}`

  const sections: Array<{
    section_type: string
    title: string | null
    content: Record<string, unknown>
    player_id: number | null
    team_tricode: string | null
  }> = []

  sections.push({
    section_type: 'hero',
    title: '',
    content: {
      image_url: heroImageUrl,
      gradient_overlay: true,
      badge: 'PLAYER SPOTLIGHT',
      team_tricode: teamTricode || null,
      player_name: playerName,
      player_stats: Object.keys(heroStats).length ? heroStats : undefined,
    },
    player_id: personId,
    team_tricode: teamTricode || null,
  })

  sections.push({
    section_type: 'headline',
    title: '',
    content: {
      text: title,
      subtitle: subtitle + (game.finalScore ? ` · ${game.finalScore}` : ''),
    },
    player_id: personId,
    team_tricode: null,
  })

  if (clips.length > 0) {
    sections.push({
      section_type: 'video_carousel',
      title: 'Highlights',
      content: { clips },
      player_id: personId,
      team_tricode: null,
    })
  }

  const dataOverlays = buildDataOverlays(stat)

  sections.push({
    section_type: 'player_highlight',
    title: playerName,
    content: {
      player_id: personId,
      name: playerName,
      team_tricode: teamTricode || null,
      stats: heroStats,
      video_url: clips[0]?.mp4 ?? null,
      video_clips: clips.length ? clips : undefined,
      data_overlays: dataOverlays.length ? dataOverlays : undefined,
    },
    player_id: personId,
    team_tricode: teamTricode || null,
  })

  const aggRowForCharts = game.aggregatedPlayerStats?.[String(personId)]
  const metricBar = buildSpotlightMetricBarSection(aggRowForCharts, playerName, personId)
  if (metricBar) {
    sections.push(metricBar)
  } else {
    const radarData = [
      { subject: 'PTS', value: Math.min(100, (stat.pts / 40) * 100), fullMark: 100 },
      { subject: 'REB', value: Math.min(100, (stat.reb / 15) * 100), fullMark: 100 },
      { subject: 'AST', value: Math.min(100, (stat.ast / 12) * 100), fullMark: 100 },
      { subject: 'STL', value: Math.min(100, (stat.stl / 4) * 100), fullMark: 100 },
      { subject: 'BLK', value: Math.min(100, (stat.blk / 4) * 100), fullMark: 100 },
    ].filter((d) => d.value > 0)

    if (radarData.length >= 3) {
      sections.push({
        section_type: 'chart',
        title: 'Scoring profile',
        content: {
          chart_type: 'radar',
          chart_props: { data: radarData },
          caption: `${playerName} — traditional stat shape vs game norms`,
        },
        player_id: personId,
        team_tricode: null,
      })
    }
  }

  const extra = buildSpotlightAutomationExtraSections(
    game.raw,
    game.aggregatedPlayerStats,
    personId,
    playerName,
    teamTricode,
    game.matchup || '',
    {
      pts: stat.pts,
      reb: stat.reb,
      ast: stat.ast,
      stl: stat.stl,
      blk: stat.blk,
      tov: stat.tov,
      fgm: stat.fgm,
      fga: stat.fga,
      fg3m: stat.fg3m,
      fg3a: stat.fg3a,
      ftm: stat.ftm,
      fta: stat.fta,
      plusMinus: stat.plusMinus,
    },
  )
  for (const s of extra) sections.push(s)

  return sections
}

function eligiblePlayersWithMp4(
  game: ParsedGame,
): Array<{ personId: number; name: string; teamTricode: string; stat: SpotlightStatSnapshot }> {
  // Roster = PlayerStats rows and/or AggregatedPlayerStats keys (fallback when array is partial).
  const idsFromArray = game.playerStats
    .map((p) => Number(p.personId ?? p.player_id))
    .filter((id) => Number.isFinite(id) && id > 0)
  const idsFromAgg = game.aggregatedPlayerStats
    ? Object.keys(game.aggregatedPlayerStats)
        .map((k) => Number(k))
        .filter((id) => Number.isFinite(id) && id > 0)
    : []
  const rosterIds = new Set([...idsFromArray, ...idsFromAgg])

  const withMp4 = new Set<number>()
  const nameById = new Map<number, string>()
  for (const play of game.allPlays) {
    if (!play.mp4 || String(play.mp4).length === 0) continue
    const pid = play.personId != null ? Number(play.personId) : NaN
    if (Number.isFinite(pid) && pid > 0 && rosterIds.has(pid)) {
      withMp4.add(pid)
      const pn = String(play.playerName ?? play.playerNameI ?? '').trim()
      if (pn && !nameById.has(pid)) nameById.set(pid, pn)
    }
    const assistName = parseAssistPlayerFromDescription(String(play.description ?? ''))
    if (assistName) {
      const aid = findPersonIdByNameFromAggregatedStats(
        assistName,
        game.aggregatedPlayerStats,
        game.allPlays as never,
      )
      if (aid != null && rosterIds.has(aid)) withMp4.add(aid)
    }
  }

  const out: Array<{ personId: number; name: string; teamTricode: string; stat: SpotlightStatSnapshot }> = []
  for (const pid of withMp4) {
    const arrRow = game.playerStats.find((p) => Number(p.personId ?? p.player_id) === pid)
    const aggRow = game.aggregatedPlayerStats?.[String(pid)]
    const name = arrRow
      ? playerNameFromStat(arrRow)
      : [aggRow?.firstName, aggRow?.familyName].filter(Boolean).join(' ').trim() ||
        nameById.get(pid) ||
        `Player ${pid}`
    const teamTricode = arrRow
      ? String(arrRow.teamTricode ?? arrRow.team_abbreviation ?? game.teamTricodes[0] ?? '')
      : String(aggRow?.teamTricode ?? aggRow?.team_abbreviation ?? game.teamTricodes[0] ?? '')
    const merged = mergePlayerStatSources(arrRow, aggRow)
    const stat = buildSpotlightStatSnapshot(merged)
    out.push({ personId: pid, name, teamTricode, stat })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

async function processGame(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
  gameId: string,
  force: boolean,
): Promise<Record<string, unknown>> {
  const objectPath = storageObjectPath(prefix, gameId)
  const storagePath = objectPath

  if (!force) {
    const { data: row } = await supabase
      .from('feed_automation_checkpoints')
      .select('player_spotlight_batch_done')
      .eq('game_id', gameId)
      .maybeSingle()
    if (row?.player_spotlight_batch_done === true) {
      return { game_id: gameId, skipped: true, reason: 'player_spotlight_batch_done' }
    }
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(objectPath)
  if (dlErr || !blob) {
    return { game_id: gameId, error: `download failed: ${objectPath}`, detail: dlErr?.message }
  }

  const text = await blob.text()
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text) as Record<string, unknown>
  } catch {
    return { game_id: gameId, error: 'invalid JSON' }
  }

  const game = parseGameJson(raw)
  if (!game) {
    return { game_id: gameId, error: 'could not parse game metadata' }
  }

  const eligible = eligiblePlayersWithMp4(game)
  if (eligible.length === 0) {
    return {
      game_id: gameId,
      warning: 'no players with MP4 highlights — checkpoint not updated',
      eligible: 0,
    }
  }

  const created: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  for (const ep of eligible) {
    const sourceRef = generateSourceRef('player_spotlight', game.gameId, undefined, ep.personId)
    const slug = `player-spotlight-${gameId}-${ep.personId}-${randomSlugSuffix()}`
    const metadata = {
      story_data: game.story,
      story: game.story,
      fun_data: game.scoreForGame,
      fun_score: game.funScore,
      homeTeam: game.meta.homeTeam,
      awayTeam: game.meta.awayTeam,
      arena: game.meta.arena,
      season: game.meta.season,
      automation: true,
      automation_source: 'automate-player-spotlights',
      spotlight_player_stats: spotlightPlayerStatsMetadata(ep.personId, ep.teamTricode, ep.stat),
      spotlight_aggregated_stats: snapshotAggregatedStatsForMetadata(game.aggregatedPlayerStats, ep.personId),
    }

    const sections = buildSections(game, ep.personId, ep.name, ep.teamTricode, ep.stat)
    const coverImageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${ep.personId}.png`

    const postRow = {
      post_type: 'player_spotlight',
      status: 'published',
      title: `${ep.name} — ${game.matchup || game.gameId}`,
      subtitle: buildSpotlightSubtitle(ep.stat),
      description: `Player spotlight — ${game.matchup || game.gameId}`,
      slug,
      cover_image_url: coverImageUrl,
      share_image_url: null,
      game_id: game.gameId,
      game_date: game.gameDate,
      team_tricodes: game.teamTricodes.length ? game.teamTricodes : null,
      player_ids: [ep.personId],
      person_id: ep.personId,
      tags: ['highlights'],
      metadata,
      source_ref: sourceRef,
      created_by: null,
      author_name: 'HoopGeek',
      published_at: new Date().toISOString(),
    }

    const { data: inserted, error: insErr } = await supabase
      .from('feed_posts')
      .insert(postRow)
      .select('id')
      .maybeSingle()

    if (insErr) {
      if (insErr.code === '23505' || String(insErr.message).toLowerCase().includes('duplicate')) {
        skipped.push(sourceRef)
        continue
      }
      errors.push(`${sourceRef}: ${insErr.message}`)
      continue
    }

    if (!inserted?.id) {
      errors.push(`${sourceRef}: no row returned`)
      continue
    }

    const sectionRows = sections.map((s, i) => ({
      post_id: inserted.id,
      section_order: i,
      section_type: s.section_type,
      title: s.title,
      content: s.content,
      player_id: s.player_id,
      team_tricode: s.team_tricode,
    }))

    const { error: secErr } = await supabase.from('feed_post_sections').insert(sectionRows)
    if (secErr) {
      errors.push(`${sourceRef} sections: ${secErr.message}`)
      await supabase.from('feed_posts').delete().eq('id', inserted.id)
      continue
    }

    created.push(sourceRef)
  }

  const ok = errors.length === 0
  if (ok) {
    const { data: existing } = await supabase
      .from('feed_automation_checkpoints')
      .select('game_id')
      .eq('game_id', gameId)
      .maybeSingle()
    if (existing) {
      await supabase
        .from('feed_automation_checkpoints')
        .update({ player_spotlight_batch_done: true, json_storage_path: storagePath })
        .eq('game_id', gameId)
    } else {
      await supabase.from('feed_automation_checkpoints').insert({
        game_id: gameId,
        json_storage_path: storagePath,
        player_spotlight_batch_done: true,
      })
    }
  }

  return {
    game_id: gameId,
    eligible: eligible.length,
    created: created.length,
    skipped_duplicates: skipped.length,
    created_source_refs: created,
    skipped_source_refs: skipped,
    errors: errors.length ? errors : undefined,
    checkpoint_updated: ok,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const bucket = Deno.env.get('FEED_GAME_DATA_BUCKET') ?? 'game-data'
    // Empty = bucket root (0022501002.json). Set to "feed" for legacy feed/0022501002.json
    const prefix = (Deno.env.get('FEED_JSON_PREFIX') ?? '').replace(/\/$/, '')

    let body: { game_id?: string; scan?: boolean; force?: boolean } = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    const force = body.force === true
    const gameIdArg = body.game_id && /^\d{10}$/.test(body.game_id) ? body.game_id : null

    if (gameIdArg) {
      const result = await processGame(supabase, bucket, prefix, gameIdArg, force)
      const err = typeof result.error === 'string' ? result.error : ''
      const notFound =
        err.startsWith('download failed') &&
        (String(result.detail ?? '').toLowerCase().includes('not found') ||
          String(result.detail ?? '').toLowerCase().includes('object not found'))
      const status = typeof result.error === 'string' ? (notFound ? 404 : 500) : 200
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
      })
    }

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message:
            'POST JSON: {"game_id":"0022501002"} for one game, or {"scan":true} to process all *10.json at bucket root (or under FEED_JSON_PREFIX). Optional: "force":true.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    if (req.method !== 'POST' || body.scan !== true) {
      return new Response(
        JSON.stringify({
          error:
            'POST JSON with {"game_id":"0022501002"} or {"scan":true}. Optional: "force":true.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const listPath = prefix || ''
    const { data: files, error: listErr } = await supabase.storage.from(bucket).list(listPath, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    })

    if (listErr) {
      return new Response(JSON.stringify({ error: listErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const gameIds: string[] = []
    for (const f of files ?? []) {
      const m = f.name?.match(/^(\d{10})\.json$/)
      if (m) gameIds.push(m[1])
    }

    const results: Record<string, unknown>[] = []
    for (const gid of gameIds) {
      const r = await processGame(supabase, bucket, prefix, gid, force)
      results.push(r)
    }

    return new Response(
      JSON.stringify({ bucket, prefix, games_found: gameIds.length, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
