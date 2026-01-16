import { Box, Typography } from '@mui/joy'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Label, ReferenceLine } from 'recharts'

interface PlayerUsage {
  name: string
  teamTricode: string
  teamColor: string
  usageRate: number
  trueShootingPct: number
  points: number
}

interface UsageEfficiencyScatterProps {
  players: PlayerUsage[]
  duration?: number
}

export default function UsageEfficiencyScatter({ players, duration = 5000 }: UsageEfficiencyScatterProps) {
  // Filter players with meaningful data
  const validPlayers = players.filter(p => p.usageRate > 10 && p.trueShootingPct > 0)
  
  // Calculate domain with padding
  const usageValues = validPlayers.map(p => p.usageRate)
  const tsValues = validPlayers.map(p => p.trueShootingPct)
  
  const usageMin = Math.floor(Math.min(...usageValues) - 2)
  const usageMax = Math.ceil(Math.max(...usageValues) + 2)
  const tsMin = Math.floor(Math.min(...tsValues) - 5)
  const tsMax = Math.ceil(Math.max(...tsValues) + 5)

  // Calculate averages for reference lines
  const avgUsage = usageValues.reduce((a, b) => a + b, 0) / usageValues.length
  const avgTS = tsValues.reduce((a, b) => a + b, 0) / tsValues.length

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
          <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5, color: data.teamColor }}>
            {data.name}
          </Typography>
          <Typography level="body-xs">
            Team: {data.teamTricode}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#FFC72C' }}>
            Usage: {data.usageRate.toFixed(1)}%
          </Typography>
          <Typography level="body-xs" sx={{ color: '#00FF00' }}>
            TS%: {data.trueShootingPct.toFixed(1)}%
          </Typography>
          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
            Points: {data.points}
          </Typography>
        </Box>
      )
    }
    return null
  }

  const CustomLabel = (props: any) => {
    const { x, y, payload } = props
    if (!payload) return null

    // Show first initial + last name for mobile
    const nameParts = payload.name.split(' ')
    const displayName = nameParts.length > 1 
      ? `${nameParts[0][0]}. ${nameParts[nameParts.length - 1]}`
      : payload.name

    return (
      <text
        x={x}
        y={y - 8}
        textAnchor="middle"
        fill={payload.teamColor}
        fontSize={10}
        fontWeight="bold"
        style={{
          textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.8)'
        }}
      >
        {displayName}
      </text>
    )
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
          Usage vs Efficiency
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Usage Rate vs True Shooting %
        </Typography>
      </Box>

      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 8, bottom: 36, left: 36 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            type="number" 
            dataKey="usageRate"
            domain={[usageMin, usageMax]}
            stroke="#888"
            tick={{ fill: '#888', fontSize: 11 }}
          >
            <Label 
              value="Usage Rate (%)" 
              position="bottom" 
              style={{ fill: '#FFC72C', fontWeight: 'bold', fontSize: 12 }}
              offset={10}
            />
          </XAxis>
          <YAxis 
            type="number" 
            dataKey="trueShootingPct"
            domain={[tsMin, tsMax]}
            stroke="#888"
            tick={{ fill: '#888', fontSize: 11 }}
          >
            <Label 
              value="True Shooting % (TS%)" 
              angle={-90} 
              position="left"
              style={{ fill: '#FFC72C', fontWeight: 'bold', fontSize: 12, textAnchor: 'middle' }}
              offset={20}
            />
          </YAxis>
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          
          {/* Reference lines for averages */}
          <ReferenceLine 
            x={avgUsage} 
            stroke="#FFC72C" 
            strokeDasharray="5 5" 
            strokeOpacity={0.5}
            label={{ value: 'Avg', fill: '#FFC72C', fontSize: 10 }}
          />
          <ReferenceLine 
            y={avgTS} 
            stroke="#FFC72C" 
            strokeDasharray="5 5" 
            strokeOpacity={0.5}
            label={{ value: 'Avg', fill: '#FFC72C', fontSize: 10 }}
          />
          
          <Scatter 
            data={validPlayers} 
            fill="#8884d8"
            label={<CustomLabel />}
          >
            {validPlayers.map((player, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={player.teamColor}
                r={6}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <Box sx={{ mt: 2 }}>
        <Typography level="body-xs" sx={{ color: 'text.tertiary', textAlign: 'center' }}>
          Top-right quadrant = High usage, high efficiency (elite)
        </Typography>
        <Typography level="body-xs" sx={{ color: 'text.tertiary', textAlign: 'center' }}>
          Bottom-right = High usage, low efficiency (volume scorer)
        </Typography>
      </Box>
    </Box>
  )
}


