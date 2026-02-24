/**
 * Feed Page (Highlights) — V2
 *
 * Card-grid feed. Each card links to /feed/:slug for the full story.
 * Supports filtering by post type, team, and tag.
 */

import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  AspectRatio,
  Modal,
  ModalDialog,
  Button,
  Stack,
  Divider,
} from '@mui/joy'
import Favorite from '@mui/icons-material/Favorite'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline'
import Visibility from '@mui/icons-material/Visibility'
import BookmarkBorder from '@mui/icons-material/BookmarkBorder'
import FilterList from '@mui/icons-material/FilterList'
import Close from '@mui/icons-material/Close'
import WarningRounded from '@mui/icons-material/WarningRounded'
import { supabase } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useFavoritePlayers, useFavoriteTeams } from '../hooks/useUserSettings'
import { orderPostsByAlgorithm } from '../utils/feedAlgorithm'
import type { FeedPost, PostType, FeedFilterType } from '../types/feed'
import type { ActiveFilter } from '../types/feed'
import FeedModulesGrid from '../components/Feed/FeedModulesGrid'

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
  upcoming: 'Upcoming',
  blog: 'Blog',
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
  upcoming: '#8B5CF6',
  blog: '#0EA5E9',
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
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'blog', label: 'Blog' },
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

export { POST_TYPE_LABELS, POST_TYPE_COLORS }

export function FeedCard({ post, onClick, isAdmin, onDelete }: {
  post: FeedPost
  onClick: () => void
  isAdmin?: boolean
  onDelete?: (post: FeedPost) => void
}) {
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
        position: 'relative',
        '&:hover': {
          borderColor: typeColor,
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${typeColor}22`,
        },
        '&:hover .admin-delete-btn': { opacity: 1 },
      }}
    >
      {/* Admin delete button */}
      {isAdmin && onDelete && (
        <IconButton
          className="admin-delete-btn"
          size="sm"
          variant="solid"
          color="danger"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(post)
          }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            opacity: 0,
            transition: 'opacity 0.15s',
            minWidth: 28,
            minHeight: 28,
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      )}

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

function EmptyState({ hasActiveFilters }: { hasActiveFilters: boolean }) {
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
        {hasActiveFilters ? 'No stories match your filters' : 'No stories yet'}
      </Typography>
      <Typography level="body-md" sx={{ color: '#888', maxWidth: 400, mx: 'auto' }}>
        {hasActiveFilters
          ? 'Try removing some filters to see more posts.'
          : 'Stories will appear here once games resume. The NBA is currently on All-Star break.'}
      </Typography>
    </Box>
  )
}

// ─── Main Feed Component ────────────────────────────────────

export default function Highlights() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: isAdmin } = useIsAdmin()
  const queryClient = useQueryClient()
  const { data: posts, isLoading, error } = useFeedPosts()
  const { data: favPlayers } = useFavoritePlayers(user?.id)
  const { data: favTeams } = useFavoriteTeams(user?.id)

  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
  const [deleteTarget, setDeleteTarget] = useState<FeedPost | null>(null)
  const [deleting, setDeleting] = useState(false)

  const addFilter = useCallback((filter: Omit<ActiveFilter, 'id'>) => {
    const id = `${filter.type}:${filter.value}`
    setActiveFilters((prev) => (prev.some((f) => f.id === id) ? prev : [...prev, { ...filter, id }]))
  }, [])

  const removeFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // Apply active filters: show post if it matches ANY selected filter (OR across all filters)
  const filteredPosts = useMemo(() => {
    if (!posts) return []
    if (activeFilters.length === 0) return posts

    const postTypeValues = new Set(activeFilters.filter((f) => f.type === 'post_type').map((f) => f.value))
    const teamValues = new Set(activeFilters.filter((f) => f.type === 'team').map((f) => f.value))
    const playerValues = new Set(activeFilters.filter((f) => f.type === 'player').map((f) => parseInt(f.value, 10)))

    return posts.filter((post) => {
      if (postTypeValues.size > 0 && postTypeValues.has(post.post_type)) return true
      const postTeams = post.team_tricodes ?? []
      if (teamValues.size > 0 && postTeams.some((t) => teamValues.has(t))) return true
      const postPlayerIds = (post.player_ids ?? []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
      if (playerValues.size > 0 && postPlayerIds.some((id) => playerValues.has(id))) return true
      return false
    })
  }, [posts, activeFilters])

  // Build algorithm options
  const algorithmOptions = useMemo(() => {
    const favoritePlayerIds = new Set<number>(
      (favPlayers ?? []).map((fp: any) => fp.nba_players?.nba_player_id ?? fp.player_id).filter(Boolean)
    )
    const favoriteTeamTricodes = new Set<string>(
      (favTeams ?? []).map((ft: any) => ft.nba_teams?.abbreviation ?? ft.abbreviation).filter(Boolean)
    )
    const postTypeFilter = activeFilters.find((f) => f.type === 'post_type')
    return {
      favoritePlayerIds,
      favoriteTeamTricodes,
      isUserLoggedIn: !!user,
      filters: {
        postType: (postTypeFilter?.value as FeedFilterType) ?? 'all',
      },
      seed: Math.floor(Date.now() / (1000 * 60 * 30)),
    }
  }, [favPlayers, favTeams, user, activeFilters])

  // Apply algorithm to filtered posts
  const orderedPosts = useMemo(() => {
    return orderPostsByAlgorithm(filteredPosts, algorithmOptions)
  }, [filteredPosts, algorithmOptions])

  const handlePostClick = useCallback(
    (post: FeedPost) => {
      navigate(`/feed/${post.slug}`)
    },
    [navigate]
  )

  const handleDeletePost = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // Delete sections first (cascade should handle this, but be explicit)
      await supabase.from('feed_post_sections').delete().eq('post_id', deleteTarget.id)
      // Delete the post
      const { error: delErr } = await supabase.from('feed_posts').delete().eq('id', deleteTarget.id)
      if (delErr) throw delErr
      // Invalidate cache so the feed refreshes
      queryClient.invalidateQueries({ queryKey: ['feed-posts-v2'] })
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete post:', err)
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, queryClient])

  // ─── Filter chips in drawer: toggle post_type filters ────────

  const filterChips = (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        '& .feed-filter-chip': {
          cursor: 'pointer',
          flexShrink: 0,
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.03em',
        },
      }}
    >
      {FILTER_OPTIONS.map((opt) => {
        const isPostType = opt.value !== 'all'
        const filterId = isPostType ? `post_type:${opt.value}` : null
        const isActive = isPostType && activeFilters.some((f) => f.id === filterId)
        const chipColor =
          opt.value === 'all' ? '#FFC72C' : POST_TYPE_COLORS[opt.value as PostType] ?? '#FFC72C'

        return (
          <Chip
            key={opt.value}
            className="feed-filter-chip"
            size="md"
            variant={isActive ? 'solid' : 'outlined'}
            onClick={() => {
              if (opt.value === 'all') {
                setActiveFilters((prev) => prev.filter((f) => f.type !== 'post_type'))
              } else if (isActive && filterId) {
                removeFilter(filterId)
              } else if (isPostType) {
                addFilter({ type: 'post_type', value: opt.value, label: opt.label })
              }
            }}
            sx={{
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
  )

  // ─── Render ─────────────────────────────────────────────

  const feedPostsContent = (
    <Box>
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress size="lg" sx={{ '--CircularProgress-trackColor': '#222', '--CircularProgress-progressColor': '#FFC72C' }} />
        </Box>
      )}

      {error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography level="body-lg" sx={{ color: '#EF4444' }}>
            Failed to load feed. Please try again.
          </Typography>
        </Box>
      )}

      {!isLoading && !error && orderedPosts.length === 0 && (
        <EmptyState hasActiveFilters={activeFilters.length > 0} />
      )}

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
            <FeedCard
              key={post.id}
              post={post}
              onClick={() => handlePostClick(post)}
              isAdmin={!!isAdmin}
              onDelete={isAdmin ? setDeleteTarget : undefined}
            />
          ))}
        </Box>
      )}
    </Box>
  )

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
      <FeedModulesGrid
        filterDrawerContent={filterChips}
        activeFilters={activeFilters}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
      >
        {feedPostsContent}
      </FeedModulesGrid>

      {/* Admin delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
        <ModalDialog
          variant="outlined"
          role="alertdialog"
          sx={{ maxWidth: 420, bgcolor: '#111', borderColor: '#333' }}
        >
          <Typography
            level="title-lg"
            startDecorator={<WarningRounded sx={{ color: '#EF4444' }} />}
            sx={{ color: '#FFF' }}
          >
            Delete Post
          </Typography>
          <Divider sx={{ borderColor: '#222' }} />
          <Typography level="body-sm" sx={{ color: '#CCC', my: 1 }}>
            Are you sure you want to permanently delete this post?
          </Typography>
          {deleteTarget && (
            <Card variant="outlined" size="sm" sx={{ bgcolor: '#0a0a0a', borderColor: '#222', mb: 2 }}>
              <CardContent sx={{ p: 1.5, gap: 0.5 }}>
                <Stack direction="row" gap={0.5} alignItems="center">
                  <Chip
                    size="sm"
                    sx={{
                      bgcolor: `${POST_TYPE_COLORS[deleteTarget.post_type] ?? '#FFC72C'}22`,
                      color: POST_TYPE_COLORS[deleteTarget.post_type] ?? '#FFC72C',
                      fontWeight: 700,
                      fontSize: '0.6rem',
                    }}
                  >
                    {POST_TYPE_LABELS[deleteTarget.post_type] ?? deleteTarget.post_type}
                  </Chip>
                  {deleteTarget.game_date && (
                    <Typography level="body-xs" sx={{ color: '#888' }}>{deleteTarget.game_date}</Typography>
                  )}
                </Stack>
                <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
                  {deleteTarget.title}
                </Typography>
                {deleteTarget.subtitle && (
                  <Typography level="body-xs" sx={{ color: '#AAA' }}>{deleteTarget.subtitle}</Typography>
                )}
              </CardContent>
            </Card>
          )}
          <Typography level="body-xs" sx={{ color: '#EF4444', mb: 2 }}>
            This will delete the post, all its sections, and engagement data. This cannot be undone.
          </Typography>
          <Stack direction="row" gap={1} justifyContent="flex-end">
            <Button
              variant="outlined"
              color="neutral"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              sx={{ color: '#CCC', borderColor: '#444' }}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              onClick={handleDeletePost}
              loading={deleting}
            >
              Delete Post
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  )
}
