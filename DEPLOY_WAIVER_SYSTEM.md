# Waiver System Deployment Guide

## Overview
This guide will help you deploy the complete waiver system to your database, which includes:
- Fantasy transactions table (for tracking adds/drops)
- Waiver system tables (for managing waivers)
- Drop player functionality
- Waiver claim functionality

## Prerequisites
- Access to your Supabase project
- Supabase CLI installed (recommended) OR psql installed

## Option 1: Using Supabase CLI (Recommended)

1. **Link your Supabase project** (if not already linked):
   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Push migrations to database**:
   ```bash
   supabase db push
   ```
   
   This will apply ALL new migrations in order, including:
   - `create_fantasy_transactions_table.sql`
   - `create_waiver_system.sql`
   - `add_waiver_columns_to_league_seasons.sql`
   - `waiver_system_functions.sql`
   - `fix_drop_player_null_handling.sql`
   - Other waiver-related migrations

## Option 2: Using the Deployment Script

1. **Run the deployment script**:
   ```bash
   ./deploy_waiver_system.sh
   ```

2. **Enter your credentials when prompted**:
   - Supabase project ref (e.g., `abcdefghijklmnop`)
   - Database password

## Option 3: Manual SQL Execution

If you prefer to manually execute the SQL files:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run these files IN ORDER:

```sql
-- 1. Create fantasy_transactions table
-- Copy contents from: supabase/migrations/create_fantasy_transactions_table.sql

-- 2. Create waiver system tables  
-- Copy contents from: supabase/migrations/create_waiver_system.sql

-- 3. Add waiver columns
-- Copy contents from: supabase/migrations/add_waiver_columns_to_league_seasons.sql

-- 4. Create waiver functions
-- Copy contents from: supabase/migrations/waiver_system_functions.sql

-- 5. Fix drop player function
-- Copy contents from: supabase/migrations/fix_drop_player_null_handling.sql

-- 6. Set default waiver settings
-- Copy contents from: supabase/migrations/set_default_waiver_settings.sql

-- 7. Apply waiver fixes
-- Copy contents from: supabase/migrations/apply_waiver_fixes.sql
```

## Verification

After deployment, verify the system is working:

### 1. Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('fantasy_transactions', 'fantasy_players_on_waivers', 'fantasy_waiver_claims', 'fantasy_waiver_order');
```

Expected result: All 4 tables should be listed.

### 2. Check drop_player Function Exists
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'drop_player';
```

Expected result: Function should be listed.

### 3. Test Drop Player Functionality

1. Log into your app
2. Navigate to a player on your roster
3. Click "Drop Player"
4. Confirm the drop
5. Check the console for logs:
   - 🔴 Drop Player button clicked!
   - 🎯 handleConfirmDrop called!
   - 📊 Drop player data
   - 🚀 Calling dropPlayerMutation...
   - ✅ Drop successful

### 4. Verify Transaction Was Created
```sql
SELECT * FROM fantasy_transactions 
ORDER BY created_at DESC 
LIMIT 10;
```

You should see a new 'cut' transaction for the dropped player.

### 5. Verify Player Is On Waivers
```sql
SELECT * FROM fantasy_players_on_waivers 
ORDER BY dropped_at DESC 
LIMIT 10;
```

You should see the dropped player with appropriate waiver status.

## Troubleshooting

### Issue: "relation fantasy_transactions does not exist"
**Solution**: Run the create_fantasy_transactions_table.sql migration first.

### Issue: "function drop_player does not exist"
**Solution**: Run the fix_drop_player_null_handling.sql migration.

### Issue: Drop button does nothing
**Solution**: 
1. Check browser console for errors
2. Verify logging shows button clicks
3. Check network tab for failed API calls
4. Verify user is authenticated
5. Check seasonId is being passed correctly

### Issue: "Permission denied for table fantasy_transactions"
**Solution**: The RLS policies should allow team owners to insert transactions. Verify:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'fantasy_transactions';
```

## What Happens When You Drop a Player?

1. **Player is removed from roster**: Deleted from `fantasy_roster_spots`
2. **Transaction is recorded**: 'cut' transaction added to `fantasy_transactions`
3. **Player goes to waivers**: Added to `fantasy_players_on_waivers` with:
   - Status: 'on_waivers' (or 'free_agent' if waiver_type = 'none')
   - Becomes free agent at: NOW() + waiver_period_hours
4. **Other teams can claim**: Players can submit waiver claims
5. **Waiver processes**: After waiver period, player becomes free agent

## Next Steps

After successful deployment:
1. ✅ Test dropping a player
2. ✅ Configure league waiver settings (in League Settings page)
3. ✅ Test waiver claims
4. ✅ Test free agent pickups
5. ✅ Review transaction history

## League Waiver Settings

Commissioners can configure these settings:

- **waiver_type**: 'none', 'rolling', 'faab', 'continuous'
- **waiver_period_hours**: How long dropped players stay on waivers (default: 48)
- **waiver_process_time**: Time of day when waivers process (default: 03:00)
- **waiver_claim_days**: Days when waivers process (default: Tue, Thu, Sat)

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all migrations have been applied
3. Check RLS policies are correctly configured
4. Review the Supabase logs for server-side errors

