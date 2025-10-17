-- =====================================================
-- INITIALIZE DRAFT STATE FUNCTION
-- =====================================================
-- This function initializes the draft state for a league
-- if it's missing or incomplete
-- =====================================================

CREATE OR REPLACE FUNCTION initialize_draft_state(
    league_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    first_pick RECORD;
    total_picks INTEGER;
    existing_state RECORD;
BEGIN
    -- Check if draft state already exists
    SELECT * INTO existing_state
    FROM fantasy_draft_current_state
    WHERE league_id = league_id_param;
    
    IF FOUND AND existing_state.current_pick_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'message', 'Draft state already initialized',
            'current_pick_id', existing_state.current_pick_id,
            'current_pick_number', existing_state.current_pick_number
        );
    END IF;
    
    -- Get first pick from draft order
    SELECT * INTO first_pick
    FROM fantasy_draft_order
    WHERE league_id = league_id_param
    AND pick_number = 1
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'No draft order found',
            'message', 'No draft order found for this league. Please set up the draft order first.'
        );
    END IF;
    
    -- Count total picks
    SELECT COUNT(*) INTO total_picks
    FROM fantasy_draft_order
    WHERE league_id = league_id_param;
    
    -- Initialize or update draft_current_state
    INSERT INTO fantasy_draft_current_state (
        league_id,
        season_id,
        current_pick_id,
        current_pick_number,
        current_round,
        draft_status,
        is_auto_pick_active,
        draft_started_at,
        total_picks,
        completed_picks,
        last_activity_at
    ) VALUES (
        league_id_param,
        first_pick.season_id,
        first_pick.id,
        1,
        1,
        'in_progress',
        true,
        NOW(),
        total_picks,
        0,
        NOW()
    ) ON CONFLICT (league_id) DO UPDATE SET
        current_pick_id = first_pick.id,
        current_pick_number = 1,
        current_round = 1,
        draft_status = 'in_progress',
        is_auto_pick_active = true,
        draft_started_at = COALESCE(fantasy_draft_current_state.draft_started_at, NOW()),
        total_picks = EXCLUDED.total_picks,
        completed_picks = 0,
        last_activity_at = NOW(),
        updated_at = NOW();
    
    -- Set timer on first pick if not already set
    UPDATE fantasy_draft_order
    SET 
        time_started = COALESCE(time_started, NOW()),
        time_expires = COALESCE(time_expires, NOW() + INTERVAL '60 seconds')
    WHERE id = first_pick.id
    AND (time_started IS NULL OR time_expires IS NULL);
    
    result := jsonb_build_object(
        'success', TRUE,
        'league_id', league_id_param,
        'current_pick_id', first_pick.id,
        'current_pick_number', 1,
        'total_picks', total_picks,
        'message', 'Draft state initialized successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to initialize draft state',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION initialize_draft_state(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ initialize_draft_state function created successfully!';
    RAISE NOTICE '✅ Initializes missing draft state for leagues';
    RAISE NOTICE '✅ Sets up first pick and timer';
    RAISE NOTICE '';
END $$;
