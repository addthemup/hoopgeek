-- =====================================================
-- FANTASY SEASON WEEKS TABLE
-- =====================================================
-- Defines the weekly structure for fantasy basketball seasons
-- Used by Lineups.tsx and future schedule generation
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_season_weeks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Season Information
    season_year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    week_name TEXT NOT NULL,
    
    -- Week Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Week Type Classification
    is_regular_season BOOLEAN DEFAULT true,
    is_playoff_week BOOLEAN DEFAULT false,
    playoff_round INTEGER, -- 1, 2, 3, etc. for playoff rounds
    
    -- Week Status
    is_active BOOLEAN DEFAULT true,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(season_year, week_number)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_fantasy_season_weeks_season_year ON fantasy_season_weeks(season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_season_weeks_week_number ON fantasy_season_weeks(week_number);
CREATE INDEX IF NOT EXISTS idx_fantasy_season_weeks_is_active ON fantasy_season_weeks(is_active);
CREATE INDEX IF NOT EXISTS idx_fantasy_season_weeks_is_regular_season ON fantasy_season_weeks(is_regular_season);
CREATE INDEX IF NOT EXISTS idx_fantasy_season_weeks_is_playoff_week ON fantasy_season_weeks(is_playoff_week);
CREATE INDEX IF NOT EXISTS idx_fantasy_season_weeks_dates ON fantasy_season_weeks(start_date, end_date);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE fantasy_season_weeks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read season weeks
CREATE POLICY "Allow authenticated users to read season weeks" ON fantasy_season_weeks
    FOR SELECT TO authenticated
    USING (true);

-- Only service role can manage season weeks
CREATE POLICY "Allow service role to manage season weeks" ON fantasy_season_weeks
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create trigger for updated_at
CREATE TRIGGER update_fantasy_season_weeks_updated_at
    BEFORE UPDATE ON fantasy_season_weeks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2025-26 NBA SEASON DATA
-- =====================================================

INSERT INTO fantasy_season_weeks (season_year, week_number, week_name, start_date, end_date, is_regular_season, is_playoff_week, playoff_round, is_active) VALUES
(2025, 0, 'Preseason', '2025-10-02', '2025-10-20', false, false, NULL, true),
(2025, 1, 'Week 1', '2025-10-21', '2025-10-26', true, false, NULL, true),
(2025, 2, 'Week 2', '2025-10-27', '2025-11-02', true, false, NULL, true),
(2025, 3, 'Week 3', '2025-11-03', '2025-11-09', true, false, NULL, true),
(2025, 4, 'Week 4', '2025-11-10', '2025-11-16', true, false, NULL, true),
(2025, 5, 'Week 5', '2025-11-17', '2025-11-23', true, false, NULL, true),
(2025, 6, 'Week 6', '2025-11-24', '2025-11-30', true, false, NULL, true),
(2025, 7, 'Week 7', '2025-12-01', '2025-12-07', true, false, NULL, true),
(2025, 8, 'Week 8', '2025-12-08', '2025-12-14', true, false, NULL, true),
(2025, 9, 'Week 9', '2025-12-15', '2025-12-21', true, false, NULL, true),
(2025, 10, 'Week 10', '2025-12-22', '2025-12-28', true, false, NULL, true),
(2025, 11, 'Week 11', '2025-12-29', '2026-01-04', true, false, NULL, true),
(2025, 12, 'Week 12', '2026-01-05', '2026-01-11', true, false, NULL, true),
(2025, 13, 'Week 13', '2026-01-12', '2026-01-18', true, false, NULL, true),
(2025, 14, 'Week 14', '2026-01-19', '2026-01-25', true, false, NULL, true),
(2025, 15, 'Week 15', '2026-01-26', '2026-02-01', true, false, NULL, true),
(2025, 16, 'Week 16', '2026-02-02', '2026-02-08', true, false, NULL, true),
(2025, 17, 'Week 17', '2026-02-09', '2026-02-15', true, false, NULL, true),
(2025, 18, 'Week 18', '2026-02-16', '2026-02-22', true, false, NULL, true),
(2025, 19, 'Week 19', '2026-02-23', '2026-03-01', true, false, NULL, true),
(2025, 20, 'Week 20', '2026-03-02', '2026-03-08', true, false, NULL, true),
(2025, 21, 'Week 21', '2026-03-09', '2026-03-15', true, false, NULL, true),
(2025, 22, 'Week 22', '2026-03-16', '2026-03-22', true, false, NULL, true),
(2025, 23, 'Week 23', '2026-03-23', '2026-03-29', true, false, NULL, true),
(2025, 24, 'Week 24', '2026-03-30', '2026-04-05', true, false, NULL, true),
(2025, 25, 'Week 25', '2026-04-06', '2026-04-12', true, false, NULL, true);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fantasy Season Weeks table created successfully!';
    RAISE NOTICE '✅ 2025-26 NBA season data inserted (26 weeks total)';
    RAISE NOTICE '✅ Week 0: Preseason (Oct 2-20, 2025)';
    RAISE NOTICE '✅ Weeks 1-25: Regular Season (Oct 21, 2025 - Apr 12, 2026)';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support Lineups.tsx and future schedule generation';
    RAISE NOTICE '📋 Features: Preseason sandbox, regular season weeks, playoff structure';
    RAISE NOTICE '🔄 Schedule generation: Will use this data to create matchups';
    RAISE NOTICE '🏀 Lineups tool: Supports preseason mock matchups with no consequences';
    RAISE NOTICE '';
END $$;
