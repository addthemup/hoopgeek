-- ============================================================================
-- AGGRESSIVE DRAFT STRATEGY WITH DYNAMIC SALARY CAP MANAGEMENT
-- ============================================================================
-- This replaces the previous tiered selection with a much more aggressive
-- and dynamic approach that calculates affordability on EVERY pick

-- Drop the old function
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, TEXT);

-- Function: Get best available player with AGGRESSIVE dynamic salary cap strategy
-- Calculates average budget per remaining pick and adjusts strategy accordingly
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
  max_affordable BIGINT;
  fantasy_weight NUMERIC;
  value_weight NUMERIC;
  cap_percentage NUMERIC;
  draft_progress NUMERIC;
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
  
  -- Calculate draft progress (0.0 = start, 1.0 = end)
  draft_progress := (total_picks_param - picks_remaining_param + 1.0) / total_picks_param::NUMERIC;
  
  -- NEW STRATEGY: Use percentage of REMAINING CAP instead of average budget multiplier
  -- This allows spending on elite players in early rounds
  IF current_round_param <= 3 THEN
    -- Rounds 1-3: Can spend up to 90% of remaining cap for elite players
    cap_percentage := 0.90;
    fantasy_weight := 0.15;  -- 15% fantasy points
    value_weight := 0.85;    -- 85% VALUE PER DOLLAR ⭐️
  ELSIF current_round_param <= 7 THEN
    -- Rounds 4-7: Can spend up to 75% of remaining cap
    cap_percentage := 0.75;
    fantasy_weight := 0.10;  -- 10% fantasy points
    value_weight := 0.90;    -- 90% VALUE PER DOLLAR ⭐️⭐️
  ELSIF current_round_param <= 11 THEN
    -- Rounds 8-11: Can spend up to 60% of remaining cap
    cap_percentage := 0.60;
    fantasy_weight := 0.05;  -- 5% fantasy points
    value_weight := 0.95;    -- 95% VALUE PER DOLLAR ⭐️⭐️⭐️
  ELSE
    -- Rounds 12+: Can spend up to 40% of remaining cap (conservative)
    cap_percentage := 0.40;
    fantasy_weight := 0.00;  -- 0% fantasy points
    value_weight := 1.00;    -- 100% VALUE PER DOLLAR ⭐️⭐️⭐️⭐️
  END IF;
  
  -- Calculate max affordable based on percentage of remaining cap
  max_affordable := (remaining_cap * cap_percentage)::BIGINT;
  
  -- Ensure we have at least average budget available
  IF max_affordable < average_budget THEN
    max_affordable := average_budget;
  END IF;
  
  -- Ensure we don't go over remaining cap
  IF max_affordable > remaining_cap THEN
    max_affordable := remaining_cap;
  END IF;
  
  RAISE NOTICE '=== ELITE-FIRST DRAFT STRATEGY ===';
  RAISE NOTICE 'Round: %, Picks Remaining: %', current_round_param, picks_remaining_param;
  RAISE NOTICE 'Current Salary: $%, Salary Cap: $%', current_salary, salary_cap;
  RAISE NOTICE 'Remaining Cap: $%, Average Budget/Pick: $%', remaining_cap, average_budget;
  RAISE NOTICE 'Max Affordable This Pick: $% (%.0f%% of remaining cap)', max_affordable, cap_percentage * 100;
  RAISE NOTICE 'Weights: %.0f%% Fantasy Points, %.0f%% VALUE PER DOLLAR 💰', fantasy_weight * 100, value_weight * 100;
  
  -- Return best player using dynamic weighted formula
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
    -- Calculate value per dollar
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
      ELSE 999999999
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
    -- HARD CONSTRAINT: Player must be affordable based on max_affordable
    AND p.salary_2025_26 <= max_affordable
    -- Player must fit in remaining cap
    AND p.salary_2025_26 <= remaining_cap
  ORDER BY 
    -- Dynamic weighted sort based on draft round
    -- Normalize fantasy points (divide by 1000) and value (multiply by 100000)
    -- to put them on similar scales for weighting
    (
      (projected_fantasy_points / 1000.0 * fantasy_weight) + 
      (value_per_dollar * 100000.0 * value_weight)
    ) DESC,
    -- Tiebreaker: prefer cheaper players in late rounds
    CASE 
      WHEN current_round_param > 10 THEN p.salary_2025_26
      ELSE -p.salary_2025_26
    END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_best_available_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_available_player TO service_role;

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available player using ELITE-FIRST strategy. Allows spending up to 90% of remaining cap in early rounds to get superstars, while maintaining value-per-dollar emphasis (85-100% weighting).';

