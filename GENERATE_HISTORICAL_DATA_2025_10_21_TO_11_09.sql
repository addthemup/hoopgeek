-- ============================================================================
-- GENERATE HISTORICAL LINEUP DATA
-- Generates Team of the Night for dates 2025-10-21 to 2025-11-09
-- Generates Team of the Week for all weeks in that range
-- ============================================================================

-- ============================================================================
-- STEP 1: Generate Team of the Night for each date
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
  RAISE NOTICE 'Starting historical Team of the Night generation...';
  
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
        RAISE NOTICE 'Generated lineup for date: %', v_current_date;
      ELSE
        RAISE NOTICE 'No games found for date: %', v_current_date;
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
-- STEP 2: Generate Team of the Week for all weeks in the date range
-- ============================================================================

DO $$
DECLARE
  v_week_record RECORD;
  v_lineup_record RECORD;
  v_weeks_created INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting historical Team of the Week generation...';
  
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
        RAISE NOTICE 'Generated lineup for week: % to %', v_week_record.start_date, v_week_record.end_date;
      ELSE
        RAISE NOTICE 'No games found for week: % to %', v_week_record.start_date, v_week_record.end_date;
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

