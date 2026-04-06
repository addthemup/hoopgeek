import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Stack,
} from '@mui/joy';
import { NavigateBefore, NavigateNext, NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { supabase } from '../../utils/supabase';
import { getTodayEST } from '../../utils/nbaDateUtils';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { TeamOfWeekSection } from '../../pages/Today';
import BestGamesModule from './BestGamesModule';

interface TodayWeeklyProps {
  week: any;
  navigate: (path: string) => void;
  onNavigateToWeek?: (weekNumber: number) => void;
}

export default function TodayWeekly({ week, navigate, onNavigateToWeek }: TodayWeeklyProps) {
  const weekStart = dayjs(week.start_date);
  const weekEnd = dayjs(week.end_date);
  const todayEST = getTodayEST();
  const today = dayjs(todayEST);
  
  // Determine if week is in the past or future
  const isPast = weekEnd.isBefore(today, 'day');
  const isFuture = weekStart.isAfter(today, 'day');
  const isCurrent = !isPast && !isFuture;
  
  // Fetch games for the week (for future weeks)
  const { data: weekGames, isLoading: gamesLoading } = useQuery({
    queryKey: ['week-summary-games', week.start_date, week.end_date],
    queryFn: async () => {
      const { data: games, error } = await supabase
        .from('nba_games')
        .select('*')
        .gte('game_date', week.start_date)
        .lte('game_date', week.end_date)
        .order('game_date', { ascending: true })
        .order('game_time_et', { ascending: true });
      
      if (error) {
        console.error('Error fetching week games:', error);
        return [];
      }
      
      return games || [];
    },
    enabled: isFuture,
  });

  // Get previous and next week numbers for navigation
  const previousWeekNumber = week.week_number > 1 ? week.week_number - 1 : null;
  const nextWeekNumber = week.allWeeks ? 
    (week.allWeeks.find((w: any) => w.week_number === week.week_number + 1) ? week.week_number + 1 : null)
    : null;

  return (
    <Box sx={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, mx: 'auto' }}>
      {/* Week Header with Navigation */}
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', mb: 2 }}>
        <CardContent sx={{ py: 1, px: 2 }}>
          {/* Week Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <IconButton
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => previousWeekNumber && onNavigateToWeek && onNavigateToWeek(previousWeekNumber)}
              disabled={!previousWeekNumber || !onNavigateToWeek}
              sx={{
                color: '#FFFFFF',
                opacity: previousWeekNumber && onNavigateToWeek ? 1 : 0.3,
                p: 0.5,
                minWidth: 32,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <NavigateBefore sx={{ fontSize: 20 }} />
            </IconButton>
            
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                {week.week_name}
              </Typography>
              <Typography level="body-xs" sx={{ color: '#B0B0B0' }}>
                {weekStart.format('MMM D')} - {weekEnd.format('MMM D, YYYY')}
              </Typography>
            </Box>
            
            <IconButton
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => nextWeekNumber && onNavigateToWeek && onNavigateToWeek(nextWeekNumber)}
              disabled={!nextWeekNumber || !onNavigateToWeek}
              sx={{
                color: '#FFFFFF',
                opacity: nextWeekNumber && onNavigateToWeek ? 1 : 0.3,
                p: 0.5,
                minWidth: 32,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <NavigateNext sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      {/* Content based on week state */}
      <Stack spacing={3}>
        {/* Team of the Week - Show for past/current weeks */}
        {(isPast || isCurrent) && (
          <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <CardContent>
              <TeamOfWeekSection 
                navigate={navigate}
                hideHeader={false}
                weekStartDate={week.start_date}
                weekEndDate={week.end_date}
                weekNumber={week.week_number}
                weekName={week.week_name}
              />
            </CardContent>
          </Card>
        )}

        {/* Best Games - Show for all weeks */}
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            <BestGamesModule
              weekStartDate={week.start_date}
              weekEndDate={week.end_date}
              navigate={navigate}
            />
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
