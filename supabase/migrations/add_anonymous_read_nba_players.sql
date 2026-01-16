-- Add anonymous read access for nba_players and nba_boxscores tables
-- This allows unauthenticated users to search for players and view game logs

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous users to read nba_players" ON nba_players;
DROP POLICY IF EXISTS "Allow anonymous users to read nba_boxscores" ON nba_boxscores;

-- Create policy to allow anonymous users to read NBA players data
CREATE POLICY "Allow anonymous users to read nba_players" ON nba_players
    FOR SELECT TO anon
    USING (true);

-- Create policy to allow anonymous users to read NBA box scores data
CREATE POLICY "Allow anonymous users to read nba_boxscores" ON nba_boxscores
    FOR SELECT TO anon
    USING (true);

-- Note: These policies work alongside the existing "Allow authenticated users to read" policies
-- Both authenticated and anonymous users can now read player and game log data

