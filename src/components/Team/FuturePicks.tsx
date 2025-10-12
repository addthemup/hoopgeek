import React from 'react';
import { Box, Typography, Card, CardContent, Stack, Chip } from '@mui/joy';
import { CalendarMonth, SportsBasketball } from '@mui/icons-material';

interface FuturePicksProps {
  teamId: string;
}

export default function FuturePicks({ teamId }: FuturePicksProps) {
  // Placeholder mock data
  const futurePicks = [
    { year: 2026, round: 1, from: 'Own Pick', projected: 5 },
    { year: 2026, round: 2, from: 'Own Pick', projected: 17 },
    { year: 2027, round: 1, from: 'Own Pick', projected: 8 },
    { year: 2027, round: 1, from: 'Team B', projected: 12 },
  ];

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography level="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          📅 Future Draft Picks
        </Typography>
        
        {futurePicks.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ textAlign: 'center', py: 3 }}>
            No future picks available
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {futurePicks.map((pick, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 'sm',
                  bgcolor: 'background.level1',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SportsBasketball sx={{ fontSize: '1.2rem', color: 'primary.500' }} />
                  <Box>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {pick.year} Round {pick.round}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {pick.from}
                    </Typography>
                  </Box>
                </Box>
                <Chip size="sm" variant="soft" color="primary">
                  ~#{pick.projected}
                </Chip>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

