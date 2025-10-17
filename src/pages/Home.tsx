import { Box, Typography, Stack, Card, Chip, IconButton, AspectRatio, Grid, Link as JoyLink, CircularProgress, CardContent, CardOverflow, Divider, CardCover } from '@mui/joy'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Favorite from '@mui/icons-material/Favorite'
import Visibility from '@mui/icons-material/Visibility'
import PlayCircleOutline from '@mui/icons-material/PlayCircleOutline'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { getAllGames, GameData } from '../utils/gameLoader'

// Detect if mobile device
const isMobile = () => {
  return window.innerWidth < 900 // MUI's md breakpoint
}

// GameData interface is now imported from gameLoader

// Mock data removed - now using real data from JSON files

// Algorithm to calculate feed priority
const calculateFeedScore = (game: GameData): number => {
  const now = Date.now()
  const gameDate = new Date(game.date).getTime()
  const daysAgo = (now - gameDate) / (1000 * 60 * 60 * 24)
  
  // Adjust fun score (divide by 10) so 100 becomes 10
  const adjustedFunScore = game.fun_score / 10
  
  // Fun score is the primary factor (weight: 70%)
  const funScoreWeight = 0.7
  const normalizedFunScore = (adjustedFunScore / 10) * funScoreWeight
  
  // Recency score with exponential decay (weight: 30%)
  const recencyWeight = 0.3
  const decayRate = 0.05 // Slower decay as requested
  const recencyScore = Math.exp(-decayRate * daysAgo) * recencyWeight
  
  // Add random factor for games older than 30 days (can bubble up)
  const randomBoost = daysAgo > 30 ? Math.random() * 0.15 : 0
  
  return normalizedFunScore + recencyScore + randomBoost
}

interface GameCardProps {
  game: GameData
  onClick: () => void
}

function GameCard({ game, onClick }: GameCardProps) {
  const { story, fun_score, lead_changes, dunk_stats, deep_shots } = game
  
  // Adjust fun score (divide by 10)
  const adjustedFunScore = fun_score / 10
  
  // Determine card color based on adjusted fun score
  const getFunScoreColor = (score: number): 'danger' | 'warning' | 'success' | 'primary' => {
    if (score >= 9.5) return 'danger'
    if (score >= 8.5) return 'warning'
    if (score >= 7.5) return 'success'
    return 'primary'
  }
  
  // Calculate days ago
  const daysAgo = Math.floor((Date.now() - new Date(game.date).getTime()) / (1000 * 60 * 60 * 24))
  const dateLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`
  
  // Format views
  const formatViews = (views: number) => {
    if (views >= 1000) return `${(views / 1000).toFixed(1)}k`
    return views.toString()
  }
  
  // Team logo URL - using ESPN's CDN
  const getTeamLogoUrl = (tricode: string) => {
    return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${tricode}.png&h=100&w=100`
  }
  
  // Get first video URL from script (or use thumbnail as fallback)
  const getVideoUrl = () => {
    // Check if there's a video URL in the game data
    if (game.video_url) return game.video_url
    
    // Otherwise, try to get from script (you'll need to pass this through gameLoader)
    // For now, return null and we'll use image fallback
    return null
  }
  
  const videoUrl = getVideoUrl()
  
  return (
    <Card variant="outlined" sx={{ width: '100%', cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
      <CardOverflow>
        {/* Video/Image Background */}
        <Box sx={{ position: 'relative', minHeight: 200 }}>
          <CardCover>
            {videoUrl ? (
              <video
                autoPlay
                loop
                muted
                playsInline
                poster={game.thumbnail_url || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800'}
                style={{ objectFit: 'cover' }}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            ) : (
              <img
                src={game.thumbnail_url || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800'}
                srcSet={`${game.thumbnail_url || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&dpr=2'} 2x`}
                loading="lazy"
                alt={story.matchup}
                style={{ objectFit: 'cover' }}
              />
            )}
          </CardCover>
          
          {/* Dark overlay for better text contrast */}
          <CardCover
            sx={{
              background: `linear-gradient(180deg, 
                rgba(0,0,0,0.3) 0%, 
                rgba(0,0,0,0.5) 50%, 
                rgba(0,0,0,0.7) 100%)`
            }}
          />
          
          {/* Content overlay */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              py: 4,
              minHeight: 200
            }}
            onClick={onClick}
          >
          {/* Team Logos */}
          <Stack direction="row" alignItems="center" spacing={3} sx={{ width: '100%', justifyContent: 'space-around', px: 2 }}>
            {/* Winner Logo */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                component="img"
                src={getTeamLogoUrl(story.teams.winner.tricode)}
                alt={story.teams.winner.tricode}
                sx={{
                  width: 60,
                  height: 60,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                }}
              />
              <Typography level="h4" sx={{ color: 'white', mt: 1, fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                {story.teams.winner.points}
              </Typography>
              <Typography level="body-xs" sx={{ color: 'white', opacity: 0.9, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                {story.teams.winner.tricode}
              </Typography>
            </Box>
            
            {/* Fun Score - FOCAL POINT */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2 }}>
              <Typography 
                level="h1" 
                sx={{ 
                  color: 'white', 
                  fontSize: '3.5rem',
                  fontWeight: 'bold',
                  lineHeight: 1,
                  textShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  letterSpacing: '-0.02em'
                }}
              >
                {adjustedFunScore.toFixed(1)}
              </Typography>
              <Typography level="body-xs" sx={{ color: 'white', opacity: 0.95, mt: 0.5, textShadow: '0 1px 2px rgba(0,0,0,0.3)', fontWeight: 'md' }}>
                🔥 FUN SCORE
              </Typography>
            </Box>
            
            {/* Loser Logo */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                component="img"
                src={getTeamLogoUrl(story.teams.loser.tricode)}
                alt={story.teams.loser.tricode}
                sx={{
                  width: 60,
                  height: 60,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
                  opacity: 0.8,
                }}
              />
              <Typography level="h4" sx={{ color: 'white', mt: 1, fontWeight: 'bold', opacity: 0.9, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                {story.teams.loser.points}
              </Typography>
              <Typography level="body-xs" sx={{ color: 'white', opacity: 0.8, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                {story.teams.loser.tricode}
              </Typography>
            </Box>
          </Stack>
          </Box>
        </Box>
        
        {/* Like Button - Bottom Right with overlay */}
        <IconButton
          aria-label={`Like ${story.matchup}`}
          size="md"
          variant="solid"
          color="danger"
          sx={{
            position: 'absolute',
            zIndex: 2,
            borderRadius: '50%',
            right: '1rem',
            bottom: 0,
            transform: 'translateY(50%)',
          }}
        >
          <Favorite />
        </IconButton>
      </CardOverflow>
      
      <CardContent onClick={onClick}>
        <Typography level="title-md">
          <JoyLink overlay underline="none">
            {story.teams.winner.city} defeats {story.teams.loser.city}
          </JoyLink>
        </Typography>
        
        {/* Highlight chips */}
        {(lead_changes.buzzer_beater > 0 || lead_changes.total >= 10 || dunk_stats['Total Dunks'] >= 15 || deep_shots.four_pointers > 0) && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
            {lead_changes.buzzer_beater > 0 && (
              <Chip size="sm" variant="soft" color="danger">
                🎯 Buzzer Beater
              </Chip>
            )}
            {lead_changes.total >= 10 && (
              <Chip size="sm" variant="soft" color="warning">
                ↔️ {lead_changes.total} Changes
              </Chip>
            )}
            {dunk_stats['Total Dunks'] >= 15 && (
              <Chip size="sm" variant="soft" color="success">
                💪 {dunk_stats['Total Dunks']} Dunks
              </Chip>
            )}
            {deep_shots.four_pointers > 0 && (
              <Chip size="sm" variant="soft" color="primary">
                🎯 4-Pointer
              </Chip>
            )}
          </Stack>
        )}
      </CardContent>
      
      <CardOverflow variant="soft">
        <Divider inset="context" />
        <CardContent orientation="horizontal">
          <Typography level="body-xs" startDecorator={<Visibility />}>
            {formatViews(game.views || 0)} views
          </Typography>
          <Divider orientation="vertical" />
          <Typography level="body-xs">{dateLabel}</Typography>
          <Divider orientation="vertical" />
          <Typography level="body-xs">{game.likes || 0} likes</Typography>
        </CardContent>
      </CardOverflow>
    </Card>
  )
}

// Batch sizes based on viewport
const MOBILE_BATCH_SIZE = 3  // Load 3 at a time on mobile (smoother than 1)
const DESKTOP_BATCH_SIZE = 12 // Load 12 at a time on desktop (4 rows of 3)

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [allGames, setAllGames] = useState<GameData[]>([])
  const [displayedGames, setDisplayedGames] = useState<GameData[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  // Sort games using the feed algorithm
  const sortedGames = useMemo(() => {
    return [...allGames].sort((a, b) => calculateFeedScore(b) - calculateFeedScore(a))
  }, [allGames])

  // Load initial games
  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true)
        const games = await getAllGames()
        setAllGames(games)
        
        // Load first batch
        const batchSize = isMobile() ? MOBILE_BATCH_SIZE : DESKTOP_BATCH_SIZE
        const sortedData = [...games].sort((a, b) => calculateFeedScore(b) - calculateFeedScore(a))
        setDisplayedGames(sortedData.slice(0, batchSize))
        setPage(1)
        setHasMore(sortedData.length > batchSize)
      } catch (error) {
        console.error('Error loading games:', error)
        setAllGames([])
      } finally {
        setLoading(false)
      }
    }
    loadGames()
  }, [])

  // Load more games when scrolling
  const loadMoreGames = useCallback(() => {
    if (loading || !hasMore) return

    const batchSize = isMobile() ? MOBILE_BATCH_SIZE : DESKTOP_BATCH_SIZE
    const startIndex = page * batchSize
    const endIndex = startIndex + batchSize
    const nextBatch = sortedGames.slice(startIndex, endIndex)

    if (nextBatch.length > 0) {
      setDisplayedGames(prev => [...prev, ...nextBatch])
      setPage(prev => prev + 1)
      setHasMore(endIndex < sortedGames.length)
    } else {
      setHasMore(false)
    }
  }, [page, sortedGames, loading, hasMore])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMoreGames()
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // Start loading a bit before reaching the bottom
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [loadMoreGames, hasMore, loading])

  // Show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleGameClick = (gameId: string) => {
    navigate(`/game/${gameId}`)
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Box sx={{ 
      maxWidth: 1400, 
      mx: 'auto', 
      pt: { xs: 1, md: 2 }, 
      pb: 2, 
      px: { xs: 1, md: 2 } 
    }}>
      {/* Floating Filter Bar (Instagram-style) */}
      <Box sx={{ 
        position: 'sticky', 
        top: { xs: 56, md: 64 }, // Account for nav height
        zIndex: 10,
        mb: 2,
        backdropFilter: 'blur(10px)',
        bgcolor: 'background.body',
        mx: -2,
        px: 2,
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
          <Chip 
            size="sm" 
            variant="solid" 
            color="primary"
            sx={{ flexShrink: 0 }}
          >
            🔥 All Games
          </Chip>
          <Chip 
            size="sm" 
            variant="soft" 
            color="danger"
            sx={{ flexShrink: 0 }}
          >
            🎯 Buzzer Beaters
          </Chip>
          <Chip 
            size="sm" 
            variant="soft" 
            color="warning"
            sx={{ flexShrink: 0 }}
          >
            ⚡ Close Games
          </Chip>
          <Chip 
            size="sm" 
            variant="soft" 
            color="success"
            sx={{ flexShrink: 0 }}
          >
            💪 High Scoring
          </Chip>
          <Chip 
            size="sm" 
            variant="soft" 
            color="neutral"
            sx={{ flexShrink: 0 }}
          >
            📅 Recent
          </Chip>
        </Stack>
      </Box>

      {/* Initial Loading State */}
      {loading && displayedGames.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress size="lg" />
            <Typography level="body-md" sx={{ color: 'text.secondary' }}>
              Loading epic games...
            </Typography>
          </Stack>
        </Box>
      )}

      {/* Games Feed - Pinterest/Instagram Style */}
      {displayedGames.length > 0 && (
        <>
          <Grid
            container
            spacing={{ xs: 1.5, sm: 2, md: 3 }}
            sx={{
              '--Grid-borderWidth': '0px',
            }}
          >
            {displayedGames.map((game, index) => (
              <Grid
                key={game.gameId}
                xs={12}
                sm={6}
                md={4}
                sx={{
                  // Staggered fade-in animation
                  animation: 'fadeInUp 0.5s ease-out',
                  animationDelay: `${(index % 12) * 0.05}s`,
                  animationFillMode: 'both',
                  '@keyframes fadeInUp': {
                    from: {
                      opacity: 0,
                      transform: 'translateY(20px)'
                    },
                    to: {
                      opacity: 1,
                      transform: 'translateY(0)'
                    }
                  }
                }}
              >
                <GameCard game={game} onClick={() => handleGameClick(game.gameId)} />
              </Grid>
            ))}
          </Grid>

          {/* Infinite Scroll Trigger & Loading Indicator */}
          <Box 
            ref={observerTarget}
            sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              py: 4,
              minHeight: '100px'
            }}
          >
            {hasMore ? (
              <Stack spacing={1} alignItems="center">
                <CircularProgress size="md" />
                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                  Loading more games...
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
                <Typography level="h4" sx={{ fontSize: '2rem' }}>
                  🎉
                </Typography>
                <Typography level="title-lg" sx={{ textAlign: 'center' }}>
                  You've watched all {allGames.length} games!
                </Typography>
                <Typography level="body-sm" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                  Check back later for more epic highlights
                </Typography>
                <Chip 
                  variant="soft" 
                  color="primary"
                  onClick={scrollToTop}
                  sx={{ cursor: 'pointer', mt: 2 }}
                >
                  ⬆️ Back to Top
                </Chip>
              </Stack>
            )}
          </Box>
        </>
      )}

      {/* Floating Scroll to Top Button (Instagram-style) */}
      {showScrollTop && (
        <IconButton
          variant="solid"
          color="primary"
          onClick={scrollToTop}
          sx={{
            position: 'fixed',
            bottom: { xs: 16, md: 24 },
            right: { xs: 16, md: 24 },
            zIndex: 1000,
            width: 56,
            height: 56,
            borderRadius: '50%',
            boxShadow: 'lg',
            animation: 'fadeIn 0.3s ease-out',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'scale(0.8)' },
              to: { opacity: 1, transform: 'scale(1)' }
            },
            '&:hover': {
              transform: 'scale(1.1)',
              transition: 'transform 0.2s'
            }
          }}
        >
          <KeyboardArrowUpIcon />
        </IconButton>
      )}

      {/* Empty State */}
      {!loading && displayedGames.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography level="h3" sx={{ mb: 2 }}>
            No games found
          </Typography>
          <Typography level="body-md" sx={{ color: 'text.secondary' }}>
            Run the index generator to load games
          </Typography>
        </Box>
      )}
    </Box>
  )
}
