#!/bin/bash

# ============================================================================
# Deploy DFS Fixes - Adds prize_won column and team_of_week function
# ============================================================================

echo "🚀 Deploying DFS fixes..."
echo ""

# Check if SUPABASE_DB_URL is set
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ Error: SUPABASE_DB_URL environment variable not set"
  echo "Please set it with your Supabase database connection string"
  echo "Example: export SUPABASE_DB_URL='postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres'"
  exit 1
fi

echo "📝 Running migration: fix_dfs_entries_and_team_of_week.sql"
psql "$SUPABASE_DB_URL" -f supabase/migrations/fix_dfs_entries_and_team_of_week.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  echo "Changes applied:"
  echo "  1. ✅ Added prize_won column to dfs_entries table"
  echo "  2. ✅ Created sync trigger to keep prize_won in sync with prize_amount"
  echo "  3. ✅ Deployed get_dfs_team_of_week() function"
  echo ""
  echo "You can now:"
  echo "  - View team of the week on DFS page"
  echo "  - See prize winnings in your entries"
else
  echo ""
  echo "❌ Migration failed. Please check the errors above."
  exit 1
fi

