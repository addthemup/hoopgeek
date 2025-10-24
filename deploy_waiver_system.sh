#!/bin/bash

# =====================================================
# WAIVER SYSTEM DEPLOYMENT SCRIPT
# =====================================================
# This script deploys the complete waiver system including:
# - Fantasy transactions table
# - Waiver system tables and functions
# - Drop player functionality
# =====================================================

set -e  # Exit on error

echo "🚀 Starting waiver system deployment..."
echo ""

# Get Supabase project ref and password
read -p "Enter your Supabase project ref: " PROJECT_REF
read -sp "Enter your Supabase database password: " DB_PASSWORD
echo ""
echo ""

# Database connection string
DB_URL="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"

echo "📋 Step 1: Creating fantasy_transactions table..."
psql "$DB_URL" -f supabase/migrations/create_fantasy_transactions_table.sql
echo "✅ fantasy_transactions table created"
echo ""

echo "📋 Step 2: Creating waiver system tables..."
psql "$DB_URL" -f supabase/migrations/create_waiver_system.sql
echo "✅ Waiver system tables created"
echo ""

echo "📋 Step 3: Adding waiver columns to league seasons..."
psql "$DB_URL" -f supabase/migrations/add_waiver_columns_to_league_seasons.sql
echo "✅ Waiver columns added"
echo ""

echo "📋 Step 4: Creating waiver system functions..."
psql "$DB_URL" -f supabase/migrations/waiver_system_functions.sql
echo "✅ Waiver system functions created"
echo ""

echo "📋 Step 5: Applying drop player fix..."
psql "$DB_URL" -f supabase/migrations/fix_drop_player_null_handling.sql
echo "✅ Drop player function fixed"
echo ""

echo "📋 Step 6: Setting default waiver settings..."
psql "$DB_URL" -f supabase/migrations/set_default_waiver_settings.sql
echo "✅ Default waiver settings applied"
echo ""

echo "📋 Step 7: Applying waiver fixes..."
psql "$DB_URL" -f supabase/migrations/apply_waiver_fixes.sql
echo "✅ Waiver fixes applied"
echo ""

echo "🎉 Waiver system deployment complete!"
echo ""
echo "Next steps:"
echo "1. Test dropping a player from your roster"
echo "2. Check the fantasy_transactions table"
echo "3. Check the fantasy_players_on_waivers table"
echo "4. Verify waiver settings in your league"

