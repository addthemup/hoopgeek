import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Box, IconButton, Typography, Stack, Menu, MenuItem, Avatar } from '@mui/joy'
import Favorite from '@mui/icons-material/Favorite'
import FavoriteBorder from '@mui/icons-material/FavoriteBorder'
import Comment from '@mui/icons-material/Comment'
import Share from '@mui/icons-material/Share'
import Visibility from '@mui/icons-material/Visibility'
import VolumeOff from '@mui/icons-material/VolumeOff'
import VolumeUp from '@mui/icons-material/VolumeUp'
import ZoomOut from '@mui/icons-material/ZoomOut'
import ZoomIn from '@mui/icons-material/ZoomIn'
import Twitter from '@mui/icons-material/Twitter'
import Facebook from '@mui/icons-material/Facebook'
import ContentCopy from '@mui/icons-material/ContentCopy'
import { SocialService } from './socialService.ts'
import CommentsModal from '../components/CommentsModal'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

interface SocialEngagementProps {
  contentId: string
  userId?: string
  username?: string
  initialLikes?: number
  initialComments?: number
  initialShares?: number
  initialViews?: number
  userLiked?: boolean
  compact?: boolean
  onCommentClick?: () => void
  videoRef?: React.RefObject<HTMLVideoElement>
  onVideoHeightToggle?: () => void
  videoHeightScale?: number // 1.0 = 3x (reel format), 0.8 = 2x (middle), 0.6 = 1x (contain)
  gameDate?: string
  gameTime?: string
  awayTeam?: string
  homeTeam?: string
  playerId?: number // nba_player_id
  playerName?: string
}

const SocialEngagement = React.memo(function SocialEngagement({
  contentId,
  userId = 'anonymous',
  username = 'Anonymous',
  initialLikes = 0,
  initialComments = 0,
  initialShares = 0,
  initialViews = 0,
  userLiked = false,
  compact = false,
  onCommentClick,
  videoRef,
  onVideoHeightToggle,
  videoHeightScale = 1.0,
  gameDate,
  gameTime,
  awayTeam,
  homeTeam,
  playerId,
  playerName
}: SocialEngagementProps) {
  const navigate = useNavigate()
  const [likes, setLikes] = useState(initialLikes)
  const [comments, setComments] = useState(initialComments)
  const [shares, setShares] = useState(initialShares)
  const [views, setViews] = useState(initialViews)
  const [liked, setLiked] = useState(userLiked)
  const [loading, setLoading] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [shareAnchorEl, setShareAnchorEl] = useState<null | HTMLElement>(null)
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const [likeAnimating, setLikeAnimating] = useState(false)
  const likeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingRef = useRef(false) // Prevent double-clicks
  const [playerUuid, setPlayerUuid] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState(false)

  // Handle sound toggle
  const handleSoundToggle = () => {
    if (videoRef?.current) {
      const video = videoRef.current
      if (soundOn) {
        video.muted = true
        setSoundOn(false)
      } else {
        video.muted = false
        setSoundOn(true)
      }
    }
  }

  // Load engagement stats on mount
  useEffect(() => {
    loadEngagementStats()
  }, [contentId])

  // Fetch player UUID for navigation
  useEffect(() => {
    const fetchPlayerUuid = async () => {
      if (!playerId) return
      
      const { data: nbaPlayer } = await supabase
        .from('nba_players')
        .select('id')
        .eq('nba_player_id', playerId)
        .maybeSingle()
      
      if (nbaPlayer?.id) {
        setPlayerUuid(nbaPlayer.id)
      }
    }
    
    fetchPlayerUuid()
  }, [playerId])

  // Handle player avatar click
  const handlePlayerAvatarClick = useCallback((e: React.MouseEvent) => {
    if (!playerUuid) return
    
    e.stopPropagation()
    navigate(`/player/${playerUuid}`)
  }, [playerUuid, navigate])
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (likeTimeoutRef.current) {
        clearTimeout(likeTimeoutRef.current)
      }
    }
  }, [])

  const loadEngagementStats = async () => {
    try {
      const stats = await SocialService.getEngagementStats(contentId)
      setLikes(stats.likesCount)
      setComments(stats.commentsCount)
      setShares(stats.sharesCount)
      setViews(stats.viewsCount || initialViews)
      setLiked(stats.userLiked)
    } catch (error) {
      console.error('Error loading engagement stats:', error)
    }
  }

  const handleLike = useCallback(async () => {
    // Prevent double-clicks and rapid-fire clicks
    if (isProcessingRef.current) return
    
    // Optimistic UI update - update immediately for instant feedback
    const previousLiked = liked
    const previousLikes = likes
    
    // Update UI instantly
    setLiked(!liked)
    setLikes(prev => liked ? prev - 1 : prev + 1)
    setLikeAnimating(true)
    isProcessingRef.current = true
    
    // Clear any existing timeout
    if (likeTimeoutRef.current) {
      clearTimeout(likeTimeoutRef.current)
    }
    
    // Animate for 200ms
    likeTimeoutRef.current = setTimeout(() => {
      setLikeAnimating(false)
    }, 200)
    
    try {
      // Make the actual API call in the background
      const result = await SocialService.toggleLike(contentId, userId)
      
      // Sync with server response (in case of race conditions or errors)
      setLiked(result.liked)
      setLikes(result.likesCount)
    } catch (error) {
      console.error('Error toggling like:', error)
      // Rollback on error
      setLiked(previousLiked)
      setLikes(previousLikes)
    } finally {
      isProcessingRef.current = false
    }
  }, [contentId, userId, liked, likes])

  const handleCommentModalClose = () => {
    setCommentDialogOpen(false)
    // Reload engagement stats to update comment count
    loadEngagementStats()
  }

  const handleShare = async (platform: 'twitter' | 'facebook' | 'copy') => {
    try {
      await SocialService.shareToExternal(contentId, platform)
      
      // Track share in database
      if (userId && userId !== 'anonymous') {
        try {
          await SocialService.shareContent(contentId, userId, platform)
        } catch (error) {
          console.error('Error tracking share:', error)
          // Continue even if tracking fails
        }
      }
      
      // Update local state and reload stats
      setShares(prev => prev + 1)
      setShareMenuOpen(false)
      
      // Reload engagement stats to get accurate count from database
      loadEngagementStats()
    } catch (error) {
      console.error('Error sharing:', error)
    }
  }

  // Get zoom multiplier text
  const getZoomMultiplier = () => {
    if (videoHeightScale === 1.0) return '3x'
    if (videoHeightScale === 0.8) return '2x'
    return '1x'
  }

  if (compact) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 900
    
    return (
      <>
        {/* Top Row: Zoom and Volume buttons only (mobile only) */}
        {isMobile && (onVideoHeightToggle || videoRef) && (
          <Stack 
            direction="row" 
            spacing={1} 
            alignItems="center"
            sx={{ width: '100%', mb: 1 }}
          >
            {/* Video Height Toggle - only show on mobile if callback provided */}
            {onVideoHeightToggle && (
              <IconButton
                size="md"
                variant="solid"
                color="neutral"
                onClick={(e) => {
                  e.stopPropagation()
                  onVideoHeightToggle()
                }}
                sx={{
                  '& svg': {
                    fontSize: 27,
                  },
                }}
              >
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ZoomIn sx={{ fontSize: 27 }} />
                  <Typography 
                    level="body-xs" 
                    sx={{ 
                      position: 'absolute',
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      color: '#000',
                      bottom: 2,
                      right: 2,
                      lineHeight: 1,
                    }}
                  >
                    {getZoomMultiplier()}
                  </Typography>
                </Box>
              </IconButton>
            )}
            
            {/* Sound Toggle - only show if videoRef is provided */}
            {videoRef && (
              <IconButton
                size="md"
                variant={soundOn ? "solid" : "plain"}
                color="neutral"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSoundToggle()
                }}
                sx={{
                  '& svg': {
                    fontSize: 27,
                  },
                }}
              >
                {soundOn ? <VolumeUp /> : <VolumeOff />}
              </IconButton>
            )}
          </Stack>
        )}

        {/* Second Row: Game Date/Time and Matchup (mobile only, above react icons) */}
        {isMobile && (gameDate || gameTime || awayTeam || homeTeam) && (
          <Stack 
            direction="row" 
            spacing={2} 
            alignItems="center" 
            justifyContent="flex-end"
            sx={{ width: '100%', mb: 1 }}
          >
            {/* Date stacked on Time */}
            {(gameDate || gameTime) && (
              <Stack spacing={0} alignItems="flex-end">
                {gameDate && (
                  <Typography level="body-xs" sx={{ fontSize: '0.875rem', color: '#FFFFFF', fontWeight: 500 }}>
                    {new Date(gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Typography>
                )}
                {gameTime && (
                  <Typography level="body-xs" sx={{ fontSize: '0.75rem', color: '#CCCCCC' }}>
                    {gameTime}
                  </Typography>
                )}
              </Stack>
            )}
            
            {/* Away @ stacked on Home */}
            {(awayTeam || homeTeam) && (
              <Stack spacing={0} alignItems="flex-end">
                {awayTeam && (
                  <Typography level="body-xs" sx={{ fontSize: '0.875rem', color: '#FFFFFF', fontWeight: 500 }}>
                    {awayTeam} @
                  </Typography>
                )}
                {homeTeam && (
                  <Typography level="body-xs" sx={{ fontSize: '0.875rem', color: '#FFFFFF', fontWeight: 500 }}>
                    {homeTeam}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        )}

        {/* Bottom Row: Social Engagement Buttons */}
        <Stack 
          direction="row" 
          spacing={1.5} 
          alignItems="center" 
          justifyContent="space-between"
          sx={{ width: '100%' }}
        >
          {/* Heart */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <IconButton
              size="md"
              variant={liked ? "solid" : "plain"}
              color={liked ? "danger" : "neutral"}
              onClick={(e) => {
                e.stopPropagation()
                handleLike()
              }}
              disabled={isProcessingRef.current}
              sx={{
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: likeAnimating ? 'scale(1.2)' : 'scale(1)',
                '&:active': {
                  transform: 'scale(0.95)',
                },
                '& svg': {
                  fontSize: 27,
                },
              }}
            >
              {liked ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
            <Typography level="body-xs" sx={{ fontSize: '1.5em' }}>{likes}</Typography>
          </Stack>
          
          {/* Comment */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <IconButton
              size="md"
              variant="plain"
              color="neutral"
              onClick={(e) => {
                e.stopPropagation()
                if (onCommentClick) {
                  onCommentClick()
                } else {
                  setCommentDialogOpen(true)
                }
              }}
              sx={{
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:active': {
                  transform: 'scale(0.9)',
                },
                '& svg': {
                  fontSize: 27,
                },
              }}
            >
              <Comment />
            </IconButton>
            <Typography level="body-xs" sx={{ fontSize: '1.5em' }}>{comments}</Typography>
          </Stack>
          
          {/* Share */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <IconButton
              size="md"
              variant="plain"
              color="neutral"
              onClick={(event) => {
                event.stopPropagation()
                setShareAnchorEl(event.currentTarget)
                setShareMenuOpen(true)
              }}
              sx={{
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:active': {
                  transform: 'scale(0.9)',
                },
                '& svg': {
                  fontSize: 27,
                },
              }}
            >
              <Share />
            </IconButton>
            <Typography level="body-xs" sx={{ fontSize: '1.5em' }}>{shares}</Typography>
          </Stack>
          
          {/* Views (read-only) */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Visibility sx={{ fontSize: 27, opacity: 0.7 }} />
            <Typography level="body-xs" sx={{ fontSize: '1.5em' }}>{views.toLocaleString()}</Typography>
          </Stack>
          
          {/* Player Avatar - far right */}
          {playerId && (
            <IconButton
              size="md"
              variant="plain"
              color="neutral"
              onClick={handlePlayerAvatarClick}
              sx={{
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:active': {
                  transform: 'scale(0.9)',
                },
                p: 0.75,
              }}
            >
              <Avatar
                src={avatarError ? undefined : `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`}
                alt={playerName || 'Player'}
                size="md"
                sx={{
                  width: 36,
                  height: 36,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  '& img': {
                    objectFit: 'cover',
                  },
                }}
                onError={() => setAvatarError(true)}
              >
                {playerName ? playerName.charAt(0).toUpperCase() : 'P'}
              </Avatar>
            </IconButton>
          )}
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

        {/* Comments Modal */}
        <CommentsModal
          open={commentDialogOpen}
          onClose={handleCommentModalClose}
          contentId={contentId}
          userId={userId}
          username={username}
        />
      </>
    )
  }

  return (
    <>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
        {/* Views (read-only) */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              minWidth: 40,
              minHeight: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Visibility sx={{ fontSize: 20 }} />
          </Box>
          <Typography level="body-sm" sx={{ color: '#fff', fontWeight: 600 }}>
            {views.toLocaleString()}
          </Typography>
        </Stack>
        
        {/* Like Button */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            variant={liked ? "solid" : "plain"}
            color={liked ? "danger" : "neutral"}
            onClick={(e) => {
              e.stopPropagation()
              handleLike()
            }}
            disabled={isProcessingRef.current}
            sx={{
              minWidth: 40,
              minHeight: 40,
              borderRadius: '50%',
              backgroundColor: liked ? '#ef4444' : 'rgba(255,255,255,0.2)',
              color: '#fff',
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: likeAnimating ? 'scale(1.3)' : 'scale(1)',
              '&:hover': {
                backgroundColor: liked ? '#dc2626' : 'rgba(255,255,255,0.3)',
                transform: likeAnimating ? 'scale(1.3)' : 'scale(1.1)',
              },
              '&:active': {
                transform: 'scale(0.9)',
              },
            }}
          >
            {liked ? <Favorite /> : <FavoriteBorder />}
          </IconButton>
          <Typography 
            level="body-sm" 
            sx={{ 
              color: '#fff', 
              fontWeight: 600,
              transition: 'all 0.15s ease-out',
              transform: likeAnimating ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            {likes}
          </Typography>
        </Stack>

        {/* Comment Button */}
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            variant="plain"
            color="neutral"
            onClick={(e) => {
              e.stopPropagation()
              setCommentDialogOpen(true)
            }}
            sx={{
              minWidth: 40,
              minHeight: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.3)',
                transform: 'scale(1.1)',
              },
              '&:active': {
                transform: 'scale(0.9)',
              },
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
              event.stopPropagation()
              setShareAnchorEl(event.currentTarget)
              setShareMenuOpen(true)
            }}
            sx={{
              minWidth: 40,
              minHeight: 40,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.3)',
                transform: 'scale(1.1)',
              },
              '&:active': {
                transform: 'scale(0.9)',
              },
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

      {/* Comments Modal */}
      <CommentsModal
        open={commentDialogOpen}
        onClose={handleCommentModalClose}
        contentId={contentId}
        userId={userId}
        username={username}
      />
    </>
  )
})

export default SocialEngagement
