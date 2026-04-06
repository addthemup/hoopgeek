import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface GameModuleVisibility {
  module_name: string;
  is_visible: boolean;
  display_order: number;
}

export interface GameModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
  };
}

export const GAME_MODULE_DEFINITIONS = [
  { id: 'stats', name: 'Stats', description: 'Basic and advanced stats in one module with Basic / Advanced tabs' },
  { id: 'team_comparison', name: 'Team Comparison', description: 'Team analytics comparison (last 10 games)' },
  { id: 'props', name: 'Props', description: 'Player prop lines for the game' },
  { id: 'hit_rates', name: 'Hit Rates', description: 'Prop hit rates vs each team defense' },
  { id: 'estimated_rotation', name: 'Estimated Rotation', description: 'Injury-adjusted minute estimates and likely rotation' },
] as const;

export const DEFAULT_GAME_MODULES: GameModuleVisibilityMap = {
  stats: { is_visible: true, display_order: 0 },
  team_comparison: { is_visible: true, display_order: 1 },
  props: { is_visible: true, display_order: 2 },
  hit_rates: { is_visible: true, display_order: 3 },
  estimated_rotation: { is_visible: true, display_order: 4 },
};

export function useGameModuleVisibility() {
  return useQuery<GameModuleVisibilityMap>({
    queryKey: ['game-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_module_visibility')
        .select('module_name, is_visible, display_order')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching game module visibility:', error);
        return DEFAULT_GAME_MODULES;
      }

      const moduleMap: GameModuleVisibilityMap = {};
      (data || []).forEach((module) => {
        moduleMap[module.module_name] = {
          is_visible: module.is_visible ?? true,
          display_order: module.display_order ?? 0,
        };
      });

      Object.entries(DEFAULT_GAME_MODULES).forEach(([name, def]) => {
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
