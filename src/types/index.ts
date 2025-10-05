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
  // Additional fields for display
  team_name?: string
  is_commissioner?: boolean
  joined_at?: string
  scoring_type?: string
  lineup_frequency?: string
  salary_cap_enabled?: boolean
  salary_cap_amount?: number
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
  id: number
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
  is_active: boolean
  is_rookie: boolean
  years_pro: number
  from_year?: number
  to_year?: number
  created_at: string
  updated_at: string
  stats?: PlayerStats
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
  league_id: string
  position: string
  position_order: number
  is_starter: boolean
  is_bench: boolean
  is_injured_reserve: boolean
  created_at: string
}

export interface FantasyTeamPlayer {
  id: string
  fantasy_team_id: string
  roster_spot_id: string
  player_id?: number
  position: string
  is_starter: boolean
  is_injured: boolean
  added_at: string
  player?: Player // Joined player data
  roster_spot?: RosterSpot // Joined roster spot data
}

export interface FantasyTeam {
  id: string
  league_id: string
  user_id?: string
  team_name: string
  team_abbreviation?: string
  draft_position?: number
  is_commissioner: boolean
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  salary_cap_used: number
  salary_cap_max: number
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
