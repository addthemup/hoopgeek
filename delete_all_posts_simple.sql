-- ============================================================================
-- QUICK DELETE: Delete all feed posts
-- ============================================================================
-- Run this in your Supabase SQL editor
-- This will delete all posts and related data
-- ============================================================================

-- First, make sure you've run fix_user_viewed_posts_delete_policy.sql
-- Otherwise the cascade deletes might be blocked by RLS

BEGIN;

-- Delete all feed_posts (cascades to feed_content, which cascades to user_viewed_posts)
DELETE FROM feed_posts;

-- Delete any algorithmic feed_content (not linked to posts)
DELETE FROM feed_content WHERE source_type = 'algorithmic';

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

