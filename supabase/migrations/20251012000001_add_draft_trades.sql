-- Create draft trade offers table
CREATE TABLE IF NOT EXISTS draft_trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  from_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  to_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  
  -- What the offering team is giving away
  offered_players INTEGER[] DEFAULT '{}',
  offered_picks INTEGER[] DEFAULT '{}',
  
  -- What the offering team wants in return
  requested_players INTEGER[] DEFAULT '{}',
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
CREATE INDEX idx_draft_trade_offers_league ON draft_trade_offers(league_id);
CREATE INDEX idx_draft_trade_offers_from_team ON draft_trade_offers(from_team_id);
CREATE INDEX idx_draft_trade_offers_to_team ON draft_trade_offers(to_team_id);
CREATE INDEX idx_draft_trade_offers_status ON draft_trade_offers(status);
CREATE INDEX idx_draft_trade_offers_expires ON draft_trade_offers(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE draft_trade_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
CREATE OR REPLACE FUNCTION create_trade_offer(
  league_id_param UUID,
  from_team_id_param UUID,
  to_team_id_param UUID,
  offered_players_param INTEGER[],
  offered_picks_param INTEGER[],
  requested_players_param INTEGER[],
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
  
  -- Verify offering team owns the offered players
  IF array_length(offered_players_param, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(offered_players_param) AS pid
      WHERE NOT EXISTS (
        SELECT 1 FROM draft_picks dp
        WHERE dp.player_id = pid
          AND dp.fantasy_team_id = from_team_id_param
          AND dp.league_id = league_id_param
      )
    ) THEN
      RAISE EXCEPTION 'From team does not own all offered players';
    END IF;
  END IF;
  
  -- Verify receiving team owns the requested players
  IF array_length(requested_players_param, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(requested_players_param) AS pid
      WHERE NOT EXISTS (
        SELECT 1 FROM draft_picks dp
        WHERE dp.player_id = pid
          AND dp.fantasy_team_id = to_team_id_param
          AND dp.league_id = league_id_param
      )
    ) THEN
      RAISE EXCEPTION 'To team does not own all requested players';
    END IF;
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pending_trades_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_trade_offer(UUID, UUID, UUID, INTEGER[], INTEGER[], INTEGER[], INTEGER[]) TO authenticated;

