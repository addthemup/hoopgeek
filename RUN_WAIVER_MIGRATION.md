# Add Waiver Columns to Database

## Problem
The `create-league` Edge Function is trying to insert waiver settings into columns that don't exist yet in the `fantasy_league_seasons` table.

## Solution
Run the SQL migration to add the missing columns.

## Steps

### Option 1: Supabase Dashboard (Recommended)

1. Open https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Open the file: `/Users/adam/Desktop/hoopgeek/supabase/migrations/add_waiver_columns_to_league_seasons.sql`
6. Copy the entire contents
7. Paste into the SQL Editor
8. Click **Run** (or press Cmd/Ctrl + Enter)
9. Verify you see output showing the columns were added

### Option 2: Supabase CLI (if available)

```bash
cd /Users/adam/Desktop/hoopgeek
supabase db push
```

## What This Migration Does

Adds the following columns to `fantasy_league_seasons`:

- **waiver_type**: Type of waiver system (none, rolling, faab, continuous)
- **waiver_period_hours**: Hours a player stays on waivers (0-168)
- **faab_budget**: FAAB budget per team (null if not using FAAB)
- **waiver_processing_day**: Day of week waivers process (0-6, default 3=Wednesday)
- **waiver_processing_time**: Time of day waivers process (default 03:00:00)
- **waiver_order_reset_type**: How waiver order resets (never, weekly_inverse_standings, continual_rolling)
- **waiver_order_tie_breaker**: How to break ties (points_scored, points_against, random)

All columns have sensible defaults, and existing leagues will be updated with default values.

## After Running

Once the migration completes successfully:

1. Go back to your app
2. Try creating a league again
3. The waiver settings should now save properly!

## Verification Query

After running the migration, you can verify the columns exist:

```sql
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'fantasy_league_seasons' 
AND column_name IN (
    'waiver_type', 
    'waiver_period_hours', 
    'faab_budget',
    'waiver_processing_day',
    'waiver_processing_time',
    'waiver_order_reset_type',
    'waiver_order_tie_breaker'
)
ORDER BY column_name;
```

You should see 7 rows returned.

