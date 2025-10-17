/**
 * User Settings and Customization Types
 * 
 * These types match the database schema for user customization features
 * including profiles, favorites, notifications, and feed preferences.
 */

// =====================================================
// USER PROFILE
// =====================================================

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// FAVORITE PLAYERS
// =====================================================

export interface FavoritePlayer {
  id: string;
  player_id: number;
  player_name: string;
  player_position: string;
  player_team: string;
  player_jersey_number: number | null;
  nba_player_id: number;
  notes: string | null;
  notify_on_games: boolean;
  notify_on_milestones: boolean;
  created_at: string;
}

export interface AddFavoritePlayerParams {
  user_id: string;
  player_id: number;
  notes?: string;
}

export interface RemoveFavoritePlayerParams {
  user_id: string;
  player_id: number;
}

// =====================================================
// FAVORITE TEAMS
// =====================================================

export interface FavoriteTeam {
  id: string;
  team_id: number;
  team_name: string;
  team_abbreviation: string;
  team_city: string;
  team_conference: string;
  team_division: string;
  notes: string | null;
  notify_on_games: boolean;
  notify_on_trades: boolean;
  created_at: string;
}

export interface AddFavoriteTeamParams {
  user_id: string;
  team_id: number;
  notes?: string;
}

export interface RemoveFavoriteTeamParams {
  user_id: string;
  team_id: number;
}

// =====================================================
// NOTIFICATION PREFERENCES
// =====================================================

export interface NotificationPreferences {
  user_id: string;
  
  // General
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  
  // Content notifications
  new_highlights: boolean;
  featured_games: boolean;
  
  // Fantasy league notifications
  league_results: boolean;
  draft_reminders: boolean;
  trade_proposals: boolean;
  waiver_wire_results: boolean;
  lineup_reminders: boolean;
  
  // Player notifications
  player_injury_reports: boolean;
  player_milestones: boolean;
  favorite_player_games: boolean;
  
  // Team notifications
  favorite_team_games: boolean;
  favorite_team_trades: boolean;
  
  // Social notifications
  league_chat_messages: boolean;
  comments_on_posts: boolean;
  mentions: boolean;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface UpdateNotificationPreferencesParams {
  user_id: string;
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;
  new_highlights?: boolean;
  featured_games?: boolean;
  league_results?: boolean;
  draft_reminders?: boolean;
  trade_proposals?: boolean;
  waiver_wire_results?: boolean;
  lineup_reminders?: boolean;
  player_injury_reports?: boolean;
  player_milestones?: boolean;
  favorite_player_games?: boolean;
  favorite_team_games?: boolean;
  favorite_team_trades?: boolean;
  league_chat_messages?: boolean;
  comments_on_posts?: boolean;
  mentions?: boolean;
}

// =====================================================
// FEED PREFERENCES
// =====================================================

export interface FeedPreferences {
  user_id: string;
  
  // Feed algorithm
  prioritize_favorite_teams: boolean;
  prioritize_favorite_players: boolean;
  show_low_fun_score_games: boolean;
  min_fun_score_threshold: number; // 0-10
  
  // Content type preferences
  show_highlights: boolean;
  show_buzzer_beaters: boolean;
  show_close_games: boolean;
  show_high_scoring: boolean;
  show_overtime_games: boolean;
  show_playoff_games: boolean;
  show_rivalry_games: boolean;
  
  // Time preferences
  days_back_to_show: number; // 1-365
  
  // View preferences
  default_feed_view: 'grid' | 'list' | 'compact';
  games_per_page: number; // 3-50
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface UpdateFeedPreferencesParams {
  user_id: string;
  prioritize_favorite_teams?: boolean;
  prioritize_favorite_players?: boolean;
  show_low_fun_score_games?: boolean;
  min_fun_score_threshold?: number;
  show_highlights?: boolean;
  show_buzzer_beaters?: boolean;
  show_close_games?: boolean;
  show_high_scoring?: boolean;
  show_overtime_games?: boolean;
  show_playoff_games?: boolean;
  show_rivalry_games?: boolean;
  days_back_to_show?: number;
  default_feed_view?: 'grid' | 'list' | 'compact';
  games_per_page?: number;
}

// =====================================================
// COMPLETE USER SETTINGS
// =====================================================

export interface CompleteUserSettings {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  favorite_players_count: number;
  favorite_teams_count: number;
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  min_fun_score_threshold: number;
  days_back_to_show: number;
  default_feed_view: 'grid' | 'list' | 'compact';
  created_at: string;
  updated_at: string;
}

// =====================================================
// UPDATE PROFILE PARAMS
// =====================================================

export interface UpdateUserProfileParams {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  theme?: 'light' | 'dark' | 'system';
  timezone?: string;
}

