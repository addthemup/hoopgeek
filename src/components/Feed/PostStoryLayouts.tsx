/**
 * Post story presentation: mobile reel hero (full-bleed vertical video) and
 * desktop blog-style article shell (Kibo blogpost–inspired layout; registry fetch failed).
 */
import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Box, IconButton, Typography } from '@mui/joy'
import ArrowBack from '@mui/icons-material/ArrowBack'
import type { FeedPost } from '../../types/feed'
import { useFeedVideoSync } from '../../hooks/useFeedVideoSync'
import { postReelVideoId } from '../../stores/feedVideoStore'
import { PostStoryTitleWithTeamLogos } from './PostStoryTitleWithTeamLogos'

export function PostStoryMobileReel({
  postId,
  videoUrls,
  post,
  onBack,
}: {
  postId: string
  /** Ordered MP4 URLs (e.g. full video_carousel); advances on end when length > 1. */
  videoUrls: string[]
  post: FeedPost
  onBack: () => void
}) {
  const reelId = postReelVideoId(postId)
  const { ref, requestPlay } = useFeedVideoSync(reelId)
  const reduceMotion = useReducedMotion()
  const [clipIndex, setClipIndex] = useState(0)
  const safeUrls = videoUrls.filter(Boolean)
  const currentUrl = safeUrls[clipIndex] ?? safeUrls[0]
  const multi = safeUrls.length > 1

  const goNextClip = useCallback(() => {
    if (safeUrls.length <= 1) return
    setClipIndex((i) => (i + 1) % safeUrls.length)
  }, [safeUrls.length])

  useEffect(() => {
    setClipIndex(0)
  }, [videoUrls])

  useEffect(() => {
    const v = ref.current
    if (!v || !currentUrl) return
    v.load()
    const t = requestAnimationFrame(() => {
      v.play().catch(() => {})
    })
    return () => cancelAnimationFrame(t)
  }, [currentUrl, ref])

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0.92 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.45 }}
      style={{ width: '100%', marginBottom: 16 }}
    >
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: { xs: 'min(72vh, 640px)', sm: 'min(56vh, 520px)' },
        bgcolor: '#000',
      }}
    >
      <video
        ref={ref}
        src={currentUrl}
        muted
        playsInline
        loop={!multi}
        style={{ width: '100%', height: '100%', minHeight: 'min(72vh, 640px)', objectFit: 'cover', display: 'block' }}
        onPlay={() => requestPlay(reelId, 'post')}
        onEnded={multi ? goNextClip : undefined}
      />
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          p: 1.5,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)',
        }}
      >
        <IconButton
          onClick={onBack}
          sx={{ color: '#fff', bgcolor: 'rgba(0,0,0,0.35)', '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' } }}
          aria-label="Back to feed"
        >
          <ArrowBack />
        </IconButton>
      </Box>
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
        }}
      >
        {multi && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mb: 1 }}>
            {safeUrls.map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: i === clipIndex ? '#FFC72C' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </Box>
        )}
        <PostStoryTitleWithTeamLogos
          post={post}
          level="h4"
          logoSize={40}
          sx={{
            color: '#fff',
            fontWeight: 800,
            fontFamily: '"Libre Baskerville", serif',
            lineHeight: 1.2,
            mb: 0.5,
          }}
        />
        {post.subtitle && (
          <Typography level="body-sm" sx={{ color: 'rgba(255,255,255,0.85)' }}>
            {post.subtitle}
          </Typography>
        )}
        <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.65)', mt: 1 }}>
          {post.author_name}
          {post.published_at && ` · ${new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
        </Typography>
      </Box>
    </Box>
    </motion.div>
  )
}

/** Mobile: article “blocks” below the full-bleed reel (rounded sheet, scrolls with page). */
export function PostStoryMobileArticleShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="article"
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        mt: 1,
        pt: 2,
        pb: 0,
        mx: { xs: -2, sm: -2 },
        px: { xs: 2, sm: 2 },
        borderRadius: 'md',
        bgcolor: '#0d0d0d',
        border: '1px solid',
        borderColor: 'neutral.800',
      }}
    >
      {children}
    </Box>
  )
}

/** Desktop: wide hero + body uses full feed content column (parent caps at CONTENT_MAX_WIDTH). */
export function PostStoryDesktopBlogShell({
  hero,
  children,
  /** When true (e.g. player_spotlight with reel), no top padding so the reel can sit flush under the app chrome. */
  compactTop = false,
}: {
  hero?: React.ReactNode
  children: React.ReactNode
  compactTop?: boolean
}) {
  return (
    <Box
      component="article"
      sx={{
        mx: 'auto',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        bgcolor: '#0d0d0d',
        pb: 8,
        pt: compactTop ? 0 : 1,
        overflowX: 'hidden',
      }}
    >
      {hero && (
        <Box
          sx={{
            mb: 3,
            overflow: 'hidden',
            borderRadius: 'lg',
            border: '1px solid',
            borderColor: 'neutral.800',
            bgcolor: 'neutral.950',
          }}
        >
          {hero}
        </Box>
      )}
      <Box sx={{ maxWidth: '100%', mx: 'auto', width: '100%', minWidth: 0 }}>{children}</Box>
    </Box>
  )
}
