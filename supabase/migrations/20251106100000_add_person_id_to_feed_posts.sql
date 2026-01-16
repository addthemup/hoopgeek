-- ============================================================================
-- ADD person_id COLUMN TO feed_posts TABLE
-- ============================================================================
-- This migration adds a person_id field to track the primary player
-- for player_spotlight posts. For fun_score posts, this will be null.
-- ============================================================================

-- Add person_id column (nullable BIGINT to match NBA person IDs)
ALTER TABLE feed_posts
ADD COLUMN IF NOT EXISTS person_id BIGINT;

-- Add index for efficient queries filtering by person_id
CREATE INDEX IF NOT EXISTS idx_feed_posts_person_id 
ON feed_posts(person_id)
WHERE person_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN feed_posts.person_id IS 
'Primary player ID for player_spotlight posts. Null for fun_score and other post types.';

