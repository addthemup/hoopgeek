-- ============================================================================
-- DFS Points System
-- ============================================================================
-- This migration creates the points system for DFS pools, allowing users to
-- accrue points for entering and placing/winning pools. Points lead to
-- achievements, badges, and trophies.

-- ----------------------------------------------------------------------------
-- 1. User Points (Total points per user)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Point Totals
  total_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0, -- Never decreases
  
  -- Statistics
  total_entries INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_top_10 INTEGER NOT NULL DEFAULT 0,
  total_top_25 INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_points CHECK (total_points >= 0 AND lifetime_points >= 0),
  CONSTRAINT valid_stats CHECK (
    total_entries >= 0 AND
    total_wins >= 0 AND
    total_top_10 >= 0 AND
    total_top_25 >= 0
  ),
  
  -- One record per user
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_dfs_user_points_user ON dfs_user_points(user_id);
CREATE INDEX idx_dfs_user_points_total ON dfs_user_points(total_points DESC);
CREATE INDEX idx_dfs_user_points_lifetime ON dfs_user_points(lifetime_points DESC);

-- ----------------------------------------------------------------------------
-- 2. Point Transactions (History of all point changes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Transaction Details
  points INTEGER NOT NULL, -- Can be positive or negative
  transaction_type TEXT NOT NULL, -- 'entry', 'win', 'placement', 'achievement', 'adjustment', 'penalty'
  description TEXT,
  
  -- Related Entities
  pool_id UUID REFERENCES dfs_pools(id) ON DELETE SET NULL,
  entry_id UUID REFERENCES dfs_entries(id) ON DELETE SET NULL,
  achievement_id UUID, -- FK to dfs_achievements (set later)
  
  -- Placement Details (for win/placement transactions)
  rank INTEGER,
  percentile DECIMAL(5, 2),
  placement_tier TEXT, -- '1st', 'top_10', 'top_25', etc.
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_points CHECK (points != 0)
);

-- Indexes
CREATE INDEX idx_dfs_point_transactions_user ON dfs_point_transactions(user_id);
CREATE INDEX idx_dfs_point_transactions_pool ON dfs_point_transactions(pool_id);
CREATE INDEX idx_dfs_point_transactions_entry ON dfs_point_transactions(entry_id);
CREATE INDEX idx_dfs_point_transactions_type ON dfs_point_transactions(transaction_type);
CREATE INDEX idx_dfs_point_transactions_created ON dfs_point_transactions(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Achievements (Milestone definitions)
-- ----------------------------------------------------------------------------
CREATE TYPE dfs_achievement_type AS ENUM (
  'first_win',
  'win_streak',
  'total_wins',
  'total_points',
  'total_entries',
  'top_10_count',
  'top_25_count',
  'perfect_lineup',
  'comeback_win',
  'underdog_win'
);

CREATE TABLE IF NOT EXISTS public.dfs_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Achievement Details
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  achievement_type dfs_achievement_type NOT NULL,
  icon_name TEXT, -- Icon identifier (e.g., 'FaTrophy', 'FaMedal')
  icon_color TEXT DEFAULT '#FFC72C', -- Primary color
  
  -- Requirements
  requirement_value INTEGER NOT NULL, -- e.g., 100 for "100 wins"
  requirement_condition JSONB, -- Additional conditions if needed
  
  -- Rewards
  points_reward INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  rarity TEXT DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_requirement CHECK (requirement_value > 0),
  CONSTRAINT valid_points_reward CHECK (points_reward >= 0)
);

-- Indexes
CREATE INDEX idx_dfs_achievements_type ON dfs_achievements(achievement_type);
CREATE INDEX idx_dfs_achievements_active ON dfs_achievements(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_dfs_achievements_display_order ON dfs_achievements(display_order);

-- ----------------------------------------------------------------------------
-- 4. User Achievements (Users who have earned achievements)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES dfs_achievements(id) ON DELETE CASCADE,
  
  -- Achievement Details
  earned_at TIMESTAMPTZ DEFAULT now(),
  progress_value INTEGER, -- Progress toward achievement (if applicable)
  
  -- Metadata
  metadata JSONB,
  
  -- One achievement per user (can't earn same achievement twice)
  UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX idx_dfs_user_achievements_user ON dfs_user_achievements(user_id);
CREATE INDEX idx_dfs_user_achievements_achievement ON dfs_user_achievements(achievement_id);
CREATE INDEX idx_dfs_user_achievements_earned ON dfs_user_achievements(earned_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Trophies (Special recognition items)
-- ----------------------------------------------------------------------------
CREATE TYPE dfs_trophy_type AS ENUM (
  'champion',      -- Won a pool
  'runner_up',     -- 2nd place
  'top_10',        -- Top 10 finish
  'top_25',        -- Top 25 finish
  'milestone',     -- Reached milestone
  'streak',        -- Win streak
  'perfect'        -- Perfect lineup
);

CREATE TABLE IF NOT EXISTS public.dfs_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trophy Details
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  trophy_type dfs_trophy_type NOT NULL,
  icon_name TEXT,
  icon_color TEXT DEFAULT '#FFD700', -- Gold
  
  -- Requirements
  requirement_value INTEGER, -- e.g., 10 for "10 wins"
  requirement_condition JSONB,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  rarity TEXT DEFAULT 'common',
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dfs_trophies_type ON dfs_trophies(trophy_type);
CREATE INDEX idx_dfs_trophies_active ON dfs_trophies(is_active) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- 6. User Trophies (Users who have earned trophies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_user_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trophy_id UUID NOT NULL REFERENCES dfs_trophies(id) ON DELETE CASCADE,
  
  -- Trophy Details
  earned_at TIMESTAMPTZ DEFAULT now(),
  pool_id UUID REFERENCES dfs_pools(id) ON DELETE SET NULL, -- Which pool earned it
  entry_id UUID REFERENCES dfs_entries(id) ON DELETE SET NULL, -- Which entry earned it
  
  -- Metadata
  metadata JSONB
  
  -- Users can earn same trophy multiple times (e.g., multiple wins)
  -- No unique constraint
);

-- Indexes
CREATE INDEX idx_dfs_user_trophies_user ON dfs_user_trophies(user_id);
CREATE INDEX idx_dfs_user_trophies_trophy ON dfs_user_trophies(trophy_id);
CREATE INDEX idx_dfs_user_trophies_pool ON dfs_user_trophies(pool_id);
CREATE INDEX idx_dfs_user_trophies_earned ON dfs_user_trophies(earned_at DESC);

-- ----------------------------------------------------------------------------
-- 7. Function to Award Points
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_dfs_points(
  p_user_id UUID,
  p_points INTEGER,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_pool_id UUID DEFAULT NULL,
  p_entry_id UUID DEFAULT NULL,
  p_rank INTEGER DEFAULT NULL,
  p_percentile DECIMAL DEFAULT NULL,
  p_placement_tier TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_current_points INTEGER;
BEGIN
  -- Validate points
  IF p_points = 0 THEN
    RAISE EXCEPTION 'Points must be non-zero';
  END IF;
  
  -- Create transaction record
  INSERT INTO dfs_point_transactions (
    user_id,
    points,
    transaction_type,
    description,
    pool_id,
    entry_id,
    rank,
    percentile,
    placement_tier,
    metadata
  ) VALUES (
    p_user_id,
    p_points,
    p_transaction_type,
    p_description,
    p_pool_id,
    p_entry_id,
    p_rank,
    p_percentile,
    p_placement_tier,
    p_metadata
  )
  RETURNING id INTO v_transaction_id;
  
  -- Update or create user points record
  INSERT INTO dfs_user_points (user_id, total_points, lifetime_points)
  VALUES (p_user_id, p_points, GREATEST(0, p_points))
  ON CONFLICT (user_id) DO UPDATE SET
    total_points = dfs_user_points.total_points + p_points,
    lifetime_points = dfs_user_points.lifetime_points + GREATEST(0, p_points),
    updated_at = now();
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 8. Function to Check and Award Achievements
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_and_award_achievements(
  p_user_id UUID
)
RETURNS TABLE(
  achievement_id UUID,
  achievement_name TEXT,
  points_awarded INTEGER
) AS $$
DECLARE
  v_user_stats RECORD;
  v_achievement RECORD;
  v_earned_count INTEGER;
BEGIN
  -- Get user statistics
  SELECT 
    COALESCE(up.total_wins, 0) as total_wins,
    COALESCE(up.total_points, 0) as total_points,
    COALESCE(up.total_entries, 0) as total_entries,
    COALESCE(up.total_top_10, 0) as total_top_10,
    COALESCE(up.total_top_25, 0) as total_top_25
  INTO v_user_stats
  FROM dfs_user_points up
  WHERE up.user_id = p_user_id;
  
  -- If user has no stats, return empty
  IF v_user_stats IS NULL THEN
    RETURN;
  END IF;
  
  -- Check all active achievements
  FOR v_achievement IN
    SELECT * FROM dfs_achievements
    WHERE is_active = TRUE
  LOOP
    -- Check if user already has this achievement
    SELECT COUNT(*) INTO v_earned_count
    FROM dfs_user_achievements
    WHERE user_id = p_user_id AND achievement_id = v_achievement.id;
    
    -- Skip if already earned
    IF v_earned_count > 0 THEN
      CONTINUE;
    END IF;
    
    -- Check achievement requirements based on type
    CASE v_achievement.achievement_type
      WHEN 'first_win' THEN
        IF v_user_stats.total_wins >= 1 THEN
          -- Award achievement
          INSERT INTO dfs_user_achievements (user_id, achievement_id)
          VALUES (p_user_id, v_achievement.id)
          ON CONFLICT DO NOTHING;
          
          -- Award points if any
          IF v_achievement.points_reward > 0 THEN
            PERFORM award_dfs_points(
              p_user_id,
              v_achievement.points_reward,
              'achievement',
              'Achievement: ' || v_achievement.name,
              NULL,
              NULL,
              NULL,
              NULL,
              NULL,
              jsonb_build_object('achievement_id', v_achievement.id)
            );
          END IF;
          
          RETURN QUERY SELECT v_achievement.id, v_achievement.name, v_achievement.points_reward;
        END IF;
        
      WHEN 'total_wins' THEN
        IF v_user_stats.total_wins >= v_achievement.requirement_value THEN
          INSERT INTO dfs_user_achievements (user_id, achievement_id)
          VALUES (p_user_id, v_achievement.id)
          ON CONFLICT DO NOTHING;
          
          IF v_achievement.points_reward > 0 THEN
            PERFORM award_dfs_points(
              p_user_id,
              v_achievement.points_reward,
              'achievement',
              'Achievement: ' || v_achievement.name,
              NULL,
              NULL,
              NULL,
              NULL,
              NULL,
              jsonb_build_object('achievement_id', v_achievement.id)
            );
          END IF;
          
          RETURN QUERY SELECT v_achievement.id, v_achievement.name, v_achievement.points_reward;
        END IF;
        
      WHEN 'total_points' THEN
        IF v_user_stats.total_points >= v_achievement.requirement_value THEN
          INSERT INTO dfs_user_achievements (user_id, achievement_id)
          VALUES (p_user_id, v_achievement.id)
          ON CONFLICT DO NOTHING;
          
          IF v_achievement.points_reward > 0 THEN
            PERFORM award_dfs_points(
              p_user_id,
              v_achievement.points_reward,
              'achievement',
              'Achievement: ' || v_achievement.name,
              NULL,
              NULL,
              NULL,
              NULL,
              NULL,
              jsonb_build_object('achievement_id', v_achievement.id)
            );
          END IF;
          
          RETURN QUERY SELECT v_achievement.id, v_achievement.name, v_achievement.points_reward;
        END IF;
        
      WHEN 'total_entries' THEN
        IF v_user_stats.total_entries >= v_achievement.requirement_value THEN
          INSERT INTO dfs_user_achievements (user_id, achievement_id)
          VALUES (p_user_id, v_achievement.id)
          ON CONFLICT DO NOTHING;
          
          IF v_achievement.points_reward > 0 THEN
            PERFORM award_dfs_points(
              p_user_id,
              v_achievement.points_reward,
              'achievement',
              'Achievement: ' || v_achievement.name,
              NULL,
              NULL,
              NULL,
              NULL,
              NULL,
              jsonb_build_object('achievement_id', v_achievement.id)
            );
          END IF;
          
          RETURN QUERY SELECT v_achievement.id, v_achievement.name, v_achievement.points_reward;
        END IF;
        
      WHEN 'top_10_count' THEN
        IF v_user_stats.total_top_10 >= v_achievement.requirement_value THEN
          INSERT INTO dfs_user_achievements (user_id, achievement_id)
          VALUES (p_user_id, v_achievement.id)
          ON CONFLICT DO NOTHING;
          
          IF v_achievement.points_reward > 0 THEN
            PERFORM award_dfs_points(
              p_user_id,
              v_achievement.points_reward,
              'achievement',
              'Achievement: ' || v_achievement.name,
              NULL,
              NULL,
              NULL,
              NULL,
              NULL,
              jsonb_build_object('achievement_id', v_achievement.id)
            );
          END IF;
          
          RETURN QUERY SELECT v_achievement.id, v_achievement.name, v_achievement.points_reward;
        END IF;
        
      WHEN 'top_25_count' THEN
        IF v_user_stats.total_top_25 >= v_achievement.requirement_value THEN
          INSERT INTO dfs_user_achievements (user_id, achievement_id)
          VALUES (p_user_id, v_achievement.id)
          ON CONFLICT DO NOTHING;
          
          IF v_achievement.points_reward > 0 THEN
            PERFORM award_dfs_points(
              p_user_id,
              v_achievement.points_reward,
              'achievement',
              'Achievement: ' || v_achievement.name,
              NULL,
              NULL,
              NULL,
              NULL,
              NULL,
              jsonb_build_object('achievement_id', v_achievement.id)
            );
          END IF;
          
          RETURN QUERY SELECT v_achievement.id, v_achievement.name, v_achievement.points_reward;
        END IF;
        
      -- Add more achievement types as needed
      ELSE
        -- Unknown achievement type, skip
        CONTINUE;
    END CASE;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 9. Insert Default Achievements
-- ----------------------------------------------------------------------------
INSERT INTO dfs_achievements (name, description, achievement_type, icon_name, points_reward, requirement_value, rarity, display_order) VALUES
('First Win', 'Win your first DFS pool', 'first_win', 'FaTrophy', 100, 1, 'common', 1),
('10 Wins', 'Win 10 DFS pools', 'total_wins', 'FaMedal', 500, 10, 'rare', 2),
('50 Wins', 'Win 50 DFS pools', 'total_wins', 'FaCrown', 2500, 50, 'epic', 3),
('100 Wins', 'Win 100 DFS pools', 'total_wins', 'FaGem', 10000, 100, 'legendary', 4),
('100 Points', 'Accumulate 100 points', 'total_points', 'FaStar', 50, 100, 'common', 5),
('500 Points', 'Accumulate 500 points', 'total_points', 'FaStar', 250, 500, 'rare', 6),
('1000 Points', 'Accumulate 1,000 points', 'total_points', 'FaStar', 1000, 1000, 'epic', 7),
('5000 Points', 'Accumulate 5,000 points', 'total_points', 'FaStar', 5000, 5000, 'legendary', 8),
('10 Entries', 'Enter 10 pools', 'total_entries', 'FaCheckCircle', 50, 10, 'common', 9),
('50 Entries', 'Enter 50 pools', 'total_entries', 'FaCheckCircle', 250, 50, 'rare', 10),
('100 Entries', 'Enter 100 pools', 'total_entries', 'FaCheckCircle', 1000, 100, 'epic', 11),
('10 Top 10s', 'Finish in top 10 ten times', 'top_10_count', 'FaAward', 500, 10, 'rare', 12),
('25 Top 10s', 'Finish in top 10 twenty-five times', 'top_10_count', 'FaAward', 2500, 25, 'epic', 13);

-- ----------------------------------------------------------------------------
-- 10. RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE dfs_user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_trophies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_user_trophies ENABLE ROW LEVEL SECURITY;

-- User Points: Users can read their own, everyone can read public leaderboards
CREATE POLICY "Users can view their own points" ON dfs_user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view leaderboard" ON dfs_user_points
  FOR SELECT USING (true); -- Public leaderboard

-- Point Transactions: Users can view their own
CREATE POLICY "Users can view their own transactions" ON dfs_point_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Achievements: Everyone can read
CREATE POLICY "Everyone can view achievements" ON dfs_achievements
  FOR SELECT USING (true);

-- User Achievements: Users can view their own, everyone can view others
CREATE POLICY "Everyone can view user achievements" ON dfs_user_achievements
  FOR SELECT USING (true);

-- Trophies: Everyone can read
CREATE POLICY "Everyone can view trophies" ON dfs_trophies
  FOR SELECT USING (true);

-- User Trophies: Everyone can view
CREATE POLICY "Everyone can view user trophies" ON dfs_user_trophies
  FOR SELECT USING (true);

