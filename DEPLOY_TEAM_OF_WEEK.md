# Deploy Team of the Week - Quick Fix

## 🚨 Issue
Getting 404 error when calling `get_dfs_team_of_week()` RPC function.

## ✅ Solution

### Step 1: Run the Updated SQL
Copy and paste the entire contents of `supabase/functions/get_dfs_team_of_week.sql` into your **Supabase SQL Editor** and run it.

The updated SQL file now:
- ✅ Drops the old function first (`DROP FUNCTION IF EXISTS`)
- ✅ Properly quotes the `"position"` reserved keyword
- ✅ Grants execute permissions to `anon`, `authenticated`, and `service_role`
- ✅ Includes verification messages

### Step 2: Verify the Function Exists

Run this in Supabase SQL Editor:
```sql
-- Check if function exists
SELECT proname, proargnames 
FROM pg_proc 
WHERE proname = 'get_dfs_team_of_week';

-- Test the function
SELECT * FROM get_dfs_team_of_week();
```

Expected output: 5 rows (2 Guards, 2 Forwards, 1 Center)

### Step 3: Test via API

You can also test via Supabase REST API:
```bash
curl "https://[YOUR-PROJECT].supabase.co/rest/v1/rpc/get_dfs_team_of_week" \
  -H "apikey: [YOUR-ANON-KEY]" \
  -H "Content-Type: application/json"
```

## 🎨 UI Updates

The frontend has been updated with:
- ✅ Proper NBA court SVG (vertical layout, 500x940)
- ✅ Real basketball court design with paint, 3-point lines, etc.
- ✅ Updated player positions for vertical court
- ✅ Better error handling

## 🔍 Troubleshooting

### Still getting 404?
1. Verify function exists: `SELECT * FROM pg_proc WHERE proname = 'get_dfs_team_of_week';`
2. Check permissions: `SELECT has_function_privilege('anon', 'get_dfs_team_of_week()', 'execute');`
3. Try refreshing your Supabase API schema cache in the dashboard

### Function returns empty?
- Check if `nba_boxscores` has data: `SELECT COUNT(*) FROM nba_boxscores;`
- Check if `weeks` table has current week: `SELECT * FROM weeks WHERE league_id = 0 ORDER BY start_date DESC;`
- Verify game dates match week ranges

### Position errors?
Make sure all references to `position` in your database are properly quoted as `"position"` since it's a PostgreSQL reserved keyword.

## 📊 What The Function Does

1. Gets current week from `weeks` table
2. Finds previous week's date range
3. Queries `nba_boxscores` for games in that period
4. Calculates FanDuel fantasy points per game
5. Averages fantasy points per player
6. Groups by position (G, F, C)
7. Returns top 2G, 2F, 1C

**Fantasy Points Formula (FanDuel):**
```
pts × 1.0
reb × 1.2
ast × 1.5
stl × 2.0
blk × 2.0
tov × -1.0
```

## 🎯 Current State

**Week Context:**
- Current Week: Week 1 (Oct 21-26, 2025)
- Team of Week Shows: Preseason (Oct 3-19, 2025)

Once deployed, the component will display the top performers from preseason games! 🏀

---

**Last Updated**: October 2025

