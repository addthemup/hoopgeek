-- ============================================================================
-- DELETE ALL FEED POSTS
-- ============================================================================
-- This script safely deletes all feed posts and related data
-- It handles the cascade chain: feed_posts -> feed_content -> user_viewed_posts
-- ============================================================================
-- WARNING: This will delete ALL posts. Use with caution!
-- ============================================================================

-- Option 1: Delete all posts using DELETE (respects RLS and cascades)
-- This is the safest method as it respects foreign key cascades
BEGIN;

-- Delete all feed_posts (this will cascade to feed_content, which cascades to user_viewed_posts)
-- Also cascades to feed_likes, feed_comments, feed_shares if they reference feed_posts
DELETE FROM feed_posts;

-- Delete any algorithmic feed_content (not linked to posts)
DELETE FROM feed_content WHERE source_type = 'algorithmic';

-- Verify deletion
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

COMMIT;

-- ============================================================================
-- ALTERNATIVE: Using TRUNCATE with CASCADE (faster but bypasses triggers)
-- ============================================================================
-- Uncomment below if you want to use TRUNCATE instead
-- WARNING: TRUNCATE does not fire triggers and may bypass some constraints
-- NOTE: You must truncate ALL tables in the cascade chain together
-- ============================================================================

-- BEGIN;
-- 
-- -- Truncate all tables in the cascade chain together
-- -- The CASCADE option will handle the foreign key dependencies
-- TRUNCATE TABLE 
--   user_viewed_posts,
--   feed_content,
--   feed_posts
-- CASCADE;
-- 
-- COMMIT;

-- ============================================================================
-- OPTION 3: Delete using a SECURITY DEFINER function (bypasses RLS)
-- ============================================================================
-- This is useful if RLS is still blocking deletions
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_all_feed_posts()
RETURNS TABLE(
  deleted_posts INTEGER,
  deleted_content INTEGER,
  deleted_views INTEGER
) 
SECURITY DEFINER  -- Run with function owner's permissions (bypasses RLS)
AS $$
DECLARE
  v_posts_count INTEGER;
  v_content_count INTEGER;
  v_views_count INTEGER;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND is_active = TRUE
    AND role IN ('super_admin', 'content_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User is not an admin';
  END IF;

  -- Get counts before deletion
  SELECT COUNT(*) INTO v_posts_count FROM feed_posts;
  SELECT COUNT(*) INTO v_content_count FROM feed_content;
  SELECT COUNT(*) INTO v_views_count FROM user_viewed_posts;

  -- Delete in order (respecting foreign keys)
  -- user_viewed_posts will be deleted by cascade from feed_content
  -- feed_content will be deleted by cascade from feed_posts
  DELETE FROM feed_posts;
  
  -- Delete any remaining algorithmic content
  DELETE FROM feed_content WHERE source_type = 'algorithmic';

  RETURN QUERY SELECT v_posts_count, v_content_count, v_views_count;
END;
$$ LANGUAGE plpgsql;

-- To use the function:
-- SELECT * FROM delete_all_feed_posts();

-- Grant execute permission to authenticated users (RLS will check admin status)
GRANT EXECUTE ON FUNCTION delete_all_feed_posts() TO authenticated;

COMMENT ON FUNCTION delete_all_feed_posts IS
'Deletes all feed posts and related data. Requires admin privileges. Returns counts of deleted records.';

