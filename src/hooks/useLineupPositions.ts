import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface LineupPosition {
  id: string;
  player_id: string;
  lineup_type: 'starters' | 'rotation' | 'bench';
  position_x: number;
  position_y: number;
  player_name: string;
  player_team: string;
  player_position: string;
  player_avatar: string;
  nba_player_id: number;
}

interface UseLineupPositionsParams {
  leagueId: string;
  teamId: string;
  lineupType?: 'starters' | 'rotation' | 'bench';
}

export function useLineupPositions({ leagueId, teamId, lineupType }: UseLineupPositionsParams) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lineup-positions', leagueId, teamId, lineupType],
    queryFn: async (): Promise<LineupPosition[]> => {
      console.log('🔍 Calling get_lineup_positions with:', {
        p_league_id: leagueId,
        p_fantasy_team_id: teamId,
        p_lineup_type: lineupType || null
      });
      
      const { data, error } = await supabase.rpc('get_lineup_positions', {
        p_league_id: leagueId,
        p_fantasy_team_id: teamId,
        p_lineup_type: lineupType || null
      });

      if (error) {
        console.error('❌ Error calling get_lineup_positions:', error);
        throw error;
      }
      
      console.log('✅ get_lineup_positions success:', data);
      return data || [];
    },
    enabled: !!leagueId && !!teamId,
  });

  const upsertPosition = useMutation({
    mutationFn: async ({ 
      playerId, 
      x, 
      y, 
      lineupType: type 
    }: { 
      playerId: string; 
      x: number; 
      y: number; 
      lineupType: 'starters' | 'rotation' | 'bench';
    }) => {
      console.log('🔍 Calling upsert_lineup_position with:', {
        p_league_id: leagueId,
        p_fantasy_team_id: teamId,
        p_player_id: playerId,
        p_lineup_type: type,
        p_position_x: x,
        p_position_y: y
      });
      
      const { data, error } = await supabase.rpc('upsert_lineup_position', {
        p_league_id: leagueId,
        p_fantasy_team_id: teamId,
        p_player_id: playerId,
        p_lineup_type: type,
        p_position_x: x,
        p_position_y: y
      });

      if (error) {
        console.error('❌ Error calling upsert_lineup_position:', error);
        throw error;
      }
      
      console.log('✅ upsert_lineup_position success:', data);
      return data;
    },
    onSuccess: () => {
      // Invalidate all lineup position queries for this team
      queryClient.invalidateQueries({ 
        queryKey: ['lineup-positions', leagueId, teamId] 
      });
    },
  });

  const removePosition = useMutation({
    mutationFn: async ({ 
      playerId, 
      lineupType: type 
    }: { 
      playerId: string; 
      lineupType: 'starters' | 'rotation' | 'bench';
    }) => {
      const { data, error } = await supabase.rpc('remove_lineup_position', {
        p_league_id: leagueId,
        p_fantasy_team_id: teamId,
        p_player_id: playerId,
        p_lineup_type: type
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all lineup position queries for this team
      queryClient.invalidateQueries({ 
        queryKey: ['lineup-positions', leagueId, teamId] 
      });
    },
  });

  const clearLineup = useMutation({
    mutationFn: async (lineupType: 'starters' | 'rotation' | 'bench') => {
      const { data, error } = await supabase
        .from('lineup_positions')
        .delete()
        .eq('league_id', leagueId)
        .eq('fantasy_team_id', teamId)
        .eq('lineup_type', lineupType);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all lineup position queries for this team
      queryClient.invalidateQueries({ 
        queryKey: ['lineup-positions', leagueId, teamId] 
      });
    },
  });

  return {
    ...query,
    upsertPosition,
    removePosition,
    clearLineup,
  };
}
