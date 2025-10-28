import { Box, Typography, Stack, Card, Chip, IconButton, CircularProgress, CardContent } from '@mui/joy'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect, useRef, useCallback } from 'react'
import Favorite from '@mui/icons-material/Favorite'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { supabase } from '../utils/supabase'
import SocialEngagement from './SocialEngagement'
import CommentsDrawer from '../components/CommentsDrawer'
import PostsStories from '../components/PostsStories'
import PlayerStatsCircle from '../components/PlayerStatsCircle'
import { useEngagementTracking, useVideoTracking } from '../hooks/useEngagementTracking'

// Feed post interface
interface FeedPost {
  id: string
  post_type: string
  status: string
  title: string
  description: string
  game_id: string
  game_date: string
  team_tricodes: string[] | null
  player_ids: number[] | null
  slides: any // JSON string that needs to be parsed
  metadata: any // JSON string that needs to be parsed
  thumbnail_url: string | null
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  published_at: string
  created_at: string
  updated_at: string
}

// Detect if mobile device
const isMobile = () => {
  return window.innerWidth < 900 // MUI's md breakpoint
}

// Viewport Detector - Only renders the post that's currently in view
interface LazyPostWrapperProps {
  children: React.ReactNode
  postId: string
  minHeight?: string
  isCurrentlyViewing: boolean // NEW: Only render if this is the active post
}

function LazyPostWrapper({ children, postId, minHeight = '600px', isCurrentlyViewing }: LazyPostWrapperProps) {
  const [hasBeenViewed, setHasBeenViewed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasBeenViewed(true)
          }
        })
      },
      {
        root: null,
        rootMargin: '100px', // Start preparing 100px before viewport
        threshold: 0.5 // 50% of post must be visible
      }
    )
    
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    
    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current)
      }
    }
  }, [])
  
  // Only render actual content if this is the currently viewing post
  const shouldRenderContent = isCurrentlyViewing && hasBeenViewed
  
  return (
    <Box 
      ref={containerRef}
      sx={{ minHeight: shouldRenderContent ? 'auto' : minHeight }}
    >
      {shouldRenderContent ? children : (
        <Card 
          variant="outlined"
          sx={{
            height: minHeight,
            bgcolor: 'background.level1',
            border: { xs: 'none', md: '3px solid' },
            borderColor: 'divider',
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 0, md: 1 },
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            }
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            bgcolor: '#000',
            width: '100%',
            height: '100%',
            borderRadius: { xs: 0, md: '12px' },
            justifyContent: 'center'
          }}>
            <CircularProgress size="lg" sx={{ color: '#fff' }} />
            <Typography level="body-sm" sx={{ color: '#fff', opacity: 0.7, fontFamily: 'serif' }}>
              {hasBeenViewed ? 'Loading...' : 'Scroll to view'}
            </Typography>
          </Box>
        </Card>
      )}
    </Box>
  )
}

interface GameCardProps {
  game: FeedPost
  userId?: string
  username?: string
  onView?: (contentId: string) => void
  onComplete?: () => void
  onSlideChange?: (postId: string, slideIndex: number, totalSlides: number) => void
  onVideoProgress?: (seconds: number) => void
  isCurrentlyViewing?: boolean
}

function GameCard({ game, userId, username, onView, onComplete, onSlideChange, onVideoProgress, isCurrentlyViewing = true }: GameCardProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [fullGameData, setFullGameData] = useState<any>(null)
  const [isLoadingCarousel, setIsLoadingCarousel] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [hasMarkedViewed, setHasMarkedViewed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  // Track video watch time
  useVideoTracking(videoRef, onVideoProgress)
  
  // Auto-pause video when not in view
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    if (!isCurrentlyViewing && !video.paused) {
      video.pause()
      console.log('⏸️ Paused video (not in view):', game.id)
    } else if (isCurrentlyViewing && video.paused) {
      video.play().catch(err => {
        console.log('▶️ Could not auto-play:', err)
      })
    }
  }, [isCurrentlyViewing, game.id])
  
  // Mark as viewed when user interacts with the post
  useEffect(() => {
    if (!hasMarkedViewed && onView && game.id) {
      // Mark as viewed after a short delay (user has seen it)
      const timer = setTimeout(() => {
        onView(game.id)
        setHasMarkedViewed(true)
      }, 2000) // 2 seconds
      
      return () => clearTimeout(timer)
    }
  }, [game.id, hasMarkedViewed, onView])
  
  // Parse JSON fields
  const parsedSlides = typeof game.slides === 'string' ? JSON.parse(game.slides) : (game.slides || [])
  const parsedMetadata = typeof game.metadata === 'string' ? JSON.parse(game.metadata) : (game.metadata || {})
  
  // Extract data from metadata
  const story_data = parsedMetadata.story_data || {}
  const fun_data = parsedMetadata.fun_data || {}
  const fun_score = fun_data.fun_score || 0
  
  // Extract data from the structure
  const story = story_data as any || {}
  const lead_changes = (fun_data as any)?.lead_changes || { total: 0, last_5_minutes: 0, last_minute: 0, buzzer_beater: 0 }
  const dunk_stats = (fun_data as any)?.dunk_stats || { 'Total Dunks': 0, 'Alley Oop': 0, 'Putback': 0 }
  const deep_shots = (fun_data as any)?.deep_shots || { deep_threes: 0, four_pointers: 0 }
  
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
      // Use the slides from the database directly
      if (parsedSlides && parsedSlides.length > 0) {
        setFullGameData({
          script: {
            video_script: parsedSlides,
            total_plays: parsedSlides.length
          },
          gameMetadata: {
            date: game.game_date,
            arena: parsedMetadata.arena || 'NBA Arena',
            season: parsedMetadata.season || '2024-25'
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
    
    console.log('🎬 GameCard Debug:', {
      game_id: game.game_id,
      post_type: game.post_type,
      slides_length: parsedSlides?.length,
      slides_sample: parsedSlides?.[0],
      first_slide_metadata: parsedSlides?.[0]?.metadata
    })
    
    // For feed posts, slides contains the video array
    if (parsedSlides && Array.isArray(parsedSlides)) {
      parsedSlides.forEach((slide: any, index) => {
          console.log(`📽️ Processing slide ${index}:`, slide)
        // Feed post slides have video_url
          const videoUrl = slide.video_url || slide.mp4
          if (videoUrl) {
            console.log(`✅ Found video URL: ${videoUrl}`)
            slides.push({
              type: 'video',
              isFirstSlide: index === 0,
              gameMetadata: index === 0 ? {
                date: game.game_date,
              arena: parsedMetadata.arena || 'NBA Arena',
              season: parsedMetadata.season || '2024-25',
                homeTeam: { quarters: [0, 0, 0, 0] },
                awayTeam: { quarters: [0, 0, 0, 0] }
              } : null,
              mp4: videoUrl,
              description: slide.description || slide.caption || '',
              ...slide
            })
          } else {
            console.log(`❌ No video URL found in slide ${index}`)
          }
        })
      }
      console.log(`📊 Total slides created: ${slides.length}`)
    
    return slides
  }
  
  const slides = getSlides()
  const hasMultipleSlides = slides.length > 1
  const currentSlideData = slides[currentSlide]
  
  // Notify parent of slide changes
  useEffect(() => {
    if (onSlideChange && slides.length > 0) {
      onSlideChange(game.id, currentSlide, slides.length)
    }
  }, [currentSlide, slides.length, game.id, onSlideChange])
  
  // Auto-advance carousel when video ends
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleVideoEnd = () => {
      if (currentSlide < slides.length - 1) {
        // Move to next slide
        setCurrentSlide(prev => prev + 1)
      } else {
        // Last slide ended - move to next post
        if (onComplete) {
          setTimeout(() => {
            onComplete()
          }, 500) // Small delay before moving to next post
        }
      }
    }

    video.addEventListener('ended', handleVideoEnd)
    return () => video.removeEventListener('ended', handleVideoEnd)
  }, [currentSlide, slides.length, onComplete])
  
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
        maxWidth: '100%',
        borderRadius: 0, // Square card
        border: { xs: 'none', md: '3px solid var(--ink-black)' }, // No border on mobile
        boxShadow: 'none',
        overflow: 'visible', // Allow rounded video to show
        mx: 0,
        boxSizing: 'border-box',
        bgcolor: 'transparent',
        p: { xs: 0, md: 1 }, // No padding on mobile for full-screen feel
        display: 'flex',
        flexDirection: 'column',
      }}
    >
    
      {/* Instagram-style Carousel */}
      <Box 
        sx={{ 
          position: 'relative',
          width: '100%',
          height: { xs: 'calc(100vh - 180px)', md: 0 }, // Full height on mobile minus nav/header
          paddingBottom: { xs: 0, md: '56.25%' }, // 16:9 aspect ratio on desktop only
          overflow: 'hidden',
          margin: 0,
          backgroundColor: '#000',
          borderRadius: { xs: 0, md: '4px' }, // No border radius on mobile
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Video rendering */}
        {currentSlideData?.mp4 ? (
          <video
            ref={videoRef}
            key={currentSlideData.mp4}
            autoPlay
            muted
            playsInline
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top',
              marginTop: 20,
              marginBottom: 100,
              marginLeft: 0,
              padding: 0,
              borderRadius: '12px', // Rounded video
            }}
          >
            <source src={currentSlideData.mp4} type="video/mp4" />
          </video>
        ) : slides.length === 0 ? (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
              color: '#fff',
              p: 2,
              borderRadius: '12px',
            }}
          >
            <Typography level="body-lg" sx={{ mb: 1 }}>No video content</Typography>
            <Typography level="body-sm" sx={{ opacity: 0.7, textAlign: 'center' }}>
              Check browser console for debug info
            </Typography>
          </Box>
        ) : (
          <Box
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
              color: '#fff',
              borderRadius: '12px',
            }}
          >
            <Typography level="body-lg">Loading...</Typography>
          </Box>
        )}
        
        {/* Player avatar with stats - top left */}
        {currentSlideData?.metadata?.personId && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 3,
              pointerEvents: 'none'
            }}
          >
            <PlayerStatsCircle
              playerId={currentSlideData.metadata.personId}
              gameId={game.game_id}
              playerName={currentSlideData.metadata.playerNameI || currentSlideData.metadata.playerName}
            />
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
        
        {/* Bottom overlay with social engagement only */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)',
            padding: '2rem 1rem 0.75rem',
            zIndex: 2,
            borderRadius: '0 0 12px 12px', // Rounded bottom corners
          }}
        >
          {/* Social engagement - centered */}
          <Stack direction="row" alignItems="center" justifyContent="center" sx={{ mt: 1 }}>
            <SocialEngagement
              contentId={game.id}
              userId={userId || 'anonymous'}
              username={username || 'Anonymous'}
              initialLikes={game.likes_count || 0}
              initialComments={game.comments_count || 0}
              initialShares={game.shares_count || 0}
              initialViews={game.views_count || 0}
              compact={true}
              onCommentClick={() => setCommentsOpen(true)}
            />
          </Stack>
        </Box>
        
        {/* Comments Drawer - slides up from bottom */}
        <CommentsDrawer
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          contentId={game.id}
          userId={userId || 'anonymous'}
          username={username || 'Anonymous'}
        />
      </Box>
      
      {/* Bottom separator on mobile between posts */}
      <Box sx={{ 
        display: { xs: 'block', md: 'none' },
        height: '8px',
        bgcolor: 'background.level2',
      }} />
    </Card>
  )
}

// Batch sizes based on viewport
const MOBILE_BATCH_SIZE = 3  // Load 3 at a time on mobile (smoother than 1)
const DESKTOP_BATCH_SIZE = 12 // Load 12 at a time on desktop (4 rows of 3)

export default function Highlights() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [displayedPosts, setDisplayedPosts] = useState<FeedPost[]>([])
  const [allPosts, setAllPosts] = useState<FeedPost[]>([]) // Store all posts for shuffling
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isShuffling, setIsShuffling] = useState(false) // New loading state for shuffle
  const [hasMore, setHasMore] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [currentViewingPost, setCurrentViewingPost] = useState<string | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)
  const [totalSlides, setTotalSlides] = useState<number>(0)
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null) // Track fun_score playlist
  
  // Detect which post is currently in viewport
  useEffect(() => {
    if (displayedPosts.length === 0) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Find the post ID from the ref map
            const postId = Array.from(postRefs.current.entries()).find(
              ([_, element]) => element === entry.target
            )?.[0]
            
            if (postId && postId !== currentViewingPost) {
              console.log('📺 Now viewing post:', postId)
              setCurrentViewingPost(postId)
            }
          }
        })
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.5 // Post must be 50%+ visible
      }
    )
    
    // Observe all post refs
    postRefs.current.forEach((element) => {
      observer.observe(element)
    })
    
    // Set first post as viewing on mount
    if (!currentViewingPost && displayedPosts.length > 0) {
      setCurrentViewingPost(displayedPosts[0].id)
    }
    
    return () => {
      observer.disconnect()
    }
  }, [displayedPosts, currentViewingPost])
  
  // 📊 ENGAGEMENT TRACKING - For Investor Analytics
  const {
    startSession,
    endSession,
    startPostView,
    updatePostView,
    endPostView,
    trackEvent,
    sessionMetrics,
    isTracking
  } = useEngagementTracking(user?.id)
  
  // Start session on mount
  useEffect(() => {
    if (user?.id) {
      startSession('/highlights')
      console.log('📊 Engagement tracking started for user:', user.id)
    }
    
    return () => {
      if (user?.id) {
        endSession('/highlights', 'navigation_away')
      }
    }
  }, [user?.id, startSession, endSession])
  
  // Log session metrics for debugging
  useEffect(() => {
    if (isTracking) {
      console.log('📈 Session Metrics:', sessionMetrics)
    }
  }, [sessionMetrics, isTracking])

  // Mark post as viewed (increment views count)
  const markPostAsViewed = useCallback(async (postId: string) => {
    if (!user) return
    
    try {
      // Get current views count and increment it
      const { data: currentPost } = await supabase
        .from('feed_posts')
        .select('views_count')
        .eq('id', postId)
        .single()
      
      if (currentPost) {
        const { error } = await supabase
          .from('feed_posts')
          .update({ views_count: (currentPost.views_count || 0) + 1 })
          .eq('id', postId)
        
        if (error) throw error
      }
      
      console.log('✅ Marked post as viewed:', postId)
    } catch (error) {
      console.error('❌ Error marking post as viewed:', error)
    }
  }, [user])

  // Handle slide change tracking
  const handleSlideChange = useCallback((postId: string, slideIndex: number, totalSlides: number) => {
    setCurrentViewingPost(postId)
    setCurrentSlideIndex(slideIndex)
    setTotalSlides(totalSlides)
    
    // Track post view start (first slide)
    if (slideIndex === 0 && user?.id) {
      startPostView(postId, totalSlides, false)
    }
    
    // Update progress when slides change
    if (user?.id && slideIndex > 0) {
      updatePostView(slideIndex + 1) // +1 because slides are 0-indexed
      
      // Track slide change event
      trackEvent('slide_change', postId, {
        from_slide: slideIndex - 1,
        to_slide: slideIndex,
        total_slides: totalSlides
      })
    }
  }, [user?.id, startPostView, updatePostView, trackEvent])
  
  // Handle video progress tracking
  const handleVideoProgress = useCallback((seconds: number) => {
    if (user?.id && seconds > 0) {
      updatePostView(currentSlideIndex + 1, seconds)
      
      // Track video progress event every 10 seconds
      if (seconds % 10 === 0) {
        trackEvent('video_progress', currentViewingPost || undefined, {
          watch_seconds: seconds,
          slide_index: currentSlideIndex
        })
      }
    }
  }, [user?.id, currentSlideIndex, currentViewingPost, updatePostView, trackEvent])

  // Handle post complete - scroll to next post with better centering
  const handlePostComplete = useCallback((completedPostId: string) => {
    // End current post view and track completion
    if (user?.id) {
      endPostView('auto_advance')
      trackEvent('post_complete', completedPostId, {
        completed_at: new Date().toISOString(),
        slides_viewed: totalSlides
      })
    }
    
    const currentIndex = displayedPosts.findIndex(p => p.id === completedPostId)
    if (currentIndex === -1 || currentIndex >= displayedPosts.length - 1) return
    
    const nextPost = displayedPosts[currentIndex + 1]
    const nextPostElement = postRefs.current.get(nextPost.id)
    
    if (nextPostElement) {
      // Get the height of the fixed header (nav + avatar bar)
      const headerHeight = window.innerWidth < 900 ? 117 : 126
      
      // Calculate the position to scroll to
      const elementRect = nextPostElement.getBoundingClientRect()
      const absoluteElementTop = elementRect.top + window.pageYOffset
      const scrollToPosition = absoluteElementTop - headerHeight
      
      // Smooth scroll to position
      window.scrollTo({
        top: scrollToPosition,
        behavior: 'smooth'
      })
    }
  }, [displayedPosts, user?.id, endPostView, trackEvent, totalSlides])
  
  // Fisher-Yates shuffle algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
  
  // Shuffle and reorganize posts when avatar is clicked
  const scrollToPost = useCallback(async (postId: string) => {
    // Track avatar click and end current post view
    if (user?.id) {
      endPostView('click_away')
      trackEvent('post_interaction', postId, {
        action: 'avatar_click',
        clicked_from_stories: true
      })
    }
    
    setIsShuffling(true)
    
    // Find the clicked post
    const clickedPost = allPosts.find(p => p.id === postId)
    if (!clickedPost) return
    
    // Check if it's a fun_score post
    const isFunScore = clickedPost.post_type === 'fun_score'
    
    let newPostOrder: FeedPost[] = []
    
    if (isFunScore && clickedPost.game_id) {
      // FUN SCORE PLAYLIST: Group all posts with same game_id
      const playlistPosts = allPosts.filter(p => p.game_id === clickedPost.game_id)
      const otherPosts = allPosts.filter(p => p.game_id !== clickedPost.game_id)
      
      // Shuffle the playlist posts (keep them together but randomize their order)
      const shuffledPlaylist = shuffleArray(playlistPosts)
      
      // Put fun_score post first, then other playlist posts, then shuffled remaining
      const funScorePost = shuffledPlaylist.find(p => p.id === postId)
      const otherPlaylistPosts = shuffledPlaylist.filter(p => p.id !== postId)
      const shuffledOthers = shuffleArray(otherPosts)
      
      newPostOrder = funScorePost 
        ? [funScorePost, ...otherPlaylistPosts, ...shuffledOthers]
        : shuffledPlaylist
      
      setActivePlaylist(clickedPost.game_id)
    } else {
      // REGULAR POST: Put clicked post first, shuffle the rest
      const otherPosts = allPosts.filter(p => p.id !== postId)
      const shuffledOthers = shuffleArray(otherPosts)
      
      newPostOrder = [clickedPost, ...shuffledOthers]
      setActivePlaylist(null)
    }
    
    // Simulate loading time for smooth transition
    await new Promise(resolve => setTimeout(resolve, 300))
    
    setDisplayedPosts(newPostOrder.slice(0, 20)) // Show first 20
    setIsShuffling(false)
    
    // Start tracking the clicked post (will be marked as clicked from avatar)
    if (user?.id && clickedPost) {
      const slides = typeof clickedPost.slides === 'string' 
        ? JSON.parse(clickedPost.slides) 
        : (clickedPost.slides || [])
      startPostView(postId, Array.isArray(slides) ? slides.length : 0, true)
    }
    
    // Scroll to top after shuffle
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [allPosts, user?.id, endPostView, trackEvent, startPostView])

  // Load feed posts
  const loadPosts = useCallback(async (offset: number) => {
    try {
      setLoading(true)
      const batchSize = isMobile() ? MOBILE_BATCH_SIZE : DESKTOP_BATCH_SIZE
      
      // Fetch published feed posts
      const { data, error } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .range(offset, offset + batchSize - 1)
      
      if (error) throw error
      return (data || []) as FeedPost[]
    } catch (error) {
      console.error('❌ Error loading posts:', error)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Load ALL posts on mount and shuffle
  useEffect(() => {
    const loadAllPosts = async () => {
      try {
        setLoading(true)
        
        // Fetch ALL published posts
        const { data, error } = await supabase
          .from('feed_posts')
          .select('*')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
        
        if (error) throw error
        
        const posts = (data || []) as FeedPost[]
        
        // Shuffle on initial load
        const shuffled = shuffleArray(posts)
        
        setAllPosts(posts)
        setDisplayedPosts(shuffled.slice(0, 20)) // Show first 20
        setHasMore(shuffled.length > 20)
      } catch (error) {
        console.error('❌ Error loading posts:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadAllPosts()
  }, [])

  // Load more posts when scrolling
  const loadMorePosts = useCallback(async () => {
    if (loading || !hasMore) return

    const batchSize = isMobile() ? MOBILE_BATCH_SIZE : DESKTOP_BATCH_SIZE
    const offset = page * batchSize
    const nextBatch = await loadPosts(offset)

    if (nextBatch.length > 0) {
      setDisplayedPosts(prev => [...prev, ...nextBatch])
      setPage(prev => prev + 1)
      setHasMore(nextBatch.length === batchSize)
    } else {
      setHasMore(false)
    }
  }, [page, loading, hasMore, loadPosts])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMorePosts()
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
  }, [loadMorePosts, hasMore, loading])

  // Show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Box sx={{ 
      bgcolor: 'background.body',
      minHeight: '100vh',
      overflowX: 'hidden', // Prevent horizontal scroll
      width: '100%',
    }}>
      {/* Posts Stories */}
      <PostsStories 
        posts={displayedPosts}
        currentViewingPost={currentViewingPost || undefined}
        currentSlideIndex={currentSlideIndex}
        totalSlides={totalSlides}
        onAvatarClick={scrollToPost}
      />

      {/* Main Feed Container - Fixed width, loads structure first */}
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 }, // 15% wider
        minWidth: { xs: '100%', sm: 805, md: 1035 }, // Fixed width
        mx: 'auto', 
        pt: { xs: '117px', md: '126px' },
        pb: { xs: 0, md: 2 }, // No bottom padding on mobile 
        px: { xs: 0, sm: 2, md: 2 }, // No horizontal padding on mobile for full-width posts
        overflowX: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
      }}>
      {/* Initial Loading State - Show skeleton grid immediately */}
        {loading && displayedPosts.length === 0 && (
        <Box sx={{ px: { xs: 0, md: 0 } }}>
          <Stack spacing={{ xs: 4, md: 5 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Card
                key={i}
                variant="outlined"
                sx={{
                  height: { xs: 500, md: 600 },
                  bgcolor: 'background.level1',
                  border: '3px solid',
                  borderColor: 'divider',
                  borderRadius: 0,
                  boxSizing: 'border-box',
                  width: '100%',
                  maxWidth: '100%',
                  p: 1,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 0.6 },
                    '50%': { opacity: 1 },
                  }
                }}
              >
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '100%',
                  flexDirection: 'column',
                  gap: 2,
                  bgcolor: 'background.level2',
                  borderRadius: '12px',
                }}>
                  <CircularProgress size="lg" />
                  <Typography level="body-sm" sx={{ fontFamily: 'serif', color: 'text.secondary' }}>
                    Loading highlights...
                  </Typography>
                </Box>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

        {/* Shuffling State - Skeleton Loader */}
        {isShuffling && (
          <Box sx={{ px: { xs: 0, md: 0 }, position: 'relative', zIndex: 10 }}>
            <Stack spacing={{ xs: 4, md: 5 }}>
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  variant="outlined"
                  sx={{
                    height: { xs: 500, md: 600 },
                    bgcolor: '#F5F1E8',
                    border: '3px solid #000',
                    borderRadius: 0,
                    boxSizing: 'border-box',
                    width: '100%',
                    maxWidth: '100%',
                    p: 1,
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 0.6 },
                      '50%': { opacity: 1 },
                    }
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%',
                    flexDirection: 'column',
                    gap: 2,
                    bgcolor: '#000',
                    borderRadius: '12px',
                  }}>
                    <CircularProgress size="lg" sx={{ color: '#fff' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif', color: '#fff' }}>
                      Reshuffling deck...
                    </Typography>
                  </Box>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Posts Feed */}
        {displayedPosts.length > 0 && !isShuffling && (
        <>
          <Stack
            spacing={{ xs: 0, md: 5 }} // No spacing on mobile for full-screen posts
            sx={{
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              px: 0,
            }}
          >
              {displayedPosts.map((post, index) => {
                // Check if this post is part of active playlist
                const isInPlaylist = activePlaylist && post.game_id === activePlaylist
                const prevPost = index > 0 ? displayedPosts[index - 1] : null
                const isPrevInPlaylist = prevPost && activePlaylist && prevPost.game_id === activePlaylist
                const showPathway = isInPlaylist && isPrevInPlaylist
                const isCurrentPost = currentViewingPost === post.id
                
                return (
                  <Box key={post.id}>
                    {/* Visual Pathway Connector - Motion Blur Effect */}
                    {showPathway && (
                      <Box
                        sx={{
                          height: { xs: 24, md: 32 },
              mx: 'auto',
                          my: { xs: -1, md: -1.5 },
              width: '100%',
                          maxWidth: '100%',
                          position: 'relative',
                          zIndex: 5,
                          overflow: 'hidden',
                        }}
                      >
                        {/* Base white pathway */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: 0,
                            right: 0,
                            height: { xs: 4, md: 6 },
                            transform: 'translateY(-50%)',
                            background: 'linear-gradient(90deg, transparent, #FFFFFF 10%, #FFFFFF 90%, transparent)',
                            opacity: 1,
                          }}
                        />
                        
                        {/* Motion blur layers */}
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Box
                            key={i}
                            sx={{
                              position: 'absolute',
                              top: '50%',
                              left: 0,
                              right: 0,
                              height: { xs: 8 + i * 2, md: 12 + i * 3 },
                              transform: 'translateY(-50%)',
                              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15) 15%, rgba(255, 255, 255, 0.15) 85%, transparent)',
                              opacity: 1 - i * 0.15,
                              filter: `blur(${i * 2}px)`,
                            }}
                          />
                        ))}
                        
                        {/* Gold accent glow */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: 0,
                            right: 0,
                            height: { xs: 16, md: 24 },
                            transform: 'translateY(-50%)',
                            background: 'linear-gradient(90deg, transparent, rgba(255, 199, 44, 0.3) 20%, rgba(255, 199, 44, 0.3) 80%, transparent)',
                            filter: 'blur(8px)',
                            animation: 'pathwayPulse 2s ease-in-out infinite',
                            '@keyframes pathwayPulse': {
                              '0%, 100%': { opacity: 0.4 },
                              '50%': { opacity: 0.7 },
                            }
                          }}
                        />
                      </Box>
                    )}
                    
                    <Box
                      ref={(el) => {
                        if (el) {
                          postRefs.current.set(post.id, el as unknown as HTMLDivElement)
                        } else {
                          postRefs.current.delete(post.id)
                        }
                      }}
                sx={{
                  // Staggered fade-in animation
                  animation: 'fadeInUp 0.5s ease-out',
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'both',
                        // Playlist glow effect
                        ...(isInPlaylist && {
                          position: 'relative',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: -4,
                            left: -4,
                            right: -4,
                            bottom: -4,
                            background: 'linear-gradient(45deg, #FFC72C, #FFD700)',
                            borderRadius: '12px',
                            opacity: 0.3,
                            zIndex: -1,
                            animation: 'glow 2s ease-in-out infinite',
                          },
                        }),
                  '@keyframes fadeInUp': {
                    from: {
                      opacity: 0,
                      transform: 'translateY(20px)'
                    },
                    to: {
                      opacity: 1,
                      transform: 'translateY(0)'
                    }
                        },
                        '@keyframes glow': {
                          '0%, 100%': { opacity: 0.2 },
                          '50%': { opacity: 0.4 },
                  }
                }}
              >
                <LazyPostWrapper 
                  postId={post.id}
                  minHeight={isMobile() ? 'calc(100vh - 100px)' : '600px'}
                  isCurrentlyViewing={currentViewingPost === post.id}
                >
                  <GameCard 
                    game={post} 
                    userId={user?.id}
                    username={user?.email}
                    onView={markPostAsViewed}
                    onComplete={() => handlePostComplete(post.id)}
                    onSlideChange={handleSlideChange}
                    onVideoProgress={handleVideoProgress}
                    isCurrentlyViewing={currentViewingPost === post.id}
                  />
                </LazyPostWrapper>
              </Box>
              </Box>
            );
          })}
          </Stack>

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
                  <Typography level="body-sm" sx={{ 
                    color: 'text.secondary',
                    fontFamily: 'serif' 
                  }}>
                    Loading more highlights...
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
                <Typography level="h4" sx={{ fontSize: '2rem' }}>
                  🎉
                </Typography>
                  <Typography level="title-lg" sx={{ 
                    textAlign: 'center',
                    fontFamily: 'serif',
                    fontWeight: 900 
                  }}>
                    You've caught up!
                </Typography>
                  <Typography level="body-sm" sx={{ 
                    color: 'text.secondary', 
                    textAlign: 'center',
                    fontFamily: 'serif' 
                  }}>
                  Check back later for more epic highlights
                </Typography>
                <Chip 
                  variant="soft" 
                  color="primary"
                  onClick={scrollToTop}
                    sx={{ 
                      cursor: 'pointer', 
                      mt: 2,
                      fontFamily: 'serif',
                      fontWeight: 700 
                    }}
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
                  bgcolor: '#000',
                  color: '#fff',
                  border: '3px solid #000',
                  boxShadow: '4px 4px 0px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.3s ease-out',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'scale(0.8)' },
              to: { opacity: 1, transform: 'scale(1)' }
            },
            '&:hover': {
                    transform: 'translate(-2px, -2px)',
                    boxShadow: '6px 6px 0px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s',
                    bgcolor: '#333',
            }
          }}
        >
          <KeyboardArrowUpIcon />
        </IconButton>
      )}

      {/* Empty State */}
        {!loading && displayedPosts.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <Typography level="h3" sx={{ 
              mb: 2,
              fontFamily: 'serif',
              fontWeight: 900 
            }}>
              No posts yet
          </Typography>
            <Typography level="body-md" sx={{ 
              color: 'text.secondary',
              fontFamily: 'serif' 
            }}>
              {user ? 'Check back soon for new highlights!' : 'Sign in to see personalized highlights'}
          </Typography>
        </Box>
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
              bgcolor: '#000',
              color: '#fff',
              border: '3px solid #000',
              boxShadow: '4px 4px 0px rgba(0,0,0,0.3)',
              animation: 'fadeIn 0.3s ease-out',
              '@keyframes fadeIn': {
                from: { opacity: 0, transform: 'scale(0.8)' },
                to: { opacity: 1, transform: 'scale(1)' }
              },
              '&:hover': {
                transform: 'translate(-2px, -2px)',
                boxShadow: '6px 6px 0px rgba(0,0,0,0.3)',
                transition: 'all 0.2s',
                bgcolor: '#333',
              }
            }}
          >
            <KeyboardArrowUpIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}

