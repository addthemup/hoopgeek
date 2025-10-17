import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface RealtimeConnection {
  isConnected: boolean
  isConnecting: boolean
  lastConnected: Date | null
  connectionAttempts: number
  maxReconnectAttempts: number
  reconnectDelay: number
}

export interface RealtimeState {
  // Connection state
  connection: RealtimeConnection
  
  // Event handlers
  onDraftPick: ((pick: any) => void) | null
  onTradeOffer: ((trade: any) => void) | null
  onChatMessage: ((message: any) => void) | null
  onDraftStatusChange: ((status: any) => void) | null
  
  // Actions
  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void
  setLastConnected: (date: Date | null) => void
  incrementConnectionAttempts: () => void
  resetConnectionAttempts: () => void
  setEventHandlers: (handlers: {
    onDraftPick?: (pick: any) => void
    onTradeOffer?: (trade: any) => void
    onChatMessage?: (message: any) => void
    onDraftStatusChange?: (status: any) => void
  }) => void
  connect: () => void
  disconnect: () => void
  reconnect: () => void
}

// Initial connection state
const initialConnection: RealtimeConnection = {
  isConnected: false,
  isConnecting: false,
  lastConnected: null,
  connectionAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
}

// Create the store
export const useRealtimeStore = create<RealtimeState>()(
  devtools(
    (set, get) => ({
      connection: initialConnection,
      onDraftPick: null,
      onTradeOffer: null,
      onChatMessage: null,
      onDraftStatusChange: null,

      setConnected: (connected: boolean) => {
        set(state => ({
          connection: {
            ...state.connection,
            isConnected: connected,
            isConnecting: false,
            lastConnected: connected ? new Date() : state.connection.lastConnected,
          }
        }))
      },

      setConnecting: (connecting: boolean) => {
        set(state => ({
          connection: {
            ...state.connection,
            isConnecting: connecting,
          }
        }))
      },

      setLastConnected: (date: Date | null) => {
        set(state => ({
          connection: {
            ...state.connection,
            lastConnected: date,
          }
        }))
      },

      incrementConnectionAttempts: () => {
        set(state => ({
          connection: {
            ...state.connection,
            connectionAttempts: state.connection.connectionAttempts + 1,
          }
        }))
      },

      resetConnectionAttempts: () => {
        set(state => ({
          connection: {
            ...state.connection,
            connectionAttempts: 0,
          }
        }))
      },

      setEventHandlers: (handlers) => {
        set({
          onDraftPick: handlers.onDraftPick || null,
          onTradeOffer: handlers.onTradeOffer || null,
          onChatMessage: handlers.onChatMessage || null,
          onDraftStatusChange: handlers.onDraftStatusChange || null,
        })
      },

      connect: () => {
        const { connection } = get()
        if (connection.isConnected || connection.isConnecting) return

        set(state => ({
          connection: {
            ...state.connection,
            isConnecting: true,
          }
        }))

        // TODO: Implement actual WebSocket connection
        console.log('🔌 Connecting to realtime...')
        
        // Simulate connection
        setTimeout(() => {
          get().setConnected(true)
          get().resetConnectionAttempts()
        }, 1000)
      },

      disconnect: () => {
        set(state => ({
          connection: {
            ...state.connection,
            isConnected: false,
            isConnecting: false,
          }
        }))
        
        console.log('🔌 Disconnected from realtime')
      },

      reconnect: () => {
        const { connection } = get()
        
        if (connection.connectionAttempts >= connection.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached')
          return
        }

        get().incrementConnectionAttempts()
        get().disconnect()
        
        const delay = connection.reconnectDelay * Math.pow(2, connection.connectionAttempts - 1)
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${connection.connectionAttempts})`)
        
        setTimeout(() => {
          get().connect()
        }, delay)
      },
    }),
    {
      name: 'realtime-store',
    }
  )
)

// Selectors
export const useConnectionStatus = () => useRealtimeStore(state => ({
  isConnected: state.connection.isConnected,
  isConnecting: state.connection.isConnecting,
  lastConnected: state.connection.lastConnected,
  connectionAttempts: state.connection.connectionAttempts,
}))

export const useRealtimeHandlers = () => useRealtimeStore(state => ({
  onDraftPick: state.onDraftPick,
  onTradeOffer: state.onTradeOffer,
  onChatMessage: state.onChatMessage,
  onDraftStatusChange: state.onDraftStatusChange,
}))
