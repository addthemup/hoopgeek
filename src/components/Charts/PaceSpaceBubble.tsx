import { Box, Typography } from '@mui/joy'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

interface PlayerMovement {
  name: string
  teamTricode: string
  speed: number
  distance: number
  minutes: number
  color: string
}

interface PaceSpaceBubbleProps {
  players: PlayerMovement[]
  title?: string
}

export default function PaceSpaceBubble({ players, title }: PaceSpaceBubbleProps) {
  // Auto-zoom: Calculate tight bounds based on actual data
  const speeds = players.map(p => p.speed)
  const distances = players.map(p => p.distance)
  
  const minSpeed = Math.min(...speeds)
  const maxSpeed = Math.max(...speeds)
  const minDistance = Math.min(...distances)
  const maxDistance = Math.max(...distances)
  
  // Add padding (10% of range)
  const speedPadding = (maxSpeed - minSpeed) * 0.1
  const distancePadding = (maxDistance - minDistance) * 0.1
  
  const speedDomain = [
    Math.floor((minSpeed - speedPadding) * 10) / 10,
    Math.ceil((maxSpeed + speedPadding) * 10) / 10
  ]
  const distanceDomain = [
    Math.floor((minDistance - distancePadding) * 10) / 10,
    Math.ceil((maxDistance + distancePadding) * 10) / 10
  ]

  // Custom label component for each point
  const CustomLabel = (props: any) => {
    const { x, y, value, index } = props
    const player = players[index]
    if (!player) return null
    
    // Split name into first initial and last name for mobile
    const nameParts = player.name.split(' ')
    const displayName = nameParts.length > 1 
      ? `${nameParts[0][0]}. ${nameParts[nameParts.length - 1]}`
      : player.name
    
    return (
      <g>
        <text
          x={x}
          y={y - 12}
          fill={player.color}
          fontSize={11}
          fontWeight={700}
          textAnchor="middle"
          style={{
            textShadow: '0 0 3px #000, 0 0 3px #000, 0 0 3px #000',
            paintOrder: 'stroke fill'
          }}
        >
          {displayName}
        </text>
      </g>
    )
  }
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <Box sx={{ 
          bgcolor: 'rgba(0, 0, 0, 0.9)', 
          border: '1px solid #FFC72C',
          borderRadius: '4px',
          p: 1
        }}>
          <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 700 }}>
            {data.name}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#fff' }}>
            {data.teamTricode}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#4ade80' }}>
            Speed: {data.speed.toFixed(2)} mph
          </Typography>
          <Typography level="body-xs" sx={{ color: '#3b82f6' }}>
            Distance: {data.distance.toFixed(2)} mi
          </Typography>
          <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {data.minutes} minutes
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
      bgcolor: '#000',
      p: 0.25,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <ResponsiveContainer width="100%" height={450}>
        <ScatterChart margin={{ top: 30, right: 20, bottom: 50, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 199, 44, 0.1)" />
          
          <XAxis 
            type="number" 
            dataKey="speed" 
            name="Speed"
            stroke="#FFC72C"
            domain={speedDomain}
            label={{ 
              value: 'Speed (mph) →', 
              position: 'bottom',
              offset: -5,
              style: { fill: '#4ade80', fontSize: 11, fontWeight: 600 }
            }}
            tick={{ fill: '#FFC72C', fontSize: 10 }}
          />
          
          <YAxis 
            type="number" 
            dataKey="distance" 
            name="Distance"
            stroke="#FFC72C"
            domain={distanceDomain}
            label={{ 
              value: 'Distance (miles) ↑', 
              angle: -90, 
              position: 'left',
              style: { fill: '#3b82f6', fontSize: 11, fontWeight: 600 }
            }}
            tick={{ fill: '#FFC72C', fontSize: 10 }}
          />
          
          <ZAxis type="number" dataKey="minutes" range={[200, 500]} />
          
          <Tooltip content={<CustomTooltip />} />
          
          <Scatter data={players} fill="#8884d8">
            {players.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList content={<CustomLabel />} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5, 
        mt: 2,
        px: 2
      }}>
        <Typography level="body-xs" sx={{ color: '#4ade80', fontWeight: 600 }}>
          ⚡ Top Right = High Motor Players
        </Typography>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
          Bubble Size = Minutes • Colors = Team Colors
        </Typography>
      </Box>
    </Box>
  )
}

