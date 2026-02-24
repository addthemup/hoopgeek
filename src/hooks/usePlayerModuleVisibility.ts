import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface PlayerModuleVisibility {
  module_name: string;
  is_visible: boolean;
  display_order: number;
}

export interface PlayerModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
  };
}

export const PLAYER_MODULE_DEFINITIONS = [
  { id: 'game_logs', name: 'Game Logs', description: 'Season game log table (traditional, advanced, fantasy, props views)' },
  { id: 'props', name: 'Props', description: 'Player prop bets grouped by game' },
  { id: 'stats', name: 'Stats', description: 'Advanced stats, charts, and radar visualizations' },
  { id: 'info', name: 'Info', description: 'General player information and bio' },
  { id: 'injuries', name: 'Injuries', description: 'Injury history and current status' },
  { id: 'awards', name: 'Awards', description: 'TOTN, TOTW, POW, POM awards' },
] as const;

export const DEFAULT_PLAYER_MODULES: PlayerModuleVisibilityMap = {
  game_logs: { is_visible: true, display_order: 0 },
  props: { is_visible: true, display_order: 1 },
  stats: { is_visible: true, display_order: 2 },
  info: { is_visible: true, display_order: 3 },
  injuries: { is_visible: true, display_order: 4 },
  awards: { is_visible: true, display_order: 5 },
};

export function usePlayerModuleVisibility() {
  return useQuery<PlayerModuleVisibilityMap>({
    queryKey: ['player-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_module_visibility')
        .select('module_name, is_visible, display_order')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching player module visibility:', error);
        return DEFAULT_PLAYER_MODULES;
      }

      const moduleMap: PlayerModuleVisibilityMap = {};
      (data || []).forEach((module) => {
        moduleMap[module.module_name] = {
          is_visible: module.is_visible ?? true,
          display_order: module.display_order ?? 0,
        };
      });

      Object.entries(DEFAULT_PLAYER_MODULES).forEach(([name, def]) => {
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
