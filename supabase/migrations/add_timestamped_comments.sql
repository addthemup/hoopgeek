-- Migration: Add timestamped comments support (SoundCloud-style)
-- Adds timestamp and slide tracking to feed_comments table
-- Version: 2025-01-XX

-- ============================================================================
-- ADD NEW COLUMNS TO feed_comments TABLE
-- ============================================================================

-- Add slide_index to track which slide (video/image) the comment is on
ALTER TABLE public.feed_comments
ADD COLUMN IF NOT EXISTS slide_index INTEGER DEFAULT 0;

-- Add timestamp_seconds for video timestamp (NULL for non-video slides)
ALTER TABLE public.feed_comments
ADD COLUMN IF NOT EXISTS timestamp_seconds NUMERIC(10,2);

-- Add position_x and position_y for non-video slides (0-100 percentage)
ALTER TABLE public.feed_comments
ADD COLUMN IF NOT EXISTS position_x NUMERIC(5,2);
ALTER TABLE public.feed_comments
ADD COLUMN IF NOT EXISTS position_y NUMERIC(5,2);

-- ============================================================================
-- ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for efficient timestamp queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_feed_comments_timestamp 
ON public.feed_comments(content_id, slide_index, timestamp_seconds)
WHERE timestamp_seconds IS NOT NULL;

-- Index for slide-based queries
CREATE INDEX IF NOT EXISTS idx_feed_comments_slide 
ON public.feed_comments(content_id, slide_index);

-- Composite index for querying comments by content and slide
CREATE INDEX IF NOT EXISTS idx_feed_comments_content_slide 
ON public.feed_comments(content_id, slide_index, created_at DESC);

-- ============================================================================
-- ADD COLUMN COMMENTS
-- ============================================================================

COMMENT ON COLUMN feed_comments.slide_index IS 
  'Index of the slide (0-based) this comment is associated with. For video slides, used with timestamp_seconds.';

COMMENT ON COLUMN feed_comments.timestamp_seconds IS 
  'Video timestamp in seconds when comment was made (for SoundCloud-style comments). NULL for non-video slides or general comments.';

COMMENT ON COLUMN feed_comments.position_x IS 
  'X position as percentage (0-100) for comments on non-video slides (images, charts, etc).';

COMMENT ON COLUMN feed_comments.position_y IS 
  'Y position as percentage (0-100) for comments on non-video slides (images, charts, etc).';

-- ============================================================================
-- UPDATE COMMENTS_COUNT TRIGGER (if exists)
-- ============================================================================

-- Note: The comments_count is denormalized in feed_posts table
-- This migration doesn't modify the count logic, but future queries
-- can filter by slide_index and timestamp_seconds
