-- =====================================================
-- USER PROFILES TABLE
-- =====================================================
-- Stores extended user profile information beyond auth.users
-- Includes display name, avatar, and user preferences
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Create user_profiles table
CREATE TABLE public.user_profiles (
    -- Primary key - references auth.users
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Profile information
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    
    -- Preferences
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    timezone TEXT DEFAULT 'America/New_York',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_profiles_id ON public.user_profiles(id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Policy: Users can view other users' basic profile info (display name, avatar)
CREATE POLICY "Users can view other profiles"
    ON public.user_profiles
    FOR SELECT
    USING (true);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy: Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
    ON public.user_profiles
    FOR DELETE
    USING (auth.uid() = id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_profiles_updated_at();

-- Trigger: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if not already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get user profile by ID
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS TABLE (
    id UUID,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    theme TEXT,
    timezone TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.id,
        up.display_name,
        up.avatar_url,
        up.bio,
        up.theme,
        up.timezone,
        up.created_at,
        up.updated_at
    FROM public.user_profiles up
    WHERE up.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update user profile
CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_user_id UUID,
    p_display_name TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_theme TEXT DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.user_profiles
    SET
        display_name = COALESCE(p_display_name, display_name),
        avatar_url = COALESCE(p_avatar_url, avatar_url),
        bio = COALESCE(p_bio, bio),
        theme = COALESCE(p_theme, theme),
        timezone = COALESCE(p_timezone, timezone),
        updated_at = NOW()
    WHERE id = p_user_id AND id = auth.uid();
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_profiles IS 'Extended user profile information';
COMMENT ON COLUMN public.user_profiles.id IS 'User ID from auth.users';
COMMENT ON COLUMN public.user_profiles.display_name IS 'User display name (can be different from email)';
COMMENT ON COLUMN public.user_profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN public.user_profiles.bio IS 'User bio/description';
COMMENT ON COLUMN public.user_profiles.theme IS 'UI theme preference (light/dark/system)';
COMMENT ON COLUMN public.user_profiles.timezone IS 'User timezone for displaying dates/times';

