-- =====================================================
-- NBA HOOPSHYPE SALARIES TABLE
-- =====================================================
-- This table stores HoopsHype salary data for NBA players
-- Based on the hoopshype_salaries.json structure
-- =====================================================

CREATE TABLE IF NOT EXISTS nba_hoopshype_salaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Player Information
    player_name TEXT NOT NULL,
    team_name TEXT,
    
    -- Player Reference (links to nba_players table)
    player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    matched_at TIMESTAMP WITH TIME ZONE,
    match_confidence NUMERIC DEFAULT 0.0,
    
    -- Salary Data by Season
    salary_2025_26 BIGINT, -- 2025-26 season salary
    salary_2026_27 BIGINT, -- 2026-27 season salary
    salary_2027_28 BIGINT, -- 2027-28 season salary
    salary_2028_29 BIGINT, -- 2028-29 season salary
    
    -- Contract Information
    contract_years_remaining INTEGER DEFAULT 0, -- Number of years left on contract
    
    -- System Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- HoopsHype Salaries Indexes
CREATE INDEX IF NOT EXISTS idx_nba_hoopshype_salaries_player_id ON nba_hoopshype_salaries(player_id);
CREATE INDEX IF NOT EXISTS idx_nba_hoopshype_salaries_player_name ON nba_hoopshype_salaries(player_name);
CREATE INDEX IF NOT EXISTS idx_nba_hoopshype_salaries_team_name ON nba_hoopshype_salaries(team_name);
CREATE INDEX IF NOT EXISTS idx_nba_hoopshype_salaries_matched ON nba_hoopshype_salaries(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nba_hoopshype_salaries_unmatched ON nba_hoopshype_salaries(player_name) WHERE player_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_nba_hoopshype_salaries_contract_years ON nba_hoopshype_salaries(contract_years_remaining);

-- =====================================================
-- UPSERT FUNCTION FOR HOOPSHYPE SALARIES
-- =====================================================

-- Drop function if it exists to ensure clean creation
DROP FUNCTION IF EXISTS upsert_nba_hoopshype_salary(TEXT, TEXT, UUID, NUMERIC, BIGINT, BIGINT, BIGINT, BIGINT, INTEGER);

CREATE OR REPLACE FUNCTION upsert_nba_hoopshype_salary(
    p_player_name TEXT,
    p_team_name TEXT DEFAULT NULL,
    p_player_id UUID DEFAULT NULL,
    p_match_confidence NUMERIC DEFAULT 0.0,
    p_salary_2025_26 BIGINT DEFAULT NULL,
    p_salary_2026_27 BIGINT DEFAULT NULL,
    p_salary_2027_28 BIGINT DEFAULT NULL,
    p_salary_2028_29 BIGINT DEFAULT NULL,
    p_contract_years_remaining INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    salary_record RECORD;
BEGIN
    -- Try to update existing salary record
    UPDATE nba_hoopshype_salaries SET
        team_name = p_team_name,
        player_id = p_player_id,
        matched_at = CASE WHEN p_player_id IS NOT NULL THEN NOW() ELSE matched_at END,
        match_confidence = p_match_confidence,
        salary_2025_26 = p_salary_2025_26,
        salary_2026_27 = p_salary_2026_27,
        salary_2027_28 = p_salary_2027_28,
        salary_2028_29 = p_salary_2028_29,
        contract_years_remaining = p_contract_years_remaining,
        updated_at = NOW()
    WHERE player_name = p_player_name
    RETURNING * INTO salary_record;
    
    -- If no rows were updated, insert new salary record
    IF NOT FOUND THEN
        INSERT INTO nba_hoopshype_salaries (
            player_name, team_name, player_id, matched_at, match_confidence,
            salary_2025_26, salary_2026_27, salary_2027_28, salary_2028_29,
            contract_years_remaining
        ) VALUES (
            p_player_name, p_team_name, p_player_id, 
            CASE WHEN p_player_id IS NOT NULL THEN NOW() ELSE NULL END, p_match_confidence,
            p_salary_2025_26, p_salary_2026_27, p_salary_2027_28, p_salary_2028_29,
            p_contract_years_remaining
        ) RETURNING * INTO salary_record;
    END IF;
    
    -- Return success result
    result := jsonb_build_object(
        'success', TRUE,
        'action', CASE WHEN FOUND THEN 'updated' ELSE 'inserted' END,
        'salary_id', salary_record.id,
        'player_name', salary_record.player_name,
        'player_id', salary_record.player_id,
        'contract_years_remaining', salary_record.contract_years_remaining
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
GRANT EXECUTE ON FUNCTION upsert_nba_hoopshype_salary TO authenticated;

-- =====================================================
-- MATCH SALARIES TO PLAYERS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION match_hoopshype_salaries_to_players()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    matched_count INTEGER := 0;
    unmatched_count INTEGER := 0;
    salary_record RECORD;
    player_record RECORD;
BEGIN
    -- Get all unmatched salary records
    FOR salary_record IN 
        SELECT id, player_name, team_name 
        FROM nba_hoopshype_salaries 
        WHERE player_id IS NULL
    LOOP
        -- Try to find matching player by name
        SELECT * INTO player_record
        FROM nba_players 
        WHERE LOWER(name) = LOWER(salary_record.player_name)
        AND is_active = true
        LIMIT 1;
        
        IF FOUND THEN
            -- Update salary record with matched player
            UPDATE nba_hoopshype_salaries 
            SET 
                player_id = player_record.id,
                matched_at = NOW(),
                match_confidence = 1.0
            WHERE id = salary_record.id;
            
            matched_count := matched_count + 1;
            RAISE NOTICE 'Matched: % → %', salary_record.player_name, player_record.name;
        ELSE
            unmatched_count := unmatched_count + 1;
        END IF;
    END LOOP;
    
    result := jsonb_build_object(
        'success', TRUE,
        'matched_count', matched_count,
        'unmatched_count', unmatched_count,
        'message', 'Salary matching completed'
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
GRANT EXECUTE ON FUNCTION match_hoopshype_salaries_to_players() TO authenticated;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on the table
ALTER TABLE nba_hoopshype_salaries ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read HoopsHype salaries
CREATE POLICY "Allow authenticated users to read nba_hoopshype_salaries" ON nba_hoopshype_salaries
    FOR SELECT TO authenticated
    USING (true);

-- Allow service role to insert/update/delete (for import scripts)
CREATE POLICY "Allow service role to manage nba_hoopshype_salaries" ON nba_hoopshype_salaries
    FOR ALL TO service_role
    USING (true);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create trigger for updated_at
CREATE TRIGGER update_nba_hoopshype_salaries_updated_at
    BEFORE UPDATE ON nba_hoopshype_salaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ NBA HoopsHype Salaries table created successfully!';
    RAISE NOTICE '✅ Table: nba_hoopshype_salaries';
    RAISE NOTICE '✅ Functions: upsert_nba_hoopshype_salary, match_hoopshype_salaries_to_players';
    RAISE NOTICE '✅ Row Level Security policies configured';
    RAISE NOTICE '✅ Indexes created for performance optimization';
    RAISE NOTICE '✅ Triggers created for updated_at timestamps';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ready to import HoopsHype salary data from JSON';
    RAISE NOTICE '💰 Fields: 2025-26, 2026-27, 2027-28, 2028-29 salaries + contract years';
    RAISE NOTICE '';
END $$;
