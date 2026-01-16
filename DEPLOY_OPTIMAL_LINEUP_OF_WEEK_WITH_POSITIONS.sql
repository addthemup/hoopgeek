-- ============================================================================
-- OPTIMAL LINEUP OF THE WEEK - With Position Constraints & Multipliers
-- Returns optimal 12-player lineup from previous week's games
-- Enforces: Starters (G G F F C), Rotation (G G F F C), Bench (Util Util)
-- Multipliers: 1x starters, 0.75x rotation, 0.5x bench
-- Optimizes based on weighted average fantasy points
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
  lineup_order INTEGER,
  lineup_unit TEXT,
  unit_position INTEGER,
  weighted_points DECIMAL
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

  -- If no previous week found, use last 7 days
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
      -- Calculate average fantasy points for the week
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
      -- Priority: 1 = position match, 2 = any player (Util accepts all)
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
  -- Rank candidates for each slot - prioritize position matches, then balance points and value
  ranked_candidates AS (
    SELECT 
      sc.*,
      -- Adjust ranking based on slot: early slots favor points, later slots favor value
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
  -- Greedy selection: Process slots sequentially using iterative CTEs
  -- Slot 1 - Reserve space for remaining slots
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
  -- Slot 2
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
  -- Slot 3
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
  -- Slot 4
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
  -- Slot 5
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
  -- Slot 6
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
  -- Slot 7
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
  -- Slot 8
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
  -- Slot 9
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
  -- Slot 10
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
  -- Slot 11
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
  -- Slot 12
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
           s1.jersey_number, s1.salary, s1.avg_fantasy_points, s1.games_played, 
           s1.unit, s1.unit_pos, s1.weighted_points, s1.slot_order, s1.cumulative_salary, s1.used_players
    FROM slot1 s1 WHERE s1.player_id IS NOT NULL
    UNION ALL SELECT s2.player_id, s2.nba_player_id, s2.player_name, s2.team, s2.player_position, 
           s2.jersey_number, s2.salary, s2.avg_fantasy_points, s2.games_played, 
           s2.unit, s2.unit_pos, s2.weighted_points, s2.slot_order, s2.cumulative_salary, s2.used_players
    FROM slot2 s2 WHERE s2.player_id IS NOT NULL
    UNION ALL SELECT s3.player_id, s3.nba_player_id, s3.player_name, s3.team, s3.player_position, 
           s3.jersey_number, s3.salary, s3.avg_fantasy_points, s3.games_played, 
           s3.unit, s3.unit_pos, s3.weighted_points, s3.slot_order, s3.cumulative_salary, s3.used_players
    FROM slot3 s3 WHERE s3.player_id IS NOT NULL
    UNION ALL SELECT s4.player_id, s4.nba_player_id, s4.player_name, s4.team, s4.player_position, 
           s4.jersey_number, s4.salary, s4.avg_fantasy_points, s4.games_played, 
           s4.unit, s4.unit_pos, s4.weighted_points, s4.slot_order, s4.cumulative_salary, s4.used_players
    FROM slot4 s4 WHERE s4.player_id IS NOT NULL
    UNION ALL SELECT s5.player_id, s5.nba_player_id, s5.player_name, s5.team, s5.player_position, 
           s5.jersey_number, s5.salary, s5.avg_fantasy_points, s5.games_played, 
           s5.unit, s5.unit_pos, s5.weighted_points, s5.slot_order, s5.cumulative_salary, s5.used_players
    FROM slot5 s5 WHERE s5.player_id IS NOT NULL
    UNION ALL SELECT s6.player_id, s6.nba_player_id, s6.player_name, s6.team, s6.player_position, 
           s6.jersey_number, s6.salary, s6.avg_fantasy_points, s6.games_played, 
           s6.unit, s6.unit_pos, s6.weighted_points, s6.slot_order, s6.cumulative_salary, s6.used_players
    FROM slot6 s6 WHERE s6.player_id IS NOT NULL
    UNION ALL SELECT s7.player_id, s7.nba_player_id, s7.player_name, s7.team, s7.player_position, 
           s7.jersey_number, s7.salary, s7.avg_fantasy_points, s7.games_played, 
           s7.unit, s7.unit_pos, s7.weighted_points, s7.slot_order, s7.cumulative_salary, s7.used_players
    FROM slot7 s7 WHERE s7.player_id IS NOT NULL
    UNION ALL SELECT s8.player_id, s8.nba_player_id, s8.player_name, s8.team, s8.player_position, 
           s8.jersey_number, s8.salary, s8.avg_fantasy_points, s8.games_played, 
           s8.unit, s8.unit_pos, s8.weighted_points, s8.slot_order, s8.cumulative_salary, s8.used_players
    FROM slot8 s8 WHERE s8.player_id IS NOT NULL
    UNION ALL SELECT s9.player_id, s9.nba_player_id, s9.player_name, s9.team, s9.player_position, 
           s9.jersey_number, s9.salary, s9.avg_fantasy_points, s9.games_played, 
           s9.unit, s9.unit_pos, s9.weighted_points, s9.slot_order, s9.cumulative_salary, s9.used_players
    FROM slot9 s9 WHERE s9.player_id IS NOT NULL
    UNION ALL SELECT s10.player_id, s10.nba_player_id, s10.player_name, s10.team, s10.player_position, 
           s10.jersey_number, s10.salary, s10.avg_fantasy_points, s10.games_played, 
           s10.unit, s10.unit_pos, s10.weighted_points, s10.slot_order, s10.cumulative_salary, s10.used_players
    FROM slot10 s10 WHERE s10.player_id IS NOT NULL
    UNION ALL SELECT s11.player_id, s11.nba_player_id, s11.player_name, s11.team, s11.player_position, 
           s11.jersey_number, s11.salary, s11.avg_fantasy_points, s11.games_played, 
           s11.unit, s11.unit_pos, s11.weighted_points, s11.slot_order, s11.cumulative_salary, s11.used_players
    FROM slot11 s11 WHERE s11.player_id IS NOT NULL
    UNION ALL SELECT s12.player_id, s12.nba_player_id, s12.player_name, s12.team, s12.player_position, 
           s12.jersey_number, s12.salary, s12.avg_fantasy_points, s12.games_played, 
           s12.unit, s12.unit_pos, s12.weighted_points, s12.slot_order, s12.cumulative_salary, s12.used_players
    FROM slot12 s12 WHERE s12.player_id IS NOT NULL
  ),
  -- Check which slots are filled and calculate total salary
  filled_slots_check AS (
    SELECT 
      COUNT(*) as slots_filled,
      COALESCE(SUM(lb.salary), 0) as total_salary
    FROM lineup_builder lb
    WHERE lb.player_id IS NOT NULL
  ),
  -- Find remaining slots that need to be filled
  remaining_slots AS (
    SELECT s.slot_order, s.unit, s.unit_pos, s.req_pos, s.mult
    FROM slots s
    WHERE NOT EXISTS (
      SELECT 1 FROM lineup_builder lb WHERE lb.slot_order = s.slot_order
    )
  ),
  -- Fill remaining slots - ALWAYS fill all 12 slots
  fill_remaining AS (
    WITH all_used_players AS (
      SELECT DISTINCT lb_used.player_id 
      FROM lineup_builder lb_used 
      WHERE lb_used.player_id IS NOT NULL
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
  -- Count how many we have so far
  lineup_count AS (
    SELECT COUNT(*) as current_count
    FROM lineup_builder lb_count
    WHERE lb_count.player_id IS NOT NULL
  ),
  -- Final lineup from all filled slots - ensure we have exactly 12
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_optimal_lineup_of_the_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_optimal_lineup_of_the_week() TO anon;

