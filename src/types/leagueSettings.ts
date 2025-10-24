export interface LeagueSettings {
  // Basic League Info
  name: string
  description?: string
  max_teams: number
  commissioner_id: string
  
  // Draft Settings
  draft_date?: string
  draft_time?: string
  draft_type: 'snake' | 'linear' | 'auction'
  draft_rounds: number
  
  // Roster Settings
  roster_positions: {
    PG: number
    SG: number
    SF: number
    PF: number
    C: number
    G: number
    F: number
    UTIL: number
    BENCH: number
    IR: number
  }
  
  // Scoring Settings
  scoring_type: 'H2H_Weekly'
  fantasy_scoring_format: 'FanDuel' | 'DraftKings' | 'Yahoo' | 'ESPN' | 'Custom'
  scoring_categories: {
    points: number
    rebounds: number
    assists: number
    steals: number
    blocks: number
    turnovers: number
    field_goal_percentage: number
    free_throw_percentage: number
    three_point_percentage: number
    three_pointers_made: number
    double_doubles: number
    triple_doubles: number
  }
  
  // League Rules
  trade_deadline?: string
  waiver_wire: boolean
  waiver_period_days: number
  max_trades_per_team: number
  max_adds_per_team: number
  
  // Waiver System Settings
  waiver_type?: 'none' | 'rolling' | 'faab' | 'continuous'
  waiver_period_hours?: number
  waiver_budget_amount?: number
  waiver_min_bid?: number
  waiver_priority_reset?: 'never' | 'weekly' | 'after_claim'
  waiver_process_time?: string
  
  // Playoff Settings
  playoff_teams: number
  playoff_weeks: number
  playoff_start_week: number
  
  // Keeper Settings
  keeper_league: boolean
  max_keepers: number
  keeper_deadline?: string
  
  // Salary Cap (if enabled)
  salary_cap_enabled: boolean
  salary_cap_amount?: number
  
  // Weekly Lineup Settings
  starters_count: number // Always 5
  starters_multiplier: number // Default 1.0
  rotation_count: number // 3-7
  rotation_multiplier: number // Default 0.75
  bench_count: number // 2-5
  bench_multiplier: number // Default 0.5
  
  // Position Unit Assignment
  position_unit_assignments: {
    starters: Record<string, number>
    rotation: Record<string, number>
    bench: Record<string, number>
  }
  
  // Other Settings
  public_league: boolean
  allow_duplicate_players: boolean
  lineup_deadline: 'daily' | 'weekly'
  lineup_lock_time: string
}

export interface UpdateLeagueSettingsFormData {
  // Make all fields optional for updates
  name?: string
  description?: string
  max_teams?: number
  draft_date?: string
  draft_time?: string
  draft_type?: 'snake' | 'linear' | 'auction'
  draft_rounds?: number
  draft_time_per_pick?: number
  draft_order_method?: 'random' | 'manual' | 'predetermined'
  scoring_type?: 'H2H_Weekly' | 'H2H_Points' | 'Rotisserie' | 'H2H_Category' | 'H2H_Most_Categories' | 'Season_Points'
  fantasy_scoring_format?: 'FanDuel' | 'DraftKings' | 'Yahoo' | 'ESPN' | 'Custom'
  trade_deadline?: string
  trade_limit?: number
  trade_salary_matching?: boolean
  trade_salary_tolerance?: number
  trade_veto_votes_required?: number
  allow_draft_pick_trades?: boolean
  waiver_wire?: boolean
  waiver_period_days?: number
  max_trades_per_team?: number
  max_adds_per_team?: number
  
  // New Waiver System Settings
  waiver_type?: 'none' | 'rolling' | 'faab' | 'continuous'
  waiver_period_hours?: number
  waiver_budget_amount?: number
  waiver_min_bid?: number
  waiver_priority_reset?: 'never' | 'weekly' | 'after_claim'
  waiver_process_time?: string
  
  playoff_teams?: number
  playoff_weeks?: number
  playoff_start_week?: number
  keeper_league?: boolean
  max_keepers?: number
  keeper_deadline?: string
  salary_cap_enabled?: boolean
  salary_cap_amount?: number
  salary_cap_soft?: boolean
  salary_cap_penalty?: number
  roster_size?: number
  total_starters?: number
  total_bench?: number
  total_ir?: number
  starters_count?: number
  starters_multiplier?: number
  rotation_count?: number
  rotation_multiplier?: number
  bench_count?: number
  bench_multiplier?: number
  public_league?: boolean
  allow_duplicate_players?: boolean
  lineup_deadline?: 'daily' | 'weekly'
  lineup_lock_time?: string
  lineup_frequency?: 'daily' | 'weekly' | 'bi-weekly'
  auto_ir_management?: boolean
  auto_substitution?: boolean
  global_leaderboard?: boolean
}

export interface LeagueCreationData {
  settings: LeagueSettings
  commissioner_team_name: string
  auto_fill_teams: boolean
  invite_emails?: string[]
}

export interface Team {
  id: string
  league_id: string
  user_id?: string
  team_name: string
  team_abbreviation?: string
  draft_position?: number
  is_commissioner: boolean
  created_at: string
  updated_at: string
  // Roster data
  roster?: {
    PG?: string[]
    SG?: string[]
    SF?: string[]
    PF?: string[]
    C?: string[]
    G?: string[]
    F?: string[]
    UTIL?: string[]
    BENCH?: string[]
  }
}

export interface DraftOrder {
  id: string
  league_id: string
  team_id: string
  round: number
  pick_number: number
  player_id?: string
  is_completed: boolean
  created_at: string
}

export interface LeagueState {
  id: string
  league_id: string
  current_phase: 'setup' | 'draft' | 'regular_season' | 'playoffs' | 'completed'
  current_week: number
  current_season: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const DEFAULT_LEAGUE_SETTINGS: Partial<LeagueSettings> = {
  waiver_type: 'rolling',
  waiver_period_hours: 24,
  waiver_budget_amount: 100,
  waiver_min_bid: 0,
  waiver_priority_reset: 'after_claim',
  waiver_process_time: '03:00',
}