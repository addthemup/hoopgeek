# Fix Roster Spots Issue - Action Plan

## 🐛 The Problem
- Started with 15 roster spots
- Made 7 draft picks
- Now have 22 roster spots (15 + 7 extra)
- **Each draft pick is adding 1 new roster spot instead of updating existing ones**

---

## 🔍 Step 1: Diagnose What's Actually Happening

Run this diagnostic query in your Supabase SQL Editor:

```bash
cd /Users/adam/Desktop/hoopgeek
psql $DATABASE_URL -f diagnose_roster_issue.sql
```

This will show you:
1. The actual `make_draft_pick` function in your database (might be different from file)
2. Any triggers on `fantasy_roster_spots` or `fantasy_draft_picks`
3. Roster spot counts for all teams
4. Timeline of when roster spots were created

**Look for:**
- ❌ Any triggers that INSERT into `fantasy_roster_spots`
- ❌ Roster spots with `created_at` timestamps DURING the draft (should all be before)
- ❌ The `make_draft_pick` function containing `INSERT INTO fantasy_roster_spots`

---

## 🔧 Step 2: Deploy the Fixed Function

Run this to update your `make_draft_pick` function with extra safeguards:

```bash
psql $DATABASE_URL -f supabase/build/fix_make_draft_pick_no_insert.sql
```

This new version:
- ✅ Counts roster spots before and after each pick
- ✅ Only UPDATES existing spots (never inserts)
- ✅ Logs detailed debug info to Supabase logs
- ✅ Raises warnings if roster count changes unexpectedly

---

## 🧹 Step 3: Clean Up Existing Duplicates

Once the function is fixed, clean up the existing duplicate roster spots:

```sql
-- For your team with 22 spots (should have 15)
-- Get the team_id first:
SELECT id, team_name, 
    (SELECT COUNT(*) FROM fantasy_roster_spots WHERE fantasy_team_id = ft.id) as spots
FROM fantasy_teams ft
WHERE league_id = 'YOUR_LEAGUE_ID'
ORDER BY spots DESC;

-- Then delete the extra 7 spots (keeping the first 15 created):
WITH ranked_spots AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY fantasy_team_id 
            ORDER BY created_at ASC, id ASC
        ) as rn
    FROM fantasy_roster_spots
    WHERE fantasy_team_id = 'YOUR_TEAM_ID_WITH_22_SPOTS'
)
DELETE FROM fantasy_roster_spots
WHERE id IN (
    SELECT id FROM ranked_spots WHERE rn > 15
);

-- Verify:
SELECT COUNT(*) FROM fantasy_roster_spots 
WHERE fantasy_team_id = 'YOUR_TEAM_ID';
-- Should now show 15
```

---

## 🧪 Step 4: Test the Fix

1. **Make a test draft pick** in your league
2. **Check Supabase logs** (Dashboard → Logs → Postgres Logs)
3. **Look for these NOTICE messages:**
   ```
   📊 Team "X" has 15 roster spots BEFORE pick
   ✅ Found available roster spot: uuid...
   ✅ VERIFIED: Roster spot count unchanged at 15
   ```

4. **If you see a WARNING:**
   ```
   ❌❌❌ BUG DETECTED: Roster spots changed from 15 to 16!
   ```
   Then the issue is NOT in `make_draft_pick` - it's a trigger or other code

---

## 🔎 Step 5: Find the Real Culprit (if needed)

If the function is correct but roster spots still increase, check:

### A. Check for Database Triggers

```sql
-- Check for triggers on fantasy_roster_spots
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fantasy_roster_spots';

-- Check for triggers on fantasy_draft_picks
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fantasy_draft_picks';
```

### B. Check Frontend Code

Look for any code that runs after `useMakeDraftPick`:
```typescript
// In src/hooks/useMakeDraftPick.ts
// Check the onSuccess callback - does it call other hooks?
```

### C. Check for Multiple Functions

```sql
-- Make sure there's only ONE make_draft_pick function
SELECT 
    proname,
    pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname LIKE '%draft_pick%';
```

---

## 🎯 Most Likely Causes

Based on the symptoms (7 picks = 7 extra spots), the issue is:

1. **Database trigger** that creates a roster spot when a draft pick is inserted
2. **Old version** of `make_draft_pick` function in database (different from file)
3. **Frontend hook** calling roster creation after each pick
4. **Race condition** where roster initialization runs during draft

---

## 📝 Quick Reference Commands

```bash
# Connect to your database
psql $DATABASE_URL

# In psql:

# Check current roster spots
SELECT ft.team_name, COUNT(frs.id) as spots
FROM fantasy_teams ft
LEFT JOIN fantasy_roster_spots frs ON ft.id = frs.fantasy_team_id
WHERE ft.league_id = 'YOUR_LEAGUE_ID'
GROUP BY ft.team_name;

# See roster spot creation timeline
SELECT id, fantasy_team_id, player_id, created_at, assigned_at
FROM fantasy_roster_spots
WHERE fantasy_team_id = 'YOUR_TEAM_ID'
ORDER BY created_at;

# Check if function exists
\df make_draft_pick

# View function definition
\sf make_draft_pick
```

---

## ✅ Success Criteria

After the fix:
- ✅ Each team has exactly the correct number of roster spots (no more, no less)
- ✅ Draft picks UPDATE roster spots (not add new ones)
- ✅ Roster spot count stays constant throughout draft
- ✅ Salary cap calculations are correct

---

## 🆘 If You Need Help

Share the output of:
1. `diagnose_roster_issue.sql` results
2. Supabase Postgres logs after making a pick
3. The trigger query results

This will help identify exactly where the roster spots are being added!

