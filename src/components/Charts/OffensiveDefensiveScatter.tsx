import { Box, Typography } from '@mui/joy'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Label, LabelList } from 'recharts'

interface PlayerRating {
  name: string
  teamTricode: string
  offensiveRating: number
  defensiveRating: number
  minutes: number
  color: string
}

interface OffensiveDefensiveScatterProps {
  players: PlayerRating[]
  title?: string
}

export default function OffensiveDefensiveScatter({ players, title }: OffensiveDefensiveScatterProps) {
  // Calculate median for quadrant lines
  const avgOffensive = players.reduce((sum, p) => sum + p.offensiveRating, 0) / players.length
  const avgDefensive = players.reduce((sum, p) => sum + p.defensiveRating, 0) / players.length

  // Auto-zoom: Calculate tight bounds based on actual data
  const offensiveRatings = players.map(p => p.offensiveRating)
  const defensiveRatings = players.map(p => p.defensiveRating)
  
  const minOffensive = Math.min(...offensiveRatings)
  const maxOffensive = Math.max(...offensiveRatings)
  const minDefensive = Math.min(...defensiveRatings)
  const maxDefensive = Math.max(...defensiveRatings)
  
  // Add small padding (5% of range)
  const offensivePadding = (maxOffensive - minOffensive) * 0.1
  const defensivePadding = (maxDefensive - minDefensive) * 0.1
  
  const offensiveDomain = [
    Math.floor(minOffensive - offensivePadding),
    Math.ceil(maxOffensive + offensivePadding)
  ]
  const defensiveDomain = [
    Math.floor(minDefensive - defensivePadding),
    Math.ceil(maxDefensive + defensivePadding)
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
            {data.teamTricode} • {data.minutes} min
          </Typography>
          <Typography level="body-xs" sx={{ color: '#4ade80' }}>
            OFF: {data.offensiveRating.toFixed(1)}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#ef4444' }}>
            DEF: {data.defensiveRating.toFixed(1)}
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
        <ScatterChart margin={{ top: 15, right: 10, bottom: 30, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 199, 44, 0.1)" />
          
          <XAxis 
            type="number" 
            dataKey="offensiveRating" 
            name="Offensive Rating"
            stroke="#FFC72C"
            domain={offensiveDomain}
            label={{ 
              value: 'Offensive Rating →', 
              position: 'bottom',
              offset: -5,
              style: { fill: '#4ade80', fontSize: 11, fontWeight: 600 }
            }}
            tick={{ fill: '#FFC72C', fontSize: 10 }}
          />
          
          <YAxis 
            type="number" 
            dataKey="defensiveRating" 
            name="Defensive Rating"
            stroke="#FFC72C"
            reversed
            domain={defensiveDomain}
            label={{ 
              value: '← Better Defense', 
              angle: -90, 
              position: 'left',
              style: { fill: '#ef4444', fontSize: 11, fontWeight: 600 }
            }}
            tick={{ fill: '#FFC72C', fontSize: 10 }}
          />
          
          <ZAxis type="number" dataKey="minutes" range={[200, 500]} />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Quadrant lines */}
          <ReferenceLine 
            x={avgOffensive} 
            stroke="rgba(255, 199, 44, 0.3)" 
            strokeDasharray="5 5" 
            strokeWidth={1}
          />
          <ReferenceLine 
            y={avgDefensive} 
            stroke="rgba(255, 199, 44, 0.3)" 
            strokeDasharray="5 5"
            strokeWidth={1}
          />
          
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
          📈 Higher Offensive Rating = Better Offense
        </Typography>
        <Typography level="body-xs" sx={{ color: '#ef4444', fontWeight: 600 }}>
          📉 Lower Defensive Rating = Better Defense
        </Typography>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
          Bubble Size = Minutes • Colors = Team Colors
        </Typography>
      </Box>
    </Box>
  )
}

