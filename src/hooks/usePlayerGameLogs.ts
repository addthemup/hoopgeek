import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface PlayerGameLog {
  id: string;
  player_id: number;
  nba_player_id: number;
  game_id: string;
  game_date: string;
  player_name: string;
  team_abbreviation: string;
  matchup: string;
  wl: string;
  min: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pts: number;
  plus_minus: number;
  jersey_num: number;
  position: string;
  team_city: string;
  team_tricode: string;
  team_name: string;
  created_at: string;
  updated_at: string;
}

interface UsePlayerGameLogsParams {
  playerIds?: number[];
  gameIds?: string[];
  gameDate?: string;
  seasonYear?: string;
}

export function usePlayerGameLogs(params: UsePlayerGameLogsParams = {}) {
  return useQuery({
    queryKey: ['playerGameLogs', params],
    queryFn: async (): Promise<PlayerGameLog[]> => {
      let query = supabase
        .from('player_game_logs')
        .select('*')
        .order('game_date', { ascending: true });

      if (params.playerIds && params.playerIds.length > 0) {
        query = query.in('nba_player_id', params.playerIds);
      }

      if (params.gameIds && params.gameIds.length > 0) {
        query = query.in('game_id', params.gameIds);
      }

      if (params.gameDate) {
        query = query.eq('game_date', params.gameDate);
      }

      if (params.seasonYear) {
        query = query.eq('season_year', params.seasonYear);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching player game logs:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!(params.playerIds?.length || params.gameIds?.length || params.gameDate || params.seasonYear),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get player stats for specific games
export function usePlayerStatsForGames(gameIds: string[]) {
  return useQuery({
    queryKey: ['playerStatsForGames', gameIds],
    queryFn: async (): Promise<Record<string, PlayerGameLog[]>> => {
      if (gameIds.length === 0) return {};

      const { data, error } = await supabase
        .from('player_game_logs')
        .select('*')
        .in('game_id', gameIds)
        .order('game_date', { ascending: true });

      if (error) {
        console.error('Error fetching player stats for games:', error);
        throw error;
      }

      // Group by game_id
      const statsByGame: Record<string, PlayerGameLog[]> = {};
      (data || []).forEach(log => {
        if (!statsByGame[log.game_id]) {
          statsByGame[log.game_id] = [];
        }
        statsByGame[log.game_id].push(log);
      });

      return statsByGame;
    },
    enabled: gameIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to get player stats for a specific player across multiple games
export function usePlayerStatsForPlayer(playerId: number, gameIds: string[]) {
  return useQuery({
    queryKey: ['playerStatsForPlayer', playerId, gameIds],
    queryFn: async (): Promise<Record<string, PlayerGameLog>> => {
      if (gameIds.length === 0) return {};

      const { data, error } = await supabase
        .from('player_game_logs')
        .select('*')
        .eq('nba_player_id', playerId)
        .in('game_id', gameIds)
        .order('game_date', { ascending: true });

      if (error) {
        console.error('Error fetching player stats for player:', error);
        throw error;
      }

      // Create a map of game_id to player stats
      const statsByGame: Record<string, PlayerGameLog> = {};
      (data || []).forEach(log => {
        statsByGame[log.game_id] = log;
      });

      return statsByGame;
    },
    enabled: gameIds.length > 0 && !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
