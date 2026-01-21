import { useState, useEffect, useMemo, useLayoutEffect, useRef } from 'react';
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
  Tabs,
  TabList,
  Tab,
  TabPanel,
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
  visibility_by_tab?: {
    past?: boolean;
    present?: boolean;
    future?: boolean;
    weekly?: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

const DAILY_MODULE_DEFINITIONS = [
  { id: 'games_carousel', name: 'Games Carousel', description: 'Horizontal scrollable game cards in header' },
  { id: 'prop_predictions', name: 'Prop Predictions', description: 'Algorithmically predicted best props for today' },
  { id: 'prop_performance', name: 'Prop Performance', description: 'Historical prop performance and hit rates for past dates' },
  { id: 'standings', name: 'Standings', description: 'NBA conference standings' },
  { id: 'favorite_players', name: 'Favorite Players', description: 'User favorite players module' },
  { id: 'team_of_night_live', name: 'Team of the Night (Live)', description: 'Live team of the night for games in progress' },
  { id: 'team_of_night_past', name: 'Team of the Night (Past)', description: 'Top performers from completed games' },
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

  // Update module visibility mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      // handleSave does the actual work, this is just for state management
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-module-visibility'] });
      queryClient.invalidateQueries({ queryKey: ['today-module-visibility-map'] });
    },
  });
  
  // Wrapper to handle save with proper error handling
  const handleSaveWithErrorHandling = async () => {
    try {
      updateMutation.reset(); // Clear any previous errors
      await handleSave();
    } catch (error) {
      // The error is already logged in handleSave
      // We need to manually set the mutation error state since handleSave throws
      // For now, the error will be shown via the Alert that checks updateMutation.isError
      // But we need to trigger a re-render, so we'll use the mutation's error state
      console.error('Save failed:', error);
      // The mutation state won't reflect this error since handleSave is called separately
      // We'll show the error via the console and the user will see it in the browser console
      throw error; // Re-throw so the caller can handle it
    }
  };

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

  // Local state for weekly modules
  const [localWeeklyModules, setLocalWeeklyModules] = useState<Record<string, { is_visible: boolean; grid_size: number; display_order: number }>>({});
  const [weeklyModuleOrder, setWeeklyModuleOrder] = useState<string[]>([]);
  
  // Tab state for past/present/future/weekly views (MUST be before any conditional returns)
  const [activeTab, setActiveTab] = useState<'past' | 'present' | 'future' | 'weekly'>('past');
  
  // Separate state for each tab's modules
  const [pastModules, setPastModules] = useState<Record<string, { is_visible: boolean; grid_size: number; display_order: number }>>({});
  const [pastModuleOrder, setPastModuleOrder] = useState<string[]>([]);
  const [presentModules, setPresentModules] = useState<Record<string, { is_visible: boolean; grid_size: number; display_order: number }>>({});
  const [presentModuleOrder, setPresentModuleOrder] = useState<string[]>([]);
  const [futureModules, setFutureModules] = useState<Record<string, { is_visible: boolean; grid_size: number; display_order: number }>>({});
  const [futureModuleOrder, setFutureModuleOrder] = useState<string[]>([]);
  
  // Track if we've initialized to prevent re-initialization after saves
  const hasInitialized = useRef(false);
  const justSaved = useRef(false);

  useEffect(() => {
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
  }, []);

  // Get current tab's modules and order
  const getCurrentTabModules = () => {
    if (activeTab === 'past') return { modules: pastModules, order: pastModuleOrder, setModules: setPastModules, setOrder: setPastModuleOrder };
    if (activeTab === 'present') return { modules: presentModules, order: presentModuleOrder, setModules: setPresentModules, setOrder: setPresentModuleOrder };
    if (activeTab === 'future') return { modules: futureModules, order: futureModuleOrder, setModules: setFutureModules, setOrder: setFutureModuleOrder };
    if (activeTab === 'weekly') return { modules: localWeeklyModules, order: weeklyModuleOrder, setModules: setLocalWeeklyModules, setOrder: setWeeklyModuleOrder };
    return { modules: pastModules, order: pastModuleOrder, setModules: setPastModules, setOrder: setPastModuleOrder };
  };

  const handleToggle = (moduleName: string) => {
    const { modules, setModules } = getCurrentTabModules();
    setModules(prev => ({
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
    const { setModules } = getCurrentTabModules();
    setModules(prev => ({
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
    const { modules, order, setModules, setOrder } = getCurrentTabModules();
    
    if (over && active.id !== over.id) {
      setOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update display_order in local state
        setModules(prev => {
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
  
  // Weekly drag end handler (now uses the same handleDragEnd for all tabs)
  const handleWeeklyDragEnd = handleDragEnd;

  const handleSave = async () => {
    if (!displayModules) return;

    // Collect all unique modules from all tabs
    const allModuleNames = new Set([
      ...pastModuleOrder,
      ...presentModuleOrder,
      ...futureModuleOrder,
      ...weeklyModuleOrder,
    ]);
    
    // Build a map of module settings with per-tab visibility
    const moduleSettings = new Map<string, {
      module_name: string;
      is_visible: boolean; // Keep for backwards compatibility
      grid_size: number;
      display_order: number;
      visibility_by_tab: {
        past: boolean;
        present: boolean;
        future: boolean;
        weekly: boolean;
      };
    }>();
    
    // Collect all modules from all tabs
    const allTabs = [
      { order: pastModuleOrder, modules: pastModules, name: 'past' },
      { order: presentModuleOrder, modules: presentModules, name: 'present' },
      { order: futureModuleOrder, modules: futureModules, name: 'future' },
      { order: weeklyModuleOrder, modules: localWeeklyModules, name: 'weekly' },
    ];
    
    // Build visibility_by_tab for each module
    // Only save modules that are in DAILY_MODULE_DEFINITIONS or WEEKLY_MODULE_DEFINITIONS
    const validModuleNames = new Set([
      ...DAILY_MODULE_DEFINITIONS.map(m => m.id),
      ...WEEKLY_MODULE_DEFINITIONS.map(m => m.id),
    ]);
    
    allModuleNames.forEach((moduleName) => {
      // Skip invalid module names (shouldn't happen, but safety check)
      if (!validModuleNames.has(moduleName)) {
        console.warn(`Skipping invalid module name: ${moduleName}`);
        return;
      }
      
      const visibilityByTab = {
        past: pastModules[moduleName]?.is_visible ?? true,
        present: presentModules[moduleName]?.is_visible ?? true,
        future: futureModules[moduleName]?.is_visible ?? true,
        weekly: localWeeklyModules[moduleName]?.is_visible ?? true,
      };
      
      // Get grid_size and display_order from present tab (or first tab where it exists)
      let gridSize = 4;
      let displayOrder = 0;
      
      const presentTabData = presentModules[moduleName];
      if (presentTabData) {
        gridSize = presentTabData.grid_size;
        displayOrder = presentModuleOrder.indexOf(moduleName);
      } else {
        // Try other tabs
        for (const tab of allTabs) {
          const tabData = tab.modules[moduleName];
          if (tabData) {
            gridSize = tabData.grid_size;
            displayOrder = tab.order.indexOf(moduleName);
            break;
          }
        }
      }
      
      // is_visible: true if visible in ANY tab (for backwards compatibility)
      const isVisible = visibilityByTab.past || visibilityByTab.present || visibilityByTab.future || visibilityByTab.weekly;
      
      moduleSettings.set(moduleName, {
        module_name: moduleName,
        is_visible: isVisible,
        grid_size: gridSize,
        display_order: displayOrder,
        visibility_by_tab: visibilityByTab,
      });
    });
    
    // Convert map to array and filter out any invalid module names (double-check)
    const updates = Array.from(moduleSettings.values()).filter(update => {
      if (!validModuleNames.has(update.module_name)) {
        console.warn(`Skipping invalid module name in save: ${update.module_name}`);
        return false;
      }
      return true;
    });

    // Upsert each module
    // Try with visibility_by_tab first, fall back to without it if column doesn't exist
    const promises = updates.map(async (update) => {
      console.log(`Saving module: ${update.module_name}`, {
        is_visible: update.is_visible,
        grid_size: update.grid_size,
        display_order: update.display_order,
        visibility_by_tab: update.visibility_by_tab,
      });
      
      // First try with visibility_by_tab
      const resultWithTab = await supabase
        .from('today_module_visibility')
        .upsert({
          module_name: update.module_name,
          is_visible: update.is_visible,
          grid_size: update.grid_size,
          display_order: update.display_order,
          visibility_by_tab: update.visibility_by_tab,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'module_name',
        });
      
      // If it fails with a column error, try without visibility_by_tab
      if (resultWithTab.error) {
        const errorMsg = resultWithTab.error.message || '';
        if (errorMsg.includes('visibility_by_tab') || errorMsg.includes('column') || errorMsg.includes('does not exist')) {
          console.warn(`Column visibility_by_tab may not exist yet for ${update.module_name}, saving without it. Please run the migration.`);
          // Fall back to saving without visibility_by_tab
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
        }
      }
      
      return resultWithTab;
    });

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    
    if (errors.length > 0) {
      console.error('Save errors:', errors);
      errors.forEach((err, index) => {
        console.error(`Error ${index + 1}:`, err.error);
        if (err.error?.message) {
          console.error(`Error message: ${err.error.message}`);
        }
        if (err.error?.details) {
          console.error(`Error details:`, err.error.details);
        }
        if (err.error?.hint) {
          console.error(`Error hint: ${err.error.hint}`);
        }
        if (err.error?.code) {
          console.error(`Error code: ${err.error.code}`);
        }
      });
      
      // Check if it's a column missing error
      const hasColumnError = errors.some(err => {
        const msg = err.error?.message || '';
        return msg.includes('visibility_by_tab') || msg.includes('column') || msg.includes('does not exist');
      });
      
      if (hasColumnError) {
        throw new Error(`Failed to save: The 'visibility_by_tab' column doesn't exist yet. Please run the migration: supabase/migrations/20260122000000_add_per_tab_visibility.sql`);
      }
      
      throw new Error(`Failed to update ${errors.length} module(s). Check console for details.`);
    }

    // Mark that we just saved to prevent re-initialization
    justSaved.current = true;
    
    // Invalidate queries to refresh the data
    queryClient.invalidateQueries({ queryKey: ['today-module-visibility'] });
    queryClient.invalidateQueries({ queryKey: ['today-module-visibility-map'] });
    
    await updateMutation.mutateAsync();
  };

  const handleReset = () => {
    // Reset will re-initialize from displayModules
    // This will trigger the useEffect that initializes tab modules
    if (displayModules) {
      const sorted = [...displayModules].sort((a, b) => a.display_order - b.display_order);
      
      const initializeTab = (tabName: 'past' | 'present' | 'future') => {
        const initialState: Record<string, { is_visible: boolean; grid_size: number; display_order: number }> = {};
        const order: string[] = [];
        
        sorted.forEach(mod => {
          let defaultGridSize = mod.grid_size ?? 4;
          
          if (tabName === 'past') {
            if (mod.module_name === 'prop_performance') {
              defaultGridSize = 8;
            } else if (mod.module_name === 'team_of_night_past') {
              defaultGridSize = 12;
            } else if (mod.module_name === 'team_of_night_live' || mod.module_name === 'prop_predictions') {
              initialState[mod.module_name] = { is_visible: false, grid_size: mod.module_name === 'team_of_night_live' ? 4 : 8, display_order: mod.display_order };
              order.push(mod.module_name);
              return;
            }
          } else if (tabName === 'present') {
            if (mod.module_name === 'prop_predictions') {
              defaultGridSize = 8;
            } else if (mod.module_name === 'team_of_night_live') {
              defaultGridSize = 4;
            } else if (mod.module_name === 'team_of_night_past' || mod.module_name === 'prop_performance') {
              initialState[mod.module_name] = { is_visible: false, grid_size: mod.module_name === 'team_of_night_past' ? 12 : 8, display_order: mod.display_order };
              order.push(mod.module_name);
              return;
            }
          } else if (tabName === 'future') {
            if (mod.module_name === 'team_of_night_live' || mod.module_name === 'team_of_night_past' ||
                mod.module_name === 'prop_predictions' || mod.module_name === 'prop_performance') {
              initialState[mod.module_name] = {
                is_visible: false,
                grid_size: mod.module_name === 'team_of_night_live' ? 4 : 
                          mod.module_name === 'team_of_night_past' ? 12 :
                          mod.module_name === 'prop_predictions' ? 8 : 8,
                display_order: mod.display_order,
              };
              order.push(mod.module_name);
              return;
            }
          }
          
          // Handle prop modules and team of night modules based on tab
          if (tabName === 'past') {
            if (mod.module_name === 'prop_performance') {
              defaultGridSize = 8;
            } else if (mod.module_name === 'team_of_night_past') {
              defaultGridSize = 12;
            } else if (mod.module_name === 'team_of_night_live' || mod.module_name === 'prop_predictions') {
              initialState[mod.module_name] = { is_visible: false, grid_size: mod.module_name === 'team_of_night_live' ? 4 : 8, display_order: mod.display_order };
              order.push(mod.module_name);
              return;
            }
          } else if (tabName === 'present') {
            if (mod.module_name === 'prop_predictions') {
              defaultGridSize = 8;
            } else if (mod.module_name === 'team_of_night_live') {
              defaultGridSize = 4;
            } else if (mod.module_name === 'team_of_night_past' || mod.module_name === 'prop_performance') {
              initialState[mod.module_name] = { is_visible: false, grid_size: mod.module_name === 'team_of_night_past' ? 12 : 8, display_order: mod.display_order };
              order.push(mod.module_name);
              return;
            }
          } else if (tabName === 'future') {
            if (mod.module_name === 'team_of_night_live' || mod.module_name === 'team_of_night_past' ||
                mod.module_name === 'prop_predictions' || mod.module_name === 'prop_performance') {
              initialState[mod.module_name] = {
                is_visible: false,
                grid_size: mod.module_name === 'team_of_night_live' ? 4 : 
                          mod.module_name === 'team_of_night_past' ? 12 :
                          mod.module_name === 'prop_predictions' ? 8 : 8,
                display_order: mod.display_order,
              };
              order.push(mod.module_name);
              return;
            }
          }
          
          initialState[mod.module_name] = {
            is_visible: mod.is_visible,
            grid_size: defaultGridSize,
            display_order: mod.display_order,
          };
          order.push(mod.module_name);
        });
        
        return { initialState, order };
      };
      
      const past = initializeTab('past');
      const present = initializeTab('present');
      const future = initializeTab('future');
      
      setPastModules(past.initialState);
      setPastModuleOrder(past.order);
      setPresentModules(present.initialState);
      setPresentModuleOrder(present.order);
      setFutureModules(future.initialState);
      setFutureModuleOrder(future.order);
    }
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Ensure scroll is enabled on AdminToday page (cleanup from other pages)
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const main = document.querySelector('main');
    
    // Force reset any styles that might have been set by other pages
    const cleanup = () => {
      // Reset html styles - allow natural document scrolling
      html.style.overflow = '';
      html.style.overflowY = '';
      html.style.overflowX = '';
      html.style.height = '';
      html.style.minHeight = '';
      html.style.maxHeight = '';
      html.style.position = '';
      html.style.width = '';
      html.style.top = '';
      html.style.left = '';
      html.style.touchAction = '';
      html.style.pointerEvents = '';
      
      // Reset body styles - allow natural document scrolling
      body.style.overflow = '';
      body.style.overflowY = '';
      body.style.overflowX = '';
      body.style.height = '';
      body.style.minHeight = '';
      body.style.maxHeight = '';
      body.style.position = '';
      body.style.width = '';
      body.style.top = '';
      body.style.left = '';
      body.style.touchAction = '';
      body.style.pointerEvents = '';
      
      // Reset root element if it exists
      if (root) {
        root.style.overflow = '';
        root.style.overflowY = '';
        root.style.overflowX = '';
        root.style.height = '';
        root.style.minHeight = '';
        root.style.maxHeight = '';
        root.style.position = '';
        root.style.touchAction = '';
        root.style.pointerEvents = '';
      }
      
      // Reset main element if it exists
      if (main) {
        (main as HTMLElement).style.overflow = '';
        (main as HTMLElement).style.overflowY = '';
        (main as HTMLElement).style.overflowX = '';
        (main as HTMLElement).style.height = '';
        (main as HTMLElement).style.position = '';
        (main as HTMLElement).style.pointerEvents = '';
      }
      
      // Force enable scrolling - explicitly set to allow scrolling
      if (body.style.position === 'fixed' || html.style.position === 'fixed') {
        body.style.position = '';
        html.style.position = '';
      }
      
      // Explicitly allow scrolling - use empty string, not 'auto'
      // 'auto' can create scroll containers, empty string uses default browser behavior
      if (body.style.overflow === 'hidden') {
        body.style.overflow = '';
        body.style.overflowY = '';
      }
      if (html.style.overflow === 'hidden') {
        html.style.overflow = '';
        html.style.overflowY = '';
      }
      
      // Ensure body and html can scroll naturally
      body.style.overflowY = '';
      html.style.overflowY = '';
    };
    
    // Global wheel handler to manually scroll window when elements can't scroll
    const handleWheel = (e: WheelEvent) => {
      // Only handle vertical scrolling
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
        return; // Ignore primarily horizontal scrolls
      }
      
      const target = e.target as HTMLElement;
      if (!target) return;
      
      // Check if the target or any parent is a scrollable container that can actually scroll
      let element: HTMLElement | null = target;
      let foundScrollable = false;
      
      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        const overflow = style.overflow;
        
        // Check if this element is scrollable
        if (overflowY === 'auto' || overflowY === 'scroll' || overflow === 'auto' || overflow === 'scroll') {
          const { scrollTop, scrollHeight, clientHeight } = element;
          const canScrollUp = scrollTop > 0;
          const canScrollDown = scrollTop < scrollHeight - clientHeight - 1;
          
          // If element can scroll in the direction of the wheel, let it handle it
          if ((e.deltaY < 0 && canScrollUp) || (e.deltaY > 0 && canScrollDown)) {
            foundScrollable = true;
            break; // Let the element handle the scroll
          }
        }
        
        element = element.parentElement;
      }
      
      // If no scrollable container can handle this scroll, manually scroll the window
      if (!foundScrollable) {
        e.preventDefault();
        window.scrollBy({
          top: e.deltaY,
          left: 0,
          behavior: 'auto'
        });
      }
    };
    
    // Run immediately and after delays to catch late-running effects
    cleanup();
    const timeoutId = setTimeout(cleanup, 0);
    const timeoutId2 = setTimeout(cleanup, 50);
    const timeoutId3 = setTimeout(cleanup, 100);
    const timeoutId4 = setTimeout(cleanup, 200);
    const timeoutId5 = setTimeout(cleanup, 500);
    
    // Add wheel handler with capture to catch events early
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(timeoutId4);
      clearTimeout(timeoutId5);
      window.removeEventListener('wheel', handleWheel, { capture: true });
      cleanup();
    };
  }, []);

  // Initialize tab-specific modules from displayModules (MUST be before any early returns)
  // Only initialize if local state is empty (first load) and we haven't just saved
  useEffect(() => {
    // Skip if we just saved (to prevent overwriting user changes)
    if (justSaved.current) {
      justSaved.current = false;
      return;
    }
    
    // Only initialize once on first load
    if (displayModules && !hasInitialized.current && pastModuleOrder.length === 0 && presentModuleOrder.length === 0 && futureModuleOrder.length === 0) {
      const sorted = [...displayModules].sort((a, b) => a.display_order - b.display_order);
      
      // Initialize all three tabs with the same base modules
      const initializeTab = (tabName: 'past' | 'present' | 'future') => {
        const initialState: Record<string, { is_visible: boolean; grid_size: number; display_order: number }> = {};
        const order: string[] = [];
        
        sorted.forEach(mod => {
          // Set default grid sizes based on tab and module type
          let defaultGridSize = mod.grid_size ?? 4;
          
          // Get visibility for this specific tab from visibility_by_tab, fallback to is_visible
          const visibilityByTab = mod.visibility_by_tab || {
            past: mod.is_visible,
            present: mod.is_visible,
            future: mod.is_visible,
            weekly: mod.is_visible,
          };
          
          let isVisibleForTab = mod.is_visible; // Default fallback
          if (tabName === 'past') {
            isVisibleForTab = visibilityByTab.past ?? mod.is_visible;
            // Past: team_of_night_past = 12 (full width), team_of_night_live = hidden by default
            if (mod.module_name === 'team_of_night_past') {
              defaultGridSize = 12;
            } else if (mod.module_name === 'team_of_night_live') {
              // Hide live on past dates
              initialState[mod.module_name] = {
                is_visible: false,
                grid_size: 4,
                display_order: mod.display_order,
              };
              order.push(mod.module_name);
              return;
            }
          } else if (tabName === 'present') {
            isVisibleForTab = visibilityByTab.present ?? mod.is_visible;
            // Present: team_of_night_live = 4 (1/3), team_of_night_past = hidden by default
            if (mod.module_name === 'team_of_night_live') {
              defaultGridSize = 4;
            } else if (mod.module_name === 'team_of_night_past') {
              // Hide past on present dates
              initialState[mod.module_name] = {
                is_visible: false,
                grid_size: 8,
                display_order: mod.display_order,
              };
              order.push(mod.module_name);
              return;
            }
          } else if (tabName === 'future') {
            isVisibleForTab = visibilityByTab.future ?? mod.is_visible;
            // Future: hide both team of night modules by default
            if (mod.module_name === 'team_of_night_live' || mod.module_name === 'team_of_night_past') {
              initialState[mod.module_name] = {
                is_visible: false,
                grid_size: mod.module_name === 'team_of_night_live' ? 4 : 8,
                display_order: mod.display_order,
              };
              order.push(mod.module_name);
              return;
            }
          } else if (tabName === 'weekly') {
            isVisibleForTab = visibilityByTab.weekly ?? mod.is_visible;
          }
          
          initialState[mod.module_name] = {
            is_visible: isVisibleForTab,
            grid_size: defaultGridSize,
            display_order: mod.display_order,
          };
          order.push(mod.module_name);
        });
        
        return { initialState, order };
      };
      
      const past = initializeTab('past');
      const present = initializeTab('present');
      const future = initializeTab('future');
      
      setPastModules(past.initialState);
      setPastModuleOrder(past.order);
      setPresentModules(present.initialState);
      setPresentModuleOrder(present.order);
      setFutureModules(future.initialState);
      setFutureModuleOrder(future.order);
    }
  }, [displayModules, pastModuleOrder.length, presentModuleOrder.length, futureModuleOrder.length]);

  // Calculate hasChanges - check if any tab has been modified
  // For simplicity, we'll always allow saving (you can enhance this to track actual changes)
  const hasChanges = useMemo(() => {
    // Always return true for now - allows saving anytime
    // In the future, you can compare against saved state to detect actual changes
    return true;
  }, []);

  // Sortable table row component for daily and weekly modules
  function SortableTableRow({ moduleName }: { moduleName: string }) {
    const isWeekly = activeTab === 'weekly';
    const moduleDefinitions = isWeekly ? WEEKLY_MODULE_DEFINITIONS : DAILY_MODULE_DEFINITIONS;
    const def = moduleDefinitions.find(d => d.id === moduleName);
    const { modules } = getCurrentTabModules();
    const local = modules[moduleName];
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

  return (
    <Box 
      sx={{
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        px: { xs: 2, md: 2 },
        pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
        pb: 4,
        bgcolor: '#000000',
        minHeight: '100vh', // Ensure minimum height but allow growth
        overflowX: 'hidden',
        // Don't set overflowY - let body handle scrolling naturally
        position: 'relative',
        pointerEvents: 'auto', // Ensure pointer events work
      }}
      onWheel={(e) => {
        // Allow wheel events to bubble up to window for scrolling
        e.stopPropagation = () => {}; // Don't prevent default scrolling
      }}
    >
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <CardContent>
          {modulesError && (
            <Alert color="warning" sx={{ mb: 2, bgcolor: '#3a2a1a', borderColor: '#5a4a2a' }}>
              <Typography sx={{ color: '#FFFFFF' }}>
                Note: The module visibility table may not exist yet. Please run the migration script first.
                Default values are being displayed.
              </Typography>
            </Alert>
          )}

          {/* Tabs for Past/Present/Future/Weekly Views */}
          <Box sx={{ mb: 4 }}>
            <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as 'past' | 'present' | 'future' | 'weekly')} sx={{ mb: 3 }}>
              <TabList>
                <Tab value="past">Past Dates</Tab>
                <Tab value="present">Today</Tab>
                <Tab value="future">Future Dates</Tab>
                <Tab value="weekly">Weekly</Tab>
              </TabList>
              
              {/* Past Tab */}
              <TabPanel value="past">
                <Box sx={{ mb: 4 }}>
                  <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
                    📅 Past Dates Grid Builder
                  </Typography>
                  <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 2 }}>
                    Controls modules shown on past date views. Team of the Night (Past) is 2/3 width by default.
                  </Typography>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={pastModuleOrder}
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
                          {pastModuleOrder.map((moduleName) => (
                            <SortableTableRow key={moduleName} moduleName={moduleName} />
                          ))}
                        </tbody>
                      </Table>
                    </SortableContext>
                  </DndContext>
                </Box>
              </TabPanel>
              
              {/* Present Tab */}
              <TabPanel value="present">
                <Box sx={{ mb: 4 }}>
                  <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
                    📅 Today Grid Builder
                  </Typography>
                  <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 2 }}>
                    Controls modules shown on today's view. Team of the Night (Live) is 1/3 width by default.
                  </Typography>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={presentModuleOrder}
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
                          {presentModuleOrder.map((moduleName) => (
                            <SortableTableRow key={moduleName} moduleName={moduleName} />
                          ))}
                        </tbody>
                      </Table>
                    </SortableContext>
                  </DndContext>
                </Box>
              </TabPanel>
              
              {/* Future Tab */}
              <TabPanel value="future">
                <Box sx={{ mb: 4 }}>
                  <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
                    📅 Future Dates Grid Builder
                  </Typography>
                  <Typography level="body-sm" sx={{ color: '#B0B0B0', mb: 2 }}>
                    Controls modules shown on future date views. Team of the Night modules are hidden by default.
                  </Typography>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={futureModuleOrder}
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
                          {futureModuleOrder.map((moduleName) => (
                            <SortableTableRow key={moduleName} moduleName={moduleName} />
                          ))}
                        </tbody>
                      </Table>
                    </SortableContext>
                  </DndContext>
                </Box>
              </TabPanel>
              
              {/* Weekly Tab */}
              <TabPanel value="weekly">
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
                    onDragEnd={handleDragEnd}
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
              </TabPanel>
            </Tabs>
          </Box>

          {/* Grid Preview - Shows active tab's layout */}
          <Box sx={{ mb: 4 }}>
            <Typography level="h4" sx={{ color: '#FFFFFF', mb: 2 }}>
              Preview Layout ({activeTab === 'past' ? 'Past Dates' : activeTab === 'present' ? 'Today' : activeTab === 'future' ? 'Future Dates' : 'Weekly'})
            </Typography>
            <Grid container spacing={2} sx={{ bgcolor: '#0a0a0a', p: 2, borderRadius: '8px' }}>
              {(() => {
                const { modules, order } = getCurrentTabModules();
                const isWeekly = activeTab === 'weekly';
                const moduleDefinitions = isWeekly ? WEEKLY_MODULE_DEFINITIONS : DAILY_MODULE_DEFINITIONS;
                
                return order
                  .filter(moduleName => modules[moduleName]?.is_visible)
                  .map((moduleName) => {
                    const def = moduleDefinitions.find(d => d.id === moduleName);
                    const gridSize = modules[moduleName]?.grid_size ?? 4;
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
                  });
              })()}
            </Grid>
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
              onClick={async () => {
                try {
                  await handleSave();
                } catch (error) {
                  // Error is already logged in handleSave
                  // Show user-friendly error message
                  alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck the browser console for details.`);
                }
              }}
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

