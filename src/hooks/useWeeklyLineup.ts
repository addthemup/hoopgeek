import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface Player {
  id: string;
  name: string;
  team: string;
  pos: string;
  status: string;
  game: string;
  gameTime: string;
  projPts: number;
  actualPts: number;
  startPct: number;
  rosPct: number;
  matchupRating: string;
  avatar: string;
  nba_player_id: number;
}

interface LineupPosition {
  id: string;
  position: string;
  player: Player | null;
  x: number;
  y: number;
  isStarter: boolean;
}

interface WeeklyLineup {
  starters: LineupPosition[];
  bench: LineupPosition[];
  isLocked: boolean;
  lockedAt?: string;
}

export function useWeeklyLineup(teamId: string, weekNumber: number, seasonYear: number) {
  const queryClient = useQueryClient();

  const { data: lineup, isLoading, error } = useQuery({
    queryKey: ['weekly-lineup', teamId, weekNumber, seasonYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_weekly_lineup', {
        team_id_param: teamId,
        week_num: weekNumber,
        season_year_param: seasonYear
      });

      if (error) {
        throw error;
      }

      return data as WeeklyLineup | null;
    },
    enabled: !!teamId && !!weekNumber && !!seasonYear,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const saveLineupMutation = useMutation({
    mutationFn: async (lineupData: WeeklyLineup) => {
      const { data, error } = await supabase.rpc('save_weekly_lineup', {
        team_id_param: teamId,
        week_num: weekNumber,
        season_year_param: seasonYear,
        lineup_data_param: lineupData
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch lineup data
      queryClient.invalidateQueries({ 
        queryKey: ['weekly-lineup', teamId, weekNumber, seasonYear] 
      });
    },
  });

  const lockLineupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('weekly_lineups')
        .update({ 
          is_locked: true, 
          locked_at: new Date().toISOString() 
        })
        .eq('fantasy_team_id', teamId)
        .eq('week_number', weekNumber)
        .eq('season_year', seasonYear);

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['weekly-lineup', teamId, weekNumber, seasonYear] 
      });
    },
  });

  const unlockLineupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('weekly_lineups')
        .update({ 
          is_locked: false, 
          locked_at: null 
        })
        .eq('fantasy_team_id', teamId)
        .eq('week_number', weekNumber)
        .eq('season_year', seasonYear);

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['weekly-lineup', teamId, weekNumber, seasonYear] 
      });
    },
  });

  return {
    lineup,
    isLoading,
    error,
    saveLineup: saveLineupMutation.mutateAsync,
    isSaving: saveLineupMutation.isPending,
    lockLineup: lockLineupMutation.mutateAsync,
    isLocking: lockLineupMutation.isPending,
    unlockLineup: unlockLineupMutation.mutateAsync,
    isUnlocking: unlockLineupMutation.isPending,
  };
}
