import { useState } from 'react';
import {
  Box,
  Typography,
  Sheet,
  Table,
  Chip,
  CircularProgress,
  Stack,
  Button,
  Avatar,
  IconButton,
  Snackbar,
} from '@mui/joy';
import { ArrowBack, Reddit, Facebook } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { format } from 'date-fns';

interface GamePostsViewProps {
  gameId: string;
  onBack: () => void;
}

interface FeedPost {
  id: string;
  title?: string;
  description?: string;
  post_type: string;
  status: string;
  created_at: string;
  published_at?: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  author_name?: string;
}

export default function GamePostsView({ gameId, onBack }: GamePostsViewProps) {
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color?: 'success' | 'danger' | 'neutral' }>({
    open: false,
    message: '',
  });

  // Post to Reddit
  const handlePostToReddit = async (postId: string) => {
    try {
      setSnackbar({
        open: true,
        message: 'Posting to Reddit...',
        color: 'neutral'
      });

      const { data, error } = await supabase.functions.invoke('post-to-reddit', {
        body: {
          post_id: postId,
          subreddit: 'hoopgeek'
        }
      })

      if (error) {
        throw error
      }

      if (data?.success) {
        setSnackbar({
          open: true,
          message: `Posted to Reddit! ${data.reddit_post_url ? `View: ${data.reddit_post_url}` : ''}`,
          color: 'success'
        })
      } else {
        throw new Error(data?.error || 'Failed to post to Reddit')
      }
    } catch (error: any) {
      console.error('Error posting to Reddit:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error posting to Reddit. Please check Reddit credentials are configured.',
        color: 'danger'
      })
    }
  }

  // Post to Facebook
  const handlePostToFacebook = async (postId: string) => {
    try {
      setSnackbar({
        open: true,
        message: 'Posting to Facebook...',
        color: 'neutral'
      })

      const { data, error } = await supabase.functions.invoke('post-to-facebook', {
        body: {
          post_id: postId
        }
      })

      if (error) {
        throw error
      }

      if (data?.success) {
        setSnackbar({
          open: true,
          message: `Posted to Facebook! ${data.facebook_post_url ? `View: ${data.facebook_post_url}` : ''}`,
          color: 'success'
        })
      } else {
        throw new Error(data?.error || 'Failed to post to Facebook')
      }
    } catch (error: any) {
      console.error('Error posting to Facebook:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error posting to Facebook. Please check Facebook credentials are configured.',
        color: 'danger'
      })
    }
  }
  // Fetch game details
  const { data: game, isLoading: gameLoading } = useQuery({
    queryKey: ['game-details', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_games')
        .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_status_text, arena_name')
        .eq('game_id', gameId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!gameId,
  });

  // Fetch all feed posts for this game
  const { data: posts, isLoading: postsLoading } = useQuery<FeedPost[]>({
    queryKey: ['game-feed-posts', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_posts')
        .select('id, title, description, post_type, status, created_at, published_at, likes_count, comments_count, views_count, author_name')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!gameId,
  });

  if (gameLoading || postsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!game) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography level="h4">Game not found</Typography>
        <Button onClick={onBack} sx={{ mt: 2 }}>
          Back to Games
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with Back Button */}
      <Stack 
        direction="row" 
        spacing={2} 
        alignItems="center" 
        sx={{ 
          mb: 3,
          bgcolor: '#ffffff',
          p: 2,
          borderRadius: 'sm',
          border: '1px solid #e0e0e0'
        }}
      >
        <Button
          variant="plain"
          startDecorator={<ArrowBack />}
          onClick={onBack}
          sx={{ color: '#000' }}
        >
          Back to Games
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography level="h4" sx={{ color: '#000' }}>
            {game.away_team_tricode} @ {game.home_team_tricode}
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Typography level="body-sm" sx={{ color: '#666' }}>
              {game.game_date ? format(new Date(game.game_date), 'MMM dd, yyyy') : 'N/A'}
            </Typography>
            {game.home_team_score !== null && game.away_team_score !== null && (
              <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#000' }}>
                {game.away_team_score} - {game.home_team_score}
              </Typography>
            )}
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
            {game.arena_name && (
              <Typography level="body-xs" sx={{ color: '#666' }}>
                {game.arena_name}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>

      {/* Posts Table */}
      {!posts || posts.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography level="body-md">No feed posts found for this game.</Typography>
        </Box>
      ) : (
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
            '& tbody tr:hover': {
              bgcolor: '#f5f5f5'
            }
          }}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Author</th>
                <th>Engagement</th>
                <th>Created</th>
                <th>Published</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#000000' }}>
                      {post.title || '(No title)'}
                    </Typography>
                    {post.description && (
                      <Typography level="body-xs" sx={{ color: '#666', mt: 0.5 }}>
                        {post.description.substring(0, 100)}{post.description.length > 100 ? '...' : ''}
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
                      {post.post_type || 'N/A'}
                    </Chip>
                  </td>
                  <td>
                    <Chip 
                      size="sm" 
                      variant={post.status === 'published' ? 'soft' : 'outlined'}
                      color={post.status === 'published' ? 'success' : 'neutral'}
                    >
                      {post.status}
                    </Chip>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#000000' }}>
                      {post.author_name || 'Unknown'}
                    </Typography>
                  </td>
                  <td>
                    <Stack direction="row" spacing={1}>
                      <Typography level="body-xs" sx={{ color: '#666' }}>
                        ❤️ {post.likes_count || 0}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#666' }}>
                        💬 {post.comments_count || 0}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#666' }}>
                        👁️ {post.views_count || 0}
                      </Typography>
                    </Stack>
                  </td>
                  <td>
                    <Typography level="body-xs" sx={{ color: '#666' }}>
                      {format(new Date(post.created_at), 'MMM dd, yyyy h:mm a')}
                    </Typography>
                  </td>
                  <td>
                    {post.published_at ? (
                      <Typography level="body-xs" sx={{ color: '#666' }}>
                        {format(new Date(post.published_at), 'MMM dd, yyyy h:mm a')}
                      </Typography>
                    ) : (
                      <Typography level="body-xs" sx={{ color: '#999' }}>
                        Not published
                      </Typography>
                    )}
                  </td>
                  <td>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        size="sm"
                        variant="plain"
                        onClick={() => handlePostToReddit(post.id)}
                        sx={{ p: 0.5, color: '#FF4500' }}
                        title="Post to Reddit"
                      >
                        <Reddit sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant="plain"
                        onClick={() => handlePostToFacebook(post.id)}
                        sx={{ p: 0.5, color: '#1877F2' }}
                        title="Post to Facebook"
                      >
                        <Facebook sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Sheet>
      )}
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        color={snackbar.color || 'neutral'}
      >
        {snackbar.message}
      </Snackbar>
    </Box>
  );
}

