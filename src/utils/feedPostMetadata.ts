import type { FeedPost } from '../types/feed'

function parseRecord(post: FeedPost): Record<string, unknown> {
  const raw = post.metadata
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return (raw || {}) as Record<string, unknown>
}

/**
 * Final score line from automation/editor metadata (`story` / `story_data.final_score`).
 * Example: `"Detroit 113 - Los Angeles 110"`.
 */
export function getFinalScoreLineFromPost(post: FeedPost): string | null {
  const meta = parseRecord(post)
  const story = (meta.story ?? meta.story_data) as Record<string, unknown> | undefined
  const raw = story?.final_score
  if (raw == null || raw === '') return null
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim()
  return s || null
}

/**
 * Parse away and home scores from `story.final_score` (e.g. "Chicago 132 - Houston 124", "CHI 132 - HOU 124").
 * Order matches `team_tricodes`: [away, home].
 */
export function parseFinalScorePairFromStoryLine(scoreLine: string): [number, number] | null {
  const normalized = scoreLine.trim().replace(/[\u2013\u2014\u2212]/g, '-')
  const m = normalized.match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return [a, b]
}

/**
 * Away / home scores for player spotlight feed thumbnails.
 * Order matches `team_tricodes`: [away, home].
 * Uses `story.final_score` when parseable; otherwise `metadata.awayTeam` / `homeTeam` points (automation / game load).
 */
export function getSpotlightFinalScorePairForThumbnail(post: FeedPost): [number, number] | null {
  const line = getFinalScoreLineFromPost(post)
  if (line) {
    const fromLine = parseFinalScorePairFromStoryLine(line)
    if (fromLine) return fromLine
  }
  const meta = parseRecord(post)
  const away = meta.awayTeam as Record<string, unknown> | undefined
  const home = meta.homeTeam as Record<string, unknown> | undefined
  if (away && home && away.points != null && home.points != null) {
    const a = Number(away.points)
    const h = Number(home.points)
    if (Number.isFinite(a) && Number.isFinite(h)) return [a, h]
  }
  const story = (meta.story ?? meta.story_data) as Record<string, unknown> | undefined
  const teams = story?.teams as
    | { winner?: { points?: unknown; tricode?: unknown }; loser?: { points?: unknown; tricode?: unknown } }
    | undefined
  const tt = post.team_tricodes
  if (teams?.winner && teams?.loser && tt && tt.length >= 2) {
    const map = new Map<string, number>()
    const wTri = String(teams.winner.tricode ?? '')
    const lTri = String(teams.loser.tricode ?? '')
    const wPts = Number(teams.winner.points)
    const lPts = Number(teams.loser.points)
    if (wTri && lTri && Number.isFinite(wPts) && Number.isFinite(lPts)) {
      map.set(wTri, wPts)
      map.set(lTri, lPts)
      const s0 = map.get(tt[0])
      const s1 = map.get(tt[1])
      if (s0 != null && s1 != null) return [s0, s1]
    }
  }
  return null
}

/**
 * Whitelist snapshot written by `automate-player-spotlights` from `PlayerStats` + optional `AggregatedPlayerStats`.
 */
export interface SpotlightPlayerStatsSnapshot {
  personId: number
  teamTricode: string
  minutes: string | null
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
  plusMinus: number | null
  efgPct: number | null
  tsPct: number | null
  pie: number | null
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

/**
 * Full `AggregatedPlayerStats` row for the spotlight player when written by automation (`metadata.spotlight_aggregated_stats`).
 */
export function getSpotlightAggregatedStatsFromPost(post: FeedPost): Record<string, unknown> | null {
  const meta = parseRecord(post)
  const raw = meta.spotlight_aggregated_stats
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as Record<string, unknown>
}

/** Per-player box score snapshot from `metadata.spotlight_player_stats` (automation only). */
export function getSpotlightPlayerStatsFromPost(post: FeedPost): SpotlightPlayerStatsSnapshot | null {
  const meta = parseRecord(post)
  const raw = meta.spotlight_player_stats
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const personId = num(o.personId)
  if (personId <= 0) return null
  return {
    personId,
    teamTricode: String(o.teamTricode ?? ''),
    minutes: o.minutes == null || o.minutes === '' ? null : String(o.minutes),
    pts: num(o.pts),
    reb: num(o.reb),
    ast: num(o.ast),
    stl: num(o.stl),
    blk: num(o.blk),
    tov: num(o.tov),
    pf: num(o.pf),
    fgm: num(o.fgm),
    fga: num(o.fga),
    fg3m: num(o.fg3m),
    fg3a: num(o.fg3a),
    ftm: num(o.ftm),
    fta: num(o.fta),
    plusMinus: numOrNull(o.plusMinus),
    efgPct: numOrNull(o.efgPct),
    tsPct: numOrNull(o.tsPct),
    pie: numOrNull(o.pie),
  }
}
