-- =====================================================
-- USER CUSTOMIZATION SYSTEM - MASTER MIGRATION
-- =====================================================
-- This file sets up the complete user customization system
-- Including profiles, favorites, notifications, and feed preferences
--
-- Run this file to create all user customization tables and functions
-- =====================================================

-- Set search path
SET search_path TO public;

-- =====================================================
-- STEP 1: USER PROFILES
-- =====================================================
\echo 'Creating user_profiles table...'
\i user_profiles.sql

-- =====================================================
-- STEP 2: USER FAVORITE PLAYERS
-- =====================================================
\echo 'Creating user_favorite_players table...'
\i user_favorite_players.sql

-- =====================================================
-- STEP 3: USER FAVORITE TEAMS
-- =====================================================
\echo 'Creating user_favorite_teams table...'
\i user_favorite_teams.sql

-- =====================================================
-- STEP 4: USER NOTIFICATION PREFERENCES
-- =====================================================
\echo 'Creating user_notification_preferences table...'
\i user_notification_preferences.sql

-- =====================================================
-- STEP 5: USER FEED PREFERENCES
-- =====================================================
\echo 'Creating user_feed_preferences table...'
\i user_feed_preferences.sql

-- =====================================================
-- HELPER VIEW: COMPLETE USER SETTINGS
-- =====================================================
\echo 'Creating user settings view...'

DROP VIEW IF EXISTS public.user_settings_complete CASCADE;

CREATE VIEW public.user_settings_complete AS
SELECT
    up.id AS user_id,
    up.display_name,
    up.avatar_url,
    up.bio,
    up.theme,
    up.timezone,
    -- Count of favorites
    (SELECT COUNT(*) FROM public.user_favorite_players WHERE user_id = up.id) AS favorite_players_count,
    (SELECT COUNT(*) FROM public.user_favorite_teams WHERE user_id = up.id) AS favorite_teams_count,
    -- Notification preferences
    unp.notifications_enabled,
    unp.email_notifications,
    unp.push_notifications,
    -- Feed preferences
    ufp.min_fun_score_threshold,
    ufp.days_back_to_show,
    ufp.default_feed_view,
    -- Timestamps
    up.created_at,
    up.updated_at
FROM public.user_profiles up
LEFT JOIN public.user_notification_preferences unp ON up.id = unp.user_id
LEFT JOIN public.user_feed_preferences ufp ON up.id = ufp.user_id;

-- Grant access to view
GRANT SELECT ON public.user_settings_complete TO authenticated;

COMMENT ON VIEW public.user_settings_complete IS 'Complete user settings including profile, favorites counts, notifications, and feed preferences';

-- =====================================================
-- HELPER FUNCTION: GET COMPLETE USER SETTINGS
-- =====================================================
\echo 'Creating helper function for complete user settings...'

CREATE OR REPLACE FUNCTION public.get_complete_user_settings(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    theme TEXT,
    timezone TEXT,
    favorite_players_count BIGINT,
    favorite_teams_count BIGINT,
    notifications_enabled BOOLEAN,
    email_notifications BOOLEAN,
    push_notifications BOOLEAN,
    min_fun_score_threshold NUMERIC,
    days_back_to_show INTEGER,
    default_feed_view TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        usc.user_id,
        usc.display_name,
        usc.avatar_url,
        usc.bio,
        usc.theme,
        usc.timezone,
        usc.favorite_players_count,
        usc.favorite_teams_count,
        usc.notifications_enabled,
        usc.email_notifications,
        usc.push_notifications,
        usc.min_fun_score_threshold,
        usc.days_back_to_show,
        usc.default_feed_view,
        usc.created_at,
        usc.updated_at
    FROM public.user_settings_complete usc
    WHERE usc.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_complete_user_settings TO authenticated;

COMMENT ON FUNCTION public.get_complete_user_settings IS 'Get all user settings in one query';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
\echo ''
\echo '✅ User customization system created successfully!'
\echo ''
\echo 'Tables created:'
\echo '  - user_profiles'
\echo '  - user_favorite_players'
\echo '  - user_favorite_teams'
\echo '  - user_notification_preferences'
\echo '  - user_feed_preferences'
\echo ''
\echo 'Views created:'
\echo '  - user_settings_complete'
\echo ''
\echo 'All RLS policies, triggers, and helper functions have been created.'
\echo ''

