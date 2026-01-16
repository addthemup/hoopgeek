/**
 * User Settings Hooks
 * 
 * React Query hooks for managing user profiles, favorites, notifications, and feed preferences
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import {
  UserProfile,
  FavoritePlayer,
  FavoriteTeam,
  NotificationPreferences,
  FeedPreferences,
  CompleteUserSettings,
  UpdateUserProfileParams,
  UpdateNotificationPreferencesParams,
  UpdateFeedPreferencesParams
} from '../types/userSettings';

// =====================================================
// USER PROFILE HOOKS
// =====================================================

/**
 * Get user profile
 */
export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const { data, error } = await supabase
        .rpc('get_user_profile', { user_id: userId });
      
      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }
      
      const profile = data?.[0] as UserProfile | null;
      console.log('Fetched user profile:', profile);
      // Return null instead of undefined to satisfy React Query
      return profile ?? null;
    },
    enabled: !!userId,
    staleTime: 0, // Always refetch when data is stale
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
}

/**
 * Update user profile
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: UpdateUserProfileParams) => {
      console.log('Calling update_user_profile with params:', params);
      const { data, error } = await supabase.rpc('update_user_profile', {
        p_user_id: params.user_id,
        p_display_name: params.display_name,
        p_avatar_url: params.avatar_url,
        p_bio: params.bio,
        p_theme: params.theme,
        p_timezone: params.timezone
      });
      
      if (error) {
        console.error('Error updating user profile:', error);
        throw error;
      }
      
      console.log('update_user_profile RPC returned:', data);
      return data;
    },
    onSuccess: async (data, variables) => {
      console.log('Profile update successful, invalidating queries for user:', variables.user_id);
      // Invalidate and refetch immediately
      await queryClient.invalidateQueries({ queryKey: ['user-profile', variables.user_id] });
      await queryClient.invalidateQueries({ queryKey: ['complete-user-settings', variables.user_id] });
      // Force a refetch
      await queryClient.refetchQueries({ queryKey: ['user-profile', variables.user_id] });
    }
  });
}

// =====================================================
// FAVORITE PLAYERS HOOKS
// =====================================================

/**
 * Get user's favorite players
 */
export function useFavoritePlayers(userId: string | undefined) {
  return useQuery({
    queryKey: ['favorite-players', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const { data, error } = await supabase
        .rpc('get_user_favorite_players', { p_user_id: userId });
      
      if (error) throw error;
      return data as FavoritePlayer[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Check if a player is favorited
 */
export function useIsPlayerFavorited(userId: string | undefined, playerId: number | undefined) {
  return useQuery({
    queryKey: ['is-player-favorited', userId, playerId],
    queryFn: async () => {
      if (!userId || !playerId) return false;
      
      const { data, error } = await supabase
        .rpc('is_player_favorited', { 
          p_user_id: userId, 
          p_player_id: playerId 
        });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!userId && !!playerId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Toggle favorite player (add if not exists, remove if exists)
 */
export function useToggleFavoritePlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, playerId }: { userId: string; playerId: number }) => {
      const { data, error } = await supabase.rpc('toggle_favorite_player', {
        p_user_id: userId,
        p_player_id: playerId
      });
      
      if (error) throw error;
      return data as boolean; // true if added, false if removed
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-players', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['is-player-favorited', variables.userId, variables.playerId] });
      queryClient.invalidateQueries({ queryKey: ['complete-user-settings', variables.userId] });
    }
  });
}

/**
 * Add player to favorites
 */
export function useAddFavoritePlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, playerId, notes }: { userId: string; playerId: number; notes?: string }) => {
      const { data, error } = await supabase.rpc('add_favorite_player', {
        p_user_id: userId,
        p_player_id: playerId,
        p_notes: notes
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-players', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['is-player-favorited', variables.userId, variables.playerId] });
      queryClient.invalidateQueries({ queryKey: ['complete-user-settings', variables.userId] });
    }
  });
}

/**
 * Remove player from favorites
 */
export function useRemoveFavoritePlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, playerId }: { userId: string; playerId: number }) => {
      const { data, error } = await supabase.rpc('remove_favorite_player', {
        p_user_id: userId,
        p_player_id: playerId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-players', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['is-player-favorited', variables.userId, variables.playerId] });
      queryClient.invalidateQueries({ queryKey: ['complete-user-settings', variables.userId] });
    }
  });
}

// =====================================================
// FAVORITE TEAMS HOOKS
// =====================================================

/**
 * Get user's favorite teams
 */
export function useFavoriteTeams(userId: string | undefined) {
  return useQuery({
    queryKey: ['favorite-teams', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // Query directly from user_favorite_teams
      const { data: favoriteTeams, error: favoritesError } = await supabase
        .from('user_favorite_teams')
        .select('id, team_id, notes, notify_on_games, notify_on_trades, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (favoritesError) {
        console.error('Error fetching favorite teams:', favoritesError);
        throw favoritesError;
      }
      
      if (!favoriteTeams || favoriteTeams.length === 0) {
        return [];
      }
      
      // Get team IDs and fetch team details
      const teamIds = favoriteTeams.map((ft: any) => ft.team_id);
      
      const { data: teams, error: teamsError } = await supabase
        .from('nba_teams')
        .select('team_id, abbreviation, nickname, city')
        .in('team_id', teamIds);
      
      if (teamsError) {
        console.error('Error fetching team details:', teamsError);
        throw teamsError;
      }
      
      // Create a map of team_id to team details
      const teamMap = new Map((teams || []).map((team: any) => [team.team_id, team]));
      
      // Transform the data to match FavoriteTeam interface
      const transformed = favoriteTeams.map((item: any) => {
        const team = teamMap.get(item.team_id);
        return {
          id: item.id,
          team_id: item.team_id,
          team_name: team ? `${team.city || ''} ${team.nickname || ''}`.trim() : '',
          team_abbreviation: team?.abbreviation || '',
          team_city: team?.city || '',
          notes: item.notes,
          notify_on_games: item.notify_on_games,
          notify_on_trades: item.notify_on_trades,
          created_at: item.created_at,
        };
      });
      
      return transformed as FavoriteTeam[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Check if a team is favorited
 */
export function useIsTeamFavorited(userId: string | undefined, teamId: number | undefined) {
  return useQuery({
    queryKey: ['is-team-favorited', userId, teamId],
    queryFn: async () => {
      if (!userId || !teamId) return false;
      
      const { data, error } = await supabase
        .rpc('is_team_favorited', { 
          p_user_id: userId, 
          p_team_id: teamId 
        });
      
      if (error) throw error;
      return data as boolean;
    },
    enabled: !!userId && !!teamId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Toggle favorite team (add if not exists, remove if exists)
 */
export function useToggleFavoriteTeam() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, teamId }: { userId: string; teamId: number }) => {
      const { data, error } = await supabase.rpc('toggle_favorite_team', {
        p_user_id: userId,
        p_team_id: teamId
      });
      
      if (error) throw error;
      return data as boolean; // true if added, false if removed
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['favorite-teams', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['is-team-favorited', variables.userId, variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ['complete-user-settings', variables.userId] });
    }
  });
}

// =====================================================
// NOTIFICATION PREFERENCES HOOKS
// =====================================================

/**
 * Get user's notification preferences
 */
export function useNotificationPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ['notification-preferences', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const { data, error } = await supabase
        .rpc('get_user_notification_preferences', { p_user_id: userId });
      
      if (error) throw error;
      return data?.[0] as NotificationPreferences | null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Update notification preferences
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: UpdateNotificationPreferencesParams) => {
      const { data, error } = await supabase.rpc('update_user_notification_preferences', {
        p_user_id: params.user_id,
        p_notifications_enabled: params.notifications_enabled,
        p_email_notifications: params.email_notifications,
        p_push_notifications: params.push_notifications,
        p_new_highlights: params.new_highlights,
        p_featured_games: params.featured_games,
        p_league_results: params.league_results,
        p_draft_reminders: params.draft_reminders,
        p_trade_proposals: params.trade_proposals,
        p_waiver_wire_results: params.waiver_wire_results,
        p_lineup_reminders: params.lineup_reminders,
        p_player_injury_reports: params.player_injury_reports,
        p_player_milestones: params.player_milestones,
        p_favorite_player_games: params.favorite_player_games,
        p_favorite_team_games: params.favorite_team_games,
        p_favorite_team_trades: params.favorite_team_trades,
        p_league_chat_messages: params.league_chat_messages,
        p_comments_on_posts: params.comments_on_posts,
        p_mentions: params.mentions
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['complete-user-settings', variables.user_id] });
    }
  });
}

// =====================================================
// FEED PREFERENCES HOOKS
// =====================================================

/**
 * Get user's feed preferences
 */
export function useFeedPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ['feed-preferences', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const { data, error } = await supabase
        .rpc('get_user_feed_preferences', { p_user_id: userId });
      
      if (error) throw error;
      return data?.[0] as FeedPreferences | null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Update feed preferences
 */
export function useUpdateFeedPreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: UpdateFeedPreferencesParams) => {
      const { data, error } = await supabase.rpc('update_user_feed_preferences', {
        p_user_id: params.user_id,
        p_prioritize_favorite_teams: params.prioritize_favorite_teams,
        p_prioritize_favorite_players: params.prioritize_favorite_players,
        p_show_low_fun_score_games: params.show_low_fun_score_games,
        p_min_fun_score_threshold: params.min_fun_score_threshold,
        p_show_highlights: params.show_highlights,
        p_show_buzzer_beaters: params.show_buzzer_beaters,
        p_show_close_games: params.show_close_games,
        p_show_high_scoring: params.show_high_scoring,
        p_show_overtime_games: params.show_overtime_games,
        p_show_playoff_games: params.show_playoff_games,
        p_show_rivalry_games: params.show_rivalry_games,
        p_days_back_to_show: params.days_back_to_show,
        p_default_feed_view: params.default_feed_view,
        p_games_per_page: params.games_per_page
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feed-preferences', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['complete-user-settings', variables.user_id] });
    }
  });
}

// =====================================================
// COMPLETE USER SETTINGS HOOKS
// =====================================================

/**
 * Get all user settings in one query
 */
export function useCompleteUserSettings(userId: string | undefined) {
  return useQuery({
    queryKey: ['complete-user-settings', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const { data, error } = await supabase
        .rpc('get_complete_user_settings', { p_user_id: userId });
      
      if (error) throw error;
      return data?.[0] as CompleteUserSettings | null;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

