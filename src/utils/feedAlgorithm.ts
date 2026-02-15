/**
 * Feed Algorithm V2
 *
 * Ordering system for the new section-based feed. Supports 9 post types
 * and factors in user preferences, engagement, recency, quality signals,
 * DFS context, view history, and content diversity.
 */

import type { FeedPost, PostType, FeedFilters } from '../types/feed'

// ─── Re-exports so old import paths still work ─────────────
export type { FeedPost } from '../types/feed'

// ─── Supporting types ───────────────────────────────────────

export interface DFSContext {
  playerIds: Set<number>
  teamTricodes: Set<string>
  playerPerformance?: Map<number, {
    fantasyPoints: number
    won: boolean
    entryCount: number
  }>
}

export interface PostFrequency {
  timesShown: number
  lastShownAt?: number
}

export interface UserBehavior {
  preferredPostTypes?: PostType[]
  avgTimeSpent?: number
  completionRate?: number
}

export interface FeedAlgorithmOptions {
  // User preferences
  favoritePlayerIds?: Set<number>
  favoriteTeamTricodes?: Set<string>

  // Shared post context
  sharedPostPlayerIds?: Set<number>
  sharedPostTeamTricodes?: Set<string>

  // View history
  viewedPostIds?: Set<string>
  postFrequencies?: Map<string, PostFrequency>

  // Context
  clickSource?: 'home' | 'avatar' | 'player_page' | 'share' | 'search'
  isUserLoggedIn?: boolean

  // Avatar boosts (with decay)
  boostedTeamTricodes?: Set<string>
  boostedPlayerIds?: Set<number>
  avatarClickDecay?: Map<string, number>

  // DFS
  dfsContextByDate?: Map<string, DFSContext>

  // Behavior
  userBehavior?: UserBehavior

  // Filters
  filters?: FeedFilters

  // Algorithm params
  seed?: number
  useWeights?: boolean
}

// ─── Helpers ────────────────────────────────────────────────

export function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array]
  let random = seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    random = (random * 1664525 + 1013904223) % 4294967296
    const j = Math.floor((random / 4294967296) * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function parseMetadata(post: FeedPost): Record<string, any> {
  if (!post.metadata) return {}
  return typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata
}

function getDaysAgo(dateStr: string | null): number {
  if (!dateStr) return Infinity
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
}

function isSameDay(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

function gradientScore(
  value: number,
  min: number,
  max: number,
  minScore: number,
  maxScore: number
): number {
  if (value <= min) return minScore
  if (value >= max) return maxScore
  return minScore + ((value - min) / (max - min)) * (maxScore - minScore)
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

// ─── Post-type priority tiers ───────────────────────────────
// Higher = more prominent in the feed by default

const POST_TYPE_PRIORITY: Record<PostType, number> = {
  team_of_night:    18,
  team_of_week:     16,
  player_of_week:   14,
  player_of_month:  14,
  game_recap:       12,
  player_spotlight: 10,
  prop_results:      8,
  prop_prediction:   6,
  injury_report:     4,
}

// ─── Engagement score ───────────────────────────────────────

function engagementScore(post: FeedPost): number {
  const likes     = Math.min((post.likes_count || 0) / 100, 1)
  const comments  = Math.min((post.comments_count || 0) / 50, 1)
  const shares    = Math.min((post.shares_count || 0) / 20, 1)
  const views     = Math.min((post.views_count || 0) / 1000, 1)
  return likes * 0.35 + comments * 0.3 + shares * 0.25 + views * 0.1
}

// ─── Main weight calculation ────────────────────────────────

export function calculatePostWeight(
  post: FeedPost,
  options: FeedAlgorithmOptions
): { weight: number; score: number } {
  let score = 0
  let weight = 1.0

  const {
    favoritePlayerIds = new Set<number>(),
    favoriteTeamTricodes = new Set<string>(),
    sharedPostPlayerIds = new Set<number>(),
    sharedPostTeamTricodes = new Set<string>(),
    viewedPostIds = new Set<string>(),
    postFrequencies = new Map(),
    boostedTeamTricodes = new Set<string>(),
    boostedPlayerIds = new Set<number>(),
    avatarClickDecay = new Map(),
    dfsContextByDate = new Map(),
    userBehavior,
    clickSource,
    isUserLoggedIn = false,
    seed = Date.now(),
  } = options

  const postPlayers = post.player_ids ?? []
  const postTeams = post.team_tricodes ?? []
  const metadata = parseMetadata(post)
  const isViewed = viewedPostIds.has(post.id)
  const daysAgo = getDaysAgo(post.game_date)
  const isToday = isSameDay(post.game_date)

  // ── Additive bonuses ─────────────────────────────────

  // 1. Unviewed bonus
  score += isViewed ? -10 : 50

  // 2. Recency
  if (isToday)        score += 30
  else if (daysAgo <= 1)  score += 22
  else if (daysAgo <= 3)  score += 15
  else if (daysAgo <= 7)  score += 10
  else if (daysAgo <= 14) score += 5

  // 3. Post type tier
  score += POST_TYPE_PRIORITY[post.post_type] ?? 6

  // 4. Quality signal per type
  if (post.post_type === 'game_recap') {
    const fun = metadata?.fun_score ?? metadata?.fun_data?.fun_score ?? 0
    score += gradientScore(fun, 50, 95, 0, 35)
  } else if (post.post_type === 'player_spotlight') {
    const fp = metadata?.fantasyPoints ?? 0
    score += gradientScore(fp, 30, 70, 0, 35)
  } else if (post.post_type === 'team_of_night' || post.post_type === 'team_of_week') {
    const totalFP = metadata?.total_fantasy_points ?? 0
    score += gradientScore(totalFP, 200, 400, 5, 30)
  }

  // 5. Engagement
  score += engagementScore(post) * 15

  // 6. Favourite players
  if (favoritePlayerIds.size > 0 && isUserLoggedIn) {
    const hits = postPlayers.filter(pid => favoritePlayerIds.has(pid)).length
    score += hits * 8
    if (hits >= 2) score += 5
    if (hits >= 3) score += 5
  }

  // 7. Favourite teams
  if (favoriteTeamTricodes.size > 0 && isUserLoggedIn) {
    const hits = postTeams.filter(t => favoriteTeamTricodes.has(t)).length
    score += hits * 6
    if (hits >= 2) score += 4
  }

  // 8. Shared-post context
  if (sharedPostPlayerIds.size > 0 && postPlayers.some(pid => sharedPostPlayerIds.has(pid)))
    score += 12
  if (sharedPostTeamTricodes.size > 0 && postTeams.some(t => sharedPostTeamTricodes.has(t)))
    score += 10

  // 9. DFS context
  if (dfsContextByDate.size > 0 && isUserLoggedIn && post.game_date) {
    const ctx = dfsContextByDate.get(post.game_date)
    if (ctx) {
      const dfsHits = postPlayers.filter(pid => ctx.playerIds.has(pid))
      score += dfsHits.length * 15
      if (ctx.playerPerformance) {
        for (const pid of dfsHits) {
          const perf = ctx.playerPerformance.get(pid)
          if (perf) {
            if (perf.fantasyPoints >= 50) score += 10
            else if (perf.fantasyPoints >= 40) score += 5
            if (perf.won) score += 8
          }
        }
      }
      score += postTeams.filter(t => ctx.teamTricodes.has(t)).length * 12
    }
  }

  // 10. Frequency penalty
  const freq = postFrequencies.get(post.id)
  if (freq) {
    score -= freq.timesShown * 5
    if (freq.lastShownAt && (Date.now() - freq.lastShownAt) < 86_400_000) score -= 10
  }

  // ── Multiplicative modifiers ─────────────────────────

  // Avatar click boosts with decay
  if (boostedTeamTricodes.size > 0 || boostedPlayerIds.size > 0) {
    const hasBoostedTeam = postTeams.some(t => boostedTeamTricodes.has(t))
    const hasBoostedPlayer = postPlayers.some(pid => boostedPlayerIds.has(pid))
    if (hasBoostedTeam || hasBoostedPlayer) {
      let boost = hasBoostedTeam ? 2.5 : 1.0
      boost += hasBoostedPlayer ? 2.0 : 0.0
      // Decay
      let decay = 1.0
      for (const t of boostedTeamTricodes) {
        if (postTeams.includes(t)) {
          const n = avatarClickDecay.get(`team:${t}`) ?? 0
          decay *= n >= 15 ? 0.3 : n >= 5 ? 1.0 - ((n - 5) / 10) * 0.7 : 1.0
        }
      }
      for (const pid of boostedPlayerIds) {
        if (postPlayers.includes(pid)) {
          const n = avatarClickDecay.get(`player:${pid}`) ?? 0
          decay *= n >= 15 ? 0.3 : n >= 5 ? 1.0 - ((n - 5) / 10) * 0.7 : 1.0
        }
      }
      weight *= boost * decay
    }
  }

  // User behaviour — post-type affinity
  if (userBehavior?.preferredPostTypes?.includes(post.post_type)) {
    weight *= 1.2
  }

  // Click source
  if (clickSource === 'avatar' && daysAgo <= 1) weight *= 1.3
  else if (clickSource === 'player_page') weight *= 1.1
  else if (clickSource === 'share') weight *= 1.15
  else if (clickSource === 'search') weight *= 1.1

  // Time of day
  const tod = getTimeOfDay()
  if (tod === 'morning' && daysAgo <= 1) weight *= 1.2
  else if (tod === 'evening' && isToday) weight *= 1.15

  // Weekend boost
  const dow = new Date().getDay()
  if ((dow === 0 || dow === 6) && daysAgo <= 2) weight *= 1.1

  // Controlled randomness
  const r1 = ((seed + post.id.charCodeAt(0)) % 100) / 100
  const r2 = ((seed * 7 + (post.id.charCodeAt(post.id.length - 1) || 0)) % 100) / 100
  const r3 = ((seed * 13 + ((post.game_date?.charCodeAt(0) || 0) % 100)) % 100) / 100
  weight *= 0.75 + ((r1 + r2 + r3) / 3) * 0.5

  const finalWeight = Math.max(0.1, (score + 100) * weight)
  return { weight: finalWeight, score }
}

// ─── Content diversity ──────────────────────────────────────
// Interleaves post types so the feed isn't all one category.

function diversify(posts: FeedPost[]): FeedPost[] {
  if (posts.length <= 3) return posts

  const buckets = new Map<PostType, FeedPost[]>()
  for (const p of posts) {
    if (!buckets.has(p.post_type)) buckets.set(p.post_type, [])
    buckets.get(p.post_type)!.push(p)
  }

  // Round-robin across buckets, sorted by priority
  const typeOrder = [...buckets.keys()].sort(
    (a, b) => (POST_TYPE_PRIORITY[b] ?? 0) - (POST_TYPE_PRIORITY[a] ?? 0)
  )

  const result: FeedPost[] = []
  const indices = new Map<PostType, number>(typeOrder.map(t => [t, 0]))
  let remaining = posts.length

  while (remaining > 0) {
    for (const type of typeOrder) {
      const bucket = buckets.get(type)!
      const idx = indices.get(type)!
      if (idx < bucket.length) {
        result.push(bucket[idx])
        indices.set(type, idx + 1)
        remaining--
      }
    }
  }

  return result
}

// ─── Filter ─────────────────────────────────────────────────

function applyFilters(posts: FeedPost[], filters?: FeedFilters): FeedPost[] {
  if (!filters) return posts

  let filtered = posts

  if (filters.postType && filters.postType !== 'all') {
    filtered = filtered.filter(p => p.post_type === filters.postType)
  }

  if (filters.teamTricode) {
    const tri = filters.teamTricode
    filtered = filtered.filter(p => p.team_tricodes?.includes(tri))
  }

  if (filters.tag) {
    const tag = filters.tag
    filtered = filtered.filter(p => p.tags?.includes(tag))
  }

  if (filters.dateRange) {
    const from = new Date(filters.dateRange.from).getTime()
    const to = new Date(filters.dateRange.to).getTime()
    filtered = filtered.filter(p => {
      if (!p.game_date) return false
      const d = new Date(p.game_date).getTime()
      return d >= from && d <= to
    })
  }

  return filtered
}

// ─── Main entry point ───────────────────────────────────────

export function orderPostsByAlgorithm(
  posts: FeedPost[],
  options: FeedAlgorithmOptions = {}
): FeedPost[] {
  const {
    viewedPostIds = new Set<string>(),
    useWeights = true,
    filters,
  } = options

  // 1. Apply user filters
  let pool = applyFilters(posts, filters)

  // 2. Calculate weights
  const weighted = pool.map(post => ({
    post,
    ...calculatePostWeight(post, options),
  }))

  // 3. Split viewed / unviewed
  const unviewed = weighted.filter(w => !viewedPostIds.has(w.post.id))
  const viewed = weighted.filter(w => viewedPostIds.has(w.post.id))

  // 4. Sort each group by weight desc
  unviewed.sort((a, b) => b.weight - a.weight)
  viewed.sort((a, b) => b.weight - a.weight)

  // 5. Diversify — round-robin post types within each group
  const diversifiedUnviewed = diversify(unviewed.map(w => w.post))
  const diversifiedViewed = diversify(viewed.map(w => w.post))

  return [...diversifiedUnviewed, ...diversifiedViewed]
}
