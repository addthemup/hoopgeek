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
} from '@mui/joy';
import { Save, Refresh, DragIndicator } from '@mui/icons-material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../utils/supabase';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { CONTENT_MAX_WIDTH } from '../constants/layout';

interface ProfileModuleVisibilityRow {
  id?: string;
  module_name: string;
  is_visible: boolean;
  display_order: number;
  grid_size: number;
  grid_size_mobile: number;
  created_at?: string;
  updated_at?: string;
}

const PROFILE_MODULE_DEFINITIONS = [
  { id: 'favorite_players', name: 'Favorite Players', description: 'Carousel of favorited players and prospects' },
  { id: 'dfs_pools', name: 'DFS Pools', description: 'Upcoming DFS pools; links to /dfs' },
  { id: 'slip_builder', name: 'Slip Builder', description: 'Parlay builder from props (ghost when empty)' },
  {
    id: 'prop_predictions',
    name: 'Prop predictions (legacy)',
    description: 'Deprecated — replaced by four split prop modules',
  },
  { id: 'prop_predictions_over', name: 'Prop predictions — Over', description: 'Last-10 hit rate, over side' },
  { id: 'prop_predictions_under', name: 'Prop predictions — Under', description: 'Last-10 hit rate, under side' },
  { id: 'prop_predictions_team_confidence', name: 'Prop predictions — Team confidence', description: 'Team-based confidence' },
  { id: 'prop_predictions_player_confidence', name: 'Prop predictions — Player confidence', description: 'Player-based confidence' },
  { id: 'prop_performance', name: 'Prop Performance', description: 'Historical prop hit rates' },
  { id: 'draft', name: 'Draft', description: 'Draft prospect rankings (mock draft at /draft)' },
];

export default function AdminProfile() {
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();

  const { data: modules, isLoading: modulesLoading, error: modulesError } = useQuery<ProfileModuleVisibilityRow[]>({
    queryKey: ['profile-module-visibility'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_module_visibility')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ProfileModuleVisibilityRow[];
    },
    enabled: isAdmin === true,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: async () => Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-module-visibility'] });
      queryClient.invalidateQueries({ queryKey: ['profile-module-visibility-map'] });
    },
  });

  const [localModules, setLocalModules] = useState<
    Record<string, { is_visible: boolean; grid_size: number; grid_size_mobile: number; display_order: number }>
  >({});
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  const localDirtyRef = useRef(false);

  const displayModules = useMemo((): ProfileModuleVisibilityRow[] => {
    const dbModules = (modules ?? []) as ProfileModuleVisibilityRow[];
    const dbByName = new Map(dbModules.map((m) => [m.module_name, m]));
    const sortedDb = [...dbModules].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const missingDefs = PROFILE_MODULE_DEFINITIONS.filter((d) => !dbByName.has(d.id));
    const nextOrder = sortedDb.length > 0 ? Math.max(...sortedDb.map((m) => m.display_order ?? 0)) + 1 : 0;
    if (sortedDb.length > 0) {
      return [
        ...sortedDb,
        ...missingDefs.map((def, i) => ({
          id: undefined,
          module_name: def.id,
          is_visible: true,
          display_order: nextOrder + i,
          grid_size: 12,
          grid_size_mobile: 12,
        })),
      ] as ProfileModuleVisibilityRow[];
    }
    return PROFILE_MODULE_DEFINITIONS.map((def, index) => ({
      id: undefined,
      module_name: def.id,
      is_visible: true,
      display_order: index,
      grid_size: 12,
      grid_size_mobile: 12,
    })) as ProfileModuleVisibilityRow[];
  }, [modules]);

  useEffect(() => {
    if (modulesLoading || !displayModules.length) return;
    if (localDirtyRef.current) return;
    const sorted = [...displayModules].sort((a, b) => a.display_order - b.display_order);
    const state: Record<string, { is_visible: boolean; grid_size: number; grid_size_mobile: number; display_order: number }> = {};
    const order: string[] = [];
    sorted.forEach((m, i) => {
      state[m.module_name] = {
        is_visible: m.is_visible,
        grid_size: m.grid_size ?? 12,
        grid_size_mobile: m.grid_size_mobile ?? 12,
        display_order: i,
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
        grid_size: local?.grid_size ?? 12,
        grid_size_mobile: local?.grid_size_mobile ?? 12,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from('profile_module_visibility').upsert(updates, { onConflict: 'module_name' });

    if (error) {
      console.error('Save profile module visibility error:', error);
      throw new Error(error.message);
    }
    localDirtyRef.current = false;
    console.info('[AdminProfile] profile_module_visibility saved', { rows: updates.length });
    updateMutation.mutate();
  };

  const handleReset = () => {
    localDirtyRef.current = false;
    queryClient.invalidateQueries({ queryKey: ['profile-module-visibility'] });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function SortableRow({ moduleName }: { moduleName: string }) {
    const def = PROFILE_MODULE_DEFINITIONS.find((d) => d.id === moduleName);
    const local = localModules[moduleName];
    const isVisible = local?.is_visible ?? true;

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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography level="body-sm" sx={{ color: isVisible ? '#FFFFFF' : '#666666', fontWeight: 500 }}>
                {def?.name ?? moduleName}
              </Typography>
              {!isVisible && <Chip size="sm" variant="soft" color="neutral" sx={{ height: 18, fontSize: '0.65rem' }}>Hidden</Chip>}
            </Box>
            {def?.description && (
              <Typography level="body-xs" sx={{ color: '#888', maxWidth: 480 }}>
                {def.description}
              </Typography>
            )}
          </Box>
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
              profile_module_visibility table may not exist. Run migration 20260323150000_profile_module_visibility.sql
            </Typography>
          </Alert>
        )}

        <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
          Profile modules
        </Typography>
        <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 3 }}>
          Choose which modules appear in the <strong>Your tools</strong> section on <code>/profile</code>. Same components as the feed drawer;
          order and visibility are independent from the feed.
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
                    <th style={{ width: 80, color: '#FFFFFF', textAlign: 'center' }}>Visible</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleOrder.map((name) => (
                    <SortableRow key={name} moduleName={name} />
                  ))}
                </tbody>
              </Table>
            </SortableContext>
          </DndContext>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography level="title-sm" sx={{ color: '#FFFFFF', mb: 1.5 }}>
            Preview (/profile)
          </Typography>
          <Box
            sx={{
              bgcolor: 'background.surface',
              borderRadius: 'md',
              p: 2,
              border: '1px solid',
              borderColor: 'neutral.outlinedBorder',
            }}
          >
            <Typography level="title-sm" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
              Your tools
            </Typography>
            <Stack spacing={1}>
              {moduleOrder
                .filter((name) => localModules[name]?.is_visible)
                .map((name) => {
                  const def = PROFILE_MODULE_DEFINITIONS.find((d) => d.id === name);
                  return (
                    <Card
                      key={name}
                      variant="outlined"
                      sx={{
                        bgcolor: '#1a1a1a',
                        borderColor: '#333',
                        p: 1.5,
                        boxShadow: 'none',
                      }}
                    >
                      <Typography level="body-sm" sx={{ color: '#FFF' }}>
                        {def?.name ?? name}
                      </Typography>
                    </Card>
                  );
                })}
              {moduleOrder.filter((name) => localModules[name]?.is_visible).length === 0 && (
                <Typography level="body-sm" sx={{ color: '#888' }}>
                  No modules visible
                </Typography>
              )}
            </Stack>
          </Box>
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
            <Typography sx={{ color: '#FFFFFF' }}>Profile module settings saved.</Typography>
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
