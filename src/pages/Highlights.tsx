/**
 * Feed Page (Highlights) — V2
 *
 * Card-grid feed. Each card links to /feed/:slug for the full story.
 * Supports filtering by post type, team, and tag.
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Input,
  IconButton,
  AspectRatio,
} from '@mui/joy'
import Search from '@mui/icons-material/Search'
import Favorite from '@mui/icons-material/Favorite'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline'
import Visibility from '@mui/icons-material/Visibility'
import BookmarkBorder from '@mui/icons-material/BookmarkBorder'
import FilterList from '@mui/icons-material/FilterList'
import { supabase } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFavoritePlayers, useFavoriteTeams } from '../hooks/useUserSettings'
import { orderPostsByAlgorithm } from '../utils/feedAlgorithm'
import type { FeedPost, PostType, FeedFilterType } from '../types/feed'

// ─── Constants ──────────────────────────────────────────────

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

const FILTER_OPTIONS: { value: FeedFilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'game_recap', label: 'Recaps' },
  { value: 'player_spotlight', label: 'Spotlights' },
  { value: 'team_of_night', label: 'TOTN' },
  { value: 'team_of_week', label: 'TOTW' },
  { value: 'player_of_week', label: 'POW' },
  { value: 'player_of_month', label: 'POM' },
  { value: 'prop_prediction', label: 'Props' },
  { value: 'prop_results', label: 'Results' },
  { value: 'injury_report', label: 'Injuries' },
]

// ─── Data fetching ──────────────────────────────────────────

function useFeedPosts() {
  return useQuery({
    queryKey: ['feed-posts-v2'],
    queryFn: async (): Promise<FeedPost[]> => {
      const { data, error } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(200)

      if (error) throw error
      return (data ?? []) as FeedPost[]
    },
    staleTime: 1000 * 60 * 2, // 2 min
  })
}

// ─── Feed Card ──────────────────────────────────────────────

function FeedCard({ post, onClick }: { post: FeedPost; onClick: () => void }) {
  const typeColor = POST_TYPE_COLORS[post.post_type] ?? '#FFC72C'
  const typeLabel = POST_TYPE_LABELS[post.post_type] ?? post.post_type

  // Format relative date
  const relativeDate = useMemo(() => {
    if (!post.game_date && !post.published_at) return ''
    const d = new Date(post.game_date ?? post.published_at!)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7) return `${diff}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [post.game_date, post.published_at])

  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        bgcolor: '#111111',
        borderColor: '#222222',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        overflow: 'hidden',
        '&:hover': {
          borderColor: typeColor,
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${typeColor}22`,
        },
      }}
    >
      {/* Cover image */}
      {post.cover_image_url && (
        <AspectRatio ratio="16/9" sx={{ borderRadius: 0 }}>
          <img
            src={post.cover_image_url}
            alt={post.title}
            loading="lazy"
            style={{ objectFit: 'cover' }}
          />
        </AspectRatio>
      )}

      {/* Fallback gradient if no cover image */}
      {!post.cover_image_url && (
        <Box
          sx={{
            height: 120,
            background: `linear-gradient(135deg, ${typeColor}33 0%, #111111 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: '2.5rem',
              fontWeight: 700,
              color: typeColor,
              opacity: 0.3,
              fontFamily: '"Libre Baskerville", serif',
            }}
          >
            {post.team_tricodes?.[0] ?? 'HG'}
          </Typography>
        </Box>
      )}

      <CardContent sx={{ p: 2, gap: 1 }}>
        {/* Type badge + date */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Chip
            size="sm"
            sx={{
              bgcolor: `${typeColor}22`,
              color: typeColor,
              fontWeight: 700,
              fontSize: '0.65rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              borderRadius: '4px',
              height: 22,
            }}
          >
            {typeLabel}
          </Chip>
          <Typography level="body-xs" sx={{ color: '#888' }}>
            {relativeDate}
          </Typography>
        </Box>

        {/* Title */}
        <Typography
          level="title-md"
          sx={{
            color: '#FFFFFF',
            fontWeight: 700,
            fontFamily: '"Libre Baskerville", serif',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.title}
        </Typography>

        {/* Subtitle */}
        {post.subtitle && (
          <Typography
            level="body-sm"
            sx={{
              color: '#AAAAAA',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.subtitle}
          </Typography>
        )}

        {/* Team tricodes */}
        {post.team_tricodes && post.team_tricodes.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {post.team_tricodes.map((tri) => (
              <Chip
                key={tri}
                size="sm"
                variant="outlined"
                sx={{
                  borderColor: '#333',
                  color: '#CCC',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  height: 20,
                }}
              >
                {tri}
              </Chip>
            ))}
          </Box>
        )}

        {/* Engagement bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            pt: 1,
            borderTop: '1px solid #1a1a1a',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Favorite sx={{ fontSize: 14, color: '#666' }} />
            <Typography level="body-xs" sx={{ color: '#666' }}>
              {post.likes_count}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ChatBubbleOutline sx={{ fontSize: 14, color: '#666' }} />
            <Typography level="body-xs" sx={{ color: '#666' }}>
              {post.comments_count}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Visibility sx={{ fontSize: 14, color: '#666' }} />
            <Typography level="body-xs" sx={{ color: '#666' }}>
              {post.views_count}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <BookmarkBorder sx={{ fontSize: 16, color: '#555' }} />
        </Box>
      </CardContent>
    </Card>
  )
}

// ─── Empty state ────────────────────────────────────────────

function EmptyState({ filter }: { filter: FeedFilterType }) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 12,
        px: 4,
      }}
    >
      <Typography
        level="h3"
        sx={{
          color: '#FFFFFF',
          fontFamily: '"Libre Baskerville", serif',
          mb: 1,
        }}
      >
        {filter === 'all' ? 'No stories yet' : `No ${POST_TYPE_LABELS[filter as PostType] ?? filter} stories yet`}
      </Typography>
      <Typography level="body-md" sx={{ color: '#888', maxWidth: 400, mx: 'auto' }}>
        Stories will appear here once games resume. The NBA is currently on All-Star break.
      </Typography>
    </Box>
  )
}

// ─── Main Feed Component ────────────────────────────────────

export default function Highlights() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: posts, isLoading, error } = useFeedPosts()
  const { data: favPlayers } = useFavoritePlayers(user?.id)
  const { data: favTeams } = useFavoriteTeams(user?.id)

  const [activeFilter, setActiveFilter] = useState<FeedFilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Build algorithm options
  const algorithmOptions = useMemo(() => {
    const favoritePlayerIds = new Set<number>(
      (favPlayers ?? []).map((fp: any) => fp.nba_players?.nba_player_id ?? fp.player_id).filter(Boolean)
    )
    const favoriteTeamTricodes = new Set<string>(
      (favTeams ?? []).map((ft: any) => ft.nba_teams?.abbreviation ?? ft.abbreviation).filter(Boolean)
    )

    return {
      favoritePlayerIds,
      favoriteTeamTricodes,
      isUserLoggedIn: !!user,
      filters: {
        postType: activeFilter,
      },
      seed: Math.floor(Date.now() / (1000 * 60 * 30)), // Changes every 30 min
    }
  }, [favPlayers, favTeams, user, activeFilter])

  // Apply algorithm
  const orderedPosts = useMemo(() => {
    if (!posts) return []
    let result = orderPostsByAlgorithm(posts, algorithmOptions)

    // Client-side search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.subtitle?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.team_tricodes?.some((t) => t.toLowerCase().includes(q))
      )
    }

    return result
  }, [posts, algorithmOptions, searchQuery])

  const handlePostClick = useCallback(
    (post: FeedPost) => {
      navigate(`/feed/${post.slug}`)
    },
    [navigate]
  )

  // ─── Render ─────────────────────────────────────────────

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 1.5, sm: 2, md: 3 },
        pt: { xs: 2, md: 3 },
        pb: 6,
      }}
    >
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          level="h2"
          sx={{
            fontFamily: '"Libre Baskerville", serif',
            fontWeight: 700,
            color: '#FFFFFF',
            fontSize: { xs: '1.5rem', md: '2rem' },
            letterSpacing: '-0.02em',
          }}
        >
          Feed
        </Typography>
        <Typography level="body-sm" sx={{ color: '#888', mt: 0.5 }}>
          NBA stories, highlights, and analysis
        </Typography>
      </Box>

      {/* Search bar */}
      <Box sx={{ mb: 2 }}>
        <Input
          placeholder="Search stories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          startDecorator={<Search sx={{ color: '#666' }} />}
          sx={{
            bgcolor: '#111',
            borderColor: '#222',
            color: '#FFF',
            '&:hover': { borderColor: '#444' },
            '&::before': { display: 'none' },
            '--Input-focusedHighlight': '#FFC72C33',
          }}
        />
      </Box>

      {/* Filter chips */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mb: 3,
          overflowX: 'auto',
          pb: 1,
          // Hide scrollbar
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.value
          const chipColor =
            opt.value === 'all' ? '#FFC72C' : POST_TYPE_COLORS[opt.value as PostType] ?? '#FFC72C'

          return (
            <Chip
              key={opt.value}
              size="md"
              variant={isActive ? 'solid' : 'outlined'}
              onClick={() => setActiveFilter(opt.value)}
              sx={{
                cursor: 'pointer',
                flexShrink: 0,
                fontWeight: 600,
                fontSize: '0.75rem',
                letterSpacing: '0.03em',
                ...(isActive
                  ? {
                      bgcolor: chipColor,
                      color: '#000',
                      '&:hover': { bgcolor: chipColor },
                    }
                  : {
                      borderColor: '#333',
                      color: '#AAA',
                      '&:hover': { borderColor: chipColor, color: chipColor },
                    }),
              }}
            >
              {opt.label}
            </Chip>
          )
        })}
      </Box>

      {/* Loading */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress size="lg" sx={{ '--CircularProgress-trackColor': '#222', '--CircularProgress-progressColor': '#FFC72C' }} />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography level="body-lg" sx={{ color: '#EF4444' }}>
            Failed to load feed. Please try again.
          </Typography>
        </Box>
      )}

      {/* Empty state */}
      {!isLoading && !error && orderedPosts.length === 0 && (
        <EmptyState filter={activeFilter} />
      )}

      {/* Card grid */}
      {!isLoading && orderedPosts.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: { xs: 2, md: 2.5 },
          }}
        >
          {orderedPosts.map((post) => (
            <FeedCard key={post.id} post={post} onClick={() => handlePostClick(post)} />
          ))}
        </Box>
      )}
    </Box>
  )
}
