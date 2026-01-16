-- ============================================================================
-- GENERATE HISTORICAL LINEUPS
-- Creates tables and generates historical data for Team of the Night and Team of the Week
-- This data can be used for gamification badges on player pages
-- ============================================================================

-- ============================================================================
-- STEP 1: Create tables to store historical lineups
-- ============================================================================

-- Table for Team of the Night (daily lineups)
CREATE TABLE IF NOT EXISTS historical_team_of_night (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_date DATE NOT NULL,
    player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
    nba_player_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    team VARCHAR(10) NOT NULL,
    player_position VARCHAR(10) NOT NULL,
    jersey_number TEXT,
    salary BIGINT NOT NULL,
    fantasy_points DECIMAL NOT NULL,
    games_played INTEGER NOT NULL DEFAULT 1,
    lineup_order INTEGER NOT NULL,
    lineup_unit TEXT NOT NULL, -- 'starters', 'rotation', or 'bench'
    unit_position INTEGER NOT NULL, -- Position within unit (1-5 for starters/rotation, 1-2 for bench)
    weighted_points DECIMAL NOT NULL, -- fantasy_points * multiplier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_date, player_id, lineup_order)
);

-- Table for Team of the Week (weekly lineups)
CREATE TABLE IF NOT EXISTS historical_team_of_week (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    season_year INTEGER NOT NULL,
    player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
    nba_player_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    team VARCHAR(10) NOT NULL,
    player_position VARCHAR(10) NOT NULL,
    jersey_number TEXT,
    salary BIGINT NOT NULL,
    avg_fantasy_points DECIMAL NOT NULL,
    games_played INTEGER NOT NULL,
    lineup_order INTEGER NOT NULL,
    lineup_unit TEXT NOT NULL, -- 'starters', 'rotation', or 'bench'
    unit_position INTEGER NOT NULL, -- Position within unit (1-5 for starters/rotation, 1-2 for bench)
    weighted_points DECIMAL NOT NULL, -- avg_fantasy_points * multiplier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(week_start, week_end, player_id, lineup_order)
);

-- Add new columns if tables already exist (for position constraints and multipliers)
DO $$
BEGIN
  -- Add columns to historical_team_of_night if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'historical_team_of_night' AND column_name = 'lineup_unit'
  ) THEN
    ALTER TABLE historical_team_of_night 
    ADD COLUMN lineup_unit TEXT,
    ADD COLUMN unit_position INTEGER,
    ADD COLUMN weighted_points DECIMAL;
  END IF;
  
  -- Add columns to historical_team_of_week if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'historical_team_of_week' AND column_name = 'lineup_unit'
  ) THEN
    ALTER TABLE historical_team_of_week 
    ADD COLUMN lineup_unit TEXT,
    ADD COLUMN unit_position INTEGER,
    ADD COLUMN weighted_points DECIMAL;
  END IF;
END $$;

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_team_of_night_date ON historical_team_of_night(game_date);
CREATE INDEX IF NOT EXISTS idx_team_of_night_player ON historical_team_of_night(player_id);
CREATE INDEX IF NOT EXISTS idx_team_of_week_week ON historical_team_of_week(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_team_of_week_player ON historical_team_of_week(player_id);

-- ============================================================================
-- STEP 2: Create functions that accept date parameters
-- ============================================================================

-- Function to get optimal lineup for a specific date
CREATE OR REPLACE FUNCTION get_optimal_lineup_for_date(p_game_date DATE)
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
  lineup_order INTEGER,
  lineup_unit TEXT,
  unit_position INTEGER,
  weighted_points DECIMAL
) AS $$
DECLARE
  v_salary_cap BIGINT := 208000000;
  v_max_players INTEGER := 12;
BEGIN
  RETURN QUERY
  WITH player_performance AS (
    SELECT 
      p.id as player_id,
      p.nba_player_id,
      p.name as player_name,
      p.team_abbreviation::VARCHAR(10) as team,
      p."position"::VARCHAR(10) as player_position,
      COALESCE(p.jersey_number, '0')::TEXT as jersey_number,
      COALESCE(hs.salary_2025_26::BIGINT, 1157153) as salary,
      SUM(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as fantasy_points,
      COUNT(b.game_id)::INTEGER as games_played,
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
    WHERE b.game_date = p_game_date
      AND p.is_active = TRUE
      AND b.min > 0
      AND COALESCE(hs.salary_2025_26, 1157153) > 0
    GROUP BY 
      p.id, p.nba_player_id, p.name, p.team_abbreviation, 
      p."position", p.jersey_number, hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 1
  ),
  ranked_players AS (
    SELECT 
      pp.*,
      (pp.fantasy_points * 0.8 + (pp.points_per_dollar * 1000000) * 0.2) as selection_score,
      ROW_NUMBER() OVER (
        ORDER BY (pp.fantasy_points * 0.8 + (pp.points_per_dollar * 1000000) * 0.2) DESC
      ) as rank
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
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
  initial_lineup AS (
    SELECT 
      lwc.*
    FROM lineup_with_cumulative lwc
    WHERE lwc.cumulative_salary <= v_salary_cap::BIGINT
      AND lwc.selection_num <= v_max_players
  ),
  cap_info AS (
    SELECT 
      COALESCE(SUM(il.salary), 0) as used_salary,
      COALESCE(COUNT(*), 0) as player_count,
      v_salary_cap::BIGINT - COALESCE(SUM(il.salary), 0) as remaining_cap,
      v_max_players - COALESCE(COUNT(*), 0) as remaining_slots
    FROM initial_lineup il
  ),
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
        ORDER BY pp.salary ASC
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
  combined_lineup AS (
    SELECT 
      il.player_id, il.nba_player_id, il.player_name, il.team, il.player_position,
      il.jersey_number, il.salary, il.fantasy_points, il.games_played
    FROM initial_lineup il
    UNION ALL
    SELECT 
      ap.player_id, ap.nba_player_id, ap.player_name, ap.team, ap.player_position,
      ap.jersey_number, ap.salary, ap.fantasy_points, ap.games_played
    FROM additional_players ap
  ),
  final_cap_info AS (
    SELECT 
      COALESCE(SUM(cl.salary), 0) as used_salary,
      COALESCE(COUNT(*), 0) as player_count,
      v_salary_cap::BIGINT - COALESCE(SUM(cl.salary), 0) as remaining_cap
    FROM combined_lineup cl
  ),
  combined_lineup_stats AS (
    SELECT 
      COALESCE(SUM(cl.salary), 0) as total_salary,
      COUNT(*) as player_count
    FROM combined_lineup cl
  ),
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
  final_lineup AS (
    SELECT 
      cl.player_id, cl.nba_player_id, cl.player_name, cl.team, cl.player_position,
      cl.jersey_number, cl.salary, cl.fantasy_points, cl.games_played
    FROM combined_lineup cl
    CROSS JOIN combined_lineup_stats cls
    WHERE cls.player_count < v_max_players
       OR (
         cls.player_count = v_max_players
         AND cl.fantasy_points > (SELECT MIN(cl2.fantasy_points) FROM combined_lineup cl2)
       )
    UNION ALL
    SELECT 
      fls.player_id, fls.nba_player_id, fls.player_name, fls.team, fls.player_position,
      fls.jersey_number, fls.salary, fls.fantasy_points, fls.games_played
    FROM fill_last_slot fls
    WHERE EXISTS (SELECT 1 FROM fill_last_slot)
  )
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
    ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC)::INTEGER as lineup_order,
    -- Placeholder values until algorithm is updated with position constraints
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC) <= 5 THEN 'starters'::TEXT
      WHEN ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC) <= 10 THEN 'rotation'::TEXT
      ELSE 'bench'::TEXT
    END as lineup_unit,
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC) <= 5 THEN (ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC))::INTEGER
      WHEN ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC) <= 10 THEN (ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC) - 5)::INTEGER
      ELSE (ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC) - 10)::INTEGER
    END as unit_position,
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC) <= 5 THEN ROUND(fl.fantasy_points * 1.0, 1)
      WHEN ROW_NUMBER() OVER (ORDER BY fl.fantasy_points DESC) <= 10 THEN ROUND(fl.fantasy_points * 0.75, 1)
      ELSE ROUND(fl.fantasy_points * 0.5, 1)
    END as weighted_points
  FROM final_lineup fl
  ORDER BY fl.fantasy_points DESC
  LIMIT v_max_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get optimal lineup for a specific week
CREATE OR REPLACE FUNCTION get_optimal_lineup_for_week(p_week_start DATE, p_week_end DATE)
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
BEGIN
  RETURN QUERY
  WITH player_performance AS (
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
    WHERE b.game_date BETWEEN p_week_start AND p_week_end
      AND p.is_active = TRUE
      AND b.min > 0
      AND COALESCE(hs.salary_2025_26, 1157153) > 0
    GROUP BY 
      p.id, p.nba_player_id, p.name, p.team_abbreviation, 
      p."position", p.jersey_number, hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 1
  ),
  ranked_players AS (
    SELECT 
      pp.*,
      CASE 
        WHEN pp.salary > 30000000 THEN 
          (pp.avg_fantasy_points * 0.7 + (pp.points_per_dollar * 1000000) * 0.3)
        WHEN pp.salary > 15000000 THEN 
          (pp.avg_fantasy_points * 0.5 + (pp.points_per_dollar * 1000000) * 0.5)
        ELSE 
          (pp.avg_fantasy_points * 0.3 + (pp.points_per_dollar * 1000000) * 0.7)
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
  initial_lineup AS (
    SELECT 
      lwc.*
    FROM lineup_with_cumulative lwc
    WHERE lwc.cumulative_salary <= v_salary_cap::BIGINT
      AND lwc.selection_num <= 3
  ),
  cap_info AS (
    SELECT 
      COALESCE(SUM(il.salary), 0) as used_salary,
      COALESCE(COUNT(*), 0) as player_count,
      v_salary_cap::BIGINT - COALESCE(SUM(il.salary), 0) as remaining_cap,
      v_max_players - COALESCE(COUNT(*), 0) as remaining_slots
    FROM initial_lineup il
  ),
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
        ORDER BY pp.salary ASC
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
  combined_lineup AS (
    SELECT 
      il.player_id, il.nba_player_id, il.player_name, il.team, il.player_position,
      il.jersey_number, il.salary, il.avg_fantasy_points, il.games_played
    FROM initial_lineup il
    UNION ALL
    SELECT 
      ap.player_id, ap.nba_player_id, ap.player_name, ap.team, ap.player_position,
      ap.jersey_number, ap.salary, ap.avg_fantasy_points, ap.games_played
    FROM additional_players ap
  ),
  combined_lineup_stats AS (
    SELECT 
      COALESCE(SUM(cl.salary), 0) as total_salary,
      COUNT(*) as player_count
    FROM combined_lineup cl
  ),
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
  final_lineup AS (
    SELECT 
      cl.player_id, cl.nba_player_id, cl.player_name, cl.team, cl.player_position,
      cl.jersey_number, cl.salary, cl.avg_fantasy_points, cl.games_played
    FROM combined_lineup cl
    CROSS JOIN combined_lineup_stats cls
    WHERE cls.player_count < v_max_players
       OR (
         cls.player_count = v_max_players
         AND cl.avg_fantasy_points > (SELECT MIN(cl2.avg_fantasy_points) FROM combined_lineup cl2)
       )
    UNION ALL
    SELECT 
      fls.player_id, fls.nba_player_id, fls.player_name, fls.team, fls.player_position,
      fls.jersey_number, fls.salary, fls.avg_fantasy_points, fls.games_played
    FROM fill_last_slot fls
  )
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
    ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC)::INTEGER as lineup_order,
    -- Placeholder values until algorithm is updated with position constraints
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC) <= 5 THEN 'starters'::TEXT
      WHEN ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC) <= 10 THEN 'rotation'::TEXT
      ELSE 'bench'::TEXT
    END as lineup_unit,
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC) <= 5 THEN (ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC))::INTEGER
      WHEN ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC) <= 10 THEN (ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC) - 5)::INTEGER
      ELSE (ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC) - 10)::INTEGER
    END as unit_position,
    CASE 
      WHEN ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC) <= 5 THEN ROUND(fl.avg_fantasy_points * 1.0, 1)
      WHEN ROW_NUMBER() OVER (ORDER BY fl.avg_fantasy_points DESC) <= 10 THEN ROUND(fl.avg_fantasy_points * 0.75, 1)
      ELSE ROUND(fl.avg_fantasy_points * 0.5, 1)
    END as weighted_points
  FROM final_lineup fl
  ORDER BY fl.avg_fantasy_points DESC
  LIMIT v_max_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Generate historical data
-- ============================================================================

-- Function to generate all historical Team of the Night data
CREATE OR REPLACE FUNCTION generate_historical_team_of_night(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  dates_processed INTEGER,
  lineups_created INTEGER,
  errors INTEGER
) AS $$
DECLARE
  v_current_date DATE;
  v_dates_processed INTEGER := 0;
  v_lineups_created INTEGER := 0;
  v_errors INTEGER := 0;
  v_lineup_record RECORD;
BEGIN
  v_current_date := p_start_date;
  
  WHILE v_current_date <= p_end_date LOOP
    BEGIN
      -- Check if games exist for this date
      IF EXISTS (SELECT 1 FROM nba_boxscores WHERE game_date = v_current_date LIMIT 1) THEN
        -- Check if lineup already exists
        IF NOT EXISTS (SELECT 1 FROM historical_team_of_night WHERE game_date = v_current_date LIMIT 1) THEN
          -- Get lineup for this date
          FOR v_lineup_record IN 
            SELECT * FROM get_optimal_lineup_for_date(v_current_date)
          LOOP
            INSERT INTO historical_team_of_night (
              game_date, player_id, nba_player_id, player_name, team, 
              player_position, jersey_number, salary, fantasy_points, 
              games_played, lineup_order, lineup_unit, unit_position, weighted_points
            ) VALUES (
              v_current_date, v_lineup_record.player_id, v_lineup_record.nba_player_id,
              v_lineup_record.player_name, v_lineup_record.team, v_lineup_record.player_position,
              v_lineup_record.jersey_number, v_lineup_record.salary, v_lineup_record.fantasy_points,
              v_lineup_record.games_played, v_lineup_record.lineup_order,
              COALESCE(v_lineup_record.lineup_unit, 'bench'::TEXT),
              COALESCE(v_lineup_record.unit_position, v_lineup_record.lineup_order),
              COALESCE(v_lineup_record.weighted_points, v_lineup_record.fantasy_points)
            )
            ON CONFLICT (game_date, player_id, lineup_order) DO UPDATE SET
              lineup_unit = EXCLUDED.lineup_unit,
              unit_position = EXCLUDED.unit_position,
              weighted_points = EXCLUDED.weighted_points;
          END LOOP;
          
          v_lineups_created := v_lineups_created + 1;
        END IF;
      END IF;
      
      v_dates_processed := v_dates_processed + 1;
      v_current_date := v_current_date + INTERVAL '1 day';
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Error processing date %: %', v_current_date, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_dates_processed, v_lineups_created, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate all historical Team of the Week data
CREATE OR REPLACE FUNCTION generate_historical_team_of_week()
RETURNS TABLE(
  weeks_processed INTEGER,
  lineups_created INTEGER,
  errors INTEGER
) AS $$
DECLARE
  v_week_record RECORD;
  v_weeks_processed INTEGER := 0;
  v_lineups_created INTEGER := 0;
  v_errors INTEGER := 0;
  v_lineup_record RECORD;
BEGIN
  -- Get all weeks from nba_season_weeks up to today
  FOR v_week_record IN 
    SELECT 
      start_date, 
      end_date,
      season_year
    FROM nba_season_weeks
    WHERE end_date < CURRENT_DATE
      AND league_id = 0
    ORDER BY start_date
  LOOP
    BEGIN
      -- Check if lineup already exists
      IF NOT EXISTS (
        SELECT 1 FROM historical_team_of_week 
        WHERE week_start = v_week_record.start_date 
          AND week_end = v_week_record.end_date 
        LIMIT 1
      ) THEN
        -- Check if games exist for this week
        IF EXISTS (
          SELECT 1 FROM nba_boxscores 
          WHERE game_date BETWEEN v_week_record.start_date AND v_week_record.end_date 
          LIMIT 1
        ) THEN
          -- Get lineup for this week
          FOR v_lineup_record IN 
            SELECT * FROM get_optimal_lineup_for_week(
              v_week_record.start_date, 
              v_week_record.end_date
            )
          LOOP
            INSERT INTO historical_team_of_week (
              week_start, week_end, season_year, player_id, nba_player_id, 
              player_name, team, player_position, jersey_number, salary, 
              avg_fantasy_points, games_played, lineup_order, lineup_unit, unit_position, weighted_points
            ) VALUES (
              v_week_record.start_date, v_week_record.end_date, v_week_record.season_year,
              v_lineup_record.player_id, v_lineup_record.nba_player_id,
              v_lineup_record.player_name, v_lineup_record.team, v_lineup_record.player_position,
              v_lineup_record.jersey_number, v_lineup_record.salary, v_lineup_record.avg_fantasy_points,
              v_lineup_record.games_played, v_lineup_record.lineup_order,
              COALESCE(v_lineup_record.lineup_unit, 'bench'::TEXT),
              COALESCE(v_lineup_record.unit_position, v_lineup_record.lineup_order),
              COALESCE(v_lineup_record.weighted_points, v_lineup_record.avg_fantasy_points)
            )
            ON CONFLICT (week_start, week_end, player_id, lineup_order) DO UPDATE SET
              lineup_unit = EXCLUDED.lineup_unit,
              unit_position = EXCLUDED.unit_position,
              weighted_points = EXCLUDED.weighted_points;
          END LOOP;
          
          v_lineups_created := v_lineups_created + 1;
        END IF;
      END IF;
      
      v_weeks_processed := v_weeks_processed + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Error processing week % to %: %', 
        v_week_record.start_date, v_week_record.end_date, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_weeks_processed, v_lineups_created, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Run the generation scripts
-- ============================================================================

-- Generate Team of the Night for dates 2025-10-21 to 2025-11-10
SELECT * FROM generate_historical_team_of_night('2025-10-21'::DATE, '2025-11-10'::DATE);

-- Generate Team of the Week for all weeks up to today
SELECT * FROM generate_historical_team_of_week();

-- ============================================================================
-- STEP 5: Create helper functions for querying awards
-- ============================================================================

-- Function to get a player's Team of the Night appearances
CREATE OR REPLACE FUNCTION get_player_team_of_night_count(p_player_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT game_date)
    FROM historical_team_of_night
    WHERE player_id = p_player_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get a player's Team of the Week appearances
CREATE OR REPLACE FUNCTION get_player_team_of_week_count(p_player_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT week_start)
    FROM historical_team_of_week
    WHERE player_id = p_player_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all awards for a player
CREATE OR REPLACE FUNCTION get_player_awards(p_player_id UUID)
RETURNS TABLE(
  award_type TEXT,
  award_count INTEGER,
  latest_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'team_of_night'::TEXT as award_type,
    COUNT(DISTINCT game_date)::INTEGER as award_count,
    MAX(game_date)::DATE as latest_date
  FROM historical_team_of_night
  WHERE player_id = p_player_id
  UNION ALL
  SELECT 
    'team_of_week'::TEXT as award_type,
    COUNT(DISTINCT week_start)::INTEGER as award_count,
    MAX(week_end)::DATE as latest_date
  FROM historical_team_of_week
  WHERE player_id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON historical_team_of_night TO authenticated;
GRANT SELECT ON historical_team_of_week TO authenticated;
GRANT SELECT ON historical_team_of_night TO anon;
GRANT SELECT ON historical_team_of_week TO anon;

GRANT EXECUTE ON FUNCTION get_optimal_lineup_for_date(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_optimal_lineup_for_week(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_historical_team_of_night(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_historical_team_of_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_team_of_night_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_team_of_week_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_awards(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION get_optimal_lineup_for_date(DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_optimal_lineup_for_week(DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_player_team_of_night_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_player_team_of_week_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_player_awards(UUID) TO anon;

