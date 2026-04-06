import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface TeamModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
  };
}

export const TEAM_MODULE_DEFINITIONS = [
  { id: 'player_dashboard', name: 'Player Dashboard', description: 'Season totals per player' },
  { id: 'rebounding', name: 'Rebounding Profile', description: 'Rebounding splits (overall, shot type, contested)' },
  { id: 'shot_dashboard', name: 'Shot Dashboard', description: 'Shooting splits by type, dribbles, shot clock, defender' },
  { id: 'game_logs', name: 'Game Logs', description: 'Last 20 team game results' },
  { id: 'four_factors', name: 'Four Factors', description: 'Pace, eFG%, TOV%, OREB%, FT rate' },
] as const;

export const DEFAULT_TEAM_MODULES: TeamModuleVisibilityMap = {
  player_dashboard: { is_visible: true, display_order: 0 },
  rebounding: { is_visible: true, display_order: 1 },
  shot_dashboard: { is_visible: true, display_order: 2 },
  game_logs: { is_visible: true, display_order: 3 },
  four_factors: { is_visible: true, display_order: 4 },
};

export function useTeamModuleVisibility() {
  return useQuery<TeamModuleVisibilityMap>({
    queryKey: ['team-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_module_visibility')
        .select('module_name, is_visible, display_order')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching team module visibility:', error);
        return DEFAULT_TEAM_MODULES;
      }

      const moduleMap: TeamModuleVisibilityMap = {};
      (data || []).forEach((module) => {
        moduleMap[module.module_name] = {
          is_visible: module.is_visible ?? true,
          display_order: module.display_order ?? 0,
        };
      });

      Object.entries(DEFAULT_TEAM_MODULES).forEach(([name, def]) => {
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
