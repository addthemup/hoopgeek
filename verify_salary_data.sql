-- =====================================================
-- SALARY DATA VERIFICATION SCRIPT
-- =====================================================
-- Run this in Supabase SQL Editor to verify salary data
-- =====================================================

-- Check if we have salary data
SELECT 
    COUNT(*) as total_salary_records,
    COUNT(DISTINCT player_id) as players_with_salaries,
    COUNT(CASE WHEN salary_2025_26 > 0 THEN 1 END) as players_with_non_zero_salary
FROM nba_hoopshype_salaries;

-- Check salary data for players in your roster
-- Replace 'YOUR_TEAM_ID' with your actual team ID
SELECT 
    np.id as player_uuid,
    np.name,
    np.nba_player_id,
    nhs.salary_2025_26,
    CASE 
        WHEN nhs.salary_2025_26 IS NULL THEN 'No salary data'
        WHEN nhs.salary_2025_26 = 0 THEN 'Salary is $0'
        ELSE 'Has salary: $' || (nhs.salary_2025_26 / 1000000)::text || 'M'
    END as status
FROM fantasy_roster_spots frs
JOIN nba_players np ON frs.player_id = np.id
LEFT JOIN nba_hoopshype_salaries nhs ON nhs.player_id = np.id
WHERE frs.fantasy_team_id = 'YOUR_TEAM_ID'
ORDER BY nhs.salary_2025_26 DESC NULLS LAST;

-- Check if there are any mismatches in player_id between tables
SELECT 
    np.id as player_uuid,
    np.name,
    np.nba_player_id,
    COUNT(nhs.id) as salary_records_count
FROM nba_players np
LEFT JOIN nba_hoopshype_salaries nhs ON nhs.player_id = np.id
WHERE np.is_active = true
GROUP BY np.id, np.name, np.nba_player_id
HAVING COUNT(nhs.id) = 0
LIMIT 20;

-- Sample of players with salaries
SELECT 
    np.name,
    np.team_abbreviation,
    nhs.salary_2025_26,
    (nhs.salary_2025_26 / 1000000)::numeric(10,1) as salary_millions
FROM nba_players np
JOIN nba_hoopshype_salaries nhs ON nhs.player_id = np.id
WHERE nhs.salary_2025_26 > 0
ORDER BY nhs.salary_2025_26 DESC
LIMIT 20;

