-- Fix make_draft_pick to respect fantasy_team_id (traded picks)
-- This ensures players go to the correct team after pick trades

CREATE OR REPLACE FUNCTION make_draft_pick(
  league_id_param UUID,
  draft_order_id_param UUID,
  player_id_param INTEGER
)
RETURNS JSONB AS $$
DECLARE
  pick_record RECORD;
  team_id UUID;
  available_spot RECORD;
  result JSONB;
BEGIN
  -- Get pick details
  SELECT * INTO pick_record
  FROM draft_order
  WHERE id = draft_order_id_param AND league_id = league_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft pick not found';
  END IF;
  
  IF pick_record.is_completed THEN
    RAISE EXCEPTION 'This pick has already been completed';
  END IF;
  
  -- ✅ FIX: Get the team for this pick
  -- If fantasy_team_id is set (pick was traded), use that
  -- Otherwise, compute from team_position (original owner)
  IF pick_record.fantasy_team_id IS NOT NULL THEN
    -- Pick was traded - use the new owner
    team_id := pick_record.fantasy_team_id;
    RAISE NOTICE 'Pick was traded to team %', team_id;
  ELSE
    -- Pick was not traded - use original owner based on team_position
    SELECT id INTO team_id
    FROM fantasy_teams
    WHERE league_id = league_id_param
    ORDER BY id
    OFFSET (pick_record.team_position - 1)
    LIMIT 1;
    
    IF team_id IS NULL THEN
      RAISE EXCEPTION 'Could not find team for pick position %', pick_record.team_position;
    END IF;
  END IF;
  
  -- Check if player has already been drafted
  IF EXISTS(SELECT 1 FROM draft_picks WHERE league_id = league_id_param AND player_id = player_id_param) THEN
    RAISE EXCEPTION 'Player has already been drafted';
  END IF;
  
  -- Create the draft pick record
  INSERT INTO draft_picks (
    league_id,
    player_id,
    fantasy_team_id,
    pick_number,
    round
  ) VALUES (
    league_id_param,
    player_id_param,
    team_id,
    pick_record.pick_number,
    pick_record.round
  );
  
  -- Mark draft_order as completed
  UPDATE draft_order
  SET is_completed = true
  WHERE id = draft_order_id_param;
  
  -- Assign player to team's first available roster spot
  SELECT id, roster_spot_id, position INTO available_spot
  FROM fantasy_team_players
  WHERE fantasy_team_id = team_id
    AND player_id IS NULL
  LIMIT 1;
  
  IF FOUND THEN
    UPDATE fantasy_team_players
    SET player_id = player_id_param
    WHERE id = available_spot.id;
  END IF;
  
  -- Update draft_current_state completed_picks
  UPDATE draft_current_state
  SET 
    completed_picks = completed_picks + 1,
    last_activity_at = NOW()
  WHERE league_id = league_id_param;
  
  -- Return success with details
  result := jsonb_build_object(
    'success', true,
    'pick_number', pick_record.pick_number,
    'round', pick_record.round,
    'team_id', team_id,
    'player_id', player_id_param,
    'was_traded', pick_record.fantasy_team_id IS NOT NULL
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION make_draft_pick IS 'Completes a draft pick: creates draft_picks record, assigns to roster, marks draft_order complete. Respects fantasy_team_id for traded picks.';

