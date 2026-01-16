-- ============================================================================
-- TRUNCATE ALL POSTS (Fast method)
-- ============================================================================
-- Use this if you want to use TRUNCATE instead of DELETE
-- Faster but bypasses triggers
-- ============================================================================
-- IMPORTANT: You must include ALL tables in the foreign key chain
-- ============================================================================

BEGIN;

-- Truncate all tables in the cascade chain together
-- The order matters - start with child tables (user_viewed_posts) 
-- and work up to parent tables (feed_posts)
-- CASCADE handles all foreign key dependencies
TRUNCATE TABLE 
  user_viewed_posts,
  feed_content,
  feed_posts
CASCADE;

COMMIT;

-- Verify everything is deleted
SELECT 
  'feed_posts' as table_name,
  COUNT(*) as remaining_count
FROM feed_posts
UNION ALL
SELECT 
  'feed_content' as table_name,
  COUNT(*) as remaining_count
FROM feed_content
UNION ALL
SELECT 
  'user_viewed_posts' as table_name,
  COUNT(*) as remaining_count
FROM user_viewed_posts;

