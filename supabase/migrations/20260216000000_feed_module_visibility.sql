-- Feed page module visibility and layout (mirrors today_module_visibility concept).
-- Each row = one module on /feed/. grid_size = desktop (md), grid_size_mobile = mobile (xs).
-- MUI Grid: 12 columns; 4 = 1/3, 8 = 2/3, 12 = full.

CREATE TABLE IF NOT EXISTS feed_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL UNIQUE,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  grid_size integer NOT NULL DEFAULT 4,
  grid_size_mobile integer NOT NULL DEFAULT 12,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_module_visibility_display_order
  ON feed_module_visibility (display_order);

-- Seed rows: all modules available on /today/ plus feed_posts
INSERT INTO feed_module_visibility (module_name, is_visible, display_order, grid_size, grid_size_mobile) VALUES
  ('games_carousel',     true, 0,  12, 12),
  ('feed_posts',         true, 1,  12, 12),
  ('prop_predictions',   true, 2,  8,  12),
  ('prop_performance',   true, 3,  8,  12),
  ('standings',          true, 4,  4,  12),
  ('favorite_players',   true, 5,  4,  12),
  ('team_of_night_live', true, 6,  4,  12),
  ('team_of_night_past', true, 7,  8,  12),
  ('leaders',            true, 8,  4,  12),
  ('injuries',           true, 9,  4,  12),
  ('team_of_week',       true, 10, 8,  12),
  ('best_games',         true, 11, 8,  12)
ON CONFLICT (module_name) DO NOTHING;

COMMENT ON TABLE feed_module_visibility IS 'Which modules show on /feed/ and their layout (grid size desktop + mobile).';
