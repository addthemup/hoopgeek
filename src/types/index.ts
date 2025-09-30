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
}

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
  name: string
  position: string
  team: string
  salary: number
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
