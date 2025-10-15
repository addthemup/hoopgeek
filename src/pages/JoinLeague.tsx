import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Input,
  FormControl,
  FormLabel,
  Alert,
  LinearProgress,
  Divider,
} from '@mui/joy';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useJoinLeague } from '../hooks/useJoinLeague';
import { supabase } from '../utils/supabase';
import { Google, SportsBasketball } from '@mui/icons-material';

export default function JoinLeague() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const joinLeague = useJoinLeague();

  const [teamName, setTeamName] = useState('');
  const [leagueInfo, setLeagueInfo] = useState<any>(null);
  const [loadingLeague, setLoadingLeague] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch league info by invite code
  useEffect(() => {
    const fetchLeagueInfo = async () => {
      if (!inviteCode) {
        setError('Invalid invite code');
        setLoadingLeague(false);
        return;
      }

      try {
        // Use the public function to get league info
        const { data, error } = await supabase.rpc('get_league_by_invite_code', {
          invite_code_param: inviteCode
        });

        if (error) {
          console.error('Error fetching league info:', error);
          setError('Failed to load league information');
        } else if (!data || !data.success) {
          setError(data?.error || 'Invalid invite code or league not found');
        } else {
          setLeagueInfo(data.league);
        }
      } catch (err) {
        console.error('Error fetching league:', err);
        setError('Failed to load league information');
      } finally {
        setLoadingLeague(false);
      }
    };

    fetchLeagueInfo();
  }, [inviteCode]);

  // Auto-join if user is already logged in
  useEffect(() => {
    if (user && leagueInfo && !joinLeague.isPending && !joinLeague.isSuccess) {
      // Don't auto-join, let user confirm
    }
  }, [user, leagueInfo]);

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/join/${inviteCode}`,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  const handleJoinLeague = async () => {
    if (!inviteCode) return;

    try {
      const result = await joinLeague.mutateAsync({
        inviteCode,
        teamName: teamName.trim() || undefined,
      });

      // Navigate to the league page
      navigate(`/league/${result.league_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join league');
    }
  };

  if (authLoading || loadingLeague) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
        <Stack spacing={2} alignItems="center">
          <LinearProgress sx={{ width: 200 }} />
          <Typography level="body-md">Loading...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error && !leagueInfo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3 }}>
        <Card sx={{ maxWidth: 500, width: '100%' }}>
          <CardContent>
            <Stack spacing={3} alignItems="center">
              <Alert color="danger" sx={{ width: '100%' }}>
                <Typography level="body-md">{error}</Typography>
              </Alert>
              <Button variant="outlined" onClick={() => navigate('/')}>
                Go to Home
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 3, bgcolor: 'background.level1' }}>
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardContent>
          <Stack spacing={3}>
            {/* Header */}
            <Box sx={{ textAlign: 'center' }}>
              <SportsBasketball sx={{ fontSize: 60, color: 'primary.500', mb: 2 }} />
              <Typography level="h2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Join League
              </Typography>
              {leagueInfo && (
                <>
                  <Typography level="h4" color="primary" sx={{ mb: 1 }}>
                    {leagueInfo.name}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    {leagueInfo.current_teams} / {leagueInfo.max_teams} teams filled
                  </Typography>
                </>
              )}
            </Box>

            <Divider />

            {/* Error Message */}
            {error && (
              <Alert color="danger">
                <Typography level="body-sm">{error}</Typography>
              </Alert>
            )}

            {/* Success Message */}
            {joinLeague.isSuccess && (
              <Alert color="success">
                <Typography level="body-sm">
                  Successfully joined the league! Redirecting...
                </Typography>
              </Alert>
            )}

            {/* Not Logged In */}
            {!user && (
              <Stack spacing={2}>
                <Typography level="body-md" sx={{ textAlign: 'center' }}>
                  Sign in with Google to join this league
                </Typography>
                <Button
                  size="lg"
                  variant="solid"
                  color="primary"
                  startDecorator={<Google />}
                  onClick={handleGoogleSignIn}
                  fullWidth
                >
                  Continue with Google
                </Button>
                <Typography level="body-xs" color="neutral" sx={{ textAlign: 'center' }}>
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </Typography>
              </Stack>
            )}

            {/* Logged In - Ready to Join */}
            {user && !joinLeague.isSuccess && (
              <Stack spacing={3}>
                <Alert color="primary" variant="soft">
                  <Typography level="body-sm">
                    You're signed in as <strong>{user.email}</strong>
                  </Typography>
                </Alert>

                <FormControl>
                  <FormLabel>Team Name (Optional)</FormLabel>
                  <Input
                    placeholder={`Team ${(leagueInfo?.current_teams || 0) + 1}`}
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    disabled={joinLeague.isPending}
                  />
                  <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                    Leave blank for auto-generated name
                  </Typography>
                </FormControl>

                <Button
                  size="lg"
                  variant="solid"
                  color="success"
                  onClick={handleJoinLeague}
                  loading={joinLeague.isPending}
                  disabled={joinLeague.isPending || leagueInfo?.current_teams >= leagueInfo?.max_teams}
                  fullWidth
                >
                  {leagueInfo?.current_teams >= leagueInfo?.max_teams
                    ? 'League is Full'
                    : 'Join League'}
                </Button>

                {leagueInfo?.current_teams >= leagueInfo?.max_teams && (
                  <Alert color="warning">
                    <Typography level="body-sm">
                      This league is full. No more teams can join.
                    </Typography>
                  </Alert>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}


