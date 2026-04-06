import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface GameDrawerFeedSettings {
  show_filters: boolean;
  show_games_carousel: boolean;
}

const DEFAULT: GameDrawerFeedSettings = {
  show_filters: true,
  show_games_carousel: true,
};

export function useGameDrawerFeedSettings() {
  return useQuery({
    queryKey: ['game-drawer-feed-settings'],
    queryFn: async (): Promise<GameDrawerFeedSettings> => {
      const { data, error } = await supabase
        .from('game_drawer_feed_settings')
        .select('show_filters, show_games_carousel')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        console.error('Error fetching game drawer feed settings:', error);
        return DEFAULT;
      }
      if (!data) return DEFAULT;
      return {
        show_filters: data.show_filters ?? true,
        show_games_carousel: data.show_games_carousel ?? true,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
