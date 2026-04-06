-- Post type 'dfs' for DFS-related feed posts (pools, entries, leaderboards).
-- Section type 'dfs_module' for frozen DFS snapshot content.

ALTER TABLE feed_posts
  DROP CONSTRAINT IF EXISTS feed_posts_post_type_check;

ALTER TABLE feed_posts
  ADD CONSTRAINT feed_posts_post_type_check
  CHECK (post_type IN (
    'game_recap',
    'player_spotlight',
    'team_of_night',
    'team_of_week',
    'player_of_week',
    'player_of_month',
    'prop_prediction',
    'prop_results',
    'injury_report',
    'upcoming',
    'blog',
    'draft',
    'dfs'
  ));

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
    'team_of_week_module',
    'tank_module',
    'dfs_module'
  ));

COMMENT ON COLUMN feed_post_sections.content IS
  'JSONB — dfs_module: DfsModuleContent (snapshot_date, pools?, message?).';
