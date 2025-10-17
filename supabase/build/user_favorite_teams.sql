-- =====================================================
-- USER FAVORITE TEAMS TABLE
-- =====================================================
-- Stores user's favorite NBA teams for personalized content
-- Used to customize home feed and receive team-specific notifications
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.user_favorite_teams CASCADE;

-- Create user_favorite_teams table
CREATE TABLE public.user_favorite_teams (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id BIGINT NOT NULL REFERENCES public.nba_teams(id) ON DELETE CASCADE,
    
    -- Metadata
    notes TEXT, -- Optional notes about why this team is favorited
    notify_on_games BOOLEAN DEFAULT true, -- Notify when team has games
    notify_on_trades BOOLEAN DEFAULT true, -- Notify on team trades/roster changes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, team_id) -- User can only favorite a team once
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Index on user_id for faster lookups
CREATE INDEX idx_user_favorite_teams_user_id ON public.user_favorite_teams(user_id);

-- Index on team_id for reverse lookups
CREATE INDEX idx_user_favorite_teams_team_id ON public.user_favorite_teams(team_id);

-- Composite index for user + team lookups
CREATE INDEX idx_user_favorite_teams_user_team ON public.user_favorite_teams(user_id, team_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.user_favorite_teams ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own favorites
CREATE POLICY "Users can view their own favorite teams"
    ON public.user_favorite_teams
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can add to their favorites
CREATE POLICY "Users can add favorite teams"
    ON public.user_favorite_teams
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their favorites
CREATE POLICY "Users can update their favorite teams"
    ON public.user_favorite_teams
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can remove from their favorites
CREATE POLICY "Users can delete their favorite teams"
    ON public.user_favorite_teams
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get user's favorite teams with team details
CREATE OR REPLACE FUNCTION public.get_user_favorite_teams(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    team_id BIGINT,
    team_name TEXT,
    team_abbreviation TEXT,
    team_city TEXT,
    team_conference TEXT,
    team_division TEXT,
    notes TEXT,
    notify_on_games BOOLEAN,
    notify_on_trades BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        uft.id,
        uft.team_id,
        nt.full_name AS team_name,
        nt.abbreviation AS team_abbreviation,
        nt.city AS team_city,
        nt.conference AS team_conference,
        nt.division AS team_division,
        uft.notes,
        uft.notify_on_games,
        uft.notify_on_trades,
        uft.created_at
    FROM public.user_favorite_teams uft
    INNER JOIN public.nba_teams nt ON uft.team_id = nt.id
    WHERE uft.user_id = p_user_id
    ORDER BY uft.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Add team to favorites
CREATE OR REPLACE FUNCTION public.add_favorite_team(
    p_user_id UUID,
    p_team_id BIGINT,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_favorite_id UUID;
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Insert or update favorite
    INSERT INTO public.user_favorite_teams (user_id, team_id, notes)
    VALUES (p_user_id, p_team_id, p_notes)
    ON CONFLICT (user_id, team_id) 
    DO UPDATE SET notes = COALESCE(p_notes, user_favorite_teams.notes)
    RETURNING id INTO v_favorite_id;
    
    RETURN v_favorite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Remove team from favorites
CREATE OR REPLACE FUNCTION public.remove_favorite_team(
    p_user_id UUID,
    p_team_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    DELETE FROM public.user_favorite_teams
    WHERE user_id = p_user_id AND team_id = p_team_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if team is favorited by user
CREATE OR REPLACE FUNCTION public.is_team_favorited(
    p_user_id UUID,
    p_team_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM public.user_favorite_teams
        WHERE user_id = p_user_id AND team_id = p_team_id
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get favorite team count for user
CREATE OR REPLACE FUNCTION public.get_favorite_team_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.user_favorite_teams
    WHERE user_id = p_user_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Toggle favorite team (add if not exists, remove if exists)
CREATE OR REPLACE FUNCTION public.toggle_favorite_team(
    p_user_id UUID,
    p_team_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Check if favorite exists
    SELECT is_team_favorited(p_user_id, p_team_id) INTO v_exists;
    
    IF v_exists THEN
        -- Remove from favorites
        PERFORM remove_favorite_team(p_user_id, p_team_id);
        RETURN false; -- Removed
    ELSE
        -- Add to favorites
        PERFORM add_favorite_team(p_user_id, p_team_id);
        RETURN true; -- Added
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorite_teams TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_favorite_teams TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_favorite_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_favorite_team TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_favorited TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_favorite_team_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_favorite_team TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_favorite_teams IS 'User favorite NBA teams for personalized content and notifications';
COMMENT ON COLUMN public.user_favorite_teams.user_id IS 'User ID from auth.users';
COMMENT ON COLUMN public.user_favorite_teams.team_id IS 'NBA Team ID from nba_teams';
COMMENT ON COLUMN public.user_favorite_teams.notes IS 'Optional user notes about this favorite team';
COMMENT ON COLUMN public.user_favorite_teams.notify_on_games IS 'Send notifications for this team''s games';
COMMENT ON COLUMN public.user_favorite_teams.notify_on_trades IS 'Send notifications for this team''s trades and roster changes';

