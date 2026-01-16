import { Box, Typography } from '@mui/joy'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts'

interface HustleStats {
  deflections: number
  chargesDrawn: number
  screenAssists: number
  looseBalls: number
  boxOuts: number
  contestedShots: number
}

interface PlayerHustle {
  name: string
  teamTricode: string
  color: string
  stats: HustleStats
}

interface HustleRadarChartProps {
  player: PlayerHustle
  title?: string
}

export default function HustleRadarChart({ player, title }: HustleRadarChartProps) {
  // Normalize stats to 0-100 scale for better radar visualization
  const maxValues = {
    deflections: 10,
    chargesDrawn: 3,
    screenAssists: 10,
    looseBalls: 8,
    boxOuts: 12,
    contestedShots: 10
  }

  const chartData = [
    {
      metric: 'Deflections',
      value: Math.min((player.stats.deflections / maxValues.deflections) * 100, 100),
      actual: player.stats.deflections
    },
    {
      metric: 'Charges',
      value: Math.min((player.stats.chargesDrawn / maxValues.chargesDrawn) * 100, 100),
      actual: player.stats.chargesDrawn
    },
    {
      metric: 'Screen Assists',
      value: Math.min((player.stats.screenAssists / maxValues.screenAssists) * 100, 100),
      actual: player.stats.screenAssists
    },
    {
      metric: 'Loose Balls',
      value: Math.min((player.stats.looseBalls / maxValues.looseBalls) * 100, 100),
      actual: player.stats.looseBalls
    },
    {
      metric: 'Box Outs',
      value: Math.min((player.stats.boxOuts / maxValues.boxOuts) * 100, 100),
      actual: player.stats.boxOuts
    },
    {
      metric: 'Contests',
      value: Math.min((player.stats.contestedShots / maxValues.contestedShots) * 100, 100),
      actual: player.stats.contestedShots
    },
  ]

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%',
      bgcolor: '#000',
      p: 0.25,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="rgba(255, 199, 44, 0.2)" />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: '#FFC72C', fontSize: 13, fontWeight: 600 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}
          />
          
          <Radar
            name={player.name}
            dataKey="value"
            stroke={player.color}
            fill={player.color}
            fillOpacity={0.4}
            strokeWidth={3}
          />
        </RadarChart>
      </ResponsiveContainer>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 1, 
        mt: 2,
        bgcolor: 'rgba(255, 199, 44, 0.05)',
        borderRadius: '8px',
        p: 1.5
      }}>
        {chartData.map((item, idx) => (
          <Box key={idx} sx={{ textAlign: 'center' }}>
            <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              {item.metric}
            </Typography>
            <Typography level="title-sm" sx={{ color: '#FFC72C', fontWeight: 700 }}>
              {item.actual}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

