-- ============================================================================
-- Fix Player Roster Trading
-- ============================================================================
-- When players are traded, they need to be moved in fantasy_team_players table
-- (the actual roster), not just draft_picks (ownership tracking)

CREATE OR REPLACE FUNCTION public.accept_trade_offer(
    trade_id_param uuid,
    accepting_team_id_param uuid,
    is_commissioner_param boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trade public.draft_trade_offers;
    v_offered_player_id integer;
    v_requested_player_id integer;
    v_offered_pick_num integer;
    v_requested_pick_num integer;
    v_result jsonb;
    v_pick_check record;
    v_empty_spot_id uuid;
BEGIN
    -- Get the trade offer
    SELECT * INTO v_trade
    FROM public.draft_trade_offers
    WHERE id = trade_id_param;

    -- Validate trade exists
    IF v_trade.id IS NULL THEN
        RAISE EXCEPTION 'Trade offer not found';
    END IF;

    -- Validate trade is still pending
    IF v_trade.status != 'pending' THEN
        RAISE EXCEPTION 'Trade offer is no longer pending (status: %)', v_trade.status;
    END IF;

    -- Validate trade hasn't expired
    IF v_trade.expires_at < now() THEN
        RAISE EXCEPTION 'Trade offer has expired';
    END IF;

    -- Validate accepting team
    IF NOT is_commissioner_param THEN
        -- Only the recipient team can accept (not the sender)
        IF accepting_team_id_param != v_trade.to_team_id THEN
            RAISE EXCEPTION 'Only the recipient team can accept this trade';
        END IF;
    END IF;

    -- VALIDATE PICKS BEFORE PROCESSING (same as before)
    IF array_length(v_trade.offered_picks, 1) > 0 THEN
        FOR v_offered_pick_num IN SELECT unnest(v_trade.offered_picks)
        LOOP
            SELECT pick_number, is_completed, fantasy_team_id, league_id INTO v_pick_check
            FROM public.draft_order
            WHERE pick_number = v_offered_pick_num
              AND league_id = v_trade.league_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Pick % does not exist in this league', v_offered_pick_num;
            END IF;
            
            IF v_pick_check.is_completed THEN
                RAISE EXCEPTION 'Pick % has already been made and cannot be traded', v_offered_pick_num;
            END IF;
            
            -- Determine the current owner of the pick
            DECLARE
                current_pick_owner_id UUID;
                original_pick_owner_id UUID;
            BEGIN
                IF v_pick_check.fantasy_team_id IS NOT NULL THEN
                    current_pick_owner_id := v_pick_check.fantasy_team_id;
                ELSE
                    SELECT ft.id INTO original_pick_owner_id
                    FROM public.draft_order do_orig
                    JOIN public.fantasy_teams ft ON ft.league_id = do_orig.league_id
                    WHERE do_orig.league_id = v_trade.league_id
                      AND do_orig.pick_number = v_offered_pick_num
                      AND ft.draft_position = do_orig.team_position;
                    
                    current_pick_owner_id := original_pick_owner_id;
                END IF;

                IF current_pick_owner_id IS NULL THEN
                    RAISE EXCEPTION 'Pick % has no identifiable team owner', v_offered_pick_num;
                END IF;
                
                IF current_pick_owner_id != v_trade.from_team_id THEN
                    RAISE EXCEPTION 'Pick % is owned by a different team (expected: %, actual: %)', 
                        v_offered_pick_num, v_trade.from_team_id, current_pick_owner_id;
                END IF;
            END;
        END LOOP;
    END IF;

    -- Check requested picks (same validation)
    IF array_length(v_trade.requested_picks, 1) > 0 THEN
        FOR v_requested_pick_num IN SELECT unnest(v_trade.requested_picks)
        LOOP
            SELECT pick_number, is_completed, fantasy_team_id INTO v_pick_check
            FROM public.draft_order
            WHERE pick_number = v_requested_pick_num
              AND league_id = v_trade.league_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Pick % does not exist in this league', v_requested_pick_num;
            END IF;
            
            IF v_pick_check.is_completed THEN
                RAISE EXCEPTION 'Pick % has already been made and cannot be traded', v_requested_pick_num;
            END IF;
            
            DECLARE
                current_pick_owner_id UUID;
                original_pick_owner_id UUID;
            BEGIN
                IF v_pick_check.fantasy_team_id IS NOT NULL THEN
                    current_pick_owner_id := v_pick_check.fantasy_team_id;
                ELSE
                    SELECT ft.id INTO original_pick_owner_id
                    FROM public.draft_order do_orig
                    JOIN public.fantasy_teams ft ON ft.league_id = do_orig.league_id
                    WHERE do_orig.league_id = v_trade.league_id
                      AND do_orig.pick_number = v_requested_pick_num
                      AND ft.draft_position = do_orig.team_position;
                    
                    current_pick_owner_id := original_pick_owner_id;
                END IF;

                IF current_pick_owner_id IS NULL THEN
                    RAISE EXCEPTION 'Pick % has no identifiable team owner', v_requested_pick_num;
                END IF;
                
                IF current_pick_owner_id != v_trade.to_team_id THEN
                    RAISE EXCEPTION 'Pick % is owned by a different team (expected: %, actual: %)', 
                        v_requested_pick_num, v_trade.to_team_id, current_pick_owner_id;
                END IF;
            END;
        END LOOP;
    END IF;

    -- ALL VALIDATIONS PASSED - Now process the trade
    
    -- 1. Transfer offered PLAYERS from from_team to to_team
    IF array_length(v_trade.offered_players, 1) > 0 THEN
        FOREACH v_offered_player_id IN ARRAY v_trade.offered_players
        LOOP
            -- Update draft_picks ownership
            UPDATE public.draft_picks
            SET fantasy_team_id = v_trade.to_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.from_team_id
              AND player_id = v_offered_player_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer player % from team % to team % in draft_picks', 
                    v_offered_player_id, v_trade.from_team_id, v_trade.to_team_id;
            END IF;

            -- ✨ NEW: Move player in roster (fantasy_team_players)
            -- 1. Remove from old team's roster
            UPDATE public.fantasy_team_players
            SET player_id = NULL
            WHERE fantasy_team_id = v_trade.from_team_id
              AND player_id = v_offered_player_id;

            -- 2. Find empty spot on new team
            SELECT id INTO v_empty_spot_id
            FROM public.fantasy_team_players
            WHERE fantasy_team_id = v_trade.to_team_id
              AND player_id IS NULL
            LIMIT 1;

            IF v_empty_spot_id IS NULL THEN
                RAISE EXCEPTION 'No empty roster spot available for player % on team %', 
                    v_offered_player_id, v_trade.to_team_id;
            END IF;

            -- 3. Assign player to new team's roster
            UPDATE public.fantasy_team_players
            SET player_id = v_offered_player_id
            WHERE id = v_empty_spot_id;
        END LOOP;
    END IF;

    -- 2. Transfer requested PLAYERS from to_team to from_team
    IF array_length(v_trade.requested_players, 1) > 0 THEN
        FOREACH v_requested_player_id IN ARRAY v_trade.requested_players
        LOOP
            -- Update draft_picks ownership
            UPDATE public.draft_picks
            SET fantasy_team_id = v_trade.from_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.to_team_id
              AND player_id = v_requested_player_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer player % from team % to team % in draft_picks', 
                    v_requested_player_id, v_trade.to_team_id, v_trade.from_team_id;
            END IF;

            -- ✨ NEW: Move player in roster (fantasy_team_players)
            -- 1. Remove from old team's roster
            UPDATE public.fantasy_team_players
            SET player_id = NULL
            WHERE fantasy_team_id = v_trade.to_team_id
              AND player_id = v_requested_player_id;

            -- 2. Find empty spot on new team
            SELECT id INTO v_empty_spot_id
            FROM public.fantasy_team_players
            WHERE fantasy_team_id = v_trade.from_team_id
              AND player_id IS NULL
            LIMIT 1;

            IF v_empty_spot_id IS NULL THEN
                RAISE EXCEPTION 'No empty roster spot available for player % on team %', 
                    v_requested_player_id, v_trade.from_team_id;
            END IF;

            -- 3. Assign player to new team's roster
            UPDATE public.fantasy_team_players
            SET player_id = v_requested_player_id
            WHERE id = v_empty_spot_id;
        END LOOP;
    END IF;

    -- 3. Transfer offered PICKS from from_team to to_team
    IF array_length(v_trade.offered_picks, 1) > 0 THEN
        FOREACH v_offered_pick_num IN ARRAY v_trade.offered_picks
        LOOP
            UPDATE public.draft_order
            SET fantasy_team_id = v_trade.to_team_id
            WHERE league_id = v_trade.league_id
              AND pick_number = v_offered_pick_num
              AND is_completed = false;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer pick % from team % to team %', 
                    v_offered_pick_num, v_trade.from_team_id, v_trade.to_team_id;
            END IF;
        END LOOP;
    END IF;

    -- 4. Transfer requested PICKS from to_team to from_team
    IF array_length(v_trade.requested_picks, 1) > 0 THEN
        FOREACH v_requested_pick_num IN ARRAY v_trade.requested_picks
        LOOP
            UPDATE public.draft_order
            SET fantasy_team_id = v_trade.from_team_id
            WHERE league_id = v_trade.league_id
              AND pick_number = v_requested_pick_num
              AND is_completed = false;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer pick % from team % to team %', 
                    v_requested_pick_num, v_trade.to_team_id, v_trade.from_team_id;
            END IF;
        END LOOP;
    END IF;

    -- 5. Mark trade as accepted
    UPDATE public.draft_trade_offers
    SET status = 'accepted',
        responded_at = NOW()
    WHERE id = trade_id_param;

    -- 6. Cancel any conflicting pending trades
    UPDATE public.draft_trade_offers
    SET status = 'cancelled'
    WHERE league_id = v_trade.league_id
      AND status = 'pending'
      AND id != trade_id_param
      AND (
        -- Trades involving any of the offered players
        offered_players && v_trade.offered_players OR
        requested_players && v_trade.offered_players OR
        -- Trades involving any of the requested players
        offered_players && v_trade.requested_players OR
        requested_players && v_trade.requested_players OR
        -- Trades involving any of the offered picks
        offered_picks && v_trade.offered_picks OR
        requested_picks && v_trade.offered_picks OR
        -- Trades involving any of the requested picks
        offered_picks && v_trade.requested_picks OR
        requested_picks && v_trade.requested_picks
      );

    -- Build success result
    v_result := jsonb_build_object(
        'success', true,
        'trade_id', trade_id_param,
        'from_team', v_trade.from_team_id,
        'to_team', v_trade.to_team_id,
        'players_transferred', 
            (COALESCE(array_length(v_trade.offered_players, 1), 0) + 
             COALESCE(array_length(v_trade.requested_players, 1), 0)),
        'picks_transferred', 
            (COALESCE(array_length(v_trade.offered_picks, 1), 0) + 
             COALESCE(array_length(v_trade.requested_picks, 1), 0))
    );

    RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.accept_trade_offer TO authenticated;

COMMENT ON FUNCTION public.accept_trade_offer IS 'Accept a trade offer and process player/pick transfers. Now correctly moves players between roster slots in fantasy_team_players.';

