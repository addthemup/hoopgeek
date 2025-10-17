import { useEffect } from 'react'
import { useDraftStore, useDraftTimer, useCurrentPick } from '../stores/draftStore'
import { useDraftOrder } from './useDraftOrder'
import { useDraftState } from './useDraftState'

/**
 * Custom hook that integrates TanStack Query with Zustand for draft state
 * This hook syncs server state (TanStack Query) with client state (Zustand)
 */
export function useDraftIntegration(leagueId: string) {
  const { data: draftOrder, isLoading: orderLoading } = useDraftOrder(leagueId)
  const { data: draftState, isLoading: stateLoading } = useDraftState(leagueId)
  
  // Zustand state
  const setPicks = useDraftStore(state => state.setPicks)
  const setCurrentPick = useDraftStore(state => state.setCurrentPick)
  const setDraftStarted = useDraftStore(state => state.setDraftStarted)
  const setDraftPaused = useDraftStore(state => state.setDraftPaused)
  const setTimeRemaining = useDraftStore(state => state.setTimeRemaining)
  
  // Sync draft order with Zustand
  useEffect(() => {
    if (draftOrder) {
      const picks = draftOrder.map(pick => ({
        id: pick.id,
        pickNumber: pick.pick_number,
        round: pick.round,
        teamId: pick.team_id,
        teamName: pick.team_name,
        playerId: pick.nba_player_id,
        playerName: pick.player_name,
        isCompleted: pick.is_completed,
        timeExpires: pick.time_expires,
        autodraftEnabled: pick.autodraft_enabled || false,
      }))
      
      setPicks(picks)
    }
  }, [draftOrder, setPicks])
  
  // Sync draft state with Zustand
  useEffect(() => {
    if (draftState) {
      setDraftStarted(draftState.draft_status === 'in_progress')
      setDraftPaused(draftState.draft_status === 'paused')
      
      if (draftState.current_pick_number) {
        setCurrentPick(draftState.current_pick_number)
      }
    }
  }, [draftState, setDraftStarted, setDraftPaused, setCurrentPick])
  
  // Calculate and sync time remaining
  useEffect(() => {
    if (!draftOrder || !draftState) return
    
    const currentPick = draftOrder.find(pick => pick.pick_number === draftState.current_pick_number)
    if (!currentPick?.time_expires) {
      setTimeRemaining(0)
      return
    }
    
    const calculateTimeRemaining = () => {
      const expiresAt = new Date(currentPick.time_expires).getTime()
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      setTimeRemaining(remaining)
    }
    
    // Calculate immediately
    calculateTimeRemaining()
    
    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000)
    
    return () => clearInterval(interval)
  }, [draftOrder, draftState, setTimeRemaining])
  
  return {
    isLoading: orderLoading || stateLoading,
    draftOrder,
    draftState,
  }
}

/**
 * Hook for managing draft timer with Zustand
 */
export function useDraftTimerIntegration() {
  const { timeRemaining, setTimeRemaining, isDraftStarted, isDraftPaused, isActive } = useDraftTimer()
  const currentPick = useCurrentPick()
  
  // Format time for display
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '0:00'
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
  
  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    isActive,
    isDraftStarted,
    isDraftPaused,
    currentPick,
    setTimeRemaining,
  }
}

/**
 * Hook for managing draft picks with Zustand
 */
export function useDraftPicksIntegration() {
  const picks = useDraftStore(state => state.picks)
  const currentPick = useCurrentPick()
  const currentPickNumber = useDraftStore(state => state.currentPickNumber)
  
  const getPickByNumber = (pickNumber: number) => {
    return picks.find(pick => pick.pickNumber === pickNumber)
  }
  
  const getCompletedPicks = () => {
    return picks.filter(pick => pick.isCompleted)
  }
  
  const getPendingPicks = () => {
    return picks.filter(pick => !pick.isCompleted)
  }
  
  const getUpcomingPicks = (count: number = 5) => {
    return picks
      .filter(pick => pick.pickNumber > currentPickNumber)
      .slice(0, count)
  }
  
  return {
    picks,
    currentPick,
    currentPickNumber,
    getPickByNumber,
    getCompletedPicks,
    getPendingPicks,
    getUpcomingPicks,
  }
}
