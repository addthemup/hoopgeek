-- =====================================================
-- WAIVER CLAIM PROCESSING FUNCTION
-- =====================================================
-- Processes all pending waiver claims at the configured time
-- Automatically handles roster spot validation and awards
-- players to the next eligible team if a roster spot was filled
-- =====================================================

CREATE OR REPLACE FUNCTION process_waiver_claims(
    p_league_id UUID,
    p_season_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_waiver_settings RECORD;
    v_claim RECORD;
    v_awarded_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_roster_full BOOLEAN;
    v_has_open_spot BOOLEAN;
    v_player_awarded BOOLEAN;
    v_result JSONB;
BEGIN
    -- Get waiver settings
    SELECT 
        waiver_type,
        waiver_budget_amount,
        waiver_min_bid,
        waiver_order_reset_type
    INTO v_waiver_settings
    FROM fantasy_league_seasons
    WHERE id = p_season_id;
    
    IF v_waiver_settings IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Season not found'
        );
    END IF;
    
    -- Process each player that has pending claims
    FOR v_claim IN (
        SELECT DISTINCT player_id
        FROM fantasy_waiver_claims
        WHERE league_id = p_league_id
          AND season_id = p_season_id
          AND status = 'pending'
    ) LOOP
        v_player_awarded := false;
        
        -- Get all claims for this player, sorted by priority/bid
        FOR v_claim IN (
            SELECT 
                fwc.id,
                fwc.fantasy_team_id,
                fwc.player_id,
                fwc.player_to_drop_id,
                fwc.bid_amount,
                fwc.priority,
                fwc.submitted_at,
                fwo.waiver_priority,
                fwo.remaining_budget
            FROM fantasy_waiver_claims fwc
            LEFT JOIN fantasy_waiver_order fwo 
                ON fwo.league_id = fwc.league_id 
                AND fwo.season_id = fwc.season_id
                AND fwo.fantasy_team_id = fwc.fantasy_team_id
            WHERE fwc.league_id = p_league_id
              AND fwc.season_id = p_season_id
              AND fwc.player_id = v_claim.player_id
              AND fwc.status = 'pending'
            ORDER BY 
                CASE 
                    WHEN v_waiver_settings.waiver_type = 'faab' THEN fwc.bid_amount 
                    ELSE fwo.waiver_priority 
                END DESC,
                fwc.submitted_at ASC
        ) LOOP
            -- Skip if player already awarded
            CONTINUE WHEN v_player_awarded;
            
            -- CRITICAL: Check if team still has a roster spot available
            -- This handles the case where they filled the spot after making the claim
            IF v_claim.player_to_drop_id IS NOT NULL THEN
                -- If they specified a player to drop, verify that player is still on their roster
                SELECT EXISTS (
                    SELECT 1 
                    FROM fantasy_roster_spots 
                    WHERE fantasy_team_id = v_claim.fantasy_team_id 
                      AND player_id = v_claim.player_to_drop_id
                ) INTO v_has_open_spot;
                
                IF NOT v_has_open_spot THEN
                    -- Player to drop is no longer on roster, invalidate claim
                    UPDATE fantasy_waiver_claims
                    SET 
                        status = 'failed',
                        processed_at = NOW(),
                        failure_reason = 'Player to drop no longer on roster'
                    WHERE id = v_claim.id;
                    
                    v_failed_count := v_failed_count + 1;
                    CONTINUE;
                END IF;
            ELSE
                -- No drop player specified, check if they have an open spot
                SELECT EXISTS (
                    SELECT 1 
                    FROM fantasy_roster_spots 
                    WHERE fantasy_team_id = v_claim.fantasy_team_id 
                      AND player_id IS NULL
                    LIMIT 1
                ) INTO v_has_open_spot;
                
                IF NOT v_has_open_spot THEN
                    -- Roster is now full, invalidate claim and move to next team
                    UPDATE fantasy_waiver_claims
                    SET 
                        status = 'failed',
                        processed_at = NOW(),
                        failure_reason = 'Roster became full after claim was submitted'
                    WHERE id = v_claim.id;
                    
                    v_failed_count := v_failed_count + 1;
                    CONTINUE;
                END IF;
            END IF;
            
            -- For FAAB, verify they still have enough budget
            IF v_waiver_settings.waiver_type = 'faab' THEN
                IF v_claim.bid_amount > COALESCE(v_claim.remaining_budget, v_waiver_settings.waiver_budget_amount) THEN
                    UPDATE fantasy_waiver_claims
                    SET 
                        status = 'failed',
                        processed_at = NOW(),
                        failure_reason = 'Insufficient budget'
                    WHERE id = v_claim.id;
                    
                    v_failed_count := v_failed_count + 1;
                    CONTINUE;
                END IF;
            END IF;
            
            -- Award the player to this team
            BEGIN
                -- If dropping a player, drop them first
                IF v_claim.player_to_drop_id IS NOT NULL THEN
                    -- Drop the player (this will handle waivers automatically)
                    PERFORM drop_player(
                        p_league_id,
                        p_season_id,
                        v_claim.fantasy_team_id,
                        v_claim.player_to_drop_id,
                        'Dropped via waiver claim processing'
                    );
                END IF;
                
                -- Add the claimed player to roster
                UPDATE fantasy_roster_spots
                SET player_id = v_claim.player_id
                WHERE id = (
                    SELECT id 
                    FROM fantasy_roster_spots
                    WHERE fantasy_team_id = v_claim.fantasy_team_id
                      AND player_id IS NULL
                    LIMIT 1
                );
                
                -- Create transaction record
                INSERT INTO fantasy_transactions (
                    league_id,
                    season_id,
                    fantasy_team_id,
                    player_id,
                    transaction_type,
                    notes,
                    transaction_metadata
                ) VALUES (
                    p_league_id,
                    p_season_id,
                    v_claim.fantasy_team_id,
                    v_claim.player_id,
                    'waiver_claim',
                    CASE 
                        WHEN v_waiver_settings.waiver_type = 'faab' 
                        THEN 'Claimed via FAAB bid: $' || v_claim.bid_amount
                        ELSE 'Claimed via waiver priority'
                    END,
                    jsonb_build_object(
                        'claim_id', v_claim.id,
                        'bid_amount', v_claim.bid_amount,
                        'waiver_priority', v_claim.waiver_priority,
                        'player_to_drop_id', v_claim.player_to_drop_id
                    )
                );
                
                -- Update FAAB budget if applicable
                IF v_waiver_settings.waiver_type = 'faab' THEN
                    UPDATE fantasy_waiver_order
                    SET 
                        remaining_budget = remaining_budget - v_claim.bid_amount,
                        total_spent = total_spent + v_claim.bid_amount
                    WHERE league_id = p_league_id
                      AND season_id = p_season_id
                      AND fantasy_team_id = v_claim.fantasy_team_id;
                END IF;
                
                -- Update waiver priority (move to back of line for rolling waivers)
                IF v_waiver_settings.waiver_type IN ('rolling', 'continuous') THEN
                    -- Move this team to the back of the waiver order
                    UPDATE fantasy_waiver_order
                    SET waiver_priority = (
                        SELECT COALESCE(MAX(waiver_priority), 0) + 1
                        FROM fantasy_waiver_order
                        WHERE league_id = p_league_id AND season_id = p_season_id
                    )
                    WHERE league_id = p_league_id
                      AND season_id = p_season_id
                      AND fantasy_team_id = v_claim.fantasy_team_id;
                    
                    -- Reorder other teams
                    WITH numbered_teams AS (
                        SELECT 
                            fantasy_team_id,
                            ROW_NUMBER() OVER (ORDER BY waiver_priority, fantasy_team_id) as new_priority
                        FROM fantasy_waiver_order
                        WHERE league_id = p_league_id AND season_id = p_season_id
                    )
                    UPDATE fantasy_waiver_order fwo
                    SET waiver_priority = nt.new_priority
                    FROM numbered_teams nt
                    WHERE fwo.fantasy_team_id = nt.fantasy_team_id
                      AND fwo.league_id = p_league_id
                      AND fwo.season_id = p_season_id;
                END IF;
                
                -- Remove player from waivers
                DELETE FROM fantasy_players_on_waivers
                WHERE league_id = p_league_id
                  AND season_id = p_season_id
                  AND player_id = v_claim.player_id;
                
                -- Mark claim as successful
                UPDATE fantasy_waiver_claims
                SET 
                    status = 'successful',
                    processed_at = NOW()
                WHERE id = v_claim.id;
                
                v_awarded_count := v_awarded_count + 1;
                v_player_awarded := true;
                
            EXCEPTION WHEN OTHERS THEN
                -- Mark claim as failed
                UPDATE fantasy_waiver_claims
                SET 
                    status = 'failed',
                    processed_at = NOW(),
                    failure_reason = SQLERRM
                WHERE id = v_claim.id;
                
                v_failed_count := v_failed_count + 1;
            END;
        END LOOP;
        
        -- If no team was awarded the player, move to free agency
        IF NOT v_player_awarded THEN
            UPDATE fantasy_players_on_waivers
            SET 
                waiver_status = 'free_agent',
                becomes_free_agent_at = NOW()
            WHERE league_id = p_league_id
              AND season_id = p_season_id
              AND player_id = v_claim.player_id;
        END IF;
        
        -- Mark any remaining pending claims for this player as failed
        UPDATE fantasy_waiver_claims
        SET 
            status = 'failed',
            processed_at = NOW(),
            failure_reason = 'Player awarded to another team'
        WHERE league_id = p_league_id
          AND season_id = p_season_id
          AND player_id = v_claim.player_id
          AND status = 'pending';
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Waiver claims processed successfully',
        'awarded_count', v_awarded_count,
        'failed_count', v_failed_count
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to process waiver claims',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_waiver_claims TO authenticated;

-- =====================================================
-- SCHEDULED WAIVER PROCESSING (CRON JOB)
-- =====================================================
-- This would typically be set up as a Supabase Edge Function
-- or external cron job that calls process_waiver_claims()
-- for each active league at their configured processing time
-- =====================================================

COMMENT ON FUNCTION process_waiver_claims IS 'Processes all pending waiver claims for a league, automatically handling roster spot validation and awarding players to eligible teams';

