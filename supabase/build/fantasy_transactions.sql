-- =====================================================
-- FANTASY TRANSACTIONS SYSTEM
-- =====================================================
-- Simplified transaction system for fantasy basketball leagues
-- Handles only 'add' and 'cut' transactions for player movements
-- =====================================================

-- =====================================================
-- FANTASY TRANSACTIONS TABLE
-- =====================================================
-- Tracks only 'add' and 'cut' transactions for player movements
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
-- FANTASY TRADES TABLE
-- =====================================================
-- Handles complex multi-player trades with proper foreign keys
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    
    -- Trade Teams
    team_a_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    team_b_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Trade Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
    
    -- Trade Details
    proposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours'),
    
    -- Approval
    team_a_approved BOOLEAN DEFAULT false,
    team_b_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FANTASY TRADE ASSETS TABLE
-- =====================================================
-- Stores individual assets (players/picks) involved in trades
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_trade_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trade_id UUID NOT NULL REFERENCES fantasy_trades(id) ON DELETE CASCADE,
    
    -- Asset Information
    asset_type TEXT NOT NULL CHECK (asset_type IN ('player', 'pick')),
    
    -- For player assets
    player_id UUID REFERENCES nba_players(id) ON DELETE CASCADE,
    
    -- For pick assets
    pick_round INTEGER,
    pick_number INTEGER,
    pick_year INTEGER,
    
    -- Which team is giving up this asset
    from_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- Which team is receiving this asset
    to_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Fantasy Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_league_id ON fantasy_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_season_id ON fantasy_transactions(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_fantasy_team_id ON fantasy_transactions(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_player_id ON fantasy_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_type ON fantasy_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_status ON fantasy_transactions(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_date ON fantasy_transactions(transaction_date);

-- Fantasy Trades Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_league_id ON fantasy_trades(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_season_id ON fantasy_trades(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_team_a_id ON fantasy_trades(team_a_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_team_b_id ON fantasy_trades(team_b_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_status ON fantasy_trades(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_proposed_by ON fantasy_trades(proposed_by);
CREATE INDEX IF NOT EXISTS idx_fantasy_trades_expires_at ON fantasy_trades(expires_at);

-- Fantasy Trade Assets Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_trade_assets_trade_id ON fantasy_trade_assets(trade_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trade_assets_player_id ON fantasy_trade_assets(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trade_assets_from_team_id ON fantasy_trade_assets(from_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trade_assets_to_team_id ON fantasy_trade_assets(to_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trade_assets_type ON fantasy_trade_assets(asset_type);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE fantasy_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_trade_assets ENABLE ROW LEVEL SECURITY;

-- Fantasy Transactions Policies
CREATE POLICY "Users can view transactions in their leagues" ON fantasy_transactions
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create transactions for their teams" ON fantasy_transactions
    FOR INSERT TO authenticated
    WITH CHECK (
        fantasy_team_id IN (
            SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Commissioners can manage all transactions" ON fantasy_transactions
    FOR ALL TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- Fantasy Trades Policies
CREATE POLICY "Users can view trades in their leagues" ON fantasy_trades
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create trades involving their teams" ON fantasy_trades
    FOR INSERT TO authenticated
    WITH CHECK (
        (team_a_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid()) OR
         team_b_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid())) AND
        proposed_by = auth.uid()
    );

CREATE POLICY "Users can update trades involving their teams" ON fantasy_trades
    FOR UPDATE TO authenticated
    USING (
        (team_a_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid()) OR
         team_b_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid())) OR
        league_id IN (SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid())
    );

-- Fantasy Trade Assets Policies
CREATE POLICY "Users can view trade assets in their leagues" ON fantasy_trade_assets
    FOR SELECT TO authenticated
    USING (
        trade_id IN (
            SELECT id FROM fantasy_trades WHERE league_id IN (
                SELECT fl.id FROM fantasy_leagues fl
                JOIN fantasy_teams ft ON fl.id = ft.league_id
                WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can manage trade assets for their trades" ON fantasy_trade_assets
    FOR ALL TO authenticated
    USING (
        trade_id IN (
            SELECT id FROM fantasy_trades WHERE 
            (team_a_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid()) OR
             team_b_id IN (SELECT id FROM fantasy_teams WHERE user_id = auth.uid())) OR
            league_id IN (SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid())
        )
    );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create triggers for updated_at
CREATE TRIGGER update_fantasy_transactions_updated_at
    BEFORE UPDATE ON fantasy_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_trades_updated_at
    BEFORE UPDATE ON fantasy_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CREATE TRANSACTION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION create_fantasy_transaction(
    league_id_param UUID,
    season_id_param UUID,
    transaction_type_param TEXT,
    fantasy_team_id_param UUID,
    player_id_param UUID,
    notes_param TEXT DEFAULT NULL,
    processed_by_param UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    transaction_id UUID;
BEGIN
    -- Validate transaction type
    IF transaction_type_param NOT IN ('add', 'cut') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid transaction type',
            'message', 'Transaction type must be either "add" or "cut"'
        );
    END IF;
    
    -- Insert the transaction
    INSERT INTO fantasy_transactions (
        league_id,
        season_id,
        transaction_type,
        fantasy_team_id,
        player_id,
        notes,
        processed_by
    ) VALUES (
        league_id_param,
        season_id_param,
        transaction_type_param,
        fantasy_team_id_param,
        player_id_param,
        notes_param,
        processed_by_param
    ) RETURNING id INTO transaction_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'transaction_id', transaction_id,
        'league_id', league_id_param,
        'season_id', season_id_param,
        'transaction_type', transaction_type_param,
        'fantasy_team_id', fantasy_team_id_param,
        'player_id', player_id_param,
        'message', 'Transaction created successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Transaction creation failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_fantasy_transaction(UUID, UUID, TEXT, UUID, UUID, TEXT, UUID) TO authenticated;

-- =====================================================
-- CREATE TRADE FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION create_fantasy_trade(
    league_id_param UUID,
    season_id_param UUID,
    team_a_id_param UUID,
    team_b_id_param UUID,
    proposed_by_param UUID,
    expires_hours_param INTEGER DEFAULT 48
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    trade_id UUID;
    expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate expiration time
    expires_at := NOW() + (expires_hours_param || ' hours')::INTERVAL;
    
    -- Insert the trade
    INSERT INTO fantasy_trades (
        league_id,
        season_id,
        team_a_id,
        team_b_id,
        proposed_by,
        expires_at
    ) VALUES (
        league_id_param,
        season_id_param,
        team_a_id_param,
        team_b_id_param,
        proposed_by_param,
        expires_at
    ) RETURNING id INTO trade_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'trade_id', trade_id,
        'league_id', league_id_param,
        'season_id', season_id_param,
        'team_a_id', team_a_id_param,
        'team_b_id', team_b_id_param,
        'expires_at', expires_at,
        'message', 'Trade proposal created successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Trade creation failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_fantasy_trade(UUID, UUID, UUID, UUID, UUID, INTEGER) TO authenticated;

-- =====================================================
-- ADD TRADE ASSET FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION add_trade_asset(
    trade_id_param UUID,
    asset_type_param TEXT,
    from_team_id_param UUID,
    to_team_id_param UUID,
    player_id_param UUID DEFAULT NULL,
    pick_round_param INTEGER DEFAULT NULL,
    pick_number_param INTEGER DEFAULT NULL,
    pick_year_param INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    asset_id UUID;
BEGIN
    -- Validate asset type
    IF asset_type_param NOT IN ('player', 'pick') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid asset type',
            'message', 'Asset type must be either "player" or "pick"'
        );
    END IF;
    
    -- Validate required fields based on asset type
    IF asset_type_param = 'player' AND player_id_param IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Player ID required',
            'message', 'Player ID is required for player assets'
        );
    END IF;
    
    IF asset_type_param = 'pick' AND (pick_round_param IS NULL OR pick_number_param IS NULL OR pick_year_param IS NULL) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Pick details required',
            'message', 'Pick round, number, and year are required for pick assets'
        );
    END IF;
    
    -- Insert the trade asset
    INSERT INTO fantasy_trade_assets (
        trade_id,
        asset_type,
        player_id,
        pick_round,
        pick_number,
        pick_year,
        from_team_id,
        to_team_id
    ) VALUES (
        trade_id_param,
        asset_type_param,
        player_id_param,
        pick_round_param,
        pick_number_param,
        pick_year_param,
        from_team_id_param,
        to_team_id_param
    ) RETURNING id INTO asset_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'asset_id', asset_id,
        'trade_id', trade_id_param,
        'asset_type', asset_type_param,
        'message', 'Trade asset added successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Trade asset creation failed',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Function is SECURITY DEFINER, so no explicit GRANT needed

-- =====================================================
-- GET TEAM TRANSACTIONS FUNCTION
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_team_transactions(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_team_transactions(
    team_id_param UUID,
    limit_param INTEGER DEFAULT 50,
    offset_param INTEGER DEFAULT 0
)
RETURNS TABLE (
    transaction_id UUID,
    transaction_type TEXT,
    status TEXT,
    player_id UUID,
    player_name TEXT,
    player_position TEXT,
    player_team TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id as transaction_id,
        ft.transaction_type,
        ft.status,
        ft.player_id,
        np.name as player_name,
        np.position as player_position,
        np.team_abbreviation as player_team,
        ft.transaction_date,
        ft.notes
    FROM fantasy_transactions ft
    LEFT JOIN nba_players np ON ft.player_id = np.id
    WHERE ft.fantasy_team_id = team_id_param
    ORDER BY ft.transaction_date DESC
    LIMIT limit_param OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_team_transactions(UUID, INTEGER, INTEGER) TO authenticated;

-- =====================================================
-- GET LEAGUE TRANSACTIONS FUNCTION
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_league_transactions(UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_league_transactions(
    league_id_param UUID,
    season_id_param UUID DEFAULT NULL,
    limit_param INTEGER DEFAULT 100,
    offset_param INTEGER DEFAULT 0
)
RETURNS TABLE (
    transaction_id UUID,
    transaction_type TEXT,
    status TEXT,
    fantasy_team_id UUID,
    fantasy_team_name TEXT,
    player_id UUID,
    player_name TEXT,
    player_position TEXT,
    player_team TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id as transaction_id,
        ft.transaction_type,
        ft.status,
        ft.fantasy_team_id,
        fteams.team_name as fantasy_team_name,
        ft.player_id,
        np.name as player_name,
        np.position as player_position,
        np.team_abbreviation as player_team,
        ft.transaction_date,
        ft.notes
    FROM fantasy_transactions ft
    LEFT JOIN fantasy_teams fteams ON ft.fantasy_team_id = fteams.id
    LEFT JOIN nba_players np ON ft.player_id = np.id
    WHERE ft.league_id = league_id_param
    AND (season_id_param IS NULL OR ft.season_id = season_id_param)
    ORDER BY ft.transaction_date DESC
    LIMIT limit_param OFFSET offset_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_league_transactions(UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fantasy Transactions system created successfully!';
    RAISE NOTICE '✅ Tables: fantasy_transactions, fantasy_trades, fantasy_trade_assets';
    RAISE NOTICE '✅ Functions: create_fantasy_transaction, create_fantasy_trade, add_trade_asset, get_team_transactions, get_league_transactions';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Simplified transaction system for add/cut operations only';
    RAISE NOTICE '📋 Transaction types: add, cut (no draft, trade, waiver_claim, free_agent_pickup)';
    RAISE NOTICE '🔄 Trade system: Proper foreign keys for players and picks, no JSONB';
    RAISE NOTICE '📊 Clean separation: Transactions for adds/cuts, Trades for complex multi-asset deals';
    RAISE NOTICE '';
END $$;
