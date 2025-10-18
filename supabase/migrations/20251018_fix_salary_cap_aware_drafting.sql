-- =====================================================
-- FIX: SALARY CAP-AWARE DRAFTING
-- =====================================================
-- This fixes the issue where teams go massively over cap
-- by enforcing budget discipline in the draft algorithm
-- =====================================================

DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_best_available_player(
  league_id_param UUID,
  team_id_param UUID,
  current_round_param INTEGER DEFAULT 1,
  picks_remaining_param INTEGER DEFAULT 15,
  total_picks_param INTEGER DEFAULT 15
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  "position" TEXT,
  team_name TEXT,
  team_abbreviation TEXT,
  salary_2025_26 BIGINT,
  projected_fantasy_points NUMERIC,
  value_per_dollar NUMERIC,
  remaining_cap_after BIGINT,
  average_budget_per_pick BIGINT,
  is_over_budget BOOLEAN
) AS $$
DECLARE
  current_salary BIGINT;
  salary_cap BIGINT;
  remaining_cap BIGINT;
  average_budget BIGINT;
  max_salary_allowed BIGINT;
  min_fantasy_points NUMERIC;
  min_games_played NUMERIC;
  fantasy_weight NUMERIC;
  value_weight NUMERIC;
BEGIN
  -- Calculate team's current salary usage from draft picks
  SELECT COALESCE(SUM(nhs.salary_2025_26), 0)
  INTO current_salary
  FROM fantasy_draft_picks fdp
  INNER JOIN nba_players np ON fdp.player_id = np.id
  INNER JOIN nba_hoopshype_salaries nhs ON np.id = nhs.player_id
  WHERE fdp.league_id = league_id_param
  AND fdp.fantasy_team_id = team_id_param;
  
  -- Get league's salary cap (default to $200M if not set)
  SELECT COALESCE(fls.salary_cap_amount, 200000000)
  INTO salary_cap
  FROM fantasy_league_seasons fls
  WHERE fls.league_id = league_id_param
  AND fls.is_active = true;
  
  -- Calculate remaining cap space
  remaining_cap := salary_cap - current_salary;
  
  -- Calculate average budget per remaining pick
  IF picks_remaining_param > 0 THEN
    average_budget := remaining_cap / picks_remaining_param;
  ELSE
    average_budget := remaining_cap;
  END IF;
  
  -- ===== SALARY CAP DISCIPLINE =====
  -- Prevent teams from going over cap by limiting max salary per pick
  -- Early rounds: Allow 2.5x average budget (for stars)
  -- Middle rounds: Allow 2.0x average budget (balanced)
  -- Late rounds: Strict average budget enforcement
  
  IF current_round_param <= 3 THEN
    -- Rounds 1-3: Can spend up to 2.5x average for elite stars
    max_salary_allowed := LEAST(average_budget * 2.5, remaining_cap);
    fantasy_weight := 0.90;
    value_weight := 0.10;
    min_fantasy_points := 1800;
    min_games_played := 55;
  ELSIF current_round_param <= 6 THEN
    -- Rounds 4-6: Can spend up to 2x average
    max_salary_allowed := LEAST(average_budget * 2.0, remaining_cap);
    fantasy_weight := 0.70;
    value_weight := 0.30;
    min_fantasy_points := 1500;
    min_games_played := 50;
  ELSIF current_round_param <= 9 THEN
    -- Rounds 7-9: Can spend up to 1.5x average
    max_salary_allowed := LEAST(average_budget * 1.5, remaining_cap);
    fantasy_weight := 0.50;
    value_weight := 0.50;
    min_fantasy_points := 1200;
    min_games_played := 45;
  ELSIF current_round_param <= 12 THEN
    -- Rounds 10-12: Strict average budget
    max_salary_allowed := LEAST(average_budget, remaining_cap);
    fantasy_weight := 0.30;
    value_weight := 0.70;
    min_fantasy_points := 900;
    min_games_played := 40;
  ELSE
    -- Rounds 13+: Must stay under average (find bargains)
    max_salary_allowed := LEAST(average_budget * 0.8, remaining_cap);
    fantasy_weight := 0.10;
    value_weight := 0.90;
    min_fantasy_points := 600;
    min_games_played := 30;
  END IF;
  
  -- Safety check: If already over cap, only allow minimum salary players
  IF remaining_cap < 0 THEN
    max_salary_allowed := 1000000; -- $1M minimum
  END IF;
  
  RAISE NOTICE '=== SALARY CAP-AWARE DRAFTING ===';
  RAISE NOTICE 'Round: %, Picks Remaining: %', current_round_param, picks_remaining_param;
  RAISE NOTICE 'Current Salary: $%, Salary Cap: $%', current_salary, salary_cap;
  RAISE NOTICE 'Remaining Cap: $%, Average Budget/Pick: $%', remaining_cap, average_budget;
  RAISE NOTICE 'Max Allowed This Pick: $% (%.1fx average)', max_salary_allowed, 
    CASE WHEN average_budget > 0 THEN max_salary_allowed::NUMERIC / average_budget ELSE 0 END;
  RAISE NOTICE 'Weights: %.0f%% Fantasy Points, %.0f%% Value', fantasy_weight * 100, value_weight * 100;
  
  -- Return best player with ENFORCED salary cap discipline
  RETURN QUERY
  SELECT 
    np.id,
    np.name,
    np.position,
    np.team_abbreviation as team_name,
    np.team_abbreviation,
    nhs.salary_2025_26,
    COALESCE(
      (
        (COALESCE(nep.proj_2026_pts, 0) * COALESCE(nep.proj_2026_gp, 0)) +
        (COALESCE(nep.proj_2026_reb, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.2) +
        (COALESCE(nep.proj_2026_ast, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.5) +
        (COALESCE(nep.proj_2026_stl, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
        (COALESCE(nep.proj_2026_blk, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
        (COALESCE(nep.proj_2026_to, 0) * COALESCE(nep.proj_2026_gp, 0) * -1) +
        (COALESCE(nep.proj_2026_3pm, 0) * COALESCE(nep.proj_2026_gp, 0) * 1)
      )::NUMERIC,
      0
    ) as projected_fantasy_points,
    CASE 
      WHEN nhs.salary_2025_26 > 0 THEN
        COALESCE(
          (
            (COALESCE(nep.proj_2026_pts, 0) * COALESCE(nep.proj_2026_gp, 0)) +
            (COALESCE(nep.proj_2026_reb, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.2) +
            (COALESCE(nep.proj_2026_ast, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.5) +
            (COALESCE(nep.proj_2026_stl, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
            (COALESCE(nep.proj_2026_blk, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
            (COALESCE(nep.proj_2026_to, 0) * COALESCE(nep.proj_2026_gp, 0) * -1) +
            (COALESCE(nep.proj_2026_3pm, 0) * COALESCE(nep.proj_2026_gp, 0) * 1)
          )::NUMERIC / nhs.salary_2025_26,
          0
        )
      ELSE 0
    END as value_per_dollar,
    (remaining_cap - nhs.salary_2025_26) as remaining_cap_after,
    average_budget as average_budget_per_pick,
    (nhs.salary_2025_26 > average_budget) as is_over_budget
  FROM nba_players np
  INNER JOIN nba_hoopshype_salaries nhs ON nhs.player_id = np.id
  LEFT JOIN nba_espn_projections nep ON nep.player_id = np.id
  WHERE 
    np.is_active = true
    AND np.id NOT IN (
      SELECT fdp.player_id
      FROM fantasy_draft_picks fdp
      WHERE fdp.league_id = league_id_param
    )
    -- ===== KEY FIX: Enforce max salary cap discipline =====
    AND nhs.salary_2025_26 <= max_salary_allowed
    AND nhs.salary_2025_26 > 0
    AND (
      (COALESCE(nep.proj_2026_pts, 0) * COALESCE(nep.proj_2026_gp, 0)) +
      (COALESCE(nep.proj_2026_reb, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(nep.proj_2026_ast, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(nep.proj_2026_stl, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
      (COALESCE(nep.proj_2026_blk, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
      (COALESCE(nep.proj_2026_to, 0) * COALESCE(nep.proj_2026_gp, 0) * -1) +
      (COALESCE(nep.proj_2026_3pm, 0) * COALESCE(nep.proj_2026_gp, 0) * 1)
    ) >= min_fantasy_points
    AND COALESCE(nep.proj_2026_gp, 0) >= min_games_played
  ORDER BY 
    (
      (
        (
          (COALESCE(nep.proj_2026_pts, 0) * COALESCE(nep.proj_2026_gp, 0)) +
          (COALESCE(nep.proj_2026_reb, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.2) +
          (COALESCE(nep.proj_2026_ast, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.5) +
          (COALESCE(nep.proj_2026_stl, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
          (COALESCE(nep.proj_2026_blk, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
          (COALESCE(nep.proj_2026_to, 0) * COALESCE(nep.proj_2026_gp, 0) * -1) +
          (COALESCE(nep.proj_2026_3pm, 0) * COALESCE(nep.proj_2026_gp, 0) * 1)
        )::NUMERIC / 100.0 * fantasy_weight
      ) + 
      (
        CASE 
          WHEN nhs.salary_2025_26 > 0 THEN
            (
              (COALESCE(nep.proj_2026_pts, 0) * COALESCE(nep.proj_2026_gp, 0)) +
              (COALESCE(nep.proj_2026_reb, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.2) +
              (COALESCE(nep.proj_2026_ast, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.5) +
              (COALESCE(nep.proj_2026_stl, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
              (COALESCE(nep.proj_2026_blk, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
              (COALESCE(nep.proj_2026_to, 0) * COALESCE(nep.proj_2026_gp, 0) * -1) +
              (COALESCE(nep.proj_2026_3pm, 0) * COALESCE(nep.proj_2026_gp, 0) * 1)
            )::NUMERIC / nhs.salary_2025_26 * 1000000.0 * value_weight
          ELSE 0
        END
      )
    ) DESC,
    (
      (COALESCE(nep.proj_2026_pts, 0) * COALESCE(nep.proj_2026_gp, 0)) +
      (COALESCE(nep.proj_2026_reb, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(nep.proj_2026_ast, 0) * COALESCE(nep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(nep.proj_2026_stl, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
      (COALESCE(nep.proj_2026_blk, 0) * COALESCE(nep.proj_2026_gp, 0) * 3) +
      (COALESCE(nep.proj_2026_to, 0) * COALESCE(nep.proj_2026_gp, 0) * -1) +
      (COALESCE(nep.proj_2026_3pm, 0) * COALESCE(nep.proj_2026_gp, 0) * 1)
    ) DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_best_available_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_available_player TO service_role;

COMMENT ON FUNCTION get_best_available_player IS 'CAP-AWARE DRAFTING: Enforces salary discipline by limiting max salary per pick based on average budget. Early rounds allow 2.5x average for stars, later rounds enforce stricter limits. This prevents teams from going massively over cap.';

