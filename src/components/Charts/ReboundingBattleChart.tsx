import { Box, Typography } from '@mui/joy'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface PlayerRebounding {
  name: string
  teamTricode: string
  teamColor: string
  offensiveRebounds: number
  defensiveRebounds: number
  totalRebounds: number
}

interface ReboundingBattleChartProps {
  players: PlayerRebounding[]
  duration?: number
}

export default function ReboundingBattleChart({ players, duration = 5000 }: ReboundingBattleChartProps) {
  // Sort by total rebounds
  const sortedPlayers = [...players].sort((a, b) => b.totalRebounds - a.totalRebounds).slice(0, 10)

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
            {data.name} ({data.teamTricode})
          </Typography>
          <Typography level="body-xs" sx={{ color: '#FFC72C' }}>
            OFF: {data.offensiveRebounds}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#FFFFFF' }}>
            DEF: {data.defensiveRebounds}
          </Typography>
          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
            Total: {data.totalRebounds}
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
      p: 0.25 // minimize outer padding
    }}>
      <Box sx={{ mb: 2 }}>
        <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
          Rebounding Battle
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Offensive vs Defensive Rebounds
        </Typography>
      </Box>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={sortedPlayers}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 90, bottom: 5 }} // reduce horizontal margins, keep left for names
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis type="number" stroke="#888" />
          <YAxis 
            dataKey="name" 
            type="category" 
            stroke="#888"
            tick={{ fill: '#888', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 199, 44, 0.1)' }} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="square"
          />
          <Bar 
            dataKey="offensiveRebounds" 
            name="Offensive" 
            stackId="a"
            fill="#FFC72C"
            radius={[0, 4, 4, 0]}
          />
          <Bar 
            dataKey="defensiveRebounds" 
            name="Defensive" 
            stackId="a"
            fill="#FFFFFF"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
          Top 10 rebounders • Gold = Offensive, White = Defensive
        </Typography>
      </Box>
    </Box>
  )
}


