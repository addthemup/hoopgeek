-- ============================================================================
-- UPDATED DRAFT FUNCTIONS WITH SALARY CAP LOGIC
-- ============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS get_best_available_player(UUID, UUID);

-- Function: Get best available player for auto-draft WITH SALARY CAP
-- Uses ESPN projections and respects salary cap constraints
-- Implements tiered selection based on draft round
CREATE OR REPLACE FUNCTION get_best_available_player(
  league_id_param UUID,
  team_id_param UUID,
  current_round_param INTEGER DEFAULT 1,
  selection_strategy TEXT DEFAULT 'best_player' -- 'best_player', 'value', or 'affordable_value'
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
  remaining_cap_after BIGINT
) AS $$
DECLARE
  current_salary BIGINT;
  salary_cap BIGINT;
  remaining_cap BIGINT;
BEGIN
  -- Calculate team's current salary usage
  SELECT COALESCE(SUM(p.salary_2025_26), 0)
  INTO current_salary
  FROM fantasy_team_players ftp
  INNER JOIN players p ON ftp.player_id = p.id
  WHERE ftp.fantasy_team_id = team_id_param;
  
  -- Get league's salary cap
  SELECT COALESCE(l.salary_cap_amount, 100000000)
  INTO salary_cap
  FROM leagues l
  WHERE l.id = league_id_param;
  
  -- Calculate remaining cap space
  remaining_cap := salary_cap - current_salary;
  
  RAISE NOTICE 'Team salary: $%, Cap: $%, Remaining: $%', current_salary, salary_cap, remaining_cap;
  
  -- Return query based on selection strategy
  IF selection_strategy = 'best_player' THEN
    -- Early rounds: Pick best player if affordable
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
      (remaining_cap - p.salary_2025_26) as remaining_cap_after
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
      -- Player salary is affordable (must fit in remaining cap)
      AND p.salary_2025_26 <= remaining_cap
    ORDER BY projected_fantasy_points DESC
    LIMIT 1;
    
  ELSIF selection_strategy = 'value' THEN
    -- Mid rounds: Balance between best player and value
    RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.position,
      p.team_name,
      p.team_abbreviation,
      p.salary_2025_26,
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
      (remaining_cap - p.salary_2025_26) as remaining_cap_after
    FROM players p
    LEFT JOIN espn_player_projections ep ON ep.player_id = p.id
    WHERE 
      p.is_active = true
      AND p.id NOT IN (
        SELECT dp.player_id 
        FROM draft_picks dp 
        WHERE dp.league_id = league_id_param
      )
      AND p.salary_2025_26 <= remaining_cap
    ORDER BY 
      -- Weighted sort: 60% fantasy points, 40% value per dollar
      (projected_fantasy_points * 0.6 + value_per_dollar * 100000 * 0.4) DESC
    LIMIT 1;
    
  ELSE -- 'affordable_value' strategy
    -- Late rounds: Prioritize value per dollar
    RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.position,
      p.team_name,
      p.team_abbreviation,
      p.salary_2025_26,
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
      (remaining_cap - p.salary_2025_26) as remaining_cap_after
    FROM players p
    LEFT JOIN espn_player_projections ep ON ep.player_id = p.id
    WHERE 
      p.is_active = true
      AND p.id NOT IN (
        SELECT dp.player_id 
        FROM draft_picks dp 
        WHERE dp.league_id = league_id_param
      )
      AND p.salary_2025_26 <= remaining_cap
    ORDER BY value_per_dollar DESC
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_best_available_player TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_available_player TO service_role;

COMMENT ON FUNCTION get_best_available_player IS 'Returns the best available undrafted player based on ESPN projections and salary cap constraints. Supports tiered selection strategies.';

