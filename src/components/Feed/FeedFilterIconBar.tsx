/**
 * Single-row feed filters as lucide pills. Used above the feed (not in the drawer).
 * No geek-bar chip = implicit "All" (parent post types; same fetch as feed_scope all_parent). ?game= may still inject explicit All.
 * "All" sets feed_scope all_parent (parent post types only, never sub-posts).
 */

import Box from '@mui/joy/Box'
import { useMediaQuery } from '@mui/material'
import type { ActiveFilter } from '../../types/feed'
import type { FeedFilterType, PostType } from '../../types/feed'
import { Pill, PillIcon } from '@/components/kibo-ui/pill'
import {
  LayoutGrid,
  Heart,
  Moon,
  Newspaper,
  Sparkles,
  Trophy,
  Star,
  UserRound,
  CalendarDays,
  ChartColumnBig,
  BadgeCheck,
  TriangleAlert,
  Clock3,
  FileText,
  ClipboardList,
  DollarSign,
  type LucideIcon,
} from 'lucide-react'

export type FeedTopBarFilterValue = FeedFilterType | 'awards'
export type FeedTopBarFilterOption = { value: FeedTopBarFilterValue; label: string }

export const FEED_FILTER_OPTIONS: FeedTopBarFilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'last_night', label: 'Last Night' },
  { value: 'game_recap', label: 'Recaps' },
  { value: 'awards', label: 'Awards' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'blog', label: 'Blog' },
  { value: 'draft', label: 'Draft' },
  { value: 'dfs', label: 'DFS' },
]

const FEED_FILTER_ICONS: Record<FeedTopBarFilterValue, LucideIcon> = {
  all: LayoutGrid,
  favorites: Heart,
  last_night: Moon,
  game_recap: Newspaper,
  player_spotlight: Sparkles,
  awards: Trophy,
  team_of_night: Trophy,
  team_of_week: Star,
  player_of_week: UserRound,
  player_of_month: CalendarDays,
  prop_prediction: ChartColumnBig,
  prop_results: BadgeCheck,
  injury_report: TriangleAlert,
  upcoming: Clock3,
  blog: FileText,
  draft: ClipboardList,
  dfs: DollarSign,
}

/** Content-driving filters (geek bar), excluding team/player header chips. Exported for Highlights query + empty state. */
export function feedBarContentFilters(filters: ActiveFilter[]) {
  return filters.filter(
    (f) =>
      f.type === 'post_type' ||
      f.type === 'favorites' ||
      f.type === 'last_night' ||
      f.type === 'feed_scope',
  )
}

function filterIdForOption(opt: FeedTopBarFilterOption): string | null {
  if (opt.value === 'all') return null
  if (opt.value === 'favorites') return 'favorites:favorites'
  if (opt.value === 'last_night') return 'last_night:last_night'
  if (opt.value === 'awards') return 'post_type:awards'
  return `post_type:${opt.value}`
}

export function isFeedFilterIconOn(activeFilters: ActiveFilter[], opt: FeedTopBarFilterOption): boolean {
  const content = feedBarContentFilters(activeFilters)
  const hasAllParent =
    activeFilters.some((f) => f.type === 'feed_scope' && f.value === 'all_parent') ||
    content.length === 0

  if (opt.value === 'all') return hasAllParent

  if (hasAllParent) return false

  if (opt.value === 'awards') {
    const awardIds = new Set([
      'post_type:team_of_night',
      'post_type:team_of_week',
      'post_type:player_of_week',
      'post_type:player_of_month',
    ])
    return activeFilters.some((f) => awardIds.has(f.id))
  }
  const id = filterIdForOption(opt)
  if (!id) return false
  return activeFilters.some((f) => f.id === id)
}

export type FeedFilterIconBarProps = {
  activeFilters: ActiveFilter[]
  onFilterClick: (opt: FeedTopBarFilterOption) => void
}

export default function FeedFilterIconBar({ activeFilters, onFilterClick }: FeedFilterIconBarProps) {
  const isMobile = useMediaQuery('(max-width: 900px)')

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: isMobile ? 0.5 : 0.75,
        width: '100%',
        minWidth: 0,
        py: 0.5,
        ...(isMobile
          ? {
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'neutral.600' },
            }
          : { overflow: 'hidden' }),
      }}
    >
      {FEED_FILTER_OPTIONS.map((opt) => {
        const Icon = FEED_FILTER_ICONS[opt.value]
        const on = isFeedFilterIconOn(activeFilters, opt)
        return (
          <Box
            key={opt.value}
            component="button"
            type="button"
            onClick={() => onFilterClick(opt)}
            aria-label={opt.label}
            aria-pressed={on}
            sx={{
              p: 0,
              border: 'none',
              bgcolor: 'transparent',
              cursor: 'pointer',
              ...(isMobile
                ? { flexShrink: 0, width: 'auto', minWidth: 0 }
                : { flex: 1, minWidth: 0 }),
            }}
          >
            <Pill
              variant={on ? 'active' : 'default'}
              className={
                isMobile
                  ? 'h-9 min-w-[36px] justify-center gap-0 px-0 whitespace-nowrap rounded-full'
                  : 'h-8 w-full justify-center px-2 text-[11px] md:text-xs gap-1 whitespace-nowrap'
              }
            >
              <PillIcon icon={Icon} size={isMobile ? 18 : 13} />
              {!isMobile ? <span>{opt.label}</span> : null}
            </Pill>
          </Box>
        )
      })}
    </Box>
  )
}

/** Post type → same icon component as the filter bar (for thumbnails later). */
export function getPostTypeFilterIcon(postType: PostType): LucideIcon {
  return FEED_FILTER_ICONS[postType] ?? FileText
}
