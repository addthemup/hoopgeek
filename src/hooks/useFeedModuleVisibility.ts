import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface FeedModuleVisibility {
  module_name: string;
  is_visible: boolean;
  display_order: number;
  grid_size: number;
  grid_size_mobile: number;
}

export interface FeedModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
    grid_size: number;
    grid_size_mobile: number;
  };
}

export const DEFAULT_FEED_MODULES: FeedModuleVisibilityMap = {
  games_carousel: { is_visible: true, display_order: 0, grid_size: 12, grid_size_mobile: 12 },
  feed_posts: { is_visible: true, display_order: 1, grid_size: 12, grid_size_mobile: 12 },
  prop_predictions: { is_visible: true, display_order: 2, grid_size: 8, grid_size_mobile: 12 },
  prop_performance: { is_visible: true, display_order: 3, grid_size: 8, grid_size_mobile: 12 },
  standings: { is_visible: true, display_order: 4, grid_size: 4, grid_size_mobile: 12 },
  favorite_players: { is_visible: true, display_order: 5, grid_size: 4, grid_size_mobile: 12 },
  team_of_night_live: { is_visible: true, display_order: 6, grid_size: 4, grid_size_mobile: 12 },
  team_of_night_past: { is_visible: true, display_order: 7, grid_size: 8, grid_size_mobile: 12 },
  leaders: { is_visible: true, display_order: 8, grid_size: 4, grid_size_mobile: 12 },
  injuries: { is_visible: true, display_order: 9, grid_size: 4, grid_size_mobile: 12 },
  team_of_week: { is_visible: true, display_order: 10, grid_size: 8, grid_size_mobile: 12 },
  best_games: { is_visible: true, display_order: 11, grid_size: 8, grid_size_mobile: 12 },
  draft: { is_visible: true, display_order: 12, grid_size: 4, grid_size_mobile: 12 },
};

export function useFeedModuleVisibility() {
  return useQuery<FeedModuleVisibilityMap>({
    queryKey: ['feed-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_module_visibility')
        .select('module_name, is_visible, display_order, grid_size, grid_size_mobile')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching feed module visibility:', error);
        return DEFAULT_FEED_MODULES;
      }

      const moduleMap: FeedModuleVisibilityMap = {};
      (data || []).forEach((module) => {
        moduleMap[module.module_name] = {
          is_visible: module.is_visible ?? true,
          display_order: module.display_order ?? 0,
          grid_size: module.grid_size ?? 4,
          grid_size_mobile: module.grid_size_mobile ?? 12,
        };
      });

      // Ensure all expected modules have a value
      Object.entries(DEFAULT_FEED_MODULES).forEach(([name, def]) => {
        if (!(name in moduleMap)) {
          moduleMap[name] = def;
        }
      });

      return moduleMap;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
