export interface User {
  id: string
  email: string
  username?: string
  created_at: string
  updated_at: string
}

export interface League {
  id: string
  name: string
  description?: string
  commissioner_id: string
  max_teams: number
  draft_date?: string
  draft_status: 'scheduled' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
  // League branding
  logo_url?: string
  logo_upload_id?: string
  colors?: {
    primary: string
    secondary: string
  }
  // League type and configuration
  league_type?: 'redraft' | 'dynasty' | 'keeper'
  draft_type?: 'snake' | 'linear' | 'auction'
  draft_rounds?: number
  // League settings
  scoring_type?: string
  fantasy_scoring_format?: string
  lineup_frequency?: string
  salary_cap_enabled?: boolean
  salary_cap_amount?: number
  trades_enabled?: boolean
  public_league?: boolean
  invite_code?: string
  // Additional fields for display
  team_name?: string
  is_commissioner?: boolean
  joined_at?: string
  // Season-specific fields (from fantasy_league_seasons)
  season_year?: number
  season_status?: 'upcoming' | 'active' | 'completed' | 'cancelled'
  current_teams?: number
  trade_deadline?: string
  roster_positions?: Record<string, number>
  starters_count?: number
  starters_multiplier?: number
  rotation_count?: number
  rotation_multiplier?: number
  bench_count?: number
  bench_multiplier?: number
  position_unit_assignments?: Record<string, any>
  playoff_teams?: number
  playoff_weeks?: number
}

// Re-export league settings types
export * from './leagueSettings'

export interface LeagueMember {
  id: string
  league_id: string
  user_id: string
  team_name: string
  joined_at: string
  is_commissioner: boolean
}

export interface Player {
  id: string
  nba_player_id: number
  name: string
  first_name?: string
  last_name?: string
  position?: string
  team_id?: number
  team_name?: string
  team_abbreviation?: string
  jersey_number?: string
  height?: string
  weight?: number
  age?: number
  birth_date?: string
  birth_city?: string
  birth_state?: string
  birth_country?: string
  college?: string
  draft_year?: number
  draft_round?: number
  draft_number?: number
  salary: number
  // Contract data fields
  salary_2025_26?: number
  salary_2026_27?: number
  salary_2027_28?: number
  salary_2028_29?: number
  contract_years_remaining?: number
  is_active: boolean
  is_rookie: boolean
  years_pro: number
  from_year?: number
  to_year?: number
  created_at: string
  updated_at: string
  stats?: PlayerStats
  espn_player_projections?: ESPNPlayerProjections[]
}

export interface PlayerStats {
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  field_goal_percentage: number
  free_throw_percentage: number
  three_point_percentage: number
}

export interface ESPNPlayerProjections {
  proj_2026_pts?: number
  proj_2026_reb?: number
  proj_2026_ast?: number
  proj_2026_stl?: number
  proj_2026_blk?: number
  proj_2026_to?: number
  proj_2026_gp?: number
  proj_2026_min?: number
  proj_2026_fg_pct?: number
  proj_2026_ft_pct?: number
  proj_2026_3pm?: number
  stats_2025_pts?: number
  stats_2025_reb?: number
  stats_2025_ast?: number
  stats_2025_stl?: number
  stats_2025_blk?: number
  stats_2025_to?: number
  stats_2025_gp?: number
  stats_2025_min?: number
  stats_2025_fg_pct?: number
  stats_2025_ft_pct?: number
  stats_2025_3pm?: number
}

export interface LeagueInvitation {
  id: string
  league_id: string
  fantasy_team_id: string
  email: string
  invited_by: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  created_at: string
  expires_at: string
  team_name?: string
  message?: string
}

export interface LeagueMember {
  id: string
  league_id: string
  user_id: string
  team_name: string
  is_commissioner: boolean
  joined_at: string
  user?: {
    id: string
    email: string
    name?: string
  }
}

export interface RosterSpot {
  id: string
  fantasy_team_id: string
  season_id: string
  is_injured_reserve: boolean
  player_id?: string
  assigned_at?: string
  assigned_by?: string
  draft_round?: number
  draft_pick?: number
  created_at: string
  updated_at: string
}

export interface FantasyTeamPlayer {
  id: string
  fantasy_team_id: string
  season_id: string
  is_injured_reserve: boolean
  player_id?: string
  assigned_at?: string
  assigned_by?: string
  draft_round?: number
  draft_pick?: number
  created_at: string
  updated_at: string
  player?: Player // Joined player data
  roster_spot?: RosterSpot // Joined roster spot data
}

export interface FantasyTeam {
  id: string
  league_id: string
  season_id: string
  user_id?: string
  team_name: string
  draft_position?: number
  is_commissioner: boolean
  is_active: boolean
  // Season-specific stats
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  current_streak: string
  current_standing: number
  created_at: string
  updated_at: string
  user?: {
    id: string
    email: string
    username?: string
  }
  roster?: FantasyTeamPlayer[] // Team's roster
}

export interface DraftPick {
  id: string
  league_id: string
  player_id: string
  fantasy_team_id: string
  pick_number: number
  created_at: string
}

export interface DraftChatMessage {
  id: string;
  league_id: string;
  user_id: string;
  fantasy_team_id: string;
  message: string;
  message_type: 'chat' | 'system' | 'pick_announcement' | 'trade_announcement';
  is_commissioner_message: boolean;
  created_at: string;
  user?: {
    email: string;
  };
  fantasy_team?: {
    team_name: string;
  };
}

export interface DraftLobbyParticipant {
  id: string;
  league_id: string;
  user_id: string;
  fantasy_team_id: string;
  joined_at: string;
  last_seen_at: string;
  is_online: boolean;
  user?: {
    email: string;
  };
  fantasy_team?: {
    team_name: string;
  };
}
