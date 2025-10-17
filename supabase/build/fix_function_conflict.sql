-- =====================================================
-- FIX FUNCTION CONFLICT
-- =====================================================
-- This script fixes the function conflict for accept_trade_offer
-- =====================================================

-- Drop all existing versions of accept_trade_offer function
DROP FUNCTION IF EXISTS accept_trade_offer(UUID, UUID);
DROP FUNCTION IF EXISTS accept_trade_offer(UUID, UUID, BOOLEAN);

-- Create the single, correct version with all parameters
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
  
  -- Update draft order to reflect pick trades
  -- Move offered picks from from_team to to_team
  IF array_length(trade_record.offered_picks, 1) > 0 THEN
    FOREACH pick_number_val IN ARRAY trade_record.offered_picks
    LOOP
      UPDATE fantasy_draft_order 
      SET 
        current_team_id = trade_record.to_team_id,
        is_traded = true,
        trade_count = trade_count + 1,
        updated_at = NOW()
      WHERE pick_number = pick_number_val 
        AND league_id = trade_record.league_id
        AND current_team_id = trade_record.from_team_id;
        
      -- Log the pick movement
      RAISE NOTICE 'Moved pick % from team % to team %', 
        pick_number_val, trade_record.from_team_id, trade_record.to_team_id;
    END LOOP;
  END IF;
  
  -- Move requested picks from to_team to from_team
  IF array_length(trade_record.requested_picks, 1) > 0 THEN
    FOREACH pick_number_val IN ARRAY trade_record.requested_picks
    LOOP
      UPDATE fantasy_draft_order 
      SET 
        current_team_id = trade_record.from_team_id,
        is_traded = true,
        trade_count = trade_count + 1,
        updated_at = NOW()
      WHERE pick_number = pick_number_val 
        AND league_id = trade_record.league_id
        AND current_team_id = trade_record.to_team_id;
        
      -- Log the pick movement
      RAISE NOTICE 'Moved pick % from team % to team %', 
        pick_number_val, trade_record.to_team_id, trade_record.from_team_id;
    END LOOP;
  END IF;
  
  -- Create individual transaction records for each player being traded
  -- Move offered players from from_team to to_team (cut from from_team, add to to_team)
  IF array_length(trade_record.offered_players, 1) > 0 THEN
    FOREACH player_id_val IN ARRAY trade_record.offered_players
    LOOP
      -- Create 'cut' transaction for the team giving up the player
      INSERT INTO fantasy_transactions (
        league_id,
        season_id,
        fantasy_team_id,
        transaction_type,
        player_id,
        notes,
        processed_by
      ) VALUES (
        trade_record.league_id,
        (SELECT id FROM fantasy_league_seasons WHERE league_id = trade_record.league_id AND is_active = true LIMIT 1),
        trade_record.from_team_id,
        'cut',
        player_id_val,
        'Traded to ' || (SELECT team_name FROM fantasy_teams WHERE id = trade_record.to_team_id),
        auth.uid()
      );
      
      -- Create 'add' transaction for the team receiving the player
      INSERT INTO fantasy_transactions (
        league_id,
        season_id,
        fantasy_team_id,
        transaction_type,
        player_id,
        notes,
        processed_by
      ) VALUES (
        trade_record.league_id,
        (SELECT id FROM fantasy_league_seasons WHERE league_id = trade_record.league_id AND is_active = true LIMIT 1),
        trade_record.to_team_id,
        'add',
        player_id_val,
        'Received from ' || (SELECT team_name FROM fantasy_teams WHERE id = trade_record.from_team_id),
        auth.uid()
      );
    END LOOP;
  END IF;
  
  -- Move requested players from to_team to from_team (cut from to_team, add to from_team)
  IF array_length(trade_record.requested_players, 1) > 0 THEN
    FOREACH player_id_val IN ARRAY trade_record.requested_players
    LOOP
      -- Create 'cut' transaction for the team giving up the player
      INSERT INTO fantasy_transactions (
        league_id,
        season_id,
        fantasy_team_id,
        transaction_type,
        player_id,
        notes,
        processed_by
      ) VALUES (
        trade_record.league_id,
        (SELECT id FROM fantasy_league_seasons WHERE league_id = trade_record.league_id AND is_active = true LIMIT 1),
        trade_record.to_team_id,
        'cut',
        player_id_val,
        'Traded to ' || (SELECT team_name FROM fantasy_teams WHERE id = trade_record.from_team_id),
        auth.uid()
      );
      
      -- Create 'add' transaction for the team receiving the player
      INSERT INTO fantasy_transactions (
        league_id,
        season_id,
        fantasy_team_id,
        transaction_type,
        player_id,
        notes,
        processed_by
      ) VALUES (
        trade_record.league_id,
        (SELECT id FROM fantasy_league_seasons WHERE league_id = trade_record.league_id AND is_active = true LIMIT 1),
        trade_record.from_team_id,
        'add',
        player_id_val,
        'Received from ' || (SELECT team_name FROM fantasy_teams WHERE id = trade_record.to_team_id),
        auth.uid()
      );
    END LOOP;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION accept_trade_offer(UUID, UUID, BOOLEAN) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed function conflict for accept_trade_offer';
    RAISE NOTICE '✅ Now only one version exists with proper parameters';
    RAISE NOTICE '✅ Commissioner force accept should work correctly';
END $$;
