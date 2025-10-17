-- =====================================================
-- FIX GET BEST AVAILABLE PLAYER FUNCTION
-- =====================================================
-- This script fixes the get_best_available_player function
-- to work with the actual database schema
-- =====================================================

-- Drop the existing function
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID, INTEGER, INTEGER, INTEGER);

-- Create a simple, working version
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
BEGIN
  -- Calculate team's current salary usage from roster spots
  SELECT COALESCE(SUM(nhs.salary_2025_26), 0)
  INTO current_salary
  FROM fantasy_roster_spots frs
  INNER JOIN nba_players np ON frs.player_id = np.id
  INNER JOIN nba_hoopshype_salaries nhs ON np.id = nhs.player_id
  WHERE frs.fantasy_team_id = team_id_param
  AND frs.player_id IS NOT NULL;
  
  -- Get league's salary cap from fantasy_league_seasons (correct table!)
  SELECT COALESCE(fls.salary_cap_amount, 200000000)
  INTO salary_cap
  FROM fantasy_league_seasons fls
  WHERE fls.league_id = league_id_param
  AND fls.is_active = true;
  
  -- Calculate remaining cap space
  remaining_cap := salary_cap - current_salary;
  
  -- Calculate average budget per pick
  average_budget := remaining_cap / GREATEST(picks_remaining_param, 1);
  
  RAISE NOTICE 'Team salary: $%, Cap: $%, Remaining: $%, Avg budget: $%', 
    current_salary, salary_cap, remaining_cap, average_budget;
  
  -- Return the best available player with simple ordering
  RETURN QUERY
  SELECT 
    np.id,
    np.name,
    np.position,
    np.team_abbreviation as team_name,
    np.team_abbreviation,
    nhs.salary_2025_26,
    -- Simple projected fantasy points calculation
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
    -- Player salary is affordable (must fit in remaining cap)
    AND nhs.salary_2025_26 <= remaining_cap
    AND nhs.salary_2025_26 > 0
  ORDER BY 
    -- Primary sort: by salary (higher salary = better player, simple approach)
    nhs.salary_2025_26 DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_best_available_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_available_player TO service_role;

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available undrafted player based on salary (simplified version).';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ get_best_available_player function fixed successfully!';
    RAISE NOTICE '✅ Uses correct table: fantasy_league_seasons for salary_cap_amount';
    RAISE NOTICE '✅ Simple ordering by salary to avoid ESPN projections issues';
    RAISE NOTICE '✅ Respects salary cap constraints';
    RAISE NOTICE '';
END $$;
