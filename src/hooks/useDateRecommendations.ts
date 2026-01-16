/**
 * Hook to get recommended posts for a specific date based on user favorites and high scores
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

export interface RecommendedPost {
  id: string;
  title: string;
  post_type: string;
  game_id: string;
  game_date: string;
  metadata: any;
  player_ids: number[];
  team_tricodes: string[];
  person_id: number | null;
  reason: 'favorite_team' | 'favorite_player' | 'high_fun_score' | 'high_fantasy_points';
  score?: number;
}

export function useDateRecommendations(
  date: string | null,
  favoriteTeamTricodes: string[],
  favoritePlayerIds: number[]
) {
  return useQuery({
    queryKey: ['date-recommendations', date, favoriteTeamTricodes, favoritePlayerIds],
    queryFn: async (): Promise<RecommendedPost[]> => {
      if (!date) return [];

      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // Get all posts for this date
      const { data: feedContent, error: feedContentError } = await supabase
        .from('feed_content')
        .select('source_id, game_id, game_date')
        .not('game_id', 'is', null)
        .gte('game_date', startDate.toISOString())
        .lte('game_date', endDate.toISOString());

      if (feedContentError) throw feedContentError;

      const sourceIds = [...new Set((feedContent || []).map((fc) => fc.source_id).filter(Boolean))];
      if (sourceIds.length === 0) return [];

      // Fetch the actual feed_posts
      const { data: posts, error: postsError } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('status', 'published')
        .in('id', sourceIds);

      if (postsError) throw postsError;
      if (!posts) return [];

      const recommendations: RecommendedPost[] = [];

      posts.forEach((post) => {
        const metadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {});
        const teamTricodes = post.team_tricodes || [];
        const playerIds = post.player_ids || [];
        const personId = post.person_id;

        // Check for favorite teams
        const hasFavoriteTeam = teamTricodes.some((tricode: string) => 
          favoriteTeamTricodes.includes(tricode)
        );

        // Check for favorite players
        const hasFavoritePlayer = personId && favoritePlayerIds.includes(personId);

        // Check for high fun score
        const funScore = metadata?.fun_score || 0;
        const isHighFunScore = post.post_type === 'fun_score' && funScore >= 7;

        // Check for high fantasy points
        const fantasyPoints = metadata?.fantasyPoints || 0;
        const isHighFantasyPoints = post.post_type === 'player_spotlight' && fantasyPoints >= 40;

        if (hasFavoriteTeam) {
          recommendations.push({
            ...post,
            reason: 'favorite_team',
          });
        } else if (hasFavoritePlayer) {
          recommendations.push({
            ...post,
            reason: 'favorite_player',
          });
        } else if (isHighFunScore) {
          recommendations.push({
            ...post,
            reason: 'high_fun_score',
            score: funScore,
          });
        } else if (isHighFantasyPoints) {
          recommendations.push({
            ...post,
            reason: 'high_fantasy_points',
            score: fantasyPoints,
          });
        }
      });

      // Sort by priority: favorite_team > favorite_player > high scores
      recommendations.sort((a, b) => {
        const priority = { favorite_team: 4, favorite_player: 3, high_fun_score: 2, high_fantasy_points: 2 };
        const priorityDiff = (priority[b.reason] || 0) - (priority[a.reason] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        // If same priority, sort by score
        return (b.score || 0) - (a.score || 0);
      });

      return recommendations.slice(0, 10); // Limit to top 10 recommendations
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

