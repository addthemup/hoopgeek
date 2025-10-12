-- CORRECT FIX: fantasy_team_id should be NULL initially
-- It only gets populated when picks are traded
-- This reverts the incorrect approach and fixes the trade validation

-- Revert: Remove the incorrect generate_draft_order that sets fantasy_team_id
-- Restore: Original function that leaves fantasy_team_id as NULL

CREATE OR REPLACE FUNCTION generate_draft_order(
  league_id_param UUID,
  total_rounds INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  team_count INTEGER;
  team_rec RECORD;
  team_list UUID[];
  shuffled_teams UUID[];
  i INTEGER;
  j INTEGER;
  round_num INTEGER;
  pick_num INTEGER;
  team_position INTEGER;
  is_snake BOOLEAN;
  random_team_id UUID;
BEGIN
  -- Get all teams (including empty ones for now)
  SELECT COUNT(*), ARRAY_AGG(id ORDER BY id) INTO team_count, team_list
  FROM fantasy_teams 
  WHERE league_id = league_id_param;
  
  IF team_count < 2 THEN
    RAISE NOTICE 'Not enough teams to generate draft order yet';
    RETURN false;
  END IF;
  
  -- Clear existing draft order
  DELETE FROM draft_order WHERE league_id = league_id_param;
  
  -- Create shuffled array for random draft order
  shuffled_teams := team_list;
  
  -- Simple shuffle algorithm (Fisher-Yates)
  FOR i IN 1..team_count LOOP
    j := floor(random() * (team_count - i + 1)) + i;
    random_team_id := shuffled_teams[i];
    shuffled_teams[i] := shuffled_teams[j];
    shuffled_teams[j] := random_team_id;
  END LOOP;
  
  pick_num := 1;
  
  -- Generate draft order for all rounds
  FOR round_num IN 1..total_rounds LOOP
    is_snake := (round_num % 2 = 0); -- Snake draft: even rounds go reverse
    
    FOR i IN 1..team_count LOOP
      IF is_snake THEN
        team_position := team_count - i + 1; -- Reverse order for even rounds
      ELSE
        team_position := i; -- Normal order for odd rounds
      END IF;
      
      -- ✅ CORRECT: Leave fantasy_team_id as NULL initially
      -- It will be populated only when picks are traded
      INSERT INTO draft_order (
        league_id,
        round,
        pick_number,
        team_position,
        is_completed
      ) VALUES (
        league_id_param,
        round_num,
        pick_num,
        team_position,
        false
      );
      
      pick_num := pick_num + 1;
    END LOOP;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update accept_trade_offer to handle NULL fantasy_team_id properly
-- NULL means "pick belongs to original owner (computed from team_position)"

CREATE OR REPLACE FUNCTION accept_trade_offer(
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
    v_expected_team_id uuid;
    v_team_list uuid[];
BEGIN
    -- Fetch the trade details
    SELECT * INTO v_trade
    FROM public.draft_trade_offers
    WHERE id = trade_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trade offer not found';
    END IF;
    
    -- Check that trade is still pending
    IF v_trade.status != 'pending' THEN
        RAISE EXCEPTION 'Trade offer is no longer pending (status: %)', v_trade.status;
    END IF;
    
    -- Check expiration
    IF v_trade.expires_at < NOW() THEN
        RAISE EXCEPTION 'Trade offer has expired';
    END IF;
    
    -- Verify that the accepting team is the recipient (or commissioner override)
    IF v_trade.to_team_id != accepting_team_id_param AND NOT is_commissioner_param THEN
        RAISE EXCEPTION 'Only the recipient team can accept this trade (or commissioner with override)';
    END IF;

    -- Get the sorted team list for the league (used to compute original owner from team_position)
    SELECT ARRAY_AGG(id ORDER BY id) INTO v_team_list
    FROM fantasy_teams
    WHERE league_id = v_trade.league_id;

    -- VALIDATE OFFERED PICKS (from_team owns them)
    IF array_length(v_trade.offered_picks, 1) > 0 THEN
        FOR v_offered_pick_num IN SELECT unnest(v_trade.offered_picks)
        LOOP
            SELECT pick_number, is_completed, fantasy_team_id, team_position INTO v_pick_check
            FROM public.draft_order
            WHERE pick_number = v_offered_pick_num
              AND league_id = v_trade.league_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Pick % does not exist in this league', v_offered_pick_num;
            END IF;
            
            IF v_pick_check.is_completed THEN
                RAISE EXCEPTION 'Pick % has already been made and cannot be traded', v_offered_pick_num;
            END IF;
            
            -- ✅ FIX: Compute expected owner
            -- If fantasy_team_id is NULL, owner is computed from team_position
            -- If fantasy_team_id is set, that's the current owner
            IF v_pick_check.fantasy_team_id IS NULL THEN
                v_expected_team_id := v_team_list[v_pick_check.team_position];
            ELSE
                v_expected_team_id := v_pick_check.fantasy_team_id;
            END IF;
            
            IF v_expected_team_id != v_trade.from_team_id THEN
                RAISE EXCEPTION 'Pick % is owned by a different team (expected: %, actual: %)', 
                    v_offered_pick_num, v_trade.from_team_id, v_expected_team_id;
            END IF;
        END LOOP;
    END IF;

    -- VALIDATE REQUESTED PICKS (to_team owns them)
    IF array_length(v_trade.requested_picks, 1) > 0 THEN
        FOR v_requested_pick_num IN SELECT unnest(v_trade.requested_picks)
        LOOP
            SELECT pick_number, is_completed, fantasy_team_id, team_position INTO v_pick_check
            FROM public.draft_order
            WHERE pick_number = v_requested_pick_num
              AND league_id = v_trade.league_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Pick % does not exist in this league', v_requested_pick_num;
            END IF;
            
            IF v_pick_check.is_completed THEN
                RAISE EXCEPTION 'Pick % has already been made and cannot be traded', v_requested_pick_num;
            END IF;
            
            -- ✅ FIX: Compute expected owner
            IF v_pick_check.fantasy_team_id IS NULL THEN
                v_expected_team_id := v_team_list[v_pick_check.team_position];
            ELSE
                v_expected_team_id := v_pick_check.fantasy_team_id;
            END IF;
            
            IF v_expected_team_id != v_trade.to_team_id THEN
                RAISE EXCEPTION 'Pick % is owned by a different team (expected: %, actual: %)', 
                    v_requested_pick_num, v_trade.to_team_id, v_expected_team_id;
            END IF;
        END LOOP;
    END IF;

    -- ALL VALIDATIONS PASSED - Now process the trade
    
    -- 1. Transfer offered players from_team → to_team
    IF array_length(v_trade.offered_players, 1) > 0 THEN
        FOR v_offered_player_id IN SELECT unnest(v_trade.offered_players)
        LOOP
            UPDATE public.draft_picks
            SET fantasy_team_id = v_trade.to_team_id
            WHERE player_id = v_offered_player_id
              AND league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.from_team_id;
        END LOOP;
    END IF;

    -- 2. Transfer requested players to_team → from_team
    IF array_length(v_trade.requested_players, 1) > 0 THEN
        FOR v_requested_player_id IN SELECT unnest(v_trade.requested_players)
        LOOP
            UPDATE public.draft_picks
            SET fantasy_team_id = v_trade.from_team_id
            WHERE player_id = v_requested_player_id
              AND league_id = v_trade.league_id
              AND fantasy_team_id = v_trade.to_team_id;
        END LOOP;
    END IF;

    -- 3. Transfer offered picks from_team → to_team
    IF array_length(v_trade.offered_picks, 1) > 0 THEN
        FOR v_offered_pick_num IN SELECT unnest(v_trade.offered_picks)
        LOOP
            UPDATE public.draft_order
            SET fantasy_team_id = v_trade.to_team_id
            WHERE pick_number = v_offered_pick_num
              AND league_id = v_trade.league_id;
        END LOOP;
    END IF;

    -- 4. Transfer requested picks to_team → from_team
    IF array_length(v_trade.requested_picks, 1) > 0 THEN
        FOR v_requested_pick_num IN SELECT unnest(v_trade.requested_picks)
        LOOP
            UPDATE public.draft_order
            SET fantasy_team_id = v_trade.from_team_id
            WHERE pick_number = v_requested_pick_num
              AND league_id = v_trade.league_id;
        END LOOP;
    END IF;

    -- 5. Mark trade as accepted
    UPDATE public.draft_trade_offers
    SET status = 'accepted',
        responded_at = NOW()
    WHERE id = trade_id_param;

    -- 6. Cancel any conflicting trades (same assets involved)
    UPDATE public.draft_trade_offers
    SET status = 'cancelled'
    WHERE id != trade_id_param
      AND league_id = v_trade.league_id
      AND status = 'pending'
      AND (
          offered_players && v_trade.offered_players OR
          offered_players && v_trade.requested_players OR
          requested_players && v_trade.offered_players OR
          requested_players && v_trade.requested_players OR
          offered_picks && v_trade.offered_picks OR
          offered_picks && v_trade.requested_picks OR
          requested_picks && v_trade.offered_picks OR
          requested_picks && v_trade.requested_picks
      );

    v_result := jsonb_build_object(
        'success', true,
        'trade_id', trade_id_param,
        'message', 'Trade accepted successfully'
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION accept_trade_offer IS 'Accepts a trade offer and transfers players/picks. Handles NULL fantasy_team_id (original owner computed from team_position).';
COMMENT ON FUNCTION generate_draft_order IS 'Generates snake draft order. Leaves fantasy_team_id NULL (only set when picks are traded).';

