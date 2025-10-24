-- Combined migration to fix drop player issue
-- 1. Update existing leagues to have default waiver settings
-- 2. Fix the drop_player function to handle NULL values

-- =====================================================
-- STEP 1: Set default waiver settings for existing leagues
-- =====================================================
UPDATE fantasy_league_seasons
SET 
    waiver_type = COALESCE(waiver_type, 'rolling'),
    waiver_period_hours = COALESCE(waiver_period_hours, 48),
    waiver_budget_amount = COALESCE(waiver_budget_amount, 100),
    waiver_min_bid = COALESCE(waiver_min_bid, 0),
    waiver_priority_reset = COALESCE(waiver_priority_reset, 'after_claim'),
    waiver_process_time = COALESCE(waiver_process_time, '03:00:00')
WHERE waiver_type IS NULL 
   OR waiver_period_hours IS NULL 
   OR waiver_budget_amount IS NULL
   OR waiver_min_bid IS NULL
   OR waiver_priority_reset IS NULL
   OR waiver_process_time IS NULL;

-- =====================================================
-- STEP 2: Fix drop_player function to handle NULL values
-- =====================================================
CREATE OR REPLACE FUNCTION drop_player(
    league_id_param UUID,
    season_id_param UUID,
    fantasy_team_id_param UUID,
    player_id_param UUID,
    user_id_param UUID,
    notes_param TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    waiver_settings RECORD;
    roster_spot_id UUID;
    becomes_free_agent_at TIMESTAMP WITH TIME ZONE;
    actual_waiver_type TEXT;
    actual_waiver_period_hours INTEGER;
    result JSONB;
BEGIN
    -- Get waiver settings with defaults
    SELECT 
        COALESCE(waiver_type, 'rolling') as waiver_type,
        COALESCE(waiver_period_hours, 48) as waiver_period_hours
    INTO waiver_settings
    FROM fantasy_league_seasons
    WHERE id = season_id_param;
    
    IF waiver_settings IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Season not found'
        );
    END IF;
    
    -- Get actual values with defaults
    actual_waiver_type := COALESCE(waiver_settings.waiver_type, 'rolling');
    actual_waiver_period_hours := COALESCE(waiver_settings.waiver_period_hours, 48);
    
    -- Calculate when player becomes free agent
    becomes_free_agent_at := NOW() + (actual_waiver_period_hours || ' hours')::INTERVAL;
    
    -- Remove player from roster
    DELETE FROM fantasy_roster_spots
    WHERE fantasy_team_id = fantasy_team_id_param 
    AND player_id = player_id_param
    RETURNING id INTO roster_spot_id;
    
    IF roster_spot_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Player not found on team roster'
        );
    END IF;
    
    -- Create transaction record
    INSERT INTO fantasy_transactions (
        league_id,
        season_id,
        transaction_type,
        fantasy_team_id,
        player_id,
        notes,
        processed_by
    ) VALUES (
        league_id_param,
        season_id_param,
        'cut',
        fantasy_team_id_param,
        player_id_param,
        notes_param,
        user_id_param
    );
    
    -- If waiver type is 'none', player becomes immediate free agent
    IF actual_waiver_type = 'none' THEN
        becomes_free_agent_at := NOW();
    END IF;
    
    -- Add player to waivers (or mark as free agent if waiver_type = 'none')
    INSERT INTO fantasy_players_on_waivers (
        league_id,
        season_id,
        player_id,
        dropped_by_team_id,
        dropped_by_user_id,
        dropped_at,
        waiver_status,
        becomes_free_agent_at
    ) VALUES (
        league_id_param,
        season_id_param,
        player_id_param,
        fantasy_team_id_param,
        user_id_param,
        NOW(),
        CASE 
            WHEN actual_waiver_type = 'none' THEN 'free_agent'
            ELSE 'on_waivers'
        END,
        becomes_free_agent_at
    )
    ON CONFLICT (league_id, season_id, player_id) 
    DO UPDATE SET
        dropped_by_team_id = EXCLUDED.dropped_by_team_id,
        dropped_by_user_id = EXCLUDED.dropped_by_user_id,
        dropped_at = EXCLUDED.dropped_at,
        waiver_status = EXCLUDED.waiver_status,
        becomes_free_agent_at = EXCLUDED.becomes_free_agent_at;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Player dropped successfully',
        'player_id', player_id_param,
        'waiver_status', CASE 
            WHEN actual_waiver_type = 'none' THEN 'free_agent'
            ELSE 'on_waivers'
        END,
        'becomes_free_agent_at', becomes_free_agent_at
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to drop player',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure permissions
GRANT EXECUTE ON FUNCTION drop_player(UUID, UUID, UUID, UUID, UUID, TEXT) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check that all seasons now have waiver settings
SELECT 
    COUNT(*) as total_seasons,
    COUNT(CASE WHEN waiver_type IS NOT NULL THEN 1 END) as with_waiver_type,
    COUNT(CASE WHEN waiver_period_hours IS NOT NULL THEN 1 END) as with_waiver_period
FROM fantasy_league_seasons;

