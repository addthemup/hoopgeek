import { supabase } from './supabase'

export interface NBAPlayer {
  id: string
  name: string
  position: string
  team: string
  salary: number
  stats?: {
    points: number
    rebounds: number
    assists: number
    steals: number
    blocks: number
    field_goal_percentage: number
    free_throw_percentage: number
    three_point_percentage: number
  }
}

export class NBAApiClient {
  private baseUrl: string

  constructor() {
    // Use Supabase Edge Function URL or separate Python service
    this.baseUrl = import.meta.env.VITE_NBA_API_URL || 'http://localhost:8000'
  }

  async getPlayers(): Promise<NBAPlayer[]> {
    try {
      // Option 1: Direct Supabase query
      const { data, error } = await supabase
        .from('nba_players')
        .select('*')
        .order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching players:', error)
      throw error
    }
  }

  async syncPlayers(): Promise<{ message: string; players_count: number }> {
    try {
      // Option 1: Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('fetch-nba-players')
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error syncing players:', error)
      throw error
    }
  }

  async getPlayerStats(playerId: string): Promise<NBAPlayer> {
    try {
      const { data, error } = await supabase
        .from('nba_players')
        .select('*')
        .eq('id', playerId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching player stats:', error)
      throw error
    }
  }

  // Alternative: Direct API calls to Python service
  async getPlayersFromService(): Promise<NBAPlayer[]> {
    try {
      const response = await fetch(`${this.baseUrl}/players`)
      if (!response.ok) throw new Error('Failed to fetch players')
      const data = await response.json()
      return data.players
    } catch (error) {
      console.error('Error fetching players from service:', error)
      throw error
    }
  }

  async syncPlayersFromService(): Promise<{ message: string; players_count: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/sync-players`, {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Failed to sync players')
      return await response.json()
    } catch (error) {
      console.error('Error syncing players from service:', error)
      throw error
    }
  }
}

export const nbaApi = new NBAApiClient()
