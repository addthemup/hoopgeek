#!/bin/bash

# ============================================================================
# DEPLOYMENT SCRIPT: ENGAGEMENT & ANALYTICS TRACKING SYSTEM
# ============================================================================
# This script deploys comprehensive engagement tracking for investor analytics
# ============================================================================

set -e  # Exit on error

echo "🚀 Deploying Engagement & Analytics Tracking System..."
echo "=================================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo "📋 Step 1: Creating engagement tracking tables..."
supabase db push --file supabase/migrations/create_engagement_tracking_system.sql
echo "✅ Engagement tables created"
echo ""

echo "📋 Step 2: Setting up DFS statistics triggers..."
supabase db push --file supabase/migrations/create_dfs_stats_triggers.sql
echo "✅ DFS stats triggers configured"
echo ""

echo "📋 Step 3: Refreshing materialized views..."
echo "Running initial data refresh..."
supabase db execute --sql "SELECT refresh_daily_engagement_metrics();"
echo "✅ Materialized views refreshed"
echo ""

echo "📋 Step 4: Backfilling DFS user statistics..."
echo "Calculating stats for existing users..."
supabase db execute --sql "SELECT * FROM recalculate_all_dfs_user_stats();"
echo "✅ DFS stats backfilled"
echo ""

echo "=================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "📊 What was deployed:"
echo "  ✓ user_engagement_sessions - Session duration tracking"
echo "  ✓ user_post_views - Individual post view analytics"
echo "  ✓ engagement_events - Granular event tracking"
echo "  ✓ dfs_user_statistics - DFS performance metrics"
echo "  ✓ daily_engagement_metrics - Daily aggregated view"
echo "  ✓ dfs_conversion_funnel - Conversion tracking view"
echo "  ✓ Auto-update triggers for real-time stats"
echo ""
echo "🎯 Next Steps:"
echo "  1. Deploy the updated frontend (with tracking hooks)"
echo "  2. Set up cron job to refresh materialized views daily:"
echo "     SELECT cron.schedule('refresh-engagement-metrics',"
echo "       '0 1 * * *', \$\$ SELECT refresh_daily_engagement_metrics(); \$\$);"
echo "  3. Access investor dashboard at /investor-dashboard"
echo "  4. Monitor engagement in Supabase dashboard"
echo ""
echo "💡 For Investors:"
echo "  - All metrics update in real-time"
echo "  - Data is anonymized and GDPR compliant"
echo "  - Export capability available for due diligence"
echo ""
echo "=================================================="

