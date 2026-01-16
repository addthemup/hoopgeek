-- ============================================================================
-- OPTIMAL LINEUP OF THE WEEK - 12 Player Optimal Lineup Under Salary Cap
-- Returns optimal 12-player lineup from previous week's games using averages
-- Stays within 208M salary cap
-- Uses salary_2025_26 from nba_hoopshype_salaries
-- Maximizes total average fantasy points using greedy algorithm
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
  v_salary_cap BIGINT := 208000000; -- 208 million salary cap
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

  -- If no previous week found, use last 7 days
  IF v_previous_week_start IS NULL THEN
    v_previous_week_start := CURRENT_DATE - INTERVAL '7 days';
    v_previous_week_end := CURRENT_DATE - INTERVAL '1 day';
  END IF;

  RETURN QUERY
  WITH previous_week_games AS (
    -- Get previous week date range
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
      COALESCE(hs.salary_2025_26::BIGINT, 1157153) as salary, -- Default to minimum salary if missing
      
      -- Calculate average fantasy points (FanDuel scoring) for the week
      AVG(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as avg_fantasy_points,
      
      COUNT(b.game_id)::INTEGER as games_played,
      
      -- Calculate points per dollar for optimization
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
  -- Optimal algorithm: Maximize average fantasy points while ensuring 12 players
  -- Step 1: Rank players by a smart combination that maximizes total points
  -- Use dynamic weighting based on salary tier to balance stars and value
  ranked_players AS (
    SELECT 
      pp.*,
      -- Dynamic scoring: For expensive players (>30M), weight points more. For cheap players, weight value more.
      -- This allows us to get stars while still filling with value players
      CASE 
        WHEN pp.salary > 30000000 THEN 
          (pp.avg_fantasy_points * 0.7 + (pp.points_per_dollar * 1000000) * 0.3)  -- Stars: 70% points
        WHEN pp.salary > 15000000 THEN 
          (pp.avg_fantasy_points * 0.5 + (pp.points_per_dollar * 1000000) * 0.5)  -- Mid: 50/50
        ELSE 
          (pp.avg_fantasy_points * 0.3 + (pp.points_per_dollar * 1000000) * 0.7)  -- Value: 70% value
      END as selection_score,
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE 
            WHEN pp.salary > 30000000 THEN 
              (pp.avg_fantasy_points * 0.7 + (pp.points_per_dollar * 1000000) * 0.3)
            WHEN pp.salary > 15000000 THEN 
              (pp.avg_fantasy_points * 0.5 + (pp.points_per_dollar * 1000000) * 0.5)
            ELSE 
              (pp.avg_fantasy_points * 0.3 + (pp.points_per_dollar * 1000000) * 0.7)
          END DESC
      ) as rank
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
  -- Step 2: Build initial lineup greedily using selection score
  -- Reserve cap space to ensure we can fill to 12 players
  lineup_with_cumulative AS (
    SELECT 
      rp.*,
      SUM(rp.salary) OVER (
        ORDER BY rp.rank
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_salary,
      ROW_NUMBER() OVER (ORDER BY rp.rank) as selection_num,
      -- Reserve minimum salary (1.15M) per remaining slot to ensure we can fill to 12
      (v_max_players - ROW_NUMBER() OVER (ORDER BY rp.rank)) * 1157153 as min_reserve_needed
    FROM ranked_players rp
  ),
  -- Step 3: Get initial selection - be VERY conservative to ensure we can fill to 12
  -- Hard limit of 3 players max to leave plenty of cap for filling
  initial_lineup AS (
    SELECT 
      lwc.*
    FROM lineup_with_cumulative lwc
    WHERE lwc.cumulative_salary <= v_salary_cap::BIGINT
      AND lwc.selection_num <= 3  -- Hard limit: max 3 players in initial selection
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
        ORDER BY pp.avg_fantasy_points DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_add_salary,
      ROW_NUMBER() OVER (ORDER BY pp.avg_fantasy_points DESC) as add_rank
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
        ORDER BY pp.salary ASC  -- Order by cheapest first when cap is tight
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_fill_salary,
      ROW_NUMBER() OVER (ORDER BY pp.salary ASC) as fill_rank
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
      aphs.jersey_number, aphs.salary, aphs.avg_fantasy_points, aphs.games_played
    FROM additional_players_high_score aphs
    UNION ALL
    SELECT 
      apv.player_id, apv.nba_player_id, apv.player_name, apv.team, apv.player_position, 
      apv.jersey_number, apv.salary, apv.avg_fantasy_points, apv.games_played
    FROM additional_players_value apv
    UNION ALL
    SELECT 
      apf.player_id, apf.nba_player_id, apf.player_name, apf.team, apf.player_position, 
      apf.jersey_number, apf.salary, apf.avg_fantasy_points, apf.games_played
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
      il.avg_fantasy_points,
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
      ap.avg_fantasy_points,
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
      AND pp.avg_fantasy_points > (SELECT MIN(cl3.avg_fantasy_points) FROM combined_lineup cl3)
      AND pp.salary <= (fci.used_salary + fci.remaining_cap - (SELECT MIN(cl4.salary) FROM combined_lineup cl4 WHERE cl4.avg_fantasy_points = (SELECT MIN(cl5.avg_fantasy_points) FROM combined_lineup cl5)))
    ORDER BY pp.avg_fantasy_points DESC
    LIMIT 1
  ),
  -- Step 9: Calculate total salary and count before making final decisions
  combined_lineup_stats AS (
    SELECT 
      COALESCE(SUM(cl.salary), 0) as total_salary,
      COUNT(*) as player_count
    FROM combined_lineup cl
  ),
  -- Step 10: If we have less than 12, try to fill ALL remaining slots aggressively
  -- Try multiple approaches: high-scoring first, then value, then cheapest
  fill_remaining_slots_final AS (
    SELECT 
      pp.*,
      cls.player_count,
      cls.total_salary,
      v_max_players - cls.player_count as slots_needed,
      v_salary_cap::BIGINT - cls.total_salary as remaining_cap,
      SUM(pp.salary) OVER (
        ORDER BY pp.avg_fantasy_points DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_fill_salary,
      ROW_NUMBER() OVER (ORDER BY pp.avg_fantasy_points DESC) as fill_rank
    FROM player_performance pp
    CROSS JOIN combined_lineup_stats cls
    WHERE cls.player_count < v_max_players
      AND pp.player_id NOT IN (SELECT cl2.player_id FROM combined_lineup cl2)
      AND pp.salary <= (v_salary_cap::BIGINT - cls.total_salary)
      AND pp.salary <= v_salary_cap::BIGINT
  ),
  fill_high_score AS (
    SELECT 
      frsf.*
    FROM fill_remaining_slots_final frsf
    WHERE frsf.cumulative_fill_salary <= frsf.remaining_cap
      AND frsf.fill_rank <= frsf.slots_needed
  ),
  -- If high-score fill didn't get us to 12, try value fill
  fill_needed_after_high AS (
    SELECT 
      (SELECT COUNT(*) FROM combined_lineup) + (SELECT COUNT(*) FROM fill_high_score) as current_count,
      (SELECT COALESCE(SUM(cl.salary), 0) FROM combined_lineup cl) + (SELECT COALESCE(SUM(fhs.salary), 0) FROM fill_high_score fhs) as total_used
  ),
  fill_value_final AS (
    SELECT 
      pp.*,
      fnah.current_count,
      v_max_players - fnah.current_count as slots_needed,
      v_salary_cap::BIGINT - fnah.total_used as remaining_cap,
      SUM(pp.salary) OVER (
        ORDER BY pp.points_per_dollar DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_value_fill,
      ROW_NUMBER() OVER (ORDER BY pp.points_per_dollar DESC) as value_fill_rank
    FROM player_performance pp
    CROSS JOIN fill_needed_after_high fnah
    WHERE fnah.current_count < v_max_players
      AND pp.player_id NOT IN (
        SELECT cl.player_id FROM combined_lineup cl
        UNION ALL
        SELECT fhs.player_id FROM fill_high_score fhs
      )
      AND pp.salary <= (v_salary_cap::BIGINT - fnah.total_used)
  ),
  fill_value_selected AS (
    SELECT fvf.*
    FROM fill_value_final fvf
    WHERE fvf.cumulative_value_fill <= fvf.remaining_cap
      AND fvf.value_fill_rank <= fvf.slots_needed
  ),
  -- If still not 12, fill with cheapest players
  fill_needed_after_value AS (
    SELECT 
      (SELECT COUNT(*) FROM combined_lineup) + 
      (SELECT COUNT(*) FROM fill_high_score) + 
      (SELECT COUNT(*) FROM fill_value_selected) as current_count,
      (SELECT COALESCE(SUM(cl.salary), 0) FROM combined_lineup cl) + 
      (SELECT COALESCE(SUM(fhs.salary), 0) FROM fill_high_score fhs) + 
      (SELECT COALESCE(SUM(fvs.salary), 0) FROM fill_value_selected fvs) as total_used
  ),
  fill_cheapest_final AS (
    SELECT 
      pp.*,
      fanv.current_count,
      v_max_players - fanv.current_count as slots_needed,
      v_salary_cap::BIGINT - fanv.total_used as remaining_cap,
      SUM(pp.salary) OVER (
        ORDER BY pp.salary ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_cheap_fill,
      ROW_NUMBER() OVER (ORDER BY pp.salary ASC) as cheap_fill_rank
    FROM player_performance pp
    CROSS JOIN fill_needed_after_value fanv
    WHERE fanv.current_count < v_max_players
      AND pp.player_id NOT IN (
        SELECT cl.player_id FROM combined_lineup cl
        UNION ALL
        SELECT fhs.player_id FROM fill_high_score fhs
        UNION ALL
        SELECT fvs.player_id FROM fill_value_selected fvs
      )
      AND pp.salary <= (v_salary_cap::BIGINT - fanv.total_used)
  ),
  fill_cheapest_selected AS (
    SELECT fcf.*
    FROM fill_cheapest_final fcf
    WHERE fcf.cumulative_cheap_fill <= fcf.remaining_cap
      AND fcf.cheap_fill_rank <= fcf.slots_needed
  ),
  -- Combine all fill players
  fill_last_slot AS (
    SELECT 
      fhs.player_id, fhs.nba_player_id, fhs.player_name, fhs.team, fhs.player_position,
      fhs.jersey_number, fhs.salary, fhs.avg_fantasy_points, fhs.games_played
    FROM fill_high_score fhs
    UNION ALL
    SELECT 
      fvs.player_id, fvs.nba_player_id, fvs.player_name, fvs.team, fvs.player_position,
      fvs.jersey_number, fvs.salary, fvs.avg_fantasy_points, fvs.games_played
    FROM fill_value_selected fvs
    UNION ALL
    SELECT 
      fcs.player_id, fcs.nba_player_id, fcs.player_name, fcs.team, fcs.player_position,
      fcs.jersey_number, fcs.salary, fcs.avg_fantasy_points, fcs.games_played
    FROM fill_cheapest_selected fcs
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
      cl.avg_fantasy_points,
      cl.games_played
    FROM combined_lineup cl
    CROSS JOIN combined_lineup_stats cls
    WHERE cls.player_count < v_max_players  -- If less than 12, keep ALL players
       OR (
         cls.player_count = v_max_players  -- If exactly 12
         AND (
           NOT EXISTS (SELECT 1 FROM upgrade_candidate uc CROSS JOIN combined_lineup_stats cls2 
                      WHERE (cls2.total_salary - (SELECT MIN(cl3.salary) FROM combined_lineup cl3 WHERE cl3.avg_fantasy_points = (SELECT MIN(cl4.avg_fantasy_points) FROM combined_lineup cl4)) + uc.salary) <= v_salary_cap::BIGINT)
           OR cl.avg_fantasy_points > (SELECT MIN(cl2.avg_fantasy_points) FROM combined_lineup cl2)  -- Keep all but worst if upgrade exists
         )
       )
    UNION ALL
    -- Add ALL fill players if we have less than 12
    SELECT 
      fls.player_id,
      fls.nba_player_id,
      fls.player_name,
      fls.team,
      fls.player_position,
      fls.jersey_number,
      fls.salary,
      fls.avg_fantasy_points,
      fls.games_played
    FROM fill_last_slot fls
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
      uc.avg_fantasy_points,
      uc.games_played
    FROM upgrade_candidate uc
    CROSS JOIN combined_lineup_stats cls
    WHERE EXISTS (SELECT 1 FROM upgrade_candidate)
      AND cls.player_count = v_max_players
      AND (cls.total_salary - (SELECT MIN(cl5.salary) FROM combined_lineup cl5 WHERE cl5.avg_fantasy_points = (SELECT MIN(cl6.avg_fantasy_points) FROM combined_lineup cl6)) + uc.salary) <= v_salary_cap::BIGINT
  )
  -- Return selected players ordered by average fantasy points
  SELECT 
    fl.player_id,
    fl.nba_player_id,
    fl.player_name,
    fl.team,
    fl.player_position,
    fl.jersey_number,
    fl.salary,
    ROUND(fl.avg_fantasy_points, 1) as avg_fantasy_points,
    fl.games_played,
    ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC)::INTEGER as lineup_order
  FROM final_lineup fl
  ORDER BY fl.avg_fantasy_points DESC
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
-- This function returns optimal 12-player lineup from PREVIOUS WEEK's games
-- Uses average fantasy points per game for the week
-- Uses two-phase greedy algorithm:
--   1. Select best value players (points-per-dollar) up to 12 or cap
--   2. Fill remaining cap space with highest-scoring players
-- Stays within 208M salary cap using salary_2025_26 from nba_hoopshype_salaries
-- Uses same FanDuel scoring: PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
-- ============================================================================

