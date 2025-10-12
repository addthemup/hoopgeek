-- ============================================================================
-- TEST PROGRESSIVE FANTASY-FIRST DRAFT STRATEGY
-- Shows top picks for each round tier
-- ============================================================================

-- ROUND 1-3: 90% Fantasy Points, 10% Value (DRAFT THE STARS!)
WITH round_1_3_candidates AS (
  SELECT 
    p.name,
    p.team_name,
    p.position,
    p.salary_2025_26,
    -- Calculate total season fantasy points
    (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    )::NUMERIC as fantasy_points,
    -- Calculate value per dollar
    (
      (
        (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
        (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
        (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
        (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
        (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
      )::NUMERIC / NULLIF(p.salary_2025_26, 0)
    ) as value_per_dollar,
    ep.proj_2026_gp as games_played
  FROM players p
  LEFT JOIN espn_player_projections ep ON ep.player_id = p.id
  WHERE 
    p.is_active = true
    AND p.salary_2025_26 > 0
    -- Round 1-3 quality filters
    AND (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    ) >= 1800
    AND COALESCE(ep.proj_2026_gp, 0) >= 55
)
SELECT 
  'ROUND 1-3 (90% Fantasy, 10% Value)' as tier,
  name,
  team_name,
  position,
  salary_2025_26 / 1000000.0 as salary_millions,
  fantasy_points,
  value_per_dollar,
  -- Calculate weighted score (90% fantasy, 10% value)
  (fantasy_points / 100.0 * 0.90) + (value_per_dollar * 1000000.0 * 0.10) as weighted_score,
  ROW_NUMBER() OVER (ORDER BY 
    (fantasy_points / 100.0 * 0.90) + (value_per_dollar * 1000000.0 * 0.10) DESC
  ) as draft_rank
FROM round_1_3_candidates
ORDER BY weighted_score DESC
LIMIT 20;

-- ROUND 4-6: 70% Fantasy Points, 30% Value (QUALITY STARTERS)
WITH round_4_6_candidates AS (
  SELECT 
    p.name,
    p.team_name,
    p.position,
    p.salary_2025_26,
    (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    )::NUMERIC as fantasy_points,
    (
      (
        (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
        (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
        (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
        (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
        (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
      )::NUMERIC / NULLIF(p.salary_2025_26, 0)
    ) as value_per_dollar
  FROM players p
  LEFT JOIN espn_player_projections ep ON ep.player_id = p.id
  WHERE 
    p.is_active = true
    AND p.salary_2025_26 > 0
    -- Round 4-6 quality filters
    AND (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    ) >= 1500
    AND COALESCE(ep.proj_2026_gp, 0) >= 50
    -- Exclude players who would be drafted in rounds 1-3
    AND (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    ) < 1800
)
SELECT 
  'ROUND 4-6 (70% Fantasy, 30% Value)' as tier,
  name,
  team_name,
  position,
  salary_2025_26 / 1000000.0 as salary_millions,
  fantasy_points,
  value_per_dollar,
  (fantasy_points / 100.0 * 0.70) + (value_per_dollar * 1000000.0 * 0.30) as weighted_score,
  ROW_NUMBER() OVER (ORDER BY 
    (fantasy_points / 100.0 * 0.70) + (value_per_dollar * 1000000.0 * 0.30) DESC
  ) as draft_rank
FROM round_4_6_candidates
ORDER BY weighted_score DESC
LIMIT 20;

-- ROUND 10+: 30% Fantasy Points, 70% Value (VALUE HUNTING)
WITH round_10_plus_candidates AS (
  SELECT 
    p.name,
    p.team_name,
    p.position,
    p.salary_2025_26,
    (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    )::NUMERIC as fantasy_points,
    (
      (
        (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
        (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
        (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
        (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
        (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
        (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
      )::NUMERIC / NULLIF(p.salary_2025_26, 0)
    ) as value_per_dollar
  FROM players p
  LEFT JOIN espn_player_projections ep ON ep.player_id = p.id
  WHERE 
    p.is_active = true
    AND p.salary_2025_26 > 0
    -- Round 10+ quality filters (lower bar)
    AND (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    ) >= 900
    AND COALESCE(ep.proj_2026_gp, 0) >= 40
    -- Only show players below round 6 threshold
    AND (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    ) < 1500
)
SELECT 
  'ROUND 10+ (30% Fantasy, 70% Value)' as tier,
  name,
  team_name,
  position,
  salary_2025_26 / 1000000.0 as salary_millions,
  fantasy_points,
  value_per_dollar,
  (fantasy_points / 100.0 * 0.30) + (value_per_dollar * 1000000.0 * 0.70) as weighted_score,
  ROW_NUMBER() OVER (ORDER BY 
    (fantasy_points / 100.0 * 0.30) + (value_per_dollar * 1000000.0 * 0.70) DESC
  ) as draft_rank
FROM round_10_plus_candidates
ORDER BY weighted_score DESC
LIMIT 20;

-- Check: Who is Toumani Camara and why was he drafted?
SELECT 
  '❌ TOUMANI CAMARA (The Problem)' as note,
  p.name,
  p.team_name,
  p.salary_2025_26 / 1000000.0 as salary_millions,
  (
    (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
    (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
    (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
    (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
    (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
    (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
    (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
  )::NUMERIC as fantasy_points,
  (
    (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    )::NUMERIC / NULLIF(p.salary_2025_26, 0)
  ) as value_per_dollar,
  ep.proj_2026_gp,
  'Would be filtered: ' || 
  CASE 
    WHEN (
      (COALESCE(ep.proj_2026_pts, 0) * COALESCE(ep.proj_2026_gp, 0)) +
      (COALESCE(ep.proj_2026_reb, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.2) +
      (COALESCE(ep.proj_2026_ast, 0) * COALESCE(ep.proj_2026_gp, 0) * 1.5) +
      (COALESCE(ep.proj_2026_stl, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_blk, 0) * COALESCE(ep.proj_2026_gp, 0) * 3) +
      (COALESCE(ep.proj_2026_to, 0) * COALESCE(ep.proj_2026_gp, 0) * -1) +
      (COALESCE(ep.proj_2026_3pm, 0) * COALESCE(ep.proj_2026_gp, 0) * 1)
    ) < 1800 THEN 'YES (< 1800 FP) ✅'
    ELSE 'NO (passes R1 threshold) ❌'
  END as filter_status
FROM players p
LEFT JOIN espn_player_projections ep ON ep.player_id = p.id
WHERE p.name ILIKE '%Camara%' AND p.name ILIKE '%Toumani%';

