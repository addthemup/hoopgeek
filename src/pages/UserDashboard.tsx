/**
 * User Dashboard - Comprehensive dashboard for user activity, stats, and content
 * Replaces the old UserSettings page with a full-featured dashboard
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Sheet,
  Grid,
  Card,
  CardContent,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/joy';
import {
  TrendingUp,
  EmojiEvents,
  SportsBasketball,
  Favorite,
  Groups,
  PlayArrow,
  NavigateNext,
  Edit,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserSettings';
import { usePlayerFavorites } from '../hooks/usePlayerFavorites';
import { useFavoriteTeams } from '../hooks/useUserSettings';
import { useDFSUserStats } from '../hooks/useDFSUserStats';
import { useUserLeagues } from '../hooks/useUserLeagues';
import { useViewingActivity } from '../hooks/useViewingActivity';
import EnhancedViewingActivityCalendar from '../components/EnhancedViewingActivityCalendar';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { getTeamSecondaryColor } from '../utils/nbaTeamColors';
import { useMediaQuery } from '@mui/material';
import EditProfileModal from '../components/EditProfileModal';

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: userProfile } = useUserProfile(user?.id);
  const { data: favoritePlayers } = usePlayerFavorites();
  const { data: favoriteTeams } = useFavoriteTeams(user?.id);
  const { data: dfsStats } = useDFSUserStats(user?.id);
  const { data: leagues } = useUserLeagues();
  const { data: activity } = useViewingActivity(user?.id, new Date().getFullYear(), new Date().getMonth() + 1);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isLandscapeMobile = isMobile && isLandscape;

  // Find user's fantasy teams
  const userFantasyTeams = leagues?.map((league) => {
    // This would need to be enhanced to get actual team stats
    return {
      leagueId: league.id,
      leagueName: league.name,
      teamName: league.team_name || 'My Team',
      wins: 0,
      losses: 0,
      standing: 0,
    };
  }) || [];


  if (!user) {
    return (
      <Box sx={{ 
        bgcolor: '#000000',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}>
        <Box
          sx={{
            maxWidth: { xs: '100%', sm: 805, md: 1035 },
            minWidth: { xs: '100%', sm: 805, md: 1035 },
            mx: 'auto',
            pt: isLandscapeMobile 
              ? '60px'
              : { xs: '147px', md: 'calc((100vh - 40px) / 16 + 91px)' },
            pb: 4,
            px: { xs: 2, sm: 2, md: 2 },
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Sheet
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 'md',
              border: '2px solid',
              borderColor: 'divider',
            }}
          >
            <Typography level="h3" sx={{ mb: 2 }}>
              Sign In Required
            </Typography>
            <Typography level="body-md" sx={{ mb: 3 }}>
              Please sign in to access your dashboard
            </Typography>
            <Button onClick={() => navigate('/login')}>Sign In</Button>
          </Sheet>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      bgcolor: '#000000',
      minHeight: '100vh',
      overflowX: 'hidden',
      width: '100%',
    }}>
      {/* Main Container - Same format as Home/Today/DFS */}
      <Box
        sx={{
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          minWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto',
          pt: isLandscapeMobile 
            ? '60px'
            : { xs: '147px', md: 'calc((100vh - 40px) / 16 + 91px)' },
          pb: 4,
          px: { xs: 2, sm: 2, md: 2 },
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Enhanced Calendar */}
        <Box sx={{ mb: 4 }}>
          <EnhancedViewingActivityCalendar />
        </Box>
      <Stack spacing={4}>
        {/* User Header Card */}
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            <Stack direction="row" spacing={3} alignItems="center">
              <Avatar
                src={userProfile?.avatar_url || undefined}
                sx={{
                  '--Avatar-size': { xs: '64px', md: '80px' },
                  width: { xs: '64px', md: '80px' },
                  height: { xs: '64px', md: '80px' },
                  border: '2px solid rgba(255, 215, 0, 0.3)',
                  '& img': {
                    objectFit: 'cover',
                  },
                }}
              >
                {!userProfile?.avatar_url && (userProfile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
              </Avatar>
              <Stack spacing={1} sx={{ flex: 1 }}>
                <Typography level="h3" sx={{ fontFamily: 'serif', fontWeight: 700, color: '#FFFFFF' }}>
                  {userProfile?.display_name || user?.email || 'User'}
                </Typography>
                {userProfile?.bio && (
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    {userProfile.bio}
                  </Typography>
                )}
                {!userProfile?.bio && (
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    {user?.email}
                  </Typography>
                )}
              </Stack>
              <Button
                variant="outlined"
                startDecorator={<Edit />}
                onClick={() => setEditProfileOpen(true)}
                sx={{
                  borderColor: '#FFD700',
                  color: '#FFD700',
                  '&:hover': {
                    bgcolor: 'rgba(255, 215, 0, 0.1)',
                    borderColor: '#FFD700',
                  },
                }}
              >
                Edit Avatar
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Quick Stats Row */}
        <Grid container spacing={2}>
          <Grid xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Typography level="body-xs" sx={{ textTransform: 'uppercase' }}>
                    DFS Winnings
                  </Typography>
                  <Typography level="h3" sx={{ color: 'success.500', fontWeight: 700 }}>
                    ${dfsStats?.totalWinnings.toFixed(2) || '0.00'}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Typography level="body-xs" sx={{ textTransform: 'uppercase' }}>
                    Contests Won
                  </Typography>
                  <Typography level="h3" sx={{ color: 'primary.500', fontWeight: 700 }}>
                    {dfsStats?.contestsWon || 0}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Typography level="body-xs" sx={{ textTransform: 'uppercase' }}>
                    Fantasy Leagues
                  </Typography>
                  <Typography level="h3" sx={{ color: 'warning.500', fontWeight: 700 }}>
                    {leagues?.length || 0}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Typography level="body-xs" sx={{ textTransform: 'uppercase' }}>
                    Favorite Players
                  </Typography>
                  <Typography level="h3" sx={{ color: 'danger.500', fontWeight: 700 }}>
                    {favoritePlayers?.length || 0}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Left Column - Activity */}
          <Grid xs={12} lg={4}>
            <Stack spacing={3}>
              {/* Favorite Teams */}
              <Sheet
                sx={{
                  p: 3,
                  borderRadius: 'md',
                  border: '2px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack spacing={2}>
                  <Typography
                    level="h4"
                    sx={{ fontFamily: 'serif', fontWeight: 700 }}
                  >
                    🏆 Favorite Teams
                  </Typography>
                  {favoriteTeams && favoriteTeams.length > 0 ? (
                    <Stack spacing={1}>
                      {favoriteTeams.slice(0, 5).map((team) => (
                        <Button
                          key={team.id}
                          variant="outlined"
                          onClick={async () => {
                            // Navigate to team page using nba_teams UUID id
                            try {
                              const { data: teamData, error } = await supabase
                                .from('nba_teams')
                                .select('id')
                                .eq('team_id', team.team_id)
                                .single();

                              if (error) {
                                console.error('Error fetching team for navigation:', error);
                                return;
                              }

                              if (teamData?.id) {
                                navigate(`/team/${teamData.id}`);
                              }
                            } catch (error) {
                              console.error('Error navigating to team:', error);
                            }
                          }}
                          sx={{
                            justifyContent: 'flex-start',
                            borderColor: getTeamSecondaryColor(team.team_abbreviation),
                          }}
                        >
                          <Avatar
                            src={getTeamLogoUrl(team.team_abbreviation)}
                            size="sm"
                            sx={{ mr: 1 }}
                          />
                          <Typography level="body-sm">{team.team_name}</Typography>
                        </Button>
                      ))}
                      {favoriteTeams.length > 5 && (
                        <Button
                          variant="plain"
                          size="sm"
                          onClick={() => navigate('/feed')}
                        >
                          View All ({favoriteTeams.length})
                        </Button>
                      )}
                    </Stack>
                  ) : (
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      No favorite teams yet
                    </Typography>
                  )}
                </Stack>
              </Sheet>

              {/* Favorite Players */}
              <Sheet
                sx={{
                  p: 3,
                  borderRadius: 'md',
                  border: '2px solid',
                  borderColor: 'divider',
                }}
              >
                <Stack spacing={2}>
                  <Typography
                    level="h4"
                    sx={{ fontFamily: 'serif', fontWeight: 700 }}
                  >
                    ⭐ Favorite Players
                  </Typography>
                  {favoritePlayers && favoritePlayers.length > 0 ? (
                    <Stack spacing={1}>
                      {favoritePlayers.slice(0, 5).map((player) => (
                        <Button
                          key={player.id}
                          variant="outlined"
                          onClick={() => navigate(`/player/${player.player_id}`)}
                          sx={{ justifyContent: 'flex-start' }}
                        >
                          <Avatar
                            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                            size="sm"
                            sx={{ mr: 1 }}
                          />
                          <Typography level="body-sm">
                            {player.nba_players?.name || 'Unknown'}
                          </Typography>
                        </Button>
                      ))}
                      {favoritePlayers.length > 5 && (
                        <Button
                          variant="plain"
                          size="sm"
                          onClick={() => navigate('/feed')}
                        >
                          View All ({favoritePlayers.length})
                        </Button>
                      )}
                    </Stack>
                  ) : (
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      No favorite players yet
                    </Typography>
                  )}
                </Stack>
              </Sheet>
            </Stack>
          </Grid>

          {/* Right Column - Main Content */}
          <Grid xs={12} lg={8}>
            <Stack spacing={3}>
              {/* DFS Stats */}
                  <Sheet
                    sx={{
                      p: 3,
                      borderRadius: 'md',
                      border: '2px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack spacing={2}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography
                          level="h4"
                          sx={{ fontFamily: 'serif', fontWeight: 700 }}
                        >
                          💰 DFS Performance
                        </Typography>
                        <Button
                          variant="plain"
                          size="sm"
                          endDecorator={<NavigateNext />}
                          onClick={() => navigate('/dfs')}
                        >
                          View All
                        </Button>
                      </Stack>
                      {dfsStats ? (
                        <Grid container spacing={2}>
                          <Grid xs={6}>
                            <Box>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                Total Contests
                              </Typography>
                              <Typography level="h4">{dfsStats.contestsEntered}</Typography>
                            </Box>
                          </Grid>
                          <Grid xs={6}>
                            <Box>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                Win Rate
                              </Typography>
                              <Typography level="h4">
                                {dfsStats.winRate.toFixed(1)}%
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid xs={6}>
                            <Box>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                Active Lineups
                              </Typography>
                              <Typography level="h4">{dfsStats.activeLineups}</Typography>
                            </Box>
                          </Grid>
                          <Grid xs={6}>
                            <Box>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                Total Points
                              </Typography>
                              <Typography level="h4">
                                {dfsStats.totalPoints.toFixed(0)}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      ) : (
                        <CircularProgress size="sm" />
                      )}
                    </Stack>
                  </Sheet>

                  {/* Fantasy Teams */}
                  {userFantasyTeams.length > 0 && (
                    <Sheet
                      sx={{
                        p: 3,
                        borderRadius: 'md',
                        border: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography
                            level="h4"
                            sx={{ fontFamily: 'serif', fontWeight: 700 }}
                          >
                            🏀 Fantasy Teams
                          </Typography>
                          <Button
                            variant="plain"
                            size="sm"
                            endDecorator={<NavigateNext />}
                            onClick={() => navigate('/fantasy')}
                          >
                            View All
                          </Button>
                        </Stack>
                        <Stack spacing={1}>
                          {userFantasyTeams.slice(0, 3).map((team) => (
                            <Card
                              key={team.leagueId}
                              variant="outlined"
                              sx={{ cursor: 'pointer' }}
                              onClick={() => navigate(`/league/${team.leagueId}`)}
                            >
                              <CardContent>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  alignItems="center"
                                >
                                  <Box>
                                    <Typography level="title-md">
                                      {team.teamName}
                                    </Typography>
                                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                                      {team.leagueName}
                                    </Typography>
                                  </Box>
                                  <Chip color="primary" variant="soft">
                                    #{team.standing}
                                  </Chip>
                                </Stack>
                              </CardContent>
                            </Card>
                          ))}
                        </Stack>
                      </Stack>
                    </Sheet>
                  )}

                  {/* Quick Actions */}
                  <Sheet
                    sx={{
                      p: 3,
                      borderRadius: 'md',
                      border: '2px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack spacing={2}>
                      <Typography
                        level="h4"
                        sx={{ fontFamily: 'serif', fontWeight: 700 }}
                      >
                        🚀 Quick Actions
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid xs={12} sm={6}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startDecorator={<PlayArrow />}
                            onClick={() => navigate('/')}
                          >
                            Watch Highlights
                          </Button>
                        </Grid>
                        <Grid xs={12} sm={6}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startDecorator={<EmojiEvents />}
                            onClick={() => navigate('/dfs')}
                          >
                            Enter DFS Contest
                          </Button>
                        </Grid>
                        <Grid xs={12} sm={6}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startDecorator={<SportsBasketball />}
                            onClick={() => navigate('/fantasy')}
                          >
                            View Fantasy Leagues
                          </Button>
                        </Grid>
                        <Grid xs={12} sm={6}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startDecorator={<Favorite />}
                            onClick={() => navigate('/players')}
                          >
                            Browse Players
                          </Button>
                        </Grid>
                      </Grid>
                    </Stack>
                  </Sheet>

                  {/* Engagement Stats */}
                  <Sheet
                    sx={{
                      p: 3,
                      borderRadius: 'md',
                      border: '2px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack spacing={2}>
                      <Typography
                        level="h4"
                        sx={{ fontFamily: 'serif', fontWeight: 700 }}
                      >
                        📊 Your Activity
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid xs={6}>
                          <Box>
                            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                              This Month
                            </Typography>
                            <Typography level="h4" sx={{ color: 'primary.500' }}>
                              {activity
                                ? Object.values(activity).reduce(
                                    (sum, day) => sum + day.viewed_posts,
                                    0
                                  )
                                : 0}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                              videos watched
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6}>
                          <Box>
                            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                              Completion Rate
                            </Typography>
                            <Typography level="h4" sx={{ color: 'success.500' }}>
                              {activity
                                ? Math.round(
                                    (Object.values(activity).reduce(
                                      (sum, day) => sum + day.viewed_posts,
                                      0
                                    ) /
                                      Math.max(
                                        1,
                                        Object.values(activity).reduce(
                                          (sum, day) => sum + day.total_posts,
                                          0
                                        )
                                      )) *
                                      100
                                  )
                                : 0}
                              %
                            </Typography>
                            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                              this month
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </Stack>
                  </Sheet>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
      </Box>
      
      {/* Edit Profile Modal */}
      <EditProfileModal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
    </Box>
  );
}

