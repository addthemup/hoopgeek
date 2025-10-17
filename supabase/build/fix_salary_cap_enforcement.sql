-- ============================================================================
-- FIX SALARY CAP ENFORCEMENT
-- ============================================================================
-- This fixes the get_best_available_player function to use fantasy_draft_picks
-- instead of fantasy_roster_spots for calculating current salary.
-- This ensures accurate cap space calculations during the draft.
-- ============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, INTEGER, INTEGER);

-- Recreate with the fix
CREATE OR REPLACE FUNCTION get_best_available_player(
  league_id_param UUID,
  team_id_param UUID,
  current_round_param INTEGER DEFAULT 1,
  picks_remaining_param INTEGER DEFAULT 15,
  total_picks_param INTEGER DEFAULT 150
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
  min_fantasy_points NUMERIC;
  min_games_played NUMERIC;
  fantasy_weight NUMERIC;
  value_weight NUMERIC;
BEGIN
  -- Calculate team's current salary usage from draft picks (source of truth)
  -- FIX: Changed from fantasy_roster_spots to fantasy_draft_picks
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
  
  -- ===== PROGRESSIVE WEIGHTING STRATEGY =====
  -- Early rounds: Fantasy production dominates (get the stars!)
  -- Late rounds: Value dominates (find the bargains!)
  
  IF current_round_param <= 3 THEN
    -- Rounds 1-3: ELITE STARS - Draft best fantasy producers
    fantasy_weight := 0.90;  -- 90% fantasy points
    value_weight := 0.10;    -- 10% value
    min_fantasy_points := 1800;  -- Elite production
    min_games_played := 55;
  ELSIF current_round_param <= 6 THEN
    -- Rounds 4-6: QUALITY STARTERS - Still prioritize production
    fantasy_weight := 0.70;  -- 70% fantasy points
    value_weight := 0.30;    -- 30% value
    min_fantasy_points := 1500;  -- Strong production
    min_games_played := 50;
  ELSIF current_round_param <= 9 THEN
    -- Rounds 7-9: BALANCED - Equal weight to production and value
    fantasy_weight := 0.50;  -- 50% fantasy points
    value_weight := 0.50;    -- 50% value
    min_fantasy_points := 1200;  -- Good production
    min_games_played := 45;
  ELSIF current_round_param <= 12 THEN
    -- Rounds 10-12: VALUE HUNTING - Start prioritizing value
    fantasy_weight := 0.30;  -- 30% fantasy points
    value_weight := 0.70;    -- 70% value
    min_fantasy_points := 900;   -- Decent production
    min_games_played := 40;
  ELSE
    -- Rounds 13+: PURE VALUE - Find the best bargains
    fantasy_weight := 0.10;  -- 10% fantasy points
    value_weight := 0.90;    -- 90% value
    min_fantasy_points := 600;   -- Minimum production
    min_games_played := 30;
  END IF;
  
  RAISE NOTICE '=== FANTASY-FIRST PROGRESSIVE STRATEGY ===';
  RAISE NOTICE 'Round: %, Picks Remaining: %', current_round_param, picks_remaining_param;
  RAISE NOTICE 'Current Salary: $%, Salary Cap: $%', current_salary, salary_cap;
  RAISE NOTICE 'Remaining Cap: $%, Average Budget/Pick: $%', remaining_cap, average_budget;
  RAISE NOTICE 'Weights: %.0f%% Fantasy Points, %.0f%% Value 💎', fantasy_weight * 100, value_weight * 100;
  RAISE NOTICE 'Min Thresholds: FP >= %, GP >= %', min_fantasy_points, min_games_played;
  
  -- Return best player using progressive weighted formula
  RETURN QUERY
  SELECT 
    np.id,
    np.name,
    np.position,
    np.team_abbreviation as team_name,
    np.team_abbreviation,
    nhs.salary_2025_26,
    -- Calculate projected fantasy points from ESPN projections
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
    -- Calculate value per dollar (fantasy points per dollar of salary)
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
    -- Player is active
    np.is_active = true
    -- Player hasn't been drafted yet in this league
    AND np.id NOT IN (
      SELECT fdp.player_id
      FROM fantasy_draft_picks fdp
      WHERE fdp.league_id = league_id_param
    )
    -- Player must fit in remaining cap
    AND nhs.salary_2025_26 <= remaining_cap
    -- Player must have salary data
    AND nhs.salary_2025_26 > 0
    -- ===== QUALITY FILTERS (Progressive by Round) =====
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
    -- PROGRESSIVE WEIGHTED FORMULA
    -- Normalize: fantasy_points (divide by 100) and value_per_dollar (multiply by 1000000)
    -- This puts them on similar scales for weighted combination
    (
      (projected_fantasy_points / 100.0 * fantasy_weight) + 
      (value_per_dollar * 1000000.0 * value_weight)
    ) DESC,
    -- Tiebreaker: Higher fantasy points (prefer better players)
    projected_fantasy_points DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_best_available_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_available_player TO service_role;

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available player using FANTASY-FIRST with progressive value weighting. FIX: Now uses fantasy_draft_picks for accurate salary calculations to prevent teams from going over cap.';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ get_best_available_player function updated successfully!';
    RAISE NOTICE '✅ FIX: Now uses fantasy_draft_picks for accurate salary calculations';
    RAISE NOTICE '✅ This prevents teams from going over the salary cap during auto-draft';
    RAISE NOTICE '';
END $$;

