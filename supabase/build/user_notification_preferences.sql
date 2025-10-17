-- =====================================================
-- USER NOTIFICATION PREFERENCES TABLE
-- =====================================================
-- Stores user's notification preferences for various events
-- Used to control which notifications the user receives
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS public.user_notification_preferences CASCADE;

-- Create user_notification_preferences table
CREATE TABLE public.user_notification_preferences (
    -- Primary key - references auth.users (one row per user)
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- General notification settings
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT false,
    
    -- Content notifications
    new_highlights BOOLEAN DEFAULT true, -- Notify on new game highlights
    featured_games BOOLEAN DEFAULT true, -- Notify on featured/high fun score games
    
    -- Fantasy league notifications
    league_results BOOLEAN DEFAULT true, -- Notify on fantasy league matchup results
    draft_reminders BOOLEAN DEFAULT true, -- Notify before draft starts
    trade_proposals BOOLEAN DEFAULT true, -- Notify on trade proposals/offers
    waiver_wire_results BOOLEAN DEFAULT true, -- Notify on waiver wire results
    lineup_reminders BOOLEAN DEFAULT true, -- Notify to set lineup before games
    
    -- Player notifications
    player_injury_reports BOOLEAN DEFAULT true, -- Notify on player injuries
    player_milestones BOOLEAN DEFAULT true, -- Notify on player career milestones
    favorite_player_games BOOLEAN DEFAULT true, -- Notify when favorite players have games
    
    -- Team notifications
    favorite_team_games BOOLEAN DEFAULT true, -- Notify when favorite teams have games
    favorite_team_trades BOOLEAN DEFAULT false, -- Notify on favorite team roster changes
    
    -- Social notifications
    league_chat_messages BOOLEAN DEFAULT true, -- Notify on league chat messages
    comments_on_posts BOOLEAN DEFAULT true, -- Notify on comments/replies
    mentions BOOLEAN DEFAULT true, -- Notify when mentioned by other users
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Index on user_id for faster lookups (already primary key, but explicit)
CREATE INDEX idx_user_notification_preferences_user_id ON public.user_notification_preferences(user_id);

-- Index for users with notifications enabled
CREATE INDEX idx_user_notification_preferences_enabled ON public.user_notification_preferences(user_id) 
WHERE notifications_enabled = true;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notification preferences
CREATE POLICY "Users can view their own notification preferences"
    ON public.user_notification_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own notification preferences
CREATE POLICY "Users can insert their own notification preferences"
    ON public.user_notification_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own notification preferences
CREATE POLICY "Users can update their own notification preferences"
    ON public.user_notification_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notification preferences
CREATE POLICY "Users can delete their own notification preferences"
    ON public.user_notification_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_notification_preferences_updated_at
    BEFORE UPDATE ON public.user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_notification_preferences_updated_at();

-- Trigger: Auto-create default notification preferences on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if not already exists)
DROP TRIGGER IF EXISTS on_auth_user_created_notification_prefs ON auth.users;
CREATE TRIGGER on_auth_user_created_notification_prefs
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_notification_preferences();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get user notification preferences
CREATE OR REPLACE FUNCTION public.get_user_notification_preferences(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    notifications_enabled BOOLEAN,
    email_notifications BOOLEAN,
    push_notifications BOOLEAN,
    new_highlights BOOLEAN,
    featured_games BOOLEAN,
    league_results BOOLEAN,
    draft_reminders BOOLEAN,
    trade_proposals BOOLEAN,
    waiver_wire_results BOOLEAN,
    lineup_reminders BOOLEAN,
    player_injury_reports BOOLEAN,
    player_milestones BOOLEAN,
    favorite_player_games BOOLEAN,
    favorite_team_games BOOLEAN,
    favorite_team_trades BOOLEAN,
    league_chat_messages BOOLEAN,
    comments_on_posts BOOLEAN,
    mentions BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        unp.user_id,
        unp.notifications_enabled,
        unp.email_notifications,
        unp.push_notifications,
        unp.new_highlights,
        unp.featured_games,
        unp.league_results,
        unp.draft_reminders,
        unp.trade_proposals,
        unp.waiver_wire_results,
        unp.lineup_reminders,
        unp.player_injury_reports,
        unp.player_milestones,
        unp.favorite_player_games,
        unp.favorite_team_games,
        unp.favorite_team_trades,
        unp.league_chat_messages,
        unp.comments_on_posts,
        unp.mentions,
        unp.created_at,
        unp.updated_at
    FROM public.user_notification_preferences unp
    WHERE unp.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update user notification preferences
CREATE OR REPLACE FUNCTION public.update_user_notification_preferences(
    p_user_id UUID,
    p_notifications_enabled BOOLEAN DEFAULT NULL,
    p_email_notifications BOOLEAN DEFAULT NULL,
    p_push_notifications BOOLEAN DEFAULT NULL,
    p_new_highlights BOOLEAN DEFAULT NULL,
    p_featured_games BOOLEAN DEFAULT NULL,
    p_league_results BOOLEAN DEFAULT NULL,
    p_draft_reminders BOOLEAN DEFAULT NULL,
    p_trade_proposals BOOLEAN DEFAULT NULL,
    p_waiver_wire_results BOOLEAN DEFAULT NULL,
    p_lineup_reminders BOOLEAN DEFAULT NULL,
    p_player_injury_reports BOOLEAN DEFAULT NULL,
    p_player_milestones BOOLEAN DEFAULT NULL,
    p_favorite_player_games BOOLEAN DEFAULT NULL,
    p_favorite_team_games BOOLEAN DEFAULT NULL,
    p_favorite_team_trades BOOLEAN DEFAULT NULL,
    p_league_chat_messages BOOLEAN DEFAULT NULL,
    p_comments_on_posts BOOLEAN DEFAULT NULL,
    p_mentions BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Upsert notification preferences
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO UPDATE SET
        notifications_enabled = COALESCE(p_notifications_enabled, user_notification_preferences.notifications_enabled),
        email_notifications = COALESCE(p_email_notifications, user_notification_preferences.email_notifications),
        push_notifications = COALESCE(p_push_notifications, user_notification_preferences.push_notifications),
        new_highlights = COALESCE(p_new_highlights, user_notification_preferences.new_highlights),
        featured_games = COALESCE(p_featured_games, user_notification_preferences.featured_games),
        league_results = COALESCE(p_league_results, user_notification_preferences.league_results),
        draft_reminders = COALESCE(p_draft_reminders, user_notification_preferences.draft_reminders),
        trade_proposals = COALESCE(p_trade_proposals, user_notification_preferences.trade_proposals),
        waiver_wire_results = COALESCE(p_waiver_wire_results, user_notification_preferences.waiver_wire_results),
        lineup_reminders = COALESCE(p_lineup_reminders, user_notification_preferences.lineup_reminders),
        player_injury_reports = COALESCE(p_player_injury_reports, user_notification_preferences.player_injury_reports),
        player_milestones = COALESCE(p_player_milestones, user_notification_preferences.player_milestones),
        favorite_player_games = COALESCE(p_favorite_player_games, user_notification_preferences.favorite_player_games),
        favorite_team_games = COALESCE(p_favorite_team_games, user_notification_preferences.favorite_team_games),
        favorite_team_trades = COALESCE(p_favorite_team_trades, user_notification_preferences.favorite_team_trades),
        league_chat_messages = COALESCE(p_league_chat_messages, user_notification_preferences.league_chat_messages),
        comments_on_posts = COALESCE(p_comments_on_posts, user_notification_preferences.comments_on_posts),
        mentions = COALESCE(p_mentions, user_notification_preferences.mentions),
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Disable all notifications for user
CREATE OR REPLACE FUNCTION public.disable_all_notifications(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    UPDATE public.user_notification_preferences
    SET
        notifications_enabled = false,
        email_notifications = false,
        push_notifications = false,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Enable all notifications for user
CREATE OR REPLACE FUNCTION public.enable_all_notifications(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    UPDATE public.user_notification_preferences
    SET
        notifications_enabled = true,
        email_notifications = true,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_notification_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_notification_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_all_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.enable_all_notifications TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_notification_preferences IS 'User notification preferences for various event types';
COMMENT ON COLUMN public.user_notification_preferences.user_id IS 'User ID from auth.users';
COMMENT ON COLUMN public.user_notification_preferences.notifications_enabled IS 'Master toggle for all notifications';
COMMENT ON COLUMN public.user_notification_preferences.email_notifications IS 'Enable email notifications';
COMMENT ON COLUMN public.user_notification_preferences.push_notifications IS 'Enable push notifications';
COMMENT ON COLUMN public.user_notification_preferences.new_highlights IS 'Notify on new game highlights';
COMMENT ON COLUMN public.user_notification_preferences.league_results IS 'Notify on fantasy league matchup results';
COMMENT ON COLUMN public.user_notification_preferences.trade_proposals IS 'Notify on trade proposals/offers';
COMMENT ON COLUMN public.user_notification_preferences.player_injury_reports IS 'Notify on player injuries';

