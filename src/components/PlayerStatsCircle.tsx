import { Box, Typography, Stack, Chip } from '@mui/joy'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { FANDUEL_SCORING } from '../utils/fantasyScoring'
import { usePlayerPropHitRate } from '../hooks/usePlayerPropHitRate'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { motion, AnimatePresence } from 'framer-motion'

interface PlayerStats {
  pts: number
  reb: number
  ast: number
  blk: number
  stl: number
  tov: number
  fgm?: number
  fga?: number
  fg3m?: number
  fg3a?: number
  ftm?: number
  fta?: number
  oreb?: number
  dreb?: number
  pf?: number
  min?: number
  plus_minus?: number
}

interface PropResult {
  id?: string
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

interface PlayerStatsCircleProps {
  playerId: number // nba_player_id (current player in slide)
  gameId: string
  playerName?: string
  postType?: string // Optional: 'player_spotlight' to show prop hit rate
  playerProps?: PlayerPropsData // Props data to rotate with stats
  spotlightPlayerId?: number // Original spotlight player ID (for player_spotlight posts)
  hideAvatar?: boolean // Hide the player avatar (for use in overlays where avatar is shown elsewhere)
}

export default function PlayerStatsCircle({ playerId, gameId, playerName, postType, playerProps, spotlightPlayerId, hideAvatar = false }: PlayerStatsCircleProps) {
  const navigate = useNavigate()
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [nbaPlayerUuid, setNbaPlayerUuid] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showProps, setShowProps] = useState(false) // Rotation state: false = stats, true = props
  const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const rotationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Fetch prop hit rate for player_spotlight posts (only for the original spotlight player)
  const isPlayerSpotlight = postType === 'player_spotlight'
  const isSpotlightPlayer = spotlightPlayerId !== undefined 
    ? Number(playerId) === Number(spotlightPlayerId)
    : isPlayerSpotlight
  const { data: propHitRate } = usePlayerPropHitRate(isSpotlightPlayer ? playerId : null)

  // Rotation timer: show stats for 15 seconds, then props for 15 seconds
  // Only rotate props if this is the original spotlight player (to avoid showing wrong player's props)
  useEffect(() => {
    // Only show props if:
    // 1. We have props data
    // 2. This is the original spotlight player (or no spotlightPlayerId specified, meaning it's not a spotlight post)
    const shouldShowProps = playerProps && playerProps.props && playerProps.props.length > 0
    
    // Check if this is the original spotlight player
    // If spotlightPlayerId is provided, compare with playerId (both should be numbers)
    // If spotlightPlayerId is not provided, allow props (it's not a spotlight post or we don't need to restrict)
    const isOriginalSpotlightPlayer = spotlightPlayerId !== undefined 
      ? Number(playerId) === Number(spotlightPlayerId)
      : true
    
    console.log('🔄 Props rotation check:', {
      shouldShowProps,
      isOriginalSpotlightPlayer,
      playerId,
      spotlightPlayerId,
      hasProps: !!playerProps?.props?.length,
      propsCount: playerProps?.props?.length || 0
    })
    
    if (!shouldShowProps || !isOriginalSpotlightPlayer) {
      setShowProps(false)
      return
    }

    // Clear any existing timers
    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current)
      rotationTimeoutRef.current = null
    }
    if (rotationIntervalRef.current) {
      clearInterval(rotationIntervalRef.current)
      rotationIntervalRef.current = null
    }

    // Start with stats (showProps = false)
    setShowProps(false)
    
    // Set up a timeout to switch to props after 15 seconds, then interval to toggle
    rotationTimeoutRef.current = setTimeout(() => {
      console.log('🔄 Switching to props after 15 seconds')
      setShowProps(true)
      
      // After showing props for 15 seconds, switch back to stats and repeat
      rotationIntervalRef.current = setInterval(() => {
        setShowProps(prev => {
          console.log('🔄 Toggling props display:', !prev)
          return !prev
        })
      }, 7000) // Toggle every 15 seconds
    }, 7000) // Switch to props after 15 seconds

    return () => {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current)
        rotationTimeoutRef.current = null
      }
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current)
        rotationIntervalRef.current = null
      }
    }
  }, [playerProps, playerId, spotlightPlayerId])
  
  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900) // MUI's md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Get the UUID for the player
  useEffect(() => {
    const fetchPlayerUuid = async () => {
      if (!playerId) return
      
      const { data: nbaPlayer } = await supabase
        .from('nba_players')
        .select('id')
        .eq('nba_player_id', playerId)
        .maybeSingle()
      
      if (nbaPlayer?.id) {
        setNbaPlayerUuid(nbaPlayer.id)
      }
    }
    
    fetchPlayerUuid()
  }, [playerId])
  

  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        setLoading(true)
        
        console.log('🔍 PlayerStatsCircle: Fetching stats for:', {
          playerId,
          gameId,
          playerName
        })
        
        // Always get data from nba_boxscores (never use live_player_stats)
        const { data: boxscoreStats, error: boxscoreError } = await supabase
          .from('nba_boxscores')
          .select('pts, reb, ast, blk, stl, tov, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, fouls_personal, min, plus_minus_points')
          .eq('game_id', gameId)
          .eq('nba_player_id', playerId)
          .single()

        console.log('📊 nba_boxscores query result:', {
          data: boxscoreStats,
          error: boxscoreError
        })

        if (boxscoreStats && !boxscoreError) {
          const extractedStats = {
            pts: boxscoreStats.pts || 0,
            reb: boxscoreStats.reb || 0,
            ast: boxscoreStats.ast || 0,
            blk: boxscoreStats.blk || 0,
            stl: boxscoreStats.stl || 0,
            tov: boxscoreStats.tov || 0,
            fgm: boxscoreStats.fgm || 0,
            fga: boxscoreStats.fga || 0,
            fg3m: boxscoreStats.fg3m || 0,
            fg3a: boxscoreStats.fg3a || 0,
            ftm: boxscoreStats.ftm || 0,
            fta: boxscoreStats.fta || 0,
            oreb: boxscoreStats.oreb || 0,
            dreb: boxscoreStats.dreb || 0,
            pf: boxscoreStats.fouls_personal || 0,
            min: boxscoreStats.min || 0,
            plus_minus: boxscoreStats.plus_minus_points || 0
          }
          console.log('✅ Found boxscore stats:', extractedStats)
          setStats(extractedStats)
        } else {
          console.warn('❌ No stats found in nba_boxscores')
        }
      } catch (error) {
        console.error('❌ Error fetching player stats:', error)
      } finally {
        setLoading(false)
      }
    }

    if (playerId && gameId) {
      fetchPlayerStats()
    } else {
      console.warn('⚠️ Missing playerId or gameId:', { playerId, gameId })
    }
  }, [playerId, gameId, playerName])

  const avatarSize = 70 // 75% of 110 (was 110, originally 55)
  
  // Handle avatar click to navigate to player page
  const handleAvatarClick = (e: React.MouseEvent) => {
    if (!nbaPlayerUuid) return
    
    e.stopPropagation()
    navigate(`/player/${nbaPlayerUuid}`)
  }

  // Calculate FanDuel Fantasy Points
  const calculateFP = () => {
    if (!stats) return 0
    // Convert to PlayerGameLog format for fantasy scoring
    const gameLog = {
      pts: stats.pts,
      reb: stats.reb,
      ast: stats.ast,
      stl: stats.stl,
      blk: stats.blk,
      tov: stats.tov,
    } as any
    return FANDUEL_SCORING.calculatePoints(gameLog)
  }

  const fantasyPoints = stats ? calculateFP() : 0

  // Show loading state with just avatar
  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          component="img"
          src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`}
          alt={playerName || 'Player'}
          title={playerName}
          sx={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: '50%',
            border: '2px solid #FFC72C',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
            backgroundColor: '#000',
            objectFit: 'cover',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            flexShrink: 0,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </Stack>
    )
  }

  // If no stats found, show avatar only (no stats)
  if (!stats) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          component="img"
          src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`}
          alt={playerName || 'Player'}
          title={playerName}
          sx={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: '50%',
            border: '2px solid #FFC72C',
            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
            backgroundColor: '#000',
            objectFit: 'cover',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            flexShrink: 0,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </Stack>
    )
  }

  // Format bet type for display - match PlayerPropsOverlay format
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
      'points+rebounds': 'PTS+REB',
      'points+rebounds+assists': 'PAR',
      'rebounds+assists': 'REB+AST',
    }
    
    const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+')
    return betTypeMap[normalized] || betTypeMap[betType] || betType.toUpperCase()
  }

  // Process props: group by bet type and pick best one per category (prefer over, then highest line)
  const processProps = (): PropResult[] => {
    if (!playerProps?.props || playerProps.props.length === 0) return []

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

    // Sort by common prop order
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

    return categories.slice(0, 11) // Limit to 11 props to match stats count
  }

  const processedProps = processProps()

  // Calculate hit rate for overs (how many categories hit their over)
  const overProps = processedProps.filter(p => p.overUnder === 'O' && p.result?.result === 'over')
  const totalOverProps = processedProps.filter(p => p.overUnder === 'O')
  const oversHit = overProps.length
  const totalOvers = totalOverProps.length
  const overHitRate = totalOvers > 0 ? Math.round((oversHit / totalOvers) * 100) : 0

  // Get stat color based on hit/miss
  const getPropColor = (prop: PropResult): string => {
    if (!prop.result) return '#FFC72C'
    const isOver = prop.result.result === 'over'
    const isUnder = prop.result.result === 'under'
    if (isOver) return '#10B981' // Green for hit
    if (isUnder) return '#EF4444' // Red for miss
    return '#FFC72C' // Gold default
  }

  // Stats to display in order (added 3PM, 3PA, FTM, FTA)
  // On mobile, hide 3PA and FTA to make stats fit better
  const allStatItems = [
    { label: 'PTS', value: stats.pts, color: '#FFC72C' },
    { label: 'REB', value: stats.reb, color: '#4ECDC4' },
    { label: 'AST', value: stats.ast, color: '#FF6B6B' },
    { label: '3PM', value: stats.fg3m || 0, color: '#9B59B6' },
    { label: '3PA', value: stats.fg3a || 0, color: '#8B5CF6' },
    { label: 'FTM', value: stats.ftm || 0, color: '#10B981' },
    { label: 'FTA', value: stats.fta || 0, color: '#059669' },
    { label: 'BLK', value: stats.blk, color: '#A855F7' },
    { label: 'STL', value: stats.stl, color: '#3498DB' },
    { label: 'TOV', value: stats.tov, color: '#E74C3C' },
    { label: 'FP', value: fantasyPoints, color: '#F39C12' },
  ]
  
  // Filter out 3PA and FTA on mobile
  const statItems = isMobile 
    ? allStatItems.filter(stat => stat.label !== '3PA' && stat.label !== 'FTA')
    : allStatItems

  // Determine what to display: stats or props
  const hasProps = processedProps.length > 0
  const displayStats = !showProps || !hasProps
  const displayProps = showProps && hasProps

  return (
    <>
      <Stack 
        direction="row" 
        spacing={0}
        alignItems="center"
        sx={{ 
          pointerEvents: 'auto',
          flexWrap: 'nowrap',
          overflow: 'visible',
          width: '100%',
          justifyContent: hideAvatar ? 'center' : 'space-between',
          gap: { xs: 0.5, md: 0.75 },
        }}
      >
        {/* Player Avatar - clickable if logged in (hidden if hideAvatar is true) */}
        {!hideAvatar && (
          <Box
            component="img"
            src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`}
            alt={playerName || 'Player'}
            title={`View ${playerName || 'player'} profile`}
            onClick={(e) => {
              e.stopPropagation() // Prevent video pause
              handleAvatarClick(e)
            }}
            data-clickable="true"
            sx={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: '50%',
              border: '2px solid #FFC72C',
              boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
              backgroundColor: '#000',
              objectFit: 'cover',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              flexShrink: 0,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'scale(1.1)',
                borderColor: '#FFD700',
                boxShadow: '0 4px 12px rgba(255, 215, 0, 0.5)',
              },
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}

        {/* Prop Hit Rate Badge - Only show on player_spotlight posts for the original spotlight player */}
        {isPlayerSpotlight && isSpotlightPlayer && propHitRate && propHitRate.totalProps > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              mr: 1,
            }}
          >
            <Chip
              size="sm"
              variant="soft"
              color={propHitRate.trend === 'hot' ? 'success' : propHitRate.trend === 'cold' ? 'danger' : 'neutral'}
              startDecorator={
                propHitRate.trend === 'hot' ? (
                  <TrendingUpIcon sx={{ fontSize: '0.875rem' }} />
                ) : propHitRate.trend === 'cold' ? (
                  <TrendingDownIcon sx={{ fontSize: '0.875rem' }} />
                ) : null
              }
              sx={{
                fontWeight: 700,
                fontSize: { xs: '0.7rem', md: '0.75rem' },
                fontFamily: '"Libre Baskerville", Georgia, serif',
                bgcolor: propHitRate.trend === 'hot' 
                  ? 'rgba(16, 185, 129, 0.2)' 
                  : propHitRate.trend === 'cold' 
                  ? 'rgba(239, 68, 68, 0.2)' 
                  : 'rgba(255, 255, 255, 0.1)',
                color: propHitRate.trend === 'hot' 
                  ? '#10B981' 
                  : propHitRate.trend === 'cold' 
                  ? '#EF4444' 
                  : '#ffffff',
                border: `1px solid ${propHitRate.trend === 'hot' 
                  ? 'rgba(16, 185, 129, 0.4)' 
                  : propHitRate.trend === 'cold' 
                  ? 'rgba(239, 68, 68, 0.4)' 
                  : 'rgba(255, 255, 255, 0.2)'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
              }}
            >
              {propHitRate.hitRate.toFixed(0)}% OVERS
            </Chip>
          </Box>
        )}

        {/* Stats or Props - Rotate between them */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          flex: 1,
        }}>
          {/* Stats/Props Row */}
          <Box sx={{ 
            display: 'flex', 
            flex: 1, 
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: { xs: 0.25, md: 0.5 },
            position: 'relative',
            minHeight: { xs: '35px', md: '40px' }, // Ensure consistent height
          }}>
          <AnimatePresence mode="wait">
            {displayStats && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex',
                  flex: 1,
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.25rem',
                  width: '100%',
                }}
              >
          {statItems.map((stat, index) => (
            <Stack
              key={stat.label}
              spacing={0}
              alignItems="center"
              sx={{
                flex: 1,
                    }}
                  >
                    {/* Stat Value */}
              <Box
                sx={{
                  backgroundColor: stat.color,
                  color: '#000',
                  fontWeight: 900,
                        fontSize: { xs: '0.825rem', md: '0.99rem' },
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  px: { xs: 0.5, md: 0.75 },
                  py: 0.25,
                  borderRadius: '4px',
                        minWidth: { xs: '26px', md: '35px' },
                  textAlign: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
                  border: '2px solid #000',
                  lineHeight: 1,
                  width: '100%',
                }}
              >
                {typeof stat.value === 'number' ? stat.value.toFixed(stat.label === 'FP' ? 1 : 0) : stat.value}
              </Box>
              
              {/* Stat Label */}
              <Typography
                level="body-xs"
                sx={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: { xs: '0.55rem', md: '0.65rem' },
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,1)',
                  fontFamily: 'system-ui',
                  whiteSpace: 'nowrap',
                  mt: 0.25,
                }}
              >
                {stat.label}
              </Typography>
            </Stack>
          ))}
              </motion.div>
            )}
      
            {displayProps && (
          <motion.div
                key="props"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'flex',
                  flex: 1,
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.25rem',
                  width: '100%',
                }}
              >
                {processedProps.map((prop, index) => {
                  if (!prop.result) return null
                  
                  return (
                    <Stack
                      key={prop.id || `${prop.bet_type}-${index}`}
                      spacing={0}
                      alignItems="center"
                      sx={{
                        flex: 1,
                      }}
                    >
                      {/* Prop Value */}
                      <Box
                        sx={{
                          backgroundColor: getPropColor(prop),
                          color: '#000',
                          fontWeight: 900,
                          fontSize: { xs: '0.825rem', md: '0.99rem' },
                          fontFamily: '"Libre Baskerville", Georgia, serif',
                          px: { xs: 0.5, md: 0.75 },
                          py: 0.25,
                          borderRadius: '4px',
                          minWidth: { xs: '26px', md: '35px' },
                          textAlign: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
                          border: '2px solid #000',
                          lineHeight: 1,
                          width: '100%',
                        }}
                      >
                        {prop.result.actualValue}
                      </Box>
                      
                      {/* Prop Label */}
                      <Typography
                        level="body-xs"
                        sx={{
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: { xs: '0.55rem', md: '0.65rem' },
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,1)',
                          fontFamily: 'system-ui',
                          whiteSpace: 'nowrap',
                          mt: 0.25,
                        }}
                      >
                        {formatBetType(prop.bet_type)}
                      </Typography>
                    </Stack>
                  )
                })}
                
                {/* Hit Rate - Display at far right */}
                {totalOvers > 0 && (
                  <Stack
                    spacing={0}
                    alignItems="center"
                    sx={{
                      flex: 1,
                    }}
                  >
                    {/* Hit Rate Value Box */}
                    <Box
                      sx={{
                        backgroundColor: overHitRate >= 50 ? '#10B981' : '#EF4444',
                        color: '#000',
                        fontWeight: 900,
                        fontSize: { xs: '0.825rem', md: '0.99rem' },
                        fontFamily: '"Libre Baskerville", Georgia, serif',
                        px: { xs: 0.5, md: 0.75 },
                        py: 0.25,
                        borderRadius: '4px',
                        minWidth: { xs: '26px', md: '35px' },
                        textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
                        border: '2px solid #000',
                        lineHeight: 1,
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
                        fontSize: { xs: '0.55rem', md: '0.65rem' },
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,1)',
                        fontFamily: 'system-ui',
                        whiteSpace: 'nowrap',
                        mt: 0.25,
                      }}
                    >
                      {oversHit}/{totalOvers} O
                    </Typography>
                  </Stack>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </Box>
        </Box>
      </Stack>
      
    </>
  )
}

