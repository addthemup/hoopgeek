/**
 * Feed Algorithm Debug Utility
 * 
 * Provides detailed logging and analysis of feed algorithm decisions
 * Helps test and understand how different factors affect feed ordering
 */

import { FeedPost, FeedAlgorithmOptions } from './feedAlgorithm'

/**
 * Detailed breakdown of why a post got its weight
 */
export interface PostWeightBreakdown {
  postId: string
  postTitle: string
  postType: string
  finalWeight: number
  finalScore: number
  factors: {
    unviewed?: { value: boolean; bonus: number }
    recency?: { daysAgo: number; bonus: number }
    sameDay?: { value: boolean; bonus: number }
    quality?: { type: 'fun_score' | 'player_spotlight'; value: number; bonus: number }
    engagement?: { score: number; bonus: number }
    favoritePlayers?: { count: number; bonus: number }
    favoriteTeams?: { count: number; bonus: number }
    sharedPostContext?: { hasPlayer: boolean; hasTeam: boolean; bonus: number }
    dfsContext?: { hasPlayer: boolean; hasTeam: boolean; performanceBonus: number; bonus: number }
    postFrequency?: { timesShown: number; penalty: number }
    avatarBoost?: { hasBoostedTeam: boolean; hasBoostedPlayer: boolean; multiplier: number; decayFactor: number }
    userBehavior?: { preferredType: boolean; multiplier: number }
    clickSource?: { source: string; multiplier: number }
    timeOfDay?: { time: string; multiplier: number }
    weekend?: { isWeekend: boolean; multiplier: number }
    randomness?: { variation: number }
  }
}

/**
 * Calculate detailed weight breakdown for a post
 */
export function getPostWeightBreakdown(
  post: FeedPost,
  options: FeedAlgorithmOptions
): PostWeightBreakdown {
  // We'll need to replicate the weight calculation logic but track each factor
  // For now, let's use the actual calculatePostWeight and then break it down
  
  const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {})
  const postPlayerIds = post.player_ids || []
  const postTeamTricodes = post.team_tricodes || []
  const isViewed = options.viewedPostIds?.has(post.id) || false
  
  // Calculate days ago
  const gameDate = post.game_date ? new Date(post.game_date).getTime() : null
  const now = Date.now()
  const daysAgo = gameDate ? (now - gameDate) / (1000 * 60 * 60 * 24) : Infinity
  const isToday = gameDate ? new Date(gameDate).toDateString() === new Date().toDateString() : false
  
  // Get time of day
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'
  const dayOfWeek = new Date().getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  
  const factors: PostWeightBreakdown['factors'] = {}
  
  // Unviewed bonus
  if (!isViewed) {
    factors.unviewed = { value: true, bonus: 50.0 }
  } else {
    factors.unviewed = { value: false, bonus: -10.0 }
  }
  
  // Recency bonuses
  if (isToday) {
    factors.sameDay = { value: true, bonus: 30.0 }
  } else if (daysAgo <= 1) {
    factors.recency = { daysAgo, bonus: 20.0 }
  } else if (daysAgo <= 3) {
    factors.recency = { daysAgo, bonus: 15.0 }
  } else if (daysAgo <= 7) {
    factors.recency = { daysAgo, bonus: 10.0 }
  } else if (daysAgo <= 14) {
    factors.recency = { daysAgo, bonus: 5.0 }
  } else {
    factors.recency = { daysAgo, bonus: 0 }
  }
  
  // Quality scores
  if (post.post_type === 'game_recap') {
    const funScore = metadata?.fun_score || 0
    let qualityBonus = 0
    if (funScore >= 9) {
      qualityBonus = 25 + ((funScore - 9) / 1) * 15 // 25-40
    } else if (funScore >= 7) {
      qualityBonus = 10 + ((funScore - 7) / 2) * 15 // 10-25
    } else if (funScore >= 5) {
      qualityBonus = ((funScore - 5) / 2) * 10 // 0-10
    }
    factors.quality = { type: 'fun_score', value: funScore, bonus: qualityBonus }
  } else if (post.post_type === 'player_spotlight') {
    const fantasyPoints = metadata?.fantasyPoints || 0
    let qualityBonus = 0
    if (fantasyPoints >= 50) {
      qualityBonus = 25 + ((fantasyPoints - 50) / 20) * 15 // 25-40
    } else if (fantasyPoints >= 40) {
      qualityBonus = 10 + ((fantasyPoints - 40) / 10) * 15 // 10-25
    } else if (fantasyPoints >= 30) {
      qualityBonus = ((fantasyPoints - 30) / 10) * 10 // 0-10
    }
    factors.quality = { type: 'player_spotlight', value: fantasyPoints, bonus: qualityBonus }
  }
  
  // Engagement
  const likes = post.likes_count || 0
  const comments = post.comments_count || 0
  const shares = post.shares_count || 0
  const views = post.views_count || 0
  const normalizedLikes = Math.min(likes / 100, 1.0)
  const normalizedComments = Math.min(comments / 50, 1.0)
  const normalizedShares = Math.min(shares / 20, 1.0)
  const normalizedViews = Math.min(views / 1000, 1.0)
  const engagementScore = (normalizedLikes * 0.4) + (normalizedComments * 0.3) + (normalizedShares * 0.2) + (normalizedViews * 0.1)
  factors.engagement = { score: engagementScore, bonus: engagementScore * 15.0 }
  
  // Favorite players
  if (options.favoritePlayerIds && options.favoritePlayerIds.size > 0 && options.isUserLoggedIn) {
    const matchingFavorites = postPlayerIds.filter(pid => options.favoritePlayerIds!.has(pid))
    if (matchingFavorites.length > 0) {
      let bonus = matchingFavorites.length * 8.0
      if (matchingFavorites.length >= 2) bonus += 5.0
      if (matchingFavorites.length >= 3) bonus += 5.0
      factors.favoritePlayers = { count: matchingFavorites.length, bonus }
    }
  }
  
  // Favorite teams
  if (options.favoriteTeamTricodes && options.favoriteTeamTricodes.size > 0 && options.isUserLoggedIn) {
    const matchingFavorites = postTeamTricodes.filter(t => options.favoriteTeamTricodes!.has(t))
    if (matchingFavorites.length > 0) {
      let bonus = matchingFavorites.length * 6.0
      if (matchingFavorites.length >= 2) bonus += 4.0
      factors.favoriteTeams = { count: matchingFavorites.length, bonus }
    }
  }
  
  // Shared post context
  if (options.sharedPostPlayerIds && options.sharedPostPlayerIds.size > 0) {
    const hasSharedPlayer = postPlayerIds.some(pid => options.sharedPostPlayerIds!.has(pid))
    const hasSharedTeam = postTeamTricodes.some(t => options.sharedPostTeamTricodes?.has(t))
    if (hasSharedPlayer || hasSharedTeam) {
      let bonus = 0
      if (hasSharedPlayer) bonus += 12.0
      if (hasSharedTeam) bonus += 10.0
      factors.sharedPostContext = { hasPlayer: hasSharedPlayer, hasTeam: hasSharedTeam, bonus }
    }
  }
  
  // DFS context
  if (options.dfsContextByDate && options.isUserLoggedIn && post.game_date) {
    const gameDateStr = new Date(post.game_date).toISOString().split('T')[0]
    const dfsContext = options.dfsContextByDate.get(gameDateStr)
    if (dfsContext) {
      const matchingDfsPlayers = postPlayerIds.filter(pid => dfsContext.playerIds.has(pid))
      const matchingDfsTeams = postTeamTricodes.filter(t => dfsContext.teamTricodes.has(t))
      if (matchingDfsPlayers.length > 0 || matchingDfsTeams.length > 0) {
        let bonus = matchingDfsPlayers.length * 15.0 + matchingDfsTeams.length * 12.0
        let performanceBonus = 0
        
        if (dfsContext.playerPerformance) {
          for (const playerId of matchingDfsPlayers) {
            const perf = dfsContext.playerPerformance!.get(playerId)
            if (perf) {
              if (perf.fantasyPoints >= 50) performanceBonus += 10.0
              else if (perf.fantasyPoints >= 40) performanceBonus += 5.0
              if (perf.won) performanceBonus += 8.0
            }
          }
        }
        
        factors.dfsContext = {
          hasPlayer: matchingDfsPlayers.length > 0,
          hasTeam: matchingDfsTeams.length > 0,
          performanceBonus,
          bonus: bonus + performanceBonus
        }
      }
    }
  }
  
  // Post frequency penalty
  if (options.postFrequencies) {
    const frequency = options.postFrequencies.get(post.id)
    if (frequency) {
      let penalty = frequency.timesShown * 5.0
      if (frequency.lastShownAt) {
        const hoursSinceLastShown = (Date.now() - frequency.lastShownAt) / (1000 * 60 * 60)
        if (hoursSinceLastShown < 24) {
          penalty += 10.0
        }
      }
      factors.postFrequency = { timesShown: frequency.timesShown, penalty: -penalty }
    }
  }
  
  // Avatar boost with decay
  let avatarMultiplier = 1.0
  let decayFactor = 1.0
  if (options.boostedTeamTricodes && options.boostedTeamTricodes.size > 0) {
    const hasBoostedTeam = postTeamTricodes.some(t => options.boostedTeamTricodes!.has(t))
    if (hasBoostedTeam) {
      avatarMultiplier = 2.5
      
      // Calculate decay
      if (options.avatarClickDecay) {
        for (const team of options.boostedTeamTricodes) {
          if (postTeamTricodes.includes(team)) {
            const key = `team:${team}`
            const postsShown = options.avatarClickDecay.get(key) || 0
            if (postsShown >= 15) {
              decayFactor = 0.3
            } else if (postsShown >= 5) {
              const decayRatio = (postsShown - 5) / 10
              decayFactor = 1.0 - (decayRatio * 0.7)
            }
          }
        }
      }
    }
  }
  
  if (options.boostedPlayerIds && options.boostedPlayerIds.size > 0) {
    const hasBoostedPlayer = postPlayerIds.some(pid => options.boostedPlayerIds!.has(pid))
    if (hasBoostedPlayer) {
      avatarMultiplier = Math.max(avatarMultiplier, 2.0)
      
      // Calculate decay for player
      if (options.avatarClickDecay) {
        for (const playerId of options.boostedPlayerIds) {
          if (postPlayerIds.includes(playerId)) {
            const key = `player:${playerId}`
            const postsShown = options.avatarClickDecay.get(key) || 0
            if (postsShown >= 15) {
              decayFactor = Math.min(decayFactor, 0.3)
            } else if (postsShown >= 5) {
              const decayRatio = (postsShown - 5) / 10
              decayFactor = Math.min(decayFactor, 1.0 - (decayRatio * 0.7))
            }
          }
        }
      }
    }
  }
  
  if (avatarMultiplier > 1.0) {
    factors.avatarBoost = {
      hasBoostedTeam: options.boostedTeamTricodes ? postTeamTricodes.some(t => options.boostedTeamTricodes!.has(t)) : false,
      hasBoostedPlayer: options.boostedPlayerIds ? postPlayerIds.some(pid => options.boostedPlayerIds!.has(pid)) : false,
      multiplier: avatarMultiplier,
      decayFactor
    }
  }
  
  // User behavior
  if (options.userBehavior?.preferredPostTypes) {
    const preferredType = options.userBehavior.preferredPostTypes.includes(post.post_type as any)
    if (preferredType) {
      factors.userBehavior = { preferredType: true, multiplier: 1.2 }
    }
  }
  
  // Click source
  if (options.clickSource) {
    let multiplier = 1.0
    if (options.clickSource === 'avatar' && daysAgo <= 1) {
      multiplier = 1.3
    } else if (options.clickSource === 'player_page') {
      multiplier = 1.1
    } else if (options.clickSource === 'share') {
      multiplier = 1.15
    } else if (options.clickSource === 'search') {
      multiplier = 1.1
    }
    if (multiplier > 1.0) {
      factors.clickSource = { source: options.clickSource, multiplier }
    }
  }
  
  // Time of day
  if (timeOfDay === 'morning' && daysAgo <= 1) {
    factors.timeOfDay = { time: timeOfDay, multiplier: 1.2 }
  } else if (timeOfDay === 'evening' && isToday) {
    factors.timeOfDay = { time: timeOfDay, multiplier: 1.15 }
  }
  
  // Weekend
  if (isWeekend && daysAgo <= 2) {
    factors.weekend = { isWeekend: true, multiplier: 1.1 }
  }
  
  // Randomness
  const seed = options.seed || Date.now()
  const randomComponent1 = ((seed + post.id.charCodeAt(0)) % 100) / 100
  const randomComponent2 = ((seed * 7 + (post.id.charCodeAt(post.id.length - 1) || 0)) % 100) / 100
  const randomComponent3 = ((seed * 13 + ((post.game_date?.charCodeAt(0) || 0) % 100)) % 100) / 100
  const combinedRandom = (randomComponent1 + randomComponent2 + randomComponent3) / 3
  const randomnessMultiplier = 0.75 + combinedRandom * 0.5 // Range: 0.75x to 1.25x
  factors.randomness = { variation: randomnessMultiplier }
  
  // Calculate final score and weight
  let score = 0.0
  let weight = 1.0
  
  // Add all bonuses
  if (factors.unviewed) score += factors.unviewed.bonus
  if (factors.sameDay) score += factors.sameDay.bonus
  if (factors.recency) score += factors.recency.bonus
  if (factors.quality) score += factors.quality.bonus
  if (factors.engagement) score += factors.engagement.bonus
  if (factors.favoritePlayers) score += factors.favoritePlayers.bonus
  if (factors.favoriteTeams) score += factors.favoriteTeams.bonus
  if (factors.sharedPostContext) score += factors.sharedPostContext.bonus
  if (factors.dfsContext) score += factors.dfsContext.bonus
  if (factors.postFrequency) score += factors.postFrequency.penalty
  
  // Apply multipliers
  if (factors.avatarBoost) weight *= factors.avatarBoost.multiplier * factors.avatarBoost.decayFactor
  if (factors.userBehavior) weight *= factors.userBehavior.multiplier
  if (factors.clickSource) weight *= factors.clickSource.multiplier
  if (factors.timeOfDay) weight *= factors.timeOfDay.multiplier
  if (factors.weekend) weight *= factors.weekend.multiplier
  if (factors.randomness) weight *= factors.randomness.variation
  
  const finalWeight = Math.max(0.1, (score + 100) * weight)
  
  return {
    postId: post.id,
    postTitle: post.title || 'Untitled',
    postType: post.post_type,
    finalWeight,
    finalScore: score,
    factors
  }
}

/**
 * Log detailed breakdown of avatar bar posts
 */
export function logAvatarBarBreakdown(
  posts: FeedPost[],
  options: FeedAlgorithmOptions,
  context: {
    route: string
    isLoggedIn: boolean
    clickSource?: string
    hasSharedPost?: boolean
    hasPlayerContext?: boolean
  }
) {
  console.group('🎯 AVATAR BAR ALGORITHM BREAKDOWN')
  console.log('📊 Context:', {
    route: context.route,
    isLoggedIn: context.isLoggedIn,
    clickSource: context.clickSource || 'home',
    hasSharedPost: context.hasSharedPost || false,
    hasPlayerContext: context.hasPlayerContext || false,
    totalPosts: posts.length,
    favoritePlayers: options.favoritePlayerIds?.size || 0,
    favoriteTeams: options.favoriteTeamTricodes?.size || 0,
    viewedPosts: options.viewedPostIds?.size || 0,
    dfsContextDates: options.dfsContextByDate?.size || 0,
    boostedTeams: options.boostedTeamTricodes?.size || 0,
    boostedPlayers: options.boostedPlayerIds?.size || 0
  })
  
  // Calculate breakdown for each post
  const breakdowns = posts.map(post => getPostWeightBreakdown(post, options))
  
  // Sort by weight (descending)
  breakdowns.sort((a, b) => b.finalWeight - a.finalWeight)
  
  // Log top 20 (what appears in avatar bar)
  const topPosts = breakdowns.slice(0, 20)
  
  console.log(`\n📋 Top ${topPosts.length} Posts (Avatar Bar Order):`)
  topPosts.forEach((breakdown, index) => {
    console.group(`#${index + 1} - ${breakdown.postTitle} (${breakdown.postType})`)
    console.log('🎯 Final Weight:', breakdown.finalWeight.toFixed(2))
    console.log('📊 Base Score:', breakdown.finalScore.toFixed(2))
    console.log('\n📈 Factors:')
    
    if (breakdown.factors.unviewed) {
      console.log(`  ✅ Unviewed: ${breakdown.factors.unviewed.bonus > 0 ? '+' : ''}${breakdown.factors.unviewed.bonus.toFixed(1)}`)
    }
    if (breakdown.factors.sameDay) {
      console.log(`  📅 Same Day: +${breakdown.factors.sameDay.bonus.toFixed(1)}`)
    }
    if (breakdown.factors.recency) {
      console.log(`  ⏰ Recency (${breakdown.factors.recency.daysAgo.toFixed(1)} days): +${breakdown.factors.recency.bonus.toFixed(1)}`)
    }
    if (breakdown.factors.quality) {
      const q = breakdown.factors.quality
      console.log(`  ⭐ Quality (${q.type}: ${q.value.toFixed(1)}): +${q.bonus.toFixed(1)}`)
    }
    if (breakdown.factors.engagement) {
      console.log(`  💬 Engagement (${breakdown.factors.engagement.score.toFixed(2)}): +${breakdown.factors.engagement.bonus.toFixed(1)}`)
    }
    if (breakdown.factors.favoritePlayers) {
      console.log(`  ⭐ Favorite Players (${breakdown.factors.favoritePlayers.count}): +${breakdown.factors.favoritePlayers.bonus.toFixed(1)}`)
    }
    if (breakdown.factors.favoriteTeams) {
      console.log(`  🏀 Favorite Teams (${breakdown.factors.favoriteTeams.count}): +${breakdown.factors.favoriteTeams.bonus.toFixed(1)}`)
    }
    if (breakdown.factors.sharedPostContext) {
      console.log(`  🔗 Shared Post Context: +${breakdown.factors.sharedPostContext.bonus.toFixed(1)}`)
    }
    if (breakdown.factors.dfsContext) {
      console.log(`  🎲 DFS Context: +${breakdown.factors.dfsContext.bonus.toFixed(1)} (performance: +${breakdown.factors.dfsContext.performanceBonus.toFixed(1)})`)
    }
    if (breakdown.factors.postFrequency) {
      console.log(`  🔁 Post Frequency (${breakdown.factors.postFrequency.timesShown}x shown): ${breakdown.factors.postFrequency.penalty.toFixed(1)}`)
    }
    if (breakdown.factors.avatarBoost) {
      const ab = breakdown.factors.avatarBoost
      console.log(`  🎯 Avatar Boost: ${ab.multiplier.toFixed(2)}x (decay: ${ab.decayFactor.toFixed(2)}x) = ${(ab.multiplier * ab.decayFactor).toFixed(2)}x`)
    }
    if (breakdown.factors.userBehavior) {
      console.log(`  👤 User Behavior (preferred type): ${breakdown.factors.userBehavior.multiplier.toFixed(2)}x`)
    }
    if (breakdown.factors.clickSource) {
      console.log(`  🖱️ Click Source (${breakdown.factors.clickSource.source}): ${breakdown.factors.clickSource.multiplier.toFixed(2)}x`)
    }
    if (breakdown.factors.timeOfDay) {
      console.log(`  🕐 Time of Day (${breakdown.factors.timeOfDay.time}): ${breakdown.factors.timeOfDay.multiplier.toFixed(2)}x`)
    }
    if (breakdown.factors.weekend) {
      console.log(`  📅 Weekend: ${breakdown.factors.weekend.multiplier.toFixed(2)}x`)
    }
    if (breakdown.factors.randomness) {
      console.log(`  🎲 Randomness: ${breakdown.factors.randomness.variation.toFixed(2)}x`)
    }
    
    console.groupEnd()
  })
  
  console.log('\n📊 Summary:')
  console.log(`  - Average Weight: ${(breakdowns.reduce((sum, b) => sum + b.finalWeight, 0) / breakdowns.length).toFixed(2)}`)
  console.log(`  - Weight Range: ${Math.min(...breakdowns.map(b => b.finalWeight)).toFixed(2)} - ${Math.max(...breakdowns.map(b => b.finalWeight)).toFixed(2)}`)
  console.log(`  - Unviewed Posts: ${breakdowns.filter(b => b.factors.unviewed?.value).length}/${breakdowns.length}`)
  console.log(`  - Same Day Posts: ${breakdowns.filter(b => b.factors.sameDay?.value).length}/${breakdowns.length}`)
  console.log(`  - Favorite Player Posts: ${breakdowns.filter(b => b.factors.favoritePlayers).length}/${breakdowns.length}`)
  console.log(`  - DFS Context Posts: ${breakdowns.filter(b => b.factors.dfsContext).length}/${breakdowns.length}`)
  
  console.groupEnd()
}

