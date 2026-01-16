import { Box, Typography } from '@mui/joy'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Dot } from 'recharts'

interface PlayerPlaymaking {
  name: string
  teamTricode: string
  teamColor: string
  assists: number
  turnovers: number
  astToRatio: number
}

interface PlaymakingEfficiencyChartProps {
  players: PlayerPlaymaking[]
  duration?: number
}

export default function PlaymakingEfficiencyChart({ players, duration = 5000 }: PlaymakingEfficiencyChartProps) {
  // Sort by assists and take top 8
  const topPlayers = [...players]
    .filter(p => p.assists > 2)
    .sort((a, b) => b.assists - a.assists)
    .slice(0, 8)

  // Create data points for line chart
  const chartData = topPlayers.map((player, index) => ({
    index: index + 1,
    name: player.name,
    assists: player.assists,
    turnovers: player.turnovers,
    ratio: player.astToRatio,
    teamColor: player.teamColor
  }))

  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props
    if (!payload) return null
    
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={dataKey === 'assists' ? payload.teamColor : '#FF4444'}
        stroke="#000"
        strokeWidth={1}
      />
    )
  }

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
          <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            {data.name}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#00FF00' }}>
            Assists: {data.assists}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#FF4444' }}>
            Turnovers: {data.turnovers}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#FFC72C' }}>
            AST/TO: {data.ratio.toFixed(2)}
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
          Playmaking Efficiency
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Assists vs Turnovers
        </Typography>
      </Box>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={chartData}
          margin={{ top: 5, right: 10, left: 10, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="name" 
            stroke="#888"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: '#888', fontSize: 10 }}
          />
          <YAxis stroke="#888" tick={{ fill: '#888' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="line"
          />
          <Line 
            type="monotone" 
            dataKey="assists" 
            name="Assists"
            stroke="#00FF00" 
            strokeWidth={3}
            dot={<CustomDot />}
          />
          <Line 
            type="monotone" 
            dataKey="turnovers" 
            name="Turnovers"
            stroke="#FF4444" 
            strokeWidth={3}
            dot={<CustomDot />}
          />
        </LineChart>
      </ResponsiveContainer>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
          Green = Assists, Red = Turnovers
        </Typography>
      </Box>
    </Box>
  )
}


