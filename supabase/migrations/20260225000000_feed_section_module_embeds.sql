-- Add section types for module embeds (injury, props, team of night, team of week).
-- These store frozen data and render with the same display components as the live feed modules.

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
    'tweet_embed',
    'injury_module',
    'prop_module',
    'team_of_night_module',
    'team_of_week_module'
  ));

COMMENT ON COLUMN feed_post_sections.content IS
  'JSONB payload — shape depends on section_type. injury_module: { injuries[], teams[], date }. prop_module: { props[], teams[], date, mode }. team_of_night_module: { players[], date }. team_of_week_module: { players[], week_name, start_date, end_date }.';
