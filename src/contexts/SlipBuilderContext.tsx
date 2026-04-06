/**
 * Slip Builder: build a parlay from Prop Predictions rows. State in context + localStorage;
 * Save persists to user_slips + slip_legs. One leg per player (no duplicate players).
 * Today's slips only for tracking; slip builder is a "ghost" module unless building or has saved slips today.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabase';

const SLIP_STORAGE_KEY = 'hoopgeek_slip_builder';

export interface SlipLeg {
  id: string;
  player_name: string;
  nba_player_id: number | null;
  bet_type: string;
  line: number;
  side: 'over' | 'under';
  odds_american: string;
  odds_decimal: number;
  player_prop_id?: string;
  game_id?: string;
  game_date?: string;
}

export interface SlipState {
  legs: SlipLeg[];
  stake_cents: number;
}

function americanToDecimal(american: number): number {
  if (american >= 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

function parseAmerican(odds: string | number | undefined): number | null {
  if (odds == null) return null;
  const s = String(odds).replace(/[+\s]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function toUuidOrNull(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(raw) ? raw : null;
}

export function propToSlipLeg(prop: {
  id?: string;
  player_name?: string;
  nba_player_id?: number | null;
  bet_type?: string;
  line?: number;
  currentLine?: number;
  displaySide?: 'over' | 'under';
  over?: { american_odds?: string; price?: string };
  under?: { american_odds?: string; price?: string };
  displayOdds?: string;
  american_odds?: string;
  game_id?: string;
  game_date?: string;
}): SlipLeg | null {
  const lineRaw = prop.currentLine ?? prop.line;
  const line = typeof lineRaw === 'number' ? lineRaw : parseFloat(String(lineRaw ?? 0));
  if (!Number.isFinite(line)) return null;
  const side = prop.displaySide ?? (prop.over ? 'over' : 'under');
  const oddsStr =
    prop.displayOdds ??
    (side === 'over' ? prop.over?.american_odds ?? prop.over?.price : prop.under?.american_odds ?? prop.under?.price) ??
    prop.american_odds;
  const american = parseAmerican(oddsStr);
  const odds_decimal = american != null ? americanToDecimal(american) : 1;
  return {
    id: `leg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    player_name: prop.player_name ?? 'Unknown',
    nba_player_id: prop.nba_player_id ?? null,
    bet_type: prop.bet_type ?? '',
    line,
    side: side as 'over' | 'under',
    odds_american: oddsStr ?? '',
    odds_decimal,
    player_prop_id: prop.id,
    game_id: toUuidOrNull(prop.game_id),
    game_date: prop.game_date,
  };
}

export type SavedSlipsSort = 'recent' | 'stake' | 'payout';

/** Saved slip from DB (all history). */
export interface SavedSlip {
  id: string;
  stake_cents: number;
  total_odds_decimal: number;
  potential_payout_cents: number;
  status: string;
  game_date: string | null;
  created_at: string;
  share_token?: string;
  is_shared?: boolean;
  legs?: {
    player_name: string;
    bet_type: string;
    line: number;
    side: string;
    odds_american: string | null;
    nba_player_id: number | null;
    game_id: string | null;
  }[];
}

interface AddLegOptions {
  /** When true, do not run onLegAddedRef (e.g. feed navigates to Profile → Slip builder instead). */
  skipOnLegAddedCallback?: boolean;
}

interface SlipBuilderContextValue {
  legs: SlipLeg[];
  stake_cents: number;
  setStakeCents: (v: number) => void;
  addLeg: (leg: SlipLeg, options?: AddLegOptions) => { added: boolean; reason?: string };
  removeLeg: (id: string) => void;
  clearSlip: () => void;
  totalOddsDecimal: number;
  potentialPayoutCents: number;
  canAddPlayer: (nbaPlayerId: number | null) => boolean;
  savedSlips: SavedSlip[];
  savedSlipsLoading: boolean;
  savedSlipsSort: SavedSlipsSort;
  setSavedSlipsSort: (sort: SavedSlipsSort) => void;
  hasMoreSavedSlips: boolean;
  isFetchingMoreSavedSlips: boolean;
  fetchNextSavedSlips: () => void;
  refetchSavedSlips: () => void;
  /** True when slip builder should appear in drawer: current slip has legs or user has saved slips history. */
  showSlipBuilder: boolean;
}

const SlipBuilderContext = createContext<SlipBuilderContextValue | null>(null);

export function useSlipBuilder(): SlipBuilderContextValue {
  const ctx = useContext(SlipBuilderContext);
  if (!ctx) {
    return {
      legs: [],
      stake_cents: 0,
      setStakeCents: () => {},
      addLeg: () => ({ added: false, reason: 'Slip Builder not available' }),
      removeLeg: () => {},
      clearSlip: () => {},
      totalOddsDecimal: 1,
      potentialPayoutCents: 0,
      canAddPlayer: () => true,
      savedSlips: [],
      savedSlipsLoading: false,
      savedSlipsSort: 'recent',
      setSavedSlipsSort: () => {},
      hasMoreSavedSlips: false,
      isFetchingMoreSavedSlips: false,
      fetchNextSavedSlips: () => {},
      refetchSavedSlips: () => {},
      showSlipBuilder: false,
    };
  }
  return ctx;
}

function loadStored(): SlipState {
  try {
    const raw = localStorage.getItem(SLIP_STORAGE_KEY);
    if (!raw) return { legs: [], stake_cents: 0 };
    const parsed = JSON.parse(raw) as SlipState;
    const legs = Array.isArray(parsed.legs)
      ? parsed.legs.map((leg) => ({
          ...leg,
          game_id: toUuidOrNull((leg as any).game_id) ?? undefined,
        }))
      : [];
    const stake_cents = Number(parsed.stake_cents) || 0;
    return { legs, stake_cents };
  } catch {
    return { legs: [], stake_cents: 0 };
  }
}

function saveStored(state: SlipState) {
  try {
    localStorage.setItem(SLIP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Optional ref to call when a leg is successfully added (e.g. open drawer and scroll to slip builder). */
export function SlipBuilderProvider({
  children,
  onLegAddedRef,
}: {
  children: React.ReactNode;
  onLegAddedRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const [state, setState] = useState<SlipState>(loadStored);
  const { user } = useAuth();
  const [savedSlipsSort, setSavedSlipsSort] = useState<SavedSlipsSort>('recent');

  const SAVED_SLIPS_PAGE_SIZE = 20;

  const {
    data: savedSlipsPages,
    isLoading: savedSlipsLoading,
    isFetchingNextPage: isFetchingMoreSavedSlips,
    hasNextPage,
    fetchNextPage,
    refetch: refetchSavedSlipsQuery,
  } = useInfiniteQuery({
    queryKey: ['user-slips-history', user?.id, savedSlipsSort],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<{ rows: SavedSlip[]; nextOffset: number | null }> => {
      if (!user?.id) return { rows: [], nextOffset: null };
      const offset = Number(pageParam) || 0;

      let query = supabase
        .from('user_slips')
        .select('id, stake_cents, total_odds_decimal, potential_payout_cents, status, game_date, created_at, share_token, is_shared')
        .eq('user_id', user.id)
        .range(offset, offset + SAVED_SLIPS_PAGE_SIZE - 1);

      if (savedSlipsSort === 'stake') {
        query = query.order('stake_cents', { ascending: false }).order('created_at', { ascending: false });
      } else if (savedSlipsSort === 'payout') {
        query = query.order('potential_payout_cents', { ascending: false }).order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data: slips, error } = await query;
      if (error || !slips) return { rows: [], nextOffset: null };
      if (slips.length === 0) return { rows: [], nextOffset: null };

      const slipIds = slips.map((s: any) => s.id).filter(Boolean);
      let legsBySlipId = new Map<
        string,
        Array<{
          player_name: string;
          bet_type: string;
          line: number;
          side: string;
          odds_american: string | null;
          nba_player_id: number | null;
          game_id: string | null;
        }>
      >();
      if (slipIds.length > 0) {
        const { data: legsRows } = await supabase
          .from('slip_legs')
          .select('slip_id, display_order, player_name, bet_type, line, side, odds_american, nba_player_id, game_id')
          .in('slip_id', slipIds)
          .order('display_order');

        legsBySlipId = (legsRows || []).reduce((acc, row: any) => {
          const list = acc.get(row.slip_id) ?? [];
          list.push({
            player_name: row.player_name,
            bet_type: row.bet_type,
            line: row.line,
            side: row.side,
            odds_american: row.odds_american,
            nba_player_id: row.nba_player_id ?? null,
            game_id: row.game_id ?? null,
          });
          acc.set(row.slip_id, list);
          return acc;
        }, new Map<string, Array<{ player_name: string; bet_type: string; line: number; side: string; odds_american: string | null; nba_player_id: number | null; game_id: string | null }>>());
      }

      const rows = slips.map((s: any) => ({ ...s, legs: legsBySlipId.get(s.id) ?? [] })) as SavedSlip[];
      const nextOffset = rows.length < SAVED_SLIPS_PAGE_SIZE ? null : offset + SAVED_SLIPS_PAGE_SIZE;
      return { rows, nextOffset };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!user?.id,
  });

  const savedSlipsRows = useMemo(
    () => (savedSlipsPages?.pages ?? []).flatMap((page) => page.rows),
    [savedSlipsPages]
  );

  const showSlipBuilder = state.legs.length > 0 || savedSlipsRows.length > 0;

  useEffect(() => {
    saveStored(state);
  }, [state]);

  const removeLeg = useCallback((id: string) => {
    setState((prev) => ({ ...prev, legs: prev.legs.filter((l) => l.id !== id) }));
  }, []);

  const clearSlip = useCallback(() => {
    setState({ legs: [], stake_cents: 0 });
  }, []);

  const canAddPlayer = useCallback(
    (nbaPlayerId: number | null) => {
      return !state.legs.some((l) => l.nba_player_id != null && l.nba_player_id === nbaPlayerId);
    },
    [state.legs]
  );

  const totalOddsDecimal = useMemo(() => {
    if (state.legs.length === 0) return 1;
    return state.legs.reduce((acc, l) => acc * l.odds_decimal, 1);
  }, [state.legs]);

  const potentialPayoutCents = useMemo(() => {
    return Math.round(state.stake_cents * totalOddsDecimal);
  }, [state.stake_cents, totalOddsDecimal]);

  const value: SlipBuilderContextValue = useMemo(
    () => ({
      legs: state.legs,
      stake_cents: state.stake_cents,
      setStakeCents: (v: number) => setState((prev) => ({ ...prev, stake_cents: Math.max(0, Math.round(v)) })),
      addLeg: (leg: SlipLeg, options?: AddLegOptions) => {
        const hasPlayer = state.legs.some(
          (l) =>
            (l.nba_player_id != null && l.nba_player_id === leg.nba_player_id) ||
            (leg.nba_player_id == null && l.player_name === leg.player_name)
        );
        if (hasPlayer) return { added: false, reason: 'One prop per player' };
        const duplicate = state.legs.some(
          (l) =>
            l.nba_player_id === leg.nba_player_id && l.bet_type === leg.bet_type && l.line === leg.line && l.side === leg.side
        );
        if (duplicate) return { added: false, reason: 'Already in slip' };
        const sanitizedLeg: SlipLeg = {
          ...leg,
          game_id: toUuidOrNull(leg.game_id) ?? undefined,
        };
        setState((prev) => ({ ...prev, legs: [...prev.legs, sanitizedLeg] }));
        if (!options?.skipOnLegAddedCallback) {
          onLegAddedRef?.current?.();
        }
        return { added: true };
      },
      removeLeg,
      clearSlip,
      totalOddsDecimal,
      potentialPayoutCents,
      canAddPlayer,
      savedSlips: savedSlipsRows,
      savedSlipsLoading,
      savedSlipsSort,
      setSavedSlipsSort,
      hasMoreSavedSlips: !!hasNextPage,
      isFetchingMoreSavedSlips,
      fetchNextSavedSlips: () => {
        if (hasNextPage) {
          void fetchNextPage();
        }
      },
      refetchSavedSlips: () => {
        void refetchSavedSlipsQuery();
      },
      showSlipBuilder,
    }),
    [
      state.legs,
      state.stake_cents,
      removeLeg,
      clearSlip,
      totalOddsDecimal,
      potentialPayoutCents,
      canAddPlayer,
      savedSlipsRows,
      savedSlipsLoading,
      savedSlipsSort,
      hasNextPage,
      isFetchingMoreSavedSlips,
      fetchNextPage,
      refetchSavedSlipsQuery,
      showSlipBuilder,
    ]
  );

  return <SlipBuilderContext.Provider value={value}>{children}</SlipBuilderContext.Provider>;
}
