# Watch History Tracking System

## Overview
A lightweight, performant system for tracking time spent watching content per team and player. This data powers personalized home pages and user profile insights.

## Architecture

### Database Schema
**Table: `user_watch_history`**
- Tracks watch time per team/player at the slide level
- Batches updates (updates existing records within 1 minute)
- Indexed for fast aggregation queries

**Key Fields:**
- `user_id` - User who watched
- `post_id` - Post being watched
- `slide_index` - Which slide in the post
- `team_tricode` - Team abbreviation (e.g., 'LAL')
- `player_id` - NBA player personId
- `watch_seconds` - Total time spent
- `video_watch_seconds` - Time spent watching videos

### React Hook: `useWatchHistoryTracking`
**Location:** `src/hooks/useWatchHistoryTracking.ts`

**Features:**
- ✅ Lightweight React state tracking (no performance impact)
- ✅ Batched database updates (every 5 seconds or on slide change)
- ✅ Automatic team/player extraction from posts and slides
- ✅ Handles video time tracking separately
- ✅ Flushes on unmount and before page unload

**Usage:**
```typescript
const { startTracking, stopTracking, updateVideoTime } = useWatchHistoryTracking()

// Start tracking when slide changes
startTracking(postId, slideIndex, slide, post)

// Update video time as video plays
updateVideoTime(seconds)

// Stop tracking when leaving slide
stopTracking()
```

## Performance Considerations

### Why It's Performant:
1. **Local State Tracking**: Time is tracked in React state, not constantly hitting the database
2. **Batched Updates**: Updates are batched every 5 seconds or on slide change
3. **Upsert Logic**: Database function updates existing records within 1 minute (prevents duplicates)
4. **Debounced Flushes**: 2-second debounce before flushing to batch multiple updates
5. **Minimal Overhead**: Only tracks when user is actively viewing (isCurrentlyViewing = true)

### Database Functions:
- `upsert_watch_history()` - Upserts watch history with batching
- `get_user_watch_summary()` - Gets aggregated watch history
- `get_user_top_teams()` - Gets top teams by watch time
- `get_user_top_players()` - Gets top players by watch time

## Integration

### Already Integrated:
- ✅ `src/pages/Highlights.tsx` - Automatically tracks when users watch slides

### How It Works:
1. When a slide is viewed, `startTracking()` is called with the slide and post data
2. The hook extracts team/player info from:
   - Post `team_tricodes` and `player_ids` arrays
   - Slide `metadata.personId` and `metadata.teamTricode`
   - Chart slides (e.g., `top_fantasy_scorers` extracts from `players` array)
3. Time is tracked locally in React state
4. Every 5 seconds, or when slide changes, updates are batched and flushed to database
5. Database upserts prevent duplicate entries

## Data Extraction

The system automatically extracts team/player info from:
- **Post level**: `post.team_tricodes[]`, `post.player_ids[]`, `post.person_id`
- **Slide level**: `slide.metadata.teamTricode`, `slide.metadata.personId`
- **Chart slides**: Extracts from `slide.players[]` array (for top_fantasy_scorers, etc.)

## Future Use Cases

### User Profile Page:
```typescript
// Get top teams
const { data: topTeams } = await supabase.rpc('get_user_top_teams', {
  p_user_id: userId,
  p_limit: 10,
  p_days_back: 30
})

// Get top players
const { data: topPlayers } = await supabase.rpc('get_user_top_players', {
  p_user_id: userId,
  p_limit: 10,
  p_days_back: 30
})
```

### Personalized Home Page:
- Show more content from user's most-watched teams/players
- Prioritize posts featuring favorite teams/players
- Show "Continue watching" for teams/players with recent activity

## Migration

Run the migration to create the table and functions:
```bash
# Migration file: supabase/migrations/20250131000001_create_user_watch_history.sql
```

## Notes

- Currently tracks first team/player per slide (can be expanded to track all)
- Watch time is rounded to seconds
- Video time is tracked separately from total watch time
- System handles missing team/player data gracefully (skips tracking if none found)

