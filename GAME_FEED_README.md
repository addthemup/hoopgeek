# Game Highlights Feed - Implementation Guide

## Overview
A complete game highlights feed system with an algorithmic social media-style feed and detailed game pages, built with MUI Joy components.

## Files Created/Modified

### New Files:
1. **`src/pages/GamePage.tsx`** - Detailed game view with story analysis, stats, and video player
2. **`GAME_FEED_README.md`** - This documentation file

### Modified Files:
1. **`src/pages/Home.tsx`** - Converted to game feed with algorithm-based sorting
2. **`src/App.tsx`** - Added `/game/:id` route

## Expected JSON Structure

Your Python scripts (`fun.py`, `score.py`, `story.py`) should output JSON in this format:

```json
{
  "gameId": "0022400599",
  "date": "2024-01-15T00:00:00.000Z",
  "fun_score": 94.5,
  
  "story": {
    "matchup": "Los Angeles Lakers vs Boston Celtics",
    "final_score": "Lakers 118 - Celtics 115",
    "teams": {
      "winner": {
        "name": "Lakers",
        "city": "Los Angeles",
        "tricode": "LAL",
        "teamId": 1610612747,
        "points": 118
      },
      "loser": {
        "name": "Celtics",
        "city": "Boston",
        "tricode": "BOS",
        "teamId": 1610612738,
        "points": 115
      }
    },
    "advantages": [
      {
        "stat_name": "Points in Paint",
        "team": "Los Angeles",
        "teamId": 1610612747,
        "teamTricode": "LAL",
        "value1": 58,
        "value2": 42,
        "diff": 16
      }
    ]
  },
  
  "team_stats": {
    "Margin of Victory": 3,
    "Combined Threes": 28,
    "Team Threes": { "LAL": 15, "BOS": 13 },
    "Combined Three %": 38.5,
    "Team Three %": { "LAL": 41.7, "BOS": 35.1 },
    "Pace": 102.3,
    "Team Pace": { "LAL": 103.2, "BOS": 101.4 },
    "Combined Contested Shots": 87,
    "Team Contested Shots": { "LAL": 45, "BOS": 42 },
    "Combined Fast Break Points": 36,
    "Team Fast Break Points": { "LAL": 24, "BOS": 12 }
  },
  
  "lead_changes": {
    "total": 12,
    "last_5_minutes": 5,
    "last_minute": 2,
    "buzzer_beater": 1
  },
  
  "dunk_stats": {
    "Total Dunks": 15,
    "Alley Oop": 3,
    "Putback": 2,
    "Running": 4,
    "Driving": 5,
    "Tip": 1,
    "Cutting": 0
  },
  
  "deep_shots": {
    "deep_threes": 8,
    "four_pointers": 2
  },
  
  "scoring_milestones": {
    "70 Ball": [],
    "60 Ball": [],
    "50 Ball": [],
    "40 Ball": [["LeBron James", 42], ["Jayson Tatum", 38]],
    "Triple Double": [["LeBron James", "PTS: 42, REB: 11, AST: 10, BLK: 1, STL: 2"]]
  },
  
  "video_url": "https://example.com/video.mp4",
  "thumbnail_url": "https://example.com/thumbnail.jpg",
  "views": 15420,
  "likes": 342,
  
  "gameMetadata": {
    "date": "2024-01-15",
    "arena": "Crypto.com Arena",
    "season": "2024-25"
  }
}
```

## Feed Algorithm

The home page feed uses a sophisticated ranking algorithm:

### Priority Factors:
1. **Fun Score (70% weight)** - Primary ranking factor
2. **Recency (30% weight)** - Exponential decay with slow rate (0.05)
3. **Random Boost (15% max)** - For games older than 30 days

### Formula:
```typescript
feedScore = (fun_score/100 * 0.7) + (e^(-0.05 * daysAgo) * 0.3) + randomBoost
```

This ensures:
- High fun score games always rank well
- Recent games get priority
- Old exciting games can randomly surface
- Maintains social media-like discovery

## Features

### Home Page Feed (`/`)
- **Responsive Grid**: 3 columns (desktop), 2 columns (tablet), 1 column (mobile)
- **Game Cards** with:
  - Thumbnail/video preview
  - Fun score badge (color-coded by score)
  - Final score overlay
  - Highlight chips (buzzer beaters, lead changes, dunks, four-pointers)
  - Play button on hover
  - Date label, team codes, views, and likes
- **Algorithmic Sorting**: Automatically ranks games using feed score

### Game Page (`/game/:gameId`)
- **Video Player**: Embedded video with poster image
- **Score Header**: Final score with fun score badge
- **Story Section**: "How [Team] Won" with top 5 statistical advantages
- **Game Excitement**: Lead changes, dunks, deep threes metrics
- **Dunk Breakdown**: Categories of dunks (Alley Oop, Putback, etc.)
- **Player Milestones**: 40/50/60/70 point games, triple doubles
- **Team Statistics**: Side-by-side comparison of key team stats
- **Game Information**: Date, arena, season, game ID

## Integration Steps

### 1. Backend API Setup

Create an endpoint to serve game JSON files:

```typescript
// Example API endpoint structure
GET /api/games          // List all games (for feed)
GET /api/games/:gameId  // Get specific game details
```

### 2. Update Home.tsx

Replace the mock data fetch in `useEffect`:

```typescript
useEffect(() => {
  const fetchGames = async () => {
    try {
      const response = await fetch('/api/games')
      const data = await response.json()
      setGames(data)
    } catch (error) {
      console.error('Error fetching games:', error)
    }
  }
  fetchGames()
}, [])
```

### 3. Update GamePage.tsx

Replace the mock data fetch:

```typescript
useEffect(() => {
  const fetchGameData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/games/${id}`)
      const data = await response.json()
      setGameData(data)
    } catch (error) {
      console.error('Error fetching game:', error)
    } finally {
      setLoading(false)
    }
  }
  
  if (id) {
    fetchGameData()
  }
}, [id])
```

### 4. Python Script Integration

Ensure your Python scripts output matches the JSON structure above:

**Concatenate.py should combine:**
- `score.py` output → `fun_score`, `lead_changes`, `dunk_stats`, `deep_shots`, `scoring_milestones`
- `story.py` output → `story` object with advantages
- Game metadata → `gameMetadata`, `team_stats`
- Media URLs → `video_url`, `thumbnail_url`

### 5. File Storage

Store generated JSON files in a structure like:
```
/games/
  ├── 0022400599/
  │   ├── 0022400599.json
  │   ├── video.mp4
  │   └── thumbnail.jpg
  ├── 0022400600/
  │   ├── 0022400600.json
  │   ├── video.mp4
  │   └── thumbnail.jpg
```

## UI Component Details

### Fun Score Color Coding
- 🔴 Red (95+): Danger color - Instant classic
- 🟠 Orange (85-94): Warning color - Very exciting
- 🟢 Green (75-84): Success color - Great game
- 🔵 Blue (< 75): Primary color - Good game

### Highlight Chips (Auto-shown when):
- **Buzzer Beater**: `lead_changes.buzzer_beater > 0`
- **Lead Changes**: `lead_changes.total >= 10`
- **Dunks**: `dunk_stats['Total Dunks'] >= 15`
- **Four-Pointer**: `deep_shots.four_pointers > 0`

### Milestone Display Priority
1. 70-point games (Red, solid)
2. 60-point games (Orange, solid)
3. 50-point games (Orange, soft)
4. 40-point games (Blue, soft)
5. Triple doubles (Green, soft)

## Testing

1. Visit `http://localhost:3000/` to see the feed
2. Click any game card to view details
3. Use browser dev tools to test responsive layouts
4. Verify algorithm by checking console logs of feed scores

## Next Steps

1. **Backend Integration**: Set up API endpoints to serve JSON files
2. **Video Processing**: Ensure video files are properly encoded for web
3. **Thumbnail Generation**: Auto-generate thumbnails from videos
4. **Views/Likes**: Implement tracking system for user engagement
5. **Infinite Scroll**: Add pagination for large game collections
6. **Filters**: Add date range, team, fun score filters
7. **Search**: Add game/team search functionality

## Notes

- Mock data is currently used for development
- All components are responsive and mobile-friendly
- MUI Joy components provide consistent theming
- TypeScript interfaces ensure type safety
- Algorithm can be tuned by adjusting weights in `calculateFeedScore()`

## Questions?

The feed algorithm prioritizes fun score heavily (70%) while still keeping recent games relevant. Games from 90+ days ago can randomly appear early in the feed due to the random boost, creating discovery moments like social media platforms.

