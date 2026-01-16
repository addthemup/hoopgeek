import { Box, Typography } from '@mui/joy'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

interface CreationStat {
  touches: number
  potentialAssists: number
  paintTouches: number
  secondaryAssists: number
  assists: number
}

interface OnBallCreationChartProps {
  player: {
    name: string
    teamTricode: string
    teamColor: string
    stats: CreationStat
  }
}

export default function OnBallCreationChart({ player }: OnBallCreationChartProps) {
  if (!player || !player.stats) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>No creation data available</Typography>
      </Box>
    )
  }

  const { stats } = player
  const assistRate = stats.touches > 0 ? (stats.assists / stats.touches * 100).toFixed(1) : 0
  const paintTouchRate = stats.touches > 0 ? (stats.paintTouches / stats.touches * 100).toFixed(1) : 0
  
  const chartData = [
    {
      x: stats.touches,
      y: stats.assists,
      label: 'Actual Assists',
      color: player.teamColor
    },
    {
      x: stats.touches,
      y: stats.potentialAssists,
      label: 'Potential Assists',
      color: '#FFC72C'
    }
  ]

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <Box sx={{ 
          bgcolor: 'background.surface', 
          p: 1.5, 
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 'sm'
        }}>
          <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5, color: player.teamColor }}>
            {player.name}
          </Typography>
          <Typography level="body-xs">{data.label}</Typography>
          <Typography level="body-xs" sx={{ color: '#FFC72C' }}>
            Touches: {stats.touches}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#00FF00' }}>
            Assists/Potential: {data.y}
          </Typography>
        </Box>
      )
    }
    return null
  }

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
          On-Ball Creation
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          {player.name} ({player.teamTricode}) • Creation Metrics
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 300, width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 8, bottom: 40, left: 36 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              type="number" 
              dataKey="x"
              domain={[0, Math.max(stats.touches * 1.2, 10)]}
              stroke="#888"
              tick={{ fill: '#888' }}
              label={{ value: 'Touches', position: 'bottom', style: { fill: '#FFC72C', fontWeight: 'bold' } }}
            />
            <YAxis 
              type="number" 
              dataKey="y"
              domain={[0, Math.max(stats.potentialAssists * 1.2, 5)]}
              stroke="#888"
              tick={{ fill: '#888' }}
              label={{ value: 'Assists', angle: -90, position: 'insideLeft', style: { fill: '#FFC72C', fontWeight: 'bold' } }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={chartData} fill="#8884d8">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} r={8} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Box>

      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.level2', borderRadius: 'sm' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Assist Rate</Typography>
            <Typography level="body-sm" sx={{ color: '#00FF00', fontWeight: 'bold' }}>{assistRate}%</Typography>
          </Box>
          <Box>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Paint Touches</Typography>
            <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>{stats.paintTouches}</Typography>
          </Box>
          <Box>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Secondary AST</Typography>
            <Typography level="body-sm" sx={{ color: '#0088FE', fontWeight: 'bold' }}>{stats.secondaryAssists}</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

