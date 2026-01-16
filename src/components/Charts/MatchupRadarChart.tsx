import { Box, Typography } from '@mui/joy'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts'

interface MatchupPlayer {
  name: string
  teamTricode: string
  color: string
  stats: {
    points: number
    fgPercentage: number
    assists: number
    turnovers: number
    blocks: number
    minutesPlayed: number
  }
}

interface MatchupRadarChartProps {
  playerA: MatchupPlayer
  playerB: MatchupPlayer
  matchupMinutes: string
}

export default function MatchupRadarChart({ playerA, playerB, matchupMinutes }: MatchupRadarChartProps) {
  // Normalize stats to 0-100 scale for radar chart
  const normalizeStats = (playerA: MatchupPlayer, playerB: MatchupPlayer) => {
    const maxPoints = Math.max(playerA.stats.points, playerB.stats.points) || 1
    const maxAssists = Math.max(playerA.stats.assists, playerB.stats.assists) || 1
    const maxBlocks = Math.max(playerA.stats.blocks, playerB.stats.blocks) || 1
    const maxMinutes = Math.max(playerA.stats.minutesPlayed, playerB.stats.minutesPlayed) || 1
    
    // Ball security is inverse of turnovers (fewer turnovers = better)
    const maxTurnovers = Math.max(playerA.stats.turnovers, playerB.stats.turnovers) || 1
    
    return [
      {
        metric: 'Scoring',
        [playerA.name]: (playerA.stats.points / maxPoints) * 100,
        [playerB.name]: (playerB.stats.points / maxPoints) * 100,
      },
      {
        metric: 'Efficiency',
        [playerA.name]: playerA.stats.fgPercentage,
        [playerB.name]: playerB.stats.fgPercentage,
      },
      {
        metric: 'Playmaking',
        [playerA.name]: (playerA.stats.assists / maxAssists) * 100,
        [playerB.name]: (playerB.stats.assists / maxAssists) * 100,
      },
      {
        metric: 'Ball Security',
        [playerA.name]: maxTurnovers === 0 ? 100 : ((maxTurnovers - playerA.stats.turnovers) / maxTurnovers) * 100,
        [playerB.name]: maxTurnovers === 0 ? 100 : ((maxTurnovers - playerB.stats.turnovers) / maxTurnovers) * 100,
      },
      {
        metric: 'Defense',
        [playerA.name]: (playerA.stats.blocks / maxBlocks) * 100,
        [playerB.name]: (playerB.stats.blocks / maxBlocks) * 100,
      },
      {
        metric: 'Impact Time',
        [playerA.name]: (playerA.stats.minutesPlayed / maxMinutes) * 100,
        [playerB.name]: (playerB.stats.minutesPlayed / maxMinutes) * 100,
      },
    ]
  }

  const chartData = normalizeStats(playerA, playerB)

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
      {/* Radar Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={chartData}>
          <PolarGrid stroke="rgba(255, 199, 44, 0.2)" />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: '#FFC72C', fontSize: 14, fontWeight: 600 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
          />
          
          {/* Player A Radar */}
          <Radar
            name={playerA.name}
            dataKey={playerA.name}
            stroke={playerA.color}
            fill={playerA.color}
            fillOpacity={0.3}
            strokeWidth={3}
          />
          
          {/* Player B Radar */}
          <Radar
            name={playerB.name}
            dataKey={playerB.name}
            stroke={playerB.color}
            fill={playerB.color}
            fillOpacity={0.3}
            strokeWidth={3}
          />
          
          <Legend 
            wrapperStyle={{ 
              paddingTop: '20px',
              fontSize: '14px',
              fontWeight: 600
            }}
            iconType="circle"
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Matchup Duration */}
      <Typography 
        level="body-sm" 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.7)', 
          textAlign: 'center', 
          mt: 1
        }}
      >
        Matchup Duration: {matchupMinutes}
      </Typography>
    </Box>
  )
}

