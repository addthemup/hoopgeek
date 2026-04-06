import React, { useMemo } from 'react'
import { Box, Card, CardContent, Stack } from '@mui/joy'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { useNBAScoreboard } from '../hooks/useNBAScoreboard'
import { getTodayEST } from '../utils/nbaDateUtils'
import { PropPerformanceModule, PropPredictionsModule } from './Today'

export default function Props() {
  const navigate = useNavigate()
  const todayEST = getTodayEST()
  const selectedDate = useMemo(() => dayjs(todayEST), [todayEST])
  const { data: nbaScoreboard } = useNBAScoreboard(todayEST)

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        pt: { xs: 2, md: 3 },
        pb: 6,
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <Stack spacing={2.5}>
        <Card variant="outlined" sx={{ bgcolor: '#111111', borderColor: '#222222' }}>
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <PropPredictionsModule
              selectedDate={selectedDate as any}
              navigate={(path) => navigate(path)}
              nbaScoreboard={nbaScoreboard as any}
              embedMode="full"
            />
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ bgcolor: '#111111', borderColor: '#222222' }}>
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <PropPerformanceModule selectedDate={selectedDate as any} navigate={(path) => navigate(path)} onOpen={() => {}} />
          </CardContent>
        </Card>
      </Stack>
    </Box>
  )
}

