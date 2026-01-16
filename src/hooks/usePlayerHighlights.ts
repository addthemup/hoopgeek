import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { calculateFantasyPoints, FANDUEL_SCORING } from '../utils/fantasyScoring';

export interface PlayerHighlight {
  id: string;
  title: string;
  description: string;
  game_id: string;
  game_date: string;
  thumbnail_url: string;
  published_at: string;
  fantasy_points?: number;
  game_stats?: {
    pts: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    tov: number;
    min: string;
    fg_pct: number;
    fg3_pct: number;
    ft_pct: number;
    matchup?: string;
  };
}

/**
 * Determines which player a highlight belongs to by counting personId occurrences
 * Uses the SAME logic as PostsStories.tsx getPostRepresentatives()
 * Returns the personId (as number) that appears most frequently in the slides
 */
function getPrimaryPlayerId(slides: string | any[], playerIds?: number[]): number | null {
  try {
    const slidesArray = typeof slides === 'string' ? JSON.parse(slides) : (slides || []);
    if (!Array.isArray(slidesArray)) return null;

    // Count personId occurrences in slides (using Map like PostsStories does)
    const playerCounts = new Map<number, number>();
    slidesArray.forEach((slide: any) => {
      const personId = slide.metadata?.personId;
      if (personId) {
        const personIdNum = typeof personId === 'number' ? personId : parseInt(personId);
        if (!isNaN(personIdNum)) {
          playerCounts.set(personIdNum, (playerCounts.get(personIdNum) || 0) + 1);
        }
      }
    });

    // Find the player that appears most (same logic as PostsStories)
    let mostFeaturedPlayer = 0;
    let maxCount = 0;
    playerCounts.forEach((count, playerId) => {
      if (count > maxCount) {
        maxCount = count;
        mostFeaturedPlayer = playerId;
      }
    });

    // Fallback to first player_id if no personId found in slides (same as PostsStories)
    if (!mostFeaturedPlayer && playerIds && playerIds.length > 0) {
      mostFeaturedPlayer = playerIds[0];
    }

    return mostFeaturedPlayer > 0 ? mostFeaturedPlayer : null;
  } catch (error) {
    console.error('Error parsing slides:', error);
    return null;
  }
}

export function usePlayerHighlights(playerId: string) {
  return useQuery({
    queryKey: ['player-highlights', playerId],
    queryFn: async () => {
      console.log('🔍 usePlayerHighlights: Starting fetch for playerId:', playerId);
      
      // First, get the nba_player_id from the player UUID
      const { data: playerData, error: playerError } = await supabase
        .from('nba_players')
        .select('nba_player_id')
        .eq('id', playerId)
        .maybeSingle();

      // Handle error or no data - PGRST116 means 0 rows, which is fine with maybeSingle
      if (playerError && playerError.code !== 'PGRST116') {
        console.error('❌ usePlayerHighlights: Error fetching player nba_player_id:', playerError);
        return [];
      }

      if (!playerData) {
        // Player doesn't exist - return empty array
        return [];
      }

      const nbaPlayerId = String(playerData.nba_player_id);
      const nbaPlayerIdNum = playerData.nba_player_id;
      console.log('✅ usePlayerHighlights: Found nba_player_id:', nbaPlayerId, '(string) or', nbaPlayerIdNum, '(number)');

      // Fetch player_spotlight posts - prefer filtering by person_id if available
      // First try to get posts with person_id matching (most efficient)
      const { data: postsWithPersonId, error: personIdError } = await supabase
        .from('feed_posts')
        .select('id, title, description, game_id, game_date, slides, thumbnail_url, published_at, player_ids, person_id')
        .eq('post_type', 'player_spotlight')
        .eq('status', 'published')
        .eq('person_id', nbaPlayerIdNum)
        .order('published_at', { ascending: false })
        .limit(100);

      // Also fetch posts without person_id set (for backwards compatibility with old posts)
      const { data: postsWithoutPersonId, error: noPersonIdError } = await supabase
        .from('feed_posts')
        .select('id, title, description, game_id, game_date, slides, thumbnail_url, published_at, player_ids, person_id')
        .eq('post_type', 'player_spotlight')
        .eq('status', 'published')
        .is('person_id', null)
        .order('published_at', { ascending: false })
        .limit(100);

      if (personIdError || noPersonIdError) {
        console.error('❌ usePlayerHighlights: Error fetching posts:', personIdError || noPersonIdError);
        throw personIdError || noPersonIdError;
      }

      // Combine both sets of posts (posts with person_id + posts without for fallback parsing)
      const posts = [...(postsWithPersonId || []), ...(postsWithoutPersonId || [])];
      
      console.log('📊 usePlayerHighlights: Found', posts?.length || 0, 'player_spotlight posts (', postsWithPersonId?.length || 0, 'with person_id,', postsWithoutPersonId?.length || 0, 'without)');

      if (!posts) {
        console.log('⚠️ usePlayerHighlights: No posts returned');
        return [];
      }

      // Filter posts where this player is the primary player
      const playerHighlights: PlayerHighlight[] = [];
      let processedCount = 0;
      let matchedCount = 0;

      // Use for...of loop to support await
      for (const post of posts) {
        if (!post.slides) {
          console.log('⚠️ usePlayerHighlights: Post', post.id, 'has no slides');
          continue;
        }

        processedCount++;
        
        // Use person_id if available (new approach), otherwise parse slides (fallback for old posts)
        let primaryPlayerId: number | null = null;
        if (post.person_id) {
          // Use person_id directly from database (most reliable)
          primaryPlayerId = post.person_id;
          console.log(`✅ usePlayerHighlights: Post ${post.id} using person_id: ${primaryPlayerId}`);
        } else {
          // Fallback: parse slides to find primary player (for backwards compatibility)
          primaryPlayerId = getPrimaryPlayerId(
            post.slides,
            post.player_ids || []
          );
          if (primaryPlayerId) {
            console.log(`🔍 usePlayerHighlights: Post ${post.id} parsed primary player from slides: ${primaryPlayerId}`);
          } else {
            console.log(`⚠️ usePlayerHighlights: Post ${post.id} has no primary player ID (no person_id, and couldn't parse from slides)`);
          }
        }

        // Compare with nba_player_id (both as numbers)
        if (primaryPlayerId === nbaPlayerIdNum) {
          matchedCount++;
          console.log('✅ usePlayerHighlights: Match found! Post:', post.id, 'Title:', post.title);
          
          // Fetch game stats for this highlight
          let gameStats = null;
          let fantasyPoints = 0;
          
          if (post.game_id) {
            try {
              const { data: boxscore, error: boxscoreError } = await supabase
                .from('nba_boxscores')
                .select('pts, reb, ast, stl, blk, tov, min, fg_pct, fg3_pct, ft_pct, matchup')
                .eq('game_id', post.game_id)
                .eq('nba_player_id', parseInt(nbaPlayerId))
                .maybeSingle();

              if (!boxscoreError && boxscore) {
                // Calculate fantasy points
                fantasyPoints = calculateFantasyPoints({
                  pts: boxscore.pts || 0,
                  reb: boxscore.reb || 0,
                  ast: boxscore.ast || 0,
                  stl: boxscore.stl || 0,
                  blk: boxscore.blk || 0,
                  tov: boxscore.tov || 0,
                } as any, FANDUEL_SCORING);

                gameStats = {
                  pts: boxscore.pts || 0,
                  reb: boxscore.reb || 0,
                  ast: boxscore.ast || 0,
                  stl: boxscore.stl || 0,
                  blk: boxscore.blk || 0,
                  tov: boxscore.tov || 0,
                  min: String(boxscore.min || '0:00'),
                  fg_pct: boxscore.fg_pct || 0,
                  fg3_pct: boxscore.fg3_pct || 0,
                  ft_pct: boxscore.ft_pct || 0,
                  matchup: boxscore.matchup || '',
                };
              }
            } catch (error) {
              console.error('Error fetching game stats for highlight:', post.id, error);
            }
          }

          playerHighlights.push({
            id: post.id,
            title: post.title || '',
            description: post.description || '',
            game_id: post.game_id || '',
            game_date: post.game_date || '',
            thumbnail_url: post.thumbnail_url || '',
            published_at: post.published_at || '',
            fantasy_points: fantasyPoints,
            game_stats: gameStats || undefined,
          });
        }
      }

      console.log(`📈 usePlayerHighlights: Processed ${processedCount} posts, found ${matchedCount} matches for player ${nbaPlayerId}`);

      // Sort by published_at descending (most recent first)
      return playerHighlights.sort((a, b) => {
        const dateA = new Date(a.published_at).getTime();
        const dateB = new Date(b.published_at).getTime();
        return dateB - dateA;
      });
    },
    enabled: !!playerId,
  });
}

