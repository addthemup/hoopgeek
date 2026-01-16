-- ============================================================================
-- OPTIMAL LINEUP OF THE WEEK - TRUE OPTIMIZATION
-- Tries multiple strategies and returns the lineup with maximum average fantasy points
-- Stays within 208M salary cap
-- Uses salary_2025_26 from nba_hoopshype_salaries
-- ============================================================================

DROP FUNCTION IF EXISTS get_optimal_lineup_of_the_week();

CREATE OR REPLACE FUNCTION get_optimal_lineup_of_the_week()
RETURNS TABLE(
  player_id UUID,
  nba_player_id INTEGER,
  player_name TEXT,
  team VARCHAR(10),
  player_position VARCHAR(10),
  jersey_number TEXT,
  salary BIGINT,
  avg_fantasy_points DECIMAL,
  games_played INTEGER,
  lineup_order INTEGER
) AS $$
DECLARE
  v_salary_cap BIGINT := 208000000;
  v_max_players INTEGER := 12;
  v_previous_week_start DATE;
  v_previous_week_end DATE;
BEGIN
  -- Get previous week from nba_season_weeks
  SELECT 
    start_date,
    end_date
  INTO 
    v_previous_week_start,
    v_previous_week_end
  FROM nba_season_weeks
  WHERE season_year = 2026
    AND end_date < CURRENT_DATE
    AND league_id = 0
  ORDER BY end_date DESC
  LIMIT 1;

  IF v_previous_week_start IS NULL THEN
    v_previous_week_start := CURRENT_DATE - INTERVAL '7 days';
    v_previous_week_end := CURRENT_DATE - INTERVAL '1 day';
  END IF;

  RETURN QUERY
  WITH previous_week_games AS (
    SELECT 
      v_previous_week_start as week_start,
      v_previous_week_end as week_end
  ),
  player_performance AS (
    SELECT 
      p.id as player_id,
      p.nba_player_id,
      p.name as player_name,
      p.team_abbreviation::VARCHAR(10) as team,
      p."position"::VARCHAR(10) as player_position,
      COALESCE(p.jersey_number, '0')::TEXT as jersey_number,
      COALESCE(hs.salary_2025_26::BIGINT, 1157153) as salary,
      AVG(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as avg_fantasy_points,
      COUNT(b.game_id)::INTEGER as games_played,
      CASE 
        WHEN COALESCE(hs.salary_2025_26, 1157153) > 0 
        THEN AVG(
          COALESCE(b.pts, 0) + 
          (COALESCE(b.reb, 0) * 1.2) + 
          (COALESCE(b.ast, 0) * 1.5) + 
          (COALESCE(b.stl, 0) * 3) + 
          (COALESCE(b.blk, 0) * 3) - 
          (COALESCE(b.tov, 0) * 1)
        )::DECIMAL / COALESCE(hs.salary_2025_26, 1157153)::DECIMAL
        ELSE 0
      END as points_per_dollar
    FROM nba_players p
    JOIN nba_boxscores b ON p.nba_player_id = b.nba_player_id
    LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
    CROSS JOIN previous_week_games pwg
    WHERE b.game_date BETWEEN pwg.week_start AND pwg.week_end
      AND p.is_active = TRUE
      AND b.min > 0
      AND COALESCE(hs.salary_2025_26, 1157153) > 0
    GROUP BY 
      p.id, p.nba_player_id, p.name, p.team_abbreviation, 
      p."position", p.jersey_number, hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 1
  ),
  -- Strategy 1: Value-first approach (prioritize points per dollar)
  strategy1_ranked AS (
    SELECT 
      pp.*,
      ROW_NUMBER() OVER (ORDER BY pp.points_per_dollar DESC, pp.avg_fantasy_points DESC) as rank
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
  strategy1_cumulative AS (
    SELECT 
      sr.*,
      SUM(sr.salary) OVER (ORDER BY sr.rank ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_salary,
      ROW_NUMBER() OVER (ORDER BY sr.rank) as selection_num
    FROM strategy1_ranked sr
  ),
  strategy1_initial AS (
    SELECT sr.*
    FROM strategy1_cumulative sr
    WHERE sr.cumulative_salary <= v_salary_cap::BIGINT
      AND sr.selection_num <= v_max_players
      AND (v_salary_cap::BIGINT - sr.cumulative_salary) >= ((v_max_players - sr.selection_num) * 1500000)
  ),
  strategy1_fill AS (
    SELECT 
      pp.*,
      (SELECT COALESCE(SUM(s1.salary), 0) FROM strategy1_initial s1) as used_salary,
      (SELECT COUNT(*) FROM strategy1_initial s1) as player_count,
      v_salary_cap::BIGINT - (SELECT COALESCE(SUM(s1.salary), 0) FROM strategy1_initial s1) as remaining_cap,
      v_max_players - (SELECT COUNT(*) FROM strategy1_initial s1) as slots_needed,
      SUM(pp.salary) OVER (ORDER BY pp.avg_fantasy_points DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_fill,
      ROW_NUMBER() OVER (ORDER BY pp.avg_fantasy_points DESC) as fill_rank
    FROM player_performance pp
    WHERE pp.player_id NOT IN (SELECT s1.player_id FROM strategy1_initial s1)
      AND (SELECT COUNT(*) FROM strategy1_initial s1) < v_max_players
      AND pp.salary <= (v_salary_cap::BIGINT - (SELECT COALESCE(SUM(s1.salary), 0) FROM strategy1_initial s1))
  ),
  strategy1_filled AS (
    SELECT s1f.*
    FROM strategy1_fill s1f
    WHERE s1f.cumulative_fill <= s1f.remaining_cap
      AND s1f.fill_rank <= s1f.slots_needed
  ),
  strategy1_lineup AS (
    SELECT s1i.* FROM strategy1_initial s1i
    UNION ALL
    SELECT s1f.* FROM strategy1_filled s1f
  ),
  strategy1_score AS (
    SELECT 
      COALESCE(SUM(s1l.avg_fantasy_points), 0) as total_points,
      COALESCE(SUM(s1l.salary), 0) as total_salary,
      COUNT(*) as player_count
    FROM strategy1_lineup s1l
  ),
  -- Strategy 2: Points-first approach (prioritize highest scorers)
  strategy2_ranked AS (
    SELECT 
      pp.*,
      ROW_NUMBER() OVER (ORDER BY pp.avg_fantasy_points DESC, pp.points_per_dollar DESC) as rank
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
  strategy2_cumulative AS (
    SELECT 
      sr.*,
      SUM(sr.salary) OVER (ORDER BY sr.rank ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_salary,
      ROW_NUMBER() OVER (ORDER BY sr.rank) as selection_num
    FROM strategy2_ranked sr
  ),
  strategy2_initial AS (
    SELECT sr.*
    FROM strategy2_cumulative sr
    WHERE sr.cumulative_salary <= v_salary_cap::BIGINT
      AND sr.selection_num <= LEAST(5, v_max_players)
      AND (v_salary_cap::BIGINT - sr.cumulative_salary) >= ((v_max_players - sr.selection_num) * 2000000)
  ),
  strategy2_fill AS (
    SELECT 
      pp.*,
      (SELECT COALESCE(SUM(s2.salary), 0) FROM strategy2_initial s2) as used_salary,
      (SELECT COUNT(*) FROM strategy2_initial s2) as player_count,
      v_salary_cap::BIGINT - (SELECT COALESCE(SUM(s2.salary), 0) FROM strategy2_initial s2) as remaining_cap,
      v_max_players - (SELECT COUNT(*) FROM strategy2_initial s2) as slots_needed,
      SUM(pp.salary) OVER (ORDER BY pp.points_per_dollar DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_fill,
      ROW_NUMBER() OVER (ORDER BY pp.points_per_dollar DESC) as fill_rank
    FROM player_performance pp
    WHERE pp.player_id NOT IN (SELECT s2.player_id FROM strategy2_initial s2)
      AND (SELECT COUNT(*) FROM strategy2_initial s2) < v_max_players
      AND pp.salary <= (v_salary_cap::BIGINT - (SELECT COALESCE(SUM(s2.salary), 0) FROM strategy2_initial s2))
  ),
  strategy2_filled AS (
    SELECT s2f.*
    FROM strategy2_fill s2f
    WHERE s2f.cumulative_fill <= s2f.remaining_cap
      AND s2f.fill_rank <= s2f.slots_needed
  ),
  strategy2_lineup AS (
    SELECT s2i.* FROM strategy2_initial s2i
    UNION ALL
    SELECT s2f.* FROM strategy2_filled s2f
  ),
  strategy2_score AS (
    SELECT 
      COALESCE(SUM(s2l.avg_fantasy_points), 0) as total_points,
      COALESCE(SUM(s2l.salary), 0) as total_salary,
      COUNT(*) as player_count
    FROM strategy2_lineup s2l
  ),
  -- Strategy 3: Balanced approach (50/50)
  strategy3_ranked AS (
    SELECT 
      pp.*,
      (pp.avg_fantasy_points * 0.5 + (pp.points_per_dollar * 1000000) * 0.5) as selection_score,
      ROW_NUMBER() OVER (ORDER BY (pp.avg_fantasy_points * 0.5 + (pp.points_per_dollar * 1000000) * 0.5) DESC) as rank
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
  strategy3_cumulative AS (
    SELECT 
      sr.*,
      SUM(sr.salary) OVER (ORDER BY sr.rank ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_salary,
      ROW_NUMBER() OVER (ORDER BY sr.rank) as selection_num
    FROM strategy3_ranked sr
  ),
  strategy3_initial AS (
    SELECT sr.*
    FROM strategy3_cumulative sr
    WHERE sr.cumulative_salary <= v_salary_cap::BIGINT
      AND sr.selection_num <= LEAST(6, v_max_players)
      AND (v_salary_cap::BIGINT - sr.cumulative_salary) >= ((v_max_players - sr.selection_num) * 1500000)
  ),
  strategy3_fill AS (
    SELECT 
      pp.*,
      (SELECT COALESCE(SUM(s3.salary), 0) FROM strategy3_initial s3) as used_salary,
      (SELECT COUNT(*) FROM strategy3_initial s3) as player_count,
      v_salary_cap::BIGINT - (SELECT COALESCE(SUM(s3.salary), 0) FROM strategy3_initial s3) as remaining_cap,
      v_max_players - (SELECT COUNT(*) FROM strategy3_initial s3) as slots_needed,
      SUM(pp.salary) OVER (ORDER BY pp.avg_fantasy_points DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_fill,
      ROW_NUMBER() OVER (ORDER BY pp.avg_fantasy_points DESC) as fill_rank
    FROM player_performance pp
    WHERE pp.player_id NOT IN (SELECT s3.player_id FROM strategy3_initial s3)
      AND (SELECT COUNT(*) FROM strategy3_initial s3) < v_max_players
      AND pp.salary <= (v_salary_cap::BIGINT - (SELECT COALESCE(SUM(s3.salary), 0) FROM strategy3_initial s3))
  ),
  strategy3_filled AS (
    SELECT s3f.*
    FROM strategy3_fill s3f
    WHERE s3f.cumulative_fill <= s3f.remaining_cap
      AND s3f.fill_rank <= s3f.slots_needed
  ),
  strategy3_lineup AS (
    SELECT s3i.* FROM strategy3_initial s3i
    UNION ALL
    SELECT s3f.* FROM strategy3_filled s3f
  ),
  strategy3_score AS (
    SELECT 
      COALESCE(SUM(s3l.avg_fantasy_points), 0) as total_points,
      COALESCE(SUM(s3l.salary), 0) as total_salary,
      COUNT(*) as player_count
    FROM strategy3_lineup s3l
  ),
  -- Compare all strategies and pick the best one
  all_strategies AS (
    SELECT 
      1 as strategy_num,
      s1s.total_points,
      s1s.total_salary,
      s1s.player_count
    FROM strategy1_score s1s
    WHERE s1s.player_count = v_max_players AND s1s.total_salary <= v_salary_cap::BIGINT
    UNION ALL
    SELECT 
      2 as strategy_num,
      s2s.total_points,
      s2s.total_salary,
      s2s.player_count
    FROM strategy2_score s2s
    WHERE s2s.player_count = v_max_players AND s2s.total_salary <= v_salary_cap::BIGINT
    UNION ALL
    SELECT 
      3 as strategy_num,
      s3s.total_points,
      s3s.total_salary,
      s3s.player_count
    FROM strategy3_score s3s
    WHERE s3s.player_count = v_max_players AND s3s.total_salary <= v_salary_cap::BIGINT
  ),
  best_strategy AS (
    SELECT strategy_num
    FROM all_strategies
    ORDER BY total_points DESC, total_salary ASC
    LIMIT 1
  )
  -- Return the best lineup based on which strategy won
  best_lineup AS (
    SELECT 
      s1l.player_id,
      s1l.nba_player_id,
      s1l.player_name,
      s1l.team,
      s1l.player_position,
      s1l.jersey_number,
      s1l.salary,
      s1l.avg_fantasy_points,
      s1l.games_played
    FROM strategy1_lineup s1l
    WHERE (SELECT strategy_num FROM best_strategy) = 1
    UNION ALL
    SELECT 
      s2l.player_id,
      s2l.nba_player_id,
      s2l.player_name,
      s2l.team,
      s2l.player_position,
      s2l.jersey_number,
      s2l.salary,
      s2l.avg_fantasy_points,
      s2l.games_played
    FROM strategy2_lineup s2l
    WHERE (SELECT strategy_num FROM best_strategy) = 2
    UNION ALL
    SELECT 
      s3l.player_id,
      s3l.nba_player_id,
      s3l.player_name,
      s3l.team,
      s3l.player_position,
      s3l.jersey_number,
      s3l.salary,
      s3l.avg_fantasy_points,
      s3l.games_played
    FROM strategy3_lineup s3l
    WHERE (SELECT strategy_num FROM best_strategy) = 3
  )
  SELECT 
    bl.player_id,
    bl.nba_player_id,
    bl.player_name,
    bl.team,
    bl.player_position,
    bl.jersey_number,
    bl.salary,
    ROUND(bl.avg_fantasy_points, 1) as avg_fantasy_points,
    bl.games_played,
    ROW_NUMBER() OVER (ORDER BY bl.avg_fantasy_points DESC)::INTEGER as lineup_order
  FROM best_lineup bl
  ORDER BY bl.avg_fantasy_points DESC
  LIMIT v_max_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_optimal_lineup_of_the_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_optimal_lineup_of_the_week() TO anon;

-- Test the function
SELECT * FROM get_optimal_lineup_of_the_week();

-- ============================================================================
-- EXPLANATION:
-- This function tries 3 different strategies and returns the one with highest
-- total average fantasy points that fits under the salary cap with 12 players:
-- Strategy 1: Value-first (prioritize points per dollar)
-- Strategy 2: Points-first (prioritize highest scorers, limit to 5 initially)
-- Strategy 3: Balanced (50% points, 50% value)
-- Returns the strategy with maximum total fantasy points
-- ============================================================================

