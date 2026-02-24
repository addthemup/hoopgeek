-- Add section_type 'game_log' for player game log tables in POW/POM posts.
-- Content shape: {
--   "player_name": "Cade Cunningham",
--   "player_id": 1630595,
--   "team_tricode": "DET",
--   "period_label": "November 2025",
--   "rows": [{ game_date, matchup, min, pts, reb, ast, stl, blk, tov, fgm, fga, fg3m, fg3a, ftm, fta, plus_minus }],
--   "averages": { gp, ppg, rpg, apg, spg, bpg, topg, fg_pct, fg3_pct, ft_pct }
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
    'post_link'
  ));
