/**
 * Captures feed drawer + PropPredictionsModule UI so "add to slip" can jump to
 * Profile → Slip builder and Back restores the previous Props tab state (pagination, filters, etc.).
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { FeedDrawerTabId } from '../constants/feedDrawerTabs';

export type PropPredictionsMainTab = 'hit_rate' | 'team_confidence' | 'player_confidence';
export type PropPredictionsHotColdTab = 'hottest' | 'coldest';

/** Serializable UI slice from PropPredictionsModule (Today.tsx). */
export interface PropPredictionsUiState {
  mainTab: PropPredictionsMainTab;
  activeTab: PropPredictionsHotColdTab;
  propTypeFilter: string;
  hitRatePage: number;
  teamConfidencePage: number;
  playerConfidencePage: number;
}

export interface FeedDrawerRestoreSnapshot {
  feedDrawerTab: FeedDrawerTabId;
  drawerProfileMode: boolean;
  /** e.g. prop_predictions_over */
  moduleName: string;
  propUi: PropPredictionsUiState;
  dateString: string;
}

export interface PendingMessagePayload {
  text: string;
  preferredRecipientId?: string;
}

export interface FeedDrawerRestoreContextValue {
  restoreSnapshot: FeedDrawerRestoreSnapshot | null;
  /** One-shot: ProfileModulesTabs switches to this sub-tab then clears. */
  requestedProfileTab: string | null;
  /** Bumps when restoring from slip so PropPredictionsModule can apply pending UI. */
  restoreGeneration: number;
  pendingMessagePayload: PendingMessagePayload | null;
  goToProfileSlipBuilderAfterAdd: (snapshot: FeedDrawerRestoreSnapshot) => void;
  goToProfileMessages: (payload?: PendingMessagePayload) => void;
  goToMainDrawerProps: () => void;
  restoreFromSlipBuilder: () => void;
  /** Returns pending UI for a module once, then clears it. */
  takePendingPropUi: (moduleName: string) => PropPredictionsUiState | undefined;
  /** Call after applying requestedProfileTab (e.g. set active sub-tab to slip_builder). */
  clearRequestedProfileTab: () => void;
  takePendingMessagePayload: () => PendingMessagePayload | null;
}

const FeedDrawerRestoreContext = createContext<FeedDrawerRestoreContextValue | null>(null);

export function useFeedDrawerRestore(): FeedDrawerRestoreContextValue {
  const ctx = useContext(FeedDrawerRestoreContext);
  if (!ctx) {
    throw new Error('useFeedDrawerRestore must be used within FeedDrawerRestoreProvider');
  }
  return ctx;
}

/** Safe when PropPredictionsModule renders outside feed drawer (e.g. full page). */
export function useFeedDrawerRestoreOptional(): FeedDrawerRestoreContextValue | null {
  return useContext(FeedDrawerRestoreContext);
}

interface FeedDrawerRestoreProviderProps {
  children: React.ReactNode;
  setDrawerOpen: (open: boolean) => void;
  setDrawerProfileMode: (v: boolean) => void;
  setFeedDrawerTab: (tab: FeedDrawerTabId) => void;
}

export function FeedDrawerRestoreProvider({
  children,
  setDrawerOpen,
  setDrawerProfileMode,
  setFeedDrawerTab,
}: FeedDrawerRestoreProviderProps) {
  const [restoreSnapshot, setRestoreSnapshot] = useState<FeedDrawerRestoreSnapshot | null>(null);
  const [requestedProfileTab, setRequestedProfileTab] = useState<string | null>(null);
  const [restoreGeneration, setRestoreGeneration] = useState(0);
  const [pendingMessagePayload, setPendingMessagePayload] = useState<PendingMessagePayload | null>(null);
  /** Synchronous pending UI so takePendingPropUi can return in the same tick (safe for useEffect). */
  const pendingPropUiRef = useRef<Record<string, PropPredictionsUiState>>({});

  const takePendingPropUi = useCallback((moduleName: string): PropPredictionsUiState | undefined => {
    const ui = pendingPropUiRef.current[moduleName];
    if (!ui) return undefined;
    const next = { ...pendingPropUiRef.current };
    delete next[moduleName];
    pendingPropUiRef.current = next;
    return ui;
  }, []);

  const goToProfileSlipBuilderAfterAdd = useCallback(
    (snapshot: FeedDrawerRestoreSnapshot) => {
      setRestoreSnapshot(snapshot);
      setRequestedProfileTab('slip_builder');
      setDrawerOpen(true);
      setDrawerProfileMode(true);
      setFeedDrawerTab('home');
    },
    [setDrawerOpen, setDrawerProfileMode, setFeedDrawerTab]
  );

  const goToMainDrawerProps = useCallback(() => {
    setDrawerOpen(true);
    setDrawerProfileMode(false);
    setFeedDrawerTab('props');
  }, [setDrawerOpen, setDrawerProfileMode, setFeedDrawerTab]);

  const goToProfileMessages = useCallback(
    (payload?: PendingMessagePayload) => {
      if (payload) setPendingMessagePayload(payload);
      setRequestedProfileTab('messages');
      setDrawerOpen(true);
      setDrawerProfileMode(true);
      setFeedDrawerTab('home');
    },
    [setDrawerOpen, setDrawerProfileMode, setFeedDrawerTab]
  );

  const restoreFromSlipBuilder = useCallback(() => {
    const snap = restoreSnapshot;
    if (!snap) return;
    pendingPropUiRef.current = {
      ...pendingPropUiRef.current,
      [snap.moduleName]: snap.propUi,
    };
    setRestoreGeneration((g) => g + 1);
    setRestoreSnapshot(null);
    setRequestedProfileTab(null);
    setDrawerProfileMode(snap.drawerProfileMode);
    setFeedDrawerTab(snap.feedDrawerTab);
    setDrawerOpen(true);
  }, [restoreSnapshot, setDrawerOpen, setDrawerProfileMode, setFeedDrawerTab]);

  const clearRequestedProfileTab = useCallback(() => {
    setRequestedProfileTab(null);
  }, []);

  const takePendingMessagePayload = useCallback(() => {
    const next = pendingMessagePayload;
    setPendingMessagePayload(null);
    return next;
  }, [pendingMessagePayload]);

  const value = useMemo(
    () =>
      ({
        restoreSnapshot,
        requestedProfileTab,
        restoreGeneration,
        pendingMessagePayload,
        goToProfileSlipBuilderAfterAdd,
        goToProfileMessages,
        goToMainDrawerProps,
        restoreFromSlipBuilder,
        takePendingPropUi,
        clearRequestedProfileTab,
        takePendingMessagePayload,
      }) satisfies FeedDrawerRestoreContextValue,
    [
      restoreSnapshot,
      requestedProfileTab,
      restoreGeneration,
      pendingMessagePayload,
      goToProfileSlipBuilderAfterAdd,
      goToProfileMessages,
      goToMainDrawerProps,
      restoreFromSlipBuilder,
      takePendingPropUi,
      clearRequestedProfileTab,
      takePendingMessagePayload,
    ]
  );

  return <FeedDrawerRestoreContext.Provider value={value}>{children}</FeedDrawerRestoreContext.Provider>;
}
