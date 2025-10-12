# Pick Owner Validation Fix

## 🐛 Bug: "Pick 14 has no identifiable team owner"

When trying to trade picks, the validation was failing with:
```
Error: Pick 14 has no identifiable team owner
```

## 🔍 Root Cause

The validation logic for finding the **original owner** of a pick (when `fantasy_team_id` is NULL) was using a complex JOIN:

```sql
-- BROKEN CODE
SELECT ft.id INTO original_pick_owner_id
FROM public.draft_order do_orig
JOIN public.fantasy_teams ft ON ft.league_id = do_orig.league_id
WHERE do_orig.league_id = v_trade.league_id
  AND do_orig.pick_number = v_offered_pick_num
  AND ft.draft_position = do_orig.team_position; -- ❌ This field doesn't exist or match
```

**Problem**: `ft.draft_position` either doesn't exist or doesn't match `team_position` correctly.

## ✅ The Fix

Use a simpler approach: ORDER BY team ID and OFFSET by position:

```sql
-- FIXED CODE
SELECT ft.id INTO v_original_pick_owner_id
FROM public.fantasy_teams ft
WHERE ft.league_id = v_trade.league_id
ORDER BY ft.id
LIMIT 1 OFFSET (v_pick_check.team_position - 1);
```

**How it works**:
- Get all teams in league
- Order by ID (consistent order)
- `team_position = 1` → Get 1st team (OFFSET 0)
- `team_position = 2` → Get 2nd team (OFFSET 1)
- etc.

This is the **same logic used everywhere else** in the codebase (e.g., `make_draft_pick`, `useDraftOrder`).

## 🚀 Deployment

### Supabase Dashboard (Recommended)

1. **Open**: Supabase Dashboard → Your Project
2. **Navigate**: SQL Editor (left sidebar)
3. **Click**: "New Query"
4. **Copy/Paste**: Contents of `supabase/migrations/20251012000007_fix_pick_owner_validation.sql`
5. **Click**: "Run"

## 🧪 Testing After Fix

### Test Pick-for-Pick Trade

1. **Create Trade Offer**:
   - Team A offers: Pick #14
   - Team B offers: Pick #20
   - Submit trade

2. **Accept Trade** (as Team B or commissioner)

3. **Expected Result**:
   - ✅ Trade accepts successfully
   - ✅ No "Pick 14 has no identifiable team owner" error
   - ✅ Pick #14 now owned by Team B
   - ✅ Pick #20 now owned by Team A

4. **Verify in UI**:
   - ✅ DraftPicksCarousel shows traded picks with "→ Team X"
   - ✅ DraftPicks table shows "Traded from X"
   - ✅ DraftRoster picks column shows correct owners
   - ✅ DraftTrade available picks updated

## 📊 What Changed

### Code Structure

**Before** (broken):
- Used nested DECLARE blocks inside loops
- Complex JOIN on potentially missing column
- Unclear variable scope

**After** (fixed):
- Declared variables at function level
- Simple query with ORDER BY and OFFSET
- Clear, consistent logic

### Variable Declarations

Moved from nested blocks to function-level:

```sql
DECLARE
    -- ... existing vars ...
    v_current_pick_owner_id uuid;  -- NEW at top level
    v_original_pick_owner_id uuid; -- NEW at top level
BEGIN
```

This avoids scope issues and makes the code cleaner.

## 🔗 Related Issues

This bug was introduced in migration `20251012000006_fix_player_roster_trades.sql` when we added pick validation logic using the complex JOIN approach.

**Previous Similar Fixes**:
- `20251012000004_fix_draft_order_team_id_v2.sql` - Fixed same issue in `accept_trade_offer`
- `20251012000005_fix_make_draft_pick_trades.sql` - Fixed same issue in `make_draft_pick`

**Root Pattern**: When finding original pick owner, always use:
```sql
SELECT ft.id FROM fantasy_teams ft
WHERE ft.league_id = ?
ORDER BY ft.id
LIMIT 1 OFFSET (team_position - 1)
```

## ✅ Verification Query

After deploying, verify pick ownership is working:

```sql
-- Check that all picks have identifiable owners
SELECT 
    do.pick_number,
    do.team_position,
    do.fantasy_team_id,
    CASE 
        WHEN do.fantasy_team_id IS NOT NULL THEN 
            (SELECT team_name FROM fantasy_teams WHERE id = do.fantasy_team_id)
        ELSE 
            (SELECT team_name FROM fantasy_teams ft 
             WHERE ft.league_id = do.league_id 
             ORDER BY ft.id 
             LIMIT 1 OFFSET (do.team_position - 1))
    END as owner_team_name
FROM draft_order do
WHERE do.league_id = 'YOUR_LEAGUE_ID'
  AND do.is_completed = false
ORDER BY do.pick_number;
```

All picks should have an `owner_team_name` (none should be NULL).

---

**Status**: ✅ **MIGRATION READY**  
**Action Required**: Run via Supabase Dashboard SQL Editor  
**Testing**: Try pick-for-pick trade after deployment

---

**Created**: 2025-10-12  
**Bug**: Pick validation failing with "no identifiable team owner"  
**Fix**: Simplified pick owner lookup logic

