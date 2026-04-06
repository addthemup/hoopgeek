-- Slip Builder: saved parlays built from player props. One slip per user with many legs.
-- Stores everything needed to display and later resolve the slip (outcomes, payout).

CREATE TABLE IF NOT EXISTS user_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  stake_cents integer NOT NULL DEFAULT 0,
  total_odds_decimal numeric(12, 4) NOT NULL,
  potential_payout_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled_won', 'settled_lost', 'void', 'cancelled')),
  game_date date,
  created_at timestamptz DEFAULT now(),
  settled_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_slips_user_id ON user_slips (user_id);
CREATE INDEX IF NOT EXISTS idx_user_slips_status ON user_slips (status);
CREATE INDEX IF NOT EXISTS idx_user_slips_created_at ON user_slips (created_at DESC);

COMMENT ON TABLE user_slips IS 'User-built parlay slips from Prop Predictions; stake and total odds stored for tracking.';

-- One row per leg (one player prop in the parlay). Snapshot of prop at add time.
CREATE TABLE IF NOT EXISTS slip_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id uuid NOT NULL REFERENCES user_slips(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  player_prop_id uuid REFERENCES player_props(id) ON DELETE SET NULL,
  nba_player_id bigint,
  player_name text NOT NULL,
  bet_type text NOT NULL,
  line numeric(10, 2) NOT NULL,
  side text NOT NULL CHECK (side IN ('over', 'under')),
  odds_american text,
  odds_decimal numeric(10, 4) NOT NULL,
  game_id uuid,
  game_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slip_legs_slip_id ON slip_legs (slip_id);

COMMENT ON TABLE slip_legs IS 'One leg per player prop in a saved slip; snapshot for display and resolution.';

-- RLS
ALTER TABLE user_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE slip_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own slips"
  ON user_slips FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage legs of own slips"
  ON slip_legs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_slips WHERE user_slips.id = slip_legs.slip_id AND user_slips.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_slips WHERE user_slips.id = slip_legs.slip_id AND user_slips.user_id = auth.uid())
  );

-- Add slip_builder to feed drawer modules (if table already has rows, insert new module)
INSERT INTO feed_module_visibility (module_name, is_visible, display_order, grid_size, grid_size_mobile)
SELECT 'slip_builder', true, 14, 4, 12
WHERE NOT EXISTS (SELECT 1 FROM feed_module_visibility WHERE module_name = 'slip_builder');
