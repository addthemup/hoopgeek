import { useState, useEffect } from 'react'
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Stack,
  Box,
  Textarea,
  Button,
  Avatar,
  IconButton,
  Divider,
  CircularProgress
} from '@mui/joy'
import Send from '@mui/icons-material/Send'
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
  replies?: Comment[]
}

interface CommentsModalProps {
  open: boolean
  onClose: () => void
  contentId: string
  userId: string
  username: string
}

export default function CommentsModal({
  open,
  onClose,
  contentId,
  userId,
  username
}: CommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      loadComments()
    }
  }, [open, contentId])

  const loadComments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('feed_comments')
        .select('*')
        .eq('content_id', contentId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Organize comments into threads
      const commentMap = new Map<string, Comment>()
      const topLevelComments: Comment[] = []

      // First pass: create map
      data?.forEach((comment: Comment) => {
        commentMap.set(comment.id, { ...comment, replies: [] })
      })

      // Second pass: organize into threads
      data?.forEach((comment: Comment) => {
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
      const { error } = await supabase
        .from('feed_comments')
        .insert([
          {
            content_id: contentId,
            user_id: userId,
            username: username,
            comment_text: newComment.trim(),
            parent_comment_id: replyingTo
          }
        ])

      if (error) throw error

      // Reload comments
      await loadComments()
      setNewComment('')
      setReplyingTo(null)
    } catch (error) {
      console.error('Error posting comment:', error)
      alert('Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const timeAgo = getTimeAgo(comment.created_at)

    return (
      <Box sx={{ ml: depth * 3 }}>
        <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
          <Avatar
            size="sm"
            sx={{
              width: depth === 0 ? 40 : 32,
              height: depth === 0 ? 40 : 32,
              flexShrink: 0
            }}
          >
            {comment.username.charAt(0).toUpperCase()}
          </Avatar>
          
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography level="title-sm" sx={{ fontWeight: 700 }}>
                {comment.username}
              </Typography>
              <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                {timeAgo}
              </Typography>
            </Stack>
            
            <Typography level="body-sm" sx={{ mb: 1, wordBreak: 'break-word' }}>
              {comment.comment_text}
            </Typography>
            
            {depth < 2 && (
              <IconButton
                size="sm"
                variant="plain"
                onClick={() => setReplyingTo(comment.id)}
                sx={{ p: 0, minHeight: 'auto' }}
              >
                <Reply fontSize="small" />
                <Typography level="body-xs" sx={{ ml: 0.5 }}>
                  Reply
                </Typography>
              </IconButton>
            )}
          </Box>
        </Stack>

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <Box sx={{ mt: 1 }}>
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
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: 600,
          width: '100%',
          maxHeight: '80vh',
          p: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography level="h4">
              Comments {!loading && `(${comments.length})`}
            </Typography>
            <ModalClose />
          </Stack>
        </Box>

        {/* Comments List */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
            '&::-webkit-scrollbar': {
              width: '8px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '4px'
            }
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : comments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography level="body-sm" sx={{ color: 'text.tertiary' }}>
                No comments yet. Be the first to comment!
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
            borderTop: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.surface'
          }}
        >
          {replyingTo && (
            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Reply fontSize="small" />
              <Typography level="body-sm">
                Replying to comment
              </Typography>
              <Button
                size="sm"
                variant="plain"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </Box>
          )}
          
          <Stack direction="row" spacing={1}>
            <Avatar size="sm">
              {username.charAt(0).toUpperCase()}
            </Avatar>
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              minRows={1}
              maxRows={4}
              sx={{ flex: 1 }}
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
              color="primary"
            >
              <Send />
            </IconButton>
          </Stack>
        </Box>
      </ModalDialog>
    </Modal>
  )
}

