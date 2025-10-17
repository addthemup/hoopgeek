import { useEffect, useState } from 'react';
import { useDraftState } from './useDraftState';
import { useDraftOrder } from './useDraftOrder';

interface DraftTimerState {
  timeRemaining: number;
  formattedTime: string;
  isActive: boolean;
  isDraftStarted: boolean;
  isDraftPaused: boolean;
  currentPickNumber: number | null;
}

/**
 * Hook for managing draft timer with real-time updates
 * Automatically calculates time remaining based on current pick's expiration time
 */
export function useDraftTimer(leagueId: string): DraftTimerState {
  const { data: draftState } = useDraftState(leagueId);
  const { data: draftOrder } = useDraftOrder(leagueId);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const isDraftStarted = draftState?.draft_status === 'in_progress';
  const isDraftPaused = draftState?.draft_status === 'paused';
  const currentPickNumber = draftState?.current_pick_number || null;

  // Calculate time remaining based on current pick
  useEffect(() => {
    console.log('🕐 useDraftTimer Debug:', {
      leagueId,
      draftOrder: draftOrder?.length || 0,
      draftState: draftState ? {
        draft_status: draftState.draft_status,
        current_pick_number: draftState.current_pick_number,
        current_pick_id: draftState.current_pick_id
      } : null,
      isDraftStarted,
      currentPickNumber
    });

    if (!draftOrder || !draftState || !isDraftStarted) {
      console.log('🕐 Timer not active - missing data or draft not started');
      setTimeRemaining(0);
      return;
    }

    const currentPick = draftOrder.find(pick => pick.pick_number === currentPickNumber);
    console.log('🕐 Current pick found:', currentPick ? {
      pick_number: currentPick.pick_number,
      time_expires: currentPick.time_expires,
      is_completed: currentPick.is_completed
    } : null);

    if (!currentPick?.time_expires) {
      console.log('🕐 No time_expires found for current pick');
      setTimeRemaining(0);
      return;
    }

    const calculateTimeRemaining = () => {
      const expiresAt = new Date(currentPick.time_expires).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeRemaining(remaining);
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [draftOrder, draftState, isDraftStarted, currentPickNumber]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    isActive: isDraftStarted && !isDraftPaused && timeRemaining > 0,
    isDraftStarted,
    isDraftPaused,
    currentPickNumber,
  };
}
