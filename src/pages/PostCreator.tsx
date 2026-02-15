/**
 * PostCreator — Multi-step form for creating feed posts (all 9 post types).
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
} from '@mui/icons-material'
import { supabase } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import type {
  PostType,
  PostStatus,
  SectionType,
  FeedTag,
  HeroContent,
  HeadlineContent,
  PlayerHighlightContent,
  StatComparisonContent,
  PullQuoteContent,
  LineupPlayer,
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
  dataSourceMode: 'totn' | 'totw' | 'pow' | 'pom' | 'game' | 'manual'
}

const POST_TYPE_OPTIONS: PostTypeOption[] = [
  {
    value: 'game_recap',
    label: 'Game Recap',
    description: 'Full story for a completed NBA game — score, highlights, advantages, play-by-play.',
    icon: <SportsSoccer />,
    color: '#FFC72C',
    tags: ['recap', 'highlights'],
    dataSourceMode: 'game',
  },
  {
    value: 'player_spotlight',
    label: 'Player Spotlight',
    description: 'Standout performance from a single player with stats, highlights, and analysis.',
    icon: <Person />,
    color: '#60A5FA',
    tags: ['highlights'],
    dataSourceMode: 'game',
  },
  {
    value: 'team_of_night',
    label: 'Team of the Night',
    description: 'Daily best-performing lineup with player highlights and data overlays.',
    icon: <Groups />,
    color: '#F59E0B',
    tags: ['awards', 'highlights'],
    dataSourceMode: 'totn',
  },
  {
    value: 'team_of_week',
    label: 'Team of the Week',
    description: 'Weekly best lineup — same model as TOTN but across 7 days.',
    icon: <CalendarMonth />,
    color: '#A78BFA',
    tags: ['awards', 'highlights'],
    dataSourceMode: 'totw',
  },
  {
    value: 'player_of_week',
    label: 'Player of the Week',
    description: 'Weekly MVP spotlight with cumulative stats and key moments.',
    icon: <Star />,
    color: '#34D399',
    tags: ['awards', 'highlights'],
    dataSourceMode: 'pow',
  },
  {
    value: 'player_of_month',
    label: 'Player of the Month',
    description: 'Monthly MVP spotlight with in-depth analysis.',
    icon: <EmojiEvents />,
    color: '#F472B6',
    tags: ['awards', 'analysis'],
    dataSourceMode: 'pom',
  },
  {
    value: 'prop_prediction',
    label: 'Prop Prediction',
    description: 'Pre-game prop predictions with confidence levels and trends.',
    icon: <Casino />,
    color: '#FB923C',
    tags: ['props'],
    theoretical: true,
    dataSourceMode: 'manual',
  },
  {
    value: 'prop_results',
    label: 'Prop Results',
    description: 'Post-game results for prop predictions — overs, unders, pushes.',
    icon: <TrendingUp />,
    color: '#10B981',
    tags: ['props'],
    theoretical: true,
    dataSourceMode: 'manual',
  },
  {
    value: 'injury_report',
    label: 'Injury Report',
    description: 'Daily injury updates — who\'s out, questionable, or returning.',
    icon: <LocalHospital />,
    color: '#EF4444',
    tags: ['injuries'],
    theoretical: true,
    dataSourceMode: 'manual',
  },
]

const SECTION_TYPE_OPTIONS: { value: SectionType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'hero', label: 'Hero Image', icon: <ImageIcon />, description: 'Full-width hero banner with optional badge' },
  { value: 'headline', label: 'Headline', icon: <TextFields />, description: 'Section heading with optional subtitle' },
  { value: 'rich_text', label: 'Rich Text', icon: <TextFields />, description: 'Markdown text block for narrative content' },
  { value: 'player_highlight', label: 'Player Highlight', icon: <Person />, description: 'Player card with stats, headshot, and data overlays' },
  { value: 'lineup_card', label: 'Lineup Card', icon: <Groups />, description: 'Starting lineup with fantasy points and stats' },
  { value: 'stat_comparison', label: 'Stat Comparison', icon: <BarChart />, description: 'Side-by-side team stat comparison' },
  { value: 'video_clip', label: 'Video Clip', icon: <VideoLibrary />, description: 'Embedded video with caption and timestamp' },
  { value: 'chart', label: 'Chart', icon: <BarChart />, description: 'Data visualization — radar, scatter, shot chart, etc.' },
  { value: 'prop_card', label: 'Prop Card', icon: <Casino />, description: 'Player prop prediction or result card' },
  { value: 'injury_card', label: 'Injury Card', icon: <LocalHospital />, description: 'Player injury status card' },
  { value: 'pull_quote', label: 'Pull Quote', icon: <FormatQuote />, description: 'Highlighted quote or stat callout' },
  { value: 'gallery', label: 'Gallery', icon: <Collections />, description: 'Multi-image gallery with captions' },
  { value: 'box_score', label: 'Box Score', icon: <TableChart />, description: 'Full box score table for both teams' },
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

function generateSourceRef(postType: PostType, gameId?: string, gameDate?: string): string {
  if (gameId) return `${postType}:${gameId}`
  if (gameDate) return `${postType}:${gameDate}`
  return `${postType}:${Date.now()}`
}

function extractGameData(json: any): GameData | null {
  const meta = json.gameMetadata || {}
  const home = meta.homeTeam || {}
  const away = meta.awayTeam || {}

  // Skip empty/unplayed game shells (abbreviation is null = no data)
  if (!home.abbreviation && !away.abbreviation) return null

  const scoreData = json.score?.[json.gameId] || {}
  const story = json.story || {}
  const rawStats = json.PlayerStats || []

  // Normalize PlayerStats — the raw NBA data uses long field names.
  // Map to the short names the rest of the app expects.
  const playerStats = rawStats.map((p: any) => ({
    ...p,
    // short aliases (safe even if the field was already present)
    pts: p.points ?? p.pts ?? null,
    reb: p.reboundsTotal ?? p.reb ?? null,
    ast: p.assists ?? p.ast ?? null,
    stl: p.steals ?? p.stl ?? null,
    blk: p.blocks ?? p.blk ?? null,
    min: p.minutes ?? p.min ?? null,
    name: [p.firstName, p.familyName].filter(Boolean).join(' ') || p.name || p.playerName || '',
    playerName: [p.firstName, p.familyName].filter(Boolean).join(' ') || p.playerName || p.name || '',
    fantasyPoints: p.fantasyPoints ?? null,
  }))

  // Extract play-by-play actions (where the mp4 URLs live)
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
  }))

  const teamTricodes = [away.abbreviation, home.abbreviation].filter(Boolean)
  const playerIds = playerStats
    .map((p: any) => p.personId || p.player_id)
    .filter(Boolean)
    .map(Number)
  const matchup = story.matchup || (away.city && home.city ? `${away.city} ${away.name} vs ${home.city} ${home.name}` : '')
  const finalScore = story.final_score || (away.points != null && home.points != null ? `${away.abbreviation} ${away.points} - ${home.abbreviation} ${home.points}` : '')

  return { gameId: json.gameId, gameDate: meta.date ? meta.date.split('T')[0] : null, teamTricodes, playerIds, matchup, finalScore, homeTeam: home, awayTeam: away, funScore: scoreData?.fun_score ?? null, scoreData, story, playerStats, playByPlay, raw: json }
}

/** Pick the best highlight clip(s) for a player from play-by-play data across all games. */
function getPlayerHighlightClips(
  playerId: number,
  allGameData: GameData[],
  maxClips = 3
): PlayByPlayAction[] {
  // Collect all plays for this player that have mp4 links
  const allPlays: PlayByPlayAction[] = []
  for (const gd of allGameData) {
    for (const play of gd.playByPlay) {
      if (play.personId === playerId && play.mp4) {
        allPlays.push(play)
      }
    }
  }
  if (allPlays.length === 0) return []

  // Score plays by excitement — dunks/3pts/blocks > 2pts > other
  const scorePlay = (p: PlayByPlayAction): number => {
    let score = 0
    const action = (p.actionType || '').toLowerCase()
    const sub = (p.subType || '').toLowerCase()
    const desc = (p.description || '').toLowerCase()
    if (action === 'block') score += 8
    if (action === 'steal') score += 7
    if (sub === 'dunk' || desc.includes('dunk')) score += 10
    if (sub === 'alley oop' || desc.includes('alley oop')) score += 9
    if (action === '3pt' || sub === '3pt' || desc.includes('3pt')) score += 6
    if (p.shotResult === 'Made') score += 4
    if (p.isFieldGoal) score += 2
    // Prefer later periods (clutch)
    if (p.period >= 4) score += 3
    return score
  }

  return allPlays
    .sort((a, b) => scorePlay(b) - scorePlay(a))
    .slice(0, maxClips)
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
    .select('id, name, team_abbreviation, nba_player_id')
    .in('id', ids)

  const pMap: Record<string, any> = {}
  for (const p of players || []) pMap[p.id] = p

  const result: ResolvedPlayer[] = []
  for (const s of TOTN_SLOTS) {
    const pid = row[`${s}_player_id`]
    if (!pid) continue
    const info = pMap[pid] || { name: 'Unknown', team_abbreviation: null, nba_player_id: null }
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
    })
  }
  return result
}

/** Fetch games for a given date from nba_games */
async function fetchGamesForDate(gameDate: string): Promise<NbaGame[]> {
  const { data, error } = await supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_status_text')
    .eq('game_date', gameDate)
    .order('game_id')
  if (error) { console.error('Failed to fetch games:', error); return [] }
  return (data || []) as NbaGame[]
}

/** Try to load a game JSON from local dev server. Returns null for missing or empty files. */
async function loadLocalGameJson(gameId: string): Promise<GameData | null> {
  try {
    const res = await fetch(`/api/local-feed/${gameId}.json`)
    if (!res.ok) return null
    const json = await res.json()
    return extractGameData(json) // returns null for empty/unplayed games
  } catch {
    return null
  }
}

// ─── Component ──────────────────────────────────────────────

export default function PostCreator() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeStep, setActiveStep] = useState(0)
  const [draft, setDraft] = useState<PostDraft>({ ...EMPTY_DRAFT })
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color: 'success' | 'danger' | 'warning' }>({ open: false, message: '', color: 'success' })

  // ─── Data source state ─────────────────────────────────────
  // TOTN / TOTW rows
  const [totnRows, setTotnRows] = useState<any[]>([])
  const [totwRows, setTotwRows] = useState<any[]>([])
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [resolvedPlayers, setResolvedPlayers] = useState<ResolvedPlayer[]>([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  // Game picker (for date-based selection)
  const [selectedDate, setSelectedDate] = useState('')
  const [gamesForDate, setGamesForDate] = useState<NbaGame[]>([])
  const [loadingGames, setLoadingGames] = useState(false)

  // Matched game JSONs (loaded from local dev server for the selected date)
  const [matchedGameData, setMatchedGameData] = useState<GameData[]>([])
  const [loadingGameData, setLoadingGameData] = useState(false)

  // Section editor state
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null)

  const currentTypeOption = POST_TYPE_OPTIONS.find(o => o.value === draft.post_type)!
  const dataSourceMode = currentTypeOption.dataSourceMode

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

  // Load data when entering step 1 based on mode
  useEffect(() => {
    if (activeStep !== 1) return
    if (dataSourceMode === 'totn' && totnRows.length === 0) fetchTotnRows()
    if (dataSourceMode === 'totw' && totwRows.length === 0) fetchTotwRows()
  }, [activeStep, dataSourceMode, totnRows.length, totwRows.length, fetchTotnRows, fetchTotwRows])

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

      // ── Load game files by scanning local JSONs for this date ──
      // Uses the /api/local-feed/by-date/:date endpoint (Vite plugin)
      // which filters out empty/unplayed shells automatically.
      setLoadingGameData(true)
      let gameIds: string[] = []
      try {
        const dateRes = await fetch(`/api/local-feed/by-date/${dateStr}`)
        if (dateRes.ok) {
          const dateData = await dateRes.json()
          gameIds = (dateData.games || [])
            .filter((g: any) => g.hasStats)
            .map((g: any) => g.gameId)
        }
      } catch { /* fall through to nba_games */ }

      // Fallback: if Vite plugin date scan found nothing, query nba_games
      if (gameIds.length === 0) {
        const games = await fetchGamesForDate(dateStr)
        setGamesForDate(games)
        gameIds = games.map(g => g.game_id)
      }

      // Load all game JSONs in parallel
      const gameDataResults = await Promise.all(
        gameIds.map(id => loadLocalGameJson(id))
      )
      const loaded = gameDataResults.filter(Boolean) as GameData[]

      // Filter to only games that contain TOTN players
      const nbaIdSet = new Set(nbaPlayerIds)
      const relevantGames = loaded.filter(gd =>
        gd.playerStats.some((ps: any) => nbaIdSet.has(Number(ps.personId)))
      )
      setMatchedGameData(relevantGames)

      setSnackbar({
        open: true,
        message: `TOTN ${dateStr}: ${players.length} players, ${relevantGames.length} games with player data (${loaded.length} total files)`,
        color: 'success',
      })
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
    } finally {
      setLoadingPlayers(false)
      setLoadingGameData(false)
    }
  }, [])

  const selectTotwRow = useCallback(async (row: any) => {
    setSelectedRowId(row.id)
    setLoadingPlayers(true)
    try {
      const players = await resolvePlayersFromRow(row, 'totw')
      setResolvedPlayers(players)

      const teamSet = new Set<string>()
      for (const p of players) {
        if (p.team_abbreviation) teamSet.add(p.team_abbreviation)
      }
      const nbaPlayerIds = players.map(p => p.nba_player_id).filter(Boolean) as number[]
      const totalFP = Number(row.total_avg_fantasy_points) || 0

      setDraft(prev => ({
        ...prev,
        game_date: row.week_start,
        team_tricodes: [...teamSet],
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

      setSnackbar({ open: true, message: `Loaded TOTW Week ${row.week_number}: ${players.length} players`, color: 'success' })
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
    } finally {
      setLoadingPlayers(false)
    }
  }, [])

  // ─── Game date picker (for game_recap / player_spotlight) ──

  const onDateSelected = useCallback(async (date: string) => {
    setSelectedDate(date)
    setLoadingGames(true)
    try {
      const games = await fetchGamesForDate(date)
      setGamesForDate(games)
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, color: 'danger' })
    } finally {
      setLoadingGames(false)
    }
  }, [])

  const selectGame = useCallback(async (game: NbaGame) => {
    setLoadingGameData(true)
    try {
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
            story_data: data.story,
            fun_data: data.scoreData,
            fun_score: data.funScore,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
          },
        }))
        setSnackbar({ open: true, message: `Loaded game: ${data.matchup}`, color: 'success' })
      } else {
        // No local JSON — still populate from nba_games row
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
  }, [])

  // ─── File upload fallback ──────────────────────────────────

  const loadGameFromFile = useCallback((file: File) => {
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
          metadata: { ...prev.metadata, story_data: data.story, fun_data: data.scoreData, fun_score: data.funScore, homeTeam: data.homeTeam, awayTeam: data.awayTeam },
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

  // ─── Auto-generate sections ────────────────────────────────

  const autoGenerateSections = useCallback(() => {
    const sections: SectionDraft[] = []
    let counter = 0
    const nextId = () => `auto-${counter++}-${Math.random().toString(36).slice(2, 6)}`

    // ── TOTN / TOTW: lineup card + player highlights ──
    if (dataSourceMode === 'totn' || dataSourceMode === 'totw') {
      const badgeText = dataSourceMode === 'totn' ? 'TEAM OF THE NIGHT' : 'TEAM OF THE WEEK'

      // Hero
      sections.push({
        id: nextId(), section_type: 'hero', title: '',
        content: { image_url: '', gradient_overlay: true, badge: badgeText } satisfies HeroContent,
        player_id: null, team_tricode: null,
      })

      // Headline
      sections.push({
        id: nextId(), section_type: 'headline', title: '',
        content: { text: draft.title, subtitle: draft.subtitle },
        player_id: null, team_tricode: null,
      })

      // Lineup card from resolved players
      if (resolvedPlayers.length > 0) {
        const starters: LineupPlayer[] = resolvedPlayers
          .filter(p => p.role === 'Starter')
          .map(p => ({
            player_id: p.nba_player_id || 0,
            name: p.name,
            fantasy_points: p.fantasy_points,
            salary: p.salary,
            team_tricode: p.team_abbreviation || '',
          }))
        const bench: LineupPlayer[] = resolvedPlayers
          .filter(p => p.role === 'Bench')
          .map(p => ({
            player_id: p.nba_player_id || 0,
            name: p.name,
            fantasy_points: p.fantasy_points,
            salary: p.salary,
            team_tricode: p.team_abbreviation || '',
          }))

        sections.push({
          id: nextId(), section_type: 'lineup_card', title: badgeText,
          content: {
            starters, bench,
            total_salary: draft.metadata.total_salary,
            total_fantasy_points: draft.metadata.total_fantasy_points || draft.metadata.total_avg_fantasy_points,
            salary_cap: draft.metadata.salary_cap,
          },
          player_id: null, team_tricode: null,
        })
      }

      // Player highlight sections — pull stats + best video clips from game data
      for (const player of resolvedPlayers) {
        let playerStats: Record<string, number> = {}

        // Try to find this player's stats in the matched game data
        if (matchedGameData.length > 0 && player.nba_player_id) {
          for (const gameData of matchedGameData) {
            const found = (gameData.playerStats || []).find(
              (ps: any) => Number(ps.personId || ps.player_id) === player.nba_player_id
            )
            if (found) {
              playerStats = {
                pts: found.pts || 0,
                reb: found.reb || 0,
                ast: found.ast || 0,
                stl: found.stl || 0,
                blk: found.blk || 0,
                min: found.min || 0,
              }
              break
            }
          }
        }

        // Pull best highlight clips from play-by-play
        const clips = player.nba_player_id
          ? getPlayerHighlightClips(player.nba_player_id, matchedGameData, 3)
          : []
        const bestClip = clips[0]

        sections.push({
          id: nextId(),
          section_type: 'player_highlight',
          title: player.name,
          content: {
            player_id: player.nba_player_id || 0,
            name: player.name,
            team_tricode: player.team_abbreviation || '',
            stats: playerStats,
            fantasy_points: player.fantasy_points,
            video_url: bestClip?.mp4 || undefined,
            video_clips: clips.map(c => ({
              mp4: c.mp4!,
              description: c.description,
              action_type: c.actionType,
              period: c.period,
              clock: c.clock,
            })),
            data_overlays: [
              { label: 'Fantasy Pts', value: player.fantasy_points.toFixed(1) },
              { label: 'Salary', value: formatSalary(player.salary) },
              ...(playerStats.pts ? [{ label: 'PTS', value: String(playerStats.pts) }] : []),
              ...(playerStats.reb ? [{ label: 'REB', value: String(playerStats.reb) }] : []),
              ...(playerStats.ast ? [{ label: 'AST', value: String(playerStats.ast) }] : []),
            ],
          } satisfies PlayerHighlightContent,
          player_id: player.nba_player_id || null,
          team_tricode: player.team_abbreviation || null,
        })
      }

    // ── Game Recap / Player Spotlight: from game JSON ──
    } else if (matchedGameData.length > 0) {
      const data = matchedGameData[0]

      // Hero
      sections.push({
        id: nextId(), section_type: 'hero', title: '',
        content: { image_url: '', gradient_overlay: true, badge: 'GAME RECAP', team_tricode: data.teamTricodes[0] || '' } satisfies HeroContent,
        player_id: null, team_tricode: data.teamTricodes[0] || null,
      })

      // Headline
      sections.push({
        id: nextId(), section_type: 'headline', title: '',
        content: { text: data.matchup || draft.title, subtitle: data.finalScore || draft.subtitle },
        player_id: null, team_tricode: null,
      })

      // Stat comparisons
      if (data.story?.advantages?.length) {
        for (const adv of data.story.advantages.slice(0, 4)) {
          sections.push({
            id: nextId(), section_type: 'stat_comparison', title: adv.stat_name,
            content: {
              title: adv.stat_name, stat_name: adv.stat_name,
              teams: [
                { tricode: adv.teamTricode || data.teamTricodes[0] || '', value: adv.value1 },
                { tricode: data.teamTricodes.find((t: string) => t !== adv.teamTricode) || data.teamTricodes[1] || '', value: adv.value2 },
              ],
              diff: adv.diff,
            } satisfies StatComparisonContent,
            player_id: null, team_tricode: null,
          })
        }
      }

      // Top players
      const topPlayers = (data.playerStats || [])
        .filter((p: any) => p.pts != null)
        .sort((a: any, b: any) => (b.pts || 0) - (a.pts || 0))
        .slice(0, 5)
      for (const p of topPlayers) {
        const playerId = p.personId || p.player_id
        sections.push({
          id: nextId(), section_type: 'player_highlight', title: p.name || p.playerName || 'Player',
          content: {
            player_id: Number(playerId), name: p.name || p.playerName || 'Player',
            team_tricode: p.teamTricode || p.team_abbreviation || '',
            stats: { pts: p.pts || 0, reb: p.reb || 0, ast: p.ast || 0, stl: p.stl || 0, blk: p.blk || 0, min: p.min || 0 },
            fantasy_points: p.fantasyPoints || p.fantasy_points || undefined,
          } satisfies PlayerHighlightContent,
          player_id: Number(playerId) || null, team_tricode: p.teamTricode || p.team_abbreviation || null,
        })
      }

      // Fun score
      if (data.funScore) {
        sections.push({
          id: nextId(), section_type: 'pull_quote', title: '',
          content: { text: `Fun Score: ${data.funScore}`, attribution: 'HoopGeek Algorithm', icon: data.funScore >= 80 ? 'fire' : data.funScore >= 60 ? 'trophy' : 'chart' } satisfies PullQuoteContent,
          player_id: null, team_tricode: null,
        })
      }
    }

    if (sections.length === 0) {
      setSnackbar({ open: true, message: 'No data loaded to generate sections from', color: 'warning' })
      return
    }

    setDraft(prev => ({ ...prev, sections: [...prev.sections, ...sections] }))
    setSnackbar({ open: true, message: `Auto-generated ${sections.length} sections`, color: 'success' })
  }, [dataSourceMode, resolvedPlayers, matchedGameData, draft.title, draft.subtitle, draft.metadata])

  // ─── Save to Supabase ──────────────────────────────────────

  const savePost = async (status: PostStatus) => {
    if (!user) { setSnackbar({ open: true, message: 'You must be logged in', color: 'danger' }); return }
    setSaving(true)
    try {
      const postRow = {
        post_type: draft.post_type, status,
        title: draft.title, subtitle: draft.subtitle || null, description: draft.description || null,
        slug: draft.slug || generateSlug(draft.title, draft.game_date || undefined),
        cover_image_url: draft.cover_image_url || null, share_image_url: draft.share_image_url || null,
        game_id: draft.game_id || null, game_date: draft.game_date || null,
        team_tricodes: draft.team_tricodes.length ? draft.team_tricodes : null,
        player_ids: draft.player_ids.length ? draft.player_ids : null,
        person_id: draft.person_id ? Number(draft.person_id) : null,
        tags: draft.tags.length ? draft.tags : [],
        metadata: draft.metadata,
        source_ref: generateSourceRef(draft.post_type, draft.game_id || undefined, draft.game_date || undefined),
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
        else navigate('/admin/create-post')
      }, 1500)
    } catch (err: any) {
      console.error('Error saving post:', err)
      setSnackbar({ open: true, message: `Error: ${err.message}`, color: 'danger' })
    } finally { setSaving(false) }
  }

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: return true
      case 1: return true
      case 2: return draft.title.trim().length > 0 && draft.slug.trim().length > 0
      case 3: return true
      case 4: return draft.title.trim().length > 0
      default: return false
    }
  }

  const hasAutoGenData = (dataSourceMode === 'totn' || dataSourceMode === 'totw')
    ? resolvedPlayers.length > 0
    : matchedGameData.length > 0

  // ─── Render ────────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, md: 3 }, pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' }, pb: 8, minHeight: '100vh' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={2} sx={{ mb: 3 }}>
        <IconButton variant="plain" onClick={() => navigate('/feed')}>
          <ArrowBack />
        </IconButton>
        <Typography level="h3" sx={{ fontWeight: 700, fontFamily: 'serif' }}>Create Post</Typography>
      </Stack>

      {/* Stepper */}
      <Stepper sx={{ mb: 4 }}>
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
            // Reset data source state when type changes
            setSelectedRowId(null); setResolvedPlayers([]); setMatchedGameData([]); setGamesForDate([])
          }} />
        )}

        {activeStep === 1 && (
          <StepDataSource
            mode={dataSourceMode}
            totnRows={totnRows} totwRows={totwRows}
            selectedRowId={selectedRowId}
            resolvedPlayers={resolvedPlayers}
            loadingRows={loadingRows} loadingPlayers={loadingPlayers}
            onSelectTotnRow={selectTotnRow} onSelectTotwRow={selectTotwRow}
            selectedDate={selectedDate} gamesForDate={gamesForDate}
            loadingGames={loadingGames} loadingGameData={loadingGameData}
            matchedGameData={matchedGameData}
            onDateSelected={onDateSelected} onSelectGame={selectGame}
            onFileUpload={loadGameFromFile}
            draft={draft}
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
          />
        )}

        {activeStep === 4 && <StepReview draft={draft} saving={saving} onSave={savePost} />}
      </Box>

      {/* Navigation */}
      <Divider sx={{ my: 3 }} />
      <Stack direction="row" justifyContent="space-between">
        <Button variant="outlined" color="neutral" startDecorator={<ArrowBack />} disabled={activeStep === 0} onClick={() => setActiveStep(prev => prev - 1)}>Back</Button>
        {activeStep < STEPS.length - 1 ? (
          <Button variant="solid" endDecorator={<ArrowForward />} disabled={!canProceed(activeStep)} onClick={() => setActiveStep(prev => prev + 1)}>Next</Button>
        ) : (
          <Stack direction="row" gap={1}>
            <Button variant="outlined" color="neutral" startDecorator={<Save />} loading={saving} onClick={() => savePost('draft')}>Save Draft</Button>
            <Button variant="solid" color="success" startDecorator={<Publish />} loading={saving} onClick={() => savePost('published')}>Publish</Button>
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
      <Typography level="body-sm" sx={{ mb: 3, color: 'text.tertiary' }}>Choose the post type. This determines the data source and default sections.</Typography>
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
              <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>{opt.description}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  )
}


// ==========================================================================
// STEP 1 — Data Source (contextual)
// ==========================================================================

function StepDataSource({
  mode, totnRows, totwRows, selectedRowId, resolvedPlayers,
  loadingRows, loadingPlayers,
  onSelectTotnRow, onSelectTotwRow,
  selectedDate, gamesForDate, loadingGames, loadingGameData, matchedGameData,
  onDateSelected, onSelectGame, onFileUpload, draft,
}: {
  mode: string
  totnRows: any[]; totwRows: any[]
  selectedRowId: string | null; resolvedPlayers: ResolvedPlayer[]
  loadingRows: boolean; loadingPlayers: boolean
  onSelectTotnRow: (row: any) => void; onSelectTotwRow: (row: any) => void
  selectedDate: string; gamesForDate: NbaGame[]; loadingGames: boolean; loadingGameData: boolean
  matchedGameData: GameData[]
  onDateSelected: (date: string) => void; onSelectGame: (game: NbaGame) => void
  onFileUpload: (file: File) => void
  draft: PostDraft
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── TOTN ──
  if (mode === 'totn') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>Select Team of the Night</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: 'text.tertiary' }}>
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
                        <td>{isSelected ? <Check color="success" fontSize="small" /> : <SportsBasketball fontSize="small" sx={{ color: '#ccc' }} />}</td>
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
                            <Typography level="body-xs" sx={{ color: 'text.secondary', minWidth: 100, textAlign: 'right' }}>
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
                      No game files with stats found for {draft.game_date}. Upload game JSONs or check that files are in <code>scripts/feed/</code>.
                    </Alert>
                  )}
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
        <Typography level="body-sm" sx={{ mb: 3, color: 'text.tertiary' }}>Pick a TOTW row. Players will be resolved automatically.</Typography>

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
            ) : resolvedPlayers.length > 0 && (
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
                        <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: 'text.tertiary', minWidth: 60, textAlign: 'right' }}>{formatSalary(p.salary)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
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
        <Typography level="body-sm" sx={{ mb: 3, color: 'text.tertiary' }}>Pick a date to see games, then select one to load its data.</Typography>

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
                return (
                  <Card key={game.game_id} variant={isSelected ? 'solid' : 'outlined'} color={isSelected ? 'success' : 'neutral'}
                    sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.400' }, transition: 'all 0.15s' }}
                    onClick={() => onSelectGame(game)}>
                    <CardContent sx={{ p: 1.5 }}>
                      <Stack direction="row" alignItems="center" gap={2}>
                        {isSelected && <Check />}
                        <Typography level="title-md" sx={{ fontWeight: 700 }}>
                          {game.away_team_tricode} {game.away_team_score ?? ''} @ {game.home_team_tricode} {game.home_team_score ?? ''}
                        </Typography>
                        <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: 'text.tertiary' }}>{game.game_id}</Typography>
                        {game.game_status_text && <Chip size="sm" variant="soft">{game.game_status_text}</Chip>}
                      </Stack>
                    </CardContent>
                  </Card>
                )
              })}
            </Stack>
          ) : selectedDate ? (
            <Typography level="body-sm" sx={{ color: 'text.tertiary', textAlign: 'center', py: 3 }}>No games found for {selectedDate}</Typography>
          ) : null}

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

  // ── POW / POM ──
  if (mode === 'pow' || mode === 'pom') {
    return (
      <Box>
        <Typography level="h4" sx={{ mb: 1 }}>{mode === 'pow' ? 'Player of the Week' : 'Player of the Month'}</Typography>
        <Typography level="body-sm" sx={{ mb: 3, color: 'text.tertiary' }}>
          Select the award data. This feature will connect to the {mode === 'pow' ? 'nba_pow' : 'nba_pom'} table.
        </Typography>
        <Alert color="neutral" variant="soft">
          Award row selection coming soon. For now, enter player details manually in the next step and add sections in Step 3.
        </Alert>
      </Box>
    )
  }

  // ── Manual (props, injuries) ──
  return (
    <Box>
      <Typography level="h4" sx={{ mb: 1 }}>Manual Entry</Typography>
      <Typography level="body-sm" sx={{ mb: 3, color: 'text.tertiary' }}>
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
      <Typography level="body-sm" sx={{ mb: 3, color: 'text.tertiary' }}>Configure the post metadata. Fields marked with * are required.</Typography>

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
            startDecorator={<Typography level="body-xs" sx={{ color: 'text.tertiary' }}>/feed/</Typography>} />
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
}: {
  draft: PostDraft
  onAddSection: (type: SectionType) => void; onRemoveSection: (idx: number) => void
  onMoveSection: (idx: number, dir: 'up' | 'down') => void; onUpdateSection: (idx: number, updates: Partial<SectionDraft>) => void
  addSectionOpen: boolean; onSetAddSectionOpen: (open: boolean) => void
  editingSectionIdx: number | null; onSetEditingSectionIdx: (idx: number | null) => void
  onAutoGenerate?: () => void
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
      <Typography level="body-sm" sx={{ mb: 3, color: 'text.tertiary' }}>Build the story by adding content sections.</Typography>

      {draft.sections.length === 0 ? (
        <Card variant="outlined" sx={{ py: 6, textAlign: 'center' }}>
          <Typography level="body-lg" sx={{ color: 'text.tertiary', mb: 2 }}>No sections yet</Typography>
          <Typography level="body-sm" sx={{ color: 'text.tertiary', mb: 3 }}>Add sections to build your story, or auto-generate from loaded data.</Typography>
          <Button variant="soft" startDecorator={<Add />} onClick={() => onSetAddSectionOpen(true)}>Add First Section</Button>
        </Card>
      ) : (
        <Stack gap={1.5}>
          {draft.sections.map((section, idx) => {
            const typeOpt = SECTION_TYPE_OPTIONS.find(o => o.value === section.section_type)
            return (
              <Card key={section.id} variant="outlined" sx={{ border: editingSectionIdx === idx ? '2px solid' : '1px solid', borderColor: editingSectionIdx === idx ? 'primary.400' : 'divider' }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography level="body-xs" sx={{ color: 'text.tertiary', minWidth: 20, textAlign: 'center' }}>{idx + 1}</Typography>
                    <Chip size="sm" variant="soft" color="primary">{typeOpt?.label || section.section_type}</Chip>
                    {section.title && <Typography level="body-sm" sx={{ flex: 1 }} noWrap>{section.title}</Typography>}
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
                  <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>{opt.description}</Typography>
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
        <FormControl><FormLabel>Markdown Content</FormLabel><Textarea size="sm" minRows={4} maxRows={12} value={content.markdown || ''} onChange={(e) => updateContent({ markdown: e.target.value })} placeholder="Narrative content (markdown)..." /></FormControl>
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
    </Stack>
  )
}


// ==========================================================================
// STEP 4 — Review & Publish
// ==========================================================================

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
          {draft.subtitle && <Typography level="body-md" sx={{ color: 'text.secondary' }}>{draft.subtitle}</Typography>}
          {draft.description && <Typography level="body-sm" sx={{ color: 'text.tertiary', mt: 0.5 }}>{draft.description}</Typography>}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography level="title-md" sx={{ mb: 2 }}>Post Details</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 1, '& > *:nth-of-type(odd)': { fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem' } }}>
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
                    <Typography level="body-xs" sx={{ minWidth: 20, color: 'text.tertiary' }}>{i + 1}.</Typography>
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
    case 'chart': return { chart_type: 'radar', chart_props: {} }
    case 'prop_card': return { player_id: 0, player_name: '', bet_type: 'points', line: 0, result: 'pending' }
    case 'injury_card': return { player_id: 0, player_name: '', team_tricode: '', status: 'QUESTIONABLE', injury: '' }
    case 'pull_quote': return { text: '', icon: 'chart' }
    case 'gallery': return { images: [] }
    case 'box_score': return { home: { tricode: '', players: [] }, away: { tricode: '', players: [] } }
    default: return {}
  }
}
