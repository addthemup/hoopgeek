import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  Stack,
  Divider,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Table,
  Select,
  Option,
} from '@mui/joy';
import { Save, Refresh, DragIndicator } from '@mui/icons-material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../utils/supabase';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { CONTENT_MAX_WIDTH } from '../constants/layout';
import { DEFAULT_FEED_MODULES } from '../hooks/useFeedModuleVisibility';
import type { FeedDesktopDrawerLayout } from '../utils/feedDrawerDesktopPack';

interface FeedModuleVisibilityRow {
  id?: string;
  module_name: string;
  is_visible: boolean;
  display_order: number;
  grid_size: number;
  grid_size_mobile: number;
  desktop_layout?: FeedDesktopDrawerLayout;
  created_at?: string;
  updated_at?: string;
}

/** Modules that are not placed in the 2×2 drawer carousel (full-width header strip only). */
const DESKTOP_LAYOUT_NOT_APPLICABLE = new Set(['games_carousel']);

const FEED_MODULE_DEFINITIONS = [
  { id: 'games_carousel', name: 'Games Carousel', description: 'Horizontal scrollable game cards' },
  {
    id: 'prop_predictions',
    name: 'Prop predictions (legacy)',
    description: 'Deprecated — replaced by Over / Under / Team conf / Player conf modules',
  },
  { id: 'prop_predictions_over', name: 'Prop predictions — Over', description: 'Last-10 hit rate, over side' },
  { id: 'prop_predictions_under', name: 'Prop predictions — Under', description: 'Last-10 hit rate, under side' },
  { id: 'prop_predictions_team_confidence', name: 'Prop predictions — Team confidence', description: 'Team-based confidence vs opponent defense' },
  { id: 'prop_predictions_player_confidence', name: 'Prop predictions — Player confidence', description: 'Player-based confidence vs opponent allowed stats' },
  { id: 'slip_builder', name: 'Slip Builder', description: 'Build parlays from props; save and track slips' },
  { id: 'prop_performance', name: 'Prop Performance', description: 'Historical prop hit rates' },
  { id: 'standings', name: 'Standings', description: 'NBA conference standings' },
  { id: 'favorite_players', name: 'Favorite Players', description: 'User favorite players' },
  { id: 'totn_totw', name: 'Team of the Night / Week', description: 'TOTN and TOTW in one module with tabs' },
  { id: 'leaders', name: 'Leaders', description: 'Season stat leaders' },
  { id: 'injuries', name: 'Injuries', description: 'NBA injury report' },
  { id: 'best_games', name: 'Best Games', description: 'Top games by Fun Score' },
  { id: 'draft', name: 'Draft', description: 'Aggregate draft prospect rankings (top 30 in drawer; full list at /draft)' },
  { id: 'dfs_pools', name: 'DFS Pools', description: 'Upcoming/public DFS pools in drawer; links to /dfs' },
];

export default function AdminFeed() {
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const queryClient = useQueryClient();

  const { data: modules, isLoading: modulesLoading, error: modulesError } = useQuery<FeedModuleVisibilityRow[]>({
    queryKey: ['feed-module-visibility'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_module_visibility')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return (data ?? []) as FeedModuleVisibilityRow[];
    },
    enabled: isAdmin === true,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: async () => Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-module-visibility'] });
      queryClient.invalidateQueries({ queryKey: ['feed-module-visibility-map'] });
    },
  });

  const [localModules, setLocalModules] = useState<
    Record<
      string,
      {
        is_visible: boolean;
        grid_size: number;
        grid_size_mobile: number;
        display_order: number;
        desktop_layout: FeedDesktopDrawerLayout;
      }
    >
  >({});
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  /** True after local edits; blocks syncing from server refetches until Save (avoids overwriting toggles). */
  const localDirtyRef = useRef(false);

  // Build list for admin: use DB rows when present, and merge in any FEED_MODULE_DEFINITIONS
  // that are missing from DB (e.g. dfs_pools) so they appear in the drawer list and can be reordered.
  const displayModules = useMemo((): FeedModuleVisibilityRow[] => {
    const dbModules = ((modules ?? []) as FeedModuleVisibilityRow[]).filter((m) => m.module_name !== 'feed_posts');
    const dbByName = new Map(dbModules.map((m) => [m.module_name, m]));
    const sortedDb = [...dbModules].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const missingDefs = FEED_MODULE_DEFINITIONS.filter((d) => !dbByName.has(d.id));
    const nextOrder = sortedDb.length > 0 ? Math.max(...sortedDb.map((m) => m.display_order ?? 0)) + 1 : 0;
    if (sortedDb.length > 0) {
      return [
        ...sortedDb,
        ...missingDefs.map((def, i) => ({
          id: undefined,
          module_name: def.id,
          is_visible: true,
          display_order: nextOrder + i,
          grid_size: def.id === 'games_carousel' ? 12 : 4,
          grid_size_mobile: 12,
          desktop_layout: DEFAULT_FEED_MODULES[def.id as keyof typeof DEFAULT_FEED_MODULES]?.desktop_layout ?? 'cell',
        })),
      ] as FeedModuleVisibilityRow[];
    }
    return FEED_MODULE_DEFINITIONS.map((def, index) => ({
      id: undefined,
      module_name: def.id,
      is_visible: true,
      display_order: index,
      grid_size: def.id === 'games_carousel' ? 12 : 4,
      grid_size_mobile: 12,
      desktop_layout: DEFAULT_FEED_MODULES[def.id as keyof typeof DEFAULT_FEED_MODULES]?.desktop_layout ?? 'cell',
    })) as FeedModuleVisibilityRow[];
  }, [modules]);

  // Sync form state whenever server data is available. The old hasInitialized ref only ran once and
  // could lock in placeholder defaults before the query finished, so toggles/saves did not match the DB.
  useEffect(() => {
    if (modulesLoading || !displayModules.length) return;
    if (localDirtyRef.current) return;
    const sorted = [...displayModules].sort((a, b) => a.display_order - b.display_order);
    const state: Record<string, { is_visible: boolean; grid_size: number; grid_size_mobile: number; display_order: number }> = {};
    const order: string[] = [];
    sorted.forEach((m, i) => {
      const defLayout =
        DEFAULT_FEED_MODULES[m.module_name as keyof typeof DEFAULT_FEED_MODULES]?.desktop_layout ?? 'cell';
      const dl = m.desktop_layout ?? defLayout;
      state[m.module_name] = {
        is_visible: m.is_visible,
        grid_size: m.grid_size ?? 4,
        grid_size_mobile: m.grid_size_mobile ?? 12,
        display_order: i,
        desktop_layout:
          dl === 'tall' || dl === 'wide' || dl === 'full' || dl === 'cell' ? dl : 'cell',
      };
      order.push(m.module_name);
    });
    setLocalModules(state);
    setModuleOrder(order);
  }, [modulesLoading, displayModules, modules]);

  const handleToggle = (moduleName: string) => {
    localDirtyRef.current = true;
    setLocalModules((prev) => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        is_visible: !prev[moduleName]?.is_visible,
      },
    }));
  };

  const handleDesktopLayout = (moduleName: string, value: FeedDesktopDrawerLayout) => {
    localDirtyRef.current = true;
    setLocalModules((prev) => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName]!,
        desktop_layout: value,
      },
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    localDirtyRef.current = true;
    setModuleOrder((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      const newOrder = arrayMove(items, oldIndex, newIndex);
      setLocalModules((prev) => {
        const updated = { ...prev };
        newOrder.forEach((name, index) => {
          if (updated[name]) updated[name] = { ...updated[name], display_order: index };
        });
        return updated;
      });
      return newOrder;
    });
  };

  const handleSave = async () => {
    const updates = moduleOrder.map((module_name, index) => {
      const local = localModules[module_name];
      return {
        module_name,
        is_visible: local?.is_visible ?? true,
        display_order: index,
        grid_size: local?.grid_size ?? 4,
        grid_size_mobile: local?.grid_size_mobile ?? 12,
        desktop_layout: local?.desktop_layout ?? 'cell',
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from('feed_module_visibility')
      .upsert(updates, { onConflict: 'module_name' });

    if (error) {
      console.error('Save feed module visibility error:', error);
      throw new Error(error.message);
    }
    localDirtyRef.current = false;
    console.info('[AdminFeed] feed_module_visibility saved', { rows: updates.length });
    updateMutation.mutate();
  };

  const handleReset = () => {
    localDirtyRef.current = false;
    queryClient.invalidateQueries({ queryKey: ['feed-module-visibility'] });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function SortableRow({
    moduleName,
    onDesktopLayout,
  }: {
    moduleName: string;
    onDesktopLayout: (name: string, value: FeedDesktopDrawerLayout) => void;
  }) {
    const def = FEED_MODULE_DEFINITIONS.find((d) => d.id === moduleName);
    const local = localModules[moduleName];
    const isVisible = local?.is_visible ?? true;
    const layoutApplicable = !DESKTOP_LAYOUT_NOT_APPLICABLE.has(moduleName);
    const desktopLayout = local?.desktop_layout ?? 'cell';

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: moduleName });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

    return (
      <tr
        ref={setNodeRef}
        style={{
          ...style,
          borderBottom: '1px solid #333333',
          backgroundColor: isDragging ? 'rgba(255, 199, 44, 0.1)' : 'transparent',
        }}
      >
        <td>
          <IconButton {...attributes} {...listeners} size="sm" variant="plain" sx={{ cursor: 'grab', color: '#FFFFFF', p: 0.5 }}>
            <DragIndicator sx={{ fontSize: 18 }} />
          </IconButton>
        </td>
        <td>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level="body-sm" sx={{ color: isVisible ? '#FFFFFF' : '#666666', fontWeight: 500 }}>
              {def?.name ?? moduleName}
            </Typography>
            {!isVisible && (
              <Chip size="sm" variant="soft" color="neutral" sx={{ height: 18, fontSize: '0.65rem' }}>Hidden</Chip>
            )}
          </Box>
        </td>
        <td>
          {!layoutApplicable ? (
            <Typography level="body-xs" sx={{ color: '#666' }}>
              —
            </Typography>
          ) : (
            <Select
              size="sm"
              value={desktopLayout}
              onChange={(_, v) => v && onDesktopLayout(moduleName, v as FeedDesktopDrawerLayout)}
              slotProps={{ listbox: { sx: { zIndex: 2000 } } }}
              sx={{ minWidth: 140 }}
            >
              <Option value="cell">1×1 cell</Option>
              <Option value="tall">Tall (full height)</Option>
              <Option value="wide">Wide (full width)</Option>
              <Option value="full">Full slide</Option>
            </Select>
          )}
        </td>
        <td style={{ textAlign: 'center' }}>
          <Switch
            checked={isVisible}
            onChange={() => handleToggle(moduleName)}
            sx={{ '--Switch-thumbSize': '16px', '--Switch-trackWidth': '36px', '--Switch-trackHeight': '20px' }}
          />
        </td>
      </tr>
    );
  }

  const mainContent = (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>
        {modulesError && (
          <Alert color="warning" sx={{ mb: 2, bgcolor: '#3a2a1a', borderColor: '#5a4a2a' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              feed_module_visibility table may not exist. Run migration 20260216000000_feed_module_visibility.sql
            </Typography>
          </Alert>
        )}

        <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
          Drawer Modules
        </Typography>
        <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 3 }}>
          Choose which modules appear in the /feed/ inset drawer (Home, Props, DFS, Draft tabs). The main story feed is always on the page; a button opens this drawer. Drag to reorder.
          Desktop uses a 2×2 carousel per tab; <strong>Desktop tile</strong> sets how each module fits (quarter, tall column, wide row, or full slide).
        </Typography>

        {modulesLoading || moduleOrder.length === 0 ? (
          <CircularProgress size="sm" />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={moduleOrder} strategy={verticalListSortingStrategy}>
              <Table hoverRow size="sm" sx={{ bgcolor: '#000000' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, color: '#FFFFFF' }} />
                    <th style={{ color: '#FFFFFF' }}>Module</th>
                    <th style={{ width: 160, color: '#FFFFFF' }}>Desktop tile</th>
                    <th style={{ width: 80, color: '#FFFFFF', textAlign: 'center' }}>In drawer</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleOrder.map((name) => (
                    <SortableRow key={name} moduleName={name} onDesktopLayout={handleDesktopLayout} />
                  ))}
                </tbody>
              </Table>
            </SortableContext>
          </DndContext>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography level="title-sm" sx={{ color: '#FFFFFF', mb: 2 }}>Preview</Typography>
          <Stack spacing={2}>
            <Box>
              <Typography level="body-xs" sx={{ color: '#888', textTransform: 'uppercase', mb: 1 }}>Inset drawer (when user taps &quot;More&quot;)</Typography>
              <Box
                sx={{
                  bgcolor: 'background.surface',
                  borderRadius: 'md',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'neutral.outlinedBorder',
                }}
              >
                <Typography level="title-sm" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.primary' }}>More</Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 1.5,
                  }}
                >
                  {moduleOrder
                    .filter((name) => localModules[name]?.is_visible)
                    .map((name) => {
                      const def = FEED_MODULE_DEFINITIONS.find((d) => d.id === name);
                      return (
                        <Card
                          key={name}
                          variant="outlined"
                          sx={{
                            bgcolor: '#1a1a1a',
                            borderColor: '#333',
                            p: 1.5,
                            minHeight: 52,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'none',
                          }}
                        >
                          <Typography level="body-sm" sx={{ color: '#FFF', textAlign: 'center' }}>
                            {def?.name ?? name}
                          </Typography>
                        </Card>
                      );
                    })}
                </Box>
                {moduleOrder.filter((name) => localModules[name]?.is_visible).length === 0 && (
                  <Typography level="body-sm" sx={{ color: '#888' }}>No modules in drawer</Typography>
                )}
              </Box>
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ my: 3, bgcolor: '#333333' }} />
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button variant="outlined" color="neutral" onClick={handleReset} startDecorator={<Refresh />} sx={{ borderColor: '#FFF', color: '#FFF' }}>
            Reset
          </Button>
          <Button
            variant="solid"
            color="primary"
            onClick={async () => {
              try {
                await handleSave();
              } catch (e) {
                alert(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
              }
            }}
            loading={updateMutation.isPending}
            startDecorator={<Save />}
            sx={{ bgcolor: '#FFC72C', color: '#000' }}
          >
            Save
          </Button>
        </Stack>
        {updateMutation.isSuccess && (
          <Alert color="success" sx={{ mt: 2, bgcolor: '#1a3a1a', borderColor: '#2d5a2d' }}>
            <Typography sx={{ color: '#FFFFFF' }}>Drawer module settings saved.</Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box
      sx={{
        maxWidth: CONTENT_MAX_WIDTH,
        mx: 'auto',
        px: { xs: 1.5, sm: 2, md: 3 },
        pt: { xs: 2, md: 3 },
        pb: 6,
      }}
    >
      {mainContent}
    </Box>
  );
}
