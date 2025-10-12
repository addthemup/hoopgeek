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
  scoring_type: 'H2H_Points' | 'H2H_Category' | 'H2H_Most_Categories' | 'Roto' | 'Season_Points'
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
  bench_count: number // 3-5
  bench_multiplier: number // Default 0.5
  
  // Other Settings
  public_league: boolean
  allow_duplicate_players: boolean
  lineup_deadline: 'daily' | 'weekly'
  lineup_lock_time: string
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