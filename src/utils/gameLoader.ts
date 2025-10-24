/**
 * Game Loader Utilities
 * 
 * Handles loading game data from Supabase database feed
 */

// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qbznyaimnrpibmahisue.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU'

// Create Supabase client
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface GameData {
  id: string
  game_id: string
  content_type: string
  game_date: string
  fun_score?: number
  story_data?: {
    matchup: string
    final_score: string
    teams: {
      winner: {
        name: string
        city: string
        tricode: string
        teamId: number
        points: number
      }
      loser: {
        name: string
        city: string
        tricode: string
        teamId: number
        points: number
      }
    }
    advantages: Array<{
      stat_name: string
      team: string
      teamId: number
      teamTricode: string
      value1: number
      value2: number
      diff: number
    }>
  }
  fun_data?: {
    lead_changes: {
      total: number
      last_5_minutes: number
      last_minute: number
      buzzer_beater: number
    }
    dunk_stats: {
      'Total Dunks': number
      'Alley Oop': number
      'Putback': number
      [key: string]: number
    }
    deep_shots: {
      deep_threes: number
      four_pointers: number
    }
  }
  video_script?: Array<{
    mp4?: string
    description?: string
    [key: string]: any
  }>
  total_plays?: number
  likes_count?: number
  comments_count?: number
  shares_count?: number
  created_at: string
}

export interface FullGameData extends GameData {
  team_stats?: {
    'Margin of Victory': number
    'Combined Threes': number
    'Team Threes': Record<string, number>
    'Combined Three %': number
    'Team Three %': Record<string, number>
    'Pace': number
    'Team Pace': Record<string, number>
    'Combined Contested Shots': number
    'Team Contested Shots': Record<string, number>
    'Combined Fast Break Points': number
    'Team Fast Break Points': Record<string, number>
  }
  scoring_milestones?: {
    '70 Ball': Array<[string, number]>
    '60 Ball': Array<[string, number]>
    '50 Ball': Array<[string, number]>
    '40 Ball': Array<[string, number]>
    'Triple Double': Array<[string, string]>
  }
  gameMetadata?: {
    date: string
    arena: string
    season: string
    status?: string
    homeTeam?: any
    awayTeam?: any
  }
  script?: {
    video_script: Array<any>
    total_plays: number
  }
}

/**
 * Get all games for the feed from Supabase database
 * Fetches content from feed_content table with proper ordering
 */
export async function getAllGames(): Promise<GameData[]> {
  try {
    const { data, error } = await supabase
      .from('feed_content')
      .select('*')
      .order('game_date', { ascending: false })
      .order('fun_score', { ascending: false, nullsFirst: false })
      .limit(100) // Limit to prevent overwhelming the UI

    if (error) {
      throw new Error(`Failed to load games: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error loading games from database:', error);
    return [];
  }
}

/**
 * Get a single game's full data by ID from Supabase
 * Fetches the complete game data from feed_content table
 */
export async function getGameById(gameId: string): Promise<FullGameData | null> {
  try {
    const { data, error } = await supabase
      .from('feed_content')
      .select('*')
      .eq('game_id', gameId)
      .single()

    if (error) {
      throw new Error(`Failed to load game ${gameId}: ${error.message}`);
    }

    return data as FullGameData;
  } catch (error) {
    console.error(`Error loading game ${gameId}:`, error);
    return null;
  }
}

/**
 * Transform raw JSON to our expected format
 * Handles different possible structures from your Python scripts
 */
function transformGameData(raw: any): FullGameData {
  // Check if data is nested under a "score" or other key
  const gameId = raw.gameId;
  const scoreData = raw.score?.[gameId] || raw.score || {};
  const story = raw.story || {};
  const metadata = raw.gameMetadata || {};
  
  return {
    game_id: gameId,
    game_date: metadata.date || raw.date,
    fun_score: scoreData.fun_score || raw.fun_score || 0,
    
    story: {
      matchup: story.matchup || '',
      final_score: story.final_score || '',
      teams: story.teams || {
        winner: {
          name: metadata.homeTeam?.name || '',
          city: metadata.homeTeam?.city || '',
          tricode: metadata.homeTeam?.abbreviation || '',
          teamId: metadata.homeTeam?.team_id || 0,
          points: metadata.homeTeam?.points || 0
        },
        loser: {
          name: metadata.awayTeam?.name || '',
          city: metadata.awayTeam?.city || '',
          tricode: metadata.awayTeam?.abbreviation || '',
          teamId: metadata.awayTeam?.team_id || 0,
          points: metadata.awayTeam?.points || 0
        }
      },
      advantages: story.advantages || []
    },
    
    lead_changes: scoreData.lead_changes || raw.lead_changes || {
      total: 0,
      last_5_minutes: 0,
      last_minute: 0,
      buzzer_beater: 0
    },
    
    dunk_stats: scoreData.dunk_stats || raw.dunk_stats || {
      'Total Dunks': 0,
      'Alley Oop': 0,
      'Putback': 0
    },
    
    deep_shots: scoreData.deep_shots || raw.deep_shots || {
      deep_threes: 0,
      four_pointers: 0
    },
    
    team_stats: scoreData.team_stats || raw.team_stats,
    scoring_milestones: scoreData.scoring_milestones || raw.scoring_milestones,
    gameMetadata: metadata,
    script: raw.script,
    
    thumbnail_url: raw.thumbnail_url,
    video_url: raw.video_url || (() => {
      // For finished games, use LAST video (game-winning play/buzzer)
      // Otherwise use first video
      if (raw.script?.video_script && Array.isArray(raw.script.video_script)) {
        const videos = raw.script.video_script.filter((play: any) => play.mp4);
        if (videos.length > 0) {
          return videos[videos.length - 1].mp4; // Use last video
        }
      }
      return null;
    })(),
    views: raw.views || 0,
    likes: raw.likes || 0
  };
}

/**
 * Get games filtered by date range
 */
export async function getGamesByDateRange(
  startDate: Date,
  endDate: Date
): Promise<GameData[]> {
  try {
    const { data, error } = await supabase
      .from('feed_content')
      .select('*')
      .gte('game_date', startDate.toISOString())
      .lte('game_date', endDate.toISOString())
      .order('game_date', { ascending: false })

    if (error) {
      throw new Error(`Failed to load games by date range: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error loading games by date range:', error);
    return [];
  }
}

/**
 * Get top games by fun score
 */
export async function getTopGamesByFunScore(limit: number = 10): Promise<GameData[]> {
  try {
    const { data, error } = await supabase
      .from('feed_content')
      .select('*')
      .not('fun_score', 'is', null)
      .order('fun_score', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to load top games: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error loading top games:', error);
    return [];
  }
}

/**
 * Search games by team
 */
export async function searchGamesByTeam(teamTricode: string): Promise<GameData[]> {
  try {
    const { data, error } = await supabase
      .from('feed_content')
      .select('*')
      .or(`home_team_tricode.eq.${teamTricode},away_team_tricode.eq.${teamTricode}`)
      .order('game_date', { ascending: false })

    if (error) {
      throw new Error(`Failed to search games by team: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error searching games by team:', error);
    return [];
  }
}

