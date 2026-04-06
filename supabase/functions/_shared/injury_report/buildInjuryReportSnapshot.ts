/**
 * Mirrors src/components/Admin/PostCreator/generators/injuryReport.ts
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import type { SectionRow } from '../prop_prediction/buildPropPredictionSnapshot.ts'

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

interface ProgressSeg {
  status: string
  startPercent: number
  widthPercent: number
}

function calculateProgressSegments(history: { injury_status?: string; date_updated: string }[]): ProgressSeg[] {
  const SEASON_START = new Date('2025-10-21')
  SEASON_START.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const totalDays = Math.ceil((today.getTime() - SEASON_START.getTime()) / 86400000) + 1

  if (!history || history.length === 0) {
    return [{ status: 'Healthy', startPercent: 0, widthPercent: 100 }]
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime(),
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
        : raw === 'Probable' ? 'Probable'
          : 'Healthy'

    if (!curSeg || curSeg.status !== status) {
      if (curSeg) injurySegs.push(curSeg)
      curSeg = { status, startDate: d, endDate: d }
    } else {
      curSeg.endDate = d
    }
  }
  if (curSeg) injurySegs.push(curSeg)
  injurySegs.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  const all: ProgressSeg[] = []
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
        all.push({
          status: 'Healthy',
          startPercent: (gapStartDays / totalDays) * 100,
          widthPercent: (gapDays / totalDays) * 100,
        })
      }
    }
    const segStartDays = Math.ceil((segStart.getTime() - SEASON_START.getTime()) / 86400000)
    const segEnd = new Date(seg.endDate)
    segEnd.setHours(23, 59, 59, 999)
    const segEndDays = Math.ceil((segEnd.getTime() - SEASON_START.getTime()) / 86400000)
    const segDays = segEndDays - segStartDays + 1
    all.push({
      status: seg.status,
      startPercent: (segStartDays / totalDays) * 100,
      widthPercent: (segDays / totalDays) * 100,
    })
    cur = new Date(segEnd)
    cur.setDate(cur.getDate() + 1)
    cur.setHours(0, 0, 0, 0)
  }

  if (cur.getTime() <= today.getTime()) {
    const gapStartDays = Math.ceil((cur.getTime() - SEASON_START.getTime()) / 86400000)
    const gapDays = Math.ceil((today.getTime() - cur.getTime()) / 86400000) + 1
    all.push({
      status: 'Healthy',
      startPercent: (gapStartDays / totalDays) * 100,
      widthPercent: (gapDays / totalDays) * 100,
    })
  }

  if (all.length === 0) all.push({ status: 'Healthy', startPercent: 0, widthPercent: 100 })
  return all.sort((a, b) => a.startPercent - b.startPercent)
}

export async function buildInjuryReportSnapshot(
  supabase: SupabaseClient,
  params: { targetDate: string; targetTeams: [string, string] },
): Promise<{ injury_snapshot: Record<string, unknown>; sections: SectionRow[] } | null> {
  const targetDate = params.targetDate.includes('T') ? params.targetDate.split('T')[0] : params.targetDate
  const targetTeams = params.targetTeams
  if (targetTeams.length < 2) return null

  const teamLabel = `${targetTeams[0]} vs ${targetTeams[1]}`
  const today = new Date().toISOString().slice(0, 10)
  const isPast = targetDate ? targetDate < today : false
  let rawInjuries: {
    nba_player_id: number
    injury_type: string | null
    injury_description: string | null
    injury_status: string
    date_updated: string
  }[] = []

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
    if (error) console.error('[InjurySnapshot] past query error:', error)
    else {
      const seen = new Set<number>()
      for (const inj of data || []) {
        if (!seen.has(inj.nba_player_id)) {
          seen.add(inj.nba_player_id)
          rawInjuries.push(inj as (typeof rawInjuries)[0])
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
    if (error) console.error('[InjurySnapshot] current query error:', error)
    else rawInjuries = (data || []) as typeof rawInjuries
  }

  const allPlayerIds = Array.from(new Set(rawInjuries.map((i) => i.nba_player_id).filter(Boolean)))
  const { data: players } = allPlayerIds.length > 0
    ? await supabase.from('nba_players').select('nba_player_id, name, team_abbreviation').in('nba_player_id', allPlayerIds)
    : { data: [] }

  const playerMap = new Map((players || []).map((p) => [p.nba_player_id, p]))

  const teamSet = new Set(targetTeams)
  const teamInjuries = rawInjuries.filter((inj) => {
    const p = playerMap.get(inj.nba_player_id)
    return p && teamSet.has(p.team_abbreviation)
  })

  if (teamInjuries.length === 0) return null

  const teamPlayerIds = teamInjuries.map((i) => i.nba_player_id)
  const { data: historyData } = teamPlayerIds.length > 0
    ? await supabase
      .from('nba_injuries')
      .select('nba_player_id, injury_status, date_updated')
      .in('nba_player_id', teamPlayerIds)
      .in('injury_status', ['Out', 'Questionable', 'Day-to-Day', 'Probable', 'Healthy'])
      .order('date_updated', { ascending: false })
      .limit(1000)
    : { data: [] }

  const historyMap = new Map<number, { injury_status?: string; date_updated: string }[]>()
  for (const row of historyData || []) {
    const list = historyMap.get(row.nba_player_id) || []
    list.push(row)
    historyMap.set(row.nba_player_id, list)
  }

  teamInjuries.sort(
    (a, b) => (STATUS_ORDER[a.injury_status] ?? 99) - (STATUS_ORDER[b.injury_status] ?? 99),
  )

  const entries = teamInjuries.map((inj) => {
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

  const injuryModuleContent = {
    injuries: entries,
    teams: targetTeams,
    date: targetDate || today,
  }

  const sections: SectionRow[] = [
    {
      section_type: 'hero',
      title: '',
      content: {
        image_url: '',
        gradient_overlay: true,
        badge: 'INJURY REPORT',
        team_tricodes: targetTeams,
      },
      player_id: null,
      team_tricode: targetTeams[0] || null,
    },
    {
      section_type: 'headline',
      title: '',
      content: {
        text: `Injury Report — ${teamLabel}`,
        subtitle: targetDate || '',
      },
      player_id: null,
      team_tricode: null,
    },
    {
      section_type: 'injury_module',
      title: '',
      content: injuryModuleContent as unknown as Record<string, unknown>,
      player_id: null,
      team_tricode: null,
    },
  ]

  return {
    injury_snapshot: injuryModuleContent as unknown as Record<string, unknown>,
    sections,
  }
}
