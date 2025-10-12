-- ============================================================================
-- Fix League Schedule Generator
-- ============================================================================
-- This migration fixes two major issues:
-- 1. Schedule rotation - teams were playing same opponents every week
-- 2. Preseason matchup generation - Week 0 sandbox games

-- Drop the old function
DROP FUNCTION IF EXISTS generate_league_schedule(UUID, INTEGER, INTEGER, INTEGER, DATE);

-- Create improved schedule generator with proper rotation and preseason
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
  fixed_team UUID; -- For rotation algorithm
  rotation_week INTEGER;
  week_record RECORD;
  total_weeks INTEGER := 25; -- Total weeks in season (from fantasy_season_weeks)
BEGIN
  -- Get team count for the league
  SELECT COUNT(*) INTO team_count
  FROM fantasy_teams 
  WHERE league_id = league_id_param;
  
  IF team_count < 2 THEN
    RAISE EXCEPTION 'League must have at least 2 teams to generate schedule';
  END IF;
  
  -- Calculate playoff start week (last N weeks of the season)
  -- If playoff_weeks_param = 3, playoffs are weeks 23, 24, 25
  -- If playoff_weeks_param = 2, playoffs are weeks 24, 25
  playoff_start_week := total_weeks - playoff_weeks_param + 1;
  
  -- Regular season is everything before playoffs (weeks 1 through playoff_start_week - 1)
  regular_season_weeks_param := playoff_start_week - 1;
  
  -- Get all team IDs in random order for preseason
  SELECT ARRAY_AGG(id ORDER BY RANDOM()) INTO team_list
  FROM fantasy_teams 
  WHERE league_id = league_id_param;
  
  -- Create or update league schedule settings
  INSERT INTO league_schedule_settings (
    league_id, 
    regular_season_weeks, 
    playoff_weeks, 
    playoff_teams,
    playoff_start_week,
    season_start_date,
    is_schedule_generated
  ) VALUES (
    league_id_param,
    regular_season_weeks_param,
    playoff_weeks_param,
    playoff_teams_param,
    playoff_start_week,
    (SELECT start_date FROM fantasy_season_weeks WHERE season_year = season_year_param AND week_number = 1),
    true
  ) ON CONFLICT (league_id) DO UPDATE SET
    regular_season_weeks = EXCLUDED.regular_season_weeks,
    playoff_weeks = EXCLUDED.playoff_weeks,
    playoff_teams = EXCLUDED.playoff_teams,
    playoff_start_week = EXCLUDED.playoff_start_week,
    season_start_date = EXCLUDED.season_start_date,
    is_schedule_generated = true,
    updated_at = NOW();
  
  -- Clear existing matchups for this league
  DELETE FROM weekly_matchups WHERE league_id = league_id_param;
  
  -- ========================================================================
  -- GENERATE PRESEASON MATCHUP (Week 0)
  -- ========================================================================
  
  -- Get preseason week info from fantasy_season_weeks
  SELECT * INTO week_record
  FROM fantasy_season_weeks
  WHERE season_year = season_year_param AND week_number = 0;
  
  IF FOUND THEN
    -- Create preseason matchups (random pairings)
    FOR i IN 1..(team_count / 2) LOOP
      team1_index := (i - 1) * 2 + 1;
      team2_index := (i - 1) * 2 + 2;
      
      IF team2_index <= team_count THEN
        INSERT INTO weekly_matchups (
          league_id,
          fantasy_team1_id,
          fantasy_team2_id,
          week_number,
          season_year,
          season_type,
          matchup_date,
          status,
          is_preseason
        ) VALUES (
          league_id_param,
          team_list[team1_index],
          team_list[team2_index],
          0, -- Week 0 = Preseason
          season_year_param,
          'regular',
          week_record.start_date, -- Use actual preseason start date
          'scheduled',
          true -- Mark as preseason
        );
      END IF;
    END LOOP;
    
    -- Handle odd number of teams (one team gets a bye in preseason)
    IF team_count % 2 = 1 THEN
      RAISE NOTICE 'Odd number of teams (%), one team has a bye in preseason', team_count;
    END IF;
  END IF;
  
  -- ========================================================================
  -- GENERATE REGULAR SEASON SCHEDULE (Weeks 1 through playoff_start_week - 1)
  -- Using Circle Method for Round-Robin Tournament
  -- ========================================================================
  
  -- Reshuffle teams for regular season (different order than preseason)
  SELECT ARRAY_AGG(id ORDER BY RANDOM()) INTO team_list
  FROM fantasy_teams 
  WHERE league_id = league_id_param;
  
  -- For round-robin rotation, we keep one team fixed and rotate the others
  -- This is the "circle method" algorithm
  fixed_team := team_list[1];
  
  FOR week_num IN 1..regular_season_weeks_param LOOP
    -- Get week info from fantasy_season_weeks for accurate dates
    SELECT * INTO week_record
    FROM fantasy_season_weeks
    WHERE season_year = season_year_param AND week_number = week_num;
    
    IF NOT FOUND THEN
      RAISE NOTICE 'Week % not found in fantasy_season_weeks, skipping', week_num;
      CONTINUE;
    END IF;
    
    -- Calculate rotation for this week
    -- We rotate the team list (except the first team which stays fixed)
    rotated_list := team_list;
    
    IF team_count > 2 THEN
      -- Apply rotation based on week number
      -- Each week, teams rotate positions (except position 1)
      FOR i IN 2..team_count LOOP
        -- Calculate new position after rotation
        rotation_week := ((week_num - 1) % (team_count - 1));
        j := 2 + ((i - 2 + rotation_week) % (team_count - 1));
        rotated_list[i] := team_list[j];
      END LOOP;
    END IF;
    
    -- Create matchups for this week using rotated positions
    FOR i IN 1..(team_count / 2) LOOP
      team1_index := i;
      team2_index := team_count - i + 1;
      
      -- Skip if indices are the same (shouldn't happen but safety check)
      IF team1_index < team2_index THEN
        INSERT INTO weekly_matchups (
          league_id,
          fantasy_team1_id,
          fantasy_team2_id,
          week_number,
          season_year,
          season_type,
          matchup_date,
          status,
          is_preseason
        ) VALUES (
          league_id_param,
          rotated_list[team1_index],
          rotated_list[team2_index],
          week_num,
          season_year_param,
          'regular',
          week_record.start_date, -- Use actual week start date from fantasy_season_weeks
          'scheduled',
          false -- Regular season game
        );
      END IF;
    END LOOP;
    
    -- Handle odd number of teams (bye week rotates)
    IF team_count % 2 = 1 THEN
      -- The middle team gets a bye
      RAISE NOTICE 'Week %: Team at position % has a bye', week_num, (team_count / 2) + 1;
    END IF;
  END LOOP;
  
  -- ========================================================================
  -- GENERATE PLAYOFF SCHEDULE (Last N weeks of season)
  -- ========================================================================
  
  FOR week_num IN playoff_start_week..total_weeks LOOP
    -- Get week info from fantasy_season_weeks
    SELECT * INTO week_record
    FROM fantasy_season_weeks
    WHERE season_year = season_year_param AND week_number = week_num;
    
    IF NOT FOUND THEN
      RAISE NOTICE 'Playoff week % not found in fantasy_season_weeks, skipping', week_num;
      CONTINUE;
    END IF;
    
    playoff_round := week_num - playoff_start_week + 1;
    
    -- Create playoff matchups (simplified - top teams advance)
    -- In reality, playoff matchups should be determined by regular season standings
    FOR i IN 1..(playoff_teams_param / 2) LOOP
      team1_id := team_list[i];
      team2_id := team_list[playoff_teams_param - i + 1];
      
      INSERT INTO weekly_matchups (
        league_id,
        fantasy_team1_id,
        fantasy_team2_id,
        week_number,
        season_year,
        season_type,
        playoff_round,
        matchup_date,
        status,
        is_preseason
      ) VALUES (
        league_id_param,
        team1_id,
        team2_id,
        week_num,
        season_year_param,
        'playoff',
        playoff_round,
        week_record.start_date, -- Use actual week start date from fantasy_season_weeks
        'scheduled',
        false -- Playoff game
      );
    END LOOP;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_league_schedule TO authenticated;

-- Add comment
COMMENT ON FUNCTION generate_league_schedule IS 'Generates complete league schedule including Week 0 (preseason sandbox), regular season with proper rotation using circle method, and playoffs. Preseason games are marked with is_preseason=true and do not count in standings.';

