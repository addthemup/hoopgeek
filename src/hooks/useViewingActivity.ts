/**
 * Hook to fetch user viewing activity by date
 * Calculates percentage of videos watched per day for calendar heat map
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface ViewingActivityByDate {
  date: string; // YYYY-MM-DD format
  total_posts: number;
  viewed_posts: number;
  percentage: number; // 0-100
}

export interface ViewingActivityData {
  [date: string]: ViewingActivityByDate;
}

/**
 * Get viewing activity for a specific month
 */
export function useViewingActivity(userId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['viewing-activity', userId, year, month],
    queryFn: async (): Promise<ViewingActivityData> => {
      if (!userId) throw new Error('User ID is required');

      // Get start and end of month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Fetch all feed_content entries with game_id for this month
      const { data: feedContent, error: feedContentError } = await supabase
        .from('feed_content')
        .select('id, game_id, game_date')
        .not('game_id', 'is', null)
        .gte('game_date', startDate.toISOString())
        .lte('game_date', endDate.toISOString());

      if (feedContentError) throw feedContentError;

      // Group content by date (YYYY-MM-DD)
      const contentByDate = new Map<string, string[]>();
      (feedContent || []).forEach((content) => {
        if (content.game_date) {
          const dateStr = new Date(content.game_date).toISOString().split('T')[0];
          if (!contentByDate.has(dateStr)) {
            contentByDate.set(dateStr, []);
          }
          contentByDate.get(dateStr)!.push(content.id);
        }
      });

      // Fetch viewed posts for this user
      const { data: viewedPosts, error: viewedError } = await supabase
        .from('user_viewed_posts')
        .select('content_id')
        .eq('user_id', userId);

      if (viewedError) throw viewedError;

      const viewedContentIds = new Set((viewedPosts || []).map((vp) => vp.content_id));

      // Calculate activity for each date
      const activity: ViewingActivityData = {};

      contentByDate.forEach((contentIds, dateStr) => {
        const totalPosts = contentIds.length;
        let viewedCount = 0;

        contentIds.forEach((contentId) => {
          if (viewedContentIds.has(contentId)) {
            viewedCount++;
          }
        });

        const percentage = totalPosts > 0 ? (viewedCount / totalPosts) * 100 : 0;

        activity[dateStr] = {
          date: dateStr,
          total_posts: totalPosts,
          viewed_posts: viewedCount,
          percentage: Math.round(percentage),
        };
      });

      return activity;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get feed posts for a specific date
 * Returns feed_posts that have game_id matching the date
 */
export function useFeedPostsByDate(date: string | null) {
  return useQuery({
    queryKey: ['feed-posts-by-date', date],
    queryFn: async () => {
      if (!date) return [];

      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // First get feed_content entries for this date
      const { data: feedContent, error: feedContentError } = await supabase
        .from('feed_content')
        .select('source_id, game_id, game_date')
        .not('game_id', 'is', null)
        .gte('game_date', startDate.toISOString())
        .lte('game_date', endDate.toISOString());

      if (feedContentError) throw feedContentError;

      // Get unique source_ids (feed_post IDs)
      const sourceIds = [...new Set((feedContent || []).map((fc) => fc.source_id).filter(Boolean))];

      if (sourceIds.length === 0) return [];

      // Fetch the actual feed_posts
      const { data: posts, error: postsError } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('status', 'published')
        .in('id', sourceIds)
        .order('game_date', { ascending: false });

      if (postsError) throw postsError;
      return posts || [];
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
}

