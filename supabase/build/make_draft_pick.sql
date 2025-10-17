-- =====================================================
-- MAKE DRAFT PICK FUNCTION
-- =====================================================
-- This function handles making a draft pick by:
-- 1. Creating a record in fantasy_draft_picks
-- 2. Updating fantasy_draft_order to mark as completed
-- 3. Adding player to team's roster
-- 4. Updating draft current state
-- =====================================================

CREATE OR REPLACE FUNCTION make_draft_pick(
    league_id_param UUID,
    draft_order_id_param UUID,
    player_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    draft_order_record RECORD;
    team_record RECORD;
    player_record RECORD;
    season_id_val UUID;
    available_spot_id UUID;
    result JSONB;
BEGIN
    -- Get draft order information
    SELECT 
        fdo.*,
        ft.id as team_id,
        ft.team_name,
        fls.id as season_id
    INTO draft_order_record
    FROM fantasy_draft_order fdo
    INNER JOIN fantasy_teams ft ON fdo.fantasy_team_id = ft.id
    INNER JOIN fantasy_league_seasons fls ON fdo.season_id = fls.id
    WHERE fdo.id = draft_order_id_param
    AND fdo.league_id = league_id_param;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Draft order not found',
            'message', 'The specified draft order does not exist.'
        );
    END IF;

    -- Check if pick is already completed
    IF draft_order_record.is_completed THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Pick already completed',
            'message', 'This pick has already been made.'
        );
    END IF;

    -- Get player information
    SELECT * INTO player_record
    FROM nba_players
    WHERE id = player_id_param;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Player not found',
            'message', 'The specified player does not exist.'
        );
    END IF;

    -- Check if player is already drafted in this league
    IF EXISTS (
        SELECT 1 FROM fantasy_draft_picks 
        WHERE league_id = league_id_param 
        AND player_id = player_id_param
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Player already drafted',
            'message', 'This player has already been drafted.'
        );
    END IF;

    -- Create draft pick record
    INSERT INTO fantasy_draft_picks (
        league_id,
        season_id,
        draft_order_id,
        pick_number,
        round,
        team_position,
        fantasy_team_id,
        player_id,
        is_auto_pick,
        auto_pick_reason,
        pick_time_used,
        created_at
    ) VALUES (
        league_id_param,
        draft_order_record.season_id,
        draft_order_id_param,
        draft_order_record.pick_number,
        draft_order_record.round,
        draft_order_record.team_position,
        draft_order_record.team_id,
        player_id_param,
        FALSE, -- Manual pick
        'manual_pick',
        EXTRACT(EPOCH FROM (NOW() - COALESCE(draft_order_record.time_started, NOW()))),
        NOW()
    );

    -- Mark pick as completed in draft order
    UPDATE fantasy_draft_order
    SET 
        is_completed = TRUE,
        time_started = COALESCE(time_started, NOW()),
        time_expires = NOW(),
        updated_at = NOW()
    WHERE id = draft_order_id_param;

    -- Add player to team's roster (find first available roster spot)
    -- Find the first available roster spot for this team
    SELECT id INTO available_spot_id
    FROM fantasy_roster_spots
    WHERE fantasy_team_id = draft_order_record.team_id
    AND player_id IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- If no available spot found, this is an error
    IF available_spot_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'No available roster spots',
            'message', 'Team roster is full - no available spots for new player.'
        );
    END IF;
    
    -- Update the available roster spot with the new player
    UPDATE fantasy_roster_spots
    SET 
        player_id = player_id_param,
        assigned_at = NOW(),
        assigned_by = NULL, -- System assigned (auto-pick)
        draft_round = draft_order_record.round,
        draft_pick = draft_order_record.pick_number,
        updated_at = NOW()
    WHERE id = available_spot_id;

    -- Update draft current state
    UPDATE fantasy_draft_current_state
    SET 
        completed_picks = completed_picks + 1,
        last_activity_at = NOW(),
        updated_at = NOW()
    WHERE league_id = league_id_param;

    -- Build success response
    result := jsonb_build_object(
        'success', TRUE,
        'league_id', league_id_param,
        'pick_number', draft_order_record.pick_number,
        'round', draft_order_record.round,
        'team_name', draft_order_record.team_name,
        'player_name', player_record.name,
        'player_position', player_record.position,
        'message', 'Draft pick made successfully'
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to make draft pick',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION make_draft_pick(UUID, UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ make_draft_pick function created successfully!';
    RAISE NOTICE '✅ Handles manual draft picks with proper validation';
    RAISE NOTICE '✅ Creates draft pick record and updates roster';
    RAISE NOTICE '✅ Updates draft current state';
    RAISE NOTICE '';
END $$;
