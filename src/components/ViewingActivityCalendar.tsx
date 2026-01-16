/**
 * Calendar Heat Map Component
 * Shows viewing activity as a heat map where intensity = percentage of videos watched
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Sheet,
  Stack,
  Tooltip,
} from '@mui/joy';
import { useViewingActivity } from '../hooks/useViewingActivity';
import { useAuth } from '../hooks/useAuth';

interface ViewingActivityCalendarProps {
  onDateSelect: (date: string | null) => void;
  selectedDate: string | null;
}

export default function ViewingActivityCalendar({
  onDateSelect,
  selectedDate,
}: ViewingActivityCalendarProps) {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: activity, isLoading } = useViewingActivity(user?.id, year, month);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Get all days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();

  // Generate calendar days
  const calendarDays: Array<{ date: Date; dateStr: string; activity?: any }> = [];

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
    });
  }

  const getColorForPercentage = (percentage: number): string => {
    if (percentage === 0) return '#ebedf0'; // Light gray
    if (percentage < 25) return '#c6e48b'; // Light green
    if (percentage < 50) return '#7bc96f'; // Medium green
    if (percentage < 75) return '#239a3b'; // Dark green
    if (percentage < 100) return '#196127'; // Very dark green
    return '#d73027'; // Red for 100%
  };

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

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Sheet
      sx={{
        p: 3,
        borderRadius: 'md',
        border: '2px solid',
        borderColor: 'divider',
        bgcolor: 'background.surface',
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography level="h4" sx={{ fontFamily: 'serif', fontWeight: 700 }}>
            📅 Viewing Activity
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              component="button"
              onClick={() => navigateMonth('prev')}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.level1',
                px: 1.5,
                py: 0.5,
                borderRadius: 'sm',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'background.level2' },
              }}
            >
              ←
            </Box>
            <Typography level="title-md" sx={{ minWidth: 150, textAlign: 'center' }}>
              {monthNames[month - 1]} {year}
            </Typography>
            <Box
              component="button"
              onClick={() => navigateMonth('next')}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.level1',
                px: 1.5,
                py: 0.5,
                borderRadius: 'sm',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'background.level2' },
              }}
            >
              →
            </Box>
          </Stack>
        </Stack>

        {/* Legend */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ fontSize: '0.75rem' }}>
          <Typography level="body-xs">Less</Typography>
          <Stack direction="row" spacing={0.5}>
            <Box sx={{ width: 12, height: 12, bgcolor: '#ebedf0', borderRadius: '2px' }} />
            <Box sx={{ width: 12, height: 12, bgcolor: '#c6e48b', borderRadius: '2px' }} />
            <Box sx={{ width: 12, height: 12, bgcolor: '#7bc96f', borderRadius: '2px' }} />
            <Box sx={{ width: 12, height: 12, bgcolor: '#239a3b', borderRadius: '2px' }} />
            <Box sx={{ width: 12, height: 12, bgcolor: '#196127', borderRadius: '2px' }} />
            <Box sx={{ width: 12, height: 12, bgcolor: '#d73027', borderRadius: '2px' }} />
          </Stack>
          <Typography level="body-xs">More</Typography>
        </Stack>

        {/* Calendar Grid */}
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography level="body-sm">Loading activity...</Typography>
          </Box>
        ) : (
          <Box>
            {/* Day names header */}
            <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
              {dayNames.map((day) => (
                <Box
                  key={day}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    fontWeight: 600,
                  }}
                >
                  {day}
                </Box>
              ))}
            </Stack>

            {/* Calendar days */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 0.5,
              }}
            >
              {calendarDays.map((day, index) => {
                if (!day.dateStr) {
                  return <Box key={`empty-${index}`} sx={{ aspectRatio: '1' }} />;
                }

                const isToday = day.dateStr === todayStr;
                const isSelected = day.dateStr === selectedDate;
                const percentage = day.activity?.percentage || 0;
                const color = getColorForPercentage(percentage);

                return (
                  <Tooltip
                    key={day.dateStr}
                    title={
                      day.activity
                        ? `${day.activity.viewed_posts}/${day.activity.total_posts} videos watched (${percentage}%)`
                        : 'No videos available'
                    }
                    arrow
                  >
                    <Box
                      onClick={() => onDateSelect(day.dateStr)}
                      sx={{
                        aspectRatio: '1',
                        bgcolor: color,
                        borderRadius: 'sm',
                        border: isSelected
                          ? '3px solid'
                          : isToday
                            ? '2px solid'
                            : '1px solid',
                        borderColor: isSelected
                          ? 'primary.500'
                          : isToday
                            ? 'warning.500'
                            : 'transparent',
                        cursor: 'pointer',
                        position: 'relative',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          zIndex: 1,
                          boxShadow: 'md',
                        },
                        transition: 'all 0.2s',
                      }}
                    >
                      {isToday && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            bgcolor: 'warning.500',
                          }}
                        />
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        )}
      </Stack>
    </Sheet>
  );
}

