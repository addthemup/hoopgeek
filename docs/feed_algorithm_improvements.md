# Feed Algorithm Improvements - Complete Rewrite

## ✅ What's Been Implemented

### 1. **Weights Actually Work Now!**
- The algorithm now **actually uses** the calculated weights
- Posts are sorted by weight (highest first)
- Default `useWeights = true` (can be disabled for backward compatibility)

### 2. **Additive + Multiplicative System**
- **Additive bonuses** (add to score):
  - Unviewed posts: +50 points
  - Same-day games: +30 points
  - Last 24 hours: +20 points
  - Quality scores: +0-40 points (gradient)
  - Engagement: +0-15 points
  - Favorites: +6-8 points per favorite (scales with count)
  - Multiple favorites: Extra +5-10 points
  - DFS context: +12-15 points per player/team
  - DFS performance: +5-10 points for high scores, +8 for wins
  
- **Multiplicative multipliers** (modify weight):
  - Avatar clicks: 2.0x-2.5x (with decay)
  - User preferences: 1.2x
  - Click source: 1.1x-1.3x
  - Time of day: 1.15x-1.2x
  - Weekend: 1.1x

### 3. **Gradient Scoring (No More Hard Thresholds)**
- **Fun Score**: Smooth curve from 0-10
  - 0-5: 0 bonus
  - 5-7: 0-10 bonus (gradient)
  - 7-9: 10-25 bonus (gradient)
  - 9-10: 25-40 bonus (gradient)
  
- **Fantasy Points**: Smooth curve from 0-70
  - 0-30: 0 bonus
  - 30-40: 0-10 bonus (gradient)
  - 40-50: 10-25 bonus (gradient)
  - 50-70: 25-40 bonus (gradient)

### 4. **Time-Based Prioritization**
- **Same-day games**: +30 points (highest priority)
- **Last 24 hours**: +20 points
- **Last 3 days**: +15 points
- **Last week**: +10 points
- **Last 2 weeks**: +5 points
- **Older**: No time bonus

### 5. **Engagement Metrics**
- Weighted engagement score:
  - Likes: 40% weight (capped at 100)
  - Comments: 30% weight (capped at 50)
  - Shares: 20% weight (capped at 20)
  - Views: 10% weight (capped at 1000)
- Adds 0-15 points to score

### 6. **Post Frequency Tracking**
- Penalty: -5 points per time shown
- Extra -10 points if shown in last 24 hours
- Prevents showing same post too many times

### 7. **Multiple Favorites Boost**
- Base: +8 points per favorite player, +6 per favorite team
- 2+ favorites: +5 extra points
- 3+ favorites: +5 more extra points
- Scales with number of favorites in post

### 8. **Decay Functions for Avatar Clicks**
- Decay starts after 5 posts shown
- Fully decays by 15 posts shown
- Linear decay from 1.0x to 0.3x multiplier
- Prevents over-saturation of same team/player

### 9. **Different Strategies Per Click Source**
- **'home'**: Standard algorithm
- **'avatar'**: +30% weight for recent content (≤1 day)
- **'player_page'**: +10% overall weight, prioritizes that player
- **'share'**: +15% overall weight, prioritizes related content
- **'search'**: +10% overall weight, prioritizes quality

### 10. **DFS Context (Date-Specific)**
- Requires `dfsContextByDate` Map: `game_date -> DFSContext`
- DFSContext includes:
  - `playerIds`: Set of players user had on that date
  - `teamTricodes`: Set of teams user had on that date
  - `playerPerformance`: Map of player performance (optional)
    - fantasyPoints
    - won (boolean)
    - entryCount
- Bonuses:
  - Base: +15 points per DFS player, +12 per DFS team
  - High performance (≥50 FP): +10 points
  - Good performance (≥40 FP): +5 points
  - Won with player: +8 points

### 11. **User Behavior Patterns**
- `preferredPostType`: 'fun_score' | 'player_spotlight' | null
- If user prefers a type, that type gets +20% weight multiplier
- Can be extended with:
  - `avgTimeSpent`: Average viewing time
  - `completionRate`: % of posts fully viewed

### 12. **Time of Day & Day of Week**
- **Morning**: +20% weight for last night's games (≤1 day)
- **Evening**: +15% weight for today's games
- **Weekend**: +10% weight for games from last 2 days

### 13. **Reduced Randomness**
- Changed from ±20% to ±10% variation
- More predictable, less chaotic results

## 📊 Weight Calculation Formula

```
Final Weight = (Base Score + All Bonuses) × All Multipliers

Where:
- Base Score = 100 (ensures positive)
- Bonuses = Additive (summed)
- Multipliers = Multiplicative (multiplied)
```

## 🔧 New Options Interface

```typescript
interface FeedAlgorithmOptions {
  // Existing...
  favoritePlayerIds?: Set<number>
  favoriteTeamTricodes?: Set<string>
  viewedPostIds?: Set<string>
  clickSource?: 'home' | 'avatar' | 'player_page' | 'share' | 'search'
  isUserLoggedIn?: boolean
  boostedTeamTricodes?: Set<string>
  boostedPlayerIds?: Set<number>
  
  // NEW:
  postFrequencies?: Map<string, PostFrequency>
  avatarClickDecay?: Map<string, number>
  dfsContextByDate?: Map<string, DFSContext>
  userBehavior?: UserBehavior
  useWeights?: boolean // Default: true
  strictRatio?: boolean // Default: true
}
```

## 🚀 Next Steps (To Fully Implement)

1. **Track Post Frequencies** in Highlights.tsx
   - Store in state: `Map<postId, { timesShown, lastShownAt }>`
   - Update when displaying posts
   - Pass to algorithm

2. **Track Avatar Click Decay** in Highlights.tsx
   - Store in state: `Map<'team:XXX' | 'player:XXX', count>`
   - Increment when showing posts from boosted team/player
   - Pass to algorithm

3. **Fetch DFS Context** in Highlights.tsx
   - Query `dfs_lineup_positions` for user's lineups
   - Group by `game_date` (from `dfs_pool_games`)
   - Build `Map<game_date, DFSContext>`
   - Pass to algorithm

4. **Track User Behavior** (optional, future)
   - Track post type preferences
   - Track viewing time
   - Track completion rates
   - Build `UserBehavior` object
   - Pass to algorithm

## 📈 Expected Improvements

1. **Better Personalization**: Multiple favorites, DFS context, behavior patterns
2. **Better Recency**: Same-day games prioritized, time-of-day awareness
3. **Better Quality**: Gradient scoring, engagement metrics
4. **Less Repetition**: Post frequency tracking
5. **Smoother Experience**: Decay functions, reduced randomness
6. **Context-Aware**: Different strategies per click source

