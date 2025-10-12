-- ============================================================================
-- DEBUG: Check and Fix generate_league_schedule Function
-- ============================================================================

-- Step 1: Check current function signature
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'generate_league_schedule'
  AND n.nspname = 'public';

-- Step 2: Drop ALL versions of the function (both old and new signatures)
DROP FUNCTION IF EXISTS generate_league_schedule(UUID, INTEGER, INTEGER, INTEGER, DATE) CASCADE;
DROP FUNCTION IF EXISTS generate_league_schedule(UUID, INTEGER, INTEGER, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS generate_league_schedule CASCADE;

-- Step 3: Recreate with ONLY the new signature
CREATE OR REPLACE FUNCTION generate_league_schedule(
  league_id_param UUID,
  regular_season_weeks_param INTEGER DEFAULT 18,
  playoff_teams_param INTEGER DEFAULT 6,
  playoff_weeks_param INTEGER DEFAULT 3,
  season_year_param INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)
)
RETURNS BOOLEAN AS $$
DECLARE
  team_count INTEGER;
  team_list UUID[];
  rotated_list UUID[];
  i INTEGER;
  j INTEGER;
  week_num INTEGER;
  playoff_start_week INTEGER;
  playoff_round INTEGER;
  team1_id UUID;
  team2_id UUID;
  team1_index INTEGER;
  team2_index INTEGER;
  fixed_team UUID;
  rotation_week INTEGER;
  week_record RECORD;
  total_weeks INTEGER := 25;
BEGIN
  -- Get team count
  SELECT COUNT(*) INTO team_count FROM fantasy_teams WHERE league_id = league_id_param;
  IF team_count < 2 THEN 
    RAISE EXCEPTION 'League must have at least 2 teams to generate schedule'; 
  END IF;
  
  -- Calculate playoff weeks (last N weeks)
  playoff_start_week := total_weeks - playoff_weeks_param + 1;
  regular_season_weeks_param := playoff_start_week - 1;
  
  -- Get random team order
  SELECT ARRAY_AGG(id ORDER BY RANDOM()) INTO team_list 
  FROM fantasy_teams WHERE league_id = league_id_param;
  
  -- Save settings
  INSERT INTO league_schedule_settings (
    league_id, regular_season_weeks, playoff_weeks, playoff_teams, 
    playoff_start_week, season_start_date, is_schedule_generated
  ) VALUES (
    league_id_param, regular_season_weeks_param, playoff_weeks_param, 
    playoff_teams_param, playoff_start_week,
    (SELECT start_date FROM fantasy_season_weeks 
     WHERE season_year = season_year_param AND week_number = 1), 
    true
  ) ON CONFLICT (league_id) DO UPDATE SET
    regular_season_weeks = EXCLUDED.regular_season_weeks,
    playoff_weeks = EXCLUDED.playoff_weeks,
    playoff_teams = EXCLUDED.playoff_teams,
    playoff_start_week = EXCLUDED.playoff_start_week,
    season_start_date = EXCLUDED.season_start_date,
    is_schedule_generated = true,
    updated_at = NOW();
  
  -- Clear existing schedule
  DELETE FROM weekly_matchups WHERE league_id = league_id_param;
  
  -- PRESEASON (Week 0)
  SELECT * INTO week_record FROM fantasy_season_weeks
  WHERE season_year = season_year_param AND week_number = 0;
  
  IF FOUND THEN
    FOR i IN 1..(team_count / 2) LOOP
      team1_index := (i - 1) * 2 + 1;
      team2_index := (i - 1) * 2 + 2;
      IF team2_index <= team_count THEN
        INSERT INTO weekly_matchups (
          league_id, fantasy_team1_id, fantasy_team2_id, week_number,
          season_year, season_type, matchup_date, status, is_preseason
        ) VALUES (
          league_id_param, team_list[team1_index], team_list[team2_index], 0,
          season_year_param, 'regular', week_record.start_date, 'scheduled', true
        );
      END IF;
    END LOOP;
  END IF;
  
  -- REGULAR SEASON with rotation
  SELECT ARRAY_AGG(id ORDER BY RANDOM()) INTO team_list 
  FROM fantasy_teams WHERE league_id = league_id_param;
  
  fixed_team := team_list[1];
  
  FOR week_num IN 1..regular_season_weeks_param LOOP
    SELECT * INTO week_record FROM fantasy_season_weeks
    WHERE season_year = season_year_param AND week_number = week_num;
    IF NOT FOUND THEN CONTINUE; END IF;
    
    rotated_list := team_list;
    IF team_count > 2 THEN
      FOR i IN 2..team_count LOOP
        rotation_week := ((week_num - 1) % (team_count - 1));
        j := 2 + ((i - 2 + rotation_week) % (team_count - 1));
        rotated_list[i] := team_list[j];
      END LOOP;
    END IF;
    
    FOR i IN 1..(team_count / 2) LOOP
      team1_index := i;
      team2_index := team_count - i + 1;
      IF team1_index < team2_index THEN
        INSERT INTO weekly_matchups (
          league_id, fantasy_team1_id, fantasy_team2_id, week_number,
          season_year, season_type, matchup_date, status, is_preseason
        ) VALUES (
          league_id_param, rotated_list[team1_index], rotated_list[team2_index], week_num,
          season_year_param, 'regular', week_record.start_date, 'scheduled', false
        );
      END IF;
    END LOOP;
  END LOOP;
  
  -- PLAYOFFS
  FOR week_num IN playoff_start_week..total_weeks LOOP
    SELECT * INTO week_record FROM fantasy_season_weeks
    WHERE season_year = season_year_param AND week_number = week_num;
    IF NOT FOUND THEN CONTINUE; END IF;
    
    playoff_round := week_num - playoff_start_week + 1;
    
    FOR i IN 1..(playoff_teams_param / 2) LOOP
      team1_id := team_list[i];
      team2_id := team_list[playoff_teams_param - i + 1];
      
      INSERT INTO weekly_matchups (
        league_id, fantasy_team1_id, fantasy_team2_id, week_number,
        season_year, season_type, playoff_round, matchup_date, status, is_preseason
      ) VALUES (
        league_id_param, team1_id, team2_id, week_num,
        season_year_param, 'playoff', playoff_round, week_record.start_date, 'scheduled', false
      );
    END LOOP;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION generate_league_schedule TO authenticated;

-- Step 5: Verify the new signature
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'generate_league_schedule'
  AND n.nspname = 'public';

