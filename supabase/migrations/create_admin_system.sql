-- ============================================================================
-- ADMIN SYSTEM - Secure Admin Interface for DFS & Content Management
-- ============================================================================

-- ============================================================================
-- ADMIN ROLES & PERMISSIONS
-- ============================================================================

-- Admin roles enum
CREATE TYPE admin_role AS ENUM (
  'super_admin',     -- Full system access
  'content_admin',   -- Can manage blog posts, news
  'dfs_admin',       -- Can create/manage DFS pools
  'support_admin',   -- Can view user data, handle support
  'readonly_admin'   -- Can view admin panels but not edit
);

-- Admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role admin_role NOT NULL DEFAULT 'readonly_admin',
  
  -- Access Control
  is_active BOOLEAN DEFAULT TRUE,
  allowed_ip_addresses TEXT[], -- Optional IP whitelist
  require_2fa BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  
  CONSTRAINT unique_admin_user UNIQUE(user_id)
);

-- Admin action audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id),
  user_id UUID REFERENCES auth.users(id),
  
  -- Action Details
  action TEXT NOT NULL, -- 'create_pool', 'edit_post', 'delete_user', etc.
  resource_type TEXT NOT NULL, -- 'dfs_pool', 'blog_post', 'user', etc.
  resource_id UUID,
  
  -- Request Details
  ip_address INET,
  user_agent TEXT,
  request_method TEXT,
  request_path TEXT,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Metadata
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_admin_audit_admin ON admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_created ON admin_audit_log(created_at DESC);

-- ============================================================================
-- BLOG & CONTENT MANAGEMENT
-- ============================================================================

-- Blog post status
CREATE TYPE blog_post_status AS ENUM (
  'draft',
  'scheduled',
  'published',
  'archived'
);

-- Blog categories
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES blog_categories(id),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Blog posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL, -- Markdown or HTML
  featured_image_url TEXT,
  
  -- Classification
  category_id UUID REFERENCES blog_categories(id),
  tags TEXT[],
  
  -- Author
  author_id UUID NOT NULL REFERENCES auth.users(id),
  author_name TEXT, -- Denormalized for display
  
  -- Publishing
  status blog_post_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT[],
  
  -- Engagement
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  
  -- Featured
  is_featured BOOLEAN DEFAULT FALSE,
  is_breaking_news BOOLEAN DEFAULT FALSE,
  featured_order INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published ON blog_posts(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_blog_posts_featured ON blog_posts(is_featured, featured_order) WHERE is_featured = TRUE;
CREATE INDEX idx_blog_posts_category ON blog_posts(category_id);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);

-- ============================================================================
-- DFS POOL TEMPLATES (For Easy Pool Creation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dfs_pool_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template Info
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- 'daily_standard', 'gpp', 'double_up', 'h2h', 'showdown'
  
  -- Default Configuration
  default_entry_fee DECIMAL(10, 2) NOT NULL,
  default_max_entries INTEGER NOT NULL,
  default_max_entries_per_user INTEGER DEFAULT 1,
  
  -- Prize Structure
  prize_structure_id UUID REFERENCES dfs_prize_structures(id),
  guaranteed_prize_pool DECIMAL(12, 2),
  rake_percentage DECIMAL(5, 2) DEFAULT 10.00,
  
  -- Difficulty
  difficulty_tier dfs_difficulty_tier NOT NULL DEFAULT 'standard',
  
  -- Roster Config (can be overridden)
  starters_count INTEGER DEFAULT 5,
  rotation_count INTEGER DEFAULT 3,
  bench_count INTEGER DEFAULT 2,
  starters_multiplier DECIMAL(4, 2) DEFAULT 1.00,
  rotation_multiplier DECIMAL(4, 2) DEFAULT 0.75,
  bench_multiplier DECIMAL(4, 2) DEFAULT 0.50,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  use_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_template_entry_fee CHECK (default_entry_fee >= 0)
);

-- Insert default templates
INSERT INTO dfs_pool_templates (
  name, description, template_type,
  default_entry_fee, default_max_entries, default_max_entries_per_user,
  difficulty_tier, guaranteed_prize_pool, rake_percentage
) VALUES
-- Free to play
('Free Roll', 'Free entry contest for beginners', 'daily_standard',
  0.00, 1000, 1, 'standard', 100.00, 0.00),

-- Standard contests  
('$5 Standard', 'Standard $5 entry contest', 'daily_standard',
  5.00, 2000, 3, 'standard', NULL, 10.00),
  
('$10 Pro', 'Pro level $10 entry', 'daily_standard',
  10.00, 1000, 3, 'pro', NULL, 10.00),
  
('$25 Elite', 'Elite difficulty $25 entry', 'daily_standard',
  25.00, 500, 3, 'elite', NULL, 10.00),

-- GPPs (Guaranteed Prize Pools)
('$10 GPP - $10K Guaranteed', 'Large field GPP', 'gpp',
  10.00, 1500, 20, 'standard', 10000.00, 10.00),
  
('$25 GPP - $50K Guaranteed', 'Major GPP contest', 'gpp',
  25.00, 2500, 150, 'pro', 50000.00, 10.00),

-- Double Ups
('$10 Double Up', 'Top 50% double their money', 'double_up',
  10.00, 100, 1, 'standard', NULL, 10.00),

-- H2H
('$20 Head-to-Head', 'One on one matchup', 'h2h',
  20.00, 2, 1, 'standard', NULL, 10.00);

-- ============================================================================
-- DFS SLATE DETECTION (Automated)
-- ============================================================================

-- Store detected slates for review/approval
CREATE TABLE IF NOT EXISTS public.dfs_detected_slates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Slate Info
  slate_date DATE NOT NULL,
  slate_name TEXT NOT NULL, -- 'Main', 'Early', 'Late', 'Showdown'
  
  -- Games
  game_count INTEGER NOT NULL,
  game_ids TEXT[] NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  
  -- Status
  is_approved BOOLEAN DEFAULT FALSE,
  pools_created BOOLEAN DEFAULT FALSE,
  
  -- Admin
  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMPTZ,
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_slate UNIQUE(slate_date, slate_name)
);

CREATE INDEX idx_detected_slates_date ON dfs_detected_slates(slate_date);
CREATE INDEX idx_detected_slates_approved ON dfs_detected_slates(is_approved, pools_created);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_audit_log (
    admin_user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    ip_address
  ) VALUES (
    p_admin_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_values,
    p_new_values,
    p_ip_address::INET
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create pool from template
CREATE OR REPLACE FUNCTION create_pool_from_template(
  p_template_id UUID,
  p_slate_date DATE,
  p_slate_name TEXT,
  p_admin_user_id UUID,
  p_custom_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_template RECORD;
  v_pool_id UUID;
  v_pool_name TEXT;
BEGIN
  -- Get template
  SELECT * INTO v_template
  FROM dfs_pool_templates
  WHERE id = p_template_id AND is_active = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or inactive';
  END IF;
  
  -- Generate pool name
  v_pool_name := COALESCE(
    p_custom_name,
    v_template.name || ' - ' || TO_CHAR(p_slate_date, 'Mon DD')
  );
  
  -- Create pool
  INSERT INTO dfs_pools (
    name,
    description,
    pool_type,
    slate_name,
    slate_date,
    start_time,
    lock_time,
    entry_fee,
    min_entries,
    max_entries,
    max_entries_per_user,
    prize_pool,
    is_guaranteed,
    guaranteed_amount,
    rake_percentage,
    difficulty_tier,
    salary_cap,
    roster_size,
    starters_count,
    rotation_count,
    bench_count,
    starters_multiplier,
    rotation_multiplier,
    bench_multiplier,
    prize_structure_id,
    status,
    is_public,
    created_by
  )
  SELECT
    v_pool_name,
    v_template.description,
    v_template.template_type,
    p_slate_name,
    p_slate_date,
    p_slate_date::TIMESTAMPTZ, -- Will be updated with actual start time
    p_slate_date::TIMESTAMPTZ, -- Will be updated with actual lock time
    v_template.default_entry_fee,
    2,
    v_template.default_max_entries,
    v_template.default_max_entries_per_user,
    v_template.guaranteed_prize_pool,
    (v_template.guaranteed_prize_pool IS NOT NULL),
    v_template.guaranteed_prize_pool,
    v_template.rake_percentage,
    v_template.difficulty_tier,
    CASE v_template.difficulty_tier
      WHEN 'elite' THEN 154600000
      WHEN 'pro' THEN 195900000
      ELSE 207800000
    END,
    v_template.starters_count + v_template.rotation_count + v_template.bench_count,
    v_template.starters_count,
    v_template.rotation_count,
    v_template.bench_count,
    v_template.starters_multiplier,
    v_template.rotation_multiplier,
    v_template.bench_multiplier,
    v_template.prize_structure_id,
    'draft',
    TRUE,
    (SELECT user_id FROM admin_users WHERE id = p_admin_user_id)
  RETURNING id INTO v_pool_id;
  
  -- Update template usage
  UPDATE dfs_pool_templates
  SET use_count = use_count + 1
  WHERE id = p_template_id;
  
  -- Log action
  PERFORM log_admin_action(
    p_admin_user_id,
    'create_pool_from_template',
    'dfs_pool',
    v_pool_id,
    NULL,
    jsonb_build_object('template_id', p_template_id, 'pool_id', v_pool_id)
  );
  
  RETURN v_pool_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-detect slates
CREATE OR REPLACE FUNCTION detect_daily_slates(p_date DATE)
RETURNS TABLE(
  slate_name TEXT,
  game_count INTEGER,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  game_ids TEXT[]
) AS $$
BEGIN
  -- Main Slate (all games)
  RETURN QUERY
  WITH games AS (
    SELECT 
      game_id,
      game_date,
      MIN(game_date) OVER () as first_game,
      MAX(game_date) OVER () as last_game,
      COUNT(*) OVER () as total_games
    FROM nba_games
    WHERE game_date::DATE = p_date
      AND game_status_text NOT IN ('Cancelled', 'Postponed')
  )
  SELECT
    'Main Slate'::TEXT,
    COUNT(*)::INTEGER,
    MIN(game_date),
    MAX(game_date) + INTERVAL '3 hours', -- Estimate game duration
    ARRAY_AGG(game_id)
  FROM games
  HAVING COUNT(*) >= 3; -- Minimum 3 games for a slate
  
  -- Early Slate (games before 7 PM ET)
  RETURN QUERY
  WITH games AS (
    SELECT 
      game_id,
      game_date
    FROM nba_games
    WHERE game_date::DATE = p_date
      AND game_status_text NOT IN ('Cancelled', 'Postponed')
      AND EXTRACT(HOUR FROM game_date AT TIME ZONE 'America/New_York') < 19
  )
  SELECT
    'Early Slate'::TEXT,
    COUNT(*)::INTEGER,
    MIN(game_date),
    MAX(game_date) + INTERVAL '3 hours',
    ARRAY_AGG(game_id)
  FROM games
  HAVING COUNT(*) >= 2;
  
  -- Late Slate (games 7 PM ET or later)
  RETURN QUERY
  WITH games AS (
    SELECT 
      game_id,
      game_date
    FROM nba_games
    WHERE game_date::DATE = p_date
      AND game_status_text NOT IN ('Cancelled', 'Postponed')
      AND EXTRACT(HOUR FROM game_date AT TIME ZONE 'America/New_York') >= 19
  )
  SELECT
    'Late Slate'::TEXT,
    COUNT(*)::INTEGER,
    MIN(game_date),
    MAX(game_date) + INTERVAL '3 hours',
    ARRAY_AGG(game_id)
  FROM games
  HAVING COUNT(*) >= 2;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_pool_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_detected_slates ENABLE ROW LEVEL SECURITY;

-- Admin users: Only super admins can view/manage
CREATE POLICY "Super admins can manage admin users" ON admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.role = 'super_admin'
        AND au.is_active = TRUE
    )
  );

-- Audit log: Admins can view their own, super admins can view all
CREATE POLICY "Admins can view audit logs" ON admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = TRUE
        AND (
          au.role = 'super_admin' OR
          au.id = admin_audit_log.admin_user_id
        )
    )
  );

-- Blog categories: Public read, admin write
CREATE POLICY "Public can view blog categories" ON blog_categories
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Content admins can manage categories" ON blog_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = TRUE
        AND au.role IN ('super_admin', 'content_admin')
    )
  );

-- Blog posts: Public read published, admin write
CREATE POLICY "Public can view published posts" ON blog_posts
  FOR SELECT USING (
    status = 'published' AND published_at <= now()
  );

CREATE POLICY "Content admins can manage posts" ON blog_posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = TRUE
        AND au.role IN ('super_admin', 'content_admin')
    )
  );

-- Pool templates: Admins only
CREATE POLICY "DFS admins can manage templates" ON dfs_pool_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = TRUE
        AND au.role IN ('super_admin', 'dfs_admin')
    )
  );

-- Detected slates: Admins only
CREATE POLICY "DFS admins can manage slates" ON dfs_detected_slates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
        AND au.is_active = TRUE
        AND au.role IN ('super_admin', 'dfs_admin')
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE admin_users IS 'Admin users with role-based access control';
COMMENT ON TABLE admin_audit_log IS 'Comprehensive audit log of all admin actions';
COMMENT ON TABLE blog_posts IS 'Blog posts and news articles for homepage';
COMMENT ON TABLE dfs_pool_templates IS 'Templates for quick DFS pool creation';
COMMENT ON TABLE dfs_detected_slates IS 'Auto-detected game slates for admin review';

-- ============================================================================
-- END OF ADMIN SYSTEM
-- ============================================================================

