-- Game page drawer module visibility and order (mirrors player_module_visibility / team_module_visibility).
-- Each row = one module on /game/:id. Controls which modules appear in the game drawer and their order.
-- Modules: basic_stats, advanced_stats, team_comparison, props, hit_rates.

CREATE TABLE IF NOT EXISTS game_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL UNIQUE,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_module_visibility_display_order
  ON game_module_visibility (display_order);

-- Seed: current game page modules (basic stats, advanced stats, team comparison, props, hit rates)
INSERT INTO game_module_visibility (module_name, is_visible, display_order) VALUES
  ('basic_stats',      true, 0),
  ('advanced_stats',   true, 1),
  ('team_comparison',  true, 2),
  ('props',            true, 3),
  ('hit_rates',        true, 4)
ON CONFLICT (module_name) DO NOTHING;

-- No RLS — global config table (admin-only writes via app).
COMMENT ON TABLE game_module_visibility IS 'Which modules show in the game page drawer and their order.';
