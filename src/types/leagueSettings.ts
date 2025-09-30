// Comprehensive League Settings Types for HoopGeek

export interface PositionLimits {
  starters: number;
  max: number | null;
}

export interface RosterSettings {
  roster_size: number;
  total_starters: number;
  total_bench: number;
  total_ir: number;
  position_limits: {
    PG: PositionLimits;
    SG: PositionLimits;
    SF: PositionLimits;
    PF: PositionLimits;
    C: PositionLimits;
    G: PositionLimits;
    F: PositionLimits;
    UTIL: PositionLimits;
    BENCH: PositionLimits;
    IR: PositionLimits;
  };
}

export interface GamesPlayedLimits {
  all_players: number | null;
  by_position: Record<string, number | null>;
}

export interface EmailNotifications {
  draft_reminders: boolean;
  trade_notifications: boolean;
  waiver_notifications: boolean;
  matchup_updates: boolean;
  playoff_updates: boolean;
}

export interface LeagueSettings {
  // Basic League Info
  id: string;
  name: string;
  description?: string;
  league_logo_url?: string;
  auto_renew_enabled: boolean;
  cash_league: boolean;
  entry_fee: number;
  prize_pool: number;
  
  // Draft Settings
  draft_type: 'snake' | 'linear' | 'auction';
  draft_date?: string;
  draft_time_per_pick: number; // seconds
  draft_order_method: 'random' | 'manual' | 'predetermined';
  draft_order_reveal_time: number; // minutes before draft
  
  // Roster Settings
  roster_size: number;
  total_starters: number;
  total_bench: number;
  total_ir: number;
  position_limits: RosterSettings['position_limits'];
  games_played_limits: GamesPlayedLimits;
  
  // HoopGeek Specific Settings
  lineup_frequency: 'daily' | 'weekly' | 'bi-weekly';
  auto_ir_management: boolean;
  auto_substitution: boolean;
  salary_cap_enabled: boolean;
  salary_cap_amount: number;
  salary_cap_soft: boolean;
  salary_cap_penalty: number; // percentage
  
  // Trade Settings
  trade_limit?: number;
  trade_deadline?: string;
  trade_review_period: number; // days
  trade_veto_votes_required: number;
  trade_salary_matching: boolean;
  trade_salary_tolerance: number; // percentage
  allow_draft_pick_trades: boolean;
  
  // Waiver/Free Agent Settings
  waiver_period: number; // days
  waiver_type: 'rolling' | 'reset_weekly' | 'reset_daily';
  waiver_mode: 'standard' | 'faab';
  faab_budget: number;
  acquisition_limit_season?: number;
  acquisition_limit_week: number;
  acquisition_limit_matchup: number;
  
  // Player Rules
  undroppable_players_list: 'ESPN' | 'Yahoo' | 'Custom' | 'None';
  player_universe: 'NBA' | 'G-League' | 'International';
  allow_injured_waiver_adds: boolean;
  post_draft_players: 'waiver' | 'free_agent';
  
  // Schedule Settings
  regular_season_start: string;
  weeks_per_matchup: number;
  regular_season_matchups: number;
  matchup_tiebreaker: 'none' | 'head_to_head' | 'points_for' | 'points_against';
  home_field_advantage: boolean;
  home_field_advantage_points: number;
  
  // Playoff Settings
  playoff_teams: number;
  playoff_weeks_round1: number;
  playoff_weeks_championship: number;
  playoff_seeding_tiebreaker: 'head_to_head' | 'points_for' | 'points_against' | 'division_record';
  playoff_home_field_advantage: boolean;
  playoff_reseeding: boolean;
  lock_eliminated_teams: boolean;
  
  // Division Settings
  divisions_enabled: boolean;
  division_count: number;
  division_names: string[];
  
  // Keeper Settings
  keepers_enabled: boolean;
  keeper_count: number;
  keeper_cost_inflation: number; // percentage
  keeper_deadline?: string;
  
  // League Management
  invite_permissions: 'commissioner' | 'all_managers';
  send_reminder_emails: boolean;
  lock_benched_players: boolean;
  public_league: boolean;
  league_password?: string;
  
  // Advanced HoopGeek Features
  global_leaderboard: boolean;
  optimal_team_challenges: boolean;
  weekly_achievements: boolean;
  social_sharing: boolean;
  team_branding: boolean;
  custom_scoring: boolean;
  
  // Notification Settings
  email_notifications: EmailNotifications;
  
  // Metadata
  commissioner_id: string;
  max_teams: number;
  scoring_type: string;
  invite_code: string;
  season_year: number;
  created_at: string;
  updated_at: string;
}

export interface LeagueSetting {
  id: string;
  league_id: string;
  setting_key: string;
  setting_value: any;
  setting_type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description?: string;
  is_editable: boolean;
  created_at: string;
  updated_at: string;
}

// Form data interfaces for creating/editing leagues
export interface CreateLeagueFormData {
  name: string;
  description?: string;
  maxTeams: number;
  scoringType: string;
  teamName: string;
  salaryCapEnabled: boolean;
  salaryCapAmount: number;
  lineupFrequency: 'daily' | 'weekly' | 'bi-weekly';
  draftType: 'snake' | 'linear' | 'auction';
  rosterSize: number;
  totalStarters: number;
  totalBench: number;
  totalIR: number;
  playoffTeams: number;
  divisionsEnabled: boolean;
  publicLeague: boolean;
}

export interface UpdateLeagueSettingsFormData {
  // Basic Settings
  name?: string;
  description?: string;
  league_logo_url?: string;
  auto_renew_enabled?: boolean;
  cash_league?: boolean;
  entry_fee?: number;
  prize_pool?: number;
  
  // Draft Settings
  draft_type?: 'snake' | 'linear' | 'auction';
  draft_date?: string;
  draft_time_per_pick?: number;
  draft_order_method?: 'random' | 'manual' | 'predetermined';
  draft_order_reveal_time?: number;
  
  // Roster Settings
  roster_size?: number;
  total_starters?: number;
  total_bench?: number;
  total_ir?: number;
  position_limits?: Partial<RosterSettings['position_limits']>;
  games_played_limits?: Partial<GamesPlayedLimits>;
  
  // HoopGeek Settings
  lineup_frequency?: 'daily' | 'weekly' | 'bi-weekly';
  auto_ir_management?: boolean;
  auto_substitution?: boolean;
  salary_cap_enabled?: boolean;
  salary_cap_amount?: number;
  salary_cap_soft?: boolean;
  salary_cap_penalty?: number;
  
  // Trade Settings
  trade_limit?: number;
  trade_deadline?: string;
  trade_review_period?: number;
  trade_veto_votes_required?: number;
  trade_salary_matching?: boolean;
  trade_salary_tolerance?: number;
  allow_draft_pick_trades?: boolean;
  
  // Waiver Settings
  waiver_period?: number;
  waiver_type?: 'rolling' | 'reset_weekly' | 'reset_daily';
  waiver_mode?: 'standard' | 'faab';
  faab_budget?: number;
  acquisition_limit_season?: number;
  acquisition_limit_week?: number;
  acquisition_limit_matchup?: number;
  
  // Player Rules
  undroppable_players_list?: 'ESPN' | 'Yahoo' | 'Custom' | 'None';
  player_universe?: 'NBA' | 'G-League' | 'International';
  allow_injured_waiver_adds?: boolean;
  post_draft_players?: 'waiver' | 'free_agent';
  
  // Schedule Settings
  regular_season_start?: string;
  weeks_per_matchup?: number;
  regular_season_matchups?: number;
  matchup_tiebreaker?: 'none' | 'head_to_head' | 'points_for' | 'points_against';
  home_field_advantage?: boolean;
  home_field_advantage_points?: number;
  
  // Playoff Settings
  playoff_teams?: number;
  playoff_weeks_round1?: number;
  playoff_weeks_championship?: number;
  playoff_seeding_tiebreaker?: 'head_to_head' | 'points_for' | 'points_against' | 'division_record';
  playoff_home_field_advantage?: boolean;
  playoff_reseeding?: boolean;
  lock_eliminated_teams?: boolean;
  
  // Division Settings
  divisions_enabled?: boolean;
  division_count?: number;
  division_names?: string[];
  
  // Keeper Settings
  keepers_enabled?: boolean;
  keeper_count?: number;
  keeper_cost_inflation?: number;
  keeper_deadline?: string;
  
  // League Management
  invite_permissions?: 'commissioner' | 'all_managers';
  send_reminder_emails?: boolean;
  lock_benched_players?: boolean;
  public_league?: boolean;
  league_password?: string;
  
  // Advanced Features
  global_leaderboard?: boolean;
  optimal_team_challenges?: boolean;
  weekly_achievements?: boolean;
  social_sharing?: boolean;
  team_branding?: boolean;
  custom_scoring?: boolean;
  
  // Notifications
  email_notifications?: Partial<EmailNotifications>;
}

// Default settings for new leagues
export const DEFAULT_LEAGUE_SETTINGS: Partial<LeagueSettings> = {
  // Basic
  auto_renew_enabled: false,
  cash_league: false,
  entry_fee: 0,
  prize_pool: 0,
  
  // Draft
  draft_type: 'snake',
  draft_time_per_pick: 90,
  draft_order_method: 'random',
  draft_order_reveal_time: 60,
  
  // Roster
  roster_size: 13,
  total_starters: 10,
  total_bench: 3,
  total_ir: 1,
  position_limits: {
    PG: { starters: 1, max: null },
    SG: { starters: 1, max: null },
    SF: { starters: 1, max: null },
    PF: { starters: 1, max: null },
    C: { starters: 1, max: 4 },
    G: { starters: 1, max: null },
    F: { starters: 1, max: null },
    UTIL: { starters: 3, max: null },
    BENCH: { starters: 3, max: null },
    IR: { starters: 1, max: null }
  },
  games_played_limits: {
    all_players: null,
    by_position: {}
  },
  
  // HoopGeek Specific
  lineup_frequency: 'weekly',
  auto_ir_management: true,
  auto_substitution: true,
  salary_cap_enabled: true,
  salary_cap_amount: 100000000,
  salary_cap_soft: false,
  salary_cap_penalty: 0.0,
  
  // Trades
  trade_limit: null,
  trade_review_period: 1,
  trade_veto_votes_required: 5,
  trade_salary_matching: true,
  trade_salary_tolerance: 10.0,
  allow_draft_pick_trades: false,
  
  // Waivers
  waiver_period: 1,
  waiver_type: 'rolling',
  waiver_mode: 'standard',
  faab_budget: 100,
  acquisition_limit_season: null,
  acquisition_limit_week: 7,
  acquisition_limit_matchup: 7,
  
  // Players
  undroppable_players_list: 'ESPN',
  player_universe: 'NBA',
  allow_injured_waiver_adds: true,
  post_draft_players: 'waiver',
  
  // Schedule
  regular_season_start: 'NBA Week 1',
  weeks_per_matchup: 1,
  regular_season_matchups: 19,
  matchup_tiebreaker: 'none',
  home_field_advantage: false,
  home_field_advantage_points: 0.0,
  
  // Playoffs
  playoff_teams: 4,
  playoff_weeks_round1: 2,
  playoff_weeks_championship: 2,
  playoff_seeding_tiebreaker: 'head_to_head',
  playoff_home_field_advantage: false,
  playoff_reseeding: false,
  lock_eliminated_teams: false,
  
  // Divisions
  divisions_enabled: false,
  division_count: 2,
  division_names: ['East', 'West'],
  
  // Keepers
  keepers_enabled: false,
  keeper_count: 0,
  keeper_cost_inflation: 0.0,
  
  // Management
  invite_permissions: 'commissioner',
  send_reminder_emails: true,
  lock_benched_players: false,
  public_league: false,
  
  // Advanced Features
  global_leaderboard: true,
  optimal_team_challenges: true,
  weekly_achievements: true,
  social_sharing: true,
  team_branding: false,
  custom_scoring: false,
  
  // Notifications
  email_notifications: {
    draft_reminders: true,
    trade_notifications: true,
    waiver_notifications: true,
    matchup_updates: true,
    playoff_updates: true
  }
};
