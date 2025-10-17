-- =====================================================
-- USER FAVORITE PLAYERS TABLE
-- =====================================================
-- Stores user's favorite NBA players for personalized content
-- Used to customize home feed and receive player-specific notifications
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.user_favorite_players CASCADE;

-- Create user_favorite_players table
CREATE TABLE public.user_favorite_players (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES public.nba_players(id) ON DELETE CASCADE,
    
    -- Metadata
    notes TEXT, -- Optional notes about why this player is favorited
    notify_on_games BOOLEAN DEFAULT true, -- Notify when player has games
    notify_on_milestones BOOLEAN DEFAULT true, -- Notify on career milestones
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, player_id) -- User can only favorite a player once
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Index on user_id for faster lookups
CREATE INDEX idx_user_favorite_players_user_id ON public.user_favorite_players(user_id);

-- Index on player_id for reverse lookups
CREATE INDEX idx_user_favorite_players_player_id ON public.user_favorite_players(player_id);

-- Composite index for user + player lookups
CREATE INDEX idx_user_favorite_players_user_player ON public.user_favorite_players(user_id, player_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.user_favorite_players ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own favorites
CREATE POLICY "Users can view their own favorite players"
    ON public.user_favorite_players
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can add to their favorites
CREATE POLICY "Users can add favorite players"
    ON public.user_favorite_players
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their favorites
CREATE POLICY "Users can update their favorite players"
    ON public.user_favorite_players
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can remove from their favorites
CREATE POLICY "Users can delete their favorite players"
    ON public.user_favorite_players
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get user's favorite players with player details
CREATE OR REPLACE FUNCTION public.get_user_favorite_players(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    player_id BIGINT,
    player_name TEXT,
    player_position TEXT,
    player_team TEXT,
    player_jersey_number INTEGER,
    nba_player_id BIGINT,
    notes TEXT,
    notify_on_games BOOLEAN,
    notify_on_milestones BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ufp.id,
        ufp.player_id,
        np.name AS player_name,
        np.position AS player_position,
        np.team_abbreviation AS player_team,
        np.jersey_number AS player_jersey_number,
        np.nba_player_id,
        ufp.notes,
        ufp.notify_on_games,
        ufp.notify_on_milestones,
        ufp.created_at
    FROM public.user_favorite_players ufp
    INNER JOIN public.nba_players np ON ufp.player_id = np.id
    WHERE ufp.user_id = p_user_id
    ORDER BY ufp.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Add player to favorites
CREATE OR REPLACE FUNCTION public.add_favorite_player(
    p_user_id UUID,
    p_player_id BIGINT,
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
    INSERT INTO public.user_favorite_players (user_id, player_id, notes)
    VALUES (p_user_id, p_player_id, p_notes)
    ON CONFLICT (user_id, player_id) 
    DO UPDATE SET notes = COALESCE(p_notes, user_favorite_players.notes)
    RETURNING id INTO v_favorite_id;
    
    RETURN v_favorite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Remove player from favorites
CREATE OR REPLACE FUNCTION public.remove_favorite_player(
    p_user_id UUID,
    p_player_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    DELETE FROM public.user_favorite_players
    WHERE user_id = p_user_id AND player_id = p_player_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if player is favorited by user
CREATE OR REPLACE FUNCTION public.is_player_favorited(
    p_user_id UUID,
    p_player_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM public.user_favorite_players
        WHERE user_id = p_user_id AND player_id = p_player_id
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get favorite player count for user
CREATE OR REPLACE FUNCTION public.get_favorite_player_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.user_favorite_players
    WHERE user_id = p_user_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Toggle favorite player (add if not exists, remove if exists)
CREATE OR REPLACE FUNCTION public.toggle_favorite_player(
    p_user_id UUID,
    p_player_id BIGINT
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
    SELECT is_player_favorited(p_user_id, p_player_id) INTO v_exists;
    
    IF v_exists THEN
        -- Remove from favorites
        PERFORM remove_favorite_player(p_user_id, p_player_id);
        RETURN false; -- Removed
    ELSE
        -- Add to favorites
        PERFORM add_favorite_player(p_user_id, p_player_id);
        RETURN true; -- Added
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favorite_players TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_favorite_players TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_favorite_player TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_favorite_player TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_player_favorited TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_favorite_player_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_favorite_player TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_favorite_players IS 'User favorite NBA players for personalized content and notifications';
COMMENT ON COLUMN public.user_favorite_players.user_id IS 'User ID from auth.users';
COMMENT ON COLUMN public.user_favorite_players.player_id IS 'NBA Player ID from nba_players';
COMMENT ON COLUMN public.user_favorite_players.notes IS 'Optional user notes about this favorite player';
COMMENT ON COLUMN public.user_favorite_players.notify_on_games IS 'Send notifications for this player''s games';
COMMENT ON COLUMN public.user_favorite_players.notify_on_milestones IS 'Send notifications for this player''s career milestones';

