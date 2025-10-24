# ⚡ Quick Start: Waiver System for New Leagues

## 🎯 Do This ONCE (First Time Setup)

### Step 1: Check if Already Deployed
Open **Supabase SQL Editor** and run:
```sql
-- Copy/paste from: check_waiver_system_status.sql
```

### Step 2: Deploy if Needed
If you see any ❌ marks, run this **ONCE**:
```sql
-- Copy/paste ENTIRE file: deploy_waiver_system_all_in_one.sql
-- Then click "Run"
```

This creates all waiver tables and functions. **You only need to do this once for your entire Supabase project.**

---

## 🔄 Do This FOR EACH NEW LEAGUE

### After Draft Completes:

**Run this in Supabase SQL Editor:**
```sql
-- Replace with your actual IDs
SELECT initialize_waiver_order(
  'YOUR_LEAGUE_ID_HERE'::uuid,
  'YOUR_SEASON_ID_HERE'::uuid
);

-- Example:
-- SELECT initialize_waiver_order(
--   'de1e54c7-4b7e-4fa2-be1f-339c53c5500a'::uuid,
--   'ede8d74c-d93c-4e09-903b-b0db098af92d'::uuid
-- );
```

**To find your IDs, run:**
```sql
SELECT 
    l.id as league_id,
    l.league_name,
    ls.id as season_id,
    ls.season_year
FROM fantasy_leagues l
JOIN fantasy_league_seasons ls ON ls.league_id = l.id
WHERE ls.is_active = true
ORDER BY l.created_at DESC;
```

---

## ✅ That's It!

After running `initialize_waiver_order()` for your league:

✅ All teams get $100 FAAB budget  
✅ Waiver priority set (inverse draft order)  
✅ Dropped players automatically go to waivers for 24h  
✅ Players page shows "On Waivers" filter  
✅ Everything works automatically!  

---

## 🧪 Test It

1. Drop a player from your roster
2. Go to **Players** page
3. Select filter: **"On Waivers"**
4. You should see the player with "24h" countdown

---

## TL;DR

```
1. Run: deploy_waiver_system_all_in_one.sql (ONCE per Supabase project)
2. After each league's draft: initialize_waiver_order(league_id, season_id)
3. Done! ✅
```

Everything else is automatic! 🎉

