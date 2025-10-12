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
  total_picks_param INTEGER DEFAULT 15
)
RETURNS TABLE(
  id INTEGER,
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
  -- Calculate team's current salary usage
  SELECT COALESCE(SUM(p.salary_2025_26), 0)
  INTO current_salary
  FROM fantasy_team_players ftp
  INNER JOIN players p ON ftp.player_id = p.id
  WHERE ftp.fantasy_team_id = team_id_param;
  
  -- Get league's salary cap (default to $200M if not set)
  SELECT COALESCE(l.salary_cap_amount, 200000000)
  INTO salary_cap
  FROM leagues l
  WHERE l.id = league_id_param;
  
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
    p.id,
    p.name,
    p.position,
    p.team_name,
    p.team_abbreviation,
    p.salary_2025_26,
    -- Calculate projected fantasy points from ESPN projections
    COALESCE(
      (
        (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
        (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
        (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
        (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
        (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
      )::NUMERIC,
      0
    ) as projected_fantasy_points,
    -- Calculate value per dollar (fantasy points per dollar of salary)
    CASE 
      WHEN p.salary_2025_26 > 0 THEN
        COALESCE(
          (
            (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
            (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
            (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
            (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
            (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
            (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
            (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
          )::NUMERIC / p.salary_2025_26,
          0
        )
      ELSE 0
    END as value_per_dollar,
    (remaining_cap - p.salary_2025_26) as remaining_cap_after,
    average_budget,
    (p.salary_2025_26 > average_budget) as is_over_budget
  FROM players p
  LEFT JOIN espn_player_projections ep ON ep.player_id = p.id
  WHERE 
    -- Player is active
    p.is_active = true
    -- Player hasn't been drafted yet in this league
    AND p.id NOT IN (
      SELECT dp.player_id 
      FROM draft_picks dp 
      WHERE dp.league_id = league_id_param
    )
    -- Player must fit in remaining cap
    AND p.salary_2025_26 <= remaining_cap
    -- Player must have salary data
    AND p.salary_2025_26 > 0
    -- ===== QUALITY FILTERS (Progressive by Round) =====
    AND (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    ) >= min_fantasy_points
    AND COALESCE(ep.proj_2026_gp, 0) >= min_games_played
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

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available player using FANTASY-FIRST with progressive value weighting. Early rounds prioritize elite fantasy production, later rounds shift toward value picks. Round 1-3: 90% fantasy/10% value, Round 4-6: 70/30, Round 7-9: 50/50, Round 10-12: 30/70, Round 13+: 10/90.';

