-- Enable Realtime for draft picks and roster changes
-- This allows the Players page to automatically refresh when players are drafted

-- Enable Realtime for fantasy_draft_picks table
ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_draft_picks;

-- Enable Realtime for fantasy_roster_spots table
ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_roster_spots;

-- Verify Realtime is enabled
SELECT 
    schemaname,
    tablename,
    pubname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('fantasy_draft_picks', 'fantasy_roster_spots')
ORDER BY tablename;

