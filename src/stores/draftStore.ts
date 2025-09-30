import { create } from 'zustand'
import { Player, DraftPick } from '../types'

interface DraftState {
  currentPick: number
  totalPicks: number
  draftOrder: string[]
  availablePlayers: Player[]
  draftPicks: DraftPick[]
  isDraftActive: boolean
  currentTeamId: string | null
  timeRemaining: number
  
  // Actions
  setCurrentPick: (pick: number) => void
  setDraftOrder: (order: string[]) => void
  setAvailablePlayers: (players: Player[]) => void
  addDraftPick: (pick: DraftPick) => void
  removePlayer: (playerId: string) => void
  setDraftActive: (active: boolean) => void
  setCurrentTeam: (teamId: string | null) => void
  setTimeRemaining: (time: number) => void
  autoPick: () => void
}

export const useDraftStore = create<DraftState>((set, get) => ({
  currentPick: 1,
  totalPicks: 0,
  draftOrder: [],
  availablePlayers: [],
  draftPicks: [],
  isDraftActive: false,
  currentTeamId: null,
  timeRemaining: 0,

  setCurrentPick: (pick) => set({ currentPick: pick }),
  setDraftOrder: (order) => set({ draftOrder: order, totalPicks: order.length }),
  setAvailablePlayers: (players) => set({ availablePlayers: players }),
  
  addDraftPick: (pick) => set((state) => ({
    draftPicks: [...state.draftPicks, pick],
    currentPick: state.currentPick + 1,
  })),
  
  removePlayer: (playerId) => set((state) => ({
    availablePlayers: state.availablePlayers.filter(p => p.id !== playerId)
  })),
  
  setDraftActive: (active) => set({ isDraftActive: active }),
  setCurrentTeam: (teamId) => set({ currentTeamId: teamId }),
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  
  autoPick: () => {
    const { availablePlayers, currentPick, draftOrder } = get()
    if (availablePlayers.length === 0) return
    
    // Simple auto-pick: select the first available player
    const selectedPlayer = availablePlayers[0]
    const currentTeamId = draftOrder[(currentPick - 1) % draftOrder.length]
    
    const newPick: DraftPick = {
      id: `pick-${currentPick}`,
      league_id: '', // Will be set by the component
      player_id: selectedPlayer.id,
      team_id: currentTeamId,
      pick_number: currentPick,
      created_at: new Date().toISOString(),
    }
    
    get().addDraftPick(newPick)
    get().removePlayer(selectedPlayer.id)
  },
}))
