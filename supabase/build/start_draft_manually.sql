-- =====================================================
-- AUTO-COMPLETE DRAFT FUNCTION (DEVELOPMENT TOOL)
-- =====================================================
-- This function allows commissioners to start a draft immediately
-- and enable auto-draft for all teams for testing purposes
-- WARNING: This is a development tool and should be disabled in production
-- =====================================================

CREATE OR REPLACE FUNCTION start_draft_manually(
    league_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    league_record RECORD;
    first_pick RECORD;
    settings RECORD;
    total_picks INTEGER;
    expires_at TIMESTAMP WITH TIME ZONE;
    current_draft_status TEXT;
BEGIN
    -- Debug: Log the league ID being processed
    RAISE NOTICE '🚀 start_draft_manually called with league_id: %', league_id_param;
    
    -- Get league information
    SELECT * INTO league_record
    FROM fantasy_leagues
    WHERE id = league_id_param;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'League not found',
            'message', 'The specified league does not exist.'
        );
    END IF;
    
    -- Check if draft is already started or completed (check fantasy_league_seasons)
    SELECT draft_status INTO current_draft_status
    FROM fantasy_league_seasons
    WHERE league_id = league_id_param
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF current_draft_status = 'in_progress' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Draft already started',
            'message', 'The draft is already in progress.'
        );
    END IF;
    
    IF current_draft_status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Draft already completed',
            'message', 'The draft has already been completed.'
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
            'error', 'Draft order not found',
            'message', 'No draft order found for this league. Please set up the draft order first.'
        );
    END IF;
    
    -- Get league settings for timing from fantasy_draft_settings
    SELECT 
        COALESCE(fds.draft_time_per_pick, 60) as time_per_pick,
        COALESCE(fds.draft_auto_pick_enabled, true) as auto_pick_enabled
    INTO settings
    FROM fantasy_draft_settings fds
    WHERE fds.league_id = league_id_param
    ORDER BY fds.created_at DESC
    LIMIT 1;
    
    -- If no draft settings found, use defaults
    IF NOT FOUND THEN
        settings.time_per_pick := 60;
        settings.auto_pick_enabled := true;
        RAISE NOTICE 'No draft settings found, using defaults: time_per_pick=60, auto_pick_enabled=true';
    END IF;
    
    -- Count total picks
    SELECT COUNT(*) INTO total_picks
    FROM fantasy_draft_order
    WHERE league_id = league_id_param;
    
    -- Calculate expiration time
    expires_at := NOW() + (settings.time_per_pick || ' seconds')::INTERVAL;
    
    -- Update league season status to in_progress (get the most recent season first)
    UPDATE fantasy_league_seasons
    SET 
        draft_status = 'in_progress',
        draft_date = NOW(),
        updated_at = NOW()
    WHERE id = (
        SELECT id 
        FROM fantasy_league_seasons 
        WHERE league_id = league_id_param 
        ORDER BY created_at DESC 
        LIMIT 1
    );
    
    -- Debug: Check if the update worked
    RAISE NOTICE 'Updated draft status to in_progress for league: %', league_id_param;
    RAISE NOTICE 'Creating draft_current_state for league: %', league_id_param;
    
    -- Initialize draft_current_state
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
        (SELECT id FROM fantasy_league_seasons WHERE league_id = league_id_param ORDER BY created_at DESC LIMIT 1),
        first_pick.id,
        1,
        1,
        'in_progress',
        settings.auto_pick_enabled,
        NOW(),
        total_picks,
        0,
        NOW()
    ) ON CONFLICT (league_id) DO UPDATE SET
        current_pick_id = first_pick.id,
        current_pick_number = 1,
        current_round = 1,
        draft_status = 'in_progress',
        is_auto_pick_active = settings.auto_pick_enabled,
        draft_started_at = NOW(),
        total_picks = total_picks,
        completed_picks = 0,
        last_activity_at = NOW(),
        updated_at = NOW();
    
    -- Set timer on first pick
    UPDATE fantasy_draft_order
    SET 
        time_started = NOW(),
        time_expires = expires_at
    WHERE id = first_pick.id;
    
    -- Enable auto-draft for ALL teams (for testing purposes)
    UPDATE fantasy_teams
    SET 
        autodraft_enabled = true,
        updated_at = NOW()
    WHERE league_id = league_id_param;
    
    result := jsonb_build_object(
        'success', TRUE,
        'league_id', league_id_param,
        'league_name', league_record.name,
        'draft_started_at', NOW(),
        'first_pick_number', 1,
        'time_per_pick', settings.time_per_pick,
        'total_picks', total_picks,
        'auto_draft_enabled', true,
        'message', 'Draft started with auto-complete enabled for all teams'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to start draft',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION start_draft_manually(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ start_draft_manually function created successfully!';
    RAISE NOTICE '⚠️  DEVELOPMENT TOOL: Auto-Complete Draft';
    RAISE NOTICE '✅ Starts draft immediately and enables auto-draft for ALL teams';
    RAISE NOTICE '✅ Perfect for testing draft-manager functionality';
    RAISE NOTICE '⚠️  WARNING: Should be disabled in production!';
    RAISE NOTICE '';
END $$;