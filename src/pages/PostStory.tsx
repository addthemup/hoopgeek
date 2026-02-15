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
  RichTextContent,
  PropCardContent,
  InjuryCardContent,
  PullQuoteContent,
  GalleryContent,
  BoxScoreContent,
  DataOverlay,
  LineupPlayer,
} from '../types/feed'
import { getTeamPrimaryColor } from '../utils/nbaTeamColors'

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

function HeroSection({ content }: { content: HeroContent }) {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: { xs: 200, md: 300 },
        background: content.image_url
          ? `url(${content.image_url}) center/cover`
          : `linear-gradient(135deg, ${content.team_tricode ? getTeamPrimaryColor(content.team_tricode) ?? '#333' : '#333'} 0%, #111 100%)`,
        display: 'flex',
        alignItems: 'flex-end',
        borderRadius: '12px',
        overflow: 'hidden',
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

function LineupCardSection({ content }: { content: LineupCardContent }) {
  const renderPlayer = (player: LineupPlayer, idx: number) => (
    <Box
      key={player.player_id || idx}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        borderBottom: '1px solid #1a1a1a',
      }}
    >
      <Avatar
        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.player_id}.png`}
        alt={player.name}
        sx={{ width: 40, height: 40 }}
      />
      <Box sx={{ flex: 1 }}>
        <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
          {player.name}
        </Typography>
        <Typography level="body-xs" sx={{ color: '#888' }}>
          {player.team_tricode} · {player.position ?? ''}
        </Typography>
      </Box>
      <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 700 }}>
        {player.fantasy_points?.toFixed(1)} FP
      </Typography>
    </Box>
  )

  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222' }}>
      <CardContent>
        <Typography level="title-sm" sx={{ color: '#FFC72C', mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Starters
        </Typography>
        {content.starters?.map(renderPlayer)}

        {content.bench && content.bench.length > 0 && (
          <>
            <Typography level="title-sm" sx={{ color: '#A78BFA', mt: 2, mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Bench
            </Typography>
            {content.bench.map(renderPlayer)}
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

function PlayerHighlightSection({ content }: { content: PlayerHighlightContent }) {
  return (
    <Card variant="outlined" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', overflow: 'hidden' }}>
      {/* Video thumbnail */}
      {content.video_thumbnail && (
        <Box
          sx={{
            position: 'relative',
            height: 180,
            background: `url(${content.video_thumbnail}) center/cover`,
          }}
        >
          {/* Data overlays */}
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
      )}

      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar
          src={content.headshot_url ?? `https://cdn.nba.com/headshots/nba/latest/260x190/${content.player_id}.png`}
          alt={content.name}
          sx={{ width: 56, height: 56 }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography level="title-md" sx={{ color: '#FFF', fontWeight: 700 }}>
            {content.name}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#888' }}>
            {content.team_tricode}
            {content.fantasy_points != null && ` · ${content.fantasy_points.toFixed(1)} FP`}
          </Typography>
        </Box>
      </CardContent>

      {/* Stat line */}
      {content.stats && (
        <Box sx={{ display: 'flex', justifyContent: 'space-around', px: 2, pb: 2 }}>
          {Object.entries(content.stats).map(([key, val]) => (
            <Box key={key} sx={{ textAlign: 'center' }}>
              <Typography level="body-lg" sx={{ color: '#FFC72C', fontWeight: 700 }}>
                {val}
              </Typography>
              <Typography level="body-xs" sx={{ color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {key}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Card>
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

  const typeColor = POST_TYPE_COLORS[post.post_type] ?? '#FFC72C'
  const typeLabel = POST_TYPE_LABELS[post.post_type] ?? post.post_type

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, md: 0 }, pt: 2, pb: 12 }}>
      {/* Back button */}
      <IconButton
        onClick={() => navigate('/feed')}
        sx={{ color: '#888', mb: 2, '&:hover': { color: '#FFF' } }}
      >
        <ArrowBack />
      </IconButton>

      {/* Post header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Chip
            size="sm"
            sx={{
              bgcolor: `${typeColor}22`,
              color: typeColor,
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {typeLabel}
          </Chip>
          {post.game_date && (
            <Typography level="body-xs" sx={{ color: '#888' }}>
              {new Date(post.game_date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Typography>
          )}
        </Box>

        <Typography
          level="h2"
          sx={{
            fontFamily: '"Libre Baskerville", serif',
            fontWeight: 700,
            color: '#FFFFFF',
            fontSize: { xs: '1.5rem', md: '2rem' },
            lineHeight: 1.25,
            mb: 1,
          }}
        >
          {post.title}
        </Typography>

        {post.subtitle && (
          <Typography level="body-lg" sx={{ color: '#AAAAAA', lineHeight: 1.5 }}>
            {post.subtitle}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <Typography level="body-xs" sx={{ color: '#666' }}>
            By {post.author_name}
          </Typography>
          {post.team_tricodes?.map((tri) => (
            <Chip
              key={tri}
              size="sm"
              variant="outlined"
              sx={{ borderColor: '#333', color: '#CCC', fontSize: '0.6rem', height: 20 }}
            >
              {tri}
            </Chip>
          ))}
        </Box>
      </Box>

      <Divider sx={{ borderColor: '#222', mb: 3 }} />

      {/* Sections */}
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
