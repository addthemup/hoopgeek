import { Box, Typography } from '@mui/joy'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface DefensiveEvent {
  category: string
  steals: number
  blocks: number
  deflections: number
  chargesDrawn: number
  minutes: number
}

interface DefensiveEventsMapProps {
  player: {
    name: string
    teamTricode: string
    teamColor: string
    events: DefensiveEvent[]
  }
}

export default function DefensiveEventsMap({ player }: DefensiveEventsMapProps) {
  if (!player || !player.events || player.events.length === 0) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>No defensive data available</Typography>
      </Box>
    )
  }

  const chartData = player.events.map(event => ({
    category: event.category,
    steals: event.steals,
    blocks: event.blocks,
    deflections: event.deflections,
    chargesDrawn: event.chargesDrawn,
    total: event.steals + event.blocks + event.deflections + event.chargesDrawn,
    per36: event.minutes > 0 ? ((event.steals + event.blocks + event.deflections + event.chargesDrawn) / event.minutes * 36).toFixed(1) : 0
  }))

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
            {player.name} - {data.category}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#00FF00' }}>STL: {data.steals}</Typography>
          <Typography level="body-xs" sx={{ color: '#0088FE' }}>BLK: {data.blocks}</Typography>
          <Typography level="body-xs" sx={{ color: '#FFC72C' }}>DEFL: {data.deflections}</Typography>
          <Typography level="body-xs" sx={{ color: '#FF8888' }}>CHRG: {data.chargesDrawn}</Typography>
          <Typography level="body-xs" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Per 36: {data.per36}
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
          Defensive Events Map
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          {player.name} ({player.teamTricode}) • Defensive Activity
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minHeight: 300, width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData}
            margin={{ top: 10, right: 8, left: 8, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              dataKey="category" 
              stroke="#888"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fill: '#888', fontSize: 10 }}
            />
            <YAxis 
              stroke="#888"
              tick={{ fill: '#888' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 199, 44, 0.1)' }} />
            <Bar dataKey="steals" stackId="a" fill="#00FF00" />
            <Bar dataKey="blocks" stackId="a" fill="#0088FE" />
            <Bar dataKey="deflections" stackId="a" fill="#FFC72C" />
            <Bar dataKey="chargesDrawn" stackId="a" fill="#FF8888" />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
          Green=Steals, Blue=Blocks, Gold=Deflections, Red=Charges Drawn
        </Typography>
      </Box>
    </Box>
  )
}

