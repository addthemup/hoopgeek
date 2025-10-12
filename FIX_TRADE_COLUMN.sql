-- Fix: Add fantasy_team_id column to draft_order and update accept_trade_offer function
-- This enables pick trading by adding team ownership to draft_order

-- STEP 1: Add fantasy_team_id column to draft_order
ALTER TABLE draft_order ADD COLUMN IF NOT EXISTS fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE;

-- Populate fantasy_team_id for existing draft orders
UPDATE draft_order
SET fantasy_team_id = (
  SELECT ft.id
  FROM fantasy_teams ft
  WHERE ft.league_id = draft_order.league_id
  ORDER BY ft.id
  LIMIT 1 OFFSET (draft_order.team_position - 1)
)
WHERE fantasy_team_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_draft_order_fantasy_team_id ON draft_order(fantasy_team_id);

-- STEP 2: Update accept_trade_offer function to use fantasy_team_id
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
            -- Update draft_order to change team ownership (FIXED: using fantasy_team_id)
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
            -- Update draft_order to change team ownership (FIXED: using fantasy_team_id)
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

