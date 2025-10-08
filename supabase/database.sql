-- HoopGeek Fantasy Basketball Database Schema
-- Complete consolidated schema including all migrations and original database
-- This replaces all previous migrations and provides a clean, complete database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop all existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS fantasy_season_weeks CASCADE;
DROP TABLE IF EXISTS dynasty_keepers CASCADE;
DROP TABLE IF EXISTS dynasty_settings CASCADE;
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
DROP TABLE IF EXISTS divisions CASCADE;
DROP TABLE IF EXISTS league_members CASCADE;
DROP TABLE IF EXISTS league_states CASCADE;
DROP TABLE IF EXISTS league_settings CASCADE;
DROP TABLE IF EXISTS draft_order CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;
DROP TABLE IF EXISTS player_game_logs CASCADE;
DROP TABLE IF EXISTS player_season_stats CASCADE;
DROP TABLE IF EXISTS player_career_stats CASCADE;
DROP TABLE IF EXISTS nba_games CASCADE;
DROP TABLE IF EXISTS nba_season_weeks CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- ============================================================================
-- PLAYERS SYSTEM (from migrations)
-- ============================================================================

-- Create players table with NBA API fields
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  nba_player_id INTEGER UNIQUE NOT NULL, -- NBA API player ID (PERSON_ID)
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  player_slug TEXT, -- PLAYER_SLUG from PlayerIndex
  position TEXT,
  team_id INTEGER, -- NBA API team ID
  team_name TEXT,
  team_abbreviation TEXT,
  team_slug TEXT, -- TEAM_SLUG from PlayerIndex
  team_city TEXT, -- TEAM_CITY from PlayerIndex
  is_defunct BOOLEAN DEFAULT false, -- IS_DEFUNCT from PlayerIndex
  jersey_number TEXT,
  height TEXT, -- e.g., "6-8"
  weight INTEGER, -- in pounds
  age INTEGER,
  birth_date DATE,
  birth_city TEXT,
  birth_state TEXT,
  birth_country TEXT,
  college TEXT,
  country TEXT, -- COUNTRY from PlayerIndex
  draft_year INTEGER,
  draft_round INTEGER,
  draft_number INTEGER,
  salary BIGINT DEFAULT 0, -- Current season salary
  -- HoopsHype salary data for next 4 years
  salary_2025_26 BIGINT,
  salary_2026_27 BIGINT,
  salary_2027_28 BIGINT,
  salary_2028_29 BIGINT,
  contract_years_remaining INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_rookie BOOLEAN DEFAULT false,
  years_pro INTEGER DEFAULT 0,
  from_year INTEGER, -- First year in NBA
  to_year INTEGER, -- Last year in NBA (null if active)
  roster_status TEXT, -- ROSTER_STATUS from PlayerIndex
  current_pts DECIMAL(5,1), -- PTS from PlayerIndex (current season stats)
  current_reb DECIMAL(5,1), -- REB from PlayerIndex (current season stats)
  current_ast DECIMAL(5,1), -- AST from PlayerIndex (current season stats)
  stats_timeframe TEXT, -- STATS_TIMEFRAME from PlayerIndex
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Player Season Stats Table
CREATE TABLE IF NOT EXISTS player_season_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    season VARCHAR(10) NOT NULL, -- e.g., "2023-24"
    team_id BIGINT,
    team_name VARCHAR(50),
    team_abbreviation VARCHAR(10),
    age INTEGER,
    gp INTEGER, -- Games played
    gs INTEGER, -- Games started
    min_per_game DECIMAL(5,2), -- Minutes per game
    fgm_per_game DECIMAL(5,2),
    fga_per_game DECIMAL(5,2),
    fg_pct DECIMAL(5,3),
    fg3m_per_game DECIMAL(5,2),
    fg3a_per_game DECIMAL(5,2),
    fg3_pct DECIMAL(5,3),
    ftm_per_game DECIMAL(5,2),
    fta_per_game DECIMAL(5,2),
    ft_pct DECIMAL(5,3),
    oreb_per_game DECIMAL(5,2),
    dreb_per_game DECIMAL(5,2),
    reb_per_game DECIMAL(5,2),
    ast_per_game DECIMAL(5,2),
    stl_per_game DECIMAL(5,2),
    blk_per_game DECIMAL(5,2),
    tov_per_game DECIMAL(5,2),
    pf_per_game DECIMAL(5,2),
    pts_per_game DECIMAL(5,2),
    plus_minus_per_game DECIMAL(5,2),
    fantasy_pts_per_game DECIMAL(6,2),
    -- Totals
    total_min INTEGER,
    total_fgm INTEGER,
    total_fga INTEGER,
    total_fg3m INTEGER,
    total_fg3a INTEGER,
    total_ftm INTEGER,
    total_fta INTEGER,
    total_oreb INTEGER,
    total_dreb INTEGER,
    total_reb INTEGER,
    total_ast INTEGER,
    total_stl INTEGER,
    total_blk INTEGER,
    total_tov INTEGER,
    total_pf INTEGER,
    total_pts INTEGER,
    total_fantasy_pts DECIMAL(8,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season)
);

-- Player Career Stats Tables (from NBA API PlayerCareerStats endpoint)

-- Career Totals - Regular Season
CREATE TABLE IF NOT EXISTS player_career_totals_regular_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    league_id BIGINT,
    team_id BIGINT,
    gp INTEGER, -- Games played
    gs INTEGER, -- Games started
    min_total INTEGER, -- Total minutes
    fgm INTEGER, -- Field goals made
    fga INTEGER, -- Field goals attempted
    fg_pct DECIMAL(5,3), -- Field goal percentage
    fg3m INTEGER, -- 3-pointers made
    fg3a INTEGER, -- 3-pointers attempted
    fg3_pct DECIMAL(5,3), -- 3-point percentage
    ftm INTEGER, -- Free throws made
    fta INTEGER, -- Free throws attempted
    ft_pct DECIMAL(5,3), -- Free throw percentage
    oreb INTEGER, -- Offensive rebounds
    dreb INTEGER, -- Defensive rebounds
    reb INTEGER, -- Total rebounds
    ast INTEGER, -- Assists
    stl INTEGER, -- Steals
    blk INTEGER, -- Blocks
    tov INTEGER, -- Turnovers
    pf INTEGER, -- Personal fouls
    pts INTEGER, -- Points
    fantasy_pts DECIMAL(10,2), -- Calculated fantasy points
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id)
);

-- Career Totals - Post Season
CREATE TABLE IF NOT EXISTS player_career_totals_post_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    league_id BIGINT,
    team_id BIGINT,
    gp INTEGER,
    gs INTEGER,
    min_total INTEGER,
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    oreb INTEGER,
    dreb INTEGER,
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pf INTEGER,
    pts INTEGER,
    fantasy_pts DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id)
);

-- Career Totals - All Star Season
CREATE TABLE IF NOT EXISTS player_career_totals_all_star_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    league_id BIGINT,
    team_id BIGINT,
    gp INTEGER,
    gs INTEGER,
    min_total INTEGER,
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    oreb INTEGER,
    dreb INTEGER,
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pf INTEGER,
    pts INTEGER,
    fantasy_pts DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id)
);

-- Career Totals - College Season
CREATE TABLE IF NOT EXISTS player_career_totals_college_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    league_id BIGINT,
    organization_id BIGINT,
    gp INTEGER,
    gs INTEGER,
    min_total INTEGER,
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    oreb INTEGER,
    dreb INTEGER,
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pf INTEGER,
    pts INTEGER,
    fantasy_pts DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id)
);

-- Season Totals - Regular Season (year-by-year breakdown)
CREATE TABLE IF NOT EXISTS player_season_totals_regular_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    season_id VARCHAR(10) NOT NULL, -- e.g., "2023-24"
    league_id BIGINT,
    team_id BIGINT,
    team_abbreviation VARCHAR(10),
    player_age INTEGER,
    gp INTEGER,
    gs INTEGER,
    min_total INTEGER,
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    oreb INTEGER,
    dreb INTEGER,
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pf INTEGER,
    pts INTEGER,
    fantasy_pts DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season_id)
);

-- Season Totals - Post Season (year-by-year breakdown)
CREATE TABLE IF NOT EXISTS player_season_totals_post_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    season_id VARCHAR(10) NOT NULL,
    league_id BIGINT,
    team_id BIGINT,
    team_abbreviation VARCHAR(10),
    player_age INTEGER,
    gp INTEGER,
    gs INTEGER,
    min_total INTEGER,
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    oreb INTEGER,
    dreb INTEGER,
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pf INTEGER,
    pts INTEGER,
    fantasy_pts DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season_id)
);

-- Season Totals - All Star Season (year-by-year breakdown)
CREATE TABLE IF NOT EXISTS player_season_totals_all_star_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    season_id VARCHAR(10) NOT NULL,
    league_id BIGINT,
    team_id BIGINT,
    team_abbreviation VARCHAR(10),
    player_age INTEGER,
    gp INTEGER,
    gs INTEGER,
    min_total INTEGER,
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    oreb INTEGER,
    dreb INTEGER,
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pf INTEGER,
    pts INTEGER,
    fantasy_pts DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season_id)
);

-- Season Totals - College Season (year-by-year breakdown)
CREATE TABLE IF NOT EXISTS player_season_totals_college_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    season_id VARCHAR(10) NOT NULL,
    league_id BIGINT,
    organization_id BIGINT,
    school_name VARCHAR(100),
    player_age INTEGER,
    gp INTEGER,
    gs INTEGER,
    min_total INTEGER,
    fgm INTEGER,
    fga INTEGER,
    fg_pct DECIMAL(5,3),
    fg3m INTEGER,
    fg3a INTEGER,
    fg3_pct DECIMAL(5,3),
    ftm INTEGER,
    fta INTEGER,
    ft_pct DECIMAL(5,3),
    oreb INTEGER,
    dreb INTEGER,
    reb INTEGER,
    ast INTEGER,
    stl INTEGER,
    blk INTEGER,
    tov INTEGER,
    pf INTEGER,
    pts INTEGER,
    fantasy_pts DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season_id)
);

-- Season Rankings - Regular Season (year-by-year rankings)
CREATE TABLE IF NOT EXISTS player_season_rankings_regular_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    season_id VARCHAR(10) NOT NULL,
    league_id BIGINT,
    team_id BIGINT,
    team_abbreviation VARCHAR(10),
    player_age INTEGER,
    gp INTEGER,
    gs INTEGER,
    rank_min INTEGER,
    rank_fgm INTEGER,
    rank_fga INTEGER,
    rank_fg_pct INTEGER,
    rank_fg3m INTEGER,
    rank_fg3a INTEGER,
    rank_fg3_pct INTEGER,
    rank_ftm INTEGER,
    rank_fta INTEGER,
    rank_ft_pct INTEGER,
    rank_oreb INTEGER,
    rank_dreb INTEGER,
    rank_reb INTEGER,
    rank_ast INTEGER,
    rank_stl INTEGER,
    rank_blk INTEGER,
    rank_tov INTEGER,
    rank_pts INTEGER,
    rank_eff INTEGER, -- Efficiency ranking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season_id)
);

-- Season Rankings - Post Season (year-by-year rankings)
CREATE TABLE IF NOT EXISTS player_season_rankings_post_season (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    season_id VARCHAR(10) NOT NULL,
    league_id BIGINT,
    team_id BIGINT,
    team_abbreviation VARCHAR(10),
    player_age INTEGER,
    gp INTEGER,
    gs INTEGER,
    rank_min INTEGER,
    rank_fgm INTEGER,
    rank_fga INTEGER,
    rank_fg_pct INTEGER,
    rank_fg3m INTEGER,
    rank_fg3a INTEGER,
    rank_fg3_pct INTEGER,
    rank_ftm INTEGER,
    rank_fta INTEGER,
    rank_ft_pct INTEGER,
    rank_oreb INTEGER,
    rank_dreb INTEGER,
    rank_reb INTEGER,
    rank_ast INTEGER,
    rank_stl INTEGER,
    rank_blk INTEGER,
    rank_tov INTEGER,
    rank_pts INTEGER,
    rank_eff INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season_id)
);

-- NBA Games Table (comprehensive NBA API data)
CREATE TABLE IF NOT EXISTS nba_games (
    id BIGSERIAL PRIMARY KEY,
    -- Basic game info
    league_id INTEGER,
    season_year INTEGER NOT NULL,
    game_date DATE NOT NULL,
    game_id VARCHAR(50) UNIQUE NOT NULL,
    game_code VARCHAR(20),
    game_status INTEGER, -- 1=Not Started, 2=In Progress, 3=Final
    game_status_text VARCHAR(50),
    game_sequence INTEGER,
    game_date_est TIMESTAMP WITH TIME ZONE,
    game_time_est TIME,
    game_datetime_est TIMESTAMP WITH TIME ZONE,
    game_date_utc TIMESTAMP WITH TIME ZONE,
    game_time_utc TIME,
    game_datetime_utc TIMESTAMP WITH TIME ZONE,
    away_team_time TIME,
    home_team_time TIME,
    day INTEGER,
    month_num INTEGER,
    week_number INTEGER,
    week_name VARCHAR(50),
    if_necessary BOOLEAN DEFAULT false,
    series_game_number INTEGER,
    game_label VARCHAR(100),
    game_sub_label VARCHAR(100),
    series_text VARCHAR(200),
    -- Arena info
    arena_name VARCHAR(100),
    arena_state VARCHAR(50),
    arena_city VARCHAR(50),
    postponed_status VARCHAR(50),
    branch_link TEXT,
    game_subtype VARCHAR(50),
    is_neutral BOOLEAN DEFAULT false,
    -- Home team info
    home_team_id INTEGER,
    home_team_name VARCHAR(50),
    home_team_city VARCHAR(50),
    home_team_tricode VARCHAR(10),
    home_team_slug VARCHAR(50),
    home_team_wins INTEGER,
    home_team_losses INTEGER,
    home_team_score INTEGER,
    home_team_seed INTEGER,
    -- Away team info
    away_team_id INTEGER,
    away_team_name VARCHAR(50),
    away_team_city VARCHAR(50),
    away_team_tricode VARCHAR(10),
    away_team_slug VARCHAR(50),
    away_team_wins INTEGER,
    away_team_losses INTEGER,
    away_team_score INTEGER,
    away_team_seed INTEGER,
    -- Points leaders
    points_leaders_person_id INTEGER,
    points_leaders_first_name VARCHAR(50),
    points_leaders_last_name VARCHAR(50),
    points_leaders_team_id INTEGER,
    points_leaders_team_city VARCHAR(50),
    points_leaders_team_name VARCHAR(50),
    points_leaders_team_tricode VARCHAR(10),
    points_leaders_points INTEGER,
    -- Broadcasters (simplified - storing main broadcaster info)
    national_broadcasters_scope VARCHAR(50),
    national_broadcasters_media VARCHAR(50),
    national_broadcasters_display VARCHAR(100),
    home_tv_broadcasters_display VARCHAR(100),
    away_tv_broadcasters_display VARCHAR(100),
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player Game Logs Table (comprehensive NBA API data)
CREATE TABLE IF NOT EXISTS player_game_logs (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    nba_player_id BIGINT NOT NULL,
    game_id VARCHAR(50) NOT NULL REFERENCES nba_games(game_id) ON DELETE CASCADE,
    -- Basic game info
    season_year VARCHAR(10) NOT NULL, -- e.g., "2024-25"
    player_name VARCHAR(100) NOT NULL,
    team_id INTEGER,
    team_abbreviation VARCHAR(10),
    team_name VARCHAR(50),
    game_date DATE NOT NULL,
    matchup VARCHAR(20) NOT NULL, -- e.g., "LAL @ GSW"
    wl CHAR(1), -- W or L
    -- Playing time
    min INTEGER, -- Minutes played
    -- Shooting stats
    fgm INTEGER, -- Field goals made
    fga INTEGER, -- Field goals attempted
    fg_pct DECIMAL(5,3), -- Field goal percentage
    fg3m INTEGER, -- 3-pointers made
    fg3a INTEGER, -- 3-pointers attempted
    fg3_pct DECIMAL(5,3), -- 3-point percentage
    ftm INTEGER, -- Free throws made
    fta INTEGER, -- Free throws attempted
    ft_pct DECIMAL(5,3), -- Free throw percentage
    -- Rebounding stats
    oreb INTEGER, -- Offensive rebounds
    dreb INTEGER, -- Defensive rebounds
    reb INTEGER, -- Total rebounds
    -- Other stats
    ast INTEGER, -- Assists
    tov INTEGER, -- Turnovers
    stl INTEGER, -- Steals
    blk INTEGER, -- Blocks
    blka INTEGER, -- Blocks against
    pf INTEGER, -- Personal fouls
    pfd INTEGER, -- Personal fouls drawn
    pts INTEGER, -- Points
    plus_minus INTEGER, -- Plus/minus
    -- Fantasy and advanced stats
    nba_fantasy_pts DECIMAL(6,2), -- NBA Fantasy points
    dd2 INTEGER, -- Double doubles
    td3 INTEGER, -- Triple doubles
    -- Rankings (season-based)
    gp_rank INTEGER,
    w_rank INTEGER,
    l_rank INTEGER,
    w_pct_rank INTEGER,
    min_rank INTEGER,
    fgm_rank INTEGER,
    fga_rank INTEGER,
    fg_pct_rank INTEGER,
    fg3m_rank INTEGER,
    fg3a_rank INTEGER,
    fg3_pct_rank INTEGER,
    ftm_rank INTEGER,
    fta_rank INTEGER,
    ft_pct_rank INTEGER,
    oreb_rank INTEGER,
    dreb_rank INTEGER,
    reb_rank INTEGER,
    ast_rank INTEGER,
    tov_rank INTEGER,
    stl_rank INTEGER,
    blk_rank INTEGER,
    blka_rank INTEGER,
    pf_rank INTEGER,
    pfd_rank INTEGER,
    pts_rank INTEGER,
    plus_minus_rank INTEGER,
    nba_fantasy_pts_rank INTEGER,
    dd2_rank INTEGER,
    td3_rank INTEGER,
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, game_id)
);

-- NBA Season Weeks Table
CREATE TABLE IF NOT EXISTS nba_season_weeks (
    id BIGSERIAL PRIMARY KEY,
    league_id INTEGER,
    season_year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    week_name VARCHAR(50),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(league_id, season_year, week_number)
);

-- ============================================================================
-- LEAGUE SYSTEM (from original database.sql and migrations)
-- ============================================================================

-- Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  commissioner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  max_teams INTEGER NOT NULL DEFAULT 10 CHECK (max_teams >= 4 AND max_teams <= 20),
  scoring_type TEXT NOT NULL DEFAULT 'H2H_Points' CHECK (scoring_type IN (
    'Roto', 'H2H_Points', 'H2H_Category', 'H2H_Most_Categories', 'Season_Points'
  )),
  draft_type TEXT NOT NULL DEFAULT 'snake' CHECK (draft_type IN ('snake', 'linear')),
  draft_date TIMESTAMP WITH TIME ZONE,
  draft_status TEXT NOT NULL DEFAULT 'scheduled' CHECK (draft_status IN (
    'scheduled', 'in_progress', 'completed', 'cancelled'
  )),
  salary_cap BIGINT DEFAULT 100000000, -- $100M default salary cap
  salary_cap_amount BIGINT DEFAULT 100000000, -- $100M default salary cap amount
  salary_cap_enabled BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  invite_code TEXT UNIQUE,
  season_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  lineup_frequency TEXT DEFAULT 'daily' CHECK (lineup_frequency IN ('daily', 'weekly', 'monthly')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create league_settings table
CREATE TABLE IF NOT EXISTS league_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  draft_type TEXT CHECK (draft_type IN ('snake', 'linear', 'auction')) DEFAULT 'snake',
  draft_rounds INTEGER DEFAULT 15,
  roster_positions JSONB DEFAULT '{
    "PG": 1,
    "SG": 1,
    "SF": 1,
    "PF": 1,
    "C": 1,
    "G": 1,
    "F": 1,
    "UTIL": 1,
    "BENCH": 3
  }',
  scoring_categories JSONB DEFAULT '{
    "points": 1,
    "rebounds": 1,
    "assists": 1,
    "steals": 1,
    "blocks": 1,
    "turnovers": -1,
    "field_goal_percentage": 0,
    "free_throw_percentage": 0,
    "three_point_percentage": 0,
    "three_pointers_made": 1,
    "double_doubles": 2,
    "triple_doubles": 5
  }',
  waiver_wire BOOLEAN DEFAULT TRUE,
  waiver_period_days INTEGER DEFAULT 2,
  max_trades_per_team INTEGER DEFAULT 10,
  max_adds_per_team INTEGER DEFAULT 50,
  playoff_teams INTEGER DEFAULT 6,
  playoff_weeks INTEGER DEFAULT 3,
  playoff_start_week INTEGER DEFAULT 20,
  keeper_league BOOLEAN DEFAULT FALSE,
  max_keepers INTEGER DEFAULT 0,
  public_league BOOLEAN DEFAULT FALSE,
  allow_duplicate_players BOOLEAN DEFAULT FALSE,
  lineup_deadline TEXT DEFAULT 'daily',
  lineup_lock_time TEXT DEFAULT '00:00',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create league_members table
CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  draft_order INTEGER,
  is_commissioner BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, user_id),
  UNIQUE(league_id, team_name)
);

-- Create divisions table
CREATE TABLE IF NOT EXISTS divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  division_order INTEGER NOT NULL, -- Order for display (1, 2, 3, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, name),
  UNIQUE(league_id, division_order)
);

-- Create fantasy_teams table (consolidated fantasy team information)
CREATE TABLE IF NOT EXISTS fantasy_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  division_id UUID REFERENCES divisions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_name TEXT NOT NULL,
  team_abbreviation TEXT,
  draft_position INTEGER,
  is_commissioner BOOLEAN DEFAULT false,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ties INTEGER DEFAULT 0,
  points_for DECIMAL(10,2) DEFAULT 0,
  points_against DECIMAL(10,2) DEFAULT 0,
  salary_cap_used BIGINT DEFAULT 0,
  salary_cap_max BIGINT DEFAULT 100000000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

-- Create draft_order table
CREATE TABLE IF NOT EXISTS draft_order (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  team_position INTEGER NOT NULL,
  player_id INTEGER REFERENCES players(id),
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Note: draft_picks table is created separately in fix_draft_picks.sql
-- to handle existing table conflicts

-- Create league_states table
CREATE TABLE IF NOT EXISTS league_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  current_phase TEXT CHECK (current_phase IN ('setup', 'draft', 'regular_season', 'playoffs', 'completed')) DEFAULT 'setup',
  current_week INTEGER DEFAULT 0,
  current_season INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create roster_spots table (defines available roster positions)
CREATE TABLE IF NOT EXISTS roster_spots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  position TEXT NOT NULL CHECK (position IN ('PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL', 'BENCH', 'IR')),
  position_order INTEGER NOT NULL, -- Order for display (1-10 for starters, 11+ for bench)
  is_starter BOOLEAN DEFAULT false,
  is_bench BOOLEAN DEFAULT false,
  is_injured_reserve BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fantasy_team_players table (roster composition)
CREATE TABLE IF NOT EXISTS fantasy_team_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  roster_spot_id UUID REFERENCES roster_spots(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL, -- NULL for empty spots
  position TEXT NOT NULL CHECK (position IN ('PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL', 'BENCH', 'IR')),
  is_starter BOOLEAN DEFAULT false,
  is_injured BOOLEAN DEFAULT false,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fantasy_team_id, roster_spot_id)
);

-- Create draft_picks table
CREATE TABLE IF NOT EXISTS draft_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  pick_number INTEGER NOT NULL,
  round INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, pick_number)
);

-- Create league_invitations table
CREATE TABLE IF NOT EXISTS league_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Create league_schedule_settings table (schedule configuration)
CREATE TABLE IF NOT EXISTS league_schedule_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  regular_season_weeks INTEGER NOT NULL DEFAULT 18,
  playoff_weeks INTEGER NOT NULL DEFAULT 3,
  playoff_teams INTEGER NOT NULL DEFAULT 6,
  playoff_start_week INTEGER NOT NULL DEFAULT 19,
  matchup_type TEXT NOT NULL DEFAULT 'weekly' CHECK (matchup_type IN ('weekly', 'daily')),
  season_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  season_end_date DATE,
  is_schedule_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id)
);

-- Create weekly_matchups table (enhanced for comprehensive scheduling)
CREATE TABLE IF NOT EXISTS weekly_matchups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  fantasy_team1_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  fantasy_team2_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  season_year INTEGER NOT NULL,
  season_type TEXT NOT NULL DEFAULT 'regular' CHECK (season_type IN ('regular', 'playoff', 'championship')),
  playoff_round INTEGER, -- NULL for regular season, 1-3 for playoffs
  matchup_date DATE,
  fantasy_team1_score DECIMAL(10,2) DEFAULT 0,
  fantasy_team2_score DECIMAL(10,2) DEFAULT 0,
  winner_fantasy_team_id UUID REFERENCES fantasy_teams(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  is_manual_override BOOLEAN DEFAULT false, -- True if commissioner manually edited
  notes TEXT, -- Commissioner notes about the matchup
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, fantasy_team1_id, fantasy_team2_id, week_number, season_year)
);

-- Create draft_chat_messages table for live draft chat
CREATE TABLE IF NOT EXISTS draft_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'chat' CHECK (message_type IN ('chat', 'system', 'pick_announcement', 'trade_announcement')),
  is_commissioner_message BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create draft_lobby_participants table to track who's in the draft lobby
CREATE TABLE draft_lobby_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_online BOOLEAN DEFAULT true,
  UNIQUE(league_id, user_id)
);

-- Create trades table for trade proposals
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  proposing_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  receiving_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  trade_items JSONB NOT NULL, -- Stores the trade items (players and picks)
  message TEXT, -- Optional message from the proposing team
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

-- Create player_watchlist table (league-specific watchlist)
CREATE TABLE player_watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT, -- Optional notes about why the player is on watchlist
  UNIQUE(league_id, user_id, player_id)
);

-- Create player_favorites table (site-wide favorites)
CREATE TABLE player_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT, -- Optional notes about why the player is a favorite
  UNIQUE(user_id, player_id)
);

-- Create dynasty_keepers table (tracks kept players from season to season)
CREATE TABLE dynasty_keepers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  fantasy_team_id UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL, -- e.g., 2024, 2025
  keeper_round INTEGER, -- Round the player was kept in (for draft order purposes)
  keeper_cost DECIMAL(10,2) DEFAULT 0, -- Cost to keep the player (for salary cap leagues)
  is_rookie_keeper BOOLEAN DEFAULT false, -- True if this is a rookie being kept
  keeper_notes TEXT, -- Optional notes about the keeper decision
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, fantasy_team_id, player_id, season_year)
);

-- Create dynasty_settings table (league-specific dynasty configuration)
CREATE TABLE dynasty_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  is_dynasty_league BOOLEAN DEFAULT false,
  max_keepers INTEGER DEFAULT 0, -- Maximum number of keepers per team
  min_keepers INTEGER DEFAULT 0, -- Minimum number of keepers per team
  keeper_deadline DATE, -- Deadline for declaring keepers
  keeper_cost_type TEXT DEFAULT 'free' CHECK (keeper_cost_type IN ('free', 'draft_round', 'salary_cap', 'auction')),
  rookie_keeper_bonus INTEGER DEFAULT 0, -- Extra years for rookie keepers
  max_keeper_years INTEGER DEFAULT 0, -- Maximum years a player can be kept (0 = unlimited)
  keeper_trade_deadline DATE, -- Deadline for trading keepers
  allow_keeper_trades BOOLEAN DEFAULT true,
  keeper_penalty_type TEXT DEFAULT 'none' CHECK (keeper_penalty_type IN ('none', 'draft_round', 'salary_increase', 'years_penalty')),
  keeper_penalty_amount DECIMAL(5,2) DEFAULT 0, -- Amount of penalty (rounds, salary %, years)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id)
);

-- Create fantasy_season_weeks table (site-wide fantasy week structure)
CREATE TABLE fantasy_season_weeks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_year INTEGER NOT NULL, -- e.g., 2025, 2026
  week_number INTEGER NOT NULL, -- 1-25 for regular season
  week_name TEXT NOT NULL, -- e.g., "Week 1", "Week 2"
  start_date DATE NOT NULL, -- Start of fantasy week
  end_date DATE NOT NULL, -- End of fantasy week
  is_regular_season BOOLEAN DEFAULT true, -- true for regular season, false for playoffs
  is_playoff_week BOOLEAN DEFAULT false, -- true for playoff weeks
  playoff_round INTEGER, -- NULL for regular season, 1-3 for playoffs
  is_active BOOLEAN DEFAULT true, -- Whether this week is currently active
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season_year, week_number)
);

-- ESPN Fantasy Basketball Player Projections
CREATE TABLE espn_player_projections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  espn_name VARCHAR(255) NOT NULL,
  espn_team VARCHAR(50),
  espn_position VARCHAR(20),
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  matched_at TIMESTAMP WITH TIME ZONE,
  match_confidence DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 1.0 confidence score
  -- 2025 Statistics
  stats_2025_gp INTEGER,
  stats_2025_min DECIMAL(4,1),
  stats_2025_fg_pct DECIMAL(4,3),
  stats_2025_ft_pct DECIMAL(4,3),
  stats_2025_3pm DECIMAL(4,1),
  stats_2025_reb DECIMAL(4,1),
  stats_2025_ast DECIMAL(4,1),
  stats_2025_ato DECIMAL(4,2),
  stats_2025_stl DECIMAL(4,1),
  stats_2025_blk DECIMAL(4,1),
  stats_2025_to DECIMAL(4,1),
  stats_2025_pts DECIMAL(4,1),
  -- 2026 Projections
  proj_2026_gp INTEGER,
  proj_2026_min DECIMAL(4,1),
  proj_2026_fg_pct DECIMAL(4,3),
  proj_2026_ft_pct DECIMAL(4,3),
  proj_2026_3pm DECIMAL(4,1),
  proj_2026_reb DECIMAL(4,1),
  proj_2026_ast DECIMAL(4,1),
  proj_2026_ato DECIMAL(4,2),
  proj_2026_stl DECIMAL(4,1),
  proj_2026_blk DECIMAL(4,1),
  proj_2026_to DECIMAL(4,1),
  proj_2026_pts DECIMAL(4,1),
  -- 2026 Outlook
  outlook_2026 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(espn_name)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Player indexes
CREATE INDEX idx_players_nba_id ON players(nba_player_id);
CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_team_name ON players(team_name);
CREATE INDEX idx_players_salary ON players(salary);
CREATE INDEX idx_players_salary_2025_26 ON players(salary_2025_26);
CREATE INDEX idx_players_salary_2026_27 ON players(salary_2026_27);
CREATE INDEX idx_players_salary_2027_28 ON players(salary_2027_28);
CREATE INDEX idx_players_salary_2028_29 ON players(salary_2028_29);
CREATE INDEX idx_players_contract_years ON players(contract_years_remaining);
CREATE INDEX idx_players_active ON players(is_active);
CREATE INDEX idx_players_draft_year ON players(draft_year);
CREATE INDEX idx_players_player_slug ON players(player_slug);
CREATE INDEX idx_players_team_slug ON players(team_slug);
CREATE INDEX idx_players_team_city ON players(team_city);
CREATE INDEX idx_players_is_defunct ON players(is_defunct);
CREATE INDEX idx_players_country ON players(country);
CREATE INDEX idx_players_roster_status ON players(roster_status);
CREATE INDEX idx_players_stats_timeframe ON players(stats_timeframe);

-- Player stats indexes
CREATE INDEX idx_player_game_logs_player_id ON player_game_logs(player_id);
CREATE INDEX idx_player_game_logs_nba_player_id ON player_game_logs(nba_player_id);
CREATE INDEX idx_player_game_logs_game_id ON player_game_logs(game_id);
CREATE INDEX idx_player_game_logs_game_date ON player_game_logs(game_date);
CREATE INDEX idx_player_game_logs_season_year ON player_game_logs(season_year);
CREATE INDEX idx_player_game_logs_team_id ON player_game_logs(team_id);
CREATE INDEX idx_player_game_logs_player_season ON player_game_logs(player_id, season_year);
CREATE INDEX idx_player_season_stats_player_season ON player_season_stats(player_id, season);

-- Career stats indexes
CREATE INDEX idx_player_career_totals_regular_season_player_id ON player_career_totals_regular_season(player_id);
CREATE INDEX idx_player_career_totals_regular_season_nba_id ON player_career_totals_regular_season(nba_player_id);
CREATE INDEX idx_player_career_totals_post_season_player_id ON player_career_totals_post_season(player_id);
CREATE INDEX idx_player_career_totals_post_season_nba_id ON player_career_totals_post_season(nba_player_id);
CREATE INDEX idx_player_career_totals_all_star_season_player_id ON player_career_totals_all_star_season(player_id);
CREATE INDEX idx_player_career_totals_all_star_season_nba_id ON player_career_totals_all_star_season(nba_player_id);
CREATE INDEX idx_player_career_totals_college_season_player_id ON player_career_totals_college_season(player_id);
CREATE INDEX idx_player_career_totals_college_season_nba_id ON player_career_totals_college_season(nba_player_id);

-- Season totals indexes
CREATE INDEX idx_player_season_totals_regular_season_player_id ON player_season_totals_regular_season(player_id);
CREATE INDEX idx_player_season_totals_regular_season_nba_id ON player_season_totals_regular_season(nba_player_id);
CREATE INDEX idx_player_season_totals_regular_season_season ON player_season_totals_regular_season(season_id);
CREATE INDEX idx_player_season_totals_post_season_player_id ON player_season_totals_post_season(player_id);
CREATE INDEX idx_player_season_totals_post_season_nba_id ON player_season_totals_post_season(nba_player_id);
CREATE INDEX idx_player_season_totals_post_season_season ON player_season_totals_post_season(season_id);
CREATE INDEX idx_player_season_totals_all_star_season_player_id ON player_season_totals_all_star_season(player_id);
CREATE INDEX idx_player_season_totals_all_star_season_nba_id ON player_season_totals_all_star_season(nba_player_id);
CREATE INDEX idx_player_season_totals_all_star_season_season ON player_season_totals_all_star_season(season_id);
CREATE INDEX idx_player_season_totals_college_season_player_id ON player_season_totals_college_season(player_id);
CREATE INDEX idx_player_season_totals_college_season_nba_id ON player_season_totals_college_season(nba_player_id);
CREATE INDEX idx_player_season_totals_college_season_season ON player_season_totals_college_season(season_id);

-- Season rankings indexes
CREATE INDEX idx_player_season_rankings_regular_season_player_id ON player_season_rankings_regular_season(player_id);
CREATE INDEX idx_player_season_rankings_regular_season_nba_id ON player_season_rankings_regular_season(nba_player_id);
CREATE INDEX idx_player_season_rankings_regular_season_season ON player_season_rankings_regular_season(season_id);
CREATE INDEX idx_player_season_rankings_post_season_player_id ON player_season_rankings_post_season(player_id);
CREATE INDEX idx_player_season_rankings_post_season_nba_id ON player_season_rankings_post_season(nba_player_id);
CREATE INDEX idx_player_season_rankings_post_season_season ON player_season_rankings_post_season(season_id);
CREATE INDEX idx_nba_games_game_date ON nba_games(game_date);
CREATE INDEX idx_nba_games_season_year ON nba_games(season_year);
CREATE INDEX idx_nba_games_game_id ON nba_games(game_id);
CREATE INDEX idx_nba_games_home_team ON nba_games(home_team_id);
CREATE INDEX idx_nba_games_away_team ON nba_games(away_team_id);
CREATE INDEX idx_nba_games_week_number ON nba_games(week_number);
CREATE INDEX idx_nba_games_status ON nba_games(game_status);
CREATE INDEX idx_nba_season_weeks_season ON nba_season_weeks(season_year);
CREATE INDEX idx_nba_season_weeks_week ON nba_season_weeks(week_number);

-- League indexes
CREATE INDEX idx_leagues_commissioner ON leagues(commissioner_id);
CREATE INDEX idx_leagues_invite_code ON leagues(invite_code);
CREATE INDEX idx_leagues_public ON leagues(is_public);
CREATE INDEX idx_league_settings_league ON league_settings(league_id);
CREATE INDEX idx_league_members_league ON league_members(league_id);
CREATE INDEX idx_league_members_user ON league_members(user_id);
CREATE INDEX idx_divisions_league ON divisions(league_id);
CREATE INDEX idx_divisions_order ON divisions(league_id, division_order);
CREATE INDEX idx_fantasy_teams_league ON fantasy_teams(league_id);
CREATE INDEX idx_fantasy_teams_division ON fantasy_teams(division_id);
CREATE INDEX idx_fantasy_teams_user ON fantasy_teams(user_id);
CREATE INDEX idx_draft_order_league ON draft_order(league_id);
CREATE INDEX idx_draft_order_round_pick ON draft_order(league_id, round, pick_number);
-- draft_picks indexes are created in fix_draft_picks.sql
CREATE INDEX idx_league_states_league ON league_states(league_id);
CREATE INDEX idx_roster_spots_league ON roster_spots(league_id);
CREATE INDEX idx_roster_spots_position ON roster_spots(position);
CREATE INDEX idx_fantasy_team_players_team ON fantasy_team_players(fantasy_team_id);
CREATE INDEX idx_fantasy_team_players_roster_spot ON fantasy_team_players(roster_spot_id);
CREATE INDEX idx_fantasy_team_players_player ON fantasy_team_players(player_id);
CREATE INDEX idx_draft_picks_league ON draft_picks(league_id);
CREATE INDEX idx_draft_picks_fantasy_team ON draft_picks(fantasy_team_id);
CREATE INDEX idx_league_invitations_league ON league_invitations(league_id);
CREATE INDEX idx_league_invitations_fantasy_team ON league_invitations(fantasy_team_id);
CREATE INDEX idx_league_invitations_token ON league_invitations(token);
CREATE INDEX idx_league_schedule_settings_league ON league_schedule_settings(league_id);
CREATE INDEX idx_weekly_matchups_league ON weekly_matchups(league_id);
CREATE INDEX idx_weekly_matchups_week ON weekly_matchups(week_number, season_year);
CREATE INDEX idx_weekly_matchups_season_type ON weekly_matchups(season_type);
CREATE INDEX idx_weekly_matchups_playoff_round ON weekly_matchups(playoff_round);
CREATE INDEX idx_weekly_matchups_teams ON weekly_matchups(fantasy_team1_id, fantasy_team2_id);
CREATE INDEX idx_draft_chat_messages_league ON draft_chat_messages(league_id);
CREATE INDEX idx_draft_chat_messages_created_at ON draft_chat_messages(created_at);
CREATE INDEX idx_draft_chat_messages_user ON draft_chat_messages(user_id);
CREATE INDEX idx_draft_chat_messages_league_user ON draft_chat_messages(league_id, user_id);
CREATE INDEX idx_draft_chat_messages_fantasy_team ON draft_chat_messages(fantasy_team_id);
CREATE INDEX idx_draft_lobby_participants_league ON draft_lobby_participants(league_id);
CREATE INDEX idx_draft_lobby_participants_user ON draft_lobby_participants(user_id);
CREATE INDEX idx_draft_lobby_participants_online ON draft_lobby_participants(is_online);
CREATE INDEX idx_draft_lobby_participants_league_user ON draft_lobby_participants(league_id, user_id);
CREATE INDEX idx_draft_lobby_participants_fantasy_team ON draft_lobby_participants(fantasy_team_id);
CREATE INDEX idx_trades_league ON trades(league_id);
CREATE INDEX idx_trades_proposing_team ON trades(proposing_team_id);
CREATE INDEX idx_trades_receiving_team ON trades(receiving_team_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_created_at ON trades(created_at);
CREATE INDEX idx_player_watchlist_league ON player_watchlist(league_id);
CREATE INDEX idx_player_watchlist_user ON player_watchlist(user_id);
CREATE INDEX idx_player_watchlist_player ON player_watchlist(player_id);
CREATE INDEX idx_player_watchlist_league_user ON player_watchlist(league_id, user_id);
CREATE INDEX idx_player_favorites_user ON player_favorites(user_id);
CREATE INDEX idx_player_favorites_player ON player_favorites(player_id);
CREATE INDEX idx_dynasty_keepers_league ON dynasty_keepers(league_id);
CREATE INDEX idx_dynasty_keepers_team ON dynasty_keepers(fantasy_team_id);
CREATE INDEX idx_dynasty_keepers_player ON dynasty_keepers(player_id);
CREATE INDEX idx_dynasty_keepers_season ON dynasty_keepers(season_year);
CREATE INDEX idx_dynasty_keepers_league_season ON dynasty_keepers(league_id, season_year);
CREATE INDEX idx_dynasty_keepers_team_season ON dynasty_keepers(fantasy_team_id, season_year);
CREATE INDEX idx_dynasty_settings_league ON dynasty_settings(league_id);
CREATE INDEX idx_fantasy_season_weeks_season ON fantasy_season_weeks(season_year);
CREATE INDEX idx_fantasy_season_weeks_week ON fantasy_season_weeks(season_year, week_number);
CREATE INDEX idx_fantasy_season_weeks_dates ON fantasy_season_weeks(start_date, end_date);
CREATE INDEX idx_fantasy_season_weeks_active ON fantasy_season_weeks(is_active);

-- ESPN projections indexes
CREATE INDEX idx_espn_projections_name ON espn_player_projections(espn_name);
CREATE INDEX idx_espn_projections_team ON espn_player_projections(espn_team);
CREATE INDEX idx_espn_projections_position ON espn_player_projections(espn_position);
CREATE INDEX idx_espn_projections_player_id ON espn_player_projections(player_id);
CREATE INDEX idx_espn_projections_matched ON espn_player_projections(matched_at);
CREATE INDEX idx_espn_projections_confidence ON espn_player_projections(match_confidence);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_game_logs_updated_at 
    BEFORE UPDATE ON player_game_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_season_stats_updated_at 
    BEFORE UPDATE ON player_season_stats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Career stats triggers
CREATE TRIGGER update_player_career_totals_regular_season_updated_at 
    BEFORE UPDATE ON player_career_totals_regular_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_career_totals_post_season_updated_at 
    BEFORE UPDATE ON player_career_totals_post_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_career_totals_all_star_season_updated_at 
    BEFORE UPDATE ON player_career_totals_all_star_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_career_totals_college_season_updated_at 
    BEFORE UPDATE ON player_career_totals_college_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_season_totals_regular_season_updated_at 
    BEFORE UPDATE ON player_season_totals_regular_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_season_totals_post_season_updated_at 
    BEFORE UPDATE ON player_season_totals_post_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_season_totals_all_star_season_updated_at 
    BEFORE UPDATE ON player_season_totals_all_star_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_season_totals_college_season_updated_at 
    BEFORE UPDATE ON player_season_totals_college_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_season_rankings_regular_season_updated_at 
    BEFORE UPDATE ON player_season_rankings_regular_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_season_rankings_post_season_updated_at 
    BEFORE UPDATE ON player_season_rankings_post_season 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nba_games_updated_at 
    BEFORE UPDATE ON nba_games 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nba_season_weeks_updated_at 
    BEFORE UPDATE ON nba_season_weeks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leagues_updated_at 
    BEFORE UPDATE ON leagues 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_divisions_updated_at 
    BEFORE UPDATE ON divisions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_teams_updated_at 
    BEFORE UPDATE ON fantasy_teams 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_states_updated_at 
    BEFORE UPDATE ON league_states 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_league_schedule_settings_updated_at 
    BEFORE UPDATE ON league_schedule_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_matchups_updated_at 
    BEFORE UPDATE ON weekly_matchups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at 
    BEFORE UPDATE ON trades 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dynasty_keepers_updated_at 
    BEFORE UPDATE ON dynasty_keepers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fantasy_season_weeks_updated_at 
    BEFORE UPDATE ON fantasy_season_weeks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_espn_player_projections_updated_at 
    BEFORE UPDATE ON espn_player_projections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dynasty_settings_updated_at 
    BEFORE UPDATE ON dynasty_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
BEGIN
  RETURN upper(substring(md5(random()::text) from 1 for 8));
END;
$$ LANGUAGE plpgsql;

-- Drop the old function first to avoid conflicts
DROP FUNCTION IF EXISTS create_league_with_commissioner(TEXT, TEXT, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_league_with_commissioner(TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, BIGINT, TEXT, JSONB) CASCADE;

-- Create function to create league with commissioner
CREATE OR REPLACE FUNCTION create_league_with_commissioner(
  league_name TEXT,
  league_description TEXT DEFAULT NULL,
  max_teams_count INTEGER DEFAULT 10,
  scoring_type_val TEXT DEFAULT 'H2H_Points',
  team_name_val TEXT DEFAULT NULL,
  salary_cap_enabled_val BOOLEAN DEFAULT true,
  salary_cap_amount_val BIGINT DEFAULT 100000000,
  lineup_frequency_val TEXT DEFAULT 'daily',
  roster_config JSONB DEFAULT '{
    "PG": 1,
    "SG": 1,
    "SF": 1,
    "PF": 1,
    "C": 1,
    "G": 1,
    "F": 1,
    "UTIL": 3,
    "BENCH": 3,
    "IR": 1
  }',
  draft_date_val TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_league_id UUID;
  new_team_id UUID;
  invite_code_val TEXT;
  team_rec RECORD;
  spot_rec RECORD;
  position_name TEXT;
  position_count INTEGER;
  position_order INTEGER := 1;
  i INTEGER;
BEGIN
  -- Generate unique invite code
  LOOP
    invite_code_val := generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM leagues WHERE invite_code = invite_code_val);
  END LOOP;

  -- Create league
  INSERT INTO leagues (
    name, 
    description, 
    commissioner_id, 
    max_teams, 
    scoring_type, 
    invite_code,
    salary_cap_enabled,
    salary_cap_amount,
    lineup_frequency,
    draft_date
  )
  VALUES (
    league_name, 
    league_description, 
    auth.uid(), 
    max_teams_count, 
    scoring_type_val, 
    invite_code_val,
    salary_cap_enabled_val,
    salary_cap_amount_val,
    lineup_frequency_val,
    draft_date_val
  )
  RETURNING id INTO new_league_id;

  -- Add commissioner as league member
  INSERT INTO league_members (league_id, user_id, team_name, is_commissioner)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'), true);

  -- Create fantasy team for commissioner
  INSERT INTO fantasy_teams (league_id, user_id, team_name, is_commissioner)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'), true)
  RETURNING id INTO new_team_id;

  -- Create empty teams for the remaining slots (no user_id assigned - waiting for invites)
  FOR i IN 2..max_teams_count LOOP
    INSERT INTO fantasy_teams (league_id, team_name, is_commissioner)
    VALUES (new_league_id, 'Team ' || i, false);
  END LOOP;

  -- Create roster spots based on configuration
  FOR position_name, position_count IN SELECT * FROM jsonb_each_text(roster_config) LOOP
    FOR i IN 1..position_count::INTEGER LOOP
      INSERT INTO roster_spots (
        league_id, 
        position, 
        position_order, 
        is_starter, 
        is_bench, 
        is_injured_reserve
      ) VALUES (
        new_league_id,
        position_name,
        position_order,
        position_name != 'BENCH' AND position_name != 'IR',
        position_name = 'BENCH',
        position_name = 'IR'
      );
      position_order := position_order + 1;
    END LOOP;
  END LOOP;

  -- Create empty roster spots for all teams
  FOR team_rec IN SELECT id FROM fantasy_teams WHERE league_id = new_league_id LOOP
    FOR spot_rec IN SELECT id, position, is_starter FROM roster_spots WHERE league_id = new_league_id LOOP
      INSERT INTO fantasy_team_players (fantasy_team_id, roster_spot_id, position, is_starter, player_id)
      VALUES (team_rec.id, spot_rec.id, spot_rec.position, spot_rec.is_starter, NULL);
    END LOOP;
  END LOOP;

  -- Generate the league schedule automatically (only if we have enough teams)
  IF max_teams_count >= 2 THEN
    PERFORM generate_league_schedule(
      new_league_id,
      18, -- regular_season_weeks (default)
      6,  -- playoff_teams (default)
      3,  -- playoff_weeks (default)
      CURRENT_DATE -- season_start_date
    );
  END IF;

  -- Generate draft order automatically (will be created when teams are filled)
  -- Note: This will only work if there are enough teams, otherwise it will be skipped
  BEGIN
    PERFORM generate_draft_order(new_league_id, 15); -- 15 rounds default
  EXCEPTION
    WHEN OTHERS THEN
      -- Draft order will be generated later when teams are filled
      RAISE NOTICE 'Draft order will be generated when teams are filled';
  END;

  RETURN new_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign a team to a user (when they accept an invitation)
CREATE OR REPLACE FUNCTION assign_team_to_user(
  team_id_param UUID,
  user_id_param UUID,
  new_team_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  team_exists BOOLEAN;
  league_id_val UUID;
BEGIN
  -- Check if team exists and get league_id
  SELECT EXISTS(SELECT 1 FROM fantasy_teams WHERE id = team_id_param), 
         (SELECT league_id FROM fantasy_teams WHERE id = team_id_param)
  INTO team_exists, league_id_val;
  
  IF NOT team_exists THEN
    RAISE EXCEPTION 'Team does not exist';
  END IF;
  
  -- Check if user is already in this league
  IF EXISTS(SELECT 1 FROM league_members WHERE league_id = league_id_val AND user_id = user_id_param) THEN
    RAISE EXCEPTION 'User is already a member of this league';
  END IF;
  
  -- Update the team with user_id and optionally new team name
  UPDATE fantasy_teams 
  SET user_id = user_id_param,
      team_name = COALESCE(new_team_name, team_name),
      updated_at = NOW()
  WHERE id = team_id_param;
  
  -- Add user to league_members
  INSERT INTO league_members (league_id, user_id, team_name, is_commissioner)
  VALUES (
    league_id_val, 
    user_id_param, 
    COALESCE(new_team_name, (SELECT team_name FROM fantasy_teams WHERE id = team_id_param)), 
    false
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to upsert players (insert or update)
CREATE OR REPLACE FUNCTION upsert_player(
  p_nba_player_id INTEGER,
  p_name TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_player_slug TEXT DEFAULT NULL,
  p_position TEXT DEFAULT NULL,
  p_team_id INTEGER DEFAULT NULL,
  p_team_name TEXT DEFAULT NULL,
  p_team_abbreviation TEXT DEFAULT NULL,
  p_team_slug TEXT DEFAULT NULL,
  p_team_city TEXT DEFAULT NULL,
  p_is_defunct BOOLEAN DEFAULT false,
  p_jersey_number TEXT DEFAULT NULL,
  p_height TEXT DEFAULT NULL,
  p_weight INTEGER DEFAULT NULL,
  p_age INTEGER DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_birth_city TEXT DEFAULT NULL,
  p_birth_state TEXT DEFAULT NULL,
  p_birth_country TEXT DEFAULT NULL,
  p_college TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_draft_year INTEGER DEFAULT NULL,
  p_draft_round INTEGER DEFAULT NULL,
  p_draft_number INTEGER DEFAULT NULL,
  p_salary BIGINT DEFAULT 0,
  p_is_active BOOLEAN DEFAULT true,
  p_is_rookie BOOLEAN DEFAULT false,
  p_years_pro INTEGER DEFAULT 0,
  p_from_year INTEGER DEFAULT NULL,
  p_to_year INTEGER DEFAULT NULL,
  p_roster_status TEXT DEFAULT NULL,
  p_current_pts DECIMAL(5,1) DEFAULT NULL,
  p_current_reb DECIMAL(5,1) DEFAULT NULL,
  p_current_ast DECIMAL(5,1) DEFAULT NULL,
  p_stats_timeframe TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  player_id INTEGER;
BEGIN
  INSERT INTO players (
    nba_player_id, name, first_name, last_name, player_slug, position, team_id, team_name,
    team_abbreviation, team_slug, team_city, is_defunct, jersey_number, height, weight, age, birth_date,
    birth_city, birth_state, birth_country, college, country, draft_year, draft_round,
    draft_number, salary, is_active, is_rookie, years_pro, from_year, to_year,
    roster_status, current_pts, current_reb, current_ast, stats_timeframe
  ) VALUES (
    p_nba_player_id, p_name, p_first_name, p_last_name, p_player_slug, p_position, p_team_id, p_team_name,
    p_team_abbreviation, p_team_slug, p_team_city, p_is_defunct, p_jersey_number, p_height, p_weight, p_age, p_birth_date,
    p_birth_city, p_birth_state, p_birth_country, p_college, p_country, p_draft_year, p_draft_round,
    p_draft_number, p_salary, p_is_active, p_is_rookie, p_years_pro, p_from_year, p_to_year,
    p_roster_status, p_current_pts, p_current_reb, p_current_ast, p_stats_timeframe
  )
  ON CONFLICT (nba_player_id) 
  DO UPDATE SET
    name = EXCLUDED.name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    player_slug = EXCLUDED.player_slug,
    position = EXCLUDED.position,
    team_id = EXCLUDED.team_id,
    team_name = EXCLUDED.team_name,
    team_abbreviation = EXCLUDED.team_abbreviation,
    team_slug = EXCLUDED.team_slug,
    team_city = EXCLUDED.team_city,
    is_defunct = EXCLUDED.is_defunct,
    jersey_number = EXCLUDED.jersey_number,
    height = EXCLUDED.height,
    weight = EXCLUDED.weight,
    age = EXCLUDED.age,
    birth_date = EXCLUDED.birth_date,
    birth_city = EXCLUDED.birth_city,
    birth_state = EXCLUDED.birth_state,
    birth_country = EXCLUDED.birth_country,
    college = EXCLUDED.college,
    country = EXCLUDED.country,
    draft_year = EXCLUDED.draft_year,
    draft_round = EXCLUDED.draft_round,
    draft_number = EXCLUDED.draft_number,
    salary = EXCLUDED.salary,
    is_active = EXCLUDED.is_active,
    is_rookie = EXCLUDED.is_rookie,
    years_pro = EXCLUDED.years_pro,
    from_year = EXCLUDED.from_year,
    to_year = EXCLUDED.to_year,
    roster_status = EXCLUDED.roster_status,
    current_pts = EXCLUDED.current_pts,
    current_reb = EXCLUDED.current_reb,
    current_ast = EXCLUDED.current_ast,
    stats_timeframe = EXCLUDED.stats_timeframe,
    updated_at = NOW()
  RETURNING id INTO player_id;
  
  RETURN player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to generate draft order
CREATE OR REPLACE FUNCTION generate_draft_order(
  league_id_param UUID,
  total_rounds INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  team_count INTEGER;
  team_rec RECORD;
  team_list UUID[];
  shuffled_teams UUID[];
  i INTEGER;
  j INTEGER;
  round_num INTEGER;
  pick_num INTEGER;
  team_index INTEGER;
  is_snake BOOLEAN;
  random_team_id UUID;
BEGIN
  -- Get all teams (including empty ones for now)
  SELECT COUNT(*), ARRAY_AGG(id ORDER BY id) INTO team_count, team_list
  FROM fantasy_teams 
  WHERE league_id = league_id_param;
  
  IF team_count < 2 THEN
    RAISE NOTICE 'Not enough teams to generate draft order yet';
    RETURN false;
  END IF;
  
  -- Clear existing draft order
  DELETE FROM draft_order WHERE league_id = league_id_param;
  
  -- Create shuffled array for random draft order
  shuffled_teams := team_list;
  
  -- Simple shuffle algorithm (Fisher-Yates)
  FOR i IN 1..team_count LOOP
    j := floor(random() * (team_count - i + 1)) + i;
    random_team_id := shuffled_teams[i];
    shuffled_teams[i] := shuffled_teams[j];
    shuffled_teams[j] := random_team_id;
  END LOOP;
  
  pick_num := 1;
  
  -- Generate draft order for all rounds
  FOR round_num IN 1..total_rounds LOOP
    is_snake := (round_num % 2 = 0); -- Snake draft: even rounds go reverse
    
    FOR i IN 1..team_count LOOP
      IF is_snake THEN
        team_index := team_count - i + 1; -- Reverse order for even rounds
      ELSE
        team_index := i; -- Normal order for odd rounds
      END IF;
      
      INSERT INTO draft_order (
        league_id,
        round,
        pick_number,
        team_position,
        is_completed
      ) VALUES (
        league_id_param,
        round_num,
        pick_num,
        team_index,
        false
      );
      
      pick_num := pick_num + 1;
    END LOOP;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to regenerate draft order (for when teams are filled)
CREATE OR REPLACE FUNCTION regenerate_draft_order(
  league_id_param UUID,
  total_rounds INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
  team_count INTEGER;
  user_team_count INTEGER;
BEGIN
  -- Check if we have enough teams with users
  SELECT COUNT(*) INTO team_count FROM fantasy_teams WHERE league_id = league_id_param;
  SELECT COUNT(*) INTO user_team_count FROM fantasy_teams WHERE league_id = league_id_param AND user_id IS NOT NULL;
  
  IF user_team_count < 2 THEN
    RAISE EXCEPTION 'Need at least 2 teams with users to generate draft order';
  END IF;
  
  -- Generate the draft order
  RETURN generate_draft_order(league_id_param, total_rounds);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current draft order
CREATE OR REPLACE FUNCTION get_draft_order(league_id_param UUID)
RETURNS TABLE (
  pick_number INTEGER,
  round INTEGER,
  team_position INTEGER,
  team_id UUID,
  team_name TEXT,
  is_completed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    draft_order.pick_number,
    draft_order.round,
    draft_order.team_position,
    ft.id as team_id,
    ft.team_name,
    draft_order.is_completed
  FROM draft_order
  LEFT JOIN fantasy_teams ft ON ft.id = (
    SELECT id FROM fantasy_teams 
    WHERE league_id = league_id_param 
    ORDER BY id 
    LIMIT 1 OFFSET (draft_order.team_position - 1)
  )
  WHERE draft_order.league_id = league_id_param
  ORDER BY draft_order.pick_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to process accepted trades
CREATE OR REPLACE FUNCTION process_trade(trade_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  trade_rec RECORD;
  item RECORD;
  player_id_val INTEGER;
  pick_number_val INTEGER;
  from_team_id UUID;
  to_team_id UUID;
BEGIN
  -- Get trade details
  SELECT * INTO trade_rec FROM trades WHERE id = trade_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found';
  END IF;
  
  IF trade_rec.status != 'accepted' THEN
    RAISE EXCEPTION 'Trade is not in accepted status';
  END IF;
  
  -- Process each trade item
  FOR item IN SELECT * FROM jsonb_array_elements(trade_rec.trade_items) LOOP
    -- Determine which team is giving and which is receiving
    IF (item->>'fromTeam')::UUID = trade_rec.proposing_team_id THEN
      from_team_id := trade_rec.proposing_team_id;
      to_team_id := trade_rec.receiving_team_id;
    ELSE
      from_team_id := trade_rec.receiving_team_id;
      to_team_id := trade_rec.proposing_team_id;
    END IF;
    
    -- Handle player trades
    IF item->>'type' = 'player' THEN
      player_id_val := (item->>'playerId')::INTEGER;
      
      -- Find the player's current roster spot
      UPDATE fantasy_team_players 
      SET player_id = NULL
      WHERE fantasy_team_id = from_team_id 
        AND player_id = player_id_val;
      
      -- Add player to receiving team (find first available spot)
      UPDATE fantasy_team_players 
      SET player_id = player_id_val
      WHERE fantasy_team_id = to_team_id 
        AND player_id IS NULL
        AND id = (
          SELECT id FROM fantasy_team_players 
          WHERE fantasy_team_id = to_team_id 
            AND player_id IS NULL 
          LIMIT 1
        );
    END IF;
    
    -- Handle draft pick trades (future implementation)
    IF item->>'type' = 'pick' THEN
      pick_number_val := (item->>'pickNumber')::INTEGER;
      -- TODO: Implement draft pick trading logic
      RAISE NOTICE 'Draft pick trading not yet implemented for pick %', pick_number_val;
    END IF;
  END LOOP;
  
  -- Update trade status
  UPDATE trades 
  SET status = 'completed', updated_at = NOW()
  WHERE id = trade_id_param;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to generate league schedule
CREATE OR REPLACE FUNCTION generate_league_schedule(
  league_id_param UUID,
  regular_season_weeks_param INTEGER DEFAULT 18,
  playoff_teams_param INTEGER DEFAULT 6,
  playoff_weeks_param INTEGER DEFAULT 3,
  season_start_date_param DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  team_count INTEGER;
  team_rec RECORD;
  team_list UUID[];
  i INTEGER;
  j INTEGER;
  week_num INTEGER;
  playoff_start_week INTEGER;
  playoff_round INTEGER;
  team1_id UUID;
  team2_id UUID;
  team1_index INTEGER;
  team2_index INTEGER;
  matchup_date DATE;
BEGIN
  -- Get team count for the league
  SELECT COUNT(*) INTO team_count
  FROM fantasy_teams 
  WHERE league_id = league_id_param;
  
  IF team_count < 2 THEN
    RAISE EXCEPTION 'League must have at least 2 teams to generate schedule';
  END IF;
  
  -- Get all team IDs
  SELECT ARRAY_AGG(id ORDER BY id) INTO team_list
  FROM fantasy_teams 
  WHERE league_id = league_id_param;
  
  -- Create or update league schedule settings
  INSERT INTO league_schedule_settings (
    league_id, 
    regular_season_weeks, 
    playoff_weeks, 
    playoff_teams,
    playoff_start_week,
    season_start_date,
    is_schedule_generated
  ) VALUES (
    league_id_param,
    regular_season_weeks_param,
    playoff_weeks_param,
    playoff_teams_param,
    regular_season_weeks_param + 1,
    season_start_date_param,
    true
  ) ON CONFLICT (league_id) DO UPDATE SET
    regular_season_weeks = EXCLUDED.regular_season_weeks,
    playoff_weeks = EXCLUDED.playoff_weeks,
    playoff_teams = EXCLUDED.playoff_teams,
    playoff_start_week = EXCLUDED.playoff_start_week,
    season_start_date = EXCLUDED.season_start_date,
    is_schedule_generated = true,
    updated_at = NOW();
  
  -- Clear existing matchups for this league
  DELETE FROM weekly_matchups WHERE league_id = league_id_param;
  
  -- Generate regular season schedule (round-robin style)
  FOR week_num IN 1..regular_season_weeks_param LOOP
    matchup_date := season_start_date_param + (week_num - 1) * INTERVAL '7 days';
    
    -- Create matchups for this week (each team plays one other team)
    FOR i IN 1..(team_count / 2) LOOP
      team1_index := i;
      team2_index := team_count - i + 1;
      
      -- Skip if we have an odd number of teams and this would be a bye week
      IF team1_index < team2_index THEN
        INSERT INTO weekly_matchups (
          league_id,
          fantasy_team1_id,
          fantasy_team2_id,
          week_number,
          season_year,
          season_type,
          matchup_date,
          status
        ) VALUES (
          league_id_param,
          team_list[team1_index],
          team_list[team2_index],
          week_num,
          EXTRACT(YEAR FROM season_start_date_param),
          'regular',
          matchup_date,
          'scheduled'
        );
      END IF;
    END LOOP;
  END LOOP;
  
  -- Generate playoff schedule
  playoff_start_week := regular_season_weeks_param + 1;
  
  -- Round 1 (Quarterfinals if 8+ teams, or first round)
  FOR week_num IN playoff_start_week..(playoff_start_week + playoff_weeks_param - 1) LOOP
    playoff_round := week_num - playoff_start_week + 1;
    matchup_date := season_start_date_param + (week_num - 1) * INTERVAL '7 days';
    
    -- Create playoff matchups (simplified - top teams advance)
    FOR i IN 1..(playoff_teams_param / 2) LOOP
      team1_id := team_list[i];
      team2_id := team_list[playoff_teams_param - i + 1];
      
      INSERT INTO weekly_matchups (
        league_id,
        fantasy_team1_id,
        fantasy_team2_id,
        week_number,
        season_year,
        season_type,
        playoff_round,
        matchup_date,
        status
      ) VALUES (
        league_id_param,
        team1_id,
        team2_id,
        week_num,
        EXTRACT(YEAR FROM season_start_date_param),
        'playoff',
        playoff_round,
        matchup_date,
        'scheduled'
      );
    END LOOP;
  END LOOP;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUZZY NAME MATCHING FUNCTIONS
-- ============================================================================

-- Function to calculate Levenshtein distance between two strings
CREATE OR REPLACE FUNCTION levenshtein_distance(str1 TEXT, str2 TEXT)
RETURNS INTEGER AS $$
DECLARE
    len1 INTEGER := length(str1);
    len2 INTEGER := length(str2);
    matrix INTEGER[][];
    i INTEGER;
    j INTEGER;
    cost INTEGER;
BEGIN
    -- Handle edge cases
    IF len1 = 0 THEN RETURN len2; END IF;
    IF len2 = 0 THEN RETURN len1; END IF;
    
    -- Initialize matrix
    matrix := array_fill(0, ARRAY[len1 + 1, len2 + 1]);
    
    -- Initialize first row and column
    FOR i IN 0..len1 LOOP
        matrix[i][0] := i;
    END LOOP;
    
    FOR j IN 0..len2 LOOP
        matrix[0][j] := j;
    END LOOP;
    
    -- Fill the matrix
    FOR i IN 1..len1 LOOP
        FOR j IN 1..len2 LOOP
            IF substring(str1, i, 1) = substring(str2, j, 1) THEN
                cost := 0;
            ELSE
                cost := 1;
            END IF;
            
            matrix[i][j] := LEAST(
                matrix[i-1][j] + 1,      -- deletion
                matrix[i][j-1] + 1,      -- insertion
                matrix[i-1][j-1] + cost  -- substitution
            );
        END LOOP;
    END LOOP;
    
    RETURN matrix[len1][len2];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to normalize names for better matching
CREATE OR REPLACE FUNCTION normalize_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Convert to lowercase
    name := LOWER(name);
    
    -- Remove common suffixes and prefixes
    name := REGEXP_REPLACE(name, '\s+(jr\.?|sr\.?|iii|ii|iv)$', '', 'gi');
    name := REGEXP_REPLACE(name, '^st\.?\s+', '', 'gi');
    
    -- Replace common abbreviations
    name := REGEXP_REPLACE(name, '\bj\.?\s*p\.?\s*', 'jp ', 'gi');
    name := REGEXP_REPLACE(name, '\bj\.?\s*', 'j ', 'gi');
    name := REGEXP_REPLACE(name, '\bm\.?\s*', 'm ', 'gi');
    name := REGEXP_REPLACE(name, '\ba\.?\s*', 'a ', 'gi');
    name := REGEXP_REPLACE(name, '\bb\.?\s*', 'b ', 'gi');
    name := REGEXP_REPLACE(name, '\bc\.?\s*', 'c ', 'gi');
    name := REGEXP_REPLACE(name, '\bd\.?\s*', 'd ', 'gi');
    name := REGEXP_REPLACE(name, '\be\.?\s*', 'e ', 'gi');
    name := REGEXP_REPLACE(name, '\bf\.?\s*', 'f ', 'gi');
    name := REGEXP_REPLACE(name, '\bg\.?\s*', 'g ', 'gi');
    name := REGEXP_REPLACE(name, '\bh\.?\s*', 'h ', 'gi');
    name := REGEXP_REPLACE(name, '\bi\.?\s*', 'i ', 'gi');
    name := REGEXP_REPLACE(name, '\bk\.?\s*', 'k ', 'gi');
    name := REGEXP_REPLACE(name, '\bl\.?\s*', 'l ', 'gi');
    name := REGEXP_REPLACE(name, '\bn\.?\s*', 'n ', 'gi');
    name := REGEXP_REPLACE(name, '\bo\.?\s*', 'o ', 'gi');
    name := REGEXP_REPLACE(name, '\bp\.?\s*', 'p ', 'gi');
    name := REGEXP_REPLACE(name, '\bq\.?\s*', 'q ', 'gi');
    name := REGEXP_REPLACE(name, '\br\.?\s*', 'r ', 'gi');
    name := REGEXP_REPLACE(name, '\bs\.?\s*', 's ', 'gi');
    name := REGEXP_REPLACE(name, '\bt\.?\s*', 't ', 'gi');
    name := REGEXP_REPLACE(name, '\bu\.?\s*', 'u ', 'gi');
    name := REGEXP_REPLACE(name, '\bv\.?\s*', 'v ', 'gi');
    name := REGEXP_REPLACE(name, '\bw\.?\s*', 'w ', 'gi');
    name := REGEXP_REPLACE(name, '\bx\.?\s*', 'x ', 'gi');
    name := REGEXP_REPLACE(name, '\by\.?\s*', 'y ', 'gi');
    name := REGEXP_REPLACE(name, '\bz\.?\s*', 'z ', 'gi');
    
    -- Remove extra spaces
    name := REGEXP_REPLACE(name, '\s+', ' ', 'g');
    name := TRIM(name);
    
    RETURN name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find best player match for ESPN name
CREATE OR REPLACE FUNCTION find_best_player_match(espn_name TEXT, espn_team TEXT DEFAULT NULL)
RETURNS TABLE(
    player_id INTEGER,
    player_name TEXT,
    match_confidence DECIMAL(3,2)
) AS $$
DECLARE
    normalized_espn_name TEXT;
    best_match_id INTEGER;
    best_match_name TEXT;
    best_confidence DECIMAL(3,2) := 0.0;
    current_distance INTEGER;
    max_distance INTEGER;
    current_confidence DECIMAL(3,2);
    player_record RECORD;
BEGIN
    normalized_espn_name := normalize_name(espn_name);
    
    -- Set maximum allowed distance based on name length
    max_distance := GREATEST(2, LENGTH(normalized_espn_name) / 4);
    
    -- Search for exact matches first
    FOR player_record IN 
        SELECT p.id, p.name, p.team_name
        FROM players p
        WHERE normalize_name(p.name) = normalized_espn_name
        AND (espn_team IS NULL OR LOWER(p.team_name) = LOWER(espn_team))
    LOOP
        RETURN QUERY SELECT player_record.id, player_record.name, 1.0::DECIMAL(3,2);
        RETURN;
    END LOOP;
    
    -- Search for fuzzy matches
    FOR player_record IN 
        SELECT p.id, p.name, p.team_name
        FROM players p
        WHERE levenshtein_distance(normalize_name(p.name), normalized_espn_name) <= max_distance
        ORDER BY levenshtein_distance(normalize_name(p.name), normalized_espn_name)
    LOOP
        current_distance := levenshtein_distance(normalize_name(player_record.name), normalized_espn_name);
        current_confidence := 1.0 - (current_distance::DECIMAL / GREATEST(LENGTH(normalized_espn_name), LENGTH(normalize_name(player_record.name))));
        
        -- Bonus for team match
        IF espn_team IS NOT NULL AND LOWER(player_record.team_name) = LOWER(espn_team) THEN
            current_confidence := current_confidence + 0.1;
        END IF;
        
        -- Cap confidence at 1.0
        current_confidence := LEAST(1.0, current_confidence);
        
        IF current_confidence > best_confidence THEN
            best_confidence := current_confidence;
            best_match_id := player_record.id;
            best_match_name := player_record.name;
        END IF;
    END LOOP;
    
    -- Only return if confidence is above threshold
    IF best_confidence >= 0.6 THEN
        RETURN QUERY SELECT best_match_id, best_match_name, best_confidence;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function to match all ESPN projections with players
CREATE OR REPLACE FUNCTION match_espn_projections()
RETURNS TABLE(
    espn_name TEXT,
    matched_player_name TEXT,
    match_confidence DECIMAL(3,2),
    matched_count INTEGER
) AS $$
DECLARE
    projection_record RECORD;
    match_result RECORD;
    total_matched INTEGER := 0;
BEGIN
    -- Clear existing matches
    UPDATE espn_player_projections 
    SET player_id = NULL, matched_at = NULL, match_confidence = 0.0;
    
    -- Match each projection
    FOR projection_record IN 
        SELECT id, espn_name, espn_team
        FROM espn_player_projections
        ORDER BY espn_name
    LOOP
        -- Find best match
        SELECT * INTO match_result
        FROM find_best_player_match(projection_record.espn_name, projection_record.espn_team);
        
        IF match_result.player_id IS NOT NULL THEN
            -- Update the projection with the match
            UPDATE espn_player_projections
            SET player_id = match_result.player_id,
                matched_at = NOW(),
                match_confidence = match_result.match_confidence
            WHERE id = projection_record.id;
            
            total_matched := total_matched + 1;
            
            -- Return the match info
            RETURN QUERY SELECT 
                projection_record.espn_name,
                match_result.player_name,
                match_result.match_confidence,
                total_matched;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;
-- Enable RLS for all career stats tables
ALTER TABLE player_career_totals_regular_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_career_totals_post_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_career_totals_all_star_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_career_totals_college_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_totals_regular_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_totals_post_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_totals_all_star_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_totals_college_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_rankings_regular_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_rankings_post_season ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_season_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_lobby_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_season_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE espn_player_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynasty_keepers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynasty_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PLAYER RLS POLICIES
-- ============================================================================

-- Allow all users to read players
CREATE POLICY "Allow all users to read players" ON players
  FOR SELECT USING (true);

-- Allow service role to manage players (for imports)
CREATE POLICY "Allow service role to manage players" ON players
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read all stats data
CREATE POLICY "Allow authenticated users to read player stats" ON player_game_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read season stats" ON player_season_stats
    FOR SELECT USING (auth.role() = 'authenticated');



-- Allow service role to manage all stats data
CREATE POLICY "Allow service role to manage player stats" ON player_game_logs
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Public read access for frontend (Anon key)
CREATE POLICY "Allow all users to read player stats (public)" ON player_game_logs
    FOR SELECT USING (true);

CREATE POLICY "Allow service role to manage season stats" ON player_season_stats
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Career stats RLS policies
CREATE POLICY "Allow authenticated users to read career stats" ON player_career_totals_regular_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage career stats" ON player_career_totals_regular_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Public read access for frontend (Anon key)
CREATE POLICY "Allow all users to read career stats (public)" ON player_career_totals_regular_season
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to read career stats" ON player_career_totals_post_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage career stats" ON player_career_totals_post_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read career stats" ON player_career_totals_all_star_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage career stats" ON player_career_totals_all_star_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read career stats" ON player_career_totals_college_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage career stats" ON player_career_totals_college_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Season totals RLS policies
CREATE POLICY "Allow authenticated users to read season totals" ON player_season_totals_regular_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage season totals" ON player_season_totals_regular_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Public read access for frontend (Anon key)
CREATE POLICY "Allow all users to read season totals (public)" ON player_season_totals_regular_season
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to read season totals" ON player_season_totals_post_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage season totals" ON player_season_totals_post_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read season totals" ON player_season_totals_all_star_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage season totals" ON player_season_totals_all_star_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read season totals" ON player_season_totals_college_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage season totals" ON player_season_totals_college_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Season rankings RLS policies
CREATE POLICY "Allow authenticated users to read season rankings" ON player_season_rankings_regular_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage season rankings" ON player_season_rankings_regular_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read season rankings" ON player_season_rankings_post_season
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage season rankings" ON player_season_rankings_post_season
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


CREATE POLICY "Allow authenticated users to manage NBA games" ON nba_games
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage NBA games" ON nba_games
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to manage NBA season weeks" ON nba_season_weeks
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage NBA season weeks" ON nba_season_weeks
    FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- LEAGUE RLS POLICIES
-- ============================================================================

-- Create RLS policies for leagues
CREATE POLICY "Allow all users to read public leagues" ON leagues
  FOR SELECT USING (is_public = true);

CREATE POLICY "Allow commissioners to read their leagues" ON leagues
  FOR SELECT USING (commissioner_id = auth.uid());

CREATE POLICY "Allow authenticated users to create leagues" ON leagues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow commissioners to update their leagues" ON leagues
  FOR UPDATE USING (commissioner_id = auth.uid());

CREATE POLICY "Allow commissioners to delete their leagues" ON leagues
  FOR DELETE USING (commissioner_id = auth.uid());

-- Create RLS policies for league_settings
CREATE POLICY "Allow commissioners to read league settings" ON league_settings
  FOR SELECT USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to create league settings" ON league_settings
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to update league settings" ON league_settings
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to delete league settings" ON league_settings
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for league_members
CREATE POLICY "Allow league members to read league members" ON league_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to join leagues" ON league_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users to leave leagues" ON league_members
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Allow commissioners to manage league members" ON league_members
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for divisions
CREATE POLICY "Allow commissioners to manage divisions in their leagues" ON divisions
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to read divisions" ON divisions
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

-- Create RLS policies for fantasy_teams
CREATE POLICY "Allow fantasy team owners to manage their teams" ON fantasy_teams
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Allow commissioners to read fantasy teams in their leagues" ON fantasy_teams
  FOR SELECT USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to create fantasy teams in their leagues" ON fantasy_teams
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to update all fantasy teams in their leagues" ON fantasy_teams
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to delete fantasy teams in their leagues" ON fantasy_teams
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for draft_order
CREATE POLICY "Allow commissioners to read draft order" ON draft_order
  FOR SELECT USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to create draft order" ON draft_order
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to update draft order" ON draft_order
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to delete draft order" ON draft_order
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- draft_picks RLS policies are created in fix_draft_picks.sql

-- Create RLS policies for league_states
CREATE POLICY "Allow commissioners to read league state" ON league_states
  FOR SELECT USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to create league state" ON league_states
  FOR INSERT WITH CHECK (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to update league state" ON league_states
  FOR UPDATE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to delete league state" ON league_states
  FOR DELETE USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for roster_spots
CREATE POLICY "Allow commissioners to manage roster spots" ON roster_spots
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to read roster spots" ON roster_spots
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

-- Create RLS policies for fantasy_team_players
CREATE POLICY "Allow fantasy team owners to manage their players" ON fantasy_team_players
  FOR ALL USING (
    fantasy_team_id IN (
      SELECT id FROM fantasy_teams WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to read fantasy team players" ON fantasy_team_players
  FOR SELECT USING (
    fantasy_team_id IN (
      SELECT ft.id FROM fantasy_teams ft
      JOIN leagues l ON ft.league_id = l.id
      WHERE l.commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for draft_picks
CREATE POLICY "Allow commissioners to read draft picks" ON draft_picks
  FOR SELECT USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to manage draft picks" ON draft_picks
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues WHERE commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for league_invitations
CREATE POLICY "Allow commissioners to manage invitations" ON league_invitations
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to read their invitations" ON league_invitations
  FOR SELECT USING (email = auth.jwt() ->> 'email');

-- Create RLS policies for league_schedule_settings
CREATE POLICY "Allow commissioners to manage schedule settings" ON league_schedule_settings
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to read schedule settings" ON league_schedule_settings
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

-- Create RLS policies for weekly_matchups
CREATE POLICY "Allow commissioners to manage matchups" ON weekly_matchups
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to read matchups" ON weekly_matchups
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

-- Create RLS policies for draft_chat_messages
CREATE POLICY "Allow league members to read draft chat messages" ON draft_chat_messages
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to send draft chat messages" ON draft_chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

-- Create RLS policies for draft_lobby_participants
CREATE POLICY "Allow league members to read draft lobby participants" ON draft_lobby_participants
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to join draft lobby" ON draft_lobby_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to update their lobby status" ON draft_lobby_participants
  FOR UPDATE USING (
    user_id = auth.uid() AND
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow league members to leave draft lobby" ON draft_lobby_participants
  FOR DELETE USING (
    user_id = auth.uid() AND
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

-- Create RLS policies for trades
CREATE POLICY "Allow league members to read trades" ON trades
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow team owners to create trades" ON trades
  FOR INSERT WITH CHECK (
    proposing_team_id IN (
      SELECT ft.id FROM fantasy_teams ft
      WHERE ft.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow team owners to update their trades" ON trades
  FOR UPDATE USING (
    proposing_team_id IN (
      SELECT ft.id FROM fantasy_teams ft
      WHERE ft.user_id = auth.uid()
    ) OR
    receiving_team_id IN (
      SELECT ft.id FROM fantasy_teams ft
      WHERE ft.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow team owners to delete their trades" ON trades
  FOR DELETE USING (
    proposing_team_id IN (
      SELECT ft.id FROM fantasy_teams ft
      WHERE ft.user_id = auth.uid()
    )
  );

-- Create RLS policies for player_watchlist
CREATE POLICY "Allow users to manage their own watchlist" ON player_watchlist
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Allow league members to read watchlist" ON player_watchlist
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

-- Create RLS policies for player_favorites
CREATE POLICY "Allow users to manage their own favorites" ON player_favorites
  FOR ALL USING (user_id = auth.uid());

-- Create RLS policies for dynasty_keepers
CREATE POLICY "Allow league members to read dynasty keepers" ON dynasty_keepers
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow team owners to manage their dynasty keepers" ON dynasty_keepers
  FOR ALL USING (
    fantasy_team_id IN (
      SELECT ft.id FROM fantasy_teams ft
      WHERE ft.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to manage dynasty keepers" ON dynasty_keepers
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for fantasy_season_weeks
CREATE POLICY "Allow all users to read fantasy season weeks" ON fantasy_season_weeks
  FOR SELECT USING (true);

CREATE POLICY "Allow service role to manage fantasy season weeks" ON fantasy_season_weeks
  FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for dynasty_settings
CREATE POLICY "Allow league members to read dynasty settings" ON dynasty_settings
  FOR SELECT USING (
    league_id IN (
      SELECT lm.league_id FROM league_members lm
      WHERE lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow commissioners to manage dynasty settings" ON dynasty_settings
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues 
      WHERE commissioner_id = auth.uid()
    )
  );

-- Create RLS policies for espn_player_projections
CREATE POLICY "Allow all users to read ESPN projections" ON espn_player_projections
  FOR SELECT USING (true);

CREATE POLICY "Allow service role to manage ESPN projections" ON espn_player_projections
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert 2025-26 Fantasy Season Weeks (Site-wide structure)
INSERT INTO fantasy_season_weeks (season_year, week_number, week_name, start_date, end_date, is_regular_season, is_playoff_week, playoff_round, is_active) VALUES
(2025, 0, 'Preseason', '2025-10-02', '2025-10-20', false, false, NULL, true),
(2025, 1, 'Week 1', '2025-10-21', '2025-10-26', true, false, NULL, true),
(2025, 2, 'Week 2', '2025-10-27', '2025-11-02', true, false, NULL, true),
(2025, 3, 'Week 3', '2025-11-03', '2025-11-09', true, false, NULL, true),
(2025, 4, 'Week 4', '2025-11-10', '2025-11-16', true, false, NULL, true),
(2025, 5, 'Week 5', '2025-11-17', '2025-11-23', true, false, NULL, true),
(2025, 6, 'Week 6', '2025-11-24', '2025-11-30', true, false, NULL, true),
(2025, 7, 'Week 7', '2025-12-01', '2025-12-07', true, false, NULL, true),
(2025, 8, 'Week 8', '2025-12-08', '2025-12-14', true, false, NULL, true),
(2025, 9, 'Week 9', '2025-12-15', '2025-12-21', true, false, NULL, true),
(2025, 10, 'Week 10', '2025-12-22', '2025-12-28', true, false, NULL, true),
(2025, 11, 'Week 11', '2025-12-29', '2026-01-04', true, false, NULL, true),
(2025, 12, 'Week 12', '2026-01-05', '2026-01-11', true, false, NULL, true),
(2025, 13, 'Week 13', '2026-01-12', '2026-01-18', true, false, NULL, true),
(2025, 14, 'Week 14', '2026-01-19', '2026-01-25', true, false, NULL, true),
(2025, 15, 'Week 15', '2026-01-26', '2026-02-01', true, false, NULL, true),
(2025, 16, 'Week 16', '2026-02-02', '2026-02-08', true, false, NULL, true),
(2025, 17, 'Week 17', '2026-02-09', '2026-02-15', true, false, NULL, true),
(2025, 18, 'Week 18', '2026-02-16', '2026-02-22', true, false, NULL, true),
(2025, 19, 'Week 19', '2026-02-23', '2026-03-01', true, false, NULL, true),
(2025, 20, 'Week 20', '2026-03-02', '2026-03-08', true, false, NULL, true),
(2025, 21, 'Week 21', '2026-03-09', '2026-03-15', true, false, NULL, true),
(2025, 22, 'Week 22', '2026-03-16', '2026-03-22', true, false, NULL, true),
(2025, 23, 'Week 23', '2026-03-23', '2026-03-29', true, false, NULL, true),
(2025, 24, 'Week 24', '2026-03-30', '2026-04-05', true, false, NULL, true),
(2025, 25, 'Week 25', '2026-04-06', '2026-04-12', true, false, NULL, true);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION upsert_player TO service_role;
GRANT EXECUTE ON FUNCTION create_league_with_commissioner TO authenticated;
GRANT EXECUTE ON FUNCTION assign_team_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION generate_league_schedule TO authenticated;
GRANT EXECUTE ON FUNCTION generate_draft_order TO authenticated;
GRANT EXECUTE ON FUNCTION regenerate_draft_order TO authenticated;
GRANT EXECUTE ON FUNCTION get_draft_order TO authenticated;
GRANT EXECUTE ON FUNCTION process_trade TO authenticated;