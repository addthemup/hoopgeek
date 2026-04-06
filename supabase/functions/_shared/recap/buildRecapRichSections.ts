/**
 * Build rich feed sections for automated game_recap posts from Storage game JSON.
 * Shapes match PostStory: stat_comparison, chart (radar | metric_bar), pull_quote, rich_text.
 */

export type RecapSectionInsert = {
  section_type: string
  title: string
  content: Record<string, unknown>
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Pick AggregatedTeamStats rows for away/home by teamTricode. */
export function parseAggregatedTeamStatsByTricode(
  raw: Record<string, unknown>,
  awayTricode: string,
  homeTricode: string,
): { away: Record<string, unknown> | null; home: Record<string, unknown> | null } {
  const root = raw.AggregatedTeamStats
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return { away: null, home: null }
  }
  let away: Record<string, unknown> | null = null
  let home: Record<string, unknown> | null = null
  for (const row of Object.values(root as Record<string, Record<string, unknown>>)) {
    if (!row || typeof row !== 'object') continue
    const tri = String((row as Record<string, unknown>).teamTricode ?? '')
    if (tri === awayTricode) away = row as Record<string, unknown>
    else if (tri === homeTricode) home = row as Record<string, unknown>
  }
  return { away, home }
}

/** Slim snapshot for feed_posts.metadata (two teams only). */
export function sanitizeAggregatedSnapshot(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return null
  const keys = [
    'teamTricode',
    'teamName',
    'traditional_points',
    'traditional_threePointersMade',
    'traditional_fieldGoalsPercentage',
    'traditional_assists',
    'traditional_reboundsTotal',
    'traditional_turnovers',
    'advanced_offensiveRating',
    'advanced_defensiveRating',
    'advanced_netRating',
    'advanced_effectiveFieldGoalPercentage',
    'advanced_trueShootingPercentage',
    'advanced_pace',
    'advanced_PIE',
    'fourFactors_effectiveFieldGoalPercentage',
    'misc_pointsFastBreak',
    'misc_pointsPaint',
    'misc_pointsSecondChance',
  ]
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (row[k] !== undefined) out[k] = row[k]
  }
  return Object.keys(out).length ? out : null
}

export function getScoreGameSlice(scoreRoot: Record<string, unknown>, gameId: string): Record<string, unknown> | null {
  const g = scoreRoot[gameId]
  if (!g || typeof g !== 'object' || Array.isArray(g)) return null
  return g as Record<string, unknown>
}

/** Radar row for ChartSection: one team's shape vs opponent (0–100 per spoke). */
function buildRadarRowsForTeam(
  self: Record<string, unknown>,
  opp: Record<string, unknown>,
  selfTri: string,
): Array<{ subject: string; value: number; fullMark: number }> {
  const ptsA = num(self.traditional_points) ?? 0
  const ptsB = num(opp.traditional_points) ?? 0
  const sumPts = ptsA + ptsB || 1
  const t3A = num(self.traditional_threePointersMade) ?? 0
  const t3B = num(opp.traditional_threePointersMade) ?? 0
  const astA = num(self.traditional_assists) ?? 0
  const astB = num(opp.traditional_assists) ?? 0
  const rebA = num(self.traditional_reboundsTotal) ?? 0
  const rebB = num(opp.traditional_reboundsTotal) ?? 0
  const tovA = num(self.traditional_turnovers) ?? 0
  const tovB = num(opp.traditional_turnovers) ?? 0
  const efgA = num(self.advanced_effectiveFieldGoalPercentage) ?? num(self.fourFactors_effectiveFieldGoalPercentage) ?? 0
  const efgB = num(opp.advanced_effectiveFieldGoalPercentage) ?? num(opp.fourFactors_effectiveFieldGoalPercentage) ?? 0
  const paceA = num(self.advanced_pace) ?? 0
  const paceB = num(opp.advanced_pace) ?? 0

  // Higher is better except turnovers (invert)
  const pct = (a: number, b: number, higherIsBetter: boolean) => {
    const m = Math.max(a, b, 1e-6)
    if (higherIsBetter) return Math.round((a / m) * 100)
    return Math.round((1 - a / m) * 100)
  }

  return [
    { subject: 'PTS share', value: Math.round((ptsA / sumPts) * 100), fullMark: 100 },
    { subject: '3PM', value: pct(t3A, t3B, true), fullMark: 100 },
    {
      subject: 'eFG%',
      value: Math.round((efgA / Math.max(efgA, efgB, 1e-6)) * 100),
      fullMark: 100,
    },
    { subject: 'AST', value: pct(astA, astB, true), fullMark: 100 },
    { subject: 'REB', value: pct(rebA, rebB, true), fullMark: 100 },
    { subject: 'TOV (lower)', value: pct(tovA, tovB, false), fullMark: 100 },
    { subject: 'Pace', value: pct(paceA, paceB, true), fullMark: 100 },
  ].map((r) => ({ ...r, subject: `${selfTri} ${r.subject}` }))
}

function statComparison(
  title: string,
  awayTri: string,
  homeTri: string,
  awayVal: number,
  homeVal: number,
  colorAway = '#60A5FA',
  colorHome = '#FFC72C',
): RecapSectionInsert {
  return {
    section_type: 'stat_comparison',
    title,
    content: {
      title,
      stat_name: title,
      teams: [
        { tricode: awayTri, value: awayVal, color: colorAway },
        { tricode: homeTri, value: homeVal, color: colorHome },
      ],
    },
  }
}

const MAX_RICH_TEXT = 2800

/**
 * Build extra sections: pull_quote, rich_text, stat_comparison, chart(s).
 * Caller merges into feed_post_sections after hero + headline.
 */
export function buildRecapRichSections(params: {
  awayTricode: string
  homeTricode: string
  finalScoreLine: string
  funScore: number | null
  scoreGame: Record<string, unknown> | null
  aggregatedAway: Record<string, unknown> | null
  aggregatedHome: Record<string, unknown> | null
}): RecapSectionInsert[] {
  const { awayTricode, homeTricode, finalScoreLine, funScore, scoreGame, aggregatedAway, aggregatedHome } = params
  const sections: RecapSectionInsert[] = []

  const teamStats = (scoreGame?.team_stats ?? {}) as Record<string, unknown>
  const margin = num(teamStats['Margin of Victory'])
  const pace = num(teamStats['Pace'])
  const leadChanges = (scoreGame?.lead_changes ?? {}) as Record<string, unknown>
  const leadTotal = num(leadChanges.total)

  // 1–2 pull quotes
  if (funScore != null && Number.isFinite(funScore)) {
    sections.push({
      section_type: 'pull_quote',
      title: '',
      content: {
        text: `Fun score ${funScore.toFixed(1)} — energy and pace in one number.`,
        attribution: 'HoopGeek game index',
        accent_color: '#FFC72C',
      },
    })
  }
  if (margin != null && margin !== 0) {
    sections.push({
      section_type: 'pull_quote',
      title: '',
      content: {
        text: `Margin of victory: ${margin > 0 ? '+' : ''}${margin} — ${Math.abs(margin) <= 5 ? 'tight down the stretch.' : 'decisive flow.'}`,
        attribution: undefined,
        accent_color: '#60A5FA',
      },
    })
  }

  // Rich text: score line + bullets from team_stats / story
  const bullets: string[] = []
  bullets.push(`**${finalScoreLine}**`)
  if (pace != null) bullets.push(`League-adjusted pace feel: **${pace.toFixed(1)}** (from game stats).`)
  const fb = teamStats['Combined Fast Break Points']
  if (num(fb) != null) bullets.push(`Combined fast break points: **${num(fb)}**.`)
  const threes = teamStats['Combined Threes']
  if (num(threes) != null) bullets.push(`Combined three-pointers made: **${num(threes)}**.`)
  if (leadTotal != null) bullets.push(`Lead changes: **${leadTotal}**.`)
  if (aggregatedAway && aggregatedHome) {
    const netA = num(aggregatedAway.advanced_netRating)
    const netH = num(aggregatedHome.advanced_netRating)
    if (netA != null && netH != null) {
      bullets.push(`${awayTricode} net rating **${netA.toFixed(1)}** vs ${homeTricode} **${netH.toFixed(1)}** (estimated).`)
    }
  }
  let md = bullets.join('\n\n')
  if (md.length > MAX_RICH_TEXT) md = md.slice(0, MAX_RICH_TEXT) + '…'
  sections.push({
    section_type: 'rich_text',
    title: 'At a glance',
    content: { markdown: md },
  })

  // Stat comparisons from AggregatedTeamStats
  if (aggregatedAway && aggregatedHome) {
    const a = aggregatedAway
    const h = aggregatedHome
    const tri = (t: Record<string, unknown>, k: string) => num(t[k])

    const t3a = tri(a, 'traditional_threePointersMade')
    const t3h = tri(h, 'traditional_threePointersMade')
    if (t3a != null && t3h != null) {
      sections.push(statComparison('Three-pointers made', awayTricode, homeTricode, t3a, t3h))
    }

    const pa = tri(a, 'advanced_pace')
    const ph = tri(h, 'advanced_pace')
    if (pa != null && ph != null) {
      sections.push(statComparison('Pace', awayTricode, homeTricode, pa, ph))
    }

    const fba = tri(a, 'misc_pointsFastBreak')
    const fbh = tri(h, 'misc_pointsFastBreak')
    if (fba != null && fbh != null) {
      sections.push(statComparison('Fast break points', awayTricode, homeTricode, fba, fbh))
    }

    const tova = tri(a, 'traditional_turnovers')
    const tovh = tri(h, 'traditional_turnovers')
    if (tova != null && tovh != null) {
      sections.push(statComparison('Turnovers', awayTricode, homeTricode, tova, tovh))
    }

    const efga = tri(a, 'advanced_effectiveFieldGoalPercentage') ?? tri(a, 'fourFactors_effectiveFieldGoalPercentage')
    const efgh = tri(h, 'advanced_effectiveFieldGoalPercentage') ?? tri(h, 'fourFactors_effectiveFieldGoalPercentage')
    if (efga != null && efgh != null) {
      sections.push({
        section_type: 'stat_comparison',
        title: 'Effective FG%',
        content: {
          title: 'Effective FG%',
          stat_name: 'eFG%',
          teams: [
            { tricode: awayTricode, value: efga, color: '#60A5FA' },
            { tricode: homeTricode, value: efgh, color: '#FFC72C' },
          ],
        },
      })
    }
  } else if (scoreGame && teamStats) {
    // Fallback: team threes from score.team_stats
    const tt = teamStats['Team Threes'] as Record<string, unknown> | undefined
    if (tt && awayTricode in tt && homeTricode in tt) {
      const va = num(tt[awayTricode])
      const vh = num(tt[homeTricode])
      if (va != null && vh != null) {
        sections.push(statComparison('Three-pointers made', awayTricode, homeTricode, va, vh))
      }
    }
    const fp = teamStats['Team Fast Break Points'] as Record<string, unknown> | undefined
    if (fp && awayTricode in fp && homeTricode in fp) {
      const va = num(fp[awayTricode])
      const vh = num(fp[homeTricode])
      if (va != null && vh != null) {
        sections.push(statComparison('Fast break points', awayTricode, homeTricode, va, vh))
      }
    }
  }

  // Radar charts (one per team) — relative game profile
  if (aggregatedAway && aggregatedHome) {
    const dataAway = buildRadarRowsForTeam(aggregatedAway, aggregatedHome, awayTricode)
    const dataHome = buildRadarRowsForTeam(aggregatedHome, aggregatedAway, homeTricode)
    if (dataAway.length >= 3) {
      sections.push({
        section_type: 'chart',
        title: `${awayTricode} game shape`,
        content: {
          chart_type: 'radar',
          chart_props: { data: dataAway },
          caption: 'Spokes scaled vs opponent this game (higher = more of that edge).',
        },
      })
    }
    if (dataHome.length >= 3) {
      sections.push({
        section_type: 'chart',
        title: `${homeTricode} game shape`,
        content: {
          chart_type: 'radar',
          chart_props: { data: dataHome },
          caption: 'Spokes scaled vs opponent this game (higher = more of that edge).',
        },
      })
    }

    // metric_bar: side-by-side key rates
    const efgA = num(aggregatedAway.advanced_effectiveFieldGoalPercentage) ?? 0
    const efgH = num(aggregatedHome.advanced_effectiveFieldGoalPercentage) ?? 0
    if (efgA > 0 && efgH > 0) {
      sections.push({
        section_type: 'chart',
        title: 'Shooting efficiency',
        content: {
          chart_type: 'metric_bar',
          chart_props: {
            data: [
              { label: `${awayTricode} eFG%`, value: efgA > 1 ? Math.min(100, efgA) : Math.min(100, efgA * 100) },
              { label: `${homeTricode} eFG%`, value: efgH > 1 ? Math.min(100, efgH) : Math.min(100, efgH * 100) },
            ],
          },
          caption: 'Effective field goal percentage (scaled to chart 0–100).',
        },
      })
    }
  }

  return sections
}
