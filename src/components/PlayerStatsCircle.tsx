import { Box, Typography, Stack } from '@mui/joy'
import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { FANDUEL_SCORING } from '../utils/fantasyScoring'

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

interface PlayerStatsCircleProps {
  playerId: number // nba_player_id
  gameId: string
  playerName?: string
}

export default function PlayerStatsCircle({ playerId, gameId, playerName }: PlayerStatsCircleProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        setLoading(true)
        
        console.log('🔍 PlayerStatsCircle: Fetching stats for:', {
          playerId,
          gameId,
          playerName
        })
        
        // Try live_player_stats first (for live/recent games)
        let { data: liveStats, error: liveError } = await supabase
          .from('live_player_stats')
          .select('stats')
          .eq('game_id', gameId)
          .eq('nba_player_id', playerId)
          .single()

        console.log('📊 live_player_stats query result:', {
          data: liveStats,
          error: liveError
        })

        if (liveStats && !liveError) {
          const statsData = liveStats.stats as any
          const extractedStats = {
            pts: statsData.pts || 0,
            reb: statsData.reb || 0,
            ast: statsData.ast || 0,
            blk: statsData.blk || 0,
            stl: statsData.stl || 0,
            tov: statsData.tov || 0,
            fgm: statsData.fgm || 0,
            fga: statsData.fga || 0,
            fg3m: statsData.fg3m || 0,
            fg3a: statsData.fg3a || 0,
            ftm: statsData.ftm || 0,
            fta: statsData.fta || 0,
            oreb: statsData.oreb || 0,
            dreb: statsData.dreb || 0,
            pf: statsData.pf || 0,
            min: statsData.min || 0,
            plus_minus: statsData.plus_minus || 0
          }
          console.log('✅ Found live stats:', extractedStats)
          setStats(extractedStats)
          setLoading(false)
          return
        }

        // Fall back to nba_boxscores (for historical games)
        console.log('🔄 Trying nba_boxscores fallback...')
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
          console.warn('❌ No stats found in either table')
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

  const avatarSize = 50

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

  // Stats to display in order
  const statItems = [
    { label: 'PTS', value: stats.pts, color: '#FFC72C' },
    { label: 'REB', value: stats.reb, color: '#4ECDC4' },
    { label: 'AST', value: stats.ast, color: '#FF6B6B' },
    { label: 'BLK', value: stats.blk, color: '#9B59B6' },
    { label: 'STL', value: stats.stl, color: '#3498DB' },
    { label: 'TOV', value: stats.tov, color: '#E74C3C' },
    { label: 'FP', value: fantasyPoints, color: '#F39C12' },
  ]

  return (
    <Stack 
      direction="row" 
      spacing={{ xs: 0.75, md: 1 }} 
      alignItems="center"
      sx={{ 
        pointerEvents: 'none',
        flexWrap: 'nowrap',
        overflow: 'visible',
      }}
    >
      {/* Player Avatar */}
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

      {/* Stats - Horizontal Layout */}
      {statItems.map((stat, index) => (
        <Stack
          key={stat.label}
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
          {/* Stat Value */}
          <Box
            sx={{
              backgroundColor: stat.color,
              color: '#000',
              fontWeight: 900,
              fontSize: { xs: '0.75rem', md: '0.9rem' },
              fontFamily: '"Libre Baskerville", Georgia, serif',
              px: { xs: 0.5, md: 0.75 },
              py: 0.25,
              borderRadius: '4px',
              minWidth: { xs: '24px', md: '32px' },
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.7)',
              border: '2px solid #000',
              lineHeight: 1,
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
    </Stack>
  )
}

