-- =====================================================
-- FANTASY TRANSACTIONS TABLE
-- =====================================================
-- Creates the fantasy_transactions table if it doesn't exist
-- This table tracks 'add' and 'cut' transactions for player movements
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    
    -- Transaction Type (only 'add' and 'cut')
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('add', 'cut')),
    
    -- Transaction Status
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    
    -- Team making the transaction
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Player being added or cut
    player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
    
    -- Transaction Details
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_league_id ON fantasy_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_season_id ON fantasy_transactions(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_fantasy_team_id ON fantasy_transactions(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_player_id ON fantasy_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_type ON fantasy_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_status ON fantasy_transactions(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_date ON fantasy_transactions(transaction_date);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE fantasy_transactions IS 'Tracks add and cut transactions for fantasy league player movements';
COMMENT ON COLUMN fantasy_transactions.transaction_type IS 'Type of transaction: add (player added to roster) or cut (player dropped from roster)';
COMMENT ON COLUMN fantasy_transactions.status IS 'Status of transaction: pending, completed, or cancelled';
COMMENT ON COLUMN fantasy_transactions.processed_by IS 'User ID of the user who processed the transaction (usually the team owner)';

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE fantasy_transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to view transactions in leagues they're members of
CREATE POLICY "Users can view transactions in their leagues"
ON fantasy_transactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.id = fantasy_transactions.fantasy_team_id
        AND ft.league_id = fantasy_transactions.league_id
        AND EXISTS (
            SELECT 1 FROM fantasy_league_members flm
            WHERE flm.league_id = ft.league_id
            AND flm.user_id = auth.uid()
        )
    )
);

-- Allow users to insert transactions for their own teams
CREATE POLICY "Users can create transactions for their teams"
ON fantasy_transactions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.id = fantasy_transactions.fantasy_team_id
        AND ft.user_id = auth.uid()
    )
);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ fantasy_transactions table created successfully!';
END $$;

