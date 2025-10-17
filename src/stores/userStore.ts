import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface UserPreferences {
  // UI Preferences
  theme: 'light' | 'dark' | 'auto'
  sidebarCollapsed: boolean
  showPlayerImages: boolean
  showSalaryInfo: boolean
  showProjections: boolean
  
  // Draft Preferences
  autoScrollToCurrentPick: boolean
  showTradeNotifications: boolean
  playSoundOnPick: boolean
  playSoundOnTrade: boolean
  
  // Chat Preferences
  chatFontSize: 'small' | 'medium' | 'large'
  showTimestamps: boolean
  showTeamColors: boolean
  
  // Notifications
  enableNotifications: boolean
  notifyOnTradeOffers: boolean
  notifyOnPickAnnouncements: boolean
  notifyOnDraftStart: boolean
}

export interface UserState {
  // User info
  userId: string | null
  userName: string | null
  userEmail: string | null
  isCommissioner: boolean
  currentLeagueId: string | null
  
  // Preferences
  preferences: UserPreferences
  
  // Actions
  setUser: (user: { id: string; name: string; email: string }) => void
  setCommissioner: (isCommissioner: boolean) => void
  setCurrentLeague: (leagueId: string | null) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  resetPreferences: () => void
  logout: () => void
}

// Default preferences
const defaultPreferences: UserPreferences = {
  theme: 'auto',
  sidebarCollapsed: false,
  showPlayerImages: true,
  showSalaryInfo: true,
  showProjections: true,
  autoScrollToCurrentPick: true,
  showTradeNotifications: true,
  playSoundOnPick: true,
  playSoundOnTrade: false,
  chatFontSize: 'medium',
  showTimestamps: true,
  showTeamColors: true,
  enableNotifications: true,
  notifyOnTradeOffers: true,
  notifyOnPickAnnouncements: true,
  notifyOnDraftStart: true,
}

// Initial state
const initialState = {
  userId: null,
  userName: null,
  userEmail: null,
  isCommissioner: false,
  currentLeagueId: null,
  preferences: defaultPreferences,
}

// Create the store
export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setUser: (user) => {
          set({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
          })
        },

        setCommissioner: (isCommissioner) => {
          set({ isCommissioner })
        },

        setCurrentLeague: (leagueId) => {
          set({ currentLeagueId: leagueId })
        },

        updatePreferences: (newPreferences) => {
          const { preferences } = get()
          set({
            preferences: { ...preferences, ...newPreferences }
          })
        },

        resetPreferences: () => {
          set({ preferences: defaultPreferences })
        },

        logout: () => {
          set(initialState)
        },
      }),
      {
        name: 'user-store',
        partialize: (state) => ({
          preferences: state.preferences,
          currentLeagueId: state.currentLeagueId,
        }),
      }
    ),
    {
      name: 'user-store',
    }
  )
)

// Selectors
export const useUser = () => useUserStore(state => ({
  id: state.userId,
  name: state.userName,
  email: state.userEmail,
  isCommissioner: state.isCommissioner,
  currentLeagueId: state.currentLeagueId,
}))

export const usePreferences = () => useUserStore(state => state.preferences)
export const useTheme = () => useUserStore(state => state.preferences.theme)
export const useIsCommissioner = () => useUserStore(state => state.isCommissioner)
