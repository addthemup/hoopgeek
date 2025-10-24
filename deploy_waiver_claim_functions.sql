-- =====================================================
-- WAIVER CLAIM FUNCTIONS
-- =====================================================
-- Submit and cancel waiver claims
-- =====================================================

-- =====================================================
-- FUNCTION: Submit Waiver Claim
-- =====================================================

-- Drop ALL existing versions of submit_waiver_claim
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'submit_waiver_claim'
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION submit_waiver_claim(
    p_league_id UUID,
    p_season_id UUID,
    p_fantasy_team_id UUID,
    p_player_id UUID,
    p_player_to_drop_id UUID,
    p_submitted_by UUID,
    p_bid_amount INTEGER DEFAULT 0,
    p_priority INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    v_waiver_settings RECORD;
    v_waiver_budget RECORD;
    v_roster_full BOOLEAN;
    v_claim_id UUID;
BEGIN
    -- Get waiver settings
    SELECT 
        waiver_type,
        waiver_budget_amount,
        waiver_min_bid
    INTO v_waiver_settings
    FROM fantasy_league_seasons
    WHERE id = p_season_id;
    
    IF v_waiver_settings IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Season not found'
        );
    END IF;
    
    -- Get team's waiver budget/priority
    SELECT 
        remaining_budget,
        waiver_priority
    INTO v_waiver_budget
    FROM fantasy_waiver_order
    WHERE league_id = p_league_id 
      AND season_id = p_season_id 
      AND fantasy_team_id = p_fantasy_team_id;
    
    -- For FAAB leagues, validate budget
    IF v_waiver_settings.waiver_type = 'faab' THEN
        IF p_bid_amount > COALESCE(v_waiver_budget.remaining_budget, v_waiver_settings.waiver_budget_amount) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Insufficient budget for this bid'
            );
        END IF;
        
        IF p_bid_amount < COALESCE(v_waiver_settings.waiver_min_bid, 0) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Bid amount is below minimum bid'
            );
        END IF;
    END IF;
    
    -- Check if roster is full
    SELECT NOT EXISTS (
        SELECT 1 
        FROM fantasy_roster_spots 
        WHERE fantasy_team_id = p_fantasy_team_id 
          AND player_id IS NULL
        LIMIT 1
    ) INTO v_roster_full;
    
    -- If roster is full and no drop player specified, error
    IF v_roster_full AND p_player_to_drop_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Roster is full, must specify a player to drop'
        );
    END IF;
    
    -- Check if player to drop exists on roster
    IF p_player_to_drop_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM fantasy_roster_spots 
            WHERE fantasy_team_id = p_fantasy_team_id 
              AND player_id = p_player_to_drop_id
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Player to drop not found on roster'
            );
        END IF;
    END IF;
    
    -- Insert waiver claim
    INSERT INTO fantasy_waiver_claims (
        league_id,
        season_id,
        fantasy_team_id,
        player_id,
        player_to_drop_id,
        bid_amount,
        priority,
        status,
        submitted_at,
        submitted_by,
        claim_type
    ) VALUES (
        p_league_id,
        p_season_id,
        p_fantasy_team_id,
        p_player_id,
        p_player_to_drop_id,
        p_bid_amount,
        COALESCE(p_priority, v_waiver_budget.waiver_priority, 1),
        'pending',
        NOW(),
        p_submitted_by,
        CASE WHEN p_player_to_drop_id IS NOT NULL THEN 'add_drop' ELSE 'add' END
    )
    RETURNING id INTO v_claim_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Waiver claim submitted successfully',
        'claim_id', v_claim_id,
        'bid_amount', p_bid_amount,
        'priority', COALESCE(p_priority, v_waiver_budget.waiver_priority, 1)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to submit waiver claim',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_waiver_claim TO authenticated;

-- =====================================================
-- FUNCTION: Cancel Waiver Claim
-- =====================================================

-- Drop ALL existing versions of cancel_waiver_claim
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'cancel_waiver_claim'
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION cancel_waiver_claim(
    p_claim_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_claim RECORD;
BEGIN
    -- Get claim details
    SELECT 
        id,
        league_id,
        season_id,
        fantasy_team_id,
        status
    INTO v_claim
    FROM fantasy_waiver_claims
    WHERE id = p_claim_id;
    
    IF v_claim IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Claim not found'
        );
    END IF;
    
    IF v_claim.status != 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Can only cancel pending claims'
        );
    END IF;
    
    -- Update claim status to cancelled
    UPDATE fantasy_waiver_claims
    SET 
        status = 'cancelled',
        processed_at = NOW()
    WHERE id = p_claim_id;
    
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

GRANT EXECUTE ON FUNCTION cancel_waiver_claim TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    -- Check if functions exist
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'submit_waiver_claim'
    ) THEN
        RAISE NOTICE '✅ submit_waiver_claim() function created successfully';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'cancel_waiver_claim'
    ) THEN
        RAISE NOTICE '✅ cancel_waiver_claim() function created successfully';
    END IF;
END $$;

