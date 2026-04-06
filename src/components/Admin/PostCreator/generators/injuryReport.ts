/**
 * Injury Report section generator.
 *
 * Produces: hero → headline → injury_module
 *
 * The injury_module section stores the full frozen dataset so the shared
 * InjuryModuleDisplay component can render it identically to the live
 * InjuriesModule in /feed/.
 */

import { supabase } from '../../../../utils/supabase'
import type {
  HeroContent,
  HeadlineContent,
  InjuryModuleContent,
  InjuryModuleEntry,
  InjuryProgressSegment,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'

const STATUS_ORDER: Record<string, number> = {
  Out: 0,
  Doubtful: 1,
  Questionable: 2,
  'Day-to-Day': 3,
}

function parseInjury(injuryType: string | null, injuryDescription: string | null): string {
  if (injuryType) {
    const afterDash = injuryType.includes(' - ')
      ? injuryType.slice(injuryType.indexOf(' - ') + 3).trim()
      : injuryType
    if (afterDash && afterDash !== 'Injury/Illness') return afterDash
  }
  if (injuryDescription) {
    const parts = injuryDescription.split(/\s+/)
    if (parts.length > 1 && /^[A-Z]/.test(parts[1])) return parts[0]
    return injuryDescription
  }
  return 'Injury'
}

function calculateProgressSegments(history: any[]): InjuryProgressSegment[] {
  const SEASON_START = new Date('2025-10-21')
  SEASON_START.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const totalDays = Math.ceil((today.getTime() - SEASON_START.getTime()) / 86400000) + 1

  if (!history || history.length === 0) {
    return [{ status: 'Healthy', startPercent: 0, widthPercent: 100 }]
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime()
  )

  const injurySegs: Array<{ status: string; startDate: Date; endDate: Date }> = []
  let curSeg: { status: string; startDate: Date; endDate: Date } | null = null

  for (const inj of sorted) {
    const d = new Date(inj.date_updated)
    d.setHours(0, 0, 0, 0)
    const raw = inj.injury_status || 'Healthy'
    const status =
      raw === 'Out' ? 'Out'
        : raw === 'Day-to-Day' || raw === 'Questionable' ? 'Questionable'
          : raw === 'Probable' ? 'Probable' : 'Healthy'

    if (!curSeg || curSeg.status !== status) {
      if (curSeg) injurySegs.push(curSeg)
      curSeg = { status, startDate: d, endDate: d }
    } else {
      curSeg.endDate = d
    }
  }
  if (curSeg) injurySegs.push(curSeg)
  injurySegs.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  const all: InjuryProgressSegment[] = []
  let cur = new Date(SEASON_START)

  for (const seg of injurySegs) {
    const segStart = new Date(seg.startDate)
    segStart.setHours(0, 0, 0, 0)
    if (cur.getTime() < segStart.getTime()) {
      const gapEnd = new Date(segStart)
      gapEnd.setDate(gapEnd.getDate() - 1)
      if (cur.getTime() <= gapEnd.getTime()) {
        const gapDays = Math.ceil((gapEnd.getTime() - cur.getTime()) / 86400000) + 1
        const gapStartDays = Math.ceil((cur.getTime() - SEASON_START.getTime()) / 86400000)
        all.push({ status: 'Healthy', startPercent: (gapStartDays / totalDays) * 100, widthPercent: (gapDays / totalDays) * 100 })
      }
    }
    const segStartDays = Math.ceil((segStart.getTime() - SEASON_START.getTime()) / 86400000)
    const segEnd = new Date(seg.endDate)
    segEnd.setHours(23, 59, 59, 999)
    const segEndDays = Math.ceil((segEnd.getTime() - SEASON_START.getTime()) / 86400000)
    const segDays = segEndDays - segStartDays + 1
    all.push({ status: seg.status, startPercent: (segStartDays / totalDays) * 100, widthPercent: (segDays / totalDays) * 100 })
    cur = new Date(segEnd)
    cur.setDate(cur.getDate() + 1)
    cur.setHours(0, 0, 0, 0)
  }

  if (cur.getTime() <= today.getTime()) {
    const gapStartDays = Math.ceil((cur.getTime() - SEASON_START.getTime()) / 86400000)
    const gapDays = Math.ceil((today.getTime() - cur.getTime()) / 86400000) + 1
    all.push({ status: 'Healthy', startPercent: (gapStartDays / totalDays) * 100, widthPercent: (gapDays / totalDays) * 100 })
  }

  if (all.length === 0) all.push({ status: 'Healthy', startPercent: 0, widthPercent: 100 })
  return all.sort((a, b) => a.startPercent - b.startPercent)
}

// ─── Generator ───────────────────────────────────────────────

export async function generateInjuryReportSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  const { draft, targetTeams } = ctx
  const targetDate = ctx.targetDate?.includes('T') ? ctx.targetDate.split('T')[0] : ctx.targetDate
  if (!targetTeams?.length) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const teamLabel = targetTeams.join(' vs ')

  // Hero
  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: '',
      gradient_overlay: true,
      badge: 'INJURY REPORT',
      team_tricodes: targetTeams,
    } satisfies HeroContent,
    player_id: null,
    team_tricode: targetTeams[0] || null,
  })

  // Headline
  sections.push({
    id: nextSectionId(),
    section_type: 'headline',
    title: '',
    content: {
      text: draft.title || `Injury Report — ${teamLabel}`,
      subtitle: draft.subtitle || targetDate || '',
    } satisfies HeadlineContent,
    player_id: null,
    team_tricode: null,
  })

  // Fetch current injuries
  const today = new Date().toISOString().slice(0, 10)
  const isPast = targetDate ? targetDate < today : false
  let rawInjuries: any[] = []

  if (isPast && targetDate) {
    const dayStart = `${targetDate}T00:00:00.000Z`
    const dayEnd = `${targetDate}T23:59:59.999Z`
    const { data, error } = await supabase
      .from('nba_injuries')
      .select('nba_player_id, injury_type, injury_description, injury_status, date_updated')
      .gte('date_updated', dayStart)
      .lte('date_updated', dayEnd)
      .in('injury_status', ['Out', 'Questionable', 'Day-to-Day', 'Doubtful'])
      .order('date_updated', { ascending: false })
      .limit(300)
    if (error) console.error('[InjuryGen] past query error:', error)
    else {
      const seen = new Set<number>()
      for (const inj of data || []) {
        if (!seen.has(inj.nba_player_id)) {
          seen.add(inj.nba_player_id)
          rawInjuries.push(inj)
        }
      }
    }
  } else {
    const { data, error } = await supabase
      .from('nba_injuries')
      .select('nba_player_id, injury_type, injury_description, injury_status, date_updated')
      .eq('is_current', true)
      .in('injury_status', ['Out', 'Questionable', 'Day-to-Day', 'Doubtful'])
      .order('date_updated', { ascending: false })
      .limit(300)
    if (error) console.error('[InjuryGen] current query error:', error)
    else rawInjuries = data || []
  }

  // Resolve player info
  const allPlayerIds = Array.from(new Set(rawInjuries.map(i => i.nba_player_id).filter(Boolean)))
  const { data: players } = allPlayerIds.length > 0
    ? await supabase.from('nba_players').select('nba_player_id, name, team_abbreviation').in('nba_player_id', allPlayerIds)
    : { data: [] }

  const playerMap = new Map((players || []).map(p => [p.nba_player_id, p]))

  // Filter to target teams
  const teamSet = new Set(targetTeams)
  const teamInjuries = rawInjuries.filter(inj => {
    const p = playerMap.get(inj.nba_player_id)
    return p && teamSet.has(p.team_abbreviation)
  })

  // Fetch full injury history for progress bars
  const teamPlayerIds = teamInjuries.map(i => i.nba_player_id)
  const { data: historyData } = teamPlayerIds.length > 0
    ? await supabase
        .from('nba_injuries')
        .select('nba_player_id, injury_status, date_updated')
        .in('nba_player_id', teamPlayerIds)
        .in('injury_status', ['Out', 'Questionable', 'Day-to-Day', 'Probable', 'Healthy'])
        .order('date_updated', { ascending: false })
        .limit(1000)
    : { data: [] }

  const historyMap = new Map<number, any[]>()
  for (const row of historyData || []) {
    const list = historyMap.get(row.nba_player_id) || []
    list.push(row)
    historyMap.set(row.nba_player_id, list)
  }

  // Sort: Out → Doubtful → Questionable → Day-to-Day
  teamInjuries.sort((a: any, b: any) => (STATUS_ORDER[a.injury_status] ?? 99) - (STATUS_ORDER[b.injury_status] ?? 99))

  // Build frozen entries
  const entries: InjuryModuleEntry[] = teamInjuries.map(inj => {
    const player = playerMap.get(inj.nba_player_id)!
    return {
      nba_player_id: inj.nba_player_id,
      player_name: player.name,
      team_tricode: player.team_abbreviation,
      injury_status: inj.injury_status,
      injury_type: parseInjury(inj.injury_type, inj.injury_description),
      progress_segments: calculateProgressSegments(historyMap.get(inj.nba_player_id) || []),
    }
  })

  // Single injury_module section with all data
  sections.push({
    id: nextSectionId(),
    section_type: 'injury_module',
    title: '',
    content: {
      injuries: entries,
      teams: targetTeams,
      date: targetDate || today,
    } satisfies InjuryModuleContent,
    player_id: null,
    team_tricode: null,
  })

  return sections
}
