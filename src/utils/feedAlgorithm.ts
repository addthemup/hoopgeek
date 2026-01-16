/**
 * Feed Algorithm Utility
 * 
 * Advanced feed ordering system that considers:
 * - User preferences (favorite players/teams)
 * - Post quality (fun_score, fantasy points) with gradient scoring
 * - Recency with time-based prioritization (same-day = highest)
 * - View history and post frequency
 * - Context (where click came from, avatar interactions with decay)
 * - Engagement metrics (likes, comments, shares, views)
 * - DFS pool participation (date-specific, performance-aware)
 * - User behavior patterns
 * - Multiple favorites boost
 */

// Feed post interface
export interface FeedPost {
  id: string
  post_type: string
  status: string
  title: string
  description: string
  game_id: string
  game_date: string
  team_tricodes: string[] | null
  player_ids: number[] | null
  person_id?: number | null
  slides: any
  metadata: any
  thumbnail_url: string | null
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  published_at: string
  created_at: string
  updated_at: string
}

/**
 * DFS context for a specific game date
 */
export interface DFSContext {
  playerIds: Set<number> // Players user had in DFS on this date
  teamTricodes: Set<string> // Teams user had in DFS on this date
  playerPerformance?: Map<number, {
    fantasyPoints: number
    won: boolean
    entryCount: number // How many entries had this player
  }>
}

/**
 * Post frequency tracking (how many times shown to user)
 */
export interface PostFrequency {
  timesShown: number
  lastShownAt?: number // timestamp
}

/**
 * User behavior patterns
 */
export interface UserBehavior {
  preferredPostType?: 'fun_score' | 'player_spotlight' | null // null = no preference
  avgTimeSpent?: number // Average time spent viewing posts
  completionRate?: number // % of posts fully viewed
}

/**
 * Options for feed algorithm
 */
export interface FeedAlgorithmOptions {
  // User preferences
  favoritePlayerIds?: Set<number>
  favoriteTeamTricodes?: Set<string>
  
  // Shared post context (for boosting related content)
  sharedPostPlayerIds?: Set<number>
  sharedPostTeamTricodes?: Set<string>
  
  // View history
  viewedPostIds?: Set<string>
  postFrequencies?: Map<string, PostFrequency> // Track how many times each post shown
  
  // Context tracking
  clickSource?: 'home' | 'avatar' | 'player_page' | 'share' | 'search'
  isUserLoggedIn?: boolean
  
  // Avatar interaction boosts (with decay tracking)
  boostedTeamTricodes?: Set<string>
  boostedPlayerIds?: Set<number>
  avatarClickDecay?: Map<string, number> // Track how many posts shown since avatar click (for decay)
  
  // DFS pool context (date-specific)
  dfsContextByDate?: Map<string, DFSContext> // Map of game_date -> DFS context
  
  // User behavior patterns
  userBehavior?: UserBehavior
  
  // Algorithm parameters
  seed?: number
  strictRatio?: boolean // Whether to enforce 2:1 fun_score:player_spotlight ratio
  useWeights?: boolean // Whether to use weight-based ordering (default: true)
}

/**
 * Seeded shuffle for consistent randomization
 */
export function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array]
  let random = seed
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Simple LCG (Linear Congruential Generator) for seeded random
    random = (random * 1664525 + 1013904223) % 4294967296
    const j = Math.floor((random / 4294967296) * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Parse metadata from post (handles both string and object formats)
 */
function parseMetadata(post: FeedPost): any {
  return typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {})
}

/**
 * Calculate days ago from game date
 */
function getDaysAgo(gameDate: string | null): number {
  if (!gameDate) return Infinity
  const date = new Date(gameDate).getTime()
  const now = Date.now()
  return (now - date) / (1000 * 60 * 60 * 24)
}

/**
 * Check if game is from today (same day)
 */
function isSameDay(gameDate: string | null): boolean {
  if (!gameDate) return false
  const game = new Date(gameDate)
  const today = new Date()
  return game.toDateString() === today.toDateString()
}

/**
 * Get time of day category
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

/**
 * Get day of week
 */
function getDayOfWeek(): number {
  return new Date().getDay() // 0 = Sunday, 6 = Saturday
}

/**
 * Calculate gradient score (smooth curve instead of hard thresholds)
 */
function gradientScore(value: number, thresholds: { min: number, max: number, minScore: number, maxScore: number }): number {
  if (value <= thresholds.min) return thresholds.minScore
  if (value >= thresholds.max) return thresholds.maxScore
  
  // Linear interpolation between min and max
  const ratio = (value - thresholds.min) / (thresholds.max - thresholds.min)
  return thresholds.minScore + (thresholds.maxScore - thresholds.minScore) * ratio
}

/**
 * Calculate engagement score based on likes, comments, shares, views
 */
function calculateEngagementScore(post: FeedPost): number {
  const likes = post.likes_count || 0
  const comments = post.comments_count || 0
  const shares = post.shares_count || 0
  const views = post.views_count || 0
  
  // Weighted engagement: likes worth most, then comments, shares, views
  // Normalize to prevent extreme values
  const normalizedLikes = Math.min(likes / 100, 1.0) // Cap at 100 likes
  const normalizedComments = Math.min(comments / 50, 1.0) // Cap at 50 comments
  const normalizedShares = Math.min(shares / 20, 1.0) // Cap at 20 shares
  const normalizedViews = Math.min(views / 1000, 1.0) // Cap at 1000 views
  
  // Weighted sum
  return (normalizedLikes * 0.4) + (normalizedComments * 0.3) + (normalizedShares * 0.2) + (normalizedViews * 0.1)
}

/**
 * Calculate decay factor for avatar clicks
 * Decays after showing X posts from that team/player
 */
function calculateAvatarDecay(
  post: FeedPost,
  boostedTeamTricodes: Set<string>,
  boostedPlayerIds: Set<number>,
  avatarClickDecay: Map<string, number>
): number {
  let decayFactor = 1.0
  
  const postTeamTricodes = post.team_tricodes || []
  const postPlayerIds = post.player_ids || []
  
  // Check team decay
  for (const team of boostedTeamTricodes) {
    if (postTeamTricodes.includes(team)) {
      const key = `team:${team}`
      const postsShown = avatarClickDecay.get(key) || 0
      // Decay starts after 5 posts, fully decays by 15 posts
      if (postsShown >= 15) {
        decayFactor *= 0.3 // Very low after 15 posts
      } else if (postsShown >= 5) {
        // Linear decay from 1.0 to 0.3 between 5-15 posts
        const decayRatio = (postsShown - 5) / 10
        decayFactor *= 1.0 - (decayRatio * 0.7)
      }
    }
  }
  
  // Check player decay
  for (const playerId of boostedPlayerIds) {
    if (postPlayerIds.includes(playerId)) {
      const key = `player:${playerId}`
      const postsShown = avatarClickDecay.get(key) || 0
      // Similar decay for players
      if (postsShown >= 15) {
        decayFactor *= 0.3
      } else if (postsShown >= 5) {
        const decayRatio = (postsShown - 5) / 10
        decayFactor *= 1.0 - (decayRatio * 0.7)
      }
    }
  }
  
  return decayFactor
}

/**
 * Calculate post weight with comprehensive factors
 * Uses both additive bonuses and multiplicative multipliers
 */
export function calculatePostWeight(
  post: FeedPost,
  options: FeedAlgorithmOptions
): { weight: number, score: number } {
  // Base score (additive) - starts at 0, bonuses add to it
  let score = 0.0
  
  // Base weight (multiplicative) - starts at 1.0, multipliers modify it
  let weight = 1.0
  
  const {
    favoritePlayerIds = new Set(),
    favoriteTeamTricodes = new Set(),
    sharedPostPlayerIds = new Set(),
    sharedPostTeamTricodes = new Set(),
    viewedPostIds = new Set(),
    postFrequencies = new Map(),
    boostedTeamTricodes = new Set(),
    boostedPlayerIds = new Set(),
    avatarClickDecay = new Map(),
    dfsContextByDate = new Map(),
    userBehavior,
    clickSource,
    isUserLoggedIn = false,
    seed = Date.now()
  } = options
  
  const postPlayerIds = post.player_ids || []
  const postTeamTricodes = post.team_tricodes || []
  const metadata = parseMetadata(post)
  const isViewed = viewedPostIds.has(post.id)
  const daysAgo = getDaysAgo(post.game_date)
  const isToday = isSameDay(post.game_date)
  
  // ============================================
  // ADDITIVE BONUSES (add to score)
  // ============================================
  
  // 1. Unviewed posts (strongest additive bonus)
  if (!isViewed) {
    score += 50.0 // Strong base bonus for unviewed
  } else {
    score -= 10.0 // Penalty for viewed posts
  }
  
  // 2. Time-based prioritization (same-day = highest)
  if (isToday) {
    score += 30.0 // Massive bonus for same-day games
  } else if (daysAgo <= 1) {
    score += 20.0 // Last 24 hours
  } else if (daysAgo <= 3) {
    score += 15.0 // Last 3 days
  } else if (daysAgo <= 7) {
    score += 10.0 // Last week
  } else if (daysAgo <= 14) {
    score += 5.0 // Last 2 weeks
  }
  // Older posts get no time bonus
  
  // 3. Quality scores (gradient, not hard thresholds)
  if (post.post_type === 'fun_score') {
    const funScore = metadata?.fun_score || 0
    // Gradient: 0-5 = 0 bonus, 5-7 = 0-10 bonus, 7-9 = 10-25 bonus, 9-10 = 25-40 bonus
    if (funScore >= 9) {
      score += gradientScore(funScore, { min: 9, max: 10, minScore: 25, maxScore: 40 })
    } else if (funScore >= 7) {
      score += gradientScore(funScore, { min: 7, max: 9, minScore: 10, maxScore: 25 })
    } else if (funScore >= 5) {
      score += gradientScore(funScore, { min: 5, max: 7, minScore: 0, maxScore: 10 })
    }
  } else if (post.post_type === 'player_spotlight') {
    const fantasyPoints = metadata?.fantasyPoints || 0
    // Gradient: 0-30 = 0 bonus, 30-40 = 0-10 bonus, 40-50 = 10-25 bonus, 50+ = 25-40 bonus
    if (fantasyPoints >= 50) {
      score += gradientScore(fantasyPoints, { min: 50, max: 70, minScore: 25, maxScore: 40 })
    } else if (fantasyPoints >= 40) {
      score += gradientScore(fantasyPoints, { min: 40, max: 50, minScore: 10, maxScore: 25 })
    } else if (fantasyPoints >= 30) {
      score += gradientScore(fantasyPoints, { min: 30, max: 40, minScore: 0, maxScore: 10 })
    }
  }
  
  // 4. Engagement metrics (additive bonus)
  const engagementScore = calculateEngagementScore(post)
  score += engagementScore * 15.0 // Scale engagement to 0-15 bonus
  
  // 5. Favorite players (additive, scales with count)
  if (favoritePlayerIds.size > 0 && isUserLoggedIn) {
    const matchingFavorites = postPlayerIds.filter(pid => favoritePlayerIds.has(pid))
    if (matchingFavorites.length > 0) {
      // Base bonus per favorite, extra bonus for multiple
      score += matchingFavorites.length * 8.0 // 8 points per favorite
      if (matchingFavorites.length >= 2) {
        score += 5.0 // Extra bonus for multiple favorites
      }
      if (matchingFavorites.length >= 3) {
        score += 5.0 // Even more for 3+
      }
    }
  }
  
  // 6. Favorite teams (additive, scales with count)
  if (favoriteTeamTricodes.size > 0 && isUserLoggedIn) {
    const matchingFavorites = postTeamTricodes.filter(t => favoriteTeamTricodes.has(t))
    if (matchingFavorites.length > 0) {
      score += matchingFavorites.length * 6.0 // 6 points per favorite team
      if (matchingFavorites.length >= 2) {
        score += 4.0 // Extra for multiple favorite teams
      }
    }
  }
  
  // 7. Shared post context (additive)
  if (sharedPostPlayerIds.size > 0) {
    const hasSharedPlayer = postPlayerIds.some(pid => sharedPostPlayerIds.has(pid))
    if (hasSharedPlayer) {
      score += 12.0
    }
  }
  if (sharedPostTeamTricodes.size > 0) {
    const hasSharedTeam = postTeamTricodes.some(t => sharedPostTeamTricodes.has(t))
    if (hasSharedTeam) {
      score += 10.0
    }
  }
  
  // 8. DFS context (date-specific, additive with performance bonus)
  if (dfsContextByDate.size > 0 && isUserLoggedIn && post.game_date) {
    const dfsContext = dfsContextByDate.get(post.game_date)
    if (dfsContext) {
      // Check players
      const matchingDfsPlayers = postPlayerIds.filter(pid => dfsContext.playerIds.has(pid))
      if (matchingDfsPlayers.length > 0) {
        score += matchingDfsPlayers.length * 15.0 // Base DFS bonus
        
        // Performance bonus if available
        if (dfsContext.playerPerformance) {
          for (const playerId of matchingDfsPlayers) {
            const perf = dfsContext.playerPerformance.get(playerId)
            if (perf) {
              // Bonus for high fantasy points
              if (perf.fantasyPoints >= 50) {
                score += 10.0
              } else if (perf.fantasyPoints >= 40) {
                score += 5.0
              }
              // Bonus if they won with this player
              if (perf.won) {
                score += 8.0
              }
            }
          }
        }
      }
      
      // Check teams
      const matchingDfsTeams = postTeamTricodes.filter(t => dfsContext.teamTricodes.has(t))
      if (matchingDfsTeams.length > 0) {
        score += matchingDfsTeams.length * 12.0
      }
    }
  }
  
  // 9. Post frequency penalty (additive penalty)
  const frequency = postFrequencies.get(post.id)
  if (frequency) {
    // Penalty increases with frequency
    score -= frequency.timesShown * 5.0 // -5 per time shown
    // Extra penalty if shown recently
    if (frequency.lastShownAt) {
      const hoursSinceLastShown = (Date.now() - frequency.lastShownAt) / (1000 * 60 * 60)
      if (hoursSinceLastShown < 24) {
        score -= 10.0 // Extra penalty if shown in last 24 hours
      }
    }
  }
  
  // ============================================
  // MULTIPLICATIVE MULTIPLIERS (modify weight)
  // ============================================
  
  // 1. Avatar click boosts (with decay)
  if (boostedTeamTricodes.size > 0 || boostedPlayerIds.size > 0) {
    const hasBoostedTeam = postTeamTricodes.some(t => boostedTeamTricodes.has(t))
    const hasBoostedPlayer = postPlayerIds.some(pid => boostedPlayerIds.has(pid))
    
    if (hasBoostedTeam || hasBoostedPlayer) {
      // Base boost
      let avatarBoost = hasBoostedTeam ? 2.5 : 1.0
      avatarBoost += hasBoostedPlayer ? 2.0 : 0.0
      
      // Apply decay
      const decayFactor = calculateAvatarDecay(post, boostedTeamTricodes, boostedPlayerIds, avatarClickDecay)
      weight *= avatarBoost * decayFactor
    }
  }
  
  // 2. User behavior patterns (preference for post type)
  if (userBehavior?.preferredPostType) {
    if (post.post_type === userBehavior.preferredPostType) {
      weight *= 1.2 // 20% boost for preferred type
    }
  }
  
  // 3. Click source adjustments
  if (clickSource === 'avatar') {
    // When from avatar click, prioritize recent content more
    if (daysAgo <= 1) {
      weight *= 1.3
    }
  } else if (clickSource === 'player_page') {
    // When from player page, prioritize that player's content
    // (handled by boostedPlayerIds above)
    weight *= 1.1 // Slight overall boost
  } else if (clickSource === 'share') {
    // When from share, prioritize related content
    // (handled by sharedPostPlayerIds/sharedPostTeamTricodes above)
    weight *= 1.15
  } else if (clickSource === 'search') {
    // When from search, user is looking for something specific
    // Prioritize quality over recency
    weight *= 1.1
  }
  
  // 4. Time of day adjustments
  const timeOfDay = getTimeOfDay()
  if (timeOfDay === 'morning' && daysAgo <= 1) {
    // Morning: prioritize last night's games
    weight *= 1.2
  } else if (timeOfDay === 'evening' && isToday) {
    // Evening: prioritize today's games
    weight *= 1.15
  }
  
  // 5. Weekend boost (games on weekends might be more important)
  const dayOfWeek = getDayOfWeek()
  if ((dayOfWeek === 0 || dayOfWeek === 6) && daysAgo <= 2) {
    // Weekend games from last 2 days get slight boost
    weight *= 1.1
  }
  
  // 6. Randomness - increased for magical/random feel
  // Use multiple sources of randomness for more variation
  const randomComponent1 = ((seed + post.id.charCodeAt(0)) % 100) / 100
  const randomComponent2 = ((seed * 7 + (post.id.charCodeAt(post.id.length - 1) || 0)) % 100) / 100
  const randomComponent3 = ((seed * 13 + ((post.game_date?.charCodeAt(0) || 0) % 100)) % 100) / 100
  // Combine multiple random sources for more variation
  const combinedRandom = (randomComponent1 + randomComponent2 + randomComponent3) / 3
  // Vary weight by up to 1.25x for more magical randomness
  weight *= (0.75 + combinedRandom * 0.5) // Range: 0.75x to 1.25x
  
  // Final weight = (base score + bonuses) * multipliers
  const finalWeight = Math.max(0.1, (score + 100) * weight) // Add 100 to base score to ensure positive
  
  return { weight: finalWeight, score }
}

/**
 * Main feed algorithm function
 * Orders posts intelligently based on comprehensive weighting system
 */
export function orderPostsByAlgorithm(
  posts: FeedPost[],
  options: FeedAlgorithmOptions = {}
): FeedPost[] {
  const {
    viewedPostIds = new Set(),
    seed = Date.now(),
    strictRatio = true,
    useWeights = true // Default to using weights now
  } = options
  
  // Separate posts by type
  const funScorePosts: FeedPost[] = []
  const playerSpotlightPosts: FeedPost[] = []
  const otherPosts: FeedPost[] = []
  
  posts.forEach(post => {
    if (post.post_type === 'fun_score') {
      funScorePosts.push(post)
    } else if (post.post_type === 'player_spotlight') {
      playerSpotlightPosts.push(post)
    } else {
      otherPosts.push(post)
    }
  })
  
  // Helper to check if post is viewed
  const isViewed = (post: FeedPost) => viewedPostIds.has(post.id)
  
  // Calculate weights for all posts
  const allPostsWithWeights = posts.map(post => ({
    post,
    ...calculatePostWeight(post, options)
  }))
  
  // Separate by type with weights
  const funScoreWithWeights = allPostsWithWeights.filter(w => w.post.post_type === 'fun_score')
  const playerSpotlightWithWeights = allPostsWithWeights.filter(w => w.post.post_type === 'player_spotlight')
  const otherWithWeights = allPostsWithWeights.filter(w => 
    w.post.post_type !== 'fun_score' && w.post.post_type !== 'player_spotlight'
  )
  
  // Separate unviewed and viewed
  const unviewedFunScores = funScoreWithWeights.filter(w => !isViewed(w.post))
  const unviewedPlayerSpotlights = playerSpotlightWithWeights.filter(w => !isViewed(w.post))
  const viewedFunScores = funScoreWithWeights.filter(w => isViewed(w.post))
  const viewedPlayerSpotlights = playerSpotlightWithWeights.filter(w => isViewed(w.post))
  
  // Sort by weight (descending) - highest weight first
  unviewedFunScores.sort((a, b) => b.weight - a.weight)
  unviewedPlayerSpotlights.sort((a, b) => b.weight - a.weight)
  viewedFunScores.sort((a, b) => b.weight - a.weight)
  viewedPlayerSpotlights.sort((a, b) => b.weight - a.weight)
  
  const interleaved: FeedPost[] = []
  
  if (strictRatio && useWeights) {
    // Weight-based interleaving with 1:1 ratio (fun_score:player_spotlight)
    let funIndex = 0
    let playerIndex = 0
    let lastAddedType: 'fun_score' | 'player_spotlight' | null = null
    
    // Interleave unviewed posts first - maintain 1:1 ratio
    while (funIndex < unviewedFunScores.length || playerIndex < unviewedPlayerSpotlights.length) {
      // Alternate between fun_score and player_spotlight
      // If we just added a player_spotlight (or haven't added anything), add a fun_score next
      if (lastAddedType !== 'fun_score' && funIndex < unviewedFunScores.length) {
        interleaved.push(unviewedFunScores[funIndex].post)
        funIndex++
        lastAddedType = 'fun_score'
      }
      // If we just added a fun_score (or haven't added anything), add a player_spotlight next
      else if (lastAddedType !== 'player_spotlight' && playerIndex < unviewedPlayerSpotlights.length) {
        interleaved.push(unviewedPlayerSpotlights[playerIndex].post)
        playerIndex++
        lastAddedType = 'player_spotlight'
      }
      // If we've run out of one type, continue with the other
      else if (funIndex >= unviewedFunScores.length && playerIndex < unviewedPlayerSpotlights.length) {
        interleaved.push(unviewedPlayerSpotlights[playerIndex].post)
        playerIndex++
        lastAddedType = 'player_spotlight'
      }
      else if (playerIndex >= unviewedPlayerSpotlights.length && funIndex < unviewedFunScores.length) {
        interleaved.push(unviewedFunScores[funIndex].post)
        funIndex++
        lastAddedType = 'fun_score'
      }
      else {
        break // Both types exhausted
      }
    }
    
    // Then add viewed posts (also weight-sorted, interleaved with 1:1 ratio)
    let viewedFunIndex = 0
    let viewedPlayerIndex = 0
    let viewedLastAddedType: 'fun_score' | 'player_spotlight' | null = null
    
    while (viewedFunIndex < viewedFunScores.length || viewedPlayerIndex < viewedPlayerSpotlights.length) {
      // Alternate between fun_score and player_spotlight
      if (viewedLastAddedType !== 'fun_score' && viewedFunIndex < viewedFunScores.length) {
        interleaved.push(viewedFunScores[viewedFunIndex].post)
        viewedFunIndex++
        viewedLastAddedType = 'fun_score'
      }
      else if (viewedLastAddedType !== 'player_spotlight' && viewedPlayerIndex < viewedPlayerSpotlights.length) {
        interleaved.push(viewedPlayerSpotlights[viewedPlayerIndex].post)
        viewedPlayerIndex++
        viewedLastAddedType = 'player_spotlight'
      }
      // If we've run out of one type, continue with the other
      else if (viewedFunIndex >= viewedFunScores.length && viewedPlayerIndex < viewedPlayerSpotlights.length) {
        interleaved.push(viewedPlayerSpotlights[viewedPlayerIndex].post)
        viewedPlayerIndex++
        viewedLastAddedType = 'player_spotlight'
      }
      else if (viewedPlayerIndex >= viewedPlayerSpotlights.length && viewedFunIndex < viewedFunScores.length) {
        interleaved.push(viewedFunScores[viewedFunIndex].post)
        viewedFunIndex++
        viewedLastAddedType = 'fun_score'
      }
      else {
        break // Both types exhausted
      }
    }
  } else if (!strictRatio && useWeights) {
    // Pure weight-based ordering, no ratio enforcement
    const allUnviewed = [...unviewedFunScores, ...unviewedPlayerSpotlights]
    const allViewed = [...viewedFunScores, ...viewedPlayerSpotlights]
    
    allUnviewed.sort((a, b) => b.weight - a.weight)
    allViewed.sort((a, b) => b.weight - a.weight)
    
    interleaved.push(...allUnviewed.map(w => w.post))
    interleaved.push(...allViewed.map(w => w.post))
  } else {
    // Fallback: original deterministic sorting (if useWeights = false)
    // This maintains backward compatibility
    const parseMetadata = (post: FeedPost) => {
      return typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {})
    }
    
    const unviewedFun = funScorePosts.filter(p => !isViewed(p))
    const unviewedPlayer = playerSpotlightPosts.filter(p => !isViewed(p))
    
    unviewedFun.sort((a, b) => {
      const metaA = parseMetadata(a)
      const metaB = parseMetadata(b)
      const scoreA = metaA?.fun_score || 0
      const scoreB = metaB?.fun_score || 0
      if (scoreB !== scoreA) return scoreB - scoreA
      const dateA = a.game_date ? new Date(a.game_date).getTime() : 0
      const dateB = b.game_date ? new Date(b.game_date).getTime() : 0
      return dateB - dateA
    })
    
    unviewedPlayer.sort((a, b) => {
      const metaA = parseMetadata(a)
      const metaB = parseMetadata(b)
      const pointsA = metaA?.fantasyPoints || 0
      const pointsB = metaB?.fantasyPoints || 0
      if (pointsB !== pointsA) return pointsB - pointsA
      const dateA = a.game_date ? new Date(a.game_date).getTime() : 0
      const dateB = b.game_date ? new Date(b.game_date).getTime() : 0
      return dateB - dateA
    })
    
    // Simple interleaving with 1:1 ratio
    let funIdx = 0
    let playerIdx = 0
    let lastAddedType: 'fun_score' | 'player_spotlight' | null = null
    
    while (funIdx < unviewedFun.length || playerIdx < unviewedPlayer.length) {
      // Alternate between fun_score and player_spotlight (1:1 ratio)
      if (lastAddedType !== 'fun_score' && funIdx < unviewedFun.length) {
        interleaved.push(unviewedFun[funIdx++])
        lastAddedType = 'fun_score'
      }
      else if (lastAddedType !== 'player_spotlight' && playerIdx < unviewedPlayer.length) {
        interleaved.push(unviewedPlayer[playerIdx++])
        lastAddedType = 'player_spotlight'
      }
      // If we've run out of one type, continue with the other
      else if (funIdx >= unviewedFun.length && playerIdx < unviewedPlayer.length) {
        interleaved.push(unviewedPlayer[playerIdx++])
        lastAddedType = 'player_spotlight'
      }
      else if (playerIdx >= unviewedPlayer.length && funIdx < unviewedFun.length) {
        interleaved.push(unviewedFun[funIdx++])
        lastAddedType = 'fun_score'
      }
      else {
        break // Both types exhausted
      }
    }
  }
  
  // Add other post types at the end (weight-sorted if using weights)
  const unviewedOther = otherWithWeights.filter(w => !isViewed(w.post))
  const viewedOther = otherWithWeights.filter(w => isViewed(w.post))
  
  if (useWeights) {
    unviewedOther.sort((a, b) => b.weight - a.weight)
    viewedOther.sort((a, b) => b.weight - a.weight)
    interleaved.push(...unviewedOther.map(w => w.post))
    interleaved.push(...viewedOther.map(w => w.post))
  } else {
    interleaved.push(...seededShuffle(unviewedOther.map(w => w.post), seed + 3000))
    interleaved.push(...seededShuffle(viewedOther.map(w => w.post), seed + 4000))
  }
  
  return interleaved
}
