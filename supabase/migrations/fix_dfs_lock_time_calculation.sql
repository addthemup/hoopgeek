-- ============================================================================
-- Fix DFS Lock Time Calculation - Ensure Proper Timezone Handling
-- ============================================================================
-- The issue: seconds_until_lock was showing pools as locked when they weren't
-- Root cause: Timezone mismatches between lock_time storage and now() calculation
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
  
  -- Time until lock - Fixed to handle timezones properly
  EXTRACT(EPOCH FROM (p.lock_time - CURRENT_TIMESTAMP))::INTEGER as seconds_until_lock,
  
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
Shows only active, public pools that are accepting entries.
Fixed timezone handling for seconds_until_lock calculation.';

