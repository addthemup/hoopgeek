import { Box, Typography } from '@mui/joy'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors'

interface FantasyPlayer {
  name: string
  teamTricode: string
  teamColor: string
  fantasyPoints: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  personId?: number // Optional: nba_player_id for highlighting
}

interface TopFantasyScorersChartProps {
  players: FantasyPlayer[]
  highlightedPlayerId?: number // Optional: personId of the highlighted player
}

// Helper function to convert hex color to rgba with opacity
const hexToRgba = (hex: string, opacity: number): string => {
  // Remove # if present
  const cleanHex = hex.replace('#', '')
  
  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export default function TopFantasyScorersChart({ players, highlightedPlayerId }: TopFantasyScorersChartProps) {
  if (!players || players.length === 0) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>No player data available</Typography>
      </Box>
    )
  }

  const top5 = [...players]
    .filter(p => p.fantasyPoints > 0)
    .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
    .slice(0, 5)

  if (top5.length === 0) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>No fantasy points calculated</Typography>
      </Box>
    )
  }

  // Get unique teams and their colors - use passed teamColor which already has contrast adjustment
  const teams = [...new Set(top5.map(p => p.teamTricode))]
  const teamColorMap = top5.reduce((acc, player) => {
    if (!acc[player.teamTricode]) {
      acc[player.teamTricode] = player.teamColor // Use the already contrast-adjusted color
    }
    return acc
  }, {} as Record<string, string>)

  // Custom Y-axis tick with team colors
  const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props
    const player = top5.find(p => p.name === payload.value)
    const teamColor = player ? player.teamColor : '#888'
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={4}
          textAnchor="end"
          fill={teamColor}
          fontSize={12}
          fontWeight="bold"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
        >
          {payload.value}
        </text>
        {player && (
          <text
            x={-75}
            y={0}
            dy={4}
            textAnchor="end"
            fill={teamColor}
            fontSize={10}
            fontWeight="600"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
          >
            {player.teamTricode}
          </text>
        )}
      </g>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload
      return (
        <Box sx={{ bgcolor: 'background.surface', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 'sm' }}>
          <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5, color: p.teamColor }}>{p.name} ({p.teamTricode})</Typography>
          <Typography level="body-xs">FP: {p.fantasyPoints.toFixed(1)}</Typography>
          <Typography level="body-xs" sx={{ color: '#FFC72C' }}>PTS {p.pts} • AST {p.ast}</Typography>
          <Typography level="body-xs" sx={{ color: '#FFFFFF' }}>REB {p.reb} • STL {p.stl} • BLK {p.blk}</Typography>
          {typeof p.tov === 'number' && <Typography level="body-xs" sx={{ color: '#FF6666' }}>TOV {p.tov}</Typography>}
        </Box>
      )
    }
    return null
  }

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%',
      minHeight: 400,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.body',
      p: 0.25
    }}>
      <Box sx={{ flex: 1, minHeight: 300, width: '100%', height: '100%', position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top5} layout="vertical" margin={{ top: 5, right: 8, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis type="number" stroke="#888" tick={{ fill: '#888' }} />
            <YAxis 
              dataKey="name" 
              type="category" 
              stroke="#888" 
              tick={<CustomYAxisTick />}
              width={120}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,199,44,0.08)' }} />
            <Bar dataKey="fantasyPoints" radius={[0, 6, 6, 0]}>
              <LabelList 
                dataKey="fantasyPoints" 
                position="right" 
                formatter={(v: number) => v.toFixed(1)} 
                fill="#fff"
                style={{ fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              />
              {top5.map((p, i) => {
                // Ensure each bar gets its unique team color
                const barColor = p.teamColor || '#FFC72C'
                // Set opacity: 100% for highlighted player, 25% for others
                // Ensure both values are numbers for proper comparison
                const isHighlighted = highlightedPlayerId !== undefined && 
                                      p.personId !== undefined && 
                                      Number(p.personId) === Number(highlightedPlayerId)
                const opacity = isHighlighted ? 1.0 : 0.25
                // Convert hex to rgba to properly apply opacity
                const colorWithOpacity = hexToRgba(barColor, opacity)
                return <Cell key={`${p.name}-${p.teamTricode}-${i}`} fill={colorWithOpacity} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Box sx={{ mt: 2 }}>
        {/* Team Legend */}
        {teams.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
            {teams.map(tricode => {
              const teamColor = teamColorMap[tricode] || '#888'
              return (
                <Box key={tricode} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box 
                    sx={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: '50%', 
                      bgcolor: teamColor,
                      border: '1px solid rgba(255,255,255,0.3)'
                    }} 
                  />
                  <Typography level="body-xs" sx={{ color: teamColor, fontWeight: 600 }}>
                    {tricode}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        )}
        <Typography level="body-xs" sx={{ color: 'text.tertiary', textAlign: 'center' }}>
          Top 5 fantasy performers • FanDuel scoring system
        </Typography>
      </Box>
    </Box>
  )
}


