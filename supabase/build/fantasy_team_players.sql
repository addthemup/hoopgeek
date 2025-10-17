-- =====================================================
-- FANTASY TEAM PLAYERS TABLE
-- =====================================================
-- This table stores the relationship between fantasy teams and players
-- Used by useRosterManagement hook for adding/removing players
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_team_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    roster_spot_id UUID REFERENCES roster_spots(id) ON DELETE SET NULL,
    
    -- Player Assignment (null when empty)
    player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    
    -- Player Status
    is_starter BOOLEAN DEFAULT false,
    is_bench BOOLEAN DEFAULT false,
    is_injured_reserve BOOLEAN DEFAULT false,
    is_taxi_squad BOOLEAN DEFAULT false,
    
    -- Acquisition Information
    acquired_via TEXT DEFAULT 'draft' CHECK (acquired_via IN ('draft', 'waiver', 'trade', 'free_agent')),
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(fantasy_team_id, roster_spot_id), -- One player per roster spot per team
    UNIQUE(fantasy_team_id, player_id) -- One instance of each player per team
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Fantasy Team Players Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_league_id ON fantasy_team_players(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_team_id ON fantasy_team_players(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_player_id ON fantasy_team_players(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_roster_spot_id ON fantasy_team_players(roster_spot_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_starter ON fantasy_team_players(is_starter);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_bench ON fantasy_team_players(is_bench);
CREATE INDEX IF NOT EXISTS idx_fantasy_team_players_injured_reserve ON fantasy_team_players(is_injured_reserve);

-- =====================================================
-- ROSTER SPOTS TABLE
-- =====================================================
-- This table defines the roster configuration for each league
-- =====================================================

CREATE TABLE IF NOT EXISTS roster_spots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    position TEXT NOT NULL, -- e.g., 'PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL', 'BENCH'
    position_order INTEGER NOT NULL, -- Order within the position
    is_required BOOLEAN DEFAULT true, -- Whether this spot must be filled
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, position, position_order)
);

-- =====================================================
-- INDEXES FOR ROSTER SPOTS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_roster_spots_league_id ON roster_spots(league_id);
CREATE INDEX IF NOT EXISTS idx_roster_spots_position ON roster_spots(position);
CREATE INDEX IF NOT EXISTS idx_roster_spots_order ON roster_spots(position_order);
