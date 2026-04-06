import React, { createContext, useContext } from 'react'
import type { FeedDrawerTabId } from '../constants/feedDrawerTabs'

export type FeedDrawerTabContextValue = {
  feedDrawerTab: FeedDrawerTabId
  setFeedDrawerTab: (tab: FeedDrawerTabId) => void
}

const FeedDrawerTabContext = createContext<FeedDrawerTabContextValue | null>(null)

export function FeedDrawerTabProvider({
  value,
  children,
}: {
  value: FeedDrawerTabContextValue
  children: React.ReactNode
}) {
  return <FeedDrawerTabContext.Provider value={value}>{children}</FeedDrawerTabContext.Provider>
}

export function useFeedDrawerTabOptional(): FeedDrawerTabContextValue | null {
  return useContext(FeedDrawerTabContext)
}

export function useFeedDrawerTab(): FeedDrawerTabContextValue {
  const ctx = useContext(FeedDrawerTabContext)
  if (!ctx) throw new Error('useFeedDrawerTab must be used within FeedDrawerTabProvider')
  return ctx
}

