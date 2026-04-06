-- Mock draft game: admin-set draft order, user picks per slot, post-draft results + scores (points only for now).

-- ---- Admin-managed draft order (optional; when locked, Mock tab uses this instead of tank fallback) ----
CREATE TABLE IF NOT EXISTS draft_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_year smallint NOT NULL,
  label text,
  is_locked boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'tank_fallback')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_orders_year ON draft_orders (draft_year);
CREATE UNIQUE INDEX IF NOT EXISTS uq_draft_orders_one_active_per_year
  ON draft_orders (draft_year)
  WHERE is_active = true;

COMMENT ON TABLE draft_orders IS 'Official or practice draft order for mock game; when locked + active, overrides tank fallback.';

CREATE TABLE IF NOT EXISTS draft_order_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_order_id uuid NOT NULL REFERENCES draft_orders(id) ON DELETE CASCADE,
  pick_number integer NOT NULL CHECK (pick_number > 0),
  team_abbreviation text NOT NULL,
  round smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_order_id, pick_number)
);

CREATE INDEX IF NOT EXISTS idx_draft_order_picks_order ON draft_order_picks (draft_order_id, pick_number);

-- ---- User single-run mock per draft year ----
CREATE TABLE IF NOT EXISTS user_mock_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_year smallint NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  draft_order_id uuid REFERENCES draft_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_mock_drafts_user_year UNIQUE (user_id, draft_year)
);

CREATE INDEX IF NOT EXISTS idx_user_mock_drafts_user ON user_mock_drafts (user_id);

CREATE TABLE IF NOT EXISTS user_mock_draft_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_mock_draft_id uuid NOT NULL REFERENCES user_mock_drafts(id) ON DELETE CASCADE,
  pick_number integer NOT NULL CHECK (pick_number > 0),
  team_abbreviation text NOT NULL,
  draft_prospect_id uuid NOT NULL REFERENCES draft_prospects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_mock_draft_id, pick_number),
  UNIQUE (user_mock_draft_id, draft_prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mock_draft_picks_draft ON user_mock_draft_picks (user_mock_draft_id);

-- ---- Actual draft results (admin-entered after real draft) ----
CREATE TABLE IF NOT EXISTS mock_draft_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_year smallint NOT NULL,
  pick_number integer NOT NULL CHECK (pick_number > 0),
  team_abbreviation text NOT NULL,
  draft_prospect_id uuid REFERENCES draft_prospects(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_year, pick_number)
);

CREATE INDEX IF NOT EXISTS idx_mock_draft_results_year ON mock_draft_results (draft_year);

-- ---- Computed scores (points only; premium conversion later) ----
CREATE TABLE IF NOT EXISTS mock_draft_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_year smallint NOT NULL,
  points_total numeric(12, 2) NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, draft_year)
);

CREATE INDEX IF NOT EXISTS idx_mock_draft_scores_year ON mock_draft_scores (draft_year);

-- ---- RLS ----
ALTER TABLE draft_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_order_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mock_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mock_draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_draft_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_draft_scores ENABLE ROW LEVEL SECURITY;

-- Draft order: public read; admin users manage
CREATE POLICY "Anyone can read draft_orders"
  ON draft_orders FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin users manage draft_orders"
  ON draft_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Service role full draft_orders"
  ON draft_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read draft_order_picks"
  ON draft_order_picks FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin users manage draft_order_picks"
  ON draft_order_picks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Service role full draft_order_picks"
  ON draft_order_picks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User mock drafts
CREATE POLICY "Users read own mock drafts"
  ON user_mock_drafts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own mock drafts"
  ON user_mock_drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own mock drafts"
  ON user_mock_drafts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full user_mock_drafts"
  ON user_mock_drafts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users manage picks of own mock draft"
  ON user_mock_draft_picks FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_mock_drafts m WHERE m.id = user_mock_draft_picks.user_mock_draft_id AND m.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_mock_drafts m WHERE m.id = user_mock_draft_picks.user_mock_draft_id AND m.user_id = auth.uid())
  );

CREATE POLICY "Service role full user_mock_draft_picks"
  ON user_mock_draft_picks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Results: public read; admin write
CREATE POLICY "Anyone can read mock_draft_results"
  ON mock_draft_results FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin users manage mock_draft_results"
  ON mock_draft_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Service role full mock_draft_results"
  ON mock_draft_results FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Scores: users read own; admin can manage (recompute)
CREATE POLICY "Users read own mock_draft_scores"
  ON mock_draft_scores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin users manage mock_draft_scores"
  ON mock_draft_scores FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Service role full mock_draft_scores"
  ON mock_draft_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
