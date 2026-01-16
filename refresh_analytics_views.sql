-- Refresh Analytics Materialized Views
-- Run this to update the analytics dashboard with latest data
-- NOTE: Make sure unique indexes exist first (run fix_analytics_views_indexes.sql)

-- Refresh daily engagement metrics (requires unique index on metric_date)
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_engagement_metrics;

-- Refresh DFS conversion funnel (requires unique index on cohort_week)
REFRESH MATERIALIZED VIEW CONCURRENTLY dfs_conversion_funnel;

-- Check if there's any data in the source tables
SELECT 
  'user_engagement_sessions' as table_name,
  COUNT(*) as row_count,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(session_start) as earliest_session,
  MAX(session_start) as latest_session
FROM user_engagement_sessions
UNION ALL
SELECT 
  'daily_engagement_metrics' as table_name,
  COUNT(*) as row_count,
  COUNT(DISTINCT daily_active_users) as unique_users,
  MIN(metric_date) as earliest_session,
  MAX(metric_date) as latest_session
FROM daily_engagement_metrics
UNION ALL
SELECT 
  'dfs_conversion_funnel' as table_name,
  COUNT(*) as row_count,
  COUNT(DISTINCT total_users) as unique_users,
  MIN(cohort_week) as earliest_session,
  MAX(cohort_week) as latest_session
FROM dfs_conversion_funnel;

