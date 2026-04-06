/**
 * PostCreator — Multi-step form for creating feed posts (all 12 post types).
 *
 * Step 0: Choose Post Type
 * Step 1: Data Source (contextual per post type)
 *   - TOTN:     Select nba_totn row → resolve players → match game JSONs by date
 *   - TOTW:     Select nba_totw row → resolve players
 *   - POW/POM:  Select award row → resolve player
 *   - Game Recap / Player Spotlight: Pick date → pick game → load game JSON
 *   - Props / Injuries: Manual entry (skip)
 * Step 2: Post Details
 * Step 3: Sections Builder
 * Step 4: Review & Publish
 *
 * Route: /admin/create-post
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Option,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Stack,
  Stepper,
  Step,
  StepIndicator,
  StepButton,
  FormControl,
  FormLabel,
  FormHelperText,
  Modal,
  ModalDialog,
  ModalClose,
  AspectRatio,
  Snackbar,
  Table,
  Sheet,
  Avatar,
  Slider,
} from '@mui/joy'
import {
  ArrowBack,
  ArrowForward,
  SportsSoccer,
  Person,
  EmojiEvents,
  TrendingUp,
  LocalHospital,
  Groups,
  CalendarMonth,
  Star,
  Casino,
  Upload,
  Search,
  Add,
  Delete,
  Save,
  Publish,
  Check,
  Close,
  Image as ImageIcon,
  VideoLibrary,
  TextFields,
  BarChart,
  FormatQuote,
  Collections,
  TableChart,
  SportsBasketball,
  Schedule,
  Article,
  Home,
} from '@mui/icons-material'
import { supabase } from '../utils/supabase'
import { isDateInEST } from '../utils/nbaDateUtils'
import { useAuth } from '../hooks/useAuth'
import { getHighlightClipsForPostType } from '../utils/feedHighlightClips'
import { collectAllPlayerSpotlightPlaysFromGameData } from '../utils/playerSpotlightPlays'
// sortHighlightClipsChronological, calculatePropResult, filterFullGameProps
// moved to generators/ — no longer needed here
import RichTextEditor from '../components/Admin/PostCreator/RichTextEditor'
import PostLinkPicker from '../components/Admin/PostCreator/PostLinkPicker'
import { getSectionGenerator } from '../components/Admin/PostCreator/generators'
import { POST_TYPE_OPTIONS as POST_TYPE_OPTIONS_FROM_CONSTANTS } from '../components/Admin/PostCreator/constants'
import type { LinkedPostRef, GeneratorContext, BoxScoreRow } from '../components/Admin/PostCreator/types'
import type {
  PostType,
  PostStatus,
  SectionType,
  FeedTag,
} from '../types/feed'

// ─── Constants ──────────────────────────────────────────────

const STEPS = ['Post Type', 'Data Source', 'Post Details', 'Sections', 'Review']

const TOTN_SLOTS = ['s1', 's2', 's3', 's4', 's5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] as const

interface PostTypeOption {
  value: PostType
  label: string
  description: string
  icon: React.ReactNode
  color: string
  tags: FeedTag[]
  theoretical?: boolean
  dataSourceMode: 'totn' | 'totw' | 'pow' | 'pom' | 'game' | 'matchup' | 'manual'
}

const POST_TYPE_OPTIONS: PostTypeOption[] = POST_TYPE_OPTIONS_FROM_CONSTANTS

const SECTION_TYPE_OPTIONS: { value: SectionType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'hero', label: 'Hero Image', icon: <ImageIcon />, description: 'Full-width hero banner with optional badge' },
  { value: 'headline', label: 'Headline', icon: <TextFields />, description: 'Section heading with optional subtitle' },
  { value: 'rich_text', label: 'Rich Text', icon: <TextFields />, description: 'Markdown text block for narrative content' },
  { value: 'player_highlight', label: 'Player Highlight', icon: <Person />, description: 'Player card with stats, headshot, and data overlays' },
  { value: 'lineup_card', label: 'Lineup Card', icon: <Groups />, description: 'Starting lineup with fantasy points and stats' },
  { value: 'stat_comparison', label: 'Stat Comparison', icon: <BarChart />, description: 'Side-by-side team stat comparison' },
  { value: 'video_clip', label: 'Video Clip', icon: <VideoLibrary />, description: 'Embedded video with caption and timestamp' },
  { value: 'video_carousel', label: 'Video Carousel', icon: <Collections />, description: 'Instagram-style carousel of MP4 clips (NBA.com) with play metadata' },
  { value: 'chart', label: 'Chart', icon: <BarChart />, description: 'Data visualization — radar, scatter, shot chart, etc.' },
  { value: 'prop_card', label: 'Prop Card', icon: <Casino />, description: 'Player prop prediction or result card' },
  { value: 'injury_card', label: 'Injury Card', icon: <LocalHospital />, description: 'Player injury status card' },
  { value: 'pull_quote', label: 'Pull Quote', icon: <FormatQuote />, description: 'Highlighted quote or stat callout' },
  { value: 'gallery', label: 'Gallery', icon: <Collections />, description: 'Multi-image gallery with captions' },
  { value: 'box_score', label: 'Box Score', icon: <TableChart />, description: 'Full box score table for both teams' },
  { value: 'game_log', label: 'Game Log', icon: <TableChart />, description: 'Player game log table with per-game stats and averages' },
  { value: 'post_link', label: 'Post Link', icon: <SportsBasketball />, description: 'Card linking to another HoopGeek post (related content, cross-reference)' },
  { value: 'tweet_embed', label: 'Tweet Embed', icon: <Article />, description: 'Embed an X (Twitter) post — paste a tweet URL as a source or reference' },
  { value: 'injury_module', label: 'Injury Module', icon: <LocalHospital />, description: 'Frozen snapshot of Injuries module (status chips + progress bars)' },
  { value: 'prop_module', label: 'Prop Module', icon: <Casino />, description: 'Frozen snapshot of Prop Predictions or Prop Results module' },
  { value: 'team_of_night_module', label: 'Team of Night Module', icon: <Groups />, description: 'Frozen snapshot of Team of the Night lineup' },
  { value: 'team_of_week_module', label: 'Team of Week Module', icon: <Groups />, description: 'Frozen snapshot of Team of the Week lineup' },
  { value: 'tank_module', label: 'Tank Module', icon: <TrendingUp />, description: 'Frozen snapshot of Tank tab (standings + draft prospects)' },
]

const TAG_OPTIONS: FeedTag[] = ['highlights', 'awards', 'props', 'injuries', 'recap', 'analysis']

// ─── Shared Types ───────────────────────────────────────────

interface ResolvedPlayer {
  id: string          // nba_players UUID
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

interface NbaGame {
  game_id: string
  game_date: string
  home_team_tricode: string
  away_team_tricode: string
  home_team_score: number | null
  away_team_score: number | null
  game_status_text: string | null
}

interface PlayByPlayAction {
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

interface GameData {
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
  playByPlay: PlayByPlayAction[]  // all plays from playByPlay.allPlays
  raw: any
}

interface SectionDraft {
  id: string
  section_type: SectionType
  title: string
  content: any
  player_id: number | null
  team_tricode: string | null
}

interface PostDraft {
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

const EMPTY_DRAFT: PostDraft = {
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

// ─── Utilities ──────────────────────────────────────────────

function generateSlug(title: string, gameDate?: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
  const datePart = gameDate ? `-${gameDate}` : ''
  const random = Math.random().toString(36).substring(2, 6)
  return `${base}${datePart}-${random}`
}

function generateSourceRef(
  postType: PostType,
  gameId?: string,
  gameDate?: string,
  disambiguator?: string | number | null
): string {
  const base = gameId ? `${postType}:${gameId}` : gameDate ? `${postType}:${gameDate}` : `${postType}:${Date.now()}`
  if (disambiguator != null && disambiguator !== '') {
    const safe = String(disambiguator).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    return `${base}:${safe}`
  }
  return base
}

function extractGameData(json: any): GameData | null {
  const meta = json.gameMetadata || {}
  const home = meta.homeTeam || {}
  const away = meta.awayTeam || {}

  if (!home.abbreviation && !away.abbreviation) return null

  const scoreData = json.score?.[json.gameId] || {}
  const story = json.story || {}

  // ── Build PlayerStats ──
  // Priority: top-level PlayerStats > boxScoreData sub-endpoints > empty
  let rawStats: any[] = json.PlayerStats || []

  if (rawStats.length === 0) {
    // Fallback: merge player identities from boxScoreData sub-endpoints.
    // The traditional endpoint (pts/reb/ast) is often missing, so we merge
    // what IS available: hustle (has points), playerTrack (has assists),
    // defensive (has defensiveRebounds), advanced (has minutes/pace).
    const bsd = json.boxScoreData || {}
    const merged: Record<string, any> = {}

    const endpointOrder = ['advanced', 'hustle', 'playerTrack', 'defensive', 'scoring', 'misc', 'fourFactors', 'usage']
    for (const ep of endpointOrder) {
      const players = bsd[ep]?.PlayerStats || []
      for (const p of players) {
        const pid = p.personId
        if (!pid) continue
        if (!merged[pid]) {
          merged[pid] = {
            personId: pid,
            firstName: p.firstName,
            familyName: p.familyName,
            nameI: p.nameI,
            teamTricode: p.teamTricode,
            teamId: p.teamId,
            position: p.position,
            jerseyNum: p.jerseyNum,
            minutes: p.minutes,
          }
        }
        const m = merged[pid]
        if (!m.minutes && p.minutes) m.minutes = p.minutes
        // hustle endpoint has "points"
        if (ep === 'hustle' && p.points != null) m.points = p.points
        // playerTrack has assists, touches, speed, distance, FG data
        if (ep === 'playerTrack') {
          if (p.assists != null) m.assists = p.assists
          if (p.touches != null) m.touches = p.touches
          if (p.speed != null) m.speed = p.speed
        }
        // defensive has defensiveRebounds, steals, blocks
        if (ep === 'defensive') {
          if (p.defensiveRebounds != null) m.defensiveRebounds = p.defensiveRebounds
          if (p.steals != null) m.steals = p.steals
          if (p.blocks != null) m.blocks = p.blocks
        }
      }
    }
    rawStats = Object.values(merged)
  }

  const playerStats = rawStats.map((p: any) => ({
    ...p,
    pts: p.points ?? p.pts ?? null,
    reb: p.reboundsTotal ?? p.defensiveRebounds ?? p.reb ?? null,
    ast: p.assists ?? p.ast ?? null,
    stl: p.steals ?? p.stl ?? null,
    blk: p.blocks ?? p.blk ?? null,
    min: p.minutes ?? p.min ?? null,
    name: [p.firstName, p.familyName].filter(Boolean).join(' ') || p.name || p.playerName || '',
    playerName: [p.firstName, p.familyName].filter(Boolean).join(' ') || p.playerName || p.name || '',
    fantasyPoints: p.fantasyPoints ?? null,
  }))

  // ── Extract play-by-play actions ──
  const rawPbp = json.playByPlay?.allPlays || json.playByPlay || []
  const playByPlay: PlayByPlayAction[] = (Array.isArray(rawPbp) ? rawPbp : []).map((p: any) => ({
    personId: p.personId ? Number(p.personId) : null,
    playerName: p.playerName || p.playerNameI || null,
    teamTricode: p.teamTricode || null,
    actionType: p.actionType || '',
    subType: p.subType || null,
    description: p.description || '',
    mp4: p.mp4 || null,
    period: p.period || 0,
    clock: p.clock || '',
    shotResult: p.shotResult || null,
    isFieldGoal: p.isFieldGoal || 0,
    pointsTotal: p.pointsTotal || 0,
    eventNum: p.eventNum != null ? Number(p.eventNum) : null,
    actionId: p.actionId != null ? Number(p.actionId) : null,
  }))

  const teamTricodes = [away.abbreviation, home.abbreviation].filter(Boolean)

  // Build playerIds from stats, falling back to unique personIds from PBP
  let playerIds = playerStats
    .map((p: any) => p.personId || p.player_id)
    .filter(Boolean)
    .map(Number)

  if (playerIds.length === 0) {
    const pbpIds = new Set<number>()
    for (const p of playByPlay) { if (p.personId && p.personId > 0) pbpIds.add(p.personId) }
    playerIds = Array.from(pbpIds)
  }

  const matchup = story.matchup || (away.city && home.city ? `${away.city} ${away.name} vs ${home.city} ${home.name}` : '')
  const finalScore = story.final_score || (away.points != null && home.points != null ? `${away.abbreviation} ${away.points} - ${home.abbreviation} ${home.points}` : '')

  return { gameId: json.gameId, gameDate: meta.date ? meta.date.split('T')[0] : null, teamTricodes, playerIds, matchup, finalScore, homeTeam: home, awayTeam: away, funScore: scoreData?.fun_score ?? null, scoreData, story, playerStats, playByPlay, raw: json }
}

function formatSalary(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

/** Resolve player UUIDs from a TOTN/TOTW row via nba_players */
async function resolvePlayersFromRow(row: any, type: 'totn' | 'totw'): Promise<ResolvedPlayer[]> {
  const ids: string[] = []
  for (const s of TOTN_SLOTS) {
    const pid = row[`${s}_player_id`]
    if (pid) ids.push(pid)
  }
  if (ids.length === 0) return []

  const { data: players } = await supabase
    .from('nba_players')
    .select('id, name, team_abbreviation, nba_player_id, position, jersey_number')
    .in('id', ids)

  const pMap: Record<string, any> = {}
  for (const p of players || []) pMap[p.id] = p

  const result: ResolvedPlayer[] = []
  for (const s of TOTN_SLOTS) {
    const pid = row[`${s}_player_id`]
    if (!pid) continue
    const info = pMap[pid] || { name: 'Unknown', team_abbreviation: null, nba_player_id: null, position: null, jersey_number: null }
    const fpKey = type === 'totn' ? `${s}_fantasy_points` : `${s}_avg_fantasy_points`
    result.push({
      id: pid,
      name: info.name,
      team_abbreviation: info.team_abbreviation,
      nba_player_id: info.nba_player_id ? Number(info.nba_player_id) : null,
      slot: s,
      role: s.startsWith('s') ? 'Starter' : 'Bench',
      fantasy_points: Number(row[fpKey]) || 0,
      salary: Number(row[`${s}_salary`]) || 0,
      position: info.position ?? null,
      jersey_number: info.jersey_number != null ? String(info.jersey_number) : null,
    })
  }
  return result
}

/** Resolve the single player from an nba_pow or nba_pom row (player_id FK → nba_players). */
async function resolvePlayerFromAwardRow(row: any, _type: 'pow' | 'pom'): Promise<ResolvedPlayer[]> {
  const playerId = row.player_id
  if (!playerId) return []

  const { data: players } = await supabase
    .from('nba_players')
    .select('id, name, team_abbreviation, nba_player_id')
    .eq('id', playerId)
    .maybeSingle()

  if (!players) return []
  const p = players as any
  return [{
    id: p.id,
    name: p.name || 'Unknown',
    team_abbreviation: p.team_abbreviation ?? null,
    nba_player_id: p.nba_player_id != null ? Number(p.nba_player_id) : null,
    slot: 's1',
    role: 'Starter',
    fantasy_points: 0,
    salary: 0,
  }]
}

/** Fetch games for a given EST date from nba_games (timestamps are UTC). */
async function fetchGamesForDate(gameDate: string): Promise<NbaGame[]> {
  const date = new Date(`${gameDate}T00:00:00Z`)
  const startUTC = new Date(date.getTime() - 6 * 60 * 60 * 1000).toISOString()
  const endUTC = new Date(date.getTime() + 30 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_status_text')
    .gte('game_date', startUTC)
    .lte('game_date', endUTC)
    .not('home_team_tricode', 'is', null)
    .not('away_team_tricode', 'is', null)
    .order('game_date', { ascending: true })
    .order('game_id')
  if (error) { console.error('Failed to fetch games:', error); return [] }

  return ((data || []) as NbaGame[]).filter(
    g => isDateInEST(g.game_date, gameDate) &&
      g.home_team_tricode && g.away_team_tricode &&
      g.home_team_tricode !== g.away_team_tricode
  )
}

/** Fetch games for a date range from nba_games, optionally only for given team tricodes */
async function fetchGamesForDateRange(weekStart: string, weekEnd: string, teamTricodes?: string[]): Promise<NbaGame[]> {
  let query = supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_status_text')
    .gte('game_date', weekStart)
    .lte('game_date', weekEnd)
    .order('game_date', { ascending: true })
    .order('game_id')
  if (teamTricodes && teamTricodes.length > 0) {
    const orConditions = teamTricodes.flatMap(t => [`home_team_tricode.eq.${t}`, `away_team_tricode.eq.${t}`]).join(',')
    query = query.or(orConditions)
  }
  const { data, error } = await query
  if (error) { console.error('Failed to fetch games for range:', error); return [] }
  return (data || []) as NbaGame[]
}

/** Normalize play-by-play API response (videos array) to PlayByPlayAction[]. */
function normalizePlayByPlayFromApi(plays: any[]): PlayByPlayAction[] {
  if (!Array.isArray(plays)) return []
  return plays.map((p: any) => ({
    personId: p.personId != null ? Number(p.personId) : null,
    playerName: p.playerName || p.playerNameI || null,
    teamTricode: p.teamTricode || null,
    actionType: p.actionType || '',
    subType: p.subType ?? null,
    description: p.description || '',
    mp4: p.mp4 || null,
    period: p.period || 0,
    clock: p.clock || '',
    shotResult: p.shotResult ?? null,
    isFieldGoal: p.isFieldGoal ?? 0,
    pointsTotal: p.pointsTotal ?? 0,
  }))
}

/** Try to load a game JSON from local dev server (`/api/local-feed/{gameId}.json`). Uses monolithic `scripts/feed/{gameId}.json` when present; falls back to `play_by_play/` only if root is missing or has no MP4 URLs. */
async function loadLocalGameJson(gameId: string): Promise<GameData | null> {
  try {
    const res = await fetch(`/api/local-feed/${gameId}.json`)
    if (res.ok) {
      const json = await res.json()
      const data = extractGameData(json)
      const hasMp4 = data?.playByPlay?.some((p: any) => p.mp4)
      if (data && hasMp4) return data
      // Root exists but no MP4s — try play-by-play endpoint and merge
      const pbpRes = await fetch(`/api/local-feed/play-by-play/${gameId}.json`)
      if (pbpRes.ok) {
        const pbpJson = await pbpRes.json()
        const allPlays = pbpJson.playByPlay?.allPlays ?? pbpJson.playByPlay ?? []
        const playByPlay = normalizePlayByPlayFromApi(Array.isArray(allPlays) ? allPlays : [])
        if (playByPlay.length > 0 && playByPlay.some((p: any) => p.mp4)) {
          if (data) return { ...data, playByPlay }
          const teamTricodes = [...new Set(playByPlay.map((p: any) => p.teamTricode).filter(Boolean))]
          return {
            gameId,
            gameDate: pbpJson.date ? pbpJson.date.split('T')[0] : null,
            teamTricodes,
            playerIds: [...new Set(playByPlay.map((p: any) => p.personId).filter(Boolean))] as number[],
            matchup: pbpJson.matchup || '',
            finalScore: '',
            homeTeam: { abbreviation: teamTricodes[0] },
            awayTeam: { abbreviation: teamTricodes[1] || teamTricodes[0] },
            funScore: null,
            scoreData: {},
            story: {},
            playerStats: [],
            playByPlay,
            raw: {},
          }
        }
      }
      return data
    }
    // 404 or other — try legacy play_by_play/ file only (no root JSON)
    const pbpRes = await fetch(`/api/local-feed/play-by-play/${gameId}.json`)
    if (!pbpRes.ok) return null
    const pbpJson = await pbpRes.json()
    const allPlays = pbpJson.playByPlay?.allPlays ?? pbpJson.playByPlay ?? []
    const playByPlay = normalizePlayByPlayFromApi(Array.isArray(allPlays) ? allPlays : [])
    if (playByPlay.length === 0 || !playByPlay.some((p: any) => p.mp4)) return null
    const teamTricodes = [...new Set(playByPlay.map((p: any) => p.teamTricode).filter(Boolean))]
    return {
      gameId: pbpJson.gameId || gameId,
      gameDate: pbpJson.date ? pbpJson.date.split('T')[0] : null,
      teamTricodes,
      playerIds: [...new Set(playByPlay.map((p: any) => p.personId).filter(Boolean))] as number[],
      matchup: pbpJson.matchup || '',
      finalScore: '',
      homeTeam: { abbreviation: teamTricodes[0] },
      awayTeam: { abbreviation: teamTricodes[1] || teamTricodes[0] },
      funScore: null,
      scoreData: {},
      story: {},
      playerStats: [],
      playByPlay,
      raw: {},
    }
  } catch {
    return null
  }
}

/**
 * Scan for games a player participated in during a date range.
 * 1. Query nba_games for the team's games in the period
 * 2. Load each game JSON from the local dev server
 * 3. Filter to games where the player actually has plays/stats
 */
async function scanGamesForPlayer(
  teamTricode: string,
  playerId: number,
  startDate: string,
  endDate: string,
): Promise<{ games: NbaGame[]; gameData: GameData[] }> {
  const games = await fetchGamesForDateRange(startDate, endDate, [teamTricode])
  if (games.length === 0) return { games: [], gameData: [] }

  const loaded: GameData[] = []
  await Promise.all(
    games.map(async (g) => {
      const data = await loadLocalGameJson(g.game_id)
      if (!data) return
      const hasPlayer = data.playerIds.includes(playerId) ||
        data.playByPlay.some(p => p.personId === playerId)
      if (hasPlayer) loaded.push(data)
    })
  )
  // Sort chronologically
  loaded.sort((a, b) => (a.gameDate ?? '').localeCompare(b.gameDate ?? ''))
  return { games, gameData: loaded }
}

/**
 * Load local JSON game files directly by game_id array (bypasses nba_games table).
 * Filters to games where the given player has play-by-play actions.
 */
async function loadGameDataByIds(
  gameIds: string[],
  playerId: number,
): Promise<GameData[]> {
  if (gameIds.length === 0) return []
  const results = await Promise.all(
    gameIds.map(async (gid) => {
      const data = await loadLocalGameJson(gid)
      if (!data) return null
      const hasPlayer = data.playerIds.includes(playerId) ||
        data.playByPlay.some(p => p.personId === playerId)
      return hasPlayer ? data : null
    })
  )
  return results.filter((d): d is GameData => d !== null)
    .sort((a, b) => (a.gameDate ?? '').localeCompare(b.gameDate ?? ''))
}

/** Fetch a player's game log from nba_boxscores for a date range. */
async function fetchPlayerGameLog(
  nbaPlayerId: number,
  startDate: string,
  endDate: string,
): Promise<BoxScoreRow[]> {
  const { data, error } = await supabase
    .from('nba_boxscores')
    .select('game_id, game_date, matchup, nba_player_id, player_name, team_abbreviation, min, pts, reb, ast, stl, blk, tov, fgm, fga, fg_pct, fg3m, fg3a, fg3_pct, ftm, fta, ft_pct, plus_minus_points, is_starter, is_home_game')
    .eq('nba_player_id', nbaPlayerId)
    .gte('game_date', startDate)
    .lte('game_date', endDate)
    .order('game_date', { ascending: true })
  if (error) { console.error('Failed to fetch player game log:', error); return [] }
  return (data || []) as BoxScoreRow[]
}

/** Build a short feed-card description from game log averages. */
function buildAwardDescription(
  playerName: string,
  teamTricode: string,
  log: BoxScoreRow[],
  mode: 'pow' | 'pom',
  periodLabel: string,
): string {
  if (log.length === 0) return `${playerName} (${teamTricode}) earned ${mode === 'pow' ? 'Player of the Week' : 'Player of the Month'} honors for ${periodLabel}.`

  const gp = log.length
  const sum = log.reduce((a, g) => ({
    pts: a.pts + (g.pts ?? 0), reb: a.reb + (g.reb ?? 0), ast: a.ast + (g.ast ?? 0),
    fgm: a.fgm + (g.fgm ?? 0), fga: a.fga + (g.fga ?? 0),
    fg3m: a.fg3m + (g.fg3m ?? 0), fg3a: a.fg3a + (g.fg3a ?? 0),
  }), { pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0 })

  const ppg = (sum.pts / gp).toFixed(1)
  const rpg = (sum.reb / gp).toFixed(1)
  const apg = (sum.ast / gp).toFixed(1)
  const fgPct = sum.fga > 0 ? (sum.fgm / sum.fga * 100).toFixed(1) : '0.0'
  const fg3Pct = sum.fg3a > 0 ? (sum.fg3m / sum.fg3a * 100).toFixed(1) : '0.0'

  return `${playerName} averaged ${ppg} PPG, ${rpg} RPG, ${apg} APG on ${fgPct}% FG and ${fg3Pct}% from 3 across ${gp} game${gp !== 1 ? 's' : ''} in ${periodLabel}.`
}

/** NBA CDN high-res player headshot URL. */
function getNbaPlayerImageUrl(nbaPlayerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaPlayerId}.png`
}

// ─── Component ──────────────────────────────────────────────

export interface PostCreatorProps {
  /** When set, back button and "save as draft" redirect here instead of /feed and /admin/create-post */
  returnPath?: string
}

export default function PostCreator({ returnPath }: PostCreatorProps = {}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const backTarget = returnPath ?? '/feed'
  const draftSaveTarget = returnPath ?? '/admin/create-post'
  const [activeStep, setActiveStep] = useState(0)
  const [draft, setDraft] = useState<PostDraft>({ ...EMPTY_DRAFT })
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color: 'success' | 'danger' | 'warning' }>({ open: false, message: '', color: 'success' })

  // ─── Data source state ─────────────────────────────────────
  // TOTN / TOTW rows
  const [totnRows, setTotnRows] = useState<any[]>([])
  const [totwRows, setTotwRows] = useState<any[]>([])
  const [powRows, setPowRows] = useState<any[]>([])
  const [pomRows, setPomRows] = useState<any[]>([])
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [resolvedPlayers, setResolvedPlayers] = useState<ResolvedPlayer[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  // Game picker (for date-based selection)
  const [selectedDate, setSelectedDate] = useState('')
  const [gamesForDate, setGamesForDate] = useState<NbaGame[]>([])
  const [loadingGames, setLoadingGames] = useState(false)
  // Feed status per game (has JSON file, has MP4 URLs) from /api/local-feed/by-date
  const [feedGamesForDate, setFeedGamesForDate] = useState<Array<{ gameId: string; hasMp4: boolean }>>([])

  // Matched game JSONs (loaded from local dev server for the selected date)
  const [matchedGameData, setMatchedGameData] = useState<GameData[]>([])
  const [loadingGameData, setLoadingGameData] = useState(false)

  // Player Spotlight: single player + highlight count (only when post_type is player_spotlight)
  const [spotlightPlayerId, setSpotlightPlayerId] = useState<number | null>(null)
  const [spotlightHighlightCount, setSpotlightHighlightCount] = useState(5)
  // Macro: generate player spotlight for all players in the game at once
  const [spotlightAllPlayers, setSpotlightAllPlayers] = useState(false)
  const [macroDrafts, setMacroDrafts] = useState<PostDraft[]>([])
  const [macroGenerating, setMacroGenerating] = useState(false)
  // Macro: generate prop results for all games on the selected date
  const [propResultsAllGames, setPropResultsAllGames] = useState(false)
  // Macro: generate injury report for all games on the selected date
  const [injuryReportAllGames, setInjuryReportAllGames] = useState(false)
  // Macro: generate prop prediction for all games on the selected date
  const [propPredictionAllGames, setPropPredictionAllGames] = useState(false)

  // Game Recap: number of highlight clips to include (algorithm picks best plays; admin chooses count)
  const [recapHighlightCount, setRecapHighlightCount] = useState(8)
  // Game Recap: clips per player for the top-5 player cards (each card gets its own slideshow)
  const [recapPlayerClipCount, setRecapPlayerClipCount] = useState(3)

  // TOTN / TOTW: clips per player for lineup + player_highlight sections (games that night / week)
  const [totnPlayerClipCount, setTotnPlayerClipCount] = useState(3)
  const [totwPlayerClipCount, setTotwPlayerClipCount] = useState(3)

  // POW / POM: game log from nba_boxscores
  const [awardGameLog, setAwardGameLog] = useState<BoxScoreRow[]>([])
  const [awardHighlightCount, setAwardHighlightCount] = useState(3)
  const [loadingAwardGames, setLoadingAwardGames] = useState(false)

  // TOTN: boxscores from nba_boxscores + per-game feed/mp4 status (for table)
  const [totnBoxscores, setTotnBoxscores] = useState<Array<{ game_id: string; nba_player_id: number; player_name?: string; pts?: number; reb?: number; ast?: number; stl?: number; blk?: number; min?: number | string }>>([])
  const [totnGamesFeedStatus, setTotnGamesFeedStatus] = useState<Array<{ gameId: string; inFeed: boolean; hasMp4: boolean }>>([])

  // Section editor state
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null)

  // Draft post type: auto-fill Step 2 once when entering (title, subtitle, description, slug from current Tank snapshot)
  const draftStep2AutoFilledRef = useRef(false)

  const currentTypeOption = POST_TYPE_OPTIONS.find(o => o.value === draft.post_type)!
  const dataSourceMode = currentTypeOption.dataSourceMode

  // ─── Auto-fill Step 2 for Draft post type (current Tank snapshot) ─
  useEffect(() => {
    if (activeStep !== 2 || draft.post_type !== 'draft' || draftStep2AutoFilledRef.current) return
    draftStep2AutoFilledRef.current = true
    const snapshotDate = new Date().toISOString().slice(0, 10)
    const d = new Date()
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const season = month >= 10 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`
    const title = `Draft Aggregate - ${snapshotDate}`
    const subtitle = `${season} · Snapshot as of ${snapshotDate}`
    const descriptionBase = `Current tank standings (worst-first) and draft prospect rankings as of ${snapshotDate}. Frozen snapshot from the Standings Tank module.`
    const slug = generateSlug(title, snapshotDate)

    // Set base fields immediately so form isn't empty
    setDraft(prev => ({
      ...prev,
      title,
      subtitle,
      description: descriptionBase,
      slug,
      game_date: snapshotDate,
    }))

    // Optionally enrich description with standings count (non-blocking)
    supabase
      .from('nba_standings')
      .select('team_id', { count: 'exact', head: true })
      .eq('season', season)
      .then(({ count }) => {
        const teamCount = typeof count === 'number' ? count : 0
        if (teamCount > 0) {
          const desc = `Lottery order (top 14 of ${teamCount} teams) and draft prospect rankings as of ${snapshotDate}. Frozen snapshot from the Standings Tank module.`
          setDraft(prev => ({ ...prev, description: desc }))
        }
      })
      .catch(() => {})
  }, [activeStep, draft.post_type])

  // ─── Fetch TOTN rows ──────────────────────────────────────

  const fetchTotnRows = useCallback(async () => {
    setLoadingRows(true)
    try {
      const { data, error } = await supabase
        .from('nba_totn')
        .select('*')
        .order('game_date', { ascending: false })
        .limit(30)
      if (error) throw error
      setTotnRows(data || [])
    } catch (err: any) {
      console.error('Failed to fetch TOTN rows:', err)
      setSnackbar({ open: true, message: `Failed to load TOTN data: ${err.message}`, color: 'danger' })
    } finally {
      setLoadingRows(false)
    }
  }, [])

  const fetchTotwRows = useCallback(async () => {
    setLoadingRows(true)
    try {
      const { data, error } = await supabase
        .from('nba_totw')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(20)
      if (error) throw error
      setTotwRows(data || [])
    } catch (err: any) {
      console.error('Failed to fetch TOTW rows:', err)
      setSnackbar({ open: true, message: `Failed to load TOTW data: ${err.message}`, color: 'danger' })
    } finally {
      setLoadingRows(false)
    }
  }, [])

  const fetchPowRows = useCallback(async () => {
    setLoadingRows(true)
    try {
      const { data, error } = await supabase
        .from('nba_pow')
        .select('*')
        .order('week_start_date', { ascending: false })
        .limit(30)
      if (error) throw error
      setPowRows(data || [])
    } catch (err: any) {
      console.error('Failed to fetch POW rows:', err)
      setSnackbar({ open: true, message: `Failed to load POW data: ${err.message}`, color: 'danger' })
    } finally {
      setLoadingRows(false)
    }
  }, [])

  const fetchPomRows = useCallback(async () => {
    setLoadingRows(true)
    try {
      const { data, error } = await supabase
        .from('nba_pom')
        .select('*')
        .order('award_year', { ascending: false })
        .order('award_month', { ascending: false })
        .limit(30)
      if (error) throw error
      setPomRows(data || [])
    } catch (err: any) {
      console.error('Failed to fetch POM rows:', err)
      setSnackbar({ open: true, message: `Failed to load POM data: ${err.message}`, color: 'danger' })
    } finally {
      setLoadingRows(false)
    }
  }, [])

  // Load data when entering step 1 based on mode
  useEffect(() => {
    if (activeStep !== 1) return
    if (dataSourceMode === 'totn' && totnRows.length === 0) fetchTotnRows()
    if (dataSourceMode === 'totw' && totwRows.length === 0) fetchTotwRows()
    if (dataSourceMode === 'pow' && powRows.length === 0) fetchPowRows()
    if (dataSourceMode === 'pom' && pomRows.length === 0) fetchPomRows()
  }, [activeStep, dataSourceMode, totnRows.length, totwRows.length, powRows.length, pomRows.length, fetchTotnRows, fetchTotwRows, fetchPowRows, fetchPomRows])

  // ─── Select a TOTN/TOTW row ─────────────────────────────

  const selectTotnRow = useCallback(async (row: any) => {
    setSelectedRowId(row.id)
    setLoadingPlayers(true)
    try {
      const players = await resolvePlayersFromRow(row, 'totn')
      setResolvedPlayers(players)

      // Collect unique team tricodes from players
      const teamSet = new Set<string>()
      for (const p of players) {
        if (p.team_abbreviation) teamSet.add(p.team_abbreviation)
      }
      const teamTricodes = [...teamSet]
      const nbaPlayerIds = players.map(p => p.nba_player_id).filter(Boolean) as number[]

      // Auto-populate draft
      const dateStr = row.game_date
      const totalFP = Number(row.total_fantasy_points) || 0
      setDraft(prev => ({
        ...prev,
        game_date: dateStr,
        team_tricodes: teamTricodes,
        player_ids: nbaPlayerIds,
        title: prev.title || `Team of the Night — ${dateStr}`,
        subtitle: prev.subtitle || `${totalFP.toFixed(1)} Total Fantasy Points`,
        slug: prev.slug || generateSlug(`team-of-the-night-${dateStr}`),
        metadata: {
          ...prev.metadata,
          totn_row: row,
          totn_players: players,
          total_salary: row.total_salary,
          salary_cap: row.salary_cap,
          total_fantasy_points: totalFP,
        },
      }))

      // ── Load game files for this date ──
      // 1) By-date scan (Vite plugin) lists games that have local JSONs with hasStats/hasMp4.
      // 2) Always also fetch nba_games for this date and merge, so we try loading every game
      //    that night (highlights only appear when local play-by-play JSONs exist).
      setLoadingGameData(true)
      let gameIdsByDate: string[] = []
      try {
        const dateRes = await fetch(`/api/local-feed/by-date/${dateStr}`)
        if (dateRes.ok) {
          const dateData = await dateRes.json()
          gameIdsByDate = (dateData.games || [])
            .filter((g: any) => g.hasStats || g.hasMp4)
            .map((g: any) => g.gameId)
        }
      } catch { /* ignore */ }

      const gamesFromDb = await fetchGamesForDate(dateStr)
      setGamesForDate(gamesFromDb)
      const gameIdsFromDb = gamesFromDb.map(g => g.game_id)
      const gameIds = [...new Set([...gameIdsByDate, ...gameIdsFromDb])]

      // Load game JSONs via /api/local-feed/ (monolithic scripts/feed/{gameId}.json; legacy play_by_play/ when needed)
      const gameDataResults = await Promise.all(
        gameIds.map(id => loadLocalGameJson(id))
      )
      const loaded = gameDataResults.filter(Boolean) as GameData[]

      // Include games where any TOTN player appears in playByPlay (mp4 clips) or in playerStats
      const nbaIdSet = new Set(nbaPlayerIds)
      const relevantGames = loaded.filter(gd => {
        const hasInStats = gd.playerStats?.some((ps: any) => nbaIdSet.has(Number(ps.personId)))
        const hasInPbp = (gd.playByPlay || []).some((p: any) => p.personId != null && nbaIdSet.has(Number(p.personId)))
        return hasInStats || hasInPbp
      })
      setMatchedGameData(relevantGames)

      // Per-game: is it in /feed/? does it have mp4 in playByPlay?
      setTotnGamesFeedStatus(gameIds.map(gameId => {
        const gd = loaded.find(g => g.gameId === gameId)
        return {
          gameId,
          inFeed: !!gd,
          hasMp4: !!(gd?.playByPlay?.some((p: any) => p.mp4)),
        }
      }))

      // nba_boxscores for these games and our players (for table)
      if (gameIds.length > 0 && nbaPlayerIds.length > 0) {
        const { data: boxData, error: boxErr } = await supabase
          .from('nba_boxscores')
          .select('game_id, nba_player_id, player_name, pts, reb, ast, stl, blk, min')
          .in('game_id', gameIds)
          .in('nba_player_id', nbaPlayerIds)
        if (!boxErr) setTotnBoxscores((boxData || []) as Array<{ game_id: string; nba_player_id: number; player_name?: string; pts?: number; reb?: number; ast?: number; stl?: number; blk?: number; min?: number | string }>)
        else setTotnBoxscores([])
      } else {
        setTotnBoxscores([])
      }

      // Per-player: games and total MP4 plays from play_by_play for the night
      for (const p of players) {
        const pid = p.nba_player_id
        if (pid == null) {
          console.log(`[TOTN] ${p.name} (${p.team_abbreviation ?? '?'}): 0 plays (no nba_player_id)`)
          continue
        }
        const gamesWithPlayer = relevantGames.filter(gd =>
          (gd.playerStats?.some((ps: any) => Number(ps.personId) === pid)) ||
          (gd.playByPlay || []).some((pl: any) => pl.personId === pid)
        )
        const totalClips = relevantGames.reduce((n, gd) => n + (gd.playByPlay || []).filter((pl: any) => pl.personId === pid && pl.mp4).length, 0)
        console.log(`[TOTN] ${p.name} (${p.team_abbreviation ?? '?'}): ${totalClips} MP4 plays in ${gamesWithPlayer.length} games`)
      }

      const totalPlays = relevantGames.reduce((n, gd) => n + (gd.playByPlay?.length || 0), 0)
      const noHighlights = relevantGames.length === 0
      setSnackbar({
        open: true,
        message: noHighlights
          ? `TOTN ${dateStr}: ${players.length} players loaded, but no game play-by-play data found for that night. Run the play-by-play scraper for ${dateStr} so highlight slideshows can be added.`
          : `TOTN ${dateStr}: ${players.length} players, ${relevantGames.length} games with play-by-play (${totalPlays} total plays) — highlight slideshows will be included.`,
        color: noHighlights ? 'warning' : 'success',
      })
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
      setTotnBoxscores([])
      setTotnGamesFeedStatus([])
    } finally {
      setLoadingPlayers(false)
      setLoadingGameData(false)
    }
  }, [])

  const selectTotwRow = useCallback(async (row: any) => {
    setSelectedRowId(row.id)
    setLoadingPlayers(true)
    setLoadingGameData(true)
    try {
      const players = await resolvePlayersFromRow(row, 'totw')
      setResolvedPlayers(players)

      const teamSet = new Set<string>()
      for (const p of players) {
        if (p.team_abbreviation) teamSet.add(p.team_abbreviation)
      }
      const teamTricodes = [...teamSet]
      const nbaPlayerIds = players.map(p => p.nba_player_id).filter(Boolean) as number[]
      const totalFP = Number(row.total_avg_fantasy_points) || 0

      setDraft(prev => ({
        ...prev,
        game_date: row.week_start,
        team_tricodes: teamTricodes,
        player_ids: nbaPlayerIds,
        title: prev.title || `Team of the Week — Week ${row.week_number} (${row.week_start} → ${row.week_end})`,
        subtitle: prev.subtitle || `${totalFP.toFixed(1)} Avg Fantasy Points`,
        slug: prev.slug || generateSlug(`team-of-the-week-${row.week_start}`),
        metadata: {
          ...prev.metadata,
          totw_row: row,
          totw_players: players,
          week_number: row.week_number,
          week_start: row.week_start,
          week_end: row.week_end,
          total_salary: row.total_salary,
          salary_cap: row.salary_cap,
          total_avg_fantasy_points: totalFP,
        },
      }))

      // Fetch nba_games for the week that involve any of the players' teams
      const weekGames = await fetchGamesForDateRange(row.week_start, row.week_end, teamTricodes)
      const gameIds = weekGames.map(g => g.game_id)
      console.log(`[TOTW] Week ${row.week_start} → ${row.week_end}: ${weekGames.length} games in nba_games for teams ${teamTricodes.join(', ')}`)

      // Load game JSONs via /api/local-feed/ (monolithic scripts/feed/{gameId}.json; legacy play_by_play/ when needed)
      const gameDataResults = await Promise.all(gameIds.map(id => loadLocalGameJson(id)))
      const loaded = gameDataResults.filter(Boolean) as GameData[]

      // Include games where any TOTW player appears in playByPlay (mp4 clips) or in playerStats
      const nbaIdSet = new Set(nbaPlayerIds)
      const relevantGames = loaded.filter(gd => {
        const hasInStats = gd.playerStats?.some((ps: any) => nbaIdSet.has(Number(ps.personId)))
        const hasInPbp = (gd.playByPlay || []).some((p: any) => p.personId != null && nbaIdSet.has(Number(p.personId)))
        return hasInStats || hasInPbp
      })
      setMatchedGameData(relevantGames)

      // Per-player: games and total MP4 plays from play_by_play for the week
      for (const p of players) {
        const pid = p.nba_player_id
        if (pid == null) {
          console.log(`[TOTW] ${p.name} (${p.team_abbreviation ?? '?'}): 0 plays (no nba_player_id)`)
          continue
        }
        const gamesWithPlayer = relevantGames.filter(gd =>
          (gd.playerStats?.some((ps: any) => Number(ps.personId) === pid)) ||
          (gd.playByPlay || []).some((pl: any) => pl.personId === pid)
        )
        const totalClips = relevantGames.reduce((n, gd) => n + (gd.playByPlay || []).filter((pl: any) => pl.personId === pid && pl.mp4).length, 0)
        console.log(`[TOTW] ${p.name} (${p.team_abbreviation ?? '?'}): ${totalClips} MP4 plays in ${gamesWithPlayer.length} games`)
      }

      setSnackbar({
        open: true,
        message: `TOTW Week ${row.week_number}: ${players.length} players, ${relevantGames.length} games with play-by-play (${relevantGames.reduce((n, gd) => n + (gd.playByPlay?.length || 0), 0)} total plays)`,
        color: 'success',
      })
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
    } finally {
      setLoadingPlayers(false)
      setLoadingGameData(false)
    }
  }, [])

  const selectPowRow = useCallback(async (row: any) => {
    setSelectedRowId(row.id)
    setLoadingPlayers(true)
    setAwardGameLog([])
    setMatchedGameData([])
    try {
      const players = await resolvePlayerFromAwardRow(row, 'pow')
      setResolvedPlayers(players)
      const p = players[0]
      const nbaPlayerIds = p ? [p.nba_player_id].filter(Boolean) as number[] : []
      const teamTricodes = p?.team_abbreviation ? [p.team_abbreviation] : []
      const periodLabel = `Week of ${row.week_start_date}`

      setDraft(prev => ({
        ...prev,
        game_date: row.week_start_date,
        team_tricodes: teamTricodes,
        player_ids: nbaPlayerIds,
        person_id: p?.nba_player_id ? String(p.nba_player_id) : prev.person_id,
        cover_image_url: prev.cover_image_url || (p?.nba_player_id ? getNbaPlayerImageUrl(p.nba_player_id) : ''),
        title: prev.title || `Player of the Week — ${row.week_start_date}`,
        subtitle: prev.subtitle || (p ? `${p.name}${p.team_abbreviation ? ` (${p.team_abbreviation})` : ''}` : ''),
        slug: prev.slug || generateSlug(`player-of-the-week-${row.week_start_date}`),
        metadata: {
          ...prev.metadata,
          pow_row: row,
          pow_player: p,
        },
      }))
      setSnackbar({ open: true, message: p ? `Loaded POW: ${p.name}` : 'Loaded POW row', color: 'success' })

      if (p?.nba_player_id && p.team_abbreviation) {
        setLoadingAwardGames(true)
        setLoadingGameData(true)
        try {
          const weekStart = row.week_start_date
          const end = new Date(weekStart)
          end.setDate(end.getDate() + 6)
          const weekEnd = end.toISOString().split('T')[0]

          const log = await fetchPlayerGameLog(p.nba_player_id, weekStart, weekEnd)
          setAwardGameLog(log)
          if (log.length > 0) {
            const desc = buildAwardDescription(p.name, p.team_abbreviation || '?', log, 'pow', periodLabel)
            setDraft(prev => ({ ...prev, description: prev.description || desc }))
          }

          // Same process as TOTW: find games in period from nba_games, load via local-feed (monolithic JSON), filter by player
          const weekGames = await fetchGamesForDateRange(weekStart, weekEnd, teamTricodes)
          const gameIds = weekGames.map(g => g.game_id)
          const gameDataResults = await Promise.all(gameIds.map(id => loadLocalGameJson(id)))
          const loaded = gameDataResults.filter(Boolean) as GameData[]
          const relevantGames = loaded.filter(gd =>
            (gd.playerStats?.some((ps: any) => Number(ps.personId) === p.nba_player_id)) ||
            (gd.playByPlay || []).some((pl: any) => pl.personId === p.nba_player_id)
          )
          setMatchedGameData(relevantGames)

          const clipCount = relevantGames.reduce((n, gd) => n + (gd.playByPlay || []).filter((pl: any) => pl.personId === p.nba_player_id && pl.mp4).length, 0)
          setSnackbar({ open: true, message: log.length > 0 ? `Found ${log.length} game${log.length !== 1 ? 's' : ''}, ${relevantGames.length} with play-by-play, ${clipCount} highlight clips for ${p.name}` : (relevantGames.length > 0 ? `${relevantGames.length} games with play-by-play, ${clipCount} clips` : `No games found for ${p.name} that week`), color: relevantGames.length > 0 ? 'success' : 'warning' })
        } catch (err: any) {
          console.error('Failed to fetch award game log:', err)
        } finally {
          setLoadingAwardGames(false)
          setLoadingGameData(false)
        }
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
    } finally {
      setLoadingPlayers(false)
    }
  }, [])

  const selectPomRow = useCallback(async (row: any) => {
    setSelectedRowId(row.id)
    setLoadingPlayers(true)
    setAwardGameLog([])
    setMatchedGameData([])
    try {
      const players = await resolvePlayerFromAwardRow(row, 'pom')
      setResolvedPlayers(players)
      const p = players[0]
      const nbaPlayerIds = p ? [p.nba_player_id].filter(Boolean) as number[] : []
      const teamTricodes = p?.team_abbreviation ? [p.team_abbreviation] : []
      const monthName = new Date(Number(row.award_year), Number(row.award_month) - 1).toLocaleString('default', { month: 'long' })
      const periodLabel = `${monthName} ${row.award_year}`

      setDraft(prev => ({
        ...prev,
        game_date: `${row.award_year}-${String(row.award_month).padStart(2, '0')}-01`,
        team_tricodes: teamTricodes,
        player_ids: nbaPlayerIds,
        person_id: p?.nba_player_id ? String(p.nba_player_id) : prev.person_id,
        cover_image_url: prev.cover_image_url || (p?.nba_player_id ? getNbaPlayerImageUrl(p.nba_player_id) : ''),
        title: prev.title || `Player of the Month — ${periodLabel}`,
        subtitle: prev.subtitle || (p ? `${p.name}${p.team_abbreviation ? ` (${p.team_abbreviation})` : ''}` : ''),
        slug: prev.slug || generateSlug(`player-of-the-month-${row.award_year}-${String(row.award_month).padStart(2, '0')}`),
        metadata: {
          ...prev.metadata,
          pom_row: row,
          pom_player: p,
        },
      }))
      setSnackbar({ open: true, message: p ? `Loaded POM: ${p.name}` : 'Loaded POM row', color: 'success' })

      if (p?.nba_player_id && p.team_abbreviation) {
        setLoadingAwardGames(true)
        setLoadingGameData(true)
        try {
          const year = Number(row.award_year)
          const month = Number(row.award_month)
          const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
          const lastDay = new Date(year, month, 0).getDate()
          const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

          const log = await fetchPlayerGameLog(p.nba_player_id, monthStart, monthEnd)
          setAwardGameLog(log)
          if (log.length > 0) {
            const desc = buildAwardDescription(p.name, p.team_abbreviation || '?', log, 'pom', periodLabel)
            setDraft(prev => ({ ...prev, description: prev.description || desc }))
          }

          // Same process as TOTW: find games in period from nba_games, load via local-feed (monolithic JSON), filter by player
          const monthGames = await fetchGamesForDateRange(monthStart, monthEnd, teamTricodes)
          const gameIds = monthGames.map(g => g.game_id)
          const gameDataResults = await Promise.all(gameIds.map(id => loadLocalGameJson(id)))
          const loaded = gameDataResults.filter(Boolean) as GameData[]
          const relevantGames = loaded.filter(gd =>
            (gd.playerStats?.some((ps: any) => Number(ps.personId) === p.nba_player_id)) ||
            (gd.playByPlay || []).some((pl: any) => pl.personId === p.nba_player_id)
          )
          setMatchedGameData(relevantGames)

          const clipCount = relevantGames.reduce((n, gd) => n + (gd.playByPlay || []).filter((pl: any) => pl.personId === p.nba_player_id && pl.mp4).length, 0)
          setSnackbar({ open: true, message: log.length > 0 ? `Found ${log.length} game${log.length !== 1 ? 's' : ''}, ${relevantGames.length} with play-by-play, ${clipCount} highlight clips for ${p.name}` : (relevantGames.length > 0 ? `${relevantGames.length} games with play-by-play, ${clipCount} clips` : `No games found for ${p.name} that month`), color: relevantGames.length > 0 ? 'success' : 'warning' })
        } catch (err: any) {
          console.error('Failed to fetch award game log:', err)
        } finally {
          setLoadingAwardGames(false)
          setLoadingGameData(false)
        }
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
    } finally {
      setLoadingPlayers(false)
    }
  }, [])

  // ─── Game date picker (for game_recap / player_spotlight) ──

  const onDateSelected = useCallback(async (date: string) => {
    setSelectedDate(date)
    setMacroDrafts([])
    setLoadingGames(true)
    setFeedGamesForDate([])
    try {
      const games = await fetchGamesForDate(date)
      setGamesForDate(games)
      // Fetch which games have JSON files and MP4 URLs (by-date API)
      try {
        const dateRes = await fetch(`/api/local-feed/by-date/${date}`)
        if (dateRes.ok) {
          const dateData = await dateRes.json()
          setFeedGamesForDate((dateData.games || []).map((g: any) => ({
            gameId: g.gameId,
            hasMp4: !!g.hasMp4,
          })))
        }
      } catch { /* non-blocking */ }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
    } finally {
      setLoadingGames(false)
    }
  }, [])

  // Injury report (matchup): default date picker to today (browser local) and load today's games when entering step 1
  useEffect(() => {
    if (activeStep !== 1 || dataSourceMode !== 'matchup' || draft.post_type !== 'injury_report' || selectedDate !== '') return
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    onDateSelected(today)
  }, [activeStep, dataSourceMode, draft.post_type, selectedDate, onDateSelected])

  // Prop results (matchup): default date picker to yesterday (browser local) and load yesterday's games when entering step 1
  useEffect(() => {
    if (activeStep !== 1 || dataSourceMode !== 'matchup' || draft.post_type !== 'prop_results' || selectedDate !== '') return
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    onDateSelected(yesterday)
  }, [activeStep, dataSourceMode, draft.post_type, selectedDate, onDateSelected])

  // Prop prediction (matchup): default date picker to today and load today's games when entering step 1 (same as drawer)
  useEffect(() => {
    if (activeStep !== 1 || dataSourceMode !== 'matchup' || draft.post_type !== 'prop_prediction' || selectedDate !== '') return
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    onDateSelected(today)
  }, [activeStep, dataSourceMode, draft.post_type, selectedDate, onDateSelected])

  const selectGame = useCallback(async (game: NbaGame) => {
    setSpotlightPlayerId(null)
    setMacroDrafts([])
    setLoadingGameData(true)
    try {
      // Matchup mode (upcoming, injury_report, prop_prediction, prop_results):
      // populate from the nba_games row directly — no JSON needed.
      if (dataSourceMode === 'matchup') {
        const teams = [game.away_team_tricode, game.home_team_tricode].filter(Boolean)
        const matchup = `${game.away_team_tricode} @ ${game.home_team_tricode}`
        const cleanDate = game.game_date?.includes('T') ? game.game_date.split('T')[0] : game.game_date
        setDraft(prev => {
          const isInjuryReport = prev.post_type === 'injury_report'
          const isPropResults = prev.post_type === 'prop_results'
          const title = prev.title || (isInjuryReport ? `Injury Report — ${matchup} — ${cleanDate}` : isPropResults ? `Prop Results — ${matchup} — ${cleanDate}` : matchup)
          const slug = prev.slug || generateSlug(isInjuryReport ? `Injury Report — ${matchup} — ${cleanDate}` : isPropResults ? `Prop Results — ${matchup} — ${cleanDate}` : matchup, cleanDate)
          const description = isInjuryReport
            ? (prev.description || `Daily injury updates for ${cleanDate} — who's out, questionable, or returning for ${matchup}.`)
            : isPropResults
              ? (prev.description || `Post-game prop results for ${matchup} on ${cleanDate} — overs, unders, pushes.`)
              : prev.description
          return {
            ...prev,
            game_id: game.game_id,
            game_date: cleanDate,
            team_tricodes: teams,
            title,
            subtitle: prev.subtitle || '',
            description,
            slug,
          }
        })
        setSnackbar({ open: true, message: `Matchup set: ${matchup}`, color: 'success' })
        setLoadingGameData(false)
        return
      }

      // Game mode (game_recap, player_spotlight): try to load local JSON for highlights
      const data = await loadLocalGameJson(game.game_id)
      if (data) {
        setMatchedGameData([data])
        setDraft(prev => ({
          ...prev,
          game_id: data.gameId,
          game_date: data.gameDate || game.game_date,
          team_tricodes: data.teamTricodes,
          player_ids: data.playerIds.slice(0, 30),
          title: prev.title || data.matchup,
          subtitle: prev.subtitle || data.finalScore,
          slug: prev.slug || generateSlug(data.matchup || data.gameId, data.gameDate || undefined),
          metadata: {
            ...prev.metadata,
            score: data.scoreData,
            story: data.story,
            story_data: data.story,
            fun_data: data.scoreData,
            fun_score: data.funScore,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
          },
        }))
        setSnackbar({ open: true, message: `Loaded game: ${data.matchup}`, color: 'success' })
      } else {
        setDraft(prev => ({
          ...prev,
          game_id: game.game_id,
          game_date: game.game_date,
          team_tricodes: [game.away_team_tricode, game.home_team_tricode].filter(Boolean),
          title: prev.title || `${game.away_team_tricode} vs ${game.home_team_tricode}`,
          subtitle: prev.subtitle || (game.away_team_score != null ? `${game.away_team_tricode} ${game.away_team_score} - ${game.home_team_tricode} ${game.home_team_score}` : ''),
          slug: prev.slug || generateSlug(`${game.away_team_tricode}-vs-${game.home_team_tricode}`, game.game_date),
        }))
        setSnackbar({ open: true, message: `Game selected (no local JSON found for ${game.game_id})`, color: 'warning' })
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
    } finally {
      setLoadingGameData(false)
    }
  }, [dataSourceMode])

  // ─── File upload fallback ──────────────────────────────────

  const loadGameFromFile = useCallback((file: File) => {
    setSpotlightPlayerId(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        const data = extractGameData(json)
        if (!data) {
          setSnackbar({ open: true, message: `File has no game data (empty/unplayed game)`, color: 'warning' })
          return
        }
        setMatchedGameData([data])
        setDraft(prev => ({
          ...prev,
          game_id: data.gameId || '',
          game_date: data.gameDate || '',
          team_tricodes: data.teamTricodes,
          player_ids: data.playerIds.slice(0, 30),
          title: prev.title || data.matchup,
          subtitle: prev.subtitle || data.finalScore,
          slug: prev.slug || generateSlug(data.matchup || data.gameId, data.gameDate || undefined),
          metadata: { ...prev.metadata, score: data.scoreData, story: data.story, story_data: data.story, fun_data: data.scoreData, fun_score: data.funScore, homeTeam: data.homeTeam, awayTeam: data.awayTeam },
        }))
        setSnackbar({ open: true, message: `Loaded ${file.name}`, color: 'success' })
      } catch (err: any) {
        setSnackbar({ open: true, message: `Invalid JSON: ${err.message}`, color: 'danger' })
      }
    }
    reader.readAsText(file)
  }, [])

  // ─── Section helpers ───────────────────────────────────────

  const addSection = (type: SectionType) => {
    const newSection: SectionDraft = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      section_type: type,
      title: '',
      content: getDefaultSectionContent(type),
      player_id: null,
      team_tricode: null,
    }
    setDraft(prev => ({ ...prev, sections: [...prev.sections, newSection] }))
    setAddSectionOpen(false)
    setEditingSectionIdx(draft.sections.length)
  }

  const removeSection = (idx: number) => {
    setDraft(prev => ({ ...prev, sections: prev.sections.filter((_, i) => i !== idx) }))
    if (editingSectionIdx === idx) setEditingSectionIdx(null)
  }

  const moveSection = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= draft.sections.length) return
    setDraft(prev => {
      const sections = [...prev.sections]
      const temp = sections[idx]
      sections[idx] = sections[newIdx]
      sections[newIdx] = temp
      return { ...prev, sections }
    })
  }

  const updateSection = (idx: number, updates: Partial<SectionDraft>) => {
    setDraft(prev => ({ ...prev, sections: prev.sections.map((s, i) => i === idx ? { ...s, ...updates } : s) }))
  }

  // Player Spotlight: players who have at least one MP4 in the selected game (from playByPlay)
  const availableSpotlightPlayers = useMemo(() => {
    if (draft.post_type !== 'player_spotlight' || matchedGameData.length === 0) return []
    const data = matchedGameData[0]
    const playByPlay = data.playByPlay || []
    const playerStats = data.playerStats || []
    const personIdsWithMp4 = new Set<number>()
    const nameByPersonId = new Map<number, string>()
    for (const play of playByPlay) {
      if (play.mp4 && play.personId != null) {
        personIdsWithMp4.add(play.personId)
        if (!nameByPersonId.has(play.personId) && play.playerName) {
          nameByPersonId.set(play.personId, play.playerName)
        }
      }
    }
    for (const ps of playerStats) {
      const pid = ps.personId ?? ps.player_id
      if (pid != null) {
        const name = ps.name ?? ps.playerName ?? [ps.firstName, ps.familyName].filter(Boolean).join(' ')
        if (name) nameByPersonId.set(Number(pid), name)
      }
    }
    return Array.from(personIdsWithMp4)
      .map(personId => ({ personId, name: nameByPersonId.get(personId) || `Player ${personId}` }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [draft.post_type, matchedGameData])

  const spotlightClipCount = spotlightPlayerId != null
    ? collectAllPlayerSpotlightPlaysFromGameData(spotlightPlayerId, matchedGameData).length
    : 0

  // Game Recap: max available clips from this game (score + story algorithm)
  const recapClipCount = useMemo(() => {
    if (draft.post_type !== 'game_recap' || matchedGameData.length === 0) return 0
    const data = matchedGameData[0]
    return getHighlightClipsForPostType('game_recap', {
      gameId: data.gameId,
      scoreData: data.scoreData || {},
      story: data.story || {},
      playByPlay: data.playByPlay || [],
    }, { maxClips: 999 }).length
  }, [draft.post_type, matchedGameData])

  // Per-player total MP4 plays (for TOTW/TOTN section list: "N in slideshow / M total")
  const playerHighlightCounts = useMemo(() => {
    const out: Record<number, number> = {}
    if ((draft.post_type !== 'team_of_week' && draft.post_type !== 'team_of_night') || matchedGameData.length === 0) return out
    for (const p of resolvedPlayers) {
      if (p.nba_player_id != null) {
        out[p.nba_player_id] = collectAllPlayerSpotlightPlaysFromGameData(p.nba_player_id, matchedGameData).length
      }
    }
    return out
  }, [draft.post_type, resolvedPlayers, matchedGameData])

  // ─── Auto-generate sections (delegated to generator registry) ─

  const autoGenerateSections = useCallback(async () => {
    const generator = getSectionGenerator(draft.post_type)
    const ctx: GeneratorContext = {
      draft,
      resolvedPlayers,
      matchedGameData,
      awardGameLog,
      spotlightPlayerId,
      spotlightHighlightCount,
      recapHighlightCount,
      recapPlayerClipCount,
      totnPlayerClipCount,
      totwPlayerClipCount,
      awardHighlightCount,
      targetDate: draft.game_date || undefined,
      targetTeams: draft.team_tricodes.length > 0 ? draft.team_tricodes : undefined,
      targetGameId: draft.game_id || undefined,
    }

    try {
      const sections = await generator(ctx)

      if (sections.length === 0) {
        setSnackbar({ open: true, message: 'No data loaded to generate sections from', color: 'warning' })
        return
      }

      if (draft.post_type === 'player_spotlight' && spotlightPlayerId != null) {
        const headline = sections.find((s) => s.section_type === 'headline')
        const headlineContent = headline?.content as { text?: string; subtitle?: string } | undefined
        const generatedSubtitle = headlineContent?.subtitle?.trim() || null
        const generatedTitle = headlineContent?.text?.trim()
        setDraft(prev => ({
          ...prev,
          person_id: String(spotlightPlayerId),
          player_ids: [spotlightPlayerId],
          sections: [...prev.sections, ...sections],
          ...(generatedSubtitle != null && { subtitle: generatedSubtitle }),
          ...(generatedTitle != null && prev.title === '' && { title: generatedTitle }),
        }))
      } else {
        setDraft(prev => ({ ...prev, sections: [...prev.sections, ...sections] }))
      }
      const isTotnTotw = draft.post_type === 'team_of_night' || draft.post_type === 'team_of_week'
      const noHighlights = isTotnTotw && matchedGameData.length === 0
      setSnackbar({
        open: true,
        message: noHighlights
          ? `Auto-generated ${sections.length} sections. No highlight slideshows (no game play-by-play data was loaded for this date — re-select the row after running the play-by-play scraper to add clips).`
          : `Auto-generated ${sections.length} sections`,
        color: noHighlights ? 'warning' : 'success',
      })
    } catch (err: any) {
      console.error('[AutoGen] Generator error:', err)
      setSnackbar({ open: true, message: `Auto-generate failed: ${err.message}`, color: 'danger' })
    }
  }, [draft, resolvedPlayers, matchedGameData, awardGameLog, spotlightPlayerId, spotlightHighlightCount, recapHighlightCount, recapPlayerClipCount, totnPlayerClipCount, totwPlayerClipCount, awardHighlightCount])

  // ─── Macro: generate player spotlight for all players in game ─

  const generateAllPlayerSpotlights = useCallback(async (): Promise<PostDraft[]> => {
    if (matchedGameData.length === 0 || draft.post_type !== 'player_spotlight') return []
    const data = matchedGameData[0]
    const gameId = data.gameId
    const gameDate = data.gameDate || draft.game_date || ''
    const matchup = data.matchup || ''
    const finalScore = data.finalScore || ''
    const teamTricodes = data.teamTricodes || []
    const option = POST_TYPE_OPTIONS.find(o => o.value === 'player_spotlight')!
    const players = availableSpotlightPlayers
    if (players.length === 0) return []
    const generator = getSectionGenerator('player_spotlight')
    const out: PostDraft[] = []
    for (const { personId, name: playerName } of players) {
      const playerStat = data.playerStats?.find((ps: any) => Number(ps.personId) === personId)
      const pts = playerStat?.pts ?? playerStat?.points
      const reb = playerStat?.reb
      const ast = playerStat?.ast
      const stl = playerStat?.stl
      const blk = playerStat?.blk
      const min = playerStat?.min
      const parts: string[] = []
      if (pts != null && pts !== '') parts.push(`${pts} PTS`)
      if (reb != null && reb !== '') parts.push(`${reb} REB`)
      if (ast != null && ast !== '') parts.push(`${ast} AST`)
      if (stl != null && stl !== '') parts.push(`${stl} STL`)
      if (blk != null && blk !== '') parts.push(`${blk} BLK`)
      if (min != null && min !== '') parts.push(`${min} MIN`)
      const subtitle = parts.length > 0 ? parts.join(' · ') : ''
      const title = `Player Spotlight — ${playerName}`
      const description = [matchup, gameDate, finalScore].filter(Boolean).length > 0
        ? `Standout performance from ${playerName} in ${matchup || 'this game'}${gameDate ? ` on ${gameDate}` : ''}.${finalScore ? ` ${finalScore}.` : ''}`
        : `Standout performance from ${playerName} — stats, highlights, and analysis.`
      const slug = generateSlug(title, gameDate || undefined)
      const baseDraft: PostDraft = {
        ...EMPTY_DRAFT,
        post_type: 'player_spotlight',
        tags: option.tags,
        title,
        subtitle,
        description,
        slug,
        game_id: gameId,
        game_date: gameDate,
        team_tricodes: teamTricodes,
        person_id: String(personId),
        player_ids: [personId],
        sections: [],
      }
      const ctx: GeneratorContext = {
        draft: baseDraft,
        resolvedPlayers: [],
        matchedGameData,
        awardGameLog: [],
        spotlightPlayerId: personId,
        spotlightHighlightCount: 5,
        recapHighlightCount: 0,
        recapPlayerClipCount: 0,
        totnPlayerClipCount: 0,
        totwPlayerClipCount: 0,
        awardHighlightCount: 0,
        targetDate: gameDate || undefined,
        targetTeams: teamTricodes.length > 0 ? teamTricodes : undefined,
        targetGameId: gameId,
      }
      try {
        const sections = await generator(ctx)
        const headline = sections.find((s) => s.section_type === 'headline')
        const headlineContent = headline?.content as { text?: string; subtitle?: string } | undefined
        const generatedSubtitle = headlineContent?.subtitle?.trim() || null
        const generatedTitle = headlineContent?.text?.trim()
        out.push({
          ...baseDraft,
          sections,
          ...(generatedSubtitle != null && { subtitle: generatedSubtitle }),
          ...(generatedTitle != null && generatedTitle !== title && { title: generatedTitle }),
        })
      } catch (err) {
        console.warn(`[Macro] Skip player ${personId} (${playerName}):`, err)
      }
    }
    return out
  }, [matchedGameData, draft.post_type, draft.game_date, availableSpotlightPlayers])

  // ─── Macro: generate prop results for all games on selected date ─

  const generateAllPropResultsPosts = useCallback(async (): Promise<PostDraft[]> => {
    if (draft.post_type !== 'prop_results' || !selectedDate || gamesForDate.length === 0) return []
    const option = POST_TYPE_OPTIONS.find(o => o.value === 'prop_results')!
    const targetDate = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate
    const generator = getSectionGenerator('prop_results')
    const out: PostDraft[] = []
    for (const game of gamesForDate) {
      const teams = [game.away_team_tricode, game.home_team_tricode].filter(Boolean)
      const matchup = `${game.away_team_tricode} @ ${game.home_team_tricode}`
      const title = `Prop Results — ${matchup} — ${targetDate}`
      const description = `Post-game prop results for ${matchup} on ${targetDate} — overs, unders, pushes.`
      const slug = generateSlug(title, targetDate)
      const baseDraft: PostDraft = {
        ...EMPTY_DRAFT,
        post_type: 'prop_results',
        tags: option.tags,
        title,
        subtitle: targetDate,
        description,
        slug,
        game_id: game.game_id,
        game_date: game.game_date || targetDate,
        team_tricodes: teams,
        sections: [],
      }
      const ctx: GeneratorContext = {
        draft: baseDraft,
        resolvedPlayers: [],
        matchedGameData: [],
        targetDate,
        targetTeams: teams,
        targetGameId: game.game_id,
      }
      try {
        const sections = await generator(ctx)
        out.push({ ...baseDraft, sections })
      } catch (err) {
        console.warn(`[Macro] Skip prop results for game ${game.game_id}:`, err)
      }
    }
    return out
  }, [draft.post_type, selectedDate, gamesForDate])

  // ─── Macro: generate injury report for all games on selected date ─

  const generateAllInjuryReportPosts = useCallback(async (): Promise<PostDraft[]> => {
    if (draft.post_type !== 'injury_report' || !selectedDate || gamesForDate.length === 0) return []
    const option = POST_TYPE_OPTIONS.find(o => o.value === 'injury_report')!
    const targetDate = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate
    const generator = getSectionGenerator('injury_report')
    const out: PostDraft[] = []
    for (const game of gamesForDate) {
      const teams = [game.away_team_tricode, game.home_team_tricode].filter(Boolean)
      const matchup = `${game.away_team_tricode} @ ${game.home_team_tricode}`
      const title = `Injury Report — ${matchup} — ${targetDate}`
      const description = `Daily injury updates for ${targetDate} — who's out, questionable, or returning for ${matchup}.`
      const slug = generateSlug(title, targetDate)
      const baseDraft: PostDraft = {
        ...EMPTY_DRAFT,
        post_type: 'injury_report',
        tags: option.tags,
        title,
        subtitle: targetDate,
        description,
        slug,
        game_id: game.game_id,
        game_date: game.game_date || targetDate,
        team_tricodes: teams,
        sections: [],
      }
      const ctx: GeneratorContext = {
        draft: baseDraft,
        resolvedPlayers: [],
        matchedGameData: [],
        targetDate,
        targetTeams: teams,
      }
      try {
        const sections = await generator(ctx)
        out.push({ ...baseDraft, sections })
      } catch (err) {
        console.warn(`[Macro] Skip injury report for game ${game.game_id}:`, err)
      }
    }
    return out
  }, [draft.post_type, selectedDate, gamesForDate])

  // ─── Macro: generate prop prediction for all games on selected date ─

  const generateAllPropPredictionPosts = useCallback(async (): Promise<PostDraft[]> => {
    if (draft.post_type !== 'prop_prediction' || !selectedDate || gamesForDate.length === 0) return []
    const option = POST_TYPE_OPTIONS.find(o => o.value === 'prop_prediction')!
    const targetDate = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate
    const generator = getSectionGenerator('prop_prediction')
    const out: PostDraft[] = []
    for (const game of gamesForDate) {
      const teams = [game.away_team_tricode, game.home_team_tricode].filter(Boolean)
      const matchup = `${game.away_team_tricode} @ ${game.home_team_tricode}`
      const title = `Prop Predictions — ${matchup} — ${targetDate}`
      const description = `Pre-game prop predictions for ${matchup} on ${targetDate} — overs, unders, confidence levels.`
      const slug = generateSlug(title, targetDate)
      const baseDraft: PostDraft = {
        ...EMPTY_DRAFT,
        post_type: 'prop_prediction',
        tags: option.tags,
        title,
        subtitle: targetDate,
        description,
        slug,
        game_id: game.game_id,
        game_date: game.game_date || targetDate,
        team_tricodes: teams,
        sections: [],
      }
      const ctx: GeneratorContext = {
        draft: baseDraft,
        resolvedPlayers: [],
        matchedGameData: [],
        targetDate,
        targetTeams: teams,
        targetGameId: game.game_id,
      }
      try {
        const sections = await generator(ctx)
        out.push({ ...baseDraft, sections })
      } catch (err) {
        console.warn(`[Macro] Skip prop prediction for game ${game.game_id}:`, err)
      }
    }
    return out
  }, [draft.post_type, selectedDate, gamesForDate])

  // ─── Save to Supabase ──────────────────────────────────────

  const savePost = async (status: PostStatus) => {
    if (!user) { setSnackbar({ open: true, message: 'You must be logged in', color: 'danger' }); return }
    setSaving(true)
    try {
      // Merge frozen module snapshots into metadata so feed posts render from metadata (same modules, frozen data)
      const metadata = { ...draft.metadata }
      const injurySection = draft.sections.find((s) => s.section_type === 'injury_module')
      const propSection = draft.sections.find((s) => s.section_type === 'prop_module')
      const tankSection = draft.sections.find((s) => s.section_type === 'tank_module')
      const dfsSection = draft.sections.find((s) => s.section_type === 'dfs_module')
      if (injurySection?.content && typeof injurySection.content === 'object') metadata.injury_snapshot = injurySection.content
      if (propSection?.content && typeof propSection.content === 'object') metadata.prop_snapshot = propSection.content
      if (tankSection?.content && typeof tankSection.content === 'object') metadata.tank_snapshot = tankSection.content
      if (dfsSection?.content && typeof dfsSection.content === 'object') metadata.dfs_snapshot = dfsSection.content

      const coverImageUrl =
        draft.cover_image_url ||
        (draft.post_type === 'player_spotlight' && (draft.person_id || draft.player_ids?.[0])
          ? getNbaPlayerImageUrl(Number(draft.person_id || draft.player_ids?.[0]))
          : null)
      const postRow = {
        post_type: draft.post_type, status,
        title: draft.title, subtitle: draft.subtitle || null, description: draft.description || null,
        slug: draft.slug || generateSlug(draft.title, draft.game_date || undefined),
        cover_image_url: coverImageUrl || null, share_image_url: draft.share_image_url || null,
        game_id: draft.game_id || null, game_date: draft.game_date || null,
        team_tricodes: draft.team_tricodes.length ? draft.team_tricodes : null,
        player_ids: draft.player_ids.length ? draft.player_ids : null,
        person_id: draft.person_id ? Number(draft.person_id) : null,
        tags: draft.tags.length ? draft.tags : [],
        metadata,
        source_ref: (() => {
          // Disambiguate so multiple posts per game/week don't collide (UNIQUE source_ref).
          // For player_spotlight always include a suffix: person_id, or player_ids[0], or timestamp so we never 409.
          let disambiguator: string | number | undefined
          if (draft.post_type === 'player_spotlight') {
            disambiguator =
              draft.person_id ?? draft.player_ids?.[0] ?? `t-${Date.now()}`
          } else if (draft.post_type === 'player_of_week' && draft.metadata?.pow_row?.conference) {
            disambiguator = String(draft.metadata.pow_row.conference)
          } else if (draft.post_type === 'player_of_month' && draft.metadata?.pom_row?.conference) {
            disambiguator = String(draft.metadata.pom_row.conference)
          } else if ((draft.post_type === 'player_of_week' || draft.post_type === 'player_of_month') && draft.person_id) {
            disambiguator = String(draft.person_id)
          }
          return generateSourceRef(
            draft.post_type,
            draft.game_id || undefined,
            draft.game_date || undefined,
            disambiguator
          )
        })(),
        created_by: user.id, author_name: 'HoopGeek',
        published_at: status === 'published' ? new Date().toISOString() : null,
      }
      const { data: insertedPost, error: postError } = await supabase.from('feed_posts').insert([postRow]).select().single()
      if (postError) throw postError
      if (!insertedPost) throw new Error('No post returned')

      if (draft.sections.length > 0) {
        const sectionRows = draft.sections.map((s, i) => ({
          post_id: insertedPost.id, section_order: i, section_type: s.section_type,
          title: s.title || null, content: s.content || {}, player_id: s.player_id || null, team_tricode: s.team_tricode || null,
        }))
        const { error: sectionsError } = await supabase.from('feed_post_sections').insert(sectionRows)
        if (sectionsError) throw sectionsError
      }

      setSnackbar({ open: true, message: `Post ${status === 'published' ? 'published' : 'saved as draft'}!`, color: 'success' })
      setTimeout(() => {
        if (status === 'published') navigate(`/feed/${insertedPost.slug}`)
        else navigate(draftSaveTarget)
      }, 1500)
    } catch (err: any) {
      console.error('Error saving post:', err)
      setSnackbar({ open: true, message: `Error: ${err.message}`, color: 'danger' })
    } finally { setSaving(false) }
  }

  const saveMacroPosts = async (status: PostStatus) => {
    if (!user || macroDrafts.length === 0) return
    setSaving(true)
    try {
      let firstSlug: string | null = null
      for (const d of macroDrafts) {
        const metadata = { ...d.metadata }
        const injurySection = d.sections.find((s) => s.section_type === 'injury_module')
        const propSection = d.sections.find((s) => s.section_type === 'prop_module')
        const tankSection = d.sections.find((s) => s.section_type === 'tank_module')
        const dfsSection = d.sections.find((s) => s.section_type === 'dfs_module')
        if (injurySection?.content && typeof injurySection.content === 'object') metadata.injury_snapshot = injurySection.content
        if (propSection?.content && typeof propSection.content === 'object') metadata.prop_snapshot = propSection.content
        if (tankSection?.content && typeof tankSection.content === 'object') metadata.tank_snapshot = tankSection.content
        if (dfsSection?.content && typeof dfsSection.content === 'object') metadata.dfs_snapshot = dfsSection.content
        const coverImageUrl = d.cover_image_url || (d.person_id ? getNbaPlayerImageUrl(Number(d.person_id)) : null)
        const postRow = {
          post_type: d.post_type,
          status,
          title: d.title,
          subtitle: d.subtitle || null,
          description: d.description || null,
          slug: d.slug || generateSlug(d.title, d.game_date || undefined),
          cover_image_url: coverImageUrl || null,
          share_image_url: d.share_image_url || null,
          game_id: d.game_id || null,
          game_date: d.game_date || null,
          team_tricodes: d.team_tricodes.length ? d.team_tricodes : null,
          player_ids: d.player_ids.length ? d.player_ids : null,
          person_id: d.person_id ? Number(d.person_id) : null,
          tags: d.tags.length ? d.tags : [],
          metadata,
          source_ref: generateSourceRef(d.post_type, d.game_id || undefined, d.game_date || undefined, d.person_id ?? d.player_ids?.[0]),
          created_by: user.id,
          author_name: 'HoopGeek',
          published_at: status === 'published' ? new Date().toISOString() : null,
        }
        const { data: insertedPost, error: postError } = await supabase.from('feed_posts').insert([postRow]).select().single()
        if (postError) throw postError
        if (!insertedPost) throw new Error('No post returned')
        if (firstSlug == null) firstSlug = insertedPost.slug
        if (d.sections.length > 0) {
          const sectionRows = d.sections.map((s, i) => ({
            post_id: insertedPost.id,
            section_order: i,
            section_type: s.section_type,
            title: s.title || null,
            content: s.content || {},
            player_id: s.player_id || null,
            team_tricode: s.team_tricode || null,
          }))
          const { error: sectionsError } = await supabase.from('feed_post_sections').insert(sectionRows)
          if (sectionsError) throw sectionsError
        }
      }
      setSnackbar({ open: true, message: `${macroDrafts.length} post${macroDrafts.length !== 1 ? 's' : ''} ${status === 'published' ? 'published' : 'saved as draft'}!`, color: 'success' })
      setTimeout(() => {
        if (status === 'published' && firstSlug) navigate(`/feed/${firstSlug}`)
        else navigate(draftSaveTarget)
      }, 1500)
    } catch (err: any) {
      console.error('Error saving macro posts:', err)
      setSnackbar({ open: true, message: `Error: ${err.message}`, color: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: return true
      case 1:
        if (draft.post_type === 'player_spotlight' && dataSourceMode === 'game') {
          if (spotlightAllPlayers) return matchedGameData.length > 0
          return matchedGameData.length > 0 && spotlightPlayerId != null
        }
        if (dataSourceMode === 'matchup') {
          if (draft.post_type === 'prop_results' && propResultsAllGames) return selectedDate.length > 0 && gamesForDate.length > 0
          if (draft.post_type === 'injury_report' && injuryReportAllGames) return selectedDate.length > 0 && gamesForDate.length > 0
          if (draft.post_type === 'prop_prediction' && propPredictionAllGames) return selectedDate.length > 0 && gamesForDate.length > 0
          return draft.team_tricodes.length >= 2
        }
        return true
      case 2: return draft.title.trim().length > 0 && draft.slug.trim().length > 0
      case 3: return true
      case 4: return draft.title.trim().length > 0
      default: return false
    }
  }

  const hasAutoGenData =
    dataSourceMode === 'manual'
      ? true
      : dataSourceMode === 'matchup'
        ? draft.team_tricodes.length >= 2 || draft.game_date.length > 0
        : (dataSourceMode === 'totn' || dataSourceMode === 'totw' || dataSourceMode === 'pow' || dataSourceMode === 'pom')
          ? resolvedPlayers.length > 0
          : draft.post_type === 'player_spotlight'
            ? matchedGameData.length > 0 && spotlightPlayerId != null
            : matchedGameData.length > 0

  // ─── Render ────────────────────────────────────────────────

  return (
    <Box sx={{
      maxWidth: 900,
      mx: 'auto',
      px: { xs: 2, md: 3 },
      pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
      pb: 8,
      minHeight: '100vh',
      bgcolor: '#ffffff',
      color: '#000',
      // Force dark text on white everywhere (app is in dark mode globally)
      '--joy-palette-text-primary': '#000',
      '--joy-palette-text-secondary': '#333',
      '--joy-palette-text-tertiary': '#666',
      '--joy-palette-neutral-plainColor': '#000',
      '--joy-palette-background-surface': '#ffffff',
      '--joy-palette-background-level1': '#f5f5f5',
      '--joy-palette-background-level2': '#eeeeee',
      '--joy-palette-background-level3': '#e0e0e0',
      '& .MuiStepButton-root': { color: '#000' },
      '& .MuiStepIndicator-root': { color: '#000' },
      '& .MuiStepper-root': { color: '#000' },
      '& .MuiFormLabel-root': { color: '#000' },
      '& .MuiFormHelperText-root': { color: '#666' },
      '& .MuiInput-input': { color: '#000' },
      '& .MuiSelect-select': { color: '#000' },
      // All typography and text readable
      '& .MuiTypography-root': { color: '#000' },
      '& .MuiCard-root': { bgcolor: '#ffffff', color: '#000' },
      '& .MuiCardContent-root': { bgcolor: 'transparent', color: '#000' },
      '& .MuiSheet-root': { bgcolor: '#ffffff', color: '#000' },
      '& table': { color: '#000' },
      '& thead': { bgcolor: '#f5f5f5' },
      '& th': { color: '#000', bgcolor: '#f5f5f5' },
      '& td': { color: '#000', bgcolor: 'transparent' },
      '& tbody tr': { bgcolor: 'transparent' },
      '& tbody tr:hover': { bgcolor: '#f9f9f9' },
      '& label': { color: '#000' },
      '& input': { color: '#000', bgcolor: '#fff' },
      '& textarea': { color: '#000', bgcolor: '#fff' },
      '& .MuiSlider-thumb': { color: '#000' },
      '& .MuiChip-label': { color: 'inherit' },
      // Cards with variant=solid: keep accent bg but force text dark where needed
      '& .MuiCard-root.MuiCard-variantSolid': { color: '#000' },
      '& .MuiCard-root.MuiCard-variantSolid .MuiTypography-root': { color: '#000' },
      '& .MuiFormControl-root': { color: '#000' },
      '& .MuiInput-root': { bgcolor: '#fff', color: '#000' },
      '& .MuiTextarea-root': { bgcolor: '#fff', color: '#000' },
      '& .MuiSelect-root': { bgcolor: '#fff', color: '#000' },
    }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 3, color: '#000' }}>
        <IconButton variant="plain" onClick={() => navigate(backTarget)} sx={{ color: '#000' }}>
          <ArrowBack />
        </IconButton>
        <Typography level="h3" sx={{ fontWeight: 700, fontFamily: 'serif', color: '#000' }}>Create Post</Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton variant="plain" onClick={() => navigate('/feed')} aria-label="Home" sx={{ color: '#000' }}>
          <Home />
        </IconButton>
      </Stack>

      {/* Stepper */}
      <Stepper sx={{ mb: 4, color: '#000' }}>
        {STEPS.map((label, index) => (
          <Step key={label} indicator={
            <StepIndicator variant={activeStep === index ? 'solid' : index < activeStep ? 'solid' : 'outlined'} color={activeStep === index ? 'primary' : index < activeStep ? 'success' : 'neutral'}>
              {index < activeStep ? <Check /> : index + 1}
            </StepIndicator>
          }>
            <StepButton onClick={() => { if (index <= activeStep) setActiveStep(index) }}>{label}</StepButton>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      <Box sx={{ minHeight: 400 }}>
        {activeStep === 0 && (
          <StepPostType selected={draft.post_type} onSelect={(type) => {
            const option = POST_TYPE_OPTIONS.find(o => o.value === type)!
            setDraft(prev => ({ ...prev, post_type: type, tags: option.tags }))
            draftStep2AutoFilledRef.current = false
            // Reset data source state when type changes
            setSelectedRowId(null); setResolvedPlayers([]); setMatchedGameData([]); setGamesForDate([]); setFeedGamesForDate([]); setTotnBoxscores([]); setTotnGamesFeedStatus([])
            setSpotlightPlayerId(null); setSpotlightHighlightCount(5)
            setSpotlightAllPlayers(false); setPropResultsAllGames(false); setInjuryReportAllGames(false); setPropPredictionAllGames(false); setMacroDrafts([])
          }} />
        )}

        {activeStep === 1 && (
          <StepDataSource
            mode={dataSourceMode}
            totnRows={totnRows} totwRows={totwRows} powRows={powRows} pomRows={pomRows}
            selectedRowId={selectedRowId}
            resolvedPlayers={resolvedPlayers}
            loadingRows={loadingRows} loadingPlayers={loadingPlayers}
            onSelectTotnRow={selectTotnRow} onSelectTotwRow={selectTotwRow}
            onSelectPowRow={selectPowRow} onSelectPomRow={selectPomRow}
            selectedDate={selectedDate} gamesForDate={gamesForDate}
            feedGamesForDate={feedGamesForDate}
            loadingGames={loadingGames} loadingGameData={loadingGameData}
            matchedGameData={matchedGameData}
            totnBoxscores={totnBoxscores}
            totnGamesFeedStatus={totnGamesFeedStatus}
            onDateSelected={onDateSelected} onSelectGame={selectGame}
            onFileUpload={loadGameFromFile}
            draft={draft}
            spotlightPlayerId={spotlightPlayerId}
            spotlightHighlightCount={spotlightHighlightCount}
            availableSpotlightPlayers={availableSpotlightPlayers}
            spotlightClipCount={spotlightClipCount}
            onSpotlightPlayerChange={(personId) => {
              setSpotlightPlayerId(personId)
              if (personId == null) {
                setDraft(prev => ({ ...prev, person_id: undefined }))
                return
              }
              const gameData = matchedGameData[0]
              const playerStat = gameData?.playerStats?.find((ps: any) => Number(ps.personId) === personId)
              const playerName = playerStat?.name || playerStat?.playerName || availableSpotlightPlayers.find(p => p.personId === personId)?.name || `Player ${personId}`
              const pts = playerStat?.pts ?? playerStat?.points
              const reb = playerStat?.reb
              const ast = playerStat?.ast
              const stl = playerStat?.stl
              const blk = playerStat?.blk
              const min = playerStat?.min
              const parts: string[] = []
              if (pts != null && pts !== '') parts.push(`${pts} PTS`)
              if (reb != null && reb !== '') parts.push(`${reb} REB`)
              if (ast != null && ast !== '') parts.push(`${ast} AST`)
              if (stl != null && stl !== '') parts.push(`${stl} STL`)
              if (blk != null && blk !== '') parts.push(`${blk} BLK`)
              if (min != null && min !== '') parts.push(`${min} MIN`)
              const subtitle = parts.length > 0 ? parts.join(' · ') : ''
              const matchup = gameData?.matchup || ''
              const gameDate = gameData?.gameDate || draft.game_date || ''
              const finalScore = gameData?.finalScore || ''
              const title = `Player Spotlight — ${playerName}`
              const description = [matchup, gameDate, finalScore].filter(Boolean).length > 0
                ? `Standout performance from ${playerName} in ${matchup || 'this game'}${gameDate ? ` on ${gameDate}` : ''}.${finalScore ? ` ${finalScore}.` : ''}`
                : `Standout performance from ${playerName} — stats, highlights, and analysis.`
              setDraft(prev => ({
                ...prev,
                person_id: String(personId),
                title,
                subtitle,
                description,
                slug: generateSlug(title, gameDate || undefined),
              }))
            }}
            onSpotlightHighlightCountChange={setSpotlightHighlightCount}
            recapHighlightCount={recapHighlightCount}
            recapClipCount={recapClipCount}
            onRecapHighlightCountChange={setRecapHighlightCount}
            recapPlayerClipCount={recapPlayerClipCount}
            onRecapPlayerClipCountChange={setRecapPlayerClipCount}
            totnPlayerClipCount={totnPlayerClipCount}
            onTotnPlayerClipCountChange={setTotnPlayerClipCount}
            totwPlayerClipCount={totwPlayerClipCount}
            onTotwPlayerClipCountChange={setTotwPlayerClipCount}
            awardGameLog={awardGameLog}
            loadingAwardGames={loadingAwardGames}
            awardHighlightCount={awardHighlightCount}
            onAwardHighlightCountChange={setAwardHighlightCount}
            spotlightAllPlayers={spotlightAllPlayers}
            onSpotlightAllPlayersChange={(v) => { setSpotlightAllPlayers(v); if (!v) setMacroDrafts([]) }}
            macroGenerating={macroGenerating}
            propResultsAllGames={propResultsAllGames}
            onPropResultsAllGamesChange={(v) => { setPropResultsAllGames(v); if (!v) setMacroDrafts([]) }}
            injuryReportAllGames={injuryReportAllGames}
            onInjuryReportAllGamesChange={(v) => { setInjuryReportAllGames(v); if (!v) setMacroDrafts([]) }}
            propPredictionAllGames={propPredictionAllGames}
            onPropPredictionAllGamesChange={(v) => { setPropPredictionAllGames(v); if (!v) setMacroDrafts([]) }}
          />
        )}

        {activeStep === 2 && (
          <StepPostDetails draft={draft} onUpdate={(u) => setDraft(prev => ({ ...prev, ...u }))} resolvedPlayers={resolvedPlayers} matchedGameData={matchedGameData} />
        )}

        {activeStep === 3 && (
          <StepSections
            draft={draft}
            onAddSection={addSection} onRemoveSection={removeSection} onMoveSection={moveSection} onUpdateSection={updateSection}
            addSectionOpen={addSectionOpen} onSetAddSectionOpen={setAddSectionOpen}
            editingSectionIdx={editingSectionIdx} onSetEditingSectionIdx={setEditingSectionIdx}
            onAutoGenerate={hasAutoGenData ? autoGenerateSections : undefined}
            playerHighlightCounts={playerHighlightCounts}
            lineupClipCount={draft.post_type === 'team_of_night' ? totnPlayerClipCount : draft.post_type === 'team_of_week' ? totwPlayerClipCount : undefined}
          />
        )}

        {activeStep === 4 && (macroDrafts.length > 0 ? (
          <StepReviewMacro drafts={macroDrafts} saving={saving} onSaveAll={saveMacroPosts} />
        ) : (
          <StepReview draft={draft} saving={saving} onSave={savePost} />
        ))}
      </Box>

      {/* Navigation */}
      <Divider sx={{ my: 3 }} />
      <Stack direction="row" justifyContent="space-between">
        <Button
          variant="outlined"
          color="neutral"
          startDecorator={<ArrowBack />}
          disabled={activeStep === 0}
          onClick={() => {
            if (activeStep === 4 && macroDrafts.length > 0) {
              setMacroDrafts([])
              setActiveStep(1)
            } else {
              setActiveStep(prev => prev - 1)
            }
          }}
        >
          Back
        </Button>
        {activeStep < STEPS.length - 1 ? (
          <Button
            variant="outlined"
            color="neutral"
            endDecorator={<ArrowForward />}
            disabled={!canProceed(activeStep) || macroGenerating}
            loading={macroGenerating}
            onClick={async () => {
              if (activeStep === 1 && draft.post_type === 'player_spotlight' && spotlightAllPlayers && matchedGameData.length > 0) {
                setMacroGenerating(true)
                try {
                  const drafts = await generateAllPlayerSpotlights()
                  setMacroDrafts(drafts)
                  if (drafts.length > 0) setActiveStep(4)
                  else setSnackbar({ open: true, message: 'No players with highlights in this game', color: 'warning' })
                } catch (err: any) {
                  setSnackbar({ open: true, message: `Generation failed: ${err.message}`, color: 'danger' })
                } finally {
                  setMacroGenerating(false)
                }
              } else if (activeStep === 1 && draft.post_type === 'prop_results' && propResultsAllGames && selectedDate && gamesForDate.length > 0) {
                setMacroGenerating(true)
                try {
                  const drafts = await generateAllPropResultsPosts()
                  setMacroDrafts(drafts)
                  if (drafts.length > 0) setActiveStep(4)
                  else setSnackbar({ open: true, message: 'No games or prop data for this date', color: 'warning' })
                } catch (err: any) {
                  setSnackbar({ open: true, message: `Generation failed: ${err.message}`, color: 'danger' })
                } finally {
                  setMacroGenerating(false)
                }
              } else if (activeStep === 1 && draft.post_type === 'injury_report' && injuryReportAllGames && selectedDate && gamesForDate.length > 0) {
                setMacroGenerating(true)
                try {
                  const drafts = await generateAllInjuryReportPosts()
                  setMacroDrafts(drafts)
                  if (drafts.length > 0) setActiveStep(4)
                  else setSnackbar({ open: true, message: 'No games for this date', color: 'warning' })
                } catch (err: any) {
                  setSnackbar({ open: true, message: `Generation failed: ${err.message}`, color: 'danger' })
                } finally {
                  setMacroGenerating(false)
                }
              } else if (activeStep === 1 && draft.post_type === 'prop_prediction' && propPredictionAllGames && selectedDate && gamesForDate.length > 0) {
                setMacroGenerating(true)
                try {
                  const drafts = await generateAllPropPredictionPosts()
                  setMacroDrafts(drafts)
                  if (drafts.length > 0) setActiveStep(4)
                  else setSnackbar({ open: true, message: 'No games or prop data for this date', color: 'warning' })
                } catch (err: any) {
                  setSnackbar({ open: true, message: `Generation failed: ${err.message}`, color: 'danger' })
                } finally {
                  setMacroGenerating(false)
                }
              } else {
                setActiveStep(prev => prev + 1)
              }
            }}
          >
            {macroGenerating ? 'Generating…' : 'Next'}
          </Button>
        ) : (
          <Stack direction="row" gap={1}>
            {macroDrafts.length > 0 ? (
              <>
                <Button variant="outlined" color="neutral" startDecorator={<Save />} loading={saving} onClick={() => saveMacroPosts('draft')}>Save all as draft</Button>
                <Button variant="solid" color="success" startDecorator={<Publish />} loading={saving} onClick={() => saveMacroPosts('published')}>Publish all</Button>
              </>
            ) : (
              <>
                <Button variant="outlined" color="neutral" startDecorator={<Save />} loading={saving} onClick={() => savePost('draft')}>Save Draft</Button>
                <Button variant="solid" color="success" startDecorator={<Publish />} loading={saving} onClick={() => savePost('published')}>Publish</Button>
              </>
            )}
          </Stack>
        )}
      </Stack>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} color={snackbar.color} variant="soft">{snackbar.message}</Snackbar>
    </Box>
  )
}


// ==========================================================================
// STEP 0 — Post Type Selection
// ==========================================================================

function StepPostType({ selected, onSelect }: { selected: PostType; onSelect: (t: PostType) => void }) {
  return (
    <Box>
      <Typography level="h4" sx={{ mb: 1 }}>What type of post?</Typography>
      <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>Choose the post type. This determines the data source and default sections.</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
        {POST_TYPE_OPTIONS.map(opt => (
          <Card key={opt.value} variant={selected === opt.value ? 'solid' : 'outlined'} color={selected === opt.value ? 'primary' : 'neutral'}
            sx={{ cursor: 'pointer', border: selected === opt.value ? `2px solid ${opt.color}` : '1px solid', borderColor: selected === opt.value ? opt.color : 'divider', transition: 'all 0.15s', '&:hover': { borderColor: opt.color, transform: 'translateY(-2px)', boxShadow: 'md' }, position: 'relative', overflow: 'visible' }}
            onClick={() => onSelect(opt.value)}>
            {opt.theoretical && <Chip size="sm" variant="soft" color="warning" sx={{ position: 'absolute', top: -8, right: 8, fontSize: '0.65rem' }}>Theoretical</Chip>}
            <CardContent>
              <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: opt.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: opt.color }}>{opt.icon}</Box>
                <Typography level="title-md" sx={{ fontWeight: 600 }}>{opt.label}</Typography>
              </Stack>
              <Typography level="body-xs" sx={{ color: '#666' }}>{opt.description}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  )
}


// ==========================================================================
// Award Games Panel (shared by POW + POM data source views)
// ==========================================================================

function AwardGamesPanel({
  gameLog, loading,
}: {
  gameLog: BoxScoreRow[]
  loading: boolean
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, gap: 2 }}>
        <CircularProgress size="sm" />
        <Typography level="body-sm">Loading game log...</Typography>
      </Box>
    )
  }

  if (gameLog.length === 0) return null

  const gp = gameLog.length
  const totals = gameLog.reduce((acc, g) => ({
    pts: acc.pts + (g.pts ?? 0),
    reb: acc.reb + (g.reb ?? 0),
    ast: acc.ast + (g.ast ?? 0),
    stl: acc.stl + (g.stl ?? 0),
    blk: acc.blk + (g.blk ?? 0),
    tov: acc.tov + (g.tov ?? 0),
    fgm: acc.fgm + (g.fgm ?? 0),
    fga: acc.fga + (g.fga ?? 0),
    fg3m: acc.fg3m + (g.fg3m ?? 0),
    fg3a: acc.fg3a + (g.fg3a ?? 0),
    ftm: acc.ftm + (g.ftm ?? 0),
    fta: acc.fta + (g.fta ?? 0),
  }), { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 })

  const avg = (v: number) => (v / gp).toFixed(1)
  const pct = (m: number, a: number) => a > 0 ? (m / a * 100).toFixed(1) + '%' : '—'

  const thRight: React.CSSProperties = { textAlign: 'right', fontSize: '0.7rem', padding: '4px 6px' }
  const tdRight: React.CSSProperties = { textAlign: 'right', padding: '4px 6px' }

  return (
    <Card variant="outlined" sx={{ mt: 1 }}>
      <CardContent sx={{ gap: 1.5 }}>
        <Typography level="title-md" startDecorator={<TableChart sx={{ fontSize: 18 }} />}>
          Game Log — {gp} game{gp !== 1 ? 's' : ''}
        </Typography>

        <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto' }}>
          <Table size="sm" stickyHeader sx={{ '& th, & td': { whiteSpace: 'nowrap' } }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 6px', fontSize: '0.7rem' }}>Date</th>
                <th style={{ padding: '4px 6px', fontSize: '0.7rem' }}>Matchup</th>
                <th style={thRight}>MIN</th>
                <th style={thRight}>PTS</th>
                <th style={thRight}>REB</th>
                <th style={thRight}>AST</th>
                <th style={thRight}>STL</th>
                <th style={thRight}>BLK</th>
                <th style={thRight}>TOV</th>
                <th style={thRight}>FG</th>
                <th style={thRight}>3PT</th>
                <th style={thRight}>FT</th>
                <th style={thRight}>+/−</th>
              </tr>
            </thead>
            <tbody>
              {gameLog.map(g => (
                <tr key={g.game_id}>
                  <td style={{ padding: '4px 6px' }}>
                    <Typography level="body-xs">{g.game_date}</Typography>
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <Typography level="body-xs" sx={{ fontWeight: 500 }}>{g.matchup}</Typography>
                  </td>
                  <td style={tdRight}><Typography level="body-xs">{g.min ?? '—'}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 700 }}>{g.pts ?? 0}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs">{g.reb ?? 0}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs">{g.ast ?? 0}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs">{g.stl ?? 0}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs">{g.blk ?? 0}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs">{g.tov ?? 0}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs">{g.fgm ?? 0}-{g.fga ?? 0}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs">{g.fg3m ?? 0}-{g.fg3a ?? 0}</Typography></td>
                  <td style={tdRight}><Typography level="body-xs">{g.ftm ?? 0}-{g.fta ?? 0}</Typography></td>
                  <td style={tdRight}>
                    <Typography level="body-xs" sx={{ color: (g.plus_minus_points ?? 0) >= 0 ? 'success.plainColor' : 'danger.plainColor' }}>
                      {(g.plus_minus_points ?? 0) >= 0 ? '+' : ''}{g.plus_minus_points ?? 0}
                    </Typography>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f5f5f5' }}>
                <td colSpan={2} style={{ padding: '4px 6px' }}>
                  <Typography level="body-xs" sx={{ fontWeight: 700 }}>Averages ({gp} GP)</Typography>
                </td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>—</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 700 }}>{avg(totals.pts)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>{avg(totals.reb)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>{avg(totals.ast)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>{avg(totals.stl)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>{avg(totals.blk)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>{avg(totals.tov)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>{pct(totals.fgm, totals.fga)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>{pct(totals.fg3m, totals.fg3a)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>{pct(totals.ftm, totals.fta)}</Typography></td>
                <td style={tdRight}><Typography level="body-xs" sx={{ fontWeight: 600 }}>—</Typography></td>
              </tr>
            </tfoot>
          </Table>
        </Sheet>
      </CardContent>
    </Card>
  )
}

// ==========================================================================
// STEP 1 — Data Source (contextual)
// ==========================================================================

function StepDataSource({
  mode, totnRows, totwRows, powRows, pomRows, selectedRowId, resolvedPlayers,
  loadingRows, loadingPlayers,
  onSelectTotnRow, onSelectTotwRow, onSelectPowRow, onSelectPomRow,
  selectedDate, gamesForDate, feedGamesForDate,
  loadingGames, loadingGameData, matchedGameData,
  totnBoxscores, totnGamesFeedStatus,
  onDateSelected, onSelectGame, onFileUpload, draft,
  spotlightPlayerId, spotlightHighlightCount, availableSpotlightPlayers, spotlightClipCount,
  onSpotlightPlayerChange, onSpotlightHighlightCountChange,
  recapHighlightCount, recapClipCount, onRecapHighlightCountChange,
  recapPlayerClipCount, onRecapPlayerClipCountChange,
  totnPlayerClipCount, onTotnPlayerClipCountChange,
  totwPlayerClipCount, onTotwPlayerClipCountChange,
  awardGameLog, loadingAwardGames,
  awardHighlightCount, onAwardHighlightCountChange,
  spotlightAllPlayers, onSpotlightAllPlayersChange, macroGenerating,
  propResultsAllGames, onPropResultsAllGamesChange,
  injuryReportAllGames, onInjuryReportAllGamesChange,
  propPredictionAllGames, onPropPredictionAllGamesChange,
}: {
  mode: string
  totnRows: any[]; totwRows: any[]; powRows: any[]; pomRows: any[]
  selectedRowId: string | null; resolvedPlayers: ResolvedPlayer[]
  loadingRows: boolean; loadingPlayers: boolean
  onSelectTotnRow: (row: any) => void; onSelectTotwRow: (row: any) => void
  onSelectPowRow: (row: any) => void; onSelectPomRow: (row: any) => void
  selectedDate: string; gamesForDate: NbaGame[]; feedGamesForDate: Array<{ gameId: string; hasMp4: boolean }>
  loadingGames: boolean; loadingGameData: boolean
  matchedGameData: GameData[]
  totnBoxscores: Array<{ game_id: string; nba_player_id: number; player_name?: string; pts?: number; reb?: number; ast?: number; stl?: number; blk?: number; min?: number | string }>
  totnGamesFeedStatus: Array<{ gameId: string; inFeed: boolean; hasMp4: boolean }>
  onDateSelected: (date: string) => void; onSelectGame: (game: NbaGame) => void
  onFileUpload: (file: File) => void
  draft: PostDraft
  spotlightPlayerId: number | null
  spotlightHighlightCount: number
  availableSpotlightPlayers: Array<{ personId: number; name: string }>
  spotlightClipCount: number
  onSpotlightPlayerChange: (personId: number | null) => void
  onSpotlightHighlightCountChange: (count: number) => void
  recapHighlightCount: number
  recapClipCount: number
  onRecapHighlightCountChange: (count: number) => void
  recapPlayerClipCount: number
  onRecapPlayerClipCountChange: (count: number) => void
  totnPlayerClipCount: number
  onTotnPlayerClipCountChange: (count: number) => void
  totwPlayerClipCount: number
  onTotwPlayerClipCountChange: (count: number) => void
  awardGameLog: BoxScoreRow[]
  loadingAwardGames: boolean
  awardHighlightCount: number
  onAwardHighlightCountChange: (count: number) => void
  spotlightAllPlayers: boolean
  onSpotlightAllPlayersChange: (v: boolean) => void
  macroGenerating?: boolean
  propResultsAllGames: boolean
  onPropResultsAllGamesChange: (v: boolean) => void
  injuryReportAllGames: boolean
  onInjuryReportAllGamesChange: (v: boolean) => void
  propPredictionAllGames: boolean
  onPropPredictionAllGamesChange: (v: boolean) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── TOTN ──
  if (mode === 'totn') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>Select Team of the Night</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>
          Pick a TOTN row. The lineup will be resolved and matched game files loaded automatically.
        </Typography>

        {loadingRows ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : totnRows.length === 0 ? (
          <Alert color="warning" variant="soft">No TOTN rows found in database.</Alert>
        ) : (
          <Stack gap={1.5}>
            {/* Row Picker */}
            <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: 320 }}>
              <Table size="sm" stickyHeader>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Total FP</th>
                    <th style={{ textAlign: 'right' }}>Salary</th>
                    <th style={{ textAlign: 'right' }}>Players</th>
                  </tr>
                </thead>
                <tbody>
                  {totnRows.map(row => {
                    const isSelected = row.id === selectedRowId
                    const playerCount = TOTN_SLOTS.filter(s => row[`${s}_player_id`]).length
                    return (
                      <tr key={row.id} onClick={() => onSelectTotnRow(row)}
                        style={{ cursor: 'pointer', background: isSelected ? '#e3f2fd' : undefined }}>
                        <td>{isSelected ? <Check color="success" fontSize="small" /> : <SportsBasketball fontSize="small" sx={{ color: '#666' }} />}</td>
                        <td><Typography level="body-sm" sx={{ fontWeight: isSelected ? 700 : 400 }}>{row.game_date}</Typography></td>
                        <td style={{ textAlign: 'right' }}><Typography level="body-sm" sx={{ fontWeight: 600 }}>{Number(row.total_fantasy_points).toFixed(1)}</Typography></td>
                        <td style={{ textAlign: 'right' }}><Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>{formatSalary(Number(row.total_salary))}</Typography></td>
                        <td style={{ textAlign: 'right' }}><Chip size="sm" variant="soft">{playerCount}</Chip></td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Sheet>

            {/* Resolved Lineup Preview */}
            {loadingPlayers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size="sm" /><Typography level="body-sm" sx={{ ml: 2 }}>Resolving players & loading game files...</Typography></Box>
            ) : resolvedPlayers.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 1.5 }}>Lineup — {draft.game_date}</Typography>
                  <Stack gap={0.5}>
                    {resolvedPlayers.map(p => {
                      // Check if this player has matched game data
                      const hasGameData = matchedGameData.some(gd =>
                        gd.playerStats.some((ps: any) => Number(ps.personId) === p.nba_player_id)
                      )
                      const gameStat = matchedGameData.flatMap(gd => gd.playerStats).find((ps: any) => Number(ps.personId) === p.nba_player_id)
                      return (
                        <Stack key={p.id} direction="row" alignItems="center" gap={1} sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Chip size="sm" variant={p.role === 'Starter' ? 'solid' : 'outlined'} color={p.role === 'Starter' ? 'primary' : 'neutral'} sx={{ minWidth: 24, textAlign: 'center' }}>
                            {p.slot.toUpperCase()}
                          </Chip>
                          <Typography level="body-sm" sx={{ fontWeight: 600, flex: 1 }}>{p.name}</Typography>
                          <Chip size="sm" variant="soft">{p.team_abbreviation || '?'}</Chip>
                          {gameStat && (
                            <Typography level="body-xs" sx={{ color: '#333', minWidth: 100, textAlign: 'right' }}>
                              {gameStat.pts ?? '—'}p {gameStat.reb ?? '—'}r {gameStat.ast ?? '—'}a
                            </Typography>
                          )}
                          <Typography level="body-xs" sx={{ fontWeight: 600, minWidth: 50, textAlign: 'right' }}>{p.fantasy_points.toFixed(1)} FP</Typography>
                          <Chip size="sm" variant="soft" color={hasGameData ? 'success' : 'warning'} sx={{ minWidth: 24, fontSize: '0.65rem' }}>
                            {hasGameData ? '✓' : '?'}
                          </Chip>
                        </Stack>
                      )
                    })}
                  </Stack>
                  {matchedGameData.length > 0 ? (
                    <Alert color="success" variant="soft" sx={{ mt: 2 }}>
                      <strong>{matchedGameData.length} game file{matchedGameData.length !== 1 ? 's' : ''}</strong> matched — {resolvedPlayers.filter(p => matchedGameData.some(gd => gd.playerStats.some((ps: any) => Number(ps.personId) === p.nba_player_id))).length}/{resolvedPlayers.length} players have stats
                    </Alert>
                  ) : (
                    <Alert color="warning" variant="soft" sx={{ mt: 2 }}>
                      No game play-by-play data found for {draft.game_date}. <strong>Highlight slideshows will not be added</strong> to this post. Scrape full game JSON for this date (e.g. <code>scripts/feed/scrape_games_date_range.py</code>) so <code>scripts/feed/&lt;game_id&gt;.json</code> includes MP4 clips in <code>playByPlay</code>, then re-select this TOTN row to load them.
                    </Alert>
                  )}

                  {/* Table: game IDs + nba_boxscores stats per player, ✓ in /feed/, ✓ has mp4 */}
                  {totnBoxscores.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography level="title-sm" sx={{ mb: 1 }}>Games &amp; stats (nba_boxscores) — /feed/ and MP4 status</Typography>
                      <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: 360 }}>
                        <Table size="sm" stickyHeader>
                          <thead>
                            <tr>
                              <th>Game ID</th>
                              <th>Player</th>
                              <th style={{ textAlign: 'right' }}>PTS</th>
                              <th style={{ textAlign: 'right' }}>REB</th>
                              <th style={{ textAlign: 'right' }}>AST</th>
                              <th style={{ textAlign: 'right' }}>MIN</th>
                              <th style={{ textAlign: 'center' }}>In /feed/</th>
                              <th style={{ textAlign: 'center' }}>Has MP4</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...totnBoxscores]
                              .sort((a, b) => a.game_id.localeCompare(b.game_id) || (a.player_name || '').localeCompare(b.player_name || ''))
                              .map((row, i) => {
                                const status = totnGamesFeedStatus.find(s => s.gameId === row.game_id)
                                const minVal = row.min != null ? (typeof row.min === 'string' ? parseFloat(row.min) : row.min) : null
                                return (
                                  <tr key={`${row.game_id}-${row.nba_player_id}-${i}`}>
                                    <td><Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>{row.game_id}</Typography></td>
                                    <td><Typography level="body-sm">{row.player_name ?? resolvedPlayers.find(p => p.nba_player_id === row.nba_player_id)?.name ?? row.nba_player_id}</Typography></td>
                                    <td style={{ textAlign: 'right' }}>{row.pts ?? '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{row.reb ?? '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{row.ast ?? '—'}</td>
                                    <td style={{ textAlign: 'right' }}>{minVal != null ? minVal.toFixed(1) : '—'}</td>
                                    <td style={{ textAlign: 'center' }}>{status?.inFeed ? <Check color="success" fontSize="small" /> : '—'}</td>
                                    <td style={{ textAlign: 'center' }}>{status?.hasMp4 ? <Check color="success" fontSize="small" /> : '—'}</td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </Table>
                      </Sheet>
                    </Box>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TOTN: clips per player for lineup + player highlight sections (games that night) */}
            {resolvedPlayers.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 2 }}>Player highlights (games that night)</Typography>
                  <FormControl sx={{ maxWidth: 360 }}>
                    <FormLabel>Clips per player (1–10)</FormLabel>
                    <Slider
                      value={totnPlayerClipCount}
                      min={1}
                      max={10}
                      step={1}
                      valueLabelDisplay="auto"
                      onChange={(_e, value) => onTotnPlayerClipCountChange(Array.isArray(value) ? value[0] : value)}
                    />
                    <FormHelperText>
                      Each lineup player gets up to {totnPlayerClipCount} highlight clip{totnPlayerClipCount !== 1 ? 's' : ''} in the lineup card and in their player highlight section (from games that night).
                    </FormHelperText>
                  </FormControl>
                </CardContent>
              </Card>
            )}
          </Stack>
        )}
      </Box>
    )
  }

  // ── TOTW ──
  if (mode === 'totw') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>Select Team of the Week</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>Pick a TOTW row. Players will be resolved automatically.</Typography>

        {loadingRows ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : totwRows.length === 0 ? (
          <Alert color="warning" variant="soft">No TOTW rows found in database.</Alert>
        ) : (
          <Stack gap={1.5}>
            <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: 320 }}>
              <Table size="sm" stickyHeader>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Week</th>
                    <th>Period</th>
                    <th style={{ textAlign: 'right' }}>Avg FP</th>
                    <th style={{ textAlign: 'right' }}>Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {totwRows.map(row => {
                    const isSelected = row.id === selectedRowId
                    return (
                      <tr key={row.id} onClick={() => onSelectTotwRow(row)}
                        style={{ cursor: 'pointer', background: isSelected ? '#e3f2fd' : undefined }}>
                        <td>{isSelected ? <Check color="success" fontSize="small" /> : null}</td>
                        <td><Typography level="body-sm" sx={{ fontWeight: isSelected ? 700 : 400 }}>Week {row.week_number}</Typography></td>
                        <td><Typography level="body-xs">{row.week_start} → {row.week_end}</Typography></td>
                        <td style={{ textAlign: 'right' }}><Typography level="body-sm" sx={{ fontWeight: 600 }}>{Number(row.total_avg_fantasy_points).toFixed(1)}</Typography></td>
                        <td style={{ textAlign: 'right' }}><Typography level="body-xs" sx={{ fontFamily: 'monospace' }}>{formatSalary(Number(row.total_salary))}</Typography></td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Sheet>

            {loadingPlayers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size="sm" /></Box>
            ) : resolvedPlayers.length > 0 ? (
              <>
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="title-md" sx={{ mb: 1.5 }}>Lineup</Typography>
                    <Stack gap={0.5}>
                      {resolvedPlayers.map(p => (
                        <Stack key={p.id} direction="row" alignItems="center" gap={1} sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Chip size="sm" variant={p.role === 'Starter' ? 'solid' : 'outlined'} color={p.role === 'Starter' ? 'primary' : 'neutral'} sx={{ minWidth: 24 }}>{p.slot.toUpperCase()}</Chip>
                          <Typography level="body-sm" sx={{ fontWeight: 600, flex: 1 }}>{p.name}</Typography>
                          <Chip size="sm" variant="soft">{p.team_abbreviation || '?'}</Chip>
                          <Typography level="body-xs" sx={{ fontWeight: 600, minWidth: 55, textAlign: 'right' }}>{p.fantasy_points.toFixed(1)} FP</Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: '#666', minWidth: 60, textAlign: 'right' }}>{formatSalary(p.salary)}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="title-md" sx={{ mb: 2 }}>Player highlights (games that week)</Typography>
                    <FormControl sx={{ maxWidth: 360 }}>
                      <FormLabel>Clips per player (1–10)</FormLabel>
                      <Slider
                        value={totwPlayerClipCount}
                        min={1}
                        max={10}
                        step={1}
                        valueLabelDisplay="auto"
                        onChange={(_e, value) => onTotwPlayerClipCountChange(Array.isArray(value) ? value[0] : value)}
                      />
                      <FormHelperText>
                        Each lineup player gets up to {totwPlayerClipCount} highlight clip{totwPlayerClipCount !== 1 ? 's' : ''} in the lineup card and in their player highlight section (from games that week).
                      </FormHelperText>
                    </FormControl>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </Stack>
        )}
      </Box>
    )
  }

  // ── Game Recap / Player Spotlight ──
  if (mode === 'game') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>Select a Game</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>Pick a date to see games, then select one to load its data.</Typography>

        <Stack gap={3}>
          <FormControl>
            <FormLabel>Game Date</FormLabel>
            <Input type="date" value={selectedDate} onChange={(e) => onDateSelected(e.target.value)} />
          </FormControl>

          {loadingGames ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size="sm" /></Box>
          ) : gamesForDate.length > 0 ? (
            <Stack gap={1}>
              <Typography level="title-sm">{gamesForDate.length} game{gamesForDate.length !== 1 ? 's' : ''} on {selectedDate}</Typography>
              {gamesForDate.map(game => {
                const isSelected = matchedGameData.some(d => d.gameId === game.game_id)
                const feedStatus = feedGamesForDate.find(f => f.gameId === game.game_id)
                const hasJson = !!feedStatus
                const hasMp4 = feedStatus?.hasMp4 ?? false
                return (
                  <Card key={game.game_id} variant={isSelected ? 'solid' : 'outlined'} color={isSelected ? 'success' : 'neutral'}
                    sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.400' }, transition: 'all 0.15s' }}
                    onClick={() => onSelectGame(game)}>
                    <CardContent sx={{ p: 1.5 }}>
                      <Stack direction="row" alignItems="center" gap={2}>
                        {hasJson && <Check color="success" fontSize="small" titleAccess="Has JSON file" />}
                        {hasMp4 && <VideoLibrary fontSize="small" color="action" titleAccess="Has MP4 URLs" />}
                        <Typography level="title-md" sx={{ fontWeight: 700 }}>
                          {game.away_team_tricode} {game.away_team_score ?? ''} @ {game.home_team_tricode} {game.home_team_score ?? ''}
                        </Typography>
                        <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: '#666' }}>{game.game_id}</Typography>
                        {game.game_status_text && <Chip size="sm" variant="soft">{game.game_status_text}</Chip>}
                      </Stack>
                    </CardContent>
                  </Card>
                )
              })}
            </Stack>
          ) : selectedDate ? (
            <Typography level="body-sm" sx={{ color: '#666', textAlign: 'center', py: 3 }}>No games found for {selectedDate}</Typography>
          ) : null}

          {/* Game Recap: main carousel + clips per player for top-5 player cards */}
          {draft.post_type === 'game_recap' && matchedGameData.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography level="title-md" sx={{ mb: 2 }}>Game Recap</Typography>
                <Stack gap={2}>
                  {recapClipCount > 0 && (
                    <FormControl>
                      <FormLabel>Game highlights carousel — how many clips? (1–{recapClipCount})</FormLabel>
                      <Slider
                        value={Math.min(recapHighlightCount, recapClipCount)}
                        min={1}
                        max={recapClipCount}
                        step={1}
                        valueLabelDisplay="auto"
                        onChange={(_e, value) => onRecapHighlightCountChange(Array.isArray(value) ? value[0] : value)}
                      />
                      <FormHelperText>
                        {Math.min(recapHighlightCount, recapClipCount)} clip{Math.min(recapHighlightCount, recapClipCount) !== 1 ? 's' : ''} — algorithm picks best plays from score + story
                      </FormHelperText>
                    </FormControl>
                  )}
                  <FormControl>
                    <FormLabel>Clips per player (top 5 cards) — (1–10)</FormLabel>
                    <Slider
                      value={recapPlayerClipCount}
                      min={1}
                      max={10}
                      step={1}
                      valueLabelDisplay="auto"
                      onChange={(_e, value) => onRecapPlayerClipCountChange(Array.isArray(value) ? value[0] : value)}
                    />
                    <FormHelperText>
                      Each player card gets its own slideshow with up to {recapPlayerClipCount} of their best plays
                    </FormHelperText>
                  </FormControl>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Player Spotlight: single vs all players + player picker (only when game selected) */}
          {draft.post_type === 'player_spotlight' && matchedGameData.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography level="title-md" sx={{ mb: 2 }}>Player Spotlight</Typography>
                {availableSpotlightPlayers.length === 0 ? (
                  <Alert color="warning" variant="soft">No players with highlights in this game.</Alert>
                ) : (
                  <Stack gap={2}>
                    <FormControl>
                      <FormLabel>Create posts for</FormLabel>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <Button
                          variant={!spotlightAllPlayers ? 'solid' : 'outlined'}
                          color="neutral"
                          size="sm"
                          onClick={() => onSpotlightAllPlayersChange(false)}
                        >
                          Single player
                        </Button>
                        <Button
                          variant={spotlightAllPlayers ? 'solid' : 'outlined'}
                          color="neutral"
                          size="sm"
                          onClick={() => onSpotlightAllPlayersChange(true)}
                        >
                          All players in game ({availableSpotlightPlayers.length})
                        </Button>
                      </Stack>
                      <FormHelperText>
                        {spotlightAllPlayers
                          ? 'Click Next to generate one post per player with highlights; you\'ll review all posts before publishing.'
                          : 'Choose one player to create a single spotlight post.'}
                      </FormHelperText>
                    </FormControl>
                    {!spotlightAllPlayers && (
                      <>
                        <FormControl>
                          <FormLabel>Select player</FormLabel>
                          <Select
                            placeholder="Choose a player"
                            value={spotlightPlayerId ?? ''}
                            onChange={(_e, v) => onSpotlightPlayerChange(v == null ? null : (v as number))}
                          >
                            {availableSpotlightPlayers.map(({ personId, name }) => (
                              <Option key={personId} value={personId}>{name}</Option>
                            ))}
                          </Select>
                        </FormControl>
                        {spotlightPlayerId != null && spotlightClipCount > 0 && (
                          <FormControl>
                            <FormLabel>How many highlights? (1–{Math.min(20, spotlightClipCount)})</FormLabel>
                            <Slider
                              value={spotlightHighlightCount}
                              min={1}
                              max={Math.min(20, spotlightClipCount)}
                              step={1}
                              valueLabelDisplay="auto"
                              onChange={(_e, value) => onSpotlightHighlightCountChange(Array.isArray(value) ? value[0] : value)}
                            />
                            <FormHelperText>{spotlightHighlightCount} clip{spotlightHighlightCount !== 1 ? 's' : ''}</FormHelperText>
                          </FormControl>
                        )}
                      </>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {/* File Upload Fallback */}
          <Divider />
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-sm" startDecorator={<Upload />} sx={{ mb: 1 }}>Or upload a JSON file</Typography>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) onFileUpload(file) }} />
              <Button variant="soft" color="neutral" onClick={() => fileInputRef.current?.click()} startDecorator={<Upload />} fullWidth>Choose file from disk</Button>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    )
  }

  // ── POW ──
  if (mode === 'pow') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>Select Player of the Week</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>
          Pick an nba_pow row. The featured player will be resolved and post details filled automatically.
        </Typography>

        {loadingRows ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : powRows.length === 0 ? (
          <Alert color="warning" variant="soft">No POW rows found in database.</Alert>
        ) : (
          <Stack gap={1.5}>
            <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: 320 }}>
              <Table size="sm" stickyHeader>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Week start</th>
                    <th>Season</th>
                    <th>Conference</th>
                  </tr>
                </thead>
                <tbody>
                  {powRows.map(row => {
                    const isSelected = row.id === selectedRowId
                    return (
                      <tr key={row.id} onClick={() => onSelectPowRow(row)}
                        style={{ cursor: 'pointer', background: isSelected ? '#e3f2fd' : undefined }}>
                        <td>{isSelected ? <Check color="success" fontSize="small" /> : null}</td>
                        <td><Typography level="body-sm" sx={{ fontWeight: isSelected ? 700 : 400 }}>{row.week_start_date}</Typography></td>
                        <td><Typography level="body-xs">{row.season ?? '—'}</Typography></td>
                        <td><Typography level="body-xs">{row.conference ?? '—'}</Typography></td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Sheet>

            {loadingPlayers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size="sm" /><Typography level="body-sm" sx={{ ml: 2 }}>Resolving player...</Typography></Box>
            ) : resolvedPlayers.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 1.5 }}>Featured player — {draft.game_date}</Typography>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ py: 0.5 }}>
                    <Chip size="sm" variant="solid" color="primary">POW</Chip>
                    <Typography level="body-sm" sx={{ fontWeight: 600, flex: 1 }}>{resolvedPlayers[0].name}</Typography>
                    <Chip size="sm" variant="soft">{resolvedPlayers[0].team_abbreviation || '?'}</Chip>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {resolvedPlayers.length > 0 && (
              <AwardGamesPanel gameLog={awardGameLog} loading={loadingAwardGames} />
            )}

            {resolvedPlayers.length > 0 && matchedGameData.length > 0 && (() => {
              const pid = resolvedPlayers[0].nba_player_id ?? 0
              const totalClips = matchedGameData.reduce((n, gd) => n + gd.playByPlay.filter(pl => pl.personId === pid && pl.mp4).length, 0)
              if (totalClips === 0) return null
              return (
                <Card variant="outlined" sx={{ mt: 0.5 }}>
                  <CardContent sx={{ gap: 1 }}>
                    <Typography level="title-sm">Highlight Clips — {totalClips} available</Typography>
                    <Typography level="body-xs" sx={{ color: '#666' }}>
                      Slide to choose how many highlight clips to include in the post.
                    </Typography>
                    <Slider size="sm" min={0} max={Math.min(totalClips, 20)} value={awardHighlightCount}
                      onChange={(_, v) => onAwardHighlightCountChange(v as number)}
                      marks valueLabelDisplay="auto"
                      sx={{ mt: 1 }} />
                    <Typography level="body-xs" sx={{ fontWeight: 600 }}>{awardHighlightCount} clip{awardHighlightCount !== 1 ? 's' : ''} selected</Typography>
                  </CardContent>
                </Card>
              )
            })()}
          </Stack>
        )}
      </Box>
    )
  }

  // ── POM ──
  if (mode === 'pom') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>Select Player of the Month</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>
          Pick an nba_pom row. The featured player will be resolved and post details filled automatically.
        </Typography>

        {loadingRows ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : pomRows.length === 0 ? (
          <Alert color="warning" variant="soft">No POM rows found in database.</Alert>
        ) : (
          <Stack gap={1.5}>
            <Sheet variant="outlined" sx={{ borderRadius: 'sm', overflow: 'auto', maxHeight: 320 }}>
              <Table size="sm" stickyHeader>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Month</th>
                    <th>Season</th>
                    <th>Conference</th>
                  </tr>
                </thead>
                <tbody>
                  {pomRows.map(row => {
                    const isSelected = row.id === selectedRowId
                    const monthName = new Date(Number(row.award_year), Number(row.award_month) - 1).toLocaleString('default', { month: 'long' })
                    return (
                      <tr key={row.id} onClick={() => onSelectPomRow(row)}
                        style={{ cursor: 'pointer', background: isSelected ? '#e3f2fd' : undefined }}>
                        <td>{isSelected ? <Check color="success" fontSize="small" /> : null}</td>
                        <td><Typography level="body-sm" sx={{ fontWeight: isSelected ? 700 : 400 }}>{monthName} {row.award_year}</Typography></td>
                        <td><Typography level="body-xs">{row.season ?? '—'}</Typography></td>
                        <td><Typography level="body-xs">{row.conference ?? '—'}</Typography></td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Sheet>

            {loadingPlayers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size="sm" /><Typography level="body-sm" sx={{ ml: 2 }}>Resolving player...</Typography></Box>
            ) : resolvedPlayers.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 1.5 }}>Featured player</Typography>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ py: 0.5 }}>
                    <Chip size="sm" variant="solid" color="primary">POM</Chip>
                    <Typography level="body-sm" sx={{ fontWeight: 600, flex: 1 }}>{resolvedPlayers[0].name}</Typography>
                    <Chip size="sm" variant="soft">{resolvedPlayers[0].team_abbreviation || '?'}</Chip>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {resolvedPlayers.length > 0 && (
              <AwardGamesPanel gameLog={awardGameLog} loading={loadingAwardGames} />
            )}

            {resolvedPlayers.length > 0 && matchedGameData.length > 0 && (() => {
              const pid = resolvedPlayers[0].nba_player_id ?? 0
              const totalClips = matchedGameData.reduce((n, gd) => n + gd.playByPlay.filter(pl => pl.personId === pid && pl.mp4).length, 0)
              if (totalClips === 0) return null
              return (
                <Card variant="outlined" sx={{ mt: 0.5 }}>
                  <CardContent sx={{ gap: 1 }}>
                    <Typography level="title-sm">Highlight Clips — {totalClips} available</Typography>
                    <Typography level="body-xs" sx={{ color: '#666' }}>
                      Slide to choose how many highlight clips to include in the post.
                    </Typography>
                    <Slider size="sm" min={0} max={Math.min(totalClips, 20)} value={awardHighlightCount}
                      onChange={(_, v) => onAwardHighlightCountChange(v as number)}
                      marks valueLabelDisplay="auto"
                      sx={{ mt: 1 }} />
                    <Typography level="body-xs" sx={{ fontWeight: 600 }}>{awardHighlightCount} clip{awardHighlightCount !== 1 ? 's' : ''} selected</Typography>
                  </CardContent>
                </Card>
              )
            })()}
          </Stack>
        )}
      </Box>
    )
  }

  // ── Matchup (upcoming, injury_report, prop_prediction, prop_results) ──
  if (mode === 'matchup') {
    const isPropResults = draft.post_type === 'prop_results'
    const isInjuryReport = draft.post_type === 'injury_report'
    const isPropPrediction = draft.post_type === 'prop_prediction'
    const hasMacroOption = (isPropResults || isInjuryReport || isPropPrediction) && selectedDate && gamesForDate.length > 0
    const macroAllOn = (isPropResults && propResultsAllGames) || (isInjuryReport && injuryReportAllGames) || (isPropPrediction && propPredictionAllGames)
    const macroLabel = isPropResults ? 'prop results' : isInjuryReport ? 'injury report' : 'prop predictions'
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>Select a Matchup</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>
          {isPropResults
            ? 'Pick a date. Create one prop results post per game, or choose a single game.'
            : isInjuryReport
              ? 'Pick a date. Create one injury report post per game, or choose a single game.'
              : isPropPrediction
                ? 'Pick a date. Create one prop predictions post per game, or choose a single game.'
                : 'Pick a date and game. The generator will pull injuries, props, stats, and related posts for both teams.'}
        </Typography>

        <Stack gap={3}>
          <FormControl>
            <FormLabel>Game Date</FormLabel>
            <Input type="date" value={selectedDate} onChange={(e) => onDateSelected(e.target.value)} />
          </FormControl>

          {hasMacroOption && (
            <FormControl>
              <FormLabel>Create posts for</FormLabel>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant={!(isPropResults ? propResultsAllGames : isInjuryReport ? injuryReportAllGames : propPredictionAllGames) ? 'solid' : 'outlined'}
                  color="neutral"
                  size="sm"
                  onClick={() => {
                    if (isPropResults) onPropResultsAllGamesChange(false)
                    else if (isInjuryReport) onInjuryReportAllGamesChange(false)
                    else onPropPredictionAllGamesChange(false)
                  }}
                >
                  Single game
                </Button>
                <Button
                  variant={(isPropResults ? propResultsAllGames : isInjuryReport ? injuryReportAllGames : propPredictionAllGames) ? 'solid' : 'outlined'}
                  color="neutral"
                  size="sm"
                  onClick={() => {
                    if (isPropResults) onPropResultsAllGamesChange(true)
                    else if (isInjuryReport) onInjuryReportAllGamesChange(true)
                    else onPropPredictionAllGamesChange(true)
                  }}
                >
                  All games on this date ({gamesForDate.length})
                </Button>
              </Stack>
              <FormHelperText>
                {macroAllOn
                  ? `Click Next to generate one ${macroLabel} post per game; you'll review all posts before publishing.`
                  : 'Choose one game to create a single post.'}
              </FormHelperText>
            </FormControl>
          )}

          {loadingGames ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size="sm" /></Box>
          ) : gamesForDate.length > 0 ? (
            <Stack gap={1}>
              <Typography level="title-sm">{gamesForDate.length} game{gamesForDate.length !== 1 ? 's' : ''} on {selectedDate}</Typography>
              {!macroAllOn && gamesForDate.map(g => {
                const isSelected = draft.game_id === g.game_id
                const feedStatus = feedGamesForDate.find(f => f.gameId === g.game_id)
                const hasJson = !!feedStatus
                const hasMp4 = feedStatus?.hasMp4 ?? false
                return (
                  <Card
                    key={g.game_id}
                    variant={isSelected ? 'solid' : 'outlined'}
                    color={isSelected ? 'primary' : 'neutral'}
                    sx={{ cursor: 'pointer', p: 1.5 }}
                    onClick={() => {
                      onSelectGame(g)
                    }}
                  >
                    <Stack direction="row" alignItems="center" gap={2}>
                      {hasJson && <Check color="success" fontSize="small" titleAccess="Has JSON file" />}
                      {hasMp4 && <VideoLibrary fontSize="small" color="action" titleAccess="Has MP4 URLs" />}
                      {isSelected && <Check color="success" fontSize="small" />}
                      <Typography level="body-sm" sx={{ fontWeight: isSelected ? 700 : 400 }}>
                        {g.away_team_tricode} @ {g.home_team_tricode}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#666' }}>
                        {g.game_status_text || 'Scheduled'}
                      </Typography>
                    </Stack>
                  </Card>
                )
              })}
              {macroAllOn && (
                <Typography level="body-sm" sx={{ color: '#666' }}>
                  {gamesForDate.length} post{gamesForDate.length !== 1 ? 's' : ''} will be generated (one per game).
                </Typography>
              )}
            </Stack>
          ) : selectedDate ? (
            <Alert color="warning" variant="soft">No games found for {selectedDate}.</Alert>
          ) : null}

          {!macroAllOn && draft.team_tricodes.length >= 2 && (
            <Alert color="success" variant="soft">
              <strong>Matchup set:</strong> {draft.team_tricodes.join(' vs ')} — {draft.game_date || selectedDate}
            </Alert>
          )}
        </Stack>
      </Box>
    )
  }

  // ── DFS: snapshot from dfs backend (pools, entries, etc.) ──
  if (draft.post_type === 'dfs') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>DFS snapshot</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>
          This post will capture data from the DFS backend (dfs_pools, dfs_entries, dfs_group_pools, etc.). Continue to add a title, then in <strong>Sections</strong> click <strong>Auto-Generate</strong> to pull current pools and build the post. Full integration with all dfs_* tables will come later.
        </Typography>
        <Alert color="neutral" variant="soft">Click Next, fill in title (e.g. &quot;DFS Pools — 2026-02-26&quot;), then in Sections click Auto-Generate.</Alert>
      </Box>
    )
  }

  // ── Draft: capture current Tank tab state ──
  if (draft.post_type === 'draft') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>Capture Tank standings</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>
          This post will save the <strong>current state</strong> of the Tank tab from the Standings drawer (worst-first standings + draft prospect rankings). Continue to add a title and subtitle, then in <strong>Sections</strong> click <strong>Auto-Generate</strong> to snapshot the data. The published post will show the tank table only — no East/West/Overall tabs.
        </Typography>
        <Alert color="neutral" variant="soft">Click Next, fill in title (e.g. &quot;Tank Race — 2025-26&quot;), then in Sections click Auto-Generate to capture the current Tank state.</Alert>
      </Box>
    )
  }

  // ── Manual (blog, etc.) ──
  return (
    <Box>
      <Typography level="h4" sx={{ mb: 1 }}>Manual Entry</Typography>
      <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>
        This post type uses manual entry. Continue to the next step to fill in details and build sections.
      </Typography>
      <Alert color="neutral" variant="soft">No data source needed. Click Next to continue.</Alert>
    </Box>
  )
}


// ==========================================================================
// STEP 2 — Post Details
// ==========================================================================

function StepPostDetails({
  draft, onUpdate, resolvedPlayers, matchedGameData,
}: {
  draft: PostDraft
  onUpdate: (updates: Partial<PostDraft>) => void
  resolvedPlayers: ResolvedPlayer[]
  matchedGameData: GameData[]
}) {
  return (
    <Box>
      <Typography level="h4" sx={{ mb: 1 }}>Post Details</Typography>
      <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>Configure the post metadata. Fields marked with * are required.</Typography>

      <Stack gap={2.5}>
        <FormControl required>
          <FormLabel>Title *</FormLabel>
          <Input placeholder="e.g. Team of the Night — 2026-02-08" value={draft.title}
            onChange={(e) => {
              const newTitle = e.target.value
              onUpdate({ title: newTitle, slug: generateSlug(newTitle, draft.game_date || undefined) })
            }} />
        </FormControl>

        <FormControl>
          <FormLabel>Subtitle</FormLabel>
          <Input placeholder="e.g. 605.9 Total Fantasy Points" value={draft.subtitle} onChange={(e) => onUpdate({ subtitle: e.target.value })} />
        </FormControl>

        <FormControl>
          <FormLabel>Description</FormLabel>
          <Textarea placeholder="Short description for feed card preview..." minRows={2} maxRows={4} value={draft.description} onChange={(e) => onUpdate({ description: e.target.value })} />
        </FormControl>

        <FormControl required>
          <FormLabel>Slug *</FormLabel>
          <Input placeholder="team-of-the-night-2026-02-08-a3f2" value={draft.slug} onChange={(e) => onUpdate({ slug: e.target.value })}
            startDecorator={<Typography level="body-xs" sx={{ color: '#666' }}>/feed/</Typography>} />
          <FormHelperText>URL-safe identifier. Auto-generated from title.</FormHelperText>
        </FormControl>

        <Divider />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <FormControl>
            <FormLabel>Game ID</FormLabel>
            <Input placeholder="0022500376" value={draft.game_id} onChange={(e) => onUpdate({ game_id: e.target.value })} sx={{ fontFamily: 'monospace' }} />
          </FormControl>
          <FormControl>
            <FormLabel>Game Date</FormLabel>
            <Input type="date" value={draft.game_date} onChange={(e) => onUpdate({ game_date: e.target.value })} />
          </FormControl>
          <FormControl>
            <FormLabel>Primary Player ID</FormLabel>
            <Input placeholder="e.g. 1628369 (Jayson Tatum)" value={draft.person_id} onChange={(e) => onUpdate({ person_id: e.target.value })} sx={{ fontFamily: 'monospace' }} />
            <FormHelperText>For spotlights/awards — the featured player</FormHelperText>
          </FormControl>
          <FormControl>
            <FormLabel>Cover Image URL</FormLabel>
            <Input placeholder="https://..." value={draft.cover_image_url} onChange={(e) => onUpdate({ cover_image_url: e.target.value })} />
            {draft.cover_image_url && (
              <Box sx={{ mt: 1, borderRadius: 'sm', overflow: 'hidden', maxWidth: 200 }}>
                <img src={draft.cover_image_url} alt="Cover preview" style={{ width: '100%', display: 'block', borderRadius: 8 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </Box>
            )}
            {(draft.post_type === 'team_of_night' || draft.post_type === 'team_of_week') && (resolvedPlayers.length > 0 || matchedGameData.length > 0 || draft.game_date || draft.team_tricodes.length > 0) && (
              <Alert size="sm" color="neutral" variant="soft" sx={{ mt: 1.5 }}>
                <Typography level="body-xs" sx={{ fontWeight: 600, mb: 0.5 }}>Cover image search hints</Typography>
                <Stack component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 0.25 } }}>
                  {draft.game_date && <li><strong>Date:</strong> {draft.game_date}</li>}
                  {draft.team_tricodes.length > 0 && <li><strong>Teams:</strong> {draft.team_tricodes.join(', ')}</li>}
                  {matchedGameData.length > 0 && (
                    <li><strong>Matchups:</strong> {matchedGameData.map(g => g.matchup || g.gameId).filter(Boolean).join(' · ') || matchedGameData.map(g => g.gameId).join(', ')}</li>
                  )}
                  {matchedGameData.length > 0 && <li><strong>Game IDs:</strong> {matchedGameData.map(g => g.gameId).join(', ')}</li>}
                  {resolvedPlayers.length > 0 && (
                    <li><strong>Players:</strong> {resolvedPlayers.slice(0, 12).map(p => p.name).join(', ')}{resolvedPlayers.length > 12 ? ` (+${resolvedPlayers.length - 12} more)` : ''}</li>
                  )}
                </Stack>
              </Alert>
            )}
          </FormControl>
        </Box>

        <Divider />

        <FormControl>
          <FormLabel>Team Tricodes</FormLabel>
          <Input placeholder="e.g. BOS, IND (comma-separated)" value={draft.team_tricodes.join(', ')}
            onChange={(e) => { const codes = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean); onUpdate({ team_tricodes: codes }) }} />
          {draft.team_tricodes.length > 0 && (
            <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>{draft.team_tricodes.map(t => <Chip key={t} size="sm" variant="soft" color="primary">{t}</Chip>)}</Stack>
          )}
        </FormControl>

        <FormControl>
          <FormLabel>Tags</FormLabel>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {TAG_OPTIONS.map(tag => (
              <Chip key={tag} variant={draft.tags.includes(tag) ? 'solid' : 'outlined'} color={draft.tags.includes(tag) ? 'primary' : 'neutral'} sx={{ cursor: 'pointer' }}
                onClick={() => onUpdate({ tags: draft.tags.includes(tag) ? draft.tags.filter(t => t !== tag) : [...draft.tags, tag] })}>{tag}</Chip>
            ))}
          </Stack>
        </FormControl>

        {/* Data summary */}
        {resolvedPlayers.length > 0 && (
          <Alert color="neutral" variant="soft">
            <strong>Lineup loaded:</strong> {resolvedPlayers.length} players from {resolvedPlayers.filter(p => p.role === 'Starter').length} starters + {resolvedPlayers.filter(p => p.role === 'Bench').length} bench
            <br />Teams: {draft.team_tricodes.join(', ')} | NBA Player IDs: {draft.player_ids.length}
          </Alert>
        )}
        {matchedGameData.length > 0 && (
          <Alert color="neutral" variant="soft">
            <strong>Game data:</strong> {matchedGameData.map(g => g.matchup || g.gameId).join(', ')}
            {matchedGameData[0]?.funScore != null && ` — Fun Score: ${matchedGameData[0].funScore}`}
          </Alert>
        )}
      </Stack>
    </Box>
  )
}


// ==========================================================================
// STEP 3 — Sections Builder
// ==========================================================================

function StepSections({
  draft, onAddSection, onRemoveSection, onMoveSection, onUpdateSection,
  addSectionOpen, onSetAddSectionOpen, editingSectionIdx, onSetEditingSectionIdx, onAutoGenerate,
  playerHighlightCounts = {}, lineupClipCount,
}: {
  draft: PostDraft
  onAddSection: (type: SectionType) => void; onRemoveSection: (idx: number) => void
  onMoveSection: (idx: number, dir: 'up' | 'down') => void; onUpdateSection: (idx: number, updates: Partial<SectionDraft>) => void
  addSectionOpen: boolean; onSetAddSectionOpen: (open: boolean) => void
  editingSectionIdx: number | null; onSetEditingSectionIdx: (idx: number | null) => void
  onAutoGenerate?: () => void
  /** For TOTW/TOTN: nba_player_id -> total MP4 plays found for the week */
  playerHighlightCounts?: Record<number, number>
  /** Max clips per player slideshow (from form); shown next to total for player_highlight sections */
  lineupClipCount?: number
}) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography level="h4">Content Sections</Typography>
        <Stack direction="row" gap={1}>
          {onAutoGenerate && <Button size="sm" variant="soft" color="warning" onClick={onAutoGenerate}>Auto-Generate</Button>}
          <Button size="sm" variant="solid" startDecorator={<Add />} onClick={() => onSetAddSectionOpen(true)}>Add Section</Button>
        </Stack>
      </Stack>
      <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>Build the story by adding content sections.</Typography>

      {draft.sections.length === 0 ? (
        <Card variant="outlined" sx={{ py: 6, textAlign: 'center' }}>
          <Typography level="body-lg" sx={{ color: '#666', mb: 2 }}>No sections yet</Typography>
          <Typography level="body-sm" sx={{ color: '#666', mb: 3 }}>
            {draft.post_type === 'draft'
              ? 'Click Auto-Generate above to capture the current Tank standings and draft prospects from the Standings module. You can then add a title and publish.'
              : 'Add sections to build your story, or auto-generate from loaded data.'}
          </Typography>
          {onAutoGenerate && draft.post_type === 'draft' ? (
            <Button variant="soft" color="warning" onClick={onAutoGenerate}>Capture current Tank state</Button>
          ) : (
            <Button variant="soft" startDecorator={<Add />} onClick={() => onSetAddSectionOpen(true)}>Add First Section</Button>
          )}
        </Card>
      ) : (
        <Stack gap={1.5}>
          {draft.sections.map((section, idx) => {
            const typeOpt = SECTION_TYPE_OPTIONS.find(o => o.value === section.section_type)
            return (
              <Card key={section.id} variant="outlined" sx={{ border: editingSectionIdx === idx ? '2px solid' : '1px solid', borderColor: editingSectionIdx === idx ? 'primary.400' : 'divider' }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography level="body-xs" sx={{ color: '#666', minWidth: 20, textAlign: 'center' }}>{idx + 1}</Typography>
                    <Chip size="sm" variant="soft" color="primary">{typeOpt?.label || section.section_type}</Chip>
                    {section.title && <Typography level="body-sm" sx={{ flex: 1 }} noWrap>{section.title}</Typography>}
                    {section.section_type === 'player_highlight' && section.content?.player_id != null && Number(section.content.player_id) in playerHighlightCounts && (
                      <Typography level="body-xs" sx={{ color: '#666', whiteSpace: 'nowrap' }}>
                        {(section.content?.video_clips?.length ?? 0)} / {playerHighlightCounts[Number(section.content.player_id)]} plays
                        {lineupClipCount != null && ` (max ${lineupClipCount})`}
                      </Typography>
                    )}
                    {section.team_tricode && <Chip size="sm" variant="outlined">{section.team_tricode}</Chip>}
                    <Box sx={{ flex: 1 }} />
                    <IconButton size="sm" variant="plain" disabled={idx === 0} onClick={() => onMoveSection(idx, 'up')}>▲</IconButton>
                    <IconButton size="sm" variant="plain" disabled={idx === draft.sections.length - 1} onClick={() => onMoveSection(idx, 'down')}>▼</IconButton>
                    <IconButton size="sm" variant="plain" color="primary" onClick={() => onSetEditingSectionIdx(editingSectionIdx === idx ? null : idx)}>
                      {editingSectionIdx === idx ? <Close /> : <TextFields />}
                    </IconButton>
                    <IconButton size="sm" variant="plain" color="danger" onClick={() => onRemoveSection(idx)}><Delete /></IconButton>
                  </Stack>
                  {editingSectionIdx === idx && (
                    <Box sx={{ mt: 2, pl: 4 }}><SectionEditor section={section} onUpdate={(updates) => onUpdateSection(idx, updates)} /></Box>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      )}

      <Modal open={addSectionOpen} onClose={() => onSetAddSectionOpen(false)}>
        <ModalDialog sx={{ maxWidth: 600 }}>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>Add Section</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, maxHeight: 400, overflow: 'auto' }}>
            {SECTION_TYPE_OPTIONS.map(opt => (
              <Card key={opt.value} variant="outlined" sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.400', transform: 'translateY(-1px)', boxShadow: 'sm' }, transition: 'all 0.15s' }}
                onClick={() => onAddSection(opt.value)}>
                <CardContent sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
                    <Box sx={{ color: 'primary.500' }}>{opt.icon}</Box>
                    <Typography level="title-sm">{opt.label}</Typography>
                  </Stack>
                  <Typography level="body-xs" sx={{ color: '#666' }}>{opt.description}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </ModalDialog>
      </Modal>
    </Box>
  )
}


// ==========================================================================
// Section Editor
// ==========================================================================

function SectionEditor({ section, onUpdate }: { section: SectionDraft; onUpdate: (updates: Partial<SectionDraft>) => void }) {
  const content = section.content || {}
  const updateContent = (patch: Record<string, any>) => onUpdate({ content: { ...content, ...patch } })

  return (
    <Stack gap={2}>
      <FormControl>
        <FormLabel>Section Title</FormLabel>
        <Input size="sm" placeholder="Optional section heading" value={section.title} onChange={(e) => onUpdate({ title: e.target.value })} />
      </FormControl>

      {section.section_type === 'hero' && (
        <>
          <FormControl><FormLabel>Image URL</FormLabel><Input size="sm" value={content.image_url || ''} onChange={(e) => updateContent({ image_url: e.target.value })} placeholder="https://..." /></FormControl>
          <FormControl><FormLabel>Badge Text</FormLabel><Input size="sm" value={content.badge || ''} onChange={(e) => updateContent({ badge: e.target.value })} placeholder="e.g. TEAM OF THE NIGHT" /></FormControl>
          <FormControl><FormLabel>Team Tricode</FormLabel><Input size="sm" value={content.team_tricode || ''} onChange={(e) => updateContent({ team_tricode: e.target.value })} placeholder="e.g. BOS" /></FormControl>
        </>
      )}

      {section.section_type === 'headline' && (
        <>
          <FormControl><FormLabel>Text</FormLabel><Input size="sm" value={content.text || ''} onChange={(e) => updateContent({ text: e.target.value })} /></FormControl>
          <FormControl><FormLabel>Subtitle</FormLabel><Input size="sm" value={content.subtitle || ''} onChange={(e) => updateContent({ subtitle: e.target.value })} /></FormControl>
          <FormControl><FormLabel>Accent Color</FormLabel><Input size="sm" type="color" value={content.accent_color || '#FFC72C'} onChange={(e) => updateContent({ accent_color: e.target.value })} /></FormControl>
        </>
      )}

      {section.section_type === 'rich_text' && (
        <FormControl>
          <FormLabel>Content (supports inline post links)</FormLabel>
          <RichTextEditor
            value={content.markdown || ''}
            onChange={(md) => updateContent({ markdown: md })}
            placeholder="Narrative content — use the link button to reference other posts..."
            minRows={4}
            maxRows={12}
          />
        </FormControl>
      )}

      {section.section_type === 'player_highlight' && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <FormControl><FormLabel>Player Name</FormLabel><Input size="sm" value={content.name || ''} onChange={(e) => updateContent({ name: e.target.value })} /></FormControl>
            <FormControl><FormLabel>Player ID</FormLabel><Input size="sm" type="number" value={content.player_id || ''} onChange={(e) => { updateContent({ player_id: Number(e.target.value) }); onUpdate({ player_id: Number(e.target.value) || null }) }} /></FormControl>
            <FormControl><FormLabel>Team Tricode</FormLabel><Input size="sm" value={content.team_tricode || ''} onChange={(e) => { updateContent({ team_tricode: e.target.value }); onUpdate({ team_tricode: e.target.value || null }) }} /></FormControl>
            <FormControl><FormLabel>Fantasy Points</FormLabel><Input size="sm" type="number" value={content.fantasy_points ?? ''} onChange={(e) => updateContent({ fantasy_points: Number(e.target.value) || undefined })} /></FormControl>
          </Box>
          <Typography level="body-xs" sx={{ fontWeight: 600 }}>Stats</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
            {['pts', 'reb', 'ast', 'stl', 'blk', 'min'].map(stat => (
              <FormControl key={stat}><FormLabel>{stat.toUpperCase()}</FormLabel><Input size="sm" type="number" value={content.stats?.[stat] ?? ''}
                onChange={(e) => updateContent({ stats: { ...(content.stats || {}), [stat]: Number(e.target.value) } })} /></FormControl>
            ))}
          </Box>
          <FormControl><FormLabel>Video URL</FormLabel><Input size="sm" value={content.video_url || ''} onChange={(e) => updateContent({ video_url: e.target.value })} placeholder="https://..." /></FormControl>
        </>
      )}

      {section.section_type === 'stat_comparison' && (
        <>
          <FormControl><FormLabel>Stat Name</FormLabel><Input size="sm" value={content.stat_name || content.title || ''} onChange={(e) => updateContent({ stat_name: e.target.value, title: e.target.value })} /></FormControl>
          <Typography level="body-xs" sx={{ fontWeight: 600 }}>Teams</Typography>
          {(content.teams || [{ tricode: '', value: 0 }, { tricode: '', value: 0 }]).map((team: any, i: number) => (
            <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <FormControl><FormLabel>Team {i + 1} Tricode</FormLabel><Input size="sm" value={team.tricode || ''} onChange={(e) => { const teams = [...(content.teams || [{ tricode: '', value: 0 }, { tricode: '', value: 0 }])]; teams[i] = { ...teams[i], tricode: e.target.value }; updateContent({ teams }) }} /></FormControl>
              <FormControl><FormLabel>Value</FormLabel><Input size="sm" type="number" value={team.value ?? ''} onChange={(e) => { const teams = [...(content.teams || [{ tricode: '', value: 0 }, { tricode: '', value: 0 }])]; teams[i] = { ...teams[i], value: Number(e.target.value) }; updateContent({ teams }) }} /></FormControl>
            </Box>
          ))}
        </>
      )}

      {section.section_type === 'video_clip' && (
        <>
          <FormControl><FormLabel>Video URL</FormLabel><Input size="sm" value={content.video_url || ''} onChange={(e) => updateContent({ video_url: e.target.value })} placeholder="https://..." /></FormControl>
          <FormControl><FormLabel>Thumbnail URL</FormLabel><Input size="sm" value={content.thumbnail_url || ''} onChange={(e) => updateContent({ thumbnail_url: e.target.value })} placeholder="https://..." /></FormControl>
          <FormControl><FormLabel>Caption</FormLabel><Input size="sm" value={content.caption || ''} onChange={(e) => updateContent({ caption: e.target.value })} /></FormControl>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <FormControl><FormLabel>Action Type</FormLabel><Input size="sm" value={content.action_type || ''} onChange={(e) => updateContent({ action_type: e.target.value })} placeholder="e.g. dunk" /></FormControl>
            <FormControl><FormLabel>Period</FormLabel><Input size="sm" type="number" value={content.period ?? ''} onChange={(e) => updateContent({ period: Number(e.target.value) || undefined })} /></FormControl>
          </Box>
        </>
      )}

      {section.section_type === 'video_carousel' && (
        <>
          <Typography level="body-sm" sx={{ fontWeight: 600 }}>Clips (MP4 URL + optional play metadata)</Typography>
          <Stack gap={1.5}>
            {(content.clips || []).map((clip: { mp4?: string; description?: string; action_type?: string; period?: number; clock?: string }, i: number) => (
              <Card key={i} variant="outlined" size="sm">
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" gap={1}>
                    <Stack gap={1} sx={{ flex: 1 }}>
                      <FormControl size="sm"><FormLabel>MP4 URL</FormLabel><Input size="sm" value={clip.mp4 || ''} onChange={(e) => { const clips = [...(content.clips || [])]; clips[i] = { ...clips[i], mp4: e.target.value }; updateContent({ clips }) }} placeholder="https://...nba.com/..." /></FormControl>
                      <FormControl size="sm"><FormLabel>Description</FormLabel><Input size="sm" value={clip.description || ''} onChange={(e) => { const clips = [...(content.clips || [])]; clips[i] = { ...clips[i], description: e.target.value }; updateContent({ clips }) }} placeholder="e.g. Luka Dončić 3PT" /></FormControl>
                      <Stack direction="row" gap={1}>
                        <FormControl size="sm"><FormLabel>Action type</FormLabel><Input size="sm" value={clip.action_type || ''} onChange={(e) => { const clips = [...(content.clips || [])]; clips[i] = { ...clips[i], action_type: e.target.value }; updateContent({ clips }) }} placeholder="2PT, 3PT, dunk" /></FormControl>
                        <FormControl size="sm"><FormLabel>Period</FormLabel><Input size="sm" type="number" value={clip.period ?? ''} onChange={(e) => { const clips = [...(content.clips || [])]; clips[i] = { ...clips[i], period: Number(e.target.value) || undefined }; updateContent({ clips }) }} /></FormControl>
                        <FormControl size="sm"><FormLabel>Clock</FormLabel><Input size="sm" value={clip.clock || ''} onChange={(e) => { const clips = [...(content.clips || [])]; clips[i] = { ...clips[i], clock: e.target.value }; updateContent({ clips }) }} placeholder="5:42" /></FormControl>
                      </Stack>
                    </Stack>
                    <IconButton size="sm" color="danger" variant="plain" onClick={() => { const clips = (content.clips || []).filter((_: any, j: number) => j !== i); updateContent({ clips }) }}><Delete /></IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
          <Button size="sm" variant="soft" startIcon={<Add />} onClick={() => updateContent({ clips: [...(content.clips || []), { mp4: '', description: '', action_type: '', clock: '' }] })}>Add clip</Button>
        </>
      )}

      {section.section_type === 'pull_quote' && (
        <>
          <FormControl><FormLabel>Quote Text</FormLabel><Textarea size="sm" minRows={2} value={content.text || ''} onChange={(e) => updateContent({ text: e.target.value })} /></FormControl>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <FormControl><FormLabel>Attribution</FormLabel><Input size="sm" value={content.attribution || ''} onChange={(e) => updateContent({ attribution: e.target.value })} placeholder="e.g. HoopGeek Algorithm" /></FormControl>
            <FormControl><FormLabel>Icon</FormLabel><Select size="sm" value={content.icon || 'chart'} onChange={(_, v) => updateContent({ icon: v })}><Option value="fire">Fire</Option><Option value="trophy">Trophy</Option><Option value="chart">Chart</Option></Select></FormControl>
          </Box>
          <FormControl><FormLabel>Accent Color</FormLabel><Input size="sm" type="color" value={content.accent_color || '#FFC72C'} onChange={(e) => updateContent({ accent_color: e.target.value })} /></FormControl>
        </>
      )}

      {section.section_type === 'prop_card' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <FormControl><FormLabel>Player Name</FormLabel><Input size="sm" value={content.player_name || ''} onChange={(e) => updateContent({ player_name: e.target.value })} /></FormControl>
          <FormControl><FormLabel>Player ID</FormLabel><Input size="sm" type="number" value={content.player_id || ''} onChange={(e) => updateContent({ player_id: Number(e.target.value) })} /></FormControl>
          <FormControl><FormLabel>Bet Type</FormLabel><Select size="sm" value={content.bet_type || 'points'} onChange={(_, v) => updateContent({ bet_type: v })}><Option value="points">Points</Option><Option value="rebounds">Rebounds</Option><Option value="assists">Assists</Option><Option value="threes">Threes</Option><Option value="pts+reb+ast">PRA</Option></Select></FormControl>
          <FormControl><FormLabel>Line</FormLabel><Input size="sm" type="number" value={content.line ?? ''} onChange={(e) => updateContent({ line: Number(e.target.value) })} /></FormControl>
          <FormControl><FormLabel>Result</FormLabel><Select size="sm" value={content.result || 'pending'} onChange={(_, v) => updateContent({ result: v })}><Option value="pending">Pending</Option><Option value="over">Over</Option><Option value="under">Under</Option><Option value="push">Push</Option></Select></FormControl>
          <FormControl><FormLabel>Confidence (0-100)</FormLabel><Input size="sm" type="number" value={content.confidence ?? ''} onChange={(e) => updateContent({ confidence: Number(e.target.value) || undefined })} /></FormControl>
        </Box>
      )}

      {section.section_type === 'injury_card' && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <FormControl><FormLabel>Player Name</FormLabel><Input size="sm" value={content.player_name || ''} onChange={(e) => updateContent({ player_name: e.target.value })} /></FormControl>
            <FormControl><FormLabel>Player ID</FormLabel><Input size="sm" type="number" value={content.player_id || ''} onChange={(e) => updateContent({ player_id: Number(e.target.value) })} /></FormControl>
            <FormControl><FormLabel>Team Tricode</FormLabel><Input size="sm" value={content.team_tricode || ''} onChange={(e) => updateContent({ team_tricode: e.target.value })} /></FormControl>
            <FormControl><FormLabel>Status</FormLabel><Select size="sm" value={content.status || 'QUESTIONABLE'} onChange={(_, v) => updateContent({ status: v })}><Option value="OUT">OUT</Option><Option value="DOUBTFUL">DOUBTFUL</Option><Option value="QUESTIONABLE">QUESTIONABLE</Option><Option value="PROBABLE">PROBABLE</Option></Select></FormControl>
          </Box>
          <FormControl><FormLabel>Injury</FormLabel><Input size="sm" value={content.injury || ''} onChange={(e) => updateContent({ injury: e.target.value })} placeholder="e.g. Left knee soreness" /></FormControl>
          <FormControl><FormLabel>Expected Return</FormLabel><Input size="sm" value={content.expected_return || ''} onChange={(e) => updateContent({ expected_return: e.target.value })} /></FormControl>
          <FormControl><FormLabel>Impact Note</FormLabel><Textarea size="sm" minRows={2} value={content.impact_note || ''} onChange={(e) => updateContent({ impact_note: e.target.value })} /></FormControl>
        </>
      )}

      {section.section_type === 'chart' && (
        <>
          <FormControl><FormLabel>Chart Type</FormLabel><Select size="sm" value={content.chart_type || 'radar'} onChange={(_, v) => updateContent({ chart_type: v })}><Option value="radar">Radar</Option><Option value="shot_chart">Shot Chart</Option><Option value="efficiency">Efficiency</Option><Option value="scatter">Scatter</Option><Option value="bar">Bar</Option><Option value="donut">Donut</Option></Select></FormControl>
          <FormControl><FormLabel>Caption</FormLabel><Input size="sm" value={content.caption || ''} onChange={(e) => updateContent({ caption: e.target.value })} /></FormControl>
          <FormControl><FormLabel>Chart Props (JSON)</FormLabel><Textarea size="sm" minRows={3} value={JSON.stringify(content.chart_props || {}, null, 2)} onChange={(e) => { try { updateContent({ chart_props: JSON.parse(e.target.value) }) } catch {} }} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }} /></FormControl>
        </>
      )}

      {(section.section_type === 'gallery') && (
        <FormControl><FormLabel>Images (one URL per line, optionally followed by | caption)</FormLabel>
          <Textarea size="sm" minRows={3} value={(content.images || []).map((img: any) => img.caption ? `${img.url} | ${img.caption}` : img.url).join('\n')}
            onChange={(e) => { const images = e.target.value.split('\n').filter(Boolean).map(line => { const [url, ...c] = line.split('|'); return { url: url.trim(), caption: c.join('|').trim() || undefined } }); updateContent({ images }) }}
            placeholder="https://img1.jpg | Caption&#10;https://img2.jpg" /></FormControl>
      )}

      {(section.section_type === 'lineup_card' || section.section_type === 'box_score') && (
        <Alert color="neutral" variant="soft">
          <Typography level="body-sm">This data is typically auto-generated. Edit the raw JSON below if needed.</Typography>
          <Textarea size="sm" minRows={4} sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.7rem' }}
            value={JSON.stringify(content, null, 2)} onChange={(e) => { try { onUpdate({ content: JSON.parse(e.target.value) }) } catch {} }} />
        </Alert>
      )}

      {section.section_type === 'post_link' && (
        <PostLinkSectionEditor content={content} updateContent={updateContent} />
      )}

      {section.section_type === 'tweet_embed' && (
        <>
          <FormControl>
            <FormLabel>Tweet URL</FormLabel>
            <Input size="sm" value={content.tweet_url || ''} onChange={(e) => updateContent({ tweet_url: e.target.value })} placeholder="https://x.com/ShamsCharania/status/1234567890" />
            <FormHelperText>Paste the full URL from X (twitter.com or x.com)</FormHelperText>
          </FormControl>
          <FormControl>
            <FormLabel>Caption (optional)</FormLabel>
            <Input size="sm" value={content.caption || ''} onChange={(e) => updateContent({ caption: e.target.value })} placeholder="e.g. Source: or Per Shams Charania:" />
          </FormControl>
          <FormControl>
            <FormLabel>Fallback Text (optional)</FormLabel>
            <Input size="sm" value={content.fallback_text || ''} onChange={(e) => updateContent({ fallback_text: e.target.value })} placeholder="Text shown if the embed can't load" />
          </FormControl>
        </>
      )}
    </Stack>
  )
}

function PostLinkSectionEditor({ content, updateContent }: { content: any; updateContent: (patch: Record<string, any>) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleSelect = (ref: LinkedPostRef) => {
    updateContent({
      post_id: ref.post_id,
      slug: ref.slug,
      title: ref.title,
      subtitle: ref.subtitle || '',
      preview_text: ref.subtitle || '',
      post_type: ref.post_type,
      cover_image_url: ref.cover_image_url || '',
      game_date: ref.game_date || '',
      team_tricodes: ref.team_tricodes || [],
    })
  }

  return (
    <Stack gap={2}>
      <Button
        size="sm"
        variant="soft"
        color="warning"
        onClick={() => setPickerOpen(true)}
        sx={{ alignSelf: 'flex-start' }}
      >
        {content.post_id ? 'Change Linked Post' : 'Select Post to Link'}
      </Button>

      {content.post_id && (
        <Card variant="outlined" size="sm" sx={{ borderLeft: '3px solid #FFC72C' }}>
          <CardContent>
            <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip size="sm" variant="soft" color="warning">{(content.post_type || '').replace(/_/g, ' ')}</Chip>
              {content.team_tricodes?.map((t: string) => <Chip key={t} size="sm" variant="outlined">{t}</Chip>)}
              {content.game_date && <Typography level="body-xs" sx={{ color: '#666' }}>{content.game_date}</Typography>}
            </Stack>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>{content.title}</Typography>
            {content.subtitle && <Typography level="body-xs" sx={{ color: '#333' }}>{content.subtitle}</Typography>}
            <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: '#666', mt: 0.5 }}>/feed/{content.slug}</Typography>
          </CardContent>
        </Card>
      )}

      <FormControl>
        <FormLabel>Context (optional)</FormLabel>
        <Input
          size="sm"
          placeholder="e.g. This player was on the Team of the Week last night"
          value={content.context || ''}
          onChange={(e) => updateContent({ context: e.target.value })}
        />
        <FormHelperText>Shown above the linked post card as italicized text</FormHelperText>
      </FormControl>

      <FormControl>
        <FormLabel>Hover preview text (optional)</FormLabel>
        <Input
          size="sm"
          placeholder="Extra line for desktop link preview; defaults to subtitle"
          value={content.preview_text || ''}
          onChange={(e) => updateContent({ preview_text: e.target.value })}
        />
        <FormHelperText>Used in feed story Glimpse hover card on desktop</FormHelperText>
      </FormControl>

      <PostLinkPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />
    </Stack>
  )
}


// ==========================================================================
// STEP 4 — Review & Publish (single post)
// ==========================================================================

// ==========================================================================
// STEP 4 (Macro) — Review all generated player spotlight posts
// ==========================================================================

function StepReviewMacro({ drafts, saving, onSaveAll }: { drafts: PostDraft[]; saving: boolean; onSaveAll: (status: PostStatus) => void }) {
  const postType = drafts[0]?.post_type ?? 'player_spotlight'
  const typeOpt = POST_TYPE_OPTIONS.find(o => o.value === postType)
  const macroLabel = postType === 'prop_results' ? 'prop results' : postType === 'injury_report' ? 'injury report' : postType === 'prop_prediction' ? 'prop predictions' : 'player spotlight'
  return (
    <Box>
      <Typography level="h4" sx={{ mb: 1 }}>Review all {macroLabel} posts</Typography>
      <Typography level="body-sm" sx={{ mb: 3, color: '#666' }}>
        {drafts.length} post{drafts.length !== 1 ? 's' : ''} will be created. Use &quot;Save all as draft&quot; or &quot;Publish all&quot; below.
      </Typography>
      <Stack gap={1.5} sx={{ maxHeight: 420, overflow: 'auto' }}>
        {drafts.map((d, i) => (
          <Card key={d.person_id || i} variant="outlined" size="sm">
            <CardContent sx={{ py: 1.5, px: 2 }}>
              <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
                <Chip size="sm" sx={{ bgcolor: typeOpt?.color || '#FFC72C', color: '#000', fontWeight: 600 }}>{typeOpt?.label}</Chip>
                <Typography level="title-sm" sx={{ fontWeight: 600 }}>{d.title || 'Untitled'}</Typography>
                <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: '#666' }}>/feed/{d.slug}</Typography>
                <Chip size="sm" variant="soft">{d.sections.length} section{d.sections.length !== 1 ? 's' : ''}</Chip>
              </Stack>
              {d.subtitle && <Typography level="body-xs" sx={{ color: '#666', mt: 0.5 }}>{d.subtitle}</Typography>}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}

function StepReview({ draft, saving, onSave }: { draft: PostDraft; saving: boolean; onSave: (status: PostStatus) => void }) {
  const typeOpt = POST_TYPE_OPTIONS.find(o => o.value === draft.post_type)
  return (
    <Box>
      <Typography level="h4" sx={{ mb: 3 }}>Review Post</Typography>

      <Card variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
        {draft.cover_image_url && <AspectRatio ratio="16/9" sx={{ minHeight: 120 }}><img src={draft.cover_image_url} alt="cover" style={{ objectFit: 'cover' }} /></AspectRatio>}
        <CardContent>
          <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip size="sm" sx={{ bgcolor: typeOpt?.color || '#FFC72C', color: '#000', fontWeight: 600 }}>{typeOpt?.label || draft.post_type}</Chip>
            {draft.team_tricodes.map(t => <Chip key={t} size="sm" variant="outlined">{t}</Chip>)}
          </Stack>
          <Typography level="h4" sx={{ fontWeight: 700 }}>{draft.title || 'Untitled'}</Typography>
          {draft.subtitle && <Typography level="body-md" sx={{ color: '#333' }}>{draft.subtitle}</Typography>}
          {draft.description && <Typography level="body-sm" sx={{ color: '#666', mt: 0.5 }}>{draft.description}</Typography>}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography level="title-md" sx={{ mb: 2 }}>Post Details</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 1, '& > *:nth-of-type(odd)': { fontWeight: 600, color: '#333', fontSize: '0.8rem' } }}>
            <Typography>Slug</Typography><Typography level="body-sm" sx={{ fontFamily: 'monospace' }}>/feed/{draft.slug}</Typography>
            <Typography>Post Type</Typography><Typography level="body-sm">{typeOpt?.label}</Typography>
            <Typography>Game ID</Typography><Typography level="body-sm" sx={{ fontFamily: 'monospace' }}>{draft.game_id || '—'}</Typography>
            <Typography>Game Date</Typography><Typography level="body-sm">{draft.game_date || '—'}</Typography>
            <Typography>Teams</Typography><Typography level="body-sm">{draft.team_tricodes.join(', ') || '—'}</Typography>
            <Typography>Primary Player</Typography><Typography level="body-sm">{draft.person_id || '—'}</Typography>
            <Typography>Tags</Typography>
            <Stack direction="row" gap={0.5}>{draft.tags.length ? draft.tags.map(t => <Chip key={t} size="sm" variant="soft">{t}</Chip>) : <Typography level="body-sm">—</Typography>}</Stack>
            <Typography>Sections</Typography><Typography level="body-sm">{draft.sections.length} section{draft.sections.length !== 1 ? 's' : ''}</Typography>
          </Box>
        </CardContent>
      </Card>

      {draft.sections.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography level="title-md" sx={{ mb: 1.5 }}>Sections</Typography>
            <Stack gap={0.5}>
              {draft.sections.map((s, i) => {
                const sOpt = SECTION_TYPE_OPTIONS.find(o => o.value === s.section_type)
                return (
                  <Stack key={s.id} direction="row" gap={1} alignItems="center">
                    <Typography level="body-xs" sx={{ minWidth: 20, color: '#666' }}>{i + 1}.</Typography>
                    <Chip size="sm" variant="soft">{sOpt?.label || s.section_type}</Chip>
                    {s.title && <Typography level="body-xs" noWrap>{s.title}</Typography>}
                  </Stack>
                )
              })}
            </Stack>
          </CardContent>
        </Card>
      )}

      {Object.keys(draft.metadata).length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography level="title-md" sx={{ mb: 1 }}>Metadata (JSONB)</Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: '#f5f5f5', borderRadius: 'sm', p: 1 }}>
              <pre style={{ margin: 0, fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(draft.metadata, null, 2).slice(0, 2000)}
                {JSON.stringify(draft.metadata, null, 2).length > 2000 ? '\n...(truncated)' : ''}
              </pre>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}


// ==========================================================================
// Helper: Default section content by type
// ==========================================================================

function getDefaultSectionContent(type: SectionType): any {
  switch (type) {
    case 'hero': return { image_url: '', gradient_overlay: true, badge: '', team_tricode: '' }
    case 'headline': return { text: '', subtitle: '' }
    case 'rich_text': return { markdown: '' }
    case 'player_highlight': return { player_id: 0, name: '', team_tricode: '', stats: {} }
    case 'lineup_card': return { starters: [], bench: [], total_fantasy_points: 0 }
    case 'stat_comparison': return { title: '', teams: [{ tricode: '', value: 0 }, { tricode: '', value: 0 }] }
    case 'video_clip': return { video_url: '', caption: '' }
    case 'video_carousel': return { clips: [] }
    case 'chart': return { chart_type: 'radar', chart_props: {} }
    case 'prop_card': return { player_id: 0, player_name: '', bet_type: 'points', line: 0, result: 'pending' }
    case 'injury_card': return { player_id: 0, player_name: '', team_tricode: '', status: 'QUESTIONABLE', injury: '' }
    case 'pull_quote': return { text: '', icon: 'chart' }
    case 'gallery': return { images: [] }
    case 'box_score': return { home: { tricode: '', players: [] }, away: { tricode: '', players: [] } }
    case 'post_link': return { post_id: '', slug: '', title: '', post_type: 'game_recap', context: '', preview_text: '' }
    case 'tweet_embed': return { tweet_url: '', caption: '', fallback_text: '' }
    case 'injury_module': return { injuries: [], teams: [], date: '' }
    case 'prop_module': return { props: [], teams: [], date: '', mode: 'prediction' }
    case 'team_of_night_module': return { players: [], date: '' }
    case 'team_of_week_module': return { players: [], week_name: '', start_date: '', end_date: '' }
    case 'tank_module': return { rows: [], season: '', snapshot_date: '' }
    case 'dfs_module': return { snapshot_date: '', pools: [], message: '' }
    default: return {}
  }
}
