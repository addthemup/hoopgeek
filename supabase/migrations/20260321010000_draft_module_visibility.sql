-- Draft page drawer module visibility and order (mirrors player/prospect/game module visibility tables).

CREATE TABLE IF NOT EXISTS draft_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_name text NOT NULL UNIQUE,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_module_visibility_display_order
  ON draft_module_visibility (display_order);

INSERT INTO draft_module_visibility (module_name, is_visible, display_order) VALUES
  ('draft_trend', true, 0),
  ('my_board_summary', true, 1)
ON CONFLICT (module_name) DO NOTHING;

COMMENT ON TABLE draft_module_visibility IS 'Which modules show in the /draft drawer and their order.';
