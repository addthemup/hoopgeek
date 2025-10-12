-- ============================================================================
-- VALUE-FIRST DRAFT STRATEGY
-- ============================================================================
-- This strategy PURELY prioritizes value (fantasy points per dollar)
-- Players with high fantasy points AND low salaries will be drafted first
-- This maximizes roster flexibility and overall team value

-- Drop the old function
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, INTEGER, INTEGER);

-- Function: Get best available player with VALUE-FIRST strategy
-- Orders purely by fantasy points per dollar (value)
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
  
  RAISE NOTICE '=== VALUE-FIRST DRAFT STRATEGY ===';
  RAISE NOTICE 'Round: %, Picks Remaining: %', current_round_param, picks_remaining_param;
  RAISE NOTICE 'Current Salary: $%, Salary Cap: $%', current_salary, salary_cap;
  RAISE NOTICE 'Remaining Cap: $%, Average Budget/Pick: $%', remaining_cap, average_budget;
  RAISE NOTICE 'Strategy: 100%% VALUE PER DOLLAR (Fantasy Points / Salary) 💰💰💰';
  
  -- Return best player PURELY by value per dollar
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
      ELSE 0  -- If no salary data, value is 0 (will be ranked last)
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
    -- Player must have salary data (exclude players with 0 or NULL salary)
    AND p.salary_2025_26 > 0
    -- Player must have projection data (exclude players with 0 fantasy points)
    AND (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    ) > 0
  ORDER BY 
    -- PURE VALUE: Fantasy points per dollar (highest value first)
    value_per_dollar DESC,
    -- Tiebreaker 1: Higher fantasy points
    projected_fantasy_points DESC,
    -- Tiebreaker 2: Lower salary (prefer cheaper players when value is equal)
    p.salary_2025_26 ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_best_available_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_available_player TO service_role;

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available player using VALUE-FIRST strategy. Orders purely by fantasy points per dollar (value). Players with high fantasy output and low salaries will be drafted first, maximizing roster flexibility and team value.';

