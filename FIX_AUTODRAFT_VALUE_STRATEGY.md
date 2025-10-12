# Fix Autodraft to Use VALUE-FIRST Strategy

## 🎯 Problem
Autodraft is currently picking **terrible players** like Richaun Holmes first overall!

**Why?** The naive value formula (fantasy points ÷ salary) over-rewards minimum-salary scrubs:
- **Richaun Holmes**: 1,128 pts ÷ $600K = **0.00188 value** ⚠️
- **Nikola Jokić**: 2,800 pts ÷ $55M = **0.00005 value**

Holmes appears **37x more valuable** than Jokić! This is mathematically correct but fantasy-incorrect.

## ✨ Solution
The new `VALUE-FIRST + QUALITY THRESHOLD` strategy:
1. **Filters out low-quality players** (minimum fantasy points, games played)
2. **Then calculates value** = Fantasy Points ÷ Salary
3. **Orders by value** among quality players only
4. **Result**: High-performing players on good contracts (rookies, emerging stars, value vets)
5. **Maximizes roster flexibility** by avoiding overpaying for names

---

## 📋 Step-by-Step Fix

### Step 1: Check if Data is Loaded

First, verify that salary and projection data are in your database:

```bash
cd /Users/adam/Desktop/hoopgeek

# Run the data check query (copy/paste into Supabase SQL Editor)
cat CHECK_PLAYER_DATA.sql
```

**What to look for:**
- Players with salary data: Should be 400+
- Players with ESPN projection data: Should be 500+
- Players with BOTH: Should be 400+

**If counts are low or zero, proceed to Step 2. Otherwise, skip to Step 3.**

---

### Step 2: Import Data from JSON Files (If Needed)

If data is missing, import it from the JSON files:

```bash
cd /Users/adam/Desktop/hoopgeek

# Install dependencies
pip install supabase python-dotenv

# Make sure your .env file has these variables:
# VITE_SUPABASE_URL=your-supabase-url
# VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Run the import script
python scripts/import_projections_and_salaries.py
```

**Expected Output:**
```
✅ Connected to Supabase
✅ Updated Stephen Curry: $59,606,817
✅ Updated Nikola Jokic: $55,224,526
...
SALARY IMPORT SUMMARY:
  ✅ Updated: 450
  ❌ Not Found: 30
  ⏭️  Skipped: 20
```

---

### Step 3: Apply the VALUE-FIRST + QUALITY THRESHOLD Migration

Apply the new draft strategy to your database:

**Option A: Using Supabase Dashboard** (RECOMMENDED)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `supabase/migrations/20251011000002_value_with_quality_threshold.sql`
4. Paste into SQL Editor and click **Run**

**Option B: Using psql (if you have direct DB access)**
```bash
cd /Users/adam/Desktop/hoopgeek

# Replace with your actual connection string
psql "postgresql://..." -f supabase/migrations/20251011000002_value_with_quality_threshold.sql
```

**Expected Output:**
```
DROP FUNCTION
CREATE FUNCTION
GRANT
COMMENT
```

---

### Step 4: Test the New Strategy

Test that the function returns high-value players:

```sql
-- Run this in Supabase SQL Editor
-- Replace 'your-league-id' and 'your-team-id' with actual UUIDs from your database

SELECT * FROM get_best_available_player(
  'your-league-id'::UUID,
  'your-team-id'::UUID,
  1,  -- current round
  15, -- picks remaining
  15  -- total picks
);
```

**Expected Result:**
The player returned should have:
- **High `value_per_dollar`** (e.g., 0.00015+)
- **Lower salary** compared to superstars (e.g., $10M-$30M range)
- **Good fantasy points** (e.g., 1500-2500)

**Example high-value players you might see:**
- Young stars on rookie contracts (e.g., Victor Wembanyama, Chet Holmgren)
- Emerging players (e.g., Jalen Williams, Scottie Barnes)
- Veterans on team-friendly deals

---

### Step 5: Restart Draft or Create New League

**Option A: Test with New Draft**
1. Create a new league in your app
2. Start the draft
3. Enable autodraft for a few teams
4. Watch the picks - they should now select high-value players

**Option B: Reset Current Draft (Careful!)**
```sql
-- Only run this if you want to completely reset the draft
DELETE FROM draft_picks WHERE league_id = 'your-league-id';
UPDATE draft_order SET is_completed = false WHERE league_id = 'your-league-id';
UPDATE fantasy_teams SET autodraft_enabled = false WHERE league_id = 'your-league-id';
```

---

## 🧪 How to Verify It's Working

After applying the fix, you should see picks like:

### Before (Broken - Minimum Salary Scrubs ❌)
```
#1 Richaun Holmes - $0.6M - 1,128 pts - Value: 0.00188 (TERRIBLE PLAYER!)
#2 Tristan Vukcevic - $0.6M - 1,220 pts - Value: 0.00190
#3 Jamal Shead - $2.0M - 1,262 pts - Value: 0.00063
#4 Other minimum-salary nobodies...
```

### After (Value-First + Quality Thresholds ✅)
```
ROUND 1-5 (Min: 1800 FP, 55 GP):
#1 Victor Wembanyama - $12.2M - 2,200 pts - Value: 0.00018 ⭐
#2 Chet Holmgren - $10.4M - 1,900 pts - Value: 0.00018 ⭐
#3 Scottie Barnes - $10.1M - 1,850 pts - Value: 0.00018 ⭐
#4 Nikola Jokić - $55.2M - 2,800 pts - Value: 0.00005 (elite but expensive)

LATER ROUNDS (Lower thresholds):
Rounds 6-10: Rotation players (1400+ FP)
Rounds 11-13: Bench players (1000+ FP)
Rounds 14+: Deep bench (700+ FP)
```

**Key Indicators:**
- ✅ **NO MORE SCRUBS!** Only quality players get drafted
- ✅ Salaries are **reasonable** ($5M-$30M range for stars)
- ✅ Value per dollar is **high** (0.00010-0.00020 range)
- ✅ Mix of **young stars on rookie deals** and **value veterans**
- ✅ Quality thresholds prevent minimum-salary nobodies
- ✅ Early rounds = elite talent, later rounds = depth/fliers

---

## 📊 Understanding the Value Formula

```
Value = Fantasy Points ÷ Salary

Where Fantasy Points = 
  (PTS × GP) + 
  (REB × GP × 1.2) + 
  (AST × GP × 1.5) + 
  (STL × GP × 3.0) + 
  (BLK × GP × 3.0) + 
  (TO × GP × -1.0) +
  (3PM × GP × 1.0)
```

**Example:**
- **Victor Wembanyama**: 2200 pts ÷ $12.2M = 0.000180 value
- **Stephen Curry**: 2500 pts ÷ $59.6M = 0.000042 value

**Wembanyama has 4.3x better value!** 🎯

---

## 🚀 Next Steps

1. ✅ Run `CHECK_PLAYER_DATA.sql` to verify data
2. ✅ Import data if needed (`import_projections_and_salaries.py`)
3. ✅ Apply migration (`20251011000001_value_first_draft_strategy.sql`)
4. ✅ Test the function in SQL Editor
5. ✅ Start a new draft and watch the autodraft picks

---

## 🆘 Troubleshooting

### Issue: Players still being picked by salary
**Solution:** The old function might still be cached. Try:
```sql
-- Force drop all versions of the function
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID);

-- Then re-run the migration
```

### Issue: "No eligible players" in autodraft
**Solution:** Check that:
1. Salary data is loaded (`SELECT COUNT(*) FROM players WHERE salary_2025_26 > 0`)
2. Projection data is loaded (`SELECT COUNT(*) FROM espn_player_projections WHERE proj_2026_gp > 0`)
3. Players aren't all drafted (`SELECT COUNT(*) FROM draft_picks WHERE league_id = 'your-id'`)

### Issue: Import script fails
**Solution:** 
1. Check that JSON files exist in `scripts/supabase/`
2. Verify environment variables in `.env`
3. Make sure you're using the service role key, not anon key

---

## 📞 Need Help?

If you're still seeing high-salary players being picked first:
1. Share the output of `CHECK_PLAYER_DATA.sql`
2. Share the result of testing `get_best_available_player()`
3. Check Edge Function logs in Supabase Dashboard

---

**Good luck! 🏀💰**

