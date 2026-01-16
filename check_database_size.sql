-- Check total database size in Supabase
-- Run this in the Supabase SQL Editor

-- Method 1: Check total database size
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as total_database_size;

-- Method 2: Check size of each table
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Method 3: Get total size of all tables combined
SELECT 
    pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) AS total_size
FROM pg_tables
WHERE schemaname = 'public';

-- Method 4: Check size of specific large tables (common in NBA apps)
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size,
    pg_size_pretty(pg_relation_size('public.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size('public.'||tablename) - pg_relation_size('public.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('nba_players', 'nba_boxscores', 'nba_games', 'nba_teams', 'feed_posts')
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

