import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Card, CardContent, Alert, Button } from '@mui/joy';
import { EmojiEvents, Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { format } from 'date-fns';

export default function JoinDFSPool() {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // Fetch pool details
  const { data: pool, isLoading: poolLoading } = useQuery({
    queryKey: ['dfs-pool-preview', poolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_todays_contests')
        .select('*')
        .eq('pool_id', poolId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!poolId,
  });

  // Redirect authenticated users to the lineup page
  useEffect(() => {
    if (!authLoading && user && poolId) {
      console.log('User authenticated, redirecting to pool lineup');
      navigate(`/dfs/lineup/${poolId}`);
    }
  }, [user, authLoading, poolId, navigate]);

  // Loading state
  if (authLoading || poolLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        gap: 2
      }}>
        <CircularProgress size="lg" />
        <Typography level="body-md">Loading pool...</Typography>
      </Box>
    );
  }

  // Pool not found
  if (!pool) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        px: 2
      }}>
        <Card sx={{ width: '100%', maxWidth: 500 }}>
          <CardContent>
            <Alert color="danger">
              <Typography level="title-md">Pool Not Found</Typography>
              <Typography level="body-sm">
                The contest you're looking for doesn't exist or is no longer available.
              </Typography>
            </Alert>
            <Button
              fullWidth
              sx={{ mt: 2 }}
              onClick={() => navigate('/dfs')}
            >
              Browse Available Contests
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // User not authenticated - show pool preview and login prompt
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '60vh',
      px: 2
    }}>
      <Card sx={{ width: '100%', maxWidth: 600 }}>
        <CardContent>
          {/* Pool Preview */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <EmojiEvents sx={{ fontSize: 64, color: 'warning.500', mb: 2 }} />
            <Typography level="h2" sx={{ mb: 1 }}>
              Join This Contest
            </Typography>
            <Typography level="body-md" color="neutral">
              You've been invited to join a Daily Fantasy Sports contest
            </Typography>
          </Box>

          {/* Contest Details */}
          <Box sx={{ 
            p: 3, 
            bgcolor: 'background.level1', 
            borderRadius: 'md',
            mb: 3
          }}>
            <Typography level="h3" sx={{ mb: 2 }}>
              {pool.name}
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography level="body-sm" color="neutral">Entry Fee:</Typography>
                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                  ${pool.entry_fee.toFixed(2)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography level="body-sm" color="neutral">Prize Pool:</Typography>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                  ${pool.prize_pool.toLocaleString()}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography level="body-sm" color="neutral">Entries:</Typography>
                <Typography level="body-sm">
                  {pool.current_entries} / {pool.max_entries}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography level="body-sm" color="neutral">Games:</Typography>
                <Typography level="body-sm">
                  {pool.games_count} games
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography level="body-sm" color="neutral">Lock Time:</Typography>
                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                  {new Date(pool.lock_time).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short'
                  })}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Call to Action */}
          <Alert color="primary" sx={{ mb: 3 }}>
            <Typography level="title-sm">Sign in to continue</Typography>
            <Typography level="body-sm">
              Create an account or sign in to enter this contest and build your lineup.
            </Typography>
          </Alert>

          <Button
            size="lg"
            fullWidth
            startDecorator={<LoginIcon />}
            onClick={() => navigate(`/login?redirect=/dfs/join/${poolId}`)}
          >
            Sign In to Join Contest
          </Button>

          <Typography level="body-xs" sx={{ textAlign: 'center', mt: 2, color: 'neutral.500' }}>
            Don't have an account? You can create one on the sign in page.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

