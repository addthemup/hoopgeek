import { Box, Typography, Stack } from '@mui/joy'

interface FoulDrawingStats {
  ftRate: number
  ftRatePer36: number
  andOneRate: number
  shootingFoulsDrawn: number
  offensiveFoulsDrawn: number
  totalFoulsDrawn: number
  fta: number
  ftm: number
}

interface FoulDrawingProfileProps {
  player: {
    name: string
    teamTricode: string
    teamColor: string
    stats: FoulDrawingStats
  }
}

export default function FoulDrawingProfile({ player }: FoulDrawingProfileProps) {
  if (!player || !player.stats) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>No foul drawing data available</Typography>
      </Box>
    )
  }

  const { stats } = player
  const ftPercent = stats.fta > 0 ? (stats.ftm / stats.fta * 100).toFixed(1) : 0

  const metrics = [
    { 
      label: 'FT Rate', 
      value: (stats.ftRate * 100).toFixed(1) + '%', 
      color: '#FFC72C',
      description: 'Free throw attempts per FGA'
    },
    { 
      label: 'FT Rate/36', 
      value: stats.ftRatePer36.toFixed(1), 
      color: '#00FF00',
      description: 'Free throw attempts per 36 min'
    },
    { 
      label: 'And-One Rate', 
      value: (stats.andOneRate * 100).toFixed(1) + '%', 
      color: '#0088FE',
      description: 'And-one plays per drive'
    },
    { 
      label: 'Shooting Fouls', 
      value: stats.shootingFoulsDrawn, 
      color: '#FF8888',
      description: 'Fouls drawn on shots'
    },
  ]

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
          Foul Drawing Profile
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          {player.name} ({player.teamTricode}) • Getting to the Line
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center' }}>
        {metrics.map((metric, index) => (
          <Box 
            key={index}
            sx={{ 
              p: 1.5, 
              bgcolor: 'background.level2', 
              borderRadius: 'sm',
              border: `1px solid ${metric.color}33`
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography level="body-sm" sx={{ fontWeight: 'bold', color: metric.color }}>
                {metric.label}
              </Typography>
              <Typography level="h4" sx={{ fontWeight: 'bold', color: '#fff' }}>
                {metric.value}
              </Typography>
            </Box>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
              {metric.description}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.level2', borderRadius: 'sm' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>FT%</Typography>
            <Typography level="body-sm" sx={{ color: '#00FF00', fontWeight: 'bold' }}>{ftPercent}%</Typography>
          </Box>
          <Box>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>FTA</Typography>
            <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>{stats.fta}</Typography>
          </Box>
          <Box>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Total Fouls Drawn</Typography>
            <Typography level="body-sm" sx={{ color: '#0088FE', fontWeight: 'bold' }}>{stats.totalFoulsDrawn}</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

