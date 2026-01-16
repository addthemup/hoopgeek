# 🚀 Apply Points and Groups System Migrations

## Quick Steps

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `qbznyaimnrpibmahisue`
   - Navigate to **SQL Editor** in the left sidebar
   - Click **"New Query"**

2. **Apply Each Migration in Order**

   Copy and paste each migration file content into the SQL Editor and click **"Run"**:

   ### Migration 1: Points System
   - File: `supabase/migrations/20250201000000_create_dfs_points_system.sql`
   - This creates: user points, transactions, achievements, trophies tables

   ### Migration 2: Groups System
   - File: `supabase/migrations/20250201000001_create_dfs_groups_system.sql`
   - This creates: groups, group members, group pools tables

   ### Migration 3: Add Points to Pools
   - File: `supabase/migrations/20250201000002_add_points_to_dfs_pools.sql`
   - This adds: point configuration fields to dfs_pools table

   ### Migration 4: Update Pool Creation
   - File: `supabase/migrations/20250201000003_add_points_to_pool_creation.sql`
   - This updates: create_dfs_pool_from_games function to accept points

3. **Verify Success**
   After each migration, you should see "Success" message.

## What Gets Created

### Points System
- ✅ `dfs_user_points` - User point totals
- ✅ `dfs_point_transactions` - Point transaction history
- ✅ `dfs_achievements` - Achievement definitions
- ✅ `dfs_user_achievements` - User achievements
- ✅ `dfs_trophies` - Trophy definitions
- ✅ `dfs_user_trophies` - User trophies
- ✅ Functions: `award_dfs_points()`, `check_and_award_achievements()`
- ✅ Triggers: Auto-award points on entry submission and ranking

### Groups System
- ✅ `dfs_groups` - Group information
- ✅ `dfs_group_members` - Group membership
- ✅ `dfs_group_pools` - Link pools to groups
- ✅ Functions: `create_dfs_group()`, `join_dfs_group()`, `leave_dfs_group()`, `link_pool_to_group()`

### Pool Updates
- ✅ Added `points_entry`, `points_win`, `points_placement`, `points_top_percent`, `points_enabled` to `dfs_pools`
- ✅ Updated `create_dfs_pool_from_games()` function to accept point parameters

## Troubleshooting

If you encounter errors:

1. **Check if tables already exist** - Some migrations use `IF NOT EXISTS`, so they're safe to run multiple times
2. **Check function conflicts** - Migration 4 drops and recreates `create_dfs_pool_from_games`, which is expected
3. **Verify RLS policies** - All tables have RLS enabled with appropriate policies

## Next Steps

After migrations are applied:
1. Test creating a pool with point configuration in the admin panel
2. Test creating a group
3. Test joining a group
4. Test creating a pool for a group

