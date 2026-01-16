import { Box, Typography } from '@mui/joy'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from 'recharts'

interface TeamAdvantage {
  category: string
  homeValue: number
  awayValue: number
  advantage: 'home' | 'away'
  homeName: string
  awayName: string
  homeColor: string
  awayColor: string
}

interface StoryComparisonChartProps {
  advantage: {
    category: string
    home_value: number
    away_value: number
    winner: 'home' | 'away'
  }
  homeTeam: {
    name: string
    color: string
    city: string
  }
  awayTeam: {
    name: string
    color: string
    city: string
  }
}

export default function StoryComparisonChart({ advantage, homeTeam, awayTeam }: StoryComparisonChartProps) {
  // Transform data for horizontal bar chart
  const chartData = [
    {
      name: awayTeam.name,
      value: advantage.away_value,
      color: awayTeam.color || '#FF6B6B'
    },
    {
      name: homeTeam.name,
      value: advantage.home_value,
      color: homeTeam.color || '#4ECDC4'
    }
  ]

  const maxValue = Math.max(advantage.home_value, advantage.away_value)
  const domain = [0, Math.ceil(maxValue * 1.1)]

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
      <ResponsiveContainer width="100%" height={200}>
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 10, right: 20, bottom: 10, left: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 199, 44, 0.1)" />
          <XAxis 
            type="number" 
            domain={domain}
            stroke="#FFC72C"
            tick={{ fill: '#FFC72C', fontSize: 14 }}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#FFC72C"
            tick={{ fill: '#FFF', fontSize: 16, fontWeight: 600 }}
            width={100}
          />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList 
              dataKey="value" 
              position="right" 
              style={{ fill: '#FFF', fontSize: 18, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Typography 
        level="body-md" 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          textAlign: 'center', 
          mt: 2,
          fontSize: '0.9rem'
        }}
      >
        {advantage.winner === 'home' ? homeTeam.city : awayTeam.city} {advantage.winner === 'home' ? homeTeam.name : awayTeam.name} Advantage
      </Typography>
    </Box>
  )
}

