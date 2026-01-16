import { useState, useRef, useEffect } from 'react'
import { Box, Input, IconButton, Stack, Avatar, Typography } from '@mui/joy'
import Send from '@mui/icons-material/Send'
import Close from '@mui/icons-material/Close'
import { supabase } from '../utils/supabase'

interface TimestampedComment {
  id: string
  content_id: string
  user_id: string
  username: string
  avatar_url?: string
  comment_text: string
  slide_index: number
  timestamp_seconds: number | null
  created_at: string
}

interface InlineCommentInputProps {
  contentId: string
  userId: string
  username: string
  currentSlideIndex: number
  currentVideoTime: number
  videoDuration: number
  isInputMode: boolean
  visibleComments: TimestampedComment[]
  onCommentAdded?: () => void
  onCloseInput?: () => void
}

/**
 * Comment bar that toggles between:
 * - Display mode: Shows comments popping up as video plays (SoundCloud style)
 * - Input mode: Shows comment input field when comment button is clicked
 * Positioned 25px above the reaction bar at bottom of post
 */
export default function InlineCommentInput({
  contentId,
  userId,
  username,
  currentSlideIndex,
  currentVideoTime,
  videoDuration,
  isInputMode,
  visibleComments,
  onCommentAdded,
  onCloseInput
}: InlineCommentInputProps) {
  const [commentText, setCommentText] = useState('')
  const [commentAtCurrentTime, setCommentAtCurrentTime] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSubmit = async () => {
    if (!commentText.trim() || submitting) return

    setSubmitting(true)
    try {
      const commentData: any = {
        content_id: contentId,
        user_id: userId,
        username: username,
        comment_text: commentText.trim(),
        slide_index: currentSlideIndex
      }

      // Add timestamp if enabled
      if (commentAtCurrentTime && videoDuration > 0) {
        commentData.timestamp_seconds = Math.round(currentVideoTime * 100) / 100 // Round to 2 decimals
      }

      const { error } = await supabase
        .from('feed_comments')
        .insert([commentData])

      if (error) throw error

      // Clear input and close input mode
      setCommentText('')
      // Reload comments to show the new one (small delay to ensure DB update completes)
      if (onCommentAdded) {
        setTimeout(() => {
          onCommentAdded()
        }, 100)
      }
      onCloseInput?.()
    } catch (error) {
      console.error('Error submitting comment:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Focus input when entering input mode
  useEffect(() => {
    if (isInputMode && inputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 100)
    }
  }, [isInputMode])

  // Don't render if no comments and not in input mode
  if (!isInputMode && visibleComments.length === 0) return null

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: '25px', // 25px above reaction bar
        left: 0,
        right: 0,
        zIndex: 15, // Above video but below modals
        pointerEvents: 'auto',
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        px: 2
      }}
    >
      {isInputMode ? (
        // Input Mode: Show comment input field (styled like search bar)
        <Box
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(232, 230, 224, 0.1)',
            borderRadius: '8px',
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            position: 'relative'
          }}
        >
          <Input
            ref={inputRef}
            placeholder={
              commentAtCurrentTime && videoDuration > 0
                ? `Comment at ${formatTimestamp(currentVideoTime)}...`
                : 'Add a comment...'
            }
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            startDecorator={
              <Avatar size="sm" sx={{ width: 24, height: 24 }}>
                {username.charAt(0).toUpperCase()}
              </Avatar>
            }
            endDecorator={
              <Stack direction="row" spacing={0.5} alignItems="center">
                {/* Timestamp toggle indicator */}
                {videoDuration > 0 && (
                  <Box
                    onClick={(e) => {
                      e.stopPropagation()
                      setCommentAtCurrentTime(!commentAtCurrentTime)
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    sx={{
                      fontSize: '0.65rem',
                      color: commentAtCurrentTime ? '#FFD700' : 'rgba(232, 230, 224, 0.4)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      px: 0.5,
                      '&:hover': {
                        opacity: 0.8
                      }
                    }}
                  >
                    {commentAtCurrentTime ? `@ ${formatTimestamp(currentVideoTime)}` : 'No timestamp'}
                  </Box>
                )}
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSubmit()
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  disabled={!commentText.trim() || submitting}
                  loading={submitting}
                  size="sm"
                  variant="plain"
                  sx={{
                    color: commentText.trim() ? '#FFD700' : 'rgba(232, 230, 224, 0.4)',
                    '&:hover': {
                      color: '#FFD700',
                      backgroundColor: 'rgba(255, 215, 0, 0.1)'
                    },
                    '&:disabled': {
                      color: 'rgba(232, 230, 224, 0.2)'
                    }
                  }}
                >
                  <Send fontSize="small" />
                </IconButton>
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseInput?.()
                  }}
                  onTouchStart={(e) => e.stopPropagation()}
                  size="sm"
                  variant="plain"
                  sx={{
                    color: 'rgba(232, 230, 224, 0.7)',
                    '&:hover': {
                      color: '#FFD700',
                      backgroundColor: 'rgba(255, 215, 0, 0.1)'
                    }
                  }}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Stack>
            }
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              } else if (e.key === 'Escape') {
                onCloseInput?.()
              }
            }}
            sx={{
              flex: 1,
              bgcolor: 'rgba(232, 230, 224, 0.05)',
              border: commentAtCurrentTime
                ? '1px solid rgba(255, 105, 180, 0.4)'
                : '1px solid rgba(232, 230, 224, 0.1)',
              color: 'rgba(232, 230, 224, 0.9)',
              '&:focus-within': {
                borderColor: commentAtCurrentTime ? '#FF69B4' : '#FFD700',
              },
              '& input::placeholder': {
                color: 'rgba(232, 230, 224, 0.4)',
              },
              '& input': {
                color: 'rgba(232, 230, 224, 0.9)',
              }
            }}
          />
        </Box>
      ) : (
        // Display Mode: Show comments popping up (SoundCloud style)
        visibleComments.length > 0 && (
          <Box
            sx={{
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              px: 2,
              py: 1.5,
              minHeight: '56px',
              overflowX: 'auto'
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              {visibleComments.map((comment) => {
                const commentTime = typeof comment.timestamp_seconds === 'string' 
                  ? parseFloat(comment.timestamp_seconds) 
                  : (comment.timestamp_seconds || 0)
                const timeDiff = commentTime - currentVideoTime
                const opacity = timeDiff > 0 
                  ? Math.max(0.4, 1 - (timeDiff / 2)) // Fade in as approaching
                  : Math.max(0.4, 1 - (Math.abs(timeDiff) / 3)) // Fade out after passing
                
                return (
                  <Box
                    key={comment.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      flexShrink: 0,
                      opacity: opacity,
                      transition: 'opacity 0.3s ease',
                      transform: timeDiff > 0 && timeDiff < 1 ? 'scale(1.05)' : 'scale(1)',
                      transitionProperty: 'opacity, transform'
                    }}
                  >
                    <Avatar
                      size="sm"
                      src={comment.avatar_url}
                      sx={{
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        border: timeDiff >= -0.5 && timeDiff <= 0.5
                          ? '2px solid rgba(255, 105, 180, 0.8)'
                          : '1px solid rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {comment.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        level="body-xs"
                        sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '0.7rem',
                          fontWeight: 500
                        }}
                      >
                        {comment.username}
                      </Typography>
                      <Typography
                        level="body-sm"
                        sx={{
                          color: '#fff',
                          fontSize: '0.8rem',
                          wordBreak: 'break-word',
                          lineHeight: 1.3
                        }}
                      >
                        {comment.comment_text}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Stack>
          </Box>
        )
      )}
    </Box>
  )
}

