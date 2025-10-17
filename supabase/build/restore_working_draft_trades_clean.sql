-- =====================================================
-- RESTORE WORKING DRAFT TRADES SCHEMA
-- =====================================================
-- Restore the old working draft_trade_offers table structure
-- This was the schema that actually worked before
-- =====================================================

-- Drop the complex fantasy_draft_trade_offers table
DROP TABLE IF EXISTS fantasy_draft_trade_offers CASCADE;

-- Drop existing draft_trade_offers table to ensure clean recreation
DROP TABLE IF EXISTS draft_trade_offers CASCADE;

-- Create the simple working draft_trade_offers table
CREATE TABLE IF NOT EXISTS draft_trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  from_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  to_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  
  -- What the offering team is giving away
  offered_players UUID[] DEFAULT '{}',
  offered_picks INTEGER[] DEFAULT '{}',
  
  -- What the offering team wants in return
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

-- Create indexes for performance (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_league ON draft_trade_offers(league_id);
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_from_team ON draft_trade_offers(from_team_id);
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_to_team ON draft_trade_offers(to_team_id);
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_status ON draft_trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_expires ON draft_trade_offers(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE draft_trade_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop existing ones first)
DROP POLICY IF EXISTS "Users can view trades involving their team" ON draft_trade_offers;
DROP POLICY IF EXISTS "Users can create trades from their team" ON draft_trade_offers;
DROP POLICY IF EXISTS "Users can respond to trades to their team" ON draft_trade_offers;
DROP POLICY IF EXISTS "Users can cancel their own pending trades" ON draft_trade_offers;

-- Users can view trades involving their team
CREATE POLICY "Users can view trades involving their team"
  ON draft_trade_offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fantasy_teams ft
      WHERE (ft.id = from_team_id OR ft.id = to_team_id)
        AND ft.user_id = auth.uid()
    )
  );

-- Users can create trades from their team
CREATE POLICY "Users can create trades from their team"
  ON draft_trade_offers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fantasy_teams ft
      WHERE ft.id = from_team_id
        AND ft.user_id = auth.uid()
    )
  );

-- Users can update trades to their team (accept/reject)
CREATE POLICY "Users can respond to trades to their team"
  ON draft_trade_offers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM fantasy_teams ft
      WHERE ft.id = to_team_id
        AND ft.user_id = auth.uid()
    )
  );

-- Users can cancel their own pending trades
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

-- Function to get pending trades count for a team
DROP FUNCTION IF EXISTS get_pending_trades_count(UUID);
CREATE OR REPLACE FUNCTION get_pending_trades_count(team_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO trade_count
  FROM draft_trade_offers
  WHERE (from_team_id = team_id_param OR to_team_id = team_id_param)
    AND status = 'pending'
    AND expires_at > NOW();
  
  RETURN trade_count;
END;
$$;

-- Function to create a trade offer
-- Drop all possible versions to avoid conflicts
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, INTEGER[], INTEGER[], INTEGER[], INTEGER[]);
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, INTEGER[], INTEGER[], UUID[], INTEGER[]);
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, UUID[], INTEGER[], INTEGER[], INTEGER[]);
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, UUID[], INTEGER[], UUID[], INTEGER[]);

CREATE OR REPLACE FUNCTION create_trade_offer(
  league_id_param UUID,
  from_team_id_param UUID,
  to_team_id_param UUID,
  offered_players_param UUID[],
  offered_picks_param INTEGER[],
  requested_players_param UUID[],
  requested_picks_param INTEGER[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_trade_id UUID;
BEGIN
  -- Verify teams are in the same league
  IF NOT EXISTS (
    SELECT 1 FROM fantasy_teams
    WHERE id = from_team_id_param AND league_id = league_id_param
  ) THEN
    RAISE EXCEPTION 'Invalid from_team_id for this league';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM fantasy_teams
    WHERE id = to_team_id_param AND league_id = league_id_param
  ) THEN
    RAISE EXCEPTION 'Invalid to_team_id for this league';
  END IF;
  
  -- Create the trade offer
  INSERT INTO draft_trade_offers (
    league_id,
    from_team_id,
    to_team_id,
    offered_players,
    offered_picks,
    requested_players,
    requested_picks,
    status,
    expires_at
  ) VALUES (
    league_id_param,
    from_team_id_param,
    to_team_id_param,
    offered_players_param,
    offered_picks_param,
    requested_players_param,
    requested_picks_param,
    'pending',
    NOW() + INTERVAL '5 minutes'
  )
  RETURNING id INTO new_trade_id;
  
  RETURN new_trade_id;
END;
$$;

-- Function to accept a trade offer
DROP FUNCTION IF EXISTS accept_trade_offer(UUID, UUID);
CREATE OR REPLACE FUNCTION accept_trade_offer(trade_id_param UUID, accepting_team_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_record RECORD;
BEGIN
  -- Get the trade offer
  SELECT * INTO trade_record 
  FROM draft_trade_offers 
  WHERE id = trade_id_param AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade offer not found or not pending';
  END IF;
  
  -- Validate that the accepting team is the recipient
  IF trade_record.to_team_id != accepting_team_id_param THEN
    RAISE EXCEPTION 'You can only accept trade offers sent to your team';
  END IF;
  
  -- Validate that user is the owner of the accepting team
  IF NOT EXISTS (
    SELECT 1 FROM fantasy_teams 
    WHERE id = accepting_team_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only accept trade offers for your own team';
  END IF;
  
  -- Check if trade has expired
  IF trade_record.expires_at < NOW() THEN
    UPDATE draft_trade_offers 
    SET status = 'expired' 
    WHERE id = trade_id_param;
    RAISE EXCEPTION 'Trade offer has expired';
  END IF;
  
  -- Accept the trade
  UPDATE draft_trade_offers 
  SET 
    status = 'accepted',
    responded_at = NOW()
  WHERE id = trade_id_param;
  
  RETURN TRUE;
END;
$$;

-- Function to reject a trade offer
DROP FUNCTION IF EXISTS reject_trade_offer(UUID, UUID);
CREATE OR REPLACE FUNCTION reject_trade_offer(trade_id_param UUID, rejecting_team_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_record RECORD;
BEGIN
  -- Get the trade offer
  SELECT * INTO trade_record 
  FROM draft_trade_offers 
  WHERE id = trade_id_param AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade offer not found or not pending';
  END IF;
  
  -- Validate that the rejecting team is either sender or recipient
  IF trade_record.from_team_id != rejecting_team_id_param AND trade_record.to_team_id != rejecting_team_id_param THEN
    RAISE EXCEPTION 'You can only reject trade offers involving your team';
  END IF;
  
  -- Validate that user is the owner of the rejecting team
  IF NOT EXISTS (
    SELECT 1 FROM fantasy_teams 
    WHERE id = rejecting_team_id_param AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only reject trade offers for your own team';
  END IF;
  
  -- Reject the trade
  UPDATE draft_trade_offers 
  SET 
    status = 'rejected',
    responded_at = NOW()
  WHERE id = trade_id_param;
  
  RETURN TRUE;
END;
$$;

-- Function to get pending trades for a team
-- Drop existing function first to handle return type changes
DROP FUNCTION IF EXISTS get_pending_draft_trades(UUID, UUID);

CREATE OR REPLACE FUNCTION get_pending_draft_trades(
  p_team_id UUID,
  p_league_id UUID
)
RETURNS TABLE (
  id UUID,
  league_id UUID,
  from_team_id UUID,
  from_team_name TEXT,
  to_team_id UUID,
  to_team_name TEXT,
  offered_players UUID[],
  offered_picks INTEGER[],
  requested_players UUID[],
  requested_picks INTEGER[],
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dto.id,
    dto.league_id,
    dto.from_team_id,
    ft_from.team_name as from_team_name,
    dto.to_team_id,
    ft_to.team_name as to_team_name,
    dto.offered_players,
    dto.offered_picks,
    dto.requested_players,
    dto.requested_picks,
    dto.status,
    dto.created_at,
    dto.expires_at,
    dto.responded_at
  FROM draft_trade_offers dto
  LEFT JOIN fantasy_teams ft_from ON dto.from_team_id = ft_from.id
  LEFT JOIN fantasy_teams ft_to ON dto.to_team_id = ft_to.id
  WHERE dto.league_id = p_league_id
    AND (dto.from_team_id = p_team_id OR dto.to_team_id = p_team_id)
    AND dto.status = 'pending'
    AND dto.expires_at > NOW()
  ORDER BY dto.created_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pending_trades_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_trade_offer(UUID, UUID, UUID, UUID[], INTEGER[], UUID[], INTEGER[]) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_trade_offer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_trade_offer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_draft_trades(UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Working draft trades schema restored successfully!';
    RAISE NOTICE '✅ Table: draft_trade_offers (simple structure)';
    RAISE NOTICE '✅ Functions: create_trade_offer, accept_trade_offer, reject_trade_offer';
    RAISE NOTICE '✅ RLS policies configured';
    RAISE NOTICE '✅ Indexes created for performance';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 This restores the old working schema that actually functioned';
    RAISE NOTICE '📋 Simple UUID[] arrays for players and INTEGER[] for picks';
    RAISE NOTICE '🔄 Clean trade flow: create → accept/reject → execute';
    RAISE NOTICE '';
END $$;
