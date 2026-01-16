-- ============================================================================
-- UPDATE HISTORICAL LINEUP FUNCTIONS WITH POSITION CONSTRAINTS
-- Updates get_optimal_lineup_for_date and get_optimal_lineup_for_week
-- to use the same position constraints and multipliers as the main functions
-- ============================================================================

-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS get_optimal_lineup_for_date(DATE);
DROP FUNCTION IF EXISTS get_optimal_lineup_for_week(DATE, DATE);

-- ============================================================================
-- STEP 1: Update get_optimal_lineup_for_date to match Team of the Night structure
-- ============================================================================

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
      COUNT(b.game_id)::INTEGER as games_played
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
  -- Position eligibility helper
  position_eligible AS (
    SELECT 
      pp.*,
      (pp.player_position ILIKE '%Guard%' OR pp.player_position IN ('PG', 'SG', 'G', 'Guard')) as can_play_guard,
      (pp.player_position ILIKE '%Forward%' OR pp.player_position IN ('SF', 'PF', 'F', 'Forward')) as can_play_forward,
      (pp.player_position ILIKE '%Center%' OR pp.player_position = 'C') as can_play_center
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
  -- Slot definitions with multipliers
  slots AS (
    SELECT 1 as slot_order, 'starters'::TEXT as unit, 1 as unit_pos, 'G'::TEXT as req_pos, 1.0::DECIMAL as mult
    UNION ALL SELECT 2, 'starters', 2, 'G', 1.0
    UNION ALL SELECT 3, 'starters', 3, 'F', 1.0
    UNION ALL SELECT 4, 'starters', 4, 'F', 1.0
    UNION ALL SELECT 5, 'starters', 5, 'C', 1.0
    UNION ALL SELECT 6, 'rotation', 1, 'G', 0.75
    UNION ALL SELECT 7, 'rotation', 2, 'G', 0.75
    UNION ALL SELECT 8, 'rotation', 3, 'F', 0.75
    UNION ALL SELECT 9, 'rotation', 4, 'F', 0.75
    UNION ALL SELECT 10, 'rotation', 5, 'C', 0.75
    UNION ALL SELECT 11, 'bench', 1, 'Util', 0.5
    UNION ALL SELECT 12, 'bench', 2, 'Util', 0.5
  ),
  -- For each slot, find eligible players with weighted scores
  slot_candidates AS (
    SELECT 
      s.slot_order,
      s.unit,
      s.unit_pos,
      s.req_pos,
      s.mult,
      pe.player_id,
      pe.nba_player_id,
      pe.player_name,
      pe.team,
      pe.player_position,
      pe.jersey_number,
      pe.salary,
      pe.fantasy_points,
      pe.games_played,
      pe.fantasy_points * s.mult as weighted_points,
      (pe.fantasy_points * s.mult) / NULLIF(pe.salary, 0) as weighted_value,
      CASE 
        WHEN s.req_pos = 'Util' THEN 1
        WHEN (s.req_pos = 'G' AND pe.can_play_guard) THEN 1
        WHEN (s.req_pos = 'F' AND pe.can_play_forward) THEN 1
        WHEN (s.req_pos = 'C' AND pe.can_play_center) THEN 1
        ELSE 2
      END as position_priority
    FROM slots s
    CROSS JOIN position_eligible pe
  ),
  -- Rank candidates for each slot
  ranked_candidates AS (
    SELECT 
      sc.*,
      CASE 
        WHEN sc.slot_order <= 5 THEN 
          (sc.weighted_points * 0.7 + sc.weighted_value * 1000000 * 0.3)
        WHEN sc.slot_order <= 10 THEN 
          (sc.weighted_points * 0.5 + sc.weighted_value * 1000000 * 0.5)
        ELSE 
          (sc.weighted_points * 0.3 + sc.weighted_value * 1000000 * 0.7)
      END as balanced_score,
      ROW_NUMBER() OVER (
        PARTITION BY sc.slot_order
        ORDER BY 
          sc.position_priority ASC, 
          CASE 
            WHEN sc.slot_order <= 5 THEN 
              (sc.weighted_points * 0.7 + sc.weighted_value * 1000000 * 0.3)
            WHEN sc.slot_order <= 10 THEN 
              (sc.weighted_points * 0.5 + sc.weighted_value * 1000000 * 0.5)
            ELSE 
              (sc.weighted_points * 0.3 + sc.weighted_value * 1000000 * 0.7)
          END DESC
      ) as rank_in_slot
    FROM slot_candidates sc
  ),
  -- Greedy selection: Process slots sequentially (same as Team of the Night)
  -- This is a simplified version - in production, you'd want the full iterative CTE structure
  -- For now, we'll use a simpler approach that still respects position constraints
  slot1 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      rc.salary as cumulative_salary,
      ARRAY[rc.player_id]::UUID[] as used_players
    FROM ranked_candidates rc
    WHERE rc.slot_order = 1
      AND rc.salary <= (v_salary_cap::BIGINT - ((v_max_players - 1) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot2 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s1.cumulative_salary + rc.salary as cumulative_salary,
      s1.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot1 s1
    WHERE rc.slot_order = 2
      AND NOT (rc.player_id = ANY(s1.used_players))
      AND (s1.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 2) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot3 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s2.cumulative_salary + rc.salary as cumulative_salary,
      s2.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot2 s2
    WHERE rc.slot_order = 3
      AND NOT (rc.player_id = ANY(s2.used_players))
      AND (s2.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 3) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot4 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s3.cumulative_salary + rc.salary as cumulative_salary,
      s3.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot3 s3
    WHERE rc.slot_order = 4
      AND NOT (rc.player_id = ANY(s3.used_players))
      AND (s3.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 4) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot5 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s4.cumulative_salary + rc.salary as cumulative_salary,
      s4.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot4 s4
    WHERE rc.slot_order = 5
      AND NOT (rc.player_id = ANY(s4.used_players))
      AND (s4.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 5) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot6 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s5.cumulative_salary + rc.salary as cumulative_salary,
      s5.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot5 s5
    WHERE rc.slot_order = 6
      AND NOT (rc.player_id = ANY(s5.used_players))
      AND (s5.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 6) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot7 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s6.cumulative_salary + rc.salary as cumulative_salary,
      s6.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot6 s6
    WHERE rc.slot_order = 7
      AND NOT (rc.player_id = ANY(s6.used_players))
      AND (s6.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 7) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot8 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s7.cumulative_salary + rc.salary as cumulative_salary,
      s7.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot7 s7
    WHERE rc.slot_order = 8
      AND NOT (rc.player_id = ANY(s7.used_players))
      AND (s7.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 8) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot9 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s8.cumulative_salary + rc.salary as cumulative_salary,
      s8.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot8 s8
    WHERE rc.slot_order = 9
      AND NOT (rc.player_id = ANY(s8.used_players))
      AND (s8.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 9) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot10 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s9.cumulative_salary + rc.salary as cumulative_salary,
      s9.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot9 s9
    WHERE rc.slot_order = 10
      AND NOT (rc.player_id = ANY(s9.used_players))
      AND (s9.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 10) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot11 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s10.cumulative_salary + rc.salary as cumulative_salary,
      s10.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot10 s10
    WHERE rc.slot_order = 11
      AND NOT (rc.player_id = ANY(s10.used_players))
      AND (s10.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 11) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot12 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s11.cumulative_salary + rc.salary as cumulative_salary,
      s11.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot11 s11
    WHERE rc.slot_order = 12
      AND NOT (rc.player_id = ANY(s11.used_players))
      AND (s11.cumulative_salary + rc.salary) <= v_salary_cap::BIGINT
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  -- Combine all slots
  lineup_builder AS (
    SELECT s1.player_id, s1.nba_player_id, s1.player_name, s1.team, s1.player_position, 
           s1.jersey_number, s1.salary, s1.fantasy_points, s1.games_played, 
           s1.unit, s1.unit_pos, s1.weighted_points
    FROM slot1 s1 WHERE s1.player_id IS NOT NULL
    UNION ALL SELECT s2.player_id, s2.nba_player_id, s2.player_name, s2.team, s2.player_position, 
           s2.jersey_number, s2.salary, s2.fantasy_points, s2.games_played, 
           s2.unit, s2.unit_pos, s2.weighted_points
    FROM slot2 s2 WHERE s2.player_id IS NOT NULL
    UNION ALL SELECT s3.player_id, s3.nba_player_id, s3.player_name, s3.team, s3.player_position, 
           s3.jersey_number, s3.salary, s3.fantasy_points, s3.games_played, 
           s3.unit, s3.unit_pos, s3.weighted_points
    FROM slot3 s3 WHERE s3.player_id IS NOT NULL
    UNION ALL SELECT s4.player_id, s4.nba_player_id, s4.player_name, s4.team, s4.player_position, 
           s4.jersey_number, s4.salary, s4.fantasy_points, s4.games_played, 
           s4.unit, s4.unit_pos, s4.weighted_points
    FROM slot4 s4 WHERE s4.player_id IS NOT NULL
    UNION ALL SELECT s5.player_id, s5.nba_player_id, s5.player_name, s5.team, s5.player_position, 
           s5.jersey_number, s5.salary, s5.fantasy_points, s5.games_played, 
           s5.unit, s5.unit_pos, s5.weighted_points
    FROM slot5 s5 WHERE s5.player_id IS NOT NULL
    UNION ALL SELECT s6.player_id, s6.nba_player_id, s6.player_name, s6.team, s6.player_position, 
           s6.jersey_number, s6.salary, s6.fantasy_points, s6.games_played, 
           s6.unit, s6.unit_pos, s6.weighted_points
    FROM slot6 s6 WHERE s6.player_id IS NOT NULL
    UNION ALL SELECT s7.player_id, s7.nba_player_id, s7.player_name, s7.team, s7.player_position, 
           s7.jersey_number, s7.salary, s7.fantasy_points, s7.games_played, 
           s7.unit, s7.unit_pos, s7.weighted_points
    FROM slot7 s7 WHERE s7.player_id IS NOT NULL
    UNION ALL SELECT s8.player_id, s8.nba_player_id, s8.player_name, s8.team, s8.player_position, 
           s8.jersey_number, s8.salary, s8.fantasy_points, s8.games_played, 
           s8.unit, s8.unit_pos, s8.weighted_points
    FROM slot8 s8 WHERE s8.player_id IS NOT NULL
    UNION ALL SELECT s9.player_id, s9.nba_player_id, s9.player_name, s9.team, s9.player_position, 
           s9.jersey_number, s9.salary, s9.fantasy_points, s9.games_played, 
           s9.unit, s9.unit_pos, s9.weighted_points
    FROM slot9 s9 WHERE s9.player_id IS NOT NULL
    UNION ALL SELECT s10.player_id, s10.nba_player_id, s10.player_name, s10.team, s10.player_position, 
           s10.jersey_number, s10.salary, s10.fantasy_points, s10.games_played, 
           s10.unit, s10.unit_pos, s10.weighted_points
    FROM slot10 s10 WHERE s10.player_id IS NOT NULL
    UNION ALL SELECT s11.player_id, s11.nba_player_id, s11.player_name, s11.team, s11.player_position, 
           s11.jersey_number, s11.salary, s11.fantasy_points, s11.games_played, 
           s11.unit, s11.unit_pos, s11.weighted_points
    FROM slot11 s11 WHERE s11.player_id IS NOT NULL
    UNION ALL SELECT s12.player_id, s12.nba_player_id, s12.player_name, s12.team, s12.player_position, 
           s12.jersey_number, s12.salary, s12.fantasy_points, s12.games_played, 
           s12.unit, s12.unit_pos, s12.weighted_points
    FROM slot12 s12 WHERE s12.player_id IS NOT NULL
  ),
  -- Fill remaining slots if needed (same logic as main function)
  filled_slots_check AS (
    SELECT 
      COUNT(*) as slots_filled,
      COALESCE(SUM(lb.salary), 0) as total_salary
    FROM lineup_builder lb
    WHERE lb.player_id IS NOT NULL
  ),
  remaining_slots AS (
    SELECT s.slot_order, s.unit, s.unit_pos, s.req_pos, s.mult
    FROM slots s
    WHERE NOT EXISTS (
      SELECT 1 FROM lineup_builder lb WHERE lb.player_id IN (
        SELECT s1.player_id FROM slot1 s1 UNION ALL
        SELECT s2.player_id FROM slot2 s2 UNION ALL
        SELECT s3.player_id FROM slot3 s3 UNION ALL
        SELECT s4.player_id FROM slot4 s4 UNION ALL
        SELECT s5.player_id FROM slot5 s5 UNION ALL
        SELECT s6.player_id FROM slot6 s6 UNION ALL
        SELECT s7.player_id FROM slot7 s7 UNION ALL
        SELECT s8.player_id FROM slot8 s8 UNION ALL
        SELECT s9.player_id FROM slot9 s9 UNION ALL
        SELECT s10.player_id FROM slot10 s10 UNION ALL
        SELECT s11.player_id FROM slot11 s11 UNION ALL
        SELECT s12.player_id FROM slot12 s12
      ) AND lb.player_id IS NOT NULL
    )
  ),
  fill_remaining AS (
    WITH all_used_players AS (
      SELECT DISTINCT player_id FROM lineup_builder WHERE player_id IS NOT NULL
    ),
    slot_candidates AS (
      SELECT 
        rs.slot_order,
        rs.unit,
        rs.unit_pos,
        rs.req_pos,
        rs.mult,
        pe.player_id as fill_player_id,
        pe.nba_player_id,
        pe.player_name,
        pe.team,
        pe.player_position,
        pe.jersey_number,
        pe.salary,
        pe.fantasy_points,
        pe.games_played,
        pe.fantasy_points * rs.mult as weighted_points,
        CASE 
          WHEN rs.req_pos = 'Util' THEN 1
          WHEN (rs.req_pos = 'G' AND pe.can_play_guard) THEN 1
          WHEN (rs.req_pos = 'F' AND pe.can_play_forward) THEN 1
          WHEN (rs.req_pos = 'C' AND pe.can_play_center) THEN 1
          ELSE 2
        END as position_priority
      FROM remaining_slots rs
      CROSS JOIN position_eligible pe
      CROSS JOIN filled_slots_check fsc
      WHERE pe.player_id NOT IN (SELECT aup.player_id FROM all_used_players aup)
        AND (
          rs.req_pos = 'Util' OR
          (rs.req_pos = 'G' AND pe.can_play_guard) OR
          (rs.req_pos = 'F' AND pe.can_play_forward) OR
          (rs.req_pos = 'C' AND pe.can_play_center) OR
          NOT EXISTS (
            SELECT 1 FROM position_eligible pe2
            WHERE pe2.player_id NOT IN (SELECT aup2.player_id FROM all_used_players aup2)
              AND (fsc.total_salary + pe2.salary) <= v_salary_cap::BIGINT
              AND (
                (rs.req_pos = 'G' AND pe2.can_play_guard) OR
                (rs.req_pos = 'F' AND pe2.can_play_forward) OR
                (rs.req_pos = 'C' AND pe2.can_play_center)
              )
          )
        )
    ),
    ranked_candidates AS (
      SELECT 
        sc.*,
        ROW_NUMBER() OVER (
          PARTITION BY sc.slot_order
          ORDER BY 
            sc.position_priority ASC,
            sc.weighted_points DESC,
            (sc.fantasy_points / NULLIF(sc.salary, 0)) DESC
        ) as rank_in_slot
      FROM slot_candidates sc
    ),
    best_per_slot AS (
      SELECT 
        rc.slot_order,
        rc.unit,
        rc.unit_pos,
        rc.req_pos,
        rc.mult,
        rc.fill_player_id,
        rc.nba_player_id,
        rc.player_name,
        rc.team,
        rc.player_position,
        rc.jersey_number,
        rc.salary,
        rc.fantasy_points,
        rc.games_played,
        rc.weighted_points
      FROM ranked_candidates rc
      WHERE rc.rank_in_slot = 1
    ),
    slots_with_cumulative AS (
      SELECT 
        bps.*,
        fsc.total_salary + SUM(bps.salary) OVER (
          ORDER BY bps.slot_order
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as cumulative_salary
      FROM best_per_slot bps
      CROSS JOIN filled_slots_check fsc
    ),
    valid_fills AS (
      SELECT 
        swc.*
      FROM slots_with_cumulative swc
      WHERE swc.cumulative_salary <= v_salary_cap::BIGINT
    )
    SELECT 
      vf.fill_player_id,
      vf.nba_player_id,
      vf.player_name,
      vf.team,
      vf.player_position,
      vf.jersey_number,
      vf.salary,
      vf.fantasy_points,
      vf.games_played,
      vf.unit,
      vf.unit_pos,
      vf.weighted_points,
      vf.slot_order
    FROM valid_fills vf
  ),
  lineup_count AS (
    SELECT COUNT(*) as current_count
    FROM lineup_builder lb_count
    WHERE lb_count.player_id IS NOT NULL
  ),
  final_lineup AS (
    SELECT 
      lb.player_id,
      lb.nba_player_id,
      lb.player_name,
      lb.team,
      lb.player_position,
      lb.jersey_number,
      lb.salary,
      lb.fantasy_points,
      lb.games_played,
      lb.unit,
      lb.unit_pos,
      lb.weighted_points
    FROM lineup_builder lb
    WHERE lb.player_id IS NOT NULL
    UNION ALL
    SELECT 
      fr.fill_player_id as player_id,
      fr.nba_player_id,
      fr.player_name,
      fr.team,
      fr.player_position,
      fr.jersey_number,
      fr.salary,
      fr.fantasy_points,
      fr.games_played,
      fr.unit,
      fr.unit_pos,
      fr.weighted_points
    FROM fill_remaining fr
    WHERE (SELECT current_count FROM lineup_count) < v_max_players
  )
  SELECT 
    fl.player_id,
    fl.nba_player_id,
    fl.player_name,
    fl.team,
    fl.player_position,
    fl.jersey_number,
    fl.salary,
    ROUND(fl.fantasy_points, 1)::DECIMAL as fantasy_points,
    fl.games_played,
    ROW_NUMBER() OVER (
      ORDER BY 
        CASE fl.unit 
          WHEN 'starters' THEN 1 
          WHEN 'rotation' THEN 2 
          WHEN 'bench' THEN 3 
        END,
        fl.unit_pos
    )::INTEGER as lineup_order,
    fl.unit::TEXT as lineup_unit,
    fl.unit_pos::INTEGER as unit_position,
    ROUND(fl.weighted_points, 1)::DECIMAL as weighted_points
  FROM final_lineup fl
  ORDER BY 
    CASE fl.unit 
      WHEN 'starters' THEN 1 
      WHEN 'rotation' THEN 2 
      WHEN 'bench' THEN 3 
    END,
    fl.unit_pos
  LIMIT v_max_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 2: Update get_optimal_lineup_for_week to match Team of the Week structure
-- ============================================================================

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
      AVG(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as avg_fantasy_points,
      COUNT(b.game_id)::INTEGER as games_played
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
  -- Position eligibility helper
  position_eligible AS (
    SELECT 
      pp.*,
      (pp.player_position ILIKE '%Guard%' OR pp.player_position IN ('PG', 'SG', 'G', 'Guard')) as can_play_guard,
      (pp.player_position ILIKE '%Forward%' OR pp.player_position IN ('SF', 'PF', 'F', 'Forward')) as can_play_forward,
      (pp.player_position ILIKE '%Center%' OR pp.player_position = 'C') as can_play_center
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
  -- Slot definitions with multipliers
  slots AS (
    SELECT 1 as slot_order, 'starters'::TEXT as unit, 1 as unit_pos, 'G'::TEXT as req_pos, 1.0::DECIMAL as mult
    UNION ALL SELECT 2, 'starters', 2, 'G', 1.0
    UNION ALL SELECT 3, 'starters', 3, 'F', 1.0
    UNION ALL SELECT 4, 'starters', 4, 'F', 1.0
    UNION ALL SELECT 5, 'starters', 5, 'C', 1.0
    UNION ALL SELECT 6, 'rotation', 1, 'G', 0.75
    UNION ALL SELECT 7, 'rotation', 2, 'G', 0.75
    UNION ALL SELECT 8, 'rotation', 3, 'F', 0.75
    UNION ALL SELECT 9, 'rotation', 4, 'F', 0.75
    UNION ALL SELECT 10, 'rotation', 5, 'C', 0.75
    UNION ALL SELECT 11, 'bench', 1, 'Util', 0.5
    UNION ALL SELECT 12, 'bench', 2, 'Util', 0.5
  ),
  -- For each slot, find eligible players with weighted scores
  slot_candidates AS (
    SELECT 
      s.slot_order,
      s.unit,
      s.unit_pos,
      s.req_pos,
      s.mult,
      pe.player_id,
      pe.nba_player_id,
      pe.player_name,
      pe.team,
      pe.player_position,
      pe.jersey_number,
      pe.salary,
      pe.avg_fantasy_points,
      pe.games_played,
      pe.avg_fantasy_points * s.mult as weighted_points,
      (pe.avg_fantasy_points * s.mult) / NULLIF(pe.salary, 0) as weighted_value,
      CASE 
        WHEN s.req_pos = 'Util' THEN 1
        WHEN (s.req_pos = 'G' AND pe.can_play_guard) THEN 1
        WHEN (s.req_pos = 'F' AND pe.can_play_forward) THEN 1
        WHEN (s.req_pos = 'C' AND pe.can_play_center) THEN 1
        ELSE 2
      END as position_priority
    FROM slots s
    CROSS JOIN position_eligible pe
  ),
  -- Rank candidates for each slot
  ranked_candidates AS (
    SELECT 
      sc.*,
      CASE 
        WHEN sc.slot_order <= 5 THEN 
          (sc.weighted_points * 0.7 + sc.weighted_value * 1000000 * 0.3)
        WHEN sc.slot_order <= 10 THEN 
          (sc.weighted_points * 0.5 + sc.weighted_value * 1000000 * 0.5)
        ELSE 
          (sc.weighted_points * 0.3 + sc.weighted_value * 1000000 * 0.7)
      END as balanced_score,
      ROW_NUMBER() OVER (
        PARTITION BY sc.slot_order
        ORDER BY 
          sc.position_priority ASC, 
          CASE 
            WHEN sc.slot_order <= 5 THEN 
              (sc.weighted_points * 0.7 + sc.weighted_value * 1000000 * 0.3)
            WHEN sc.slot_order <= 10 THEN 
              (sc.weighted_points * 0.5 + sc.weighted_value * 1000000 * 0.5)
            ELSE 
              (sc.weighted_points * 0.3 + sc.weighted_value * 1000000 * 0.7)
          END DESC
      ) as rank_in_slot
    FROM slot_candidates sc
  ),
  -- Greedy selection: Process slots sequentially (same structure as date function)
  -- Using same iterative CTE pattern - abbreviated for brevity
  slot1 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      rc.salary as cumulative_salary,
      ARRAY[rc.player_id]::UUID[] as used_players
    FROM ranked_candidates rc
    WHERE rc.slot_order = 1
      AND rc.salary <= (v_salary_cap::BIGINT - ((v_max_players - 1) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot2 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s1.cumulative_salary + rc.salary as cumulative_salary,
      s1.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot1 s1
    WHERE rc.slot_order = 2
      AND NOT (rc.player_id = ANY(s1.used_players))
      AND (s1.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 2) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot3 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s2.cumulative_salary + rc.salary as cumulative_salary,
      s2.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot2 s2
    WHERE rc.slot_order = 3
      AND NOT (rc.player_id = ANY(s2.used_players))
      AND (s2.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 3) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot4 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s3.cumulative_salary + rc.salary as cumulative_salary,
      s3.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot3 s3
    WHERE rc.slot_order = 4
      AND NOT (rc.player_id = ANY(s3.used_players))
      AND (s3.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 4) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot5 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s4.cumulative_salary + rc.salary as cumulative_salary,
      s4.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot4 s4
    WHERE rc.slot_order = 5
      AND NOT (rc.player_id = ANY(s4.used_players))
      AND (s4.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 5) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot6 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s5.cumulative_salary + rc.salary as cumulative_salary,
      s5.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot5 s5
    WHERE rc.slot_order = 6
      AND NOT (rc.player_id = ANY(s5.used_players))
      AND (s5.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 6) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot7 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s6.cumulative_salary + rc.salary as cumulative_salary,
      s6.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot6 s6
    WHERE rc.slot_order = 7
      AND NOT (rc.player_id = ANY(s6.used_players))
      AND (s6.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 7) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot8 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s7.cumulative_salary + rc.salary as cumulative_salary,
      s7.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot7 s7
    WHERE rc.slot_order = 8
      AND NOT (rc.player_id = ANY(s7.used_players))
      AND (s7.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 8) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot9 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s8.cumulative_salary + rc.salary as cumulative_salary,
      s8.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot8 s8
    WHERE rc.slot_order = 9
      AND NOT (rc.player_id = ANY(s8.used_players))
      AND (s8.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 9) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot10 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s9.cumulative_salary + rc.salary as cumulative_salary,
      s9.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot9 s9
    WHERE rc.slot_order = 10
      AND NOT (rc.player_id = ANY(s9.used_players))
      AND (s9.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 10) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot11 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s10.cumulative_salary + rc.salary as cumulative_salary,
      s10.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot10 s10
    WHERE rc.slot_order = 11
      AND NOT (rc.player_id = ANY(s10.used_players))
      AND (s10.cumulative_salary + rc.salary) <= (v_salary_cap::BIGINT - ((v_max_players - 11) * 1157153))
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  slot12 AS (
    SELECT DISTINCT ON (rc.slot_order)
      rc.*,
      s11.cumulative_salary + rc.salary as cumulative_salary,
      s11.used_players || rc.player_id as used_players
    FROM ranked_candidates rc
    CROSS JOIN slot11 s11
    WHERE rc.slot_order = 12
      AND NOT (rc.player_id = ANY(s11.used_players))
      AND (s11.cumulative_salary + rc.salary) <= v_salary_cap::BIGINT
    ORDER BY rc.slot_order, rc.position_priority ASC, rc.balanced_score DESC
    LIMIT 1
  ),
  -- Combine all slots (same structure as date function)
  lineup_builder AS (
    SELECT s1.player_id, s1.nba_player_id, s1.player_name, s1.team, s1.player_position, 
           s1.jersey_number, s1.salary, s1.avg_fantasy_points, s1.games_played, 
           s1.unit, s1.unit_pos, s1.weighted_points
    FROM slot1 s1 WHERE s1.player_id IS NOT NULL
    UNION ALL SELECT s2.player_id, s2.nba_player_id, s2.player_name, s2.team, s2.player_position, 
           s2.jersey_number, s2.salary, s2.avg_fantasy_points, s2.games_played, 
           s2.unit, s2.unit_pos, s2.weighted_points
    FROM slot2 s2 WHERE s2.player_id IS NOT NULL
    UNION ALL SELECT s3.player_id, s3.nba_player_id, s3.player_name, s3.team, s3.player_position, 
           s3.jersey_number, s3.salary, s3.avg_fantasy_points, s3.games_played, 
           s3.unit, s3.unit_pos, s3.weighted_points
    FROM slot3 s3 WHERE s3.player_id IS NOT NULL
    UNION ALL SELECT s4.player_id, s4.nba_player_id, s4.player_name, s4.team, s4.player_position, 
           s4.jersey_number, s4.salary, s4.avg_fantasy_points, s4.games_played, 
           s4.unit, s4.unit_pos, s4.weighted_points
    FROM slot4 s4 WHERE s4.player_id IS NOT NULL
    UNION ALL SELECT s5.player_id, s5.nba_player_id, s5.player_name, s5.team, s5.player_position, 
           s5.jersey_number, s5.salary, s5.avg_fantasy_points, s5.games_played, 
           s5.unit, s5.unit_pos, s5.weighted_points
    FROM slot5 s5 WHERE s5.player_id IS NOT NULL
    UNION ALL SELECT s6.player_id, s6.nba_player_id, s6.player_name, s6.team, s6.player_position, 
           s6.jersey_number, s6.salary, s6.avg_fantasy_points, s6.games_played, 
           s6.unit, s6.unit_pos, s6.weighted_points
    FROM slot6 s6 WHERE s6.player_id IS NOT NULL
    UNION ALL SELECT s7.player_id, s7.nba_player_id, s7.player_name, s7.team, s7.player_position, 
           s7.jersey_number, s7.salary, s7.avg_fantasy_points, s7.games_played, 
           s7.unit, s7.unit_pos, s7.weighted_points
    FROM slot7 s7 WHERE s7.player_id IS NOT NULL
    UNION ALL SELECT s8.player_id, s8.nba_player_id, s8.player_name, s8.team, s8.player_position, 
           s8.jersey_number, s8.salary, s8.avg_fantasy_points, s8.games_played, 
           s8.unit, s8.unit_pos, s8.weighted_points
    FROM slot8 s8 WHERE s8.player_id IS NOT NULL
    UNION ALL SELECT s9.player_id, s9.nba_player_id, s9.player_name, s9.team, s9.player_position, 
           s9.jersey_number, s9.salary, s9.avg_fantasy_points, s9.games_played, 
           s9.unit, s9.unit_pos, s9.weighted_points
    FROM slot9 s9 WHERE s9.player_id IS NOT NULL
    UNION ALL SELECT s10.player_id, s10.nba_player_id, s10.player_name, s10.team, s10.player_position, 
           s10.jersey_number, s10.salary, s10.avg_fantasy_points, s10.games_played, 
           s10.unit, s10.unit_pos, s10.weighted_points
    FROM slot10 s10 WHERE s10.player_id IS NOT NULL
    UNION ALL SELECT s11.player_id, s11.nba_player_id, s11.player_name, s11.team, s11.player_position, 
           s11.jersey_number, s11.salary, s11.avg_fantasy_points, s11.games_played, 
           s11.unit, s11.unit_pos, s11.weighted_points
    FROM slot11 s11 WHERE s11.player_id IS NOT NULL
    UNION ALL SELECT s12.player_id, s12.nba_player_id, s12.player_name, s12.team, s12.player_position, 
           s12.jersey_number, s12.salary, s12.avg_fantasy_points, s12.games_played, 
           s12.unit, s12.unit_pos, s12.weighted_points
    FROM slot12 s12 WHERE s12.player_id IS NOT NULL
  ),
  -- Fill remaining slots (same logic as date function)
  filled_slots_check AS (
    SELECT 
      COUNT(*) as slots_filled,
      COALESCE(SUM(lb.salary), 0) as total_salary
    FROM lineup_builder lb
    WHERE lb.player_id IS NOT NULL
  ),
  remaining_slots AS (
    SELECT s.slot_order, s.unit, s.unit_pos, s.req_pos, s.mult
    FROM slots s
    WHERE NOT EXISTS (
      SELECT 1 FROM lineup_builder lb WHERE lb.player_id IN (
        SELECT s1.player_id FROM slot1 s1 UNION ALL
        SELECT s2.player_id FROM slot2 s2 UNION ALL
        SELECT s3.player_id FROM slot3 s3 UNION ALL
        SELECT s4.player_id FROM slot4 s4 UNION ALL
        SELECT s5.player_id FROM slot5 s5 UNION ALL
        SELECT s6.player_id FROM slot6 s6 UNION ALL
        SELECT s7.player_id FROM slot7 s7 UNION ALL
        SELECT s8.player_id FROM slot8 s8 UNION ALL
        SELECT s9.player_id FROM slot9 s9 UNION ALL
        SELECT s10.player_id FROM slot10 s10 UNION ALL
        SELECT s11.player_id FROM slot11 s11 UNION ALL
        SELECT s12.player_id FROM slot12 s12
      ) AND lb.player_id IS NOT NULL
    )
  ),
  fill_remaining AS (
    WITH all_used_players AS (
      SELECT DISTINCT player_id FROM lineup_builder WHERE player_id IS NOT NULL
    ),
    slot_candidates AS (
      SELECT 
        rs.slot_order,
        rs.unit,
        rs.unit_pos,
        rs.req_pos,
        rs.mult,
        pe.player_id as fill_player_id,
        pe.nba_player_id,
        pe.player_name,
        pe.team,
        pe.player_position,
        pe.jersey_number,
        pe.salary,
        pe.avg_fantasy_points,
        pe.games_played,
        pe.avg_fantasy_points * rs.mult as weighted_points,
        CASE 
          WHEN rs.req_pos = 'Util' THEN 1
          WHEN (rs.req_pos = 'G' AND pe.can_play_guard) THEN 1
          WHEN (rs.req_pos = 'F' AND pe.can_play_forward) THEN 1
          WHEN (rs.req_pos = 'C' AND pe.can_play_center) THEN 1
          ELSE 2
        END as position_priority
      FROM remaining_slots rs
      CROSS JOIN position_eligible pe
      CROSS JOIN filled_slots_check fsc
      WHERE pe.player_id NOT IN (SELECT aup.player_id FROM all_used_players aup)
        AND (
          rs.req_pos = 'Util' OR
          (rs.req_pos = 'G' AND pe.can_play_guard) OR
          (rs.req_pos = 'F' AND pe.can_play_forward) OR
          (rs.req_pos = 'C' AND pe.can_play_center) OR
          NOT EXISTS (
            SELECT 1 FROM position_eligible pe2
            WHERE pe2.player_id NOT IN (SELECT aup2.player_id FROM all_used_players aup2)
              AND (fsc.total_salary + pe2.salary) <= v_salary_cap::BIGINT
              AND (
                (rs.req_pos = 'G' AND pe2.can_play_guard) OR
                (rs.req_pos = 'F' AND pe2.can_play_forward) OR
                (rs.req_pos = 'C' AND pe2.can_play_center)
              )
          )
        )
    ),
    ranked_candidates AS (
      SELECT 
        sc.*,
        ROW_NUMBER() OVER (
          PARTITION BY sc.slot_order
          ORDER BY 
            sc.position_priority ASC,
            sc.weighted_points DESC,
            (sc.avg_fantasy_points / NULLIF(sc.salary, 0)) DESC
        ) as rank_in_slot
      FROM slot_candidates sc
    ),
    best_per_slot AS (
      SELECT 
        rc.slot_order,
        rc.unit,
        rc.unit_pos,
        rc.req_pos,
        rc.mult,
        rc.fill_player_id,
        rc.nba_player_id,
        rc.player_name,
        rc.team,
        rc.player_position,
        rc.jersey_number,
        rc.salary,
        rc.avg_fantasy_points,
        rc.games_played,
        rc.weighted_points
      FROM ranked_candidates rc
      WHERE rc.rank_in_slot = 1
    ),
    slots_with_cumulative AS (
      SELECT 
        bps.*,
        fsc.total_salary + SUM(bps.salary) OVER (
          ORDER BY bps.slot_order
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as cumulative_salary
      FROM best_per_slot bps
      CROSS JOIN filled_slots_check fsc
    ),
    valid_fills AS (
      SELECT 
        swc.*
      FROM slots_with_cumulative swc
      WHERE swc.cumulative_salary <= v_salary_cap::BIGINT
    )
    SELECT 
      vf.fill_player_id,
      vf.nba_player_id,
      vf.player_name,
      vf.team,
      vf.player_position,
      vf.jersey_number,
      vf.salary,
      vf.avg_fantasy_points,
      vf.games_played,
      vf.unit,
      vf.unit_pos,
      vf.weighted_points,
      vf.slot_order
    FROM valid_fills vf
  ),
  lineup_count AS (
    SELECT COUNT(*) as current_count
    FROM lineup_builder lb_count
    WHERE lb_count.player_id IS NOT NULL
  ),
  final_lineup AS (
    SELECT 
      lb.player_id,
      lb.nba_player_id,
      lb.player_name,
      lb.team,
      lb.player_position,
      lb.jersey_number,
      lb.salary,
      lb.avg_fantasy_points,
      lb.games_played,
      lb.unit,
      lb.unit_pos,
      lb.weighted_points
    FROM lineup_builder lb
    WHERE lb.player_id IS NOT NULL
    UNION ALL
    SELECT 
      fr.fill_player_id as player_id,
      fr.nba_player_id,
      fr.player_name,
      fr.team,
      fr.player_position,
      fr.jersey_number,
      fr.salary,
      fr.avg_fantasy_points,
      fr.games_played,
      fr.unit,
      fr.unit_pos,
      fr.weighted_points
    FROM fill_remaining fr
    WHERE (SELECT current_count FROM lineup_count) < v_max_players
  )
  SELECT 
    fl.player_id,
    fl.nba_player_id,
    fl.player_name,
    fl.team,
    fl.player_position,
    fl.jersey_number,
    fl.salary,
    ROUND(fl.avg_fantasy_points, 1)::DECIMAL as avg_fantasy_points,
    fl.games_played,
    ROW_NUMBER() OVER (
      ORDER BY 
        CASE fl.unit 
          WHEN 'starters' THEN 1 
          WHEN 'rotation' THEN 2 
          WHEN 'bench' THEN 3 
        END,
        fl.unit_pos
    )::INTEGER as lineup_order,
    fl.unit::TEXT as lineup_unit,
    fl.unit_pos::INTEGER as unit_position,
    ROUND(fl.weighted_points, 1)::DECIMAL as weighted_points
  FROM final_lineup fl
  ORDER BY 
    CASE fl.unit 
      WHEN 'starters' THEN 1 
      WHEN 'rotation' THEN 2 
      WHEN 'bench' THEN 3 
    END,
    fl.unit_pos
  LIMIT v_max_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Generate historical data for dates 2025-10-21 to 2025-11-09
-- ============================================================================

DO $$
DECLARE
  v_current_date DATE := '2025-10-21'::DATE;
  v_end_date DATE := '2025-11-09'::DATE;
  v_lineup_record RECORD;
  v_lineups_created INTEGER := 0;
  v_dates_processed INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  WHILE v_current_date <= v_end_date LOOP
    BEGIN
      -- Check if games exist for this date
      IF EXISTS (SELECT 1 FROM nba_boxscores WHERE game_date = v_current_date LIMIT 1) THEN
        -- Delete existing lineup for this date if it exists (to regenerate with new structure)
        DELETE FROM historical_team_of_night WHERE game_date = v_current_date;
        
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
      
      v_dates_processed := v_dates_processed + 1;
      v_current_date := v_current_date + INTERVAL '1 day';
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Error processing date %: %', v_current_date, SQLERRM;
      v_current_date := v_current_date + INTERVAL '1 day';
    END;
  END LOOP;
  
  RAISE NOTICE 'Historical Team of the Night generation complete:';
  RAISE NOTICE '  Dates processed: %', v_dates_processed;
  RAISE NOTICE '  Lineups created: %', v_lineups_created;
  RAISE NOTICE '  Errors: %', v_errors;
END $$;

-- ============================================================================
-- STEP 4: Generate historical data for weeks in the date range
-- ============================================================================

DO $$
DECLARE
  v_week_record RECORD;
  v_lineup_record RECORD;
  v_weeks_created INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Get all weeks that overlap with the date range
  FOR v_week_record IN 
    SELECT start_date, end_date, season_year
    FROM nba_season_weeks
    WHERE season_year = 2026
      AND league_id = 0
      AND start_date <= '2025-11-09'::DATE
      AND end_date >= '2025-10-21'::DATE
    ORDER BY start_date
  LOOP
    BEGIN
      -- Check if games exist for this week
      IF EXISTS (
        SELECT 1 FROM nba_boxscores 
        WHERE game_date BETWEEN v_week_record.start_date AND v_week_record.end_date 
        LIMIT 1
      ) THEN
        -- Delete existing lineup for this week if it exists (to regenerate with new structure)
        DELETE FROM historical_team_of_week 
        WHERE week_start = v_week_record.start_date 
          AND week_end = v_week_record.end_date;
        
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
        
        v_weeks_created := v_weeks_created + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Error processing week % to %: %', v_week_record.start_date, v_week_record.end_date, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Historical Team of the Week generation complete:';
  RAISE NOTICE '  Weeks created: %', v_weeks_created;
  RAISE NOTICE '  Errors: %', v_errors;
END $$;

