-- ============================================================================
-- DFS FOREIGN KEY VERIFICATION SCRIPT
-- ============================================================================
-- Purpose: Verify all foreign key relationships are properly set up
-- Run this AFTER applying all DFS migrations
-- ============================================================================

-- ============================================================================
-- 1. VERIFY TABLE EXISTENCE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== VERIFYING TABLE EXISTENCE ===';
  
  -- Check core NBA tables
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'nba_games') THEN
    RAISE NOTICE '✅ nba_games table exists';
  ELSE
    RAISE WARNING '❌ nba_games table MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'nba_players') THEN
    RAISE NOTICE '✅ nba_players table exists';
  ELSE
    RAISE WARNING '❌ nba_players table MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'nba_hoopshype_salaries') THEN
    RAISE NOTICE '✅ nba_hoopshype_salaries table exists';
  ELSE
    RAISE WARNING '❌ nba_hoopshype_salaries table MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'nba_boxscores') THEN
    RAISE NOTICE '✅ nba_boxscores table exists';
  ELSE
    RAISE WARNING '❌ nba_boxscores table MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'nba_season_weeks') THEN
    RAISE NOTICE '✅ nba_season_weeks table exists';
  ELSE
    RAISE WARNING '❌ nba_season_weeks table MISSING!';
  END IF;
  
  -- Check DFS tables
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'dfs_pools') THEN
    RAISE NOTICE '✅ dfs_pools table exists';
  ELSE
    RAISE WARNING '❌ dfs_pools table MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'dfs_pool_games') THEN
    RAISE NOTICE '✅ dfs_pool_games table exists';
  ELSE
    RAISE WARNING '❌ dfs_pool_games table MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'dfs_player_salaries') THEN
    RAISE NOTICE '✅ dfs_player_salaries table exists';
  ELSE
    RAISE WARNING '❌ dfs_player_salaries table MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'dfs_lineups') THEN
    RAISE NOTICE '✅ dfs_lineups table exists';
  ELSE
    RAISE WARNING '❌ dfs_lineups table MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'dfs_lineup_positions') THEN
    RAISE NOTICE '✅ dfs_lineup_positions table exists';
  ELSE
    RAISE WARNING '❌ dfs_lineup_positions table MISSING!';
  END IF;
END $$;

-- ============================================================================
-- 2. VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFYING FOREIGN KEY CONSTRAINTS ===';
  
  -- Check dfs_pool_games → nba_games FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_dfs_pool_games_game'
    AND table_name = 'dfs_pool_games'
  ) THEN
    RAISE NOTICE '✅ dfs_pool_games → nba_games FK exists';
  ELSE
    RAISE WARNING '❌ dfs_pool_games → nba_games FK MISSING!';
  END IF;
  
  -- Check dfs_player_salaries → nba_players FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_dfs_player_salaries_player'
    AND table_name = 'dfs_player_salaries'
  ) THEN
    RAISE NOTICE '✅ dfs_player_salaries → nba_players FK exists';
  ELSE
    RAISE WARNING '❌ dfs_player_salaries → nba_players FK MISSING!';
  END IF;
  
  -- Check dfs_lineup_positions → nba_players FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_dfs_lineup_positions_player'
    AND table_name = 'dfs_lineup_positions'
  ) THEN
    RAISE NOTICE '✅ dfs_lineup_positions → nba_players FK exists';
  ELSE
    RAISE WARNING '❌ dfs_lineup_positions → nba_players FK MISSING!';
  END IF;
END $$;

-- ============================================================================
-- 3. VERIFY DATA AVAILABILITY
-- ============================================================================

DO $$
DECLARE
  v_games_count INTEGER;
  v_players_count INTEGER;
  v_salaries_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFYING DATA AVAILABILITY ===';
  
  -- Check NBA games
  SELECT COUNT(*) INTO v_games_count FROM nba_games;
  IF v_games_count > 0 THEN
    RAISE NOTICE '✅ nba_games has % rows', v_games_count;
  ELSE
    RAISE WARNING '❌ nba_games is EMPTY!';
  END IF;
  
  -- Check NBA players
  SELECT COUNT(*) INTO v_players_count FROM nba_players WHERE is_active = TRUE;
  IF v_players_count > 0 THEN
    RAISE NOTICE '✅ nba_players has % active players', v_players_count;
  ELSE
    RAISE WARNING '❌ nba_players has NO active players!';
  END IF;
  
  -- Check hoopshype salaries
  SELECT COUNT(*) INTO v_salaries_count 
  FROM nba_hoopshype_salaries 
  WHERE salary_2025_26 IS NOT NULL;
  IF v_salaries_count > 0 THEN
    RAISE NOTICE '✅ nba_hoopshype_salaries has % players with 2025-26 salaries', v_salaries_count;
  ELSE
    RAISE WARNING '❌ nba_hoopshype_salaries has NO 2025-26 salaries!';
  END IF;
END $$;

-- ============================================================================
-- 4. TEST FOREIGN KEY RELATIONSHIPS
-- ============================================================================

DO $$
DECLARE
  v_test_game_id VARCHAR(50);
  v_test_player_id UUID;
  v_test_nba_player_id INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING FOREIGN KEY RELATIONSHIPS ===';
  
  -- Get a test game
  SELECT game_id INTO v_test_game_id 
  FROM nba_games 
  WHERE game_status_text = 'Final' 
  ORDER BY game_date_est DESC 
  LIMIT 1;
  
  IF v_test_game_id IS NOT NULL THEN
    RAISE NOTICE '✅ Found test game: %', v_test_game_id;
  ELSE
    RAISE WARNING '❌ No games found for testing';
  END IF;
  
  -- Get a test player
  SELECT id, nba_player_id INTO v_test_player_id, v_test_nba_player_id
  FROM nba_players 
  WHERE is_active = TRUE 
  AND team_abbreviation IS NOT NULL
  LIMIT 1;
  
  IF v_test_player_id IS NOT NULL THEN
    RAISE NOTICE '✅ Found test player: % (nba_player_id: %)', v_test_player_id, v_test_nba_player_id;
  ELSE
    RAISE WARNING '❌ No players found for testing';
  END IF;
  
  -- Test if player has salary
  IF EXISTS (
    SELECT 1 FROM nba_hoopshype_salaries 
    WHERE player_id = v_test_player_id 
    AND salary_2025_26 IS NOT NULL
  ) THEN
    RAISE NOTICE '✅ Test player has 2025-26 salary in nba_hoopshype_salaries';
  ELSE
    RAISE WARNING '⚠️  Test player has NO 2025-26 salary (will use minimum)';
  END IF;
END $$;

-- ============================================================================
-- 5. VERIFY FUNCTIONS EXIST
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFYING FUNCTIONS EXIST ===';
  
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_available_nba_games_for_dfs'
  ) THEN
    RAISE NOTICE '✅ get_available_nba_games_for_dfs() exists';
  ELSE
    RAISE WARNING '❌ get_available_nba_games_for_dfs() MISSING!';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_dfs_pool_from_games'
  ) THEN
    RAISE NOTICE '✅ create_dfs_pool_from_games() exists';
  ELSE
    RAISE WARNING '❌ create_dfs_pool_from_games() MISSING!';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_dfs_players_for_games'
  ) THEN
    RAISE NOTICE '✅ get_dfs_players_for_games() exists';
  ELSE
    RAISE WARNING '❌ get_dfs_players_for_games() MISSING!';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_dfs_team_of_week'
  ) THEN
    RAISE NOTICE '✅ get_dfs_team_of_week() exists';
  ELSE
    RAISE WARNING '❌ get_dfs_team_of_week() MISSING!';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'generate_dfs_salaries_from_real_contracts'
  ) THEN
    RAISE NOTICE '✅ generate_dfs_salaries_from_real_contracts() exists';
  ELSE
    RAISE WARNING '❌ generate_dfs_salaries_from_real_contracts() MISSING!';
  END IF;
END $$;

-- ============================================================================
-- 6. VERIFY VIEWS EXIST
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFYING VIEWS EXIST ===';
  
  IF EXISTS (SELECT FROM pg_views WHERE viewname = 'dfs_todays_contests') THEN
    RAISE NOTICE '✅ dfs_todays_contests view exists';
  ELSE
    RAISE WARNING '❌ dfs_todays_contests view MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_views WHERE viewname = 'dfs_admin_pool_summary') THEN
    RAISE NOTICE '✅ dfs_admin_pool_summary view exists';
  ELSE
    RAISE WARNING '❌ dfs_admin_pool_summary view MISSING!';
  END IF;
  
  IF EXISTS (SELECT FROM pg_views WHERE viewname = 'dfs_lineup_summary') THEN
    RAISE NOTICE '✅ dfs_lineup_summary view exists';
  ELSE
    RAISE WARNING '❌ dfs_lineup_summary view MISSING!';
  END IF;
END $$;

-- ============================================================================
-- 7. SAMPLE QUERIES TO TEST INTEGRATION
-- ============================================================================

-- Test getting available games
SELECT 
  'TEST: Get available games for today' as test_name,
  COUNT(*) as games_available
FROM get_available_nba_games_for_dfs(CURRENT_DATE);

-- Test getting players for a game
WITH sample_games AS (
  SELECT game_id 
  FROM nba_games 
  WHERE DATE(game_date_est) >= CURRENT_DATE - INTERVAL '7 days'
  LIMIT 3
)
SELECT 
  'TEST: Get players from sample games' as test_name,
  COUNT(*) as players_available
FROM get_dfs_players_for_games(
  ARRAY(SELECT game_id FROM sample_games)
);

-- Test salary statistics
SELECT 
  'TEST: Salary statistics' as test_name,
  COUNT(*) as players_with_salaries,
  MIN(salary_2025_26) as min_salary,
  MAX(salary_2025_26) as max_salary,
  AVG(salary_2025_26)::BIGINT as avg_salary
FROM nba_hoopshype_salaries
WHERE salary_2025_26 IS NOT NULL;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '  DFS FOREIGN KEY VERIFICATION COMPLETE';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the output above for any ❌ or ⚠️  warnings.';
  RAISE NOTICE 'All checks should show ✅ for production readiness.';
  RAISE NOTICE '';
END $$;

