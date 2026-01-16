import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  Stack,
  Textarea,
  IconButton,
  Avatar,
  CircularProgress
} from '@mui/joy'
import Send from '@mui/icons-material/Send'
import Close from '@mui/icons-material/Close'
import Reply from '@mui/icons-material/Reply'
import { supabase } from '../utils/supabase'

interface Comment {
  id: string
  content_id: string
  user_id: string
  username: string
  comment_text: string
  parent_comment_id: string | null
  created_at: string
  slide_index?: number | null
  timestamp_seconds?: number | null
  position_x?: number | null
  position_y?: number | null
  avatar_url?: string | null
  replies?: Comment[]
}

interface CommentsDrawerProps {
  open: boolean
  onClose: () => void
  contentId: string
  userId: string
  username: string
  currentSlideIndex?: number
  currentVideoTime?: number
  onSeekToTime?: (time: number) => void
}

export default function CommentsDrawer({
  open,
  onClose,
  contentId,
  userId,
  username,
  currentSlideIndex = 0,
  currentVideoTime = 0,
  onSeekToTime
}: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [commentAtCurrentTime, setCommentAtCurrentTime] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      loadComments()
    }
  }, [open, contentId])

  const loadComments = async () => {
    setLoading(true)
    try {
      // First, get the comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('feed_comments')
        .select('*')
        .eq('content_id', contentId)
        .order('timestamp_seconds', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true })

      if (commentsError) throw commentsError

      if (!commentsData || commentsData.length === 0) {
        setComments([])
        setLoading(false)
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

      // Transform data to include avatar_url
      const commentsWithAvatars = commentsData.map((comment: any) => ({
        ...comment,
        avatar_url: avatarMap.get(comment.user_id) || null
      }))

      // Organize comments into threads
      const commentMap = new Map<string, Comment>()
      const topLevelComments: Comment[] = []

      // First pass: create map
      commentsWithAvatars.forEach((comment: Comment) => {
        commentMap.set(comment.id, { ...comment, replies: [] })
      })

      // Second pass: organize into threads
      commentsWithAvatars.forEach((comment: Comment) => {
        const commentWithReplies = commentMap.get(comment.id)!
        
        if (comment.parent_comment_id) {
          const parent = commentMap.get(comment.parent_comment_id)
          if (parent) {
            parent.replies = parent.replies || []
            parent.replies.push(commentWithReplies)
          }
        } else {
          topLevelComments.push(commentWithReplies)
        }
      })

      setComments(topLevelComments)
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return

    setSubmitting(true)
    try {
      const commentData: any = {
        content_id: contentId,
        user_id: userId,
        username: username,
        comment_text: newComment.trim(),
        parent_comment_id: replyingTo || null
      }

      // Add timestamp if "Comment at current time" is enabled
      if (commentAtCurrentTime && currentVideoTime >= 0) {
        commentData.slide_index = currentSlideIndex
        commentData.timestamp_seconds = Math.round(currentVideoTime * 100) / 100 // Round to 2 decimals
      }

      const { error } = await supabase
        .from('feed_comments')
        .insert([commentData])

      if (error) throw error

      // Reload comments
      await loadComments()
      setNewComment('')
      setReplyingTo(null)
      setCommentAtCurrentTime(false)
      
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }, 100)
    } catch (error) {
      console.error('Error posting comment:', error)
      alert('Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  // Format timestamp as MM:SS
  const formatTimestamp = (seconds: number | null | undefined): string => {
    if (seconds == null) return ''
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const timeAgo = getTimeAgo(comment.created_at)
    const hasTimestamp = comment.timestamp_seconds != null

    return (
      <Box sx={{ ml: depth * 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <Avatar
            size="sm"
            src={comment.avatar_url || undefined}
            sx={{
              width: 32,
              height: 32,
              flexShrink: 0,
              fontSize: '0.75rem'
            }}
          >
            {comment.username.charAt(0).toUpperCase()}
          </Avatar>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ flexWrap: 'wrap' }}>
              <Typography level="title-sm" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                {comment.username}
              </Typography>
              {hasTimestamp && (
                <Typography
                  level="body-xs"
                  onClick={() => onSeekToTime?.(comment.timestamp_seconds!)}
                  sx={{ 
                    color: 'primary.500',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  @ {formatTimestamp(comment.timestamp_seconds)}
                </Typography>
              )}
              <Typography level="body-xs" sx={{ color: 'text.tertiary', fontSize: '0.7rem' }}>
                {timeAgo}
              </Typography>
            </Stack>
            
            <Typography level="body-sm" sx={{ fontSize: '0.85rem', wordBreak: 'break-word', mb: 0.5 }}>
              {comment.comment_text}
            </Typography>
            
            {depth < 2 && (
              <Typography
                level="body-xs"
                onClick={() => setReplyingTo(comment.id)}
                sx={{ 
                  color: 'text.tertiary',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  '&:hover': { color: 'text.primary' }
                }}
              >
                Reply
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </Box>
        )}
      </Box>
    )
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date().getTime()
    const then = new Date(timestamp).getTime()
    const diffInSeconds = Math.floor((now - then) / 1000)

    if (diffInSeconds < 60) return `${diffInSeconds}s`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
    return `${Math.floor(diffInSeconds / 86400)}d`
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: open ? '70%' : '0%',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(20px)',
        transition: 'height 0.3s ease-in-out',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Typography level="title-md" sx={{ color: '#fff', fontWeight: 700 }}>
          Comments {!loading && `(${comments.length})`}
        </Typography>
        <IconButton
          size="sm"
          variant="plain"
          onClick={onClose}
          sx={{ color: '#fff' }}
        >
          <Close />
        </IconButton>
      </Box>

      {/* Comments List */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          '&::-webkit-scrollbar': {
            width: '6px'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255,255,255,0.3)',
            borderRadius: '3px'
          }
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: '#fff' }} />
          </Box>
        ) : comments.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography level="body-sm" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              No comments yet. Be the first!
            </Typography>
          </Box>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)'
        }}
      >
        {replyingTo && (
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Reply fontSize="small" sx={{ color: 'rgba(255,255,255,0.6)' }} />
            <Typography level="body-sm" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Replying...
            </Typography>
            <Typography
              level="body-sm"
              onClick={() => setReplyingTo(null)}
              sx={{ 
                color: 'primary.500',
                cursor: 'pointer',
                ml: 'auto',
                fontWeight: 600
              }}
            >
              Cancel
            </Typography>
          </Box>
        )}
        
        {/* Comment at current time button */}
        {currentVideoTime > 0 && (
          <Box sx={{ mb: 1 }}>
            <Box
              onClick={() => setCommentAtCurrentTime(!commentAtCurrentTime)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.5,
                borderRadius: '6px',
                backgroundColor: commentAtCurrentTime 
                  ? 'rgba(255, 105, 180, 0.2)' 
                  : 'rgba(255,255,255,0.1)',
                border: `1px solid ${commentAtCurrentTime ? '#FF69B4' : 'rgba(255,255,255,0.2)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: commentAtCurrentTime 
                    ? 'rgba(255, 105, 180, 0.3)' 
                    : 'rgba(255,255,255,0.15)'
                }
              }}
            >
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: commentAtCurrentTime ? '#FF69B4' : 'rgba(255,255,255,0.3)',
                  border: `2px solid ${commentAtCurrentTime ? '#FF69B4' : 'rgba(255,255,255,0.5)'}`
                }}
              />
              <Typography level="body-xs" sx={{ color: '#fff', fontWeight: 600 }}>
                Comment at {formatTimestamp(currentVideoTime)}
              </Typography>
            </Box>
          </Box>
        )}
        
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <Avatar size="sm" sx={{ mb: 0.5 }}>
            {username.charAt(0).toUpperCase()}
          </Avatar>
          <Textarea
            placeholder={commentAtCurrentTime ? `Comment at ${formatTimestamp(currentVideoTime)}...` : "Add a comment..."}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            minRows={1}
            maxRows={3}
            sx={{ 
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: commentAtCurrentTime 
                ? '1px solid rgba(255, 105, 180, 0.4)' 
                : '1px solid rgba(255,255,255,0.2)',
              '&:focus-within': {
                border: commentAtCurrentTime 
                  ? '1px solid #FF69B4' 
                  : '1px solid rgba(255,255,255,0.4)'
              },
              '& textarea::placeholder': {
                color: 'rgba(255,255,255,0.5)'
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmitComment()
              }
            }}
          />
          <IconButton
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
            loading={submitting}
            sx={{
              backgroundColor: 'primary.500',
              color: '#fff',
              mb: 0.5,
              '&:hover': {
                backgroundColor: 'primary.600'
              },
              '&:disabled': {
                backgroundColor: 'rgba(255,255,255,0.2)'
              }
            }}
          >
            <Send />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  )
}

