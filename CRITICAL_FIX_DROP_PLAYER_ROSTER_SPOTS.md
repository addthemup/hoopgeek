# 🚨 CRITICAL FIX: Drop Player Roster Spot Bug

## The Problem

**CRITICAL BUG DISCOVERED**: When dropping a player, the `drop_player()` function was **DELETING** the roster spot entirely, permanently removing roster positions from teams.

### What Was Happening:
```sql
-- ❌ WRONG - This deletes the roster spot permanently
DELETE FROM fantasy_roster_spots
WHERE fantasy_team_id = fantasy_team_id_param 
AND player_id = player_id_param;
```

This caused teams to **lose roster spots permanently** every time they dropped a player!

## The Fix

Changed from **DELETE** to **UPDATE** to clear the player but preserve the spot:

```sql
-- ✅ CORRECT - This clears the player but keeps the roster spot
UPDATE fantasy_roster_spots
SET 
    player_id = NULL,
    updated_at = NOW()
WHERE fantasy_team_id = fantasy_team_id_param 
AND player_id = player_id_param;
```

## Files Fixed

1. ✅ `fix_drop_player_roster_spot_bug.sql` - The corrected function (deploy this!)
2. ✅ `deploy_waiver_system_all_in_one.sql` - Updated main deployment file
3. ✅ `supabase/migrations/fix_drop_player_null_handling.sql` - Updated migration

## Immediate Action Required

### Step 1: Apply the Fix

**Run this in Supabase SQL Editor immediately:**

```bash
# Copy and paste the contents of:
fix_drop_player_roster_spot_bug.sql
```

Or manually:

1. Open Supabase Dashboard → SQL Editor
2. Copy the entire contents of `fix_drop_player_roster_spot_bug.sql`
3. Paste and click **Run**

### Step 2: Check for Damage

**Run the diagnostic script to see if roster spots were deleted:**

```bash
# In Supabase SQL Editor, run:
restore_deleted_roster_spots.sql
```

This will show:
- Which teams are missing roster spots
- How many spots each team should have vs. actually has
- Recent drop transactions

### Step 3: Restore Missing Spots (if needed)

If teams are missing roster spots, you'll need to restore them manually.

**Check the output from Step 2**, then for each missing spot:

```sql
INSERT INTO fantasy_roster_spots (
    fantasy_team_id,
    position,
    player_id,
    created_at,
    updated_at
) VALUES (
    'TEAM_ID_FROM_DIAGNOSTIC',
    'POSITION_THAT_IS_MISSING',  -- e.g., 'PG', 'SG', 'SF', 'PF', 'C', 'BENCH'
    NULL,                         -- No player assigned
    NOW(),
    NOW()
);
```

## How to Identify Which Positions Are Missing

### Option 1: Check Recent Drops

```sql
-- See what was recently dropped
SELECT 
    ft.team_name,
    np.name as player_name,
    np.position,
    frs_before.position as roster_position_before_drop,
    trans.transaction_date
FROM fantasy_transactions trans
JOIN fantasy_teams ft ON trans.fantasy_team_id = ft.id
JOIN nba_players np ON trans.player_id = np.id
LEFT JOIN fantasy_roster_spots frs_before ON frs_before.fantasy_team_id = ft.id 
    AND frs_before.player_id = np.id
WHERE trans.transaction_type = 'cut'
AND trans.transaction_date > NOW() - INTERVAL '2 hours'
ORDER BY trans.transaction_date DESC;
```

### Option 2: Compare with League Settings

```sql
-- See what each team SHOULD have
SELECT 
    ft.team_name,
    ft.id as team_id,
    fls.roster_positions as expected_positions,
    (SELECT jsonb_object_agg(position, COUNT(*))
     FROM fantasy_roster_spots
     WHERE fantasy_team_id = ft.id
     GROUP BY position
    ) as actual_positions
FROM fantasy_teams ft
JOIN fantasy_league_seasons fls ON ft.season_id = fls.id
WHERE ft.is_active = true;
```

## Prevention

The fix has been applied to all relevant files:
- ✅ Main deployment script
- ✅ Migration files
- ✅ Standalone fix script

**Future drops will now properly:**
1. Clear `player_id` from the roster spot (set to NULL)
2. Keep the roster spot intact
3. Allow new players to fill the empty spot

## Testing the Fix

After applying the fix:

1. **Drop a player** from any team
2. **Check the database:**
   ```sql
   SELECT * FROM fantasy_roster_spots 
   WHERE fantasy_team_id = 'YOUR_TEAM_ID'
   ORDER BY position;
   ```
3. **Verify:**
   - Same number of roster spots as before
   - One spot now has `player_id = NULL`
   - Spot's `position` is preserved

## Summary of Changes

### Before (Bug):
- Drop player → DELETE roster spot
- Result: Team permanently loses a roster position
- Each drop reduces total roster size

### After (Fixed):
- Drop player → UPDATE roster spot (set player_id = NULL)
- Result: Roster spot preserved, just empty
- Team maintains full roster size

## Impact Assessment

**Severity**: 🔴 **CRITICAL**

**Affected Operations**:
- ✅ All player drops through UI
- ✅ Any code calling `drop_player()` function
- ✅ Waiver system drop operations

**Data Loss**:
- Roster spots deleted during testing phase
- Need to restore missing spots manually

## Rollout Checklist

- [x] Fix created
- [x] All files updated
- [ ] Fix deployed to database
- [ ] Damage assessed (run diagnostic)
- [ ] Missing spots restored
- [ ] Fix verified with test drop
- [ ] Documentation updated

## Support

If you need help:
1. Run `restore_deleted_roster_spots.sql` to see damage
2. Check console logs when dropping players
3. Verify the fix was applied: `SELECT prosrc FROM pg_proc WHERE proname = 'drop_player'` should show UPDATE not DELETE

