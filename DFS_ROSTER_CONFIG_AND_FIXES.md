# DFS Roster Configurations & Lock Time Fix

## 🎯 Changes Implemented

### 1. **Roster Configuration Options**

Added two roster configuration options when creating DFS pools:

#### **Compact Roster** (10 players) - Default
- **Starters** (5): G G F F C at 1.0x multiplier
- **Rotation** (3): G F C at 0.75x multiplier  
- **Bench** (2): UTIL UTIL at 0.5x multiplier

#### **Full Roster** (13 players)
- **Starters** (5): G G F F C at 1.0x multiplier
- **Rotation** (5): G G F F C at 0.75x multiplier
- **Bench** (3): UTIL UTIL UTIL at 0.5x multiplier

### 2. **Difficulty Tier Name Fixes**

Corrected the mapping of difficulty names to salary caps:
- **Standard** (`elite` in DB) = **$154.6M cap** (Tightest/Hardest)
- **Apron 1** (`pro` in DB) = **$195.9M cap** (First Apron - Medium)
- **Apron 2** (`standard` in DB) = **$207.8M cap** (Second Apron - Easiest)

### 3. **Lock Time Display Fix**

Fixed timezone issue where pools were showing as "Locked" prematurely:
- Changed from `now()` to `CURRENT_TIMESTAMP` for proper timezone handling
- Ensures seconds_until_lock calculation respects user's timezone

## 📁 Files Modified

### Frontend Changes:
1. **`src/components/Admin/DFSPoolManager.tsx`**
   - Added roster_config to FormData interface
   - Added roster configuration selector UI with descriptions
   - Pass roster_config to pool creation
   - Fixed difficulty tier naming in admin form

2. **`src/hooks/useCreateDFSPool.ts`**
   - Added roster_config parameter
   - Calculate roster counts based on configuration (5/3/2 or 5/5/3)
   - Pass counts to database function

3. **`src/components/DFS/TodaysContests.tsx`**
   - Fixed difficulty filter button order
   - Updated getDifficultyName mapping
   - Fixed difficulty tier naming display

4. **`src/components/DFS/PoolDetailsModal.tsx`**
   - Updated getDifficultyLabel with correct names and caps

### Database Migrations (MUST RUN):

1. **`supabase/migrations/add_roster_config_to_pool_creation.sql`**
   - Updates `create_dfs_pool_from_games()` function
   - Adds `p_starters_count`, `p_rotation_count`, `p_bench_count` parameters
   - Stores roster configuration in pool table

2. **`supabase/migrations/fix_dfs_lock_time_calculation.sql`**
   - Fixes `dfs_todays_contests` view
   - Changes timezone calculation for seconds_until_lock
   - Uses CURRENT_TIMESTAMP instead of now()

## 🚀 Deployment Steps

### 1. Run Database Migrations

```bash
# Apply roster configuration migration
psql -h <your-db-host> -U postgres -d <your-db> -f supabase/migrations/add_roster_config_to_pool_creation.sql

# Apply lock time fix migration
psql -h <your-db-host> -U postgres -d <your-db> -f supabase/migrations/fix_dfs_lock_time_calculation.sql
```

Or via Supabase CLI:
```bash
cd /Users/adam/Desktop/hoopgeek
supabase db push
```

### 2. Deploy Frontend

The frontend changes are already implemented. Just deploy normally:
```bash
npm run build
# Deploy to your hosting platform
```

## ✅ Testing Checklist

- [ ] Create a new DFS pool with **Compact roster** (10 players)
- [ ] Create a new DFS pool with **Full roster** (13 players)
- [ ] Verify lock time shows correct countdown (not "Locked" prematurely)
- [ ] Check difficulty filter buttons show correct order: Standard → Apron 1 → Apron 2
- [ ] Verify difficulty chips display correct names in contest list
- [ ] Test pool creation with different salary cap + roster combinations

## 📊 Configuration Combinations

Admins can now create varied contests with:
- **3 Salary Caps** × **2 Roster Configs** = **6 Different Contest Types**

Examples:
1. **Standard ($154.6M) + Compact (10)** - Extreme constraint
2. **Standard ($154.6M) + Full (13)** - Very tight but more depth
3. **Apron 1 ($195.9M) + Compact (10)** - Balanced 
4. **Apron 1 ($195.9M) + Full (13)** - Strategic depth
5. **Apron 2 ($207.8M) + Compact (10)** - Most flexible
6. **Apron 2 ($207.8M) + Full (13)** - Maximum lineup options

This allows experimentation with different difficulty levels based on both salary constraint AND lineup complexity!

## 🐛 Bugs Fixed

1. ✅ Delete pool iterator error (fixed in previous session)
2. ✅ Difficulty tier names backwards (Standard vs Apron 1 vs Apron 2)
3. ✅ Lock time showing "Locked" when pools have hours remaining
4. ✅ Missing roster configuration options in pool creation

## 📝 Notes

- Roster configuration **cannot be changed** after pool creation (by design)
- The full roster (13 players) provides more strategic depth for users
- Compact roster (10 players) is faster to fill and simpler for beginners
- Lock times are now properly timezone-aware

