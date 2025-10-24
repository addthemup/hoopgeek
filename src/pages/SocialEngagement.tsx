import React, { useState, useEffect } from 'react'
import { Box, IconButton, Typography, Stack, Menu, MenuItem, Modal, ModalDialog, ModalClose, Textarea, Button, Divider } from '@mui/joy'
import Favorite from '@mui/icons-material/Favorite'
import FavoriteBorder from '@mui/icons-material/FavoriteBorder'
import Comment from '@mui/icons-material/Comment'
import Share from '@mui/icons-material/Share'
import Twitter from '@mui/icons-material/Twitter'
import Facebook from '@mui/icons-material/Facebook'
import ContentCopy from '@mui/icons-material/ContentCopy'
import { SocialService } from './socialService.ts'

interface SocialEngagementProps {
  contentId: string
  userId?: string
  username?: string
  initialLikes?: number
  initialComments?: number
  initialShares?: number
  userLiked?: boolean
  compact?: boolean
}

export default function SocialEngagement({
  contentId,
  userId = 'anonymous',
  username = 'Anonymous',
  initialLikes = 0,
  initialComments = 0,
  initialShares = 0,
  userLiked = false,
  compact = false
}: SocialEngagementProps) {
  const [likes, setLikes] = useState(initialLikes)
  const [comments, setComments] = useState(initialComments)
  const [shares, setShares] = useState(initialShares)
  const [liked, setLiked] = useState(userLiked)
  const [loading, setLoading] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [shareAnchorEl, setShareAnchorEl] = useState<null | HTMLElement>(null)
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Load engagement stats on mount
  useEffect(() => {
    loadEngagementStats()
  }, [contentId])

  const loadEngagementStats = async () => {
    try {
      const stats = await SocialService.getEngagementStats(contentId)
      setLikes(stats.likesCount)
      setComments(stats.commentsCount)
      setShares(stats.sharesCount)
      setLiked(stats.userLiked)
    } catch (error) {
      console.error('Error loading engagement stats:', error)
    }
  }

  const handleLike = async () => {
    if (loading) return
    
    setLoading(true)
    try {
      const result = await SocialService.toggleLike(contentId, userId)
      setLiked(result.liked)
      setLikes(result.likesCount)
    } catch (error) {
      console.error('Error toggling like:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleComment = async () => {
    if (!commentText.trim() || submittingComment) return
    
    setSubmittingComment(true)
    try {
      await SocialService.addComment(contentId, userId, username, commentText.trim())
      setComments(prev => prev + 1)
      setCommentText('')
      setCommentDialogOpen(false)
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleShare = async (platform: 'twitter' | 'facebook' | 'copy') => {
    try {
      await SocialService.shareToExternal(contentId, platform)
      
      // Record the share in database
      await SocialService.shareContent(contentId, userId, platform)
      setShares(prev => prev + 1)
      setShareMenuOpen(false)
    } catch (error) {
      console.error('Error sharing:', error)
    }
  }

  if (compact) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <IconButton
          size="sm"
          variant={liked ? "solid" : "plain"}
          color={liked ? "danger" : "neutral"}
          onClick={handleLike}
          disabled={loading}
        >
          {liked ? <Favorite /> : <FavoriteBorder />}
        </IconButton>
        <Typography level="body-xs">{likes}</Typography>
        
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={() => setCommentDialogOpen(true)}
        >
          <Comment />
        </IconButton>
        <Typography level="body-xs">{comments}</Typography>
        
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={(event) => {
            setShareAnchorEl(event.currentTarget)
            setShareMenuOpen(true)
          }}
        >
          <Share />
        </IconButton>
        <Typography level="body-xs">{shares}</Typography>
      </Stack>
    )
  }

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
        {/* Like Button */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            variant={liked ? "solid" : "plain"}
            color={liked ? "danger" : "neutral"}
            onClick={handleLike}
            disabled={loading}
            sx={{
              minWidth: 40,
              minHeight: 40,
              borderRadius: '50%',
              backgroundColor: liked ? 'var(--accent-red)' : 'rgba(255,255,255,0.2)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                backgroundColor: liked ? 'var(--accent-red)' : 'rgba(255,255,255,0.3)'
              }
            }}
          >
            {liked ? <Favorite /> : <FavoriteBorder />}
          </IconButton>
          <Typography level="body-sm" sx={{ color: '#fff', fontWeight: 600 }}>
            {likes}
          </Typography>
        </Stack>

        {/* Comment Button */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            variant="plain"
            color="neutral"
            onClick={() => setCommentDialogOpen(true)}
            sx={{
              minWidth: 40,
              minHeight: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.3)'
              }
            }}
          >
            <Comment />
          </IconButton>
          <Typography level="body-sm" sx={{ color: '#fff', fontWeight: 600 }}>
            {comments}
          </Typography>
        </Stack>

        {/* Share Button */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            variant="plain"
            color="neutral"
            onClick={(event) => {
              setShareAnchorEl(event.currentTarget)
              setShareMenuOpen(true)
            }}
            sx={{
              minWidth: 40,
              minHeight: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.3)'
              }
            }}
          >
            <Share />
          </IconButton>
          <Typography level="body-sm" sx={{ color: '#fff', fontWeight: 600 }}>
            {shares}
          </Typography>
        </Stack>
      </Stack>

      {/* Share Menu */}
      <Menu
        open={shareMenuOpen}
        onClose={() => {
          setShareMenuOpen(false)
          setShareAnchorEl(null)
        }}
        anchorEl={shareAnchorEl}
        placement="bottom-end"
      >
        <MenuItem onClick={() => handleShare('twitter')}>
          <Twitter sx={{ mr: 1 }} />
          Share on Twitter
        </MenuItem>
        <MenuItem onClick={() => handleShare('facebook')}>
          <Facebook sx={{ mr: 1 }} />
          Share on Facebook
        </MenuItem>
        <MenuItem onClick={() => handleShare('copy')}>
          <ContentCopy sx={{ mr: 1 }} />
          Copy Link
        </MenuItem>
      </Menu>

      {/* Comment Modal */}
      <Modal open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Add a Comment
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Textarea
            placeholder="What do you think about this highlight?"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            minRows={3}
            maxRows={6}
            sx={{ mb: 2 }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button variant="plain" onClick={() => setCommentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleComment}
              disabled={!commentText.trim() || submittingComment}
              loading={submittingComment}
            >
              Post Comment
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </>
  )
}
