-- ============================================================================
-- DRAFT MANAGEMENT MIGRATION
-- Adds autodraft functionality and draft state tracking
-- ============================================================================

-- Add autodraft_enabled to fantasy_teams (per-team autodraft setting)
ALTER TABLE fantasy_teams 
ADD COLUMN IF NOT EXISTS autodraft_enabled BOOLEAN DEFAULT false;

-- Add draft timing and autopick fields to draft_order
ALTER TABLE draft_order
ADD COLUMN IF NOT EXISTS time_started TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS time_expires TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS time_extensions_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_auto_picked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_pick_reason TEXT;

-- Add draft settings to league_settings
ALTER TABLE league_settings
ADD COLUMN IF NOT EXISTS draft_time_per_pick INTEGER DEFAULT 60, -- seconds per pick (default 60)
ADD COLUMN IF NOT EXISTS draft_auto_pick_enabled BOOLEAN DEFAULT true; -- enable auto-pick when timer expires

-- Create draft_current_state table (tracks live draft state)
CREATE TABLE IF NOT EXISTS draft_current_state (
  league_id UUID PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  current_pick_id UUID REFERENCES draft_order(id),
  current_pick_number INTEGER,
  current_round INTEGER,
  draft_status TEXT CHECK (draft_status IN ('scheduled', 'in_progress', 'paused', 'completed')) DEFAULT 'scheduled',
  draft_started_at TIMESTAMP WITH TIME ZONE,
  draft_completed_at TIMESTAMP WITH TIME ZONE,
  draft_paused_at TIMESTAMP WITH TIME ZONE,
  total_picks INTEGER DEFAULT 0,
  completed_picks INTEGER DEFAULT 0,
  is_auto_pick_active BOOLEAN DEFAULT true, -- League-wide autopick toggle
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for draft_current_state
CREATE INDEX IF NOT EXISTS idx_draft_current_state_status ON draft_current_state(draft_status);
CREATE INDEX IF NOT EXISTS idx_draft_current_state_pick ON draft_current_state(current_pick_id);

-- Create index for draft_order time queries
CREATE INDEX IF NOT EXISTS idx_draft_order_time_expires ON draft_order(time_expires) WHERE is_completed = false;

-- Enable RLS for draft_current_state
ALTER TABLE draft_current_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for draft_current_state
CREATE POLICY "Allow league members to read draft state" ON draft_current_state
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to manage draft state" ON draft_current_state
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow service role to manage draft state" ON draft_current_state
  FOR ALL USING (auth.role() = 'service_role');

-- Add trigger for draft_current_state updated_at
CREATE TRIGGER update_draft_current_state_updated_at 
    BEFORE UPDATE ON draft_current_state 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create index on fantasy_teams.autodraft_enabled for quick lookups
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_autodraft ON fantasy_teams(autodraft_enabled);

COMMENT ON TABLE draft_current_state IS 'Tracks the current state of active drafts for real-time management';
COMMENT ON COLUMN fantasy_teams.autodraft_enabled IS 'When true, this team will auto-pick with 3-second timer. Set automatically when timer expires.';
COMMENT ON COLUMN draft_order.is_auto_picked IS 'True if this pick was made automatically (not manually by user)';
COMMENT ON COLUMN draft_order.auto_pick_reason IS 'Reason for auto-pick: time_expired, autodraft_enabled, commissioner_pick, etc.';
COMMENT ON COLUMN league_settings.draft_time_per_pick IS 'Seconds allowed per pick (default 60). Teams with autodraft_enabled use 3 seconds.';

