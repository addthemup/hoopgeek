-- =====================================================
-- FANTASY LEAGUES TABLE (Base League Info)
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_leagues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Basic League Information
    name TEXT NOT NULL,
    description TEXT,
    commissioner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- League Branding
    logo_url TEXT, -- External image URL for league logo
    logo_upload_id UUID, -- Reference to uploaded image in storage
    colors JSONB DEFAULT '{"primary": "#1D428A", "secondary": "#FFC72C"}', -- League color scheme
    
    -- League Type
    league_type TEXT DEFAULT 'redraft' CHECK (league_type IN ('redraft', 'dynasty', 'keeper')),
    
    -- League Configuration (rarely changes)
    max_teams INTEGER NOT NULL DEFAULT 12,
    draft_type TEXT DEFAULT 'snake' CHECK (draft_type IN ('snake', 'linear', 'auction')),
    draft_rounds INTEGER DEFAULT 15,
    
    -- League Settings (rarely changes)
    scoring_type TEXT DEFAULT 'H2H_Weekly' CHECK (scoring_type IN ('H2H_Weekly', 'H2H_Daily', 'Points', 'Roto')),
    fantasy_scoring_format TEXT DEFAULT 'FanDuel' CHECK (fantasy_scoring_format IN ('FanDuel', 'DraftKings', 'Yahoo', 'ESPN', 'Custom')),
    lineup_frequency TEXT DEFAULT 'weekly' CHECK (lineup_frequency IN ('daily', 'weekly')),
    
    -- Salary Cap (base setting, can be overridden per season)
    salary_cap_enabled BOOLEAN DEFAULT true,
    
    -- Additional Settings
    trades_enabled BOOLEAN DEFAULT true,
    public_league BOOLEAN DEFAULT false,
    
    -- System Fields
    invite_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FANTASY LEAGUE SEASONS TABLE (Season-Specific Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_league_seasons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_year INTEGER NOT NULL,
    
    -- Season Status (truly season-specific)
    is_active BOOLEAN DEFAULT true,
    season_status TEXT DEFAULT 'upcoming' CHECK (season_status IN ('upcoming', 'active', 'completed', 'cancelled')),
    
    -- Season-Specific Team Info
    current_teams INTEGER DEFAULT 0,
    
    -- Season-Specific Draft Info (changes each season)
    draft_date TIMESTAMP WITH TIME ZONE,
    draft_status TEXT DEFAULT 'scheduled' CHECK (draft_status IN ('scheduled', 'in_progress', 'completed')),
    
    -- Season-Specific Trade Info
    trade_deadline DATE,
    
    -- Season-Specific Roster Configuration (can change year to year)
    roster_positions JSONB DEFAULT '{"G": 4, "F": 4, "C": 2, "UTIL": 5}',
    
    -- Season-Specific Weekly Lineup Configuration (can change year to year)
    starters_count INTEGER DEFAULT 5,
    starters_multiplier DECIMAL DEFAULT 1.0,
    rotation_count INTEGER DEFAULT 5,
    rotation_multiplier DECIMAL DEFAULT 0.75,
    bench_count INTEGER DEFAULT 3,
    bench_multiplier DECIMAL DEFAULT 0.5,
    
    -- Season-Specific Position Unit Assignment (can change year to year)
    position_unit_assignments JSONB DEFAULT '{"starters": {}, "rotation": {}, "bench": {}}',
    
    -- Season-Specific Salary Cap (can change year to year)
    salary_cap_amount BIGINT DEFAULT 200000000,
    
    -- Season-Specific Playoffs (can change year to year)
    playoff_teams INTEGER DEFAULT 6,
    playoff_weeks INTEGER DEFAULT 3,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, season_year)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Fantasy Leagues Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_commissioner_id ON fantasy_leagues(commissioner_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_invite_code ON fantasy_leagues(invite_code);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_logo_upload_id ON fantasy_leagues(logo_upload_id);

-- Fantasy League Seasons Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_league_seasons_league_id ON fantasy_league_seasons(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_league_seasons_season_year ON fantasy_league_seasons(season_year);
CREATE INDEX IF NOT EXISTS idx_fantasy_league_seasons_active ON fantasy_league_seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_fantasy_league_seasons_status ON fantasy_league_seasons(season_status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE fantasy_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_league_seasons ENABLE ROW LEVEL SECURITY;

-- Fantasy Leagues Policies
CREATE POLICY "Users can view leagues they created" ON fantasy_leagues
    FOR SELECT TO authenticated
    USING (commissioner_id = auth.uid());

CREATE POLICY "Users can create leagues" ON fantasy_leagues
    FOR INSERT TO authenticated
    WITH CHECK (commissioner_id = auth.uid());

CREATE POLICY "Commissioners can update their leagues" ON fantasy_leagues
    FOR UPDATE TO authenticated
    USING (commissioner_id = auth.uid());

CREATE POLICY "Commissioners can delete their leagues" ON fantasy_leagues
    FOR DELETE TO authenticated
    USING (commissioner_id = auth.uid());

-- Fantasy League Seasons Policies
CREATE POLICY "Users can view seasons in their leagues" ON fantasy_league_seasons
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

CREATE POLICY "Commissioners can manage seasons" ON fantasy_league_seasons
    FOR ALL TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_fantasy_leagues_updated_at
    BEFORE UPDATE ON fantasy_leagues
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_league_seasons_updated_at
    BEFORE UPDATE ON fantasy_league_seasons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fantasy Leagues system created successfully!';
    RAISE NOTICE '✅ Tables: fantasy_leagues, fantasy_league_seasons';
    RAISE NOTICE '✅ League branding: logo_url, logo_upload_id, colors (JSONB)';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support Dashboard at http://localhost:3000/fantasy';
    RAISE NOTICE '📅 Dynasty league support: Each season is stored separately';
    RAISE NOTICE '🎨 League branding: Custom logos and color schemes supported';
    RAISE NOTICE '';
END $$;
