-- =====================================================
-- USER FEED PREFERENCES TABLE
-- =====================================================
-- Stores user's feed customization preferences
-- Used to personalize the home page game feed algorithm
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.user_feed_preferences CASCADE;

-- Create user_feed_preferences table
CREATE TABLE public.user_feed_preferences (
    -- Primary key - references auth.users (one row per user)
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Feed algorithm preferences
    prioritize_favorite_teams BOOLEAN DEFAULT true, -- Boost games with favorite teams
    prioritize_favorite_players BOOLEAN DEFAULT true, -- Boost games with favorite players
    show_low_fun_score_games BOOLEAN DEFAULT false, -- Show games with low fun scores
    min_fun_score_threshold NUMERIC(3,1) DEFAULT 7.0 CHECK (min_fun_score_threshold >= 0 AND min_fun_score_threshold <= 10),
    
    -- Content type preferences
    show_highlights BOOLEAN DEFAULT true,
    show_buzzer_beaters BOOLEAN DEFAULT true,
    show_close_games BOOLEAN DEFAULT true,
    show_high_scoring BOOLEAN DEFAULT true,
    show_overtime_games BOOLEAN DEFAULT true,
    show_playoff_games BOOLEAN DEFAULT true,
    show_rivalry_games BOOLEAN DEFAULT true,
    
    -- Time preferences
    days_back_to_show INTEGER DEFAULT 90 CHECK (days_back_to_show >= 1 AND days_back_to_show <= 365),
    
    -- View preferences
    default_feed_view TEXT DEFAULT 'grid' CHECK (default_feed_view IN ('grid', 'list', 'compact')),
    games_per_page INTEGER DEFAULT 12 CHECK (games_per_page >= 3 AND games_per_page <= 50),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Index on user_id for faster lookups (already primary key, but explicit)
CREATE INDEX idx_user_feed_preferences_user_id ON public.user_feed_preferences(user_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.user_feed_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own feed preferences
CREATE POLICY "Users can view their own feed preferences"
    ON public.user_feed_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own feed preferences
CREATE POLICY "Users can insert their own feed preferences"
    ON public.user_feed_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own feed preferences
CREATE POLICY "Users can update their own feed preferences"
    ON public.user_feed_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own feed preferences
CREATE POLICY "Users can delete their own feed preferences"
    ON public.user_feed_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_feed_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_feed_preferences_updated_at
    BEFORE UPDATE ON public.user_feed_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_feed_preferences_updated_at();

-- Trigger: Auto-create default feed preferences on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_feed_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_feed_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if not already exists)
DROP TRIGGER IF EXISTS on_auth_user_created_feed_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_feed_prefs
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_feed_preferences();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get user feed preferences
CREATE OR REPLACE FUNCTION public.get_user_feed_preferences(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    prioritize_favorite_teams BOOLEAN,
    prioritize_favorite_players BOOLEAN,
    show_low_fun_score_games BOOLEAN,
    min_fun_score_threshold NUMERIC,
    show_highlights BOOLEAN,
    show_buzzer_beaters BOOLEAN,
    show_close_games BOOLEAN,
    show_high_scoring BOOLEAN,
    show_overtime_games BOOLEAN,
    show_playoff_games BOOLEAN,
    show_rivalry_games BOOLEAN,
    days_back_to_show INTEGER,
    default_feed_view TEXT,
    games_per_page INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ufp.user_id,
        ufp.prioritize_favorite_teams,
        ufp.prioritize_favorite_players,
        ufp.show_low_fun_score_games,
        ufp.min_fun_score_threshold,
        ufp.show_highlights,
        ufp.show_buzzer_beaters,
        ufp.show_close_games,
        ufp.show_high_scoring,
        ufp.show_overtime_games,
        ufp.show_playoff_games,
        ufp.show_rivalry_games,
        ufp.days_back_to_show,
        ufp.default_feed_view,
        ufp.games_per_page,
        ufp.created_at,
        ufp.updated_at
    FROM public.user_feed_preferences ufp
    WHERE ufp.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update user feed preferences
CREATE OR REPLACE FUNCTION public.update_user_feed_preferences(
    p_user_id UUID,
    p_prioritize_favorite_teams BOOLEAN DEFAULT NULL,
    p_prioritize_favorite_players BOOLEAN DEFAULT NULL,
    p_show_low_fun_score_games BOOLEAN DEFAULT NULL,
    p_min_fun_score_threshold NUMERIC DEFAULT NULL,
    p_show_highlights BOOLEAN DEFAULT NULL,
    p_show_buzzer_beaters BOOLEAN DEFAULT NULL,
    p_show_close_games BOOLEAN DEFAULT NULL,
    p_show_high_scoring BOOLEAN DEFAULT NULL,
    p_show_overtime_games BOOLEAN DEFAULT NULL,
    p_show_playoff_games BOOLEAN DEFAULT NULL,
    p_show_rivalry_games BOOLEAN DEFAULT NULL,
    p_days_back_to_show INTEGER DEFAULT NULL,
    p_default_feed_view TEXT DEFAULT NULL,
    p_games_per_page INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Upsert feed preferences
    INSERT INTO public.user_feed_preferences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO UPDATE SET
        prioritize_favorite_teams = COALESCE(p_prioritize_favorite_teams, user_feed_preferences.prioritize_favorite_teams),
        prioritize_favorite_players = COALESCE(p_prioritize_favorite_players, user_feed_preferences.prioritize_favorite_players),
        show_low_fun_score_games = COALESCE(p_show_low_fun_score_games, user_feed_preferences.show_low_fun_score_games),
        min_fun_score_threshold = COALESCE(p_min_fun_score_threshold, user_feed_preferences.min_fun_score_threshold),
        show_highlights = COALESCE(p_show_highlights, user_feed_preferences.show_highlights),
        show_buzzer_beaters = COALESCE(p_show_buzzer_beaters, user_feed_preferences.show_buzzer_beaters),
        show_close_games = COALESCE(p_show_close_games, user_feed_preferences.show_close_games),
        show_high_scoring = COALESCE(p_show_high_scoring, user_feed_preferences.show_high_scoring),
        show_overtime_games = COALESCE(p_show_overtime_games, user_feed_preferences.show_overtime_games),
        show_playoff_games = COALESCE(p_show_playoff_games, user_feed_preferences.show_playoff_games),
        show_rivalry_games = COALESCE(p_show_rivalry_games, user_feed_preferences.show_rivalry_games),
        days_back_to_show = COALESCE(p_days_back_to_show, user_feed_preferences.days_back_to_show),
        default_feed_view = COALESCE(p_default_feed_view, user_feed_preferences.default_feed_view),
        games_per_page = COALESCE(p_games_per_page, user_feed_preferences.games_per_page),
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reset feed preferences to defaults
CREATE OR REPLACE FUNCTION public.reset_user_feed_preferences(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    DELETE FROM public.user_feed_preferences
    WHERE user_id = p_user_id;
    
    INSERT INTO public.user_feed_preferences (user_id)
    VALUES (p_user_id);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_feed_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_feed_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_feed_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_feed_preferences TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_feed_preferences IS 'User feed customization preferences for home page algorithm';
COMMENT ON COLUMN public.user_feed_preferences.user_id IS 'User ID from auth.users';
COMMENT ON COLUMN public.user_feed_preferences.prioritize_favorite_teams IS 'Boost games featuring favorite teams in feed';
COMMENT ON COLUMN public.user_feed_preferences.prioritize_favorite_players IS 'Boost games featuring favorite players in feed';
COMMENT ON COLUMN public.user_feed_preferences.show_low_fun_score_games IS 'Include games with low fun scores in feed';
COMMENT ON COLUMN public.user_feed_preferences.min_fun_score_threshold IS 'Minimum fun score to show in feed (0-10)';
COMMENT ON COLUMN public.user_feed_preferences.days_back_to_show IS 'How many days back to show games (1-365)';
COMMENT ON COLUMN public.user_feed_preferences.default_feed_view IS 'Default view mode for feed (grid/list/compact)';
COMMENT ON COLUMN public.user_feed_preferences.games_per_page IS 'Number of games to load per page (3-50)';

