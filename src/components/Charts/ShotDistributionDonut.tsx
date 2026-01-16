import { Box, Typography } from '@mui/joy'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts'

interface ShotDistribution {
  paint: number
  midrange: number
  threePoint: number
  freeThrow: number
}

interface PlayerShots {
  name: string
  teamTricode: string
  totalPoints: number
  distribution: ShotDistribution
}

interface ShotDistributionDonutProps {
  player: PlayerShots
  title?: string
}

export default function ShotDistributionDonut({ player, title }: ShotDistributionDonutProps) {
  const COLORS = {
    paint: '#ef4444',      // Red
    midrange: '#f59e0b',   // Orange
    threePoint: '#3b82f6', // Blue
    freeThrow: '#8b5cf6'   // Purple
  }

  const chartData = [
    { 
      name: 'Paint', 
      value: player.distribution.paint,
      percentage: (player.distribution.paint * 100).toFixed(1)
    },
    { 
      name: 'Midrange', 
      value: player.distribution.midrange,
      percentage: (player.distribution.midrange * 100).toFixed(1)
    },
    { 
      name: '3-Pointers', 
      value: player.distribution.threePoint,
      percentage: (player.distribution.threePoint * 100).toFixed(1)
    },
    { 
      name: 'Free Throws', 
      value: player.distribution.freeThrow,
      percentage: (player.distribution.freeThrow * 100).toFixed(1)
    },
  ].filter(item => item.value > 0)

  const CHART_COLORS = [COLORS.paint, COLORS.midrange, COLORS.threePoint, COLORS.freeThrow]

  const renderCustomLabel = (entry: any) => {
    return `${entry.percentage}%`
  }

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
      <ResponsiveContainer width="100%" height={350}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={120}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
            paddingAngle={2}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={CHART_COLORS[index]}
                stroke="#000"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Legend 
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => (
              <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
                {value}: {entry.payload.percentage}%
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: 2, 
        mt: 2,
        bgcolor: 'rgba(255, 199, 44, 0.05)',
        borderRadius: '8px',
        p: 2
      }}>
        {chartData.map((item, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              bgcolor: CHART_COLORS[idx],
              borderRadius: '2px'
            }} />
            <Box>
              <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                {item.name}
              </Typography>
              <Typography level="title-sm" sx={{ color: '#FFC72C', fontWeight: 700 }}>
                {item.percentage}%
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Typography 
        level="body-xs" 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.5)', 
          textAlign: 'center',
          mt: 2
        }}
      >
        Where The Points Came From
      </Typography>
    </Box>
  )
}

