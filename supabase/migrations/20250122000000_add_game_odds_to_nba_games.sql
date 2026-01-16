-- ============================================================================
-- ADD GAME ODDS TO NBA_GAMES TABLE
-- ============================================================================
-- Adds columns to nba_games table for storing betting odds and spread data
-- from NBA API live endpoints
-- ============================================================================

-- Add odds and spread columns to nba_games table
ALTER TABLE public.nba_games
ADD COLUMN IF NOT EXISTS home_spread NUMERIC(5, 1),
ADD COLUMN IF NOT EXISTS away_spread NUMERIC(5, 1),
ADD COLUMN IF NOT EXISTS over_under NUMERIC(5, 1),
ADD COLUMN IF NOT EXISTS home_moneyline INTEGER,
ADD COLUMN IF NOT EXISTS away_moneyline INTEGER,
ADD COLUMN IF NOT EXISTS odds_source TEXT DEFAULT 'nba_api',
ADD COLUMN IF NOT EXISTS odds_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS raw_odds_data JSONB; -- Store full odds data for reference

-- Add index for odds queries
CREATE INDEX IF NOT EXISTS idx_nba_games_odds_updated ON nba_games(odds_updated_at DESC) WHERE odds_updated_at IS NOT NULL;

-- Add comment to columns
COMMENT ON COLUMN public.nba_games.home_spread IS 'Point spread for home team (negative means home team is favored)';
COMMENT ON COLUMN public.nba_games.away_spread IS 'Point spread for away team (positive means away team is underdog)';
COMMENT ON COLUMN public.nba_games.over_under IS 'Total points over/under line';
COMMENT ON COLUMN public.nba_games.home_moneyline IS 'Moneyline odds for home team (e.g., -150)';
COMMENT ON COLUMN public.nba_games.away_moneyline IS 'Moneyline odds for away team (e.g., +130)';
COMMENT ON COLUMN public.nba_games.odds_source IS 'Source of odds data (e.g., nba_api, sportsbook)';
COMMENT ON COLUMN public.nba_games.odds_updated_at IS 'Timestamp when odds were last updated';
COMMENT ON COLUMN public.nba_games.raw_odds_data IS 'Full JSON response from odds API for reference';

