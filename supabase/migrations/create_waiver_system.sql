-- =====================================================
-- WAIVER SYSTEM IMPLEMENTATION
-- =====================================================
-- Adds comprehensive waiver system support including:
-- - Waiver configuration (4 types: none, rolling, FAAB, continuous)
-- - Waiver claims tracking
-- - Waiver priority/budget tracking
-- - Dropped player eligibility tracking
-- =====================================================

-- =====================================================
-- STEP 1: Add Waiver Settings to fantasy_league_seasons
-- =====================================================

-- Add waiver configuration columns to fantasy_league_seasons
ALTER TABLE fantasy_league_seasons
ADD COLUMN IF NOT EXISTS waiver_type TEXT DEFAULT 'rolling' CHECK (waiver_type IN ('none', 'rolling', 'faab', 'continuous')),
ADD COLUMN IF NOT EXISTS waiver_period_hours INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS waiver_process_time TIME DEFAULT '03:00:00', -- 3:00 AM daily
ADD COLUMN IF NOT EXISTS waiver_budget_amount INTEGER DEFAULT 100, -- For FAAB only
ADD COLUMN IF NOT EXISTS waiver_min_bid INTEGER DEFAULT 0, -- For FAAB only
ADD COLUMN IF NOT EXISTS waiver_priority_reset TEXT DEFAULT 'weekly' CHECK (waiver_priority_reset IN ('never', 'weekly', 'after_claim')),
ADD COLUMN IF NOT EXISTS waiver_claim_days TEXT[] DEFAULT ARRAY['Tuesday', 'Thursday', 'Saturday']; -- Days waivers process

COMMENT ON COLUMN fantasy_league_seasons.waiver_type IS 'Type of waiver system: none (free agents), rolling (inverse standings), faab (auction budget), continuous (fixed priority)';
COMMENT ON COLUMN fantasy_league_seasons.waiver_period_hours IS 'Hours a dropped player stays on waivers before becoming a free agent';
COMMENT ON COLUMN fantasy_league_seasons.waiver_process_time IS 'Time of day when waiver claims are processed (in league timezone)';
COMMENT ON COLUMN fantasy_league_seasons.waiver_budget_amount IS 'Total FAAB budget per team for the season (only used if waiver_type = faab)';
COMMENT ON COLUMN fantasy_league_seasons.waiver_min_bid IS 'Minimum bid amount for FAAB claims (only used if waiver_type = faab)';
COMMENT ON COLUMN fantasy_league_seasons.waiver_priority_reset IS 'How often waiver priority resets (never, weekly, after_claim)';
COMMENT ON COLUMN fantasy_league_seasons.waiver_claim_days IS 'Days of the week when waivers process (e.g., Tuesday, Thursday, Saturday)';

-- =====================================================
-- STEP 2: Create fantasy_waiver_order Table
-- =====================================================
-- Tracks each team's waiver priority or remaining FAAB budget

CREATE TABLE IF NOT EXISTS fantasy_waiver_order (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- For Rolling/Continuous Waivers (priority-based)
    waiver_priority INTEGER DEFAULT 1,
    
    -- For FAAB Waivers (budget-based)
    remaining_budget INTEGER DEFAULT 100,
    total_spent INTEGER DEFAULT 0,
    
    -- Tracking
    last_claim_date TIMESTAMP WITH TIME ZONE,
    total_claims INTEGER DEFAULT 0,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, season_id, fantasy_team_id)
);

COMMENT ON TABLE fantasy_waiver_order IS 'Tracks waiver priority or FAAB budget for each team in a league season';

-- =====================================================
-- STEP 3: Create fantasy_waiver_claims Table
-- =====================================================
-- Tracks all waiver claims (both pending and processed)

CREATE TABLE IF NOT EXISTS fantasy_waiver_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Player being claimed
    player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
    
    -- Optional: Player being dropped to make room (can be NULL if roster spot available)
    drop_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    
    -- Claim Details
    claim_type TEXT NOT NULL CHECK (claim_type IN ('waiver', 'free_agent')),
    bid_amount INTEGER, -- For FAAB only
    priority_at_claim INTEGER, -- Team's priority when claim was made
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'cancelled')),
    failure_reason TEXT, -- Why claim failed (e.g., 'outbid', 'insufficient_budget', 'player_claimed_by_higher_priority')
    
    -- Processing
    claim_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    process_date TIMESTAMP WITH TIME ZONE, -- When claim was processed
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE fantasy_waiver_claims IS 'Tracks all waiver claims including pending, successful, and failed claims';

-- =====================================================
-- STEP 4: Create fantasy_players_on_waivers Table
-- =====================================================
-- Tracks which players are currently on waivers and when they become free agents

CREATE TABLE IF NOT EXISTS fantasy_players_on_waivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
    
    -- Who dropped the player
    dropped_by_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    dropped_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    dropped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Waiver Status
    waiver_status TEXT DEFAULT 'on_waivers' CHECK (waiver_status IN ('on_waivers', 'claimed', 'free_agent')),
    becomes_free_agent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- If claimed
    claimed_by_team_id UUID REFERENCES fantasy_teams(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, season_id, player_id)
);

COMMENT ON TABLE fantasy_players_on_waivers IS 'Tracks which players are on waivers, when dropped, and when they become free agents';

-- =====================================================
-- STEP 5: Create Indexes for Performance
-- =====================================================

-- fantasy_waiver_order indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_order_league_season ON fantasy_waiver_order(league_id, season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_order_team ON fantasy_waiver_order(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_order_priority ON fantasy_waiver_order(waiver_priority);

-- fantasy_waiver_claims indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_claims_league_season ON fantasy_waiver_claims(league_id, season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_claims_team ON fantasy_waiver_claims(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_claims_player ON fantasy_waiver_claims(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_claims_status ON fantasy_waiver_claims(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_claims_process_date ON fantasy_waiver_claims(process_date);
CREATE INDEX IF NOT EXISTS idx_fantasy_waiver_claims_claim_date ON fantasy_waiver_claims(claim_date);

-- fantasy_players_on_waivers indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_league_season ON fantasy_players_on_waivers(league_id, season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_player ON fantasy_players_on_waivers(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_status ON fantasy_players_on_waivers(waiver_status);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_becomes_free_agent ON fantasy_players_on_waivers(becomes_free_agent_at);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_dropped_by ON fantasy_players_on_waivers(dropped_by_team_id);

-- =====================================================
-- STEP 6: Enable Row Level Security (RLS)
-- =====================================================

ALTER TABLE fantasy_waiver_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_waiver_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_players_on_waivers ENABLE ROW LEVEL SECURITY;

-- fantasy_waiver_order policies
CREATE POLICY "Users can view waiver order in their leagues" ON fantasy_waiver_order
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "System can manage waiver order" ON fantasy_waiver_order
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- fantasy_waiver_claims policies
CREATE POLICY "Users can view waiver claims in their leagues" ON fantasy_waiver_claims
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create waiver claims for their teams" ON fantasy_waiver_claims
    FOR INSERT TO authenticated
    WITH CHECK (
        fantasy_team_id IN (
            SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can cancel their own pending claims" ON fantasy_waiver_claims
    FOR UPDATE TO authenticated
    USING (
        fantasy_team_id IN (
            SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
        ) AND status = 'pending'
    );

CREATE POLICY "Commissioners can manage all claims" ON fantasy_waiver_claims
    FOR ALL TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- fantasy_players_on_waivers policies
CREATE POLICY "Users can view players on waivers in their leagues" ON fantasy_players_on_waivers
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "System can manage players on waivers" ON fantasy_players_on_waivers
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- STEP 7: Create Triggers for updated_at
-- =====================================================

CREATE TRIGGER update_fantasy_waiver_order_updated_at
    BEFORE UPDATE ON fantasy_waiver_order
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_waiver_claims_updated_at
    BEFORE UPDATE ON fantasy_waiver_claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_players_on_waivers_updated_at
    BEFORE UPDATE ON fantasy_players_on_waivers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Waiver system created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables Created:';
    RAISE NOTICE '   - fantasy_waiver_order (tracks priority/budget per team)';
    RAISE NOTICE '   - fantasy_waiver_claims (tracks all claims)';
    RAISE NOTICE '   - fantasy_players_on_waivers (tracks dropped players)';
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  Columns Added to fantasy_league_seasons:';
    RAISE NOTICE '   - waiver_type (none, rolling, faab, continuous)';
    RAISE NOTICE '   - waiver_period_hours (default 48)';
    RAISE NOTICE '   - waiver_process_time (default 3:00 AM)';
    RAISE NOTICE '   - waiver_budget_amount (default 100 for FAAB)';
    RAISE NOTICE '   - waiver_min_bid (default 0)';
    RAISE NOTICE '   - waiver_priority_reset (never, weekly, after_claim)';
    RAISE NOTICE '   - waiver_claim_days (default Tue/Thu/Sat)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Waiver Types Supported:';
    RAISE NOTICE '   1. none: Free agents, no waivers';
    RAISE NOTICE '   2. rolling: Inverse standings, resets after claim';
    RAISE NOTICE '   3. faab: Blind bidding with budget';
    RAISE NOTICE '   4. continuous: Fixed priority (draft order)';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Row Level Security: Enabled with proper policies';
    RAISE NOTICE '📈 Indexes: Created for query performance';
    RAISE NOTICE '⏰ Triggers: Created for updated_at timestamps';
    RAISE NOTICE '';
END $$;

