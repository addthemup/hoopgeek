-- =====================================================
-- FIX FANTASY_WAIVER_CLAIMS TABLE
-- =====================================================
-- Adds missing columns and foreign key relationships
-- =====================================================

-- First, let's check what we have and add missing columns
DO $$ 
BEGIN
    -- Add player_to_drop_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'player_to_drop_id'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN player_to_drop_id UUID;
        RAISE NOTICE '✅ Added player_to_drop_id column';
    END IF;
    
    -- Add submitted_by if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'submitted_by'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN submitted_by UUID;
        RAISE NOTICE '✅ Added submitted_by column';
    END IF;
    
    -- Add failure_reason if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'failure_reason'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN failure_reason TEXT;
        RAISE NOTICE '✅ Added failure_reason column';
    END IF;
    
    -- Ensure bid_amount exists and is INTEGER
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'bid_amount'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN bid_amount INTEGER DEFAULT 0;
        RAISE NOTICE '✅ Added bid_amount column';
    END IF;
    
    -- Ensure priority exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'priority'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN priority INTEGER DEFAULT 1;
        RAISE NOTICE '✅ Added priority column';
    END IF;
    
    -- Ensure submitted_at exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'submitted_at'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE '✅ Added submitted_at column';
    END IF;
    
    -- Ensure processed_at exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'processed_at'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN processed_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Added processed_at column';
    END IF;
    
    -- Ensure status exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN status TEXT DEFAULT 'pending';
        RAISE NOTICE '✅ Added status column';
    END IF;
    
    -- Ensure claim_type exists and is properly configured
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND column_name = 'claim_type'
    ) THEN
        ALTER TABLE fantasy_waiver_claims 
        ADD COLUMN claim_type TEXT DEFAULT 'add';
        RAISE NOTICE '✅ Added claim_type column';
    ELSE
        -- If it exists but has NOT NULL constraint without default, add default
        ALTER TABLE fantasy_waiver_claims 
        ALTER COLUMN claim_type SET DEFAULT 'add';
        
        -- Make it nullable if it has NOT NULL constraint
        ALTER TABLE fantasy_waiver_claims 
        ALTER COLUMN claim_type DROP NOT NULL;
        RAISE NOTICE '✅ Updated claim_type column to be nullable with default';
    END IF;
END $$;

-- Drop any CHECK constraints on claim_type
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%claim_type%'
    ) LOOP
        EXECUTE 'ALTER TABLE fantasy_waiver_claims DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
        RAISE NOTICE 'Dropped check constraint: %', r.constraint_name;
    END LOOP;
END $$;

-- =====================================================
-- ADD FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Drop ALL existing foreign keys to recreate them properly
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE fantasy_waiver_claims DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
        RAISE NOTICE 'Dropped constraint: %', r.constraint_name;
    END LOOP;
END $$;

-- Add foreign key constraints
DO $$
BEGIN
    -- player_id -> nba_players
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fantasy_waiver_claims_player_id_fkey'
    ) THEN
        ALTER TABLE fantasy_waiver_claims
        ADD CONSTRAINT fantasy_waiver_claims_player_id_fkey 
        FOREIGN KEY (player_id) REFERENCES nba_players(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added player_id foreign key';
    END IF;
    
    -- player_to_drop_id -> nba_players
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fantasy_waiver_claims_player_to_drop_id_fkey'
    ) THEN
        ALTER TABLE fantasy_waiver_claims
        ADD CONSTRAINT fantasy_waiver_claims_player_to_drop_id_fkey 
        FOREIGN KEY (player_to_drop_id) REFERENCES nba_players(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added player_to_drop_id foreign key';
    END IF;
    
    -- submitted_by -> auth.users
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fantasy_waiver_claims_submitted_by_fkey'
    ) THEN
        ALTER TABLE fantasy_waiver_claims
        ADD CONSTRAINT fantasy_waiver_claims_submitted_by_fkey 
        FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added submitted_by foreign key';
    END IF;
    
    -- fantasy_team_id -> fantasy_teams
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fantasy_waiver_claims_fantasy_team_id_fkey'
    ) THEN
        ALTER TABLE fantasy_waiver_claims
        ADD CONSTRAINT fantasy_waiver_claims_fantasy_team_id_fkey 
        FOREIGN KEY (fantasy_team_id) REFERENCES fantasy_teams(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added fantasy_team_id foreign key';
    END IF;
    
    -- league_id -> fantasy_leagues
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fantasy_waiver_claims_league_id_fkey'
    ) THEN
        ALTER TABLE fantasy_waiver_claims
        ADD CONSTRAINT fantasy_waiver_claims_league_id_fkey 
        FOREIGN KEY (league_id) REFERENCES fantasy_leagues(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added league_id foreign key';
    END IF;
    
    -- season_id -> fantasy_league_seasons
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fantasy_waiver_claims_season_id_fkey'
    ) THEN
        ALTER TABLE fantasy_waiver_claims
        ADD CONSTRAINT fantasy_waiver_claims_season_id_fkey 
        FOREIGN KEY (season_id) REFERENCES fantasy_league_seasons(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added season_id foreign key';
    END IF;
END $$;

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_waiver_claims_league_season 
ON fantasy_waiver_claims(league_id, season_id);

CREATE INDEX IF NOT EXISTS idx_waiver_claims_team_status 
ON fantasy_waiver_claims(fantasy_team_id, status);

CREATE INDEX IF NOT EXISTS idx_waiver_claims_player_status 
ON fantasy_waiver_claims(player_id, status);

CREATE INDEX IF NOT EXISTS idx_waiver_claims_status_priority 
ON fantasy_waiver_claims(status, priority DESC);

-- =====================================================
-- UPDATE RLS POLICIES
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view waiver claims in their leagues" ON fantasy_waiver_claims;
DROP POLICY IF EXISTS "Users can submit waiver claims for their teams" ON fantasy_waiver_claims;
DROP POLICY IF EXISTS "Users can cancel their own pending claims" ON fantasy_waiver_claims;

-- Enable RLS
ALTER TABLE fantasy_waiver_claims ENABLE ROW LEVEL SECURITY;

-- View claims in leagues you're part of
CREATE POLICY "Users can view waiver claims in their leagues"
ON fantasy_waiver_claims
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.league_id = fantasy_waiver_claims.league_id
        AND ft.user_id = auth.uid()
    )
);

-- Submit claims for your own team
CREATE POLICY "Users can submit waiver claims for their teams"
ON fantasy_waiver_claims
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.id = fantasy_waiver_claims.fantasy_team_id
        AND ft.user_id = auth.uid()
    )
);

-- Update/cancel your own pending claims
CREATE POLICY "Users can cancel their own pending claims"
ON fantasy_waiver_claims
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.id = fantasy_waiver_claims.fantasy_team_id
        AND ft.user_id = auth.uid()
    )
    AND status = 'pending'
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM fantasy_teams ft
        WHERE ft.id = fantasy_waiver_claims.fantasy_team_id
        AND ft.user_id = auth.uid()
    )
);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
    v_columns TEXT[];
BEGIN
    -- Get all columns
    SELECT array_agg(column_name::TEXT ORDER BY column_name)
    INTO v_columns
    FROM information_schema.columns
    WHERE table_name = 'fantasy_waiver_claims';
    
    RAISE NOTICE '✅ fantasy_waiver_claims columns: %', v_columns;
    
    -- Check foreign keys
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'fantasy_waiver_claims' 
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        RAISE NOTICE '✅ Foreign key constraints added';
    END IF;
END $$;

