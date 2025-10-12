import React from 'react';
import { Box, Typography, Card, CardContent, LinearProgress } from '@mui/joy';
import { TrendingUp } from '@mui/icons-material';

interface TeamPerformanceRadialProps {
  teamId: string;
}

export default function TeamPerformanceRadial({ teamId }: TeamPerformanceRadialProps) {
  // Placeholder mock data for different performance metrics
  const metrics = [
    { category: 'Points', value: 85, rank: 3, total: 12 },
    { category: 'Rebounds', value: 72, rank: 5, total: 12 },
    { category: 'Assists', value: 90, rank: 2, total: 12 },
    { category: 'Steals', value: 65, rank: 7, total: 12 },
    { category: 'Blocks', value: 78, rank: 4, total: 12 },
    { category: 'FG%', value: 88, rank: 1, total: 12 },
  ];

  const getColor = (value: number) => {
    if (value >= 80) return 'success';
    if (value >= 60) return 'primary';
    if (value >= 40) return 'warning';
    return 'danger';
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography level="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          📊 Performance vs League
        </Typography>
        
        <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
          Team ranking across all statistical categories
        </Typography>

        {metrics.map((metric) => (
          <Box key={metric.category} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                {metric.category}
              </Typography>
              <Typography level="body-xs" color="neutral">
                #{metric.rank} of {metric.total}
              </Typography>
            </Box>
            <LinearProgress
              determinate
              value={metric.value}
              color={getColor(metric.value)}
              sx={{ height: 8, borderRadius: 'sm' }}
            />
          </Box>
        ))}

        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <TrendingUp sx={{ color: 'success.500' }} />
          <Typography level="body-sm" color="success">
            Team is performing above league average
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

