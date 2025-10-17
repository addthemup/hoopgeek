-- =====================================================
-- ADD AUTODRAFT FIELD TO FANTASY TEAMS
-- =====================================================
-- Adds autodraft_enabled field to fantasy_teams table
-- Allows teams to be set to autodraft during the draft
-- =====================================================

-- Add autodraft_enabled column to fantasy_teams table
ALTER TABLE fantasy_teams 
ADD COLUMN IF NOT EXISTS autodraft_enabled BOOLEAN DEFAULT false;

-- Add index for autodraft_enabled for performance
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_autodraft_enabled ON fantasy_teams(autodraft_enabled);

-- Add comment to document the field
COMMENT ON COLUMN fantasy_teams.autodraft_enabled IS 'Whether this team should automatically draft players when it is their turn';

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Update existing policies to include autodraft_enabled field
-- (The field will be automatically included in existing SELECT/UPDATE policies)

-- =====================================================
-- FUNCTIONS FOR AUTODRAFT MANAGEMENT
-- =====================================================

-- Function to toggle autodraft for a team
CREATE OR REPLACE FUNCTION toggle_team_autodraft(
    p_team_id UUID,
    p_enabled BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the team's autodraft setting
    UPDATE fantasy_teams 
    SET 
        autodraft_enabled = p_enabled,
        updated_at = NOW()
    WHERE id = p_team_id;
    
    -- Return true if update was successful
    RETURN FOUND;
END;
$$;

-- Function to get teams with autodraft enabled
CREATE OR REPLACE FUNCTION get_autodraft_teams(
    p_league_id UUID
) RETURNS TABLE (
    team_id UUID,
    team_name TEXT,
    user_id UUID,
    autodraft_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id,
        ft.team_name,
        ft.user_id,
        ft.autodraft_enabled
    FROM fantasy_teams ft
    WHERE ft.league_id = p_league_id
    AND ft.autodraft_enabled = true
    AND ft.is_active = true;
END;
$$;

-- =====================================================
-- GRANTS AND PERMISSIONS
-- =====================================================

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION toggle_team_autodraft(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_autodraft_teams(UUID) TO authenticated;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Added autodraft_enabled field to fantasy_teams table';
    RAISE NOTICE '✅ Created toggle_team_autodraft function';
    RAISE NOTICE '✅ Created get_autodraft_teams function';
    RAISE NOTICE '✅ Added index for performance';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to support team-level autodraft toggles in DraftPicksCarousel.tsx';
    RAISE NOTICE '📋 Features: Individual team autodraft, commissioner controls, real-time updates';
    RAISE NOTICE '🔄 Draft system: Teams can now be set to autodraft independently';
    RAISE NOTICE '🏀 UI: DraftPicksCarousel will show autodraft toggle buttons per team';
    RAISE NOTICE '';
END $$;
