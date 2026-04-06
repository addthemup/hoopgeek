-- Link feed_posts to draft prospects (e.g. draft module posts that mention a prospect).
-- Enables prospect page to show "posts featuring this prospect" like player page.
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS draft_prospect_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_feed_posts_draft_prospect_ids
  ON feed_posts USING GIN (draft_prospect_ids);

COMMENT ON COLUMN feed_posts.draft_prospect_ids IS 'Draft prospect UUIDs (draft_prospects.id) featured in this post.';
