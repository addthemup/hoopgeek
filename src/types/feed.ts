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
  | 'upcoming'
  | 'blog'
  | 'draft'
  | 'dfs'

/** Shown only via parent posts (e.g. upcoming / recap), never in the main feed grid. */
export const FEED_SUB_POST_TYPES = ['prop_prediction', 'prop_results', 'injury_report'] as const

export type FeedSubPostType = (typeof FEED_SUB_POST_TYPES)[number]

/** Allowed in /feed infinite query and "All" scope (excludes FEED_SUB_POST_TYPES). */
export const PARENT_FEED_POST_TYPES: PostType[] = [
  'game_recap',
  'player_spotlight',
  'team_of_night',
  'team_of_week',
  'player_of_week',
  'player_of_month',
  'upcoming',
  'blog',
  'draft',
  'dfs',
]

export type PostStatus = 'draft' | 'published' | 'archived'

// ─── Section types ──────────────────────────────────────────
export type SectionType =
  | 'hero'
  | 'headline'
  | 'lineup_card'
  | 'player_highlight'
  | 'stat_comparison'
  | 'video_clip'
  | 'video_carousel'
  | 'chart'
  | 'rich_text'
  | 'prop_card'
  | 'injury_card'
  | 'pull_quote'
  | 'gallery'
  | 'box_score'
  | 'game_log'
  | 'post_link'
  | 'tweet_embed'
  | 'injury_module'
  | 'prop_module'
  | 'team_of_night_module'
  | 'team_of_week_module'
  | 'tank_module'
  | 'dfs_module'

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
  draft_prospect_ids: string[] | null  // draft_prospects.id UUIDs
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
  | VideoCarouselContent
  | ChartContent
  | RichTextContent
  | PropCardContent
  | InjuryCardContent
  | PullQuoteContent
  | GalleryContent
  | BoxScoreContent
  | GameLogContent
  | PostLinkContent
  | TweetEmbedContent
  | InjuryModuleContent
  | PropModuleContent
  | TeamOfNightModuleContent
  | TeamOfWeekModuleContent
  | TankModuleContent
  | DfsModuleContent

export interface HeroContent {
  image_url?: string
  gradient_overlay?: boolean
  badge?: string                // e.g. 'TEAM OF THE NIGHT'
  team_tricode?: string
  /** Game Recap: final score line (e.g. 'LAC 126 – NOP 124') and both team tricodes */
  score_line?: string
  team_tricodes?: string[]
  /** Player Spotlight: name and stats shown in hero */
  player_name?: string
  player_stats?: { pts?: number; reb?: number; ast?: number; stl?: number; blk?: number; min?: number }
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
  jersey_number?: string | number
  headshot_url?: string
  stats?: Record<string, number>
  /** MP4 highlight clips from game JSON (play-by-play); used for slideshow in lineup cell */
  video_clips?: HighlightClip[]
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

/** Instagram-style carousel of NBA.com MP4 clips with play metadata (period, clock, description, action_type) */
export interface VideoCarouselContent {
  clips: HighlightClip[]
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

export interface InjuryProgressSegment {
  status: string                 // 'Healthy' | 'Out' | 'Questionable' | 'Probable'
  startPercent: number           // 0–100 (position in season timeline)
  widthPercent: number           // 0–100 (duration in season timeline)
}

export interface InjuryCardContent {
  player_id: number
  player_name: string
  team_tricode: string
  status: string                 // 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'PROBABLE'
  injury: string                 // 'Left knee soreness'
  expected_return?: string
  impact_note?: string
  /** Season injury timeline — green/red/orange progress bar segments */
  progress_segments?: InjuryProgressSegment[]
}

// ── Module-embed section types ──────────────────────────────
// These store frozen data snapshots but render with the same
// display component the live feed modules use, so visual
// changes propagate automatically to past posts.

export interface InjuryModuleEntry {
  nba_player_id: number
  player_name: string
  team_tricode: string
  injury_status: string          // 'Out' | 'Questionable' | 'Day-to-Day' | 'Doubtful'
  injury_type: string            // e.g. 'Left knee'
  progress_segments: InjuryProgressSegment[]
}

export interface InjuryModuleContent {
  injuries: InjuryModuleEntry[]
  teams: string[]
  date: string                   // YYYY-MM-DD
}

export interface PropModuleEntry {
  nba_player_id: number
  player_name: string
  team_tricode: string
  bet_type: string               // 'points' | 'rebounds' | 'assists' | ...
  line: number
  line_movement?: number
  over_odds?: string
  under_odds?: string
  over_hit_rate?: number | null   // 0–100
  under_hit_rate?: number | null  // 0–100
  over_hits?: number
  under_hits?: number
  last10_total?: number
  /** Team confidence 1–10 (opposition team stat vs rulebook). */
  team_confidence?: number | null
  /** Player confidence 1–10 (opposition allowed stats). */
  player_confidence?: number | null
  /** Opposition stat label for confidence views (e.g. "DFG%"). */
  opposition_stat_label?: string
  opposition_stat_value?: string | null
  /** Player offense stat (team conf view: "X vs Opp Y"). */
  player_offense_stat_label?: string
  player_offense_stat_value?: string | null
  /** For results posts: actual stat value */
  actual?: number
  /** For results posts: 'over' | 'under' | 'push' */
  result?: string
}

/** Matches drawer `PropPredictionsModule` embed modes. Omitted or `full` = tabbed module (legacy). */
export type PropModuleEmbedMode = 'full' | 'over' | 'under' | 'team_confidence' | 'player_confidence'

export interface PropModuleContent {
  props: PropModuleEntry[]
  teams: string[]
  date: string                   // YYYY-MM-DD
  mode: 'prediction' | 'results'
  /** When set, story shows only this slice (same rows as drawer modules). */
  embedMode?: PropModuleEmbedMode
}

/** Frozen snapshot of a Team of the Night lineup (same shape as live module). */
export interface TeamOfNightPlayerEntry {
  player_id: string | null
  nba_player_id: number
  player_name: string
  team: string
  player_position: string
  jersey_number: string
  salary: number
  fantasy_points: number
  games_played: number
  lineup_order?: number
  lineup_unit?: string
  unit_position?: number
  weighted_points?: number
}

export interface TeamOfNightModuleContent {
  players: TeamOfNightPlayerEntry[]
  date: string                   // YYYY-MM-DD or display string
}

/** Frozen snapshot of a Team of the Week lineup. */
export interface TeamOfWeekPlayerEntry {
  player_id: string | null
  nba_player_id: number
  player_name: string
  team: string
  player_position: string
  jersey_number: string
  salary: number
  avg_fantasy_points: number
  games_played: number
}

export interface TeamOfWeekModuleContent {
  players: TeamOfWeekPlayerEntry[]
  week_name?: string
  start_date?: string            // YYYY-MM-DD
  end_date?: string              // YYYY-MM-DD
}

/** Frozen prospect snapshot for tank/draft module (one per pick). */
export interface TankProspectEntry {
  id: string                     // draft_prospects.id
  player_name_full: string
  player_slug?: string
  school_team: string | null
  position_primary: string | null
  image_url?: string | null
}

/** Frozen tank row: pick slot + team + lottery odds + prospect at that pick. */
export interface TankRowEntry {
  pick: number                   // 1-14
  team_id: number
  team_abbreviation: string
  team_internal_id?: string      // nba_teams.id for /team/:id navigation
  wins: number
  losses: number
  tank_gb: number               // games behind worst (tank leader)
  top4_pct: number | null       // lottery top-4 %
  one_ovr_pct: number | null    // #1 overall %
  prospect: TankProspectEntry | null
}

export interface TankModuleContent {
  rows: TankRowEntry[]
  season: string                 // e.g. '2025-26'
  snapshot_date: string         // YYYY-MM-DD when data was frozen
  snapshot_week?: string        // draft_rankings snapshot_week if applicable
}

/** Placeholder for DFS feed post section; will expand with dfs_pools, dfs_entries, etc. */
export interface DfsModuleContent {
  snapshot_date: string         // YYYY-MM-DD
  pools?: Array<{ id: string; name: string; status: string; entry_count?: number }>
  message?: string              // e.g. "DFS data will be integrated here"
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

export interface GameLogRow {
  game_date: string
  matchup: string
  min: string | number | null
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fgm: number
  fga: number
  fg3m: number
  fg3a: number
  ftm: number
  fta: number
  plus_minus: number | null
}

export interface GameLogContent {
  player_name: string
  player_id: number
  team_tricode: string
  period_label: string
  rows: GameLogRow[]
  averages: Record<string, number>
}

export interface PostLinkContent {
  post_id: string
  slug: string
  title: string
  subtitle?: string
  /** Extra line for hover previews (Glimpse) when subtitle is empty or too short */
  preview_text?: string
  post_type: PostType
  cover_image_url?: string
  context?: string              // e.g. "This player was on the Team of the Week"
  game_date?: string
  team_tricodes?: string[]
}

export interface TweetEmbedContent {
  tweet_url: string             // full URL: https://x.com/user/status/...
  tweet_id?: string             // numeric status ID (extracted from URL if omitted)
  caption?: string              // editorial label shown above the embed, e.g. "Source:"
  fallback_text?: string        // displayed if the embed fails to load
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

export type FeedFilterType = 'all' | 'favorites' | 'last_night' | PostType

export interface FeedFilters {
  postType: FeedFilterType
  teamTricode?: string
  playerName?: string
  tag?: FeedTag
  dateRange?: { from: string; to: string }
}

/** Single active filter (post type, team, player, or favorites) for feed chip + filtering */
export type ActiveFilterType = 'post_type' | 'team' | 'player' | 'favorites' | 'last_night' | 'feed_scope'

/** `feed_scope` values e.g. all_parent = main-feed "All" (parent post types only). */
export type FeedScopeValue = 'all_parent'

export interface ActiveFilter {
  id: string
  type: ActiveFilterType
  value: string
  label: string
}
