import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'

// Types for draft state
export interface DraftPick {
  id: string
  pickNumber: number
  round: number
  teamId: string
  teamName: string
  playerId?: string
  playerName?: string
  isCompleted: boolean
  timeExpires?: string
  autodraftEnabled: boolean
}

export interface DraftState {
  // Current draft info
  currentPickNumber: number
  currentRound: number
  timeRemaining: number
  isDraftStarted: boolean
  isDraftPaused: boolean
  
  // Draft picks
  picks: DraftPick[]
  currentPick: DraftPick | null
  
  // UI state
  isConnected: boolean
  isAutoScrolling: boolean
  selectedPlayerId: string | null
  showTradeModal: boolean
  tradeModalPick: DraftPick | null
  
  // Chat state
  chatMessages: ChatMessage[]
  isChatOpen: boolean
  
  // Actions
  setCurrentPick: (pickNumber: number) => void
  setTimeRemaining: (time: number) => void
  setDraftStarted: (started: boolean) => void
  setDraftPaused: (paused: boolean) => void
  setPicks: (picks: DraftPick[]) => void
  updatePick: (pickNumber: number, updates: Partial<DraftPick>) => void
  setConnected: (connected: boolean) => void
  setAutoScrolling: (autoScrolling: boolean) => void
  setSelectedPlayer: (playerId: string | null) => void
  setShowTradeModal: (show: boolean, pick?: DraftPick | null) => void
  addChatMessage: (message: ChatMessage) => void
  setChatOpen: (open: boolean) => void
  resetDraft: () => void
}

export interface ChatMessage {
  id: string
  userId: string
  userName: string
  teamName: string
  message: string
  messageType: 'chat' | 'system' | 'pick_announcement' | 'trade_announcement'
  timestamp: string
  isCommissioner: boolean
}

// Initial state
const initialState = {
  currentPickNumber: 1,
  currentRound: 1,
  timeRemaining: 0,
  isDraftStarted: false,
  isDraftPaused: false,
  picks: [],
  currentPick: null,
  isConnected: false,
  isAutoScrolling: true,
  selectedPlayerId: null,
  showTradeModal: false,
  tradeModalPick: null,
  chatMessages: [],
  isChatOpen: false,
}

// Create the store
export const useDraftStore = create<DraftState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      // Actions
      setCurrentPick: (pickNumber: number) => {
        const { picks } = get()
        const currentPick = picks.find(pick => pick.pickNumber === pickNumber) || null
        const currentRound = Math.ceil(pickNumber / 10) // Assuming 10 teams
        
        set({ 
          currentPickNumber: pickNumber, 
          currentRound,
          currentPick 
        })
      },

      setTimeRemaining: (time: number) => {
        set({ timeRemaining: Math.max(0, time) })
      },

      setDraftStarted: (started: boolean) => {
        set({ isDraftStarted: started })
      },

      setDraftPaused: (paused: boolean) => {
        set({ isDraftPaused: paused })
      },

      setPicks: (picks: DraftPick[]) => {
        const { currentPickNumber } = get()
        const currentPick = picks.find(pick => pick.pickNumber === currentPickNumber) || null
        
        set({ picks, currentPick })
      },

      updatePick: (pickNumber: number, updates: Partial<DraftPick>) => {
        const { picks } = get()
        const updatedPicks = picks.map(pick => 
          pick.pickNumber === pickNumber 
            ? { ...pick, ...updates }
            : pick
        )
        
        const { currentPickNumber } = get()
        const currentPick = updatedPicks.find(pick => pick.pickNumber === currentPickNumber) || null
        
        set({ picks: updatedPicks, currentPick })
      },

      setConnected: (connected: boolean) => {
        set({ isConnected: connected })
      },

      setAutoScrolling: (autoScrolling: boolean) => {
        set({ isAutoScrolling: autoScrolling })
      },

      setSelectedPlayer: (playerId: string | null) => {
        set({ selectedPlayerId: playerId })
      },

      setShowTradeModal: (show: boolean, pick?: DraftPick | null) => {
        set({ 
          showTradeModal: show, 
          tradeModalPick: show ? pick || null : null 
        })
      },

      addChatMessage: (message: ChatMessage) => {
        const { chatMessages } = get()
        set({ chatMessages: [...chatMessages, message] })
      },

      setChatOpen: (open: boolean) => {
        set({ isChatOpen: open })
      },

      resetDraft: () => {
        set(initialState)
      },
    })),
    {
      name: 'draft-store',
    }
  )
)

// Selectors for common use cases
export const useCurrentPick = () => useDraftStore(state => state.currentPick)
export const useTimeRemaining = () => useDraftStore(state => state.timeRemaining)
export const useDraftStatus = () => useDraftStore(state => ({
  isStarted: state.isDraftStarted,
  isPaused: state.isDraftPaused,
  isConnected: state.isConnected
}))
export const useDraftPicks = () => useDraftStore(state => state.picks)
export const useChatMessages = () => useDraftStore(state => state.chatMessages)
export const useTradeModal = () => useDraftStore(state => ({
  show: state.showTradeModal,
  pick: state.tradeModalPick
}))

// Timer hook for countdown
export const useDraftTimer = () => {
  const timeRemaining = useDraftStore(state => state.timeRemaining)
  const setTimeRemaining = useDraftStore(state => state.setTimeRemaining)
  const isDraftStarted = useDraftStore(state => state.isDraftStarted)
  const isDraftPaused = useDraftStore(state => state.isDraftPaused)
  
  return {
    timeRemaining,
    setTimeRemaining,
    isDraftStarted,
    isDraftPaused,
    isActive: isDraftStarted && !isDraftPaused && timeRemaining > 0
  }
}