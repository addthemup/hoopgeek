import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface DraftModuleVisibilityMap {
  [moduleName: string]: {
    is_visible: boolean;
    display_order: number;
  };
}

export const DRAFT_MODULE_DEFINITIONS = [
  {
    id: 'draft_trend',
    name: 'Draft trend',
    description: 'Prospect trend chart comparing stock aggregate and your rank over time.',
  },
  {
    id: 'my_board_summary',
    name: 'My board summary',
    description: 'Summary metrics for your mock board and user aggregate participation.',
  },
  {
    id: 'mock_progress',
    name: 'Mock game progress',
    description: 'Mock draft completion and score when results are published.',
  },
] as const;

export const DEFAULT_DRAFT_MODULES: DraftModuleVisibilityMap = {
  draft_trend: { is_visible: true, display_order: 0 },
  my_board_summary: { is_visible: true, display_order: 1 },
  mock_progress: { is_visible: true, display_order: 2 },
};

export function useDraftModuleVisibility() {
  return useQuery<DraftModuleVisibilityMap>({
    queryKey: ['draft-module-visibility-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_module_visibility')
        .select('module_name, is_visible, display_order')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching draft module visibility:', error);
        return DEFAULT_DRAFT_MODULES;
      }

      const moduleMap: DraftModuleVisibilityMap = {};
      (data || []).forEach((module) => {
        moduleMap[module.module_name] = {
          is_visible: module.is_visible ?? true,
          display_order: module.display_order ?? 0,
        };
      });

      Object.entries(DEFAULT_DRAFT_MODULES).forEach(([name, def]) => {
        if (!(name in moduleMap)) moduleMap[name] = def;
      });

      return moduleMap;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
