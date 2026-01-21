import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface ModuleVisibility {
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
}

export interface ModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
    grid_size: number;
    visibility_by_tab?: {
      past?: boolean;
      present?: boolean;
      future?: boolean;
      weekly?: boolean;
    };
  };
}

export function useTodayModuleVisibility() {
  return useQuery<ModuleVisibilityMap>({
    queryKey: ['today-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('today_module_visibility')
        .select('module_name, is_visible, display_order, grid_size, visibility_by_tab')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching module visibility:', error);
        // Return all modules visible as default if table doesn't exist or error
        const defaultModules = {
          games_carousel: { is_visible: true, display_order: 0, grid_size: 12 },
          prop_predictions: { is_visible: true, display_order: 1, grid_size: 8 },
          standings: { is_visible: true, display_order: 2, grid_size: 4 },
          favorite_players: { is_visible: true, display_order: 3, grid_size: 4 },
          team_of_night_live: { is_visible: true, display_order: 4, grid_size: 4 },
          team_of_night_past: { is_visible: true, display_order: 5, grid_size: 8 },
          leaders: { is_visible: true, display_order: 6, grid_size: 4 },
          team_of_week: { is_visible: true, display_order: 7, grid_size: 8 },
        };
        return defaultModules;
      }

      // Convert array to object for easier lookup
      const moduleMap: ModuleVisibilityMap = {};
      (data || []).forEach((module) => {
        // Get visibility_by_tab from database, or create default from is_visible
        const visibilityByTab = module.visibility_by_tab || {
          past: module.is_visible,
          present: module.is_visible,
          future: module.is_visible,
          weekly: module.is_visible,
        };
        
        moduleMap[module.module_name] = {
          is_visible: module.is_visible,
          display_order: module.display_order ?? 0,
          grid_size: module.grid_size ?? 4,
          visibility_by_tab: visibilityByTab,
        };
      });

      // Ensure all modules have a default value
      const defaultModules = [
        { name: 'games_carousel', order: 0, size: 12 },
        { name: 'prop_predictions', order: 1, size: 8 },
        { name: 'prop_performance', order: 2, size: 8 },
        { name: 'standings', order: 3, size: 4 },
        { name: 'favorite_players', order: 4, size: 4 },
        { name: 'team_of_night_live', order: 5, size: 4 },
        { name: 'team_of_night_past', order: 6, size: 12 },
        { name: 'leaders', order: 7, size: 4 },
        { name: 'team_of_week', order: 8, size: 8 },
      ];

      defaultModules.forEach((def) => {
        if (!(def.name in moduleMap)) {
          moduleMap[def.name] = {
            is_visible: true,
            display_order: def.order,
            grid_size: def.size,
            visibility_by_tab: {
              past: true,
              present: true,
              future: true,
              weekly: true,
            },
          };
        }
      });

      return moduleMap;
    },
    staleTime: 0, // Always refetch to get latest settings
    gcTime: 0, // Don't cache, always get fresh data (React Query v5)
    retry: false,
  });
}

