# Team of the Week - Implementation Guide

## 🎯 Overview

The **Team of the Week** feature displays the top 5 performing NBA players from the previous week based on fantasy points scoring. This creates a dynamic showcase of the best recent performances.

## 📊 How It Works

### Data Flow
1. **Week Detection**: System identifies the current week from the `weeks` table
2. **Previous Week Query**: Fetches the immediately preceding week (e.g., if we're in Week 1, it shows Preseason data)
3. **Stats Calculation**: Pulls player stats from `nba_boxscores` for that week's games
4. **Fantasy Scoring**: Calculates FanDuel fantasy points for each game
5. **Aggregation**: Averages fantasy points per player across all games played
6. **Position Ranking**: Ranks players within their position groups (G, F, C)
7. **Top 5 Selection**: Returns top 2 Guards, top 2 Forwards, and top 1 Center

### Fantasy Scoring Formula (FanDuel)

```sql
Points:    1.0 × pts
Rebounds:  1.2 × reb
Assists:   1.5 × ast
Steals:    2.0 × stl
Blocks:    2.0 × blk
Turnovers: -1.0 × tov
```

### Position Mapping

The function intelligently maps various position labels to three categories:

- **Guards (G)**: PG, SG, G, or any position containing 'G'
- **Forwards (F)**: SF, PF, F, or any position containing 'F' (but not G)
- **Centers (C)**: C, or any position containing 'C'

## 🗄️ Database Structure

### Function: `get_dfs_team_of_week()`

**Location**: `supabase/functions/get_dfs_team_of_week.sql`

**Returns**:
```typescript
{
  player_id: uuid | null,
  nba_player_id: integer,
  player_name: text,
  team: text,
  position: text,
  jersey_number: text,
  salary: bigint,
  avg_fantasy_points: numeric,
  games_played: bigint
}[]
```

**Key Logic**:
1. Queries `weeks` table to find current and previous weeks
2. Joins with `nba_boxscores` for game statistics
3. LEFT JOIN with `players` table to get salary information
4. Calculates fantasy points using FanDuel scoring
5. Groups and ranks by position
6. Returns exactly 5 players (2G, 2F, 1C)

## 🎨 Frontend Component

### Component: `TeamOfTheWeek.tsx`

**Location**: `src/components/DFS/TeamOfTheWeek.tsx`

**Features**:
- ✅ Basketball court visualization
- ✅ Player jerseys with team colors
- ✅ Fantasy points display
- ✅ Real NBA salaries
- ✅ Games played count
- ✅ Loading, error, and empty states
- ✅ 5-minute cache for performance

**Layout**: Now positioned in the right sidebar of the DFS page

## 📦 Data Requirements

### Required Tables

1. **`weeks`**: Tracks NBA season weeks
   - `start_date`, `end_date`
   - `season_year`, `week_number`
   - `league_id` (0 for global weeks)

2. **`nba_boxscores`**: Player game statistics
   - `nba_player_id`, `player_name`
   - `game_date`, `team_abbreviation`
   - Stats: `pts`, `reb`, `ast`, `stl`, `blk`, `tov`
   - `min` (minutes played)
   - `position`, `jersey_num`

3. **`players`**: Player roster information
   - `nba_player_id`
   - `salary` (real NBA salary)

### Sample Data Format

**nba_boxscores** row:
```json
{
  "nba_player_id": 1630200,
  "player_name": "T. Jones",
  "game_date": "2025-10-16",
  "team_abbreviation": "CHI",
  "position": "G",
  "jersey_num": null,
  "pts": 8,
  "reb": 5,
  "ast": 4,
  "stl": 4,
  "blk": 0,
  "tov": 1,
  "min": 23.0
}
```

**weeks** row:
```json
{
  "season_year": 2026,
  "week_number": 0,
  "week_name": "Preseason",
  "start_date": "2025-10-03",
  "end_date": "2025-10-19",
  "league_id": 0
}
```

## 🚀 Deployment

### Deploy the Database Function

```bash
./deploy_team_of_week.sh
```

Or manually:
```bash
psql "$SUPABASE_DB_URL" -f supabase/functions/get_dfs_team_of_week.sql
```

### Test the Function

```sql
-- Test in Supabase SQL Editor
SELECT * FROM get_dfs_team_of_week();
```

Expected output: 5 rows (2 Guards, 2 Forwards, 1 Center)

## 🧪 Testing Scenarios

### Scenario 1: Week 1 of Regular Season
- **Current Week**: Week 1 (Oct 21-26, 2025)
- **Team of Week Shows**: Preseason data (Oct 3-19, 2025)

### Scenario 2: Week 5 of Regular Season
- **Current Week**: Week 5
- **Team of Week Shows**: Week 4 data

### Scenario 3: No Previous Week Available
- **Fallback**: Shows players from last 7 days

### Scenario 4: No Games Played Yet
- **UI**: Shows "No games played yet" message

## 🎯 Current State

### ✅ Completed
- [x] Created SQL function with FanDuel scoring
- [x] Implemented position grouping and ranking
- [x] Added week detection logic
- [x] Updated TeamOfTheWeek component
- [x] Added error handling and loading states
- [x] Moved to right sidebar in DFS page
- [x] Created deployment script

### 🔄 Integration Points

The function integrates with:
- `fantasyScoring.ts` - Mirrors the FanDuel scoring formula
- `weeks` table - For week boundaries
- `nba_boxscores` - For player statistics
- `players` table - For salary data

## 📈 Performance Considerations

- **Caching**: Frontend caches results for 5 minutes
- **Indexing**: Ensure `nba_boxscores.game_date` is indexed
- **Filtering**: Only includes players with `min > 0` (actually played)
- **Minimum Games**: Requires at least 1 game played to appear

## 🔮 Future Enhancements

Potential improvements:
1. **Multiple Scoring Formats**: Allow switching between FanDuel, DraftKings, etc.
2. **Historical Teams**: View Team of the Week from past weeks
3. **Click-through**: Navigate to player detail pages
4. **Share Feature**: Share Team of the Week on social media
5. **Comparison**: Show improvement/decline from previous week
6. **Awards**: Track how many times a player appears in Team of the Week

## 📝 Notes

- Function automatically handles edge cases (no weeks, no games, etc.)
- Uses FanDuel scoring by default (matches main DFS scoring)
- Salary comes from real NBA contracts stored in `players` table
- Position mapping is flexible to handle various position labels
- Returns NULL for `player_id` since boxscores use `nba_player_id`

## 🆘 Troubleshooting

### "Unable to load Team of the Week"
- Check if function exists: `SELECT * FROM pg_proc WHERE proname = 'get_dfs_team_of_week'`
- Verify permissions: Function should be executable by `authenticated` and `anon`

### Empty Results
- Verify `weeks` table has data for current season
- Check `nba_boxscores` has recent game data
- Ensure game dates fall within week boundaries

### Incorrect Fantasy Points
- Verify boxscore stats are not NULL (function uses COALESCE)
- Double-check scoring formula matches FanDuel (pts×1, reb×1.2, etc.)

---

**Created**: October 2025
**Last Updated**: October 2025
**Status**: ✅ Production Ready

