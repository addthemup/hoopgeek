/**
 * PostStory — Full scrollable story page for a single feed post.
 *
 * Route: /feed/:slug
 * Loads the post + its sections from Supabase and renders each section
 * as a typed component. Engagement bar at the bottom.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Avatar,
  IconButton,
  Textarea,
  Button,
  Divider,
  Stack,
} from '@mui/joy'
import ArrowBack from '@mui/icons-material/ArrowBack'
import Favorite from '@mui/icons-material/Favorite'
import FavoriteBorder from '@mui/icons-material/FavoriteBorder'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline'
import Share from '@mui/icons-material/Share'
import BookmarkBorder from '@mui/icons-material/BookmarkBorder'
import Bookmark from '@mui/icons-material/Bookmark'
import ContentCopy from '@mui/icons-material/ContentCopy'
import Send from '@mui/icons-material/Send'
import Reply from '@mui/icons-material/Reply'
import { supabase } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import { FANDUEL_SCORING } from '../utils/fantasyScoring'
import {
  toggleLike,
  toggleBookmark,
  recordShare,
  shareToExternal,
  recordView,
  getComments,
  addComment,
  getEngagementStats,
} from './socialService'
import type {
  FeedPost,
  FeedPostSection,
  FeedPostComment,
  PostType,
  SectionType,
  HeroContent,
  HeadlineContent,
  LineupCardContent,
  PlayerHighlightContent,
  StatComparisonContent,
  VideoClipContent,
  VideoCarouselContent,
  RichTextContent,
  PropCardContent,
  InjuryCardContent,
  PullQuoteContent,
  GalleryContent,
  BoxScoreContent,
  DataOverlay,
  LineupPlayer,
} from '../types/feed'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { getTeamPrimaryColor } from '../utils/nbaTeamColors'
import PlayerJersey from '../components/PlayerJersey'

// ─── Type badge colors ──────────────────────────────────────

const POST_TYPE_COLORS: Record<PostType, string> = {
  game_recap: '#FFC72C',
  player_spotlight: '#60A5FA',
  team_of_night: '#F59E0B',
  team_of_week: '#A78BFA',
  player_of_week: '#34D399',
  player_of_month: '#F472B6',
  prop_prediction: '#FB923C',
  prop_results: '#10B981',
  injury_report: '#EF4444',
  upcoming: '#8B5CF6',
  blog: '#0EA5E9',
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  game_recap: 'Game Recap',
  player_spotlight: 'Player Spotlight',
  team_of_night: 'Team of the Night',
  team_of_week: 'Team of the Week',
  player_of_week: 'Player of the Week',
  player_of_month: 'Player of the Month',
  prop_prediction: 'Prop Prediction',
  prop_results: 'Prop Results',
  injury_report: 'Injury Report',
  upcoming: 'Upcoming',
  blog: 'Blog',
}

// ─── Data hooks ─────────────────────────────────────────────

function usePostBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['feed-post', slug],
    queryFn: async (): Promise<FeedPost | null> => {
      if (!slug) return null
      const { data, error } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle()
      if (error) throw error
      return data as FeedPost | null
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  })
}

function usePostSections(postId: string | undefined) {
  return useQuery({
    queryKey: ['feed-post-sections', postId],
    queryFn: async (): Promise<FeedPostSection[]> => {
      if (!postId) return []
      const { data, error } = await supabase
        .from('feed_post_sections')
        .select('*')
        .eq('post_id', postId)
        .order('section_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as FeedPostSection[]
    },
    enabled: !!postId,
    staleTime: 1000 * 60 * 5,
  })
}

// ─── Section renderers ──────────────────────────────────────

function formatMinStat(min: number): string {
  if (min == null || min < 0) return '—'
  const m = Math.floor(min)
  const s = Math.round((min % 1) * 60)
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(m)
}

function HeroSection({ content }: { content: HeroContent }) {
  const stats = content.player_stats
  const statRows = stats
    ? [
        { label: 'pts', value: stats.pts },
        { label: 'reb', value: stats.reb },
        { label: 'ast', value: stats.ast },
        { label: 'stl', value: stats.stl },
        { label: 'blk', value: stats.blk },
        { label: 'min', value: stats.min != null ? formatMinStat(stats.min) : undefined },
      ].filter((r) => r.value !== undefined && r.value !== null)
    : []

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: { xs: 200, md: 10 },
        background: content.image_url
          ? `url(${content.image_url}) center/cover`
          : `linear-gradient(135deg, ${content.team_tricode ? getTeamPrimaryColor(content.team_tricode) ?? '#333' : '#333'} 0%, #111 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        borderRadius: '12px',
        overflow: 'hidden',
        p: 3,
        pb: 3,
      }}
    >
      {content.gradient_overlay && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)',
          }}
        />
      )}
      {content.badge && (
        <Chip
          size="sm"
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            bgcolor: '#FFC72C',
            color: '#000',
            fontWeight: 700,
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {content.badge}
        </Chip>
      )}
      {/* Game Recap: badge + score line + team chips (no matchup text repeat) */}
      {content.score_line != null && (
        <Box sx={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <Typography
            sx={{
              color: '#FFF',
              fontWeight: 700,
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              lineHeight: 1.2,
              letterSpacing: '0.02em',
            }}
          >
            {content.score_line}
          </Typography>
          {content.team_tricodes && content.team_tricodes.length >= 2 && (
            <Stack direction="row" gap={1} sx={{ mt: 1 }}>
              {content.team_tricodes.map((tri) => (
                <Chip
                  key={tri}
                  size="sm"
                  variant="soft"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: '#FFF',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                >
                  {tri}
                </Chip>
              ))}
            </Stack>
          )}
        </Box>
      )}
      {/* Player Spotlight: name + team + stats */}
      {content.player_name && !content.score_line && (
        <Box sx={{ position: 'relative', zIndex: 1, width: '100%' }}>
          <Typography
            sx={{
              color: '#FFF',
              fontWeight: 700,
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              lineHeight: 1.2,
            }}
          >
            {content.player_name}
          </Typography>
          {content.team_tricode && (
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 600,
                fontSize: '0.9rem',
                mt: 0.5,
              }}
            >
              {content.team_tricode}
            </Typography>
          )}
          {statRows.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mt: 1.5 }}>
              {statRows.map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                  </Typography>
                  <Typography sx={{ color: '#FFF', fontWeight: 700, fontSize: '0.95rem' }}>
                    {typeof value === 'number' ? value : value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  )
}

function HeadlineSection({ content }: { content: HeadlineContent }) {
  return (
    <Box sx={{ py: 2 }}>
      <Typography
        level="h3"
        sx={{
          fontFamily: '"Libre Baskerville", serif',
          fontWeight: 700,
          color: content.accent_color ?? '#FFFFFF',
          fontSize: { xs: '1.3rem', md: '1.6rem' },
          lineHeight: 1.3,
        }}
      >
        {content.text}
      </Typography>
      {content.subtitle && (
        <Typography level="body-md" sx={{ color: '#AAA', mt: 1 }}>
          {content.subtitle}
        </Typography>
      )}
    </Box>
  )
}

const LINEUP_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
  gap: 2,
}

/** Single lineup player cell: slideshow of MP4 highlights when video_clips exist, else jersey only */
function LineupPlayerCell({ player, idx }: { player: LineupPlayer; idx: number }) {
  const clips = player.video_clips?.length ? player.video_clips : []
  const [clipIndex, setClipIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const currentClip = clips[clipIndex]

  // When clip index changes, play the new clip
  useEffect(() => {
    if (!currentClip?.mp4 || !videoRef.current) return
    const v = videoRef.current
    v.src = currentClip.mp4
    v.load()
    v.play().catch(() => {})
  }, [clipIndex, currentClip?.mp4])

  const goNext = useCallback(() => {
    setClipIndex(i => (i + 1) % clips.length)
  }, [clips.length])

  return (
    <Box
      key={player.player_id || idx}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        p: 1.5,
        borderRadius: 'sm',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid #222',
      }}
    >
      {clips.length > 0 ? (
        <Box sx={{ width: '100%', borderRadius: 'sm', overflow: 'hidden', bgcolor: '#000' }}>
          <video
            ref={videoRef}
            src={currentClip?.mp4}
            muted
            autoPlay
            playsInline
            style={{ width: '100%', display: 'block', aspectRatio: '16/10', objectFit: 'cover' }}
            onEnded={goNext}
          />
          {clips.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, py: 0.5 }}>
              {clips.map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    bgcolor: i === clipIndex ? '#FFC72C' : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      ) : (
        <PlayerJersey
          playerName={player.name}
          jerseyNumber={player.jersey_number}
          nbaTeam={player.team_tricode}
          position={player.position}
          size="small"
          textColor="#FFFFFF"
        />
      )}
      <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600, mt: 1, lineHeight: 1.2 }}>
        {player.name}
      </Typography>
      <Typography level="body-xs" sx={{ color: '#888', mt: 0.25 }}>
        {player.team_tricode}{player.position ? ` · ${player.position}` : ''}
      </Typography>
      <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 700, mt: 0.5 }}>
        {player.fantasy_points?.toFixed(1)} FP
      </Typography>
    </Box>
  )
}

function LineupCardSection({ content }: { content: LineupCardContent }) {
  const renderPlayer = (player: LineupPlayer, idx: number) => (
    <LineupPlayerCell player={player} idx={idx} />
  )

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222' }}>
      <CardContent>
        <Typography level="title-sm" sx={{ color: '#FFC72C', mb: 1.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Starters
        </Typography>
        <Box sx={LINEUP_GRID_SX}>
          {content.starters?.map(renderPlayer)}
        </Box>

        {content.bench && content.bench.length > 0 && (
          <>
            <Typography level="title-sm" sx={{ color: '#A78BFA', mt: 3, mb: 1.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bench
            </Typography>
            <Box sx={LINEUP_GRID_SX}>
              {content.bench.map(renderPlayer)}
            </Box>
          </>
        )}

        {(content.total_fantasy_points != null || content.total_salary != null) && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 1, borderTop: '1px solid #222' }}>
            {content.total_fantasy_points != null && (
              <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 700 }}>
                Total: {content.total_fantasy_points.toFixed(1)} FP
              </Typography>
            )}
            {content.total_salary != null && (
              <Typography level="body-sm" sx={{ color: '#888' }}>
                ${(content.total_salary / 1_000_000).toFixed(1)}M salary
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

/** Stat keys in display order: MIN PTS REB AST BLK STL. FP is computed from these via FanDuel. */
const PLAYER_CARD_STAT_ORDER = ['min', 'pts', 'reb', 'ast', 'blk', 'stl'] as const

function playerCardFantasyPoints(content: PlayerHighlightContent): number {
  if (content.fantasy_points != null) return content.fantasy_points
  const s = content.stats || {}
  return FANDUEL_SCORING.calculatePoints({
    pts: s.pts ?? 0,
    reb: s.reb ?? 0,
    ast: s.ast ?? 0,
    stl: s.stl ?? 0,
    blk: s.blk ?? 0,
    tov: s.tov ?? 0,
  } as any)
}

function PlayerHighlightSection({ content }: { content: PlayerHighlightContent }) {
  const clips = content.video_clips?.length ? content.video_clips : []
  const [clipIndex, setClipIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentClip = clips[clipIndex]

  useEffect(() => {
    if (!currentClip?.mp4 || !videoRef.current) return
    const v = videoRef.current
    v.src = currentClip.mp4
    v.load()
    v.play().catch(() => {})
  }, [clipIndex, currentClip?.mp4])

  // Pause when this section scrolls out of view (so the previous highlight stops when you scroll to the next)
  useEffect(() => {
    const el = containerRef.current
    if (!el || clips.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.25 && videoRef.current) {
            videoRef.current.pause()
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 1], rootMargin: '0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [clips.length])

  const goNext = useCallback(() => {
    if (clips.length <= 1) return
    setClipIndex((i) => (i + 1) % clips.length)
  }, [clips.length])

  const fp = playerCardFantasyPoints(content)
  const stats = content.stats || {}
  const orderedStats = PLAYER_CARD_STAT_ORDER.filter((key) => stats[key] != null).map((key) => ({
    key: key.toUpperCase(),
    value: stats[key],
  }))

  return (
    <Box ref={containerRef}>
      <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'hidden' }}>
      {/* This player's highlight slideshow when video_clips exist; else static thumbnail */}
      {clips.length > 0 ? (
        <Box sx={{ position: 'relative', width: '100%', bgcolor: '#000' }}>
          <video
            ref={videoRef}
            src={currentClip?.mp4}
            muted
            autoPlay
            playsInline
            style={{ width: '100%', display: 'block', aspectRatio: '16/10', objectFit: 'cover' }}
            onEnded={goNext}
          />
          {content.data_overlays && content.data_overlays.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                p: 1,
                background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
              }}
            >
              {content.data_overlays.map((overlay: DataOverlay, i: number) => (
                <Chip
                  key={i}
                  size="sm"
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: overlay.color ?? '#FFC72C',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {overlay.label}: {overlay.value}
                </Chip>
              ))}
            </Box>
          )}
          {clips.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, py: 0.5 }}>
            {clips.map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: i === clipIndex ? '#FFC72C' : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </Box>
          )}
        </Box>
      ) : content.video_thumbnail ? (
        <Box
          sx={{
            position: 'relative',
            height: 180,
            background: `url(${content.video_thumbnail}) center/cover`,
          }}
        >
          {content.data_overlays && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                gap: 1,
                p: 1,
                background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
              }}
            >
              {content.data_overlays.map((overlay: DataOverlay, i: number) => (
                <Chip
                  key={i}
                  size="sm"
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: overlay.color ?? '#FFC72C',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {overlay.label}: {overlay.value}
                </Chip>
              ))}
            </Box>
          )}
        </Box>
      ) : null}

      <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center' }}>
        <Avatar
          src={content.headshot_url ?? `https://cdn.nba.com/headshots/nba/latest/260x190/${content.player_id}.png`}
          alt={content.name}
          sx={{ width: 56, height: 56 }}
        />
        <Typography level="title-md" sx={{ color: '#FFF', fontWeight: 700 }}>
          {content.name}
        </Typography>
        <Typography level="body-md" sx={{ color: '#FFC72C', fontWeight: 700 }}>
          {fp.toFixed(1)} FP
        </Typography>
        <Typography level="body-xs" sx={{ color: '#888' }}>
          {content.team_tricode}
        </Typography>
      </CardContent>

      {/* Stat line: MIN PTS REB AST BLK STL */}
      {orderedStats.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-around', px: 2, pb: 2 }}>
          {orderedStats.map(({ key, value }) => (
            <Box key={key} sx={{ textAlign: 'center' }}>
              <Typography level="body-lg" sx={{ color: '#FFC72C', fontWeight: 700 }}>
                {value}
              </Typography>
              <Typography level="body-xs" sx={{ color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {key}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Card>
    </Box>
  )
}

function StatComparisonSection({ content }: { content: StatComparisonContent }) {
  const maxVal = Math.max(...content.teams.map((t) => t.value), 1)

  return (
    <Box sx={{ py: 1 }}>
      <Typography level="title-sm" sx={{ color: '#CCC', mb: 1.5, fontWeight: 600 }}>
        {content.title}
      </Typography>
      <Stack spacing={1}>
        {content.teams.map((team) => (
          <Box key={team.tricode} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600, minWidth: 36 }}>
              {team.tricode}
            </Typography>
            <Box sx={{ flex: 1, height: 20, bgcolor: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
              <Box
                sx={{
                  height: '100%',
                  width: `${(team.value / maxVal) * 100}%`,
                  bgcolor: team.color ?? '#FFC72C',
                  borderRadius: 4,
                  transition: 'width 0.6s ease',
                }}
              />
            </Box>
            <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 700, minWidth: 36, textAlign: 'right' }}>
              {typeof team.value === 'number' && team.value < 1 ? `${(team.value * 100).toFixed(1)}%` : team.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

function VideoClipSection({ content }: { content: VideoClipContent }) {
  return (
    <Box sx={{ borderRadius: '8px', overflow: 'hidden', bgcolor: '#0a0a0a' }}>
      {content.video_url ? (
        <video
          src={content.video_url}
          poster={content.thumbnail_url}
          controls
          style={{ width: '100%', display: 'block' }}
        />
      ) : content.thumbnail_url ? (
        <img
          src={content.thumbnail_url}
          alt={content.caption ?? 'Video'}
          style={{ width: '100%', display: 'block' }}
        />
      ) : null}
      {content.caption && (
        <Typography level="body-sm" sx={{ color: '#AAA', p: 1.5, fontStyle: 'italic' }}>
          {content.caption}
          {content.period && content.clock && (
            <Typography component="span" sx={{ color: '#666', ml: 1 }}>
              Q{content.period} {content.clock}
            </Typography>
          )}
        </Typography>
      )}
    </Box>
  )
}

/** Instagram-style carousel of MP4 clips with play metadata (period, clock, description). MUI Joy only. */
function VideoCarouselSection({ content }: { content: VideoCarouselContent }) {
  const clips = content.clips?.filter((c) => c.mp4) ?? []
  const [index, setIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const current = clips[index]

  useEffect(() => {
    if (!current?.mp4 || !videoRef.current) return
    const v = videoRef.current
    v.src = current.mp4
    v.load()
    v.play().catch(() => {})
  }, [index, current?.mp4])

  if (clips.length === 0) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222' }}>
        <CardContent>
          <Typography level="body-sm" sx={{ color: '#666' }}>No clips in this carousel.</Typography>
        </CardContent>
      </Card>
    )
  }

  const goPrev = () => setIndex((i) => (i - 1 + clips.length) % clips.length)
  const goNext = () => setIndex((i) => (i + 1) % clips.length)

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'hidden' }}>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {clips.length > 1 && (
          <IconButton
            variant="soft"
            color="neutral"
            size="sm"
            onClick={goPrev}
            sx={{
              position: 'absolute',
              left: 8,
              zIndex: 2,
              bgcolor: 'rgba(0,0,0,0.6)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            }}
          >
            <ChevronLeft />
          </IconButton>
        )}
        <Box sx={{ width: '100%', aspectRatio: '9/16', maxHeight: 420, mx: clips.length > 1 ? 5 : 0 }}>
          <video
            ref={videoRef}
            src={current?.mp4}
            muted={false}
            controls
            playsInline
            style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', background: '#000' }}
            onEnded={goNext}
          />
        </Box>
        {clips.length > 1 && (
          <IconButton
            variant="soft"
            color="neutral"
            size="sm"
            onClick={goNext}
            sx={{
              position: 'absolute',
              right: 8,
              zIndex: 2,
              bgcolor: 'rgba(0,0,0,0.6)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            }}
          >
            <ChevronRight />
          </IconButton>
        )}
      </Box>
      {(current?.description || (current?.period != null && current?.clock)) && (
        <CardContent sx={{ py: 1, px: 1.5 }}>
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
            {current.period != null && current.clock != null && (
              <Chip size="sm" variant="soft" sx={{ fontSize: '0.7rem' }}>
                Q{current.period} {current.clock}
              </Chip>
            )}
            {current.action_type && (
              <Chip size="sm" variant="outlined" sx={{ fontSize: '0.7rem' }}>
                {current.action_type}
              </Chip>
            )}
            {current.description && (
              <Typography level="body-sm" sx={{ color: '#AAA', flex: 1, minWidth: 0 }}>
                {current.description}
              </Typography>
            )}
          </Stack>
        </CardContent>
      )}
      {clips.length > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, pb: 1 }}>
          {clips.map((_, i) => (
            <Box
              key={i}
              onClick={() => setIndex(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIndex(i)}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: i === index ? '#FFC72C' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            />
          ))}
        </Box>
      )}
    </Card>
  )
}

function RichTextSection({ content }: { content: RichTextContent }) {
  // Simple markdown rendering (bold, headings, paragraphs)
  const html = useMemo(() => {
    let md = content.markdown || ''
    md = md.replace(/^### (.+)$/gm, '<h4 style="color:#FFC72C;margin:12px 0 4px;">$1</h4>')
    md = md.replace(/^## (.+)$/gm, '<h3 style="color:#FFF;margin:16px 0 8px;">$1</h3>')
    md = md.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#FFF;">$1</strong>')
    md = md.replace(/\n\n/g, '</p><p style="margin:8px 0;">')
    return `<p style="margin:8px 0;">${md}</p>`
  }, [content.markdown])

  return (
    <Box
      sx={{ color: '#CCC', lineHeight: 1.7, '& h3': { fontFamily: '"Libre Baskerville", serif' } }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function PropCardSection({ content }: { content: PropCardContent }) {
  const resultColor =
    content.result === 'over' ? '#10B981' : content.result === 'under' ? '#EF4444' : '#888'

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${content.player_id}.png`}
              sx={{ width: 36, height: 36 }}
            />
            <Box>
              <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
                {content.player_name}
              </Typography>
              <Typography level="body-xs" sx={{ color: '#888' }}>
                {content.bet_type}
              </Typography>
            </Box>
          </Box>
          {content.result && content.result !== 'pending' && (
            <Chip
              size="sm"
              sx={{
                bgcolor: `${resultColor}22`,
                color: resultColor,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {content.result}
            </Chip>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-around', pt: 1 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography level="body-xs" sx={{ color: '#666' }}>Line</Typography>
            <Typography level="body-lg" sx={{ color: '#FFC72C', fontWeight: 700 }}>
              {content.line}
            </Typography>
          </Box>
          {content.actual != null && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography level="body-xs" sx={{ color: '#666' }}>Actual</Typography>
              <Typography level="body-lg" sx={{ color: resultColor, fontWeight: 700 }}>
                {content.actual}
              </Typography>
            </Box>
          )}
          {content.confidence != null && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography level="body-xs" sx={{ color: '#666' }}>Confidence</Typography>
              <Typography level="body-lg" sx={{ color: '#CCC', fontWeight: 700 }}>
                {(content.confidence * 100).toFixed(0)}%
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}

function InjuryCardSection({ content }: { content: InjuryCardContent }) {
  const statusColor: Record<string, string> = {
    OUT: '#EF4444',
    DOUBTFUL: '#F59E0B',
    QUESTIONABLE: '#FB923C',
    PROBABLE: '#10B981',
  }

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar
          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${content.player_id}.png`}
          sx={{ width: 48, height: 48 }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
            {content.player_name}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#888' }}>
            {content.team_tricode} · {content.injury}
          </Typography>
          {content.impact_note && (
            <Typography level="body-xs" sx={{ color: '#AAA', mt: 0.5, fontStyle: 'italic' }}>
              {content.impact_note}
            </Typography>
          )}
        </Box>
        <Chip
          size="sm"
          sx={{
            bgcolor: `${statusColor[content.status] ?? '#888'}22`,
            color: statusColor[content.status] ?? '#888',
            fontWeight: 700,
            fontSize: '0.65rem',
          }}
        >
          {content.status}
        </Chip>
      </CardContent>
    </Card>
  )
}

function PullQuoteSection({ content }: { content: PullQuoteContent }) {
  return (
    <Box
      sx={{
        borderLeft: `4px solid ${content.accent_color ?? '#FFC72C'}`,
        pl: 2.5,
        py: 1.5,
        my: 1,
      }}
    >
      <Typography
        level="h4"
        sx={{
          fontFamily: '"Libre Baskerville", serif',
          color: content.accent_color ?? '#FFC72C',
          fontWeight: 700,
          lineHeight: 1.4,
        }}
      >
        {content.text}
      </Typography>
      {content.attribution && (
        <Typography level="body-xs" sx={{ color: '#888', mt: 0.5 }}>
          — {content.attribution}
        </Typography>
      )}
    </Box>
  )
}

function GallerySection({ content }: { content: GalleryContent }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        pb: 1,
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {content.images?.map((img, i) => (
        <Box key={i} sx={{ flexShrink: 0, borderRadius: '8px', overflow: 'hidden' }}>
          <img
            src={img.url}
            alt={img.caption ?? ''}
            style={{ height: 180, width: 'auto', display: 'block' }}
          />
        </Box>
      ))}
    </Box>
  )
}

function BoxScoreSection({ content }: { content: BoxScoreContent }) {
  const renderTeam = (team: BoxScoreContent['home'], label: string) => (
    <Box sx={{ mb: 2 }}>
      <Typography level="title-sm" sx={{ color: '#FFC72C', mb: 1, fontWeight: 700 }}>
        {team.tricode}
      </Typography>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
        <thead>
          <tr>
            {['Player', 'MIN', 'PTS', 'REB', 'AST', 'FG', '+/-'].map((h) => (
              <th
                key={h}
                style={{
                  color: '#888',
                  padding: '4px 6px',
                  textAlign: h === 'Player' ? 'left' : 'right',
                  borderBottom: '1px solid #222',
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {team.players?.map((p) => (
            <tr key={p.player_id}>
              <td style={{ color: '#FFF', padding: '4px 6px' }}>{p.name}</td>
              <td style={{ color: '#AAA', padding: '4px 6px', textAlign: 'right' }}>{p.minutes}</td>
              <td style={{ color: '#FFC72C', padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>{p.pts}</td>
              <td style={{ color: '#AAA', padding: '4px 6px', textAlign: 'right' }}>{p.reb}</td>
              <td style={{ color: '#AAA', padding: '4px 6px', textAlign: 'right' }}>{p.ast}</td>
              <td style={{ color: '#AAA', padding: '4px 6px', textAlign: 'right' }}>{p.fg}</td>
              <td
                style={{
                  color: (p.plus_minus ?? 0) >= 0 ? '#10B981' : '#EF4444',
                  padding: '4px 6px',
                  textAlign: 'right',
                }}
              >
                {(p.plus_minus ?? 0) >= 0 ? '+' : ''}{p.plus_minus ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  )

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'auto' }}>
      <CardContent>
        {renderTeam(content.away, 'Away')}
        {renderTeam(content.home, 'Home')}
      </CardContent>
    </Card>
  )
}

// ─── Section router ─────────────────────────────────────────

function SectionRenderer({ section }: { section: FeedPostSection }) {
  const { section_type, content, title } = section

  return (
    <Box sx={{ mb: 3 }}>
      {/* Section title (if provided and not a hero/headline — those have their own) */}
      {title && !['hero', 'headline'].includes(section_type) && (
        <Typography
          level="title-sm"
          sx={{
            color: '#AAA',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: '0.7rem',
            mb: 1.5,
          }}
        >
          {title}
        </Typography>
      )}

      {section_type === 'hero' && <HeroSection content={content as HeroContent} />}
      {section_type === 'headline' && <HeadlineSection content={content as HeadlineContent} />}
      {section_type === 'lineup_card' && <LineupCardSection content={content as LineupCardContent} />}
      {section_type === 'player_highlight' && <PlayerHighlightSection content={content as PlayerHighlightContent} />}
      {section_type === 'stat_comparison' && <StatComparisonSection content={content as StatComparisonContent} />}
      {section_type === 'video_clip' && <VideoClipSection content={content as VideoClipContent} />}
      {section_type === 'video_carousel' && <VideoCarouselSection content={content as VideoCarouselContent} />}
      {section_type === 'rich_text' && <RichTextSection content={content as RichTextContent} />}
      {section_type === 'prop_card' && <PropCardSection content={content as PropCardContent} />}
      {section_type === 'injury_card' && <InjuryCardSection content={content as InjuryCardContent} />}
      {section_type === 'pull_quote' && <PullQuoteSection content={content as PullQuoteContent} />}
      {section_type === 'gallery' && <GallerySection content={content as GalleryContent} />}
      {section_type === 'box_score' && <BoxScoreSection content={content as BoxScoreContent} />}
      {section_type === 'chart' && (
        <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', p: 3, textAlign: 'center' }}>
          <Typography level="body-sm" sx={{ color: '#888' }}>
            Chart: {(content as any)?.chart_type ?? 'unknown'}
          </Typography>
        </Card>
      )}
    </Box>
  )
}

// ─── Comment component ──────────────────────────────────────

function CommentThread({
  comment,
  userId,
  onReply,
}: {
  comment: FeedPostComment
  userId?: string
  onReply: (parentId: string) => void
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Avatar
          src={comment.user_profile?.avatar_url ?? undefined}
          sx={{ width: 32, height: 32, bgcolor: '#333' }}
        >
          {comment.user_profile?.display_name?.charAt(0) ?? '?'}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level="body-xs" sx={{ color: '#FFF', fontWeight: 600 }}>
              {comment.user_profile?.display_name ?? 'Anonymous'}
            </Typography>
            <Typography level="body-xs" sx={{ color: '#666' }}>
              {new Date(comment.created_at).toLocaleDateString()}
            </Typography>
          </Box>
          <Typography level="body-sm" sx={{ color: '#CCC', mt: 0.5 }}>
            {comment.content}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
            <Typography
              level="body-xs"
              onClick={() => onReply(comment.id)}
              sx={{ color: '#666', cursor: 'pointer', '&:hover': { color: '#FFC72C' } }}
            >
              Reply
            </Typography>
            {comment.likes_count > 0 && (
              <Typography level="body-xs" sx={{ color: '#666' }}>
                {comment.likes_count} likes
              </Typography>
            )}
          </Box>

          {/* Nested replies */}
          {comment.replies && comment.replies.length > 0 && (
            <Box sx={{ mt: 1.5, pl: 1, borderLeft: '2px solid #222' }}>
              {comment.replies.map((reply) => (
                <CommentThread key={reply.id} comment={reply} userId={userId} onReply={onReply} />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ─── Main component ─────────────────────────────────────────

export default function PostStory() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: post, isLoading: postLoading, error: postError } = usePostBySlug(slug)
  const { data: sections, isLoading: sectionsLoading } = usePostSections(post?.id)

  // Engagement state
  const [liked, setLiked] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [engagement, setEngagement] = useState({
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    viewsCount: 0,
    bookmarksCount: 0,
  })

  // Comments
  const [comments, setComments] = useState<FeedPostComment[]>([])
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Scroll tracking for sections viewed
  const contentRef = useRef<HTMLDivElement>(null)
  const viewStartTime = useRef(Date.now())

  // Load engagement + record view on mount
  useEffect(() => {
    if (!post?.id) return

    // Load engagement stats
    getEngagementStats(post.id, user?.id).then((stats) => {
      setEngagement({
        likesCount: stats.likesCount,
        commentsCount: stats.commentsCount,
        sharesCount: stats.sharesCount,
        viewsCount: stats.viewsCount,
        bookmarksCount: stats.bookmarksCount,
      })
      setLiked(stats.userLiked)
      setBookmarked(stats.userBookmarked)
    })

    // Record view
    recordView(post.id, user?.id ?? null, 'feed')

    // Set OG meta tags for sharing
    document.title = `${post.title} | HoopGeek`
  }, [post?.id, user?.id])

  // Load comments when toggled
  useEffect(() => {
    if (showComments && post?.id) {
      getComments(post.id).then(setComments)
    }
  }, [showComments, post?.id])

  const handleLike = useCallback(async () => {
    if (!post?.id || !user?.id) return
    const prev = liked
    setLiked(!liked)
    setEngagement((e) => ({ ...e, likesCount: e.likesCount + (liked ? -1 : 1) }))
    try {
      const result = await toggleLike(post.id, user.id)
      setLiked(result.liked)
      setEngagement((e) => ({ ...e, likesCount: result.likesCount }))
    } catch {
      setLiked(prev)
    }
  }, [post?.id, user?.id, liked])

  const handleBookmark = useCallback(async () => {
    if (!post?.id || !user?.id) return
    const prev = bookmarked
    setBookmarked(!bookmarked)
    try {
      const result = await toggleBookmark(post.id, user.id)
      setBookmarked(result.bookmarked)
    } catch {
      setBookmarked(prev)
    }
  }, [post?.id, user?.id, bookmarked])

  const handleShare = useCallback(async () => {
    if (!post?.slug) return
    await shareToExternal(post.slug, 'copy')
    if (post.id) recordShare(post.id, user?.id ?? null, 'copy')
  }, [post?.slug, post?.id, user?.id])

  const handleSubmitComment = useCallback(async () => {
    if (!post?.id || !user?.id || !newComment.trim()) return
    setSubmittingComment(true)
    try {
      await addComment(post.id, user.id, newComment.trim(), replyToId ?? undefined)
      setNewComment('')
      setReplyToId(null)
      // Reload comments
      const updated = await getComments(post.id)
      setComments(updated)
      setEngagement((e) => ({ ...e, commentsCount: e.commentsCount + 1 }))
    } catch (err) {
      console.error('Error adding comment:', err)
    } finally {
      setSubmittingComment(false)
    }
  }, [post?.id, user?.id, newComment, replyToId])

  // ─── Loading / error states ─────────────────────────────

  if (postLoading || sectionsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 16 }}>
        <CircularProgress size="lg" sx={{ '--CircularProgress-progressColor': '#FFC72C' }} />
      </Box>
    )
  }

  if (postError || !post) {
    return (
      <Box sx={{ textAlign: 'center', pt: 16 }}>
        <Typography level="h3" sx={{ color: '#FFF', mb: 1 }}>
          Story not found
        </Typography>
        <Typography level="body-md" sx={{ color: '#888', mb: 3 }}>
          This story may have been removed or the link is incorrect.
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/feed')}
          sx={{ borderColor: '#FFC72C', color: '#FFC72C' }}
        >
          Back to Feed
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, md: 0 }, pt: 2, pb: 12 }}>
      {/* Back button */}
      <IconButton
        onClick={() => navigate('/feed')}
        sx={{ color: '#888', mb: 2, '&:hover': { color: '#FFF' } }}
      >
        <ArrowBack />
      </IconButton>

      {/* Sections (hero with gradient is first) */}
      <Box ref={contentRef}>
        {(sections ?? []).map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}

        {(!sections || sections.length === 0) && (
          <Typography level="body-md" sx={{ color: '#888', py: 4, textAlign: 'center' }}>
            No story content yet.
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: '#222', my: 3 }} />

      {/* Engagement bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          py: 1.5,
          px: 2,
          bgcolor: '#0a0a0a',
          borderRadius: '12px',
          border: '1px solid #222',
        }}
      >
        <Box
          onClick={handleLike}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
        >
          {liked ? (
            <Favorite sx={{ fontSize: 20, color: '#EF4444' }} />
          ) : (
            <FavoriteBorder sx={{ fontSize: 20, color: '#888' }} />
          )}
          <Typography level="body-xs" sx={{ color: liked ? '#EF4444' : '#888' }}>
            {engagement.likesCount}
          </Typography>
        </Box>

        <Box
          onClick={() => setShowComments(!showComments)}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
        >
          <ChatBubbleOutline sx={{ fontSize: 20, color: showComments ? '#FFC72C' : '#888' }} />
          <Typography level="body-xs" sx={{ color: showComments ? '#FFC72C' : '#888' }}>
            {engagement.commentsCount}
          </Typography>
        </Box>

        <Box
          onClick={handleShare}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
        >
          <ContentCopy sx={{ fontSize: 18, color: '#888' }} />
          <Typography level="body-xs" sx={{ color: '#888' }}>
            Share
          </Typography>
        </Box>

        <Box
          onClick={handleBookmark}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
        >
          {bookmarked ? (
            <Bookmark sx={{ fontSize: 20, color: '#FFC72C' }} />
          ) : (
            <BookmarkBorder sx={{ fontSize: 20, color: '#888' }} />
          )}
        </Box>
      </Box>

      {/* Comments section */}
      {showComments && (
        <Box sx={{ mt: 3 }}>
          <Typography level="title-md" sx={{ color: '#FFF', mb: 2, fontWeight: 700 }}>
            Comments ({engagement.commentsCount})
          </Typography>

          {/* Comment input */}
          {user ? (
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              <Textarea
                placeholder={replyToId ? 'Write a reply...' : 'Add a comment...'}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                minRows={2}
                maxRows={4}
                sx={{
                  flex: 1,
                  bgcolor: '#111',
                  borderColor: '#222',
                  color: '#FFF',
                  '&::before': { display: 'none' },
                }}
              />
              <IconButton
                onClick={handleSubmitComment}
                disabled={submittingComment || !newComment.trim()}
                sx={{ color: '#FFC72C', alignSelf: 'flex-end' }}
              >
                <Send />
              </IconButton>
            </Box>
          ) : (
            <Typography level="body-sm" sx={{ color: '#888', mb: 3 }}>
              Sign in to comment.
            </Typography>
          )}

          {/* Comment threads */}
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              userId={user?.id}
              onReply={(parentId) => {
                setReplyToId(parentId)
                // Focus the textarea
              }}
            />
          ))}

          {comments.length === 0 && (
            <Typography level="body-sm" sx={{ color: '#666', textAlign: 'center', py: 4 }}>
              No comments yet. Be the first to share your thoughts.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}
