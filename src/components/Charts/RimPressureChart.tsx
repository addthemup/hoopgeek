import { Box, Typography, Stack, Grid } from '@mui/joy'

interface RimPressureStats {
  drives: number
  rimAttempts: number
  rimFTA: number
  passOuts: number
  rimFGM: number
  rimFGA: number
}

interface RimPressureChartProps {
  player: {
    name: string
    teamTricode: string
    teamColor: string
    stats: RimPressureStats
  }
}

export default function RimPressureChart({ player }: RimPressureChartProps) {
  if (!player || !player.stats) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>No rim pressure data available</Typography>
      </Box>
    )
  }

  const { stats } = player
  const rimFG = stats.rimFGA > 0 ? (stats.rimFGM / stats.rimFGA * 100).toFixed(1) : 0
  const driveToRimRate = stats.drives > 0 ? (stats.rimAttempts / stats.drives * 100).toFixed(1) : 0
  const rimScoreRate = stats.rimAttempts > 0 ? ((stats.rimFGM + stats.rimFTA) / stats.rimAttempts * 100).toFixed(1) : 0

  const metrics = [
    { label: 'Drives', value: stats.drives, color: '#FFC72C' },
    { label: 'Rim Attempts', value: stats.rimAttempts, color: '#00FF00' },
    { label: 'Rim FTAs', value: stats.rimFTA, color: '#0088FE' },
    { label: 'Pass Outs', value: stats.passOuts, color: '#FF8888' },
  ]

  const maxValue = Math.max(...metrics.map(m => m.value), 1)

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.body',
      p: 0.25
    }}>
      <Box sx={{ mb: 2 }}>
        <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
          Rim Pressure
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          {player.name} ({player.teamTricode}) • Drive Impact
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center' }}>
        {metrics.map((metric, index) => {
          const percentage = (metric.value / maxValue) * 100
          return (
            <Box key={index}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: metric.color }}>
                  {metric.label}
                </Typography>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#fff' }}>
                  {metric.value}
                </Typography>
              </Box>
              <Box sx={{ 
                width: '100%', 
                height: 32,
                bgcolor: 'background.level2',
                borderRadius: 'sm',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <Box sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, ${metric.color}, ${metric.color}CC)`,
                  transition: 'width 0.5s ease-out',
                }} />
              </Box>
            </Box>
          )
        })}
      </Stack>

      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.level2', borderRadius: 'sm' }}>
        <Grid container spacing={1}>
          <Grid xs={6}>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Rim FG%</Typography>
            <Typography level="body-sm" sx={{ color: '#00FF00', fontWeight: 'bold' }}>{rimFG}%</Typography>
          </Grid>
          <Grid xs={6}>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Drive→Rim Rate</Typography>
            <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>{driveToRimRate}%</Typography>
          </Grid>
          <Grid xs={6}>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Rim Score Rate</Typography>
            <Typography level="body-sm" sx={{ color: '#0088FE', fontWeight: 'bold' }}>{rimScoreRate}%</Typography>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}

