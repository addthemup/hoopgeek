# Draft Pick Trading Ownership Fix

## Problem

When draft picks were traded in the Trade module, the system correctly:
- ✅ Showed trade indicators in the UI (arrow showing new owner)
- ✅ Recorded the trade in `draft_trade_offers` table
- ❌ **BUT did not transfer actual drafting rights to the new owner**

### Root Cause

The `accept_trade_offer` function was updating `current_team_id` when picks were traded, but the entire system (both frontend and backend) actually uses `fantasy_team_id` to determine ownership:

1. **Frontend checks** (in `useDraftOrder.ts` line 155):
   ```typescript
   team_id: pick.fantasy_team_id
   ```

2. **Backend checks** (in `make_draft_pick` function line 33):
   ```sql
   INNER JOIN fantasy_teams ft ON fdo.fantasy_team_id = ft.id
   ```

3. **Draft manager** (in `auto-draft/index.ts` line 526):
   ```typescript
   const team = teams[currentPick.team_position - 1]
   ```
   (Which gets teams based on `fantasy_team_id` ordering)

## Solution

Updated the `accept_trade_offer` function to properly transfer ownership by updating **`fantasy_team_id`** (not just `current_team_id`) when picks are traded:

```sql
UPDATE fantasy_draft_order 
SET 
  -- Store original owner if this is the first trade
  original_team_id = COALESCE(original_team_id, fantasy_team_id),
  -- ⚠️ KEY FIX: Update the actual owner (this is what make_draft_pick checks!)
  fantasy_team_id = trade_record.to_team_id,
  -- Also update current_team_id for tracking
  current_team_id = trade_record.to_team_id,
  is_traded = true,
  trade_count = trade_count + 1,
  updated_at = NOW()
WHERE pick_number = pick_number_val 
  AND league_id = trade_record.league_id
  AND fantasy_team_id = trade_record.from_team_id;
```

## Field Meanings After Fix

- **`fantasy_team_id`**: Current owner who can make the pick (UPDATED on trade)
- **`original_team_id`**: Original owner for historical tracking (SET on first trade, never changes)
- **`current_team_id`**: Also current owner, kept for compatibility (UPDATED on trade)
- **`is_traded`**: Boolean flag indicating pick has been traded
- **`trade_count`**: Number of times pick has been traded

## Deployment Instructions

1. Go to your Supabase SQL Editor
2. Copy and paste the entire contents of `supabase/build/fix_pick_trading_ownership.sql`
3. Run the script
4. You should see:
   ```
   ✅ Fixed pick trading to update fantasy_team_id (actual ownership)
   ✅ Picks will now be draftable by the team that traded for them
   ✅ original_team_id still tracks the original owner for history
   ```

## Testing

1. Make a trade involving draft picks
2. Accept the trade
3. Wait for that pick number to come up in the draft
4. The team that received the pick in the trade should now be able to draft with it
5. The DraftPicksCarousel should show both:
   - The trade indicator (→ New Team)
   - The correct current owner when it's their turn to pick

## What This Fixes

- ✅ Teams can now actually use picks they traded for
- ✅ Auto-draft will draft for the correct team (the one who traded for the pick)
- ✅ Commissioner auto-pick will work for traded picks
- ✅ Draft timer shows correct team on the clock
- ✅ Trade history is preserved in `original_team_id`
- ✅ UI continues to show trade indicators correctly

## Related Files

- **SQL Function**: `supabase/build/fix_pick_trading_ownership.sql`
- **Trade Hook**: `src/hooks/useTradeActions.ts`
- **Draft Order Hook**: `src/hooks/useDraftOrder.ts` (no changes needed)
- **Draft Pick Function**: `supabase/build/make_draft_pick.sql` (no changes needed)
- **Auto-draft Function**: `supabase/functions/auto-draft/index.ts` (no changes needed)

The beauty of this fix is that by correcting the database field that was supposed to be updated all along, the entire system (frontend and backend) automatically works correctly without any other code changes!

