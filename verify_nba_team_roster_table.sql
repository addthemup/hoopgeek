-- =====================================================
-- VERIFY NBA TEAM ROSTER TABLE
-- =====================================================
-- Run this in Supabase SQL Editor to check if the table exists
-- =====================================================

-- Check if table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'nba_team_roster'
        ) 
        THEN '✅ Table nba_team_roster EXISTS'
        ELSE '❌ Table nba_team_roster DOES NOT EXIST'
    END as table_status;

-- If table exists, show structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'nba_team_roster'
ORDER BY ordinal_position;

-- Check row count
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'nba_team_roster'
        ) 
        THEN (SELECT COUNT(*)::text || ' rows in nba_team_roster' FROM nba_team_roster)
        ELSE 'Table does not exist'
    END as row_count;

-- Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'nba_team_roster';

-- Check foreign keys
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'nba_team_roster';

