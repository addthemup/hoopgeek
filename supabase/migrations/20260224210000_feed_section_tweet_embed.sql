-- Add section_type 'tweet_embed' for official X (Twitter) embedded tweets.
-- Content shape: {
--   "tweet_url": "https://x.com/ShamsCharania/status/1234567890",
--   "tweet_id": "1234567890",
--   "caption": "Source:",
--   "fallback_text": "Shams Charania: LeBron James is listed as questionable..."
-- }

ALTER TABLE feed_post_sections
  DROP CONSTRAINT IF EXISTS feed_post_sections_section_type_check;

ALTER TABLE feed_post_sections
  ADD CONSTRAINT feed_post_sections_section_type_check
  CHECK (section_type IN (
    'hero',
    'headline',
    'lineup_card',
    'player_highlight',
    'stat_comparison',
    'video_clip',
    'video_carousel',
    'chart',
    'rich_text',
    'prop_card',
    'injury_card',
    'pull_quote',
    'gallery',
    'box_score',
    'game_log',
    'post_link',
    'tweet_embed'
  ));

COMMENT ON COLUMN feed_post_sections.content IS
  'JSONB payload — shape depends on section_type. tweet_embed: { tweet_url, tweet_id?, caption?, fallback_text? }';
