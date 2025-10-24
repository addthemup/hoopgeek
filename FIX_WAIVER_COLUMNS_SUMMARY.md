# Fix: Add Waiver Columns to Database

## 🔴 Current Issue
The league creation form is failing with:
```
Could not find the 'faab_budget' column of 'fantasy_league_seasons' in the schema cache
```

## ✅ What I've Done

### 1. Created SQL Migration
- **File**: `supabase/migrations/add_waiver_columns_to_league_seasons.sql`
- Adds 7 waiver-related columns to `fantasy_league_seasons` table
- Includes safety checks (won't fail if columns already exist)

### 2. Updated League Creation Form
- **File**: `src/components/LeagueCreationForm.tsx`
- Added FAAB Budget input that shows when FAAB waiver type is selected
- Shows/hides dynamically based on waiver type selection

### 3. Updated Frontend Hook
- **File**: `src/hooks/useLeagueInitializationMinimal.ts`  
- Added `faabBudget` to the data sent to Edge Function

### 4. Updated Edge Function
- **File**: `supabase/functions/create-league/index.ts`
- Added `faabBudget` parameter
- Uses commissioner's selected FAAB budget (or defaults to 100 if FAAB selected)
- **Status**: ✅ Deployed to Supabase

## 🚀 What You Need to Do

### Step 1: Run the SQL Migration (REQUIRED)

The Edge Function is deployed, but it **won't work until you add the database columns**.

**Option A: Supabase Dashboard (Easiest)**
1. Open https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy ALL the contents from:
   ```
   /Users/adam/Desktop/hoopgeek/supabase/migrations/add_waiver_columns_to_league_seasons.sql
   ```
6. Paste into SQL Editor
7. Click **Run** (or Cmd/Ctrl + Enter)
8. Verify you see output showing columns were added successfully

**Option B: Supabase CLI**
```bash
cd /Users/adam/Desktop/hoopgeek
supabase db push
```

### Step 2: Test League Creation

After running the migration:

1. Refresh your app (hard refresh: Cmd/Shift + R)
2. Create a new test league
3. In Step 1:
   - Set Draft Rounds to 12
   - Select "FAAB" as waiver type
   - Set FAAB Budget to 200 (or any amount)
4. In Step 2:
   - Adjust roster to exactly 12 spots
   - Verify you see green ✅ alert
5. Complete the form and create the league
6. Should succeed! 🎉

## 📋 New Features Added

### Waiver Settings in League Creation

**Step 1 Now Includes:**
- **Waiver Type**: None, Rolling, FAAB, or Continuous
- **Waiver Period**: Hours players stay on waivers (0-168)
- **FAAB Budget**: Shows only when FAAB selected (default: $100)

### Columns Added to Database

The migration adds these columns to `fantasy_league_seasons`:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `waiver_type` | TEXT | 'rolling' | none, rolling, faab, continuous |
| `waiver_period_hours` | INTEGER | 48 | Hours on waivers (0-168) |
| `faab_budget` | INTEGER | NULL | FAAB budget per team |
| `waiver_processing_day` | INTEGER | 3 | Day waivers process (0=Sun, 3=Wed) |
| `waiver_processing_time` | TIME | 03:00:00 | Time waivers process |
| `waiver_order_reset_type` | TEXT | 'weekly_inverse_standings' | How order resets |
| `waiver_order_tie_breaker` | TEXT | 'points_scored' | How to break ties |

## 🧪 Verification Query

After running the migration, verify columns exist:

```sql
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'fantasy_league_seasons' 
AND column_name IN (
    'waiver_type', 
    'waiver_period_hours', 
    'faab_budget',
    'waiver_processing_day',
    'waiver_processing_time',
    'waiver_order_reset_type',
    'waiver_order_tie_breaker'
)
ORDER BY column_name;
```

Should return 7 rows.

## 📚 Related Files

- ✅ `RUN_WAIVER_MIGRATION.md` - Detailed migration instructions
- ✅ `LEAGUE_CREATION_IMPROVEMENTS.md` - Full list of league creation improvements
- ✅ `supabase/migrations/add_waiver_columns_to_league_seasons.sql` - SQL migration file
- ✅ Edge Function deployed and ready

## ⏭️ Next Steps

1. **Run the SQL migration** (see Step 1 above)
2. **Test creating a league** with different waiver settings
3. **Verify** the waiver settings are saved correctly in the database
4. If everything works, you're done! 🏀

## ❓ Questions?

If you get any errors after running the migration, let me know and I'll help debug!

