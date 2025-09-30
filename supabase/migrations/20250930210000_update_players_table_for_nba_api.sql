-- Update players table to match NBA API data structure
-- Drop existing table and recreate with proper schema
DROP TABLE IF EXISTS players CASCADE;

-- Create players table with NBA API fields
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  nba_player_id INTEGER UNIQUE NOT NULL, -- NBA API player ID
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  position TEXT,
  team_id INTEGER, -- NBA API team ID
  team_name TEXT,
  team_abbreviation TEXT,
  jersey_number TEXT,
  height TEXT, -- e.g., "6-8"
  weight INTEGER, -- in pounds
  age INTEGER,
  birth_date DATE,
  birth_city TEXT,
  birth_state TEXT,
  birth_country TEXT,
  college TEXT,
  draft_year INTEGER,
  draft_round INTEGER,
  draft_number INTEGER,
  salary BIGINT DEFAULT 0, -- Current season salary
  is_active BOOLEAN DEFAULT true,
  is_rookie BOOLEAN DEFAULT false,
  years_pro INTEGER DEFAULT 0,
  from_year INTEGER, -- First year in NBA
  to_year INTEGER, -- Last year in NBA (null if active)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_players_nba_id ON players(nba_player_id);
CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_team_name ON players(team_name);
CREATE INDEX idx_players_salary ON players(salary);
CREATE INDEX idx_players_active ON players(is_active);
CREATE INDEX idx_players_draft_year ON players(draft_year);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read players
CREATE POLICY "Allow all users to read players" ON players
  FOR SELECT USING (true);

-- Create policy to allow service role to manage players (for imports)
CREATE POLICY "Allow service role to manage players" ON players
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to upsert players (insert or update)
CREATE OR REPLACE FUNCTION upsert_player(
  p_nba_player_id INTEGER,
  p_name TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_position TEXT DEFAULT NULL,
  p_team_id INTEGER DEFAULT NULL,
  p_team_name TEXT DEFAULT NULL,
  p_team_abbreviation TEXT DEFAULT NULL,
  p_jersey_number TEXT DEFAULT NULL,
  p_height TEXT DEFAULT NULL,
  p_weight INTEGER DEFAULT NULL,
  p_age INTEGER DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_birth_city TEXT DEFAULT NULL,
  p_birth_state TEXT DEFAULT NULL,
  p_birth_country TEXT DEFAULT NULL,
  p_college TEXT DEFAULT NULL,
  p_draft_year INTEGER DEFAULT NULL,
  p_draft_round INTEGER DEFAULT NULL,
  p_draft_number INTEGER DEFAULT NULL,
  p_salary BIGINT DEFAULT 0,
  p_is_active BOOLEAN DEFAULT true,
  p_is_rookie BOOLEAN DEFAULT false,
  p_years_pro INTEGER DEFAULT 0,
  p_from_year INTEGER DEFAULT NULL,
  p_to_year INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  player_id INTEGER;
BEGIN
  INSERT INTO players (
    nba_player_id, name, first_name, last_name, position, team_id, team_name,
    team_abbreviation, jersey_number, height, weight, age, birth_date,
    birth_city, birth_state, birth_country, college, draft_year, draft_round,
    draft_number, salary, is_active, is_rookie, years_pro, from_year, to_year
  ) VALUES (
    p_nba_player_id, p_name, p_first_name, p_last_name, p_position, p_team_id, p_team_name,
    p_team_abbreviation, p_jersey_number, p_height, p_weight, p_age, p_birth_date,
    p_birth_city, p_birth_state, p_birth_country, p_college, p_draft_year, p_draft_round,
    p_draft_number, p_salary, p_is_active, p_is_rookie, p_years_pro, p_from_year, p_to_year
  )
  ON CONFLICT (nba_player_id) 
  DO UPDATE SET
    name = EXCLUDED.name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    position = EXCLUDED.position,
    team_id = EXCLUDED.team_id,
    team_name = EXCLUDED.team_name,
    team_abbreviation = EXCLUDED.team_abbreviation,
    jersey_number = EXCLUDED.jersey_number,
    height = EXCLUDED.height,
    weight = EXCLUDED.weight,
    age = EXCLUDED.age,
    birth_date = EXCLUDED.birth_date,
    birth_city = EXCLUDED.birth_city,
    birth_state = EXCLUDED.birth_state,
    birth_country = EXCLUDED.birth_country,
    college = EXCLUDED.college,
    draft_year = EXCLUDED.draft_year,
    draft_round = EXCLUDED.draft_round,
    draft_number = EXCLUDED.draft_number,
    salary = EXCLUDED.salary,
    is_active = EXCLUDED.is_active,
    is_rookie = EXCLUDED.is_rookie,
    years_pro = EXCLUDED.years_pro,
    from_year = EXCLUDED.from_year,
    to_year = EXCLUDED.to_year,
    updated_at = NOW()
  RETURNING id INTO player_id;
  
  RETURN player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION upsert_player TO service_role;
