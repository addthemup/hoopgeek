-- =====================================================
-- NBA ESPN PROJECTIONS TABLE
-- =====================================================
-- This table stores ESPN fantasy basketball player projections
-- Based on the espn_projections.json structure
-- =====================================================

CREATE TABLE IF NOT EXISTS nba_espn_projections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- ESPN Player Information
    espn_name TEXT NOT NULL,
    espn_team TEXT,
    espn_position TEXT,
    
    -- Player Reference (links to nba_players table)
    player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    matched_at TIMESTAMP WITH TIME ZONE,
    match_confidence NUMERIC DEFAULT 0.0,
    
    -- 2025 Statistics (actual stats from last season)
    stats_2025_gp INTEGER, -- Games Played
    stats_2025_min NUMERIC, -- Minutes per game
    stats_2025_fg_pct NUMERIC, -- Field Goal Percentage
    stats_2025_ft_pct NUMERIC, -- Free Throw Percentage
    stats_2025_3pm NUMERIC, -- 3-Pointers Made per game
    stats_2025_reb NUMERIC, -- Rebounds per game
    stats_2025_ast NUMERIC, -- Assists per game
    stats_2025_ato NUMERIC, -- Assist to Turnover ratio
    stats_2025_stl NUMERIC, -- Steals per game
    stats_2025_blk NUMERIC, -- Blocks per game
    stats_2025_to NUMERIC, -- Turnovers per game
    stats_2025_pts NUMERIC, -- Points per game
    
    -- 2026 Projections (ESPN's projections for next season)
    proj_2026_gp INTEGER, -- Projected Games Played
    proj_2026_min NUMERIC, -- Projected Minutes per game
    proj_2026_fg_pct NUMERIC, -- Projected Field Goal Percentage
    proj_2026_ft_pct NUMERIC, -- Projected Free Throw Percentage
    proj_2026_3pm NUMERIC, -- Projected 3-Pointers Made per game
    proj_2026_reb NUMERIC, -- Projected Rebounds per game
    proj_2026_ast NUMERIC, -- Projected Assists per game
    proj_2026_ato NUMERIC, -- Projected Assist to Turnover ratio
    proj_2026_stl NUMERIC, -- Projected Steals per game
    proj_2026_blk NUMERIC, -- Projected Blocks per game
    proj_2026_to NUMERIC, -- Projected Turnovers per game
    proj_2026_pts NUMERIC, -- Projected Points per game
    
    -- 2026 Outlook (ESPN's analysis/outlook text)
    outlook_2026 TEXT,
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- ESPN Projections Indexes
CREATE INDEX IF NOT EXISTS idx_nba_espn_projections_player_id ON nba_espn_projections(player_id);
CREATE INDEX IF NOT EXISTS idx_nba_espn_projections_espn_name ON nba_espn_projections(espn_name);
CREATE INDEX IF NOT EXISTS idx_nba_espn_projections_espn_team ON nba_espn_projections(espn_team);
CREATE INDEX IF NOT EXISTS idx_nba_espn_projections_espn_position ON nba_espn_projections(espn_position);
CREATE INDEX IF NOT EXISTS idx_nba_espn_projections_matched ON nba_espn_projections(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nba_espn_projections_unmatched ON nba_espn_projections(espn_name) WHERE player_id IS NULL;

-- =====================================================
-- UPSERT FUNCTION FOR ESPN PROJECTIONS
-- =====================================================

-- Drop function if it exists to ensure clean creation
DROP FUNCTION IF EXISTS upsert_nba_espn_projection(TEXT, TEXT, TEXT, UUID, NUMERIC, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION upsert_nba_espn_projection(
    p_espn_name TEXT,
    p_espn_team TEXT DEFAULT NULL,
    p_espn_position TEXT DEFAULT NULL,
    p_player_id UUID DEFAULT NULL,
    p_match_confidence NUMERIC DEFAULT 0.0,
    p_stats_2025_gp INTEGER DEFAULT NULL,
    p_stats_2025_min NUMERIC DEFAULT NULL,
    p_stats_2025_fg_pct NUMERIC DEFAULT NULL,
    p_stats_2025_ft_pct NUMERIC DEFAULT NULL,
    p_stats_2025_3pm NUMERIC DEFAULT NULL,
    p_stats_2025_reb NUMERIC DEFAULT NULL,
    p_stats_2025_ast NUMERIC DEFAULT NULL,
    p_stats_2025_ato NUMERIC DEFAULT NULL,
    p_stats_2025_stl NUMERIC DEFAULT NULL,
    p_stats_2025_blk NUMERIC DEFAULT NULL,
    p_stats_2025_to NUMERIC DEFAULT NULL,
    p_stats_2025_pts NUMERIC DEFAULT NULL,
    p_proj_2026_gp INTEGER DEFAULT NULL,
    p_proj_2026_min NUMERIC DEFAULT NULL,
    p_proj_2026_fg_pct NUMERIC DEFAULT NULL,
    p_proj_2026_ft_pct NUMERIC DEFAULT NULL,
    p_proj_2026_3pm NUMERIC DEFAULT NULL,
    p_proj_2026_reb NUMERIC DEFAULT NULL,
    p_proj_2026_ast NUMERIC DEFAULT NULL,
    p_proj_2026_ato NUMERIC DEFAULT NULL,
    p_proj_2026_stl NUMERIC DEFAULT NULL,
    p_proj_2026_blk NUMERIC DEFAULT NULL,
    p_proj_2026_to NUMERIC DEFAULT NULL,
    p_proj_2026_pts NUMERIC DEFAULT NULL,
    p_outlook_2026 TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    projection_record RECORD;
BEGIN
    -- Try to update existing projection
    UPDATE nba_espn_projections SET
        espn_team = p_espn_team,
        espn_position = p_espn_position,
        player_id = p_player_id,
        matched_at = CASE WHEN p_player_id IS NOT NULL THEN NOW() ELSE matched_at END,
        match_confidence = p_match_confidence,
        stats_2025_gp = p_stats_2025_gp,
        stats_2025_min = p_stats_2025_min,
        stats_2025_fg_pct = p_stats_2025_fg_pct,
        stats_2025_ft_pct = p_stats_2025_ft_pct,
        stats_2025_3pm = p_stats_2025_3pm,
        stats_2025_reb = p_stats_2025_reb,
        stats_2025_ast = p_stats_2025_ast,
        stats_2025_ato = p_stats_2025_ato,
        stats_2025_stl = p_stats_2025_stl,
        stats_2025_blk = p_stats_2025_blk,
        stats_2025_to = p_stats_2025_to,
        stats_2025_pts = p_stats_2025_pts,
        proj_2026_gp = p_proj_2026_gp,
        proj_2026_min = p_proj_2026_min,
        proj_2026_fg_pct = p_proj_2026_fg_pct,
        proj_2026_ft_pct = p_proj_2026_ft_pct,
        proj_2026_3pm = p_proj_2026_3pm,
        proj_2026_reb = p_proj_2026_reb,
        proj_2026_ast = p_proj_2026_ast,
        proj_2026_ato = p_proj_2026_ato,
        proj_2026_stl = p_proj_2026_stl,
        proj_2026_blk = p_proj_2026_blk,
        proj_2026_to = p_proj_2026_to,
        proj_2026_pts = p_proj_2026_pts,
        outlook_2026 = p_outlook_2026,
        updated_at = NOW()
    WHERE espn_name = p_espn_name
    RETURNING * INTO projection_record;
    
    -- If no rows were updated, insert new projection
    IF NOT FOUND THEN
        INSERT INTO nba_espn_projections (
            espn_name, espn_team, espn_position, player_id, matched_at, match_confidence,
            stats_2025_gp, stats_2025_min, stats_2025_fg_pct, stats_2025_ft_pct, stats_2025_3pm,
            stats_2025_reb, stats_2025_ast, stats_2025_ato, stats_2025_stl, stats_2025_blk,
            stats_2025_to, stats_2025_pts,
            proj_2026_gp, proj_2026_min, proj_2026_fg_pct, proj_2026_ft_pct, proj_2026_3pm,
            proj_2026_reb, proj_2026_ast, proj_2026_ato, proj_2026_stl, proj_2026_blk,
            proj_2026_to, proj_2026_pts, outlook_2026
        ) VALUES (
            p_espn_name, p_espn_team, p_espn_position, p_player_id, 
            CASE WHEN p_player_id IS NOT NULL THEN NOW() ELSE NULL END, p_match_confidence,
            p_stats_2025_gp, p_stats_2025_min, p_stats_2025_fg_pct, p_stats_2025_ft_pct, p_stats_2025_3pm,
            p_stats_2025_reb, p_stats_2025_ast, p_stats_2025_ato, p_stats_2025_stl, p_stats_2025_blk,
            p_stats_2025_to, p_stats_2025_pts,
            p_proj_2026_gp, p_proj_2026_min, p_proj_2026_fg_pct, p_proj_2026_ft_pct, p_proj_2026_3pm,
            p_proj_2026_reb, p_proj_2026_ast, p_proj_2026_ato, p_proj_2026_stl, p_proj_2026_blk,
            p_proj_2026_to, p_proj_2026_pts, p_outlook_2026
        ) RETURNING * INTO projection_record;
    END IF;
    
    -- Return success result
    result := jsonb_build_object(
        'success', TRUE,
        'action', CASE WHEN FOUND THEN 'updated' ELSE 'inserted' END,
        'projection_id', projection_record.id,
        'espn_name', projection_record.espn_name,
        'player_id', projection_record.player_id
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION upsert_nba_espn_projection TO authenticated;

-- =====================================================
-- MATCH PROJECTIONS TO PLAYERS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION match_espn_projections_to_players()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    matched_count INTEGER := 0;
    unmatched_count INTEGER := 0;
    projection_record RECORD;
    player_record RECORD;
BEGIN
    -- Get all unmatched projections
    FOR projection_record IN 
        SELECT id, espn_name, espn_team 
        FROM nba_espn_projections 
        WHERE player_id IS NULL
    LOOP
        -- Try to find matching player by name
        SELECT * INTO player_record
        FROM nba_players 
        WHERE LOWER(name) = LOWER(projection_record.espn_name)
        AND is_active = true
        LIMIT 1;
        
        IF FOUND THEN
            -- Update projection with matched player
            UPDATE nba_espn_projections 
            SET 
                player_id = player_record.id,
                matched_at = NOW(),
                match_confidence = 1.0
            WHERE id = projection_record.id;
            
            matched_count := matched_count + 1;
            RAISE NOTICE 'Matched: % → %', projection_record.espn_name, player_record.name;
        ELSE
            unmatched_count := unmatched_count + 1;
        END IF;
    END LOOP;
    
    result := jsonb_build_object(
        'success', TRUE,
        'matched_count', matched_count,
        'unmatched_count', unmatched_count,
        'message', 'Projection matching completed'
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_espn_projections_to_players() TO authenticated;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on the table
ALTER TABLE nba_espn_projections ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read ESPN projections
CREATE POLICY "Allow authenticated users to read nba_espn_projections" ON nba_espn_projections
    FOR SELECT TO authenticated
    USING (true);

-- Allow service role to insert/update/delete (for import scripts)
CREATE POLICY "Allow service role to manage nba_espn_projections" ON nba_espn_projections
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create trigger for updated_at
CREATE TRIGGER update_nba_espn_projections_updated_at
    BEFORE UPDATE ON nba_espn_projections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ NBA ESPN Projections table created successfully!';
    RAISE NOTICE '✅ Table: nba_espn_projections';
    RAISE NOTICE '✅ Functions: upsert_nba_espn_projection, match_espn_projections_to_players';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to import ESPN projections from JSON';
    RAISE NOTICE '📊 Fields: 2025 stats, 2026 projections, outlook text';
    RAISE NOTICE '';
END $$;
