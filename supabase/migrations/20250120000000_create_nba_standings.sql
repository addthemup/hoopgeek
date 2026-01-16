-- Create NBA Standings Table
CREATE TABLE IF NOT EXISTS public.nba_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id INTEGER NOT NULL REFERENCES public.nba_teams(team_id) ON DELETE CASCADE,
  team_abbreviation VARCHAR(3) NOT NULL,
  team_name VARCHAR(100) NOT NULL,
  conference VARCHAR(10) NOT NULL CHECK (conference IN ('East', 'West')),
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  win_percentage DECIMAL(5,3) NOT NULL DEFAULT 0.000,
  games_behind DECIMAL(5,1) DEFAULT 0.0,
  conference_rank INTEGER NOT NULL,
  division VARCHAR(50),
  division_rank INTEGER,
  home_wins INTEGER DEFAULT 0,
  home_losses INTEGER DEFAULT 0,
  away_wins INTEGER DEFAULT 0,
  away_losses INTEGER DEFAULT 0,
  last_10_wins INTEGER DEFAULT 0,
  last_10_losses INTEGER DEFAULT 0,
  streak VARCHAR(10), -- e.g., "W3" or "L2"
  season VARCHAR(10) NOT NULL, -- e.g., "2024-25"
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, season)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_nba_standings_conference_season ON public.nba_standings(conference, season, conference_rank);
CREATE INDEX IF NOT EXISTS idx_nba_standings_team_season ON public.nba_standings(team_id, season);
CREATE INDEX IF NOT EXISTS idx_nba_standings_updated_at ON public.nba_standings(updated_at DESC);

-- Enable RLS
ALTER TABLE public.nba_standings ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "nba_standings_public_read" ON public.nba_standings
  FOR SELECT
  USING (true);

-- Function to update standings (called by cron job)
CREATE OR REPLACE FUNCTION public.update_nba_standings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function will be called by the cron job
  -- The actual data insertion will happen via the Edge Function
  RAISE NOTICE 'update_nba_standings function called';
END;
$$;

-- Add comment
COMMENT ON TABLE public.nba_standings IS 'NBA team standings updated daily at 3 AM';

