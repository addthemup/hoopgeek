-- ============================================================================
-- DAILY FANTASY SPORTS (DFS) SYSTEM - COMPREHENSIVE DATABASE SCHEMA
-- ============================================================================
-- Version: 1.0
-- Date: 2025-10-20
-- Purpose: Complete DFS system for daily contests with unique 3-unit lineup structure
-- ============================================================================

-- ============================================================================
-- ENUMS AND TYPES
-- ============================================================================

-- Pool status lifecycle
CREATE TYPE dfs_pool_status AS ENUM (
  'draft',           -- Pool being created
  'scheduled',       -- Pool scheduled, accepting entries
  'filling',         -- Pool filling up
  'guaranteed',      -- Pool will run regardless of entries
  'live',            -- Games have started
  'scoring',         -- Games completed, calculating scores
  'final',           -- Scoring complete, prizes distributed
  'cancelled',       -- Pool cancelled, refunds issued
  'suspended'        -- Pool suspended for investigation
);

-- Entry status
CREATE TYPE dfs_entry_status AS ENUM (
  'pending',         -- Entry submitted, payment pending
  'active',          -- Entry confirmed and active
  'withdrawn',       -- Entry withdrawn before pool start
  'disqualified',    -- Entry disqualified
  'completed'        -- Entry scored and finalized
);

-- Payout status
CREATE TYPE dfs_payout_status AS ENUM (
  'pending',         -- Payout calculated, awaiting distribution
  'processing',      -- Payment being processed
  'completed',       -- Payment completed
  'failed',          -- Payment failed
  'cancelled'        -- Payout cancelled
);

-- Transaction types
CREATE TYPE dfs_transaction_type AS ENUM (
  'entry_fee',       -- Entry fee charged
  'refund',          -- Entry fee refunded
  'prize',           -- Prize payout
  'bonus',           -- Bonus credit
  'withdrawal',      -- User withdrawal
  'deposit',         -- User deposit
  'adjustment'       -- Manual adjustment
);

-- Prize distribution types
CREATE TYPE dfs_prize_type AS ENUM (
  'top_n',           -- Top N places win
  'percentage',      -- Percentage of field wins
  'guaranteed',      -- Guaranteed prize pool
  'winner_take_all', -- Single winner
  'double_up',       -- Top 50% double money
  'multiplier',      -- 3x, 5x, 10x, etc.
  'satellite'        -- Win entry to another contest
);

-- Lineup unit types (matching your system)
CREATE TYPE dfs_lineup_unit AS ENUM (
  'starters',        -- 5 players, 1.0x multiplier
  'rotation',        -- 3 players, 0.75x multiplier
  'bench'            -- 2 players, 0.5x multiplier
);

-- Salary cap difficulty tiers
CREATE TYPE dfs_difficulty_tier AS ENUM (
  'elite',           -- $154.6M (hardest)
  'pro',             -- $195.9M (first apron)
  'standard'         -- $207.8M (second apron)
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DFS Pools (Contests)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Information
  name TEXT NOT NULL,
  description TEXT,
  pool_type TEXT DEFAULT 'classic', -- classic, showdown, turbo, etc.
  
  -- Slate Configuration
  slate_name TEXT NOT NULL, -- e.g., "Main Slate", "Early Slate", "Late Slate"
  slate_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  lock_time TIMESTAMPTZ NOT NULL, -- When lineups lock (usually first game start)
  end_time TIMESTAMPTZ, -- When all games end (calculated)
  
  -- Entry Configuration
  entry_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  min_entries INTEGER NOT NULL DEFAULT 2,
  max_entries INTEGER NOT NULL,
  max_entries_per_user INTEGER DEFAULT 1, -- Multi-entry limit
  current_entries INTEGER NOT NULL DEFAULT 0,
  
  -- Prize Configuration
  prize_pool DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  prize_type dfs_prize_type NOT NULL DEFAULT 'top_n', -- Type of prize distribution
  is_guaranteed BOOLEAN DEFAULT FALSE, -- Guaranteed prize pool
  guaranteed_amount DECIMAL(12, 2), -- Guaranteed minimum prize
  rake_percentage DECIMAL(5, 2) DEFAULT 10.00, -- Platform fee
  
  -- Salary Cap Configuration
  difficulty_tier dfs_difficulty_tier NOT NULL DEFAULT 'standard',
  salary_cap BIGINT NOT NULL, -- In dollars (e.g., 207800000 for $207.8M)
  
  -- Lineup Requirements
  roster_size INTEGER NOT NULL DEFAULT 10, -- Total players (5+3+2)
  starters_count INTEGER NOT NULL DEFAULT 5,
  rotation_count INTEGER NOT NULL DEFAULT 3,
  bench_count INTEGER NOT NULL DEFAULT 2,
  
  -- Unit Multipliers
  starters_multiplier DECIMAL(4, 2) NOT NULL DEFAULT 1.00,
  rotation_multiplier DECIMAL(4, 2) NOT NULL DEFAULT 0.75,
  bench_multiplier DECIMAL(4, 2) NOT NULL DEFAULT 0.50,
  
  -- Scoring Configuration
  scoring_format TEXT NOT NULL DEFAULT 'FanDuel', -- FanDuel, DraftKings, etc.
  scoring_config JSONB, -- Custom scoring if needed
  
  -- Late Swap Configuration
  allow_late_swap BOOLEAN DEFAULT FALSE,
  late_swap_until TIMESTAMPTZ,
  
  -- Status & Visibility
  status dfs_pool_status NOT NULL DEFAULT 'draft',
  is_public BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_beginner_friendly BOOLEAN DEFAULT FALSE,
  
  -- Prize Distribution Template
  prize_structure_id UUID, -- FK to dfs_prize_structures
  prize_distribution JSONB, -- Actual distribution (calculated)
  
  -- Additional Settings
  allow_duplicates BOOLEAN DEFAULT FALSE, -- Multiple entries can have same players
  require_unique_lineups BOOLEAN DEFAULT FALSE,
  min_unique_players INTEGER, -- For multi-entry, minimum unique players
  
  -- Business Logic
  created_by UUID REFERENCES auth.users(id),
  created_by_admin_id UUID, -- Admin who created (if via admin panel)
  season_year INTEGER NOT NULL DEFAULT 2025,
  league_type TEXT DEFAULT 'NBA', -- Future: NFL, MLB, etc.
  
  -- Metadata
  tags TEXT[], -- searchable tags
  rules_url TEXT,
  terms_url TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_entry_limits CHECK (min_entries >= 2 AND max_entries >= min_entries),
  CONSTRAINT valid_entries_per_user CHECK (max_entries_per_user >= 1),
  CONSTRAINT valid_fee CHECK (entry_fee >= 0),
  CONSTRAINT valid_prize_pool CHECK (prize_pool >= 0),
  CONSTRAINT valid_roster_size CHECK (roster_size = starters_count + rotation_count + bench_count),
  CONSTRAINT valid_multipliers CHECK (
    starters_multiplier >= 0 AND 
    rotation_multiplier >= 0 AND 
    bench_multiplier >= 0
  )
);

-- Indexes for performance
CREATE INDEX idx_dfs_pools_status ON dfs_pools(status);
CREATE INDEX idx_dfs_pools_slate_date ON dfs_pools(slate_date);
CREATE INDEX idx_dfs_pools_start_time ON dfs_pools(start_time);
CREATE INDEX idx_dfs_pools_lock_time ON dfs_pools(lock_time);
CREATE INDEX idx_dfs_pools_is_public ON dfs_pools(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_dfs_pools_difficulty ON dfs_pools(difficulty_tier);
CREATE INDEX idx_dfs_pools_featured ON dfs_pools(is_featured) WHERE is_featured = TRUE;

-- ----------------------------------------------------------------------------
-- DFS Pool Games (Slate Games)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_pool_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  pool_id UUID NOT NULL REFERENCES dfs_pools(id) ON DELETE CASCADE,
  game_id VARCHAR(50) NOT NULL, -- FK to nba_games.game_id
  
  -- Game Information (denormalized for performance)
  game_date TIMESTAMPTZ NOT NULL,
  home_team VARCHAR(10) NOT NULL, -- Team abbreviation
  away_team VARCHAR(10) NOT NULL, -- Team abbreviation
  
  -- Status
  is_included BOOLEAN DEFAULT TRUE, -- Allow excluding games from slate
  is_started BOOLEAN DEFAULT FALSE,
  is_final BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_pool_game UNIQUE(pool_id, game_id),
  CONSTRAINT fk_dfs_pool_games_game FOREIGN KEY (game_id) REFERENCES nba_games(game_id) ON DELETE RESTRICT
);

CREATE INDEX idx_dfs_pool_games_pool ON dfs_pool_games(pool_id);
CREATE INDEX idx_dfs_pool_games_game ON dfs_pool_games(game_id);
CREATE INDEX idx_dfs_pool_games_status ON dfs_pool_games(pool_id, is_started, is_final);

-- ----------------------------------------------------------------------------
-- DFS Entries (User Contest Entries)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  pool_id UUID NOT NULL REFERENCES dfs_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Entry Information
  entry_number INTEGER, -- User's nth entry in this pool
  entry_name TEXT, -- Optional custom name
  
  -- Financial
  entry_fee_paid DECIMAL(10, 2) NOT NULL,
  transaction_id UUID, -- FK to dfs_transactions
  
  -- Lineup Reference
  lineup_id UUID, -- FK to dfs_lineups (set after lineup created)
  
  -- Scoring
  raw_score DECIMAL(10, 2), -- Score before multipliers
  final_score DECIMAL(10, 2), -- Score after unit multipliers
  rank INTEGER, -- Final rank in pool
  percentile DECIMAL(5, 2), -- Top X%
  
  -- Prizes
  prize_amount DECIMAL(10, 2) DEFAULT 0.00,
  prize_paid BOOLEAN DEFAULT FALSE,
  payout_id UUID, -- FK to dfs_payouts
  
  -- Status
  status dfs_entry_status NOT NULL DEFAULT 'pending',
  is_public BOOLEAN DEFAULT TRUE, -- Show in public leaderboards
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  scored_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_entry_fee CHECK (entry_fee_paid >= 0),
  CONSTRAINT valid_scores CHECK (
    (raw_score IS NULL OR raw_score >= 0) AND
    (final_score IS NULL OR final_score >= 0)
  ),
  CONSTRAINT valid_prize CHECK (prize_amount >= 0)
);

-- Indexes
CREATE INDEX idx_dfs_entries_pool ON dfs_entries(pool_id);
CREATE INDEX idx_dfs_entries_user ON dfs_entries(user_id);
CREATE INDEX idx_dfs_entries_status ON dfs_entries(status);
CREATE INDEX idx_dfs_entries_rank ON dfs_entries(pool_id, rank) WHERE rank IS NOT NULL;
CREATE INDEX idx_dfs_entries_score ON dfs_entries(pool_id, final_score DESC) WHERE final_score IS NOT NULL;
CREATE UNIQUE INDEX idx_dfs_entries_user_pool_number ON dfs_entries(pool_id, user_id, entry_number);

-- ----------------------------------------------------------------------------
-- DFS Lineups (Contest Lineups)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  entry_id UUID NOT NULL REFERENCES dfs_entries(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES dfs_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Lineup Configuration
  lineup_name TEXT,
  
  -- Salary Tracking
  total_salary BIGINT NOT NULL DEFAULT 0, -- Sum of all player salaries
  remaining_salary BIGINT, -- salary_cap - total_salary
  
  -- Completeness
  is_complete BOOLEAN DEFAULT FALSE, -- All positions filled
  is_valid BOOLEAN DEFAULT FALSE, -- Passes all validations
  is_locked BOOLEAN DEFAULT FALSE, -- Locked after pool starts
  
  -- Validation Errors
  validation_errors JSONB, -- Array of error messages
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  locked_at TIMESTAMPTZ,
  
  CONSTRAINT unique_entry_lineup UNIQUE(entry_id)
);

-- Indexes
CREATE INDEX idx_dfs_lineups_entry ON dfs_lineups(entry_id);
CREATE INDEX idx_dfs_lineups_pool ON dfs_lineups(pool_id);
CREATE INDEX idx_dfs_lineups_user ON dfs_lineups(user_id);
CREATE INDEX idx_dfs_lineups_valid ON dfs_lineups(pool_id, is_valid) WHERE is_valid = TRUE;

-- ----------------------------------------------------------------------------
-- DFS Lineup Positions (Player Slots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_lineup_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  lineup_id UUID NOT NULL REFERENCES dfs_lineups(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES dfs_pools(id) ON DELETE CASCADE,
  
  -- Player Information
  player_id UUID NOT NULL, -- FK to nba_players.id
  nba_player_id INTEGER NOT NULL,
  
  -- Position Configuration
  unit dfs_lineup_unit NOT NULL, -- starters, rotation, bench
  unit_position INTEGER NOT NULL, -- 1-5 for starters, 1-3 for rotation, 1-2 for bench
  
  -- Player Snapshot (denormalized for historical accuracy)
  player_name TEXT NOT NULL,
  player_team VARCHAR(10) NOT NULL, -- Team abbreviation
  player_position TEXT,
  player_salary BIGINT NOT NULL,
  
  -- Scoring
  raw_fantasy_points DECIMAL(10, 2), -- Player's actual fantasy points
  unit_multiplier DECIMAL(4, 2) NOT NULL, -- Multiplier for this unit
  weighted_points DECIMAL(10, 2), -- raw_fantasy_points * unit_multiplier
  
  -- Game Performance
  games_played INTEGER DEFAULT 0,
  games_data JSONB, -- Array of game performances
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_salary CHECK (player_salary >= 0),
  CONSTRAINT valid_unit_position CHECK (
    (unit = 'starters' AND unit_position BETWEEN 1 AND 5) OR
    (unit = 'rotation' AND unit_position BETWEEN 1 AND 3) OR
    (unit = 'bench' AND unit_position BETWEEN 1 AND 2)
  ),
  CONSTRAINT unique_lineup_unit_position UNIQUE(lineup_id, unit, unit_position),
  CONSTRAINT fk_dfs_lineup_positions_player FOREIGN KEY (player_id) REFERENCES nba_players(id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_dfs_lineup_positions_lineup ON dfs_lineup_positions(lineup_id);
CREATE INDEX idx_dfs_lineup_positions_player ON dfs_lineup_positions(player_id);
CREATE INDEX idx_dfs_lineup_positions_pool ON dfs_lineup_positions(pool_id);
CREATE INDEX idx_dfs_lineup_positions_unit ON dfs_lineup_positions(lineup_id, unit);

-- ----------------------------------------------------------------------------
-- DFS Player Salaries (Pool-Specific Salaries)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_player_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  pool_id UUID NOT NULL REFERENCES dfs_pools(id) ON DELETE CASCADE,
  player_id UUID NOT NULL, -- FK to nba_players.id
  nba_player_id INTEGER NOT NULL,
  
  -- Player Information (snapshot)
  player_name TEXT NOT NULL,
  player_team VARCHAR(10) NOT NULL, -- Team abbreviation
  player_position TEXT,
  
  -- Salary for this specific pool/slate
  salary BIGINT NOT NULL,
  
  -- Ownership Tracking
  ownership_count INTEGER DEFAULT 0, -- How many lineups include this player
  ownership_percentage DECIMAL(5, 2), -- % of lineups with this player
  
  -- Projections & Stats
  projected_points DECIMAL(6, 2), -- Projected fantasy points
  actual_points DECIMAL(6, 2), -- Actual fantasy points (after games)
  value_score DECIMAL(6, 2), -- points per $1000 of salary
  
  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  is_playing BOOLEAN DEFAULT TRUE, -- Playing in slate games
  injury_status TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_salary CHECK (salary >= 0),
  CONSTRAINT unique_pool_player UNIQUE(pool_id, player_id),
  CONSTRAINT fk_dfs_player_salaries_player FOREIGN KEY (player_id) REFERENCES nba_players(id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_dfs_player_salaries_pool ON dfs_player_salaries(pool_id);
CREATE INDEX idx_dfs_player_salaries_player ON dfs_player_salaries(player_id);
CREATE INDEX idx_dfs_player_salaries_salary ON dfs_player_salaries(pool_id, salary DESC);
CREATE INDEX idx_dfs_player_salaries_ownership ON dfs_player_salaries(pool_id, ownership_percentage DESC);
CREATE INDEX idx_dfs_player_salaries_value ON dfs_player_salaries(pool_id, value_score DESC) WHERE value_score IS NOT NULL;

-- ----------------------------------------------------------------------------
-- DFS Prize Structures (Templates)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_prize_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL,
  description TEXT,
  prize_type dfs_prize_type NOT NULL,
  
  -- Configuration
  payout_places INTEGER NOT NULL, -- How many places get paid
  payout_structure JSONB NOT NULL, -- Array of { place: 1, percentage: 50.0 }
  
  -- Validation
  min_entries INTEGER, -- Minimum entries needed
  max_entries INTEGER, -- Maximum entries (null = unlimited)
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_payout_places CHECK (payout_places >= 1)
);

-- Example prize structures
INSERT INTO public.dfs_prize_structures (name, prize_type, payout_places, payout_structure) VALUES
('Winner Take All', 'winner_take_all', 1, '[{"place": 1, "percentage": 100.0}]'::jsonb),
('Top 3', 'top_n', 3, '[{"place": 1, "percentage": 50.0}, {"place": 2, "percentage": 30.0}, {"place": 3, "percentage": 20.0}]'::jsonb),
('Top 10%', 'percentage', 10, '[{"place": 1, "percentage": 20.0}, {"place": 2, "percentage": 15.0}, {"place": 3, "percentage": 10.0}]'::jsonb),
('Double Up', 'double_up', 50, '[{"percentage": 100.0}]'::jsonb);

-- ----------------------------------------------------------------------------
-- DFS Payouts (Prize Distributions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  entry_id UUID NOT NULL REFERENCES dfs_entries(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES dfs_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Prize Details
  place INTEGER NOT NULL,
  prize_amount DECIMAL(10, 2) NOT NULL,
  
  -- Payment Processing
  status dfs_payout_status NOT NULL DEFAULT 'pending',
  payment_method TEXT, -- stripe, paypal, credit, etc.
  transaction_id UUID, -- FK to dfs_transactions
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  CONSTRAINT valid_place CHECK (place >= 1),
  CONSTRAINT valid_prize CHECK (prize_amount >= 0)
);

-- Indexes
CREATE INDEX idx_dfs_payouts_entry ON dfs_payouts(entry_id);
CREATE INDEX idx_dfs_payouts_pool ON dfs_payouts(pool_id);
CREATE INDEX idx_dfs_payouts_user ON dfs_payouts(user_id);
CREATE INDEX idx_dfs_payouts_status ON dfs_payouts(status);

-- ----------------------------------------------------------------------------
-- DFS Transactions (Financial Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction Details
  transaction_type dfs_transaction_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  
  -- References
  pool_id UUID REFERENCES dfs_pools(id),
  entry_id UUID REFERENCES dfs_entries(id),
  payout_id UUID REFERENCES dfs_payouts(id),
  
  -- Description
  description TEXT,
  metadata JSONB,
  
  -- External Payment Reference
  external_transaction_id TEXT, -- Stripe, PayPal, etc.
  payment_method TEXT,
  
  -- Status
  is_processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_amount CHECK (amount != 0)
);

-- Indexes
CREATE INDEX idx_dfs_transactions_user ON dfs_transactions(user_id);
CREATE INDEX idx_dfs_transactions_type ON dfs_transactions(transaction_type);
CREATE INDEX idx_dfs_transactions_pool ON dfs_transactions(pool_id) WHERE pool_id IS NOT NULL;
CREATE INDEX idx_dfs_transactions_created ON dfs_transactions(created_at DESC);

-- ----------------------------------------------------------------------------
-- DFS User Balances (Account Balances)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_user_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Balances
  total_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  withdrawable_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  pending_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  bonus_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  
  -- Lifetime Stats
  lifetime_deposits DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  lifetime_withdrawals DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  lifetime_entries DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  lifetime_winnings DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  
  -- Counts
  total_contests_entered INTEGER NOT NULL DEFAULT 0,
  total_contests_won INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_balances CHECK (
    total_balance >= 0 AND
    withdrawable_balance >= 0 AND
    pending_balance >= 0 AND
    bonus_balance >= 0
  )
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dfs_pools_updated_at BEFORE UPDATE ON dfs_pools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dfs_entries_updated_at BEFORE UPDATE ON dfs_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dfs_lineups_updated_at BEFORE UPDATE ON dfs_lineups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dfs_lineup_positions_updated_at BEFORE UPDATE ON dfs_lineup_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dfs_user_balances_updated_at BEFORE UPDATE ON dfs_user_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE dfs_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_pool_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_lineup_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_player_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_prize_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_user_balances ENABLE ROW LEVEL SECURITY;

-- DFS Pools: Public can view, authenticated can create
CREATE POLICY "Public pools are viewable by everyone" ON dfs_pools
  FOR SELECT USING (is_public = TRUE OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create pools" ON dfs_pools
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Pool creators can update their pools" ON dfs_pools
  FOR UPDATE USING (created_by = auth.uid());

-- DFS Pool Games: Follow pool visibility
CREATE POLICY "Pool games follow pool visibility" ON dfs_pool_games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dfs_pools 
      WHERE dfs_pools.id = dfs_pool_games.pool_id 
      AND (dfs_pools.is_public = TRUE OR auth.uid() IS NOT NULL)
    )
  );

-- DFS Entries: Users can manage their own entries
CREATE POLICY "Users can view their own entries" ON dfs_entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create entries" ON dfs_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own entries" ON dfs_entries
  FOR UPDATE USING (user_id = auth.uid());

-- DFS Lineups: Users can manage their own lineups
CREATE POLICY "Users can view their own lineups" ON dfs_lineups
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create lineups" ON dfs_lineups
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own lineups" ON dfs_lineups
  FOR UPDATE USING (user_id = auth.uid() AND is_locked = FALSE);

-- DFS Lineup Positions: Users can manage their own lineup positions
CREATE POLICY "Users can view their own lineup positions" ON dfs_lineup_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dfs_lineups 
      WHERE dfs_lineups.id = dfs_lineup_positions.lineup_id 
      AND dfs_lineups.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create lineup positions" ON dfs_lineup_positions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dfs_lineups 
      WHERE dfs_lineups.id = lineup_id 
      AND dfs_lineups.user_id = auth.uid()
      AND dfs_lineups.is_locked = FALSE
    )
  );

CREATE POLICY "Users can update their lineup positions" ON dfs_lineup_positions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM dfs_lineups 
      WHERE dfs_lineups.id = dfs_lineup_positions.lineup_id 
      AND dfs_lineups.user_id = auth.uid()
      AND dfs_lineups.is_locked = FALSE
    )
  );

CREATE POLICY "Users can delete their lineup positions" ON dfs_lineup_positions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM dfs_lineups 
      WHERE dfs_lineups.id = dfs_lineup_positions.lineup_id 
      AND dfs_lineups.user_id = auth.uid()
      AND dfs_lineups.is_locked = FALSE
    )
  );

-- DFS Player Salaries: Public read for active pools
CREATE POLICY "Player salaries are viewable for active pools" ON dfs_player_salaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dfs_pools 
      WHERE dfs_pools.id = dfs_player_salaries.pool_id 
      AND dfs_pools.status IN ('scheduled', 'filling', 'guaranteed', 'live')
    )
  );

-- DFS Prize Structures: Public read
CREATE POLICY "Prize structures are viewable by everyone" ON dfs_prize_structures
  FOR SELECT USING (is_active = TRUE);

-- DFS Payouts: Users can view their own payouts
CREATE POLICY "Users can view their own payouts" ON dfs_payouts
  FOR SELECT USING (user_id = auth.uid());

-- DFS Transactions: Users can view their own transactions
CREATE POLICY "Users can view their own transactions" ON dfs_transactions
  FOR SELECT USING (user_id = auth.uid());

-- DFS User Balances: Users can view their own balance
CREATE POLICY "Users can view their own balance" ON dfs_user_balances
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own balance" ON dfs_user_balances
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Initialize user balance
CREATE OR REPLACE FUNCTION initialize_dfs_user_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO dfs_user_balances (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create balance on user creation
-- Note: This assumes auth.users is accessible. Adjust if needed.

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Active Pools with Entry Counts
CREATE OR REPLACE VIEW dfs_active_pools_summary AS
SELECT 
  p.*,
  COUNT(e.id) as total_entries,
  COUNT(DISTINCT e.user_id) as unique_users,
  (p.prize_pool - (p.prize_pool * p.rake_percentage / 100)) as net_prize_pool,
  (p.current_entries::DECIMAL / NULLIF(p.max_entries, 0) * 100) as fill_percentage
FROM dfs_pools p
LEFT JOIN dfs_entries e ON p.id = e.pool_id AND e.status = 'active'
WHERE p.status IN ('scheduled', 'filling', 'guaranteed', 'live')
GROUP BY p.id;

-- View: Pool Leaderboard
CREATE OR REPLACE VIEW dfs_pool_leaderboards AS
SELECT 
  e.pool_id,
  e.id as entry_id,
  e.user_id,
  e.entry_name,
  e.final_score,
  e.rank,
  e.prize_amount,
  p.name as pool_name,
  p.status as pool_status
FROM dfs_entries e
JOIN dfs_pools p ON e.pool_id = p.id
WHERE e.status = 'completed' AND e.is_public = TRUE
ORDER BY e.pool_id, e.rank;

-- View: User DFS Stats
CREATE OR REPLACE VIEW dfs_user_statistics AS
SELECT 
  e.user_id,
  COUNT(DISTINCT e.pool_id) as contests_entered,
  COUNT(*) as total_entries,
  SUM(e.entry_fee_paid) as total_spent,
  SUM(e.prize_amount) as total_winnings,
  SUM(e.prize_amount) - SUM(e.entry_fee_paid) as net_profit,
  AVG(e.final_score) as avg_score,
  COUNT(*) FILTER (WHERE e.rank = 1) as first_place_finishes,
  COUNT(*) FILTER (WHERE e.rank <= 3) as top_3_finishes,
  COUNT(*) FILTER (WHERE e.prize_amount > 0) as cashes
FROM dfs_entries e
WHERE e.status = 'completed'
GROUP BY e.user_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE dfs_pools IS 'Daily fantasy sports contest pools with unique 3-unit lineup structure';
COMMENT ON TABLE dfs_pool_games IS 'Games included in each DFS pool slate';
COMMENT ON TABLE dfs_entries IS 'User entries into DFS contests';
COMMENT ON TABLE dfs_lineups IS 'Lineup configurations for contest entries';
COMMENT ON TABLE dfs_lineup_positions IS 'Individual player positions in lineups with unit multipliers';
COMMENT ON TABLE dfs_player_salaries IS 'Player salaries for specific pools and slates';
COMMENT ON TABLE dfs_prize_structures IS 'Prize distribution templates';
COMMENT ON TABLE dfs_payouts IS 'Prize payouts to users';
COMMENT ON TABLE dfs_transactions IS 'Financial transaction ledger';
COMMENT ON TABLE dfs_user_balances IS 'User account balances and lifetime statistics';

COMMENT ON COLUMN dfs_lineup_positions.unit_multiplier IS 'Starters: 1.0x, Rotation: 0.75x, Bench: 0.5x';
COMMENT ON COLUMN dfs_lineup_positions.weighted_points IS 'raw_fantasy_points * unit_multiplier';
COMMENT ON COLUMN dfs_pools.salary_cap IS 'Elite: $154.6M, Pro: $195.9M, Standard: $207.8M';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

