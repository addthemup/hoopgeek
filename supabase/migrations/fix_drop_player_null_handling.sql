-- Fix drop_player function to handle NULL waiver settings gracefully
-- This fixes the issue where leagues created before waiver migration have NULL waiver settings

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
    -- Get waiver settings
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
    
    -- ⚠️ CRITICAL: Clear the player from roster spot, DON'T DELETE the spot
    -- Roster spots are permanent and should never be deleted
    UPDATE fantasy_roster_spots
    SET 
        player_id = NULL,
        updated_at = NOW()
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

