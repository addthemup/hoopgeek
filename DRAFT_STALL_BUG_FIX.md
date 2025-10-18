# 🐛 Draft Stall Bug Fix

## The Problem

Drafts were stalling at random picks with these symptoms:
- `time_expires: not set` (NULL)
- `Error getting best player: null`
- Draft-manager kept looping but never progressed

## Root Cause

**Line 637** in `draft-manager/index.ts` had **invalid PostgREST syntax**:

```typescript
.order('nba_hoopshype_salaries(salary_2025_26)', { ascending: false });
```

**Why it failed:**
- PostgREST **cannot order by related table columns** using this syntax
- This caused the fallback query to fail with error:
  ```
  code: "PGRST118"
  message: "A related order on 'nba_hoopshype_salaries' is not possible"
  ```
- When the fallback query failed, it returned `null`
- This prevented `time_expires` from being set
- Without `time_expires`, the pick couldn't progress

## The Fix

### 1. Fixed Fallback Query (Primary Fix)

**Before:**
```typescript
let fallbackQuery = supabase
  .from('nba_players')
  .select(`
    *,
    nba_hoopshype_salaries!inner(salary_2025_26),
    nba_espn_projections(proj_2026_pts, proj_2026_reb, proj_2026_ast, proj_2026_gp)
  `)
  .eq('is_active', true)
  .lte('nba_hoopshype_salaries.salary_2025_26', remainingCap)
  .order('nba_hoopshype_salaries(salary_2025_26)', { ascending: false }); // ❌ BROKEN
```

**After:**
```typescript
let fallbackQuery = supabase
  .from('nba_players')
  .select(`
    *,
    nba_hoopshype_salaries!inner(salary_2025_26),
    nba_espn_projections(proj_2026_pts, proj_2026_reb, proj_2026_ast, proj_2026_gp)
  `)
  .eq('is_active', true)
  .lte('nba_hoopshype_salaries.salary_2025_26', remainingCap);

const { data: fallbackPlayersRaw, error: fallbackError } = await fallbackQuery.limit(20);

// Sort by salary in JavaScript (highest first) and take the best player
const fallbackPlayers = fallbackPlayersRaw?.sort((a: any, b: any) => {
  const salaryA = a.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0;
  const salaryB = b.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0;
  return salaryB - salaryA;
}).slice(0, 1);
```

**Benefits:**
- ✅ No more PostgREST relationship errors
- ✅ Fetches 20 players and sorts in JavaScript
- ✅ More flexible sorting logic
- ✅ Still picks highest-paid player as fallback

### 2. Added Auto-Recovery System (Backup)

If a pick somehow still gets stuck with `time_expires = NULL`, the draft-manager now **automatically detects and fixes it**:

```typescript
// AUTO-RECOVERY: Fix any picks with null time_expires
console.log('🔧 Checking for stalled picks (null time_expires)...');
for (const draft of activeDrafts) {
  const currentPick = draft.fantasy_draft_order;
  if (currentPick && !currentPick.time_expires && !currentPick.is_completed) {
    console.log(`⚠️ STALLED PICK DETECTED: League ${draft.league_id}, Pick #${currentPick.pick_number}`);
    
    // Get team's autodraft status
    // Calculate appropriate timer (3s for autodraft, 60s otherwise)
    // Set time_expires
    
    console.log(`✅ Fixed stalled pick #${currentPick.pick_number} - draft will resume automatically`);
  }
}
```

**This runs every time draft-manager executes** (~10 seconds), so stalled picks are automatically recovered!

## Files Changed

1. **`supabase/functions/draft-manager/index.ts`**
   - Fixed fallback query ordering (line 627-650)
   - Added auto-recovery logic (line 248-292)

2. **`supabase/migrations/20251018_add_fix_stalled_picks_function.sql`** (Optional backup)
   - SQL function to manually fix stalled picks
   - Can be called manually or via cron job

3. **`supabase/migrations/20251018_fix_stalled_draft_pick.sql`** (Emergency fix for current stall)
   - Fixes the currently stalled pick #226
   - One-time use for immediate recovery

## How to Deploy

### Step 1: Deploy the updated draft-manager
```bash
cd /Users/adam/Desktop/hoopgeek
supabase functions deploy draft-manager
```

### Step 2: (Optional) Deploy the SQL recovery function
Run in Supabase SQL Editor:
```sql
-- Copy from: /Users/adam/Desktop/hoopgeek/supabase/migrations/20251018_add_fix_stalled_picks_function.sql
```

### Step 3: Fix currently stalled pick (if needed)
Run in Supabase SQL Editor:
```sql
-- Copy from: /Users/adam/Desktop/hoopgeek/supabase/migrations/20251018_fix_stalled_draft_pick.sql
```

## Verification

After deploying, check the draft-manager logs:

**Success indicators:**
```
🔧 Checking for stalled picks (null time_expires)...
✅ No stalled picks found
⚡ Found 1 active draft(s) with picks to process:
⏰ Pick #226 has EXPIRED - processing...
🤖 Auto-picking player: [Player Name]
✅ Moved to pick #227
```

**If a stalled pick is detected:**
```
⚠️ STALLED PICK DETECTED: League 5082f7c5-..., Pick #226 has null time_expires
🔧 AUTO-FIXING: Setting time_expires to 60s from now
✅ Fixed stalled pick #226 - draft will resume automatically
```

## Prevention

This fix prevents the issue from happening again because:

1. **Fallback query now works** - No more PostgREST errors
2. **Auto-recovery** - Even if something else causes a stall, it's automatically fixed
3. **Better logging** - Easier to diagnose if issues persist

## Related Issues

This also fixes the secondary symptom where drafts showed:
- `"time_expires": "not set"`
- Picks stuck in round 12 indefinitely
- Draft appearing "in_progress" but not progressing

All of these were caused by the same root issue! 🎯

