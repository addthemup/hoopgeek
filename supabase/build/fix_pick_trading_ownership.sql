-- =====================================================
-- FIX PICK TRADING OWNERSHIP
-- =====================================================
-- The issue: When picks are traded, we update current_team_id
-- but make_draft_pick and the frontend check fantasy_team_id
-- to determine who can make the pick.
-- 
-- Solution: Update fantasy_team_id (the actual owner) when
-- trading picks, and keep original_team_id for history.
-- =====================================================

DROP FUNCTION IF EXISTS accept_trade_offer(UUID, UUID, BOOLEAN);

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
  is_commissioner BOOLEAN := is_commissioner_param;
  player_id_val UUID;
  pick_number_val INTEGER;
BEGIN
  -- Get the trade offer
  SELECT * INTO trade_record 
  FROM draft_trade_offers 
  WHERE id = trade_id_param AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade offer not found or not pending';
  END IF;
  
  -- Check if user is commissioner of the league (if not already set)
  IF NOT is_commissioner THEN
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
    FOREACH player_id_val IN ARRAY trade_record.offered_players
    LOOP
      UPDATE fantasy_roster_spots 
      SET 
        fantasy_team_id = trade_record.to_team_id,
        assigned_at = NOW(),
        assigned_by = auth.uid()
      WHERE player_id = player_id_val
        AND fantasy_team_id = trade_record.from_team_id;
        
      -- Log the player movement
      RAISE NOTICE 'Moved player % from team % to team %', 
        player_id_val, trade_record.from_team_id, trade_record.to_team_id;
    END LOOP;
  END IF;
  
  -- Move requested players from to_team to from_team
  IF array_length(trade_record.requested_players, 1) > 0 THEN
    FOREACH player_id_val IN ARRAY trade_record.requested_players
    LOOP
      UPDATE fantasy_roster_spots 
      SET 
        fantasy_team_id = trade_record.from_team_id,
        assigned_at = NOW(),
        assigned_by = auth.uid()
      WHERE player_id = player_id_val
        AND fantasy_team_id = trade_record.to_team_id;
        
      -- Log the player movement
      RAISE NOTICE 'Moved player % from team % to team %', 
        player_id_val, trade_record.to_team_id, trade_record.from_team_id;
    END LOOP;
  END IF;
  
  -- ⚠️ KEY FIX: Update fantasy_team_id (actual ownership) when trading picks
  -- Move offered picks from from_team to to_team
  IF array_length(trade_record.offered_picks, 1) > 0 THEN
    FOREACH pick_number_val IN ARRAY trade_record.offered_picks
    LOOP
      UPDATE fantasy_draft_order 
      SET 
        -- Store original owner if this is the first trade
        original_team_id = COALESCE(original_team_id, fantasy_team_id),
        -- Update the actual owner (this is what make_draft_pick checks!)
        fantasy_team_id = trade_record.to_team_id,
        -- Also update current_team_id for tracking
        current_team_id = trade_record.to_team_id,
        is_traded = true,
        trade_count = trade_count + 1,
        updated_at = NOW()
      WHERE pick_number = pick_number_val 
        AND league_id = trade_record.league_id
        AND fantasy_team_id = trade_record.from_team_id;
        
      -- Log the pick movement
      RAISE NOTICE 'Moved pick % ownership from team % to team % (fantasy_team_id updated)', 
        pick_number_val, trade_record.from_team_id, trade_record.to_team_id;
    END LOOP;
  END IF;
  
  -- Move requested picks from to_team to from_team
  IF array_length(trade_record.requested_picks, 1) > 0 THEN
    FOREACH pick_number_val IN ARRAY trade_record.requested_picks
    LOOP
      UPDATE fantasy_draft_order 
      SET 
        -- Store original owner if this is the first trade
        original_team_id = COALESCE(original_team_id, fantasy_team_id),
        -- Update the actual owner (this is what make_draft_pick checks!)
        fantasy_team_id = trade_record.from_team_id,
        -- Also update current_team_id for tracking
        current_team_id = trade_record.from_team_id,
        is_traded = true,
        trade_count = trade_count + 1,
        updated_at = NOW()
      WHERE pick_number = pick_number_val 
        AND league_id = trade_record.league_id
        AND fantasy_team_id = trade_record.to_team_id;
        
      -- Log the pick movement
      RAISE NOTICE 'Moved pick % ownership from team % to team % (fantasy_team_id updated)', 
        pick_number_val, trade_record.to_team_id, trade_record.from_team_id;
    END LOOP;
  END IF;
  
  -- Note: fantasy_transactions table only supports 'add' and 'cut' types
  -- Trade history is already tracked in draft_trade_offers table
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_trade_offer(UUID, UUID, BOOLEAN) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed pick trading to update fantasy_team_id (actual ownership)';
    RAISE NOTICE '✅ Picks will now be draftable by the team that traded for them';
    RAISE NOTICE '✅ original_team_id still tracks the original owner for history';
END $$;

