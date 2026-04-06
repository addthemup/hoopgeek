import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface ProspectModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
  };
}

export const PROSPECT_MODULE_DEFINITIONS = [
  {
    id: 'ranking_over_time',
    name: 'Ranking over time',
    description: 'Draft rank by week from Tankathon, NBADraft.net, The Athletic, and ESPN (draft_rankings).',
  },
] as const;

export const DEFAULT_PROSPECT_MODULES: ProspectModuleVisibilityMap = {
  ranking_over_time: { is_visible: true, display_order: 0 },
};

export function useProspectModuleVisibility() {
  return useQuery<ProspectModuleVisibilityMap>({
    queryKey: ['prospect-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prospect_module_visibility')
        .select('module_name, is_visible, display_order')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching prospect module visibility:', error);
        return DEFAULT_PROSPECT_MODULES;
      }

      const moduleMap: ProspectModuleVisibilityMap = {};
      (data || []).forEach((module) => {
        moduleMap[module.module_name] = {
          is_visible: module.is_visible ?? true,
          display_order: module.display_order ?? 0,
        };
      });

      Object.entries(DEFAULT_PROSPECT_MODULES).forEach(([name, def]) => {
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
