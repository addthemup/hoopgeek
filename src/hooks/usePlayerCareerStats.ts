import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface CareerStats {
  id: number;
  player_id: number;
  nba_player_id: number;
  league_id?: number;
  team_id?: number;
  gp?: number; // Games played
  gs?: number; // Games started
  min_total?: number; // Total minutes
  fgm?: number; // Field goals made
  fga?: number; // Field goals attempted
  fg_pct?: number; // Field goal percentage
  fg3m?: number; // 3-pointers made
  fg3a?: number; // 3-pointers attempted
  fg3_pct?: number; // 3-point percentage
  ftm?: number; // Free throws made
  fta?: number; // Free throws attempted
  ft_pct?: number; // Free throw percentage
  oreb?: number; // Offensive rebounds
  dreb?: number; // Defensive rebounds
  reb?: number; // Total rebounds
  ast?: number; // Assists
  stl?: number; // Steals
  blk?: number; // Blocks
  tov?: number; // Turnovers
  pf?: number; // Personal fouls
  pts?: number; // Points
  fantasy_pts?: number; // Calculated fantasy points
  created_at: string;
  updated_at: string;
}

export interface SeasonStats {
  id: number;
  player_id: number;
  nba_player_id: number;
  season_id: string;
  league_id?: number;
  team_id?: number;
  team_abbreviation?: string;
  player_age?: number;
  gp?: number;
  gs?: number;
  min_total?: number;
  fgm?: number;
  fga?: number;
  fg_pct?: number;
  fg3m?: number;
  fg3a?: number;
  fg3_pct?: number;
  ftm?: number;
  fta?: number;
  ft_pct?: number;
  oreb?: number;
  dreb?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  tov?: number;
  pf?: number;
  pts?: number;
  fantasy_pts?: number;
  created_at: string;
  updated_at: string;
}

export interface SeasonRankings {
  id: number;
  player_id: number;
  nba_player_id: number;
  season_id: string;
  league_id?: number;
  team_id?: number;
  team_abbreviation?: string;
  player_age?: number;
  gp?: number;
  gs?: number;
  min_total?: number;
  fgm?: number;
  fga?: number;
  fg_pct?: number;
  fg3m?: number;
  fg3a?: number;
  fg3_pct?: number;
  ftm?: number;
  fta?: number;
  ft_pct?: number;
  oreb?: number;
  dreb?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  tov?: number;
  pf?: number;
  pts?: number;
  fantasy_pts?: number;
  created_at: string;
  updated_at: string;
}

export function usePlayerCareerStats(playerId: string) {
  return useQuery({
    queryKey: ['player-career-stats', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_career_totals_regular_season')
        .select('*')
        .eq('player_id', playerId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully

      if (error) {
        console.error('Error fetching career stats:', error);
        throw new Error(`Failed to fetch career stats: ${error.message}`);
      }

      return data as CareerStats | null;
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function usePlayerSeasonStats(playerId: string) {
  return useQuery({
    queryKey: ['player-season-stats', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_season_totals_regular_season')
        .select('*')
        .eq('player_id', playerId)
        .order('season_id', { ascending: false });

      if (error) {
        console.error('Error fetching season stats:', error);
        throw new Error(`Failed to fetch season stats: ${error.message}`);
      }

      return (data || []) as SeasonStats[];
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function usePlayerSeasonRankings(playerId: string) {
  return useQuery({
    queryKey: ['player-season-rankings', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_season_rankings_regular_season')
        .select('*')
        .eq('player_id', playerId)
        .order('season_id', { ascending: false });

      if (error) {
        console.error('Error fetching season rankings:', error);
        throw new Error(`Failed to fetch season rankings: ${error.message}`);
      }

      return (data || []) as SeasonRankings[];
    },
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
