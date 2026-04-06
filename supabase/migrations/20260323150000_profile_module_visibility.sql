-- /profile "Your tools" module list — same pattern as feed_module_visibility (global config, no RLS).

CREATE TABLE IF NOT EXISTS profile_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL UNIQUE,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  grid_size integer NOT NULL DEFAULT 12,
  grid_size_mobile integer NOT NULL DEFAULT 12,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_module_visibility_display_order
  ON profile_module_visibility (display_order);

INSERT INTO profile_module_visibility (module_name, is_visible, display_order, grid_size, grid_size_mobile) VALUES
  ('favorite_players',   true, 0, 12, 12),
  ('dfs_pools',          true, 1, 12, 12),
  ('slip_builder',       true, 2, 12, 12),
  ('prop_predictions',   true, 3, 12, 12),
  ('prop_performance',   true, 4, 12, 12),
  ('draft',              true, 5, 12, 12)
ON CONFLICT (module_name) DO NOTHING;

COMMENT ON TABLE profile_module_visibility IS 'Which feed-equivalent modules appear on /profile (stacked). Admin: PROFILE UI.';

ALTER TABLE profile_module_visibility DISABLE ROW LEVEL SECURITY;
