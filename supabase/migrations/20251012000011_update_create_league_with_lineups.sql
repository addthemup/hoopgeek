-- ============================================================================
-- Update create_league_with_commissioner to support lineup settings
-- ============================================================================

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS create_league_with_commissioner CASCADE;

CREATE OR REPLACE FUNCTION create_league_with_commissioner(
  league_name TEXT,
  league_description TEXT DEFAULT NULL,
  max_teams_count INTEGER DEFAULT 10,
  scoring_type_val TEXT DEFAULT 'H2H_Points',
  team_name_val TEXT DEFAULT NULL,
  salary_cap_enabled_val BOOLEAN DEFAULT true,
  salary_cap_amount_val BIGINT DEFAULT 100000000,
  lineup_frequency_val TEXT DEFAULT 'daily',
  roster_config JSONB DEFAULT '{
    "PG": 1,
    "SG": 1,
    "SF": 1,
    "PF": 1,
    "C": 1,
    "G": 1,
    "F": 1,
    "UTIL": 3,
    "BENCH": 3,
    "IR": 1
  }',
  draft_date_val TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  -- NEW: Lineup settings
  starters_count_val INTEGER DEFAULT 5,
  starters_multiplier_val DECIMAL(4,2) DEFAULT 1.0,
  rotation_count_val INTEGER DEFAULT 5,
  rotation_multiplier_val DECIMAL(4,2) DEFAULT 0.75,
  bench_count_val INTEGER DEFAULT 3,
  bench_multiplier_val DECIMAL(4,2) DEFAULT 0.5
)
RETURNS UUID AS $$
DECLARE
  new_league_id UUID;
  new_team_id UUID;
  new_settings_id UUID;
  invite_code_val TEXT;
  team_rec RECORD;
  spot_rec RECORD;
  position_name TEXT;
  position_count INTEGER;
  position_order INTEGER := 1;
  i INTEGER;
  roster_size INTEGER;
  lineup_size INTEGER;
BEGIN
  -- Validate lineup configuration
  IF starters_count_val != 5 THEN
    RAISE EXCEPTION 'Starters count must be 5';
  END IF;
  
  IF rotation_count_val < 3 OR rotation_count_val > 7 THEN
    RAISE EXCEPTION 'Rotation count must be between 3 and 7';
  END IF;
  
  IF bench_count_val < 3 OR bench_count_val > 5 THEN
    RAISE EXCEPTION 'Bench count must be between 3 and 5';
  END IF;
  
  -- Calculate roster size and lineup size
  SELECT 
    COALESCE((roster_config->>'PG')::INTEGER, 0) +
    COALESCE((roster_config->>'SG')::INTEGER, 0) +
    COALESCE((roster_config->>'SF')::INTEGER, 0) +
    COALESCE((roster_config->>'PF')::INTEGER, 0) +
    COALESCE((roster_config->>'C')::INTEGER, 0) +
    COALESCE((roster_config->>'G')::INTEGER, 0) +
    COALESCE((roster_config->>'F')::INTEGER, 0) +
    COALESCE((roster_config->>'UTIL')::INTEGER, 0) +
    COALESCE((roster_config->>'BENCH')::INTEGER, 0)
  INTO roster_size;
  
  lineup_size := starters_count_val + rotation_count_val + bench_count_val;
  
  -- Validate lineup size doesn't exceed roster size
  IF lineup_size > roster_size THEN
    RAISE EXCEPTION 'Lineup size (%) cannot exceed roster size (%)', lineup_size, roster_size;
  END IF;

  -- Generate unique invite code
  LOOP
    invite_code_val := generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM leagues WHERE invite_code = invite_code_val);
  END LOOP;

  -- Create league
  INSERT INTO leagues (
    name, description, commissioner_id, max_teams, scoring_type, invite_code,
    salary_cap_enabled, salary_cap_amount, lineup_frequency, draft_date
  ) VALUES (
    league_name, league_description, auth.uid(), max_teams_count, scoring_type_val, invite_code_val,
    salary_cap_enabled_val, salary_cap_amount_val, lineup_frequency_val, draft_date_val
  ) RETURNING id INTO new_league_id;

  -- Create league settings with lineup configuration
  INSERT INTO league_settings (
    league_id,
    roster_positions,
    starters_count,
    starters_multiplier,
    rotation_count,
    rotation_multiplier,
    bench_count,
    bench_multiplier
  ) VALUES (
    new_league_id,
    roster_config,
    starters_count_val,
    starters_multiplier_val,
    rotation_count_val,
    rotation_multiplier_val,
    bench_count_val,
    bench_multiplier_val
  ) RETURNING id INTO new_settings_id;

  -- Add commissioner as league member
  INSERT INTO league_members (league_id, user_id, team_name, is_commissioner)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'), true);

  -- Create fantasy team for commissioner
  INSERT INTO fantasy_teams (league_id, user_id, team_name, is_commissioner)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'), true)
  RETURNING id INTO new_team_id;

  -- Create empty teams for remaining slots
  FOR i IN 2..max_teams_count LOOP
    INSERT INTO fantasy_teams (league_id, team_name, is_commissioner)
    VALUES (new_league_id, 'Team ' || i, false);
  END LOOP;

  -- Create roster spots based on configuration
  FOR position_name, position_count IN SELECT * FROM jsonb_each_text(roster_config) LOOP
    FOR i IN 1..position_count::INTEGER LOOP
      INSERT INTO roster_spots (
        league_id, position, position_order, is_starter, is_bench, is_injured_reserve
      ) VALUES (
        new_league_id, position_name, position_order,
        position_name != 'BENCH' AND position_name != 'IR',
        position_name = 'BENCH', position_name = 'IR'
      );
      position_order := position_order + 1;
    END LOOP;
  END LOOP;

  -- Create empty roster spots for all teams
  FOR team_rec IN SELECT id FROM fantasy_teams WHERE league_id = new_league_id LOOP
    FOR spot_rec IN SELECT id, position, is_starter FROM roster_spots WHERE league_id = new_league_id LOOP
      INSERT INTO fantasy_team_players (fantasy_team_id, roster_spot_id, position, is_starter, player_id)
      VALUES (team_rec.id, spot_rec.id, spot_rec.position, spot_rec.is_starter, NULL);
    END LOOP;
  END LOOP;

  -- Generate the league schedule
  IF max_teams_count >= 2 THEN
    PERFORM generate_league_schedule(
      new_league_id,
      22,
      6,
      3,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    );
  END IF;

  -- Generate draft order
  BEGIN
    PERFORM generate_draft_order(new_league_id, 15);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Draft order will be generated when teams are filled';
  END;

  RETURN new_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_league_with_commissioner TO authenticated;

COMMENT ON FUNCTION create_league_with_commissioner IS 'Creates a new league with commissioner, teams, roster spots, schedule, and lineup settings';

