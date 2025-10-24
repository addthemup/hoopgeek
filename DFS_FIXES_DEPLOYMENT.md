# DFS Fixes Deployment Guide

## Issues Fixed

1. **Missing `prize_won` column** - Frontend was looking for `prize_won` but database has `prize_amount`
2. **Missing `get_dfs_team_of_week` function** - Function wasn't deployed to database

## Errors Being Fixed

```
❌ column dfs_entries.prize_won does not exist
❌ POST .../rpc/get_dfs_team_of_week 404 (Not Found)
```

## Deployment Options

### Option 1: Using Deployment Script (Recommended)

```bash
# Set your database URL (get from Supabase dashboard > Project Settings > Database)
export SUPABASE_DB_URL='postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres'

# Run the deployment script
./deploy_dfs_fixes.sh
```

### Option 2: Using Supabase CLI

```bash
npx supabase db push
```

### Option 3: Using Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/fix_dfs_entries_and_team_of_week.sql`
4. Click "Run"

## What This Migration Does

### 1. Adds `prize_won` Column
- Adds a new column `prize_won` to `dfs_entries` table
- Syncs it with existing `prize_amount` values
- Creates a trigger to keep them in sync automatically

### 2. Creates `get_dfs_team_of_week()` Function
- Returns top 5 performing players from the current NBA week
- Uses FanDuel scoring: PTS + REB×1.2 + AST×1.5 + STL×3 + BLK×3 - TOV
- Requires `nba_boxscores` data and `nba_season_weeks` table

## Verification

After deployment, test in your browser console:

```javascript
// Test get_dfs_team_of_week function
const { data, error } = await supabase.rpc('get_dfs_team_of_week');
console.log('Team of Week:', data);

// Test dfs_entries with prize_won column
const { data: entries, error: entriesError } = await supabase
  .from('dfs_entries')
  .select('id, prize_won, prize_amount')
  .limit(5);
console.log('Entries:', entries);
```

## Troubleshooting

### If you get "column already exists" error
The migration is idempotent and safe to re-run. It uses `IF NOT EXISTS` checks.

### If team of week shows no data
Make sure you have:
- Boxscore data in `nba_boxscores` table
- Current week defined in `nba_season_weeks` table for season_year 2026

### If entries still show errors
Clear your browser cache and refresh the page.

## Files Changed

- ✅ `supabase/migrations/fix_dfs_entries_and_team_of_week.sql` - Main migration
- ✅ `deploy_dfs_fixes.sh` - Deployment script

