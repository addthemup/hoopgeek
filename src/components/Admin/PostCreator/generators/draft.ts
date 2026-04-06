/**
 * Draft (tank race) post generator.
 *
 * Freezes live data: standings (tank order) + draft prospect rankings.
 * Produces: hero → headline → tank_module.
 * Renders with the same TankModuleDisplay as the Tank tab in Standings module.
 */

import { supabase } from '../../../../utils/supabase'
import type {
  HeroContent,
  HeadlineContent,
  TankModuleContent,
  TankRowEntry,
  TankProspectEntry,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'

const LOTTERY_TOP4_PCT = [52.1, 52.1, 52.1, 48.1, 42.1, 37.2, 32.0, 26.3, 20.3, 13.9, 9.4, 7.1, 4.8, 2.4]
const LOTTERY_ONE_OVR_PCT = [14.0, 14.0, 14.0, 12.5, 10.5, 9.0, 7.5, 6.0, 4.5, 3.0, 2.0, 1.5, 1.0, 0.5]

function getCurrentSeason(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  return month >= 10 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`
}

export async function generateDraftSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  resetSectionIdCounter()
  const sections: SectionDraft[] = []
  const draft = ctx.draft
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const season = getCurrentSeason()

  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: '',
      gradient_overlay: true,
      badge: 'DRAFT',
    } satisfies HeroContent,
    player_id: null,
    team_tricode: null,
  })

  sections.push({
    id: nextSectionId(),
    section_type: 'headline',
    title: '',
    content: {
      text: draft.title || `Tank Race — ${season}`,
      subtitle: draft.subtitle || snapshotDate,
    } satisfies HeadlineContent,
    player_id: null,
    team_tricode: null,
  })

  // 1. Fetch standings
  const { data: standingsRows, error: standingsError } = await supabase
    .from('nba_standings')
    .select('*')
    .eq('season', season)
    .order('conference', { ascending: true })
    .order('conference_rank', { ascending: true })

  if (standingsError || !standingsRows?.length) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `Standings not available for ${season}. Run maintenance to sync.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  const east = standingsRows.filter((r: any) => r.conference === 'East')
  const west = standingsRows.filter((r: any) => r.conference === 'West')
  const all = [...east, ...west].sort((a: any, b: any) => (a.win_percentage ?? 0) - (b.win_percentage ?? 0))
  const leader = all[0]
  const leaderW = leader?.wins ?? 0
  const leaderL = leader?.losses ?? 0

  const tankOrder = all.map((t: any, i: number) => {
    const w = t.wins ?? 0
    const l = t.losses ?? 0
    const gb = leader ? w - leaderW + (leaderL - l) / 2 : 0
    const pick = i + 1
    const top4 = pick <= 14 ? LOTTERY_TOP4_PCT[pick - 1] : null
    const oneOvr = pick <= 14 ? LOTTERY_ONE_OVR_PCT[pick - 1] : null
    return {
      team_id: t.team_id,
      team_abbreviation: t.team_abbreviation ?? t.abbreviation ?? '',
      wins: w,
      losses: l,
      pick,
      tankGb: gb,
      top4Pct: top4,
      oneOvrPct: oneOvr,
    }
  })

  // 2. Fetch draft prospect rankings (latest snapshot_week, top 14 by consensus)
  const { data: latestWeekRow } = await supabase
    .from('draft_rankings')
    .select('snapshot_week')
    .not('draft_prospect_id', 'is', null)
    .order('snapshot_week', { ascending: false })
    .limit(1)
    .maybeSingle()

  const snapshotWeek = latestWeekRow?.snapshot_week ?? null
  let prospects: TankProspectEntry[] = []

  if (snapshotWeek) {
    const { data: rankRows } = await supabase
      .from('draft_rankings')
      .select('draft_prospect_id, rank')
      .eq('snapshot_week', snapshotWeek)
      .not('draft_prospect_id', 'is', null)

    const byProspect = new Map<string, number[]>()
    for (const r of rankRows ?? []) {
      const id = r.draft_prospect_id
      if (!byProspect.has(id)) byProspect.set(id, [])
      byProspect.get(id)!.push(r.rank)
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
        (a: any, b: any) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
      )
      prospects = sorted.map((p: any) => ({
        id: p.id,
        player_name_full: p.player_name_full ?? '',
        player_slug: p.player_slug,
        school_team: p.school_team ?? null,
        position_primary: p.position_primary ?? null,
        image_url: p.image_url ?? null,
      }))
    }
  }

  const teamIds = tankOrder.slice(0, 14).map((t: any) => t.team_id)
  const { data: teamRows } = await supabase
    .from('nba_teams')
    .select('id, team_id')
    .in('team_id', teamIds)
  const teamIdToInternal = new Map<number, string>()
  for (const row of teamRows ?? []) {
    teamIdToInternal.set(row.team_id, row.id)
  }

  const rows: TankRowEntry[] = tankOrder.slice(0, 14).map((t: any, index: number) => ({
    pick: t.pick,
    team_id: t.team_id,
    team_abbreviation: t.team_abbreviation,
    team_internal_id: teamIdToInternal.get(t.team_id),
    wins: t.wins,
    losses: t.losses,
    tank_gb: t.tankGb,
    top4_pct: t.top4Pct,
    one_ovr_pct: t.oneOvrPct,
    prospect: prospects[index] ?? null,
  }))

  sections.push({
    id: nextSectionId(),
    section_type: 'tank_module',
    title: '',
    content: {
      rows,
      season,
      snapshot_date: snapshotDate,
      snapshot_week: snapshotWeek ?? undefined,
    } satisfies TankModuleContent,
    player_id: null,
    team_tricode: null,
  })

  return sections
}
