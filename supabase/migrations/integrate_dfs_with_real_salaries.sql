-- ============================================================================
-- DFS Integration with Real NBA Salaries
-- ============================================================================
-- Purpose: Use actual NBA contract salaries for DFS contests
-- Differentiator: Players manage real salary caps like actual GMs
-- ============================================================================

-- ============================================================================
-- UPDATE DFS PLAYER SALARIES STRUCTURE
-- ============================================================================

-- Add comment to clarify this uses REAL NBA salaries
COMMENT ON COLUMN dfs_player_salaries.salary IS 'Real NBA salary from nba_hoopshype_salaries.salary_2025_26 (not DFS points)';

-- ============================================================================
-- FUNCTION: Generate DFS Player Salaries from Real NBA Salaries
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_dfs_salaries_from_real_contracts(
  p_pool_id UUID,
  p_season_year TEXT DEFAULT '2025-26'
)
RETURNS TABLE(
  players_added INTEGER,
  total_salary BIGINT,
  min_salary BIGINT,
  max_salary BIGINT,
  avg_salary BIGINT
) AS $$
DECLARE
  v_players_added INTEGER := 0;
  v_total_salary BIGINT := 0;
  v_min_salary BIGINT := 0;
  v_max_salary BIGINT := 0;
  v_avg_salary BIGINT := 0;
BEGIN
  -- Get teams playing in this pool's slate
  WITH pool_teams AS (
    SELECT DISTINCT unnest(ARRAY[home_team, away_team]) as team_abbr
    FROM dfs_pool_games
    WHERE pool_id = p_pool_id
  )
  -- Insert players with their REAL NBA salaries
  INSERT INTO dfs_player_salaries (
    pool_id,
    player_id,
    nba_player_id,
    player_name,
    player_team,
    player_position,
    salary,
    projected_points,
    is_active,
    is_playing
  )
  SELECT 
    p_pool_id,
    p.id,
    p.nba_player_id,
    p.name,
    p.team_abbreviation,
    p.position,
    -- Use REAL NBA salary from hoopshype
    COALESCE(
      CASE p_season_year
        WHEN '2025-26' THEN hs.salary_2025_26
        WHEN '2026-27' THEN hs.salary_2026_27
        WHEN '2027-28' THEN hs.salary_2027_28
        WHEN '2028-29' THEN hs.salary_2028_29
        ELSE hs.salary_2025_26
      END,
      -- Fallback for players without contracts (minimum salary)
      1157153  -- NBA minimum salary 2025-26 (0 years experience)
    ) as salary,
    -- Projected points (you'll calculate from stats)
    35.0 as projected_points,
    TRUE as is_active,
    TRUE as is_playing
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  WHERE p.team_abbreviation IN (SELECT team_abbr FROM pool_teams)
    AND p.is_active = TRUE
  ON CONFLICT (pool_id, player_id) DO UPDATE
  SET 
    salary = EXCLUDED.salary,
    player_name = EXCLUDED.player_name,
    player_team = EXCLUDED.player_team,
    player_position = EXCLUDED.player_position,
    updated_at = now();
  
  -- Get statistics
  SELECT 
    COUNT(*)::INTEGER,
    COALESCE(SUM(salary), 0),
    COALESCE(MIN(salary), 0),
    COALESCE(MAX(salary), 0),
    COALESCE(AVG(salary)::BIGINT, 0)
  INTO v_players_added, v_total_salary, v_min_salary, v_max_salary, v_avg_salary
  FROM dfs_player_salaries
  WHERE dfs_player_salaries.pool_id = p_pool_id;
  
  RETURN QUERY SELECT 
    v_players_added,
    v_total_salary,
    v_min_salary,
    v_max_salary,
    v_avg_salary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Validate Lineup Against Salary Cap (Real NBA Rules)
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_dfs_lineup_salary(
  p_lineup_id UUID,
  p_pool_id UUID
)
RETURNS TABLE(
  is_valid BOOLEAN,
  total_salary BIGINT,
  salary_cap BIGINT,
  remaining_cap BIGINT,
  is_over_cap BOOLEAN,
  player_count INTEGER
) AS $$
DECLARE
  v_total_salary BIGINT;
  v_salary_cap BIGINT;
  v_player_count INTEGER;
BEGIN
  -- Get pool salary cap
  SELECT salary_cap INTO v_salary_cap
  FROM dfs_pools
  WHERE id = p_pool_id;
  
  -- Calculate lineup total salary
  SELECT 
    COALESCE(SUM(player_salary), 0),
    COUNT(*)
  INTO v_total_salary, v_player_count
  FROM dfs_lineup_positions
  WHERE lineup_id = p_lineup_id;
  
  RETURN QUERY SELECT
    (v_total_salary <= v_salary_cap) as is_valid,
    v_total_salary,
    v_salary_cap,
    (v_salary_cap - v_total_salary) as remaining_cap,
    (v_total_salary > v_salary_cap) as is_over_cap,
    v_player_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Get Available Players by Salary Range
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dfs_players_by_salary_range(
  p_pool_id UUID,
  p_min_salary BIGINT DEFAULT 0,
  p_max_salary BIGINT DEFAULT 999999999,
  p_position TEXT DEFAULT NULL
)
RETURNS TABLE(
  player_id UUID,
  player_name TEXT,
  team TEXT,
  player_position TEXT,
  salary BIGINT,
  salary_formatted TEXT,
  projected_points DECIMAL,
  value_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.player_id,
    ps.player_name,
    ps.player_team,
    ps.player_position,
    ps.salary,
    '$' || TO_CHAR(ps.salary, 'FM999,999,999') as salary_formatted,
    ps.projected_points,
    ps.value_score
  FROM dfs_player_salaries ps
  WHERE ps.pool_id = p_pool_id
    AND ps.salary BETWEEN p_min_salary AND p_max_salary
    AND ps.is_active = TRUE
    AND ps.is_playing = TRUE
    AND (p_position IS NULL OR ps.player_position = p_position)
  ORDER BY ps.salary DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEW: DFS Lineup Summary with Real Salary Breakdown
-- ============================================================================

CREATE OR REPLACE VIEW dfs_lineup_summary AS
SELECT 
  l.id as lineup_id,
  l.pool_id,
  l.user_id,
  e.id as entry_id,
  
  -- Pool info
  p.name as pool_name,
  p.salary_cap,
  p.difficulty_tier,
  
  -- Lineup composition
  COUNT(lp.id) as total_players,
  COUNT(lp.id) FILTER (WHERE lp.unit = 'starters') as starters_count,
  COUNT(lp.id) FILTER (WHERE lp.unit = 'rotation') as rotation_count,
  COUNT(lp.id) FILTER (WHERE lp.unit = 'bench') as bench_count,
  
  -- Real salary breakdown
  COALESCE(SUM(lp.player_salary), 0) as total_salary,
  COALESCE(SUM(lp.player_salary) FILTER (WHERE lp.unit = 'starters'), 0) as starters_salary,
  COALESCE(SUM(lp.player_salary) FILTER (WHERE lp.unit = 'rotation'), 0) as rotation_salary,
  COALESCE(SUM(lp.player_salary) FILTER (WHERE lp.unit = 'bench'), 0) as bench_salary,
  
  -- Cap analysis
  (p.salary_cap - COALESCE(SUM(lp.player_salary), 0)) as remaining_cap,
  ROUND((COALESCE(SUM(lp.player_salary), 0)::DECIMAL / p.salary_cap * 100), 2) as cap_used_pct,
  (COALESCE(SUM(lp.player_salary), 0) <= p.salary_cap) as is_under_cap,
  
  -- Scoring
  COALESCE(SUM(lp.raw_fantasy_points), 0) as total_raw_points,
  COALESCE(SUM(lp.weighted_points), 0) as total_weighted_points,
  
  -- Status
  l.is_complete,
  l.is_valid,
  l.is_locked
  
FROM dfs_lineups l
JOIN dfs_pools p ON l.pool_id = p.id
LEFT JOIN dfs_entries e ON l.entry_id = e.id
LEFT JOIN dfs_lineup_positions lp ON l.id = lp.lineup_id
GROUP BY l.id, p.id, e.id;

-- ============================================================================
-- HELPER FUNCTION: Format Salary for Display
-- ============================================================================

CREATE OR REPLACE FUNCTION format_nba_salary(p_salary BIGINT)
RETURNS TEXT AS $$
BEGIN
  RETURN '$' || TO_CHAR(p_salary, 'FM999,999,999');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- QUERY EXAMPLES & DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION generate_dfs_salaries_from_real_contracts IS 
'Generates DFS player salaries using REAL NBA contract data from nba_hoopshype_salaries.
This is the key differentiator - players build lineups using actual NBA salaries, not arbitrary DFS pricing.';

COMMENT ON FUNCTION validate_dfs_lineup_salary IS
'Validates a DFS lineup against the pool salary cap using real NBA salaries.
Returns detailed breakdown of salary usage and cap compliance.';

COMMENT ON VIEW dfs_lineup_summary IS
'Comprehensive view of DFS lineups showing real NBA salary breakdown by unit (starters/rotation/bench).
Use this for lineup builder UI to show cap management in real-time.';

-- ============================================================================
-- SAMPLE USAGE
-- ============================================================================

/*

-- EXAMPLE 1: Create pool and generate real salaries
SELECT create_pool_from_template(
  'standard-template-id',
  '2025-10-27',
  'Main Slate',
  'admin-user-id'
) as pool_id \gset

-- Generate player salaries from REAL NBA contracts
SELECT * FROM generate_dfs_salaries_from_real_contracts(:pool_id, '2025-26');

-- Result:
-- players_added | total_salary    | min_salary | max_salary  | avg_salary
-- 300           | 4,234,567,890  | 1,157,153  | 51,915,615  | 14,115,226


-- EXAMPLE 2: Get players by salary tier
-- Superstars ($40M+)
SELECT * FROM get_dfs_players_by_salary_range(
  :pool_id,
  40000000,
  999999999
);

-- Mid-tier ($15M-$40M)
SELECT * FROM get_dfs_players_by_salary_range(
  :pool_id,
  15000000,
  40000000
);

-- Value plays ($1M-$15M)
SELECT * FROM get_dfs_players_by_salary_range(
  :pool_id,
  1000000,
  15000000
);


-- EXAMPLE 3: Validate lineup after adding players
SELECT * FROM validate_dfs_lineup_salary(
  'lineup-id',
  'pool-id'
);

-- Result:
-- is_valid | total_salary  | salary_cap   | remaining_cap | is_over_cap | player_count
-- true     | 195,432,789   | 207,800,000  | 12,367,211    | false       | 10


-- EXAMPLE 4: Get lineup summary
SELECT * FROM dfs_lineup_summary
WHERE lineup_id = 'your-lineup-id';

-- Shows full breakdown:
-- - Total salary vs cap
-- - Salary by unit (starters/rotation/bench)
-- - Cap used percentage
-- - Remaining cap
-- - Weighted points

*/

-- ============================================================================
-- REALISTIC LINEUP EXAMPLE
-- ============================================================================

/*

ELITE DIFFICULTY ($154.6M Cap):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STARTERS (1.0x) - $120M
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Stephen Curry    $51.9M  (must pay for elite)
2. OG Anunoby       $18.6M  (value starter)
3. Dillon Brooks    $13.5M  (cheap starter)
4. Patrick Williams $9.0M   (budget find)
5. Jaxson Hayes     $2.1M   (minimum guy)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROTATION (0.75x) - $25M
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. Jordan Clarkson  $14.3M  (6th man)
7. Kelly Oubre      $8.0M   (value rotation)
8. Shake Milton     $3.0M   (cheap bench)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BENCH (0.5x) - $8M
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. Svi Mykhailiuk   $3.9M   (cheap bench)
10. Drew Eubanks    $2.4M   (minimum)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: $153.7M / $154.6M ($900K remaining)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRATEGY:
- Spent big on Curry (elite scorer)
- Balanced with mid-tier starters
- Found value in rotation/bench
- Used every dollar wisely (like a real GM!)

*/

-- ============================================================================
-- END OF INTEGRATION
-- ============================================================================

