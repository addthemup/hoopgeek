/**
 * Admin: mock draft order (tank seed / manual reorder / lock) + post-draft results + score recompute.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Table,
  Input,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Option,
  Select,
} from '@mui/joy';
import { Save, Refresh, DragIndicator } from '@mui/icons-material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../utils/supabase';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useStandings } from '../hooks/useStandings';
import { buildTankOrder } from '../utils/draftTankOrder';
import { recomputeMockDraftScoresForYear } from '../utils/mockDraftScoring';
import { CONTENT_MAX_WIDTH } from '../constants/layout';

interface DraftOrderRow {
  id: string;
  draft_year: number;
  label: string | null;
  is_locked: boolean;
  is_active: boolean;
  source: string;
}

interface PickRow {
  pick_number: number;
  team_abbreviation: string;
}

interface OrderRow {
  id: string;
  team_abbreviation: string;
}

const DEFAULT_YEAR = 2026;
const NUM_PICKS = 30;

function rowsFromPicks(picks: PickRow[]): OrderRow[] {
  const sorted = [...picks].sort((a, b) => a.pick_number - b.pick_number);
  return sorted.map((p) => ({ id: `p-${p.pick_number}`, team_abbreviation: p.team_abbreviation }));
}

export default function AdminMockDraft() {
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [adminTab, setAdminTab] = useState(0);
  const { data: standings } = useStandings();

  const { data: activeOrder, isLoading: orderLoading, error: orderError } = useQuery({
    queryKey: ['admin-draft-order', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_orders')
        .select('*')
        .eq('draft_year', year)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DraftOrderRow | null;
    },
    enabled: isAdmin === true,
  });

  const { data: orderPicks = [], isLoading: picksLoading } = useQuery({
    queryKey: ['admin-draft-order-picks', activeOrder?.id],
    queryFn: async () => {
      if (!activeOrder?.id) return [];
      const { data, error } = await supabase
        .from('draft_order_picks')
        .select('pick_number, team_abbreviation')
        .eq('draft_order_id', activeOrder.id)
        .order('pick_number', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PickRow[];
    },
    enabled: !!activeOrder?.id,
  });

  const [orderRows, setOrderRows] = useState<OrderRow[]>([]);

  useEffect(() => {
    if (!orderPicks.length) {
      setOrderRows([]);
      return;
    }
    setOrderRows(rowsFromPicks(orderPicks));
  }, [orderPicks]);

  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!standings) throw new Error('No standings');
      const tank = buildTankOrder(standings.east, standings.west).slice(0, NUM_PICKS);
      await supabase.from('draft_orders').update({ is_active: false }).eq('draft_year', year).eq('is_active', true);

      const { data: newOrder, error: oErr } = await supabase
        .from('draft_orders')
        .insert({
          draft_year: year,
          label: 'Seeded from tank',
          is_locked: false,
          is_active: true,
          source: 'admin',
        })
        .select('id')
        .single();
      if (oErr) throw oErr;

      const rows = tank.map((t) => ({
        draft_order_id: newOrder.id,
        pick_number: t.pick,
        team_abbreviation: t.team_abbreviation,
        round: 1,
      }));

      const { error: pErr } = await supabase.from('draft_order_picks').insert(rows);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-draft-order', year] });
      queryClient.invalidateQueries({ queryKey: ['draft-order-locked'] });
    },
  });

  const savePicksMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrder?.id) throw new Error('No active order');
      const reordered = orderRows.map((r, idx) => ({
        pick_number: idx + 1,
        team_abbreviation: r.team_abbreviation || '???',
      }));

      await supabase.from('draft_order_picks').delete().eq('draft_order_id', activeOrder.id);

      const { error } = await supabase.from('draft_order_picks').insert(
        reordered.map((r) => ({
          draft_order_id: activeOrder.id,
          pick_number: r.pick_number,
          team_abbreviation: r.team_abbreviation,
          round: 1,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-draft-order-picks', activeOrder?.id] });
      queryClient.invalidateQueries({ queryKey: ['draft-order-locked'] });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      if (!activeOrder?.id) throw new Error('No active order');
      const { error } = await supabase.from('draft_orders').update({ is_locked: locked, updated_at: new Date().toISOString() }).eq('id', activeOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-draft-order', year] });
      queryClient.invalidateQueries({ queryKey: ['draft-order-locked'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderRows((items) => {
      const oldIndex = items.findIndex((r) => r.id === active.id);
      const newIndex = items.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  function SortableOrderRow({ row, index }: { row: OrderRow; index: number }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
      <tr ref={setNodeRef} style={{ ...style, borderBottom: '1px solid #333' }}>
        <td>
          <IconButton {...attributes} {...listeners} size="sm" variant="plain" sx={{ cursor: 'grab', color: '#FFF' }}>
            <DragIndicator />
          </IconButton>
        </td>
        <td>
          <Typography sx={{ color: '#FFF' }}>{index + 1}</Typography>
        </td>
        <td>
          <Input
            value={row.team_abbreviation}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setOrderRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, team_abbreviation: v } : r)));
            }}
            sx={{ bgcolor: '#111', color: '#FFF' }}
            size="sm"
          />
        </td>
      </tr>
    );
  }

  if (isAdmin !== true) {
    return (
      <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', p: 3 }}>
        <Alert color="danger">Access denied.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', px: { xs: 1.5, sm: 2, md: 3 }, pt: 2, pb: 6 }}>
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333' }}>
        <CardContent>
          <Typography level="h4" sx={{ color: '#FFF', mb: 2 }}>
            Mock draft (order & results)
          </Typography>
          {orderError && (
            <Alert color="warning" sx={{ mb: 2 }}>
              Run migrations 20260321100000_mock_draft_game.sql and 20260321110000 if needed.
            </Alert>
          )}

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ color: '#B0B0B0' }}>Draft year</Typography>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || DEFAULT_YEAR)}
              sx={{ width: 100, bgcolor: '#111', color: '#FFF' }}
            />
          </Stack>

          <Tabs value={adminTab} onChange={(_e, v) => setAdminTab(v as number)} sx={{ bgcolor: '#1a1a1a' }}>
            <TabList>
              <Tab>Draft order</Tab>
              <Tab>Results & scoring</Tab>
            </TabList>
            <TabPanel value={0} sx={{ pt: 2 }}>
              {orderLoading || picksLoading ? (
                <CircularProgress />
              ) : (
                <>
                  {activeOrder ? (
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
                      <Typography sx={{ color: '#B0B0B0' }}>
                        Active order: {activeOrder.label ?? '—'} ({activeOrder.is_locked ? 'locked' : 'unlocked'})
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography sx={{ color: '#FFF' }}>Locked</Typography>
                        <Switch
                          checked={activeOrder.is_locked}
                          onChange={(e) => lockMutation.mutate(e.target.checked)}
                        />
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography sx={{ color: '#888', mb: 2 }}>No active custom order — app uses live tank fallback until you seed one.</Typography>
                  )}

                  <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="solid"
                      sx={{ bgcolor: '#FFC72C', color: '#000' }}
                      loading={seedMutation.isPending}
                      onClick={() => seedMutation.mutate()}
                      startDecorator={<Refresh />}
                    >
                      Seed active order from tank ({NUM_PICKS} picks)
                    </Button>
                    {activeOrder && orderRows.length > 0 && (
                      <Button
                        variant="outlined"
                        sx={{ borderColor: '#FFF', color: '#FFF' }}
                        loading={savePicksMutation.isPending}
                        onClick={() => savePicksMutation.mutate()}
                        startDecorator={<Save />}
                      >
                        Save pick order & abbreviations
                      </Button>
                    )}
                  </Stack>

                  {activeOrder && orderRows.length > 0 && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={orderRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                        <Table sx={{ bgcolor: '#000' }}>
                          <thead>
                            <tr>
                              <th style={{ width: 40 }} />
                              <th style={{ color: '#FFF' }}>#</th>
                              <th style={{ color: '#FFF' }}>Team</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderRows.map((row, index) => (
                              <SortableOrderRow key={row.id} row={row} index={index} />
                            ))}
                          </tbody>
                        </Table>
                      </SortableContext>
                    </DndContext>
                  )}
                </>
              )}
            </TabPanel>
            <TabPanel value={1} sx={{ pt: 2 }}>
              <AdminMockDraftResults year={year} />
            </TabPanel>
          </Tabs>
        </CardContent>
      </Card>
    </Box>
  );
}

function AdminMockDraftResults({ year }: { year: number }) {
  const queryClient = useQueryClient();
  const { data: prospects } = useQuery({
    queryKey: ['admin-draft-prospects', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_prospects')
        .select('id, player_name_full')
        .eq('draft_year', year)
        .order('player_name_full');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: results, isLoading } = useQuery({
    queryKey: ['mock-draft-results', year],
    queryFn: async () => {
      const { data, error } = await supabase.from('mock_draft_results').select('*').eq('draft_year', year).order('pick_number');
      if (error) throw error;
      return data ?? [];
    },
  });

  const [localResults, setLocalResults] = useState<Record<number, { team_abbreviation: string; draft_prospect_id: string | null }>>(
    {}
  );

  useEffect(() => {
    const m: Record<number, { team_abbreviation: string; draft_prospect_id: string | null }> = {};
    for (const r of results ?? []) {
      m[r.pick_number] = {
        team_abbreviation: r.team_abbreviation,
        draft_prospect_id: r.draft_prospect_id,
      };
    }
    setLocalResults(m);
  }, [results]);

  const saveResults = async () => {
    const rows = Object.entries(localResults).map(([pn, v]) => ({
      draft_year: year,
      pick_number: Number(pn),
      team_abbreviation: v.team_abbreviation,
      draft_prospect_id: v.draft_prospect_id || null,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return;
    const { error } = await supabase.from('mock_draft_results').upsert(rows, { onConflict: 'draft_year,pick_number' });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['mock-draft-results', year] });
  };

  const recompute = async () => {
    const { updated } = await recomputeMockDraftScoresForYear(year);
    alert(`Recomputed scores for ${updated} users.`);
    queryClient.invalidateQueries({ queryKey: ['mock-draft-score'] });
  };

  if (isLoading) return <CircularProgress />;

  return (
    <Stack spacing={2}>
      <Typography sx={{ color: '#B0B0B0' }}>
        Enter the real draft results by pick. Then recompute scores (10 pts per exact pick in Phase 1).
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Button variant="solid" sx={{ bgcolor: '#FFC72C', color: '#000' }} onClick={() => saveResults().catch((e) => alert(e.message))}>
          Save results
        </Button>
        <Button variant="outlined" sx={{ borderColor: '#FFF', color: '#FFF' }} onClick={() => recompute().catch((e) => alert(e.message))}>
          Recompute all scores
        </Button>
      </Stack>
      <Table sx={{ bgcolor: '#000' }}>
        <thead>
          <tr>
            <th style={{ color: '#FFF' }}>Pick</th>
            <th style={{ color: '#FFF' }}>Team</th>
            <th style={{ color: '#FFF' }}>Prospect</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: NUM_PICKS }, (_, i) => i + 1).map((pickNum) => {
            const row = localResults[pickNum] ?? { team_abbreviation: '', draft_prospect_id: null as string | null };
            return (
              <tr key={pickNum} style={{ borderBottom: '1px solid #333' }}>
                <td>
                  <Typography sx={{ color: '#FFF' }}>{pickNum}</Typography>
                </td>
                <td>
                  <Input
                    size="sm"
                    value={row.team_abbreviation}
                    onChange={(e) =>
                      setLocalResults((prev) => ({
                        ...prev,
                        [pickNum]: { ...row, team_abbreviation: e.target.value.toUpperCase() },
                      }))
                    }
                    sx={{ bgcolor: '#111', color: '#FFF' }}
                  />
                </td>
                <td>
                  <Select
                    value={row.draft_prospect_id ?? ''}
                    onChange={(_e, v) =>
                      setLocalResults((prev) => ({
                        ...prev,
                        [pickNum]: { ...row, draft_prospect_id: (v as string) || null },
                      }))
                    }
                    sx={{ minWidth: 220, bgcolor: '#111', color: '#FFF' }}
                  >
                    <Option value="">—</Option>
                    {(prospects ?? []).map((p: any) => (
                      <Option key={p.id} value={p.id}>
                        {p.player_name_full}
                      </Option>
                    ))}
                  </Select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Stack>
  );
}
