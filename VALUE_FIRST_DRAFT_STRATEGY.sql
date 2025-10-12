-- ============================================================================
-- VALUE-FIRST AGGRESSIVE DRAFT STRATEGY
-- ============================================================================
-- This update flips the weighting to prioritize VALUE (fantasy pts per dollar)
-- as the PRIMARY metric throughout the entire draft
--
-- Example: Victor Wembanyama (299 pts/$M) > Nikola Jokić (85 pts/$M)
--
-- Weighting by Round:
-- - Rounds 1-3:  85% Value, 15% Fantasy Points (can spend up to 2x avg)
-- - Rounds 4-7:  90% Value, 10% Fantasy Points (can spend up to 1.5x avg)
-- - Rounds 8-11: 95% Value,  5% Fantasy Points (stay near average)
-- - Rounds 12+: 100% Value,  0% Fantasy Points (must underspend at 0.8x avg)
-- ============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, INTEGER, INTEGER);

-- Function: Get best available player with VALUE-FIRST strategy
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
  budget_multiplier NUMERIC;
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
  
  -- Determine budget multiplier and weights based on round
  -- STRATEGY: Prioritize VALUE (pts per dollar) as PRIMARY metric across ALL rounds
  -- Early rounds: Allow overspending for elite value (Wemby > Jokić)
  -- Late rounds: Force underspending, pure value hunting
  IF current_round_param <= 3 THEN
    -- Rounds 1-3: Allow big spending but ONLY for elite value players
    budget_multiplier := 2.0;
    fantasy_weight := 0.15;  -- 15% fantasy points
    value_weight := 0.85;    -- 85% VALUE PER DOLLAR ⭐️
  ELSIF current_round_param <= 7 THEN
    -- Rounds 4-7: Moderate spending, heavy value emphasis
    budget_multiplier := 1.5;
    fantasy_weight := 0.10;  -- 10% fantasy points
    value_weight := 0.90;    -- 90% VALUE PER DOLLAR ⭐️⭐️
  ELSIF current_round_param <= 11 THEN
    -- Rounds 8-11: Near-average spending, extreme value focus
    budget_multiplier := 1.1;
    fantasy_weight := 0.05;  -- 5% fantasy points
    value_weight := 0.95;    -- 95% VALUE PER DOLLAR ⭐️⭐️⭐️
  ELSE
    -- Rounds 12+: Must underspend, PURE value hunting
    budget_multiplier := 0.8;
    fantasy_weight := 0.00;  -- 0% fantasy points
    value_weight := 1.00;    -- 100% VALUE PER DOLLAR ⭐️⭐️⭐️⭐️
  END IF;
  
  -- Calculate max affordable salary for this pick
  max_affordable := (average_budget * budget_multiplier)::BIGINT;
  
  -- Ensure we don't go over remaining cap
  IF max_affordable > remaining_cap THEN
    max_affordable := remaining_cap;
  END IF;
  
  RAISE NOTICE '=== VALUE-FIRST DRAFT STRATEGY ===';
  RAISE NOTICE 'Round: %, Picks Remaining: %', current_round_param, picks_remaining_param;
  RAISE NOTICE 'Current Salary: $%, Salary Cap: $%', current_salary, salary_cap;
  RAISE NOTICE 'Remaining Cap: $%, Average Budget/Pick: $%', remaining_cap, average_budget;
  RAISE NOTICE 'Max Affordable This Pick: $% (%.1fx average)', max_affordable, budget_multiplier;
  RAISE NOTICE 'Weights: %.0f%% Fantasy Points, %.0f%% VALUE PER DOLLAR 💰', fantasy_weight * 100, value_weight * 100;
  
  -- Return best player using VALUE-FIRST weighted formula
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
      ELSE 999999999  -- Free players have infinite value
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
    -- VALUE-FIRST weighted sort based on draft round
    -- Normalize fantasy points (divide by 1000) and value (multiply by 100000)
    -- to put them on similar scales for weighting
    (
      (projected_fantasy_points / 1000.0 * fantasy_weight) + 
      (value_per_dollar * 100000.0 * value_weight)
    ) DESC,
    -- Tiebreaker: prefer cheaper players in late rounds, more expensive in early
    CASE 
      WHEN current_round_param > 10 THEN p.salary_2025_26       -- Late: cheaper is better
      ELSE -p.salary_2025_26                                     -- Early: expensive is fine
    END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_best_available_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_available_player TO service_role;

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available player using VALUE-FIRST strategy (85-100% weighting on fantasy pts per dollar). Prioritizes efficient spending throughout the draft while respecting dynamic salary cap constraints.';

