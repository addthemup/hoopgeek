/**
 * Player Spotlight section generator.
 *
 * Produces a rich, data-driven post that doesn't feel procedural:
 *   hero → headline → video_carousel → [pull_quote] → [insights] → player_highlight → [chart: radar] → [chart: shot_chart] → [chart: shot_zone_bar] → prop_cards
 *
 * Uses AggregatedPlayerStats / PlayerStats and shotChartData from the monolithic game JSON (local-feed API may merge legacy player_stats/ + shot_charts/ if missing).
 * When player_stats is missing, derives a minimal stat line from play-by-play.
 * Compares spotlight player to all others in the game to surface strengths/weaknesses (good/bad) and adds
 * insights section + improved pull quote. Shot chart and shot-by-zone bar use shot_charts when available.
 */

import { collectAllPlayerSpotlightPlaysFromGameData } from '../../../../utils/playerSpotlightPlays'
import { buildAggregatedStatTableMarkdown, buildSpotlightMetricBarSection } from '../../../../utils/spotlightAutomationSections'
import { calculatePropResult } from '../../../../utils/playerPropsCalculator'
import { filterFullGameProps } from '../../../../utils/playerPropsFilter'
import { supabase } from '../../../../utils/supabase'
import type {
  HeroContent,
  HeadlineContent,
  PlayerHighlightContent,
  PropCardContent,
  ChartContent,
  PullQuoteContent,
  RichTextContent,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext, GameData } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'

// ─── Spotight player stat shape (normalized from PlayerStats or keyed object) ──
interface SpotlightStat {
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  min: string | number | null
  plusMinus: number | null
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
  tov: number
  [key: string]: any
}

/** Resolve player name from game data (stats, PBP, or fallback). */
function getPlayerName(data: GameData, spotlightPlayerId: number): string {
  const playerStat = (data.playerStats || []).find(
    (p: any) => Number(p.personId || p.player_id) === spotlightPlayerId
  )
  if (playerStat?.name) return playerStat.name
  if (playerStat?.playerName) return playerStat.playerName
  const fromPbp = (data.playByPlay || []).find((p: any) => p.personId === spotlightPlayerId)
  if (fromPbp?.playerName) return fromPbp.playerName
  const keyed = data.raw?.playerStatsByPersonId?.[String(spotlightPlayerId)]
  if (keyed?.firstName != null || keyed?.familyName != null) {
    return [keyed.firstName, keyed.familyName].filter(Boolean).join(' ') || `Player ${spotlightPlayerId}`
  }
  return `Player ${spotlightPlayerId}`
}

/** Get team tricode for the spotlight player. */
function getTeamTricode(data: GameData, spotlightPlayerId: number): string {
  const playerStat = (data.playerStats || []).find(
    (p: any) => Number(p.personId || p.player_id) === spotlightPlayerId
  )
  if (playerStat?.teamTricode) return playerStat.teamTricode
  if (playerStat?.team_abbreviation) return playerStat.team_abbreviation
  const keyed = data.raw?.playerStatsByPersonId?.[String(spotlightPlayerId)]
  if (keyed?.teamTricode) return keyed.teamTricode
  return data.teamTricodes?.[0] || ''
}

/** Build normalized SpotlightStat from game data (playerStats array or raw.playerStatsByPersonId). */
function getSpotlightStat(data: GameData, spotlightPlayerId: number): SpotlightStat | null {
  const pid = spotlightPlayerId
  const row = (data.playerStats || []).find(
    (p: any) => Number(p.personId || p.player_id) === pid
  )
  if (row) {
    const min = row.min ?? row.minutes ?? null
    return {
      pts: row.pts ?? row.points ?? 0,
      reb: row.reb ?? row.reboundsTotal ?? 0,
      ast: row.ast ?? row.assists ?? 0,
      stl: row.stl ?? row.steals ?? 0,
      blk: row.blk ?? row.blocks ?? 0,
      min,
      plusMinus: row.plusMinusPoints ?? row.plus_minus ?? null,
      fgm: row.fieldGoalsMade ?? row.fgm ?? 0,
      fga: row.fieldGoalsAttempted ?? row.fga ?? 0,
      fg3m: row.threePointersMade ?? row.fg3m ?? 0,
      fg3a: row.threePointersAttempted ?? row.fg3a ?? 0,
      ftm: row.freeThrowsMade ?? row.ftm ?? 0,
      fta: row.freeThrowsAttempted ?? row.fta ?? 0,
      tov: row.turnovers ?? row.tov ?? 0,
      ...row,
    }
  }
  const keyed = data.raw?.playerStatsByPersonId?.[String(pid)]
  if (!keyed) return null
  const t = keyed
  return {
    pts: t.traditional_points ?? t.traditional_pts ?? 0,
    reb: t.traditional_reboundsTotal ?? t.traditional_reb ?? 0,
    ast: t.traditional_assists ?? t.traditional_ast ?? 0,
    stl: t.traditional_steals ?? t.traditional_stl ?? 0,
    blk: t.traditional_blocks ?? t.traditional_blk ?? 0,
    min: t.traditional_minutes ?? null,
    plusMinus: t.traditional_plusMinusPoints ?? null,
    fgm: t.traditional_fieldGoalsMade ?? 0,
    fga: t.traditional_fieldGoalsAttempted ?? 0,
    fg3m: t.traditional_threePointersMade ?? 0,
    fg3a: t.traditional_threePointersAttempted ?? 0,
    ftm: t.traditional_freeThrowsMade ?? 0,
    fta: t.traditional_freeThrowsAttempted ?? 0,
    tov: t.traditional_turnovers ?? 0,
    netRating: t.advanced_netRating ?? t.advanced_estimatedNetRating,
    assistToTurnover: t.advanced_assistToTurnover,
    assistPercentage: t.advanced_assistPercentage,
    effectiveFieldGoalPercentage: t.advanced_effectiveFieldGoalPercentage,
    trueShootingPercentage: t.advanced_trueShootingPercentage,
    usagePercentage: t.advanced_usagePercentage,
    PIE: t.advanced_PIE,
    pointsPaint: t.misc_pointsPaint,
    pointsOffTurnovers: t.misc_pointsOffTurnovers,
    foulsDrawn: t.misc_foulsDrawn,
  }
}

/** Derive minimal stats from play-by-play when player_stats is missing.
 *  Never use pointsTotal (it is the team's running score). Sum PTS from the player's scoring events only. */
function deriveStatsFromPbp(playByPlay: any[], personId: number, playerName: string): SpotlightStat {
  let fgm = 0
  let fga = 0
  let fg3m = 0
  let fg3a = 0
  let ftm = 0
  let fta = 0
  let ast = 0
  let reb = 0
  let stl = 0
  let blk = 0
  const nameParts = playerName.split(/\s+/).filter(Boolean)
  const lastName = nameParts[nameParts.length - 1] || ''
  for (const p of playByPlay) {
    const desc = (p.description || '') as string
    const descLower = desc.toLowerCase()
    if (p.personId === personId) {
      if (p.isFieldGoal === 1 || p.actionType === 'Made Shot' || p.actionType === 'Missed Shot') {
        fga++
        const is3 =
          descLower.includes('3pt') ||
          descLower.includes('3pt ') ||
          (p.subType && String(p.subType).toLowerCase().includes('3pt'))
        if (is3) fg3a++
        if (p.shotResult === 'Made') {
          fgm++
          if (is3) fg3m++
        }
      }
      if (descLower.includes('free throw')) {
        fta++
        if (!desc.trim().toUpperCase().startsWith('MISS')) {
          ftm++
        }
      }
      if (descLower.includes('rebound')) reb++
      if (descLower.includes('steal')) stl++
      if (descLower.includes('block')) blk++
    }
    if (lastName && desc.includes(`(${lastName}`) && /\d+\s*AST\)/i.test(desc)) {
      const m = desc.match(/\([^)]*(\d+)\s*AST\)/i)
      if (m) ast = Math.max(ast, parseInt(m[1], 10))
    }
  }
  const pts = 2 * fgm + fg3m + ftm
  return {
    pts,
    reb,
    ast,
    stl,
    blk,
    min: null,
    plusMinus: null,
    fgm,
    fga,
    fg3m,
    fg3a,
    ftm,
    fta,
    tov: 0,
  }
}

/** Get shot chart array for the player when available (raw.shotChartData[personId]). */
function getShotChart(data: GameData, spotlightPlayerId: number): any[] | null {
  const arr = data.raw?.shotChartData?.[String(spotlightPlayerId)]
  return Array.isArray(arr) ? arr : null
}

/** All players in game from AggregatedPlayerStats / playerStatsByPersonId; filter to those with meaningful minutes. */
function getAllGamePlayerStats(data: GameData): Record<string, any> {
  const keyed = data.raw?.playerStatsByPersonId ?? data.raw?.AggregatedPlayerStats
  if (!keyed || typeof keyed !== 'object') return {}
  const out: Record<string, any> = {}
  for (const [pid, stats] of Object.entries(keyed)) {
    if (!/^\d+$/.test(pid) || !stats) continue
    const row = stats as Record<string, unknown>
    const min = row.advanced_minutes ?? row.traditional_minutes
    if (min) {
      const [a, b] = String(min).split(':').map(Number)
      const totalMin = (a || 0) + ((b || 0) / 60)
      if (totalMin >= 5) out[pid] = row
    } else {
      out[pid] = row
    }
  }
  return out
}

/** Metric config for game-wide ranking: key path, label, higher is better, optional formatter. */
const INSIGHT_METRICS: Array<{
  key: string
  label: string
  higherIsBetter: boolean
  format?: (v: number) => string
}> = [
  { key: 'traditional_points', label: 'points', higherIsBetter: true },
  { key: 'traditional_assists', label: 'assists', higherIsBetter: true },
  { key: 'traditional_reboundsTotal', label: 'rebounds', higherIsBetter: true },
  { key: 'traditional_steals', label: 'steals', higherIsBetter: true },
  { key: 'traditional_blocks', label: 'blocks', higherIsBetter: true },
  { key: 'advanced_netRating', label: 'Net Rating', higherIsBetter: true, format: v => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) },
  { key: 'advanced_trueShootingPercentage', label: 'True Shooting', higherIsBetter: true, format: v => `${(v * 100).toFixed(0)}%` },
  { key: 'advanced_effectiveFieldGoalPercentage', label: 'eFG%', higherIsBetter: true, format: v => `${(v * 100).toFixed(0)}%` },
  { key: 'advanced_PIE', label: 'PIE', higherIsBetter: true, format: v => `${(v * 100).toFixed(0)}%` },
  { key: 'advanced_assistPercentage', label: 'AST%', higherIsBetter: true, format: v => `${(v * 100).toFixed(0)}%` },
  { key: 'misc_blocks', label: 'blocks', higherIsBetter: true },
  { key: 'playerTrack_assists', label: 'assists', higherIsBetter: true },
]

/** Compare spotlight player to all others; return strengths and weaknesses for the feed post. */
function getSpotlightInsights(
  data: GameData,
  spotlightPlayerId: number
): { strengths: string[]; weaknesses: string[]; topStrength: string | null } {
  const all = getAllGamePlayerStats(data)
  const pidStr = String(spotlightPlayerId)
  const player = all[pidStr]
  if (!player || Object.keys(all).length < 2) return { strengths: [], weaknesses: [], topStrength: null }

  const strengths: string[] = []
  const weaknesses: string[] = []

  for (const m of INSIGHT_METRICS) {
    const raw = player[m.key]
    if (raw === undefined || raw === null) continue
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
    if (!Number.isFinite(num)) continue

    const values = Object.entries(all)
      .map(([, s]) => (s[m.key] != null ? (typeof s[m.key] === 'number' ? s[m.key] : parseFloat(String(s[m.key]))) : NaN))
      .filter(v => Number.isFinite(v))
    if (values.length < 2) continue

    values.sort((a, b) => (m.higherIsBetter ? b - a : a - b))
    const rank = values.indexOf(num) + 1
    const total = values.length
    const display = m.format ? m.format(num) : String(Math.round(num))

    if (rank <= 3 && m.higherIsBetter) {
      if (rank === 1) strengths.push(`Led game in ${m.label} (${display})`)
      else strengths.push(`Top ${rank} in game in ${m.label} (${display})`)
    } else if (rank <= 3 && !m.higherIsBetter) {
      strengths.push(`Among game's best in ${m.label} (${display})`)
    }
    if (rank >= total - 2 && rank > 3 && m.higherIsBetter && total >= 6) {
      weaknesses.push(`Low ${m.label} in this game (${display})`)
    }
  }

  // Dedupe by label (e.g. "blocks" from traditional and misc)
  const seen = new Set<string>()
  const dedupe = (arr: string[]) => arr.filter(s => {
    const lab = s.replace(/\s*\([^)]+\)\s*$/, '').trim()
    if (seen.has(lab)) return false
    seen.add(lab)
    return true
  })

  const topStrength = dedupe(strengths)[0] ?? null
  return {
    strengths: dedupe(strengths).slice(0, 5),
    weaknesses: dedupe(weaknesses).slice(0, 3),
    topStrength,
  }
}

/** Aggregate shot chart by SHOT_ZONE_BASIC for a bar chart. */
function getShotChartByZone(shots: any[]): Array<{ zone: string; fgm: number; fga: number; pct: number }> {
  const byZone: Record<string, { fgm: number; fga: number }> = {}
  for (const s of shots) {
    const zone = s.SHOT_ZONE_BASIC || 'Other'
    if (!byZone[zone]) byZone[zone] = { fgm: 0, fga: 0 }
    byZone[zone].fga++
    if (s.SHOT_MADE_FLAG === 1) byZone[zone].fgm++
  }
  return Object.entries(byZone).map(([zone, { fgm, fga }]) => ({
    zone,
    fgm,
    fga,
    pct: fga > 0 ? Math.round((fgm / fga) * 100) : 0,
  }))
  // Note: ordering handled by caller
}

/** Pick 1–2 elite callouts and a subtitle stat line for variety. */
function pickEliteCallouts(stat: SpotlightStat): { pullQuote: string | null; subtitleExtras: string[] } {
  const pullQuotes: string[] = []
  const extras: string[] = []

  if (stat.ast >= 6 && stat.tov <= 2 && stat.ast > 0) {
    const ratio = stat.tov > 0 ? (stat.ast / stat.tov).toFixed(1) : String(stat.ast)
    pullQuotes.push(`${stat.ast} AST${stat.tov > 0 ? `, ${stat.tov} TO` : ''} — ${ratio} AST/TO`)
  }
  if (stat.fg3a >= 3 && stat.fg3m >= 2) {
    const line = `${stat.fg3m}/${stat.fg3a} from 3`
    if (stat.fg3m / stat.fg3a >= 0.4) pullQuotes.push(line)
    extras.push(line)
  }
  if (stat.ftm >= 5 && stat.fta > 0 && stat.ftm === stat.fta) {
    pullQuotes.push(`${stat.ftm}/${stat.fta} from the line`)
    extras.push(`${stat.ftm}/${stat.fta} FT`)
  }
  if ((stat.stl + stat.blk) >= 2) {
    const parts = []
    if (stat.stl > 0) parts.push(`${stat.stl} STL`)
    if (stat.blk > 0) parts.push(`${stat.blk} BLK`)
    pullQuotes.push(parts.join(', '))
  }
  if (stat.plusMinus != null && stat.plusMinus >= 10) {
    extras.push(`+${stat.plusMinus}`)
  }
  const net = (stat as any).netRating
  if (typeof net === 'number' && net >= 15) {
    pullQuotes.push(`${net.toFixed(1)} Net Rating`)
  }

  return {
    pullQuote: pullQuotes.length > 0 ? pullQuotes[0] : null,
    subtitleExtras: extras.slice(0, 2),
  }
}

/** Build hero stat line (pts, reb, ast, stl, blk, min) for display. */
function toHeroStats(stat: SpotlightStat): Record<string, number> {
  const out: Record<string, number> = {}
  if (stat.pts > 0 || stat.reb > 0 || stat.ast > 0 || stat.stl > 0 || stat.blk > 0) {
    if (stat.pts >= 0) out.pts = stat.pts
    if (stat.reb >= 0) out.reb = stat.reb
    if (stat.ast >= 0) out.ast = stat.ast
    if (stat.stl >= 0) out.stl = stat.stl
    if (stat.blk >= 0) out.blk = stat.blk
  }
  if (stat.min != null) {
    const minNum = typeof stat.min === 'string' ? parseMinutes(stat.min) : stat.min
    if (minNum >= 0) out.min = minNum
  }
  return out
}

function parseMinutes(s: string): number {
  if (typeof s !== 'string') return 0
  const [a, b] = s.split(':').map(Number)
  if (!Number.isFinite(a)) return 0
  return a + (Number.isFinite(b) ? b / 60 : 0)
}

/** Build subtitle: stat line + optional elite extras (e.g. "25 PTS · 4 REB · 9 AST · 33 MIN · 5/10 from 3"). */
function buildSubtitle(stat: SpotlightStat, subtitleExtras: string[], draftSubtitle: string | undefined): string {
  const parts: string[] = []
  if (stat.pts >= 0) parts.push(`${stat.pts} PTS`)
  if (stat.reb >= 0) parts.push(`${stat.reb} REB`)
  if (stat.ast >= 0) parts.push(`${stat.ast} AST`)
  if (stat.stl >= 0) parts.push(`${stat.stl} STL`)
  if (stat.blk >= 0) parts.push(`${stat.blk} BLK`)
  if (stat.min != null) {
    const m =
      typeof stat.min === 'string'
        ? stat.min
        : `${Math.floor(stat.min)}:${String(Math.round((stat.min % 1) * 60)).padStart(2, '0')}`
    parts.push(`${m} MIN`)
  }
  const line = parts.join(' · ')
  const extra = subtitleExtras.length > 0 ? ` · ${subtitleExtras.join(' · ')}` : ''
  if (draftSubtitle?.trim()) return draftSubtitle
  return line + extra
}

export async function generatePlayerSpotlightSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  const { draft, matchedGameData, spotlightPlayerId } = ctx
  if (!spotlightPlayerId || matchedGameData.length === 0) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const data = matchedGameData[0]
  const gameId = data.gameId
  const gameDate = data.gameDate || draft.game_date || ''

  const playerName = getPlayerName(data, spotlightPlayerId)
  const teamTricode = getTeamTricode(data, spotlightPlayerId)

  let stat: SpotlightStat | null = getSpotlightStat(data, spotlightPlayerId)
  if (!stat) {
    stat = deriveStatsFromPbp(data.playByPlay || [], spotlightPlayerId, playerName)
  }

  const { pullQuote, subtitleExtras } = pickEliteCallouts(stat)
  const insights = getSpotlightInsights(data, spotlightPlayerId)
  const heroStats = toHeroStats(stat)
  const subtitle = buildSubtitle(stat, subtitleExtras, draft.subtitle || undefined)
  const pullQuoteText = insights.topStrength ?? pullQuote

  const clips = collectAllPlayerSpotlightPlaysFromGameData(spotlightPlayerId, matchedGameData)
  const highlightClips = clips.map((c) => ({
    mp4: c.mp4!,
    description: c.description,
    action_type: c.actionType,
    period: c.period,
    clock: c.clock,
  }))

  const shotChart = getShotChart(data, spotlightPlayerId)

  // ─── Hero (large player image, same as player_of_week / player_of_month) ──
  const heroImageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${spotlightPlayerId}.png`
  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: heroImageUrl,
      gradient_overlay: true,
      badge: 'PLAYER SPOTLIGHT',
      team_tricode: teamTricode || null,
      player_name: playerName,
      player_stats: Object.keys(heroStats).length > 0 ? heroStats : undefined,
    } satisfies HeroContent,
    player_id: spotlightPlayerId,
    team_tricode: teamTricode || null,
  })

  // ─── Headline (title + subtitle with stat line and optional elite extras) ──
  sections.push({
    id: nextSectionId(),
    section_type: 'headline',
    title: '',
    content: {
      text: draft.title || `${playerName} — ${data.matchup || ''}`,
      subtitle: subtitle || data.finalScore || '',
    } satisfies HeadlineContent,
    player_id: spotlightPlayerId,
    team_tricode: null,
  })

  // ─── Video carousel ────────────────────────────────────────
  if (highlightClips.length > 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'video_carousel',
      title: 'Highlights',
      content: { clips: highlightClips },
      player_id: spotlightPlayerId,
      team_tricode: null,
    })
  }

  // ─── Pull quote (elite callout when we have one) ─────────────
  if (pullQuoteText) {
    sections.push({
      id: nextSectionId(),
      section_type: 'pull_quote',
      title: '',
      content: {
        text: pullQuoteText,
        attribution: playerName,
        icon: 'chart',
      } satisfies PullQuoteContent,
      player_id: spotlightPlayerId,
      team_tricode: null,
    })
  }

  // ─── Insights (good / bad) ──────────────────────────────────
  if (insights.strengths.length > 0 || insights.weaknesses.length > 0) {
    const mdParts: string[] = []
    if (insights.strengths.length > 0) {
      mdParts.push('**What went well**')
      mdParts.push(...insights.strengths.map(s => `- ${s}`))
    }
    if (insights.weaknesses.length > 0) {
      if (mdParts.length > 0) mdParts.push('')
      mdParts.push('**What didn’t**')
      mdParts.push(...insights.weaknesses.map(s => `- ${s}`))
    }
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: mdParts.join('\n') } satisfies RichTextContent,
      player_id: spotlightPlayerId,
      team_tricode: null,
    })
  }

  // ─── Player highlight card (enriched overlays) ──────────────
  const dataOverlays: { label: string; value: string }[] = []
  if (stat.pts >= 0 && stat.pts > 0) dataOverlays.push({ label: 'PTS', value: String(stat.pts) })
  if (stat.reb >= 0 && stat.reb > 0) dataOverlays.push({ label: 'REB', value: String(stat.reb) })
  if (stat.ast >= 0 && stat.ast > 0) dataOverlays.push({ label: 'AST', value: String(stat.ast) })
  if (stat.stl > 0) dataOverlays.push({ label: 'STL', value: String(stat.stl) })
  if (stat.blk > 0) dataOverlays.push({ label: 'BLK', value: String(stat.blk) })
  if (stat.plusMinus != null && stat.plusMinus !== 0) {
    dataOverlays.push({ label: '+/−', value: stat.plusMinus > 0 ? `+${stat.plusMinus}` : String(stat.plusMinus) })
  }
  if (stat.fg3m > 0 && stat.fg3a > 0) {
    dataOverlays.push({ label: '3PM', value: `${stat.fg3m}/${stat.fg3a}` })
  }
  if (stat.ftm > 0 && stat.fta > 0) {
    dataOverlays.push({ label: 'FT', value: `${stat.ftm}/${stat.fta}` })
  }

  sections.push({
    id: nextSectionId(),
    section_type: 'player_highlight',
    title: playerName,
    content: {
      player_id: spotlightPlayerId,
      name: playerName,
      team_tricode: teamTricode || null,
      stats: heroStats,
      video_url: highlightClips[0]?.mp4,
      video_clips: highlightClips.length ? highlightClips : undefined,
      data_overlays: dataOverlays.length > 0 ? dataOverlays : undefined,
    } satisfies PlayerHighlightContent,
    player_id: spotlightPlayerId,
    team_tricode: teamTricode || null,
  })

  // ─── Chart: efficiency bars (from agg) or radar fallback ───
  const aggRowForCharts = (data.raw as Record<string, unknown>)?.AggregatedPlayerStats?.[String(spotlightPlayerId)] as
    | Record<string, unknown>
    | undefined
  const metricBar = buildSpotlightMetricBarSection(aggRowForCharts, playerName, spotlightPlayerId)
  if (metricBar) {
    sections.push({
      id: nextSectionId(),
      section_type: 'chart',
      title: metricBar.title || 'Efficiency profile',
      content: metricBar.content as unknown as ChartContent,
      player_id: spotlightPlayerId,
      team_tricode: null,
    })
  } else if (Object.keys(heroStats).length >= 3) {
    const radarData = [
      { subject: 'PTS', value: Math.min(100, (stat.pts / 40) * 100), fullMark: 100 },
      { subject: 'REB', value: Math.min(100, (stat.reb / 15) * 100), fullMark: 100 },
      { subject: 'AST', value: Math.min(100, (stat.ast / 12) * 100), fullMark: 100 },
      { subject: 'STL', value: Math.min(100, (stat.stl / 4) * 100), fullMark: 100 },
      { subject: 'BLK', value: Math.min(100, (stat.blk / 4) * 100), fullMark: 100 },
    ].filter(d => d.value > 0)

    if (radarData.length >= 3) {
      sections.push({
        id: nextSectionId(),
        section_type: 'chart',
        title: 'Scoring profile',
        content: {
          chart_type: 'radar',
          chart_props: { data: radarData },
          caption: `${playerName} — traditional stat shape vs game norms`,
        } satisfies ChartContent,
        player_id: spotlightPlayerId,
        team_tricode: null,
      })
    }
  }

  // ─── Chart: shot chart (when available) ───────────────────────
  if (shotChart && shotChart.length > 0) {
    const shots = shotChart.map((s: any) => ({
      eventNum: Number(s.GAME_EVENT_ID ?? 0),
      locX: s.LOC_X ?? null,
      locY: s.LOC_Y ?? null,
      shotResult: s.SHOT_MADE_FLAG === 1 ? 'Made' : 'Missed',
      shotDistance: s.SHOT_DISTANCE ?? null,
      period: Number(s.PERIOD ?? 0),
      clock: `${String(s.MINUTES_REMAINING ?? 0)}:${String(s.SECONDS_REMAINING ?? 0).padStart(2, '0')}`,
      description: `${s.EVENT_TYPE || ''} — ${s.ACTION_TYPE || ''} (${s.SHOT_ZONE_BASIC || ''})`.replace(/\s+/g, ' ').trim(),
    }))
    sections.push({
      id: nextSectionId(),
      section_type: 'chart',
      title: 'Shot chart',
      content: {
        chart_type: 'shot_chart',
        chart_props: { shots, playerName, teamTricode },
        caption: `${playerName} — ${shotChart.filter((s: any) => s.SHOT_MADE_FLAG === 1).length}/${shotChart.length} FGM`,
      } satisfies ChartContent,
      player_id: spotlightPlayerId,
      team_tricode: null,
    })

    const zonesRaw = getShotChartByZone(shotChart)
    const zones = zonesRaw
      .map(z => ({ ...z, missed: z.fga - z.fgm }))
      .sort((a, b) => b.fga - a.fga)
      .slice(0, 8)

    if (zones.length >= 3) {
      sections.push({
        id: nextSectionId(),
        section_type: 'chart',
        title: 'Shot profile (by zone)',
        content: {
          chart_type: 'bar',
          chart_props: { data: zones },
          caption: `${playerName} — makes vs misses by zone`,
        } satisfies ChartContent,
        player_id: spotlightPlayerId,
        team_tricode: null,
      })
    }
  }

  const aggRow = aggRowForCharts
  const aggTableHtml = buildAggregatedStatTableMarkdown(aggRow, playerName)
  if (aggTableHtml) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: 'Full stats',
      content: { markdown: aggTableHtml },
      player_id: spotlightPlayerId,
      team_tricode: null,
    })
  }

  // ─── Prop cards (unchanged) ─────────────────────────────────
  try {
    const { data: nbaGame } = await supabase
      .from('nba_games')
      .select('game_date, home_team_tricode, away_team_tricode')
      .eq('game_id', gameId)
      .maybeSingle()

    if (nbaGame?.game_date) {
      const targetDate = nbaGame.game_date.split('T')[0]
      const home = nbaGame.home_team_tricode || ''
      const away = nbaGame.away_team_tricode || ''
      const { data: propsGame } = await supabase
        .from('player_props_games')
        .select('id')
        .eq('game_date', targetDate)
        .or(`home_team_tricode.eq.${home},away_team_tricode.eq.${home},home_team_tricode.eq.${away},away_team_tricode.eq.${away}`)
        .limit(1)
        .maybeSingle()

      if (propsGame) {
        const { data: allProps } = await supabase
          .from('player_props')
          .select('id, bet_type, line, bet_type_id, game_id, raw_odd_data')
          .eq('game_id', propsGame.id)
          .eq('nba_player_id', spotlightPlayerId)

        const fullGameProps = filterFullGameProps(allProps || [])
        const { data: boxscore } = await supabase
          .from('nba_boxscores')
          .select('pts, reb, ast, stl, blk, tov, fg3m, ftm')
          .eq('nba_player_id', spotlightPlayerId)
          .eq('game_id', gameId)
          .single()

        if (boxscore && fullGameProps.length > 0) {
          for (const prop of fullGameProps) {
            const result = calculatePropResult(prop.bet_type, prop.line ?? 0, boxscore)
            if (result) {
              sections.push({
                id: nextSectionId(),
                section_type: 'prop_card',
                title: '',
                content: {
                  player_id: spotlightPlayerId,
                  player_name: playerName,
                  bet_type: prop.bet_type,
                  line: prop.line ?? 0,
                  actual: result.actualValue,
                  result: result.result,
                } satisfies PropCardContent,
                player_id: spotlightPlayerId,
                team_tricode: null,
              })
            }
          }
        }
      }
    }
  } catch {
    // Omit props on error — non-critical
  }

  return sections
}
