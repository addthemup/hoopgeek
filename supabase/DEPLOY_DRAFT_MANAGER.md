# Deploy Updated Draft Manager with Salary Cap Logic

## Overview
This update adds **tiered selection strategy** to the autodraft system to respect salary cap constraints.

## Changes Made

### 1. SQL Function Update (`update_draft_functions_with_salary_cap.sql`)
- ✅ Added salary cap calculation (current team salary vs league cap)
- ✅ Filters players by affordability (must fit in remaining cap space)
- ✅ Three selection strategies:
  - **best_player**: Early rounds (1-5) - Pick highest projected fantasy points
  - **value**: Mid rounds (6-10) - Balance fantasy points and value per dollar
  - **affordable_value**: Late rounds (11+) - Prioritize value per dollar

### 2. Edge Function Update (`draft-manager/index.ts`)
- ✅ Automatically selects strategy based on current draft round
- ✅ Enhanced logging with salary information
- ✅ Shows remaining cap space after each pick

## Deployment Steps

### Step 1: Run the SQL Migration
```bash
# Navigate to project root
cd /Users/adam/Desktop/hoopgeek

# Run the migration
npx supabase db push --file supabase/migrations/update_draft_functions_with_salary_cap.sql
```

### Step 2: Deploy the Edge Function
```bash
# Deploy the updated draft-manager function
npx supabase functions deploy draft-manager
```

### Step 3: Verify Deployment
Check the Supabase dashboard:
1. Go to Database > Functions
2. Verify `get_best_available_player` has 4 parameters now
3. Check Edge Functions logs for successful deployment

## Testing

### Test with a New Draft
1. Create a new league with salary cap enabled
2. Set draft date to NOW
3. Enable all teams for autodraft
4. Watch the logs in Supabase Edge Functions

### Expected Log Output
```
🤖 Auto-picking for pick #1 (Round 1)
🎯 Team: Lakers Legends (autodraft: true)
🎯 Strategy: Best Available Player (Early Round)
🌟 Auto-picking player: Nikola Jokic (C) - Denver Nuggets
   📊 Projected Fantasy Points: 3456.7
   💰 Salary: $51.4M
   💎 Value per $: 0.0672
   🧢 Remaining Cap After: $48.6M
```

## Strategy Breakdown

### Rounds 1-5: Best Player
- Picks highest projected fantasy points
- Only considers affordable players
- Focus: Get the superstars early

### Rounds 6-10: Balanced Value
- Weighted sort: 60% fantasy points + 40% value per dollar
- Balances star power with salary efficiency
- Focus: Build a competitive roster

### Rounds 11+: Value per Dollar
- Prioritizes bang for buck
- Maximizes remaining cap space
- Focus: Fill roster with efficient players

## Rollback (If Needed)

If something goes wrong:

```bash
# Restore old function
npx supabase db push --file supabase/migrations/add_draft_functions.sql

# Redeploy old edge function from git
git checkout origin/main -- supabase/functions/draft-manager/index.ts
npx supabase functions deploy draft-manager
```

## Notes
- All teams will now respect salary cap during autodraft
- No team can exceed the league's salary cap
- If no affordable players exist, pick is marked as "no_eligible_players"
- Manual picks still need frontend validation for salary cap

