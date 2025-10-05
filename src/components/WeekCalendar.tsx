import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Alert,
} from '@mui/joy';
import { useWeekSchedule } from '../hooks/useNBASchedule';

interface WeekCalendarProps {
  weekNumber: number;
}

export default function WeekCalendar({ weekNumber }: WeekCalendarProps) {
  const { data: weekSchedule, isLoading, error } = useWeekSchedule(weekNumber);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <LinearProgress sx={{ flex: 1 }} />
        <Typography level="body-xs">Loading...</Typography>
      </Box>
    );
  }

  if (error || !weekSchedule) {
    return null; // Fail silently for a non-focal component
  }

  // Get the start date of the week (Monday)
  const getWeekStartDate = (weekNumber: number) => {
    // This is a simplified calculation - in a real app you'd get this from your season data
    const seasonStart = new Date('2025-10-23'); // Season start date
    const weekStart = new Date(seasonStart);
    weekStart.setDate(seasonStart.getDate() + (weekNumber - 1) * 7);
    
    // Adjust to Monday (assuming season starts on a Wednesday, adjust accordingly)
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, Monday = 1
    weekStart.setDate(weekStart.getDate() + daysToMonday);
    
    return weekStart;
  };

  const weekStart = getWeekStartDate(weekNumber);
  const today = new Date();
  
  // Create array of 7 days starting from Monday
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Group games by day
  const gamesByDay: { [key: string]: any[] } = {};
  weekSchedule.games.forEach(game => {
    const gameDate = new Date(game.game_date);
    const dayKey = gameDate.toISOString().split('T')[0];
    if (!gamesByDay[dayKey]) {
      gamesByDay[dayKey] = [];
    }
    gamesByDay[dayKey].push(game);
  });

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const getGameCount = (date: Date) => {
    const dayKey = date.toISOString().split('T')[0];
    return gamesByDay[dayKey]?.length || 0;
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Grid container spacing={1} sx={{ display: 'flex', flexWrap: 'nowrap' }}>
        {days.map((date, index) => {
          const gameCount = getGameCount(date);
          const isCurrentDay = isToday(date);
          
          return (
            <Grid xs={12/7} key={index} sx={{ minWidth: 0, flex: 1 }}>
              <Card 
                variant={isCurrentDay ? "solid" : "outlined"}
                color={isCurrentDay ? "primary" : "neutral"}
                sx={{ 
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'default',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 'sm'
                  }
                }}
              >
                <CardContent sx={{ p: 1, textAlign: 'center', width: '100%' }}>
                  <Typography 
                    level="body-xs" 
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                      color: isCurrentDay ? 'white' : 'text.primary',
                      mb: 0.5
                    }}
                  >
                    {dayNames[index]}
                  </Typography>
                  
                  <Typography 
                    level="body-xs" 
                    sx={{ 
                      fontSize: '0.65rem',
                      color: isCurrentDay ? 'white' : 'text.secondary',
                      mb: 0.5
                    }}
                  >
                    {date.getDate()}
                  </Typography>
                  
                  {gameCount > 0 && (
                    <Chip 
                      size="sm" 
                      variant={isCurrentDay ? "soft" : "outlined"}
                      color={isCurrentDay ? "neutral" : "primary"}
                      sx={{ 
                        fontSize: '0.6rem',
                        height: '16px',
                        minHeight: '16px',
                        '--Chip-radius': '8px'
                      }}
                    >
                      {gameCount}
                    </Chip>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
