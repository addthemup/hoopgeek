-- =====================================================
-- EXECUTE DRAFT TRADE FUNCTION
-- =====================================================
-- This function properly executes a draft trade by:
-- 1. Swapping draft picks in fantasy_draft_order
-- 2. Creating transaction records in fantasy_transactions
-- 3. Updating trade status
-- =====================================================

CREATE OR REPLACE FUNCTION execute_draft_trade(
    p_trade_id UUID,
    p_accepting_team_id UUID
) RETURNS JSONB AS $$
DECLARE
    trade_record RECORD;
    is_commissioner BOOLEAN := FALSE;
    season_id_val UUID;
    result JSONB;
BEGIN
    -- Get the trade offer with all details
    SELECT 
        fdt.*,
        ft_from.team_name as from_team_name,
        ft_to.team_name as to_team_name
    INTO trade_record 
    FROM fantasy_draft_trade_offers fdt
    LEFT JOIN fantasy_teams ft_from ON fdt.from_team_id = ft_from.id
    LEFT JOIN fantasy_teams ft_to ON fdt.to_team_id = ft_to.id
    WHERE fdt.id = p_trade_id AND fdt.status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Trade offer not found or not pending'
        );
    END IF;
    
    -- Check if user is commissioner of the league
    SELECT EXISTS (
        SELECT 1 FROM fantasy_leagues 
        WHERE id = trade_record.league_id AND commissioner_id = auth.uid()
    ) INTO is_commissioner;
    
    -- If not commissioner, validate normal trade acceptance rules
    IF NOT is_commissioner THEN
        -- Validate that the accepting team is the recipient
        IF trade_record.to_team_id != p_accepting_team_id THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'You can only accept trade offers sent to your team'
            );
        END IF;
        
        -- Validate that user is the owner of the accepting team
        IF NOT EXISTS (
            SELECT 1 FROM fantasy_teams 
            WHERE id = p_accepting_team_id AND user_id = auth.uid()
        ) THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'You can only accept trade offers for your own team'
            );
        END IF;
    END IF;
    
    -- Check if trade has expired
    IF trade_record.expires_at < NOW() THEN
        UPDATE fantasy_draft_trade_offers 
        SET status = 'expired' 
        WHERE id = p_trade_id;
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Trade offer has expired'
        );
    END IF;
    
    -- Get season ID for transaction records
    SELECT id INTO season_id_val
    FROM fantasy_league_seasons
    WHERE league_id = trade_record.league_id
    AND is_active = true
    LIMIT 1;
    
    IF season_id_val IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Active season not found for this league'
        );
    END IF;
    
    -- Execute the trade by swapping draft picks
    -- Update offered picks to be owned by the receiving team
    IF trade_record.offered_picks IS NOT NULL AND jsonb_array_length(trade_record.offered_picks) > 0 THEN
        UPDATE fantasy_draft_order
        SET 
            fantasy_team_id = trade_record.to_team_id,
            is_traded = true,
            updated_at = NOW()
        WHERE league_id = trade_record.league_id
        AND pick_number = ANY(
            SELECT jsonb_array_elements_text(trade_record.offered_picks)::INTEGER
        );
    END IF;
    
    -- Update requested picks to be owned by the offering team
    IF trade_record.requested_picks IS NOT NULL AND jsonb_array_length(trade_record.requested_picks) > 0 THEN
        UPDATE fantasy_draft_order
        SET 
            fantasy_team_id = trade_record.from_team_id,
            is_traded = true,
            updated_at = NOW()
        WHERE league_id = trade_record.league_id
        AND pick_number = ANY(
            SELECT jsonb_array_elements_text(trade_record.requested_picks)::INTEGER
        );
    END IF;
    
    -- Create transaction records for the trade
    -- Record the trade in fantasy_transactions
    INSERT INTO fantasy_transactions (
        league_id,
        season_id,
        transaction_type,
        fantasy_team_id,
        player_id,
        notes,
        processed_by
    ) VALUES (
        trade_record.league_id,
        season_id_val,
        'trade',
        trade_record.from_team_id,
        NULL, -- No specific player for draft pick trades
        'Draft pick trade executed: ' || trade_record.from_team_name || ' ↔ ' || trade_record.to_team_name,
        auth.uid()
    );
    
    -- Accept the trade
    UPDATE fantasy_draft_trade_offers 
    SET 
        status = 'accepted',
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_trade_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'trade_id', p_trade_id,
        'from_team', trade_record.from_team_name,
        'to_team', trade_record.to_team_name,
        'message', 'Trade executed successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Trade execution failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION execute_draft_trade(UUID, UUID) TO authenticated;

-- =====================================================
-- UPDATE ACCEPT TRADE FUNCTION
-- =====================================================
-- Update the existing accept_draft_trade_offer function to use the new execute_draft_trade function
-- =====================================================

CREATE OR REPLACE FUNCTION accept_draft_trade_offer(
    p_trade_id UUID,
    p_accepting_team_id UUID
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Call the execute_draft_trade function
    SELECT execute_draft_trade(p_trade_id, p_accepting_team_id) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION accept_draft_trade_offer(UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Draft trade execution system created successfully!';
    RAISE NOTICE '✅ Function: execute_draft_trade - properly swaps draft picks and creates transactions';
    RAISE NOTICE '✅ Function: accept_draft_trade_offer - updated to use execute_draft_trade';
    RAISE NOTICE '✅ Trade execution includes:';
    RAISE NOTICE '  - Swapping draft picks in fantasy_draft_order';
    RAISE NOTICE '  - Setting is_traded = true for traded picks';
    RAISE NOTICE '  - Creating transaction records in fantasy_transactions';
    RAISE NOTICE '  - Updating trade status to accepted';
    RAISE NOTICE '';
END $$;
