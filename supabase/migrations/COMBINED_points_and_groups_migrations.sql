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

-- ============================================================================
-- DFS Groups System
-- ============================================================================
-- This migration creates the groups system, allowing users to create groups
-- and create private pools for group members.

-- ----------------------------------------------------------------------------
-- 1. DFS Groups
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Group Information
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier
  
  -- Group Settings
  is_public BOOLEAN DEFAULT FALSE, -- Public groups appear in search
  is_open BOOLEAN DEFAULT TRUE, -- Open groups allow anyone to join
  max_members INTEGER, -- NULL = unlimited
  
  -- Group Avatar/Icon
  avatar_url TEXT,
  icon_name TEXT,
  icon_color_primary TEXT DEFAULT '#FFC72C',
  icon_color_secondary TEXT DEFAULT '#000000',
  
  -- Group Statistics
  member_count INTEGER NOT NULL DEFAULT 0,
  pool_count INTEGER NOT NULL DEFAULT 0,
  total_entries INTEGER NOT NULL DEFAULT 0,
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_member_count CHECK (member_count >= 0),
  CONSTRAINT valid_pool_count CHECK (pool_count >= 0),
  CONSTRAINT valid_total_entries CHECK (total_entries >= 0),
  CONSTRAINT valid_max_members CHECK (max_members IS NULL OR max_members > 0)
);

-- Indexes
CREATE INDEX idx_dfs_groups_owner ON dfs_groups(owner_id);
CREATE INDEX idx_dfs_groups_created_by ON dfs_groups(created_by);
CREATE INDEX idx_dfs_groups_slug ON dfs_groups(slug);
CREATE INDEX idx_dfs_groups_public ON dfs_groups(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_dfs_groups_open ON dfs_groups(is_open) WHERE is_open = TRUE;
CREATE INDEX idx_dfs_groups_created_at ON dfs_groups(created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. DFS Group Members
-- ----------------------------------------------------------------------------
CREATE TYPE dfs_group_role AS ENUM (
  'owner',      -- Group creator/owner
  'admin',      -- Can manage group and create pools
  'member'      -- Regular member
);

CREATE TABLE IF NOT EXISTS public.dfs_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES dfs_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Member Details
  role dfs_group_role NOT NULL DEFAULT 'member',
  nickname TEXT, -- Optional nickname in this group
  
  -- Member Statistics (within this group)
  total_entries INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  
  -- Invitation Details
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitation_token TEXT, -- For invite links
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_member_stats CHECK (
    total_entries >= 0 AND
    total_wins >= 0 AND
    total_points >= 0
  ),
  
  -- One membership per user per group
  UNIQUE(group_id, user_id)
);

-- Indexes
CREATE INDEX idx_dfs_group_members_group ON dfs_group_members(group_id);
CREATE INDEX idx_dfs_group_members_user ON dfs_group_members(user_id);
CREATE INDEX idx_dfs_group_members_role ON dfs_group_members(group_id, role);
CREATE INDEX idx_dfs_group_members_active ON dfs_group_members(group_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_dfs_group_members_points ON dfs_group_members(group_id, total_points DESC);

-- ----------------------------------------------------------------------------
-- 3. DFS Group Pools (Link pools to groups)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dfs_group_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES dfs_groups(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES dfs_pools(id) ON DELETE CASCADE,
  
  -- Pool Details
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- One pool can only belong to one group
  UNIQUE(pool_id)
);

-- Indexes
CREATE INDEX idx_dfs_group_pools_group ON dfs_group_pools(group_id);
CREATE INDEX idx_dfs_group_pools_pool ON dfs_group_pools(pool_id);
CREATE INDEX idx_dfs_group_pools_created_by ON dfs_group_pools(created_by);

-- ----------------------------------------------------------------------------
-- 4. Function to Create Group
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_dfs_group(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT FALSE,
  p_is_open BOOLEAN DEFAULT TRUE,
  p_max_members INTEGER DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_icon_name TEXT DEFAULT NULL,
  p_icon_color_primary TEXT DEFAULT '#FFC72C',
  p_icon_color_secondary TEXT DEFAULT '#000000'
)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
  v_user_id UUID;
  v_slug TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Generate slug if not provided
  IF p_slug IS NULL OR p_slug = '' THEN
    v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM dfs_groups WHERE slug = v_slug) LOOP
      v_slug := v_slug || '-' || floor(random() * 1000)::text;
    END LOOP;
  ELSE
    v_slug := lower(regexp_replace(p_slug, '[^a-zA-Z0-9]+', '-', 'g'));
    -- Check if slug already exists
    IF EXISTS (SELECT 1 FROM dfs_groups WHERE slug = v_slug) THEN
      RAISE EXCEPTION 'Group slug already exists';
    END IF;
  END IF;
  
  -- Create group
  INSERT INTO dfs_groups (
    name,
    description,
    slug,
    is_public,
    is_open,
    max_members,
    avatar_url,
    icon_name,
    icon_color_primary,
    icon_color_secondary,
    created_by,
    owner_id
  ) VALUES (
    p_name,
    p_description,
    v_slug,
    p_is_public,
    p_is_open,
    p_max_members,
    p_avatar_url,
    p_icon_name,
    p_icon_color_primary,
    p_icon_color_secondary,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_group_id;
  
  -- Add creator as owner
  INSERT INTO dfs_group_members (
    group_id,
    user_id,
    role,
    is_active
  ) VALUES (
    v_group_id,
    v_user_id,
    'owner',
    TRUE
  );
  
  -- Update member count
  UPDATE dfs_groups SET member_count = 1 WHERE id = v_group_id;
  
  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. Function to Join Group
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_dfs_group(
  p_group_id UUID,
  p_invitation_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_group RECORD;
  v_member_count INTEGER;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Get group details
  SELECT * INTO v_group FROM dfs_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group not found';
  END IF;
  
  -- Check if group is open or user has valid invitation
  IF NOT v_group.is_open THEN
    IF p_invitation_token IS NULL THEN
      RAISE EXCEPTION 'Group is closed and requires invitation';
    END IF;
    -- TODO: Validate invitation token
  END IF;
  
  -- Check if already a member
  IF EXISTS (SELECT 1 FROM dfs_group_members WHERE group_id = p_group_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'User is already a member of this group';
  END IF;
  
  -- Check member limit
  IF v_group.max_members IS NOT NULL THEN
    SELECT COUNT(*) INTO v_member_count
    FROM dfs_group_members
    WHERE group_id = p_group_id AND is_active = TRUE;
    
    IF v_member_count >= v_group.max_members THEN
      RAISE EXCEPTION 'Group has reached maximum member limit';
    END IF;
  END IF;
  
  -- Add member
  INSERT INTO dfs_group_members (
    group_id,
    user_id,
    role,
    is_active,
    invitation_token
  ) VALUES (
    p_group_id,
    v_user_id,
    'member',
    TRUE,
    p_invitation_token
  );
  
  -- Update member count
  UPDATE dfs_groups SET member_count = member_count + 1 WHERE id = p_group_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 6. Function to Leave Group
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION leave_dfs_group(
  p_group_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_member RECORD;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Get member record
  SELECT * INTO v_member FROM dfs_group_members
  WHERE group_id = p_group_id AND user_id = v_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;
  
  -- Cannot leave if owner (must transfer ownership first)
  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'Owner cannot leave group. Transfer ownership first.';
  END IF;
  
  -- Remove member
  UPDATE dfs_group_members
  SET is_active = FALSE, updated_at = now()
  WHERE group_id = p_group_id AND user_id = v_user_id;
  
  -- Update member count
  UPDATE dfs_groups SET member_count = GREATEST(0, member_count - 1) WHERE id = p_group_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 7. Function to Link Pool to Group
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION link_pool_to_group(
  p_group_id UUID,
  p_pool_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_group_member RECORD;
  v_link_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user is member of group
  SELECT * INTO v_group_member FROM dfs_group_members
  WHERE group_id = p_group_id AND user_id = v_user_id AND is_active = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;
  
  -- Check if pool already linked to a group
  IF EXISTS (SELECT 1 FROM dfs_group_pools WHERE pool_id = p_pool_id) THEN
    RAISE EXCEPTION 'Pool is already linked to a group';
  END IF;
  
  -- Link pool to group
  INSERT INTO dfs_group_pools (
    group_id,
    pool_id,
    created_by
  ) VALUES (
    p_group_id,
    p_pool_id,
    v_user_id
  )
  RETURNING id INTO v_link_id;
  
  -- Update group pool count
  UPDATE dfs_groups SET pool_count = pool_count + 1 WHERE id = p_group_id;
  
  RETURN v_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 8. Trigger to Update Group Stats
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_dfs_group_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update member count when member joins
    UPDATE dfs_groups
    SET member_count = (
      SELECT COUNT(*) FROM dfs_group_members
      WHERE group_id = NEW.group_id AND is_active = TRUE
    )
    WHERE id = NEW.group_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update member count if active status changes
    IF OLD.is_active != NEW.is_active THEN
      UPDATE dfs_groups
      SET member_count = (
        SELECT COUNT(*) FROM dfs_group_members
        WHERE group_id = NEW.group_id AND is_active = TRUE
      )
      WHERE id = NEW.group_id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_group_member_count
  AFTER INSERT OR UPDATE ON dfs_group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_dfs_group_stats();

-- ----------------------------------------------------------------------------
-- 9. RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE dfs_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_group_pools ENABLE ROW LEVEL SECURITY;

-- Groups: Public groups visible to all, private groups visible to members
CREATE POLICY "Public groups are visible to all" ON dfs_groups
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Members can view their groups" ON dfs_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dfs_group_members
      WHERE group_id = dfs_groups.id
      AND user_id = auth.uid()
      AND is_active = TRUE
    )
  );

CREATE POLICY "Owners can update their groups" ON dfs_groups
  FOR UPDATE USING (owner_id = auth.uid());

-- Group Members: Members can view members of their groups
CREATE POLICY "Members can view group members" ON dfs_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dfs_group_members gm
      WHERE gm.group_id = dfs_group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.is_active = TRUE
    )
  );

CREATE POLICY "Users can view their own memberships" ON dfs_group_members
  FOR SELECT USING (user_id = auth.uid());

-- Group Pools: Members can view pools in their groups
CREATE POLICY "Members can view group pools" ON dfs_group_pools
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dfs_group_members
      WHERE group_id = dfs_group_pools.group_id
      AND user_id = auth.uid()
      AND is_active = TRUE
    )
  );

-- ============================================================================
-- Add Points Configuration to DFS Pools
-- ============================================================================
-- This migration adds point configuration fields to dfs_pools and creates
-- functions to automatically award points when entries are submitted and
-- when pools are finalized.

-- ----------------------------------------------------------------------------
-- 1. Add Point Configuration Columns to dfs_pools
-- ----------------------------------------------------------------------------
ALTER TABLE dfs_pools
ADD COLUMN IF NOT EXISTS points_entry INTEGER DEFAULT 10, -- Points for entering
ADD COLUMN IF NOT EXISTS points_win INTEGER DEFAULT 100, -- Points for 1st place
ADD COLUMN IF NOT EXISTS points_placement JSONB DEFAULT '[]'::jsonb, -- Incremental points for placements
ADD COLUMN IF NOT EXISTS points_top_percent JSONB DEFAULT '[]'::jsonb, -- Points for top N%
ADD COLUMN IF NOT EXISTS points_enabled BOOLEAN DEFAULT TRUE; -- Enable/disable points for this pool

-- Example points_placement: [{"rank": 1, "points": 100}, {"rank": 2, "points": 75}, {"rank": 3, "points": 50}]
-- Example points_top_percent: [{"percent": 10, "points": 25}, {"percent": 25, "points": 10}]

-- Add constraints
ALTER TABLE dfs_pools
ADD CONSTRAINT valid_points_entry CHECK (points_entry >= 0),
ADD CONSTRAINT valid_points_win CHECK (points_win >= 0);

-- ----------------------------------------------------------------------------
-- 2. Function to Award Entry Points
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_entry_points(
  p_entry_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_entry RECORD;
  v_pool RECORD;
  v_points INTEGER;
BEGIN
  -- Get entry details
  SELECT * INTO v_entry
  FROM dfs_entries
  WHERE id = p_entry_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get pool details
  SELECT * INTO v_pool
  FROM dfs_pools
  WHERE id = v_entry.pool_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if points are enabled for this pool
  IF NOT v_pool.points_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Check if entry is submitted
  IF NOT v_entry.is_submitted THEN
    RETURN FALSE;
  END IF;
  
  -- Check if points already awarded for this entry
  IF EXISTS (
    SELECT 1 FROM dfs_point_transactions
    WHERE entry_id = p_entry_id
    AND transaction_type = 'entry'
  ) THEN
    RETURN FALSE; -- Already awarded
  END IF;
  
  -- Award entry points
  v_points := COALESCE(v_pool.points_entry, 10);
  
  PERFORM award_dfs_points(
    v_entry.user_id,
    v_points,
    'entry',
    'Entry points for pool: ' || v_pool.name,
    v_pool.id,
    p_entry_id,
    NULL,
    NULL,
    NULL,
    jsonb_build_object('pool_name', v_pool.name)
  );
  
  -- Update user stats
  UPDATE dfs_user_points
  SET total_entries = total_entries + 1
  WHERE user_id = v_entry.user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. Function to Award Placement Points
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION award_placement_points(
  p_entry_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_entry RECORD;
  v_pool RECORD;
  v_points INTEGER := 0;
  v_placement_points INTEGER := 0;
  v_top_percent_points INTEGER := 0;
  v_placement_tier TEXT;
  v_placement_config JSONB;
  v_percent_config JSONB;
BEGIN
  -- Get entry details
  SELECT * INTO v_entry
  FROM dfs_entries
  WHERE id = p_entry_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get pool details
  SELECT * INTO v_pool
  FROM dfs_pools
  WHERE id = v_entry.pool_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if points are enabled
  IF NOT v_pool.points_enabled THEN
    RETURN FALSE;
  END IF;
  
  -- Check if entry has a rank
  IF v_entry.rank IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if points already awarded for this placement
  IF EXISTS (
    SELECT 1 FROM dfs_point_transactions
    WHERE entry_id = p_entry_id
    AND transaction_type = 'placement'
  ) THEN
    RETURN FALSE; -- Already awarded
  END IF;
  
  -- Calculate points from placement config (rank-based)
  IF v_pool.points_placement IS NOT NULL AND jsonb_array_length(v_pool.points_placement) > 0 THEN
    -- Check each placement tier
    FOR v_placement_config IN SELECT * FROM jsonb_array_elements(v_pool.points_placement)
    LOOP
      IF (v_placement_config->>'rank')::INTEGER = v_entry.rank THEN
        v_placement_points := (v_placement_config->>'points')::INTEGER;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- If 1st place and no placement config, use points_win
  IF v_entry.rank = 1 AND v_placement_points = 0 THEN
    v_placement_points := COALESCE(v_pool.points_win, 100);
    v_placement_tier := '1st';
  ELSIF v_entry.rank = 2 THEN
    v_placement_tier := '2nd';
  ELSIF v_entry.rank = 3 THEN
    v_placement_tier := '3rd';
  ELSE
    v_placement_tier := v_entry.rank::TEXT || 'th';
  END IF;
  
  -- Calculate points from top percent config
  IF v_pool.points_top_percent IS NOT NULL AND jsonb_array_length(v_pool.points_top_percent) > 0 THEN
    -- Check each percent tier
    FOR v_percent_config IN SELECT * FROM jsonb_array_elements(v_pool.points_top_percent)
    LOOP
      DECLARE
        v_percent DECIMAL;
      BEGIN
        v_percent := (v_percent_config->>'percent')::DECIMAL;
        IF v_entry.percentile IS NOT NULL AND v_entry.percentile <= v_percent THEN
          v_top_percent_points := GREATEST(v_top_percent_points, (v_percent_config->>'points')::INTEGER);
        END IF;
      END;
    END LOOP;
  END IF;
  
  -- Use the higher of placement or percent points
  v_points := GREATEST(v_placement_points, v_top_percent_points);
  
  -- Award points if any
  IF v_points > 0 THEN
    PERFORM award_dfs_points(
      v_entry.user_id,
      v_points,
      'placement',
      'Placement points for pool: ' || v_pool.name || ' (Rank: ' || v_entry.rank || ')',
      v_pool.id,
      p_entry_id,
      v_entry.rank,
      v_entry.percentile,
      v_placement_tier,
      jsonb_build_object(
        'pool_name', v_pool.name,
        'rank', v_entry.rank,
        'percentile', v_entry.percentile
      )
    );
    
    -- Update user stats
    IF v_entry.rank = 1 THEN
      UPDATE dfs_user_points
      SET total_wins = total_wins + 1
      WHERE user_id = v_entry.user_id;
    END IF;
    
    IF v_entry.rank <= 10 THEN
      UPDATE dfs_user_points
      SET total_top_10 = total_top_10 + 1
      WHERE user_id = v_entry.user_id;
    END IF;
    
    IF v_entry.rank <= 25 THEN
      UPDATE dfs_user_points
      SET total_top_25 = total_top_25 + 1
      WHERE user_id = v_entry.user_id;
    END IF;
    
    -- Check for achievements
    PERFORM check_and_award_achievements(v_entry.user_id);
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. Trigger to Award Entry Points on Submission
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_award_entry_points()
RETURNS TRIGGER AS $$
BEGIN
  -- When entry is submitted, award entry points
  IF NEW.is_submitted = TRUE AND (OLD.is_submitted IS NULL OR OLD.is_submitted = FALSE) THEN
    PERFORM award_entry_points(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_award_entry_points_on_submit
  AFTER UPDATE OF is_submitted ON dfs_entries
  FOR EACH ROW
  WHEN (NEW.is_submitted = TRUE AND (OLD.is_submitted IS NULL OR OLD.is_submitted = FALSE))
  EXECUTE FUNCTION trigger_award_entry_points();

-- ----------------------------------------------------------------------------
-- 5. Trigger to Award Placement Points on Rank Update
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_award_placement_points()
RETURNS TRIGGER AS $$
BEGIN
  -- When rank is set and entry is submitted, award placement points
  IF NEW.rank IS NOT NULL AND NEW.is_submitted = TRUE THEN
    -- Only award if rank was just set (was NULL before)
    IF OLD.rank IS NULL THEN
      PERFORM award_placement_points(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_award_placement_points_on_rank
  AFTER UPDATE OF rank ON dfs_entries
  FOR EACH ROW
  WHEN (NEW.rank IS NOT NULL AND OLD.rank IS NULL AND NEW.is_submitted = TRUE)
  EXECUTE FUNCTION trigger_award_placement_points();

-- ----------------------------------------------------------------------------
-- 6. Function to Initialize User Points (called when user first enters a pool)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION initialize_user_points(
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Create user points record if it doesn't exist
  INSERT INTO dfs_user_points (user_id, total_points, lifetime_points)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 7. Update submit_dfs_lineup function to initialize points
-- ----------------------------------------------------------------------------
-- This will be handled by the trigger, but we can also call it explicitly
-- in the submit function if needed

-- ============================================================================
-- Add Points Configuration to Pool Creation Function
-- ============================================================================
-- This migration updates create_dfs_pool_from_games to accept point
-- configuration parameters.

-- Drop ALL overloads of create_dfs_pool_from_games
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'create_dfs_pool_from_games' 
    AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- Recreate function with point parameters
CREATE OR REPLACE FUNCTION create_dfs_pool_from_games(
  -- Required parameters
  p_pool_name TEXT,
  p_slate_name TEXT,
  p_slate_date DATE,
  p_game_ids TEXT[],
  
  -- Optional basic parameters
  p_description TEXT DEFAULT NULL,
  p_entry_fee DECIMAL(10, 2) DEFAULT 0.00,
  p_max_entries INTEGER DEFAULT 1000,
  p_difficulty_tier dfs_difficulty_tier DEFAULT 'standard',
  
  -- Roster configuration
  p_starters_count INTEGER DEFAULT 5,
  p_rotation_count INTEGER DEFAULT 3,
  p_bench_count INTEGER DEFAULT 2,
  
  -- Scoring
  p_scoring_format TEXT DEFAULT 'FanDuel',
  
  -- Icon parameters
  p_icon_name TEXT DEFAULT NULL,
  p_html_color_primary TEXT DEFAULT NULL,
  p_html_color_secondary TEXT DEFAULT NULL,
  
  -- Lineup requirements
  p_lineup_requirements JSONB DEFAULT NULL,
  
  -- Point configuration
  p_points_entry INTEGER DEFAULT 10,
  p_points_win INTEGER DEFAULT 100,
  p_points_placement JSONB DEFAULT '[]'::jsonb,
  p_points_top_percent JSONB DEFAULT '[]'::jsonb,
  p_points_enabled BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  pool_id UUID,
  games_added INTEGER,
  players_added INTEGER,
  min_salary BIGINT,
  max_salary BIGINT,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_pool_id UUID;
  v_lock_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_start_time TIMESTAMPTZ;
  v_salary_cap BIGINT;
  v_games_added INTEGER := 0;
  v_players_added INTEGER := 0;
  v_min_salary BIGINT;
  v_max_salary BIGINT;
  v_prize_pool DECIMAL(12, 2);
BEGIN
  -- Validate games
  IF array_length(p_game_ids, 1) IS NULL OR array_length(p_game_ids, 1) = 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0, 0::BIGINT, 0::BIGINT, FALSE,
      'Error: No games selected'::TEXT;
    RETURN;
  END IF;
  
  -- Get lock time (earliest game start) and end time (latest game end)
  SELECT 
    MIN(game_date_est) as lock,
    MAX(game_date_est + INTERVAL '3 hours') as end_time
  INTO v_lock_time, v_end_time
  FROM nba_games
  WHERE game_id = ANY(p_game_ids);
  
  IF v_lock_time IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, 0, 0, 0::BIGINT, 0::BIGINT, FALSE,
      'Error: No valid games found'::TEXT;
    RETURN;
  END IF;
  
  -- Set start time (4 hours before lock)
  v_start_time := v_lock_time - INTERVAL '4 hours';
  
  -- Set salary cap based on difficulty
  v_salary_cap := CASE p_difficulty_tier
    WHEN 'elite' THEN 154600000
    WHEN 'pro' THEN 195900000
    WHEN 'standard' THEN 207800000
    ELSE 207800000
  END;
  
  -- Calculate prize pool (90% of entry fees)
  v_prize_pool := (p_entry_fee * p_max_entries * 0.9);
  
  -- Create the pool
  INSERT INTO dfs_pools (
    name,
    description,
    slate_name,
    slate_date,
    start_time,
    lock_time,
    end_time,
    entry_fee,
    prize_pool,
    max_entries,
    salary_cap,
    difficulty_tier,
    prize_type,
    is_public,
    status,
    created_by_admin_id,
    -- Roster configuration
    roster_size,
    starters_count,
    rotation_count,
    bench_count,
    -- Scoring
    scoring_format,
    -- Icon
    icon_name,
    html_color_primary,
    html_color_secondary,
    -- Lineup requirements
    lineup_requirements,
    -- Point configuration
    points_entry,
    points_win,
    points_placement,
    points_top_percent,
    points_enabled
  ) VALUES (
    p_pool_name,
    p_description,
    p_slate_name,
    p_slate_date,
    v_start_time,
    v_lock_time,
    v_end_time,
    p_entry_fee,
    v_prize_pool,
    p_max_entries,
    v_salary_cap,
    p_difficulty_tier,
    'top_n',
    TRUE,
    'scheduled',
    auth.uid(),
    -- Roster
    p_starters_count + p_rotation_count + p_bench_count,
    p_starters_count,
    p_rotation_count,
    p_bench_count,
    -- Scoring
    p_scoring_format,
    -- Icon
    p_icon_name,
    p_html_color_primary,
    p_html_color_secondary,
    -- Lineup requirements
    p_lineup_requirements,
    -- Points
    p_points_entry,
    p_points_win,
    p_points_placement,
    p_points_top_percent,
    p_points_enabled
  )
  RETURNING id INTO v_pool_id;
  
  -- Add games to the pool
  INSERT INTO dfs_pool_games (pool_id, game_id, game_date, home_team, away_team)
  SELECT 
    v_pool_id,
    g.game_id::TEXT,
    g.game_date_est,
    g.home_team_tricode::TEXT,
    g.away_team_tricode::TEXT
  FROM nba_games g
  WHERE g.game_id = ANY(p_game_ids);
  
  GET DIAGNOSTICS v_games_added = ROW_COUNT;
  
  -- Auto-populate players from the selected games
  INSERT INTO dfs_player_salaries (pool_id, player_id, nba_player_id, player_name, player_team, player_position, salary)
  SELECT DISTINCT
    v_pool_id,
    p.id,
    p.nba_player_id,
    p.player_name,
    p.team_abbreviation,
    p.position,
    COALESCE(ps.salary, 0)
  FROM nba_players p
  LEFT JOIN player_salaries ps ON p.nba_player_id = ps.nba_player_id
  WHERE p.team_abbreviation IN (
    SELECT DISTINCT home_team_tricode FROM nba_games WHERE game_id = ANY(p_game_ids)
    UNION
    SELECT DISTINCT away_team_tricode FROM nba_games WHERE game_id = ANY(p_game_ids)
  )
  AND p.is_active = TRUE
  ON CONFLICT (pool_id, player_id) DO NOTHING;
  
  GET DIAGNOSTICS v_players_added = ROW_COUNT;
  
  -- Get salary range
  SELECT 
    MIN(salary),
    MAX(salary)
  INTO v_min_salary, v_max_salary
  FROM dfs_player_salaries
  WHERE pool_id = v_pool_id;
  
  RETURN QUERY SELECT 
    v_pool_id,
    v_games_added,
    v_players_added,
    COALESCE(v_min_salary, 0::BIGINT),
    COALESCE(v_max_salary, 0::BIGINT),
    TRUE,
    'Pool created successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_dfs_pool_from_games TO authenticated, service_role;

COMMENT ON FUNCTION create_dfs_pool_from_games IS 
'Creates a DFS pool from selected NBA games with point configuration support';

