-- ============================================================================
-- FANTASY-FIRST WITH PROGRESSIVE VALUE WEIGHTING
-- ============================================================================
-- Early rounds: Prioritize raw fantasy production (draft the stars)
-- Middle rounds: Balance fantasy production with value
-- Late rounds: Prioritize value (find hidden gems)

-- Drop the old function
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, INTEGER, INTEGER);

-- Function: Get best available player with PROGRESSIVE weighting strategy
-- Round 1-3: 90% fantasy points, 10% value (DRAFT THE STARS)
-- Round 4-6: 70% fantasy points, 30% value (QUALITY STARTERS)
-- Round 7-9: 50% fantasy points, 50% value (BALANCED)
-- Round 10-12: 30% fantasy points, 70% value (VALUE HUNTING)
-- Round 13+: 10% fantasy points, 90% value (PURE VALUE)
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
    fantasy_weight := 0.90;
    value_weight := 0.10;
    min_fantasy_points := 1800;
    min_games_played := 55;
  ELSIF current_round_param <= 6 THEN
    -- Rounds 4-6: QUALITY STARTERS - Still prioritize production
    fantasy_weight := 0.70;
    value_weight := 0.30;
    min_fantasy_points := 1500;
    min_games_played := 50;
  ELSIF current_round_param <= 9 THEN
    -- Rounds 7-9: BALANCED - Equal weight to production and value
    fantasy_weight := 0.50;
    value_weight := 0.50;
    min_fantasy_points := 1200;
    min_games_played := 45;
  ELSIF current_round_param <= 12 THEN
    -- Rounds 10-12: VALUE HUNTING - Start prioritizing value
    fantasy_weight := 0.30;
    value_weight := 0.70;
    min_fantasy_points := 900;
    min_games_played := 40;
  ELSE
    -- Rounds 13+: PURE VALUE - Find the best bargains
    fantasy_weight := 0.10;
    value_weight := 0.90;
    min_fantasy_points := 600;
    min_games_played := 30;
  END IF;
  
  RAISE NOTICE '=== FANTASY-FIRST PROGRESSIVE STRATEGY ===';
  RAISE NOTICE 'Round: %, Picks Remaining: %', current_round_param, picks_remaining_param;
  RAISE NOTICE 'Current Salary: $%, Salary Cap: $%', current_salary, salary_cap;
  RAISE NOTICE 'Remaining Cap: $%, Average Budget/Pick: $%', remaining_cap, average_budget;
  RAISE NOTICE 'Weights: %.0f%% Fantasy Points, %.0f%% Value', fantasy_weight * 100, value_weight * 100;
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
    np.is_active = true
    AND np.id NOT IN (
      SELECT fdp.player_id
      FROM fantasy_draft_picks fdp
      WHERE fdp.league_id = league_id_param
    )
    AND nhs.salary_2025_26 <= remaining_cap
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
      -- Use the actual calculated value, not the alias
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

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available player using FANTASY-FIRST with progressive value weighting. Early rounds prioritize elite fantasy production, later rounds shift toward value picks. Round 1-3: 90% fantasy/10% value, Round 4-6: 70/30, Round 7-9: 50/50, Round 10-12: 30/70, Round 13+: 10/90.';

DO $$
BEGIN
    RAISE NOTICE '✅ get_best_available_player function created successfully!';
    RAISE NOTICE '✅ Progressive weighting strategy implemented';
    RAISE NOTICE '✅ Early rounds: Draft the stars (90%% fantasy points)';
    RAISE NOTICE '✅ Late rounds: Find the bargains (90%% value)';
    RAISE NOTICE '✅ Uses fantasy_draft_picks for accurate salary calculations';
    RAISE NOTICE '✅ Respects salary cap constraints';
    RAISE NOTICE '';
END $$;
