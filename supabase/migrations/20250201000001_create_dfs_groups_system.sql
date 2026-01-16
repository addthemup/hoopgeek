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

