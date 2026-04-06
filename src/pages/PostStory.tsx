/**
 * PostStory — Full scrollable story page for a single feed post.
 *
 * Route: /feed/:slug
 * Loads the post + its sections from Supabase and renders each section
 * as a typed component. Engagement bar at the bottom.
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMediaQuery } from '@mui/material'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardOverflow,
  Chip,
  CircularProgress,
  Avatar,
  IconButton,
  Textarea,
  Button,
  Divider,
  Stack,
  AspectRatio,
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
  InjuryProgressSegment,
  PullQuoteContent,
  GalleryContent,
  BoxScoreContent,
  GameLogContent,
  PostLinkContent,
  TweetEmbedContent,
  DataOverlay,
  LineupPlayer,
  ChartContent,
  InjuryModuleContent,
  PropModuleContent,
  TeamOfNightModuleContent,
  TeamOfWeekModuleContent,
  TankModuleContent,
  DfsModuleContent,
} from '../types/feed'
import InjuryModuleDisplay from '../components/modules/InjuryModuleDisplay'
import PropModuleDisplay from '../components/modules/PropModuleDisplay'
import TeamOfNightModuleDisplay from '../components/modules/TeamOfNightModuleDisplay'
import TeamOfWeekModuleDisplay from '../components/modules/TeamOfWeekModuleDisplay'
import {
  PostStoryDesktopBlogShell,
  PostStoryMobileArticleShell,
  PostStoryMobileReel,
} from '../components/Feed/PostStoryLayouts'
import { PostStoryTitleWithTeamLogos } from '../components/Feed/PostStoryTitleWithTeamLogos'
import {
  PostLinkSection,
  PostLinkSpotlightCarousel,
  buildSpotlightSkipSet,
  getSpotlightGroupAtIndex,
} from '../components/Feed/PostLinkFeedBlocks'
import { getReelVideoFromSections } from '../utils/feedFirstVideo'
import { useFeedVideoStore } from '../stores/feedVideoStore'
import TankModuleDisplay from '../components/modules/TankModuleDisplay'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import LocalHospital from '@mui/icons-material/LocalHospital'
import { getTeamPrimaryColor } from '../utils/nbaTeamColors'
import { getTeamLogoUrl } from '../utils/nbaTeamLogos'
import PlayerJersey from '../components/PlayerJersey'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import ShotChartTable from '../components/Charts/ShotChartTable'

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
  draft: '#6366F1',
  dfs: '#22C55E',
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
  draft: 'Draft',
  dfs: 'DFS',
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

const SWIPE_THRESHOLD_PX = 50

/** One row from nba_boxscores for per-game stats on TOTW. */
interface TotwGameBoxscore {
  game_id: string
  game_date: string
  matchup: string | null
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  fg3m: number
  tov?: number
  fgm?: number
  fga?: number
  fg3a?: number
  ftm?: number
  fta?: number
}

/** Parse "AWAY @ HOME" matchup; return opponent tricode and whether player's team was on the road. */
function parseMatchup(matchup: string | null, playerTeamTricode: string): { opponentTricode: string; isRoad: boolean } | null {
  if (!matchup || !playerTeamTricode) return null
  const parts = matchup.split('@').map((s) => s.trim())
  if (parts.length !== 2) return null
  const [away, home] = parts
  const playerUpper = playerTeamTricode.toUpperCase()
  if (away?.toUpperCase() === playerUpper) return { opponentTricode: home ?? '', isRoad: true }
  if (home?.toUpperCase() === playerUpper) return { opponentTricode: away ?? '', isRoad: false }
  return null
}

/** When false, only a placeholder is shown (no video). Ensures only one slideshow plays at a time on the page.
 *  When hideVideo is true (e.g. player_spotlight), the video/slideshow is omitted so only the carousel shows clips.
 *  When noCard is true, render without outer Box/Card (for use inside a combined single Card with video carousel). */
function PlayerHighlightSection({
  content,
  isActiveSection = true,
  weekRange,
  gameDate,
  onPlayerClick,
  hideVideo = false,
  noCard = false,
}: {
  content: PlayerHighlightContent
  isActiveSection?: boolean
  /** For team_of_week: query nba_boxscores for this week and show per-game stat cards. */
  weekRange?: { start: string; end: string }
  /** For team_of_night: single game date (YYYY-MM-DD); show one game's box score card like TOTW. */
  gameDate?: string
  /** When provided, player name is clickable and navigates to player page. */
  onPlayerClick?: (nbaPlayerId: number) => void
  /** When true, do not render the video/slideshow (e.g. player_spotlight uses video_carousel only). */
  hideVideo?: boolean
  /** When true, do not wrap in Box/Card (embed in parent Card). */
  noCard?: boolean
}) {
  const effectiveWeekRange = weekRange ?? (gameDate
    ? { start: `${gameDate}T00:00:00`, end: `${gameDate}T23:59:59` }
    : undefined)
  const clips = hideVideo ? [] : (content.video_clips?.length ? content.video_clips : [])
  const [clipIndex, setClipIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const currentClip = clips[clipIndex]

  useEffect(() => {
    if (!isActiveSection || !currentClip?.mp4 || !videoRef.current) return
    const v = videoRef.current
    v.src = currentClip.mp4
    v.load()
    v.play().catch(() => {})
  }, [isActiveSection, clipIndex, currentClip?.mp4])

  const goNext = useCallback(() => {
    if (clips.length <= 1) return
    setClipIndex((i) => (i + 1) % clips.length)
  }, [clips.length])

  const goPrev = useCallback(() => {
    if (clips.length <= 1) return
    setClipIndex((i) => (i - 1 + clips.length) % clips.length)
  }, [clips.length])

  // Keyboard: left/right when this slideshow is active
  useEffect(() => {
    if (!isActiveSection || clips.length <= 1) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActiveSection, clips.length, goPrev, goNext])

  // Swipe: track touch start/end for mobile and iPad
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current == null || clips.length <= 1) return
      const endX = e.changedTouches[0].clientX
      const delta = endX - touchStartX.current
      touchStartX.current = null
      if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
      if (delta < 0) goNext()
      else goPrev()
    },
    [clips.length, goNext, goPrev]
  )

  const fp = playerCardFantasyPoints(content)
  const stats = content.stats || {}
  const orderedStats = PLAYER_CARD_STAT_ORDER.filter((key) => stats[key] != null).map((key) => ({
    key: key.toUpperCase(),
    value: stats[key],
  }))

  // TOTW / TOTN: fetch per-game boxscores (TOTW = week range, TOTN = single game date)
  const { data: boxscoreRows } = useQuery({
    queryKey: ['nba_boxscores-lineup', content.player_id, effectiveWeekRange?.start, effectiveWeekRange?.end],
    queryFn: async (): Promise<TotwGameBoxscore[]> => {
      if (!effectiveWeekRange?.start || !effectiveWeekRange?.end || !content.player_id) return []
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('game_id, game_date, matchup, pts, reb, ast, stl, blk, fg3m, tov, fgm, fga, fg3a, ftm, fta')
        .eq('nba_player_id', content.player_id)
        .gte('game_date', effectiveWeekRange.start)
        .lte('game_date', effectiveWeekRange.end)
        .order('game_date', { ascending: true })
      if (error) return []
      return (data || []).map((row: Record<string, unknown>) => ({
        game_id: String(row.game_id ?? ''),
        game_date: String(row.game_date ?? ''),
        matchup: row.matchup != null ? String(row.matchup) : null,
        pts: Number(row.pts ?? 0),
        reb: Number(row.reb ?? 0),
        ast: Number(row.ast ?? 0),
        stl: Number(row.stl ?? 0),
        blk: Number(row.blk ?? 0),
        fg3m: Number(row.fg3m ?? 0),
        tov: row.tov != null ? Number(row.tov) : undefined,
        fgm: row.fgm != null ? Number(row.fgm) : undefined,
        fga: row.fga != null ? Number(row.fga) : undefined,
        fg3a: row.fg3a != null ? Number(row.fg3a) : undefined,
        ftm: row.ftm != null ? Number(row.ftm) : undefined,
        fta: row.fta != null ? Number(row.fta) : undefined,
      }))
    },
    enabled: !!effectiveWeekRange?.start && !!effectiveWeekRange?.end && !!content.player_id,
    staleTime: 1000 * 60 * 5,
  })

  const totwGames = boxscoreRows ?? []

  // TOTW / TOTN: per-game prop hit rate (player_props + player_props_games → compare to boxscore via calculatePropResult)
  // Match props games by nba_game_id when set, else by date + team tricodes (player_props_games often has null nba_game_id)
  const { data: propHitRatesByGame } = useQuery({
    queryKey: ['lineup-prop-hit-rates', content.player_id, effectiveWeekRange?.start, effectiveWeekRange?.end, totwGames.map((g) => g.game_id).join(',')],
    queryFn: async (): Promise<Record<string, { hitRate: number; total: number }>> => {
      if (!content.player_id || totwGames.length === 0 || !effectiveWeekRange?.start || !effectiveWeekRange?.end) return {}
      const { calculatePropResult } = await import('../utils/playerPropsCalculator')
      const { filterFullGameProps } = await import('../utils/playerPropsFilter')
      const { matchPropsGamesToNbaGames } = await import('../utils/matchPropsGamesToNbaGames')
      const playerTeam = content.team_tricode || ''
      const nbaGamesForMatching = totwGames.map((g) => {
        const parsed = parseMatchup(g.matchup, playerTeam)
        const away = parsed?.isRoad ? playerTeam : (parsed?.opponentTricode ?? '')
        const home = parsed?.isRoad ? (parsed?.opponentTricode ?? '') : playerTeam
        return {
          game_id: g.game_id,
          game_date: g.game_date,
          home_team_tricode: home || null,
          away_team_tricode: away || null,
        }
      })
      const { data: allPropsGames } = await supabase
        .from('player_props_games')
        .select('id, event_id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team')
        .gte('game_date', effectiveWeekRange.start)
        .lte('game_date', effectiveWeekRange.end)
      const propsGamesList = allPropsGames || []
      const matched = matchPropsGamesToNbaGames(
        propsGamesList as Array<{ id: string; event_id: string; nba_game_id: string | null; game_date: string; home_team_tricode: string | null; away_team_tricode: string | null; home_team: string | null; away_team: string | null }>,
        nbaGamesForMatching
      )
      const propsGameIdToNbaGameId = new Map<string, string>()
      matched.forEach((nbaGame, propsId) => {
        propsGameIdToNbaGameId.set(propsId, nbaGame.game_id)
      })
      const uuids = [...matched.keys()]
      if (uuids.length === 0) return {}
      const { data: props } = await supabase
        .from('player_props')
        .select('id, game_id, bet_type, line, raw_odd_data')
        .eq('nba_player_id', content.player_id)
        .in('game_id', uuids)
      const fullGameProps = filterFullGameProps(props || [])
      const boxscoreByGame = new Map(totwGames.map((g) => [g.game_id, g]))
      const result: Record<string, { hits: number; total: number }> = {}
      for (const prop of fullGameProps) {
        const nbaGameId = propsGameIdToNbaGameId.get(prop.game_id)
        if (!nbaGameId) continue
        const box = boxscoreByGame.get(nbaGameId)
        if (!box) continue
        const calc = calculatePropResult(prop.bet_type, Number(prop.line ?? 0), box)
        if (!calc || calc.result === 'push') continue
        const raw = (prop as { raw_odd_data?: { sideID?: string } | null }).raw_odd_data
        const side = raw?.sideID?.toLowerCase()
        const isOver = side === 'over' || (!side && true)
        const hit = (isOver && calc.result === 'over') || (!isOver && calc.result === 'under')
        if (!result[nbaGameId]) result[nbaGameId] = { hits: 0, total: 0 }
        result[nbaGameId].total += 1
        if (hit) result[nbaGameId].hits += 1
      }
      const out: Record<string, { hitRate: number; total: number }> = {}
      for (const [gid, r] of Object.entries(result)) {
        if (r.total > 0) out[gid] = { hitRate: (r.hits / r.total) * 100, total: r.total }
      }
      return out
    },
    enabled: !!content.player_id && totwGames.length > 0 && !!effectiveWeekRange?.start && !!effectiveWeekRange?.end,
    staleTime: 1000 * 60 * 5,
  })

  // Player spotlight (hideVideo): no standalone avatar card — reel overlay + article sections carry the story
  if (hideVideo && totwGames.length === 0) {
    const hasOverlaysStrip = Boolean(content.data_overlays?.length && !noCard)
    const hasThumb = Boolean(content.video_thumbnail)
    if (!hasOverlaysStrip && !hasThumb) {
      return null
    }
  }

  const cardInner = (
    <>
      {/* Player spotlight: no inline avatar/header — title + matchup live on the reel overlay (PostStoryMobileReel), same as mobile */}
      {/* This player's highlight slideshow when video_clips exist; only render <video> when isActiveSection so one plays at a time */}
      {clips.length > 0 ? (
        <Box
          sx={{ position: 'relative', width: '100%', bgcolor: '#000' }}
          onTouchStart={isActiveSection && clips.length > 1 ? handleTouchStart : undefined}
          onTouchEnd={isActiveSection && clips.length > 1 ? handleTouchEnd : undefined}
        >
          {isActiveSection && clips.length > 1 && (
            <>
              <IconButton
                aria-label="Previous clip"
                onClick={(e) => {
                  e.stopPropagation()
                  goPrev()
                }}
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 2,
                  bgcolor: 'rgba(0,0,0,0.6)',
                  color: '#FFF',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
                }}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                aria-label="Next clip"
                onClick={(e) => {
                  e.stopPropagation()
                  goNext()
                }}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 2,
                  bgcolor: 'rgba(0,0,0,0.6)',
                  color: '#FFF',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
                }}
              >
                <ChevronRight />
              </IconButton>
            </>
          )}
          {isActiveSection ? (
            <video
              ref={videoRef}
              src={currentClip?.mp4}
              muted
              autoPlay
              playsInline
              style={{ width: '100%', display: 'block', aspectRatio: '16/10', objectFit: 'cover' }}
              onEnded={goNext}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                aspectRatio: '16/10',
                bgcolor: '#111',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography level="body-sm" sx={{ color: '#666' }}>Scroll to watch</Typography>
            </Box>
          )}
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
          {isActiveSection && clips.length > 1 && (
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
      ) : hideVideo && content.data_overlays && content.data_overlays.length > 0 && !noCard ? (
        <Box sx={{ p: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1, background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)', borderBottom: '1px solid #222' }}>
          {content.data_overlays.map((overlay: DataOverlay, i: number) => (
            <Chip
              key={i}
              size="sm"
              sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: overlay.color ?? '#FFC72C', fontWeight: 700, fontSize: '0.7rem' }}
            >
              {overlay.label}: {overlay.value}
            </Chip>
          ))}
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

      {/* TOTW: header + game cards in one grid (Game 1 | Header | Game 2 / Game 3 | Game 4 | Game 5) */}
      {totwGames.length > 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            p: 1.5,
            alignContent: 'start',
          }}
        >
          {/* Game 1 */}
          {totwGames[0] && (() => {
            const game = totwGames[0]
            const statItems = [
              { label: 'PTS', value: game.pts },
              { label: 'REB', value: game.reb },
              { label: 'AST', value: game.ast },
              { label: 'BLK', value: game.blk },
              { label: 'STL', value: game.stl },
              ...(game.fg3m > 2.5 ? [{ label: '3PM', value: game.fg3m }] : []),
            ]
            const parsed = parseMatchup(game.matchup, content.team_tricode)
            const opponentTricode = parsed?.opponentTricode ?? ''
            const isRoad = parsed?.isRoad ?? true
            const propRate = propHitRatesByGame?.[game.game_id]
            return (
              <Card key={game.game_id} variant="outlined" size="sm" sx={{ bgcolor: '#151515', borderRadius: 0, borderColor: '#333', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                  <CardOverflow sx={{ borderBottom: 'none' }}>
                    <AspectRatio ratio="1" sx={{ minWidth: 56, maxWidth: 70 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: '#1a1a1a', gap: 0.25 }}>
                        {opponentTricode ? (
                          <Box component="img" src={getTeamLogoUrl(opponentTricode)} alt={opponentTricode} sx={{ width: 28, height: 28, objectFit: 'contain' }} />
                        ) : (
                          <Box sx={{ width: 28, height: 28, bgcolor: '#333', borderRadius: '50%' }} />
                        )}
                        <Typography sx={{ color: '#888', fontWeight: 600, fontSize: '0.65rem' }}>{isRoad ? '@' : 'vs'}</Typography>
                      </Box>
                    </AspectRatio>
                  </CardOverflow>
                  <CardContent sx={{ py: 1, px: 1.5, flex: 1, '&:last-child': { pb: 1 } }}>
                    <Typography level="title-sm" sx={{ color: '#FFF', fontWeight: 600 }}>{opponentTricode ? `${isRoad ? '@' : 'vs'} ${opponentTricode}` : (game.matchup || '—')}</Typography>
                    <Typography level="body-xs" sx={{ color: '#888' }}>{game.game_date}</Typography>
                  </CardContent>
                </Box>
                <CardOverflow variant="soft" sx={{ display: 'flex', flexDirection: 'row', gap: 0, justifyContent: 'space-around', alignItems: 'center', py: 0.75, px: 1, borderTop: '1px solid', borderColor: '#333', bgcolor: '#111' }}>
                  {statItems.map((item, i) => (
                    <Box key={item.label} sx={{ display: 'flex', alignItems: 'center' }}>
                      {i > 0 && <Divider orientation="vertical" sx={{ mx: 0.5 }} />}
                      <Typography level="body-xs" sx={{ color: '#FFC72C', fontWeight: 700, fontSize: '0.7rem' }}>{item.label} {item.value}</Typography>
                    </Box>
                  ))}
                </CardOverflow>
                {propRate != null && propRate.total > 0 && (
                  <Box sx={{ py: 0.5, px: 1, borderTop: '1px solid', borderColor: '#333', textAlign: 'center' }}>
                    <Typography
                      level="body-xs"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        color: propRate.hitRate < 50 ? '#EF4444' : propRate.hitRate >= 90 ? '#22C55E' : '#CCC',
                      }}
                    >
                      Prop rate: {Math.round(propRate.hitRate)}%
                    </Typography>
                  </Box>
                )}
              </Card>
            )
          })()}
          {/* Header cell: avatar + name, FP, team (physically attached to game log) */}
          <Card variant="outlined" size="sm" sx={{ bgcolor: '#151515', borderRadius: 0, borderColor: '#333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 120, p: 1 }}>
            <Avatar
              src={content.headshot_url ?? `https://cdn.nba.com/headshots/nba/latest/260x190/${content.player_id}.png`}
              alt={content.name}
              sx={{ width: 48, height: 48, mb: 0.5 }}
            />
            <Typography
              level="title-sm"
              component={onPlayerClick ? 'span' : 'p'}
              onClick={onPlayerClick ? () => onPlayerClick(content.player_id) : undefined}
              sx={{
                color: '#FFF',
                fontWeight: 700,
                textAlign: 'center',
                ...(onPlayerClick && { cursor: 'pointer', '&:hover': { color: '#FFC72C', textDecoration: 'underline' } }),
              }}
            >
              {content.name}
            </Typography>
            <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 700 }}>{fp.toFixed(1)} FP</Typography>
            <Typography level="body-xs" sx={{ color: '#888' }}>{content.team_tricode}</Typography>
          </Card>
          {/* Game 2, 3, 4, 5, ... */}
          {totwGames.slice(1).map((game) => {
            const statItems = [
              { label: 'PTS', value: game.pts },
              { label: 'REB', value: game.reb },
              { label: 'AST', value: game.ast },
              { label: 'BLK', value: game.blk },
              { label: 'STL', value: game.stl },
              ...(game.fg3m > 2.5 ? [{ label: '3PM', value: game.fg3m }] : []),
            ]
            const parsed = parseMatchup(game.matchup, content.team_tricode)
            const opponentTricode = parsed?.opponentTricode ?? ''
            const isRoad = parsed?.isRoad ?? true
            const propRate = propHitRatesByGame?.[game.game_id]
            return (
              <Card key={game.game_id} variant="outlined" size="sm" sx={{ bgcolor: '#151515', borderRadius: 0, borderColor: '#333', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                  <CardOverflow sx={{ borderBottom: 'none' }}>
                    <AspectRatio ratio="1" sx={{ minWidth: 56, maxWidth: 70 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: '#1a1a1a', gap: 0.25 }}>
                        {opponentTricode ? (
                          <Box component="img" src={getTeamLogoUrl(opponentTricode)} alt={opponentTricode} sx={{ width: 28, height: 28, objectFit: 'contain' }} />
                        ) : (
                          <Box sx={{ width: 28, height: 28, bgcolor: '#333', borderRadius: '50%' }} />
                        )}
                        <Typography sx={{ color: '#888', fontWeight: 600, fontSize: '0.65rem' }}>{isRoad ? '@' : 'vs'}</Typography>
                      </Box>
                    </AspectRatio>
                  </CardOverflow>
                  <CardContent sx={{ py: 1, px: 1.5, flex: 1, '&:last-child': { pb: 1 } }}>
                    <Typography level="title-sm" sx={{ color: '#FFF', fontWeight: 600 }}>{opponentTricode ? `${isRoad ? '@' : 'vs'} ${opponentTricode}` : (game.matchup || '—')}</Typography>
                    <Typography level="body-xs" sx={{ color: '#888' }}>{game.game_date}</Typography>
                  </CardContent>
                </Box>
                <CardOverflow variant="soft" sx={{ display: 'flex', flexDirection: 'row', gap: 0, justifyContent: 'space-around', alignItems: 'center', py: 0.75, px: 1, borderTop: '1px solid', borderColor: '#333', bgcolor: '#111' }}>
                  {statItems.map((item, i) => (
                    <Box key={item.label} sx={{ display: 'flex', alignItems: 'center' }}>
                      {i > 0 && <Divider orientation="vertical" sx={{ mx: 0.5 }} />}
                      <Typography level="body-xs" sx={{ color: '#FFC72C', fontWeight: 700, fontSize: '0.7rem' }}>{item.label} {item.value}</Typography>
                    </Box>
                  ))}
                </CardOverflow>
                {propRate != null && propRate.total > 0 && (
                  <Box sx={{ py: 0.5, px: 1, borderTop: '1px solid', borderColor: '#333', textAlign: 'center' }}>
                    <Typography
                      level="body-xs"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        color: propRate.hitRate < 50 ? '#EF4444' : propRate.hitRate >= 90 ? '#22C55E' : '#CCC',
                      }}
                    >
                      Prop rate: {Math.round(propRate.hitRate)}%
                    </Typography>
                  </Box>
                )}
              </Card>
            )
          })}
        </Box>
      ) : hideVideo ? null : (
        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center' }}>
          <Avatar
            src={content.headshot_url ?? `https://cdn.nba.com/headshots/nba/latest/260x190/${content.player_id}.png`}
            alt={content.name}
            sx={{ width: 56, height: 56 }}
          />
          <Typography
            level="title-md"
            component={onPlayerClick ? 'span' : 'p'}
            onClick={onPlayerClick ? () => onPlayerClick(content.player_id) : undefined}
            sx={{
              color: '#FFF',
              fontWeight: 700,
              ...(onPlayerClick && { cursor: 'pointer', '&:hover': { color: '#FFC72C', textDecoration: 'underline' } }),
            }}
          >
            {content.name}
          </Typography>
          <Typography level="body-md" sx={{ color: '#FFC72C', fontWeight: 700 }}>{fp.toFixed(1)} FP</Typography>
          <Typography level="body-xs" sx={{ color: '#888' }}>{content.team_tricode}</Typography>
        </CardContent>
      )}

      {/* Stat line: MIN PTS REB AST BLK STL — not for player_spotlight (hideVideo); reel + charts carry context */}
      {orderedStats.length > 0 && !(noCard && hideVideo) && !hideVideo && (
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
    </>
  )

  if (noCard) return cardInner
  return (
    <Box ref={containerRef}>
      <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'hidden' }}>
        {cardInner}
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
function VideoCarouselSection({ content, noCard }: { content: VideoCarouselContent; noCard?: boolean }) {
  const clips = content.clips?.filter((c) => c.mp4) ?? []
  const [index, setIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const touchStartX = useRef<number | null>(null)
  const current = clips[index]

  useEffect(() => {
    if (!current?.mp4 || !videoRef.current) return
    const v = videoRef.current
    v.src = current.mp4
    v.load()
  }, [index, current?.mp4])

  useLayoutEffect(() => {
    if (!current?.mp4 || !videoRef.current) return
    const v = videoRef.current
    // Defer play so the element is ready after paint (fixes initial load not playing until user swipes)
    const t = setTimeout(() => {
      v.play().catch(() => {})
    }, 50)
    return () => clearTimeout(t)
  }, [index, current?.mp4])

  const goPrev = useCallback(() => setIndex((i) => (i - 1 + clips.length) % clips.length), [clips.length])
  const goNext = useCallback(() => setIndex((i) => (i + 1) % clips.length), [clips.length])

  useEffect(() => {
    if (clips.length <= 1) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clips.length, goPrev, goNext])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current == null || clips.length <= 1) return
      const endX = e.changedTouches[0].clientX
      const delta = endX - touchStartX.current
      touchStartX.current = null
      if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
      if (delta < 0) goNext()
      else goPrev()
    },
    [clips.length, goNext, goPrev]
  )

  if (clips.length === 0) {
    const emptyContent = <Typography level="body-sm" sx={{ color: '#666' }}>No clips in this carousel.</Typography>
    if (noCard) return <Box sx={{ bgcolor: '#0a0a0a', p: 2 }}>{emptyContent}</Box>
    return (
      <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222' }}>
        <CardContent>{emptyContent}</CardContent>
      </Card>
    )
  }

  const inner = (
    <>
      <Box
        sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        onTouchStart={clips.length > 1 ? handleTouchStart : undefined}
        onTouchEnd={clips.length > 1 ? handleTouchEnd : undefined}
      >
        {clips.length > 1 && (
          <>
            <IconButton
              aria-label="Previous clip"
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
            <IconButton
              aria-label="Next clip"
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
          </>
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
    </>
  )

  if (noCard) return inner
  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'hidden' }}>
      {inner}
    </Card>
  )
}

function RichTextSection({ content }: { content: RichTextContent }) {
  const navigate = useNavigate()

  const html = useMemo(() => {
    let md = content.markdown || ''
    if (md.trim().startsWith('<div class="spotlight-stat-table"') || md.trim().startsWith('<table')) {
      return md
    }
    // Inline post links: {{post:/feed/slug|Display Text}} → clickable link
    md = md.replace(
      /\{\{post:\/feed\/([^\s|]+)\|([^}]+)\}\}/g,
      '<a href="/feed/$1" class="post-link" data-post-slug="$1" style="color:#FFC72C;text-decoration:underline;cursor:pointer;font-weight:600;">$2</a>'
    )
    md = md.replace(/^### (.+)$/gm, '<h4 style="color:#FFC72C;margin:12px 0 4px;">$1</h4>')
    md = md.replace(/^## (.+)$/gm, '<h3 style="color:#FFF;margin:16px 0 8px;">$1</h3>')
    md = md.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#FFF;">$1</strong>')
    md = md.replace(/\n\n/g, '</p><p style="margin:8px 0;">')
    return `<p style="margin:8px 0;">${md}</p>`
  }, [content.markdown])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const link = target.closest('a[data-post-slug]') as HTMLAnchorElement | null
    if (link) {
      e.preventDefault()
      const slug = link.dataset.postSlug
      if (slug) navigate(`/feed/${slug}`)
    }
  }, [navigate])

  return (
    <Box
      onClick={handleClick}
      sx={{
        color: '#CCC',
        lineHeight: 1.7,
        '& h3': { fontFamily: '"Libre Baskerville", serif' },
        '& .post-link:hover': { color: '#FFD54F' },
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function TweetEmbedSection({ content }: { content: TweetEmbedContent }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const tweetId = useMemo(() => {
    if (content.tweet_id) return content.tweet_id
    const match = content.tweet_url?.match(/status\/(\d+)/)
    return match?.[1] || null
  }, [content.tweet_url, content.tweet_id])

  useEffect(() => {
    if (!tweetId || !containerRef.current) return
    setLoaded(false)
    setError(false)

    const renderTweet = () => {
      const twttr = (window as any).twttr
      if (!twttr?.widgets || !containerRef.current) return
      containerRef.current.innerHTML = ''
      twttr.widgets
        .createTweet(tweetId, containerRef.current, {
          theme: 'dark',
          align: 'center',
          dnt: true,
        })
        .then((el: HTMLElement | undefined) => {
          if (el) setLoaded(true)
          else setError(true)
        })
        .catch(() => setError(true))
    }

    const scriptId = 'twitter-widgets-js'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://platform.twitter.com/widgets.js'
      script.async = true
      script.onload = renderTweet
      document.head.appendChild(script)
    } else if ((window as any).twttr?.widgets) {
      renderTweet()
    } else {
      const poll = setInterval(() => {
        if ((window as any).twttr?.widgets) {
          clearInterval(poll)
          renderTweet()
        }
      }, 100)
      return () => clearInterval(poll)
    }
  }, [tweetId])

  return (
    <Box>
      {content.caption && (
        <Typography
          level="body-xs"
          sx={{ color: '#888', mb: 1, fontStyle: 'italic', textAlign: 'center' }}
        >
          {content.caption}
        </Typography>
      )}

      <Box ref={containerRef} sx={{ display: 'flex', justifyContent: 'center', minHeight: 100 }} />

      {!loaded && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size="sm" />
        </Box>
      )}

      {error && (
        <Card
          variant="outlined"
          component="a"
          href={content.tweet_url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            bgcolor: '#0a0a0a',
            borderColor: '#333',
            textDecoration: 'none',
            cursor: 'pointer',
            '&:hover': { borderColor: '#1D9BF0' },
          }}
        >
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="svg"
              viewBox="0 0 24 24"
              sx={{ width: 20, height: 20, fill: '#FFF', flexShrink: 0 }}
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </Box>
            <Typography level="body-sm" sx={{ color: '#CCC' }}>
              {content.fallback_text || 'View post on X'}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
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
    'DAY-TO-DAY': '#FB923C',
  }

  const progressColor: Record<string, string> = {
    Healthy: '#10B981',
    Out: '#EF4444',
    Questionable: '#FF6B35',
    Probable: '#FFC72C',
  }

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${content.player_id}.png`}
            sx={{ width: 48, height: 48 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography level="body-sm" noWrap sx={{ color: '#FFF', fontWeight: 600 }}>
                  {content.player_name}
                </Typography>
                <Chip
                  size="sm"
                  sx={{
                    bgcolor: `${statusColor[content.status] ?? '#888'}22`,
                    color: statusColor[content.status] ?? '#888',
                    fontWeight: 700,
                    fontSize: '0.6rem',
                    flexShrink: 0,
                  }}
                >
                  {content.status}
                </Chip>
                {content.team_tricode && (
                  <Avatar
                    src={getTeamLogoUrl(content.team_tricode)}
                    alt={content.team_tricode}
                    sx={{ width: 20, height: 20, flexShrink: 0 }}
                  >
                    {content.team_tricode.charAt(0)}
                  </Avatar>
                )}
              </Stack>
            </Stack>

            {/* Season progress bar */}
            {content.progress_segments && content.progress_segments.length > 0 && (
              <Box sx={{ position: 'relative', width: '100%', height: 14, borderRadius: '4px', overflow: 'hidden', mt: 0.75 }}>
                {content.progress_segments.map((seg: InjuryProgressSegment, idx: number) => (
                  <Box
                    key={idx}
                    sx={{
                      position: 'absolute',
                      left: `${seg.startPercent}%`,
                      width: `${seg.widthPercent}%`,
                      height: '100%',
                      bgcolor: progressColor[seg.status] ?? '#666',
                      borderRadius:
                        idx === 0 && idx === content.progress_segments!.length - 1 ? '4px'
                          : idx === 0 ? '4px 0 0 4px'
                            : idx === content.progress_segments!.length - 1 ? '0 4px 4px 0'
                              : '0',
                    }}
                  />
                ))}
              </Box>
            )}

            <Typography level="body-xs" sx={{ color: '#888', mt: 0.5 }}>
              {content.injury}
            </Typography>
            {content.impact_note && (
              <Typography level="body-xs" sx={{ color: '#AAA', mt: 0.25, fontStyle: 'italic' }}>
                {content.impact_note}
              </Typography>
            )}
          </Box>
        </Box>
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

function GameLogSection({ content }: { content: GameLogContent }) {
  const rows = content.rows ?? []
  const avgs = content.averages ?? {}
  const gp = avgs.gp ?? rows.length

  if (rows.length === 0) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222' }}>
        <CardContent>
          <Typography level="body-sm" sx={{ color: '#666' }}>No game log data available.</Typography>
        </CardContent>
      </Card>
    )
  }

  const thStyle: React.CSSProperties = {
    color: '#888', padding: '6px 8px', textAlign: 'right',
    borderBottom: '1px solid #222', fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap',
  }
  const thLeft: React.CSSProperties = { ...thStyle, textAlign: 'left' }
  const tdStyle: React.CSSProperties = { color: '#CCC', padding: '5px 8px', textAlign: 'right', fontSize: '0.75rem', borderBottom: '1px solid #1a1a1a' }
  const tdLeft: React.CSSProperties = { ...tdStyle, textAlign: 'left' }

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'auto' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
          <Typography level="title-sm" sx={{ color: '#FFC72C', fontWeight: 700 }}>
            {content.player_name} — Game Log
          </Typography>
          <Typography level="body-xs" sx={{ color: '#888' }}>
            {content.period_label} &middot; {gp} game{gp !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={thLeft}>Date</th>
              <th style={thLeft}>Matchup</th>
              <th style={thStyle}>MIN</th>
              <th style={thStyle}>PTS</th>
              <th style={thStyle}>REB</th>
              <th style={thStyle}>AST</th>
              <th style={thStyle}>STL</th>
              <th style={thStyle}>BLK</th>
              <th style={thStyle}>TOV</th>
              <th style={thStyle}>FG</th>
              <th style={thStyle}>3PT</th>
              <th style={thStyle}>FT</th>
              <th style={thStyle}>+/-</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={tdLeft}>{r.game_date}</td>
                <td style={{ ...tdLeft, fontWeight: 500, color: '#FFF' }}>{r.matchup}</td>
                <td style={tdStyle}>{r.min ?? '—'}</td>
                <td style={{ ...tdStyle, color: '#FFC72C', fontWeight: 700 }}>{r.pts}</td>
                <td style={tdStyle}>{r.reb}</td>
                <td style={tdStyle}>{r.ast}</td>
                <td style={tdStyle}>{r.stl}</td>
                <td style={tdStyle}>{r.blk}</td>
                <td style={tdStyle}>{r.tov}</td>
                <td style={tdStyle}>{r.fgm}-{r.fga}</td>
                <td style={tdStyle}>{r.fg3m}-{r.fg3a}</td>
                <td style={tdStyle}>{r.ftm}-{r.fta}</td>
                <td style={{
                  ...tdStyle,
                  color: (r.plus_minus ?? 0) >= 0 ? '#10B981' : '#EF4444',
                }}>
                  {r.plus_minus != null ? `${r.plus_minus >= 0 ? '+' : ''}${r.plus_minus}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #333' }}>
              <td colSpan={2} style={{ ...tdLeft, fontWeight: 700, color: '#FFF' }}>
                Averages ({gp} GP)
              </td>
              <td style={tdStyle}>—</td>
              <td style={{ ...tdStyle, color: '#FFC72C', fontWeight: 700 }}>{avgs.ppg?.toFixed(1) ?? '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{avgs.rpg?.toFixed(1) ?? '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{avgs.apg?.toFixed(1) ?? '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{avgs.spg?.toFixed(1) ?? '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{avgs.bpg?.toFixed(1) ?? '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{avgs.topg?.toFixed(1) ?? '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{avgs.fg_pct != null ? `${avgs.fg_pct.toFixed(1)}%` : '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{avgs.fg3_pct != null ? `${avgs.fg3_pct.toFixed(1)}%` : '—'}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{avgs.ft_pct != null ? `${avgs.ft_pct.toFixed(1)}%` : '—'}</td>
              <td style={tdStyle}>—</td>
            </tr>
          </tfoot>
        </Box>
      </CardContent>
    </Card>
  )
}

/** Renders chart sections: radar (recharts) or placeholder for other types. */
function ChartSection({ content }: { content: ChartContent }) {
  const { chart_type, chart_props, caption } = content
  const data = chart_props?.data as Array<{ subject: string; value: number; fullMark: number }> | undefined

  if (chart_type === 'radar' && data && data.length >= 3) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', p: 2, overflow: 'hidden' }}>
        <Box sx={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#333" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#AAA', fontSize: 11 }}
                tickLine={{ stroke: '#444' }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#666', fontSize: 10 }} />
              <Radar name="Stats" dataKey="value" stroke="#60A5FA" fill="#60A5FA" fillOpacity={0.4} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </Box>
        {caption && (
          <Typography level="body-sm" sx={{ color: '#888', textAlign: 'center', mt: 1 }}>
            {caption}
          </Typography>
        )}
      </Card>
    )
  }

  if (chart_type === 'shot_chart' && Array.isArray((chart_props as any)?.shots)) {
    const shots = (chart_props as any).shots as any[]
    const playerName = (chart_props as any).playerName as string | undefined
    const teamTricode = (chart_props as any).teamTricode as string | undefined
    return (
      <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', p: 2, overflow: 'hidden' }}>
        <Box sx={{ width: '100%', height: 460 }}>
          <ShotChartTable shots={shots as any} playerName={playerName} teamTricode={teamTricode} />
        </Box>
        {caption && (
          <Typography level="body-sm" sx={{ color: '#888', textAlign: 'center', mt: 1 }}>
            {caption}
          </Typography>
        )}
      </Card>
    )
  }

  if (chart_type === 'bar' && Array.isArray((chart_props as any)?.data)) {
    const barData = (chart_props as any).data as Array<{ zone: string; fgm: number; missed?: number; fga?: number; pct?: number }>
    if (barData.length >= 2) {
      return (
        <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', p: 2, overflow: 'hidden' }}>
          <Box sx={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 10, right: 16, left: 24, bottom: 10 }}>
                <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#AAA', fontSize: 11 }} tickLine={{ stroke: '#444' }} axisLine={{ stroke: '#333' }} />
                <YAxis
                  type="category"
                  dataKey="zone"
                  width={120}
                  tick={{ fill: '#AAA', fontSize: 11 }}
                  tickLine={{ stroke: '#444' }}
                  axisLine={{ stroke: '#333' }}
                />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #333', color: '#eee' }}
                  formatter={(value: any, name: any, props: any) => {
                    const v = Number(value)
                    if (!Number.isFinite(v)) return [value, name]
                    if (name === 'fgm') return [v, 'Made']
                    if (name === 'missed') return [v, 'Missed']
                    return [v, String(name)]
                  }}
                  labelFormatter={(label: any) => String(label)}
                />
                <Legend wrapperStyle={{ color: '#AAA', fontSize: 12 }} />
                <Bar dataKey="fgm" stackId="a" fill="#4caf50" name="Made" radius={[4, 0, 0, 4]} />
                <Bar dataKey="missed" stackId="a" fill="#f44336" name="Missed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          {caption && (
            <Typography level="body-sm" sx={{ color: '#888', textAlign: 'center', mt: 1 }}>
              {caption}
            </Typography>
          )}
        </Card>
      )
    }
  }

  if (chart_type === 'metric_bar' && Array.isArray((chart_props as any)?.data)) {
    const metrics = (chart_props as any).data as Array<{ label: string; value: number }>
    if (metrics.length >= 2) {
      const chartHeight = Math.min(400, 72 + metrics.length * 44)
      return (
        <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', p: 2, overflow: 'hidden' }}>
          <Box sx={{ width: '100%', height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: '#AAA', fontSize: 11 }}
                  tickLine={{ stroke: '#444' }}
                  axisLine={{ stroke: '#333' }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={108}
                  tick={{ fill: '#AAA', fontSize: 11 }}
                  tickLine={{ stroke: '#444' }}
                  axisLine={{ stroke: '#333' }}
                />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #333', color: '#eee' }}
                  formatter={(value: number) => [`${Number(value).toFixed(1)}`, '']}
                />
                <Bar dataKey="value" fill="#60A5FA" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          {caption && (
            <Typography level="body-sm" sx={{ color: '#888', textAlign: 'center', mt: 1 }}>
              {caption}
            </Typography>
          )}
        </Card>
      )
    }
  }

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', p: 3, textAlign: 'center' }}>
      <Typography level="body-sm" sx={{ color: '#888' }}>
        Chart: {chart_type ?? 'unknown'}
      </Typography>
    </Card>
  )
}

// ─── Section router ─────────────────────────────────────────

function SectionRenderer({
  section,
  sectionIndex,
  activePlayerHighlightSectionIndex,
  onScrollToPlayer,
  post,
  groupPosition,
  noCard,
}: {
  section: FeedPostSection
  sectionIndex: number
  activePlayerHighlightSectionIndex: number
  onScrollToPlayer?: (nbaPlayerId: number) => void
  post?: FeedPost | null
  /** When grouped with next/prev section (e.g. video_carousel + player_highlight), remove margin and inner card border so they look like one module */
  groupPosition?: 'first' | 'last'
  /** When true, do not wrap in root Box (for embedding inside a single parent Card). */
  noCard?: boolean
}) {
  const navigate = useNavigate()
  const { section_type, content, title } = section
  const isActivePlayerHighlight = section_type === 'player_highlight' && sectionIndex === activePlayerHighlightSectionIndex

  const weekRange = useMemo(() => {
    if (post?.post_type !== 'team_of_week' || !post?.metadata) return undefined
    const meta = typeof post.metadata === 'string'
      ? (() => { try { return JSON.parse(post.metadata || '{}') } catch { return {} } })()
      : post.metadata
    const start = meta.week_start ?? meta.totw_row?.week_start
    const end = meta.week_end ?? meta.totw_row?.week_end
    if (start && end) return { start: String(start), end: String(end) }
    return undefined
  }, [post?.post_type, post?.metadata])

  const gameDate = useMemo(() => {
    if (post?.post_type !== 'team_of_night') return undefined
    let raw: string | undefined = post.game_date
    if (!raw && post?.metadata) {
      const meta = typeof post.metadata === 'string'
        ? (() => { try { return JSON.parse(post.metadata || '{}') } catch { return {} } })()
        : post.metadata as Record<string, unknown>
      raw = (meta?.totn_row as { game_date?: string } | undefined)?.game_date ?? meta?.game_date as string | undefined
    }
    if (!raw) return undefined
    const s = String(raw)
    return s.includes('T') ? s.slice(0, 10) : s
  }, [post?.post_type, post?.game_date, post?.metadata])

  const isUuid = (s: string | null | undefined) =>
    !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

  const handlePlayerClickByNbaId = useCallback(
    async (nbaPlayerId: number) => {
      const { data } = await supabase
        .from('nba_players')
        .select('id')
        .eq('nba_player_id', nbaPlayerId)
        .maybeSingle()
      if (data?.id) navigate(`/player/${data.id}`)
    },
    [navigate]
  )

  const handlePlayerClickWithOptionalUuid = useCallback(
    async (playerId: string | null, nbaPlayerId: number) => {
      if (isUuid(playerId)) {
        navigate(`/player/${playerId}`)
        return
      }
      await handlePlayerClickByNbaId(nbaPlayerId)
    },
    [navigate, handlePlayerClickByNbaId]
  )

  const rootSx = useMemo(
    () => ({
      mb: groupPosition ? 0 : 3,
      ...(groupPosition === 'first' && {
        '& > *:last-child': {
          borderBottom: 'none',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        },
      }),
      ...(groupPosition === 'last' && {
        '& > *:last-child': {
          borderTop: 'none',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        },
      }),
    }),
    [groupPosition]
  )

  const sectionContent = (
    <>
      {section_type === 'hero' && post?.post_type !== 'player_spotlight' && (
        <HeroSection content={content as HeroContent} />
      )}
      {section_type === 'headline' && <HeadlineSection content={content as HeadlineContent} />}
      {section_type === 'lineup_card' && <LineupCardSection content={content as LineupCardContent} />}
      {section_type === 'player_highlight' && (
        <PlayerHighlightSection
          content={content as PlayerHighlightContent}
          isActiveSection={isActivePlayerHighlight}
          weekRange={weekRange}
          gameDate={gameDate}
          onPlayerClick={handlePlayerClickByNbaId}
          hideVideo={post?.post_type === 'player_spotlight'}
          noCard={noCard}
        />
      )}
      {section_type === 'stat_comparison' && <StatComparisonSection content={content as StatComparisonContent} />}
      {section_type === 'video_clip' && <VideoClipSection content={content as VideoClipContent} />}
      {section_type === 'video_carousel' && (
        <VideoCarouselSection content={content as VideoCarouselContent} noCard={noCard} />
      )}
      {section_type === 'rich_text' && <RichTextSection content={content as RichTextContent} />}
      {section_type === 'prop_card' && <PropCardSection content={content as PropCardContent} />}
      {section_type === 'injury_card' && <InjuryCardSection content={content as InjuryCardContent} />}
      {section_type === 'injury_module' && (
        <InjuryModuleDisplay
          injuries={(content as InjuryModuleContent).injuries}
          teams={(content as InjuryModuleContent).teams}
          date={(content as InjuryModuleContent).date}
          compact
          onPlayerClick={handlePlayerClickByNbaId}
        />
      )}
      {section_type === 'prop_module' && (
        <PropModuleDisplay
          props={(content as PropModuleContent).props}
          teams={(content as PropModuleContent).teams}
          date={(content as PropModuleContent).date}
          mode={(content as PropModuleContent).mode}
          embedMode={(content as PropModuleContent).embedMode}
          compact
          onPlayerClick={handlePlayerClickByNbaId}
        />
      )}
      {section_type === 'team_of_night_module' && (
        <TeamOfNightModuleDisplay
          players={(content as TeamOfNightModuleContent).players}
          date={(content as TeamOfNightModuleContent).date}
          compact
          showJersey={true}
          onPlayerClick={onScrollToPlayer ? (_uuid, nbaId) => onScrollToPlayer(nbaId) : handlePlayerClickWithOptionalUuid}
        />
      )}
      {section_type === 'team_of_week_module' && (
        <TeamOfWeekModuleDisplay
          players={(content as TeamOfWeekModuleContent).players}
          weekName={(content as TeamOfWeekModuleContent).week_name}
          startDate={(content as TeamOfWeekModuleContent).start_date}
          endDate={(content as TeamOfWeekModuleContent).end_date}
          compact
          onPlayerClick={onScrollToPlayer ? (_uuid, nbaId) => onScrollToPlayer(nbaId) : handlePlayerClickWithOptionalUuid}
        />
      )}
      {section_type === 'tank_module' && (
        <TankModuleDisplay
          rows={(content as TankModuleContent).rows}
          season={(content as TankModuleContent).season}
          snapshotDate={(content as TankModuleContent).snapshot_date}
          compact
          onTeamClick={(internalId) => internalId && navigate(`/team/${internalId}`)}
          onProspectClick={(id) => navigate(`/prospect/${id}`)}
        />
      )}
      {section_type === 'dfs_module' && (() => {
        const dfs = content as DfsModuleContent
        return (
          <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333', p: 2 }}>
            <Typography level="title-sm" sx={{ mb: 1 }}>DFS snapshot — {dfs.snapshot_date}</Typography>
            {dfs.message && <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 1 }}>{dfs.message}</Typography>}
            {dfs.pools && dfs.pools.length > 0 && (
              <Stack gap={0.5} sx={{ mt: 1 }}>
                {dfs.pools.map((p) => (
                  <Box key={p.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography level="body-sm">{p.name}</Typography>
                    <Chip size="sm" variant="soft">{p.status}</Chip>
                  </Box>
                ))}
              </Stack>
            )}
            <Button size="sm" variant="soft" sx={{ mt: 2 }} onClick={() => navigate('/dfs')}>View DFS</Button>
          </Card>
        )
      })()}
      {section_type === 'pull_quote' && <PullQuoteSection content={content as PullQuoteContent} />}
      {section_type === 'gallery' && <GallerySection content={content as GalleryContent} />}
      {section_type === 'box_score' && <BoxScoreSection content={content as BoxScoreContent} />}
      {section_type === 'game_log' && <GameLogSection content={content as GameLogContent} />}
      {section_type === 'post_link' && <PostLinkSection content={content as PostLinkContent} />}
      {section_type === 'tweet_embed' && <TweetEmbedSection content={content as TweetEmbedContent} />}
      {section_type === 'chart' && (
        <ChartSection content={content as ChartContent} />
      )}
    </>
  )

  if (noCard) return sectionContent
  return <Box sx={rootSx}>{sectionContent}</Box>
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

// ─── Linked child posts (props / injuries / spotlight) ───────

function parseStoryPostMetadata(post: FeedPost): Record<string, unknown> {
  if (!post.metadata) return {}
  if (typeof post.metadata === 'string') {
    try {
      return JSON.parse(post.metadata || '{}')
    } catch {
      return {}
    }
  }
  return post.metadata as Record<string, unknown>
}

function LinkedChildPostsStrip({ post }: { post: FeedPost }) {
  const navigate = useNavigate()
  const meta = useMemo(() => parseStoryPostMetadata(post), [post.metadata])

  const linkedIds = useMemo(() => {
    const rows: { id: string; kind: 'props' | 'injuries' }[] = []
    const p = meta.linked_prop_prediction_post_id
    const i = meta.linked_injury_post_id
    if (p) rows.push({ id: String(p), kind: 'props' })
    if (i) rows.push({ id: String(i), kind: 'injuries' })
    return rows
  }, [meta])

  const metaIdList = useMemo(() => linkedIds.map((x) => x.id).filter(Boolean), [linkedIds])

  const { data: linkedRows } = useQuery({
    queryKey: ['feed-linked-child-posts', post.id, [...metaIdList].sort().join(',')],
    queryFn: async () => {
      if (metaIdList.length === 0) return []
      const { data, error } = await supabase
        .from('feed_posts')
        .select('id, slug, title, post_type')
        .in('id', metaIdList)
        .eq('status', 'published')
      if (error) throw error
      return data ?? []
    },
    enabled: metaIdList.length > 0,
    staleTime: 60_000,
  })

  const showSpotlight =
    !!post.game_id && (post.post_type === 'upcoming' || post.post_type === 'game_recap')

  const { data: spotlightRow } = useQuery({
    queryKey: ['feed-spotlight-linked', post.game_id, post.id],
    queryFn: async () => {
      if (!post.game_id) return null
      const { data, error } = await supabase
        .from('feed_posts')
        .select('id, slug, title, post_type')
        .eq('game_id', post.game_id)
        .eq('post_type', 'player_spotlight')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: showSpotlight,
    staleTime: 60_000,
  })

  const items = useMemo(() => {
    const byId = new Map((linkedRows ?? []).map((r) => [r.id, r]))
    const out: { slug: string; label: string; color: string }[] = []
    for (const { id, kind } of linkedIds) {
      const r = byId.get(id)
      if (!r?.slug) continue
      out.push({
        slug: r.slug,
        label: kind === 'props' ? 'Prop predictions' : 'Injury report',
        color: kind === 'props' ? '#FB923C' : '#EF4444',
      })
    }
    if (spotlightRow?.slug && !out.some((o) => o.slug === spotlightRow.slug)) {
      out.push({ slug: spotlightRow.slug, label: 'Player spotlight', color: '#60A5FA' })
    }
    return out
  }, [linkedIds, linkedRows, spotlightRow])

  if (items.length === 0) return null

  return (
    <Box
      sx={{
        mb: 2,
        p: 1.5,
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'rgba(255,255,255,0.12)',
        bgcolor: 'rgba(255,255,255,0.04)',
      }}
    >
      <Typography level="title-sm" sx={{ color: '#FFF', fontWeight: 700, mb: 1 }}>
        More for this game
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {items.map((it) => (
          <Chip
            key={it.slug}
            variant="soft"
            onClick={() => navigate(`/feed/${it.slug}`)}
            sx={{
              cursor: 'pointer',
              fontWeight: 700,
              borderColor: it.color,
              color: it.color,
              bgcolor: `${it.color}18`,
              '&:hover': { bgcolor: `${it.color}28` },
            }}
          >
            {it.label}
          </Chip>
        ))}
      </Stack>
    </Box>
  )
}

// ─── Main component ─────────────────────────────────────────

export default function PostStory() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const isMobile = useMediaQuery('(max-width: 900px)')
  const reduceMotion = useReducedMotion()
  const clearFeedScope = useFeedVideoStore((s) => s.clearScope)
  const clearPostScope = useFeedVideoStore((s) => s.clearScope)
  useEffect(() => {
    clearFeedScope('feed')
  }, [clearFeedScope])
  useEffect(
    () => () => {
      clearPostScope('post')
    },
    [clearPostScope]
  )

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

  const handleScrollToPlayer = useCallback((nbaPlayerId: number) => {
    document.getElementById(`player-highlight-${nbaPlayerId}`)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handlePlayerClickByNbaId = useCallback(
    async (nbaPlayerId: number) => {
      const { data } = await supabase
        .from('nba_players')
        .select('id')
        .eq('nba_player_id', nbaPlayerId)
        .maybeSingle()
      if (data?.id) navigate(`/player/${data.id}`)
    },
    [navigate]
  )

  // For player_spotlight: reorder so pull_quote appears below the radar (after last chart)
  const displaySections = useMemo(() => {
    const list = sections ?? []
    if (post?.post_type !== 'player_spotlight') return list
    const pullQuote = list.find((s) => s.section_type === 'pull_quote')
    if (!pullQuote) return list
    const withoutPull = list.filter((s) => s.section_type !== 'pull_quote')
    const lastChartIdx = withoutPull.reduce((acc, s, i) => (s.section_type === 'chart' ? i : acc), -1)
    if (lastChartIdx < 0) return list
    return [
      ...withoutPull.slice(0, lastChartIdx + 1),
      pullQuote,
      ...withoutPull.slice(lastChartIdx + 1),
    ]
  }, [sections, post?.post_type])

  const reelInfo = useMemo(
    () =>
      displaySections?.length
        ? getReelVideoFromSections(displaySections)
        : { url: null as string | null, urls: [] as string[], skipSectionId: null as string | null },
    [displaySections]
  )
  const reelUrls = useMemo(
    () => (reelInfo.urls.length > 0 ? reelInfo.urls : reelInfo.url ? [reelInfo.url] : []),
    [reelInfo.urls, reelInfo.url]
  )
  /** Mobile: any post with reel URLs. Desktop: player spotlight only (same reel UX as phone). */
  const showStoryReel =
    reelUrls.length > 0 &&
    !!post?.id &&
    (isMobile || post?.post_type === 'player_spotlight')

  const shouldSkipSectionForReel = useCallback(
    (section: FeedPostSection) => {
      if (!showStoryReel || !reelInfo.skipSectionId || section.id !== reelInfo.skipSectionId) return false
      return true
    },
    [showStoryReel, reelInfo.skipSectionId]
  )

  const spotlightSkip = useMemo(
    () => buildSpotlightSkipSet(displaySections ?? []),
    [displaySections]
  )

  // Injury report: first 3 players from injury_module for header (same idea as prop prediction "three in header")
  const injuryHeaderPlayers = useMemo(() => {
    if (post?.post_type !== 'injury_report' || !sections?.length) return []
    const injurySection = sections.find((s) => s.section_type === 'injury_module')
    const content = injurySection?.content as InjuryModuleContent | undefined
    const injuries = content?.injuries
    if (!Array.isArray(injuries)) return []
    return injuries.slice(0, 3).map((inj) => ({
      nba_player_id: inj.nba_player_id,
      player_name: inj.player_name,
      team_tricode: inj.team_tricode,
    }))
  }, [post?.post_type, sections])

  // Only one player_highlight section "active" at a time so only one video plays; scroll to a section to watch its slideshow
  const playerHighlightIndices = useMemo(
    () => displaySections.map((s, i) => (s.section_type === 'player_highlight' ? i : null)).filter((x): x is number => x != null),
    [displaySections]
  )
  const [activePlayerHighlightSectionIndex, setActivePlayerHighlightSectionIndex] = useState<number>(() => playerHighlightIndices[0] ?? 0)
  const sectionRefsMap = useRef<Map<number, HTMLDivElement | null>>(new Map())
  const ratioRef = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    if (playerHighlightIndices.length === 0) return
    const elements = playerHighlightIndices
      .map((i) => sectionRefsMap.current.get(i))
      .filter(Boolean) as HTMLDivElement[]
    if (elements.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLDivElement
          for (const [idx, refEl] of sectionRefsMap.current) {
            if (refEl === el) {
              ratioRef.current.set(idx, entry.intersectionRatio)
              break
            }
          }
        }
        let bestIndex = playerHighlightIndices[0] ?? 0
        let bestRatio = 0
        for (const idx of playerHighlightIndices) {
          const r = ratioRef.current.get(idx) ?? 0
          if (r > bestRatio) {
            bestRatio = r
            bestIndex = idx
          }
        }
        setActivePlayerHighlightSectionIndex(bestIndex)
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-10% 0px -10% 0px' }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [playerHighlightIndices])

  // When sections load, default active to first player_highlight
  useEffect(() => {
    if (playerHighlightIndices.length > 0 && !playerHighlightIndices.includes(activePlayerHighlightSectionIndex)) {
      setActivePlayerHighlightSectionIndex(playerHighlightIndices[0])
    }
  }, [playerHighlightIndices, activePlayerHighlightSectionIndex])

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

  /** On mobile with reel: stats/charts/engagement sit in article blocks below the hero. */
  const ScrollShell = showStoryReel ? PostStoryMobileArticleShell : Fragment

  const storyBody = (
      <Box
        sx={{
          maxWidth: '100%',
          mx: 'auto',
          px: { xs: 2, md: 0 },
          pt:
            showStoryReel && post?.post_type === 'player_spotlight' && !isMobile
              ? 0
              : showStoryReel
                ? 1
                : 2,
          pb: 12,
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          bgcolor: '#0d0d0d',
          minHeight: '100%',
          overflowX: 'hidden',
        }}
      >
        {showStoryReel && reelUrls.length > 0 && (
          <Box
            sx={{
              mx: { xs: -2, sm: -2 },
              width: { xs: 'calc(100% + 32px)', sm: 'calc(100% + 32px)' },
              maxWidth: post?.post_type === 'player_spotlight' && !isMobile ? 640 : 'none',
              ...(post?.post_type === 'player_spotlight' && !isMobile ? { mx: 'auto' } : {}),
            }}
          >
            <PostStoryMobileReel
              postId={post.id}
              videoUrls={reelUrls}
              post={post}
              onBack={() => navigate('/feed')}
            />
          </Box>
        )}
        {/* Back button + title + subtitle on one row — dark background so compact sections (prop module, etc.) stay legible */}
        {!showStoryReel && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
            minHeight: 40,
          }}
        >
          <IconButton
            onClick={() => navigate('/feed')}
            sx={{ color: '#AAA', flexShrink: 0, '&:hover': { color: '#FFF' } }}
            aria-label="Back to feed"
          >
            <ArrowBack />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {post.title && (
              <PostStoryTitleWithTeamLogos
                post={post}
                level="title-md"
                logoSize={32}
                sx={{
                  color: '#FFF',
                  fontWeight: 700,
                  fontFamily: '"Libre Baskerville", serif',
                  lineHeight: 1.3,
                }}
              />
            )}
            {post.subtitle && (
              <Typography
                level="body-sm"
                sx={{ color: '#CCC', lineHeight: 1.3 }}
              >
                {post.subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        )}

        <ScrollShell>
        <LinkedChildPostsStrip post={post} />

        {/* Injury report: three players in header (like prop predictions) + red injured icon */}
        {post.post_type === 'injury_report' && injuryHeaderPlayers.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalHospital sx={{ color: '#EF4444', fontSize: 24 }} aria-hidden />
              <Typography level="body-sm" sx={{ color: '#AAA', fontWeight: 600 }}>
                Featured
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1.5,
                maxWidth: 280,
              }}
            >
              {injuryHeaderPlayers.map((p, i) => (
                <Box
                  key={p.nba_player_id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <Avatar
                    src={`https://cdn.nba.com/headshots/nba/latest/260x190/${p.nba_player_id}.png`}
                    sx={{
                      width: 56,
                      height: 56,
                      border: '2px solid #333',
                      '& img': { objectFit: 'cover', width: '100%', height: '100%' },
                    }}
                    onClick={() => handlePlayerClickByNbaId(p.nba_player_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handlePlayerClickByNbaId(p.nba_player_id)}
                  />
                  <Typography level="body-xs" sx={{ color: '#CCC', textAlign: 'center', maxWidth: 72 }} noWrap>
                    {p.player_name}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Sections (hero with gradient is first); for player_spotlight, video_carousel + player_highlight render as one module */}
        <Box ref={contentRef}>
        {displaySections.map((section, sectionIndex) => {
          if (shouldSkipSectionForReel(section)) return null
          if (spotlightSkip.has(sectionIndex)) return null
          const spotlightGroup = getSpotlightGroupAtIndex(displaySections, sectionIndex)
          if (spotlightGroup) {
            return (
              <motion.div
                key={`spotlight-${spotlightGroup[0].id}`}
                style={{ width: '100%' }}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.34,
                  delay: reduceMotion ? 0 : Math.min(sectionIndex, 24) * 0.028,
                }}
              >
                <Box sx={{ mb: 2 }}>
                  <PostLinkSpotlightCarousel sections={spotlightGroup} />
                </Box>
              </motion.div>
            )
          }
          const nextSection = displaySections[sectionIndex + 1]
          // Skip all headline sections; title + subtitle already shown in header row (lifts everything else)
          if (section.section_type === 'headline') {
            return null
          }
          const isSpotlightVideoGroup =
            post?.post_type === 'player_spotlight' &&
            section.section_type === 'video_carousel' &&
            nextSection?.section_type === 'player_highlight'
          if (
            post?.post_type === 'player_spotlight' &&
            section.section_type === 'player_highlight' &&
            displaySections[sectionIndex - 1]?.section_type === 'video_carousel'
          ) {
            return null
          }
          if (isSpotlightVideoGroup) {
            // Desktop: player block + carousel. Mobile reel: all clips in hero; only player block here (no duplicate carousel).
            if (showStoryReel) {
              return (
                <motion.div
                  key={`${section.id}-reel-stats`}
                  style={{ width: '100%' }}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.34,
                    delay: reduceMotion ? 0 : Math.min(sectionIndex, 24) * 0.028,
                  }}
                >
                  <Card
                    variant="outlined"
                    sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'hidden', mb: 3 }}
                  >
                    <Box
                      ref={(el: HTMLDivElement | null) => {
                        sectionRefsMap.current.set(sectionIndex + 1, el)
                      }}
                      id={
                        nextSection?.section_type === 'player_highlight' &&
                        (nextSection.content as PlayerHighlightContent)?.player_id != null
                          ? `player-highlight-${(nextSection.content as PlayerHighlightContent).player_id}`
                          : undefined
                      }
                    >
                      <SectionRenderer
                        section={nextSection}
                        sectionIndex={sectionIndex + 1}
                        activePlayerHighlightSectionIndex={activePlayerHighlightSectionIndex}
                        onScrollToPlayer={handleScrollToPlayer}
                        post={post ?? undefined}
                        groupPosition="first"
                        noCard
                      />
                    </Box>
                  </Card>
                </motion.div>
              )
            }
            // Player block (avatar, name, FP, team, stat row) first, then video below
            return (
              <motion.div
                key={section.id}
                style={{ width: '100%' }}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.34,
                  delay: reduceMotion ? 0 : Math.min(sectionIndex, 24) * 0.028,
                }}
              >
              <Card
                variant="outlined"
                sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'hidden', mb: 3 }}
              >
                <Box
                  ref={(el: HTMLDivElement | null) => {
                    sectionRefsMap.current.set(sectionIndex + 1, el)
                  }}
                  id={
                    nextSection?.section_type === 'player_highlight' && (nextSection.content as PlayerHighlightContent)?.player_id != null
                      ? `player-highlight-${(nextSection.content as PlayerHighlightContent).player_id}`
                      : undefined
                  }
                >
                  <SectionRenderer
                    section={nextSection}
                    sectionIndex={sectionIndex + 1}
                    activePlayerHighlightSectionIndex={activePlayerHighlightSectionIndex}
                    onScrollToPlayer={handleScrollToPlayer}
                    post={post ?? undefined}
                    groupPosition="first"
                    noCard
                  />
                </Box>
                <Box
                  ref={(el: HTMLDivElement | null) => {
                    sectionRefsMap.current.set(sectionIndex, el)
                  }}
                >
                  <SectionRenderer
                    section={section}
                    sectionIndex={sectionIndex}
                    activePlayerHighlightSectionIndex={activePlayerHighlightSectionIndex}
                    onScrollToPlayer={handleScrollToPlayer}
                    post={post ?? undefined}
                    groupPosition="last"
                    noCard
                  />
                </Box>
              </Card>
              </motion.div>
            )
          }
          return (
            <motion.div
              key={section.id}
              style={{ width: '100%' }}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.32,
                delay: reduceMotion ? 0 : Math.min(sectionIndex, 24) * 0.028,
              }}
            >
            <Box
              ref={(el: HTMLDivElement | null) => {
                sectionRefsMap.current.set(sectionIndex, el)
              }}
              id={section.section_type === 'player_highlight' && (section.content as PlayerHighlightContent)?.player_id != null ? `player-highlight-${(section.content as PlayerHighlightContent).player_id}` : undefined}
            >
              <SectionRenderer
                section={section}
                sectionIndex={sectionIndex}
                activePlayerHighlightSectionIndex={activePlayerHighlightSectionIndex}
                onScrollToPlayer={handleScrollToPlayer}
                post={post ?? undefined}
              />
            </Box>
            </motion.div>
          )
        })}

        {(displaySections.length === 0) && (
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
        </ScrollShell>
      </Box>
  )

  return !isMobile ? (
    <PostStoryDesktopBlogShell
      compactTop={post.post_type === 'player_spotlight'}
      hero={
        post.post_type === 'player_spotlight'
          ? undefined
          : post.cover_image_url
            ? (
                <img
                  src={post.cover_image_url}
                  alt=""
                  className="max-h-[min(480px,50vh)] w-full object-cover"
                />
              )
            : undefined
      }
    >
      {storyBody}
    </PostStoryDesktopBlogShell>
  ) : (
    storyBody
  )
}
