/**
 * Mirrors draft.ts — tank_module snapshot for automate-draft.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import type { SectionRow } from '../prop_prediction/buildPropPredictionSnapshot.ts'

const LOTTERY_TOP4_PCT = [52.1, 52.1, 52.1, 48.1, 42.1, 37.2, 32.0, 26.3, 20.3, 13.9, 9.4, 7.1, 4.8, 2.4]
const LOTTERY_ONE_OVR_PCT = [14.0, 14.0, 14.0, 12.5, 10.5, 9.0, 7.5, 6.0, 4.5, 3.0, 2.0, 1.5, 1.0, 0.5]

function getCurrentSeason(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  return month >= 10 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`
}

export async function buildDraftSnapshot(
  supabase: SupabaseClient,
): Promise<{
  sections: SectionRow[]
  tank_snapshot: Record<string, unknown>
  season: string
  snapshot_date: string
} | null> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const season = getCurrentSeason()

  const { data: standingsRows, error: standingsError } = await supabase
    .from('nba_standings')
    .select('*')
    .eq('season', season)
    .order('conference', { ascending: true })
    .order('conference_rank', { ascending: true })

  if (standingsError || !standingsRows?.length) return null

  const east = standingsRows.filter((r: Record<string, unknown>) => r.conference === 'East')
  const west = standingsRows.filter((r: Record<string, unknown>) => r.conference === 'West')
  const all = [...east, ...west].sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      Number(a.win_percentage ?? 0) - Number(b.win_percentage ?? 0),
  )
  const leader = all[0] as Record<string, unknown> | undefined
  const leaderW = Number(leader?.wins ?? 0)
  const leaderL = Number(leader?.losses ?? 0)

  const tankOrder = all.map((t: Record<string, unknown>, i: number) => {
    const w = Number(t.wins ?? 0)
    const l = Number(t.losses ?? 0)
    const gb = leader ? w - leaderW + (leaderL - l) / 2 : 0
    const pick = i + 1
    const top4 = pick <= 14 ? LOTTERY_TOP4_PCT[pick - 1] : null
    const oneOvr = pick <= 14 ? LOTTERY_ONE_OVR_PCT[pick - 1] : null
    return {
      team_id: t.team_id,
      team_abbreviation: (t.team_abbreviation ?? t.abbreviation ?? '') as string,
      wins: w,
      losses: l,
      pick,
      tankGb: gb,
      top4Pct: top4,
      oneOvrPct: oneOvr,
    }
  })

  const { data: latestWeekRow } = await supabase
    .from('draft_rankings')
    .select('snapshot_week')
    .not('draft_prospect_id', 'is', null)
    .order('snapshot_week', { ascending: false })
    .limit(1)
    .maybeSingle()

  const snapshotWeek = latestWeekRow?.snapshot_week ?? null
  const prospects: Array<{
    id: string
    player_name_full: string
    player_slug: string | null
    school_team: string | null
    position_primary: string | null
    image_url: string | null
  }> = []

  if (snapshotWeek) {
    const { data: rankRows } = await supabase
      .from('draft_rankings')
      .select('draft_prospect_id, rank')
      .eq('snapshot_week', snapshotWeek)
      .not('draft_prospect_id', 'is', null)

    const byProspect = new Map<string, number[]>()
    for (const r of rankRows ?? []) {
      const id = r.draft_prospect_id as string
      if (!byProspect.has(id)) byProspect.set(id, [])
      byProspect.get(id)!.push(r.rank as number)
    }

    const avgByProspect = new Map<string, number>()
    byProspect.forEach((ranks, id) => {
      avgByProspect.set(id, ranks.reduce((a, b) => a + b, 0) / ranks.length)
    })

    const sortedIds = Array.from(avgByProspect.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id)
      .slice(0, 14)

    if (sortedIds.length > 0) {
      const { data: prospectRows } = await supabase
        .from('draft_prospects')
        .select('id, player_name_full, player_slug, school_team, position_primary, image_url')
        .in('id', sortedIds)

      const orderMap = new Map(sortedIds.map((id, i) => [id, i]))
      const sorted = (prospectRows ?? []).sort(
        (a: { id: string }, b: { id: string }) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      )
      for (const p of sorted) {
        prospects.push({
          id: p.id,
          player_name_full: p.player_name_full ?? '',
          player_slug: p.player_slug,
          school_team: p.school_team ?? null,
          position_primary: p.position_primary ?? null,
          image_url: p.image_url ?? null,
        })
      }
    }
  }

  const teamIds = tankOrder.slice(0, 14).map((t) => t.team_id as number)
  const { data: teamRows } = await supabase.from('nba_teams').select('id, team_id').in('team_id', teamIds)
  const teamIdToInternal = new Map<number, string>()
  for (const row of teamRows ?? []) {
    teamIdToInternal.set(row.team_id as number, row.id as string)
  }

  const rows = tankOrder.slice(0, 14).map((t, index) => ({
    pick: t.pick,
    team_id: t.team_id,
    team_abbreviation: t.team_abbreviation,
    team_internal_id: teamIdToInternal.get(t.team_id as number),
    wins: t.wins,
    losses: t.losses,
    tank_gb: t.tankGb,
    top4_pct: t.top4Pct,
    one_ovr_pct: t.oneOvrPct,
    prospect: prospects[index] ?? null,
  }))

  const tankModuleContent = {
    rows,
    season,
    snapshot_date: snapshotDate,
    snapshot_week: snapshotWeek ?? undefined,
  }

  const sections: SectionRow[] = [
    {
      section_type: 'hero',
      title: '',
      content: { image_url: '', gradient_overlay: true, badge: 'DRAFT' },
      player_id: null,
      team_tricode: null,
    },
    {
      section_type: 'headline',
      title: '',
      content: {
        text: `Tank Race — ${season}`,
        subtitle: snapshotDate,
      },
      player_id: null,
      team_tricode: null,
    },
    {
      section_type: 'tank_module',
      title: '',
      content: tankModuleContent as unknown as Record<string, unknown>,
      player_id: null,
      team_tricode: null,
    },
  ]

  return {
    sections,
    tank_snapshot: tankModuleContent as unknown as Record<string, unknown>,
    season,
    snapshot_date: snapshotDate,
  }
}
