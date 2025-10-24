-- =====================================================
-- WAIVER SYSTEM - ALL IN ONE DEPLOYMENT
-- =====================================================
-- Run this entire file in Supabase SQL Editor
-- It will create all necessary tables and functions
-- =====================================================

-- 🚀 Starting waiver system deployment...

-- =====================================================
-- STEP 1: Create fantasy_transactions table
-- =====================================================
-- 📋 Step 1: Creating fantasy_transactions table...

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_league_id ON fantasy_transactions(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_season_id ON fantasy_transactions(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_fantasy_team_id ON fantasy_transactions(fantasy_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_player_id ON fantasy_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_type ON fantasy_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_status ON fantasy_transactions(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_date ON fantasy_transactions(transaction_date);

-- Enable RLS
ALTER TABLE fantasy_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view transactions in their leagues" ON fantasy_transactions;
DROP POLICY IF EXISTS "Users can create transactions for their teams" ON fantasy_transactions;

-- Create RLS policies
CREATE POLICY "Users can view transactions in their leagues"
ON fantasy_transactions FOR SELECT
USING (
    -- User can view transactions in leagues where they have a team
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.league_id = fantasy_transactions.league_id
        AND ft.user_id = auth.uid()
    )
);

CREATE POLICY "Users can create transactions for their teams"
ON fantasy_transactions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.id = fantasy_transactions.fantasy_team_id
        AND ft.user_id = auth.uid()
    )
);

-- ✅ fantasy_transactions table created

-- =====================================================
-- STEP 2: Add waiver columns to fantasy_league_seasons
-- =====================================================
-- 📋 Step 2: Adding waiver columns to fantasy_league_seasons...

ALTER TABLE fantasy_league_seasons
ADD COLUMN IF NOT EXISTS waiver_type TEXT DEFAULT 'rolling' CHECK (waiver_type IN ('none', 'rolling', 'faab', 'continuous')),
ADD COLUMN IF NOT EXISTS waiver_period_hours INTEGER DEFAULT 48,
ADD COLUMN IF NOT EXISTS waiver_process_time TIME DEFAULT '03:00:00',
ADD COLUMN IF NOT EXISTS waiver_budget_amount INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS waiver_min_bid INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS waiver_priority_reset TEXT DEFAULT 'weekly' CHECK (waiver_priority_reset IN ('never', 'weekly', 'after_claim')),
ADD COLUMN IF NOT EXISTS waiver_claim_days TEXT[] DEFAULT ARRAY['Tuesday', 'Thursday', 'Saturday'];

-- ✅ Waiver columns added

-- =====================================================
-- STEP 3: Create fantasy_players_on_waivers table
-- =====================================================
-- 📋 Step 3: Creating fantasy_players_on_waivers table...

CREATE TABLE IF NOT EXISTS fantasy_players_on_waivers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
    
    -- Who dropped the player
    dropped_by_team_id UUID REFERENCES fantasy_teams(id) ON DELETE SET NULL,
    dropped_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    dropped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Waiver Status
    waiver_status TEXT DEFAULT 'on_waivers' CHECK (waiver_status IN ('on_waivers', 'free_agent', 'claimed')),
    becomes_free_agent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    claimed_by_team_id UUID REFERENCES fantasy_teams(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(league_id, season_id, player_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_league_id ON fantasy_players_on_waivers(league_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_season_id ON fantasy_players_on_waivers(season_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_player_id ON fantasy_players_on_waivers(player_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_status ON fantasy_players_on_waivers(waiver_status);
CREATE INDEX IF NOT EXISTS idx_fantasy_players_on_waivers_free_agent_at ON fantasy_players_on_waivers(becomes_free_agent_at);

-- Enable RLS
ALTER TABLE fantasy_players_on_waivers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view waivers in their leagues" ON fantasy_players_on_waivers;

-- Create RLS policy
CREATE POLICY "Users can view waivers in their leagues"
ON fantasy_players_on_waivers FOR SELECT
USING (
    -- User can view waivers in leagues where they have a team
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.league_id = fantasy_players_on_waivers.league_id
        AND ft.user_id = auth.uid()
    )
);

-- ✅ fantasy_players_on_waivers table created

-- =====================================================
-- STEP 4: Create drop_player function
-- =====================================================
-- 📋 Step 4: Creating drop_player function...

CREATE OR REPLACE FUNCTION drop_player(
    league_id_param UUID,
    season_id_param UUID,
    fantasy_team_id_param UUID,
    player_id_param UUID,
    user_id_param UUID,
    notes_param TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    waiver_settings RECORD;
    roster_spot_id UUID;
    becomes_free_agent_at TIMESTAMP WITH TIME ZONE;
    actual_waiver_type TEXT;
    actual_waiver_period_hours INTEGER;
    result JSONB;
BEGIN
    -- Get waiver settings
    SELECT 
        COALESCE(waiver_type, 'rolling') as waiver_type,
        COALESCE(waiver_period_hours, 48) as waiver_period_hours
    INTO waiver_settings
    FROM fantasy_league_seasons
    WHERE id = season_id_param;
    
    IF waiver_settings IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Season not found'
        );
    END IF;
    
    -- Get actual values with defaults
    actual_waiver_type := COALESCE(waiver_settings.waiver_type, 'rolling');
    actual_waiver_period_hours := COALESCE(waiver_settings.waiver_period_hours, 48);
    
    -- Calculate when player becomes free agent
    becomes_free_agent_at := NOW() + (actual_waiver_period_hours || ' hours')::INTERVAL;
    
    -- ⚠️ CRITICAL: Clear the player from roster spot, DON'T DELETE the spot
    -- Roster spots are permanent and should never be deleted
    UPDATE fantasy_roster_spots
    SET 
        player_id = NULL,
        updated_at = NOW()
    WHERE fantasy_team_id = fantasy_team_id_param 
    AND player_id = player_id_param
    RETURNING id INTO roster_spot_id;
    
    IF roster_spot_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Player not found on team roster'
        );
    END IF;
    
    -- Create transaction record
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
        'cut',
        fantasy_team_id_param,
        player_id_param,
        notes_param,
        user_id_param
    );
    
    -- If waiver type is 'none', player becomes immediate free agent
    IF actual_waiver_type = 'none' THEN
        becomes_free_agent_at := NOW();
    END IF;
    
    -- Add player to waivers (or mark as free agent if waiver_type = 'none')
    INSERT INTO fantasy_players_on_waivers (
        league_id,
        season_id,
        player_id,
        dropped_by_team_id,
        dropped_by_user_id,
        dropped_at,
        waiver_status,
        becomes_free_agent_at
    ) VALUES (
        league_id_param,
        season_id_param,
        player_id_param,
        fantasy_team_id_param,
        user_id_param,
        NOW(),
        CASE 
            WHEN actual_waiver_type = 'none' THEN 'free_agent'
            ELSE 'on_waivers'
        END,
        becomes_free_agent_at
    )
    ON CONFLICT (league_id, season_id, player_id) 
    DO UPDATE SET
        dropped_by_team_id = EXCLUDED.dropped_by_team_id,
        dropped_by_user_id = EXCLUDED.dropped_by_user_id,
        dropped_at = EXCLUDED.dropped_at,
        waiver_status = EXCLUDED.waiver_status,
        becomes_free_agent_at = EXCLUDED.becomes_free_agent_at;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Player dropped successfully - roster spot preserved',
        'player_id', player_id_param,
        'roster_spot_id', roster_spot_id,
        'waiver_status', CASE 
            WHEN actual_waiver_type = 'none' THEN 'free_agent'
            ELSE 'on_waivers'
        END,
        'becomes_free_agent_at', becomes_free_agent_at
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to drop player',
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION drop_player(UUID, UUID, UUID, UUID, UUID, TEXT) TO authenticated;

-- ✅ drop_player function created

-- =====================================================
-- STEP 5: Set default waiver settings for existing leagues
-- =====================================================
-- 📋 Step 5: Setting default waiver settings for existing leagues...

UPDATE fantasy_league_seasons
SET 
    waiver_type = COALESCE(waiver_type, 'rolling'),
    waiver_period_hours = COALESCE(waiver_period_hours, 48),
    waiver_process_time = COALESCE(waiver_process_time, '03:00:00'),
    waiver_budget_amount = COALESCE(waiver_budget_amount, 100),
    waiver_min_bid = COALESCE(waiver_min_bid, 0),
    waiver_priority_reset = COALESCE(waiver_priority_reset, 'weekly'),
    waiver_claim_days = COALESCE(waiver_claim_days, ARRAY['Tuesday', 'Thursday', 'Saturday'])
WHERE waiver_type IS NULL OR waiver_period_hours IS NULL;

-- ✅ Default waiver settings applied

-- 🎉 Waiver system deployment complete!
-- 
-- Next steps:
-- 1. Test dropping a player from your roster
-- 2. Check browser console for logs
-- 3. Verify transaction in fantasy_transactions table
-- 4. Verify player in fantasy_players_on_waivers table

