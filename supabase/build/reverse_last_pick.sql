-- ============================================================================
-- REVERSE LAST PICK (COMMISSIONER TOOL)
-- ============================================================================
-- This function allows commissioners to undo the last pick in the draft.
-- It deletes the most recent pick, resets the draft state, and restarts the timer.
-- ============================================================================

CREATE OR REPLACE FUNCTION reverse_last_pick(
  league_id_param UUID,
  commissioner_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_pick RECORD;
  previous_pick RECORD;
  result JSON;
BEGIN
  -- Verify user is commissioner
  IF NOT EXISTS (
    SELECT 1 FROM fantasy_leagues
    WHERE id = league_id_param
    AND commissioner_id = commissioner_user_id
  ) THEN
    RAISE EXCEPTION 'Only the commissioner can reverse picks';
  END IF;

  -- Get the most recent completed pick
  SELECT * INTO last_pick
  FROM fantasy_draft_picks
  WHERE league_id = league_id_param
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No picks to reverse';
  END IF;

  -- Get the pick info from draft order
  SELECT * INTO previous_pick
  FROM fantasy_draft_order
  WHERE league_id = league_id_param
  AND pick_number = last_pick.pick_number;

  -- Delete the pick from fantasy_draft_picks
  DELETE FROM fantasy_draft_picks
  WHERE id = last_pick.id;

  -- Delete the player from fantasy_roster_spots (if they were added)
  DELETE FROM fantasy_roster_spots
  WHERE fantasy_team_id = last_pick.fantasy_team_id
  AND player_id = last_pick.player_id
  AND season_id = (
    SELECT id FROM fantasy_league_seasons
    WHERE league_id = league_id_param
    AND is_active = true
    LIMIT 1
  );

  -- Reset the pick in fantasy_draft_order
  UPDATE fantasy_draft_order
  SET 
    is_completed = false,
    auto_pick_reason = NULL,
    time_started = NOW(),
    time_expires = NOW() + INTERVAL '60 seconds'  -- Default 60 second timer
  WHERE league_id = league_id_param
  AND pick_number = last_pick.pick_number;

  -- Update draft current state to point to this pick
  UPDATE fantasy_draft_current_state
  SET 
    current_pick_number = last_pick.pick_number,
    updated_at = NOW()
  WHERE league_id = league_id_param;

  -- Log the commissioner action in fantasy_transactions
  INSERT INTO fantasy_transactions (
    league_id,
    season_id,
    fantasy_team_id,
    transaction_type,
    player_id,
    notes,
    processed_by
  ) VALUES (
    league_id_param,
    (SELECT id FROM fantasy_league_seasons WHERE league_id = league_id_param AND is_active = true LIMIT 1),
    last_pick.fantasy_team_id,
    'cut',
    last_pick.player_id,
    'Pick reversed by commissioner',
    commissioner_user_id
  );

  -- Build result
  result := json_build_object(
    'success', true,
    'message', 'Pick reversed successfully',
    'reversed_pick', json_build_object(
      'pick_number', last_pick.pick_number,
      'player_id', last_pick.player_id,
      'team_id', last_pick.fantasy_team_id,
      'round', previous_pick.round
    ),
    'new_current_pick', last_pick.pick_number
  );

  RAISE NOTICE 'Pick #% reversed by commissioner', last_pick.pick_number;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reverse_last_pick TO authenticated;

COMMENT ON FUNCTION reverse_last_pick IS 'Allows commissioner to undo the most recent draft pick. Deletes the pick, removes player from roster, and resets the timer.';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ reverse_last_pick function created successfully!';
    RAISE NOTICE '✅ Commissioner can now undo the last pick';
    RAISE NOTICE '✅ Deletes pick, removes from roster, and resets timer';
    RAISE NOTICE '';
END $$;

