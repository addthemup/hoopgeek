import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface ProfileModuleVisibilityRow {
  module_name: string;
  is_visible: boolean;
  display_order: number;
  grid_size: number;
  grid_size_mobile: number;
}

export interface ProfileModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
    grid_size: number;
    grid_size_mobile: number;
  };
}

/** Defaults match migrations 20260323150000_profile_module_visibility + 20260324120000_split_prop_prediction_feed_profile_modules */
export const DEFAULT_PROFILE_MODULES: ProfileModuleVisibilityMap = {
  favorite_players: { is_visible: true, display_order: 0, grid_size: 12, grid_size_mobile: 12 },
  dfs_pools: { is_visible: true, display_order: 1, grid_size: 12, grid_size_mobile: 12 },
  slip_builder: { is_visible: true, display_order: 2, grid_size: 12, grid_size_mobile: 12 },
  prop_predictions: { is_visible: false, display_order: 99, grid_size: 12, grid_size_mobile: 12 },
  prop_predictions_over: { is_visible: true, display_order: 3, grid_size: 12, grid_size_mobile: 12 },
  prop_predictions_under: { is_visible: true, display_order: 4, grid_size: 12, grid_size_mobile: 12 },
  prop_predictions_team_confidence: { is_visible: true, display_order: 5, grid_size: 12, grid_size_mobile: 12 },
  prop_predictions_player_confidence: { is_visible: true, display_order: 6, grid_size: 12, grid_size_mobile: 12 },
  prop_performance: { is_visible: true, display_order: 7, grid_size: 12, grid_size_mobile: 12 },
  draft: { is_visible: true, display_order: 8, grid_size: 12, grid_size_mobile: 12 },
};

export function useProfileModuleVisibility() {
  return useQuery<ProfileModuleVisibilityMap>({
    queryKey: ['profile-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_module_visibility')
        .select('module_name, is_visible, display_order, grid_size, grid_size_mobile')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching profile module visibility:', error);
        return DEFAULT_PROFILE_MODULES;
      }

      const moduleMap: ProfileModuleVisibilityMap = {};
      (data || []).forEach((module: ProfileModuleVisibilityRow) => {
        moduleMap[module.module_name] = {
          is_visible: module.is_visible ?? true,
          display_order: module.display_order ?? 0,
          grid_size: module.grid_size ?? 12,
          grid_size_mobile: module.grid_size_mobile ?? 12,
        };
      });

      Object.entries(DEFAULT_PROFILE_MODULES).forEach(([name, def]) => {
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
