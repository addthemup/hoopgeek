-- ============================================================================
-- OPTIMAL LINEUP OF THE NIGHT - 12 Player Optimal Lineup With Position Constraints
-- Returns optimal 12-player lineup from yesterday's games
-- Enforces position requirements: Starters (G G F F C), Rotation (G G F F C), Bench (Util Util)
-- Applies multipliers: 1x starters, 0.75x rotation, 0.5x bench
-- Optimizes based on weighted fantasy points (raw_points * multiplier)
-- Stays within 208M salary cap
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
  WITH last_night_games AS (
    SELECT (CURRENT_DATE - INTERVAL '1 day')::DATE as game_date
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
    CROSS JOIN last_night_games lng
    WHERE b.game_date = lng.game_date
      AND p.is_active = TRUE
      AND b.min > 0
      AND COALESCE(hs.salary_2025_26, 1157153) > 0
    GROUP BY 
      p.id, p.nba_player_id, p.name, p.team_abbreviation, 
      p."position", p.jersey_number, hs.salary_2025_26
    HAVING COUNT(b.game_id) >= 1
  ),
  -- Helper: Check if player is eligible for position
  position_eligible AS (
    SELECT 
      pp.*,
      -- Check eligibility for each position type
      CASE 
        WHEN pp.player_position ILIKE '%Guard%' OR pp.player_position IN ('PG', 'SG', 'G', 'Guard')
        THEN true ELSE false
      END as can_play_guard,
      CASE 
        WHEN pp.player_position ILIKE '%Forward%' OR pp.player_position IN ('SF', 'PF', 'F', 'Forward')
        THEN true ELSE false
      END as can_play_forward,
      CASE 
        WHEN pp.player_position ILIKE '%Center%' OR pp.player_position = 'C'
        THEN true ELSE false
      END as can_play_center,
      -- UTIL can be anyone
      true as can_play_util
    FROM player_performance pp
    WHERE pp.salary <= v_salary_cap::BIGINT
  ),
  -- Define position requirements for each unit
  position_requirements AS (
    SELECT 'starters'::TEXT as unit, 1 as slot, 'G'::TEXT as required_position, 1.0::DECIMAL as multiplier
    UNION ALL SELECT 'starters', 2, 'G', 1.0
    UNION ALL SELECT 'starters', 3, 'F', 1.0
    UNION ALL SELECT 'starters', 4, 'F', 1.0
    UNION ALL SELECT 'starters', 5, 'C', 1.0
    UNION ALL SELECT 'rotation', 1, 'G', 0.75
    UNION ALL SELECT 'rotation', 2, 'G', 0.75
    UNION ALL SELECT 'rotation', 3, 'F', 0.75
    UNION ALL SELECT 'rotation', 4, 'F', 0.75
    UNION ALL SELECT 'rotation', 5, 'C', 0.75
    UNION ALL SELECT 'bench', 1, 'Util', 0.5
    UNION ALL SELECT 'bench', 2, 'Util', 0.5
  ),
  -- Calculate weighted points for each player in each possible slot
  player_slot_options AS (
    SELECT 
      pe.*,
      pr.unit,
      pr.slot as unit_position,
      pr.required_position,
      pr.multiplier,
      pe.fantasy_points * pr.multiplier as weighted_points,
      CASE 
        WHEN pr.required_position = 'Util' THEN true
        WHEN pr.required_position = 'G' THEN pe.can_play_guard
        WHEN pr.required_position = 'F' THEN pe.can_play_forward
        WHEN pr.required_position = 'C' THEN pe.can_play_center
        ELSE false
      END as is_eligible
    FROM position_eligible pe
    CROSS JOIN position_requirements pr
    WHERE 
      CASE 
        WHEN pr.required_position = 'Util' THEN true
        WHEN pr.required_position = 'G' THEN pe.can_play_guard
        WHEN pr.required_position = 'F' THEN pe.can_play_forward
        WHEN pr.required_position = 'C' THEN pe.can_play_center
        ELSE false
      END
  ),
  -- Rank players for each slot by weighted value
  ranked_by_slot AS (
    SELECT 
      pso.*,
      -- Value score: weighted points per dollar
      (pso.weighted_points / NULLIF(pso.salary, 0)) * 1000000 as value_score,
      ROW_NUMBER() OVER (
        PARTITION BY pso.unit, pso.unit_position
        ORDER BY pso.weighted_points DESC, (pso.weighted_points / NULLIF(pso.salary, 0)) DESC
      ) as rank_in_slot
    FROM player_slot_options pso
    WHERE pso.is_eligible
  ),
  -- Greedy selection: Fill each slot with best available player
  -- We'll use a recursive CTE or iterative approach
  -- For now, use a simpler greedy approach: select best player for each slot
  selected_lineup AS (
    SELECT DISTINCT ON (rbs.unit, rbs.unit_position)
      rbs.player_id,
      rbs.nba_player_id,
      rbs.player_name,
      rbs.team,
      rbs.player_position,
      rbs.jersey_number,
      rbs.salary,
      rbs.fantasy_points,
      rbs.games_played,
      rbs.unit,
      rbs.unit_position,
      rbs.weighted_points,
      rbs.multiplier,
      SUM(rbs.salary) OVER (
        ORDER BY 
          CASE rbs.unit 
            WHEN 'starters' THEN 1 
            WHEN 'rotation' THEN 2 
            WHEN 'bench' THEN 3 
          END,
          rbs.unit_position
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as cumulative_salary
    FROM ranked_by_slot rbs
    WHERE rbs.rank_in_slot = 1
    ORDER BY 
      CASE rbs.unit 
        WHEN 'starters' THEN 1 
        WHEN 'rotation' THEN 2 
        WHEN 'bench' THEN 3 
      END,
      rbs.unit_position,
      rbs.rank_in_slot
  ),
  -- Filter to only valid lineups (under cap, no duplicates)
  valid_lineup AS (
    SELECT 
      sl.*
    FROM selected_lineup sl
    WHERE sl.cumulative_salary <= v_salary_cap::BIGINT
      AND sl.player_id NOT IN (
        SELECT sl2.player_id 
        FROM selected_lineup sl2 
        WHERE sl2.unit = sl.unit 
          AND sl2.unit_position < sl.unit_position
      )
  ),
  -- Check if we have all 12 slots filled
  lineup_complete AS (
    SELECT 
      COUNT(*) as slots_filled,
      COALESCE(SUM(salary), 0) as total_salary
    FROM valid_lineup
  ),
  -- If incomplete, try to fill remaining slots with best available players
  remaining_slots AS (
    SELECT 
      pr.unit,
      pr.slot as unit_position,
      pr.required_position,
      pr.multiplier
    FROM position_requirements pr
    WHERE NOT EXISTS (
      SELECT 1 FROM valid_lineup vl
      WHERE vl.unit = pr.unit AND vl.unit_position = pr.slot
    )
  ),
  -- Find best players for remaining slots
  fill_remaining AS (
    SELECT DISTINCT ON (rs.unit, rs.unit_position)
      pe.player_id,
      pe.nba_player_id,
      pe.player_name,
      pe.team,
      pe.player_position,
      pe.jersey_number,
      pe.salary,
      pe.fantasy_points,
      pe.games_played,
      rs.unit,
      rs.unit_position,
      pe.fantasy_points * rs.multiplier as weighted_points,
      rs.multiplier
    FROM position_eligible pe
    CROSS JOIN remaining_slots rs
    WHERE pe.player_id NOT IN (SELECT vl.player_id FROM valid_lineup vl)
      AND (
        rs.required_position = 'Util' OR
        (rs.required_position = 'G' AND pe.can_play_guard) OR
        (rs.required_position = 'F' AND pe.can_play_forward) OR
        (rs.required_position = 'C' AND pe.can_play_center)
      )
      AND pe.salary <= (v_salary_cap::BIGINT - (SELECT COALESCE(total_salary, 0) FROM lineup_complete))
    ORDER BY 
      rs.unit, rs.unit_position,
      (pe.fantasy_points * rs.multiplier) DESC,
      (pe.fantasy_points / NULLIF(pe.salary, 0)) DESC
  ),
  -- Combine valid lineup with filled slots
  final_lineup AS (
    SELECT 
      vl.player_id,
      vl.nba_player_id,
      vl.player_name,
      vl.team,
      vl.player_position,
      vl.jersey_number,
      vl.salary,
      vl.fantasy_points,
      vl.games_played,
      vl.unit as lineup_unit,
      vl.unit_position,
      vl.weighted_points
    FROM valid_lineup vl
    UNION ALL
    SELECT 
      fr.player_id,
      fr.nba_player_id,
      fr.player_name,
      fr.team,
      fr.player_position,
      fr.jersey_number,
      fr.salary,
      fr.fantasy_points,
      fr.games_played,
      fr.unit as lineup_unit,
      fr.unit_position,
      fr.weighted_points
    FROM fill_remaining fr
    WHERE (SELECT slots_filled FROM lineup_complete) < 12
  )
  -- Return final lineup ordered by unit and position
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
    ROW_NUMBER() OVER (
      ORDER BY 
        CASE fl.lineup_unit 
          WHEN 'starters' THEN 1 
          WHEN 'rotation' THEN 2 
          WHEN 'bench' THEN 3 
        END,
        fl.unit_position
    )::INTEGER as lineup_order,
    fl.lineup_unit,
    fl.unit_position,
    ROUND(fl.weighted_points, 1) as weighted_points
  FROM final_lineup fl
  ORDER BY 
    CASE fl.lineup_unit 
      WHEN 'starters' THEN 1 
      WHEN 'rotation' THEN 2 
      WHEN 'bench' THEN 3 
    END,
    fl.unit_position
  LIMIT v_max_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_optimal_lineup_of_the_night() TO authenticated;
GRANT EXECUTE ON FUNCTION get_optimal_lineup_of_the_night() TO anon;

