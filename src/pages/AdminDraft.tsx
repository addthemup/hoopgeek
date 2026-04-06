/**
 * Admin: Draft page drawer configuration.
 * Turn modules on/off and drag to reorder for /draft.
 */

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
import { DRAFT_MODULE_DEFINITIONS } from '../hooks/useDraftModuleVisibility';
import { CONTENT_MAX_WIDTH } from '../constants/layout';

interface DraftModuleVisibilityRow {
  id?: string;
  module_name: string;
  is_visible: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export default function AdminDraft() {
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();

  const { data: modules, isLoading: modulesLoading, error: modulesError } = useQuery<DraftModuleVisibilityRow[]>({
    queryKey: ['draft-module-visibility'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_module_visibility')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DraftModuleVisibilityRow[];
    },
    enabled: isAdmin === true,
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: async () => Promise.resolve(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft-module-visibility'] });
      queryClient.invalidateQueries({ queryKey: ['draft-module-visibility-map'] });
    },
  });

  const [localModules, setLocalModules] = useState<Record<string, { is_visible: boolean; display_order: number }>>({});
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  const hasInitialized = useRef(false);

  const displayModules = (modules ?? []).length > 0
    ? modules!
    : DRAFT_MODULE_DEFINITIONS.map((def, index) => ({
        id: undefined,
        module_name: def.id,
        is_visible: true,
        display_order: index,
      })) as DraftModuleVisibilityRow[];

  useEffect(() => {
    if (!displayModules.length || hasInitialized.current) return;
    const sorted = [...displayModules].sort((a, b) => a.display_order - b.display_order);
    const state: Record<string, { is_visible: boolean; display_order: number }> = {};
    const order: string[] = [];
    sorted.forEach((m, i) => {
      state[m.module_name] = {
        is_visible: m.is_visible,
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
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from('draft_module_visibility')
      .upsert(updates, { onConflict: 'module_name' });

    if (error) {
      console.error('Save draft module visibility error:', error);
      throw new Error(error.message);
    }
    updateMutation.mutate();
  };

  const handleReset = () => {
    hasInitialized.current = false;
    queryClient.invalidateQueries({ queryKey: ['draft-module-visibility'] });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function SortableRow({ moduleName }: { moduleName: string }) {
    const def = DRAFT_MODULE_DEFINITIONS.find((d) => d.id === moduleName);
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level="body-sm" sx={{ color: isVisible ? '#FFFFFF' : '#666666', fontWeight: 500 }}>
              {def?.name ?? moduleName}
            </Typography>
            {def?.description && (
              <Typography level="body-xs" sx={{ color: '#888888' }}>
                {def.description}
              </Typography>
            )}
            {!isVisible && (
              <Chip size="sm" variant="soft" color="neutral" sx={{ height: 18, fontSize: '0.65rem' }}>Hidden</Chip>
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
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
        <CardContent>
          {modulesError && (
            <Alert color="warning" sx={{ mb: 2, bgcolor: '#3a2a1a', borderColor: '#5a4a2a' }}>
              <Typography sx={{ color: '#FFFFFF' }}>
                draft_module_visibility table may not exist. Run migration 20260321010000_draft_module_visibility.sql
              </Typography>
            </Alert>
          )}

          <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
            Draft Page Modules
          </Typography>
          <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 3 }}>
            Choose which modules appear in the drawer on /draft. Drag to reorder module order.
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
              <Typography sx={{ color: '#FFFFFF' }}>Draft module settings saved.</Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
