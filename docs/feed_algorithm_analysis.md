# Feed Algorithm Current State Analysis

## Current Weight Multipliers

### 1. **Unviewed Posts** 
- **Weight**: `2.0x` (strongest factor)
- **Issue**: This is good, but it's binary - either viewed or not. No consideration for partial views or time spent.

### 2. **Recency**
- **≤3 days**: `1.5x`
- **≤7 days**: `1.2x`
- **Issue**: Very basic. No consideration for:
  - Time of day (morning vs evening)
  - Day of week (weekend games might be more important)
  - Same-day games (should be highest priority)

### 3. **Post Quality**
- **Fun Score >8.5**: `1.8x`
- **Fun Score >7.0**: `1.3x`
- **Fantasy Points >50**: `1.8x`
- **Fantasy Points >40**: `1.3x`
- **Issue**: Hard thresholds, no gradient. A 8.6 vs 8.4 gets same treatment.

### 4. **Favorite Players** 
- **Weight**: `1.3x` (only if logged in)
- **Issue**: 
  - Same weight regardless of how many favorites match
  - No consideration for favorite player's role/importance in the post
  - Doesn't check if user has multiple favorites in the same post

### 5. **Favorite Teams**
- **Weight**: `1.2x` (only if logged in)
- **Issue**: Same as favorite players - too simplistic

### 6. **Avatar Click Boosts**
- **Boosted Teams**: `3.0x` (when avatar clicked)
- **Boosted Players**: `2.5x` (when player avatar clicked)
- **Issue**: 
  - Very strong, but no decay over time
  - No consideration for how many times user has clicked this team/player
  - Should probably decay after showing X posts from that team/player

### 7. **Shared Post Context**
- **Shared Post Players**: `1.4x`
- **Shared Post Teams**: `1.3x`
- **Issue**: Only applies when coming from share link, but should persist in session

### 8. **DFS Pool Context** (Not Implemented)
- **DFS Players**: `1.6x` (if user had player in DFS on game date)
- **DFS Teams**: `1.4x` (if user had team in DFS on game date)
- **Issue**: 
  - Not actually being passed in from Highlights.tsx
  - Should be date-specific (only boost if user had them on THAT game's date)
  - Should consider DFS performance (did they win/lose with this player?)

### 9. **Click Source** (Barely Used)
- **'avatar' + recent (≤1 day)**: `1.3x`
- **Issue**: 
  - Only applies to avatar clicks
  - No different behavior for 'player_page', 'share', 'search', 'home'
  - Should have different strategies per source

### 10. **Randomness**
- **Variation**: `±20%` (0.8x to 1.2x)
- **Issue**: Too much randomness can hurt user experience

## CRITICAL PROBLEM: Weights Aren't Actually Used!

The `calculatePostWeight` function is defined but **NOT USED** in the main algorithm when `strictRatio = true` (which is the default). 

The algorithm currently:
1. Separates posts by type
2. Sorts deterministically by quality/recency
3. Interleaves in 2:1 ratio

**The weights are only used when `strictRatio = false`**, which is never set to false in Highlights.tsx!

## Missing Variables

1. **Engagement Metrics**: likes_count, comments_count, shares_count, views_count
2. **User Engagement History**: Has user liked/commented on similar posts?
3. **Post Frequency**: How many times has this post been shown to user?
4. **Time Spent**: How long did user view this post?
5. **Completion Rate**: Did user watch all slides?
6. **Time of Day**: Morning vs evening preferences
7. **Day of Week**: Weekend games might be more important
8. **Same-Day Games**: Games from today should be highest priority
9. **Multiple Favorites**: Posts with multiple favorite players/teams should get extra boost
10. **DFS Performance**: Did user win/lose with this player? How much did they score?
11. **Team Matchups**: Rivalry games, playoff implications
12. **Player Milestones**: Career highs, records broken
13. **Post Age**: How long has this post been published?
14. **User Behavior Patterns**: Does user prefer fun_score or player_spotlight?

## Recommendations

1. **Actually use the weights** in the main algorithm
2. **Add additive bonuses** instead of just multiplicative (prevents extreme values)
3. **Implement gradient scoring** instead of hard thresholds
4. **Add engagement metrics** to weights
5. **Implement DFS context** properly
6. **Add time-based considerations** (same-day, time of day)
7. **Add decay functions** for avatar clicks (don't show 20 posts from same team)
8. **Track post frequency** (don't show same post too many times)
9. **Consider multiple favorites** (posts with 2+ favorites get extra boost)
10. **Different strategies per click source**

