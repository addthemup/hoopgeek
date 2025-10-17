-- Debug draft state
SELECT 'fantasy_draft_current_state' as table_name, * FROM fantasy_draft_current_state WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b'
UNION ALL
SELECT 'fantasy_draft_order' as table_name, id::text, league_id::text, season_id::text, pick_number::text, round::text, team_position::text, fantasy_team_id::text, is_completed::text, time_started::text, time_expires::text, time_extensions_used::text, auto_pick_reason, auto_pick_enabled::text, created_at::text, updated_at::text FROM fantasy_draft_order WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b' AND pick_number = 1;
