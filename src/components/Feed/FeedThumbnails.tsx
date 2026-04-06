/**
 * Feed card thumbnails by post type.
 * Renders custom thumbnails (e.g. Team of the Week grid) or fallbacks.
 */

import { useMemo, type CSSProperties } from 'react'
import { Box } from '@mui/joy'
import { Typography } from '@/components/ui/typography'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { AvatarStack } from '@/components/kibo-ui/avatar-stack'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'
import Assessment from '@mui/icons-material/Assessment'
import Article from '@mui/icons-material/Article'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import BarChart from '@mui/icons-material/BarChart'
import CalendarMonth from '@mui/icons-material/CalendarMonth'
import EmojiEvents from '@mui/icons-material/EmojiEvents'
import Event from '@mui/icons-material/Event'
import LocalHospital from '@mui/icons-material/LocalHospital'
import Newspaper from '@mui/icons-material/Newspaper'
import Person from '@mui/icons-material/Person'
import Star from '@mui/icons-material/Star'
import TrendingUp from '@mui/icons-material/TrendingUp'
import WorkspacePremium from '@mui/icons-material/WorkspacePremium'
import {
  getTeamAlternateColorForPlayerSpotlightFeedThumbnail,
  getTeamColorForPlayerSpotlightFeedThumbnail,
  getTeamPrimaryColor,
} from '../../utils/nbaTeamColors'
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos'
import type { PostType } from '../../types/feed'
import { useDraftProspectsByIds } from '../../hooks/useDraftProspectRankings'
import type { FeedPost } from '../../types/feed'
import { getFirstMp4FromPostMetadata, getMp4SlideUrlsFromMetadata } from '../../utils/feedFirstVideo'
import { getSpotlightFinalScorePairForThumbnail } from '../../utils/feedPostMetadata'
import { feedThumbVideoId } from '../../stores/feedVideoStore'
import { useFeedVideoSync } from '../../hooks/useFeedVideoSync'
import { useFeedThumbnailVideoAutoplay } from '../../hooks/useFeedThumbnailVideoAutoplay'

/** 16/9 aspect ratio wrapper with frame, overlay, and optional type-color accent. */
function Aspect16_9({
  className,
  children,
  accentColor,
  ...props
}: React.ComponentPropsWithoutRef<'div'> & { accentColor?: string }) {
  return (
    <div
      className={cn('aspect-video overflow-hidden bg-black relative feed-card-thumb', className)}
      style={{ isolation: 'isolate' }}
      {...props}
    >
      {children}
      {/* Subtle bottom gradient so card content reads better */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%, transparent 100%)',
        }}
      />
      {accentColor && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 pointer-events-none"
          aria-hidden
          style={{ backgroundColor: accentColor, opacity: 0.9 }}
        />
      )}
    </div>
  )
}

function thumbIconConfig(
  postType: PostType,
  fallbackColor: string
): { Icon: typeof LocalHospital; color: string } {
  switch (postType) {
    case 'injury_report':
      return { Icon: LocalHospital, color: '#EF4444' }
    case 'player_spotlight':
      return { Icon: AutoAwesome, color: fallbackColor }
    case 'prop_prediction':
      return { Icon: TrendingUp, color: fallbackColor }
    case 'prop_results':
      return { Icon: Assessment, color: fallbackColor }
    case 'game_recap':
      return { Icon: Newspaper, color: fallbackColor }
    case 'upcoming':
      return { Icon: Event, color: fallbackColor }
    case 'draft':
      return { Icon: EmojiEvents, color: fallbackColor }
    case 'team_of_week':
      return { Icon: Star, color: fallbackColor }
    case 'team_of_night':
      return { Icon: WorkspacePremium, color: fallbackColor }
    case 'player_of_week':
      return { Icon: Person, color: fallbackColor }
    case 'player_of_month':
      return { Icon: CalendarMonth, color: fallbackColor }
    case 'blog':
      return { Icon: Article, color: fallbackColor }
    case 'dfs':
      return { Icon: BarChart, color: fallbackColor }
    default:
      return { Icon: Article, color: fallbackColor }
  }
}

/** Bottom-right corner type icon (matches injury-report geometry). */
export function FeedThumbTypeIcon({ postType, typeColor }: { postType: PostType; typeColor: string }) {
  const { Icon, color } = thumbIconConfig(postType, typeColor)
  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 36,
        height: 36,
        borderRadius: '50%',
        bgcolor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
      }}
      aria-hidden
    >
      <Icon sx={{ color, fontSize: 22 }} />
    </Box>
  )
}

function hashStringToInt(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Muted loop MP4 preview when `metadata.slides` (or preview fields) expose a URL — orchestrated globally so only one plays. */
function FeedCardVideoPreview({
  postId,
  videoUrl,
  typeColor,
  postType,
}: {
  postId: string
  videoUrl: string
  typeColor: string
  postType: PostType
}) {
  const vidId = feedThumbVideoId(postId)
  const { ref, requestPlay } = useFeedVideoSync(vidId)
  const containerRef = useFeedThumbnailVideoAutoplay(postId, true)
  return (
    <Aspect16_9 accentColor={typeColor}>
      <div ref={containerRef} className="absolute inset-0">
        <video
          ref={ref}
          src={videoUrl}
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          onPlay={() => requestPlay(vidId, 'feed')}
        />
      </div>
      <FeedThumbTypeIcon postType={postType} typeColor={typeColor} />
    </Aspect16_9>
  )
}

/** Horizontal story strip when metadata has 2+ slide MP4s (thumbnail JPG per slide). */
function FeedCardStoriesThumb({
  postId,
  urls,
  typeColor,
  postType,
  reduceMotion,
}: {
  postId: string
  urls: string[]
  typeColor: string
  postType: PostType
  reduceMotion: boolean | null
}) {
  return (
    <Aspect16_9 accentColor={typeColor}>
      <motion.div
        className="absolute inset-0 bg-black"
        initial={reduceMotion ? false : { opacity: 0.88 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.35 }}
      >
        <Carousel className="h-full w-full pt-1" opts={{ align: 'start', loop: false, dragFree: true }}>
          <CarouselContent
            viewportClassName="h-[calc(100%-4px)]"
            className="-ml-2 h-full gap-0"
          >
            {urls.map((mp4, i) => {
              const thumb = mp4.includes('.mp4') ? mp4.replace('.mp4', '_thumbnail.jpg') : mp4
              return (
                <CarouselItem
                  key={`${postId}-slide-${i}`}
                  className="basis-[78%] pl-2 sm:basis-[62%]"
                >
                  <div className="relative h-full min-h-[80px] w-full overflow-hidden rounded-lg border border-white/10 bg-neutral-900/90">
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.opacity = '0.15'
                      }}
                    />
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>
        </Carousel>
      </motion.div>
      <FeedThumbTypeIcon postType={postType} typeColor={typeColor} />
    </Aspect16_9>
  )
}

const NBA_HEADSHOT = (nbaId: number | string) =>
  `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`

/** Large player image (same as player_of_week / player_of_month hero). */
const NBA_PLAYER_LARGE_IMAGE = (nbaId: number | string) =>
  `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`

/** Spread text for away/home pills; order matches `team_tricodes` [away, home]. */
function formatSpreadPillPrimary(
  primary: number | null | undefined,
  opposite: number | null | undefined,
): string {
  const value = primary != null ? primary : opposite != null ? -Number(opposite) : null
  if (value == null || Number.isNaN(value)) return ''
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(n)) return ''
  const prefix = n > 0 ? '+' : ''
  return `${prefix}${n.toFixed(1)}`
}

/**
 * Split gradient, watermark logos, and score pills — same layout as player spotlight feed cards.
 * When `playerImageUrl` is null (e.g. game recap), the center player layer is omitted.
 */
function TwoTeamSpotlightStyleFeedThumbnail({
  post,
  typeColor,
  iconPostType,
  playerImageUrl,
  scorePillMode = 'final',
  spreadAway = null,
  spreadHome = null,
  tipLabel = null,
  logoMotion = false,
}: {
  post: FeedPost
  typeColor: string
  iconPostType: PostType
  playerImageUrl: string | null
  scorePillMode?: 'final' | 'spread'
  spreadAway?: number | null
  spreadHome?: number | null
  tipLabel?: string | null
  logoMotion?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const teamTricodes = post.team_tricodes ?? []
  const teamA = teamTricodes[0]
  const teamB = teamTricodes[1]
  const colorA = teamA ? getTeamColorForPlayerSpotlightFeedThumbnail(teamA) : null
  const colorB = teamB ? getTeamColorForPlayerSpotlightFeedThumbnail(teamB) : null
  const hasTwoTeams = colorA && colorB
  const splitAngle = 82 + (hashStringToInt(post.id) % 37)
  const singleAngle = 120 + (hashStringToInt(post.id) % 41)
  const teamBackground = hasTwoTeams
    ? {
        background: `linear-gradient(${splitAngle}deg, ${colorA} 0%, ${colorA} 50%, ${colorB} 50%, ${colorB} 100%)`,
      }
    : colorA
      ? { background: `linear-gradient(${singleAngle}deg, ${colorA} 0%, #0d0d0d 100%)` }
      : { bgcolor: '#0d0d0d' }

  const scorePair = scorePillMode === 'final' ? getSpotlightFinalScorePairForThumbnail(post) : null
  const scoreAway = scorePair?.[0]
  const scoreHome = scorePair?.[1]

  const spreadAwayStr = scorePillMode === 'spread' ? formatSpreadPillPrimary(spreadAway, spreadHome) : ''
  const spreadHomeStr = scorePillMode === 'spread' ? formatSpreadPillPrimary(spreadHome, spreadAway) : ''

  const leftPillFinal = scorePillMode === 'final' && hasTwoTeams && scoreAway != null && teamA
  const rightPillFinal = scorePillMode === 'final' && hasTwoTeams && scoreHome != null && teamB
  const leftPillSpread = scorePillMode === 'spread' && hasTwoTeams && spreadAwayStr && teamA
  const rightPillSpread = scorePillMode === 'spread' && hasTwoTeams && spreadHomeStr && teamB

  const renderWatermarkLogo = (side: 'left' | 'right', team: string) => {
    const pos =
      side === 'left'
        ? { left: '4%', right: 'auto' as const }
        : { right: '4%', left: 'auto' as const }
    const img = (
      <img src={getTeamLogoUrl(team)} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
    )
    const sx = {
      position: 'absolute' as const,
      ...pos,
      bottom: 10,
      zIndex: 1,
      width: '33%',
      maxWidth: 180,
      pointerEvents: 'none' as const,
      opacity: 0.26,
    }
    if (logoMotion && !reduceMotion) {
      return (
        <motion.div
          key={`${side}-logo`}
          style={sx}
          aria-hidden
          animate={{
            y: [0, side === 'left' ? -5 : 5, 0],
            rotate: [0, side === 'left' ? -2.2 : 2.2, 0],
          }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          {img}
        </motion.div>
      )
    }
    return (
      <Box sx={sx} aria-hidden>
        {img}
      </Box>
    )
  }

  return (
    <Aspect16_9 accentColor={typeColor}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          opacity: 0.85,
          ...teamBackground,
        }}
        aria-hidden
      />
      {teamA ? renderWatermarkLogo('left', teamA) : null}
      {teamB ? renderWatermarkLogo('right', teamB) : null}
      {playerImageUrl ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <img
            src={playerImageUrl}
            alt={post.title}
            loading="lazy"
            style={{
              width: 'auto',
              height: '100%',
              maxWidth: '70%',
              objectFit: 'contain',
              objectPosition: 'bottom center',
              display: 'block',
            }}
            onError={(e) => {
              const t = e.target as HTMLImageElement
              t.style.display = 'none'
              const fallback = t.nextElementSibling as HTMLElement
              if (fallback) fallback.style.display = 'flex'
            }}
          />
          <Box
            sx={{
              display: 'none',
              position: 'absolute',
              inset: 0,
              bgcolor: '#0d0d0d',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-hidden
          />
        </Box>
      ) : null}
      {leftPillFinal ? (
        <Box
          sx={{
            position: 'absolute',
            left: '4%',
            top: '25%',
            transform: 'translateY(-50%)',
            zIndex: 4,
            width: '33%',
            maxWidth: 180,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <Typography
            component="span"
            sx={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '1.2rem',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.04em',
              lineHeight: 1,
              px: 1.75,
              py: 0.75,
              borderRadius: '10px',
              bgcolor: 'rgba(0,0,0,0.52)',
              color: getTeamAlternateColorForPlayerSpotlightFeedThumbnail(teamA),
              border: `1px solid color-mix(in srgb, ${getTeamColorForPlayerSpotlightFeedThumbnail(teamA)} 38%, rgba(255,255,255,0.35))`,
              boxShadow: '0 2px 14px rgba(0,0,0,0.45)',
              textShadow: 'none',
            }}
          >
            {scoreAway}
          </Typography>
        </Box>
      ) : null}
      {rightPillFinal ? (
        <Box
          sx={{
            position: 'absolute',
            right: '4%',
            top: '25%',
            transform: 'translateY(-50%)',
            zIndex: 4,
            width: '33%',
            maxWidth: 180,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <Typography
            component="span"
            sx={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '1.2rem',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.04em',
              lineHeight: 1,
              px: 1.75,
              py: 0.75,
              borderRadius: '10px',
              bgcolor: 'rgba(0,0,0,0.52)',
              color: getTeamAlternateColorForPlayerSpotlightFeedThumbnail(teamB),
              border: `1px solid color-mix(in srgb, ${getTeamColorForPlayerSpotlightFeedThumbnail(teamB)} 38%, rgba(255,255,255,0.35))`,
              boxShadow: '0 2px 14px rgba(0,0,0,0.45)',
              textShadow: 'none',
            }}
          >
            {scoreHome}
          </Typography>
        </Box>
      ) : null}
      {leftPillSpread ? (
        <Box
          sx={{
            position: 'absolute',
            left: '4%',
            top: '25%',
            transform: 'translateY(-50%)',
            zIndex: 4,
            width: '33%',
            maxWidth: 180,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <Typography
            component="span"
            sx={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '1.05rem',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.04em',
              lineHeight: 1,
              px: 1.5,
              py: 0.65,
              borderRadius: '10px',
              bgcolor: 'rgba(0,0,0,0.55)',
              color: '#D4AF37',
              border: `1px solid color-mix(in srgb, ${getTeamColorForPlayerSpotlightFeedThumbnail(teamA)} 38%, rgba(255,255,255,0.35))`,
              boxShadow: '0 2px 14px rgba(0,0,0,0.45)',
            }}
          >
            {spreadAwayStr}
          </Typography>
        </Box>
      ) : null}
      {rightPillSpread ? (
        <Box
          sx={{
            position: 'absolute',
            right: '4%',
            top: '25%',
            transform: 'translateY(-50%)',
            zIndex: 4,
            width: '33%',
            maxWidth: 180,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <Typography
            component="span"
            sx={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '1.05rem',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.04em',
              lineHeight: 1,
              px: 1.5,
              py: 0.65,
              borderRadius: '10px',
              bgcolor: 'rgba(0,0,0,0.55)',
              color: '#D4AF37',
              border: `1px solid color-mix(in srgb, ${getTeamColorForPlayerSpotlightFeedThumbnail(teamB)} 38%, rgba(255,255,255,0.35))`,
              boxShadow: '0 2px 14px rgba(0,0,0,0.45)',
            }}
          >
            {spreadHomeStr}
          </Typography>
        </Box>
      ) : null}
      {scorePillMode === 'spread' && hasTwoTeams && !spreadAwayStr && !spreadHomeStr && tipLabel ? (
        <Typography
          level="body-sm"
          sx={{
            position: 'absolute',
            bottom: 52,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.82rem',
            textShadow: '0 1px 10px rgba(0,0,0,0.9)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
          aria-hidden
        >
          {tipLabel}
        </Typography>
      ) : null}
      <FeedThumbTypeIcon postType={iconPostType} typeColor={typeColor} />
    </Aspect16_9>
  )
}

type ThumbnailPlayer = { headshotUrl: string; name: string; team_abbreviation: string }

function parseMetadata(post: FeedPost): Record<string, unknown> {
  const raw = post.metadata
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}')
    } catch {
      return {}
    }
  }
  return (raw || {}) as Record<string, unknown>
}

function numMeta(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

type LineupThumbnailData = {
  players: ThumbnailPlayer[]
  label: string
  chipLabel: string
}

/** Team of the Week or Team of the Night: same grid, different metadata/label. */
function getTeamLineupThumbnailData(post: FeedPost): LineupThumbnailData | null {
  const isTotw = post.post_type === 'team_of_week'
  const isTotn = post.post_type === 'team_of_night'
  if (!isTotw && !isTotn) return null

  const meta = parseMetadata(post)

  if (isTotw) {
    const weekNum = meta.week_number ?? (meta.totw_row as Record<string, unknown>)?.week_number
    const weekLabel =
      weekNum != null
        ? `Week ${weekNum}`
        : meta.week_start && meta.week_end
          ? `${meta.week_start} – ${meta.week_end}`
          : ''
    const roster = meta.totw_players ?? (meta.totw_row as Record<string, unknown>)?.totw_players
    if (Array.isArray(roster) && roster.length > 0) {
      const list = (roster as Record<string, unknown>[])
        .slice(0, 12)
        .map((p) => {
          const nbaId = p.nba_player_id ?? p.player_id
          return {
            headshotUrl: nbaId ? NBA_HEADSHOT(nbaId as number | string) : '',
            name: (p.name as string) || '',
            team_abbreviation: (p.team_abbreviation as string) || (p.team_tricode as string) || '',
          }
        })
        .filter((p): p is ThumbnailPlayer => !!p.headshotUrl)
      if (list.length > 0) {
        return { players: list, label: String(weekLabel), chipLabel: 'Team of the Week' }
      }
    }
    const playerIds = post.player_ids || []
    if (Array.isArray(playerIds) && playerIds.length > 0) {
      const list = playerIds
        .slice(0, 12)
        .map((id: number | string) => ({ headshotUrl: NBA_HEADSHOT(id), name: '', team_abbreviation: '' }))
      return { players: list, label: String(weekLabel), chipLabel: 'Team of the Week' }
    }
  }

  if (isTotn) {
    const dateLabel = post.game_date || (meta.totn_row as Record<string, unknown>)?.game_date as string | undefined
    const roster = meta.totn_players ?? (meta.totn_row as Record<string, unknown>)?.totn_players
    if (Array.isArray(roster) && roster.length > 0) {
      const list = (roster as Record<string, unknown>[])
        .slice(0, 12)
        .map((p) => {
          const nbaId = p.nba_player_id ?? p.player_id
          return {
            headshotUrl: nbaId ? NBA_HEADSHOT(nbaId as number | string) : '',
            name: (p.name as string) || '',
            team_abbreviation: (p.team_abbreviation as string) || (p.team_tricode as string) || '',
          }
        })
        .filter((p): p is ThumbnailPlayer => !!p.headshotUrl)
      if (list.length > 0) {
        return { players: list, label: dateLabel || '', chipLabel: 'Team of the Night' }
      }
    }
    const playerIds = post.player_ids || []
    if (Array.isArray(playerIds) && playerIds.length > 0) {
      const list = playerIds
        .slice(0, 12)
        .map((id: number | string) => ({ headshotUrl: NBA_HEADSHOT(id), name: '', team_abbreviation: '' }))
      return { players: list, label: dateLabel || '', chipLabel: 'Team of the Night' }
    }
  }

  return null
}

/** Draft (tank snapshot) thumbnail: prospect ids from metadata.tank_snapshot.rows (image_url resolved from draft_prospects). */
function getDraftThumbnailData(post: FeedPost): { prospectIds: string[]; label: string } | null {
  if (post.post_type !== 'draft') return null
  const meta = parseMetadata(post)
  const snapshot = meta.tank_snapshot as { rows?: Array<{ prospect?: { id?: string } | null }>; snapshot_date?: string } | undefined
  const rows = snapshot?.rows
  if (!Array.isArray(rows) || rows.length === 0) return null

  const prospectIds = rows
    .slice(0, 12)
    .map((row) => (row.prospect?.id as string) ?? '')
    .filter(Boolean)

  if (prospectIds.length === 0) return null
  const label = (snapshot?.snapshot_date as string) ?? post.game_date ?? ''
  return { prospectIds, label }
}

type PropResultRow = {
  nba_player_id?: number
  player_name?: string
  team_tricode?: string
  result?: string
}

type PropPredictionRow = {
  nba_player_id?: number
  player_name?: string
  team_tricode?: string
}

/** Top 3 players by hit rate: overs / total lines (only "over" results count as hits). */
function getPropResultsThumbnailData(
  post: FeedPost
): { players: ThumbnailPlayer[]; subtitle: string } | null {
  if (post.post_type !== 'prop_results') return null
  const meta = parseMetadata(post)
  const snapshot = meta.prop_snapshot as Record<string, unknown> | undefined
  const props = snapshot?.props as PropResultRow[] | undefined
  if (!Array.isArray(props) || props.length === 0) return null

  const byPlayer = new Map<
    number,
    { overs: number; total: number; name: string; team_tricode: string }
  >()
  for (const p of props) {
    const nbaId = p.nba_player_id
    if (nbaId == null) continue
    const name = (p.player_name as string) || ''
    const team = (p.team_tricode as string) || ''
    const isOver = p.result === 'over'

    const cur = byPlayer.get(nbaId)
    if (cur) {
      cur.total += 1
      if (isOver) cur.overs += 1
    } else {
      byPlayer.set(nbaId, {
        overs: isOver ? 1 : 0,
        total: 1,
        name,
        team_tricode: team,
      })
    }
  }

  const ranked = [...byPlayer.entries()]
    .filter(([, stats]) => stats.total > 0)
    .map(([nbaId, stats]) => ({
      nbaId,
      hitRate: stats.overs / stats.total,
      overs: stats.overs,
      total: stats.total,
      name: stats.name,
      team_tricode: stats.team_tricode,
    }))
    .sort((a, b) => {
      if (b.hitRate !== a.hitRate) return b.hitRate - a.hitRate
      return b.total - a.total
    })
    .slice(0, 3)

  if (ranked.length === 0) return null

  const players: ThumbnailPlayer[] = ranked.map((r) => ({
    headshotUrl: NBA_HEADSHOT(r.nbaId),
    name: r.name,
    team_abbreviation: r.team_tricode,
  }))

  const tricodes = post.team_tricodes && post.team_tricodes.length >= 2
    ? `${post.team_tricodes[0]} @ ${post.team_tricodes[1]}`
    : post.team_tricodes?.[0] ?? ''
  const subtitle = [tricodes, post.game_date].filter(Boolean).join(' · ')

  return { players, subtitle }
}

type InjurySnapshotEntry = { nba_player_id: number; player_name: string; team_tricode: string }

/** First 3 injured players from injury_snapshot (same layout as prop prediction: three in header). */
function getInjuryReportThumbnailData(
  post: FeedPost
): { players: ThumbnailPlayer[]; subtitle: string } | null {
  if (post.post_type !== 'injury_report') return null
  const meta = parseMetadata(post)
  const snapshot = meta.injury_snapshot as { injuries?: InjurySnapshotEntry[]; date?: string } | undefined
  const injuries = snapshot?.injuries
  if (!Array.isArray(injuries) || injuries.length === 0) return null

  const players: ThumbnailPlayer[] = injuries
    .slice(0, 3)
    .map((inj) => ({
      headshotUrl: NBA_HEADSHOT(inj.nba_player_id),
      name: inj.player_name ?? '',
      team_abbreviation: inj.team_tricode ?? '',
    }))

  if (players.length === 0) return null
  const subtitle = [post.team_tricodes?.join(' · '), snapshot?.date ?? post.game_date].filter(Boolean).join(' · ')
  return { players, subtitle }
}

/** Top 2 players by prop count (full-height split thumbnail composition). */
function getPropPredictionThumbnailData(
  post: FeedPost
): { players: ThumbnailPlayer[]; subtitle: string } | null {
  if (post.post_type !== 'prop_prediction') return null
  const meta = parseMetadata(post)
  const snapshot = meta.prop_snapshot as Record<string, unknown> | undefined
  const props = snapshot?.props as PropPredictionRow[] | undefined
  if (!Array.isArray(props) || props.length === 0) return null

  const byPlayer = new Map<
    number,
    { count: number; name: string; team_tricode: string }
  >()
  for (const p of props) {
    const nbaId = p.nba_player_id
    if (nbaId == null) continue
    const name = (p.player_name as string) || ''
    const team = (p.team_tricode as string) || ''

    const cur = byPlayer.get(nbaId)
    if (cur) {
      cur.count += 1
    } else {
      byPlayer.set(nbaId, { count: 1, name, team_tricode: team })
    }
  }

  const ranked = [...byPlayer.entries()]
    .map(([nbaId, stats]) => ({
      nbaId,
      count: stats.count,
      name: stats.name,
      team_tricode: stats.team_tricode,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)

  if (ranked.length === 0) return null

  const players: ThumbnailPlayer[] = ranked.map((r) => ({
    headshotUrl: NBA_HEADSHOT(r.nbaId),
    name: r.name,
    team_abbreviation: r.team_tricode,
  }))

  const tricodes = post.team_tricodes && post.team_tricodes.length >= 2
    ? `${post.team_tricodes[0]} @ ${post.team_tricodes[1]}`
    : post.team_tricodes?.[0] ?? ''
  const subtitle = [tricodes, post.game_date].filter(Boolean).join(' · ')

  return { players, subtitle }
}

export interface FeedCardThumbnailProps {
  post: FeedPost
  typeColor: string
}

/**
 * Renders the thumbnail for a feed card: custom (e.g. TOTW grid), cover image, or gradient placeholder.
 */
export function FeedCardThumbnail({ post, typeColor }: FeedCardThumbnailProps) {
  const reduceMotion = useReducedMotion()
  const slideMp4s = useMemo(() => getMp4SlideUrlsFromMetadata(post), [post])
  const lineupThumb = useMemo(
    () => getTeamLineupThumbnailData(post),
    [post.post_type, post.metadata, post.player_ids, post.game_date]
  )
  const propResultsThumb = useMemo(
    () => getPropResultsThumbnailData(post),
    [post.post_type, post.metadata, post.team_tricodes, post.game_date]
  )
  const propPredictionThumb = useMemo(
    () => getPropPredictionThumbnailData(post),
    [post.post_type, post.metadata, post.team_tricodes, post.game_date]
  )
  const injuryReportThumb = useMemo(
    () => getInjuryReportThumbnailData(post),
    [post.post_type, post.metadata, post.team_tricodes, post.game_date]
  )
  const draftThumb = useMemo(
    () => getDraftThumbnailData(post),
    [post.post_type, post.metadata, post.game_date]
  )
  const prospectIds = draftThumb?.prospectIds ?? []
  const { data: draftProspects } = useDraftProspectsByIds(prospectIds)
  const draftPlayers = useMemo(() => {
    const list = draftProspects ?? []
    return Array.from({ length: 12 }, (_, i) => list[i] ?? { id: '', image_url: null, player_name_full: '' })
  }, [draftProspects])

  const mp4Preview = useMemo(() => getFirstMp4FromPostMetadata(post), [post])
  if (slideMp4s.length >= 2) {
    return (
      <FeedCardStoriesThumb
        postId={post.id}
        urls={slideMp4s}
        typeColor={typeColor}
        postType={post.post_type}
        reduceMotion={reduceMotion}
      />
    )
  }
  if (mp4Preview) {
    return (
      <FeedCardVideoPreview
        postId={post.id}
        videoUrl={mp4Preview}
        typeColor={typeColor}
        postType={post.post_type}
      />
    )
  }

  if (post.post_type === 'prop_results' && propResultsThumb && !post.cover_image_url) {
    return (
      <Aspect16_9 accentColor={typeColor}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            bgcolor: '#000',
          }}
        >
          <Box
            sx={{
              height: '60%',
              width: 'auto',
              maxWidth: '100%',
              aspectRatio: '3 / 1',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: '1fr',
              gap: 0,
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 1,
              overflow: 'hidden',
              boxSizing: 'border-box',
              bgcolor: '#000',
            }}
          >
            {propResultsThumb.players.map((player, i) => {
              const teamColor = player.team_abbreviation
                ? getTeamPrimaryColor(player.team_abbreviation)
                : null
              const squareBg = teamColor ? `${teamColor}33` : '#0d0d0d'
              return (
                <Box
                  key={i}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    overflow: 'hidden',
                    bgcolor: squareBg,
                  }}
                >
                  <img
                    src={player.headshotUrl}
                    alt={player.name || `Player ${i + 1}`}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      t.style.display = 'none'
                      const fallback = t.nextElementSibling as HTMLElement
                      if (fallback) fallback.style.display = 'flex'
                    }}
                  />
                  <Box
                    sx={{
                      display: 'none',
                      position: 'absolute',
                      inset: 0,
                      bgcolor: '#0d0d0d',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-hidden
                  />
                </Box>
              )
            })}
          </Box>
        </Box>
        <FeedThumbTypeIcon postType="prop_results" typeColor={typeColor} />
      </Aspect16_9>
    )
  }

  if (post.post_type === 'prop_prediction' && propPredictionThumb && !post.cover_image_url) {
    return (
      <Aspect16_9 accentColor={typeColor}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.max(propPredictionThumb.players.length, 1)}, 1fr)`,
            gridTemplateRows: '1fr',
            gap: 0,
            bgcolor: '#000',
            overflow: 'hidden',
          }}
        >
          {propPredictionThumb.players.map((player, i) => {
            const teamColor = player.team_abbreviation
              ? getTeamPrimaryColor(player.team_abbreviation)
              : null
            const squareBg = teamColor ? `${teamColor}33` : '#0d0d0d'
            return (
              <Box
                key={i}
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  minHeight: 0,
                  overflow: 'hidden',
                  bgcolor: squareBg,
                }}
              >
                <img
                  src={player.headshotUrl}
                  alt={player.name || `Player ${i + 1}`}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement
                    t.style.display = 'none'
                    const fallback = t.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
                <Box
                  sx={{
                    display: 'none',
                    position: 'absolute',
                    inset: 0,
                    bgcolor: '#0d0d0d',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-hidden
                />
              </Box>
            )
          })}
        </Box>
        <FeedThumbTypeIcon postType="prop_prediction" typeColor={typeColor} />
      </Aspect16_9>
    )
  }

  if (post.post_type === 'injury_report' && injuryReportThumb && !post.cover_image_url) {
    const injuryRed = '#EF4444'
    return (
      <Aspect16_9 accentColor={injuryRed}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: '1fr',
            gap: 0,
            overflow: 'hidden',
            bgcolor: '#000',
          }}
        >
          {injuryReportThumb.players.map((player, i) => {
            const teamColor = player.team_abbreviation
              ? getTeamPrimaryColor(player.team_abbreviation)
              : null
            const squareBg = teamColor ? `${teamColor}33` : '#0d0d0d'
            return (
              <Box
                key={i}
                sx={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  minHeight: 0,
                  overflow: 'hidden',
                  bgcolor: squareBg,
                }}
              >
                <img
                  src={player.headshotUrl}
                  alt={player.name || `Player ${i + 1}`}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement
                    t.style.display = 'none'
                    const fallback = t.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
                <Box
                  sx={{
                    display: 'none',
                    position: 'absolute',
                    inset: 0,
                    bgcolor: '#0d0d0d',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-hidden
                />
              </Box>
            )
          })}
        </Box>
        <FeedThumbTypeIcon postType="injury_report" typeColor={injuryRed} />
      </Aspect16_9>
    )
  }

  if (
    (post.post_type === 'team_of_week' || post.post_type === 'team_of_night') &&
    lineupThumb &&
    !post.cover_image_url
  ) {
    const teamA = lineupThumb.players[0]?.team_abbreviation
    const teamB =
      lineupThumb.players.find((p) => p.team_abbreviation && p.team_abbreviation !== teamA)?.team_abbreviation ??
      null
    const colorA = teamA ? getTeamPrimaryColor(teamA) : null
    const colorB = teamB ? getTeamPrimaryColor(teamB) : null
    const gradientBg =
      colorA && colorB
        ? {
            background: `linear-gradient(125deg, ${colorA}aa 0%, #0a0a0a 42%, ${colorB}aa 100%)`,
          }
        : { bgcolor: '#000' }

    return (
      <Aspect16_9 accentColor={typeColor}>
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center px-3"
          style={gradientBg as CSSProperties}
          initial={reduceMotion ? false : { opacity: 0.9, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.4 }}
        >
          <AvatarStack animate size={40} className="max-w-full justify-center">
            {lineupThumb.players.slice(0, 10).map((player, i) => (
              <Avatar key={`${player.headshotUrl}-${i}`} className="ring-2 ring-black/75">
                <AvatarImage src={player.headshotUrl} alt="" className="object-cover" />
                <AvatarFallback className="bg-neutral-800 text-[10px] text-neutral-300">
                  {(player.name || '?').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            ))}
          </AvatarStack>
        </motion.div>
        <FeedThumbTypeIcon postType={post.post_type} typeColor={typeColor} />
      </Aspect16_9>
    )
  }

  if (post.post_type === 'draft' && draftThumb && !post.cover_image_url) {
    return (
      <Aspect16_9 accentColor={typeColor}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gridTemplateRows: 'repeat(3, 1fr)',
            gap: 0,
            overflow: 'hidden',
            bgcolor: '#000',
          }}
        >
          {draftPlayers.map((player, i) => (
            <Box
              key={player.id || i}
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
                bgcolor: '#0d0d0d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {player.image_url ? (
                <img
                  src={player.image_url}
                  alt={player.player_name_full || `Prospect ${i + 1}`}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    const t = e.target as HTMLImageElement
                    t.style.display = 'none'
                    const fallback = t.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              <Box
                sx={{
                  display: player.image_url ? 'none' : 'flex',
                  position: 'absolute',
                  inset: 0,
                  bgcolor: '#1a1a1a',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden
              >
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'neutral.500',
                  }}
                >
                  {player.player_name_full ? player.player_name_full.charAt(0).toUpperCase() : ''}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
        <FeedThumbTypeIcon postType="draft" typeColor={typeColor} />
      </Aspect16_9>
    )
  }

  // Upcoming: recap-style frame + spread pills (metadata from automation) + motion on logos.
  if (post.post_type === 'upcoming' && (post.team_tricodes?.length ?? 0) >= 1) {
    const meta = parseMetadata(post)
    const awayS = numMeta(meta.away_spread)
    const homeS = numMeta(meta.home_spread)
    const tipRaw = meta.game_time_et
    const tipLabel = typeof tipRaw === 'string' && tipRaw.trim() ? tipRaw.trim() : null
    return (
      <TwoTeamSpotlightStyleFeedThumbnail
        post={post}
        typeColor={typeColor}
        iconPostType="upcoming"
        playerImageUrl={null}
        scorePillMode="spread"
        spreadAway={awayS}
        spreadHome={homeS}
        tipLabel={tipLabel}
        logoMotion
      />
    )
  }

  // Game recap: same two-team frame as player spotlight, without the center player cutout (before generic cover).
  if (post.post_type === 'game_recap' && (post.team_tricodes?.length ?? 0) >= 1) {
    return (
      <TwoTeamSpotlightStyleFeedThumbnail
        post={post}
        typeColor={typeColor}
        iconPostType="game_recap"
        playerImageUrl={null}
      />
    )
  }

  // Player spotlight: same layout with optional headshot (before generic cover_image_url).
  const spotlightPlayerId = post.person_id ?? post.player_ids?.[0]
  if (post.post_type === 'player_spotlight' && spotlightPlayerId != null) {
    const imageUrl = post.cover_image_url ?? NBA_PLAYER_LARGE_IMAGE(spotlightPlayerId)
    return (
      <TwoTeamSpotlightStyleFeedThumbnail
        post={post}
        typeColor={typeColor}
        iconPostType="player_spotlight"
        playerImageUrl={imageUrl}
      />
    )
  }

  if (post.cover_image_url) {
    return (
      <Aspect16_9 accentColor={typeColor}>
        <img
          src={post.cover_image_url}
          alt={post.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 ease-out"
          style={{ objectFit: 'cover' }}
        />
        <FeedThumbTypeIcon postType={post.post_type} typeColor={typeColor} />
      </Aspect16_9>
    )
  }

  return (
    <div className="aspect-video overflow-hidden bg-black relative feed-card-thumb" style={{ isolation: 'isolate' }}>
      <Box
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${typeColor}28 0%, #0a0a0a 50%, #111 100%)`,
          boxShadow: `inset 0 0 80px ${typeColor}12`,
        }}
      >
        <Typography
          className="text-[2.75rem] font-extrabold opacity-40 drop-shadow-lg"
          style={{ color: typeColor, textShadow: `0 0 24px ${typeColor}40` }}
        >
          {post.team_tricodes?.[0] ?? 'HG'}
        </Typography>
      </Box>
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%, transparent 100%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 pointer-events-none"
        aria-hidden
        style={{ backgroundColor: typeColor, opacity: 0.9 }}
      />
      <FeedThumbTypeIcon postType={post.post_type} typeColor={typeColor} />
    </div>
  )
}
