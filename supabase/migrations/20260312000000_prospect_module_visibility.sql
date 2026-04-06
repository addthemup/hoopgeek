-- Prospect page drawer module visibility and order (mirrors player_module_visibility / team_module_visibility).
-- Each row = one module on /prospect/:id. Controls which modules appear in the prospect drawer and their order.

CREATE TABLE IF NOT EXISTS prospect_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL UNIQUE,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_module_visibility_display_order
  ON prospect_module_visibility (display_order);

-- Seed: current prospect drawer module
INSERT INTO prospect_module_visibility (module_name, is_visible, display_order) VALUES
  ('ranking_over_time', true, 0)
ON CONFLICT (module_name) DO NOTHING;

-- No RLS — global config table (admin-only writes via app).
COMMENT ON TABLE prospect_module_visibility IS 'Which modules show in the prospect page drawer and their order.';
