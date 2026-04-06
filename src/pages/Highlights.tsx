/**
 * Feed Page (Highlights) — V2
 *
 * Card-grid feed. Each card links to /feed/:slug for the full story.
 * Supports filtering by post type, team, and tag.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Modal,
  ModalDialog,
  Button,
  Stack,
  Divider,
} from '@mui/joy'
import { useMediaQuery } from '@mui/material'
import Favorite from '@mui/icons-material/Favorite'
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline'
import Visibility from '@mui/icons-material/Visibility'
import BookmarkBorder from '@mui/icons-material/BookmarkBorder'
import Close from '@mui/icons-material/Close'
import WarningRounded from '@mui/icons-material/WarningRounded'
import { supabase } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useFavoritePlayers, useFavoriteTeams } from '../hooks/useUserSettings'
import { usePlayerFavorites } from '../hooks/usePlayerFavorites'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { orderPostsByAlgorithm } from '../utils/feedAlgorithm'
import { useFeedVideoStore } from '../stores/feedVideoStore'
import type { FeedPost, PostType, FeedFilterType } from '../types/feed'
import {
  PARENT_FEED_POST_TYPES,
  FEED_SUB_POST_TYPES,
} from '../types/feed'
import type { FeedDrawerTabId } from '../constants/feedDrawerTabs'
import { useFeedDrawerTabOptional } from '../contexts/FeedDrawerTabContext'
import type { ActiveFilter } from '../types/feed'
import { FeedCardThumbnail } from '../components/Feed/FeedThumbnails'
import { useSetFeedLayoutProps } from '../contexts/FeedLayoutContext'
import GamePage from './GamePage'
import { PropPredictionsModule } from './Today'
import { useNBAScoreboard } from '../hooks/useNBAScoreboard'
import { getTodayEST } from '../utils/nbaDateUtils'
import dayjs from 'dayjs'
import Link from '@mui/joy/Link'
import ChevronLeft from '@mui/icons-material/ChevronLeft'

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
  draft: 'Draft',
  dfs: 'DFS',
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
  draft: '#6366F1',
  dfs: '#22C55E',
}

// ─── Data fetching ──────────────────────────────────────────

/** Small pages; next chunk loads when the sentinel intersects (all breakpoints). */
const FEED_PAGE_SIZE = 12
const HOME_CANDIDATE_PAGE_SIZE = 24

const LAST_NIGHT_SQL_POST_TYPES: PostType[] = ['game_recap', 'player_spotlight', 'team_of_night']

export type FeedInfiniteQuerySpec = {
  postTypes: PostType[]
  queryKeySuffix: string
}

export function buildFeedInfiniteSpecFromDrawerTab(tab: FeedDrawerTabId): FeedInfiniteQuerySpec {
  if (tab === 'props') {
    return { postTypes: ['prop_prediction', 'prop_results'], queryKeySuffix: 'tab:props' }
  }
  if (tab === 'dfs') {
    return { postTypes: ['dfs'], queryKeySuffix: 'tab:dfs' }
  }
  if (tab === 'draft') {
    return { postTypes: ['draft'], queryKeySuffix: 'tab:draft' }
  }
  return { postTypes: [...PARENT_FEED_POST_TYPES], queryKeySuffix: 'tab:home' }
}

function useFeedPostsInfinite(spec: FeedInfiniteQuerySpec) {
  return useInfiniteQuery({
    queryKey: ['feed-posts-v2-infinite', spec.queryKeySuffix],
    queryFn: async ({ pageParam = 0 }): Promise<FeedPost[]> => {
      if (!spec.postTypes.length) return []
      const isHomeFeed = spec.queryKeySuffix === 'tab:home'
      const pageSize = isHomeFeed ? HOME_CANDIDATE_PAGE_SIZE : FEED_PAGE_SIZE
      const from = pageParam * pageSize
      const to = from + pageSize - 1
      let q = supabase
        .from('feed_posts')
        .select('*')
        .eq('status', 'published')
        .in('post_type', spec.postTypes)
        .order('published_at', { ascending: false })
        .range(from, to)
      for (const st of FEED_SUB_POST_TYPES) {
        q = q.neq('post_type', st)
      }
      const { data, error } = await q
      if (error) throw error
      const base = (data ?? []) as FeedPost[]

      if (!isHomeFeed) return base

      // Home feed needs a richer candidate pool so recaps/upcoming can surface even
      // when recent automation floods one post type.
      const today = getTodayEST()
      const recapFrom = pageParam * 20
      const recapTo = recapFrom + 19
      const upcomingFrom = pageParam * 16
      const upcomingTo = upcomingFrom + 15
      const draftFrom = pageParam * 10
      const draftTo = draftFrom + 9

      const [{ data: recapSupplemental }, { data: upcomingSupplemental }, { data: draftSupplemental }] = await Promise.all([
        supabase
          .from('feed_posts')
          .select('*')
          .eq('status', 'published')
          .eq('post_type', 'game_recap')
          .order('game_date', { ascending: false, nullsFirst: false })
          .order('published_at', { ascending: false })
          .range(recapFrom, recapTo),
        supabase
          .from('feed_posts')
          .select('*')
          .eq('status', 'published')
          .eq('post_type', 'upcoming')
          .gte('game_date', today)
          .order('game_date', { ascending: true, nullsFirst: false })
          .order('published_at', { ascending: false })
          .range(upcomingFrom, upcomingTo),
        supabase
          .from('feed_posts')
          .select('*')
          .eq('status', 'published')
          .eq('post_type', 'draft')
          .order('published_at', { ascending: false })
          .range(draftFrom, draftTo),
      ])

      const spotlightFrom = pageParam * 6
      const spotlightTo = spotlightFrom + 5
      const { data: spotlightSupplemental } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('status', 'published')
        .eq('post_type', 'player_spotlight')
        .order('published_at', { ascending: false })
        .range(spotlightFrom, spotlightTo)

      const mergedById = new Map<string, FeedPost>()
      for (const p of base) mergedById.set(p.id, p)
      for (const p of ((recapSupplemental ?? []) as FeedPost[])) mergedById.set(p.id, p)
      for (const p of ((upcomingSupplemental ?? []) as FeedPost[])) mergedById.set(p.id, p)
      for (const p of ((draftSupplemental ?? []) as FeedPost[])) mergedById.set(p.id, p)
      for (const p of ((spotlightSupplemental ?? []) as FeedPost[])) mergedById.set(p.id, p)
      return Array.from(mergedById.values())
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= FEED_PAGE_SIZE ? allPages.length : undefined,
    initialPageParam: 0,
    enabled: spec.postTypes.length > 0,
    staleTime: 1000 * 60 * 2, // 2 min
  })
}

// ─── Feed Card ──────────────────────────────────────────────

export { POST_TYPE_LABELS, POST_TYPE_COLORS }

/** Fixed calendar date for feed cards (game night first, else published). */
export function formatFeedCardDate(post: FeedPost): string {
  const raw = post.game_date ?? post.published_at
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Subtitle without redundant date (shown in header). */
function getDisplaySubtitle(post: FeedPost): string | null {
  let sub = post.subtitle?.trim()
  if (!sub) return null

  const gd = post.game_date ? String(post.game_date).slice(0, 10) : null
  if (gd && sub === gd) return null
  if (gd && /^\d{4}-\d{2}-\d{2}$/.test(sub) && sub === gd) return null

  if (gd) {
    const tail = ` · ${gd}`
    if (sub.endsWith(tail)) sub = sub.slice(0, -tail.length).trim()
    else if (sub.endsWith(` ${gd}`)) sub = sub.slice(0, -(gd.length + 1)).trim()
  }

  if (!sub) return null
  return sub
}

export function FeedCard({ post, onClick, isAdmin, onDelete }: {
  post: FeedPost
  onClick: () => void
  isAdmin?: boolean
  onDelete?: (post: FeedPost) => void
}) {
  const typeColor = POST_TYPE_COLORS[post.post_type] ?? '#FFC72C'
  const typeLabel = POST_TYPE_LABELS[post.post_type] ?? post.post_type
  const isUpcoming = post.post_type === 'upcoming'
  const gameDayKey = post.game_date ? String(post.game_date).slice(0, 10) : ''
  const isTonight = isUpcoming && gameDayKey === getTodayEST()

  const headerDate = useMemo(() => formatFeedCardDate(post), [post.game_date, post.published_at])
  const displaySubtitle = useMemo(() => getDisplaySubtitle(post), [post.subtitle, post.game_date])

  return (
    <Card
      variant="outlined"
      onClick={onClick}
      className="group"
      sx={{
        bgcolor: '#111111',
        borderColor: isUpcoming ? 'rgba(139, 92, 246, 0.42)' : '#222222',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...(isUpcoming
          ? {
              boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.25), 0 10px 36px rgba(139, 92, 246, 0.14)',
            }
          : {}),
        '&:hover': {
          borderColor: typeColor,
          boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${typeColor}22`,
        },
        '&:hover .admin-delete-btn': { opacity: 1 },
        '& .feed-card-thumb': { transition: 'transform 0.3s ease-out' },
        '&:hover .feed-card-thumb': { transform: 'scale(1.03)' },
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

      <Box
        sx={{
          width: '100%',
          aspectRatio: '16 / 9',
          flexShrink: 0,
          overflow: 'hidden',
          bgcolor: '#000',
        }}
      >
        <FeedCardThumbnail post={post} typeColor={typeColor} />
      </Box>

      <CardContent sx={{ p: 2, gap: 1, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Type badge + date */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
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
            {isTonight && (
              <Chip size="sm" variant="soft" sx={{ height: 22, fontSize: '0.6rem', fontWeight: 800, bgcolor: 'rgba(139,92,246,0.35)', color: '#E9D5FF' }}>
                Tonight
              </Chip>
            )}
            {isUpcoming && !isTonight && (
              <Chip size="sm" variant="soft" sx={{ height: 22, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(139,92,246,0.2)', color: '#C4B5FD' }}>
                Preview
              </Chip>
            )}
          </Box>
          <Typography level="body-xs" sx={{ color: '#888', fontVariantNumeric: 'tabular-nums' }}>
            {headerDate}
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

        {/* Subtitle (date deduped vs header) */}
        {displaySubtitle && (
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
            {displaySubtitle}
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

function EmptyState({ mode }: { mode: 'no_content_scope' | 'no_matches' }) {
  const title =
    mode === 'no_content_scope'
      ? 'Pick a feed category'
      : 'No stories match your filters'
  const body =
    mode === 'no_content_scope'
      ? 'Choose a tab in the drawer to load stories. Props, DFS, and Draft live there; the main feed stays on this page.'
      : 'Try other categories or remove some filters to see more posts.'
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
        {title}
      </Typography>
      <Typography level="body-md" sx={{ color: '#888', maxWidth: 440, mx: 'auto' }}>
        {body}
      </Typography>
    </Box>
  )
}

// ─── Main Feed Component ────────────────────────────────────

export default function Highlights() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { data: isAdmin } = useIsAdmin()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()
  const isMobile = useMediaQuery('(max-width: 900px)')
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
  const feedFetchingNextRef = useRef(false)
  const clearPostScope = useFeedVideoStore((s) => s.clearScope)
  useEffect(() => {
    clearPostScope('post')
  }, [clearPostScope])

  const { data: favPlayers } = useFavoritePlayers(user?.id)
  const { data: favTeams } = useFavoriteTeams(user?.id)
  const { data: playerFavorites } = usePlayerFavorites()

  const isPropPredictionsPage = location.pathname === '/feed/prop-predictions' || location.pathname.startsWith('/feed/prop-predictions/')
  const todayEST = getTodayEST()
  const { data: nbaScoreboard } = useNBAScoreboard(isPropPredictionsPage ? todayEST : undefined)

  const [searchParams, setSearchParams] = useSearchParams()
  const selectedGameId = searchParams.get('game') ?? null

  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])
  const [deleteTarget, setDeleteTarget] = useState<FeedPost | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [feedSessionSeed] = useState(() => Date.now() + Math.floor(Math.random() * 1_000_000))

  const drawerTab = useFeedDrawerTabOptional()?.feedDrawerTab ?? 'home'
  const feedInfiniteSpec = useMemo(() => buildFeedInfiniteSpecFromDrawerTab(drawerTab), [drawerTab])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useFeedPostsInfinite(feedInfiniteSpec)
  const posts = useMemo(() => data?.pages.flat() ?? [], [data])

  // Fetch game teams when ?game= is set (for filtering feed and syncing chip filters)
  const { data: gameTeams } = useQuery({
    queryKey: ['feed-game-teams', selectedGameId],
    queryFn: async () => {
      if (!selectedGameId) return null
      const { data } = await supabase
        .from('nba_games')
        .select('home_team_tricode, away_team_tricode')
        .eq('game_id', selectedGameId)
        .maybeSingle()
      return data?.home_team_tricode && data?.away_team_tricode ? data : null
    },
    enabled: !!selectedGameId,
    staleTime: 1000 * 60 * 5,
  })

  // When URL has ?game= but no team filters, sync chip filters from game
  useEffect(() => {
    if (!selectedGameId || !gameTeams || activeFilters.some((f) => f.type === 'team')) return
    setActiveFilters((prev) => {
      const hasHome = prev.some((f) => f.type === 'team' && f.value === gameTeams.home_team_tricode)
      const hasAway = prev.some((f) => f.type === 'team' && f.value === gameTeams.away_team_tricode)
      if (hasHome && hasAway) return prev
      const next = prev.filter((f) => f.type !== 'team')
      next.push({ id: `team:${gameTeams.home_team_tricode}`, type: 'team', value: gameTeams.home_team_tricode, label: gameTeams.home_team_tricode })
      next.push({ id: `team:${gameTeams.away_team_tricode}`, type: 'team', value: gameTeams.away_team_tricode, label: gameTeams.away_team_tricode })
      return next
    })
  }, [selectedGameId, gameTeams, activeFilters])

  useEffect(() => {
    feedFetchingNextRef.current = isFetchingNextPage
  }, [isFetchingNextPage])

  useEffect(() => {
    if (!hasNextPage) return
    const el = loadMoreSentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting)
        if (hit && !feedFetchingNextRef.current) fetchNextPage()
      },
      { root: null, rootMargin: '320px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, fetchNextPage])

  const addFilter = useCallback((filter: Omit<ActiveFilter, 'id'>) => {
    const id = `${filter.type}:${filter.value}`
    setActiveFilters((prev) => (prev.some((f) => f.id === id) ? prev : [...prev, { ...filter, id }]))
  }, [])

  const removeFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // When ?game= is set, only show posts for that game's teams (plus any other active filters)
  const gameTeamTricodes = useMemo(() => {
    if (!selectedGameId || !gameTeams) return null
    return new Set([gameTeams.home_team_tricode, gameTeams.away_team_tricode])
  }, [selectedGameId, gameTeams])

  // Favorite player IDs from same source as Favorites drawer (usePlayerFavorites) so the Favorites chip matches the list you see in the drawer
  const favoritePlayerIdsSet = useMemo(
    () =>
      new Set<number>(
        (playerFavorites ?? [])
          .map((fav) => fav.nba_players?.nba_player_id)
          .filter((id): id is number => id != null && id > 0)
      ),
    [playerFavorites]
  )

  // Apply active filters: show post if it matches ANY selected team/player chip.
  // Sub-post types never appear (query + safety filter).
  const filteredPosts = useMemo(() => {
    if (!posts) return []
    if (selectedGameId && !gameTeamTricodes) return []

    const subEx = new Set(FEED_SUB_POST_TYPES as unknown as string[])
    let pool = posts.filter((p) => !subEx.has(p.post_type))

    if (gameTeamTricodes) {
      pool = pool.filter((post) => {
        const postTeams = post.team_tricodes ?? []
        return postTeams.some((t) => gameTeamTricodes.has(t))
      })
    }

    const teamValues = new Set(activeFilters.filter((f) => f.type === 'team').map((f) => f.value))
    const playerValues = new Set(activeFilters.filter((f) => f.type === 'player').map((f) => parseInt(f.value, 10)))
    if (teamValues.size === 0 && playerValues.size === 0) {
      return pool
    }

    return pool.filter((post) => {
      const postPlayerIdsBase = (post.player_ids ?? []).map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
      if (post.person_id != null) postPlayerIdsBase.push(post.person_id)

      const postTeams = post.team_tricodes ?? []
      const postPlayerIds = postPlayerIdsBase

      if (teamValues.size > 0 && postTeams.some((t) => teamValues.has(t))) return true
      if (playerValues.size > 0 && postPlayerIds.some((id) => playerValues.has(id))) return true
      return false
    })
  }, [posts, activeFilters, selectedGameId, gameTeamTricodes])

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
      clickSource: 'home' as const,
      isUserLoggedIn: !!user,
      filters: {
        postType: 'all' as FeedFilterType,
      },
      seed: feedSessionSeed,
    }
  }, [favPlayers, favTeams, user, feedSessionSeed])

  // Apply algorithm to filtered posts
  const orderedPosts = useMemo(() => {
    return orderPostsByAlgorithm(filteredPosts, algorithmOptions)
  }, [filteredPosts, algorithmOptions])

  const deckPosts = orderedPosts

  const filterDeckKey = useMemo(
    () => `${drawerTab}:${selectedGameId ?? ''}:${[...activeFilters].map((f) => f.id).sort().join(',')}`,
    [drawerTab, selectedGameId, activeFilters]
  )
  const feedMotionKey = filterDeckKey

  const handlePostClick = useCallback(
    (post: FeedPost) => {
      navigate(`/feed/${post.slug}`)
    },
    [navigate]
  )

  // When user clicks a game in the carousel: go to standalone game page
  const handleGameClick = useCallback(
    (game: { game_id: string; home_team_tricode: string; away_team_tricode: string }) => {
      navigate(`/game/${game.game_id}`, { state: { returnPath: '/feed' } })
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
      queryClient.invalidateQueries({ queryKey: ['feed-posts-v2-infinite'] })
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete post:', err)
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, queryClient])

  // Register with persistent feed shell so header/drawer stay mounted when navigating to a post
  useSetFeedLayoutProps({
    filterDrawerContent: null,
    activeFilters,
    onAddFilter: addFilter,
    onRemoveFilter: removeFilter,
    onGameClick: handleGameClick,
    hasGameHeader: !!selectedGameId && !isPropPredictionsPage,
  })

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

      {!isLoading && !error && orderedPosts.length === 0 && !isPropPredictionsPage && (
        <EmptyState mode="no_matches" />
      )}

      {!isLoading && !error && orderedPosts.length > 0 && (
        <>
          <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={feedMotionKey}
              initial={reduceMotion ? false : isMobile ? { opacity: 0, x: 18 } : { opacity: 0 }}
              animate={isMobile ? { opacity: 1, x: 0 } : { opacity: 1 }}
              exit={reduceMotion ? undefined : isMobile ? { opacity: 0, x: -18 } : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : isMobile ? 0.26 : 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}
            >
              <Box
                sx={{
                  display: 'grid',
                  // Column count follows the feed column width (container), not only viewport md — keeps 3 cols in the 1035px feed when the window is under 900px wide.
                  gridTemplateColumns: 'minmax(0, 1fr)',
                  gap: { xs: 2.5, sm: 2 },
                  '@container (min-width: 520px)': {
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 2,
                  },
                  '@container (min-width: 720px)': {
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 2.5,
                  },
                }}
              >
                {deckPosts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    layout={!reduceMotion}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                    transition={{
                      layout: { duration: reduceMotion ? 0 : 0.28, ease: [0.25, 0.46, 0.45, 0.94] },
                      opacity: { duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : Math.min(index, 14) * 0.04 },
                      y: { duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : Math.min(index, 14) * 0.04 },
                    }}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                  >
                    <FeedCard
                      post={post}
                      onClick={() => handlePostClick(post)}
                      isAdmin={!!isAdmin}
                      onDelete={isAdmin ? setDeleteTarget : undefined}
                    />
                  </motion.div>
                ))}
              </Box>
            </motion.div>
          </AnimatePresence>
          </Box>
          {hasNextPage && (
            <>
              <Box ref={loadMoreSentinelRef} sx={{ height: 1, width: '100%' }} aria-hidden />
              {isFetchingNextPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size="md" sx={{ '--CircularProgress-trackColor': '#222', '--CircularProgress-progressColor': '#FFC72C' }} />
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Box>
  )

  const isMainFeed = !selectedGameId && !isPropPredictionsPage;

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        px: { xs: 0, sm: 0, md: 0 },
        pt: { xs: 2, md: 3 },
        pb: 6,
        boxSizing: 'border-box',
        overflowX: 'hidden',
        ...(selectedGameId || isMainFeed ? { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 } : {}),
      }}
    >
      {isPropPredictionsPage ? (
        <Box sx={{ width: '100%', maxWidth: '100%', py: 2 }}>
          <Link
            component="button"
            onClick={() => navigate('/feed')}
            sx={{
              color: 'text.secondary',
              fontSize: '0.875rem',
              mb: 2,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              '&:hover': { color: 'primary.500' },
            }}
          >
            <ChevronLeft fontSize="small" />
            Feed
          </Link>
          <Box sx={{ width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PropPredictionsModule
              embedMode="over"
              selectedDate={dayjs(todayEST)}
              navigate={navigate}
              onOpen={() => {}}
              nbaScoreboard={nbaScoreboard}
            />
            <PropPredictionsModule
              embedMode="under"
              selectedDate={dayjs(todayEST)}
              navigate={navigate}
              onOpen={() => {}}
              nbaScoreboard={nbaScoreboard}
            />
            <PropPredictionsModule
              embedMode="team_confidence"
              selectedDate={dayjs(todayEST)}
              navigate={navigate}
              onOpen={() => {}}
              nbaScoreboard={nbaScoreboard}
            />
            <PropPredictionsModule
              embedMode="player_confidence"
              selectedDate={dayjs(todayEST)}
              navigate={navigate}
              onOpen={() => {}}
              nbaScoreboard={nbaScoreboard}
            />
          </Box>
        </Box>
      ) : (
        <>
          {selectedGameId && (
            <Box sx={{ mb: 1.5, '& .MuiBox-root': { maxWidth: '100%' } }}>
              <GamePage gameId={selectedGameId} embeddedInFeed />
            </Box>
          )}
          {feedPostsContent}
        </>
      )}

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
