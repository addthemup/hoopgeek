import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import type { FeedDesktopDrawerLayout } from '../utils/feedDrawerDesktopPack';

export interface FeedModuleVisibility {
  module_name: string;
  is_visible: boolean;
  display_order: number;
  grid_size: number;
  grid_size_mobile: number;
  desktop_layout: FeedDesktopDrawerLayout;
}

export interface FeedModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
    grid_size: number;
    grid_size_mobile: number;
    /** Desktop inset drawer: tile shape within each 2×2 carousel slide */
    desktop_layout: FeedDesktopDrawerLayout;
  };
}

const cell = { desktop_layout: 'cell' as const };

export const DEFAULT_FEED_MODULES: FeedModuleVisibilityMap = {
  games_carousel: { is_visible: true, display_order: 0, grid_size: 12, grid_size_mobile: 12, ...cell },
  /** Legacy single card — prefer the four split modules below */
  prop_predictions: { is_visible: false, display_order: 99, grid_size: 8, grid_size_mobile: 12, ...cell },
  prop_predictions_over: { is_visible: true, display_order: 2, grid_size: 6, grid_size_mobile: 12, ...cell },
  prop_predictions_under: { is_visible: true, display_order: 3, grid_size: 6, grid_size_mobile: 12, ...cell },
  prop_predictions_team_confidence: { is_visible: true, display_order: 4, grid_size: 6, grid_size_mobile: 12, ...cell },
  prop_predictions_player_confidence: { is_visible: true, display_order: 5, grid_size: 6, grid_size_mobile: 12, ...cell },
  slip_builder: { is_visible: true, display_order: 6, grid_size: 4, grid_size_mobile: 12, ...cell },
  prop_performance: { is_visible: true, display_order: 7, grid_size: 8, grid_size_mobile: 12, ...cell },
  standings: { is_visible: true, display_order: 8, grid_size: 4, grid_size_mobile: 12, desktop_layout: 'tall' },
  favorite_players: { is_visible: true, display_order: 9, grid_size: 4, grid_size_mobile: 12, ...cell },
  totn_totw: { is_visible: true, display_order: 10, grid_size: 8, grid_size_mobile: 12, ...cell },
  leaders: { is_visible: true, display_order: 11, grid_size: 4, grid_size_mobile: 12, ...cell },
  injuries: { is_visible: true, display_order: 12, grid_size: 4, grid_size_mobile: 12, ...cell },
  best_games: { is_visible: true, display_order: 13, grid_size: 8, grid_size_mobile: 12, ...cell },
  draft: { is_visible: true, display_order: 14, grid_size: 4, grid_size_mobile: 12, ...cell },
  dfs_pools: { is_visible: true, display_order: 15, grid_size: 4, grid_size_mobile: 12, ...cell },
};

export function useFeedModuleVisibility() {
  return useQuery<FeedModuleVisibilityMap>({
    queryKey: ['feed-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_module_visibility')
        .select('module_name, is_visible, display_order, grid_size, grid_size_mobile, desktop_layout')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching feed module visibility:', error);
        return DEFAULT_FEED_MODULES;
      }

      const moduleMap: FeedModuleVisibilityMap = {};
      (data || []).forEach((module: FeedModuleVisibility) => {
        moduleMap[module.module_name] = {
          is_visible: module.is_visible ?? true,
          display_order: module.display_order ?? 0,
          grid_size: module.grid_size ?? 4,
          grid_size_mobile: module.grid_size_mobile ?? 12,
          desktop_layout:
            module.desktop_layout === 'tall' ||
            module.desktop_layout === 'wide' ||
            module.desktop_layout === 'full' ||
            module.desktop_layout === 'cell'
              ? module.desktop_layout
              : 'cell',
        };
      });

      // Ensure all expected modules have a value (including desktop_layout after new column)
      Object.entries(DEFAULT_FEED_MODULES).forEach(([name, def]) => {
        if (!(name in moduleMap)) {
          moduleMap[name] = def;
        } else {
          const cur = moduleMap[name];
          if (!cur.desktop_layout) {
            moduleMap[name] = { ...cur, desktop_layout: def.desktop_layout };
          }
        }
      });

      // Main feed stories always live on /feed/; not a drawer module (see feedDrawerTabs).
      delete moduleMap.feed_posts;

      return moduleMap;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
