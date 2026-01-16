import { useState, useEffect, useMemo, useRef } from 'react'
import { Box, Avatar, Typography, Stack } from '@mui/joy'
import { motion, AnimatePresence } from 'framer-motion'

interface TimestampedComment {
  id: string
  content_id: string
  user_id: string
  username: string
  avatar_url?: string
  comment_text: string
  slide_index: number
  timestamp_seconds: number | null
  position_x?: number
  position_y?: number
  parent_comment_id: string | null
  created_at: string
}

interface TimestampedCommentsOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>
  currentSlideIndex: number
  contentId: string
  comments: TimestampedComment[]
  userId?: string
  onCommentClick?: (comment: TimestampedComment) => void
}

/**
 * Instagram Live / Twitch-style stream chat feed
 * Comments appear at bottom right, slide up and fade out
 */
export default function TimestampedCommentsOverlay({
  videoRef,
  currentSlideIndex,
  contentId,
  comments,
  userId,
  onCommentClick
}: TimestampedCommentsOverlayProps) {
  const [currentVideoTime, setCurrentVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [shownCommentIds, setShownCommentIds] = useState<Set<string>>(new Set())
  const timeUpdateIntervalRef = useRef<number>()
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Track video time updates and duration
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      if (timeUpdateIntervalRef.current) {
        cancelAnimationFrame(timeUpdateIntervalRef.current)
      }
      
      timeUpdateIntervalRef.current = requestAnimationFrame(() => {
        const newTime = video.currentTime
        setCurrentVideoTime(newTime)
        setIsPlaying(!video.paused)
      })
    }

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration || 0)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    // Set initial duration if already loaded
    if (video.duration) {
      setVideoDuration(video.duration)
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      if (timeUpdateIntervalRef.current) {
        cancelAnimationFrame(timeUpdateIntervalRef.current)
      }
    }
  }, [videoRef])

  // Filter comments for current slide
  const slideComments = useMemo(() => {
    return comments.filter(comment => {
      // Must be on current slide
      if (comment.slide_index !== currentSlideIndex) return false
      // Must have a timestamp (video comments only)
      if (!comment.timestamp_seconds) return false
      return true
    }).sort((a, b) => {
      // Sort by timestamp
      return (a.timestamp_seconds || 0) - (b.timestamp_seconds || 0)
    })
  }, [comments, currentSlideIndex])

  // Reset shown comments when slide changes
  useEffect(() => {
    setShownCommentIds(new Set())
  }, [currentSlideIndex])

  // Track which comments have been shown (to trigger animations)
  useEffect(() => {
    slideComments.forEach(comment => {
      const commentTime = comment.timestamp_seconds || 0
      // Show comment when video reaches its timestamp (within 0.1 seconds)
      if (currentVideoTime >= commentTime - 0.1 && !shownCommentIds.has(comment.id)) {
        setShownCommentIds(prev => new Set(prev).add(comment.id))
      }
    })
  }, [currentVideoTime, slideComments, shownCommentIds])

  // Get comments that should be visible in the chat feed
  // Show comments that have been triggered (reached their timestamp) and are still recent (within 8 seconds)
  const visibleComments = useMemo(() => {
    if (slideComments.length === 0) return []

    return slideComments
      .filter(comment => {
        const commentTime = comment.timestamp_seconds || 0
        const timeDiff = currentVideoTime - commentTime
        
        // Show comments that have been triggered and are within 8 seconds of current time
        return shownCommentIds.has(comment.id) && timeDiff >= 0 && timeDiff <= 8
      })
      .sort((a, b) => {
        // Sort by timestamp (oldest first, so with flex-end, newest appear at bottom)
        return (a.timestamp_seconds || 0) - (b.timestamp_seconds || 0)
      })
      .slice(-15) // Keep last 15 comments visible
  }, [slideComments, currentVideoTime, shownCommentIds])

  // Auto-scroll to bottom when new comments arrive (live stream behavior)
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current
      container.scrollTop = container.scrollHeight
    }
  }, [visibleComments.length])

  // Don't render if no comments for this slide
  if (slideComments.length === 0) {
    return null
  }

  // Format timestamp as MM:SS
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 80, // Above reaction bar
        right: 16,
        width: { xs: 'calc(100% - 32px)', sm: 320 },
        maxWidth: 320,
        maxHeight: 'calc(50% - 80px)',
        pointerEvents: 'none',
        zIndex: 15,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden'
      }}
    >
      {/* Stream Chat Feed - Text only, no background */}
      <Box
        ref={chatContainerRef}
        sx={{
          width: '100%',
          maxHeight: '100%',
          pointerEvents: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}
      >
        <Stack
          spacing={0.75}
          sx={{
            width: '100%',
            paddingBottom: 0
          }}
        >
          <AnimatePresence>
            {visibleComments.map((comment, index) => {
            const commentTime = comment.timestamp_seconds || 0
            const timeDiff = currentVideoTime - commentTime
            // Fade out as comment gets older (within the 8 second window)
            const opacity = Math.max(0, 1 - (timeDiff / 8))
            
            // Hide if opacity is 0
            if (opacity <= 0) {
              return null
            }
            
            return (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity, 
                  y: 0
                }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => {
                  e.stopPropagation() // Prevent video pause
                  onCommentClick?.(comment)
                }}
                style={{
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  width: '100%'
                }}
                data-clickable="true"
              >
                <Stack 
                  direction="row" 
                  spacing={1} 
                  alignItems="flex-start"
                  sx={{
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.6)',
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8))'
                  }}
                >
                  {/* Avatar */}
                  <Avatar
                    src={comment.avatar_url}
                    sx={{
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      border: '2px solid rgba(255, 255, 255, 0.9)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)'
                    }}
                  >
                    {comment.username.charAt(0).toUpperCase()}
                  </Avatar>
                  
                  {/* Comment Content - No background, just text */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                    <Typography
                      sx={{
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          textShadow: '0 2px 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7)'
                      }}
                    >
                      {comment.username}
                    </Typography>
                    <Typography
                        sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          textShadow: '0 2px 4px rgba(0, 0, 0, 0.9)'
                        }}
                      >
                        {formatTimestamp(commentTime)}
                      </Typography>
                    </Stack>
                    <Typography
                      sx={{
                        color: '#fff',
                        fontSize: '0.9rem',
                        lineHeight: 1.3,
                        wordBreak: 'break-word',
                        fontWeight: 500,
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.7)'
                      }}
                    >
                      {comment.comment_text}
                    </Typography>
                  </Box>
          </Stack>
              </motion.div>
            )
          })}
          </AnimatePresence>
        </Stack>
      </Box>
    </Box>
  )
}

