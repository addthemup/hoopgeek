import { Box, Typography } from '@mui/joy'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ShotZone {
  zone: string
  efg: number
  attempts: number
  made: number
}

interface ShotProfileEfficiencyChartProps {
  player: {
    name: string
    teamTricode: string
    teamColor: string
    zones: ShotZone[]
  }
}

export default function ShotProfileEfficiencyChart({ player }: ShotProfileEfficiencyChartProps) {
  if (!player || !player.zones || player.zones.length === 0) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>No shot data available</Typography>
      </Box>
    )
  }

  const chartData = player.zones.map(zone => ({
    zone: zone.zone,
    efg: Number((zone.efg * 100).toFixed(1)), // Convert to number for chart
    attempts: zone.attempts,
    made: zone.made,
    teamColor: player.teamColor
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
            {player.name} - {data.zone}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#FFC72C' }}>
            eFG%: {data.efg}%
          </Typography>
          <Typography level="body-xs" sx={{ color: '#FFFFFF' }}>
            {data.made}/{data.attempts} FGM/FGA
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
          Shot Profile Efficiency
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          {player.name} ({player.teamTricode}) • eFG% by Zone
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
              dataKey="zone" 
              stroke="#888"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fill: '#888', fontSize: 10 }}
            />
            <YAxis 
              stroke="#888"
              tick={{ fill: '#888' }}
              label={{ value: 'eFG%', angle: -90, position: 'insideLeft', style: { fill: '#FFC72C', fontWeight: 'bold' } }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 199, 44, 0.1)' }} />
            <Bar dataKey="efg" fill={player.teamColor} radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={player.teamColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
          Effective Field Goal % by shooting zone
        </Typography>
      </Box>
    </Box>
  )
}

