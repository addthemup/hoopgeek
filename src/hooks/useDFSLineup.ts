import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DFSLineupPosition {
  id: string;
  lineup_id: string;
  pool_id: string;
  player_id: string;
  unit: 'starters' | 'rotation' | 'bench';
  unit_position: number;
  unit_multiplier: number;
  player_name: string;
  player_team: string;
  player_salary: number;
}

export function useDFSLineup(poolId: string | undefined, userId: string | undefined, entryId?: string | undefined) {
  return useQuery<DFSLineupPosition[]>({
    queryKey: ['dfs-lineup', poolId, userId, entryId],
    queryFn: async () => {
      if (!poolId || !userId) return [];

      let entry;

      // If entryId is provided, fetch that specific entry
      if (entryId) {
        const { data, error: entryError } = await supabase
          .from('dfs_entries')
          .select('id')
          .eq('id', entryId)
          .eq('user_id', userId)
          .maybeSingle();

        if (entryError) throw entryError;
        entry = data;
      } else {
        // Otherwise, get or create an entry for this user/pool
        const { data, error: entryError } = await supabase
        .from('dfs_entries')
        .select('id')
        .eq('pool_id', poolId)
        .eq('user_id', userId)
        .maybeSingle();

      if (entryError) throw entryError;
        entry = data;
      }

      if (!entry) {
        // Get pool entry fee
        const { data: pool, error: poolError } = await supabase
          .from('dfs_pools')
          .select('entry_fee')
          .eq('id', poolId)
          .single();

        if (poolError) throw poolError;

        // Create a new entry
        const { data: newEntry, error: createError } = await supabase
          .from('dfs_entries')
          .insert({
            pool_id: poolId,
            user_id: userId,
            entry_fee_paid: pool.entry_fee || 0, // Use pool's entry fee
            total_salary: 0,
            projected_points: 0,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        if (!newEntry) return [];

        // No lineup positions yet for new entry
        return [];
      }

      // Get or create lineup for this entry
      const { data: lineup, error: lineupError } = await supabase
        .from('dfs_lineups')
        .select('id')
        .eq('entry_id', entry.id)
        .eq('pool_id', poolId)
        .maybeSingle();

      if (lineupError) throw lineupError;

      if (!lineup) {
        // No lineup yet, return empty
        return [];
      }

      // Get lineup positions
      const { data, error } = await supabase
        .from('dfs_lineup_positions')
        .select('*')
        .eq('lineup_id', lineup.id)
        .eq('pool_id', poolId);

      if (error) throw error;
      
      // Convert unit_position from 1-based (DB) to 0-based (UI)
      return (data || []).map(pos => ({
        ...pos,
        unit_position: pos.unit_position - 1
      }));
    },
    enabled: !!poolId && !!userId,
  });
}

export function useSetDFSLineupPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      poolId: string;
      userId: string;
      playerId: string;
      lineupUnit: 'starters' | 'rotation' | 'bench';
      unitPosition: number;
      multiplier: number;
    }) => {
      console.log('🏀 Adding player to lineup:', params);
      
      // Get or create entry
      console.log('1️⃣ Checking for existing entry...');
      const { data: entry, error: entryError } = await supabase
        .from('dfs_entries')
        .select('id')
        .eq('pool_id', params.poolId)
        .eq('user_id', params.userId)
        .maybeSingle();

      if (entryError) {
        console.error('❌ Entry error:', entryError);
        throw entryError;
      }

      let entryId = entry?.id;

      if (!entryId) {
        console.log('2️⃣ No entry found, creating new entry...');
        // Get pool entry fee
        const { data: pool, error: poolError } = await supabase
          .from('dfs_pools')
          .select('entry_fee')
          .eq('id', params.poolId)
          .single();

        if (poolError) {
          console.error('❌ Pool error:', poolError);
          throw poolError;
        }

        // Create a new entry
        const { data: newEntry, error: createError } = await supabase
          .from('dfs_entries')
          .insert({
            pool_id: params.poolId,
            user_id: params.userId,
            entry_fee_paid: pool.entry_fee || 0,
            total_salary: 0,
            projected_points: 0,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('❌ Create entry error:', createError);
          throw createError;
        }
        if (!newEntry) throw new Error('Failed to create entry');
        entryId = newEntry.id;
        console.log('✅ Entry created:', entryId);
      } else {
        console.log('✅ Entry exists:', entryId);
      }

      // Get or create lineup for this entry
      console.log('3️⃣ Checking for existing lineup...');
      const { data: lineup, error: lineupError } = await supabase
        .from('dfs_lineups')
        .select('id')
        .eq('entry_id', entryId)
        .eq('pool_id', params.poolId)
        .maybeSingle();

      if (lineupError) {
        console.error('❌ Lineup query error:', lineupError);
        throw lineupError;
      }

      let lineupId = lineup?.id;

      if (!lineupId) {
        console.log('4️⃣ No lineup found, creating new lineup...');
        // Create a new lineup
        const { data: newLineup, error: createLineupError } = await supabase
          .from('dfs_lineups')
          .insert({
            entry_id: entryId,
            pool_id: params.poolId,
            user_id: params.userId,
            total_salary: 0,
            is_complete: false,
            is_valid: false,
          })
          .select('id')
          .single();

        if (createLineupError) {
          console.error('❌ Create lineup error:', createLineupError);
          throw createLineupError;
        }
        if (!newLineup) throw new Error('Failed to create lineup');
        lineupId = newLineup.id;
        console.log('✅ Lineup created:', lineupId);
      } else {
        console.log('✅ Lineup exists:', lineupId);
      }

      // Get player details from dfs_player_salaries
      console.log('5️⃣ Fetching player details...');
      const { data: playerData, error: playerError } = await supabase
        .from('dfs_player_salaries')
        .select('nba_player_id, player_name, player_team, player_position, salary')
        .eq('pool_id', params.poolId)
        .eq('player_id', params.playerId)
        .single();

      if (playerError) {
        console.error('❌ Player data error:', playerError);
        throw playerError;
      }
      if (!playerData) throw new Error('Player not found in pool');
      console.log('✅ Player data:', playerData);

      // Upsert lineup position with all required fields
      console.log('6️⃣ Upserting lineup position...');
      const { data, error } = await supabase
        .from('dfs_lineup_positions')
        .upsert({
          lineup_id: lineupId,
          pool_id: params.poolId,
          player_id: params.playerId,
          nba_player_id: playerData.nba_player_id,
          unit: params.lineupUnit,
          unit_position: params.unitPosition + 1, // Convert 0-based to 1-based indexing
          player_name: playerData.player_name,
          player_team: playerData.player_team,
          player_position: playerData.player_position,
          player_salary: playerData.salary,
          unit_multiplier: params.multiplier,
        }, {
          onConflict: 'lineup_id,unit,unit_position',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Upsert error:', error);
        throw error;
      }
      console.log('✅ Player added to lineup successfully!', data);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dfs-lineup', variables.poolId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-lineup-salary', variables.poolId, variables.userId] });
    },
  });
}

export function useRemoveDFSLineupPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      poolId: string;
      userId: string;
      lineupUnit: 'starters' | 'rotation' | 'bench';
      unitPosition: number;
    }) => {
      // Get entry
      const { data: entry, error: entryError } = await supabase
        .from('dfs_entries')
        .select('id')
        .eq('pool_id', params.poolId)
        .eq('user_id', params.userId)
        .single();

      if (entryError) throw entryError;
      if (!entry) return;

      // Get lineup
      const { data: lineup, error: lineupError } = await supabase
        .from('dfs_lineups')
        .select('id')
        .eq('entry_id', entry.id)
        .eq('pool_id', params.poolId)
        .single();

      if (lineupError) throw lineupError;
      if (!lineup) return;

      // Delete lineup position
      const { error } = await supabase
        .from('dfs_lineup_positions')
        .delete()
        .eq('lineup_id', lineup.id)
        .eq('unit', params.lineupUnit)
        .eq('unit_position', params.unitPosition + 1); // Convert 0-based to 1-based indexing

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dfs-lineup', variables.poolId, variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['dfs-lineup-salary', variables.poolId, variables.userId] });
    },
  });
}

