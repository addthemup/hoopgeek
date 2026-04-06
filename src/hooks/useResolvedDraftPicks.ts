import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useStandings } from './useStandings';
import { buildTankOrder } from '../utils/draftTankOrder';

export type ResolvedDraftPick = {
  pick_number: number;
  team_abbreviation: string;
  team_id?: number;
};

/**
 * Active locked admin draft order wins; otherwise first `maxPicks` teams from tank ordering (StandingsModule logic).
 */
export function useResolvedDraftPicks(draftYear: number | null, maxPicks = 30) {
  const { data: standings, isLoading: standingsLoading } = useStandings();

  const { data: lockedMeta, isLoading: lockedLoading } = useQuery({
    queryKey: ['draft-order-locked', draftYear],
    queryFn: async () => {
      if (!draftYear) return null;
      const { data, error } = await supabase
        .from('draft_orders')
        .select('id')
        .eq('draft_year', draftYear)
        .eq('is_active', true)
        .eq('is_locked', true)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
    enabled: !!draftYear,
  });

  const { data: lockedPicksRaw, isLoading: picksLoading } = useQuery({
    queryKey: ['draft-order-picks', lockedMeta?.id],
    queryFn: async () => {
      if (!lockedMeta?.id) return [];
      const { data, error } = await supabase
        .from('draft_order_picks')
        .select('pick_number, team_abbreviation')
        .eq('draft_order_id', lockedMeta.id)
        .order('pick_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as { pick_number: number; team_abbreviation: string }[];
    },
    enabled: !!lockedMeta?.id,
  });

  const resolved = useMemo(() => {
    if (!draftYear) {
      return {
        picks: [] as ResolvedDraftPick[],
        source: 'none' as const,
        draftOrderId: null as string | null,
      };
    }
    if (lockedMeta?.id && lockedPicksRaw && lockedPicksRaw.length > 0) {
      const picks: ResolvedDraftPick[] = lockedPicksRaw.map((r) => ({
        pick_number: r.pick_number,
        team_abbreviation: r.team_abbreviation,
      }));
      return { picks, source: 'admin' as const, draftOrderId: lockedMeta.id };
    }
    if (!standings) {
      return { picks: [] as ResolvedDraftPick[], source: 'tank' as const, draftOrderId: null };
    }
    const tank = buildTankOrder(standings.east, standings.west);
    const picks = tank.slice(0, maxPicks).map((t) => ({
      pick_number: t.pick,
      team_abbreviation: t.team_abbreviation,
      team_id: t.team_id,
    }));
    return { picks, source: 'tank' as const, draftOrderId: null };
  }, [draftYear, lockedMeta?.id, lockedPicksRaw, standings, maxPicks]);

  return {
    ...resolved,
    isLoading: standingsLoading || lockedLoading || picksLoading,
  };
}
