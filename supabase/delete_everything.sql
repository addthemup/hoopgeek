-- Delete Everything Script
-- Use this to completely wipe your Supabase database
-- WARNING: This will delete ALL data and tables!

-- Drop all tables in correct order (due to foreign key constraints)
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS draft_chat_messages CASCADE;
DROP TABLE IF EXISTS draft_lobby_participants CASCADE;
DROP TABLE IF EXISTS weekly_matchups CASCADE;
DROP TABLE IF EXISTS league_schedule_settings CASCADE;
DROP TABLE IF EXISTS league_invitations CASCADE;
DROP TABLE IF EXISTS draft_picks CASCADE;
DROP TABLE IF EXISTS fantasy_team_players CASCADE;
DROP TABLE IF EXISTS roster_spots CASCADE;
DROP TABLE IF EXISTS fantasy_teams CASCADE;
DROP TABLE IF EXISTS league_members CASCADE;
DROP TABLE IF EXISTS league_states CASCADE;
DROP TABLE IF EXISTS league_settings CASCADE;
DROP TABLE IF EXISTS draft_order CASCADE;
DROP TABLE IF EXISTS draft_picks CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;
DROP TABLE IF EXISTS player_game_logs CASCADE;
DROP TABLE IF EXISTS player_season_stats CASCADE;
DROP TABLE IF EXISTS player_career_stats CASCADE;
DROP TABLE IF EXISTS nba_games CASCADE;
DROP TABLE IF EXISTS nba_season_weeks CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_invite_code() CASCADE;
DROP FUNCTION IF EXISTS create_league_with_commissioner(TEXT, TEXT, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_league_with_commissioner(TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, BIGINT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_league_with_commissioner(TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, BIGINT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS create_league_with_commissioner(TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, BIGINT, TEXT, JSONB, TIMESTAMP WITH TIME ZONE) CASCADE;
DROP FUNCTION IF EXISTS assign_team_to_user(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS upsert_player(INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, DATE, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, BIGINT, BOOLEAN, BOOLEAN, INTEGER, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS generate_league_schedule(UUID, INTEGER, INTEGER, INTEGER, DATE) CASCADE;
DROP FUNCTION IF EXISTS generate_draft_order(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS regenerate_draft_order(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_draft_order(UUID) CASCADE;
DROP FUNCTION IF EXISTS process_trade(UUID) CASCADE;

-- Drop all extensions (optional - be careful with this)
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- Note: This script will completely wipe your database
-- Make sure you have backups if you need to preserve any data
