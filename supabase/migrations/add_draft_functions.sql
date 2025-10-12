-- ============================================================================
-- DRAFT MANAGEMENT FUNCTIONS
-- Functions for auto-picking players and making draft picks
-- ============================================================================

-- Function: Get best available player for auto-draft
-- Uses ESPN projections to find the best undrafted player
CREATE OR REPLACE FUNCTION get_best_available_player(
  league_id_param UUID,
  team_id_param UUID DEFAULT NULL
)
RETURNS TABLE(
  id INTEGER,
  name TEXT,
  "position" TEXT,
  team_name TEXT,
  team_abbreviation TEXT,
  salary_2025_26 BIGINT,
  projected_fantasy_points NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.position,
    p.team_name,
    p.team_abbreviation,
    p.salary_2025_26,
    -- Calculate projected fantasy points from ESPN projections
    COALESCE(
      (
        (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
        (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
        (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
        (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
        (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
      )::NUMERIC,
      0
    ) as projected_fantasy_points
  FROM players p
  LEFT JOIN espn_player_projections ep ON ep.player_id = p.id
  WHERE 
    -- Player is active
    p.is_active = true
    -- Player hasn't been drafted yet in this league
    AND p.id NOT IN (
      SELECT dp.player_id 
      FROM draft_picks dp 
      WHERE dp.league_id = league_id_param
    )
  ORDER BY projected_fantasy_points DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Make a draft pick
-- This function handles the entire draft pick process:
-- 1. Creates draft_pick record
-- 2. Assigns player to team's roster
-- 3. Marks draft_order as completed
-- 4. Updates draft_current_state
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
  
  -- Get the team for this pick (based on team_position)
  SELECT id INTO team_id
  FROM fantasy_teams
  WHERE league_id = league_id_param
  ORDER BY id
  OFFSET (pick_record.team_position - 1)
  LIMIT 1;
  
  IF team_id IS NULL THEN
    RAISE EXCEPTION 'Could not find team for pick position %', pick_record.team_position;
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
    'player_id', player_id_param
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_best_available_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_available_player TO service_role;
GRANT EXECUTE ON FUNCTION make_draft_pick TO authenticated;
GRANT EXECUTE ON FUNCTION make_draft_pick TO service_role;

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available undrafted player based on ESPN projections';
COMMENT ON FUNCTION make_draft_pick IS 'Completes a draft pick: creates draft_picks record, assigns to roster, marks draft_order complete';

