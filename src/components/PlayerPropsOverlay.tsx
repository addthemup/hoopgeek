import { Box, Typography, Stack } from '@mui/joy'
import { Whatshot, AcUnit } from '@mui/icons-material'

interface PropResult {
  bet_type: string
  line: number
  overUnder?: 'O' | 'U' | null
  result?: {
    actualValue: number
    hit: boolean
    result: 'over' | 'under' | 'push'
  } | null
}

interface PlayerPropsData {
  props: PropResult[]
  hitRate: number
  totalProps: number
  oversHit: number
  undersHit: number
  pushes: number
}

interface PlayerPropsOverlayProps {
  playerProps?: PlayerPropsData
  propsIcon?: 'fire' | 'snow' | null
}

export default function PlayerPropsOverlay({ playerProps, propsIcon }: PlayerPropsOverlayProps) {
  if (!playerProps || playerProps.totalProps === 0) {
    return null
  }

  const hitRatePercent = Math.round(playerProps.hitRate * 100)

  // Format bet type for display - match MarginPlayerProps format
  const formatBetType = (betType: string): string => {
    const betTypeMap: Record<string, string> = {
      'points': 'PTS',
      'point': 'PTS',
      'pts': 'PTS',
      'rebounds': 'REB',
      'rebound': 'REB',
      'reb': 'REB',
      'assists': 'AST',
      'assist': 'AST',
      'ast': 'AST',
      'steals': 'STL',
      'steal': 'STL',
      'stl': 'STL',
      'blocks': 'BLK',
      'block': 'BLK',
      'blk': 'BLK',
      'threes': '3PM',
      'three': '3PM',
      '3pt': '3PM',
      '3-pointer': '3PM',
      '3pm': '3PM',
      'threepointersmade': '3PM',
      'three_pointers_made': '3PM',
      'three-pointers-made': '3PM',
      'turnovers': 'TOV',
      'turnover': 'TOV',
      'tov': 'TOV',
      'points_rebounds': 'PTS+REB',
      'points_assists': 'PTS+AST',
      'rebounds_assists': 'REB+AST',
      'points_rebounds_assists': 'PAR',
      'blocks+steals': 'STOCKS',
      'blocks_steals': 'STOCKS',
      'steals+blocks': 'STOCKS',
      'steals_blocks': 'STOCKS',
      'stocks': 'STOCKS',
      'points+assists': 'PTS+AST',
      'points_assists': 'PTS+AST',
      'points+rebounds': 'PTS+REB',
      'points_rebounds': 'PTS+REB',
      'points+rebounds+assists': 'PAR',
      'points_rebounds_assists': 'PAR',
      'rebounds+assists': 'REB+AST',
      'rebounds_assists': 'REB+AST',
    }
    
    const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+')
    return betTypeMap[normalized] || betTypeMap[betType] || betType.toUpperCase()
  }

  // Group props by bet type and pick best one per category (prefer over, then highest line)
  const processProps = (): PropResult[] => {
    if (!playerProps.props || playerProps.props.length === 0) return []

    // Group by normalized bet type
    const propsByType: Record<string, PropResult[]> = {}
    
    playerProps.props.forEach(prop => {
      if (!prop.result) return
      
      const normalizedBetType = prop.bet_type.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+')
      if (!propsByType[normalizedBetType]) {
        propsByType[normalizedBetType] = []
      }
      propsByType[normalizedBetType].push(prop)
    })

    // For each category, pick the best prop
    const categories: PropResult[] = []
    
    Object.entries(propsByType).forEach(([betType, props]) => {
      if (props.length === 0) return

      // Separate into over and under props
      const overProps = props.filter(p => p.overUnder === 'O')
      const underProps = props.filter(p => p.overUnder === 'U')

      // Prefer over props, then highest line for over, lowest line for under
      let bestProp: PropResult | null = null

      if (overProps.length > 0) {
        // Get the over prop with the highest line
        bestProp = overProps.reduce((best, current) => {
          const currentLine = current.line || -Infinity
          const bestLine = best.line || -Infinity
          return currentLine > bestLine ? current : best
        })
      } else if (underProps.length > 0) {
        // Get the under prop with the lowest line
        bestProp = underProps.reduce((best, current) => {
          const currentLine = current.line || Infinity
          const bestLine = best.line || Infinity
          return currentLine < bestLine ? current : best
        })
      } else {
        // No over/under specified, just take the first one
        bestProp = props[0]
      }

      if (bestProp) {
        categories.push(bestProp)
      }
    })

    // Sort by common prop order (same as MarginPlayerProps)
    const propOrder = ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'TOV', 'STOCKS', 'PTS+AST', 'PTS+REB', 'PAR', 'REB+AST']
    categories.sort((a, b) => {
      const aDisplay = formatBetType(a.bet_type)
      const bDisplay = formatBetType(b.bet_type)
      const aIndex = propOrder.indexOf(aDisplay)
      const bIndex = propOrder.indexOf(bDisplay)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return aDisplay.localeCompare(bDisplay)
    })

    return categories.slice(0, 15) // Limit to 15 props (no scrollbar needed)
  }

  const processedProps = processProps()

  if (processedProps.length === 0) {
    return null
  }

  // Calculate hit rate for overs (how many categories hit their over)
  // Only count props that are "over" props and hit
  const overProps = processedProps.filter(p => p.overUnder === 'O' && p.result?.result === 'over')
  const totalOverProps = processedProps.filter(p => p.overUnder === 'O')
  const oversHit = overProps.length
  const totalOvers = totalOverProps.length
  const overHitRate = totalOvers > 0 ? Math.round((oversHit / totalOvers) * 100) : 0

  // Get stat color based on hit/miss (same as stats buttons)
  const getStatColor = (isOver: boolean, isUnder: boolean): string => {
    if (isOver) return '#10B981' // Green for hit
    if (isUnder) return '#EF4444' // Red for miss
    return '#FFC72C' // Gold default (same as stats)
  }

  // Calculate height offset to position below stats row
  // Avatar: 55px, stats buttons: ~35px (value box + label), spacing: ~12px
  // Total: ~102px to ensure props start below the stats row
  const statsRowHeight = { xs: 102, md: 102 }

  return (
    <Box
      sx={{
        position: 'absolute',
        right: 12,
        top: { xs: statsRowHeight.xs, md: statsRowHeight.md }, // Position below stats row
        zIndex: 15,
        pointerEvents: 'auto',
      }}
    >
      <Stack
        direction="column"
        spacing={0.5}
        alignItems="flex-end"
      >
        {/* Props - Display as vertical buttons matching stats styling */}
        {processedProps.map((prop, index) => {
          if (!prop.result) return null

          const isOver = prop.result.result === 'over'
          const isUnder = prop.result.result === 'under'
          const statColor = getStatColor(isOver, isUnder)

          return (
            <Stack
              key={prop.id || `${prop.bet_type}-${index}`}
              spacing={0}
              alignItems="center"
              sx={{
                animation: 'fadeIn 0.4s ease-out',
                animationDelay: `${index * 0.05}s`,
                animationFillMode: 'both',
                '@keyframes fadeIn': {
                  from: { opacity: 0, transform: 'scale(0.8)' },
                  to: { opacity: 1, transform: 'scale(1)' }
                }
              }}
            >
              {/* Prop Value Box - Identical to stats buttons */}
              <Box
                sx={{
                  backgroundColor: statColor,
                  color: '#000',
                  fontWeight: 900,
                  fontSize: { xs: '0.825rem', md: '0.99rem' }, // Same as stats
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  px: { xs: 0.5, md: 0.75 }, // Same as stats
                  py: 0.25, // Same as stats
                  borderRadius: '4px', // Same as stats
                  minWidth: { xs: '26px', md: '35px' }, // Same as stats
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.7)', // Same as stats
                  border: '2px solid #000', // Same as stats
                  lineHeight: 1, // Same as stats
                  width: '100%',
                }}
              >
                {prop.result.actualValue}
              </Box>
              
              {/* Prop Label - Identical to stats labels */}
                  <Typography
                    level="body-xs"
                    sx={{
                      color: '#fff',
                  fontWeight: 700,
                  fontSize: { xs: '0.55rem', md: '0.65rem' }, // Same as stats
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                  textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,1)', // Same as stats
                  fontFamily: 'system-ui', // Same as stats
                  whiteSpace: 'nowrap',
                  mt: 0.25, // Same as stats
                    }}
                  >
                    {formatBetType(prop.bet_type)}
                  </Typography>
            </Stack>
          )
        })}

        {/* Hit Rate - Display at bottom */}
        {totalOvers > 0 && (
          <Stack
            spacing={0}
            alignItems="center"
                      sx={{
              mt: 0.5,
              animation: 'fadeIn 0.4s ease-out',
              animationDelay: `${processedProps.length * 0.05}s`,
              animationFillMode: 'both',
              '@keyframes fadeIn': {
                from: { opacity: 0, transform: 'scale(0.8)' },
                to: { opacity: 1, transform: 'scale(1)' }
              }
            }}
          >
            {/* Hit Rate Value Box */}
            <Box
                      sx={{
                backgroundColor: overHitRate >= 50 ? '#10B981' : '#EF4444',
                color: '#000',
                fontWeight: 900,
                fontSize: { xs: '0.825rem', md: '0.99rem' }, // Same as stats
                fontFamily: '"Libre Baskerville", Georgia, serif',
                px: { xs: 0.5, md: 0.75 }, // Same as stats
                py: 0.25, // Same as stats
                borderRadius: '4px', // Same as stats
                minWidth: { xs: '26px', md: '35px' }, // Same as stats
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.7)', // Same as stats
                border: '2px solid #000', // Same as stats
                lineHeight: 1, // Same as stats
                width: '100%',
              }}
            >
              {overHitRate}%
            </Box>
            
            {/* Hit Rate Label */}
                  <Typography
                    level="body-xs"
                    sx={{
                color: '#fff',
                      fontWeight: 700,
                fontSize: { xs: '0.55rem', md: '0.65rem' }, // Same as stats
                      textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,1)', // Same as stats
                fontFamily: 'system-ui', // Same as stats
                whiteSpace: 'nowrap',
                mt: 0.25, // Same as stats
                    }}
                  >
              {oversHit}/{totalOvers} OVERS
                  </Typography>
                </Stack>
        )}
      </Stack>
    </Box>
  )
}

