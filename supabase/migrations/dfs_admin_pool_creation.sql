-- ============================================================================
-- DFS ADMIN: POOL CREATION & PLAYER POPULATION
-- ============================================================================
-- Purpose: Backend functions for admin to create pools and auto-populate
--          players from selected NBA games
-- ============================================================================

-- ============================================================================
-- FUNCTION: Get Available NBA Games for DFS Slate
-- ============================================================================

CREATE OR REPLACE FUNCTION get_available_nba_games_for_dfs(
  p_date DATE
)
RETURNS TABLE(
  game_id VARCHAR(50),
  game_date TIMESTAMPTZ,
  home_team VARCHAR(10),
  away_team VARCHAR(10),
  home_team_name TEXT,
  away_team_name TEXT,
  venue TEXT,
  game_status TEXT,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.game_id,
    g.game_date_est,
    g.home_team_abbr,
    g.visitor_team_abbr,
    ht.full_name as home_team_name,
    vt.full_name as away_team_name,
    g.arena_name as venue,
    g.game_status_text as game_status,
    (g.game_status_text = 'scheduled' OR g.game_status_text IS NULL) as is_available
  FROM nba_games g
  LEFT JOIN nba_teams ht ON g.home_team_abbr = ht.abbreviation
  LEFT JOIN nba_teams vt ON g.visitor_team_abbr = vt.abbreviation
  WHERE DATE(g.game_date_est) = p_date
  ORDER BY g.game_date_est;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_available_nba_games_for_dfs IS
'Gets all NBA games for a specific date that can be included in a DFS slate.
Used by admin to select which games to include in a pool.';

-- ============================================================================
-- FUNCTION: Create DFS Pool from Selected Games
-- ============================================================================

CREATE OR REPLACE FUNCTION create_dfs_pool_from_games(
  p_admin_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_slate_name TEXT,
  p_slate_date DATE,
  p_game_ids VARCHAR(50)[],
  p_entry_fee DECIMAL DEFAULT 10.00,
  p_max_entries INTEGER DEFAULT 100,
  p_difficulty_tier dfs_difficulty_tier DEFAULT 'standard',
  p_prize_type dfs_prize_type DEFAULT 'top_n',
  p_is_guaranteed BOOLEAN DEFAULT FALSE,
  p_is_featured BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  pool_id UUID,
  games_added INTEGER,
  players_added INTEGER,
  min_salary BIGINT,
  max_salary BIGINT,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_pool_id UUID;
  v_lock_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_games_added INTEGER := 0;
  v_players_added INTEGER := 0;
  v_min_salary BIGINT;
  v_max_salary BIGINT;
  v_salary_cap BIGINT;
BEGIN
  -- Verify admin user (check against admin_users table)
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = p_admin_user_id 
    AND is_active = TRUE
  ) THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      0,
      0,
      0::BIGINT,
      0::BIGINT,
      FALSE,
      'Unauthorized: User is not an admin'::TEXT;
    RETURN;
  END IF;
  
  -- Validate we have games
  IF array_length(p_game_ids, 1) IS NULL OR array_length(p_game_ids, 1) = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      0,
      0,
      0::BIGINT,
      0::BIGINT,
      FALSE,
      'Error: No games selected'::TEXT;
    RETURN;
  END IF;
  
  -- Get lock time (earliest game start) and end time (latest game end)
  SELECT 
    MIN(game_date_est) as lock,
    MAX(game_date_est + INTERVAL '3 hours') as end_time -- Assume 3hr games
  INTO v_lock_time, v_end_time
  FROM nba_games
  WHERE game_id = ANY(p_game_ids);
  
  -- Set salary cap based on difficulty
  v_salary_cap := CASE p_difficulty_tier
    WHEN 'elite' THEN 154600000
    WHEN 'pro' THEN 195900000
    WHEN 'standard' THEN 207800000
    ELSE 207800000
  END;
  
  -- Calculate prize pool (simple 90% payout for now)
  
  -- Create the pool
  INSERT INTO dfs_pools (
    name,
    description,
    slate_name,
    slate_date,
    start_time,
    lock_time,
    end_time,
    entry_fee,
    prize_pool,
    max_entries,
    salary_cap,
    difficulty_tier,
    prize_type,
    is_guaranteed,
    is_featured,
    is_public,
    status,
    created_by_admin_id
  ) VALUES (
    p_name,
    p_description,
    p_slate_name,
    p_slate_date,
    v_lock_time - INTERVAL '4 hours', -- Pool opens 4 hours before lock
    v_lock_time,
    v_end_time,
    p_entry_fee,
    (p_entry_fee * p_max_entries * 0.9), -- 90% payout
    p_max_entries,
    v_salary_cap,
    p_difficulty_tier,
    p_prize_type,
    p_is_guaranteed,
    p_is_featured,
    TRUE,
    'scheduled',
    p_admin_user_id
  )
  RETURNING id INTO v_pool_id;
  
  -- Add games to the pool
  INSERT INTO dfs_pool_games (
    pool_id,
    game_id,
    game_date,
    home_team,
    away_team
  )
  SELECT 
    v_pool_id,
    g.game_id,
    g.game_date_est,
    g.home_team_abbr,
    g.visitor_team_abbr
  FROM nba_games g
  WHERE g.game_id = ANY(p_game_ids);
  
  GET DIAGNOSTICS v_games_added = ROW_COUNT;
  
  -- Auto-populate players from the selected games
  WITH game_teams AS (
    SELECT DISTINCT unnest(ARRAY[home_team, away_team]) as team_abbr
    FROM dfs_pool_games
    WHERE pool_id = v_pool_id
  )
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
    v_pool_id,
    p.id,
    p.nba_player_id,
    p.name,
    p.team_abbreviation,
    p.position,
    -- Use REAL NBA salary from hoopshype
    COALESCE(hs.salary_2025_26, 1157153) as salary, -- Default to NBA minimum
    35.0 as projected_points, -- TODO: Calculate from recent performance
    TRUE as is_active,
    TRUE as is_playing
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  WHERE p.team_abbreviation IN (SELECT team_abbr FROM game_teams)
    AND p.is_active = TRUE;
  
  GET DIAGNOSTICS v_players_added = ROW_COUNT;
  
  -- Get salary statistics
  SELECT 
    MIN(salary),
    MAX(salary)
  INTO v_min_salary, v_max_salary
  FROM dfs_player_salaries
  WHERE pool_id = v_pool_id;
  
  -- Log admin action
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details
  ) VALUES (
    p_admin_user_id,
    'create',
    'dfs_pool',
    v_pool_id,
    jsonb_build_object(
      'pool_name', p_name,
      'games_count', v_games_added,
      'players_count', v_players_added,
      'difficulty', p_difficulty_tier,
      'entry_fee', p_entry_fee
    )
  );
  
  RETURN QUERY SELECT 
    v_pool_id,
    v_games_added,
    v_players_added,
    v_min_salary,
    v_max_salary,
    TRUE,
    format('Pool created successfully with %s games and %s players', v_games_added, v_players_added)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_dfs_pool_from_games IS
'Admin function to create a DFS pool from selected NBA games.
Automatically populates players from teams playing in the selected games.
Uses REAL NBA salaries from nba_hoopshype_salaries table.';

-- ============================================================================
-- FUNCTION: Get Players for Selected Games
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dfs_players_for_games(
  p_game_ids VARCHAR(50)[]
)
RETURNS TABLE(
  player_id UUID,
  nba_player_id INTEGER,
  player_name TEXT,
  team VARCHAR(10),
  player_position VARCHAR(10),
  salary_2025_26 BIGINT,
  recent_avg_fantasy_pts DECIMAL,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH game_teams AS (
    SELECT DISTINCT unnest(ARRAY[home_team_abbr, visitor_team_abbr]) as team_abbr
    FROM nba_games
    WHERE game_id = ANY(p_game_ids)
  )
  SELECT 
    p.id,
    p.nba_player_id,
    p.name,
    p.team_abbreviation,
    p.position,
    COALESCE(hs.salary_2025_26, 1157153) as salary_2025_26,
    35.0::DECIMAL as recent_avg_fantasy_pts, -- TODO: Calculate from boxscores
    p.is_active
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
  WHERE p.team_abbreviation IN (SELECT team_abbr FROM game_teams)
    AND p.is_active = TRUE
  ORDER BY hs.salary_2025_26 DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_dfs_players_for_games IS
'Preview which players will be available for DFS pool based on selected games.
Useful for admin to verify player pool before creating the contest.';

-- ============================================================================
-- VIEW: Today's DFS Contests (Public View)
-- ============================================================================

CREATE OR REPLACE VIEW dfs_todays_contests AS
SELECT 
  p.id as pool_id,
  p.name,
  p.description,
  p.slate_name,
  p.slate_date,
  p.lock_time,
  p.entry_fee,
  p.prize_pool,
  p.current_entries,
  p.max_entries,
  p.min_entries,
  p.max_entries_per_user,
  p.difficulty_tier,
  p.salary_cap,
  p.prize_type,
  p.is_guaranteed,
  p.is_featured,
  p.status,
  
  -- Entry percentage
  CASE 
    WHEN p.max_entries > 0 THEN 
      ROUND((p.current_entries::DECIMAL / p.max_entries * 100), 1)
    ELSE 0
  END as fill_percentage,
  
  -- Game count
  (SELECT COUNT(*) FROM dfs_pool_games WHERE pool_id = p.id) as games_count,
  
  -- Player count
  (SELECT COUNT(*) FROM dfs_player_salaries WHERE pool_id = p.id AND is_active = TRUE) as active_players_count,
  
  -- Time until lock
  EXTRACT(EPOCH FROM (p.lock_time - now())) as seconds_until_lock,
  
  -- Games list
  (
    SELECT json_agg(
      json_build_object(
        'game_id', pg.game_id,
        'home_team', pg.home_team,
        'away_team', pg.away_team,
        'game_date', pg.game_date
      )
      ORDER BY pg.game_date
    )
    FROM dfs_pool_games pg
    WHERE pg.pool_id = p.id AND pg.is_included = TRUE
  ) as games

FROM dfs_pools p
WHERE p.is_public = TRUE
  AND p.status IN ('scheduled', 'filling')
  AND DATE(p.slate_date) >= CURRENT_DATE
ORDER BY p.lock_time ASC, p.is_featured DESC;

COMMENT ON VIEW dfs_todays_contests IS
'Public view of upcoming DFS contests for display on the DFS homepage.
Shows only active, public pools that are accepting entries.';

-- ============================================================================
-- VIEW: DFS Pool Summary (Admin View)
-- ============================================================================

CREATE OR REPLACE VIEW dfs_admin_pool_summary AS
SELECT 
  p.id as pool_id,
  p.name,
  p.slate_name,
  p.slate_date,
  p.status,
  p.created_at,
  
  -- Entry stats
  p.current_entries,
  p.max_entries,
  ROUND((p.current_entries::DECIMAL / NULLIF(p.max_entries, 0) * 100), 1) as fill_pct,
  
  -- Financial
  p.entry_fee,
  p.prize_pool,
  (p.entry_fee * p.current_entries) as total_collected,
  
  -- Game stats
  (SELECT COUNT(*) FROM dfs_pool_games WHERE pool_id = p.id) as games_count,
  (SELECT COUNT(*) FROM dfs_player_salaries WHERE pool_id = p.id) as total_players,
  (SELECT COUNT(*) FROM dfs_player_salaries WHERE pool_id = p.id AND is_active = TRUE) as active_players,
  
  -- Admin info
  p.created_by_admin_id

FROM dfs_pools p
ORDER BY p.created_at DESC;

COMMENT ON VIEW dfs_admin_pool_summary IS
'Admin dashboard view showing all DFS pools with detailed statistics.';

-- ============================================================================
-- FUNCTION: Update DFS Player Projections
-- ============================================================================

CREATE OR REPLACE FUNCTION update_dfs_player_projections(
  p_pool_id UUID
)
RETURNS TABLE(
  players_updated INTEGER,
  avg_projection DECIMAL
) AS $$
DECLARE
  v_players_updated INTEGER;
  v_avg_projection DECIMAL;
BEGIN
  -- Update projected_points based on recent game performance
  -- This calculates average fantasy points from last 5 games
  WITH recent_performance AS (
    SELECT 
      ps.player_id,
      AVG(
        COALESCE(b.pts, 0) + 
        (COALESCE(b.reb, 0) * 1.2) + 
        (COALESCE(b.ast, 0) * 1.5) + 
        (COALESCE(b.stl, 0) * 3) + 
        (COALESCE(b.blk, 0) * 3) - 
        (COALESCE(b.tov, 0) * 1)
      ) as avg_fantasy_pts
    FROM dfs_player_salaries ps
    JOIN nba_boxscores b ON ps.nba_player_id = b.nba_player_id
    WHERE ps.pool_id = p_pool_id
      AND b.game_date >= CURRENT_DATE - INTERVAL '14 days'
    GROUP BY ps.player_id
    HAVING COUNT(*) >= 3 -- At least 3 recent games
  )
  UPDATE dfs_player_salaries ps
  SET 
    projected_points = COALESCE(rp.avg_fantasy_pts, 25.0),
    value_score = (COALESCE(rp.avg_fantasy_pts, 25.0) / NULLIF(ps.salary, 0) * 1000000),
    updated_at = now()
  FROM recent_performance rp
  WHERE ps.pool_id = p_pool_id
    AND ps.player_id = rp.player_id;
  
  GET DIAGNOSTICS v_players_updated = ROW_COUNT;
  
  SELECT AVG(projected_points)
  INTO v_avg_projection
  FROM dfs_player_salaries
  WHERE pool_id = p_pool_id;
  
  RETURN QUERY SELECT v_players_updated, v_avg_projection;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_dfs_player_projections IS
'Calculates and updates projected fantasy points for all players in a pool
based on their recent game performance (last 14 days).';

-- ============================================================================
-- SAMPLE USAGE
-- ============================================================================

/*

-- EXAMPLE 1: Get available games for today
SELECT * FROM get_available_nba_games_for_dfs(CURRENT_DATE);


-- EXAMPLE 2: Preview players from selected games
SELECT * FROM get_dfs_players_for_games(
  ARRAY['0022500001', '0022500002', '0022500003']
)
ORDER BY salary_2025_26 DESC
LIMIT 20;


-- EXAMPLE 3: Create a DFS pool (admin only)
SELECT * FROM create_dfs_pool_from_games(
  'admin-user-id-here'::UUID,
  'Sunday Main Slate',
  'Full NBA Sunday action with 10 games',
  'Main Slate',
  '2025-10-27',
  ARRAY['0022500001', '0022500002', '0022500003', '0022500004', '0022500005'],
  10.00, -- Entry fee
  1000, -- Max entries
  'standard', -- Difficulty
  'top_n', -- Prize type
  TRUE, -- Is guaranteed
  TRUE -- Is featured
);

-- Result:
-- pool_id                | games_added | players_added | min_salary | max_salary | success | message
-- xxxxxxxx-xxxx-xxxx-... | 5           | 150           | 1,157,153  | 51,915,615 | true    | Pool created...


-- EXAMPLE 4: Update player projections
SELECT * FROM update_dfs_player_projections('pool-id-here'::UUID);


-- EXAMPLE 5: View today's contests (public)
SELECT * FROM dfs_todays_contests
WHERE difficulty_tier = 'standard'
ORDER BY lock_time;


-- EXAMPLE 6: Admin dashboard view
SELECT * FROM dfs_admin_pool_summary
WHERE slate_date = CURRENT_DATE;

*/

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Public can view contests
GRANT SELECT ON dfs_todays_contests TO anon, authenticated;

-- Only admins can create pools
REVOKE EXECUTE ON FUNCTION create_dfs_pool_from_games FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_dfs_pool_from_games TO authenticated;

-- Admins can view admin summary
GRANT SELECT ON dfs_admin_pool_summary TO authenticated;

-- ============================================================================
-- END
-- ============================================================================

