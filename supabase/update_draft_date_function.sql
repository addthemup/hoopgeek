-- Update the create_league_with_commissioner function to include draft_date parameter

-- Drop the old function first to avoid conflicts
DROP FUNCTION IF EXISTS create_league_with_commissioner(TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, BIGINT, TEXT, JSONB) CASCADE;

-- Create function to create league with commissioner
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
  draft_date_val TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_league_id UUID;
  new_team_id UUID;
  invite_code_val TEXT;
  position_key TEXT;
  position_count INTEGER;
  i INTEGER;
BEGIN
  -- Generate unique invite code
  LOOP
    invite_code_val := generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM leagues WHERE invite_code = invite_code_val);
  END LOOP;

  -- Create league
  INSERT INTO leagues (
    name, 
    description, 
    commissioner_id, 
    max_teams, 
    scoring_type, 
    invite_code,
    salary_cap_enabled,
    salary_cap_amount,
    lineup_frequency,
    draft_date
  )
  VALUES (
    league_name, 
    league_description, 
    auth.uid(), 
    max_teams_count, 
    scoring_type_val, 
    invite_code_val,
    salary_cap_enabled_val,
    salary_cap_amount_val,
    lineup_frequency_val,
    draft_date_val
  )
  RETURNING id INTO new_league_id;

  -- Add commissioner as league member
  INSERT INTO league_members (league_id, user_id, team_name, is_commissioner)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'), true);

  -- Get the commissioner's team ID
  SELECT id INTO new_team_id FROM fantasy_teams WHERE league_id = new_league_id AND user_id = auth.uid();

  -- Create roster spots based on configuration
  FOR position_key, position_count IN SELECT * FROM jsonb_each_text(roster_config)
  LOOP
    FOR i IN 1..position_count::INTEGER
    LOOP
      INSERT INTO roster_spots (league_id, position, position_order)
      VALUES (new_league_id, position_key, i);
    END LOOP;
  END LOOP;

  -- Generate league schedule
  PERFORM generate_league_schedule(new_league_id, max_teams_count);

  RETURN new_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
