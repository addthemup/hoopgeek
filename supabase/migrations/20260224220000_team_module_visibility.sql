-- Team page module visibility and layout (mirrors player_module_visibility).
-- Each row = one module on /team/:id. Controls which modules appear in the
-- team drawer and their order.

CREATE TABLE IF NOT EXISTS team_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL UNIQUE,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_module_visibility_display_order
  ON team_module_visibility (display_order);

-- Seed rows: the five current team page modules
INSERT INTO team_module_visibility (module_name, is_visible, display_order) VALUES
  ('player_dashboard', true, 0),
  ('rebounding',       true, 1),
  ('shot_dashboard',   true, 2),
  ('game_logs',        true, 3),
  ('four_factors',     true, 4)
ON CONFLICT (module_name) DO NOTHING;

-- No RLS — global config table (matches player_module_visibility / feed_module_visibility).
-- Admin writes via the authenticated Supabase client.

COMMENT ON TABLE team_module_visibility IS 'Which modules show in the team page drawer and their order.';
