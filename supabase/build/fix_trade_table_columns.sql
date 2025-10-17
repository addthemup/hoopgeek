-- =====================================================
-- FIX TRADE TABLE COLUMN TYPES
-- =====================================================
-- Update draft_trade_offers table to use UUID[] for player columns
-- instead of INTEGER[] to match the function signatures
-- =====================================================

-- First, drop the existing table completely to avoid type conflicts
DROP TABLE IF EXISTS draft_trade_offers CASCADE;

-- Recreate the table with correct UUID[] types for player columns
CREATE TABLE draft_trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  from_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  to_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  
  -- What the offering team is giving away (UUID[] for players)
  offered_players UUID[] DEFAULT '{}',
  offered_picks INTEGER[] DEFAULT '{}',
  
  -- What the offering team wants in return (UUID[] for players)
  requested_players UUID[] DEFAULT '{}',
  requested_picks INTEGER[] DEFAULT '{}',
  
  -- Trade status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
  responded_at TIMESTAMP WITH TIME ZONE,
  
  -- Response note
  response_note TEXT,
  
  CONSTRAINT different_teams CHECK (from_team_id != to_team_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_league ON draft_trade_offers(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_from_team ON draft_trade_offers(from_team_id);
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_to_team ON draft_trade_offers(to_team_id);
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_status ON draft_trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_expires ON draft_trade_offers(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE draft_trade_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view trades involving their team"
  ON draft_trade_offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fantasy_teams ft
      WHERE (ft.id = from_team_id OR ft.id = to_team_id)
        AND ft.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trades from their team"
  ON draft_trade_offers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fantasy_teams ft
      WHERE ft.id = from_team_id
        AND ft.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can respond to trades to their team"
  ON draft_trade_offers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fantasy_teams ft
      WHERE ft.id = to_team_id
        AND ft.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can cancel their own pending trades"
  ON draft_trade_offers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fantasy_teams ft
      WHERE ft.id = from_team_id
        AND ft.user_id = auth.uid()
    )
    AND status = 'pending'
  );

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed draft_trade_offers table with UUID[] columns for players';
    RAISE NOTICE '✅ Table recreated with correct data types';
    RAISE NOTICE '✅ Ready for UUID[] player arrays';
END $$;
