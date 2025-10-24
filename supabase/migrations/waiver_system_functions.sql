-- =====================================================
-- WAIVER SYSTEM FUNCTIONS
-- =====================================================
-- Database functions for managing waivers:
-- - Initialize waiver order for a season
-- - Drop player (with waiver or immediate free agent)
-- - Submit waiver claim
-- - Process waiver claims
-- - Update waiver priorities
-- =====================================================

-- =====================================================
-- FUNCTION: Initialize Waiver Order for Season
-- =====================================================
-- Call this when a season starts or after draft completes
-- Sets initial waiver priority (inverse of draft order or standings)

CREATE OR REPLACE FUNCTION initialize_waiver_order(
    league_id_param UUID,
    season_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    waiver_settings RECORD;
    team_record RECORD;
    priority_counter INTEGER := 1;
    result JSONB;
BEGIN
    -- Get waiver settings for this season
    SELECT 
        waiver_type,
        waiver_budget_amount
    INTO waiver_settings
    FROM fantasy_league_seasons
    WHERE id = season_id_param;
    
    IF waiver_settings IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Season not found'
        );
    END IF;
    
    -- Delete existing waiver order for this season (in case re-initializing)
    DELETE FROM fantasy_waiver_order
    WHERE league_id = league_id_param AND season_id = season_id_param;
    
    -- Initialize waiver order for each team
    -- Priority is inverse of draft position (last pick gets #1 priority)
    FOR team_record IN
        SELECT 
            ft.id as team_id,
            ft.draft_position
        FROM fantasy_teams ft
        WHERE ft.league_id = league_id_param
        ORDER BY ft.draft_position DESC NULLS LAST
    LOOP
        INSERT INTO fantasy_waiver_order (
            league_id,
            season_id,
            fantasy_team_id,
            waiver_priority,
            remaining_budget,
            total_spent
        ) VALUES (
            league_id_param,
            season_id_param,
            team_record.team_id,
            priority_counter,
            waiver_settings.waiver_budget_amount,
            0
        );
        
        priority_counter := priority_counter + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Waiver order initialized',
        'teams_initialized', priority_counter - 1,
        'waiver_type', waiver_settings.waiver_type
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to initialize waiver order',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION initialize_waiver_order(UUID, UUID) TO authenticated;

-- =====================================================
-- FUNCTION: Drop Player (Cut Player)
-- =====================================================
-- Handles dropping a player from a team
-- Automatically puts player on waivers or makes them a free agent

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
    result JSONB;
BEGIN
    -- Get waiver settings
    SELECT 
        waiver_type,
        waiver_period_hours
    INTO waiver_settings
    FROM fantasy_league_seasons
    WHERE id = season_id_param;
    
    IF waiver_settings IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Season not found'
        );
    END IF;
    
    -- Calculate when player becomes free agent
    becomes_free_agent_at := NOW() + (waiver_settings.waiver_period_hours || ' hours')::INTERVAL;
    
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
    IF waiver_settings.waiver_type = 'none' THEN
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
            WHEN waiver_settings.waiver_type = 'none' THEN 'free_agent'
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
            WHEN waiver_settings.waiver_type = 'none' THEN 'free_agent'
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

GRANT EXECUTE ON FUNCTION drop_player(UUID, UUID, UUID, UUID, UUID, TEXT) TO authenticated;

-- =====================================================
-- FUNCTION: Submit Waiver Claim
-- =====================================================
-- Allows a team to submit a waiver claim for a player

CREATE OR REPLACE FUNCTION submit_waiver_claim(
    league_id_param UUID,
    season_id_param UUID,
    fantasy_team_id_param UUID,
    player_id_param UUID,
    drop_player_id_param UUID DEFAULT NULL,
    bid_amount_param INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    waiver_settings RECORD;
    team_waiver_info RECORD;
    player_status RECORD;
    claim_type TEXT;
    result JSONB;
BEGIN
    -- Get waiver settings
    SELECT 
        waiver_type,
        waiver_min_bid,
        waiver_budget_amount
    INTO waiver_settings
    FROM fantasy_league_seasons
    WHERE id = season_id_param;
    
    IF waiver_settings IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Season not found'
        );
    END IF;
    
    -- Get team's current waiver info
    SELECT 
        waiver_priority,
        remaining_budget
    INTO team_waiver_info
    FROM fantasy_waiver_order
    WHERE fantasy_team_id = fantasy_team_id_param 
    AND season_id = season_id_param;
    
    IF team_waiver_info IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Team waiver info not found. Initialize waiver order first.'
        );
    END IF;
    
    -- Check if player is on waivers or free agent
    SELECT 
        waiver_status,
        becomes_free_agent_at
    INTO player_status
    FROM fantasy_players_on_waivers
    WHERE league_id = league_id_param 
    AND season_id = season_id_param
    AND player_id = player_id_param;
    
    -- Determine claim type
    IF player_status IS NULL OR player_status.waiver_status = 'free_agent' OR 
       player_status.becomes_free_agent_at <= NOW() THEN
        claim_type := 'free_agent';
    ELSE
        claim_type := 'waiver';
    END IF;
    
    -- Validate FAAB bid if required
    IF waiver_settings.waiver_type = 'faab' AND claim_type = 'waiver' THEN
        IF bid_amount_param IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Bid amount required for FAAB waiver claims'
            );
        END IF;
        
        IF bid_amount_param < waiver_settings.waiver_min_bid THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Bid amount below minimum',
                'minimum_bid', waiver_settings.waiver_min_bid
            );
        END IF;
        
        IF bid_amount_param > team_waiver_info.remaining_budget THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Insufficient budget',
                'remaining_budget', team_waiver_info.remaining_budget,
                'bid_amount', bid_amount_param
            );
        END IF;
    END IF;
    
    -- Check for duplicate pending claim
    IF EXISTS (
        SELECT 1 FROM fantasy_waiver_claims
        WHERE fantasy_team_id = fantasy_team_id_param
        AND player_id = player_id_param
        AND status = 'pending'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You already have a pending claim for this player'
        );
    END IF;
    
    -- Create waiver claim
    INSERT INTO fantasy_waiver_claims (
        league_id,
        season_id,
        fantasy_team_id,
        player_id,
        drop_player_id,
        claim_type,
        bid_amount,
        priority_at_claim,
        status
    ) VALUES (
        league_id_param,
        season_id_param,
        fantasy_team_id_param,
        player_id_param,
        drop_player_id_param,
        claim_type,
        bid_amount_param,
        team_waiver_info.waiver_priority,
        'pending'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Waiver claim submitted successfully',
        'claim_type', claim_type,
        'bid_amount', bid_amount_param,
        'priority', team_waiver_info.waiver_priority
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to submit waiver claim',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_waiver_claim(UUID, UUID, UUID, UUID, UUID, INTEGER) TO authenticated;

-- =====================================================
-- FUNCTION: Get Players Available for Claim
-- =====================================================
-- Returns all players available (on waivers or free agents)

CREATE OR REPLACE FUNCTION get_available_players_for_league(
    league_id_param UUID,
    season_id_param UUID
)
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    player_position TEXT,
    player_team TEXT,
    waiver_status TEXT,
    becomes_free_agent_at TIMESTAMP WITH TIME ZONE,
    dropped_by_team_name TEXT,
    dropped_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pow.player_id,
        np.name as player_name,
        np.position as player_position,
        np.team_abbreviation as player_team,
        pow.waiver_status,
        pow.becomes_free_agent_at,
        ft.team_name as dropped_by_team_name,
        pow.dropped_at
    FROM fantasy_players_on_waivers pow
    LEFT JOIN nba_players np ON pow.player_id = np.id
    LEFT JOIN fantasy_teams ft ON pow.dropped_by_team_id = ft.id
    WHERE pow.league_id = league_id_param
    AND pow.season_id = season_id_param
    AND pow.waiver_status IN ('on_waivers', 'free_agent')
    ORDER BY 
        CASE 
            WHEN pow.waiver_status = 'free_agent' THEN 1
            ELSE 2
        END,
        pow.becomes_free_agent_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_available_players_for_league(UUID, UUID) TO authenticated;

-- =====================================================
-- FUNCTION: Get Team's Pending Waiver Claims
-- =====================================================

CREATE OR REPLACE FUNCTION get_team_pending_claims(
    fantasy_team_id_param UUID
)
RETURNS TABLE (
    claim_id UUID,
    player_id UUID,
    player_name TEXT,
    player_position TEXT,
    drop_player_id UUID,
    drop_player_name TEXT,
    claim_type TEXT,
    bid_amount INTEGER,
    priority_at_claim INTEGER,
    claim_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wc.id as claim_id,
        wc.player_id,
        np.name as player_name,
        np.position as player_position,
        wc.drop_player_id,
        np_drop.name as drop_player_name,
        wc.claim_type,
        wc.bid_amount,
        wc.priority_at_claim,
        wc.claim_date
    FROM fantasy_waiver_claims wc
    LEFT JOIN nba_players np ON wc.player_id = np.id
    LEFT JOIN nba_players np_drop ON wc.drop_player_id = np_drop.id
    WHERE wc.fantasy_team_id = fantasy_team_id_param
    AND wc.status = 'pending'
    ORDER BY wc.claim_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_team_pending_claims(UUID) TO authenticated;

-- =====================================================
-- FUNCTION: Cancel Waiver Claim
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_waiver_claim(
    claim_id_param UUID,
    user_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
    claim_record RECORD;
BEGIN
    -- Get claim info and verify ownership
    SELECT 
        wc.id,
        wc.status,
        wc.fantasy_team_id,
        ft.user_id
    INTO claim_record
    FROM fantasy_waiver_claims wc
    JOIN fantasy_teams ft ON wc.fantasy_team_id = ft.id
    WHERE wc.id = claim_id_param;
    
    IF claim_record IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Waiver claim not found'
        );
    END IF;
    
    IF claim_record.user_id != user_id_param THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You do not have permission to cancel this claim'
        );
    END IF;
    
    IF claim_record.status != 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Can only cancel pending claims',
            'current_status', claim_record.status
        );
    END IF;
    
    -- Update claim status
    UPDATE fantasy_waiver_claims
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = claim_id_param;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Waiver claim cancelled successfully'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to cancel waiver claim',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_waiver_claim(UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Waiver system functions created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Functions Created:';
    RAISE NOTICE '   - initialize_waiver_order(league_id, season_id)';
    RAISE NOTICE '   - drop_player(league_id, season_id, team_id, player_id, user_id, notes)';
    RAISE NOTICE '   - submit_waiver_claim(league_id, season_id, team_id, player_id, drop_player_id, bid_amount)';
    RAISE NOTICE '   - get_available_players_for_league(league_id, season_id)';
    RAISE NOTICE '   - get_team_pending_claims(team_id)';
    RAISE NOTICE '   - cancel_waiver_claim(claim_id, user_id)';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 All functions use SECURITY DEFINER and have proper grants';
    RAISE NOTICE '';
END $$;

