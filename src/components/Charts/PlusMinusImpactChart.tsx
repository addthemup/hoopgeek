import { Box, Typography, Stack } from '@mui/joy'

interface PlayerPlusMinus {
  name: string
  teamTricode: string
  teamColor: string
  plusMinus: number
  minutes: number
}

interface PlusMinusImpactChartProps {
  players: PlayerPlusMinus[]
  duration?: number
}

export default function PlusMinusImpactChart({ players, duration = 5000 }: PlusMinusImpactChartProps) {
  // Sort by plus/minus and take top 10
  const sortedPlayers = [...players]
    .filter(p => p.minutes > 5)
    .sort((a, b) => b.plusMinus - a.plusMinus)
    .slice(0, 10)

  const maxAbsPlusMinus = Math.max(...sortedPlayers.map(p => Math.abs(p.plusMinus)))

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.body',
      p: 0.25,
      overflow: 'auto'
    }}>
      <Box sx={{ mb: 3 }}>
        <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
          Plus/Minus Impact
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Player impact on scoring margin
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ flex: 1 }}>
        {sortedPlayers.map((player, index) => {
          const isPositive = player.plusMinus >= 0
          const percentage = (Math.abs(player.plusMinus) / maxAbsPlusMinus) * 100
          
          return (
            <Box key={index} sx={{ width: '100%' }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                mb: 0.5,
                alignItems: 'center'
              }}>
                <Typography level="body-sm" sx={{ 
                  fontWeight: 'bold',
                  color: player.teamColor,
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  fontSize: { xs: '0.75rem', md: '0.875rem' }
                }}>
                  {player.name.length > 20 ? player.name.substring(0, 20) + '...' : player.name}
                </Typography>
                <Typography level="body-sm" sx={{ 
                  fontWeight: 'bold',
                  color: isPositive ? '#00FF00' : '#FF4444',
                  fontSize: { xs: '0.875rem', md: '1rem' }
                }}>
                  {isPositive ? '+' : ''}{player.plusMinus}
                </Typography>
              </Box>
              
              <Box sx={{ 
                width: '100%', 
                height: 28,
                bgcolor: 'background.level2',
                borderRadius: 'sm',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <Box sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${percentage}%`,
                  background: isPositive 
                    ? 'linear-gradient(90deg, #00FF00, #00CC00)' 
                    : 'linear-gradient(90deg, #FF4444, #CC0000)',
                  transition: 'width 0.5s ease-out',
                  display: 'flex',
                  alignItems: 'center',
                  px: 1
                }} />
                
                <Box sx={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 1
                }}>
                  <Typography level="body-xs" sx={{ 
                    color: '#000',
                    fontWeight: 'bold',
                    textShadow: '0 0 4px rgba(255,255,255,0.8)'
                  }}>
                    {player.teamTricode} • {player.minutes.toFixed(0)} min
                  </Typography>
                </Box>
              </Box>
            </Box>
          )
        })}
      </Stack>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
          Green = Positive impact, Red = Negative impact
        </Typography>
      </Box>
    </Box>
  )
}


