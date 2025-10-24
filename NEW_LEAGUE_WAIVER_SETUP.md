# 🏀 Waiver System Setup for New Leagues

## 🔍 Step 1: Check if Waiver System is Deployed

**Run this in Supabase SQL Editor:**
```sql
-- Copy and run: check_waiver_system_status.sql
```

This will tell you which components are already deployed.

---

## 📋 Step 2: Deploy Missing Components

### If ANY checks show ❌, run the deployment script:

**In Supabase SQL Editor, run:**
```sql
-- Copy and paste ENTIRE contents of: deploy_waiver_system_all_in_one.sql
```

This will create:
- ✅ `fantasy_waiver_order` table (tracks budgets & priority)
- ✅ `fantasy_waiver_claims` table (tracks claim submissions)
- ✅ `fantasy_players_on_waivers` table (tracks players on waivers)
- ✅ `initialize_waiver_order()` function
- ✅ `drop_player()` function (updated to handle waivers)
- ✅ All waiver columns in `fantasy_league_seasons`

---

## 🎯 Step 3: Workflow for Each New League

### **After Creating a New League:**

#### 1️⃣ **League Settings Include Waiver Config**
When you create a league, make sure these settings are set in `fantasy_league_seasons`:

```typescript
{
  waiver_type: 'faab',              // or 'rolling', 'continuous', 'none'
  waiver_period_hours: 24,          // Hours player stays on waivers
  waiver_budget_amount: 100,        // FAAB budget per team
  waiver_min_bid: 1,                // Minimum FAAB bid
  waiver_priority_reset: 'weekly'   // or 'never', 'after_claim'
}
```

These should be saved automatically when creating the league season.

#### 2️⃣ **After Draft Completes:**
You MUST initialize the waiver order. Two options:

**Option A: Run SQL directly (in Supabase SQL Editor)**
```sql
SELECT initialize_waiver_order(
  'YOUR_LEAGUE_ID_HERE'::uuid,
  'YOUR_SEASON_ID_HERE'::uuid
);
```

**Option B: Call from your app**
```typescript
const { data, error } = await supabase.rpc('initialize_waiver_order', {
  league_id_param: leagueId,
  season_id_param: seasonId
});

console.log('Waiver order initialized:', data);
```

This will:
- ✅ Create a row in `fantasy_waiver_order` for each team
- ✅ Set initial FAAB budget to 100 for each team
- ✅ Set waiver priority based on inverse draft order

---

## 🚦 Step 4: Verify It's Working

### **Test 1: Check Waiver Order Was Created**
```sql
SELECT 
    ft.team_name,
    wo.waiver_priority,
    wo.remaining_budget,
    wo.total_spent
FROM fantasy_waiver_order wo
JOIN fantasy_teams ft ON ft.id = wo.fantasy_team_id
WHERE wo.league_id = 'YOUR_LEAGUE_ID_HERE'
ORDER BY wo.waiver_priority ASC;
```

You should see all teams with their priority and budget.

### **Test 2: Drop a Player**
1. Go to your team roster
2. Drop any player
3. Check the `fantasy_players_on_waivers` table:

```sql
SELECT 
    np.name as player_name,
    fpw.waiver_status,
    fpw.becomes_free_agent_at,
    (fpw.becomes_free_agent_at - NOW()) as time_remaining
FROM fantasy_players_on_waivers fpw
JOIN nba_players np ON np.id = fpw.player_id
WHERE fpw.league_id = 'YOUR_LEAGUE_ID_HERE';
```

You should see the player with `waiver_status = 'on_waivers'` and `becomes_free_agent_at` set to 24 hours from drop time.

### **Test 3: View in Players Page**
1. Go to **Players** page
2. Change filter to **"On Waivers"**
3. You should see the dropped player with hours remaining

---

## ✅ Quick Checklist for New Leagues

```
[ ] 1. Waiver system components deployed (run check_waiver_system_status.sql)
[ ] 2. League created with waiver settings in fantasy_league_seasons
[ ] 3. Draft completed
[ ] 4. initialize_waiver_order() called with league_id and season_id
[ ] 5. Waiver order verified (all teams have budget & priority)
[ ] 6. Test drop player → appears in waivers for 24h
[ ] 7. Test Players page → "On Waivers" filter shows dropped players
```

---

## ⚠️ Important Notes

### **You MUST call `initialize_waiver_order()` for each new league!**
- It doesn't happen automatically
- Call it after the draft completes
- It sets up the budget and priority for all teams
- Safe to call multiple times (it resets/recreates the data)

### **The `drop_player()` function handles waivers automatically**
- When you drop a player, it's added to waivers automatically
- No additional code needed
- The 24-hour timer starts immediately

### **"Free Agent" vs "On Waivers"**
- **On Waivers**: Player was dropped, still in 24h period
- **Free Agent**: Player never rostered OR 24h period expired
- Only "Free Agents" can be added directly
- "On Waivers" requires a waiver claim (not yet implemented)

---

## 🔮 What Happens Automatically

✅ **When you drop a player:**
- Player removed from roster (roster spot cleared)
- Transaction logged in `fantasy_transactions`
- Player added to `fantasy_players_on_waivers` with 24h timer
- Player shows in "On Waivers" filter with countdown

✅ **After 24 hours:**
- Player status changes from "on_waivers" to "free_agent"
- Player shows as "Free Agent" in UI
- Anyone can add them directly (no claim needed)

❌ **NOT automatic (need to build):**
- Submitting waiver claims during 24h period
- Processing claims when timer expires
- Deducting FAAB budget when claim succeeds
- Updating waiver priority after claims

---

## 📞 If Something's Not Working

### Problem: Player not going to waivers when dropped
**Check:** Is `drop_player()` function deployed with waiver support?
```sql
-- Check the function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'drop_player';
```

### Problem: Can't initialize waiver order
**Check:** Do you have the correct league_id and season_id?
```sql
-- Get your IDs
SELECT l.id as league_id, ls.id as season_id
FROM fantasy_leagues l
JOIN fantasy_league_seasons ls ON ls.league_id = l.id
WHERE ls.is_active = true;
```

### Problem: Players showing immediately as free agents (not waivers)
**Check:** Waiver period settings
```sql
SELECT waiver_type, waiver_period_hours
FROM fantasy_league_seasons
WHERE id = 'YOUR_SEASON_ID';
```

---

## 🎉 Summary

For **NEW leagues**, you need to:

1. ✅ **ONE TIME**: Deploy waiver system (run `deploy_waiver_system_all_in_one.sql`)
2. ✅ **PER LEAGUE**: After draft, call `initialize_waiver_order(league_id, season_id)`
3. ✅ **AUTOMATIC**: Everything else works automatically!

The waiver system will then:
- Track each team's FAAB budget
- Track waiver priority order
- Put dropped players on waivers for 24h
- Convert to free agents after 24h
- Show waiver status in Players page

**Ready to go!** 🚀

