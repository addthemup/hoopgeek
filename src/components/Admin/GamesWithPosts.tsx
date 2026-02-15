import { useState } from 'react';
import {
  Box,
  Typography,
  Sheet,
  Table,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/joy';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { format } from 'date-fns';

export default function GamesWithPosts() {
  const navigate = useNavigate();

  // Fetch all unique game IDs that have feed posts
  const { data: gamesWithPosts, isLoading } = useQuery({
    queryKey: ['games-with-feed-posts'],
    queryFn: async () => {
      // Get all unique game_ids from feed_posts where game_id is not null
      // Try to use a simpler query first, then paginate if needed
      let allPosts: any[] = [];
      
      try {
        // First try: Get all posts with a high limit
        const { data: posts, error: postsError } = await supabase
          .from('feed_posts')
          .select('game_id, game_date')
          .not('game_id', 'is', null)
          .limit(10000); // High limit to get most posts

        if (postsError) {
          console.error('Error fetching posts:', postsError);
          throw postsError;
        }

        if (posts) {
          allPosts = posts;
          console.log(`📊 Fetched ${allPosts.length} feed posts (first batch)`);
          
          // If we got exactly 10000, there might be more - paginate
          if (posts.length === 10000) {
            console.log('⚠️ Hit limit, paginating for more posts...');
            let from = 10000;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
              const { data: morePosts, error: moreError } = await supabase
                .from('feed_posts')
                .select('game_id, game_date')
                .not('game_id', 'is', null)
                .range(from, from + pageSize - 1);

              if (moreError) {
                console.error('Error fetching more posts:', moreError);
                break; // Stop pagination on error, use what we have
              }

              if (morePosts && morePosts.length > 0) {
                allPosts = [...allPosts, ...morePosts];
                from += pageSize;
                hasMore = morePosts.length === pageSize;
                console.log(`📊 Fetched ${morePosts.length} more posts (total: ${allPosts.length})`);
              } else {
                hasMore = false;
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in post fetching:', error);
        throw error;
      }
      
      console.log(`📊 Total feed posts fetched: ${allPosts.length}`);

      if (allPosts.length === 0) {
        console.warn('⚠️ No feed posts found');
        return [];
      }

      // Get unique game IDs
      const uniqueGameIds = [...new Set(allPosts.map(p => p.game_id).filter(Boolean))];
      
      if (uniqueGameIds.length === 0) {
        console.warn('⚠️ No unique game IDs found');
        return [];
      }

      if (uniqueGameIds.length === 0) return [];

      // Count posts per game
      const postCounts = new Map<string, number>();
      const gameDates = new Map<string, string>();
      allPosts.forEach(post => {
        if (post.game_id) {
          postCounts.set(post.game_id, (postCounts.get(post.game_id) || 0) + 1);
          if (post.game_date) {
            gameDates.set(post.game_id, post.game_date);
          }
        }
      });

      console.log(`📊 Found ${uniqueGameIds.length} unique game IDs with feed posts`);
      console.log(`📅 Sample game IDs:`, uniqueGameIds.slice(0, 10));

      // Fetch game data for these game IDs (Supabase .in() has a limit of ~1000 items)
      // Split into batches if needed
      let allGames: any[] = [];
      const batchSize = 1000;
      
      for (let i = 0; i < uniqueGameIds.length; i += batchSize) {
        const batch = uniqueGameIds.slice(i, i + batchSize);
        const { data: games, error: gamesError } = await supabase
          .from('nba_games')
          .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_status_text, arena_name')
          .in('game_id', batch)
          .order('game_date', { ascending: false });

        if (gamesError) {
          console.error('Error fetching games:', gamesError);
          throw gamesError;
        }
        if (games) {
          allGames = [...allGames, ...games];
        }
      }
      
      console.log(`✅ Fetched ${allGames.length} games from nba_games table`);

      // Create a map of found games
      const gamesMap = new Map(allGames.map(game => [game.game_id, game]));

      // Combine game data with post counts, including games that might not be in nba_games
      return uniqueGameIds.map(gameId => {
        const game = gamesMap.get(gameId);
        if (game) {
          // Game exists in nba_games
          return {
            ...game,
            post_count: postCounts.get(gameId) || 0,
          };
        } else {
          // Game doesn't exist in nba_games, create a placeholder
          return {
            game_id: gameId,
            game_date: gameDates.get(gameId) || null,
            home_team_tricode: null,
            away_team_tricode: null,
            home_team_score: null,
            away_team_score: null,
            game_status_text: 'Unknown',
            arena_name: null,
            post_count: postCounts.get(gameId) || 0,
          };
        }
      }).sort((a, b) => {
        // Sort by date descending, with null dates at the end
        if (!a.game_date && !b.game_date) return 0;
        if (!a.game_date) return 1;
        if (!b.game_date) return -1;
        return new Date(b.game_date).getTime() - new Date(a.game_date).getTime();
      });
    },
  });

  const handleGameClick = (gameId: string) => {
    navigate(`/admin/create-post/game/${gameId}`);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!gamesWithPosts || gamesWithPosts.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="body-md">No games with feed posts found.</Typography>
      </Box>
    );
  }

  return (
    <Sheet variant="outlined" sx={{ 
      borderRadius: 0, 
      border: '1px solid #e0e0e0', 
      overflow: 'auto',
      bgcolor: '#ffffff'
    }}>
      <Table sx={{
        bgcolor: '#ffffff',
        '& thead th': {
          bgcolor: '#ffffff',
          color: '#000000',
          fontFamily: 'serif',
          fontWeight: 900,
          textTransform: 'uppercase',
          borderBottom: '2px solid #000000',
          fontSize: '0.85rem',
          letterSpacing: '0.05em'
        },
        '& tbody td': {
          borderBottom: '1px solid #e0e0e0',
          fontFamily: 'serif',
          bgcolor: '#ffffff',
          color: '#000000'
        },
        '& tbody tr': {
          cursor: 'pointer',
          '&:hover': {
            bgcolor: '#f5f5f5'
          }
        }
      }}>
        <thead>
          <tr>
            <th>Game Date</th>
            <th>Matchup</th>
            <th>Score</th>
            <th>Status</th>
            <th>Posts</th>
            <th>Arena</th>
          </tr>
        </thead>
        <tbody>
          {gamesWithPosts.map((game) => (
            <tr 
              key={game.game_id}
              onClick={() => handleGameClick(game.game_id)}
            >
              <td>
                <Typography level="body-sm" sx={{ color: '#000000' }}>
                  {game.game_date ? format(new Date(game.game_date), 'MMM dd, yyyy') : 'N/A'}
                </Typography>
                <Typography level="body-xs" sx={{ color: '#666', fontWeight: 'bold' }}>
                  {game.game_id}
                </Typography>
              </td>
              <td>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#000000' }}>
                  {game.away_team_tricode} @ {game.home_team_tricode}
                </Typography>
              </td>
              <td>
                {game.home_team_score !== null && game.away_team_score !== null ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#000000' }}>
                      {game.away_team_score} - {game.home_team_score}
                    </Typography>
                    {game.away_team_score > game.home_team_score ? (
                      <Chip size="sm" variant="soft" color="primary">
                        {game.away_team_tricode}
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="soft" color="primary">
                        {game.home_team_tricode}
                      </Chip>
                    )}
                  </Stack>
                ) : (
                  <Typography level="body-sm" sx={{ color: '#666' }}>
                    TBD
                  </Typography>
                )}
              </td>
              <td>
                <Chip 
                  size="sm" 
                  variant="solid"
                  sx={{ 
                    bgcolor: '#000000',
                    color: '#ffffff',
                  }}
                >
                  {game.game_status_text || 'Scheduled'}
                </Chip>
              </td>
              <td>
                <Chip 
                  size="sm" 
                  variant="soft"
                  color="primary"
                  sx={{ 
                    color: '#000000',
                    bgcolor: '#e3f2fd',
                  }}
                >
                  {game.post_count} {game.post_count === 1 ? 'post' : 'posts'}
                </Chip>
              </td>
              <td>
                <Typography level="body-xs" sx={{ color: '#666' }}>
                  {game.arena_name || 'N/A'}
                </Typography>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Sheet>
  );
}

