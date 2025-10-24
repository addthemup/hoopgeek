-- Update existing leagues to have default waiver settings if they're NULL
-- This ensures all leagues work with the waiver system

UPDATE fantasy_league_seasons
SET 
    waiver_type = COALESCE(waiver_type, 'rolling'),
    waiver_period_hours = COALESCE(waiver_period_hours, 48),
    waiver_budget_amount = COALESCE(waiver_budget_amount, 100),
    waiver_min_bid = COALESCE(waiver_min_bid, 0),
    waiver_priority_reset = COALESCE(waiver_priority_reset, 'after_claim'),
    waiver_process_time = COALESCE(waiver_process_time, '03:00:00')
WHERE waiver_type IS NULL 
   OR waiver_period_hours IS NULL 
   OR waiver_budget_amount IS NULL
   OR waiver_min_bid IS NULL
   OR waiver_priority_reset IS NULL
   OR waiver_process_time IS NULL;

-- Verify the update
SELECT 
    COUNT(*) as total_seasons,
    COUNT(CASE WHEN waiver_type IS NOT NULL THEN 1 END) as with_waiver_type,
    COUNT(CASE WHEN waiver_period_hours IS NOT NULL THEN 1 END) as with_waiver_period
FROM fantasy_league_seasons;

