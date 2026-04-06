/**
 * Extra feed sections for automated player spotlight posts (Edge + shared with app).
 * Keeps parity with Post Creator: shot chart, zone profile, insights, pull quote, stat table.
 */

export type AutomationSection = {
  section_type: string
  title: string | null
  content: Record<string, unknown>
  player_id: number | null
  team_tricode: string | null
}

function getShotChartArray(raw: Record<string, unknown> | undefined, personId: number): unknown[] | null {
  const sc = raw?.shotChartData as Record<string, unknown> | undefined
  if (!sc) return null
  const arr = sc[String(personId)]
  return Array.isArray(arr) ? arr : null
}

function getShotChartByZone(shots: Array<Record<string, unknown>>): Array<{ zone: string; fgm: number; fga: number; pct: number }> {
  const byZone: Record<string, { fgm: number; fga: number }> = {}
  for (const s of shots) {
    const zone = String(s.SHOT_ZONE_BASIC || 'Other')
    if (!byZone[zone]) byZone[zone] = { fgm: 0, fga: 0 }
    byZone[zone].fga++
    if (s.SHOT_MADE_FLAG === 1) byZone[zone].fgm++
  }
  return Object.entries(byZone).map(([zone, { fgm, fga }]) => ({
    zone,
    fgm,
    fga,
    pct: fga > 0 ? Math.round((fgm / fga) * 1000) / 10 : 0,
  }))
}

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
  { key: 'advanced_netRating', label: 'Net Rating', higherIsBetter: true, format: (v) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) },
  { key: 'advanced_trueShootingPercentage', label: 'True Shooting', higherIsBetter: true, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'advanced_effectiveFieldGoalPercentage', label: 'eFG%', higherIsBetter: true, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'advanced_PIE', label: 'PIE', higherIsBetter: true, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'advanced_assistPercentage', label: 'AST%', higherIsBetter: true, format: (v) => `${(v * 100).toFixed(0)}%` },
]

function getAllPlayersFromAgg(aggregated: Record<string, Record<string, unknown>> | null | undefined): Record<string, Record<string, unknown>> {
  if (!aggregated || typeof aggregated !== 'object') return {}
  const out: Record<string, Record<string, unknown>> = {}
  for (const [pid, stats] of Object.entries(aggregated)) {
    if (!/^\d+$/.test(pid) || !stats) continue
    const min = stats.advanced_minutes ?? stats.traditional_minutes
    if (min) {
      const parts = String(min).split(':').map(Number)
      const totalMin = (parts[0] || 0) + ((parts[1] || 0) / 60)
      if (totalMin >= 5) out[pid] = stats
    } else {
      out[pid] = stats
    }
  }
  return out
}

function getSpotlightInsightsMarkdown(
  aggregated: Record<string, Record<string, unknown>> | null | undefined,
  spotlightPlayerId: number,
): string | null {
  const all = getAllPlayersFromAgg(aggregated)
  const pidStr = String(spotlightPlayerId)
  const player = all[pidStr]
  if (!player || Object.keys(all).length < 2) return null

  const lines: string[] = ['**How they stacked up in this game**', '']
  for (const m of INSIGHT_METRICS) {
    const raw = player[m.key]
    if (raw === undefined || raw === null) continue
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
    if (!Number.isFinite(num)) continue

    const values = Object.entries(all)
      .map(([, s]) => {
        const v = s[m.key]
        return v != null ? (typeof v === 'number' ? v : parseFloat(String(v))) : NaN
      })
      .filter((v) => Number.isFinite(v))
    if (values.length < 2) continue

    values.sort((a, b) => (m.higherIsBetter ? b - a : a - b))
    const rank = values.indexOf(num) + 1
    const total = values.length
    const display = m.format ? m.format(num) : String(Math.round(num))

    if (rank <= 3 && m.higherIsBetter) {
      if (rank === 1) lines.push(`- Led the game in **${m.label}** (${display})`)
      else lines.push(`- ${m.label}: **${display}** (top ${rank} of ${total})`)
    }
  }

  // Dedupe similar lines
  const uniq = [...new Set(lines)]
  if (uniq.length <= 2) return null
  return uniq.join('\n')
}

function pickPullQuote(
  stat: { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fg3m: number; fg3a: number; ftm: number; fta: number; plusMinus: number | null },
): string | null {
  if (stat.ast >= 6 && stat.tov <= 2 && stat.ast > 0) {
    const ratio = stat.tov > 0 ? (stat.ast / stat.tov).toFixed(1) : String(stat.ast)
    return `${stat.ast} AST${stat.tov > 0 ? `, ${stat.tov} TO` : ''} — ${ratio} AST/TO`
  }
  if (stat.fg3a >= 3 && stat.fg3m >= 2 && stat.fg3m / stat.fg3a >= 0.4) {
    return `${stat.fg3m}/${stat.fg3a} from three`
  }
  if (stat.ftm >= 5 && stat.fta > 0 && stat.ftm === stat.fta) {
    return `${stat.ftm}/${stat.fta} from the line`
  }
  if (stat.stl + stat.blk >= 2) {
    const parts = []
    if (stat.stl > 0) parts.push(`${stat.stl} STL`)
    if (stat.blk > 0) parts.push(`${stat.blk} BLK`)
    return parts.join(', ')
  }
  if (stat.plusMinus != null && stat.plusMinus >= 10) {
    return `+${stat.plusMinus} on the floor`
  }
  return null
}

/**
 * Horizontal bar chart of advanced rates (0–100 scale) — preferred over generic radar when agg data exists.
 */
export function buildSpotlightMetricBarSection(
  aggRow: Record<string, unknown> | undefined,
  playerName: string,
  personId: number,
): AutomationSection | null {
  if (!aggRow) return null
  const items: { label: string; value: number }[] = []
  const pushPct = (label: string, key: string) => {
    const v = aggRow[key]
    if (v == null || v === '') return
    const n = typeof v === 'number' ? v : parseFloat(String(v))
    if (!Number.isFinite(n)) return
    const pctVal = n <= 1 && n >= 0 ? n * 100 : Math.min(100, Math.max(0, n))
    items.push({ label, value: Math.round(pctVal * 10) / 10 })
  }
  pushPct('True Shooting', 'advanced_trueShootingPercentage')
  pushPct('eFG%', 'advanced_effectiveFieldGoalPercentage')
  pushPct('Usage', 'advanced_usagePercentage')
  pushPct('PIE', 'advanced_PIE')
  if (items.length < 3) return null
  return {
    section_type: 'chart',
    title: 'Efficiency profile',
    content: {
      chart_type: 'metric_bar',
      chart_props: { data: items },
      caption: `${playerName} — advanced rates (same 0–100 scale)`,
    },
    player_id: personId,
    team_tricode: null,
  }
}

/** Side-by-side team comparison from `AggregatedTeamStats` (game JSON). */
export function buildAggregatedTeamStatsHtml(
  raw: Record<string, unknown> | undefined,
  teamTricodes: string[],
): string | null {
  const aggRoot = raw?.AggregatedTeamStats as Record<string, Record<string, unknown>> | undefined
  if (!aggRoot || typeof aggRoot !== 'object') return null
  const rows = Object.values(aggRoot).filter((t) => t && typeof t === 'object') as Record<string, unknown>[]
  if (rows.length < 2) return null

  const byTri = (tri: string) => rows.find((r) => String(r.teamTricode ?? '').toUpperCase() === tri.toUpperCase())
  let t0 = teamTricodes[0] ? byTri(teamTricodes[0]) : undefined
  let t1 = teamTricodes[1] ? byTri(teamTricodes[1]) : undefined
  if (!t0 || !t1) {
    t0 = rows[0]
    t1 = rows[1]
  }
  const tri0 = String(t0.teamTricode ?? teamTricodes[0] ?? 'Away')
  const tri1 = String(t1.teamTricode ?? teamTricodes[1] ?? 'Home')

  const tr = (label: string, k: string, fmt?: (v: unknown) => string) => {
    const a = fmt ? fmt(t0[k]) : cellStr(t0[k])
    const b = fmt ? fmt(t1[k]) : cellStr(t1[k])
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#aaa;font-size:0.875rem">${escapeHtml(
      label,
    )}</td><td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#fff;font-weight:600;text-align:right">${escapeHtml(
      a,
    )}</td><td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#fff;font-weight:600;text-align:right">${escapeHtml(
      b,
    )}</td></tr>`
  }

  const thead = `<thead><tr><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #444;color:#ccc">Stat</th><th style="padding:8px 12px;border-bottom:1px solid #444;color:#ccc;text-align:right">${escapeHtml(
    tri0,
  )}</th><th style="padding:8px 12px;border-bottom:1px solid #444;color:#ccc;text-align:right">${escapeHtml(tri1)}</th></tr></thead>`

  const body = [
    tr('PTS', 'traditional_points'),
    tr('REB', 'traditional_reboundsTotal'),
    tr('AST', 'traditional_assists'),
    tr('FG%', 'traditional_fieldGoalsPercentage', (v) => pct(v)),
    tr('3P%', 'traditional_threePointersPercentage', (v) => pct(v)),
    tr('FT%', 'traditional_freeThrowsPercentage', (v) => pct(v)),
    tr('ORtg', 'advanced_offensiveRating', (v) => numPlain(v)),
    tr('DRtg', 'advanced_defensiveRating', (v) => numPlain(v)),
    tr('Net', 'advanced_netRating', (v) => {
      if (v == null || v === '') return '—'
      const n = typeof v === 'number' ? v : parseFloat(String(v))
      if (!Number.isFinite(n)) return '—'
      return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1)
    }),
    tr('Pace', 'advanced_pace', (v) => numPlain(v)),
    tr('eFG%', 'fourFactors_effectiveFieldGoalPercentage', (v) => pct(v)),
    tr('TOV%', 'fourFactors_teamTurnoverPercentage', (v) => pct(v)),
    tr('OREB%', 'fourFactors_offensiveReboundPercentage', (v) => pct(v)),
  ].join('')

  return `<div class="spotlight-stat-table"><p style="margin:0 0 12px;color:#fff;font-weight:700">Team box &amp; advanced</p><table style="width:100%;border-collapse:collapse;border:1px solid #333;border-radius:8px;overflow:hidden">${thead}<tbody>${body}</tbody></table></div>`
}

function cellStr(v: unknown): string {
  if (v == null || v === '') return '—'
  return String(v)
}

function numPlain(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(1)
}

export function buildAggregatedStatTableMarkdown(
  aggRow: Record<string, unknown> | undefined,
  playerName: string,
): string | null {
  if (!aggRow) return null
  const tr = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#aaa;font-size:0.875rem">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#fff;font-weight:600">${value}</td></tr>`
  return `<div class="spotlight-stat-table"><p style="margin:0 0 12px;color:#fff;font-weight:700">${escapeHtml(
    playerName,
  )} — box score &amp; advanced</p><table style="width:100%;border-collapse:collapse;border:1px solid #333;border-radius:8px;overflow:hidden">${tr(
    'MIN',
    String(aggRow.traditional_minutes ?? aggRow.advanced_minutes ?? '—'),
  )}${tr('PTS', String(aggRow.traditional_points ?? '—'))}${tr('REB', String(aggRow.traditional_reboundsTotal ?? '—'))}${tr(
    'AST',
    String(aggRow.traditional_assists ?? '—'),
  )}${tr('STL / BLK', `${String(aggRow.traditional_steals ?? '—')} / ${String(aggRow.traditional_blocks ?? '—')}`)}${tr(
    'TOV',
    String(aggRow.traditional_turnovers ?? '—'),
  )}${tr(
    'FG',
    `${String(aggRow.traditional_fieldGoalsMade ?? '—')}-${String(aggRow.traditional_fieldGoalsAttempted ?? '—')} (${pct(aggRow.traditional_fieldGoalsPercentage)})`,
  )}${tr(
    '3PT',
    `${String(aggRow.traditional_threePointersMade ?? '—')}-${String(aggRow.traditional_threePointersAttempted ?? '—')} (${pct(aggRow.traditional_threePointersPercentage)})`,
  )}${tr('FT', `${String(aggRow.traditional_freeThrowsMade ?? '—')}-${String(aggRow.traditional_freeThrowsAttempted ?? '—')}`)}${tr(
    'TS%',
    pct(aggRow.advanced_trueShootingPercentage),
  )}${tr('eFG%', pct(aggRow.advanced_effectiveFieldGoalPercentage))}${tr('USG%', pct(aggRow.advanced_usagePercentage))}${tr(
    'NET RTG',
    num(aggRow.advanced_netRating),
  )}${tr('PIE', pct(aggRow.advanced_PIE))}</table></div>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pct(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function num(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) return '—'
  return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1)
}

/**
 * Sections to append after the base radar (shot chart, zone bar, pull quote, insights, markdown table).
 */
export function buildSpotlightAutomationExtraSections(
  raw: Record<string, unknown> | undefined,
  aggregatedPlayerStats: Record<string, Record<string, unknown>> | null | undefined,
  personId: number,
  playerName: string,
  teamTricode: string,
  matchup: string,
  stat: {
    pts: number
    reb: number
    ast: number
    stl: number
    blk: number
    tov: number
    fgm: number
    fga: number
    fg3m: number
    fg3a: number
    ftm: number
    fta: number
    plusMinus: number | null
  },
): AutomationSection[] {
  const out: AutomationSection[] = []
  const shotChart = getShotChartArray(raw, personId)
  if (shotChart && shotChart.length > 0) {
    const shots = shotChart.map((s) => {
      const row = s as Record<string, unknown>
      return {
        eventNum: Number(row.GAME_EVENT_ID ?? 0),
        locX: row.LOC_X ?? null,
        locY: row.LOC_Y ?? null,
        shotResult: row.SHOT_MADE_FLAG === 1 ? 'Made' : 'Missed',
        shotDistance: row.SHOT_DISTANCE ?? null,
        period: Number(row.PERIOD ?? 0),
        clock: `${String(row.MINUTES_REMAINING ?? 0)}:${String(row.SECONDS_REMAINING ?? 0).padStart(2, '0')}`,
        description: `${row.EVENT_TYPE || ''} — ${row.ACTION_TYPE || ''} (${row.SHOT_ZONE_BASIC || ''})`.replace(/\s+/g, ' ').trim(),
      }
    })
    const made = shotChart.filter((s) => (s as Record<string, unknown>).SHOT_MADE_FLAG === 1).length
    out.push({
      section_type: 'chart',
      title: 'Shot chart',
      content: {
        chart_type: 'shot_chart',
        chart_props: { shots, playerName, teamTricode },
        caption: `${playerName} — ${made}/${shotChart.length} FGM`,
      },
      player_id: personId,
      team_tricode: null,
    })
    const zonesRaw = getShotChartByZone(shotChart as Array<Record<string, unknown>>)
    const zones = zonesRaw
      .map((z) => ({ ...z, missed: z.fga - z.fgm }))
      .sort((a, b) => b.fga - a.fga)
      .slice(0, 8)
    if (zones.length >= 3) {
      out.push({
        section_type: 'chart',
        title: 'Shot profile (by zone)',
        content: {
          chart_type: 'bar',
          chart_props: { data: zones },
          caption: `${playerName} — makes vs attempts by zone`,
        },
        player_id: personId,
        team_tricode: null,
      })
    }
  }

  const pq = pickPullQuote(stat)
  if (pq) {
    out.push({
      section_type: 'pull_quote',
      title: '',
      content: {
        text: pq,
        attribution: playerName,
        icon: 'chart',
      },
      player_id: personId,
      team_tricode: null,
    })
  }

  const insightMd = getSpotlightInsightsMarkdown(aggregatedPlayerStats, personId)
  if (insightMd) {
    out.push({
      section_type: 'rich_text',
      title: '',
      content: { markdown: insightMd },
      player_id: personId,
      team_tricode: null,
    })
  }

  const aggRow = aggregatedPlayerStats?.[String(personId)]
  const tableMd = buildAggregatedStatTableMarkdown(aggRow, playerName)
  if (tableMd) {
    out.push({
      section_type: 'rich_text',
      title: 'Full stats',
      content: { markdown: tableMd },
      player_id: personId,
      team_tricode: null,
    })
  }

  return out
}

export function snapshotAggregatedStatsForMetadata(
  aggregatedPlayerStats: Record<string, Record<string, unknown>> | null | undefined,
  personId: number,
): Record<string, unknown> | null {
  const row = aggregatedPlayerStats?.[String(personId)]
  if (!row || typeof row !== 'object') return null
  return { ...row }
}
