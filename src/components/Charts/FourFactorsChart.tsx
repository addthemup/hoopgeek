import { Box, Typography } from '@mui/joy'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList, Legend } from 'recharts'

interface TeamFactors {
  teamName: string
  teamColor: string
  efg: number
  ftaRate: number
  tovRate: number
  orbRate: number
}

interface FourFactorsChartProps {
  homeTeam: TeamFactors
  awayTeam: TeamFactors
  title?: string
}

export default function FourFactorsChart({ homeTeam, awayTeam, title }: FourFactorsChartProps) {
  const chartData = [
    {
      factor: 'eFG%',
      [homeTeam.teamName]: homeTeam.efg * 100,
      [awayTeam.teamName]: awayTeam.efg * 100,
    },
    {
      factor: 'FT Rate',
      [homeTeam.teamName]: homeTeam.ftaRate * 100,
      [awayTeam.teamName]: awayTeam.ftaRate * 100,
    },
    {
      factor: 'TOV%',
      [homeTeam.teamName]: homeTeam.tovRate * 100,
      [awayTeam.teamName]: awayTeam.tovRate * 100,
      inverse: true // Lower is better
    },
    {
      factor: 'ORB%',
      [homeTeam.teamName]: homeTeam.orbRate * 100,
      [awayTeam.teamName]: awayTeam.orbRate * 100,
    },
  ]

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
        <BarChart 
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 40, bottom: 10, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 199, 44, 0.1)" />
          <XAxis 
            type="number" 
            stroke="#FFC72C"
            tick={{ fill: '#FFC72C', fontSize: 12 }}
            domain={[0, 'dataMax + 10']}
          />
          <YAxis 
            type="category" 
            dataKey="factor" 
            stroke="#FFC72C"
            tick={{ fill: '#FFC72C', fontSize: 14, fontWeight: 600 }}
            width={90}
          />
          
          <Legend 
            wrapperStyle={{ 
              paddingTop: '20px',
              fontSize: '14px',
              fontWeight: 600
            }}
            iconType="square"
          />
          
          <Bar dataKey={awayTeam.teamName} fill={awayTeam.teamColor} radius={[0, 4, 4, 0]}>
            <LabelList 
              dataKey={awayTeam.teamName}
              position="right" 
              style={{ fill: '#FFF', fontSize: 14, fontWeight: 700 }}
              formatter={(value: number) => value.toFixed(1)}
            />
          </Bar>
          
          <Bar dataKey={homeTeam.teamName} fill={homeTeam.teamColor} radius={[0, 4, 4, 0]}>
            <LabelList 
              dataKey={homeTeam.teamName}
              position="right" 
              style={{ fill: '#FFF', fontSize: 14, fontWeight: 700 }}
              formatter={(value: number) => value.toFixed(1)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: 4, 
        mt: 2,
        flexWrap: 'wrap'
      }}>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          eFG% = Effective Field Goal %
        </Typography>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          FT Rate = Free Throw Attempt Rate
        </Typography>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          TOV% = Turnover % (Lower is Better)
        </Typography>
        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          ORB% = Offensive Rebound %
        </Typography>
      </Box>
    </Box>
  )
}

