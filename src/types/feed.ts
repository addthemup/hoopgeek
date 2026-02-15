/**
 * Feed V2 Types
 *
 * TypeScript interfaces matching the feed_v2 database schema.
 * Every table and every JSONB content shape is typed here.
 */

// ─── Post types ─────────────────────────────────────────────
export type PostType =
  | 'game_recap'
  | 'player_spotlight'
  | 'team_of_night'
  | 'team_of_week'
  | 'player_of_week'
  | 'player_of_month'
  | 'prop_prediction'
  | 'prop_results'
  | 'injury_report'

export type PostStatus = 'draft' | 'published' | 'archived'

// ─── Section types ──────────────────────────────────────────
export type SectionType =
  | 'hero'
  | 'headline'
  | 'lineup_card'
  | 'player_highlight'
  | 'stat_comparison'
  | 'video_clip'
  | 'chart'
  | 'rich_text'
  | 'prop_card'
  | 'injury_card'
  | 'pull_quote'
  | 'gallery'
  | 'box_score'

// ─── Feed tag values ────────────────────────────────────────
export type FeedTag = 'highlights' | 'awards' | 'props' | 'injuries' | 'recap' | 'analysis'

// ─── Share platform ─────────────────────────────────────────
export type SharePlatform = 'twitter' | 'facebook' | 'copy' | 'instagram' | 'sms' | 'other'

// ─── View source ────────────────────────────────────────────
export type ViewSource = 'feed' | 'share_link' | 'push_notification' | 'search' | 'direct'

// =====================================================================
// DATABASE ROW TYPES
// =====================================================================

/** Row from `feed_posts` */
export interface FeedPost {
  id: string
  post_type: PostType
  status: PostStatus
  source_ref: string | null
  title: string
  subtitle: string | null
  description: string | null
  slug: string
  cover_image_url: string | null
  share_image_url: string | null
  game_id: string | null
  game_date: string | null       // DATE as ISO string
  team_tricodes: string[] | null
  player_ids: number[] | null
  person_id: number | null
  metadata: Record<string, any>
  tags: FeedTag[]
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  bookmarks_count: number
  created_by: string | null
  author_name: string
  published_at: string | null
  created_at: string
  updated_at: string
}

/** Row from `feed_post_sections` */
export interface FeedPostSection {
  id: string
  post_id: string
  section_order: number
  section_type: SectionType
  title: string | null
  content: SectionContent
  player_id: number | null
  team_tricode: string | null
  created_at: string
}

/** Row from `feed_post_comments` */
export interface FeedPostComment {
  id: string
  post_id: string
  user_id: string
  parent_comment_id: string | null
  content: string
  likes_count: number
  is_edited: boolean
  created_at: string
  updated_at: string
  // Joined fields (from user profile)
  user_profile?: {
    display_name: string | null
    avatar_url: string | null
  }
  replies?: FeedPostComment[]
}

/** Row from `feed_post_likes` */
export interface FeedPostLike {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

/** Row from `feed_post_shares` */
export interface FeedPostShare {
  id: string
  post_id: string
  user_id: string | null
  platform: SharePlatform
  created_at: string
}

/** Row from `feed_post_bookmarks` */
export interface FeedPostBookmark {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

/** Row from `feed_post_views` */
export interface FeedPostView {
  id: string
  post_id: string
  user_id: string | null
  viewed_at: string
  view_duration_seconds: number | null
  sections_viewed: number
  source: ViewSource | null
}

/** Row from `feed_comment_likes` */
export interface FeedCommentLike {
  id: string
  comment_id: string
  user_id: string
  created_at: string
}

// =====================================================================
// SECTION CONTENT SHAPES (typed per section_type)
// =====================================================================

/** Union type — the `content` JSONB column in feed_post_sections */
export type SectionContent =
  | HeroContent
  | HeadlineContent
  | LineupCardContent
  | PlayerHighlightContent
  | StatComparisonContent
  | VideoClipContent
  | ChartContent
  | RichTextContent
  | PropCardContent
  | InjuryCardContent
  | PullQuoteContent
  | GalleryContent
  | BoxScoreContent

export interface HeroContent {
  image_url?: string
  gradient_overlay?: boolean
  badge?: string                // e.g. 'TEAM OF THE NIGHT'
  team_tricode?: string
}

export interface HeadlineContent {
  text: string
  subtitle?: string
  accent_color?: string         // e.g. '#FFC72C'
}

export interface LineupPlayer {
  player_id: number
  name: string
  fantasy_points: number
  salary?: number
  position?: string
  team_tricode: string
  headshot_url?: string
  stats?: Record<string, number>
}

export interface LineupCardContent {
  starters: LineupPlayer[]
  bench: LineupPlayer[]
  total_salary?: number
  total_fantasy_points?: number
  salary_cap?: number
}

export interface DataOverlay {
  label: string
  value: string | number
  color?: string
}

export interface HighlightClip {
  mp4: string
  description?: string
  action_type?: string
  period?: number
  clock?: string
}

export interface PlayerHighlightContent {
  player_id: number
  name: string
  headshot_url?: string
  team_tricode: string
  stats: Record<string, number>   // { pts: 32, reb: 14, ast: 9, ... }
  fantasy_points?: number
  video_url?: string              // best single clip
  video_thumbnail?: string
  video_clips?: HighlightClip[]   // top N highlight clips for this player
  data_overlays?: DataOverlay[]
}

export interface StatComparisonTeam {
  tricode: string
  value: number
  color?: string
}

export interface StatComparisonContent {
  title: string
  teams: StatComparisonTeam[]
  diff?: number
  stat_name?: string
}

export interface VideoClipContent {
  video_url: string
  thumbnail_url?: string
  caption?: string
  duration_seconds?: number
  action_type?: string
  period?: number
  clock?: string
}

export interface ChartContent {
  chart_type: string             // 'shot_chart' | 'radar' | 'efficiency' | ...
  chart_props: Record<string, any>
  caption?: string
}

export interface RichTextContent {
  markdown: string
}

export interface PropCardContent {
  player_id: number
  player_name: string
  bet_type: string               // 'points' | 'rebounds' | 'assists' | ...
  line: number
  actual?: number
  result?: 'over' | 'under' | 'push' | 'pending'
  odds?: number
  confidence?: number
  trend?: number[]
}

export interface InjuryCardContent {
  player_id: number
  player_name: string
  team_tricode: string
  status: string                 // 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'PROBABLE'
  injury: string                 // 'Left knee soreness'
  expected_return?: string
  impact_note?: string
}

export interface PullQuoteContent {
  text: string
  attribution?: string
  accent_color?: string
  icon?: string                  // 'fire' | 'trophy' | 'chart' | ...
}

export interface GalleryContent {
  images: Array<{ url: string; caption?: string }>
}

export interface BoxScorePlayer {
  player_id: number
  name: string
  minutes: string
  pts: number
  reb: number
  ast: number
  stl?: number
  blk?: number
  fg?: string                    // '12-22'
  three_pt?: string              // '4-8'
  ft?: string                    // '3-4'
  plus_minus?: number
}

export interface BoxScoreContent {
  home: {
    tricode: string
    players: BoxScorePlayer[]
  }
  away: {
    tricode: string
    players: BoxScorePlayer[]
  }
}

// =====================================================================
// FEED CARD (for the grid / list view — lightweight projection)
// =====================================================================

/** Lightweight projection for feed card rendering (no sections) */
export interface FeedCard {
  id: string
  post_type: PostType
  title: string
  subtitle: string | null
  description: string | null
  slug: string
  cover_image_url: string | null
  game_date: string | null
  team_tricodes: string[] | null
  person_id: number | null
  tags: FeedTag[]
  likes_count: number
  comments_count: number
  views_count: number
  bookmarks_count: number
  published_at: string | null
  metadata: Record<string, any>
}

// =====================================================================
// ENGAGEMENT STATE (client-side)
// =====================================================================

export interface EngagementState {
  liked: boolean
  bookmarked: boolean
  likesCount: number
  commentsCount: number
  sharesCount: number
  viewsCount: number
  bookmarksCount: number
}

// =====================================================================
// FILTER / ALGORITHM OPTIONS
// =====================================================================

export type FeedFilterType = 'all' | PostType

export interface FeedFilters {
  postType: FeedFilterType
  teamTricode?: string
  playerName?: string
  tag?: FeedTag
  dateRange?: { from: string; to: string }
}
