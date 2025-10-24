-- Add waiver-related columns to fantasy_league_seasons table
-- These columns are needed for the waiver system to work properly

-- Add waiver columns if they don't exist
DO $$ 
BEGIN
    -- Add waiver_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_league_seasons' 
        AND column_name = 'waiver_type'
    ) THEN
        ALTER TABLE fantasy_league_seasons
        ADD COLUMN waiver_type TEXT DEFAULT 'rolling' CHECK (waiver_type IN ('none', 'rolling', 'faab', 'continuous'));
        
        COMMENT ON COLUMN fantasy_league_seasons.waiver_type IS 'Type of waiver system: none, rolling, faab, or continuous';
    END IF;

    -- Add waiver_period_hours column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_league_seasons' 
        AND column_name = 'waiver_period_hours'
    ) THEN
        ALTER TABLE fantasy_league_seasons
        ADD COLUMN waiver_period_hours INTEGER DEFAULT 48 CHECK (waiver_period_hours >= 0 AND waiver_period_hours <= 168);
        
        COMMENT ON COLUMN fantasy_league_seasons.waiver_period_hours IS 'Number of hours a dropped player stays on waivers';
    END IF;

    -- Add faab_budget column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_league_seasons' 
        AND column_name = 'faab_budget'
    ) THEN
        ALTER TABLE fantasy_league_seasons
        ADD COLUMN faab_budget INTEGER;
        
        COMMENT ON COLUMN fantasy_league_seasons.faab_budget IS 'FAAB budget for each team (only used if waiver_type is faab)';
    END IF;

    -- Add waiver_processing_day column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_league_seasons' 
        AND column_name = 'waiver_processing_day'
    ) THEN
        ALTER TABLE fantasy_league_seasons
        ADD COLUMN waiver_processing_day INTEGER DEFAULT 3 CHECK (waiver_processing_day >= 0 AND waiver_processing_day <= 6);
        
        COMMENT ON COLUMN fantasy_league_seasons.waiver_processing_day IS 'Day of week when waivers process (0=Sunday, 6=Saturday)';
    END IF;

    -- Add waiver_processing_time column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_league_seasons' 
        AND column_name = 'waiver_processing_time'
    ) THEN
        ALTER TABLE fantasy_league_seasons
        ADD COLUMN waiver_processing_time TIME DEFAULT '03:00:00';
        
        COMMENT ON COLUMN fantasy_league_seasons.waiver_processing_time IS 'Time of day when waivers process';
    END IF;

    -- Add waiver_order_reset_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_league_seasons' 
        AND column_name = 'waiver_order_reset_type'
    ) THEN
        ALTER TABLE fantasy_league_seasons
        ADD COLUMN waiver_order_reset_type TEXT DEFAULT 'weekly_inverse_standings' 
        CHECK (waiver_order_reset_type IN ('never', 'weekly_inverse_standings', 'continual_rolling'));
        
        COMMENT ON COLUMN fantasy_league_seasons.waiver_order_reset_type IS 'How waiver order resets: never, weekly_inverse_standings, or continual_rolling';
    END IF;

    -- Add waiver_order_tie_breaker column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_league_seasons' 
        AND column_name = 'waiver_order_tie_breaker'
    ) THEN
        ALTER TABLE fantasy_league_seasons
        ADD COLUMN waiver_order_tie_breaker TEXT DEFAULT 'points_scored' 
        CHECK (waiver_order_tie_breaker IN ('points_scored', 'points_against', 'random'));
        
        COMMENT ON COLUMN fantasy_league_seasons.waiver_order_tie_breaker IS 'How to break ties in waiver order: points_scored, points_against, or random';
    END IF;

END $$;

-- Set default values for existing leagues that don't have waiver settings
UPDATE fantasy_league_seasons
SET 
    waiver_type = COALESCE(waiver_type, 'rolling'),
    waiver_period_hours = COALESCE(waiver_period_hours, 48),
    waiver_processing_day = COALESCE(waiver_processing_day, 3),
    waiver_processing_time = COALESCE(waiver_processing_time, '03:00:00'::TIME),
    waiver_order_reset_type = COALESCE(waiver_order_reset_type, 'weekly_inverse_standings'),
    waiver_order_tie_breaker = COALESCE(waiver_order_tie_breaker, 'points_scored')
WHERE 
    waiver_type IS NULL 
    OR waiver_period_hours IS NULL 
    OR waiver_processing_day IS NULL 
    OR waiver_processing_time IS NULL
    OR waiver_order_reset_type IS NULL
    OR waiver_order_tie_breaker IS NULL;

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'fantasy_league_seasons' 
AND column_name IN (
    'waiver_type', 
    'waiver_period_hours', 
    'faab_budget',
    'waiver_processing_day',
    'waiver_processing_time',
    'waiver_order_reset_type',
    'waiver_order_tie_breaker'
)
ORDER BY column_name;

