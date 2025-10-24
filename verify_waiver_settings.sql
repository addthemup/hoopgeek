-- =====================================================
-- Verify Waiver Settings are Saving Correctly
-- =====================================================

-- Check waiver settings for all active seasons
SELECT 
    l.league_name,
    ls.season_year,
    ls.is_active,
    ls.waiver_type,
    ls.waiver_period_hours,
    ls.waiver_budget_amount,
    ls.waiver_min_bid,
    ls.waiver_priority_reset,
    ls.waiver_process_time,
    ls.waiver_claim_days
FROM fantasy_league_seasons ls
JOIN fantasy_leagues l ON l.id = ls.league_id
WHERE ls.is_active = true
ORDER BY ls.created_at DESC;

-- If you want to check a specific league:
-- WHERE l.id = 'YOUR_LEAGUE_ID_HERE';

-- Expected output should show:
-- waiver_type: 'faab' (or 'rolling', 'continuous', 'none')
-- waiver_period_hours: 24 (or your configured value)
-- waiver_budget_amount: 100
-- waiver_min_bid: 1
-- etc.

-- If these columns show NULL, the settings are NOT being saved correctly!

