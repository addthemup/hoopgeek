# Zustand State Management

This directory contains Zustand stores for managing client-side state in the fantasy draft application.

## Stores Overview

### 1. `draftStore.ts` - Draft State Management
Manages all draft-related state including picks, timer, and UI state.

**Key Features:**
- Current pick tracking
- Countdown timer management
- Draft picks array
- Chat messages
- Trade modal state
- Auto-scrolling preferences

**Usage:**
```typescript
import { useDraftStore, useCurrentPick, useTimeRemaining } from '../stores/draftStore'

// Get current pick
const currentPick = useCurrentPick()

// Get time remaining
const timeRemaining = useTimeRemaining()

// Update picks
const setPicks = useDraftStore(state => state.setPicks)
setPicks(newPicks)
```

### 2. `userStore.ts` - User Preferences
Manages user preferences and settings with persistence.

**Key Features:**
- Theme preferences (light/dark/auto)
- UI preferences (sidebar, images, etc.)
- Draft preferences (auto-scroll, sounds, etc.)
- Chat preferences
- Notification settings

**Usage:**
```typescript
import { useUser, usePreferences, useTheme } from '../stores/userStore'

// Get user info
const { id, name, isCommissioner } = useUser()

// Get preferences
const preferences = usePreferences()

// Update preferences
const updatePreferences = useUserStore(state => state.updatePreferences)
updatePreferences({ theme: 'dark' })
```

### 3. `realtimeStore.ts` - WebSocket Management
Manages real-time connections and event handlers.

**Key Features:**
- Connection status tracking
- Reconnection logic
- Event handler management
- Connection attempts tracking

**Usage:**
```typescript
import { useRealtimeStore, useConnectionStatus } from '../stores/realtimeStore'

// Get connection status
const { isConnected, isConnecting } = useConnectionStatus()

// Connect to realtime
const connect = useRealtimeStore(state => state.connect)
connect()
```

## Integration Hooks

### `useDraftIntegration.ts`
Custom hooks that integrate TanStack Query with Zustand:

- `useDraftIntegration(leagueId)` - Syncs server state with client state
- `useDraftTimerIntegration()` - Manages draft timer with formatting
- `useDraftPicksIntegration()` - Manages draft picks with helper functions

**Usage:**
```typescript
import { useDraftIntegration, useDraftTimerIntegration } from '../hooks/useDraftIntegration'

// In your component
function DraftComponent({ leagueId }) {
  const { isLoading, draftOrder, draftState } = useDraftIntegration(leagueId)
  const { timeRemaining, formattedTime, isActive } = useDraftTimerIntegration()
  
  // Component logic...
}
```

## Best Practices

### 1. Use Selectors
Always use selectors to avoid unnecessary re-renders:

```typescript
// ✅ Good - only re-renders when timeRemaining changes
const timeRemaining = useDraftStore(state => state.timeRemaining)

// ❌ Bad - re-renders on any state change
const { timeRemaining } = useDraftStore()
```

### 2. Use Integration Hooks
Use the integration hooks instead of directly accessing stores:

```typescript
// ✅ Good - handles server/client sync
const { timeRemaining, formattedTime } = useDraftTimerIntegration()

// ❌ Bad - manual state management
const timeRemaining = useDraftStore(state => state.timeRemaining)
// Manual formatting and sync logic...
```

### 3. Persist User Preferences
User preferences are automatically persisted to localStorage:

```typescript
// Preferences are automatically saved
const updatePreferences = useUserStore(state => state.updatePreferences)
updatePreferences({ theme: 'dark' }) // Saved to localStorage
```

### 4. Handle Loading States
Always handle loading states when integrating with TanStack Query:

```typescript
const { isLoading, draftOrder } = useDraftIntegration(leagueId)

if (isLoading) {
  return <LoadingSpinner />
}
```

## Migration from Local State

When migrating components from local state to Zustand:

1. **Replace useState with useDraftStore selectors**
2. **Use integration hooks for complex logic**
3. **Remove manual state synchronization**
4. **Use selectors to prevent unnecessary re-renders**

### Example Migration:

```typescript
// Before (local state)
const [countdown, setCountdown] = useState(0)
const [currentPick, setCurrentPick] = useState(null)

// After (Zustand)
const { timeRemaining, currentPick } = useDraftTimerIntegration()
```

## Debugging

Enable Redux DevTools for debugging:

```typescript
// Stores are configured with devtools
// Open Redux DevTools in browser to inspect state
```

## Performance

- Zustand is lightweight and performant
- Selectors prevent unnecessary re-renders
- Persistence is handled efficiently
- Real-time updates are optimized
