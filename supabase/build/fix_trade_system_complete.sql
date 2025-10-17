-- =====================================================
-- COMPLETE TRADE SYSTEM FIX
-- =====================================================
-- This script completely rebuilds the trade system with correct UUID[] types
-- =====================================================

-- Step 1: Drop all existing trade-related objects
DROP TABLE IF EXISTS fantasy_draft_trade_offers CASCADE;
DROP TABLE IF EXISTS draft_trade_offers CASCADE;

-- Drop all trade functions
DROP FUNCTION IF EXISTS get_pending_trades_count(UUID);
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, INTEGER[], INTEGER[], INTEGER[], INTEGER[]);
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, INTEGER[], INTEGER[], UUID[], INTEGER[]);
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, UUID[], INTEGER[], INTEGER[], INTEGER[]);
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, UUID[], INTEGER[], UUID[], INTEGER[]);
DROP FUNCTION IF EXISTS accept_trade_offer(UUID, UUID);
DROP FUNCTION IF EXISTS reject_trade_offer(UUID, UUID);
DROP FUNCTION IF EXISTS get_pending_draft_trades(UUID, UUID);

-- Step 2: Create the table with correct UUID[] types
CREATE TABLE draft_trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
  from_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  to_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  
  -- UUID[] for players, INTEGER[] for picks
  offered_players UUID[] DEFAULT '{}',
  offered_picks INTEGER[] DEFAULT '{}',
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

-- Step 3: Create indexes
CREATE INDEX idx_draft_trade_offers_league ON draft_trade_offers(league_id);
CREATE INDEX idx_draft_trade_offers_from_team ON draft_trade_offers(from_team_id);
CREATE INDEX idx_draft_trade_offers_to_team ON draft_trade_offers(to_team_id);
CREATE INDEX idx_draft_trade_offers_status ON draft_trade_offers(status);
CREATE INDEX idx_draft_trade_offers_expires ON draft_trade_offers(expires_at) WHERE status = 'pending';

-- Step 4: Enable RLS
ALTER TABLE draft_trade_offers ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
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

-- Step 6: Create functions with correct signatures

-- Function to get pending trades count
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
CREATE OR REPLACE FUNCTION accept_trade_offer(trade_id_param UUID, accepting_team_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_record RECORD;
  is_commissioner BOOLEAN := FALSE;
  offered_players_moved INTEGER := 0;
  offered_player_ids_moved UUID[];
  requested_players_moved INTEGER := 0;
  requested_player_ids_moved UUID[];
BEGIN
  -- Get the trade offer
  SELECT * INTO trade_record 
  FROM draft_trade_offers 
  WHERE id = trade_id_param AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade offer not found or not pending';
  END IF;
  
  -- Check if user is commissioner of the league
  SELECT EXISTS (
    SELECT 1 FROM fantasy_leagues fl
    WHERE fl.id = trade_record.league_id 
      AND fl.commissioner_id = auth.uid()
  ) INTO is_commissioner;
  
  -- Validate that the accepting team is the recipient (unless commissioner)
  IF NOT is_commissioner AND trade_record.to_team_id != accepting_team_id_param THEN
    RAISE EXCEPTION 'You can only accept trade offers sent to your team';
  END IF;
  
  -- Validate that user is the owner of the accepting team (unless commissioner)
  IF NOT is_commissioner AND NOT EXISTS (
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
  
  -- Execute the trade by moving players between teams
  -- Move offered players from from_team to to_team
  IF array_length(trade_record.offered_players, 1) > 0 THEN
    RAISE NOTICE '🔄 Moving % offered players from team % to team %', 
      array_length(trade_record.offered_players, 1), 
      trade_record.from_team_id, 
      trade_record.to_team_id;
    RAISE NOTICE '📦 Offered player IDs: %', trade_record.offered_players;
    
    WITH updated_rows AS (
      UPDATE fantasy_roster_spots 
      SET 
        fantasy_team_id = trade_record.to_team_id,
        assigned_at = NOW(),
        assigned_by = auth.uid()
      WHERE player_id = ANY(trade_record.offered_players)
        AND fantasy_team_id = trade_record.from_team_id
      RETURNING player_id, fantasy_team_id
    )
    SELECT COUNT(*), array_agg(player_id) INTO offered_players_moved, offered_player_ids_moved
    FROM updated_rows;
    
    RAISE NOTICE '✅ Moved % offered players: %', offered_players_moved, offered_player_ids_moved;
  END IF;
  
  -- Move requested players from to_team to from_team
  IF array_length(trade_record.requested_players, 1) > 0 THEN
    RAISE NOTICE '🔄 Moving % requested players from team % to team %', 
      array_length(trade_record.requested_players, 1), 
      trade_record.to_team_id, 
      trade_record.from_team_id;
    RAISE NOTICE '📦 Requested player IDs: %', trade_record.requested_players;
    
    WITH updated_rows AS (
      UPDATE fantasy_roster_spots 
      SET 
        fantasy_team_id = trade_record.from_team_id,
        assigned_at = NOW(),
        assigned_by = auth.uid()
      WHERE player_id = ANY(trade_record.requested_players)
        AND fantasy_team_id = trade_record.to_team_id
      RETURNING player_id, fantasy_team_id
    )
    SELECT COUNT(*), array_agg(player_id) INTO requested_players_moved, requested_player_ids_moved
    FROM updated_rows;
    
    RAISE NOTICE '✅ Moved % requested players: %', requested_players_moved, requested_player_ids_moved;
  END IF;
  
  -- Update draft order to reflect pick trades
  -- Move offered picks from from_team to to_team
  IF array_length(trade_record.offered_picks, 1) > 0 THEN
    UPDATE fantasy_draft_order 
    SET 
      -- Initialize original_team_id if this is the first trade
      original_team_id = COALESCE(original_team_id, fantasy_team_id),
      -- Set new current owner
      current_team_id = trade_record.to_team_id,
      is_traded = true,
      trade_count = COALESCE(trade_count, 0) + 1,
      updated_at = NOW()
    WHERE pick_number = ANY(trade_record.offered_picks)
      AND league_id = trade_record.league_id
      -- Match picks owned by from_team (either as original owner or current owner)
      AND (
        (current_team_id IS NULL AND fantasy_team_id = trade_record.from_team_id) -- Original owner
        OR current_team_id = trade_record.from_team_id -- Current owner (already traded)
      );
  END IF;
  
  -- Move requested picks from to_team to from_team
  IF array_length(trade_record.requested_picks, 1) > 0 THEN
    UPDATE fantasy_draft_order 
    SET 
      -- Initialize original_team_id if this is the first trade
      original_team_id = COALESCE(original_team_id, fantasy_team_id),
      -- Set new current owner
      current_team_id = trade_record.from_team_id,
      is_traded = true,
      trade_count = COALESCE(trade_count, 0) + 1,
      updated_at = NOW()
    WHERE pick_number = ANY(trade_record.requested_picks)
      AND league_id = trade_record.league_id
      -- Match picks owned by to_team (either as original owner or current owner)
      AND (
        (current_team_id IS NULL AND fantasy_team_id = trade_record.to_team_id) -- Original owner
        OR current_team_id = trade_record.to_team_id -- Current owner (already traded)
      );
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to reject a trade offer
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
  offered_players JSONB,
  offered_picks JSONB,
  requested_players JSONB,
  requested_picks JSONB,
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
    -- Convert player UUIDs to full player objects
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', np.id,
            'name', np.name,
            'position', np.position,
            'team_abbreviation', np.team_abbreviation,
            'nba_player_id', np.nba_player_id,
            'salary_2025_26', COALESCE(nhs.salary_2025_26, 0)
          )
        )
        FROM unnest(dto.offered_players) AS player_id
        LEFT JOIN nba_players np ON np.id = player_id
        LEFT JOIN nba_hoopshype_salaries nhs ON nhs.player_id = np.id
      ),
      '[]'::jsonb
    ) as offered_players,
    -- Convert pick numbers to full pick objects
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'pick_number', pick_num,
            'round', ((pick_num - 1) / (SELECT COUNT(*) FROM fantasy_teams ft_count WHERE ft_count.league_id = p_league_id)) + 1,
            'team_position', ((pick_num - 1) % (SELECT COUNT(*) FROM fantasy_teams ft_count WHERE ft_count.league_id = p_league_id)) + 1,
            'is_completed', false
          )
        )
        FROM unnest(dto.offered_picks) AS pick_num
      ),
      '[]'::jsonb
    ) as offered_picks,
    -- Convert requested player UUIDs to full player objects
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', np.id,
            'name', np.name,
            'position', np.position,
            'team_abbreviation', np.team_abbreviation,
            'nba_player_id', np.nba_player_id,
            'salary_2025_26', COALESCE(nhs.salary_2025_26, 0)
          )
        )
        FROM unnest(dto.requested_players) AS player_id
        LEFT JOIN nba_players np ON np.id = player_id
        LEFT JOIN nba_hoopshype_salaries nhs ON nhs.player_id = np.id
      ),
      '[]'::jsonb
    ) as requested_players,
    -- Convert requested pick numbers to full pick objects
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'pick_number', pick_num,
            'round', ((pick_num - 1) / (SELECT COUNT(*) FROM fantasy_teams ft_count WHERE ft_count.league_id = p_league_id)) + 1,
            'team_position', ((pick_num - 1) % (SELECT COUNT(*) FROM fantasy_teams ft_count WHERE ft_count.league_id = p_league_id)) + 1,
            'is_completed', false
          )
        )
        FROM unnest(dto.requested_picks) AS pick_num
      ),
      '[]'::jsonb
    ) as requested_picks,
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

-- Step 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pending_trades_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_trade_offer(UUID, UUID, UUID, UUID[], INTEGER[], UUID[], INTEGER[]) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_trade_offer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_trade_offer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_draft_trades(UUID, UUID) TO authenticated;

-- Step 8: Verification
DO $$
BEGIN
    RAISE NOTICE '✅ Trade system completely rebuilt with UUID[] for players';
    RAISE NOTICE '✅ All old objects dropped and recreated';
    RAISE NOTICE '✅ Functions have correct signatures';
    RAISE NOTICE '✅ Table has correct column types';
    RAISE NOTICE '✅ Ready for UUID player IDs';
END $$;
