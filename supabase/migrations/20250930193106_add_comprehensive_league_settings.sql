-- Comprehensive League Settings for HoopGeek Fantasy Basketball
-- Adding all necessary settings for commissioner management

-- Add new columns to leagues table for comprehensive settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS league_logo_url TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS auto_renew_enabled BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS cash_league BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS entry_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS prize_pool DECIMAL(10,2) DEFAULT 0;

-- Draft Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS draft_type TEXT DEFAULT 'snake' CHECK (draft_type IN ('snake', 'linear', 'auction'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS draft_time_per_pick INTEGER DEFAULT 90; -- seconds
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS draft_order_method TEXT DEFAULT 'random' CHECK (draft_order_method IN ('random', 'manual', 'predetermined'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS draft_order_reveal_time INTEGER DEFAULT 60; -- minutes before draft

-- Roster Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS roster_size INTEGER DEFAULT 13;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS total_starters INTEGER DEFAULT 10;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS total_bench INTEGER DEFAULT 3;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS total_ir INTEGER DEFAULT 1;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS position_limits JSONB DEFAULT '{
  "PG": {"starters": 1, "max": null},
  "SG": {"starters": 1, "max": null},
  "SF": {"starters": 1, "max": null},
  "PF": {"starters": 1, "max": null},
  "C": {"starters": 1, "max": 4},
  "G": {"starters": 1, "max": null},
  "F": {"starters": 1, "max": null},
  "UTIL": {"starters": 3, "max": null},
  "BENCH": {"starters": 3, "max": null},
  "IR": {"starters": 1, "max": null}
}';

-- Games Played Limits
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS games_played_limits JSONB DEFAULT '{
  "all_players": null,
  "by_position": {}
}';

-- HoopGeek Specific Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS lineup_frequency TEXT DEFAULT 'weekly' CHECK (lineup_frequency IN ('daily', 'weekly', 'bi-weekly'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS auto_ir_management BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS auto_substitution BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS salary_cap_enabled BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS salary_cap_amount BIGINT DEFAULT 100000000; -- $100M default
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS salary_cap_soft BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS salary_cap_penalty DECIMAL(5,2) DEFAULT 0.0; -- percentage penalty for going over

-- Trade Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS trade_limit INTEGER DEFAULT null; -- null = no limit
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS trade_deadline DATE;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS trade_review_period INTEGER DEFAULT 1; -- days
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS trade_veto_votes_required INTEGER DEFAULT 5;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS trade_salary_matching BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS trade_salary_tolerance DECIMAL(5,2) DEFAULT 10.0; -- percentage
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS allow_draft_pick_trades BOOLEAN DEFAULT false;

-- Waiver/Free Agent Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS waiver_period INTEGER DEFAULT 1; -- days
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS waiver_type TEXT DEFAULT 'rolling' CHECK (waiver_type IN ('rolling', 'reset_weekly', 'reset_daily'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS waiver_mode TEXT DEFAULT 'standard' CHECK (waiver_mode IN ('standard', 'faab'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS faab_budget INTEGER DEFAULT 100;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS acquisition_limit_season INTEGER DEFAULT null; -- null = no limit
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS acquisition_limit_week INTEGER DEFAULT 7;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS acquisition_limit_matchup INTEGER DEFAULT 7;

-- Player Rules
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS undroppable_players_list TEXT DEFAULT 'ESPN' CHECK (undroppable_players_list IN ('ESPN', 'Yahoo', 'Custom', 'None'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS player_universe TEXT DEFAULT 'NBA' CHECK (player_universe IN ('NBA', 'G-League', 'International'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS allow_injured_waiver_adds BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS post_draft_players TEXT DEFAULT 'waiver' CHECK (post_draft_players IN ('waiver', 'free_agent'));

-- Schedule Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS regular_season_start TEXT DEFAULT 'NBA Week 1';
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS weeks_per_matchup INTEGER DEFAULT 1;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS regular_season_matchups INTEGER DEFAULT 19;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS matchup_tiebreaker TEXT DEFAULT 'none' CHECK (matchup_tiebreaker IN ('none', 'head_to_head', 'points_for', 'points_against'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS home_field_advantage BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS home_field_advantage_points DECIMAL(5,2) DEFAULT 0.0;

-- Playoff Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_teams INTEGER DEFAULT 4;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_weeks_round1 INTEGER DEFAULT 2;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_weeks_championship INTEGER DEFAULT 2;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_seeding_tiebreaker TEXT DEFAULT 'head_to_head' CHECK (playoff_seeding_tiebreaker IN ('head_to_head', 'points_for', 'points_against', 'division_record'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_home_field_advantage BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_reseeding BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS lock_eliminated_teams BOOLEAN DEFAULT false;

-- Division Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS divisions_enabled BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS division_count INTEGER DEFAULT 2;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS division_names TEXT[] DEFAULT ARRAY['East', 'West'];

-- Keeper Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS keepers_enabled BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS keeper_count INTEGER DEFAULT 0;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS keeper_cost_inflation DECIMAL(5,2) DEFAULT 0.0; -- percentage increase per year
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS keeper_deadline DATE;

-- League Management
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS invite_permissions TEXT DEFAULT 'commissioner' CHECK (invite_permissions IN ('commissioner', 'all_managers'));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS send_reminder_emails BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS lock_benched_players BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS public_league BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS league_password TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS league_description TEXT;

-- Advanced HoopGeek Features
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS global_leaderboard BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS optimal_team_challenges BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS weekly_achievements BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS social_sharing BOOLEAN DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS team_branding BOOLEAN DEFAULT false;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS custom_scoring BOOLEAN DEFAULT false;

-- Notification Settings
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS email_notifications JSONB DEFAULT '{
  "draft_reminders": true,
  "trade_notifications": true,
  "waiver_notifications": true,
  "matchup_updates": true,
  "playoff_updates": true
}';

-- Create league_settings table for additional configuration
CREATE TABLE IF NOT EXISTS league_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array')),
  description TEXT,
  is_editable BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(league_id, setting_key)
);

-- Add RLS for league_settings
ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members can read league settings" ON league_settings
  FOR SELECT USING (
    league_id IN (
      SELECT league_id FROM league_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Commissioners can manage league settings" ON league_settings
  FOR ALL USING (
    league_id IN (
      SELECT id FROM leagues WHERE commissioner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_league_settings_league ON league_settings(league_id);
CREATE INDEX IF NOT EXISTS idx_league_settings_key ON league_settings(setting_key);

-- Update the create_league_with_commissioner function to include new settings
CREATE OR REPLACE FUNCTION create_league_with_commissioner(
  league_name TEXT,
  league_description TEXT DEFAULT NULL,
  max_teams_count INTEGER DEFAULT 10,
  scoring_type_val TEXT DEFAULT 'H2H_Points',
  team_name_val TEXT DEFAULT NULL,
  salary_cap_enabled_val BOOLEAN DEFAULT true,
  salary_cap_amount_val BIGINT DEFAULT 100000000,
  lineup_frequency_val TEXT DEFAULT 'weekly'
)
RETURNS UUID AS $$
DECLARE
  new_league_id UUID;
  new_team_id UUID;
  invite_code_val TEXT;
BEGIN
  -- Generate unique invite code
  LOOP
    invite_code_val := generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM leagues WHERE invite_code = invite_code_val);
  END LOOP;

  -- Create league with comprehensive settings
  INSERT INTO leagues (
    name, description, commissioner_id, max_teams, scoring_type, invite_code,
    salary_cap_enabled, salary_cap_amount, lineup_frequency
  )
  VALUES (
    league_name, league_description, auth.uid(), max_teams_count, scoring_type_val, invite_code_val,
    salary_cap_enabled_val, salary_cap_amount_val, lineup_frequency_val
  )
  RETURNING id INTO new_league_id;

  -- Add commissioner as league member
  INSERT INTO league_members (league_id, user_id, team_name, is_commissioner)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'), true);

  -- Create team for commissioner
  INSERT INTO teams (league_id, user_id, name)
  VALUES (new_league_id, auth.uid(), COALESCE(team_name_val, 'My Team'))
  RETURNING id INTO new_team_id;

  RETURN new_league_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage to authenticated role
GRANT EXECUTE ON FUNCTION create_league_with_commissioner(TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, BIGINT, TEXT) TO authenticated;
