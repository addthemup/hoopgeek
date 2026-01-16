import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMediaQuery } from '@mui/material';
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
  Sheet,
  Grid,
  Select,
  Option,
  IconButton,
  Chip,
  Table,
} from '@mui/joy';
import { Save, Refresh, DragIndicator, Visibility, VisibilityOff } from '@mui/icons-material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../utils/supabase';
import { useIsAdmin } from '../hooks/useIsAdmin';

interface ModuleVisibility {
  id: string;
  module_name: string;
  is_visible: boolean;
  display_order: number;
  grid_size?: number;
  created_at?: string;
  updated_at?: string;
}

const DAILY_MODULE_DEFINITIONS = [
  { id: 'games_carousel', name: 'Games Carousel', description: 'Horizontal scrollable game cards in header' },
  { id: 'prop_predictions', name: 'Prop Predictions', description: 'Algorithmically predicted best props' },
  { id: 'standings', name: 'Standings', description: 'NBA conference standings' },
  { id: 'favorite_players', name: 'Favorite Players', description: 'User favorite players module' },
  { id: 'team_of_night', name: 'Team of the Night', description: 'Top performers from last night' },
  { id: 'leaders', name: 'Leaders', description: 'Season stat leaders' },
  { id: 'injuries', name: 'Injuries', description: 'Current NBA injury report (shows historical for past dates)' },
];

const WEEKLY_MODULE_DEFINITIONS = [
  { id: 'team_of_week', name: 'Team of the Week', description: 'Top performers for the week' },
  { id: 'best_games', name: 'Best Games', description: 'Top games ranked by Fun Score' },
];

export default function AdminToday() {
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileHeight = useMediaQuery('(max-height: 600px)');
  const isLandscapeMobile = isLandscape && isMobileHeight;
  
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const queryClient = useQueryClient();

  // Fetch module visibility settings
  const { data: modules, isLoading: modulesLoading, refetch, error: modulesError } = useQuery<ModuleVisibility[]>({
    queryKey: ['today-module-visibility'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('today_module_visibility')
          .select('*')
          .order('display_order', { ascending: true });

        if (error) {
          console.error('Error fetching module visibility:', error);
          // If table doesn't exist, return default values
          return DAILY_MODULE_DEFINITIONS.map((mod, index) => ({
            id: mod.id,
            module_name: mod.id,
            is_visible: true,
            display_order: index,
          }));
        }

        // Merge with definitions to ensure all modules are present
        const existingModules = data || [];
        const moduleMap = new Map(existingModules.map(m => [m.module_name, m]));
        
        return DAILY_MODULE_DEFINITIONS.map((def, index) => {
          const existing = moduleMap.get(def.id);
          return existing ? {
            ...existing,
            // Ensure all required fields are present
            id: existing.id,
            module_name: existing.module_name,
            is_visible: existing.is_visible,
            display_order: existing.display_order ?? index,
            grid_size: existing.grid_size ?? 4,
          } : {
            id: def.id,
            module_name: def.id,
            is_visible: true,
            display_order: index,
            grid_size: 4,
          };
        });
      } catch (err) {
        console.error('Exception fetching module visibility:', err);
        // Return default values on any error
        return DAILY_MODULE_DEFINITIONS.map((mod, index) => ({
          id: mod.id,
          module_name: mod.id,
          is_visible: true,
          display_order: index,
        }));
      }
    },
    enabled: isAdmin === true, // Only run query if user is confirmed admin (not undefined)
    retry: false, // Don't retry if table doesn't exist
  });

  // Update module visibility mutation (now handled in handleSave)
  const updateMutation = useMutation({
    mutationFn: async () => {
      // This is now handled in handleSave
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-module-visibility'] });
      queryClient.invalidateQueries({ queryKey: ['today-module-visibility-map'] });
    },
  });

  // If modules are still loading or error, show default values
  const displayModules = useMemo(() => {
    return modules || DAILY_MODULE_DEFINITIONS.map((mod, index) => ({
      id: mod.id,
      module_name: mod.id,
      is_visible: true,
      display_order: index,
      grid_size: 4,
    }));
  }, [modules]);

  // Local state for daily modules (visibility, grid size, order)
  const [localModules, setLocalModules] = useState<Record<string, { is_visible: boolean; grid_size: number; display_order: number }>>({});
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  
  // Local state for weekly modules
  const [localWeeklyModules, setLocalWeeklyModules] = useState<Record<string, { is_visible: boolean; grid_size: number; display_order: number }>>({});
  const [weeklyModuleOrder, setWeeklyModuleOrder] = useState<string[]>([]);

  useEffect(() => {
    if (displayModules) {
      const initialState: Record<string, { is_visible: boolean; grid_size: number; display_order: number }> = {};
      const order: string[] = [];
      
      // Sort by display_order
      const sorted = [...displayModules].sort((a, b) => a.display_order - b.display_order);
      
      sorted.forEach(mod => {
        initialState[mod.module_name] = {
          is_visible: mod.is_visible,
          grid_size: mod.grid_size ?? 4,
          display_order: mod.display_order,
        };
        order.push(mod.module_name);
      });
      
      setLocalModules(initialState);
      setModuleOrder(order);
    }
    
    // Initialize weekly modules from WEEKLY_MODULE_DEFINITIONS
    const weeklyInitialState: Record<string, { is_visible: boolean; grid_size: number; display_order: number }> = {};
    const weeklyOrder: string[] = [];
    
    WEEKLY_MODULE_DEFINITIONS.forEach((def, index) => {
      weeklyInitialState[def.id] = {
        is_visible: true,
        grid_size: 12, // Full width by default for weekly modules
        display_order: index,
      };
      weeklyOrder.push(def.id);
    });
    
    setLocalWeeklyModules(weeklyInitialState);
    setWeeklyModuleOrder(weeklyOrder);
  }, [displayModules]);

  const handleToggle = (moduleName: string) => {
    setLocalModules(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        is_visible: !prev[moduleName]?.is_visible,
      },
    }));
  };

  const handleWeeklyToggle = (moduleName: string) => {
    setLocalWeeklyModules(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        is_visible: !prev[moduleName]?.is_visible,
      },
    }));
  };

  const handleGridSizeChange = (moduleName: string, newSize: number) => {
    setLocalModules(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        grid_size: newSize,
      },
    }));
  };

  const handleWeeklyGridSizeChange = (moduleName: string, newSize: number) => {
    setLocalWeeklyModules(prev => ({
      ...prev,
      [moduleName]: {
        ...prev[moduleName],
        grid_size: newSize,
      },
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setModuleOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update display_order in local state
        setLocalModules(prev => {
          const updated = { ...prev };
          newOrder.forEach((moduleName, index) => {
            if (updated[moduleName]) {
              updated[moduleName] = {
                ...updated[moduleName],
                display_order: index,
              };
            }
          });
          return updated;
        });
        
        return newOrder;
      });
    }
  };

  const handleWeeklyDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setWeeklyModuleOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update display_order in local state
        setLocalWeeklyModules(prev => {
          const updated = { ...prev };
          newOrder.forEach((moduleName, index) => {
            if (updated[moduleName]) {
              updated[moduleName] = {
                ...updated[moduleName],
                display_order: index,
              };
            }
          });
          return updated;
        });
        
        return newOrder;
      });
    }
  };

  const handleSave = async () => {
    if (!displayModules) return;

    const updates = moduleOrder.map((moduleName, index) => {
      const local = localModules[moduleName];
      const original = displayModules.find(m => m.module_name === moduleName);
      return {
        module_name: moduleName,
        is_visible: local?.is_visible ?? original?.is_visible ?? true,
        grid_size: local?.grid_size ?? original?.grid_size ?? 4,
        display_order: index,
      };
    });

    // Upsert each module with all fields
    const promises = updates.map(update => {
      return supabase
        .from('today_module_visibility')
        .upsert({
          module_name: update.module_name,
          is_visible: update.is_visible,
          grid_size: update.grid_size,
          display_order: update.display_order,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'module_name',
        });
    });

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    
    if (errors.length > 0) {
      throw new Error(`Failed to update ${errors.length} module(s)`);
    }

    await updateMutation.mutateAsync();
  };

  const handleReset = () => {
    if (displayModules) {
      const initialState: Record<string, { is_visible: boolean; grid_size: number; display_order: number }> = {};
      const order: string[] = [];
      
      const sorted = [...displayModules].sort((a, b) => a.display_order - b.display_order);
      sorted.forEach(mod => {
        initialState[mod.module_name] = {
          is_visible: mod.is_visible,
          grid_size: mod.grid_size ?? 4,
          display_order: mod.display_order,
        };
        order.push(mod.module_name);
      });
      
      setLocalModules(initialState);
      setModuleOrder(order);
    }
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate hasChanges BEFORE any early returns (Rules of Hooks)
  const hasChanges = useMemo(() => {
    if (!displayModules || moduleOrder.length === 0) return false;
    
    return moduleOrder.some((moduleName, index) => {
      const local = localModules[moduleName];
      const original = displayModules.find(m => m.module_name === moduleName);
      if (!local || !original) return false;
      
      return (
        local.is_visible !== original.is_visible ||
        local.grid_size !== (original.grid_size ?? 4) ||
        local.display_order !== index
      );
    });
  }, [displayModules, localModules, moduleOrder]);

  // Sortable table row component for daily modules
  function SortableTableRow({ moduleName }: { moduleName: string }) {
    const def = DAILY_MODULE_DEFINITIONS.find(d => d.id === moduleName);
    const local = localModules[moduleName];
    const isVisible = local?.is_visible ?? true;
    const gridSize = local?.grid_size ?? 4;
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: moduleName });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <tr
        ref={setNodeRef}
        style={{
          ...style,
          borderBottom: '1px solid #333333',
          backgroundColor: isDragging ? 'rgba(255, 199, 44, 0.1)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 199, 44, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <td>
          <IconButton
            {...attributes}
            {...listeners}
            size="sm"
            variant="plain"
            sx={{
              cursor: 'grab',
              color: '#FFFFFF',
              p: 0.5,
              '&:active': {
                cursor: 'grabbing',
              },
            }}
          >
            <DragIndicator sx={{ fontSize: 18 }} />
          </IconButton>
        </td>
        <td>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level="body-sm" sx={{ color: isVisible ? '#FFFFFF' : '#666666', fontWeight: 500 }}>
              {def?.name || moduleName}
            </Typography>
            {!isVisible && (
              <Chip size="sm" variant="soft" color="neutral" sx={{ height: 18, fontSize: '0.65rem' }}>
                Hidden
              </Chip>
            )}
          </Box>
        </td>
        <td style={{ textAlign: 'center' }}>
          <Select
            value={gridSize}
            onChange={(_, value) => value && handleGridSizeChange(moduleName, value)}
            size="sm"
            sx={{ minWidth: 80 }}
          >
            <Option value={4}>1/3</Option>
            <Option value={8}>2/3</Option>
            <Option value={12}>Full</Option>
          </Select>
        </td>
        <td style={{ textAlign: 'center' }}>
          <Switch
            checked={isVisible}
            onChange={() => handleToggle(moduleName)}
            sx={{
              '--Switch-thumbSize': '16px',
              '--Switch-trackWidth': '36px',
              '--Switch-trackHeight': '20px',
            }}
          />
        </td>
      </tr>
    );
  }

  // Sortable table row component for weekly modules
  function SortableWeeklyTableRow({ moduleName }: { moduleName: string }) {
    const def = WEEKLY_MODULE_DEFINITIONS.find(d => d.id === moduleName);
    const local = localWeeklyModules[moduleName];
    const isVisible = local?.is_visible ?? true;
    const gridSize = local?.grid_size ?? 12;
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: moduleName });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <tr
        ref={setNodeRef}
        style={{
          ...style,
          borderBottom: '1px solid #333333',
          backgroundColor: isDragging ? 'rgba(255, 199, 44, 0.1)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 199, 44, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <td>
          <IconButton
            {...attributes}
            {...listeners}
            size="sm"
            variant="plain"
            sx={{
              cursor: 'grab',
              color: '#FFFFFF',
              p: 0.5,
              '&:active': {
                cursor: 'grabbing',
              },
            }}
          >
            <DragIndicator sx={{ fontSize: 18 }} />
          </IconButton>
        </td>
        <td>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level="body-sm" sx={{ color: isVisible ? '#FFFFFF' : '#666666', fontWeight: 500 }}>
              {def?.name || moduleName}
            </Typography>
            {!isVisible && (
              <Chip size="sm" variant="soft" color="neutral" sx={{ height: 18, fontSize: '0.65rem' }}>
                Hidden
              </Chip>
            )}
          </Box>
        </td>
        <td style={{ textAlign: 'center' }}>
          <Select
            value={gridSize}
            onChange={(_, value) => value && handleWeeklyGridSizeChange(moduleName, value)}
            size="sm"
            sx={{ minWidth: 80 }}
          >
            <Option value={4}>1/3</Option>
            <Option value={8}>2/3</Option>
            <Option value={12}>Full</Option>
          </Select>
        </td>
        <td style={{ textAlign: 'center' }}>
          <Switch
            checked={isVisible}
            onChange={() => handleWeeklyToggle(moduleName)}
            sx={{
              '--Switch-thumbSize': '16px',
              '--Switch-trackWidth': '36px',
              '--Switch-trackHeight': '20px',
            }}
          />
        </td>
      </tr>
    );
  }

  if (isAdminLoading) {
    return (
      <Box sx={{
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        px: { xs: 2, md: 2 },
        pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
        pb: 4,
        bgcolor: '#000000',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box sx={{
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        px: { xs: 2, md: 2 },
        pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
        pb: 4,
        bgcolor: '#000000',
        minHeight: '100vh',
      }}>
        <Alert color="danger">
          <Typography>You do not have permission to access this page.</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{
      maxWidth: { xs: '100%', sm: 805, md: 1035 },
      mx: 'auto',
      px: { xs: 2, md: 2 },
      pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
      pb: 4,
      bgcolor: '#000000',
      minHeight: '100vh',
    }}>
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <Typography level="h2" sx={{ color: '#FFFFFF', mb: 1 }}>
              Today Page Module Manager
            </Typography>
            <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
              Control which modules are displayed on the /today page. Changes take effect immediately after saving.
            </Typography>
          </Box>

          <Divider sx={{ my: 3, bgcolor: '#333333' }} />

          {modulesError && (
            <Alert color="warning" sx={{ mb: 2, bgcolor: '#3a2a1a', borderColor: '#5a4a2a' }}>
              <Typography sx={{ color: '#FFFFFF' }}>
                Note: The module visibility table may not exist yet. Please run the migration script first.
                Default values are being displayed.
              </Typography>
            </Alert>
          )}

          {/* Two Grid Builders - One for Daily View, One for Weekly View */}
          <Box sx={{ mb: 4 }}>
            <Typography level="h3" sx={{ color: '#FFFFFF', mb: 2 }}>
              📐 Grid Layout Builders
            </Typography>
            <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 3 }}>
              Configure module layouts separately for daily views (past/present/future) and weekly views. Drag and drop modules to reorder, adjust grid sizes, and toggle visibility.
            </Typography>
            
            {/* Daily View Grid Builder */}
            <Box sx={{ mb: 4 }}>
              <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
                📅 Daily View Grid Builder
              </Typography>
              <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 2 }}>
                Controls modules shown on individual day views (past, present, future dates)
              </Typography>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={moduleOrder}
                strategy={verticalListSortingStrategy}
              >
                <Table hoverRow size="sm" sx={{ bgcolor: '#000000' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', color: '#FFFFFF' }}></th>
                      <th style={{ color: '#FFFFFF' }}>Module</th>
                      <th style={{ width: '100px', color: '#FFFFFF', textAlign: 'center' }}>Grid Size</th>
                      <th style={{ width: '80px', color: '#FFFFFF', textAlign: 'center' }}>Visible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleOrder.map((moduleName) => (
                      <SortableTableRow key={moduleName} moduleName={moduleName} />
                    ))}
                  </tbody>
                </Table>
              </SortableContext>
            </DndContext>
          </Box>

          {/* Weekly View Grid Builder */}
          <Box sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
              📆 Weekly View Grid Builder
            </Typography>
            <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 2 }}>
              Controls modules shown on weekly summary pages
            </Typography>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleWeeklyDragEnd}
            >
              <SortableContext
                items={weeklyModuleOrder}
                strategy={verticalListSortingStrategy}
              >
                <Table hoverRow size="sm" sx={{ bgcolor: '#000000' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', color: '#FFFFFF' }}></th>
                      <th style={{ color: '#FFFFFF' }}>Module</th>
                      <th style={{ width: '100px', color: '#FFFFFF', textAlign: 'center' }}>Grid Size</th>
                      <th style={{ width: '80px', color: '#FFFFFF', textAlign: 'center' }}>Visible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyModuleOrder.map((moduleName) => (
                      <SortableWeeklyTableRow key={moduleName} moduleName={moduleName} />
                    ))}
                  </tbody>
                </Table>
              </SortableContext>
            </DndContext>
          </Box>

          {/* Daily Grid Preview */}
          <Box sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
              Preview Layout
            </Typography>
            <Grid container spacing={2} sx={{ bgcolor: '#0a0a0a', p: 2, borderRadius: '8px' }}>
              {moduleOrder
                .filter(moduleName => localModules[moduleName]?.is_visible)
                .map((moduleName) => {
                  const def = DAILY_MODULE_DEFINITIONS.find(d => d.id === moduleName);
                  const gridSize = localModules[moduleName]?.grid_size ?? 4;
                  const gridSizeLabel = gridSize === 4 ? '1/3' : gridSize === 8 ? '2/3' : 'Full';
                  
                  return (
                    <Grid key={moduleName} xs={12} md={gridSize}>
                      <Card
                        variant="outlined"
                        sx={{
                          bgcolor: '#1a1a1a',
                          borderColor: '#333333',
                          p: 2,
                          minHeight: 80,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography level="title-sm" sx={{ color: '#FFFFFF', mb: 0.5 }}>
                            {def?.name || moduleName}
                          </Typography>
                          <Chip size="sm" variant="soft" color="primary">
                            {gridSizeLabel} width
                          </Chip>
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
            </Grid>
          </Box>
          </Box>

          <Divider sx={{ my: 3, bgcolor: '#333333' }} />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              color="neutral"
              onClick={handleReset}
              disabled={!hasChanges || updateMutation.isPending}
              startDecorator={<Refresh />}
              sx={{
                borderColor: '#FFFFFF',
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Reset
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
              loading={updateMutation.isPending}
              startDecorator={<Save />}
              sx={{
                bgcolor: '#FFC72C',
                color: '#000000',
                '&:hover': {
                  bgcolor: '#FFD700',
                },
              }}
            >
              Save Changes
            </Button>
          </Box>

          {updateMutation.isSuccess && (
            <Alert color="success" sx={{ mt: 2, bgcolor: '#1a3a1a', borderColor: '#2d5a2d' }}>
              <Typography sx={{ color: '#FFFFFF' }}>
                Module visibility settings saved successfully!
              </Typography>
            </Alert>
          )}

          {updateMutation.isError && (
            <Alert color="danger" sx={{ mt: 2, bgcolor: '#3a1a1a', borderColor: '#5a2d2d' }}>
              <Typography sx={{ color: '#FFFFFF' }}>
                Error saving settings: {updateMutation.error instanceof Error ? updateMutation.error.message : 'Unknown error'}
              </Typography>
            </Alert>
          )}

        </CardContent>
      </Card>
    </Box>
  );
}

