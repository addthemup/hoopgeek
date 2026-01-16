import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Stack,
  CircularProgress,
  Alert,
  Avatar,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useDFSGroupBySlug, useJoinDFSGroup } from '../hooks/useDFSGroups';
import { People, CheckCircle, Error } from '@mui/icons-material';

export default function JoinDFSGroup() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: group, isLoading: groupLoading } = useDFSGroupBySlug(slug);
  const joinGroupMutation = useJoinDFSGroup();
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleJoinGroup = async () => {
    if (!group || !user) return;

    setJoinStatus('joining');
    setErrorMessage('');

    try {
      await joinGroupMutation.mutateAsync({
        groupId: group.id,
      });
      setJoinStatus('success');
      setTimeout(() => {
        navigate('/dfs');
      }, 2000);
    } catch (error: any) {
      setJoinStatus('error');
      setErrorMessage(error?.message || 'Failed to join group');
    }
  };

  if (groupLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!group) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
        <Alert color="danger" startDecorator={<Error />}>
          Group not found. The invite link may be invalid or the group may have been deleted.
        </Alert>
        <Button onClick={() => navigate('/dfs')} sx={{ mt: 2 }}>
          Back to DFS
        </Button>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
        <Alert color="warning">
          Please log in to join this group.
        </Alert>
        <Button onClick={() => navigate('/login')} sx={{ mt: 2 }}>
          Go to Login
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <CardContent>
          <Stack spacing={3} alignItems="center">
            <Avatar
              src={group.avatar_url || undefined}
              sx={{
                width: 100,
                height: 100,
                bgcolor: group.icon_color_primary || '#FFC72C',
              }}
            >
              {group.name.charAt(0).toUpperCase()}
            </Avatar>

            <Box sx={{ textAlign: 'center' }}>
              <Typography level="h2" sx={{ color: '#FFFFFF', fontFamily: 'serif', mb: 1 }}>
                {group.name}
              </Typography>
              {group.description && (
                <Typography level="body-md" sx={{ color: '#FFFFFF', opacity: 0.8 }}>
                  {group.description}
                </Typography>
              )}
            </Box>

            <Stack direction="row" spacing={4} sx={{ mt: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <People sx={{ fontSize: 32, color: '#FFC72C', mb: 1 }} />
                <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                  {group.member_count} Members
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                  {group.pool_count} Pools
                </Typography>
              </Box>
            </Stack>

            {joinStatus === 'success' ? (
              <Alert color="success" startDecorator={<CheckCircle />} sx={{ width: '100%' }}>
                Successfully joined {group.name}! Redirecting...
              </Alert>
            ) : joinStatus === 'error' ? (
              <Alert color="danger" sx={{ width: '100%' }}>
                {errorMessage}
              </Alert>
            ) : (
              <Stack spacing={2} sx={{ width: '100%', mt: 2 }}>
                {!group.is_open && (
                  <Alert color="warning" sx={{ width: '100%' }}>
                    This is a closed group. You need an invitation to join.
                  </Alert>
                )}
                <Button
                  onClick={handleJoinGroup}
                  disabled={joinGroupMutation.isPending || !group.is_open}
                  loading={joinGroupMutation.isPending}
                  size="lg"
                  sx={{
                    bgcolor: '#FFC72C',
                    color: '#000000',
                    fontWeight: 'bold',
                    '&:hover': {
                      bgcolor: '#FFD700',
                    },
                  }}
                >
                  Join Group
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/dfs')}
                  sx={{ borderColor: '#333333', color: '#FFFFFF' }}
                >
                  Cancel
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

