-- Improved accept_trade_offer function with better error handling

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
        IF accepting_team_id_param != v_trade.to_team_id THEN
            RAISE EXCEPTION 'Only the recipient team can accept this trade';
        END IF;
    END IF;

    -- VALIDATE PICKS BEFORE PROCESSING
    -- Check that all offered picks exist, are not completed, and belong to from_team
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
            
            IF v_pick_check.fantasy_team_id IS NULL THEN
                RAISE EXCEPTION 'Pick % has no team owner set (fantasy_team_id is NULL)', v_offered_pick_num;
            END IF;
            
            IF v_pick_check.fantasy_team_id != v_trade.from_team_id THEN
                RAISE EXCEPTION 'Pick % is owned by a different team (expected: %, actual: %)', 
                    v_offered_pick_num, v_trade.from_team_id, v_pick_check.fantasy_team_id;
            END IF;
        END LOOP;
    END IF;

    -- Check requested picks
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
            
            IF v_pick_check.fantasy_team_id IS NULL THEN
                RAISE EXCEPTION 'Pick % has no team owner set (fantasy_team_id is NULL)', v_requested_pick_num;
            END IF;
            
            IF v_pick_check.fantasy_team_id != v_trade.to_team_id THEN
                RAISE EXCEPTION 'Pick % is owned by a different team (expected: %, actual: %)', 
                    v_requested_pick_num, v_trade.to_team_id, v_pick_check.fantasy_team_id;
            END IF;
        END LOOP;
    END IF;

    -- ALL VALIDATIONS PASSED - Now process the trade
    
    -- 1. Transfer offered players
    IF array_length(v_trade.offered_players, 1) > 0 THEN
        FOREACH v_offered_player_id IN ARRAY v_trade.offered_players
        LOOP
            UPDATE public.draft_picks
            SET fantasy_team_id = v_trade.to_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.from_team_id
              AND player_id = v_offered_player_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer player % (not found in draft_picks)', v_offered_player_id;
            END IF;
        END LOOP;
    END IF;

    -- 2. Transfer requested players
    IF array_length(v_trade.requested_players, 1) > 0 THEN
        FOREACH v_requested_player_id IN ARRAY v_trade.requested_players
        LOOP
            UPDATE public.draft_picks
            SET fantasy_team_id = v_trade.from_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.to_team_id
              AND player_id = v_requested_player_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer player % (not found in draft_picks)', v_requested_player_id;
            END IF;
        END LOOP;
    END IF;

    -- 3. Transfer offered picks
    IF array_length(v_trade.offered_picks, 1) > 0 THEN
        FOREACH v_offered_pick_num IN ARRAY v_trade.offered_picks
        LOOP
            UPDATE public.draft_order
            SET fantasy_team_id = v_trade.to_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.from_team_id
              AND pick_number = v_offered_pick_num
              AND is_completed = false;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer pick % (update returned no rows)', v_offered_pick_num;
            END IF;
        END LOOP;
    END IF;

    -- 4. Transfer requested picks
    IF array_length(v_trade.requested_picks, 1) > 0 THEN
        FOREACH v_requested_pick_num IN ARRAY v_trade.requested_picks
        LOOP
            UPDATE public.draft_order
            SET fantasy_team_id = v_trade.from_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.to_team_id
              AND pick_number = v_requested_pick_num
              AND is_completed = false;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer pick % (update returned no rows)', v_requested_pick_num;
            END IF;
        END LOOP;
    END IF;

    -- 5. Mark trade as accepted
    UPDATE public.draft_trade_offers
    SET status = 'accepted',
        responded_at = NOW()
    WHERE id = trade_id_param;

    -- 6. Cancel conflicting trades
    UPDATE public.draft_trade_offers
    SET status = 'cancelled'
    WHERE id != trade_id_param
      AND league_id = v_trade.league_id
      AND status = 'pending'
      AND (
          (offered_players && v_trade.offered_players) OR
          (offered_players && v_trade.requested_players) OR
          (requested_players && v_trade.offered_players) OR
          (requested_players && v_trade.requested_players) OR
          (offered_picks && v_trade.offered_picks) OR
          (offered_picks && v_trade.requested_picks) OR
          (requested_picks && v_trade.offered_picks) OR
          (requested_picks && v_trade.requested_picks)
      );

    -- Return success
    v_result := jsonb_build_object(
        'success', true,
        'trade_id', trade_id_param,
        'from_team_id', v_trade.from_team_id,
        'to_team_id', v_trade.to_team_id,
        'players_transferred', (
            COALESCE(array_length(v_trade.offered_players, 1), 0) + 
            COALESCE(array_length(v_trade.requested_players, 1), 0)
        ),
        'picks_transferred', (
            COALESCE(array_length(v_trade.offered_picks, 1), 0) + 
            COALESCE(array_length(v_trade.requested_picks, 1), 0)
        )
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_trade_offer TO authenticated;

