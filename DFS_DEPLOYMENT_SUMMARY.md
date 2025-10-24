# DFS Team of the Week - Deployment Summary

## ✅ What This Does

Returns the top 5 performing players from the **PREVIOUS** week based on fantasy points.

### Example (Today: Oct 22, 2025):
- **Current Week**: Week 1 (Oct 21-26)
- **Previous Week**: Week 0 "Preseason" (Oct 3-19)  
- **Returns**: Top 5 players from Oct 3-19

## 📊 How It Works

1. **Finds Current Week**: Looks up today's date in `nba_season_weeks` for season 2026
2. **Gets Previous Week**: Finds `week_number - 1` from the same table
3. **Calculates Fantasy Points**: Uses FanDuel scoring:
   - Points: 1.0
   - Rebounds: 1.2
   - Assists: 1.5
   - Steals: 3.0
   - Blocks: 3.0
   - Turnovers: -1.0
4. **Returns Top 5**: Sorted by average fantasy points

## 🎯 Variable Week Support

✅ Handles weeks of any length (not just 7 days):
- Preseason: 17 days (Oct 3-19)
- Week 1: 6 days (Oct 21-26)
- Week 2: 7 days (Oct 27-Nov 2)
- etc.

## 🚀 Deployment

**File**: `DEPLOY_DFS_TEAM_OF_WEEK_DYNAMIC.sql`

Copy and paste into Supabase SQL Editor and run.

## 🧪 Testing

After deployment, the script automatically runs:

1. **Main function test**: `SELECT * FROM get_dfs_team_of_week();`
2. **Debug query**: Shows current/previous week info

### Expected Results (Oct 22, 2025):

```
today: 2025-10-22
current_week: Week 1
current_week_start: 2025-10-21
current_week_end: 2025-10-26
previous_week: Preseason
previous_week_start: 2025-10-03
previous_week_end: 2025-10-19
```

Top 5 players from Preseason (Oct 3-19).

## 📝 Database Requirements

- ✅ `nba_season_weeks` table with season_year 2026 data
- ✅ `nba_boxscores` table with game data
- ✅ `nba_players` table
- ✅ `nba_hoopshype_salaries` table (optional, fallback to min salary)

## 🔄 Frontend Integration

Your frontend calls:
```javascript
const { data, error } = await supabase.rpc('get_dfs_team_of_week');
```

Returns array of 5 players with:
- player_id (UUID)
- nba_player_id (INTEGER)
- player_name (TEXT)
- team (VARCHAR)
- player_position (VARCHAR)
- jersey_number (TEXT)
- salary (BIGINT)
- avg_fantasy_points (DECIMAL)
- total_fantasy_points (DECIMAL)
- games_played (INTEGER)

## ⚠️ Edge Cases

- **Week 0 (Preseason)**: Returns empty if no previous week exists
- **No games in previous week**: Returns empty array
- **Season not started**: Returns empty array

## 🎨 Bonus: Prize Won Column

This deployment also adds:
- `prize_won` column to `dfs_entries` table
- Auto-sync trigger to keep it in sync with `prize_amount`
- Fixes frontend "column does not exist" errors

