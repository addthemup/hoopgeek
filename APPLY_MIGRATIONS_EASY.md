# 🚀 Easy Migration Application

## One-Click Application

I've created a **combined migration file** that includes all 4 migrations in the correct order.

### Steps:

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/qbznyaimnrpibmahisue/sql/new

2. **Copy the Combined Migration**
   - Open file: `supabase/migrations/COMBINED_points_and_groups_migrations.sql`
   - Copy **ALL** contents (Cmd/Ctrl + A, then Cmd/Ctrl + C)

3. **Paste and Run**
   - Paste into SQL Editor (Cmd/Ctrl + V)
   - Click **"Run"** button (or press Cmd/Ctrl + Enter)
   - Wait for "Success" message

4. **Done!** ✅

The combined file includes:
- ✅ Points system (tables, functions, triggers)
- ✅ Groups system (tables, functions)
- ✅ Points configuration for pools
- ✅ Updated pool creation function

All migrations use `IF NOT EXISTS` where safe, so you can run it multiple times if needed.

---

## Alternative: Apply One-by-One

If you prefer to apply them separately:

1. `20250201000000_create_dfs_points_system.sql`
2. `20250201000001_create_dfs_groups_system.sql`
3. `20250201000002_add_points_to_dfs_pools.sql`
4. `20250201000003_add_points_to_pool_creation.sql`

Apply each in order in the SQL Editor.

