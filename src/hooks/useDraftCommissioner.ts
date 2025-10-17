import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

interface DraftCommissionerState {
  isPaused: boolean;
  timePerPick: number;
  allowTrades: boolean;
  allowTimeExtensions: boolean;
  currentPickTimer: number | null;
}

export function useDraftCommissioner(leagueId: string) {
  const queryClient = useQueryClient();
  const [commissionerState, setCommissionerState] = useState<DraftCommissionerState>({
    isPaused: false,
    timePerPick: 60, // default 60 seconds
    allowTrades: true,
    allowTimeExtensions: true,
    currentPickTimer: null
  });

  // Get current draft state
  const { data: draftState } = useQuery({
    queryKey: ['draft-state', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_draft_current_state')
        .select('*')
        .eq('league_id', leagueId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!leagueId,
    refetchInterval: 2000,
  });

  // Get current pick details
  const { data: currentPick } = useQuery({
    queryKey: ['current-pick', leagueId],
    queryFn: async () => {
      if (!draftState?.current_pick_id) return null;
      
      const { data, error } = await supabase
        .from('fantasy_draft_order')
        .select(`
          *,
          fantasy_teams!inner(team_name, autodraft_enabled)
        `)
        .eq('id', draftState.current_pick_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!draftState?.current_pick_id,
    refetchInterval: 1000, // Update every second for timer
  });

  // Calculate remaining time for current pick
  useEffect(() => {
    if (currentPick?.time_expires && !commissionerState.isPaused) {
      const calculateRemaining = () => {
        const expiresAt = new Date(currentPick.time_expires).getTime();
        const now = Date.now();
        return Math.max(0, Math.floor((expiresAt - now) / 1000));
      };

      setCommissionerState(prev => ({
        ...prev,
        currentPickTimer: calculateRemaining()
      }));

      const interval = setInterval(() => {
        const remaining = calculateRemaining();
        setCommissionerState(prev => ({
          ...prev,
          currentPickTimer: remaining
        }));
        
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCommissionerState(prev => ({
        ...prev,
        currentPickTimer: null
      }));
    }
  }, [currentPick?.time_expires, commissionerState.isPaused]);

  // Pause/Resume draft
  const pauseDraft = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('fantasy_draft_current_state')
        .update({ 
          is_auto_pick_active: false,
          last_activity_at: new Date().toISOString()
        })
        .eq('league_id', leagueId);

      if (error) throw error;
    },
    onSuccess: () => {
      setCommissionerState(prev => ({ ...prev, isPaused: true }));
      queryClient.invalidateQueries({ queryKey: ['draft-state', leagueId] });
    }
  });

  const resumeDraft = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('fantasy_draft_current_state')
        .update({ 
          is_auto_pick_active: true,
          last_activity_at: new Date().toISOString()
        })
        .eq('league_id', leagueId);

      if (error) throw error;
    },
    onSuccess: () => {
      setCommissionerState(prev => ({ ...prev, isPaused: false }));
      queryClient.invalidateQueries({ queryKey: ['draft-state', leagueId] });
    }
  });

  // Update time per pick
  const updateTimePerPick = useMutation({
    mutationFn: async (newTime: number) => {
      const { error } = await supabase
        .from('fantasy_leagues')
        .update({ draft_time_per_pick: newTime })
        .eq('id', leagueId);

      if (error) throw error;
    },
    onSuccess: (_, newTime) => {
      setCommissionerState(prev => ({ ...prev, timePerPick: newTime }));
    }
  });

  // Extend current pick timer
  const extendPickTimer = useMutation({
    mutationFn: async (additionalSeconds: number) => {
      if (!currentPick) throw new Error('No current pick');
      
      const newExpiresAt = new Date(Date.now() + additionalSeconds * 1000);
      
      const { error } = await supabase
        .from('fantasy_draft_order')
        .update({ 
          time_expires: newExpiresAt.toISOString(),
          time_extensions_used: (currentPick.time_extensions_used || 0) + 1
        })
        .eq('id', currentPick.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-pick', leagueId] });
    }
  });

  // Skip current pick (force auto-pick)
  const skipCurrentPick = useMutation({
    mutationFn: async () => {
      if (!currentPick) throw new Error('No current pick');
      
      // Trigger the draft-manager to process this pick immediately
      const { error } = await supabase.functions.invoke('draft-manager', {
        body: { 
          trigger: 'manual_skip', 
          league_id: leagueId,
          pick_id: currentPick.id
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-state', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['current-pick', leagueId] });
    }
  });

  // Reverse last pick (undo)
  const reversePick = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('reverse_last_pick', {
        league_id_param: leagueId,
        commissioner_user_id: user.id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Pick reversed:', data);
      queryClient.invalidateQueries({ queryKey: ['draft-state', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['current-pick', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft-order', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['draft-picks', leagueId] });
    }
  });

  return {
    commissionerState,
    draftState,
    currentPick,
    pauseDraft,
    resumeDraft,
    updateTimePerPick,
    extendPickTimer,
    skipCurrentPick,
    reversePick,
    isCommissioner: true // You can add actual permission checking here
  };
}
