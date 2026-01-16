import { Box, Typography } from '@mui/joy'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

interface TeamTurnover {
  teamName: string
  teamTricode: string
  teamColor: string
  turnovers: number
  pointsOffTurnovers: number
}

interface TurnoverAnalysisChartProps {
  teams: TeamTurnover[]
  duration?: number
}

export default function TurnoverAnalysisChart({ teams, duration = 5000 }: TurnoverAnalysisChartProps) {
  const chartData = teams.map(team => ({
    name: team.teamTricode,
    turnovers: team.turnovers,
    pointsOff: team.pointsOffTurnovers,
    teamColor: team.teamColor,
    fullName: team.teamName
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
          <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            {data.fullName}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#FF4444' }}>
            Turnovers: {data.turnovers}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#00FF00' }}>
            Points Off TO: {data.pointsOff}
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
          Turnover Analysis
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Team Turnovers vs Points Generated
        </Typography>
      </Box>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={chartData}
          margin={{ top: 10, right: 8, left: 8, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="name" 
            stroke="#888"
            tick={{ fill: '#888' }}
          />
          <YAxis stroke="#888" tick={{ fill: '#888' }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 199, 44, 0.1)' }} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="square"
          />
          <Bar 
            dataKey="turnovers" 
            name="Turnovers" 
            fill="#FF4444"
            radius={[8, 8, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-turnovers-${index}`} fill="#FF4444" />
            ))}
          </Bar>
          <Bar 
            dataKey="pointsOff" 
            name="Points Off TO" 
            fill="#00FF00"
            radius={[8, 8, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-points-${index}`} fill="#00FF00" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
          Red = Turnovers committed, Green = Points scored off opponent turnovers
        </Typography>
      </Box>
    </Box>
  )
}


