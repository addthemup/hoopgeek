/**
 * Context for the persistent feed shell (header + drawer).
 * Child routes (Highlights, PostStory) set props so the shell can render
 * filter chips, game header state, etc., without remounting when navigating.
 */

import React, { createContext, useContext, useState } from 'react'
import type { ActiveFilter } from '../types/feed'
import { getSiteDayEST } from '../utils/nbaDateUtils'

export type FeedLayoutState = {
  /** @deprecated Filters moved above feed; kept for compatibility */
  filterDrawerContent: React.ReactNode
  /** Row of filter icons above feed posts (Highlights). */
  feedTopBar: React.ReactNode
  activeFilters: ActiveFilter[]
  onAddFilter?: (filter: Omit<ActiveFilter, 'id'>) => void
  onRemoveFilter?: (id: string) => void
  onGameClick?: (game: { game_id: string; home_team_tricode: string; away_team_tricode: string }) => void
  hasGameHeader?: boolean
  /** When set (e.g. on /feed?game=), drawer shows filters + carousel + this game UI (render function to avoid re-render loops). */
  gameDrawerContentRenderer: (() => React.ReactNode) | null
}

const defaultState: FeedLayoutState = {
  filterDrawerContent: null,
  feedTopBar: null,
  activeFilters: [],
  hasGameHeader: false,
  gameDrawerContentRenderer: null,
}

const FeedLayoutContext = createContext<{
  state: FeedLayoutState
  setState: React.Dispatch<React.SetStateAction<FeedLayoutState>>
  siteDate: string
  setSiteDate: React.Dispatch<React.SetStateAction<string>>
}>({
  state: defaultState,
  setState: () => {},
  siteDate: getSiteDayEST(3),
  setSiteDate: () => {},
})

export function FeedLayoutProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FeedLayoutState>(defaultState)
  const [siteDate, setSiteDate] = useState<string>(getSiteDayEST(3))
  return (
    <FeedLayoutContext.Provider value={{ state, setState, siteDate, setSiteDate }}>
      {children}
    </FeedLayoutContext.Provider>
  )
}

export function useFeedLayout() {
  return useContext(FeedLayoutContext)
}

/** Call from Highlights to register filter drawer content and handlers so the shell can show them. */
export function useSetFeedLayoutProps(props: Partial<FeedLayoutState>) {
  const { setState } = useFeedLayout()
  const { filterDrawerContent, feedTopBar, activeFilters, onAddFilter, onRemoveFilter, onGameClick, hasGameHeader } = props
  React.useEffect(() => {
    setState((prev) => ({
      ...prev,
      filterDrawerContent,
      feedTopBar,
      activeFilters,
      onAddFilter,
      onRemoveFilter,
      onGameClick,
      hasGameHeader,
    }))
    return () => {
      setState((prev) => ({
        ...prev,
        filterDrawerContent: null,
        feedTopBar: null,
        activeFilters: [],
        hasGameHeader: false,
      }))
    }
  }, [setState, filterDrawerContent, feedTopBar, activeFilters, hasGameHeader, onAddFilter, onRemoveFilter, onGameClick])
}

/** Call from GamePageLayout when embedded in feed to inject game UI into the feed drawer (filters + carousel + game modules). Pass null to clear. */
export function useSetGameDrawerContent(renderContent: (() => React.ReactNode) | null) {
  const { setState } = useFeedLayout()
  React.useEffect(() => {
    // Game drawer is deprecated; keep this hook as a no-op for compatibility.
    setState((prev) => ({ ...prev, gameDrawerContentRenderer: null }))
    return undefined
  }, [setState, renderContent])
}
