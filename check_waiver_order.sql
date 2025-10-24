-- Check if fantasy_waiver_order table exists and has data for your league
SELECT 
    wo.id,
    ft.team_name,
    wo.waiver_priority,
    wo.remaining_budget,
    wo.total_spent,
    wo.total_claims,
    wo.last_claim_date
FROM fantasy_waiver_order wo
JOIN fantasy_teams ft ON ft.id = wo.fantasy_team_id
WHERE wo.league_id = 'de1e54c7-4b7e-4fa2-be1f-339c53c5500a'
ORDER BY wo.waiver_priority ASC;
