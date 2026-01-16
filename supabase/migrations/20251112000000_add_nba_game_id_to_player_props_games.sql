-- ============================================================================
-- ADD NBA_GAME_ID TO PLAYER_PROPS_GAMES
-- ============================================================================
-- Links player_props_games to nba_games for easier querying
-- ============================================================================

-- Add nba_game_id column to link to nba_games
ALTER TABLE public.player_props_games
ADD COLUMN IF NOT EXISTS nba_game_id VARCHAR(50);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_props_games_nba_game_id 
ON player_props_games(nba_game_id) 
WHERE nba_game_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN player_props_games.nba_game_id IS 'Links to nba_games.game_id for joining with game data';

