-- ============================================================================
-- Fix dfs_todays_contests view to include live pools
-- ============================================================================
-- Issue: The view only shows pools with status 'scheduled' or 'filling',
--        but it should also include 'live' pools so they appear in the avatar bar
--        
-- Pool Status Flow:
-- - Pools are created as 'scheduled' (upcoming, accepting entries)
-- - When first game in slate starts → 'live' (games in progress)
-- - When all games finish → 'completed' (finished, not shown in view)
-- 
-- Note: 'filling' status is not needed - current_entries vs max_entries
--       makes the filling state implied. The view shows both 'scheduled'
--       (upcoming) and 'live' (active) pools.
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
  p.icon_name,
  p.html_color_primary,
  p.html_color_secondary,
  
  -- Entry percentage (shows how full the pool is)
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
  -- Show upcoming pools (scheduled) and active pools (live)
  -- Exclude completed, draft, cancelled, suspended, etc.
  AND p.status IN ('scheduled', 'live')
  AND DATE(p.slate_date) >= CURRENT_DATE
ORDER BY p.lock_time ASC, p.is_featured DESC;

COMMENT ON VIEW dfs_todays_contests IS
'Public view of upcoming and live DFS contests for display on the DFS homepage.
Shows active, public pools that are:
- scheduled: Upcoming pools (before first game starts, accepting entries)
- live: Active pools (games have started, users can still edit lineups until their specific game starts)

Excludes completed pools and other inactive statuses.
The fill_percentage field (current_entries/max_entries) makes the filling state implied.
Fixed timezone handling for seconds_until_lock calculation.
Includes icon fields (icon_name, html_color_primary, html_color_secondary).
Updated to include live pools so they appear in the avatar bar.';

-- Re-grant permissions on the view
GRANT SELECT ON dfs_todays_contests TO anon, authenticated;

