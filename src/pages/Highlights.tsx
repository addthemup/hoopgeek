import { Box, Typography, Stack, Card, Chip, IconButton, CircularProgress, CardContent, Modal, ModalDialog, ModalClose, Button } from '@mui/joy'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useMediaQuery } from '@mui/material'
import Favorite from '@mui/icons-material/Favorite'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import Send from '@mui/icons-material/Send'
import Close from '@mui/icons-material/Close'
import { supabase } from '../utils/supabase'
import SocialEngagement from './SocialEngagement'
import PostsStories from '../components/PostsStories'
import TimestampedCommentsOverlay from '../components/TimestampedCommentsOverlay'
import InlineCommentInput from '../components/InlineCommentInput'
import { useEngagementTracking, useVideoTracking } from '../hooks/useEngagementTracking'
import { useWatchHistoryTracking } from '../hooks/useWatchHistoryTracking'
import StoryComparisonChart from '../components/Charts/StoryComparisonChart'
import MatchupRadarChart from '../components/Charts/MatchupRadarChart'
import OffensiveDefensiveScatter from '../components/Charts/OffensiveDefensiveScatter'
import PaceSpaceBubble from '../components/Charts/PaceSpaceBubble'
import HustleRadarChart from '../components/Charts/HustleRadarChart'
import FourFactorsChart from '../components/Charts/FourFactorsChart'
import ShotDistributionDonut from '../components/Charts/ShotDistributionDonut'
import ReboundingBattleChart from '../components/Charts/ReboundingBattleChart'
import PlaymakingEfficiencyChart from '../components/Charts/PlaymakingEfficiencyChart'
import TurnoverAnalysisChart from '../components/Charts/TurnoverAnalysisChart'
import PlusMinusImpactChart from '../components/Charts/PlusMinusImpactChart'
import UsageEfficiencyScatter from '../components/Charts/UsageEfficiencyScatter'
import TopFantasyScorersChart from '../components/Charts/TopFantasyScorersChart'
import ShotProfileEfficiencyChart from '../components/Charts/ShotProfileEfficiencyChart'
import ShotChartTable from '../components/Charts/ShotChartTable'
import RimPressureChart from '../components/Charts/RimPressureChart'
import OnBallCreationChart from '../components/Charts/OnBallCreationChart'
import DefensiveEventsMap from '../components/Charts/DefensiveEventsMap'
import FoulDrawingProfile from '../components/Charts/FoulDrawingProfile'
import PlayerComparisonRadarChart from '../components/Charts/PlayerComparisonRadarChart'
import PlayerStatsCircle from '../components/PlayerStatsCircle'
import { orderPostsByAlgorithm, FeedPost, FeedAlgorithmOptions, seededShuffle } from '../utils/feedAlgorithm'
import { logAvatarBarBreakdown } from '../utils/feedAlgorithmDebug'

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
  // Detect landscape mobile for reduced card height
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isMobileHeight = useMediaQuery('(max-height: 600px)')
  const isLandscapeMobile = isLandscape && isMobileHeight
  
  // If this post is currently being viewed (e.g., clicked from avatar), immediately mark as viewed
  useEffect(() => {
    if (isCurrentlyViewing) {
      setHasBeenViewed(true)
    }
  }, [isCurrentlyViewing])
  
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
      sx={{ 
        minHeight: shouldRenderContent ? 'auto' : minHeight,
        maxHeight: isLandscapeMobile 
          ? 'calc(77vh - 107px)' // 90% of normal height for landscape mobile
          : { xs: 'calc(85vh - 119px)', md: 'none' }, // Maximum 85% of parent container on mobile
        bgcolor: 'background.body', // Ensure background matches page
        position: 'relative',
        zIndex: 1, // Below avatar bars
      }}
    >
      {shouldRenderContent ? children : (
        <Card 
          variant="outlined"
          sx={{
            height: minHeight,
            bgcolor: 'background.body', // Match page background
            border: { xs: 'none', md: '3px solid' },
            borderColor: 'divider',
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 0, md: 1 },
            animation: 'pulse 1.5s ease-in-out infinite',
            position: 'relative',
            zIndex: 1, // Ensure it's below avatar bars
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
            bgcolor: 'background.body', // Match page background instead of black
            width: '100%',
            height: '100%',
            borderRadius: { xs: 0, md: '12px' },
            justifyContent: 'center'
          }}>
            <CircularProgress size="lg" />
            <Typography level="body-sm" sx={{ color: 'text.secondary', opacity: 0.7, fontFamily: 'serif' }}>
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

const GameCard = memo(function GameCard({ game, userId, username, onView, onComplete, onSlideChange, onVideoProgress, isCurrentlyViewing = true }: GameCardProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const indicatorRefs = useRef<(HTMLDivElement | null)[]>([])
  const isMobileDevice = useMediaQuery('(max-width: 900px)')
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 })
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 })
  const [mouseStart, setMouseStart] = useState(0)
  const [mouseEnd, setMouseEnd] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [fullGameData, setFullGameData] = useState<any>(null)
  const [isLoadingCarousel, setIsLoadingCarousel] = useState(false)
  const [hasMarkedViewed, setHasMarkedViewed] = useState(false)
  // Detect landscape mobile for reduced card height
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isMobileHeight = useMediaQuery('(max-height: 600px)')
  const isLandscapeMobile = isLandscape && isMobileHeight
  const [currentVideoTime, setCurrentVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [timestampedComments, setTimestampedComments] = useState<any[]>([])
  const [commentInputOpen, setCommentInputOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [videoHeightScale, setVideoHeightScale] = useState(1.0) // 1.0 = 3x (reel format, default), 0.8 = 2x (middle), 0.6 = 1x (contain)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastTouchTimeRef = useRef<number>(0)
  
  // Track video watch time
  useVideoTracking(videoRef, onVideoProgress)
  
  // Track watch history per team/player
  const { startTracking, stopTracking, updateVideoTime: updateWatchVideoTime } = useWatchHistoryTracking()
  
  // Track current video time and duration for timestamped comments
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentVideoTime(video.currentTime)
    }

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration || 0)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    
    // Set initial duration if already loaded
    if (video.duration) {
      setVideoDuration(video.duration)
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
    }
  }, [videoRef])
  
  // Load timestamped comments for this post
  const loadTimestampedComments = useCallback(async () => {
    if (!game.id) return
    
    try {
      // First, get the comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('feed_comments')
        .select(`
          id, 
          user_id, 
          username, 
          comment_text, 
          slide_index, 
          timestamp_seconds, 
          created_at
        `)
        .eq('content_id', game.id)
        .not('timestamp_seconds', 'is', null)
        .order('timestamp_seconds', { ascending: true })

      if (commentsError) throw commentsError
      
      if (!commentsData || commentsData.length === 0) {
        setTimestampedComments([])
        return
      }
      
      // Get unique user IDs
      const userIds = [...new Set(commentsData.map(c => c.user_id))]
      
      // Fetch avatar URLs from user_profiles
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('id, avatar_url')
        .in('id', userIds)
      
      // Create a map of user_id -> avatar_url
      const avatarMap = new Map<string, string | null>()
      if (profilesData) {
        profilesData.forEach(profile => {
          avatarMap.set(profile.id, profile.avatar_url || null)
        })
      }
      
      // Transform data to include avatar_url and convert timestamp_seconds and slide_index to numbers
      const commentsWithAvatars = commentsData.map((comment: any) => ({
        ...comment,
        avatar_url: avatarMap.get(comment.user_id) || null,
        timestamp_seconds: comment.timestamp_seconds 
          ? parseFloat(comment.timestamp_seconds) 
          : null,
        slide_index: typeof comment.slide_index === 'string' 
          ? parseInt(comment.slide_index, 10) 
          : (comment.slide_index ?? 0)
      }))
      
      console.log('🎬 Loaded timestamped comments:', {
        count: commentsWithAvatars.length,
        withAvatars: commentsWithAvatars.filter(c => c.avatar_url).length
      })
      
      setTimestampedComments(commentsWithAvatars)
    } catch (error) {
      console.error('Error loading timestamped comments:', error)
      setTimestampedComments([])
    }
  }, [game.id])

  useEffect(() => {
    loadTimestampedComments()
  }, [loadTimestampedComments])

  // Reload comments when slide changes (in case comments were added on a different slide)
  useEffect(() => {
    loadTimestampedComments()
  }, [currentSlide, loadTimestampedComments])
  
  // Handle seeking to timestamp
  const handleSeekToTime = useCallback((time: number) => {
    const video = videoRef.current
    if (video) {
      video.currentTime = time
      video.play().catch(err => console.log('Could not play:', err))
    }
  }, [])

  // Format timestamp as MM:SS
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle submitting a comment
  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !userId) return

    try {
      const commentData: any = {
        content_id: game.id,
        user_id: userId,
        username: username || 'Anonymous',
        comment_text: newComment.trim(),
        slide_index: currentSlide,
        timestamp_seconds: Math.round(currentVideoTime * 100) / 100 // Round to 2 decimals
      }

      const { error } = await supabase
        .from('feed_comments')
        .insert([commentData])

      if (error) throw error

      // Reload comments
      await loadTimestampedComments()
      setNewComment('')
      setCommentInputOpen(false)
    } catch (error) {
      console.error('Error posting comment:', error)
      alert('Failed to post comment')
    }
  }, [newComment, userId, username, game.id, currentSlide, currentVideoTime, loadTimestampedComments])

  
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
  
  // Create slides: All video and chart slides - memoized to prevent re-renders
  const slides = useMemo(() => {
    const slidesArray = []
    
    // For feed posts, slides contains the video and chart array
    if (parsedSlides && Array.isArray(parsedSlides)) {
      parsedSlides.forEach((slide: any, index) => {
        // Chart slides
        const chartTypes = ['story_comparison', 'matchup_comparison', 'game_summary', 'offensive_defensive_scatter', 'pace_space_bubble', 'hustle_radar', 'four_factors', 'shot_distribution', 'top_fantasy_scorers', 'player_comparison_radar', 'shot_chart_table']
        if (chartTypes.includes(slide.type)) {
          slidesArray.push({
            type: slide.type,
            isFirstSlide: index === 0,
            gameMetadata: index === 0 ? {
              date: game.game_date,
              arena: parsedMetadata.arena || 'NBA Arena',
              season: parsedMetadata.season || '2024-25',
              homeTeam: { quarters: [0, 0, 0, 0] },
              awayTeam: { quarters: [0, 0, 0, 0] }
            } : null,
            duration: slide.duration || 7000,
            ...slide
          })
        } 
        // Video slides
        else {
          const videoUrl = slide.video_url || slide.mp4
          if (videoUrl) {
            slidesArray.push({
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
          }
        }
      })
    }
    
    return slidesArray
  }, [parsedSlides, game.game_id])
  const hasMultipleSlides = slides.length > 1
  const currentSlideData = slides[currentSlide]

  // Calculate visible comments for current slide (SoundCloud style)
  const visibleComments = useMemo(() => {
    if (!currentSlideData?.mp4 || timestampedComments.length === 0) return []

    // Filter comments for current slide
    // Ensure slide_index is a number for comparison
    const slideComments = timestampedComments.filter(comment => {
      const commentSlideIndex = typeof comment.slide_index === 'string' 
        ? parseInt(comment.slide_index, 10) 
        : (comment.slide_index ?? -1)
      
      if (commentSlideIndex !== currentSlide) return false
      if (!comment.timestamp_seconds) return false
      return true
    })

    if (slideComments.length === 0) return []

    // Show comments that are approaching (within 2 seconds) or just passed (within 3 seconds)
    return slideComments
      .filter(comment => {
        const commentTime = typeof comment.timestamp_seconds === 'string' 
          ? parseFloat(comment.timestamp_seconds) 
          : (comment.timestamp_seconds || 0)
        const timeDiff = commentTime - currentVideoTime
        return timeDiff >= -3 && timeDiff <= 2
      })
      .sort((a, b) => {
        // Sort by proximity to current time (closest first)
        const timeA = typeof a.timestamp_seconds === 'string' 
          ? parseFloat(a.timestamp_seconds) 
          : (a.timestamp_seconds || 0)
        const timeB = typeof b.timestamp_seconds === 'string' 
          ? parseFloat(b.timestamp_seconds) 
          : (b.timestamp_seconds || 0)
        const diffA = Math.abs(timeA - currentVideoTime)
        const diffB = Math.abs(timeB - currentVideoTime)
        return diffA - diffB
      })
      .slice(0, 5) // Limit to 5 visible comments
  }, [timestampedComments, currentSlide, currentVideoTime, currentSlideData?.mp4])
  
  // Note: We intentionally don't reset video height when slide changes
  // to maintain the user's zoom preference across auto-advancing videos
  
  // Notify parent of slide changes
  useEffect(() => {
    if (onSlideChange && slides.length > 0) {
      onSlideChange(game.id, currentSlide, slides.length)
    }
  }, [currentSlide, slides.length, game.id, onSlideChange])

  // Scroll active indicator into view on mobile
  useEffect(() => {
    if (isMobileDevice && indicatorRefs.current[currentSlide]) {
      const activeIndicator = indicatorRefs.current[currentSlide]
      if (activeIndicator) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
          activeIndicator.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
          })
        }, 0)
      }
    }
  }, [currentSlide, isMobileDevice])
  
  // Track watch history when slide changes
  useEffect(() => {
    if (!isCurrentlyViewing || !currentSlideData) return
    
    // Stop tracking previous slide
    stopTracking()
    
    // Start tracking current slide
    startTracking(game.id, currentSlide, currentSlideData, game)
    
    // Cleanup: stop tracking when component unmounts or slide changes
    return () => {
      stopTracking()
    }
  }, [currentSlide, currentSlideData, game, isCurrentlyViewing, startTracking, stopTracking])
  
  // Update video watch time for watch history tracking
  useEffect(() => {
    if (currentSlideData?.mp4 && currentVideoTime > 0) {
      updateWatchVideoTime(currentVideoTime)
    }
  }, [currentVideoTime, currentSlideData, updateWatchVideoTime])
  
  // Auto-play video when slide changes (if currently viewing)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isCurrentlyViewing) return
    
    const slideData = slides[currentSlide]
    
    // Cleanup: pause and reset previous video before loading new one
    if (video.src && video.src !== slideData?.mp4) {
      video.pause()
      video.currentTime = 0
      video.load() // Reset video element
    }
    
    // Small delay to ensure video element is ready
    const timer = setTimeout(() => {
      if (video && slideData?.mp4 && video.paused) {
        video.play().catch(err => {
          console.log('▶️ Could not auto-play on slide change:', err)
        })
      }
    }, 150)
    
    return () => {
      clearTimeout(timer)
      // Cleanup: pause video when component unmounts or slide changes
      if (video) {
        video.pause()
        video.currentTime = 0
      }
    }
  }, [currentSlide, isCurrentlyViewing, slides])
  
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

  // Auto-advance for chart slides (timer-based)
  useEffect(() => {
    // Only auto-advance if this card is currently being viewed
    if (!isCurrentlyViewing) {
      return
    }

    const chartTypes = ['story_comparison', 'matchup_comparison', 'game_summary', 'offensive_defensive_scatter', 'pace_space_bubble', 'hustle_radar', 'four_factors', 'shot_distribution', 'top_fantasy_scorers', 'player_comparison_radar', 'shot_chart_table']
    
    if (!currentSlideData || !chartTypes.includes(currentSlideData.type)) {
      return // Not a chart slide
    }

    // Always use 7 seconds for chart slides to ensure autoplay doesn't get stuck
    const duration = 7000

    const timer = setTimeout(() => {
      if (currentSlide < slides.length - 1) {
        // Move to next slide
        setCurrentSlide(prev => prev + 1)
      } else {
        // Last slide ended - move to next post
        if (onComplete) {
          setTimeout(() => {
            onComplete()
          }, 500)
        }
      }
    }, duration)

    return () => clearTimeout(timer)
  }, [currentSlide, currentSlideData, slides.length, onComplete, isCurrentlyViewing])
  
  // Swipe/drag handlers
  const minSwipeDistance = 50
  
  // Touch handlers for mobile
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
    setTouchEnd({ x: touch.clientX, y: touch.clientY })
    setIsDragging(false)
  }
  
  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0]
    setTouchEnd({ x: touch.clientX, y: touch.clientY })
    const deltaX = Math.abs(touch.clientX - touchStart.x)
    const deltaY = Math.abs(touch.clientY - touchStart.y)
    // Consider it dragging if there's significant movement in any direction
    if (deltaX > 10 || deltaY > 10) {
      setIsDragging(true)
    }
  }
  
  const onTouchEnd = () => {
    if (!touchStart.x || touchEnd.x === null || touchEnd.x === undefined) return
    
    const deltaX = touchStart.x - touchEnd.x
    const deltaY = touchStart.y - touchEnd.y
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)
    
    // Determine if this is primarily a horizontal or vertical swipe
    // Lean towards horizontal: if horizontal movement is at least 1.5x vertical, treat as horizontal
    const isHorizontalSwipe = absDeltaX > absDeltaY * 1.5
    const isVerticalSwipe = absDeltaY > absDeltaX * 1.5
    
    const isLeftSwipe = deltaX > minSwipeDistance
    const isRightSwipe = deltaX < -minSwipeDistance
    const wasDragging = absDeltaX > 10 || absDeltaY > 10
    
    // Only handle horizontal swipes for slide navigation
    // Ignore vertical swipes to prevent accidental navigation when scrolling feed
    if (isHorizontalSwipe) {
      if (isLeftSwipe && currentSlide < slides.length - 1) {
        setCurrentSlide(currentSlide + 1)
        lastTouchTimeRef.current = Date.now()
      } else if (isRightSwipe && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1)
        lastTouchTimeRef.current = Date.now()
      }
    } else if (!wasDragging || (wasDragging && !isVerticalSwipe && absDeltaX < 10)) {
      // Small movement or non-vertical drag = tap, toggle video pause/play
      lastTouchTimeRef.current = Date.now()
      toggleVideoPlayPause()
    }
    
    // Reset dragging state
    setIsDragging(false)
    setTouchStart({ x: 0, y: 0 })
    setTouchEnd({ x: 0, y: 0 })
  }
  
  // Mouse drag handlers for desktop
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only handle left mouse button
    setMouseStart(e.clientX)
    setMouseEnd(e.clientX)
    setIsDragging(false)
  }
  
  const onMouseMove = (e: React.MouseEvent) => {
    if (mouseStart === 0) return
    const currentX = e.clientX
    setMouseEnd(currentX)
    const distance = Math.abs(mouseStart - currentX)
    if (distance > 10) {
      setIsDragging(true)
    }
  }
  
  const onMouseUp = () => {
    if (mouseStart === 0) return
    
    const distance = mouseStart - mouseEnd
    const absDistance = Math.abs(distance)
    const isLeftDrag = distance > minSwipeDistance
    const isRightDrag = distance < -minSwipeDistance
    
    // If it's a drag, handle navigation
    if (isLeftDrag && currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else if (isRightDrag && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
    
    // Reset mouse drag state
    const wasDragging = absDistance > 10
    setMouseStart(0)
    setMouseEnd(0)
    setIsDragging(false)
    
    // Store drag state for click handler check
    if (wasDragging) {
      lastTouchTimeRef.current = Date.now()
    }
  }
  
  // Keyboard navigation
  useEffect(() => {
    if (!isCurrentlyViewing) return // Only handle keyboard when this post is in view
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if user is not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      if (e.key === 'ArrowLeft' && currentSlide > 0) {
        e.preventDefault()
        setCurrentSlide(currentSlide - 1)
      } else if (e.key === 'ArrowRight' && currentSlide < slides.length - 1) {
        e.preventDefault()
        setCurrentSlide(currentSlide + 1)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentSlide, slides.length, isCurrentlyViewing])
  
  const toggleVideoPlayPause = () => {
    const video = videoRef.current
    if (!video) return
    
    if (video.paused) {
      video.play().catch(err => {
        console.log('Could not play video:', err)
      })
    } else {
      video.pause()
    }
  }
  
  // Toggle video height between 1x, 2x, and 3x (cycling: 3x -> 1x -> 2x -> 3x)
  // 1.0 = 3x (reel format, cover, 100% height)
  // 0.8 = 2x (middle ground, contain, 80% height)
  // 0.6 = 1x (contain, 60% height, shows full video)
  const toggleVideoHeight = () => {
    setVideoHeightScale(prev => {
      if (prev === 1.0) return 0.6 // 3x -> 1x
      if (prev === 0.6) return 0.8 // 1x -> 2x
      return 1.0 // 2x -> 3x
    })
  }
  
  // Get current zoom multiplier text
  const getZoomMultiplier = () => {
    if (videoHeightScale === 1.0) return '3x'
    if (videoHeightScale === 0.8) return '2x'
    return '1x'
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
        height: isLandscapeMobile 
          ? 'calc(77vh - 107px)' // 90% of normal height for landscape mobile
          : { xs: 'calc(85vh - 119px)', md: 'auto' }, // Card height on mobile for 85%/15% split
        maxHeight: isLandscapeMobile 
          ? 'calc(77vh - 107px)' // 90% of normal height for landscape mobile
          : { xs: 'calc(85vh - 119px)', md: 'none' }, // Limit card to 85% of parent container height on mobile
        borderRadius: 0, // Square card
        border: { xs: 'none', md: '3px solid var(--ink-black)' }, // No border on mobile
        boxShadow: 'none',
        overflow: 'hidden', // Prevent content from overflowing upward
        mx: 0,
        boxSizing: 'border-box',
        bgcolor: 'transparent',
        p: { xs: 0, md: 1 }, // No padding on mobile for full-screen feel
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1, // Ensure cards are below avatar bars
        // Hide scrollbars
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
        '& *': {
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      }}
    >
    
      {/* Video Container - 85% of card height */}
      <Box 
        ref={containerRef}
        sx={{ 
          position: 'relative',
          width: '100%',
          height: { xs: '85%', md: 0 }, // 85% of card height on mobile
          paddingBottom: { xs: 0, md: '56.25%' }, // 16:9 aspect ratio on desktop only
          overflow: 'hidden',
          margin: 0,
          backgroundColor: '#000',
          borderRadius: { xs: 0, md: '4px' }, // No border radius on mobile
          userSelect: 'none', // Prevent text selection during drag
          WebkitUserSelect: 'none',
          isolation: 'isolate', // Create new stacking context to prevent overflow
          flexShrink: 0, // Don't shrink
          // Hide scrollbars
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          '& *': {
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          },
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp} // Handle mouse leaving the container
      >
        {/* Content rendering (video or chart) */}
        {currentSlideData?.mp4 ? (
            <video
            ref={videoRef}
            key={currentSlideData.mp4}
            autoPlay
            muted
            playsInline
            onError={(e) => {
              console.error('❌ Video loading error:', e)
              const video = e.target as HTMLVideoElement
              if (video) {
                video.style.display = 'none'
              }
            }}
            onLoadStart={() => {
              // Ensure video is visible when loading starts
              if (videoRef.current) {
                videoRef.current.style.display = 'block'
              }
            }}
              onClick={(e) => {
                e.stopPropagation()
                
                // Don't pause video if clicking on interactive elements
                const target = e.target as HTMLElement
                const isClickableElement = target.closest('[data-clickable]') || 
                                          target.closest('button') ||
                                          target.closest('a') ||
                                          target.closest('[role="button"]') ||
                                          target.closest('.MuiIconButton-root') ||
                                          target.closest('.MuiAvatar-root') ||
                                          target.closest('[data-testid]')
                
                if (isClickableElement) {
                  return // Don't toggle play/pause
                }
                
                // Prevent double-firing on mobile (onClick fires after touchEnd)
                // Only handle click if it wasn't a recent touch/mouse event and not dragging
                const timeSinceLastTouch = Date.now() - lastTouchTimeRef.current
                const wasRecentInteraction = timeSinceLastTouch < 300
                
                if (!wasRecentInteraction && !isDragging && mouseStart.x === 0 && touchStart.x === 0) {
                  toggleVideoPlayPause()
                }
              }}
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${videoHeightScale * 100}%`,
                objectFit: videoHeightScale === 0.6 || videoHeightScale === 0.8 ? 'contain' : 'cover',
                objectPosition: 'center',
                marginTop: 0,
                marginBottom: 0,
                marginLeft: 0,
                padding: 0,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'height 0.3s ease-out, object-fit 0.3s ease-out',
              }}
            >
              <source src={currentSlideData.mp4} type="video/mp4" />
            </video>
        ) : currentSlideData?.type === 'story_comparison' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Story Comparison</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <StoryComparisonChart 
                advantage={currentSlideData.advantage}
                homeTeam={currentSlideData.home_team}
                awayTeam={currentSlideData.away_team}
              />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'matchup_comparison' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Matchup Comparison</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <MatchupRadarChart
                playerA={currentSlideData.playerA}
                playerB={currentSlideData.playerB}
                matchupMinutes={currentSlideData.matchupMinutes}
              />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'offensive_defensive_scatter' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Offensive vs Defensive Rating</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <OffensiveDefensiveScatter players={currentSlideData.players} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'pace_space_bubble' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Pace & Space</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <PaceSpaceBubble players={currentSlideData.players} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'hustle_radar' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Hustle Stats</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <HustleRadarChart player={currentSlideData.player} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'four_factors' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Four Factors</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <FourFactorsChart 
                homeTeam={currentSlideData.homeTeam}
                awayTeam={currentSlideData.awayTeam}
              />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'shot_distribution' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Shot Distribution</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <ShotDistributionDonut player={currentSlideData.player} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'rebounding_battle' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Rebounding Battle</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <ReboundingBattleChart players={currentSlideData.players} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'playmaking_efficiency' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Playmaking Efficiency</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <PlaymakingEfficiencyChart players={currentSlideData.players} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'turnover_analysis' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Turnover Analysis</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <TurnoverAnalysisChart teams={currentSlideData.teams} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'plus_minus_impact' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Plus/Minus Impact</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <PlusMinusImpactChart players={currentSlideData.players} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'usage_efficiency' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Usage vs Efficiency</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <UsageEfficiencyScatter players={currentSlideData.players} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'top_fantasy_scorers' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Top Fantasy Scorers</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <TopFantasyScorersChart 
                players={currentSlideData.players} 
                highlightedPlayerId={currentSlideData.highlightedPlayerId}
              />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'shot_chart_table' ? (
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            left: { xs: 0, md: 0 }, 
            width: '100%', 
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Shot Chart</Typography>
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <ShotChartTable shots={currentSlideData.shots} playerName={currentSlideData.playerName} teamTricode={currentSlideData.teamTricode} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'shot_profile_efficiency' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Shot Profile Efficiency</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <ShotProfileEfficiencyChart player={currentSlideData.player} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'rim_pressure' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Rim Pressure</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <RimPressureChart player={currentSlideData.player} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'on_ball_creation' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>On-Ball Creation</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <OnBallCreationChart player={currentSlideData.player} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'defensive_events' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Defensive Events</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <DefensiveEventsMap player={currentSlideData.player} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'foul_drawing' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>Foul Drawing Profile</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <FoulDrawingProfile player={currentSlideData.player} />
            </Box>
          </Box>
        ) : currentSlideData?.type === 'player_comparison_radar' ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 'bold', p: 1, textAlign: 'center', zIndex: 2 }}>{currentSlideData.categoryTitle || 'Player Comparison'}</Typography>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <PlayerComparisonRadarChart
                targetPlayer={currentSlideData.targetPlayer}
                comparisonPlayers={currentSlideData.comparisonPlayers || []}
                category={currentSlideData.category}
                categoryTitle={currentSlideData.categoryTitle || 'Player Comparison'}
              />
            </Box>
          </Box>
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
            <Typography level="body-lg" sx={{ mb: 1 }}>No content</Typography>
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
        
        
        
        {/* Instagram-style carousel indicators (dots) - top center */}
        {hasMultipleSlides && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              left: 0,
              right: 0,
              zIndex: 3,
              overflowX: isMobileDevice ? 'auto' : 'visible',
              overflowY: 'hidden',
              display: 'flex',
              justifyContent: isMobileDevice ? 'flex-start' : 'center',
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none', // IE/Edge
              '&::-webkit-scrollbar': {
                display: 'none', // Chrome/Safari
              },
              px: isMobileDevice ? 2 : 0, // Add padding on mobile to prevent edge clipping
            }}
          >
            <Stack 
              direction="row" 
              spacing={0.5}
              alignItems="center"
              sx={{
                position: 'relative',
                minWidth: isMobileDevice ? 'max-content' : 'auto',
                mx: isMobileDevice ? 'auto' : 0,
              }}
            >
              {slides.map((slide, index) => {
                const isChart = slide?.type && [
                  'story_comparison', 'matchup_comparison', 'game_summary', 
                  'offensive_defensive_scatter', 'pace_space_bubble', 'hustle_radar', 
                  'four_factors', 'shot_distribution', 'top_fantasy_scorers', 
                  'player_comparison_radar', 'shot_chart_table'
                ].includes(slide.type)
                
                const isActive = index === currentSlide
                const size = isActive ? 24 : (isChart ? 8 : 6)
                
                return (
                  <Box
                    key={index}
                    ref={(el) => {
                      indicatorRefs.current[index] = el
                    }}
                    sx={{
                      width: size,
                      height: isChart ? size : 6,
                      borderRadius: isChart ? (isActive ? 2 : 1) : 3, // Square/diamond for charts, round for videos
                      backgroundColor: isChart 
                        ? (isActive ? '#FFC72C' : 'rgba(255, 199, 44, 0.5)') // Gold for charts
                        : (isActive ? '#fff' : 'rgba(255,255,255,0.5)'), // White for videos
                      border: isChart && !isActive ? '1px solid rgba(255, 199, 44, 0.7)' : 'none', // Border for inactive chart indicators
                      transform: isChart && !isActive ? 'rotate(45deg)' : 'none', // Rotate inactive chart indicators to diamond shape
                      transition: 'all 0.3s',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0, // Prevent shrinking on mobile
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentSlide(index)
                    }}
                  />
                )
              })}
            </Stack>
          </Box>
        )}
        
        {/* Player Stats Overlay - Top of slide */}
        {currentSlideData?.mp4 && game.game_id && (() => {
          // Get player ID from various possible locations
          const playerId = currentSlideData?.metadata?.personId || 
                          currentSlideData?.personId || 
                          currentSlideData?.nba_player_id ||
                          game.person_id
          
          // Get player name from various possible locations
          const playerName = currentSlideData?.metadata?.playerNameI || 
                            currentSlideData?.metadata?.playerName ||
                            currentSlideData?.playerName ||
                            game.metadata?.playerNameI ||
                            game.metadata?.playerName
          
          // Only render if we have a player ID
          if (!playerId) return null
          
          return (
            <Box
              sx={{
                position: 'absolute',
                top: hasMultipleSlides ? 36 : 12, // Closer to carousel indicators
                left: 12,
                right: 12,
                zIndex: 2,
                pointerEvents: 'none', // Allow clicks to pass through to video
              }}
            >
              <Box
                sx={{
                  pointerEvents: 'auto', // Re-enable pointer events for the stats component
                }}
              >
                <PlayerStatsCircle
                  playerId={Number(playerId)}
                  gameId={game.game_id}
                  playerName={playerName}
                  postType={game.post_type}
                  spotlightPlayerId={game.person_id ? Number(game.person_id) : undefined}
                  hideAvatar={true}
                />
              </Box>
            </Box>
          )
        })()}
        
        {/* Timestamped Comments Overlay - Live stream chat feed */}
        {currentSlideData?.mp4 && (
          <TimestampedCommentsOverlay
            videoRef={videoRef}
            currentSlideIndex={currentSlide}
            contentId={game.id}
            comments={timestampedComments}
            userId={userId}
            onCommentClick={(comment) => {
              if (comment.timestamp_seconds != null) {
                handleSeekToTime(comment.timestamp_seconds)
              }
            }}
          />
        )}
        
      </Box>
      
      {/* React Bar Container - 15% of card height, separate from video */}
      <Box
        sx={{
          width: '100%',
          height: { xs: '15%', md: 'auto' }, // 15% of card height on mobile
          minHeight: { xs: '60px', md: 'auto' }, // Minimum height for react bar
          backgroundColor: 'background.body',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, md: 2 },
          py: { xs: 1, md: 1 },
          flexShrink: 0, // Don't shrink
        }}
      >
        {commentInputOpen && userId && currentSlideData?.mp4 ? (
          /* Comment Input - replaces reaction bar */
          <Stack 
            direction="row" 
            spacing={1} 
            alignItems="center"
            sx={{ 
              width: '100%',
              maxWidth: { xs: '100%', sm: 600 },
              mx: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
            data-clickable="true"
          >
            <Box
              component="input"
              placeholder={`Comment at ${formatTimestamp(currentVideoTime)}...`}
              value={newComment}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmitComment()
                }
              }}
              autoFocus
              sx={{
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#fff',
                fontSize: '0.9rem',
                '&::placeholder': {
                  color: 'rgba(255, 255, 255, 0.6)'
                },
                '&:focus': {
                  outline: 'none',
                  borderColor: 'rgba(255, 255, 255, 0.4)',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            />
            <IconButton
              onClick={handleSubmitComment}
              disabled={!newComment.trim()}
              sx={{
                backgroundColor: 'primary.500',
                color: '#fff',
                '&:hover': {
                  backgroundColor: 'primary.600'
                },
                '&:disabled': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  opacity: 0.5
                }
              }}
            >
              <Send />
            </IconButton>
            <IconButton
              onClick={() => {
                setCommentInputOpen(false)
                setNewComment('')
              }}
              sx={{ 
                color: '#fff',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              <Close />
            </IconButton>
          </Stack>
        ) : (
          /* Social engagement - centered (reaction bar) */
          <Stack 
            direction="row" 
            alignItems="center" 
            justifyContent="center" 
            sx={{ 
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent video pause when clicking reactions
          >
            <SocialEngagement
              contentId={game.id}
              userId={userId || 'anonymous'}
              username={username || 'Anonymous'}
              initialLikes={game.likes_count || 0}
              initialComments={game.comments_count || 0}
              initialShares={game.shares_count || 0}
              initialViews={game.views_count || 0}
              compact={true}
              videoRef={videoRef}
              onCommentClick={() => setCommentInputOpen(true)}
              onVideoHeightToggle={toggleVideoHeight}
              videoHeightScale={videoHeightScale}
              gameDate={game.game_date}
              gameTime={parsedMetadata.game_time || parsedMetadata.gameTime || undefined}
              awayTeam={parsedMetadata.awayTeam?.tricode || parsedMetadata.awayTeam?.abbreviation || story?.teams?.awayTeam?.tricode || undefined}
              homeTeam={parsedMetadata.homeTeam?.tricode || parsedMetadata.homeTeam?.abbreviation || story?.teams?.homeTeam?.tricode || undefined}
              playerId={currentSlideData?.metadata?.personId || game.person_id}
              playerName={currentSlideData?.metadata?.playerNameI || currentSlideData?.metadata?.playerName || game.metadata?.playerNameI || game.metadata?.playerName}
            />
          </Stack>
        )}
      </Box>
      
      {/* Bottom separator on mobile between posts */}
      <Box sx={{ 
        display: { xs: 'block', md: 'none' },
        height: '8px',
        bgcolor: 'background.level2',
      }} />
    </Card>
  )
})

// Batch sizes based on viewport
const MOBILE_BATCH_SIZE = 3  // Load 3 at a time on mobile (smoother than 1)
const DESKTOP_BATCH_SIZE = 12 // Load 12 at a time on desktop (4 rows of 3)

// Seeded random number generator for consistent but unique shuffling
// Uses a seed to ensure same seed = same sequence, but different seeds = different sequences
class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  // Simple linear congruential generator
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 2**32
    return this.seed / 2**32
  }

  // Generate a random number between min and max
  nextBetween(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
}

// Get or create a session seed for feed shuffling
// This ensures each page load/session gets a different seed
function getSessionSeed(context?: string): number {
  const storageKey = context 
    ? `feed_seed_${context}` 
    : 'feed_seed_session'
  
  // Check if we already have a seed for this session/context
  const existingSeed = sessionStorage.getItem(storageKey)
  if (existingSeed) {
    return parseInt(existingSeed, 10)
  }
  
  // Generate a new seed based on timestamp + random component
  // This ensures uniqueness across sessions while being deterministic within a session
  const newSeed = Date.now() + Math.floor(Math.random() * 1000000)
  sessionStorage.setItem(storageKey, newSeed.toString())
  return newSeed
}

// Generate a seed from a post ID + session seed
// This creates unique randomness per post while maintaining session consistency
function getPostSeed(postId: string, sessionSeed: number): number {
  // Hash the post ID into a number
  let hash = 0
  for (let i = 0; i < postId.length; i++) {
    const char = postId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  // Combine with session seed
  return (sessionSeed ^ hash) >>> 0 // Ensure positive 32-bit integer
}

export default function Highlights() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  
  // CRITICAL: Early return if not on feed route - prevents component from rendering when navigating away
  // This ensures React Router can properly unmount this component
  // MUST be first thing in component to prevent any hooks from running when not on feed route
  const isFeedRoute = location.pathname === '/' || location.pathname === '/feed' || location.pathname === '/feed/'
  if (!isFeedRoute) {
    // Clean up fixed positioning immediately before returning (minimal DOM manipulation)
    const html = document.documentElement
    const body = document.body
    // Only reset if actually set (avoid unnecessary DOM writes)
    if (html.style.position === 'fixed' || body.style.position === 'fixed') {
      html.style.cssText = ''
      body.style.cssText = ''
    }
    return null
  }
  const [searchParams, setSearchParams] = useSearchParams()
  const sharedPostId = searchParams.get('postId') || null // Get postId from URL if shared
  const filterTeam = searchParams.get('filterTeam') || null // Get team filter from URL
  const filterPlayer = searchParams.get('filterPlayer') || null // Get player filter from URL
  const isDesktop = useMediaQuery('(min-width: 1200px)')
  // Detect landscape mobile orientation
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isMobileHeight = useMediaQuery('(max-height: 600px)')
  const isLandscapeMobile = isLandscape && isMobileHeight
  const [displayedPosts, setDisplayedPosts] = useState<FeedPost[]>([])
  const [allPosts, setAllPosts] = useState<FeedPost[]>([]) // Store all posts for shuffling
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [favoritesLoading, setFavoritesLoading] = useState(true) // Track favorites loading state
  const [favoritesLoaded, setFavoritesLoaded] = useState(false) // Track if favorites have been loaded at least once
  const [isShuffling, setIsShuffling] = useState(false) // New loading state for shuffle
  const [hasMore, setHasMore] = useState(true)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)
  const postRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [currentViewingPost, setCurrentViewingPost] = useState<string | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0)
  const [totalSlides, setTotalSlides] = useState<number>(0)
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null) // Track fun_score playlist
  const [sharedPost, setSharedPost] = useState<FeedPost | null>(null) // Store shared post data
  const [queuedPlayerIds, setQueuedPlayerIds] = useState<Set<number>>(new Set()) // Track queued players for avatar bar
  const [playerContext, setPlayerContext] = useState<{ personId: number; teamTricodes: string[] } | null>(null) // Track player context for filtered feed
  const [teamContext, setTeamContext] = useState<string | null>(null) // Track team context for filtered feed (team tricode)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [avatarModalType, setAvatarModalType] = useState<'game' | 'player' | 'post' | null>(null)
  const [avatarModalData, setAvatarModalData] = useState<any>(null)
  const loadMorePostsRef = useRef<(() => Promise<void>) | null>(null)
  
  // Session seed for feed shuffling - regenerated on each page load
  // This ensures every refresh gets a different seed
  // Use a function to generate a truly random seed each time
  const generateNewSeed = () => Date.now() + Math.floor(Math.random() * 1000000)
  const sessionSeedRef = useRef<number>(generateNewSeed())
  
  // Track player context for player-specific feeds (different seed per player)
  const [playerFeedContext, setPlayerFeedContext] = useState<string | null>(null)
  
  // Reset component state when navigating to this route (even if already on it)
  // This ensures the component re-renders when clicking home button while on home page
  const prevLocationKeyRef = useRef<string | undefined>(location.key)
  useEffect(() => {
    // Only reset if we're actually on the feed route AND the location key changed
    // This prevents unnecessary resets on every render
    const isFeedRoute = location.pathname === '/' || location.pathname === '/feed' || location.pathname === '/feed/'
    if (!isFeedRoute || location.key === prevLocationKeyRef.current) {
      prevLocationKeyRef.current = location.key
      return
    }
    
    // Update the ref to track this navigation
    prevLocationKeyRef.current = location.key
    
    // Reset all state to initial values
    setDisplayedPosts([])
    setAllPosts([])
    setPage(0)
    setLoading(false)
    setHasMore(true)
    setCurrentViewingPost(null)
    setCurrentSlideIndex(0)
    setTotalSlides(0)
    setSharedPost(null)
    setQueuedPlayerIds(new Set())
    setPlayerContext(null)
    setTeamContext(null)
    setPlayerFeedContext(null)
    setActivePlaylist(null)
    setPostFrequencies(new Map())
    setAvatarClickDecay(new Map())
    setDfsContextByDate(new Map())
    setUserBehavior(null)
    
    // Regenerate session seed for new navigation
    sessionSeedRef.current = generateNewSeed()
    
    // Don't set loading here - let the initial load effect handle it
    // The reset of state above will trigger the initial load effect to run
  }, [location.key, location.pathname]) // Use location.key to detect navigation even when pathname is same
  
  // CRITICAL: Clean up fixed positioning IMMEDIATELY when navigating away
  // Use useLayoutEffect for synchronous cleanup before React Router renders new route
  useLayoutEffect(() => {
    // If we're not on the feed route, clean up IMMEDIATELY
    const isFeedRoute = location.pathname === '/' || location.pathname === '/feed' || location.pathname === '/feed/'
    if (!isFeedRoute) {
      // Clean up any existing styles SYNCHRONOUSLY to prevent navigation interference
      // Use cssText for faster batch update instead of individual property assignments
      const html = document.documentElement
      const body = document.body
      
      // Only reset if actually set (avoid unnecessary DOM writes)
      if (html.style.position === 'fixed' || body.style.position === 'fixed') {
        html.style.cssText = ''
        body.style.cssText = ''
      }
      
      // Also clean up feed container scroll snap
      const feedContainer = document.querySelector('[data-feed-container]') as HTMLElement
      if (feedContainer && feedContainer.style.scrollSnapType) {
        feedContainer.style.scrollSnapType = ''
      }
    }
  }, [location.pathname, location.key]) // Run on every route change
  
  // Apply scroll snap and prevent upward scrolling on mobile
  // Only apply when we're actually on the Highlights page
  useEffect(() => {
    // If we're not on the feed route, don't apply styles
    const isFeedRoute = location.pathname === '/' || location.pathname === '/feed' || location.pathname === '/feed/'
    if (!isFeedRoute) {
      return
    }
    
    if (!isMobile()) return
    
    // Completely disable body/html scroll on mobile
    const html = document.documentElement
    const body = document.body
    html.style.overflow = 'hidden'
    html.style.height = '100vh'
    html.style.position = 'fixed'
    html.style.width = '100%'
    html.style.top = '0'
    html.style.left = '0'
    body.style.overflow = 'hidden'
    body.style.height = '100vh'
    body.style.position = 'fixed'
    body.style.width = '100%'
    body.style.top = '0'
    body.style.left = '0'
    // In landscape mobile, add extra prevention
    if (isLandscapeMobile) {
      html.style.touchAction = 'none'
      body.style.touchAction = 'none'
    }
    
    // Find the feed container
    const feedContainer = document.querySelector('[data-feed-container]') as HTMLElement
    if (!feedContainer) {
      // Cleanup if container not found
      return () => {
        html.style.overflow = ''
        html.style.height = ''
        html.style.position = ''
        html.style.width = ''
        body.style.overflow = ''
        body.style.height = ''
        body.style.position = ''
        body.style.width = ''
      }
    }
    
    // Apply scroll snap to feed container (both mobile and desktop)
    feedContainer.style.scrollSnapType = 'y mandatory'
    
    // Allow bidirectional scrolling - no prevention
    
    return () => {
      html.style.overflow = ''
      html.style.height = ''
      html.style.position = ''
      html.style.width = ''
      html.style.top = ''
      html.style.left = ''
      html.style.touchAction = ''
      body.style.overflow = ''
      body.style.height = ''
      body.style.position = ''
      body.style.width = ''
      body.style.top = ''
      body.style.left = ''
      body.style.touchAction = ''
      feedContainer.style.scrollSnapType = ''
    }
  }, [displayedPosts.length, isLandscapeMobile, location.pathname, location.key]) // Re-run when posts load, landscape mobile changes, or route changes (including key)

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
    
    // Set first post as viewing on mount if not already set
    // This is a fallback in case initial load didn't set it
    if (!currentViewingPost && displayedPosts.length > 0) {
      const firstPostId = displayedPosts[0].id
      setCurrentViewingPost(firstPostId)
      setCurrentSlideIndex(0)
      console.log('🎬 Fallback: Setting first post as current viewing:', firstPostId)
    }
    
    return () => {
      observer.disconnect()
    }
  }, [displayedPosts, currentViewingPost])
  
  // Keyboard scrolling for desktop - ArrowDown/ArrowUp to scroll to next/previous post
  useEffect(() => {
    if (isMobile()) return // Only on desktop
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if user is not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      const feedContainer = document.querySelector('[data-feed-container="true"]') as HTMLElement
      if (!feedContainer) return
      
      // Find current post index
      const currentIndex = displayedPosts.findIndex(post => post.id === currentViewingPost)
      
      if (e.key === 'ArrowDown' || e.key === 'Down') {
        e.preventDefault()
        
        if (currentIndex === -1 || currentIndex >= displayedPosts.length - 1) return
        
        // Get next post element
        const nextPostId = displayedPosts[currentIndex + 1].id
        const nextPostElement = postRefs.current.get(nextPostId)
        
        if (nextPostElement) {
          // Scroll feed container to next post with smooth behavior
          const containerRect = feedContainer.getBoundingClientRect()
          const elementRect = nextPostElement.getBoundingClientRect()
          const scrollTop = feedContainer.scrollTop + (elementRect.top - containerRect.top)
          
          feedContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          })
        }
      } else if (e.key === 'ArrowUp' || e.key === 'Up') {
        e.preventDefault()
        
        if (currentIndex === -1 || currentIndex <= 0) return
        
        // Get previous post element
        const prevPostId = displayedPosts[currentIndex - 1].id
        const prevPostElement = postRefs.current.get(prevPostId)
        
        if (prevPostElement) {
          // Scroll feed container to previous post with smooth behavior
          const containerRect = feedContainer.getBoundingClientRect()
          const elementRect = prevPostElement.getBoundingClientRect()
          const scrollTop = feedContainer.scrollTop + (elementRect.top - containerRect.top)
          
          feedContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          })
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [displayedPosts, currentViewingPost, isMobile])
  
  // Ensure currentViewingPost exists in allPosts (for avatar bar synchronization)
  useEffect(() => {
    if (currentViewingPost && allPosts.length > 0) {
      const postExists = allPosts.some(p => p.id === currentViewingPost)
      if (!postExists) {
        // Current viewing post not in allPosts - set to first post
        console.warn('⚠️ currentViewingPost not found in allPosts, resetting to first post:', {
          currentViewingPost,
          firstPostInAllPosts: allPosts[0]?.id,
          allPostsLength: allPosts.length
        })
        if (allPosts[0]) {
          setCurrentViewingPost(allPosts[0].id)
          setCurrentSlideIndex(0)
        }
      }
    } else if (!currentViewingPost && allPosts.length > 0) {
      // No current viewing post but we have posts - set to first
      console.log('🎬 No currentViewingPost, setting to first post in allPosts:', allPosts[0]?.id)
      if (allPosts[0]) {
        setCurrentViewingPost(allPosts[0].id)
        setCurrentSlideIndex(0)
      }
    }
  }, [allPosts, currentViewingPost])
  
  // 📊 ENGAGEMENT TRACKING - TEMPORARILY DISABLED (causing infinite loops)
  // TODO: Fix circular dependencies in useEngagementTracking hook
  /* const {
    startSession,
    endSession,
    startPostView,
    updatePostView,
    endPostView,
    trackEvent,
    sessionMetrics,
    isTracking
  } = useEngagementTracking(user?.id) */
  
  // Dummy implementations to prevent errors (accept arguments but do nothing)
  const startSession = (_entryPage?: string) => {}
  const endSession = (_exitPage?: string, _reason?: string) => {}
  const startPostView = (_postId: string, _totalSlides: number, _wasClicked?: boolean) => {}
  const updatePostView = (_slidesViewed: number, _videoWatchSeconds?: number) => {}
  const endPostView = (_exitMethod?: string) => {}
  const trackEvent = (_eventType: string, _postId?: string, _eventData?: any) => {}
  const sessionMetrics = { sessionId: null, postsViewed: 0, postsCompleted: 0, videosWatched: 0, totalWatchTime: 0, interactions: 0 }
  const isTracking = false

  // Mark post as viewed (track in user_post_views table)
  const markPostAsViewed = useCallback(async (postId: string) => {
    if (!user?.id) return
    
    try {
      // Check if user has already viewed this post
      const { data: existingView } = await supabase
        .from('user_post_views')
        .select('id')
        .eq('user_id', user.id)
        .eq('post_id', postId)
        .limit(1)
        .maybeSingle()
      
      // If not viewed, insert a new view record
      if (!existingView) {
        const { error: viewError } = await supabase
          .from('user_post_views')
          .insert({
            user_id: user.id,
            post_id: postId,
            view_started_at: new Date().toISOString(),
            view_ended_at: new Date().toISOString(),
            was_clicked_from_avatar: false
          })
        
        if (viewError) throw viewError
      }
      
      // Also increment views_count on feed_posts for backward compatibility
      const { data: currentPost } = await supabase
        .from('feed_posts')
        .select('views_count')
        .eq('id', postId)
        .single()
      
      if (currentPost) {
        const { error: updateError } = await supabase
          .from('feed_posts')
          .update({ views_count: (currentPost.views_count || 0) + 1 })
          .eq('id', postId)
        
        if (updateError) throw updateError
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
    if (currentIndex === -1) return
    
    // Check if we need to load more posts (if we're within 3 posts of the end)
    if (currentIndex >= displayedPosts.length - 3 && hasMore && !loading && loadMorePostsRef.current) {
      loadMorePostsRef.current()
    }
    
    // If we're at the last post, loop back to the first post for infinite scrolling
    let nextIndex = currentIndex + 1
    if (nextIndex >= displayedPosts.length) {
      // Loop back to beginning for infinite scroll
      nextIndex = 0
    }
    
    const nextPost = displayedPosts[nextIndex]
    if (!nextPost) return
    
    // Set the next post as the current viewing post (this triggers avatar scroll)
    setCurrentViewingPost(nextPost.id)
    setCurrentSlideIndex(0)
    setTotalSlides(0)
    
    const nextPostElement = postRefs.current.get(nextPost.id)
    
    if (nextPostElement) {
      // Get the height of the fixed header (nav + avatar bar)
      const headerHeight = window.innerWidth < 900 ? 113 : 126
      
      // Calculate the position to scroll to
      const elementRect = nextPostElement.getBoundingClientRect()
      const absoluteElementTop = elementRect.top + window.pageYOffset
      const scrollToPosition = absoluteElementTop - headerHeight
      
      // Smooth scroll to position
      window.scrollTo({
        top: scrollToPosition,
        behavior: 'smooth'
      })
      
      // Start viewing the next post
      if (user?.id) {
        // Get total slides for the next post
        const nextPostSlides = typeof nextPost.slides === 'string' 
          ? JSON.parse(nextPost.slides) 
          : (nextPost.slides || [])
        const nextPostTotalSlides = Array.isArray(nextPostSlides) ? nextPostSlides.length : 0
        startPostView(nextPost.id, nextPostTotalSlides, false)
      }
    }
  }, [displayedPosts, user?.id, endPostView, trackEvent, totalSlides, hasMore, loading, startPostView])
  
  // Fisher-Yates shuffle with seed for deterministic randomness
  const seededShuffle = <T extends unknown>(array: T[], seed: number): T[] => {
    const shuffled = [...array]
    let random = seed
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Simple LCG (Linear Congruential Generator) for seeded random
      random = (random * 1664525 + 1013904223) % 4294967296
      const j = Math.floor((random / 4294967296) * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
  
  // Weighted random selection - higher weight = more likely to be selected
  const weightedShuffle = <T extends unknown>(
    array: T[],
    getWeight: (item: T) => number,
    seed: number
  ): T[] => {
    // Create weighted array with cumulative weights
    const weighted = array.map(item => ({
      item,
      weight: Math.max(0.1, getWeight(item)) // Minimum weight to ensure all items can be selected
    }))
    
    // Normalize weights
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0)
    weighted.forEach(w => {
      w.weight = w.weight / totalWeight
    })
    
    // Shuffle using weighted selection
    const result: T[] = []
    const remaining = [...weighted]
    let random = seed
    
    while (remaining.length > 0) {
      // Generate random number
      random = (random * 1664525 + 1013904223) % 4294967296
      const rand = random / 4294967296
      
      // Find item based on cumulative probability
      let cumulative = 0
      let selectedIndex = 0
      for (let i = 0; i < remaining.length; i++) {
        cumulative += remaining[i].weight
        if (rand <= cumulative) {
          selectedIndex = i
          break
        }
      }
      
      result.push(remaining[selectedIndex].item)
      remaining.splice(selectedIndex, 1)
      
      // Renormalize weights for remaining items
      const newTotal = remaining.reduce((sum, w) => sum + w.weight, 0)
      if (newTotal > 0) {
        remaining.forEach(w => {
          w.weight = w.weight / newTotal
        })
      }
    }
    
    return result
  }
  
  // Use the feed algorithm utility
  // The algorithm is now in src/utils/feedAlgorithm.ts for better isolation and testing
  
  // State for user favorites
  const [favoritePlayerIds, setFavoritePlayerIds] = useState<Set<number>>(new Set())
  const [favoriteTeamTricodes, setFavoriteTeamTricodes] = useState<Set<string>>(new Set())
  
  // State for feed algorithm enhancements
  const [postFrequencies, setPostFrequencies] = useState<Map<string, { timesShown: number; lastShownAt?: number }>>(new Map())
  const [avatarClickDecay, setAvatarClickDecay] = useState<Map<string, number>>(new Map()) // Track posts shown since avatar click
  const [dfsContextByDate, setDfsContextByDate] = useState<Map<string, { playerIds: Set<number>; teamTricodes: Set<string>; playerPerformance?: Map<number, { fantasyPoints: number; won: boolean; entryCount: number }> }>>(new Map())
  const [userBehavior, setUserBehavior] = useState<{ preferredPostType?: 'fun_score' | 'player_spotlight' | null; avgTimeSpent?: number; completionRate?: number } | null>(null)
  
  // Extract player/team IDs from shared post for boosting
  const sharedPostPlayerIds = useMemo(() => {
    if (!sharedPost) return new Set<number>()
    return new Set(sharedPost.player_ids || [])
  }, [sharedPost])
  
  const sharedPostTeamTricodes = useMemo(() => {
    if (!sharedPost) return new Set<string>()
    return new Set(sharedPost.team_tricodes || [])
  }, [sharedPost])
  
  // Fetch DFS context, post frequencies, and user behavior for logged-in users
  useEffect(() => {
    const fetchAlgorithmData = async () => {
      if (!user?.id) {
        // Clear data if user logs out
        setDfsContextByDate(new Map())
        setPostFrequencies(new Map())
        setUserBehavior(null)
        return
      }

      try {
        // Fetch DFS context
        const { data: dfsData, error: dfsError } = await supabase.rpc('get_user_dfs_context_for_feed', {
          p_user_id: user.id
        })
        
        if (dfsError) {
          console.warn('⚠️ Error fetching DFS context:', dfsError)
        } else if (dfsData) {
          // Convert JSONB to Map<string, DFSContext>
          const dfsMap = new Map<string, any>()
          for (const [gameDate, context] of Object.entries(dfsData)) {
            const ctx = context as any
            dfsMap.set(gameDate, {
              playerIds: new Set(ctx.playerIds || []),
              teamTricodes: new Set(ctx.teamTricodes || []),
              playerPerformance: ctx.playerPerformance ? new Map(Object.entries(ctx.playerPerformance).map(([k, v]: [string, any]) => [
                parseInt(k),
                { fantasyPoints: v.fantasyPoints || 0, won: v.won || false, entryCount: v.entryCount || 0 }
              ])) : undefined
            })
          }
          setDfsContextByDate(dfsMap)
        }

        // Fetch post frequencies
        const { data: freqData, error: freqError } = await supabase.rpc('get_user_post_frequencies', {
          p_user_id: user.id
        })
        
        if (freqError) {
          console.warn('⚠️ Error fetching post frequencies:', freqError)
        } else if (freqData) {
          // Convert JSONB to Map<string, PostFrequency>
          const freqMap = new Map<string, { timesShown: number; lastShownAt?: number }>()
          for (const [postId, freq] of Object.entries(freqData)) {
            const f = freq as any
            freqMap.set(postId, {
              timesShown: f.timesShown || 0,
              lastShownAt: f.lastShownAt || undefined
            })
          }
          setPostFrequencies(freqMap)
        }

        // Fetch user behavior
        const { data: behaviorData, error: behaviorError } = await supabase.rpc('get_user_feed_behavior', {
          p_user_id: user.id
        })
        
        if (behaviorError) {
          console.warn('⚠️ Error fetching user behavior:', behaviorError)
        } else if (behaviorData) {
          setUserBehavior({
            preferredPostType: behaviorData.preferredPostType || null,
            avgTimeSpent: behaviorData.avgTimeSpent || undefined,
            completionRate: behaviorData.completionRate || undefined
          })
        }
      } catch (error) {
        console.error('❌ Error fetching algorithm data:', error)
      }
    }

    fetchAlgorithmData()
  }, [user?.id])

  // Handle team/player filters from URL params
  useEffect(() => {
    if (filterTeam) {
      // Set team context for filtering
      setTeamContext(filterTeam)
      setPlayerContext(null) // Clear player context when team filter is active
    } else if (filterPlayer) {
      // Fetch player data to set player context
      const fetchPlayerForFilter = async () => {
        try {
          const { data: playerData, error } = await supabase
            .from('nba_players')
            .select('nba_player_id, team_abbreviation')
            .eq('id', filterPlayer)
            .single()
          
          if (error || !playerData) {
            console.error('Error fetching player for filter:', error)
            setPlayerContext(null)
            return
          }
          
          // Use team_abbreviation directly as tricode (they should be the same)
          const teamTricodes = playerData.team_abbreviation ? [playerData.team_abbreviation] : []
          
          setPlayerContext({
            personId: playerData.nba_player_id,
            teamTricodes
          })
          setTeamContext(null) // Clear team context when player filter is active
        } catch (error) {
          console.error('Error setting player context from filter:', error)
          setPlayerContext(null)
        }
      }
      
      fetchPlayerForFilter()
    } else {
      // Clear both contexts if no filter
      setTeamContext(null)
      // Only clear player context if not set from shared post
      if (!sharedPostId) {
        setPlayerContext(null)
      }
    }
  }, [filterTeam, filterPlayer, sharedPostId])

  // Fetch shared post if postId is in URL
  useEffect(() => {
    const fetchSharedPost = async () => {
      if (!sharedPostId) {
        setSharedPost(null)
        // Don't clear player context here if filterPlayer is set
        if (!filterPlayer) {
          setPlayerContext(null) // Clear player context when no shared post
        }
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('feed_posts')
          .select('*')
          .eq('id', sharedPostId)
          .eq('status', 'published')
          .maybeSingle()
        
        if (error) throw error
        
        if (data) {
          const fetchedPost = data as FeedPost
          setSharedPost(fetchedPost)
          
          // If this is a player_spotlight post, set player context for filtered feed
          if (fetchedPost.post_type === 'player_spotlight' && fetchedPost.person_id && fetchedPost.team_tricodes && fetchedPost.team_tricodes.length > 0) {
            setPlayerContext({
              personId: fetchedPost.person_id,
              teamTricodes: fetchedPost.team_tricodes
            })
            console.log('🎯 Player context set from shared post:', {
              personId: fetchedPost.person_id,
              teamTricodes: fetchedPost.team_tricodes
            })
          }
          
          // Add shared post to allPosts if it's not already there
          setAllPosts(prevPosts => {
            const exists = prevPosts.some(p => p.id === sharedPostId)
            if (exists) {
              return prevPosts
            }
            // Add shared post to the beginning of allPosts
            return [fetchedPost, ...prevPosts]
          })
          
          // Ensure shared post is in displayedPosts and shown first
          setDisplayedPosts(prevDisplayed => {
            const exists = prevDisplayed.some(p => p.id === sharedPostId)
            if (exists) {
              // Move to first position
              const filtered = prevDisplayed.filter(p => p.id !== sharedPostId)
              return [fetchedPost, ...filtered]
            }
            // Add to beginning
            return [fetchedPost, ...prevDisplayed]
          })
          
          // Set as current viewing post
          setCurrentViewingPost(sharedPostId)
          
          // Scroll to this post after loading (with retry mechanism)
          let retries = 0
          const maxRetries = 10
          const checkAndScroll = () => {
            const postElement = postRefs.current.get(sharedPostId)
            if (postElement) {
              console.log('📍 Shared post: Scrolling to post element')
              const headerHeight = window.innerWidth < 900 ? 113 : 126
              const elementRect = postElement.getBoundingClientRect()
              const absoluteElementTop = elementRect.top + window.pageYOffset
              const scrollToPosition = absoluteElementTop - headerHeight
              window.scrollTo({
                top: scrollToPosition,
                behavior: 'smooth'
              })
            } else if (retries < maxRetries) {
              retries++
              setTimeout(checkAndScroll, 100) // Retry every 100ms
            } else {
              console.warn('⚠️ Shared post: Post element not found in refs after retries')
            }
          }
          setTimeout(checkAndScroll, 100) // Start checking after 100ms
        } else {
          setSharedPost(null)
        }
      } catch (error) {
        console.error('Error fetching shared post:', error)
        setSharedPost(null)
      }
    }
    
    fetchSharedPost()
  }, [sharedPostId])
  
  // Fetch user favorites - must complete before loading posts
  useEffect(() => {
    const fetchFavorites = async () => {
      // Wait for auth to complete first
      if (authLoading) {
        return
      }
      
      setFavoritesLoading(true)
      
      if (!user?.id) {
        // User is not logged in - set empty favorites and mark as loaded
        setFavoritePlayerIds(new Set())
        setFavoriteTeamTricodes(new Set())
        setFavoritesLoading(false)
        setFavoritesLoaded(true)
        return
      }
      
      try {
        // Fetch favorite players - need to join with nba_players to get actual NBA player ID
        const { data: favoritePlayers } = await supabase
          .from('player_favorites')
          .select(`
            player_id,
            nba_players (
              nba_player_id
            )
          `)
          .eq('user_id', user.id)
        
        const playerIds = new Set<number>()
        if (favoritePlayers) {
          favoritePlayers.forEach((fp: any) => {
            // The player_id in player_favorites is UUID, but we need nba_players.nba_player_id (BIGINT)
            const nbaPlayerId = fp.nba_players?.nba_player_id
            if (nbaPlayerId && typeof nbaPlayerId === 'number') {
              playerIds.add(nbaPlayerId)
            }
          })
        }
        setFavoritePlayerIds(playerIds)
        
        // Fetch favorite teams - use user_favorite_teams table with team_id (INTEGER)
        const { data: favoriteTeams } = await supabase
          .from('user_favorite_teams')
          .select(`
            team_id,
            nba_teams (
              abbreviation
            )
          `)
          .eq('user_id', user.id)
        
        // Map team_id to abbreviation (used as tricode in posts)
        const teamTricodes = new Set<string>()
        if (favoriteTeams) {
          favoriteTeams.forEach((ft: any) => {
            // team_id is INTEGER, and we need the abbreviation from nba_teams
            const abbreviation = ft.nba_teams?.abbreviation
            if (abbreviation) {
              teamTricodes.add(abbreviation)
            }
          })
        }
        setFavoriteTeamTricodes(teamTricodes)
      } catch (error) {
        console.error('Error fetching favorites:', error)
      } finally {
        setFavoritesLoading(false)
        setFavoritesLoaded(true)
      }
    }
    
    fetchFavorites()
  }, [user?.id, authLoading])
  
  // Reorder posts when avatar is clicked (use algorithm, not random shuffle)
  const scrollToPost = useCallback(async (postId: string) => {
    console.log('🔍 scrollToPost called with postId:', postId)
    console.log('📊 allPosts length:', allPosts.length)
    console.log('📋 Sample post IDs:', allPosts.slice(0, 5).map(p => ({ id: p.id, title: p.title })))
    
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
    if (!clickedPost) {
      console.error('❌ scrollToPost: Post not found!', {
        searchedPostId: postId,
        allPostsCount: allPosts.length,
        availableIds: allPosts.slice(0, 10).map(p => p.id)
      })
      setIsShuffling(false)
      return
    }
    
    console.log('✅ scrollToPost: Found post:', clickedPost.title, 'in allPosts (total:', allPosts.length, 'posts)')
    
    // Fetch viewed post IDs
    let viewedPostIds = new Set<string>()
    if (user?.id) {
      const { data: viewedPosts } = await supabase
        .from('user_post_views')
        .select('post_id')
        .eq('user_id', user.id)
      
      if (viewedPosts) {
        viewedPostIds = new Set(viewedPosts.map(v => v.post_id))
      }
    }
    
    // Extract team tricodes from clicked post to boost (when fun_score is clicked, show more from that team)
    const boostedTeamTricodes = new Set<string>(clickedPost.team_tricodes || [])
    
    // Generate new seed for reshuffle
    const newSeed = Date.now() + Math.floor(Math.random() * 1000000)
    
    // Update avatar click decay tracking
    const updatedDecay = new Map(avatarClickDecay)
    for (const team of boostedTeamTricodes) {
      const key = `team:${team}`
      updatedDecay.set(key, (updatedDecay.get(key) || 0) + 1)
    }
    setAvatarClickDecay(updatedDecay)

    // Use algorithm to reorder all posts with new seed and team boost
    const reorderedPosts = orderPostsByAlgorithm(allPosts, {
      favoritePlayerIds,
      favoriteTeamTricodes,
      sharedPostPlayerIds,
      sharedPostTeamTricodes,
      viewedPostIds,
      postFrequencies,
      dfsContextByDate,
      userBehavior: userBehavior || undefined,
      avatarClickDecay: updatedDecay,
      seed: newSeed,
      boostedTeamTricodes, // Boost team when fun_score avatar is clicked
      clickSource: 'avatar',
      isUserLoggedIn: !!user?.id
    })
    
    console.log('📊 scrollToPost: Reordered posts count:', reorderedPosts.length, 'allPosts count:', allPosts.length)
    
    // Find the clicked post's new position
    const clickedIndex = reorderedPosts.findIndex(p => p.id === postId)
    console.log('🔍 scrollToPost: Clicked post index in reordered list:', clickedIndex >= 0 ? clickedIndex : 'NOT FOUND')
    
    let newPostOrder: FeedPost[] = []
    
    if (clickedIndex >= 0) {
      // Put clicked post FIRST, then reshuffle the rest with MORE randomness for magical feel
      const remainingPosts = [
        ...reorderedPosts.slice(0, clickedIndex),
        ...reorderedPosts.slice(clickedIndex + 1)
      ]
      
      // Reshuffle remaining posts with additional randomness layer
      // This makes it feel more magical - same algorithm base, but different random outcome
      const reshuffleSeed = newSeed + Math.floor(Math.random() * 1000000)
      const shuffledRemaining = seededShuffle(remainingPosts, reshuffleSeed)
      
      newPostOrder = [
        reorderedPosts[clickedIndex], // Clicked post ALWAYS first
        ...shuffledRemaining // Rest reshuffled for magical randomness
      ]
      console.log('✅ scrollToPost: Reordered posts, clicked post is now first, rest reshuffled:', newPostOrder[0]?.id, newPostOrder[0]?.title)
    } else {
      // Clicked post not in reordered list - add it first, then reshuffle the rest
      console.warn('⚠️ scrollToPost: Clicked post not found in reordered posts, adding it manually')
      const reshuffleSeed = newSeed + Math.floor(Math.random() * 1000000)
      const shuffledRemaining = seededShuffle(reorderedPosts, reshuffleSeed)
      newPostOrder = [
        clickedPost, // Put clicked post first
        ...shuffledRemaining // Rest reshuffled
      ]
      console.log('✅ scrollToPost: Added clicked post manually, rest reshuffled:', newPostOrder[0]?.id, newPostOrder[0]?.title)
    }
    
    // Update allPosts with new order so avatar bar reflects the change immediately
    // This makes the clicked avatar slide to the front and the rest re-render
    setAllPosts(newPostOrder)
    
    // Simulate loading time for smooth transition
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const postsToDisplay = newPostOrder.slice(0, 20)
    console.log('📋 scrollToPost: Setting displayedPosts, first post:', postsToDisplay[0]?.id, postsToDisplay[0]?.title)
    setDisplayedPosts(postsToDisplay) // Show first 20
    
    // Log avatar bar breakdown after avatar click
    logAvatarBarBreakdown(postsToDisplay, {
      favoritePlayerIds,
      favoriteTeamTricodes,
      sharedPostPlayerIds,
      sharedPostTeamTricodes,
      viewedPostIds,
      postFrequencies,
      dfsContextByDate,
      userBehavior: userBehavior || undefined,
      avatarClickDecay: updatedDecay,
      seed: newSeed,
      boostedTeamTricodes,
      clickSource: 'avatar',
      isUserLoggedIn: !!user?.id
    }, {
      route: window.location.pathname,
      isLoggedIn: !!user?.id,
      clickSource: 'avatar',
      hasSharedPost: false,
      hasPlayerContext: false
    })
    
    // Update post frequencies for displayed posts
    if (user?.id) {
      setPostFrequencies(prev => {
        const updated = new Map(prev)
        const now = Date.now()
        postsToDisplay.forEach(post => {
          const existing = updated.get(post.id)
          updated.set(post.id, {
            timesShown: (existing?.timesShown || 0) + 1,
            lastShownAt: now
          } as { timesShown: number; lastShownAt?: number })
        })
        return updated
      })
      
      // Update avatar click decay counters
      setAvatarClickDecay(prev => {
        const updated = new Map(prev)
        postsToDisplay.forEach(post => {
          const postTeamTricodes = post.team_tricodes || []
          const postPlayerIds = post.player_ids || []
          
          // Increment decay counters for boosted teams/players
          for (const team of boostedTeamTricodes) {
            if (postTeamTricodes.includes(team)) {
              const key = `team:${team}`
              updated.set(key, (updated.get(key) || 0) + 1)
            }
          }
        })
        return updated
      })
    }
    
    setIsShuffling(false)
    console.log('✅ scrollToPost: Complete, isShuffling set to false')
    
    // Set the clicked post as the current viewing post (this will make it visible/active)
    setCurrentViewingPost(postId)
    setCurrentSlideIndex(0)
    
    // Start tracking the clicked post (will be marked as clicked from avatar)
    if (user?.id && clickedPost) {
      const slides = typeof clickedPost.slides === 'string' 
        ? JSON.parse(clickedPost.slides) 
        : (clickedPost.slides || [])
      startPostView(postId, Array.isArray(slides) ? slides.length : 0, true)
    }
    
    // Scroll to top after reorder
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // Wait for post to render and ref to be registered, then scroll to it
    // Use a retry mechanism since React needs time to render and register refs
    let retries = 0
    const maxRetries = 10
    const checkAndScroll = () => {
      const postElement = postRefs.current.get(postId)
      if (postElement) {
        console.log('📍 scrollToPost: Scrolling to post element')
        const headerHeight = window.innerWidth < 900 ? 113 : 126
        const elementRect = postElement.getBoundingClientRect()
        const absoluteElementTop = elementRect.top + window.pageYOffset
        const scrollToPosition = absoluteElementTop - headerHeight
        window.scrollTo({
          top: scrollToPosition,
          behavior: 'smooth'
        })
      } else if (retries < maxRetries) {
        retries++
        setTimeout(checkAndScroll, 100) // Retry every 100ms
      } else {
        console.warn('⚠️ scrollToPost: Post element not found in refs after retries')
      }
    }
    setTimeout(checkAndScroll, 100) // Start checking after 100ms
  }, [allPosts, user?.id, endPostView, trackEvent, startPostView, orderPostsByAlgorithm, favoritePlayerIds, favoriteTeamTricodes, sharedPostPlayerIds, sharedPostTeamTricodes])
  
  // Handle avatar double-click: play that post and prioritize player highlights
  const handleAvatarDoubleClick = useCallback(async (postId: string, playerId: number) => {
    // Track avatar click and end current post view
    if (user?.id) {
      endPostView('click_away')
      trackEvent('post_interaction', postId, {
        action: 'player_avatar_double_click',
        player_id: playerId,
        clicked_from_stories: true
      })
    }
    
    setIsShuffling(true)
    
    // Find the clicked post
    const clickedPost = allPosts.find(p => p.id === postId)
    if (!clickedPost) {
      setIsShuffling(false)
      return
    }
    
    // Add player to queue (this will show multiple avatars for this player)
    setQueuedPlayerIds(prev => new Set([...prev, playerId]))
    
    // Fetch viewed post IDs
    let viewedPostIds = new Set<string>()
    if (user?.id) {
      const { data: viewedPosts } = await supabase
        .from('user_post_views')
        .select('post_id')
        .eq('user_id', user.id)
      
      if (viewedPosts) {
        viewedPostIds = new Set(viewedPosts.map(v => v.post_id))
      }
    }
    
    // Extract team tricodes from clicked post to boost (when player is clicked, show more from their team)
    const boostedTeamTricodes = new Set<string>(clickedPost.team_tricodes || [])
    
    // Generate new seed for reshuffle
    const newSeed = Date.now() + Math.floor(Math.random() * 1000000)
    
    // Update avatar click decay tracking
    const updatedDecay = new Map(avatarClickDecay)
    for (const team of boostedTeamTricodes) {
      const key = `team:${team}`
      updatedDecay.set(key, (updatedDecay.get(key) || 0) + 1)
    }
    const playerKey = `player:${playerId}`
    updatedDecay.set(playerKey, (updatedDecay.get(playerKey) || 0) + 1)
    setAvatarClickDecay(updatedDecay)

    // Reorder using algorithm with new seed and team boost
    const reorderedPosts = orderPostsByAlgorithm(allPosts, {
      favoritePlayerIds,
      favoriteTeamTricodes,
      sharedPostPlayerIds,
      sharedPostTeamTricodes,
      viewedPostIds,
      postFrequencies,
      dfsContextByDate,
      userBehavior: userBehavior || undefined,
      avatarClickDecay: updatedDecay,
      seed: newSeed,
      boostedTeamTricodes, // Boost team when player avatar is clicked
      boostedPlayerIds: new Set([playerId]), // Boost the clicked player
      clickSource: 'avatar',
      isUserLoggedIn: !!user?.id
    })
    
    // Find clicked post position
    const clickedIndex = reorderedPosts.findIndex(p => p.id === postId)
    let finalOrderedPosts: FeedPost[] = []
    
    if (clickedIndex >= 0) {
      // Put clicked post FIRST, then reshuffle the rest with MORE randomness for magical feel
      const remainingPosts = [
        ...reorderedPosts.slice(0, clickedIndex),
        ...reorderedPosts.slice(clickedIndex + 1)
      ]
      
      // Reshuffle remaining posts with additional randomness layer
      const reshuffleSeed = newSeed + Math.floor(Math.random() * 1000000)
      const shuffledRemaining = seededShuffle(remainingPosts, reshuffleSeed)
      
      finalOrderedPosts = [
        reorderedPosts[clickedIndex], // Clicked post ALWAYS first
        ...shuffledRemaining // Rest reshuffled for magical randomness
      ]
    } else {
      // Clicked post not in reordered list - add it first, then reshuffle the rest
      console.warn('⚠️ handleAvatarDoubleClick: Clicked post not found in reordered posts, adding it manually')
      const reshuffleSeed = newSeed + Math.floor(Math.random() * 1000000)
      const shuffledRemaining = seededShuffle(reorderedPosts, reshuffleSeed)
      finalOrderedPosts = [
        clickedPost, // Put clicked post first
        ...shuffledRemaining // Rest reshuffled
      ]
    }
    
    // Update allPosts with new order so avatar bar reflects the change
    setAllPosts(finalOrderedPosts)
    
    // Simulate loading time for smooth transition
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const postsToDisplay = finalOrderedPosts.slice(0, 20)
    setDisplayedPosts(postsToDisplay)
    
    // Log avatar bar breakdown after player avatar double-click
    logAvatarBarBreakdown(postsToDisplay, {
      favoritePlayerIds,
      favoriteTeamTricodes,
      sharedPostPlayerIds,
      sharedPostTeamTricodes,
      viewedPostIds,
      postFrequencies,
      dfsContextByDate,
      userBehavior: userBehavior || undefined,
      avatarClickDecay: updatedDecay,
      seed: newSeed,
      boostedTeamTricodes,
      boostedPlayerIds: new Set([playerId]),
      clickSource: 'avatar',
      isUserLoggedIn: !!user?.id
    }, {
      route: window.location.pathname,
      isLoggedIn: !!user?.id,
      clickSource: 'avatar',
      hasSharedPost: false,
      hasPlayerContext: false
    })
    
    // Update post frequencies for displayed posts
    if (user?.id) {
      setPostFrequencies(prev => {
        const updated = new Map(prev)
        const now = Date.now()
        postsToDisplay.forEach(post => {
          const existing = updated.get(post.id)
          updated.set(post.id, {
            timesShown: (existing?.timesShown || 0) + 1,
            lastShownAt: now
          } as { timesShown: number; lastShownAt?: number })
        })
        return updated
      })
      
      // Update avatar click decay counters
      setAvatarClickDecay(prev => {
        const updated = new Map(prev)
        postsToDisplay.forEach(post => {
          const postTeamTricodes = post.team_tricodes || []
          const postPlayerIds = post.player_ids || []
          
          // Increment decay counters for boosted teams/players
          for (const team of boostedTeamTricodes) {
            if (postTeamTricodes.includes(team)) {
              const key = `team:${team}`
              updated.set(key, (updated.get(key) || 0) + 1)
            }
          }
          if (postPlayerIds.includes(playerId)) {
            const key = `player:${playerId}`
            updated.set(key, (updated.get(key) || 0) + 1)
          }
        })
        return updated
      })
    }
    
    setIsShuffling(false)
    
    // Set the clicked post as the current viewing post (this will make it play)
    setCurrentViewingPost(postId)
    setCurrentSlideIndex(0)
    
    // Start tracking the clicked post
    if (user?.id && clickedPost) {
      const slides = typeof clickedPost.slides === 'string' 
        ? JSON.parse(clickedPost.slides) 
        : (clickedPost.slides || [])
      startPostView(postId, Array.isArray(slides) ? slides.length : 0, true)
    }
    
    // Scroll to top to play the post
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // Wait for post to render and ref to be registered, then scroll to it
    // Use a retry mechanism since React needs time to render and register refs
    let retries = 0
    const maxRetries = 10
    const checkAndScroll = () => {
      const postElement = postRefs.current.get(postId)
      if (postElement) {
        postElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (retries < maxRetries) {
        retries++
        setTimeout(checkAndScroll, 100) // Retry every 100ms
      }
    }
    setTimeout(checkAndScroll, 100) // Start checking after 100ms
  }, [allPosts, favoritePlayerIds, favoriteTeamTricodes, sharedPostPlayerIds, sharedPostTeamTricodes, orderPostsByAlgorithm, user?.id, endPostView, trackEvent, startPostView])
  
  // Handle avatar hold: show modal
  const handleAvatarHold = useCallback((type: 'game' | 'player' | 'post', data: any) => {
    setAvatarModalType(type)
    setAvatarModalData(data)
    setAvatarModalOpen(true)
  }, [])

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

  // Load initial posts on mount and order using new algorithm
  // CRITICAL: Wait for auth and favorites to complete before loading to avoid re-render
  // PERFORMANCE: Only load recent posts initially (200 most recent) to prevent timeout
  useEffect(() => {
    // Don't load posts until auth is complete and favorites are loaded
    if (authLoading || !favoritesLoaded) {
      return
    }
    
    // If there's a sharedPostId, wait for sharedPost to be fetched (so we can set playerContext)
    // This ensures we have the player context before filtering posts
    if (sharedPostId && !sharedPost) {
      console.log('⏳ Waiting for shared post to be fetched before loading posts...')
      return
    }
    
    const loadInitialPosts = async () => {
      try {
        setLoading(true)
        
        // Fetch viewed post IDs for current user (optimized - only get IDs)
        let viewedPostIds = new Set<string>()
        if (user?.id) {
          const { data: viewedPosts, error: viewError } = await supabase
            .from('user_post_views')
            .select('post_id')
            .eq('user_id', user.id)
            .limit(10000) // Reasonable limit for viewed posts
          
          if (viewError) {
            console.warn('⚠️ Error loading viewed posts:', viewError)
          } else if (viewedPosts) {
            viewedPostIds = new Set(viewedPosts.map(v => v.post_id))
          }
        }
        
        // If player context or team context is set, filter posts
        let posts: FeedPost[] = []
        
        if (playerContext) {
          // Filter to show only:
          // 1. player_spotlight posts with this person_id
          // 2. fun_score posts from this player's team
          console.log('🎯 Loading filtered feed for player context:', playerContext)
          
          // Fetch player_spotlight posts for this player
          const { data: playerSpotlightPosts, error: spotlightError } = await supabase
            .from('feed_posts')
            .select('*')
            .eq('status', 'published')
            .eq('post_type', 'player_spotlight')
            .eq('person_id', playerContext.personId)
            .order('game_date', { ascending: false, nullsFirst: false })
            .limit(100)
          
          if (spotlightError) {
            console.error('❌ Error loading player spotlight posts:', spotlightError)
          }
          
          // Fetch fun_score posts from this player's team
          const { data: funScorePosts, error: funScoreError } = await supabase
            .from('feed_posts')
            .select('*')
            .eq('status', 'published')
            .eq('post_type', 'fun_score')
            .overlaps('team_tricodes', playerContext.teamTricodes) // Posts that include any of the player's teams
            .order('game_date', { ascending: false, nullsFirst: false })
            .limit(100)
          
          if (funScoreError) {
            console.error('❌ Error loading team fun_score posts:', funScoreError)
          }
          
          // Combine both types of posts
          posts = [
            ...(playerSpotlightPosts || []),
            ...(funScorePosts || [])
          ]
          
          // Ensure shared post is included if it exists
          if (sharedPost && !posts.some(p => p.id === sharedPost.id)) {
            posts.unshift(sharedPost) // Add to beginning
          }
          
          console.log('📊 Filtered feed loaded:', {
            playerSpotlightCount: playerSpotlightPosts?.length || 0,
            funScoreCount: funScorePosts?.length || 0,
            total: posts.length,
            includesSharedPost: sharedPost ? posts.some(p => p.id === sharedPost.id) : false
          })
        } else if (teamContext) {
          // Filter to show only:
          // 1. fun_score posts from this team
          // 2. player_spotlight posts from players on this team
          console.log('🎯 Loading filtered feed for team context:', teamContext)
          
          // Fetch fun_score posts from this team
          const { data: funScorePosts, error: funScoreError } = await supabase
            .from('feed_posts')
            .select('*')
            .eq('status', 'published')
            .eq('post_type', 'fun_score')
            .overlaps('team_tricodes', [teamContext]) // Posts that include this team
            .order('game_date', { ascending: false, nullsFirst: false })
            .limit(100)
          
          if (funScoreError) {
            console.error('❌ Error loading team fun_score posts:', funScoreError)
          }
          
          // Get all players on this team to fetch their spotlight posts
          const { data: teamPlayers, error: playersError } = await supabase
            .from('nba_players')
            .select('nba_player_id')
            .eq('team_abbreviation', teamContext)
          
          if (playersError) {
            console.error('❌ Error loading team players:', playersError)
          }
          
          // Fetch player_spotlight posts from players on this team
          let playerSpotlightPosts: FeedPost[] = []
          if (teamPlayers && teamPlayers.length > 0) {
            const playerIds = teamPlayers.map(p => p.nba_player_id)
            const { data: spotlightPosts, error: spotlightError } = await supabase
              .from('feed_posts')
              .select('*')
              .eq('status', 'published')
              .eq('post_type', 'player_spotlight')
              .in('person_id', playerIds)
              .order('game_date', { ascending: false, nullsFirst: false })
              .limit(100)
            
            if (spotlightError) {
              console.error('❌ Error loading player spotlight posts:', spotlightError)
            } else {
              playerSpotlightPosts = spotlightPosts || []
            }
          }
          
          // Combine both types of posts
          posts = [
            ...(funScorePosts || []),
            ...playerSpotlightPosts
          ]
          
          // Ensure shared post is included if it exists
          if (sharedPost && !posts.some(p => p.id === sharedPost.id)) {
            posts.unshift(sharedPost) // Add to beginning
          }
          
          console.log('📊 Filtered feed loaded:', {
            playerSpotlightCount: playerSpotlightPosts?.length || 0,
            funScoreCount: funScorePosts?.length || 0,
            total: posts.length,
            includesSharedPost: sharedPost ? posts.some(p => p.id === sharedPost.id) : false
          })
        } else {
          // Normal feed: load recent posts (200 most recent by game_date)
          const INITIAL_LOAD_LIMIT = 200
          
          const { data, error } = await supabase
            .from('feed_posts')
            .select('*')
            .eq('status', 'published')
            .order('game_date', { ascending: false, nullsFirst: false })
            .limit(INITIAL_LOAD_LIMIT)
          
          if (error) throw error
          
          posts = (data || []) as FeedPost[]
        }
        
        // Order posts using the new algorithm
        // Generate new seed for fresh shuffle on each load and store in ref
        // This ensures every page load/refresh gets a different order
        sessionSeedRef.current = generateNewSeed()
        console.log('🎲 Generated new session seed:', sessionSeedRef.current)
        
        const orderedPosts = orderPostsByAlgorithm(posts, {
          favoritePlayerIds,
          favoriteTeamTricodes,
          sharedPostPlayerIds,
          sharedPostTeamTricodes,
          viewedPostIds,
          postFrequencies,
          dfsContextByDate,
          userBehavior: userBehavior || undefined,
          avatarClickDecay,
          seed: sessionSeedRef.current,
          clickSource: sharedPostId ? 'share' : 'home',
          isUserLoggedIn: !!user?.id
        })
        
        // If shared post exists, put it first
        let finalOrderedPosts = orderedPosts
        if (sharedPostId) {
          const sharedIndex = orderedPosts.findIndex(p => p.id === sharedPostId)
          if (sharedIndex >= 0) {
            // Found in ordered posts, move to first
            finalOrderedPosts = [
              orderedPosts[sharedIndex],
              ...orderedPosts.slice(0, sharedIndex),
              ...orderedPosts.slice(sharedIndex + 1)
            ]
          } else if (sharedPost) {
            // Shared post not in ordered list (might not be in initial batch), add it first
            console.log('⚠️ Shared post not in initial batch, adding manually:', sharedPostId)
            finalOrderedPosts = [
              sharedPost,
              ...orderedPosts
            ]
          }
        }
        
        // Deduplicate posts by ID to ensure no duplicates
        const seenIds = new Set<string>()
        const deduplicatedFinalPosts = finalOrderedPosts.filter(post => {
          if (seenIds.has(post.id)) {
            return false
          }
          seenIds.add(post.id)
          return true
        })
        
        // Store all loaded posts for shuffling/avatar clicks
        // IMPORTANT: Use deduplicatedFinalPosts (not raw posts) so avatar bar matches displayed order
        const initialPostsToDisplay = deduplicatedFinalPosts.slice(0, 20)
        
        // Set allPosts first, then use useEffect to set currentViewingPost after state updates
        setAllPosts(deduplicatedFinalPosts)
        setDisplayedPosts(initialPostsToDisplay) // Show first 20
        
        // Set the first post as the current viewing post so it auto-plays
        // Do this synchronously - the useEffect in PostsStories will handle the timing
        if (initialPostsToDisplay.length > 0) {
          const firstPostId = initialPostsToDisplay[0].id
          setCurrentViewingPost(firstPostId)
          setCurrentSlideIndex(0)
          console.log('🎬 Initial load: Setting first post as current viewing:', firstPostId, {
            allPostsLength: finalOrderedPosts.length,
            displayedPostsLength: initialPostsToDisplay.length,
            firstPostInAllPosts: finalOrderedPosts[0]?.id,
            firstPostInDisplayed: initialPostsToDisplay[0]?.id
          })
        }
        
        // Log avatar bar breakdown for debugging
        logAvatarBarBreakdown(initialPostsToDisplay, {
          favoritePlayerIds,
          favoriteTeamTricodes,
          sharedPostPlayerIds,
          sharedPostTeamTricodes,
          viewedPostIds,
          postFrequencies,
          dfsContextByDate,
          userBehavior: userBehavior || undefined,
          avatarClickDecay,
          seed: sessionSeedRef.current,
          clickSource: sharedPostId ? 'share' : 'home',
          isUserLoggedIn: !!user?.id
        }, {
          route: window.location.pathname,
          isLoggedIn: !!user?.id,
          clickSource: sharedPostId ? 'share' : 'home',
          hasSharedPost: !!sharedPostId,
          hasPlayerContext: !!playerContext
        })
        
        // Update post frequencies for displayed posts
        if (user?.id) {
          setPostFrequencies(prev => {
            const updated = new Map(prev)
            const now = Date.now()
            initialPostsToDisplay.forEach(post => {
              const existing = updated.get(post.id)
              updated.set(post.id, {
                timesShown: (existing?.timesShown || 0) + 1,
                lastShownAt: now
              } as { timesShown: number; lastShownAt?: number })
            })
            return updated
          })
        }
        
        setHasMore(finalOrderedPosts.length > 20)
      } catch (error) {
        console.error('❌ Error loading posts:', error)
        // Set empty state on error to prevent infinite loading
        setDisplayedPosts([])
        setAllPosts([])
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    }
    
    loadInitialPosts()
  }, [authLoading, favoritesLoaded, user?.id, orderPostsByAlgorithm, favoritePlayerIds, favoriteTeamTricodes, sharedPostPlayerIds, sharedPostTeamTricodes, sharedPostId, sharedPost, playerContext, teamContext, filterTeam, filterPlayer, location.key]) // Include location.key to reload on navigation

  // Load more posts when scrolling (using algorithm-ordered posts)
  const loadMorePosts = useCallback(async (forceFetch = false) => {
    console.log('🔄 loadMorePosts called', { loading, hasMore, allPostsLength: allPosts.length, displayedPostsLength: displayedPosts.length, forceFetch })
    
    if (loading) {
      console.log('⏸️ loadMorePosts: Already loading, skipping')
      return
    }
    
    // Don't check hasMore - we have thousands of posts, so always try to load more
    // The database query will return empty if we've truly reached the end

    setLoading(true)
    // When forceFetch is true (called from avatar bar), fetch 20 new posts
    // Otherwise use normal batch size
    const fetchSize = forceFetch ? 20 : (isMobile() ? MOBILE_BATCH_SIZE : DESKTOP_BATCH_SIZE)
    const batchSize = isMobile() ? MOBILE_BATCH_SIZE : DESKTOP_BATCH_SIZE
    const currentLength = displayedPosts.length
    
    try {
      // Fetch viewed posts if user is logged in (only once, reuse)
      let viewedPostIds = new Set<string>()
      if (user?.id) {
        const { data: viewedPosts } = await supabase
          .from('user_post_views')
          .select('post_id')
          .eq('user_id', user.id)
          .limit(10000)
        
        if (viewedPosts) {
          viewedPostIds = new Set(viewedPosts.map(v => v.post_id))
        }
      }
      
      // Re-order all currently loaded posts to get the correct order
      // Use same seed to maintain consistency during pagination
      const paginationSeed = sessionSeedRef.current
      const orderedPosts = orderPostsByAlgorithm(allPosts, {
        favoritePlayerIds,
        favoriteTeamTricodes,
        sharedPostPlayerIds,
        sharedPostTeamTricodes,
        viewedPostIds,
        seed: paginationSeed,
        clickSource: 'home',
        isUserLoggedIn: !!user?.id
      })
      
      // Check if we have more posts in the ordered list
      // If forceFetch is true (called from avatar bar), always fetch new posts
      if (!forceFetch && currentLength < orderedPosts.length) {
        // Show more from already-loaded posts
        console.log('📋 loadMorePosts: Showing more from already-loaded posts', {
          currentLength,
          orderedPostsLength: orderedPosts.length,
          willShow: currentLength + batchSize
        })
        const nextBatch = orderedPosts.slice(0, currentLength + batchSize)
        setDisplayedPosts(nextBatch)
        setHasMore(nextBatch.length < orderedPosts.length)
      } else {
        // Need to load more posts from database
        console.log('📥 loadMorePosts: Fetching new posts from database', {
          allPostsLength: allPosts.length,
          fetchSize,
          range: `${allPosts.length} to ${allPosts.length + fetchSize - 1}`
        })
        
        const { data: nextBatch, error } = await supabase
          .from('feed_posts')
          .select('*')
          .eq('status', 'published')
          .order('game_date', { ascending: false, nullsFirst: false })
          .range(allPosts.length, allPosts.length + fetchSize - 1)
        
        if (error) {
          console.error('❌ Error loading more posts:', error)
          setHasMore(false)
          return
        }
        
        console.log('📦 loadMorePosts: Received batch from database', {
          batchSize: nextBatch?.length || 0,
          allPostsLengthBefore: allPosts.length
        })
        
        if (nextBatch && nextBatch.length > 0) {
          // Add new posts to allPosts, but deduplicate by post ID first
          const existingPostIds = new Set(allPosts.map(p => p.id))
          const newPosts = (nextBatch as FeedPost[]).filter(p => !existingPostIds.has(p.id))
          
          console.log('🔄 loadMorePosts: Adding new posts to allPosts', {
            newPostsAdded: newPosts.length,
            duplicatesFiltered: nextBatch.length - newPosts.length,
            currentAllPostsLength: allPosts.length
          })
          
          // Order the NEW posts using the algorithm (considering all posts for proper weighting)
          const allPostsForWeighting = [...allPosts, ...newPosts]
          const orderedAllPosts = orderPostsByAlgorithm(allPostsForWeighting, {
            favoritePlayerIds,
            favoriteTeamTricodes,
            sharedPostPlayerIds,
            sharedPostTeamTricodes,
            viewedPostIds,
            postFrequencies,
            dfsContextByDate,
            userBehavior: userBehavior || undefined,
            avatarClickDecay,
            seed: paginationSeed,
            clickSource: 'home',
            isUserLoggedIn: !!user?.id
          })
          
          // Deduplicate ordered posts
          const seenIds = new Set<string>()
          const deduplicatedOrdered = orderedAllPosts.filter(post => {
            if (seenIds.has(post.id)) {
              return false
            }
            seenIds.add(post.id)
            return true
          })
          
          // Find which posts are NEW (not in current allPosts)
          const currentPostIds = new Set(allPosts.map(p => p.id))
          const newPostIds = new Set(newPosts.map(p => p.id))
          
          // Get the new posts in their algorithm-ordered positions
          // Keep existing posts in their current order, append new ones at the end
          const existingPosts = allPosts // Keep existing in current order
          
          // Filter deduplicatedOrdered to get only new posts (by ID)
          // This ensures we get all new posts that passed through the algorithm
          const newPostsInOrder = deduplicatedOrdered.filter(p => newPostIds.has(p.id))
          
          // If we got fewer new posts than expected, it might be because some were filtered during deduplication
          // In that case, just append the raw newPosts (they'll be ordered by the algorithm on next load)
          // But first, let's make sure we're not missing any
          if (newPostsInOrder.length < newPosts.length) {
            console.warn('⚠️ loadMorePosts: Some new posts missing from ordered list', {
              newPostsCount: newPosts.length,
              newPostsInOrderCount: newPostsInOrder.length,
              missing: newPosts.length - newPostsInOrder.length
            })
            // Add any missing new posts to the end (they might have been filtered during deduplication)
            const foundNewPostIds = new Set(newPostsInOrder.map(p => p.id))
            const missingNewPosts = newPosts.filter(p => !foundNewPostIds.has(p.id))
            if (missingNewPosts.length > 0) {
              console.log('➕ loadMorePosts: Adding missing new posts', { count: missingNewPosts.length })
              newPostsInOrder.push(...missingNewPosts)
            }
          }
          
          // Append new posts to the end (don't reshuffle existing ones)
          const updatedAllPosts = [...existingPosts, ...newPostsInOrder]
          
          console.log('✅ loadMorePosts: Appending new posts to allPosts', {
            existingPostsCount: existingPosts.length,
            newPostsInOrderCount: newPostsInOrder.length,
            totalPostsNow: updatedAllPosts.length
          })
          
          // IMPORTANT: Append new posts to allPosts (don't reorder existing ones)
          setAllPosts(updatedAllPosts)
          
          // Update displayed posts (use deduplicated ordered posts for feed)
          const newPostsToDisplay = deduplicatedOrdered.slice(0, currentLength + batchSize)
          setDisplayedPosts(newPostsToDisplay)
          
          // Log avatar bar breakdown for the newly added posts
          // Get the posts that will be newly visible in avatar bar (the new ones we just added)
          if (newPostsInOrder.length > 0) {
            logAvatarBarBreakdown(newPostsInOrder, {
              favoritePlayerIds,
              favoriteTeamTricodes,
              sharedPostPlayerIds,
              sharedPostTeamTricodes,
              viewedPostIds,
              postFrequencies,
              dfsContextByDate,
              userBehavior: userBehavior || undefined,
              avatarClickDecay,
              seed: paginationSeed,
              clickSource: 'home',
              isUserLoggedIn: !!user?.id
            }, {
              route: '/',
              isLoggedIn: !!user?.id,
              clickSource: 'home',
              hasSharedPost: false,
              hasPlayerContext: false
            })
          }
          
          // Update post frequencies for newly displayed posts
          if (user?.id) {
            setPostFrequencies(prev => {
              const updated = new Map(prev)
              const now = Date.now()
              // Only track posts that are newly displayed (after currentLength)
              const newlyDisplayed = newPostsToDisplay.slice(currentLength)
              newlyDisplayed.forEach(post => {
                const existing = updated.get(post.id)
                updated.set(post.id, {
                  timesShown: (existing?.timesShown || 0) + 1,
                  lastShownAt: now
                } as { timesShown: number; lastShownAt?: number })
              })
              return updated
            })
          }
          
          const hasMorePosts = nextBatch.length === fetchSize
          setHasMore(hasMorePosts)
          console.log('✅ loadMorePosts: Completed successfully', {
            newPostsAdded: newPosts.length,
            totalPostsNow: updatedAllPosts.length,
            hasMore: hasMorePosts
          })
        } else {
          console.log('⚠️ loadMorePosts: No more posts available from database')
          setHasMore(false)
        }
      }
    } catch (error) {
      console.error('❌ Error in loadMorePosts:', error)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, displayedPosts, allPosts, user?.id, orderPostsByAlgorithm, favoritePlayerIds, favoriteTeamTricodes, sharedPostPlayerIds, sharedPostTeamTricodes])
  
  // Store loadMorePosts in ref for use in handlePostComplete
  useEffect(() => {
    loadMorePostsRef.current = loadMorePosts
  }, [loadMorePosts])

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
      position: isLandscapeMobile ? 'fixed' : 'relative', // Fixed position in landscape mobile to prevent page scroll
      margin: 0,
      padding: 0,
      // On mobile, prevent any scrolling that would reveal content behind avatar bars
      ...(isMobile() && {
        overflowY: 'hidden', // Prevent body scroll on mobile
        height: '100vh', // Lock body height
      }),
      // In landscape mobile, ensure no padding/margin that could push content down and prevent all scrolling
      ...(isLandscapeMobile && {
        marginTop: 0,
        paddingTop: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: 'hidden', // Absolutely prevent page scroll in landscape mobile
        touchAction: 'none', // Prevent touch scrolling on the page itself
      }),
    }}>
      {/* MarginBars are now rendered in Layout component for all routes */}

      {/* Posts Stories */}
      <PostsStories 
        posts={allPosts}
        currentViewingPost={currentViewingPost || undefined}
        currentSlideIndex={currentSlideIndex}
        totalSlides={totalSlides}
        onAvatarClick={scrollToPost}
        favoritePlayerIds={favoritePlayerIds}
        onAvatarDoubleClick={handleAvatarDoubleClick}
        onAvatarHold={handleAvatarHold}
        onLoadMorePosts={loadMorePosts}
      />

      {/* Main Feed Container - Only render after avatars are loaded */}
      {allPosts.length > 0 && (
      <Box sx={{ 
        maxWidth: isLandscapeMobile 
          ? '66.67%' // 2/3 of screen width in landscape mobile
          : { xs: '100%', sm: 805, md: 1035 },
        minWidth: isLandscapeMobile 
          ? '66.67%' // 2/3 of screen width in landscape mobile
          : { xs: '100%', sm: 805, md: 1035 },
        mx: isLandscapeMobile 
          ? 'auto' // Center the 2/3 width container
          : { xs: 'auto', sm: 'auto', md: 'auto' }, // Center with maxWidth constraint 
        // Fixed position on both mobile and desktop to sit below avatar bars and fill remaining viewport
        position: { xs: 'fixed', md: 'fixed' },
        top: isLandscapeMobile 
          ? '80px' // Start directly below avatar bar (80px tall) in landscape mobile
          : { xs: '100px', md: 'calc((100vh - 40px) / 16 + 120px)' }, // Start below avatar bar (100px tall) on mobile
        left: { xs: 0, md: 0 },
        right: { xs: 0, md: 0 },
        bottom: { xs: 0, md: 0 },
        height: isLandscapeMobile 
          ? 'calc(100vh - 80px)' // Full height minus avatar bar (80px) in landscape mobile
          : { xs: 'calc(100vh - 100px)', md: 'calc(100vh - (100vh - 40px) / 16 - 120px)' }, // Full height minus avatar bar (100px) on mobile
        overflowY: { xs: 'auto', md: 'auto' }, // Scrollable on both mobile and desktop
        overflowX: 'hidden',
        // Prevent any content from rendering above container
        ...(isMobile() && {
          contain: 'layout style paint',
          willChange: 'scroll-position',
        }),
        // In landscape mobile, ensure feed container can scroll even though page cannot
        ...(isLandscapeMobile && {
          touchAction: 'pan-y', // Allow vertical scrolling in feed container
        }),
        pt: isLandscapeMobile ? 0 : { xs: '100px', md: 0 }, // Padding on mobile to account for avatar bar at top, no padding-top on desktop since container is positioned below avatar bar
        pb: { xs: 0, md: 8 }, // No bottom padding on mobile, 64px on desktop to ensure last post is fully visible 
        px: { xs: 0, sm: 2, md: 2 }, // No horizontal padding on mobile for full-width posts
        width: '100%',
        boxSizing: 'border-box',
        bgcolor: 'background.body', // Ensure background covers padding area
        zIndex: 100, // Below avatar bars (1200) but above other content
        // Scroll snap for both mobile and desktop
        scrollSnapType: 'y mandatory',
        // Prevent upward scrolling on mobile
        ...(isMobile() && {
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }),
      } as any}
      data-feed-container="true" // For scroll prevention hook
      >
      {/* Initial Loading State - Only show if we have posts but they're still loading */}
        {(loading || authLoading || !favoritesLoaded) && displayedPosts.length === 0 && allPosts.length > 0 && (
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
              pt: 0, // No padding-top
              mt: 0, // No margin-top
              position: 'relative',
              zIndex: 1, // Below avatar bars
              // Ensure content doesn't render above padding
              '& > *': {
                position: 'relative',
              }
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
                          // Don't interfere with scroll snap
                          ...(isMobile() && {
                            scrollSnapAlign: 'none',
                          }),
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
                  // Scroll snap - snap to start of each post (both mobile and desktop)
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always', // Always stop at each post, don't skip
                  // Each post takes full remaining height of viewport
                  height: isLandscapeMobile 
                    ? 'calc(100vh - 200px)' // Full height minus avatar bar in landscape mobile
                    : { xs: 'calc(100vh - 243px)', md: 'calc(100vh - (100vh - 40px) / 16 - 120px)' }, // Full height minus nav bar and avatar bar on desktop
                  minHeight: isLandscapeMobile 
                    ? 'calc(100vh - 200px)' 
                    : { xs: 'calc(100vh - 243px)', md: 'calc(100vh - (100vh - 40px) / 16 - 120px)' },
                  display: 'flex',
                  flexDirection: 'column',
                  // First post starts immediately below avatar bar
                  ...(index === 0 && {
                    marginTop: 0,
                    paddingTop: 0,
                  }),
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
                  minHeight={isLandscapeMobile 
                    ? 'calc(77vh - 107px)' // 90% of normal height for landscape mobile
                    : isMobile() ? 'calc(85vh - 119px)' : '600px'} // 85% of parent container (100vh - 140px) on mobile
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


      {/* Avatar Hold Modal */}
      <Modal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
      >
        <ModalDialog
          sx={{
            maxWidth: { xs: '90vw', sm: '600px', md: '700px' },
            maxHeight: '90vh',
            width: '100%',
            bgcolor: '#fff',
            border: '3px solid #000',
            borderRadius: 0,
            boxShadow: '6px 6px 0px #000',
            overflow: 'auto',
            p: 0,
          }}
        >
          <ModalClose
            sx={{
              top: '12px',
              right: '12px',
              bgcolor: '#000',
              color: '#fff',
              borderRadius: 0,
              border: '2px solid #fff',
              '&:hover': {
                bgcolor: '#333',
              },
            }}
          />
          {avatarModalType === 'game' && avatarModalData?.gameId && (
            <Box sx={{ p: 2 }}>
              <Typography level="h4" sx={{ mb: 2, fontFamily: 'serif', fontWeight: 900 }}>
                Game Details
              </Typography>
              <Typography level="body-md">
                Game ID: {avatarModalData.gameId}
              </Typography>
              <Button
                variant="solid"
                onClick={() => navigate(`/game/${avatarModalData.gameId}`)}
                sx={{ mt: 2 }}
              >
                View Full Game
              </Button>
            </Box>
          )}
          {avatarModalType === 'player' && avatarModalData?.playerId && (
            <Box sx={{ p: 2 }}>
              <Typography level="h4" sx={{ mb: 2, fontFamily: 'serif', fontWeight: 900 }}>
                {avatarModalData.playerName || 'Player'}
              </Typography>
              {(() => {
                const bannerMode = avatarModalData.bannerMode || 'fp'
                const metadata = avatarModalData.metadata || {}
                
                if (bannerMode === 'fp') {
                  return (
                    <Box>
                      <Typography level="body-lg" sx={{ mb: 2 }}>
                        Fantasy Points: {metadata.fantasyPoints?.toFixed(1) || 'N/A'}
                      </Typography>
                      <Button
                        variant="solid"
                        onClick={() => navigate(`/player/${avatarModalData.playerId}`)}
                        sx={{ mt: 2 }}
                      >
                        View Player Page
                      </Button>
                    </Box>
                  )
                } else if (bannerMode === 'pts-reb-ast') {
                  return (
                    <Box>
                      <Typography level="body-lg" sx={{ mb: 1 }}>
                        Points: {metadata.points || 0}
                      </Typography>
                      <Typography level="body-lg" sx={{ mb: 1 }}>
                        Rebounds: {metadata.rebounds || 0}
                      </Typography>
                      <Typography level="body-lg" sx={{ mb: 2 }}>
                        Assists: {metadata.assists || 0}
                      </Typography>
                      <Button
                        variant="solid"
                        onClick={() => navigate(`/player/${avatarModalData.playerId}`)}
                        sx={{ mt: 2 }}
                      >
                        View Player Page
                      </Button>
                    </Box>
                  )
                } else if (bannerMode === 'prop-hit-rate') {
                  return (
                    <Box>
                      <Typography level="body-lg" sx={{ mb: 2 }}>
                        Prop Hit Rate: {metadata.propHitRate ? `${(metadata.propHitRate * 100).toFixed(0)}%` : 'N/A'}
                      </Typography>
                      <Button
                        variant="solid"
                        onClick={() => navigate(`/player/${avatarModalData.playerId}`)}
                        sx={{ mt: 2 }}
                      >
                        View Player Page
                      </Button>
                    </Box>
                  )
                }
                return null
              })()}
            </Box>
          )}
          {avatarModalType === 'post' && avatarModalData?.postId && (
            <Box sx={{ p: 2 }}>
              <Typography level="h4" sx={{ mb: 2, fontFamily: 'serif', fontWeight: 900 }}>
                {avatarModalData.postTitle || 'Post'}
              </Typography>
              <Typography level="body-md" sx={{ mb: 2 }}>
                {avatarModalData.description || `View ${avatarModalData.playerName || 'player'}'s highlights`}
              </Typography>
              <Button
                variant="solid"
                onClick={() => {
                  setAvatarModalOpen(false)
                  // Navigate to the post by scrolling to it
                  const postElement = document.querySelector(`[data-post-id="${avatarModalData.postId}"]`)
                  if (postElement) {
                    postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }}
                sx={{ mt: 2, mr: 2 }}
              >
                View Post
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  // Share functionality
                  const shareUrl = `${window.location.origin}/?postId=${avatarModalData.postId}`
                  if (navigator.share) {
                    navigator.share({
                      title: avatarModalData.postTitle || 'Check out this highlight',
                      text: avatarModalData.description || '',
                      url: shareUrl,
                    })
                  } else {
                    navigator.clipboard.writeText(shareUrl)
                    // Could show a toast here
                  }
                }}
                sx={{ mt: 2 }}
              >
                Share
              </Button>
            </Box>
          )}
        </ModalDialog>
      </Modal>
    </Box>
  )
}

