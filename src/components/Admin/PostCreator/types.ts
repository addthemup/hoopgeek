/**
 * PostCreator shared types.
 *
 * Extracted from the PostCreator monolith so generators, editors,
 * and pickers can import without circular deps.
 */

import type { PostType, SectionType, FeedTag } from '../../../types/feed'

// ─── Post type option (step 0 card) ────────────────────────

export type DataSourceMode = 'totn' | 'totw' | 'pow' | 'pom' | 'game' | 'manual'

export interface PostTypeOption {
  value: PostType
  label: string
  description: string
  icon: React.ReactNode
  color: string
  tags: FeedTag[]
  theoretical?: boolean
  dataSourceMode: DataSourceMode
}

// ─── Resolved player (from nba_players) ────────────────────

export interface ResolvedPlayer {
  id: string
  name: string
  team_abbreviation: string | null
  nba_player_id: number | null
  slot: string
  role: 'Starter' | 'Bench'
  fantasy_points: number
  salary: number
  position?: string | null
  jersey_number?: string | null
}

// ─── Game data (from JSON files in /feed/) ─────────────────

export interface PlayByPlayAction {
  personId: number | null
  playerName: string | null
  teamTricode: string | null
  actionType: string
  subType: string | null
  description: string
  mp4: string | null
  period: number
  clock: string
  shotResult: string | null
  isFieldGoal: number
  pointsTotal: number
}

export interface GameData {
  gameId: string
  gameDate: string | null
  teamTricodes: string[]
  playerIds: number[]
  matchup: string
  finalScore: string
  homeTeam: any
  awayTeam: any
  funScore: number | null
  scoreData: any
  story: any
  playerStats: any[]
  playByPlay: PlayByPlayAction[]
  raw: any
}

export interface NbaGame {
  game_id: string
  game_date: string
  home_team_tricode: string
  away_team_tricode: string
  home_team_score: number | null
  away_team_score: number | null
  game_status_text: string | null
}

// ─── Section draft (pre-save) ──────────────────────────────

export interface SectionDraft {
  id: string
  section_type: SectionType
  title: string
  content: any
  player_id: number | null
  team_tricode: string | null
}

// ─── Post draft (full form state) ──────────────────────────

export interface PostDraft {
  post_type: PostType
  title: string
  subtitle: string
  description: string
  slug: string
  cover_image_url: string
  share_image_url: string
  game_id: string
  game_date: string
  team_tricodes: string[]
  player_ids: number[]
  person_id: string
  tags: FeedTag[]
  metadata: Record<string, any>
  sections: SectionDraft[]
}

export const EMPTY_DRAFT: PostDraft = {
  post_type: 'game_recap',
  title: '',
  subtitle: '',
  description: '',
  slug: '',
  cover_image_url: '',
  share_image_url: '',
  game_id: '',
  game_date: '',
  team_tricodes: [],
  player_ids: [],
  person_id: '',
  tags: [],
  metadata: {},
  sections: [],
}

// ─── Box score row (from nba_boxscores table) ──────────────

export interface BoxScoreRow {
  game_id: string
  game_date: string
  matchup: string
  nba_player_id: number
  player_name: string
  team_abbreviation: string
  min: string | number | null
  pts: number | null
  reb: number | null
  ast: number | null
  stl: number | null
  blk: number | null
  tov: number | null
  fgm: number | null
  fga: number | null
  fg_pct: number | null
  fg3m: number | null
  fg3a: number | null
  fg3_pct: number | null
  ftm: number | null
  fta: number | null
  ft_pct: number | null
  plus_minus_points: number | null
  is_starter: boolean | null
  is_home_game: boolean | null
}

// ─── Generator context (passed to each generator fn) ───────

export interface GeneratorContext {
  draft: PostDraft
  resolvedPlayers: ResolvedPlayer[]
  matchedGameData: GameData[]
  awardGameLog?: BoxScoreRow[]
  spotlightPlayerId?: number | null
  spotlightHighlightCount?: number
  recapHighlightCount?: number
  recapPlayerClipCount?: number
  totnPlayerClipCount?: number
  totwPlayerClipCount?: number
  awardHighlightCount?: number
}

export type SectionGenerator = (ctx: GeneratorContext) => Promise<SectionDraft[]>

// ─── Linked post reference (for post_link sections + inline links) ──

export interface LinkedPostRef {
  post_id: string
  slug: string
  title: string
  subtitle?: string | null
  post_type: PostType
  cover_image_url?: string | null
  game_date?: string | null
  team_tricodes?: string[] | null
}
