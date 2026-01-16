-- ============================================================================
-- OPTIMAL LINEUP OF THE NIGHT - 12 Player Optimal Lineup Under Salary Cap
-- Returns optimal 12-player lineup from yesterday's games
-- Stays within 207M salary cap (or standard DFS salary cap)
-- Uses salary_2025_26 from nba_hoopshype_salaries
-- Maximizes total fantasy points using greedy algorithm
-- ============================================================================

DROP FUNCTION IF EXISTS get_optimal_lineup_of_the_night();

CREATE OR REPLACE FUNCTION get_optimal_lineup_of_the_night()
RETURNS TABLE(
  player_id UUID,
  nba_player_id INTEGER,
  player_name TEXT,
  team VARCHAR(10),
  player_position VARCHAR(10),
  jersey_number TEXT,
  salary BIGINT,
  fantasy_points DECIMAL,
  games_played INTEGER,
  lineup_order INTEGER
) AS $$
DECLARE
  v_salary_cap BIGINT := 208000000; -- 207 million salary cap
  v_max_players INTEGER := 12;
BEGIN
  RETURN QUERY
  WITH last_night_games AS (
    -- Get yesterday's date
    SELECT 
      (CURRENT_DATE - INTERVAL '1 day')::DATE as game_date
  ),
  player_performance AS (
    SELECT 
      p.id as player_id,
      p.nba_player_id,
      p.name as player_name,
      p.team_abbreviation::VARCHAR(10) as team,
      p."position"::VARCHAR(10) as player_position,
      COALESCE(p.jersey_number, '0')::TEXT as jersey_number,
      COALESCE(hs.salary_2025_26::BIGINT, 1157153) as salary, -- Default to minimum salary if missing
      
      -- Calculate fantasy points (FanDuel scoring)
      SUM(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as fantasy_points,
      
      COUNT(b.game_id)::INTEGER as games_played,
      
      -- Calculate points per dollar for optimization
      CASE 
        WHEN COALESCE(hs.salary_2025_26, 1157153) > 0 
        THEN SUM(
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
    CROSS JOIN last_night_games lng
    WHERE b.game_date = lng.game_date
      AND p.is_active = TRUE
      AND b.min > 0
      AND COALESCE(hs.salary_2025_26, 1157153) > 0 -- Must have a salary
    GROUP BY 
      p.id, 
      p.nba_player_id, 
      p.name, 
      p.team_abbreviation, 
      p."position", 
      p.jersey_number,
      hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 1
  ),
  -- Improved algorithm: Prioritize high-scoring players while using cap efficiently
  -- Step 1: Rank players by a combination that heavily favors total points
  -- We want stars first, then fill with value players
  ranked_players AS (
    SELECT 
      pp.*,
      -- Weight: 80% fantasy points, 20% value (points per dollar)
      -- This heavily prioritizes getting the best players
      (pp.fantasy_points * 0.8 + (pp.points_per_dollar * 1000000) * 0.2) as selection_score,
      ROW_NUMBER() OVER (
        ORDER BY (pp.fantasy_points * 0.8 + (pp.points_per_dollar * 1000000) * 0.2) DESC
      ) as rank
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
  -- Step 2: Build initial lineup greedily using selection score
  lineup_with_cumulative AS (
    SELECT 
      rp.*,
      SUM(rp.salary) OVER (
        ORDER BY rp.rank
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_salary,
      ROW_NUMBER() OVER (ORDER BY rp.rank) as selection_num
    FROM ranked_players rp
  ),
  -- Step 3: Get initial selection (up to 12 players, under cap)
  initial_lineup AS (
    SELECT 
      lwc.*
    FROM lineup_with_cumulative lwc
    WHERE lwc.cumulative_salary <= v_salary_cap::BIGINT
      AND lwc.selection_num <= v_max_players
  ),
  -- Step 4: Calculate remaining cap space and slots
  cap_info AS (
    SELECT 
      COALESCE(SUM(il.salary), 0) as used_salary,
      COALESCE(COUNT(*), 0) as player_count,
      v_salary_cap::BIGINT - COALESCE(SUM(il.salary), 0) as remaining_cap,
      v_max_players - COALESCE(COUNT(*), 0) as remaining_slots
    FROM initial_lineup il
  ),
  -- Step 5: If we have remaining slots, fill them aggressively to reach 12 players
  -- First try highest-scoring players that fit individually
  fill_remaining_slots AS (
    SELECT 
      pp.*,
      ci.used_salary,
      ci.player_count,
      ci.remaining_cap,
      ci.remaining_slots,
      SUM(pp.salary) OVER (
        ORDER BY pp.fantasy_points DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_add_salary,
      ROW_NUMBER() OVER (ORDER BY pp.fantasy_points DESC) as add_rank
    FROM player_performance pp
    CROSS JOIN cap_info ci
    WHERE pp.player_id NOT IN (SELECT il2.player_id FROM initial_lineup il2)
      AND ci.player_count < v_max_players
      AND pp.salary <= ci.remaining_cap
      AND pp.salary <= v_salary_cap::BIGINT
  ),
  additional_players_high_score AS (
    SELECT 
      frs.*
    FROM fill_remaining_slots frs
    WHERE frs.cumulative_add_salary <= frs.remaining_cap
      AND frs.add_rank <= frs.remaining_slots
      AND frs.cumulative_add_salary <= v_salary_cap::BIGINT - (SELECT COALESCE(SUM(il.salary), 0) FROM initial_lineup il)
  ),
  -- If we still don't have 12, fill with best value players that fit
  current_lineup_count AS (
    SELECT 
      (SELECT COUNT(*) FROM initial_lineup il_count) + (SELECT COUNT(*) FROM additional_players_high_score ap_count) as current_count,
      (SELECT COALESCE(SUM(il_sum.salary), 0) FROM initial_lineup il_sum) + (SELECT COALESCE(SUM(ap_sum.salary), 0) FROM additional_players_high_score ap_sum) as total_used
  ),
  still_need_players AS (
    SELECT 
      clc.current_count,
      v_max_players - clc.current_count as still_needed,
      clc.total_used,
      v_salary_cap::BIGINT - clc.total_used as remaining_cap_after_add
    FROM current_lineup_count clc
  ),
  fill_with_value AS (
    SELECT 
      pp.*,
      snp.still_needed,
      snp.remaining_cap_after_add,
      SUM(pp.salary) OVER (
        ORDER BY pp.points_per_dollar DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_value_salary,
      ROW_NUMBER() OVER (ORDER BY pp.points_per_dollar DESC) as value_rank
    FROM player_performance pp
    CROSS JOIN still_need_players snp
    WHERE pp.player_id NOT IN (
        SELECT il.player_id FROM initial_lineup il
        UNION ALL
        SELECT ap.player_id FROM additional_players_high_score ap
      )
      AND snp.still_needed > 0
      AND pp.salary <= snp.remaining_cap_after_add
      AND pp.salary <= v_salary_cap::BIGINT
  ),
  additional_players_value AS (
    SELECT 
      fwv.*
    FROM fill_with_value fwv
    WHERE fwv.cumulative_value_salary <= fwv.remaining_cap_after_add
      AND fwv.value_rank <= fwv.still_needed
      AND fwv.cumulative_value_salary <= v_salary_cap::BIGINT - (
        (SELECT COALESCE(SUM(il.salary), 0) FROM initial_lineup il) + 
        (SELECT COALESCE(SUM(ap.salary), 0) FROM additional_players_high_score ap)
      )
  ),
  -- Final fallback: if we still don't have 12, fill with ANY affordable players
  final_fill_needed AS (
    SELECT 
      (SELECT COUNT(*) FROM initial_lineup il_cnt) + 
      (SELECT COUNT(*) FROM additional_players_high_score ap_cnt) + 
      (SELECT COUNT(*) FROM additional_players_value av_cnt) as current_count,
      (SELECT COALESCE(SUM(il_sal.salary), 0) FROM initial_lineup il_sal) + 
      (SELECT COALESCE(SUM(ap_sal.salary), 0) FROM additional_players_high_score ap_sal) + 
      (SELECT COALESCE(SUM(av_sal.salary), 0) FROM additional_players_value av_sal) as total_used
  ),
  fill_any_remaining AS (
    SELECT 
      pp.*,
      ffn.current_count,
      v_max_players - ffn.current_count as still_needed,
      v_salary_cap::BIGINT - ffn.total_used as remaining_cap,
      SUM(pp.salary) OVER (
        ORDER BY pp.fantasy_points DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_fill_salary,
      ROW_NUMBER() OVER (ORDER BY pp.fantasy_points DESC) as fill_rank
    FROM player_performance pp
    CROSS JOIN final_fill_needed ffn
    WHERE pp.player_id NOT IN (
        SELECT il.player_id FROM initial_lineup il
        UNION ALL
        SELECT ap.player_id FROM additional_players_high_score ap
        UNION ALL
        SELECT av.player_id FROM additional_players_value av
      )
      AND ffn.current_count < v_max_players
      AND pp.salary <= (v_salary_cap::BIGINT - ffn.total_used)
      AND pp.salary <= v_salary_cap::BIGINT
  ),
  additional_players_final AS (
    SELECT 
      far.*
    FROM fill_any_remaining far
    WHERE far.cumulative_fill_salary <= far.remaining_cap
      AND far.fill_rank <= far.still_needed
      AND far.cumulative_fill_salary <= v_salary_cap::BIGINT - (
        (SELECT COALESCE(SUM(il.salary), 0) FROM initial_lineup il) + 
        (SELECT COALESCE(SUM(ap.salary), 0) FROM additional_players_high_score ap) +
        (SELECT COALESCE(SUM(av.salary), 0) FROM additional_players_value av)
      )
  ),
  -- Combine all sets of additional players
  additional_players AS (
    SELECT 
      aphs.player_id, aphs.nba_player_id, aphs.player_name, aphs.team, aphs.player_position, 
      aphs.jersey_number, aphs.salary, aphs.fantasy_points, aphs.games_played
    FROM additional_players_high_score aphs
    UNION ALL
    SELECT 
      apv.player_id, apv.nba_player_id, apv.player_name, apv.team, apv.player_position, 
      apv.jersey_number, apv.salary, apv.fantasy_points, apv.games_played
    FROM additional_players_value apv
    UNION ALL
    SELECT 
      apf.player_id, apf.nba_player_id, apf.player_name, apf.team, apf.player_position, 
      apf.jersey_number, apf.salary, apf.fantasy_points, apf.games_played
    FROM additional_players_final apf
  ),
  -- Step 6: Combine initial lineup with additional players
  combined_lineup AS (
    SELECT 
      il.player_id,
      il.nba_player_id,
      il.player_name,
      il.team,
      il.player_position,
      il.jersey_number,
      il.salary,
      il.fantasy_points,
      il.games_played
    FROM initial_lineup il
    UNION ALL
    SELECT 
      ap.player_id,
      ap.nba_player_id,
      ap.player_name,
      ap.team,
      ap.player_position,
      ap.jersey_number,
      ap.salary,
      ap.fantasy_points,
      ap.games_played
    FROM additional_players ap
  ),
  -- Step 7: Calculate final cap usage
  final_cap_info AS (
    SELECT 
      COALESCE(SUM(cl.salary), 0) as used_salary,
      COALESCE(COUNT(*), 0) as player_count,
      v_salary_cap::BIGINT - COALESCE(SUM(cl.salary), 0) as remaining_cap
    FROM combined_lineup cl
  ),
  -- Step 8: Try to upgrade - replace lowest-scoring player with better player if we have cap
  upgrade_candidate AS (
    SELECT 
      pp.*
    FROM player_performance pp
    CROSS JOIN final_cap_info fci
    WHERE pp.player_id NOT IN (SELECT cl2.player_id FROM combined_lineup cl2)
      AND fci.player_count = v_max_players
      AND pp.fantasy_points > (SELECT MIN(cl3.fantasy_points) FROM combined_lineup cl3)
      AND pp.salary <= (fci.used_salary + fci.remaining_cap - (SELECT MIN(cl4.salary) FROM combined_lineup cl4 WHERE cl4.fantasy_points = (SELECT MIN(cl5.fantasy_points) FROM combined_lineup cl5)))
    ORDER BY pp.fantasy_points DESC
    LIMIT 1
  ),
  -- Step 9: Calculate total salary and count before making final decisions
  combined_lineup_stats AS (
    SELECT 
      COALESCE(SUM(cl.salary), 0) as total_salary,
      COUNT(*) as player_count
    FROM combined_lineup cl
  ),
  -- Step 10: If we have less than 12, try to fill remaining slot with best affordable player
  fill_last_slot AS (
    SELECT 
      pp.*
    FROM player_performance pp
    CROSS JOIN combined_lineup_stats cls
    WHERE cls.player_count < v_max_players
      AND pp.player_id NOT IN (SELECT cl2.player_id FROM combined_lineup cl2)
      AND pp.salary <= (v_salary_cap::BIGINT - cls.total_salary)
      AND pp.salary <= v_salary_cap::BIGINT
    ORDER BY pp.fantasy_points DESC
    LIMIT 1
  ),
  -- Step 11: Final lineup - ensure we have 12 players and stay under cap
  final_lineup AS (
    -- Include all players from combined lineup, except worst if we're doing an upgrade
    SELECT 
      cl.player_id,
      cl.nba_player_id,
      cl.player_name,
      cl.team,
      cl.player_position,
      cl.jersey_number,
      cl.salary,
      cl.fantasy_points,
      cl.games_played
    FROM combined_lineup cl
    CROSS JOIN combined_lineup_stats cls
    WHERE cls.player_count < v_max_players  -- If less than 12, keep ALL players
       OR (
         cls.player_count = v_max_players  -- If exactly 12
         AND (
           NOT EXISTS (SELECT 1 FROM upgrade_candidate uc CROSS JOIN combined_lineup_stats cls2 
                      WHERE (cls2.total_salary - (SELECT MIN(cl3.salary) FROM combined_lineup cl3 WHERE cl3.fantasy_points = (SELECT MIN(cl4.fantasy_points) FROM combined_lineup cl4)) + uc.salary) <= v_salary_cap::BIGINT)
           OR cl.fantasy_points > (SELECT MIN(cl2.fantasy_points) FROM combined_lineup cl2)  -- Keep all but worst if upgrade exists
         )
       )
    UNION ALL
    -- Add fill player if we have less than 12
    SELECT 
      fls.player_id,
      fls.nba_player_id,
      fls.player_name,
      fls.team,
      fls.player_position,
      fls.jersey_number,
      fls.salary,
      fls.fantasy_points,
      fls.games_played
    FROM fill_last_slot fls
    WHERE EXISTS (SELECT 1 FROM fill_last_slot)
    UNION ALL
    -- Add upgrade if we have 12 and upgrade is valid
    SELECT 
      uc.player_id,
      uc.nba_player_id,
      uc.player_name,
      uc.team,
      uc.player_position,
      uc.jersey_number,
      uc.salary,
      uc.fantasy_points,
      uc.games_played
    FROM upgrade_candidate uc
    CROSS JOIN combined_lineup_stats cls
    WHERE EXISTS (SELECT 1 FROM upgrade_candidate)
      AND cls.player_count = v_max_players
      AND (cls.total_salary - (SELECT MIN(cl5.salary) FROM combined_lineup cl5 WHERE cl5.fantasy_points = (SELECT MIN(cl6.fantasy_points) FROM combined_lineup cl6)) + uc.salary) <= v_salary_cap::BIGINT
  )
  -- Return selected players ordered by fantasy points
  SELECT 
    fl.player_id,
    fl.nba_player_id,
    fl.player_name,
    fl.team,
    fl.player_position,
    fl.jersey_number,
    fl.salary,
    ROUND(fl.fantasy_points, 1) as fantasy_points,
    fl.games_played,
    ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC)::INTEGER as lineup_order
  FROM final_lineup fl
  ORDER BY fl.fantasy_points DESC
  LIMIT v_max_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_optimal_lineup_of_the_night() TO authenticated;
GRANT EXECUTE ON FUNCTION get_optimal_lineup_of_the_night() TO anon;

-- Test the function
SELECT * FROM get_optimal_lineup_of_the_night();

-- Show what date it's checking
SELECT (CURRENT_DATE - INTERVAL '1 day')::DATE as yesterday;

-- Function to get summary statistics for optimal lineup
CREATE OR REPLACE FUNCTION get_optimal_lineup_summary()
RETURNS TABLE(
  players_selected BIGINT,
  total_salary BIGINT,
  total_fantasy_points DECIMAL,
  total_salary_millions DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as players_selected,
    COALESCE(SUM(salary), 0)::BIGINT as total_salary,
    COALESCE(ROUND(SUM(fantasy_points), 1), 0)::DECIMAL as total_fantasy_points,
    COALESCE(ROUND(SUM(salary)::DECIMAL / 1000000, 2), 0)::DECIMAL as total_salary_millions
  FROM get_optimal_lineup_of_the_night();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_optimal_lineup_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_optimal_lineup_summary() TO anon;

-- Test the summary function
SELECT * FROM get_optimal_lineup_summary();

-- Show total salary and points of optimal lineup (legacy test query)
SELECT 
  COUNT(*) as players_selected,
  SUM(salary) as total_salary,
  SUM(fantasy_points) as total_fantasy_points,
  ROUND(SUM(salary)::DECIMAL / 1000000, 2) as total_salary_millions
FROM get_optimal_lineup_of_the_night();

-- ============================================================================
-- EXPLANATION:
-- This function returns optimal 12-player lineup from YESTERDAY's games
-- Uses two-phase greedy algorithm:
--   1. Select best value players (points-per-dollar) up to 12 or cap
--   2. Fill remaining cap space with highest-scoring players
-- Stays within 207M salary cap using salary_2025_26 from nba_hoopshype_salaries
-- If no games yesterday, returns empty (component won't show)
-- Uses same FanDuel scoring: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
-- ============================================================================
