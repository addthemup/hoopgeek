# 🏀 Apply NBA Team Roster Migration

## Quick Steps

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Navigate to **SQL Editor** in the left sidebar

2. **Copy the Migration SQL**
   - The migration file is: `supabase/migrations/20250120000004_create_nba_team_roster.sql`
   - Copy the entire contents below

3. **Paste and Run**
   - Paste into SQL Editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)
   - Wait for "Success" message

## What This Creates

✅ `nba_team_roster` table with:
- Foreign keys to `nba_teams` and `nba_players`
- Indexes for performance
- RLS policies for public read access
- Unique constraint on `(team_id, season, nba_player_id)`
- Auto-update trigger for `updated_at` timestamp

## Verification

After running, verify with:
```sql
SELECT * FROM nba_team_roster LIMIT 5;
```

You should see an empty table (no rows yet, but table structure exists).

