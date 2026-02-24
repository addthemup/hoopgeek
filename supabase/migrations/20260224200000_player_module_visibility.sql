-- Player page module visibility and layout (mirrors feed_module_visibility).
-- Each row = one module on /player/:id. Controls which modules appear in the
-- player drawer and their order. Modules: game_logs, props, stats, info,
-- injuries, awards (more to come).

CREATE TABLE IF NOT EXISTS player_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL UNIQUE,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_module_visibility_display_order
  ON player_module_visibility (display_order);

-- Seed rows: the six current player page modules
INSERT INTO player_module_visibility (module_name, is_visible, display_order) VALUES
  ('game_logs',  true, 0),
  ('props',      true, 1),
  ('stats',      true, 2),
  ('info',       true, 3),
  ('injuries',   true, 4),
  ('awards',     true, 5)
ON CONFLICT (module_name) DO NOTHING;

-- No RLS — this is a global config table (matches feed_module_visibility).
-- Admin writes via the authenticated Supabase client.

COMMENT ON TABLE player_module_visibility IS 'Which modules show in the player page drawer and their order.';
