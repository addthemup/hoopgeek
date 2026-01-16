/**
 * Hook to fetch user engagement sessions by date
 * Aggregates session duration and watch time per day
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface EngagementDataByDate {
  date: string; // YYYY-MM-DD format
  total_watch_seconds: number; // Total video watch time in seconds
  session_duration_seconds: number; // Total session duration in seconds
  sessions_count: number; // Number of sessions on this day
  watch_time_hours: number; // Watch time in hours (calculated)
  session_time_hours: number; // Session time in hours (calculated)
}

export interface EngagementData {
  [date: string]: EngagementDataByDate;
}

/**
 * Get engagement sessions for a specific month
 */
export function useEngagementSessions(userId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['engagement-sessions', userId, year, month],
    queryFn: async (): Promise<EngagementData> => {
      if (!userId) throw new Error('User ID is required');

      // Get start and end of month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Fetch watch history for this month
      const { data: watchHistory, error } = await supabase
        .from('user_watch_history')
        .select('watched_at, watch_seconds, video_watch_seconds')
        .eq('user_id', userId)
        .gte('watched_at', startDate.toISOString())
        .lte('watched_at', endDate.toISOString());

      if (error) throw error;

      // Aggregate by date
      const engagementByDate: EngagementData = {};

      (watchHistory || []).forEach((entry) => {
        const dateStr = new Date(entry.watched_at).toISOString().split('T')[0];
        
        if (!engagementByDate[dateStr]) {
          engagementByDate[dateStr] = {
            date: dateStr,
            total_watch_seconds: 0,
            session_duration_seconds: 0,
            sessions_count: 0,
            watch_time_hours: 0,
            session_time_hours: 0,
          };
        }

        // Use video_watch_seconds if available, otherwise use watch_seconds
        const watchSeconds = entry.video_watch_seconds || entry.watch_seconds || 0;

        engagementByDate[dateStr].total_watch_seconds += watchSeconds;
        // For session duration, use watch_seconds as a proxy (total time spent)
        engagementByDate[dateStr].session_duration_seconds += entry.watch_seconds || 0;
        // Count each entry as a viewing session
        engagementByDate[dateStr].sessions_count += 1;
      });

      // Calculate hours for each date
      Object.values(engagementByDate).forEach((data) => {
        data.watch_time_hours = data.total_watch_seconds / 3600;
        data.session_time_hours = data.session_duration_seconds / 3600;
      });

      return engagementByDate;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

