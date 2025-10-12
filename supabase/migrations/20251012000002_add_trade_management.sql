-- Migration: Add Trade Management Functions
-- Description: Functions to fetch pending trades and accept/process trade offers

-- ============================================================================
-- Function: get_pending_trades
-- Description: Fetch pending trades for a team, or all trades if commissioner
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_trades(
    team_id_param uuid,
    league_id_param uuid,
    is_commissioner_param boolean DEFAULT false
)
RETURNS TABLE (
    id uuid,
    league_id uuid,
    from_team_id uuid,
    from_team_name text,
    to_team_id uuid,
    to_team_name text,
    offered_players jsonb,
    offered_picks jsonb,
    requested_players jsonb,
    requested_picks jsonb,
    status text,
    created_at timestamp with time zone,
    expires_at timestamp with time zone,
    is_expired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dto.id,
        dto.league_id,
        dto.from_team_id,
        ft_from.team_name as from_team_name,
        dto.to_team_id,
        ft_to.team_name as to_team_name,
        -- Get player details for offered players
        (
            SELECT jsonb_agg(jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'position', p.position,
                'team_abbreviation', p.team_abbreviation,
                'nba_player_id', p.nba_player_id,
                'salary_2025_26', p.salary_2025_26
            ))
            FROM unnest(dto.offered_players) AS player_id
            LEFT JOIN public.players p ON p.id = player_id
        ) as offered_players,
        -- Get pick details for offered picks
        (
            SELECT jsonb_agg(jsonb_build_object(
                'pick_number', do_pick.pick_number,
                'round', do_pick.round,
                'team_position', do_pick.team_position,
                'is_completed', do_pick.is_completed
            ))
            FROM unnest(dto.offered_picks) AS pick_num
            LEFT JOIN public.draft_order do_pick ON do_pick.pick_number = pick_num AND do_pick.league_id = dto.league_id
        ) as offered_picks,
        -- Get player details for requested players
        (
            SELECT jsonb_agg(jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'position', p.position,
                'team_abbreviation', p.team_abbreviation,
                'nba_player_id', p.nba_player_id,
                'salary_2025_26', p.salary_2025_26
            ))
            FROM unnest(dto.requested_players) AS player_id
            LEFT JOIN public.players p ON p.id = player_id
        ) as requested_players,
        -- Get pick details for requested picks
        (
            SELECT jsonb_agg(jsonb_build_object(
                'pick_number', do_pick.pick_number,
                'round', do_pick.round,
                'team_position', do_pick.team_position,
                'is_completed', do_pick.is_completed
            ))
            FROM unnest(dto.requested_picks) AS pick_num
            LEFT JOIN public.draft_order do_pick ON do_pick.pick_number = pick_num AND do_pick.league_id = dto.league_id
        ) as requested_picks,
        dto.status,
        dto.created_at,
        dto.expires_at,
        (dto.expires_at < now()) as is_expired
    FROM public.draft_trade_offers dto
    LEFT JOIN public.fantasy_teams ft_from ON ft_from.id = dto.from_team_id
    LEFT JOIN public.fantasy_teams ft_to ON ft_to.id = dto.to_team_id
    WHERE 
        dto.league_id = league_id_param
        AND dto.status = 'pending'
        AND (
            -- If commissioner, show all trades
            is_commissioner_param = true
            OR
            -- Otherwise, only show trades where user's team is involved
            (dto.from_team_id = team_id_param OR dto.to_team_id = team_id_param)
        )
    ORDER BY dto.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_pending_trades TO authenticated;

-- ============================================================================
-- Function: accept_trade_offer
-- Description: Accept and process a trade offer
-- ============================================================================
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

    -- Start processing the trade
    -- 1. Transfer offered players from from_team to to_team
    IF array_length(v_trade.offered_players, 1) > 0 THEN
        FOREACH v_offered_player_id IN ARRAY v_trade.offered_players
        LOOP
            -- Update draft_picks to change ownership
            UPDATE public.draft_picks
            SET fantasy_team_id = v_trade.to_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.from_team_id
              AND player_id = v_offered_player_id;
            
            -- Verify the update happened
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer player % from team % to team %', 
                    v_offered_player_id, v_trade.from_team_id, v_trade.to_team_id;
            END IF;
        END LOOP;
    END IF;

    -- 2. Transfer requested players from to_team to from_team
    IF array_length(v_trade.requested_players, 1) > 0 THEN
        FOREACH v_requested_player_id IN ARRAY v_trade.requested_players
        LOOP
            -- Update draft_picks to change ownership
            UPDATE public.draft_picks
            SET fantasy_team_id = v_trade.from_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.to_team_id
              AND player_id = v_requested_player_id;
            
            -- Verify the update happened
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer player % from team % to team %', 
                    v_requested_player_id, v_trade.to_team_id, v_trade.from_team_id;
            END IF;
        END LOOP;
    END IF;

    -- 3. Transfer offered picks from from_team to to_team
    IF array_length(v_trade.offered_picks, 1) > 0 THEN
        FOREACH v_offered_pick_num IN ARRAY v_trade.offered_picks
        LOOP
            -- Update draft_order to change team ownership
            UPDATE public.draft_order
            SET fantasy_team_id = v_trade.to_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.from_team_id
              AND pick_number = v_offered_pick_num
              AND is_completed = false;
            
            -- Verify the update happened
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer pick % from team % to team % (pick may be completed or not exist)', 
                    v_offered_pick_num, v_trade.from_team_id, v_trade.to_team_id;
            END IF;
        END LOOP;
    END IF;

    -- 4. Transfer requested picks from to_team to from_team
    IF array_length(v_trade.requested_picks, 1) > 0 THEN
        FOREACH v_requested_pick_num IN ARRAY v_trade.requested_picks
        LOOP
            -- Update draft_order to change team ownership
            UPDATE public.draft_order
            SET fantasy_team_id = v_trade.from_team_id
            WHERE league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.to_team_id
              AND pick_number = v_requested_pick_num
              AND is_completed = false;
            
            -- Verify the update happened
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to transfer pick % from team % to team % (pick may be completed or not exist)', 
                    v_requested_pick_num, v_trade.to_team_id, v_trade.from_team_id;
            END IF;
        END LOOP;
    END IF;

    -- 5. Mark trade as accepted
    UPDATE public.draft_trade_offers
    SET status = 'accepted'
    WHERE id = trade_id_param;

    -- 6. Cancel any other pending trades involving the traded assets
    -- This prevents double-trading the same assets
    UPDATE public.draft_trade_offers
    SET status = 'cancelled'
    WHERE id != trade_id_param
      AND league_id = v_trade.league_id
      AND status = 'pending'
      AND (
          -- Trades involving the same players
          (offered_players && v_trade.offered_players) OR
          (offered_players && v_trade.requested_players) OR
          (requested_players && v_trade.offered_players) OR
          (requested_players && v_trade.requested_players) OR
          -- Trades involving the same picks
          (offered_picks && v_trade.offered_picks) OR
          (offered_picks && v_trade.requested_picks) OR
          (requested_picks && v_trade.offered_picks) OR
          (requested_picks && v_trade.requested_picks)
      );

    -- Return success result
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.accept_trade_offer TO authenticated;

-- ============================================================================
-- Function: reject_trade_offer
-- Description: Reject a trade offer
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_trade_offer(
    trade_id_param uuid,
    rejecting_team_id_param uuid,
    is_commissioner_param boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trade public.draft_trade_offers;
    v_result jsonb;
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

    -- Validate rejecting team
    IF NOT is_commissioner_param THEN
        -- Only the recipient or sender team can reject
        IF rejecting_team_id_param != v_trade.to_team_id AND rejecting_team_id_param != v_trade.from_team_id THEN
            RAISE EXCEPTION 'Only teams involved in the trade can reject it';
        END IF;
    END IF;

    -- Mark trade as rejected
    UPDATE public.draft_trade_offers
    SET status = 'rejected'
    WHERE id = trade_id_param;

    -- Return success result
    v_result := jsonb_build_object(
        'success', true,
        'trade_id', trade_id_param,
        'status', 'rejected'
    );

    RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.reject_trade_offer TO authenticated;

-- ============================================================================
-- Add indexes for better performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_league_status 
    ON public.draft_trade_offers(league_id, status);

CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_from_team 
    ON public.draft_trade_offers(from_team_id);

CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_to_team 
    ON public.draft_trade_offers(to_team_id);

CREATE INDEX IF NOT EXISTS idx_draft_trade_offers_expires 
    ON public.draft_trade_offers(expires_at);

