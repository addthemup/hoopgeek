-- Allow new feed post types: 'upcoming' and 'blog'
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
    'blog'
  ));
