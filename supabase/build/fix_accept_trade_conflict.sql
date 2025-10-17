-- =====================================================
-- FIX ACCEPT_TRADE_OFFER FUNCTION CONFLICT
-- =====================================================
-- Drop all versions and recreate with correct signature
-- =====================================================

-- Drop all possible versions of accept_trade_offer
DROP FUNCTION IF EXISTS accept_trade_offer(UUID, UUID);
DROP FUNCTION IF EXISTS accept_trade_offer(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS accept_trade_offer(trade_id_param UUID, accepting_team_id_param UUID);
DROP FUNCTION IF EXISTS accept_trade_offer(trade_id_param UUID, accepting_team_id_param UUID, is_commissioner_param BOOLEAN);

-- Recreate with the correct signature (with is_commissioner_param and DEFAULT)
CREATE OR REPLACE FUNCTION accept_trade_offer(
  trade_id_param UUID, 
  accepting_team_id_param UUID,
  is_commissioner_param BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trade_record RECORD;
  is_commissioner BOOLEAN := FALSE;
  season_id_var UUID;
BEGIN
  -- Get the trade offer
  SELECT * INTO trade_record 
  FROM draft_trade_offers 
  WHERE id = trade_id_param AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade offer not found or not pending';
  END IF;
  
  -- Check if user is commissioner of the league (or passed in as param)
  IF is_commissioner_param THEN
    is_commissioner := TRUE;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM fantasy_leagues fl
      WHERE fl.id = trade_record.league_id 
        AND fl.commissioner_id = auth.uid()
    ) INTO is_commissioner;
  END IF;
  
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
    UPDATE fantasy_roster_spots 
    SET 
      fantasy_team_id = trade_record.to_team_id,
      assigned_at = NOW(),
      assigned_by = auth.uid()
    WHERE player_id = ANY(trade_record.offered_players)
      AND fantasy_team_id = trade_record.from_team_id;
  END IF;
  
  -- Move requested players from to_team to from_team
  IF array_length(trade_record.requested_players, 1) > 0 THEN
    UPDATE fantasy_roster_spots 
    SET 
      fantasy_team_id = trade_record.from_team_id,
      assigned_at = NOW(),
      assigned_by = auth.uid()
    WHERE player_id = ANY(trade_record.requested_players)
      AND fantasy_team_id = trade_record.to_team_id;
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
  
  -- Create transaction records for each player involved in the trade
  -- Get the season ID
  SELECT id INTO season_id_var 
  FROM fantasy_league_seasons 
  WHERE league_id = trade_record.league_id AND is_active = TRUE 
  LIMIT 1;
  
  -- Log 'add' transactions for offered players (to_team receives)
  IF array_length(trade_record.offered_players, 1) > 0 THEN
    INSERT INTO fantasy_transactions (
      league_id,
      season_id,
      fantasy_team_id,
      transaction_type,
      player_id,
      notes
    )
    SELECT 
      trade_record.league_id,
      season_id_var,
      trade_record.to_team_id,
      'add',
      unnest(trade_record.offered_players),
      'Received via trade';
    
    -- Log 'cut' transactions for offered players (from_team loses)
    INSERT INTO fantasy_transactions (
      league_id,
      season_id,
      fantasy_team_id,
      transaction_type,
      player_id,
      notes
    )
    SELECT 
      trade_record.league_id,
      season_id_var,
      trade_record.from_team_id,
      'cut',
      unnest(trade_record.offered_players),
      'Traded away';
  END IF;
  
  -- Log 'add' transactions for requested players (from_team receives)
  IF array_length(trade_record.requested_players, 1) > 0 THEN
    INSERT INTO fantasy_transactions (
      league_id,
      season_id,
      fantasy_team_id,
      transaction_type,
      player_id,
      notes
    )
    SELECT 
      trade_record.league_id,
      season_id_var,
      trade_record.from_team_id,
      'add',
      unnest(trade_record.requested_players),
      'Received via trade';
    
    -- Log 'cut' transactions for requested players (to_team loses)
    INSERT INTO fantasy_transactions (
      league_id,
      season_id,
      fantasy_team_id,
      transaction_type,
      player_id,
      notes
    )
    SELECT 
      trade_record.league_id,
      season_id_var,
      trade_record.to_team_id,
      'cut',
      unnest(trade_record.requested_players),
      'Traded away';
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION accept_trade_offer(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_trade_offer(UUID, UUID, BOOLEAN) TO service_role;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed accept_trade_offer function conflict';
    RAISE NOTICE '✅ Single function with is_commissioner_param (DEFAULT FALSE)';
    RAISE NOTICE '✅ Picks will now transfer between teams when trades are accepted';
END $$;

