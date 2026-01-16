-- Create NBA Leaders Table
-- Stores season leaders for various statistical categories
-- Updated daily at 3 AM via cron job

CREATE TABLE IF NOT EXISTS public.nba_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.nba_players(id) ON DELETE CASCADE,
  nba_player_id INTEGER NOT NULL,
  team_id INTEGER REFERENCES public.nba_teams(team_id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL, -- e.g., 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', '3PT_PCT', 'FT_PCT'
  value DECIMAL(10,2) NOT NULL, -- The actual stat value
  rank INTEGER NOT NULL, -- Rank in this category (1 = leader)
  season VARCHAR(10) NOT NULL, -- e.g., "2024-25"
  games_played INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, category, season)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_nba_leaders_category_season ON public.nba_leaders(category, season, rank);
CREATE INDEX IF NOT EXISTS idx_nba_leaders_player_season ON public.nba_leaders(player_id, season);
CREATE INDEX IF NOT EXISTS idx_nba_leaders_nba_player_season ON public.nba_leaders(nba_player_id, season);
CREATE INDEX IF NOT EXISTS idx_nba_leaders_team_season ON public.nba_leaders(team_id, season);
CREATE INDEX IF NOT EXISTS idx_nba_leaders_updated_at ON public.nba_leaders(updated_at DESC);

-- Enable RLS
ALTER TABLE public.nba_leaders ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "nba_leaders_public_read" ON public.nba_leaders
  FOR SELECT
  USING (true);

-- Add comment
COMMENT ON TABLE public.nba_leaders IS 'NBA season statistical leaders updated daily at 3 AM';

