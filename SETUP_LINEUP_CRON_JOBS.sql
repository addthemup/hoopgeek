-- ============================================================================
-- CRON JOBS: TEAM OF THE NIGHT & TEAM OF THE WEEK
-- ============================================================================
-- Creates two cron jobs:
-- 1. Nightly at 3:15 AM: Generate Team of the Night for yesterday's games
-- 2. Daily at 3:15 AM: Check if yesterday was end of week, generate Team of Week
-- ============================================================================

-- Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on pg_cron
GRANT USAGE ON SCHEMA cron TO authenticated;
GRANT USAGE ON SCHEMA cron TO service_role;

-- ============================================================================
-- HELPER FUNCTION: Generate Team of the Night for yesterday
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_daily_team_of_night()
RETURNS TABLE(
  game_date DATE,
  players_added INTEGER,
  success BOOLEAN
) AS $$
DECLARE
  v_yesterday DATE;
  v_players_added INTEGER := 0;
  v_lineup_record RECORD;
BEGIN
  -- Get yesterday's date
  v_yesterday := (CURRENT_DATE - INTERVAL '1 day')::DATE;
  
  -- Check if lineup already exists
  IF EXISTS (SELECT 1 FROM historical_team_of_night WHERE game_date = v_yesterday LIMIT 1) THEN
    RETURN QUERY SELECT v_yesterday, 0::INTEGER, true::BOOLEAN;
    RETURN;
  END IF;
  
  -- Check if games exist for yesterday
  IF NOT EXISTS (SELECT 1 FROM nba_boxscores WHERE game_date = v_yesterday LIMIT 1) THEN
    RETURN QUERY SELECT v_yesterday, 0::INTEGER, true::BOOLEAN;
    RETURN;
  END IF;
  
  -- Get lineup for yesterday
  FOR v_lineup_record IN 
    SELECT * FROM get_optimal_lineup_of_the_night()
  LOOP
    INSERT INTO historical_team_of_night (
      game_date, player_id, nba_player_id, player_name, team, 
      player_position, jersey_number, salary, fantasy_points, 
      games_played, lineup_order, lineup_unit, unit_position, weighted_points
    ) VALUES (
      v_yesterday, v_lineup_record.player_id, v_lineup_record.nba_player_id,
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
    
    v_players_added := v_players_added + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_yesterday, v_players_added, true::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Generate Team of the Week if week just ended
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_weekly_team_of_week()
RETURNS TABLE(
  week_start DATE,
  week_end DATE,
  players_added INTEGER,
  success BOOLEAN
) AS $$
DECLARE
  v_yesterday DATE;
  v_week_record RECORD;
  v_players_added INTEGER := 0;
  v_lineup_record RECORD;
BEGIN
  -- Get yesterday's date
  v_yesterday := (CURRENT_DATE - INTERVAL '1 day')::DATE;
  
  -- Check if yesterday was the end of a week
  SELECT 
    start_date, 
    end_date,
    season_year
  INTO v_week_record
  FROM nba_season_weeks
  WHERE end_date = v_yesterday
    AND league_id = 0
  LIMIT 1;
  
  -- If no week ended yesterday, return early
  IF v_week_record IS NULL THEN
    RETURN QUERY SELECT NULL::DATE, NULL::DATE, 0::INTEGER, true::BOOLEAN;
    RETURN;
  END IF;
  
  -- Check if lineup already exists
  IF EXISTS (
    SELECT 1 FROM historical_team_of_week 
    WHERE week_start = v_week_record.start_date 
      AND week_end = v_week_record.end_date 
    LIMIT 1
  ) THEN
    RETURN QUERY SELECT 
      v_week_record.start_date, 
      v_week_record.end_date, 
      0::INTEGER, 
      true::BOOLEAN;
    RETURN;
  END IF;
  
  -- Check if games exist for this week
  IF NOT EXISTS (
    SELECT 1 FROM nba_boxscores 
    WHERE game_date BETWEEN v_week_record.start_date AND v_week_record.end_date 
    LIMIT 1
  ) THEN
    RETURN QUERY SELECT 
      v_week_record.start_date, 
      v_week_record.end_date, 
      0::INTEGER, 
      true::BOOLEAN;
    RETURN;
  END IF;
  
  -- Get lineup for this week
  FOR v_lineup_record IN 
    SELECT * FROM get_optimal_lineup_of_the_week()
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
    
    v_players_added := v_players_added + 1;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_week_record.start_date, 
    v_week_record.end_date, 
    v_players_added, 
    true::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CRON JOB 1: TEAM OF THE NIGHT (Nightly at 3:15 AM)
-- ============================================================================

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-team-of-night-daily') THEN
        PERFORM cron.unschedule('generate-team-of-night-daily');
        RAISE NOTICE 'Removed existing generate-team-of-night-daily job';
    ELSE
        RAISE NOTICE 'No existing generate-team-of-night-daily job to remove';
    END IF;
END $$;

-- Schedule the Team of the Night to run daily at 3:15 AM
SELECT cron.schedule(
    'generate-team-of-night-daily',                    -- Job name
    '15 3 * * *',                                      -- Daily at 3:15 AM (UTC)
    $$
    SELECT * FROM generate_daily_team_of_night();
    $$
);

-- ============================================================================
-- CRON JOB 2: TEAM OF THE WEEK (Daily at 3:15 AM, only runs if week ended)
-- ============================================================================

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-team-of-week-daily') THEN
        PERFORM cron.unschedule('generate-team-of-week-daily');
        RAISE NOTICE 'Removed existing generate-team-of-week-daily job';
    ELSE
        RAISE NOTICE 'No existing generate-team-of-week-daily job to remove';
    END IF;
END $$;

-- Schedule the Team of the Week to run daily at 3:15 AM
-- (It will only generate if yesterday was the end of a week)
SELECT cron.schedule(
    'generate-team-of-week-daily',                    -- Job name
    '15 3 * * *',                                      -- Daily at 3:15 AM (UTC)
    $$
    SELECT * FROM generate_weekly_team_of_week();
    $$
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List the scheduled cron jobs
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobname
FROM cron.job
WHERE jobname IN ('generate-team-of-night-daily', 'generate-team-of-week-daily')
ORDER BY jobname;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION generate_daily_team_of_night() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_weekly_team_of_week() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_daily_team_of_night() TO service_role;
GRANT EXECUTE ON FUNCTION generate_weekly_team_of_week() TO service_role;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Cron Schedule: '15 3 * * *' = Daily at 3:15 AM UTC
-- 
-- To manually trigger:
--   SELECT * FROM generate_daily_team_of_night();
--   SELECT * FROM generate_weekly_team_of_week();
-- 
-- To stop:
--   SELECT cron.unschedule('generate-team-of-night-daily');
--   SELECT cron.unschedule('generate-team-of-week-daily');
-- 
-- To list all jobs:
--   SELECT * FROM cron.job;
-- 
-- ============================================================================

