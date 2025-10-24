# 🚀 Deploy DFS Fixes - Quick Instructions

## The Problem
- ❌ `POST .../rpc/get_dfs_team_of_week 404 (Not Found)` - Function doesn't exist
- ❌ `column dfs_entries.prize_won does not exist` - Missing column

## The Solution - 3 Easy Steps

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `qbznyaimnrpibmahisue`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy & Paste
1. Open the file: `DEPLOY_DFS_FIXES_NOW.sql` (in this folder)
2. Copy the ENTIRE contents
3. Paste into the SQL Editor

### Step 3: Run It
1. Click the **RUN** button (or press Cmd/Ctrl + Enter)
2. Wait a few seconds
3. Look for success message at the bottom

## ✅ What This Does
- Adds `prize_won` column to `dfs_entries` table
- Creates `get_dfs_team_of_week()` function
- Tests the function at the end

## 🧪 Testing the Function

After deploying, you can test directly in SQL Editor:

```sql
-- Test 1: Check if function exists
SELECT * FROM get_dfs_team_of_week();

-- Test 2: Check nba_season_weeks data
SELECT * FROM nba_season_weeks 
WHERE season_year = 2026 
ORDER BY week_number;

-- Test 3: Check boxscore data exists
SELECT COUNT(*) as total_games, 
       MIN(game_date) as earliest, 
       MAX(game_date) as latest
FROM nba_boxscores;
```

## 🐛 Troubleshooting

### If you get: "relation nba_season_weeks does not exist"
You need to create the season weeks table. Let me know and I'll help.

### If you get: "no data returned"
This means there's no boxscore data for the current week. The function needs:
- Games in `nba_boxscores` table
- A current week defined in `nba_season_weeks` for season 2026

### If you get: "operator does not exist: integer = uuid"
This shouldn't happen with the new function. If it does, let me know the exact line.

## 📱 After Deployment

1. Go back to your DFS page
2. **Hard refresh** your browser (Cmd+Shift+R or Ctrl+Shift+R)
3. You should see:
   - ✅ Team of the Week displaying (if there's data)
   - ✅ Your Entries showing with player avatars
   - ✅ Prize winnings displaying correctly

## Need Help?

If errors persist after deployment, share the error message and we'll debug further!

