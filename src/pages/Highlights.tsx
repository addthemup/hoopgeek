import { Box, Typography, Stack, Card, Chip, IconButton, Grid, CircularProgress, CardContent } from '@mui/joy'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Favorite from '@mui/icons-material/Favorite'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { getAllGames, GameData } from '../utils/gameLoader'
import SocialEngagement from './SocialEngagement'

// Detect if mobile device
const isMobile = () => {
  return window.innerWidth < 900 // MUI's md breakpoint
}

// Algorithm to calculate feed priority
const calculateFeedScore = (game: GameData): number => {
  const now = Date.now()
  const gameDate = new Date(game.game_date).getTime()
  const daysAgo = (now - gameDate) / (1000 * 60 * 60 * 24)
  
  // Adjust fun score (divide by 10) so 100 becomes 10
  const adjustedFunScore = (game.fun_score || 0) / 10
  
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
  userId?: string
  username?: string
}

function GameCard({ game, onClick, userId, username }: GameCardProps) {
  const { story_data, fun_score, fun_data, video_script } = game
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [fullGameData, setFullGameData] = useState<any>(null)
  const [isLoadingCarousel, setIsLoadingCarousel] = useState(false)
  
  // Extract data from the new structure
  const story = story_data || {}
  const lead_changes = fun_data?.lead_changes || { total: 0, last_5_minutes: 0, last_minute: 0, buzzer_beater: 0 }
  const dunk_stats = fun_data?.dunk_stats || { 'Total Dunks': 0, 'Alley Oop': 0, 'Putback': 0 }
  const deep_shots = fun_data?.deep_shots || { deep_threes: 0, four_pointers: 0 }
  
  // Safe access to team data with fallbacks
  const hasTeamData = story?.teams?.winner && story?.teams?.loser
  const winnerTricode = story?.teams?.winner?.tricode || 'UNK'
  const winnerPoints = story?.teams?.winner?.points || 0
  const loserTricode = story?.teams?.loser?.tricode || 'UNK'
  const loserPoints = story?.teams?.loser?.points || 0
  
  // Adjust fun score (divide by 10)
  const adjustedFunScore = (fun_score || 0) / 10
  
  // Determine Metacritic-style score color
  const getMetacriticColor = (score: number): string => {
    if (score >= 9.0) return '#00ce7a' // Universal acclaim (green)
    if (score >= 7.5) return '#ffbd3f' // Generally favorable (yellow)
    if (score >= 5.0) return '#ff6874' // Mixed reviews (red)
    return '#ff0000' // Generally unfavorable (dark red)
  }
  
  // Team logo URL - using ESPN's CDN
  const getTeamLogoUrl = (tricode: string) => {
    return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${tricode}.png&h=100&w=100`
  }
  
  // Load full game data on hover/focus for carousel
  const loadFullGameData = async () => {
    if (fullGameData || isLoadingCarousel) return
    
    setIsLoadingCarousel(true)
    try {
      // Use the video_script from the database directly
      if (video_script && video_script.length > 0) {
        setFullGameData({
          script: {
            video_script: video_script,
            total_plays: game.total_plays || video_script.length
          },
          gameMetadata: {
            date: game.game_date,
            arena: 'NBA Arena', // You might want to add this to your schema
            season: '2024' // You might want to add this to your schema
          }
        })
      }
    } catch (error) {
      console.error('Error loading full game data:', error)
    } finally {
      setIsLoadingCarousel(false)
    }
  }
  
  // Create slides: All video slides, first one has game metadata overlay
  const getSlides = () => {
    const slides = []
    
    // Get all video highlights from database
    if (video_script && Array.isArray(video_script)) {
      const videos = video_script
        .filter((play: any) => play.mp4 && play.description)
        .slice(0, 10) // Limit to 10 video slides
      
      videos.forEach((video, index) => {
        slides.push({
          type: 'video',
          isFirstSlide: index === 0, // Mark first slide for special overlay
          gameMetadata: index === 0 ? {
            date: game.game_date,
            arena: 'NBA Arena',
            season: '2024',
            homeTeam: {
              quarters: [0, 0, 0, 0] // You might want to add this to your schema
            },
            awayTeam: {
              quarters: [0, 0, 0, 0] // You might want to add this to your schema
            }
          } : null,
          ...video
        })
      })
    } else if (fullGameData?.script?.video_script && Array.isArray(fullGameData.script.video_script)) {
      // Fallback to full game data
      const videos = fullGameData.script.video_script
        .filter((play: any) => play.mp4 && play.description)
        .slice(0, 10)
      
      videos.forEach((video, index) => {
        slides.push({
          type: 'video',
          isFirstSlide: index === 0,
          gameMetadata: index === 0 ? fullGameData?.gameMetadata : null,
          ...video
        })
      })
    }
    
    return slides
  }
  
  const slides = getSlides()
  const hasMultipleSlides = slides.length > 1
  const currentSlideData = slides[currentSlide]
  
  // Swipe handlers
  const minSwipeDistance = 50
  
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(0)
    setTouchStart(e.targetTouches[0].clientX)
  }
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe && currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    }
    if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }
  
  const nextSlide = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    }
  }
  
  const prevSlide = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }
  
  return (
    <Card 
      variant="outlined"
      onMouseEnter={loadFullGameData}
      sx={{ 
        width: '100%',
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderRadius: 0,
        border: '3px solid var(--ink-black)',
        boxShadow: '4px 4px 0px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        '&:hover': { 
          transform: 'translateY(-2px)',
          boxShadow: '6px 6px 0px rgba(0,0,0,0.2)'
        }
      }}
    >
      {/* Instagram-style Carousel */}
      <Box 
        sx={{ 
          position: 'relative',
          width: '100%',
          height: 0,
          paddingBottom: '125%', // 4:5 aspect ratio (Instagram portrait)
          overflow: 'hidden',
          margin: 0,
          backgroundColor: '#000'
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Video rendering */}
        {currentSlideData?.mp4 ? (
          <video
            key={currentSlideData.mp4}
            autoPlay
            loop
            muted
            playsInline
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              margin: 0,
              padding: 0
            }}
            onClick={onClick}
          >
            <source src={currentSlideData.mp4} type="video/mp4" />
          </video>
        ) : (
          <Box
            onClick={onClick}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
              color: '#fff'
            }}
          >
            <Typography level="body-lg">Loading...</Typography>
          </Box>
        )}
        
        {/* First slide special overlay with game metadata */}
        {currentSlideData?.isFirstSlide && currentSlideData?.gameMetadata && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)',
              padding: '4rem 1.5rem 3rem',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          >
            {/* Date and Arena */}
            <Stack spacing={0.5} sx={{ mb: 2 }}>
              <Typography 
                level="body-sm" 
                sx={{ 
                  textAlign: 'center',
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  fontWeight: 700,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: '0.75rem'
                }}
              >
                {new Date(currentSlideData.gameMetadata.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Typography>
              <Typography 
                level="body-xs" 
                sx={{ 
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.85)',
                  fontStyle: 'italic',
                  fontSize: '0.75rem'
                }}
              >
                {currentSlideData.gameMetadata.arena}
              </Typography>
            </Stack>
            
            {/* Quarter Scores */}
            {currentSlideData.gameMetadata.homeTeam && currentSlideData.gameMetadata.awayTeam && (
              <Box 
                sx={{ 
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: '4px',
                  padding: 1.5,
                  backdropFilter: 'blur(8px)'
                }}
              >
                <Typography 
                  level="body-xs" 
                  sx={{ 
                    textAlign: 'center',
                    fontWeight: 700,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.7rem'
                  }}
                >
                  Score by Quarter
                </Typography>
                <Grid container spacing={1}>
                  {[0, 1, 2, 3].map(qtr => (
                    <Grid key={qtr} xs={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '0.7rem'
                          }}
                        >
                          Q{qtr + 1}
                        </Typography>
                        <Typography 
                          level="body-sm" 
                          sx={{ 
                            fontWeight: 700,
                            color: '#fff',
                            fontFamily: '"Libre Baskerville", Georgia, serif'
                          }}
                        >
                          {currentSlideData.gameMetadata.homeTeam.quarters[qtr]}-{currentSlideData.gameMetadata.awayTeam.quarters[qtr]}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        )}
        
        {/* Metacritic-style score badge - top left (only for fun content) */}
        {game.content_type === 'fun' && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              backgroundColor: getMetacriticColor(adjustedFunScore),
              color: '#fff',
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: '"Libre Baskerville", Georgia, serif',
              fontWeight: 700,
              fontSize: '1.5rem',
              border: '3px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              zIndex: 3
            }}
          >
            {Math.round(adjustedFunScore * 10)}
          </Box>
        )}
        
        {/* Instagram-style carousel indicators (dots) - top center */}
        {hasMultipleSlides && (
          <Stack 
            direction="row" 
            spacing={0.5}
            sx={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 3
            }}
          >
            {slides.map((_, index) => (
              <Box
                key={index}
                sx={{
                  width: index === currentSlide ? 24 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: index === currentSlide ? '#fff' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentSlide(index)
                }}
              />
            ))}
          </Stack>
        )}
        
        {/* Navigation arrows - left/right */}
        {hasMultipleSlides && (
          <>
            {currentSlide > 0 && (
              <IconButton
                onClick={prevSlide}
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  minWidth: 32,
                  minHeight: 32,
                  borderRadius: '50%',
                  zIndex: 3,
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.8)'
                  }
                }}
              >
                <ChevronLeftIcon />
              </IconButton>
            )}
            {currentSlide < slides.length - 1 && (
              <IconButton
                onClick={nextSlide}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  minWidth: 32,
                  minHeight: 32,
                  borderRadius: '50%',
                  zIndex: 3,
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.8)'
                  }
                }}
              >
                <ChevronRightIcon />
              </IconButton>
            )}
          </>
        )}
        
        {/* Bottom overlay with team scores and play description */}
        <Box
          onClick={onClick}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
            padding: '3rem 1rem 1rem',
            zIndex: 2
          }}
        >
          {/* Team matchup */}
          {hasTeamData ? (
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1, mb: 1 }}>
              {/* Winner */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box
                  component="img"
                  src={getTeamLogoUrl(winnerTricode)}
                  alt={winnerTricode}
                  sx={{ width: 28, height: 28, objectFit: 'contain' }}
                />
                <Box>
                  <Typography level="body-xs" sx={{ color: '#fff', opacity: 0.8, fontSize: '0.7rem' }}>
                    {winnerTricode}
                  </Typography>
                  <Typography level="h4" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}>
                    {winnerPoints}
                  </Typography>
                </Box>
              </Stack>
              
              <Typography level="body-xs" sx={{ color: '#fff', opacity: 0.6, fontWeight: 600, px: 1 }}>
                VS
              </Typography>
              
              {/* Loser */}
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box>
                  <Typography level="body-xs" sx={{ color: '#fff', opacity: 0.7, fontSize: '0.7rem', textAlign: 'right' }}>
                    {loserTricode}
                  </Typography>
                  <Typography level="h4" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1, opacity: 0.7, textAlign: 'right' }}>
                    {loserPoints}
                  </Typography>
                </Box>
                <Box
                  component="img"
                  src={getTeamLogoUrl(loserTricode)}
                  alt={loserTricode}
                  sx={{ width: 28, height: 28, objectFit: 'contain', opacity: 0.7 }}
                />
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" justifyContent="center" sx={{ px: 1, mb: 1 }}>
              <Typography level="body-sm" sx={{ color: '#fff', opacity: 0.7 }}>
                Game Data Loading...
              </Typography>
            </Stack>
          )}
          
          {/* Play description */}
          {currentSlideData?.description && !currentSlideData?.isFirstSlide && (
            <Typography 
              level="body-sm"
              sx={{ 
                color: '#fff',
                textAlign: 'center',
                fontSize: '0.85rem',
                fontFamily: '"Crimson Text", Georgia, serif',
                px: 2,
                lineHeight: 1.3,
                mb: 1
              }}
            >
              {currentSlideData.description}
            </Typography>
          )}
          
          {/* Game highlight icons - overlayed on video */}
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
            {lead_changes.buzzer_beater > 0 && (
              <Box 
                title="Buzzer Beater"
                sx={{ 
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                }}
              >
                🎯
              </Box>
            )}
            {lead_changes.total >= 10 && (
              <Box 
                title={`${lead_changes.total} Lead Changes`}
                sx={{ 
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                }}
              >
                ↔️
              </Box>
            )}
            {dunk_stats['Total Dunks'] >= 15 && (
              <Box 
                title={`${dunk_stats['Total Dunks']} Dunks`}
                sx={{ 
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                }}
              >
                💪
              </Box>
            )}
            {deep_shots.four_pointers > 0 && (
              <Box 
                title="4-Pointer"
                sx={{ 
                  fontSize: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                }}
              >
                🏀
              </Box>
            )}
            
            {/* Social Engagement - inline with icons */}
            <SocialEngagement
              contentId={game.id}
              userId={userId || 'anonymous'}
              username={username || 'Anonymous'}
              initialLikes={game.likes_count || 0}
              initialComments={game.comments_count || 0}
              initialShares={game.shares_count || 0}
              compact={true}
            />
          </Stack>
        </Box>
      </Box>
      
      {/* Instagram-style Social Engagement Section */}
      <Box sx={{ p: 2, backgroundColor: 'background.body' }}>
        <SocialEngagement
          contentId={game.id}
          userId={userId || 'anonymous'}
          username={username || 'Anonymous'}
          initialLikes={game.likes_count || 0}
          initialComments={game.comments_count || 0}
          initialShares={game.shares_count || 0}
          compact={false}
        />
        
        {/* Game Stats Summary */}
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} justifyContent="center">
            {lead_changes.total >= 10 && (
              <Chip size="sm" color="warning" variant="soft">
                {lead_changes.total} Lead Changes
              </Chip>
            )}
            {dunk_stats['Total Dunks'] >= 15 && (
              <Chip size="sm" color="success" variant="soft">
                {dunk_stats['Total Dunks']} Dunks
              </Chip>
            )}
            {deep_shots.four_pointers > 0 && (
              <Chip size="sm" color="primary" variant="soft">
                4-Pointer Alert!
              </Chip>
            )}
          </Stack>
        </Box>
      </Box>
    </Card>
  )
}

// Batch sizes based on viewport
const MOBILE_BATCH_SIZE = 3  // Load 3 at a time on mobile (smoother than 1)
const DESKTOP_BATCH_SIZE = 12 // Load 12 at a time on desktop (4 rows of 3)

export default function Highlights() {
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
      {/* Page Title */}
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography 
          level="h2" 
          sx={{ 
            fontFamily: '"Libre Baskerville", Georgia, serif',
            fontWeight: 700,
            mb: 1
          }}
        >
          🎬 Game Highlights
        </Typography>
        <Typography level="body-md" color="neutral">
          Relive the most epic moments from the NBA season
        </Typography>
      </Box>

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
                key={game.game_id}
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
                <GameCard 
                  game={game} 
                  onClick={() => handleGameClick(game.game_id)} 
                  userId={user?.id}
                  username={user?.email}
                />
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

