import { useState, useEffect, useRef } from 'react';
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

interface FeedModuleVisibilityRow {
  id?: string;
  module_name: string;
  is_visible: boolean;
  display_order: number;
  grid_size: number;
  grid_size_mobile: number;
  created_at?: string;
  updated_at?: string;
}

const FEED_MODULE_DEFINITIONS = [
  { id: 'games_carousel', name: 'Games Carousel', description: 'Horizontal scrollable game cards' },
  { id: 'feed_posts', name: 'Feed Posts', description: 'Card grid of published stories' },
  { id: 'prop_predictions', name: 'Prop Predictions', description: 'Best props for today' },
  { id: 'prop_performance', name: 'Prop Performance', description: 'Historical prop hit rates' },
  { id: 'standings', name: 'Standings', description: 'NBA conference standings' },
  { id: 'favorite_players', name: 'Favorite Players', description: 'User favorite players' },
  { id: 'team_of_night_live', name: 'Team of the Night (Live)', description: 'Live games in progress' },
  { id: 'team_of_night_past', name: 'Team of the Night (Past)', description: 'Top performers from completed games' },
  { id: 'leaders', name: 'Leaders', description: 'Season stat leaders' },
  { id: 'injuries', name: 'Injuries', description: 'NBA injury report' },
  { id: 'team_of_week', name: 'Team of the Week', description: 'Top performers for the week' },
  { id: 'best_games', name: 'Best Games', description: 'Top games by Fun Score' },
  { id: 'draft', name: 'Draft', description: 'Aggregate draft prospect rankings (top 30 in drawer; full list at /draft)' },
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

  const [localModules, setLocalModules] = useState<Record<string, { is_visible: boolean; grid_size: number; grid_size_mobile: number; display_order: number }>>({});
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  const hasInitialized = useRef(false);

  const displayModules = (modules ?? []).length > 0
    ? modules!
    : FEED_MODULE_DEFINITIONS.map((def, index) => ({
        id: undefined,
        module_name: def.id,
        is_visible: true,
        display_order: index,
        grid_size: def.id === 'games_carousel' || def.id === 'feed_posts' ? 12 : 4,
        grid_size_mobile: 12,
      })) as FeedModuleVisibilityRow[];

  useEffect(() => {
    if (!displayModules.length || hasInitialized.current) return;
    const sorted = [...displayModules].sort((a, b) => a.display_order - b.display_order);
    const state: Record<string, { is_visible: boolean; grid_size: number; grid_size_mobile: number; display_order: number }> = {};
    const order: string[] = [];
    sorted.forEach((m, i) => {
      state[m.module_name] = {
        is_visible: m.is_visible,
        grid_size: m.grid_size ?? 4,
        grid_size_mobile: m.grid_size_mobile ?? 12,
        display_order: i,
      };
      order.push(m.module_name);
    });
    setLocalModules(state);
    setModuleOrder(order);
    hasInitialized.current = true;
  }, [displayModules]);

  const handleToggle = (moduleName: string) => {
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
    updateMutation.mutate();
  };

  const handleReset = () => {
    hasInitialized.current = false;
    queryClient.invalidateQueries({ queryKey: ['feed-module-visibility'] });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function SortableRow({ moduleName }: { moduleName: string }) {
    const def = FEED_MODULE_DEFINITIONS.find((d) => d.id === moduleName);
    const local = localModules[moduleName];
    const isVisible = local?.is_visible ?? true;
    const isFeedPosts = moduleName === 'feed_posts';

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
            {isFeedPosts && (
              <Chip size="sm" variant="soft" color="primary" sx={{ height: 18, fontSize: '0.65rem' }}>Main page</Chip>
            )}
            {!isVisible && !isFeedPosts && (
              <Chip size="sm" variant="soft" color="neutral" sx={{ height: 18, fontSize: '0.65rem' }}>Hidden</Chip>
            )}
          </Box>
        </td>
        <td style={{ textAlign: 'center' }}>
          {isFeedPosts ? (
            <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>—</Typography>
          ) : (
            <Switch
              checked={isVisible}
              onChange={() => handleToggle(moduleName)}
              sx={{ '--Switch-thumbSize': '16px', '--Switch-trackWidth': '36px', '--Switch-trackHeight': '20px' }}
            />
          )}
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
          Choose which modules appear in the drawer on /feed/. The feed is the only content on the page; a button opens this drawer. Drag to reorder.
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
                    <th style={{ width: 80, color: '#FFFFFF', textAlign: 'center' }}>In drawer</th>
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
          <Typography level="title-sm" sx={{ color: '#FFFFFF', mb: 2 }}>Preview</Typography>
          <Stack spacing={2}>
            <Box>
              <Typography level="body-xs" sx={{ color: '#888', textTransform: 'uppercase', mb: 1 }}>Main page</Typography>
              <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 56 }}>
                <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 500 }}>Feed Posts</Typography>
                <Chip size="sm" variant="soft" color="primary" sx={{ ml: 1 }}>Full width</Chip>
              </Card>
            </Box>
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
                    .filter((name) => name !== 'feed_posts' && localModules[name]?.is_visible)
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
                {moduleOrder.filter((name) => name !== 'feed_posts' && localModules[name]?.is_visible).length === 0 && (
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
        maxWidth: 1200,
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
