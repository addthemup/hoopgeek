-- Allow section_type 'video_carousel' for MP4 slide carousels
-- Content shape: { "clips": [ { "mp4": "https://...", "description": "...", "action_type": "...", "period": 1, "clock": "4:22" } ] }

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
    'box_score'
  ));

COMMENT ON COLUMN feed_post_sections.content IS 'JSONB payload — shape depends on section_type. video_carousel: { clips: [{ mp4, description?, action_type?, period?, clock? }] }';
