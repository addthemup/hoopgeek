/**
 * Enhanced Interactive Calendar Component - Mobile First
 * Inspired by Focus To-Do: Focus Timer & Tasks app
 * Shows viewing activity with circular progress indicators
 * Uses MUI X DateCalendar with dynamic data source
 */

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Sheet,
  Stack,
  Tooltip,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Grid,
  Avatar,
  LinearProgress,
} from '@mui/joy';
import { useViewingActivity, useFeedPostsByDate } from '../hooks/useViewingActivity';
import { useGamesByDate } from '../hooks/useGamesByDate';
import { useDateRecommendations } from '../hooks/useDateRecommendations';
import { useAuth } from '../hooks/useAuth';
import { usePlayerFavorites } from '../hooks/usePlayerFavorites';
import { useFavoriteTeams } from '../hooks/useUserSettings';
import { useNavigate } from 'react-router-dom';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { PlayArrow, NavigateNext, NavigateBefore, Star, TrendingUp, EmojiEvents, Visibility, VisibilityOff, Favorite, Whatshot } from '@mui/icons-material';
import { IconButton } from '@mui/joy';
import { supabase } from '../utils/supabase';
import { useMediaQuery } from '@mui/material';
import { useEngagementSessions } from '../hooks/useEngagementSessions';

interface EnhancedViewingActivityCalendarProps {
  onDateSelect?: (date: string | null) => void;
  selectedDate?: string | null;
}

export default function EnhancedViewingActivityCalendar({
  onDateSelect,
  selectedDate,
}: EnhancedViewingActivityCalendarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [localSelectedDate, setLocalSelectedDate] = useState<string | null>(selectedDate || null);
  const [viewMode, setViewMode] = useState<'all' | 'unwatched' | 'favorites' | 'highlights'>('all');
  const [showDateDetails, setShowDateDetails] = useState(false);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: activity, isLoading } = useViewingActivity(user?.id, year, month);
  const { data: engagementData, isLoading: engagementLoading } = useEngagementSessions(user?.id, year, month);
  const { data: favoritePlayers } = usePlayerFavorites();
  const { data: favoriteTeams } = useFavoriteTeams(user?.id);

  // Get favorite team tricodes and player IDs
  const favoriteTeamTricodes = favoriteTeams?.map((team: any) => team.team_abbreviation) || [];
  const favoritePlayerIds = favoritePlayers?.map((fp: any) => fp.nba_players?.nba_player_id).filter(Boolean) || [];

  // Fetch games for the entire month to show on calendar days
  const [monthGames, setMonthGames] = useState<Record<string, number>>({});
  const [monthGamesWithFavorites, setMonthGamesWithFavorites] = useState<Record<string, boolean>>({});
  const [teamViewingStats, setTeamViewingStats] = useState<Array<{ team: string; hours: number; minutes: number }>>([]);

  useEffect(() => {
    const fetchMonthGames = async () => {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const { data: games, error } = await supabase
        .from('nba_games')
        .select('game_date, home_team_tricode, away_team_tricode')
        .gte('game_date', startDate.toISOString())
        .lte('game_date', endDate.toISOString());

      if (error) {
        console.error('Error fetching month games:', error);
        return;
      }

      const gamesByDate: Record<string, number> = {};
      const favoritesByDate: Record<string, boolean> = {};

      (games || []).forEach((game) => {
        const dateStr = new Date(game.game_date).toISOString().split('T')[0];
        gamesByDate[dateStr] = (gamesByDate[dateStr] || 0) + 1;
        
        if (!favoritesByDate[dateStr]) {
          favoritesByDate[dateStr] = 
            favoriteTeamTricodes.includes(game.home_team_tricode) ||
            favoriteTeamTricodes.includes(game.away_team_tricode);
        }
      });

      setMonthGames(gamesByDate);
      setMonthGamesWithFavorites(favoritesByDate);
    };

    fetchMonthGames();
  }, [year, month, favoriteTeamTricodes]);

  // Fetch team viewing stats
  useEffect(() => {
    const fetchTeamStats = async () => {
      if (!user?.id) return;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get viewed posts with team info
      const { data: viewedPosts } = await supabase
        .from('user_viewed_posts')
        .select('content_id, feed_content!inner(game_id, game_date, feed_posts!inner(team_tricodes))')
        .eq('user_id', user.id)
        .gte('feed_content.game_date', startDate.toISOString())
        .lte('feed_content.game_date', endDate.toISOString());

      if (!viewedPosts) return;

      const teamStats: Record<string, number> = {};
      viewedPosts.forEach((vp: any) => {
        const teams = vp.feed_content?.feed_posts?.team_tricodes || [];
        teams.forEach((team: string) => {
          teamStats[team] = (teamStats[team] || 0) + 1; // Count posts per team
        });
      });

      const sorted = Object.entries(teamStats)
        .map(([team, count]) => ({
          team,
          hours: Math.floor(count * 2 / 60), // Estimate ~2 min per post
          minutes: (count * 2) % 60,
        }))
        .sort((a, b) => (b.hours * 60 + b.minutes) - (a.hours * 60 + a.minutes))
        .slice(0, 5);

      setTeamViewingStats(sorted);
    };

    fetchTeamStats();
  }, [user?.id, year, month]);

  // Fetch data for selected date
  const { data: games, isLoading: gamesLoading } = useGamesByDate(localSelectedDate);
  const { data: datePosts, isLoading: postsLoading } = useFeedPostsByDate(localSelectedDate);
  const { data: recommendations, isLoading: recommendationsLoading } = useDateRecommendations(
    localSelectedDate,
    favoriteTeamTricodes,
    favoritePlayerIds
  );

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleDateClick = (dateStr: string) => {
    setLocalSelectedDate(dateStr);
    setShowDateDetails(true);
    if (onDateSelect) {
      onDateSelect(dateStr);
    }
  };

  const handleBackToCalendar = () => {
    setShowDateDetails(false);
    setLocalSelectedDate(null);
    if (onDateSelect) {
      onDateSelect(null);
    }
  };

  const handleNavigateDate = (direction: 'prev' | 'next') => {
    if (!localSelectedDate) return;
    
    const current = new Date(localSelectedDate);
    const newDate = new Date(current);
    
    if (direction === 'prev') {
      newDate.setDate(current.getDate() - 1);
    } else {
      newDate.setDate(current.getDate() + 1);
    }
    
    const newDateStr = newDate.toISOString().split('T')[0];
    setLocalSelectedDate(newDateStr);
    if (onDateSelect) {
      onDateSelect(newDateStr);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Get all days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();

  // Generate calendar days
  const calendarDays: Array<{ date: Date; dateStr: string; activity?: any; engagement?: any }> = [];

  // Add empty cells for days before month starts
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push({
      date: new Date(year, month - 1, -i),
      dateStr: '',
    });
  }

  // Add all days in month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dateStr = date.toISOString().split('T')[0];
    calendarDays.push({
      date,
      dateStr,
      activity: activity?.[dateStr],
      engagement: engagementData?.[dateStr],
    });
  }

  // Calculate max values for heat map scaling
  const maxWatchTime = engagementData ? Math.max(...Object.values(engagementData).map(e => e.watch_time_hours), 0) : 0;
  const maxSessionTime = engagementData ? Math.max(...Object.values(engagementData).map(e => e.session_time_hours), 0) : 0;
  // Use the maximum of watch time or session time for scaling, with a minimum to ensure colors show
  const maxEngagement = Math.max(maxWatchTime, maxSessionTime, 0.1); // Minimum 0.1 hours to ensure some scaling
  const maxGames = Math.max(...Object.values(monthGames), 0);
  
  // Debug: Log engagement data to see what we're getting
  console.log('Engagement Data:', engagementData);
  console.log('Max Engagement:', maxEngagement);

  // Calculate monthly stats
  const monthlyStats = activity ? {
    totalVideos: Object.values(activity).reduce((sum, day) => sum + day.total_posts, 0),
    watchedVideos: Object.values(activity).reduce((sum, day) => sum + day.viewed_posts, 0),
    completionRate: Object.values(activity).reduce((sum, day) => sum + day.percentage, 0) / Object.keys(activity).length,
  } : { totalVideos: 0, watchedVideos: 0, completionRate: 0 };

  // If showing date details, render that view instead
  if (showDateDetails && localSelectedDate) {
    return (
      <Box sx={{ width: '100%' }}>
        <Stack spacing={2}>
          {/* Date Details Header */}
          <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Button
                  variant="plain"
                  size="sm"
                  startDecorator={<NavigateBefore />}
                  onClick={handleBackToCalendar}
                  sx={{ color: '#FFFFFF' }}
                >
                  Back
                </Button>
                
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton
                    size="sm"
                    variant="plain"
                    onClick={() => handleNavigateDate('prev')}
                    sx={{ color: '#FFFFFF' }}
                  >
                    <NavigateBefore />
                  </IconButton>
                  <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem', minWidth: 140, textAlign: 'center' }}>
                    {new Date(localSelectedDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Typography>
                  <IconButton
                    size="sm"
                    variant="plain"
                    onClick={() => handleNavigateDate('next')}
                    sx={{ color: '#FFFFFF' }}
                  >
                    <NavigateNext />
                  </IconButton>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* Date Details Content */}
          <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <CardContent sx={{ p: 2 }}>
              <Grid container spacing={1.5}>
                {/* Games */}
                {games && games.length > 0 && (
                  <Grid xs={12}>
                    <Typography level="title-sm" sx={{ color: '#FFFFFF', mb: 1.5, fontWeight: 700, fontSize: '0.85rem' }}>
                      🏀 Games
                    </Typography>
                    <Stack spacing={1}>
                      {games.map((game) => (
                        <Button
                          key={game.game_id}
                          variant="outlined"
                          fullWidth
                          size="sm"
                          onClick={() => navigate(`/game/${game.game_id}`)}
                          sx={{
                            justifyContent: 'flex-start',
                            borderColor: '#333333',
                            color: '#FFFFFF',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                            <Avatar src={getTeamLogoUrl(game.away_team_tricode)} size="sm" sx={{ width: 20, height: 20 }} />
                            <Typography level="body-sm" sx={{ flex: 1, fontSize: '0.75rem' }}>
                              {game.away_team_tricode} @ {game.home_team_tricode}
                            </Typography>
                            {game.game_status_text === 'Final' && (
                              <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.7rem' }}>
                                {game.away_team_score} - {game.home_team_score}
                              </Typography>
                            )}
                          </Stack>
                        </Button>
                      ))}
                    </Stack>
                  </Grid>
                )}

                {/* Viewing History */}
                {datePosts && datePosts.length > 0 && (
                  <Grid xs={12}>
                    <Typography level="title-sm" sx={{ color: '#FFFFFF', mb: 1.5, mt: 2, fontWeight: 700, fontSize: '0.85rem' }}>
                      👀 What You've Watched
                    </Typography>
                    <Stack spacing={1}>
                      {datePosts.slice(0, 5).map((post: any) => (
                        <Button
                          key={post.id}
                          variant="outlined"
                          fullWidth
                          size="sm"
                          onClick={() => navigate(`/${post.id}`)}
                          sx={{
                            justifyContent: 'flex-start',
                            borderColor: '#333333',
                            color: '#FFFFFF',
                          }}
                        >
                          <Typography level="body-sm" sx={{ fontSize: '0.75rem', textAlign: 'left', flex: 1 }}>
                            {post.title || `${post.post_type} - ${post.game_id}`}
                          </Typography>
                        </Button>
                      ))}
                      {datePosts.length > 5 && (
                        <Typography level="body-xs" sx={{ color: '#999999', textAlign: 'center', mt: 0.5, fontSize: '0.7rem' }}>
                          +{datePosts.length - 5} more posts
                        </Typography>
                      )}
                    </Stack>
                  </Grid>
                )}

                {/* Recommendations */}
                {recommendations && recommendations.length > 0 && (
                  <Grid xs={12}>
                    <Typography level="title-sm" sx={{ color: '#FFFFFF', mb: 1.5, mt: 2, fontWeight: 700, fontSize: '0.85rem' }}>
                      ⭐ Recommended for You
                    </Typography>
                    <Stack spacing={1}>
                      {recommendations.map((rec) => (
                        <Button
                          key={rec.id}
                          variant="outlined"
                          fullWidth
                          size="sm"
                          onClick={() => navigate(`/${rec.id}`)}
                          startDecorator={<Star sx={{ fontSize: 14 }} />}
                          sx={{
                            justifyContent: 'flex-start',
                            borderColor: '#333333',
                            color: '#FFFFFF',
                          }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                            <Chip size="sm" color="primary" variant="soft" sx={{ fontSize: '0.65rem' }}>
                              {rec.reason === 'favorite_team' ? 'Team' : 
                               rec.reason === 'favorite_player' ? 'Player' :
                               rec.reason === 'high_fun_score' ? 'Fun' : 'Fantasy'}
                            </Chip>
                            <Typography level="body-sm" sx={{ fontSize: '0.75rem', textAlign: 'left', flex: 1 }}>
                              {rec.title || `${rec.post_type}`}
                            </Typography>
                            {rec.score && (
                              <Typography level="body-xs" sx={{ color: '#FFC72C', fontSize: '0.7rem' }}>
                                {rec.score.toFixed(1)}
                              </Typography>
                            )}
                          </Stack>
                        </Button>
                      ))}
                    </Stack>
                  </Grid>
                )}

                {/* No Content Message */}
                {(!games || games.length === 0) && (!datePosts || datePosts.length === 0) && (!recommendations || recommendations.length === 0) && (
                  <Grid xs={12}>
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography level="body-sm" sx={{ color: '#999999' }}>
                        No content available for this date
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={2}>
        {/* Stats Cards - Top Row */}
        <Grid container spacing={1}>
          <Grid xs={4}>
            <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', p: 1, textAlign: 'center' }}>
              <Typography level="h2" sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1.1rem' }}>
                {monthlyStats.watchedVideos}
              </Typography>
              <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.6rem', mt: 0.25 }}>
                This Month
              </Typography>
            </Card>
          </Grid>
          <Grid xs={4}>
            <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', p: 1, textAlign: 'center' }}>
              <Typography level="h2" sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1.1rem' }}>
                {Math.round(monthlyStats.completionRate)}%
              </Typography>
              <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.6rem', mt: 0.25 }}>
                Completion
              </Typography>
            </Card>
          </Grid>
          <Grid xs={4}>
            <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', p: 1, textAlign: 'center' }}>
              <Typography level="h2" sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '1.1rem' }}>
                {Object.keys(monthGames).length}
              </Typography>
              <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.6rem', mt: 0.25 }}>
                Game Days
              </Typography>
            </Card>
          </Grid>
        </Grid>

        {/* Calendar Card */}
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent sx={{ p: 1.5 }}>
            {/* Calendar Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.75rem' }}>
                Viewing Activity & Engagement
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton
                  size="sm"
                  variant="plain"
                  onClick={() => navigateMonth('prev')}
                  sx={{ color: '#FFFFFF', '--IconButton-size': '28px' }}
                >
                  <NavigateBefore sx={{ fontSize: '1rem' }} />
                </IconButton>
                <Typography level="body-sm" sx={{ color: '#FFFFFF', minWidth: 90, textAlign: 'center', fontSize: '0.7rem' }}>
                  {monthNames[month - 1]} {year}
                </Typography>
                <IconButton
                  size="sm"
                  variant="plain"
                  onClick={() => navigateMonth('next')}
                  sx={{ color: '#FFFFFF', '--IconButton-size': '28px' }}
                >
                  <NavigateNext sx={{ fontSize: '1rem' }} />
                </IconButton>
              </Stack>
            </Stack>

            {/* Day Names Header */}
            <Grid container spacing={0.25} sx={{ mb: 0.5 }}>
              {dayNames.map((day) => (
                <Grid xs={12/7} key={day}>
                  <Typography level="body-xs" sx={{ textAlign: 'center', color: '#999999', fontSize: '0.6rem', fontWeight: 600 }}>
                    {day}
                  </Typography>
                </Grid>
              ))}
            </Grid>

            {/* Legend */}
            <Stack direction="row" spacing={2} sx={{ mb: 1, justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#ebedf0' }} />
                <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.6rem' }}>
                  No activity
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#c6e48b' }} />
                <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.6rem' }}>
                  Low
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#7bc96f' }} />
                <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.6rem' }}>
                  Medium
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#239a3b' }} />
                <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.6rem' }}>
                  High
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CircularProgress
                  determinate
                  value={50}
                  size="sm"
                  sx={{
                    '--CircularProgress-size': '12px',
                    '--CircularProgress-trackThickness': '2px',
                    '--CircularProgress-progressThickness': '2px',
                    '--CircularProgress-progressColor': '#FFC72C',
                    '--CircularProgress-trackColor': 'transparent',
                  }}
                />
                <Typography level="body-xs" sx={{ color: '#999999', fontSize: '0.6rem' }}>
                  View %
                </Typography>
              </Stack>
            </Stack>

            {/* Calendar Grid */}
            {isLoading || engagementLoading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <CircularProgress size="sm" />
              </Box>
            ) : (
              <Grid container spacing={0.25}>
                {calendarDays.map((day, index) => {
                  if (!day.dateStr) {
                    return <Grid xs={12/7} key={`empty-${index}`}><Box sx={{ minHeight: '32px' }} /></Grid>;
                  }

                  const isToday = day.dateStr === todayStr;
                  const isSelected = day.dateStr === localSelectedDate;
                  const percentage = day.activity?.percentage || 0;
                  const gameCount = monthGames[day.dateStr] || 0;
                  const hasFavoriteTeam = monthGamesWithFavorites[day.dateStr] || false;
                  const watchTime = day.engagement?.watch_time_hours || 0;
                  const sessionTime = day.engagement?.session_time_hours || 0;
                  const sessionsCount = day.engagement?.sessions_count || 0;
                  
                  // Use session time if watch time is 0, or combine both metrics
                  const engagementMetric = watchTime > 0 ? watchTime : sessionTime;
                  
                  // Calculate heat map intensity (0-1) for engagement using pre-calculated max
                  const engagementIntensity = maxEngagement > 0 ? Math.min(engagementMetric / maxEngagement, 1) : 0;
                  
                  // Get color for engagement heat map (green scale)
                  const getEngagementColor = (intensity: number) => {
                    if (intensity === 0) return 'rgba(255, 255, 255, 0.05)'; // Very light background
                    if (intensity < 0.2) return '#c6e48b'; // Light green
                    if (intensity < 0.4) return '#7bc96f'; // Medium green
                    if (intensity < 0.6) return '#239a3b'; // Dark green
                    if (intensity < 0.8) return '#196127'; // Very dark green
                    return '#0e4a1a'; // Darkest green
                  };

                  return (
                    <Grid xs={12/7} key={day.dateStr}>
                      <Tooltip
                        title={
                          <Box>
                            <Typography level="body-sm" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {new Date(day.dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </Typography>
                            {day.activity && (
                              <Typography level="body-xs">
                                {day.activity.viewed_posts}/{day.activity.total_posts} videos ({percentage}%)
                              </Typography>
                            )}
                            {(watchTime > 0 || sessionTime > 0) && (
                              <Typography level="body-xs" sx={{ mt: 0.5, color: '#4CAF50' }}>
                                {watchTime > 0 ? `${watchTime.toFixed(1)}h watch` : `${sessionTime.toFixed(1)}h session`}
                                {sessionsCount > 1 && ` • ${sessionsCount} sessions`}
                              </Typography>
                            )}
                            {gameCount > 0 && (
                              <Typography level="body-xs" sx={{ mt: 0.5 }}>
                                {gameCount} game{gameCount !== 1 ? 's' : ''}
                              </Typography>
                            )}
                          </Box>
                        }
                        arrow
                      >
                        <Box
                          onClick={() => handleDateClick(day.dateStr)}
                          sx={{
                            position: 'relative',
                            minHeight: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            borderRadius: 'sm',
                            border: isSelected ? '2px solid #FFC72C' : isToday ? '1.5px solid #FFC72C' : 'none',
                            // Heat map background for engagement
                            bgcolor: getEngagementColor(engagementIntensity),
                            '&:hover': {
                              transform: 'scale(1.1)',
                              zIndex: 1,
                              boxShadow: 'md',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          {/* Circular Progress for viewing activity */}
                          {percentage > 0 && (
                            <CircularProgress
                              determinate
                              value={percentage}
                              size="sm"
                              sx={{
                                position: 'absolute',
                                '--CircularProgress-size': '32px',
                                '--CircularProgress-trackThickness': '2px',
                                '--CircularProgress-progressThickness': '2px',
                                '--CircularProgress-progressColor': percentage >= 75 ? '#FFC72C' : percentage >= 50 ? '#FFA500' : '#FFD700',
                                '--CircularProgress-trackColor': 'transparent',
                              }}
                            />
                          )}
                          
                          {/* Date Number */}
                          <Typography
                            level="body-sm"
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: isToday ? 700 : 600,
                              color: engagementIntensity > 0.4 ? '#FFFFFF' : engagementIntensity > 0 ? '#333333' : '#FFFFFF',
                              zIndex: 1,
                              position: 'relative',
                            }}
                          >
                            {day.date.getDate()}
                          </Typography>

                          {/* Game Count Badge */}
                          {gameCount > 0 && (
                            <Chip
                              size="sm"
                              variant="solid"
                              color={hasFavoriteTeam ? 'warning' : 'neutral'}
                              sx={{
                                position: 'absolute',
                                top: -3,
                                right: -3,
                                minHeight: '12px',
                                height: '12px',
                                fontSize: '0.5rem',
                                px: 0.25,
                                fontWeight: 700,
                                '--Chip-radius': '6px',
                                zIndex: 2,
                              }}
                            >
                              {gameCount}
                            </Chip>
                          )}
                        </Box>
                      </Tooltip>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </CardContent>
        </Card>

        {/* Focus Time Chart - Team/Player Viewing */}
        {teamViewingStats.length > 0 && (
          <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 2, fontSize: '0.9rem' }}>
                Focus Time by Team
              </Typography>
              <Stack spacing={1.5}>
                {teamViewingStats.map((stat, idx) => {
                  const totalMinutes = stat.hours * 60 + stat.minutes;
                  const maxMinutes = teamViewingStats[0]?.hours * 60 + (teamViewingStats[0]?.minutes || 0);
                  const percentage = maxMinutes > 0 ? (totalMinutes / maxMinutes) * 100 : 0;
                  
                  return (
                    <Box key={stat.team}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar
                            src={getTeamLogoUrl(stat.team)}
                            size="sm"
                            sx={{ width: 24, height: 24 }}
                          />
                          <Typography level="body-sm" sx={{ color: '#FFFFFF', fontSize: '0.8rem' }}>
                            {stat.team}
                          </Typography>
                        </Stack>
                        <Typography level="body-sm" sx={{ color: '#999999', fontSize: '0.75rem' }}>
                          {stat.hours > 0 ? `${stat.hours}h ` : ''}{stat.minutes}m
                        </Typography>
                      </Stack>
                      <LinearProgress
                        determinate
                        value={percentage}
                        sx={{
                          '--LinearProgress-thickness': '8px',
                          '--LinearProgress-radius': '4px',
                        }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        )}

      </Stack>
    </Box>
  );
}
