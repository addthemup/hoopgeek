-- Fix Materialized View Indexes for Concurrent Refresh
-- These views need unique indexes to support CONCURRENTLY refresh

-- Drop existing non-unique index if it exists
DROP INDEX IF EXISTS idx_daily_engagement_date;

-- Create unique index on daily_engagement_metrics (metric_date should be unique per day)
CREATE UNIQUE INDEX idx_daily_engagement_date_unique 
ON daily_engagement_metrics(metric_date DESC);

-- Check if dfs_conversion_funnel has a unique index
-- If not, create one (cohort_week should be unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'dfs_conversion_funnel' 
    AND indexname LIKE '%unique%'
  ) THEN
    -- Drop existing non-unique index if exists
    DROP INDEX IF EXISTS idx_dfs_conversion_cohort;
    
    -- Create unique index on cohort_week
    CREATE UNIQUE INDEX idx_dfs_conversion_cohort_unique 
    ON dfs_conversion_funnel(cohort_week DESC);
  END IF;
END $$;

-- Now refresh both views concurrently
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_engagement_metrics;
REFRESH MATERIALIZED VIEW CONCURRENTLY dfs_conversion_funnel;

-- Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('daily_engagement_metrics', 'dfs_conversion_funnel')
ORDER BY tablename, indexname;

