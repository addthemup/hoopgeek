-- ============================================================================
-- PLAYER PROP RESULTS TABLE
-- ============================================================================
-- Stores calculated hit rates for player props after games are final
-- Updated nightly by edge function that compares props with boxscores
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.player_prop_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  player_id UUID REFERENCES nba_players(id) ON DELETE CASCADE,
  nba_player_id INTEGER NOT NULL,
  game_id VARCHAR(50) NOT NULL, -- nba_games.game_id
  game_date DATE NOT NULL,
  
  -- Hit Rate Metrics
  total_props INTEGER NOT NULL DEFAULT 0,
  overs_hit INTEGER NOT NULL DEFAULT 0,
  unders_hit INTEGER NOT NULL DEFAULT 0,
  pushes INTEGER NOT NULL DEFAULT 0,
  hit_rate NUMERIC(5,2) NOT NULL, -- Percentage (0-100)
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_player_game UNIQUE(nba_player_id, game_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prop_results_player_date ON player_prop_results(nba_player_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_prop_results_game ON player_prop_results(game_id);
CREATE INDEX IF NOT EXISTS idx_prop_results_player_id ON player_prop_results(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prop_results_date ON player_prop_results(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_prop_results_hit_rate ON player_prop_results(hit_rate DESC);

-- Update trigger for updated_at
CREATE TRIGGER update_player_prop_results_updated_at
  BEFORE UPDATE ON player_prop_results
  FOR EACH ROW
  EXECUTE FUNCTION update_player_props_updated_at();

-- Enable RLS
ALTER TABLE player_prop_results ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read access to authenticated users
CREATE POLICY "Allow read access to player_prop_results"
  ON player_prop_results
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow service role to insert/update
CREATE POLICY "Allow service role to manage player_prop_results"
  ON player_prop_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

