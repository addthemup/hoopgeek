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

export interface DraftPick {
  id: string
  league_id: string
  player_id: string
  team_id: string
  pick_number: number
  created_at: string
}

export interface Team {
  id: string
  league_id: string
  user_id: string
  name: string
  players: Player[]
  salary_cap_used: number
  salary_cap_max: number
}
