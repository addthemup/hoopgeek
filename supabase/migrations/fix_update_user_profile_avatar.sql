-- ============================================================================
-- FIX UPDATE_USER_PROFILE FUNCTION FOR AVATAR_URL
-- ============================================================================
-- Ensure avatar_url is properly updated even when other fields are NULL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_user_id UUID,
    p_display_name TEXT DEFAULT NULL,
    p_avatar_url TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_theme TEXT DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated BOOLEAN := FALSE;
    v_profile_exists BOOLEAN := FALSE;
BEGIN
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = p_user_id) INTO v_profile_exists;
    
    -- If profile doesn't exist, create it first
    IF NOT v_profile_exists THEN
        INSERT INTO public.user_profiles (id, display_name, avatar_url, bio, theme, timezone)
        VALUES (
            p_user_id,
            COALESCE(p_display_name, (SELECT email FROM auth.users WHERE id = p_user_id)),
            p_avatar_url,
            p_bio,
            COALESCE(p_theme, 'system'),
            COALESCE(p_timezone, 'America/New_York')
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Check if insert was successful
        v_profile_exists := EXISTS(SELECT 1 FROM public.user_profiles WHERE id = p_user_id);
        
        IF v_profile_exists THEN
            RAISE NOTICE 'Created new profile for user %', p_user_id;
            v_updated := TRUE;
        ELSE
            RAISE WARNING 'Failed to create profile for user %', p_user_id;
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Update only the fields that are provided (not NULL)
    -- This ensures avatar_url can be updated even if other fields are NULL
    UPDATE public.user_profiles
    SET
        display_name = CASE 
            WHEN p_display_name IS NOT NULL THEN p_display_name 
            ELSE display_name 
        END,
        avatar_url = CASE 
            WHEN p_avatar_url IS NOT NULL THEN p_avatar_url 
            ELSE avatar_url 
        END,
        bio = CASE 
            WHEN p_bio IS NOT NULL THEN p_bio 
            ELSE bio 
        END,
        theme = CASE 
            WHEN p_theme IS NOT NULL THEN p_theme 
            ELSE theme 
        END,
        timezone = CASE 
            WHEN p_timezone IS NOT NULL THEN p_timezone 
            ELSE timezone 
        END,
        updated_at = NOW()
    WHERE id = p_user_id AND id = auth.uid();
    
    -- FOUND is automatically set by PostgreSQL after UPDATE
    IF NOT v_updated THEN
        v_updated := FOUND;
    END IF;
    
    -- Log for debugging (remove in production if needed)
    IF v_updated THEN
        RAISE NOTICE 'Profile updated for user % with avatar_url: %', p_user_id, p_avatar_url;
    ELSE
        RAISE WARNING 'Profile update failed for user % - user not found or not authorized. auth.uid() = %', p_user_id, auth.uid();
    END IF;
    
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_user_profile IS 
'Update user profile fields. Only non-NULL parameters will be updated. Returns TRUE if update was successful.';

