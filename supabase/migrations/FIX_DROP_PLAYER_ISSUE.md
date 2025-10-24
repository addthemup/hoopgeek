# Fix for Drop Player Issue

## Problem
Players cannot be dropped from the Players page because:
1. Leagues created before the waiver system migration have NULL waiver settings
2. The `drop_player` function doesn't handle NULL values gracefully
3. When `waiver_period_hours` is NULL, the INTERVAL calculation fails

## Solution
We've created two SQL migrations to fix this:

### 1. Set Default Waiver Settings (`set_default_waiver_settings.sql`)
This migration updates all existing leagues to have default waiver settings if they're NULL.

**Defaults:**
- `waiver_type`: 'rolling'
- `waiver_period_hours`: 48 hours
- `waiver_budget_amount`: 100 (for FAAB)
- `waiver_min_bid`: 0
- `waiver_priority_reset`: 'after_claim'
- `waiver_process_time`: '03:00:00' (3 AM)

### 2. Fix drop_player Function (`fix_drop_player_null_handling.sql`)
This migration updates the `drop_player` function to use COALESCE to handle NULL values gracefully, ensuring it always has valid default values to work with.

## How to Apply

### Step 1: Apply the SQL migrations in order

```bash
# From your project root
cd supabase/migrations

# 1. Set default waiver settings for existing leagues
psql YOUR_DATABASE_URL -f set_default_waiver_settings.sql

# 2. Update the drop_player function to handle NULLs
psql YOUR_DATABASE_URL -f fix_drop_player_null_handling.sql
```

### Step 2: Verify the fix

Run this query to verify all seasons have waiver settings:

```sql
SELECT 
    id,
    league_id,
    waiver_type,
    waiver_period_hours,
    waiver_budget_amount
FROM fantasy_league_seasons
ORDER BY created_at DESC
LIMIT 10;
```

All rows should have non-NULL values for waiver settings.

### Step 3: Test dropping a player

1. Go to the Players page in your league
2. Find a player on your roster
3. Click the "Drop" button
4. Confirm the drop
5. Check the Recent Transactions on the League Home page

## What Changed

### LeagueHome.tsx
- **Recent Transactions** now shows adds/cuts from `fantasy_transactions` table instead of draft trades
- Displays proper transaction type (Added/Dropped) with player details
- Shows transaction time and team information

### Database Function (drop_player)
- Now uses `COALESCE()` to provide default values if waiver settings are NULL
- `waiver_type` defaults to 'rolling'
- `waiver_period_hours` defaults to 48
- Will never fail due to NULL interval calculations

## Expected Behavior After Fix

1. **Dropping players works** - No more errors when dropping players
2. **Players go to waivers** - Based on league settings (rolling waivers by default, 48 hour period)
3. **Transactions appear** - In the League Home "Recent Transactions" section
4. **Players disappear** - From the Players page (free agents list) when added
5. **Players reappear** - In the Players page when dropped (with waiver status chip)

## Troubleshooting

If drops still don't work:

1. **Check browser console** for error messages
2. **Verify season_id** is being passed correctly (check `useDropPlayer.ts` logs)
3. **Check RLS policies** on `fantasy_roster_spots`, `fantasy_transactions`, and `fantasy_players_on_waivers`
4. **Verify user authentication** (user.id should exist)

Run this query to check if the function exists:

```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'drop_player';
```

## Need More Help?

If issues persist, check:
- Supabase logs for function errors
- Browser network tab for RPC call responses
- Database logs for transaction failures

