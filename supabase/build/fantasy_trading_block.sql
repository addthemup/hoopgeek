-- =====================================================
-- FANTASY TRADING BLOCK SYSTEM
-- =====================================================
-- Manages players that teams are willing to trade
-- Supports different availability statuses and trade preferences
-- =====================================================

-- =====================================================
-- FANTASY TRADING BLOCK TABLE
-- =====================================================
-- Stores players that teams are willing to trade
-- =====================================================

CREATE TABLE IF NOT EXISTS fantasy_trading_block (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
    
    -- Trading Status
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'listening', 'untouchable', 'inactive')),
    
    -- Trade Preferences
    trade_notes TEXT, -- Optional notes about what the team is looking for
    preferred_positions TEXT[], -- Array of positions the team wants in return
    preferred_teams UUID[], -- Array of team IDs the team prefers to trade with
    
    -- Trade Value Assessment
    asking_price TEXT, -- What the team is asking for (e.g., "2nd round pick", "Star player")
    trade_priority INTEGER DEFAULT 5 CHECK (trade_priority >= 1 AND trade_priority <= 10), -- 1 = must trade, 10 = barely available
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date for the trade listing
    
    -- System Fields
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, fantasy_team_id, player_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Trading Block Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_trading_block_league_id ON fantasy_trading_block(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trading_block_season_id ON fantasy_trading_block(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trading_block_fantasy_team_id ON fantasy_trading_block(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trading_block_player_id ON fantasy_trading_block(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_trading_block_status ON fantasy_trading_block(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_trading_block_priority ON fantasy_trading_block(trade_priority);
CREATE INDEX IF NOT EXISTS idx_fantasy_trading_block_expires_at ON fantasy_trading_block(expires_at);
CREATE INDEX IF NOT EXISTS idx_fantasy_trading_block_team_status ON fantasy_trading_block(fantasy_team_id, status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE fantasy_trading_block ENABLE ROW LEVEL SECURITY;

-- Trading Block Policies
CREATE POLICY "Users can view trading block in their leagues" ON fantasy_trading_block
    FOR SELECT TO authenticated
    USING (
        league_id IN (
            SELECT fl.id FROM fantasy_leagues fl
            JOIN fantasy_teams ft ON fl.id = ft.league_id
            WHERE ft.user_id = auth.uid() OR fl.commissioner_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage trading block for their teams" ON fantasy_trading_block
    FOR ALL TO authenticated
    USING (
        fantasy_team_id IN (
            SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Commissioners can manage all trading blocks" ON fantasy_trading_block
    FOR ALL TO authenticated
    USING (
        league_id IN (
            SELECT id FROM fantasy_leagues WHERE commissioner_id = auth.uid()
        )
    );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create trigger for updated_at
CREATE TRIGGER update_fantasy_trading_block_updated_at
    BEFORE UPDATE ON fantasy_trading_block
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ADD PLAYER TO TRADING BLOCK FUNCTION
-- =====================================================
-- Adds a player to the trading block
-- =====================================================

CREATE OR REPLACE FUNCTION add_player_to_trading_block(
    p_league_id UUID,
    p_season_id UUID,
    p_fantasy_team_id UUID,
    p_player_id UUID,
    p_status TEXT DEFAULT 'available',
    p_trade_notes TEXT DEFAULT NULL,
    p_preferred_positions TEXT[] DEFAULT NULL,
    p_preferred_teams UUID[] DEFAULT NULL,
    p_asking_price TEXT DEFAULT NULL,
    p_trade_priority INTEGER DEFAULT 5,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    trading_block_id UUID;
BEGIN
    -- Validate status
    IF p_status NOT IN ('available', 'listening', 'untouchable', 'inactive') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid status',
            'message', 'Status must be one of: available, listening, untouchable, inactive'
        );
    END IF;
    
    -- Validate trade priority
    IF p_trade_priority < 1 OR p_trade_priority > 10 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid trade priority',
            'message', 'Trade priority must be between 1 and 10'
        );
    END IF;
    
    -- Check if player is already on trading block
    IF EXISTS (
        SELECT 1 FROM fantasy_trading_block 
        WHERE league_id = p_league_id 
        AND fantasy_team_id = p_fantasy_team_id 
        AND player_id = p_player_id
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Player already on trading block',
            'message', 'This player is already on the trading block'
        );
    END IF;
    
    -- Insert the trading block entry
    INSERT INTO fantasy_trading_block (
        league_id,
        season_id,
        fantasy_team_id,
        player_id,
        status,
        trade_notes,
        preferred_positions,
        preferred_teams,
        asking_price,
        trade_priority,
        expires_at,
        created_by,
        updated_by
    ) VALUES (
        p_league_id,
        p_season_id,
        p_fantasy_team_id,
        p_player_id,
        p_status,
        p_trade_notes,
        p_preferred_positions,
        p_preferred_teams,
        p_asking_price,
        p_trade_priority,
        p_expires_at,
        p_created_by,
        p_created_by
    ) RETURNING id INTO trading_block_id;
    
    result := jsonb_build_object(
        'success', TRUE,
        'trading_block_id', trading_block_id,
        'league_id', p_league_id,
        'fantasy_team_id', p_fantasy_team_id,
        'player_id', p_player_id,
        'status', p_status,
        'message', 'Player added to trading block successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to add player to trading block',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_player_to_trading_block(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT[], UUID[], TEXT, INTEGER, TIMESTAMP WITH TIME ZONE, UUID) TO authenticated;

-- =====================================================
-- REMOVE PLAYER FROM TRADING BLOCK FUNCTION
-- =====================================================
-- Removes a player from the trading block
-- =====================================================

CREATE OR REPLACE FUNCTION remove_player_from_trading_block(
    p_league_id UUID,
    p_fantasy_team_id UUID,
    p_player_id UUID
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    deleted_count INTEGER;
BEGIN
    -- Delete the trading block entry
    DELETE FROM fantasy_trading_block 
    WHERE league_id = p_league_id 
    AND fantasy_team_id = p_fantasy_team_id 
    AND player_id = p_player_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    IF deleted_count = 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Player not found on trading block',
            'message', 'This player is not currently on the trading block'
        );
    END IF;
    
    result := jsonb_build_object(
        'success', TRUE,
        'league_id', p_league_id,
        'fantasy_team_id', p_fantasy_team_id,
        'player_id', p_player_id,
        'message', 'Player removed from trading block successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to remove player from trading block',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION remove_player_from_trading_block(UUID, UUID, UUID) TO authenticated;

-- =====================================================
-- UPDATE TRADING BLOCK STATUS FUNCTION
-- =====================================================
-- Updates the status of a player on the trading block
-- =====================================================

CREATE OR REPLACE FUNCTION update_trading_block_status(
    p_league_id UUID,
    p_fantasy_team_id UUID,
    p_player_id UUID,
    p_status TEXT,
    p_trade_notes TEXT DEFAULT NULL,
    p_preferred_positions TEXT[] DEFAULT NULL,
    p_preferred_teams UUID[] DEFAULT NULL,
    p_asking_price TEXT DEFAULT NULL,
    p_trade_priority INTEGER DEFAULT 5,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_updated_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    updated_count INTEGER;
BEGIN
    -- Validate status
    IF p_status NOT IN ('available', 'listening', 'untouchable', 'inactive') THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid status',
            'message', 'Status must be one of: available, listening, untouchable, inactive'
        );
    END IF;
    
    -- Validate trade priority
    IF p_trade_priority < 1 OR p_trade_priority > 10 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Invalid trade priority',
            'message', 'Trade priority must be between 1 and 10'
        );
    END IF;
    
    -- Update the trading block entry
    UPDATE fantasy_trading_block 
    SET 
        status = p_status,
        trade_notes = p_trade_notes,
        preferred_positions = p_preferred_positions,
        preferred_teams = p_preferred_teams,
        asking_price = p_asking_price,
        trade_priority = p_trade_priority,
        expires_at = p_expires_at,
        updated_by = p_updated_by,
        updated_at = NOW()
    WHERE league_id = p_league_id 
    AND fantasy_team_id = p_fantasy_team_id 
    AND player_id = p_player_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count = 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Player not found on trading block',
            'message', 'This player is not currently on the trading block'
        );
    END IF;
    
    result := jsonb_build_object(
        'success', TRUE,
        'league_id', p_league_id,
        'fantasy_team_id', p_fantasy_team_id,
        'player_id', p_player_id,
        'status', p_status,
        'message', 'Trading block status updated successfully'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Failed to update trading block status',
        'message', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_trading_block_status(UUID, UUID, UUID, TEXT, TEXT, TEXT[], UUID[], TEXT, INTEGER, TIMESTAMP WITH TIME ZONE, UUID) TO authenticated;

-- =====================================================
-- GET TRADING BLOCK FUNCTION
-- =====================================================
-- Retrieves trading block for a specific team or league
-- =====================================================

CREATE OR REPLACE FUNCTION get_trading_block(
    p_league_id UUID,
    p_fantasy_team_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    league_id UUID,
    season_id UUID,
    fantasy_team_id UUID,
    player_id UUID,
    player_name TEXT,
    player_position TEXT,
    player_team TEXT,
    player_avatar TEXT,
    status TEXT,
    trade_notes TEXT,
    preferred_positions TEXT[],
    asking_price TEXT,
    trade_priority INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ftb.id,
        ftb.league_id,
        ftb.season_id,
        ftb.fantasy_team_id,
        ftb.player_id,
        np.name as player_name,
        np.position as player_position,
        np.team_abbreviation as player_team,
        CASE 
            WHEN np.nba_player_id IS NOT NULL THEN 
                'https://cdn.nba.com/headshots/nba/latest/260x190/' || np.nba_player_id || '.png'
            ELSE ''
        END as player_avatar,
        ftb.status,
        ftb.trade_notes,
        ftb.preferred_positions,
        ftb.asking_price,
        ftb.trade_priority,
        ftb.expires_at,
        ftb.created_at,
        ftb.updated_at
    FROM fantasy_trading_block ftb
    LEFT JOIN nba_players np ON ftb.player_id = np.id
    WHERE ftb.league_id = p_league_id
    AND (p_fantasy_team_id IS NULL OR ftb.fantasy_team_id = p_fantasy_team_id)
    ORDER BY ftb.trade_priority ASC, ftb.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_trading_block(UUID, UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Fantasy Trading Block system created successfully!';
    RAISE NOTICE '✅ Table: fantasy_trading_block';
    RAISE NOTICE '✅ Functions: add_player_to_trading_block, remove_player_from_trading_block, update_trading_block_status, get_trading_block';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support TradingBlock component';
    RAISE NOTICE '📋 Features: Player availability, trade preferences, priority levels';
    RAISE NOTICE '🔄 Trading management: Add/remove players, update status, expiration dates';
    RAISE NOTICE '🏷️ Status types: available, listening, untouchable, inactive';
    RAISE NOTICE '📊 Trade preferences: Preferred positions, teams, asking price';
    RAISE NOTICE '';
END $$;
