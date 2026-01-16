-- ============================================================================
-- PERFORMANCE INDEX FOR FEED POSTS QUERIES
-- ============================================================================
-- This index optimizes the common query pattern:
-- SELECT * FROM feed_posts 
-- WHERE status = 'published' 
-- ORDER BY game_date DESC
-- LIMIT 200
--
-- The composite index on (status, game_date DESC) with a WHERE clause
-- allows PostgreSQL to efficiently filter and sort in one operation.
-- ============================================================================

-- Drop existing index if it exists (idempotent)
DROP INDEX IF EXISTS idx_feed_posts_published_game_date;

-- Create composite index for published posts ordered by game_date
CREATE INDEX idx_feed_posts_published_game_date 
ON feed_posts(status, game_date DESC NULLS LAST)
WHERE status = 'published';

-- Add comment for documentation
COMMENT ON INDEX idx_feed_posts_published_game_date IS 
'Composite index for efficient querying of published posts by game_date. Optimizes the feed loading query pattern.';

