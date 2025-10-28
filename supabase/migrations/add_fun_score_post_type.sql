-- ============================================================================
-- Add 'fun_score' post type to feed_post_type enum
-- ============================================================================

-- Add the new value to the enum
ALTER TYPE feed_post_type ADD VALUE IF NOT EXISTS 'fun_score';

-- Update comment for documentation
COMMENT ON TYPE feed_post_type IS 'Post types: game_highlight, buzzer_beater, player_spotlight, rookie_watch, team_performance, stat_showcase, comparison, milestone, fun_score, custom';

