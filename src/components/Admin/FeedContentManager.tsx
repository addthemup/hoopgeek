import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Table,
  Sheet,
  Chip,
  Modal,
  ModalDialog,
  ModalClose,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Option,
  Grid,
  AspectRatio,
  Stepper,
  Step,
  StepIndicator,
  StepButton,
  Snackbar,
  Checkbox
} from '@mui/joy'
import {
  Add,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  Upload,
  Save,
  Cancel,
  PlayArrow,
  Image as ImageIcon,
  BarChart,
  Person,
  Sports,
  EmojiEvents,
  ExpandMore,
  ChevronRight,
  CheckBox,
  CheckBoxOutlineBlank,
  AutoAwesome,
  Reddit,
  Facebook,
  OpenInNew
} from '@mui/icons-material'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FunScoreDataModal from './FunScoreDataModal'
import StoryComparisonChart from '../Charts/StoryComparisonChart'
import MatchupRadarChart from '../Charts/MatchupRadarChart'
import OffensiveDefensiveScatter from '../Charts/OffensiveDefensiveScatter'
import PaceSpaceBubble from '../Charts/PaceSpaceBubble'
import HustleRadarChart from '../Charts/HustleRadarChart'
import FourFactorsChart from '../Charts/FourFactorsChart'
import ShotDistributionDonut from '../Charts/ShotDistributionDonut'
import ReboundingBattleChart from '../Charts/ReboundingBattleChart'
import PlaymakingEfficiencyChart from '../Charts/PlaymakingEfficiencyChart'
import TurnoverAnalysisChart from '../Charts/TurnoverAnalysisChart'
import PlusMinusImpactChart from '../Charts/PlusMinusImpactChart'
import UsageEfficiencyScatter from '../Charts/UsageEfficiencyScatter'
import TopFantasyScorersChart from '../Charts/TopFantasyScorersChart'
import ShotChartTable from '../Charts/ShotChartTable'
import ShotProfileEfficiencyChart from '../Charts/ShotProfileEfficiencyChart'
import RimPressureChart from '../Charts/RimPressureChart'
import OnBallCreationChart from '../Charts/OnBallCreationChart'
import DefensiveEventsMap from '../Charts/DefensiveEventsMap'
import FoulDrawingProfile from '../Charts/FoulDrawingProfile'
import PlayerComparisonRadarChart from '../Charts/PlayerComparisonRadarChart'
import { getTeamPrimaryColor, getTeamSecondaryColor, getTeamColors, TeamColors } from '../../utils/nbaTeamColors'
import { FANDUEL_SCORING } from '../../utils/fantasyScoring'
import { calculatePlayerPropResults, calculatePropResult } from '../../utils/playerPropsCalculator'

interface FeedPost {
  id: string
  post_type: string
  status: string
  title?: string
  description?: string
  game_id?: string
  game_date?: string
  team_tricodes?: string[]
  player_ids?: number[]
  person_id?: number | null
  slides: any[]
  thumbnail_url?: string | null
  metadata?: any
  likes_count: number
  comments_count: number
  shares_count: number
  views_count: number
  created_at: string
  published_at?: string
}

interface PlayByPlayPlay {
  gameId: string
  eventNum: number
  actionId: number
  period: number
  clock: string
  description: string
  teamId: number | null
  teamTricode: string | null
  scoreHome: string
  scoreAway: string
  videoAvailable: number
  actionType: string
  subType: string | null
  shotResult: string | null
  shotDistance: number | null
  isFieldGoal: number
  playerName: string | null
  playerNameI: string | null
  personId: number | null
  xLegacy: number | null
  yLegacy: number | null
  location: string | null
  pointsTotal: number
  mp4?: string | null
  mp4_local?: string | null
}

interface GameData {
  gameId: string
  gameMetadata: {
    date: string
    arena: string
    season: string
    homeTeam: {
      team_id: number
      abbreviation: string
      city: string
      name: string
      quarters: number[]
      points: number | null
    }
    awayTeam: {
      team_id: number
      abbreviation: string
      city: string
      name: string
      quarters: number[]
      points: number | null
    }
  }
  score: {
    [gameId: string]: {
      team_stats: any
      lead_changes: {
        total: number
        last_5_minutes: number
        last_minute: number
        buzzer_beater: number
      }
      dunk_stats: {
        [key: string]: number
        'Total Dunks': number
      }
      deep_shots: {
        deep_threes: number
        four_pointers: number
      }
      scoring_milestones: any
      fun_score: number
    }
  }
  story: {
    matchup: string
    final_score: string
    advantages: Array<any>
    teams: {
      winner: any
      loser: any
    }
  }
  script: {
    total_plays: number
    video_script: Array<{
      gameId: string
      actionId: number
      period: number
      clock: string
      description: string
      teamId: number
      teamTricode: string
      scoreHome: string
      scoreAway: string
      videoAvailable: number
      actionType: string
      subType: string
      shotResult: string
      playerName: string
      playerNameI: string
      personId: number
      mp4?: string | null
      mp4_local?: string | null
    }>
  }
  playByPlay?: {
    allPlays: PlayByPlayPlay[]
  }
  AggregatedPlayerStats?: {
    [personId: string]: {
      traditional_points?: number
      traditional_reboundsTotal?: number
      traditional_assists?: number
      traditional_steals?: number
      traditional_blocks?: number
      traditional_turnovers?: number
      traditional_personId?: number
      nameI?: string
      firstName?: string
      familyName?: string
    }
  }
}

/**
 * Chart Selection Framework
 * Scores each potential chart (0-100) based on how meaningful it is for this player in this game
 */

interface ChartScore {
  chartType: string
  category?: string
  score: number
  reason: string
  data: any // Chart-specific data
}

interface PlayerRanking {
  personId: number
  name: string
  teamTricode: string
  [key: string]: any // Dynamic stat fields
}

/**
 * Calculate rankings for all players in a specific stat
 */
function calculatePlayerRankings(
  allPlayerStats: Record<string, any>,
  statKey: string,
  direction: 'desc' | 'asc' = 'desc'
): PlayerRanking[] {
  const rankings: PlayerRanking[] = []
  
  Object.entries(allPlayerStats).forEach(([personIdStr, stats]: [string, any]) => {
    const value = stats[statKey]
    if (value !== undefined && value !== null) {
      rankings.push({
        personId: parseInt(personIdStr),
        name: stats.nameI || `${stats.firstName || ''} ${stats.familyName || ''}`.trim(),
        teamTricode: stats.teamTricode || '',
        value
      })
    }
  })
  
  rankings.sort((a, b) => direction === 'desc' ? b.value - a.value : a.value - b.value)
  return rankings
}

/**
 * Get player's rank (1-indexed) in a specific stat
 */
function getPlayerRank(
  personId: number,
  rankings: PlayerRanking[]
): number {
  const index = rankings.findIndex(r => r.personId === personId)
  return index >= 0 ? index + 1 : rankings.length + 1
}

/**
 * Check if player is in top N for a stat
 */
function isTopN(
  personId: number,
  rankings: PlayerRanking[],
  n: number
): boolean {
  return getPlayerRank(personId, rankings) <= n
}

/**
 * Calculate game average for a stat
 */
function calculateGameAverage(
  allPlayerStats: Record<string, any>,
  statKey: string
): number {
  const values: number[] = []
  Object.values(allPlayerStats).forEach((stats: any) => {
    const value = stats[statKey]
    if (value !== undefined && value !== null && typeof value === 'number') {
      values.push(value)
    }
  })
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
}

/**
 * Calculate percentage above/below game average
 */
function percentageAboveAverage(
  playerValue: number,
  gameAverage: number
): number {
  if (gameAverage === 0) return 0
  return ((playerValue - gameAverage) / gameAverage) * 100
}

/**
 * Score a chart based on multiple criteria
 */
function scoreChart(
  personId: number,
  criteria: {
    topN?: { rank: number, score: number }[] // e.g., [{ rank: 1, score: 100 }, { rank: 3, score: 70 }]
    percentageAboveAverage?: { threshold: number, score: number }[] // e.g., [{ threshold: 25, score: 80 }]
    minimumValue?: { value: number, score: number }[] // e.g., [{ value: 10, score: 50 }]
    custom?: () => { score: number, reason: string } // Custom scoring logic
  },
  getRanking: () => PlayerRanking[],
  getPlayerValue: () => number,
  getGameAverage: () => number
): { score: number, reason: string } {
  let maxScore = 0
  let reasons: string[] = []
  
  // Check top N rankings
  if (criteria.topN) {
    const rankings = getRanking()
    for (const { rank, score } of criteria.topN) {
      if (isTopN(personId, rankings, rank)) {
        maxScore = Math.max(maxScore, score)
        reasons.push(`Top ${rank} in game (${score}pts)`)
      }
    }
  }
  
  // Check percentage above average
  if (criteria.percentageAboveAverage) {
    const gameAvg = getGameAverage()
    const playerValue = getPlayerValue()
    const pctAbove = percentageAboveAverage(playerValue, gameAvg)
    
    for (const { threshold, score } of criteria.percentageAboveAverage) {
      if (pctAbove >= threshold) {
        maxScore = Math.max(maxScore, score)
        reasons.push(`${pctAbove.toFixed(1)}% above average (${score}pts)`)
      }
    }
  }
  
  // Check minimum value thresholds
  if (criteria.minimumValue) {
    const playerValue = getPlayerValue()
    for (const { value, score } of criteria.minimumValue) {
      if (playerValue >= value) {
        maxScore = Math.max(maxScore, score)
        reasons.push(`Value ≥ ${value} (${score}pts)`)
      }
    }
  }
  
  // Custom scoring logic
  if (criteria.custom) {
    const customResult = criteria.custom()
    maxScore = Math.max(maxScore, customResult.score)
    if (customResult.score > 0) {
      reasons.push(customResult.reason)
    }
  }
  
  return {
    score: maxScore,
    reason: reasons.length > 0 ? reasons[0] : 'Not relevant for this game'
  }
}

/**
 * Check if player is #1 in any hustle stat
 */
function isTopHustlePlayer(
  personId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): { isTop: boolean, stat?: string } {
  const hustleStats = [
    'hustle_contestedShots',
    'hustle_deflections',
    'hustle_looseBallsRecoveredTotal',
    'hustle_boxOuts',
    'hustle_chargesDrawn',
    'hustle_screenAssists'
  ]
  
  for (const statKey of hustleStats) {
    const value = targetStats[statKey]
    if (value !== undefined && value !== null && value > 0) {
      const rankings = calculatePlayerRankings(allPlayerStats, statKey, 'desc')
      if (isTopN(personId, rankings, 1)) {
        return { isTop: true, stat: statKey }
      }
    }
  }
  
  return { isTop: false }
}

/**
 * Outlier detection: Check if player meets any outlier criteria
 */
function isOutlierPlayer(
  personId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>,
  statKey: string,
  options?: {
    topN?: number
    percentageAboveAverage?: number
    isTopInAnyHustle?: boolean
  }
): { isOutlier: boolean, reason: string } {
  const { topN = 3, percentageAboveAverage: pctThreshold = 25, isTopInAnyHustle = false } = options || {}
  
  // Check if top N
  const rankings = calculatePlayerRankings(allPlayerStats, statKey, 'desc')
  if (isTopN(personId, rankings, topN)) {
    const rank = getPlayerRank(personId, rankings)
    return { isOutlier: true, reason: `Top ${rank} in ${statKey}` }
  }
  
  // Check if percentage above average
  const playerValue = targetStats[statKey] ?? 0
  const gameAvg = calculateGameAverage(allPlayerStats, statKey)
  const pctAbove = percentageAboveAverage(playerValue, gameAvg)
  if (pctAbove >= pctThreshold) {
    return { isOutlier: true, reason: `${pctAbove.toFixed(1)}% above average in ${statKey}` }
  }
  
  // Check if top hustle player (if requested)
  if (isTopInAnyHustle) {
    const hustleResult = isTopHustlePlayer(personId, targetStats, allPlayerStats)
    if (hustleResult.isTop) {
      return { isOutlier: true, reason: `#1 in ${hustleResult.stat}` }
    }
  }
  
  return { isOutlier: false, reason: '' }
}

/**
 * Score Usage Dominance Chart
 */
function scoreUsageChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  // Check if usage stats exist
  if (!targetStats.usage_usagePercentage && 
      !targetStats.usage_percentagePoints &&
      !targetStats.usage_percentageAssists) {
    return null
  }
  
  const usageValue = targetStats.usage_usagePercentage ?? 0
  
  // Score based on top 3 OR 25%+ above average
  const result = scoreChart(
    targetPersonId,
    {
      topN: [
        { rank: 1, score: 100 },
        { rank: 2, score: 90 },
        { rank: 3, score: 75 }
      ],
      percentageAboveAverage: [
        { threshold: 50, score: 95 },
        { threshold: 25, score: 70 }
      ]
    },
    () => calculatePlayerRankings(allPlayerStats, 'usage_usagePercentage', 'desc'),
    () => usageValue,
    () => calculateGameAverage(allPlayerStats, 'usage_usagePercentage')
  )
  
  if (result.score < 60) {
    return null // Not relevant enough
  }
  
  // Prepare chart data
  const chartData = {
    category: 'usage',
    title: 'Usage Comparison',
    stats: {
      usagePercentage: targetStats.usage_usagePercentage ?? 0,
      percentagePoints: targetStats.usage_percentagePoints ?? 0,
      percentageAssists: targetStats.usage_percentageAssists ?? 0,
      percentageReboundsTotal: targetStats.usage_percentageReboundsTotal ?? 0,
      percentageTurnovers: targetStats.usage_percentageTurnovers ?? 0,
      percentageFieldGoalsAttempted: targetStats.usage_percentageFieldGoalsAttempted ?? 0
    }
  }
  
  return {
    chartType: 'player_comparison_radar',
    category: 'usage',
    score: result.score,
    reason: result.reason,
    data: chartData
  }
}

/**
 * Score Hustle Standout Chart
 */
function scoreHustleChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  const hustleStats = [
    'hustle_contestedShots',
    'hustle_deflections',
    'hustle_looseBallsRecoveredTotal',
    'hustle_boxOuts',
    'hustle_chargesDrawn',
    'hustle_screenAssists'
  ]
  
  // Check if any hustle stat exists
  const hasHustleData = hustleStats.some(stat => targetStats[stat] !== undefined && targetStats[stat] !== null)
  if (!hasHustleData) {
    return null
  }
  
  // Find which hustle stats player is top 2 in
  const topHustleStats: string[] = []
  let maxScore = 0
  
  for (const statKey of hustleStats) {
    const value = targetStats[statKey] ?? 0
    if (value > 0) {
      const rankings = calculatePlayerRankings(allPlayerStats, statKey, 'desc')
      const rank = getPlayerRank(targetPersonId, rankings)
      
      if (rank <= 2) {
        topHustleStats.push(statKey)
        const score = rank === 1 ? 100 : 85
        maxScore = Math.max(maxScore, score)
      }
    }
  }
  
  if (topHustleStats.length === 0) {
    return null // Not top 2 in any hustle stat
  }
  
  const chartData = {
    category: 'hustle',
    title: 'Hustle Stats',
    stats: {
      contestedShots: targetStats.hustle_contestedShots ?? 0,
      deflections: targetStats.hustle_deflections ?? 0,
      looseBallsRecoveredTotal: targetStats.hustle_looseBallsRecoveredTotal ?? 0,
      boxOuts: targetStats.hustle_boxOuts ?? 0,
      chargesDrawn: targetStats.hustle_chargesDrawn ?? 0,
      screenAssists: targetStats.hustle_screenAssists ?? 0
    },
    topStats: topHustleStats
  }
  
  const isTop1 = topHustleStats.some(stat => {
    const rankings = calculatePlayerRankings(allPlayerStats, stat, 'desc')
    return getPlayerRank(targetPersonId, rankings) === 1
  })
  
  return {
    chartType: 'player_comparison_radar',
    category: 'hustle',
    score: maxScore,
    reason: isTop1 
      ? `#1 in ${topHustleStats.length} hustle stat${topHustleStats.length > 1 ? 's' : ''}`
      : `Top 2 in ${topHustleStats.length} hustle stat${topHustleStats.length > 1 ? 's' : ''}`,
    data: chartData
  }
}

/**
 * Score Efficiency Outlier Chart (Four Factors)
 */
function scoreEfficiencyChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  // Check if four factors stats exist
  if (targetStats.fourFactors_effectiveFieldGoalPercentage === undefined &&
      targetStats.fourFactors_freeThrowAttemptRate === undefined) {
    return null
  }
  
  const efgValue = (targetStats.fourFactors_effectiveFieldGoalPercentage ?? 0) * 100
  const fgaValue = targetStats.traditional_fieldGoalsAttempted ?? 0
  
  // Check if top 3 eFG%
  const efgRankings = calculatePlayerRankings(allPlayerStats, 'fourFactors_effectiveFieldGoalPercentage', 'desc')
  const efgRank = getPlayerRank(targetPersonId, efgRankings)
  const isTop3EFG = efgRank <= 3
  
  // Check if top 3 FGA and top half eFG%
  const fgaRankings = calculatePlayerRankings(allPlayerStats, 'traditional_fieldGoalsAttempted', 'desc')
  const fgaRank = getPlayerRank(targetPersonId, fgaRankings)
  const isTop3FGA = fgaRank <= 3
  
  const allEFG = Object.values(allPlayerStats)
    .map((s: any) => (s.fourFactors_effectiveFieldGoalPercentage ?? 0) * 100)
    .filter(v => v > 0)
    .sort((a, b) => b - a)
  const medianEFG = allEFG[Math.floor(allEFG.length / 2)] || 0
  const isTopHalfEFG = efgValue >= medianEFG
  
  if (!isTop3EFG && !(isTop3FGA && isTopHalfEFG)) {
    return null
  }
  
  let score = 0
  let reason = ''
  
  if (isTop3EFG) {
    score = efgRank === 1 ? 100 : (efgRank === 2 ? 90 : 75)
    reason = `Top ${efgRank} eFG% in game`
  } else if (isTop3FGA && isTopHalfEFG) {
    score = 70
    reason = `Top ${fgaRank} FGA + top half eFG%`
  }
  
  const chartData = {
    category: 'fourfactors',
    title: 'Four Factors',
    stats: {
      effectiveFieldGoalPercentage: efgValue,
      freeThrowAttemptRate: ((targetStats.fourFactors_freeThrowAttemptRate ?? 0) * 100),
      offensiveReboundPercentage: ((targetStats.fourFactors_offensiveReboundPercentage ?? 0) * 100),
      teamTurnoverPercentage: ((targetStats.fourFactors_teamTurnoverPercentage ?? 0) * 100),
      oppEffectiveFieldGoalPercentage: ((targetStats.fourFactors_oppEffectiveFieldGoalPercentage ?? 0) * 100),
      oppOffensiveReboundPercentage: ((targetStats.fourFactors_oppOffensiveReboundPercentage ?? 0) * 100)
    }
  }
  
  return {
    chartType: 'player_comparison_radar',
    category: 'fourfactors',
    score,
    reason,
    data: chartData
  }
}

/**
 * Detect player position/role from stats
 */
function detectPlayerPosition(targetStats: any): 'guard' | 'wing' | 'big' | null {
  const assists = targetStats.traditional_assists ?? 0
  const rebounds = targetStats.traditional_reboundsTotal ?? 0
  const blocks = targetStats.traditional_blocks ?? 0
  const points = targetStats.traditional_points ?? 0
  const usage = targetStats.usage_usagePercentage ?? 0
  
  // Guard: High AST + usage
  if (assists >= 5 && usage >= 20) {
    return 'guard'
  }
  
  // Big: High REB + BLK
  if (rebounds >= 8 && blocks >= 1) {
    return 'big'
  }
  
  // Wing: High scoring, moderate other stats
  if (points >= 15 && assists >= 2 && rebounds >= 3) {
    return 'wing'
  }
  
  // Secondary checks
  if (assists >= 7) return 'guard'
  if (rebounds >= 10 || blocks >= 2) return 'big'
  if (points >= 20) return 'wing'
  
  return null
}

/**
 * Score Playmaking Chart
 */
function scorePlaymakingChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  const assists = targetStats.traditional_assists ?? 0
  const usage = targetStats.usage_usagePercentage ?? 0
  
  // Check if AST rate is top 2
  const astRankings = calculatePlayerRankings(allPlayerStats, 'traditional_assists', 'desc')
  const astRank = getPlayerRank(targetPersonId, astRankings)
  
  if (astRank > 2 || usage < 15 || usage > 40) {
    return null // Not top 2 AST or usage not reasonable
  }
  
  // Check for playmaking stats
  if (targetStats.traditional_assists === undefined) {
    return null
  }
  
  const chartData = {
    category: 'playmaking',
    title: 'Playmaking Comparison',
    stats: {
      assists: assists,
      assistPercentage: targetStats.traditional_assists / (targetStats.traditional_points ?? 1) * 100,
      passes: targetStats.playerTrack_passes ?? 0,
      secondaryAssists: targetStats.traditional_assists * 0.3, // Approximate
      freeThrowAssists: 0 // Would need play-by-play
    }
  }
  
  return {
    chartType: 'player_comparison_radar',
    category: 'playmaking',
    score: astRank === 1 ? 95 : 80,
    reason: `Top ${astRank} assist rate, reasonable usage`,
    data: chartData
  }
}

/**
 * Score Defensive Impact Chart
 */
function scoreDefensiveChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  const steals = targetStats.traditional_steals ?? 0
  const blocks = targetStats.traditional_blocks ?? 0
  const deflections = targetStats.hustle_deflections ?? 0
  const contestedShots = targetStats.hustle_contestedShots ?? 0
  
  // Check if top 3 in any defensive metric
  let isTopDefender = false
  let maxScore = 0
  let reason = ''
  
  // Steals
  const stlRankings = calculatePlayerRankings(allPlayerStats, 'traditional_steals', 'desc')
  const stlRank = getPlayerRank(targetPersonId, stlRankings)
  if (stlRank <= 3 && steals > 0) {
    isTopDefender = true
    maxScore = Math.max(maxScore, stlRank === 1 ? 100 : (stlRank === 2 ? 85 : 75))
    reason = `Top ${stlRank} steals`
  }
  
  // Blocks
  const blkRankings = calculatePlayerRankings(allPlayerStats, 'traditional_blocks', 'desc')
  const blkRank = getPlayerRank(targetPersonId, blkRankings)
  if (blkRank <= 3 && blocks > 0) {
    isTopDefender = true
    maxScore = Math.max(maxScore, blkRank === 1 ? 100 : (blkRank === 2 ? 85 : 75))
    reason = `Top ${blkRank} blocks`
  }
  
  // Combined STL+BLK+deflections
  const combinedDefense = steals + blocks + deflections
  if (combinedDefense >= 5) {
    const allCombined = Object.values(allPlayerStats).map((s: any) => 
      (s.traditional_steals ?? 0) + (s.traditional_blocks ?? 0) + (s.hustle_deflections ?? 0)
    ).sort((a, b) => b - a)
    const rank = allCombined.findIndex(v => v < combinedDefense) + 1
    if (rank <= 3) {
      isTopDefender = true
      maxScore = Math.max(maxScore, rank === 1 ? 100 : (rank === 2 ? 90 : 80))
      reason = `Top ${rank} in defensive impact (STL+BLK+DEF)`
    }
  }
  
  if (!isTopDefender) {
    return null
  }
  
  const chartData = {
    category: 'defensive',
    title: 'Defensive Impact',
    stats: {
      steals: steals,
      blocks: blocks,
      deflections: deflections,
      contestedShots: contestedShots,
      defensiveRating: targetStats.advanced_defensiveRating ?? 0,
      defensiveReboundPercentage: ((targetStats.advanced_defensiveReboundPercentage ?? 0) * 100)
    }
  }
  
  return {
    chartType: 'player_comparison_radar',
    category: 'defensive',
    score: maxScore,
    reason,
    data: chartData
  }
}

/**
 * Score Scoring Breakdown Chart
 */
function scoreScoringBreakdownChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  const points = targetStats.traditional_points ?? 0
  
  // Only show for high scoring volume (20+ points)
  if (points < 20) {
    return null
  }
  
  const fga = targetStats.traditional_fieldGoalsAttempted ?? 0
  const fgm = targetStats.traditional_fieldGoalsMade ?? 0
  
  if (fga === 0) {
    return null
  }
  
  // Approximate breakdown (would need shot chart data for accurate)
  const points3pt = (targetStats.traditional_threePointersMade ?? 0) * 3
  const points2pt = points - points3pt - (targetStats.traditional_freeThrowsMade ?? 0)
  const pct3pt = points > 0 ? (points3pt / points) * 100 : 0
  const pct2pt = points > 0 ? (points2pt / points) * 100 : 0
  
  const chartData = {
    category: 'scoring',
    title: 'Scoring Breakdown',
    stats: {
      pctPoints3pt: pct3pt,
      pctPoints2pt: pct2pt,
      pctPointsPaint: pct2pt * 0.6, // Estimate
      pctPointsMidrange: pct2pt * 0.4, // Estimate
      pctPointsFastBreak: 0, // Would need play-by-play
      pctAssisted: 0, // Would need shot tracking
      freeThrowRate: ((targetStats.fourFactors_freeThrowAttemptRate ?? 0) * 100)
    }
  }
  
  // Score based on volume
  let score = 60
  if (points >= 30) score = 90
  else if (points >= 25) score = 75
  
  return {
    chartType: 'player_comparison_radar',
    category: 'scoring',
    score,
    reason: `${points} points - high scoring volume`,
    data: chartData
  }
}

/**
 * Detect statistical anomalies
 */
function detectStatisticalAnomalies(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  const points = targetStats.traditional_points ?? 0
  const rebounds = targetStats.traditional_reboundsTotal ?? 0
  const assists = targetStats.traditional_assists ?? 0
  const steals = targetStats.traditional_steals ?? 0
  const blocks = targetStats.traditional_blocks ?? 0
  const turnovers = targetStats.traditional_turnovers ?? 0
  const fga = targetStats.traditional_fieldGoalsAttempted ?? 0
  const fgm = targetStats.traditional_fieldGoalsMade ?? 0
  const fgPct = fga > 0 ? (fgm / fga) * 100 : 0
  
  // Triple-double watch (8+ in 3 categories)
  const categoriesAt8Plus = [
    points >= 8,
    rebounds >= 8,
    assists >= 8,
    steals >= 8,
    blocks >= 8
  ].filter(Boolean).length
  
  if (categoriesAt8Plus >= 3) {
    return {
      chartType: 'special',
      category: 'triple-double-watch',
      score: 100,
      reason: `${categoriesAt8Plus} categories with 8+`,
      data: {
        category: 'special',
        title: 'Triple-Double Watch',
        stats: {
          points,
          rebounds,
          assists,
          steals,
          blocks,
          turnovers
        }
      }
    }
  }
  
  // Perfect efficiency (80%+ on 10+ FGA)
  if (fgPct >= 80 && fga >= 10) {
    return {
      chartType: 'special',
      category: 'perfect-efficiency',
      score: 95,
      reason: `${fgPct.toFixed(1)}% FG on ${fga} attempts`,
      data: {
        category: 'special',
        title: 'Perfect Efficiency',
        stats: {
          fgPercentage: fgPct,
          fieldGoalsAttempted: fga,
          fieldGoalsMade: fgm,
          points
        }
      }
    }
  }
  
  // High assist rate (top 2)
  const astRankings = calculatePlayerRankings(allPlayerStats, 'traditional_assists', 'desc')
  const astRank = getPlayerRank(targetPersonId, astRankings)
  if (astRank <= 2 && assists >= 8) {
    return {
      chartType: 'special',
      category: 'high-assist-rate',
      score: 85,
      reason: `Top ${astRank} assist rate (${assists} AST)`,
      data: {
        category: 'special',
        title: 'High Assist Rate',
        stats: {
          assists,
          assistRank: astRank
        }
      }
    }
  }
  
  return null
}

/**
 * Score Relative Performance Chart (Top of Game)
 */
function scoreRelativePerformanceChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  // Find metrics where player ranks top 3
  const top3Metrics: Array<{ metric: string, rank: number, value: number }> = []
  
  const keyMetrics = [
    { key: 'traditional_points', name: 'Points' },
    { key: 'traditional_reboundsTotal', name: 'Rebounds' },
    { key: 'traditional_assists', name: 'Assists' },
    { key: 'traditional_steals', name: 'Steals' },
    { key: 'traditional_blocks', name: 'Blocks' },
    { key: 'usage_usagePercentage', name: 'Usage' }
  ]
  
  for (const metric of keyMetrics) {
    const value = targetStats[metric.key] ?? 0
    if (value > 0) {
      const rankings = calculatePlayerRankings(allPlayerStats, metric.key, 'desc')
      const rank = getPlayerRank(targetPersonId, rankings)
      if (rank <= 3) {
        top3Metrics.push({ metric: metric.name, rank, value })
      }
    }
  }
  
  if (top3Metrics.length < 2) {
    return null // Need at least 2 top-3 metrics
  }
  
  // Calculate score based on number of top-3 metrics
  let score = 60
  if (top3Metrics.length >= 4) score = 90
  else if (top3Metrics.length === 3) score = 75
  
  const chartData = {
    category: 'relative',
    title: 'Top of Game Performance',
    stats: top3Metrics.reduce((acc, m) => {
      acc[m.metric] = m.value
      return acc
    }, {} as Record<string, number>),
    topMetrics: top3Metrics
  }
  
  return {
    chartType: 'player_comparison_radar',
    category: 'relative',
    score,
    reason: `Top 3 in ${top3Metrics.length} categories`,
    data: chartData
  }
}

/**
 * Score Team Context Charts
 */
function scoreTeamContextChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  const targetTeam = targetStats.teamTricode
  if (!targetTeam) return null
  
  // Get teammates (same team)
  const teammates = Object.entries(allPlayerStats)
    .filter(([_, stats]: [string, any]) => stats.teamTricode === targetTeam)
    .filter(([pid, _]) => parseInt(pid) !== targetPersonId)
  
  if (teammates.length === 0) return null
  
  // Find categories where player stands out from teammates
  const standoutMetrics: string[] = []
  const keyStats = ['traditional_points', 'traditional_reboundsTotal', 'traditional_assists']
  
  for (const statKey of keyStats) {
    const targetValue = targetStats[statKey] ?? 0
    const teammateValues = teammates.map(([_, s]: [string, any]) => s[statKey] ?? 0)
    const maxTeammate = Math.max(...teammateValues, 0)
    
    if (targetValue > maxTeammate * 1.2) { // 20% above best teammate
      standoutMetrics.push(statKey)
    }
  }
  
  if (standoutMetrics.length === 0) {
    return null
  }
  
  return {
    chartType: 'player_comparison_radar',
    category: 'team-context',
    score: 70,
    reason: `Stands out from teammates in ${standoutMetrics.length} categories`,
    data: {
      category: 'team-context',
      title: 'Vs Teammates',
      stats: standoutMetrics.reduce((acc, key) => {
        acc[key] = targetStats[key] ?? 0
        return acc
      }, {} as Record<string, number>)
    }
  }
}

/**
 * Score Complementary Charts (Strengths & Weaknesses)
 */
function scoreComplementaryChart(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore | null {
  // Find top 3 strengths and potential weaknesses
  const keyMetrics = [
    { key: 'traditional_points', name: 'Points' },
    { key: 'traditional_reboundsTotal', name: 'Rebounds' },
    { key: 'traditional_assists', name: 'Assists' },
    { key: 'traditional_steals', name: 'Steals' },
    { key: 'traditional_blocks', name: 'Blocks' },
    { key: 'usage_usagePercentage', name: 'Usage' },
    { key: 'fourFactors_effectiveFieldGoalPercentage', name: 'eFG%' }
  ]
  
  const strengths: Array<{ metric: string, rank: number, value: number }> = []
  const weaknesses: Array<{ metric: string, value: number, issue: string }> = []
  
  for (const metric of keyMetrics) {
    const value = targetStats[metric.key] ?? 0
    if (value > 0) {
      const rankings = calculatePlayerRankings(allPlayerStats, metric.key, 'desc')
      const rank = getPlayerRank(targetPersonId, rankings)
      
      // Top 3 = strength
      if (rank <= 3) {
        strengths.push({ metric: metric.name, rank, value })
      }
      
      // Check for weaknesses (high turnovers, low efficiency)
      if (metric.key === 'traditional_turnovers') {
        const toRankings = calculatePlayerRankings(allPlayerStats, 'traditional_turnovers', 'desc')
        const toRank = getPlayerRank(targetPersonId, toRankings)
        if (toRank <= 3 && value >= 5) { // Top 3 in turnovers = bad
          weaknesses.push({ metric: metric.name, value, issue: `High turnovers (${value})` })
        }
      }
    }
  }
  
  // Check efficiency
  const fga = targetStats.traditional_fieldGoalsAttempted ?? 0
  const fgm = targetStats.traditional_fieldGoalsMade ?? 0
  const fgPct = fga > 0 ? (fgm / fga) * 100 : 0
  
  if (fgPct < 40 && fga >= 10) {
    weaknesses.push({ 
      metric: 'FG%', 
      value: fgPct, 
      issue: `Low efficiency (${fgPct.toFixed(1)}%)` 
    })
  }
  
  // Need at least 2 strengths OR 1 strength + 1 weakness
  if (strengths.length < 2 && weaknesses.length === 0) {
    return null
  }
  
  const chartData = {
    category: 'complementary',
    title: 'Strengths & Weaknesses',
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    stats: {
      ...strengths.slice(0, 3).reduce((acc, s) => {
        acc[`strength_${s.metric}`] = s.value
        return acc
      }, {} as Record<string, number>),
      ...weaknesses.slice(0, 3).reduce((acc, w) => {
        acc[`weakness_${w.metric}`] = w.value
        return acc
      }, {} as Record<string, number>)
    }
  }
  
  // Score based on having clear strengths and/or weaknesses
  let score = 65
  if (strengths.length >= 3 && weaknesses.length >= 1) score = 85
  else if (strengths.length >= 2) score = 75
  
  return {
    chartType: 'complementary',
    category: 'complementary',
    score,
    reason: strengths.length >= 2 
      ? `${strengths.length} strengths${weaknesses.length > 0 ? `, ${weaknesses.length} areas to improve` : ''}`
      : `${weaknesses.length} areas to improve`,
    data: chartData
  }
}

/**
 * Main chart selection function
 * Evaluates all potential charts and returns top-scoring ones
 */
function selectRelevantCharts(
  targetPersonId: number,
  targetStats: any,
  allPlayerStats: Record<string, any>
): ChartScore[] {
  const chartScores: ChartScore[] = []
  
  // Score all chart types
  const usageChart = scoreUsageChart(targetPersonId, targetStats, allPlayerStats)
  if (usageChart) chartScores.push(usageChart)
  
  const hustleChart = scoreHustleChart(targetPersonId, targetStats, allPlayerStats)
  if (hustleChart) chartScores.push(hustleChart)
  
  const efficiencyChart = scoreEfficiencyChart(targetPersonId, targetStats, allPlayerStats)
  if (efficiencyChart) chartScores.push(efficiencyChart)
  
  // Position-based charts
  const position = detectPlayerPosition(targetStats)
  if (position === 'guard') {
    const playmakingChart = scorePlaymakingChart(targetPersonId, targetStats, allPlayerStats)
    if (playmakingChart) chartScores.push(playmakingChart)
  }
  
  // Statistical anomalies (special highlights)
  const anomalyChart = detectStatisticalAnomalies(targetPersonId, targetStats, allPlayerStats)
  if (anomalyChart) chartScores.push(anomalyChart)
  
  // Relative performance
  const relativeChart = scoreRelativePerformanceChart(targetPersonId, targetStats, allPlayerStats)
  if (relativeChart) chartScores.push(relativeChart)
  
  // Team context
  const teamContextChart = scoreTeamContextChart(targetPersonId, targetStats, allPlayerStats)
  if (teamContextChart) chartScores.push(teamContextChart)
  
  // Defensive impact
  const defensiveChart = scoreDefensiveChart(targetPersonId, targetStats, allPlayerStats)
  if (defensiveChart) chartScores.push(defensiveChart)
  
  // Scoring breakdown (if high scoring)
  const scoringChart = scoreScoringBreakdownChart(targetPersonId, targetStats, allPlayerStats)
  if (scoringChart) chartScores.push(scoringChart)
  
  // Complementary (strengths & weaknesses)
  const complementaryChart = scoreComplementaryChart(targetPersonId, targetStats, allPlayerStats)
  if (complementaryChart) chartScores.push(complementaryChart)
  
  // Filter by minimum relevance and ensure variety
  const filteredCharts = chartScores
    .filter(c => c.score >= 60) // Minimum relevance threshold
    .sort((a, b) => b.score - a.score) // Sort by score descending
  
  // Ensure variety: prefer different chart types
  const selectedCharts: ChartScore[] = []
  const usedTypes = new Set<string>()
  
  // First pass: add one of each type (highest scoring)
  for (const chart of filteredCharts) {
    if (!usedTypes.has(chart.chartType) || chart.score >= 90) {
      selectedCharts.push(chart)
      usedTypes.add(chart.chartType)
      if (selectedCharts.length >= 4) break
    }
  }
  
  // Second pass: fill remaining slots with highest scores
  if (selectedCharts.length < 4) {
    for (const chart of filteredCharts) {
      if (!selectedCharts.includes(chart)) {
        selectedCharts.push(chart)
        if (selectedCharts.length >= 4) break
      }
    }
  }
  
  return selectedCharts.slice(0, 4) // Top 4 max
}

/**
 * Get unique color for a player by cycling through team colors
 * Returns the next available color from the team's palette
 * Ensures no color is repeated across all players
 */
function getUniquePlayerColor(
  teamTricode: string,
  colorIndex: number,
  usedColors: Set<string>
): string {
  const teamColors = getTeamColors(teamTricode)
  const colorOrder: (keyof TeamColors)[] = ['primary', 'secondary', 'tertiary', 'quaternary', 'quinary']
  
  // Find first available color that hasn't been used
  for (const colorKey of colorOrder) {
    const color = teamColors[colorKey]
    if (color && !usedColors.has(color)) {
      usedColors.add(color)
      return getContrastColor(color)
    }
  }
  
  // If all team colors are used, try to find any unused color from other teams
  // Generate a variation of the base color with slight modification
  const baseColor = teamColors.primary || '#1D428A'
  const hex = baseColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Create variation by adjusting brightness based on index
  const variation = (colorIndex % 5) * 20 // Vary by 0-80
  const newR = Math.min(255, r + variation)
  const newG = Math.min(255, g + variation)
  const newB = Math.min(255, b + variation)
  
  const variedColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
  
  // Check if variation is unique
  if (!usedColors.has(variedColor)) {
    usedColors.add(variedColor)
    return getContrastColor(variedColor)
  }
  
  // Last resort: generate a completely unique color
  const fallbackColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80'
  ]
  
  for (const fallback of fallbackColors) {
    if (!usedColors.has(fallback)) {
      usedColors.add(fallback)
      return getContrastColor(fallback)
    }
  }
  
  // Ultimate fallback - shouldn't reach here
  return getContrastColor(baseColor)
}

/**
 * Helper function to ensure good contrast on black background
 * Converts very dark colors to lighter/white alternatives
 */
const getContrastColor = (hexColor: string): string => {
  // Remove # if present
  const hex = hexColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  
  // If too dark (luminance < 0.3), return white or a lighter version
  if (luminance < 0.3) {
    // For very dark colors (like Brooklyn #000000), use white
    if (luminance < 0.15) {
      return '#FFFFFF'
    }
    // For moderately dark, brighten it
    const factor = 2.5
    return `#${Math.min(255, Math.round(r * factor)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(g * factor)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(b * factor)).toString(16).padStart(2, '0')}`
  }
  
  return hexColor
}

/**
 * Parse clock string (PT12M00.00S format) to seconds
 */
const parseClock = (clockStr: string): number => {
  const timeStr = clockStr.replace('PT', '').replace('S', '')
  if (timeStr.includes('M')) {
    const [minutes, seconds] = timeStr.split('M')
    return parseFloat(minutes) * 60 + parseFloat(seconds)
  }
  return parseFloat(timeStr)
}

/**
 * Calculate fantasy points from traditional stats using FanDuel scoring
 */
const calculateFantasyPointsFromStats = (stats: {
  traditional_points?: number
  traditional_reboundsTotal?: number
  traditional_assists?: number
  traditional_steals?: number
  traditional_blocks?: number
  traditional_turnovers?: number
}): number => {
  const pts = stats.traditional_points || 0
  const reb = stats.traditional_reboundsTotal || 0
  const ast = stats.traditional_assists || 0
  const stl = stats.traditional_steals || 0
  const blk = stats.traditional_blocks || 0
  const tov = stats.traditional_turnovers || 0

  // FanDuel scoring: PTS*1.0 + REB*1.2 + AST*1.5 + STL*2.0 + BLK*2.0 + TOV*(-1.0)
  const fantasyPoints = (pts * 1.0) + (reb * 1.2) + (ast * 1.5) + (stl * 2.0) + (blk * 2.0) + (tov * -1.0)
  return Math.round(fantasyPoints * 100) / 100
}

/**
 * Calculate chart information for a player using dynamic chart selection
 * Returns information about selected charts based on game performance
 */
const calculatePlayerChartInfo = (
  personId: number,
  gameData: GameData,
  teams: string[]
): {
  hasTop5FantasyChart: boolean
  selectedCharts: Array<{
    chartType: string
    category?: string
    score: number
    reason: string
  }>
} => {
  const result = {
    hasTop5FantasyChart: false,
    selectedCharts: [] as Array<{
      chartType: string
      category?: string
      score: number
      reason: string
    }>
  }

  if (!gameData.AggregatedPlayerStats) {
    return result
  }

  // Calculate fantasy points for all players
  const allPlayers: Array<{
    personId: number
    name: string
    teamTricode: string
    fantasyPoints: number
  }> = []

  Object.entries(gameData.AggregatedPlayerStats).forEach(([personIdStr, stats]: [string, any]) => {
    const pid = parseInt(personIdStr)
    const fantasyPoints = calculateFantasyPointsFromStats(stats)
    const playerName = stats.nameI || stats.firstName + ' ' + stats.familyName || `Player ${pid}`
    const teamTricode = stats.teamTricode || ''
    
    allPlayers.push({
      personId: pid,
      name: playerName,
      teamTricode,
      fantasyPoints
    })
  })

  // Sort by fantasy points descending
  allPlayers.sort((a, b) => b.fantasyPoints - a.fantasyPoints)

  // Check if target player is in top 5
  const targetPlayerIndex = allPlayers.findIndex(p => p.personId === personId)
  result.hasTop5FantasyChart = targetPlayerIndex >= 0 && targetPlayerIndex < 5

  // Use dynamic chart selection
  const targetStats = gameData.AggregatedPlayerStats[personId.toString()] as any
  if (targetStats) {
    const relevantCharts = selectRelevantCharts(
      personId,
      targetStats,
      gameData.AggregatedPlayerStats
    )
    
    result.selectedCharts = relevantCharts.map(chart => ({
      chartType: chart.chartType,
      category: chart.category,
      score: chart.score,
      reason: chart.reason
    }))
  }

  return result
}

/**
 * Detect feed posts algorithmically from game data
 */
const detectFeedPosts = (gameData: GameData): Array<{
  id: string
  postType: string
  title: string
  slideCount: number
  selected: boolean
  fantasyPoints: number
  metadata: any
}> => {
  const detected: Array<{
    id: string
    postType: string
    title: string
    slideCount: number
    selected: boolean
    fantasyPoints: number
    metadata: any
  }> = []

  if (!gameData.playByPlay?.allPlays) {
    return detected
  }

  const plays = gameData.playByPlay.allPlays
  const firstScoreKey = Object.keys(gameData.score || {})[0]
  const scoreData = firstScoreKey ? gameData.score[firstScoreKey] : null

  // 1. Detect Fun Score Post
  if (scoreData) {
    const funScorePlays: PlayByPlayPlay[] = []
    
    // Find milestone players and their personIds
    const milestonePlayerIds = new Set<number>()
    const milestoneInfo: Array<{ playerName: string; points: number; milestone: string }> = []
    
    if (scoreData.scoring_milestones && gameData.AggregatedPlayerStats) {
      // Check each milestone category
      const milestoneCategories = ['70 Ball', '60 Ball', '50 Ball', '40 Ball', 'Triple Double']
      for (const category of milestoneCategories) {
        const players = scoreData.scoring_milestones[category] || []
        for (const milestone of players) {
          const playerName = Array.isArray(milestone) ? milestone[0] : milestone
          const points = Array.isArray(milestone) ? milestone[1] : null
          
          // Find personId by matching player name in AggregatedPlayerStats
          for (const [personId, stats] of Object.entries(gameData.AggregatedPlayerStats)) {
            const fullName = `${stats.firstName || ''} ${stats.familyName || ''}`.trim()
            const nameI = stats.nameI || ''
            
            // Match by full name or nameI
            if (fullName === playerName || nameI === playerName || 
                nameI.includes(playerName.split(' ')[0]) || 
                fullName.includes(playerName.split(' ')[0])) {
              milestonePlayerIds.add(parseInt(personId))
              milestoneInfo.push({
                playerName,
                points: points || stats.traditional_points || 0,
                milestone: category
              })
              break
            }
          }
        }
      }
    }
    
    // Find plays that factor into fun score:
    // - Dunks
    // - Deep threes (>27 feet)
    // - Four pointers (>30 feet)
    // - Lead changes (period >= 4, clock <= 300 seconds)
    // - Buzzer beaters (period >= 4, clock <= 3 seconds, shotResult === 'Made')
    // - Scoring plays from milestone players (Made shots, especially scoring plays)
    // - All made 3-pointers (expanded from just deep threes)
    // - Blocks
    // - Steals
    // - And-1s
    // - All made shots in 4th quarter (especially close games)
    // - All scoring plays in overtime
    // - Game-tying/go-ahead shots in 4th quarter
    
    let currentLeader: 'home' | 'away' | null = null
    const margin = scoreData?.team_stats?.['Margin of Victory'] ?? null
    const isCloseGame = margin !== null && margin < 10
    
    for (let i = 0; i < plays.length; i++) {
      const play = plays[i]
      const clockSeconds = parseClock(play.clock)
      
      // Dunks
      if (play.subType && play.subType.includes('Dunk') && play.shotResult === 'Made') {
        funScorePlays.push(play)
      }
      
      // All made 3-pointers (expanded criteria)
      if (play.shotResult === 'Made' && play.isFieldGoal === 1 && play.shotDistance) {
        // Deep threes and four pointers (original criteria)
        if (play.shotDistance > 27) {
          funScorePlays.push(play)
        }
        // All made 3-pointers (new - add if not already added above)
        else if (play.shotDistance >= 23.75 && !funScorePlays.find(p => p.eventNum === play.eventNum)) {
          funScorePlays.push(play)
        }
      }
      
      // Blocks
      if (play.actionType === 'Block' && play.mp4) {
        funScorePlays.push(play)
      }
      
      // Steals
      if (play.actionType === 'Steal' && play.mp4) {
        funScorePlays.push(play)
      }
      
      // And-1s (check description for "and 1", "and-one", "and1")
      if (play.description && play.shotResult === 'Made' && 
          (play.description.toLowerCase().includes('and 1') || 
           play.description.toLowerCase().includes('and-one') ||
           play.description.toLowerCase().includes('and1'))) {
        if (!funScorePlays.find(p => p.eventNum === play.eventNum)) {
          funScorePlays.push(play)
        }
      }
      
      // Scoring plays from milestone players (all made shots)
      if (play.personId && milestonePlayerIds.has(play.personId) && 
          play.shotResult === 'Made' && play.isFieldGoal === 1) {
        // Add if not already in list (avoid duplicates)
        if (!funScorePlays.find(p => p.eventNum === play.eventNum)) {
          funScorePlays.push(play)
        }
      }
      
      // 4th quarter and overtime plays
      if (play.period >= 4 && play.scoreHome && play.scoreAway) {
        const scoreHome = parseInt(play.scoreHome)
        const scoreAway = parseInt(play.scoreAway)
        
        let newLeader: 'home' | 'away' | null = null
        if (scoreHome > scoreAway) {
          newLeader = 'home'
        } else if (scoreAway > scoreHome) {
          newLeader = 'away'
        }
        
        // Lead changes in last 5 minutes of 4th period or overtime
        if (newLeader && newLeader !== currentLeader && currentLeader !== null && clockSeconds <= 300) {
          funScorePlays.push(play)
        }
        
        currentLeader = newLeader || currentLeader
        
        // Buzzer beaters
        if (clockSeconds <= 3 && play.shotResult === 'Made') {
          funScorePlays.push(play)
        }
        
        // All made shots in 4th quarter (especially close games)
        if (play.shotResult === 'Made' && play.isFieldGoal === 1 && play.mp4) {
          if (isCloseGame || clockSeconds <= 300) {
            // Add if not already in list (avoid duplicates)
            if (!funScorePlays.find(p => p.eventNum === play.eventNum)) {
              funScorePlays.push(play)
            }
          }
        }
        
        // Game-tying/go-ahead shots in 4th quarter (within 5 points)
        if (play.shotResult === 'Made' && play.isFieldGoal === 1 && clockSeconds <= 300) {
          const scoreDiff = Math.abs(scoreHome - scoreAway)
          if (scoreDiff <= 5) {
            // Check if this shot tied or gave the lead
            const prevScoreHome = i > 0 ? parseInt(plays[i - 1].scoreHome || '0') : scoreHome
            const prevScoreAway = i > 0 ? parseInt(plays[i - 1].scoreAway || '0') : scoreAway
            const prevDiff = Math.abs(prevScoreHome - prevScoreAway)
            const newDiff = Math.abs(scoreHome - scoreAway)
            
            // If the difference decreased or changed sign, it's a game-tying/go-ahead shot
            if (newDiff < prevDiff || (prevDiff > 0 && newDiff === 0)) {
              if (!funScorePlays.find(p => p.eventNum === play.eventNum)) {
                funScorePlays.push(play)
              }
            }
          }
        }
      }
      
      // All scoring plays in overtime
      if (play.period > 4 && play.shotResult === 'Made' && play.isFieldGoal === 1 && play.mp4) {
        if (!funScorePlays.find(p => p.eventNum === play.eventNum)) {
          funScorePlays.push(play)
        }
      }
    }
    
    if (funScorePlays.length > 0) {
      // Calculate fantasy points from all players involved in fun score plays
      // Get unique player IDs from fun score plays
      const playerIds = new Set<number>()
      funScorePlays.forEach(play => {
        if (play.personId) {
          playerIds.add(play.personId)
        }
      })

      // Sum fantasy points from all players involved
      let totalFantasyPoints = 0
      if (gameData.AggregatedPlayerStats) {
        playerIds.forEach(personId => {
          const playerStats = gameData.AggregatedPlayerStats[personId.toString()]
          if (playerStats) {
            totalFantasyPoints += calculateFantasyPointsFromStats(playerStats)
          }
        })
      }

      // Build title with milestone info
      let title = `Fun Score: ${scoreData.fun_score}`
      if (milestoneInfo.length > 0) {
        const milestoneText = milestoneInfo.map(m => {
          if (m.milestone === 'Triple Double') {
            return `${m.playerName} Triple Double`
          }
          return `${m.playerName} ${m.points}pt`
        }).join(', ')
        title = `Fun Score: ${scoreData.fun_score} • ${milestoneText}`
      }

      // Get story advantages for charts
      const storyAdvantages = gameData.story?.advantages || []
      
      // Calculate total slide count (plays + top fantasy scorers chart + story advantage charts)
      // Top fantasy scorers chart is always added if we have player stats
      const hasTopFantasyChart = gameData.AggregatedPlayerStats ? 1 : 0
      const totalSlideCount = funScorePlays.length + hasTopFantasyChart + storyAdvantages.length

      // Calculate duplicates skipped for fun_score posts using smart deduplication
      // Helper to parse clock to seconds
      const parseClockToSeconds = (clock: string): number => {
        try {
          const match = clock.match(/PT(\d+)M([\d.]+)S/)
          if (match) {
            const minutes = parseInt(match[1])
            const seconds = parseFloat(match[2])
            return minutes * 60 + seconds
          }
        } catch (e) {
          return 0
        }
        return 0
      }
      
      // Helper to get play priority (higher = better to keep)
      const getPlayPriority = (play: PlayByPlayPlay): number => {
        let priority = 0
        if (play.shotResult === 'Made') priority += 100
        priority += (play.pointsTotal || 0) * 10
        if (play.isFieldGoal === 1) priority += 50
        if (play.shotResult) priority += 25
        return priority
      }
      
      // Smart deduplication: group plays with same mp4 OR plays within 5 seconds with related action types
      const deduplicatedPlays: PlayByPlayPlay[] = []
      const processedEventNums = new Set<number>()
      let duplicatesSkipped = 0
      
      for (let i = 0; i < funScorePlays.length; i++) {
        const play = funScorePlays[i]
        if (!play.mp4 || processedEventNums.has(play.eventNum)) continue
        
        const sameVideoPlays: PlayByPlayPlay[] = [play]
        const playTime = parseClockToSeconds(play.clock)
        
        for (let j = i + 1; j < funScorePlays.length; j++) {
          const otherPlay = funScorePlays[j]
          if (!otherPlay.mp4 || processedEventNums.has(otherPlay.eventNum)) continue
          
          if (otherPlay.period !== play.period) continue
          
          const otherTime = parseClockToSeconds(otherPlay.clock)
          const timeDiff = Math.abs(playTime - otherTime)
          
          const isExactMatch = otherPlay.mp4 === play.mp4 && timeDiff <= 5
          const relatedActionTypes = ['Missed Shot', 'Rebound', 'Made Shot']
          const isRelatedAction = relatedActionTypes.includes(play.actionType) && 
                                 relatedActionTypes.includes(otherPlay.actionType)
          const isSequenceMatch = otherPlay.mp4 !== play.mp4 && timeDiff <= 5 && isRelatedAction
          
          if (isExactMatch || isSequenceMatch) {
            sameVideoPlays.push(otherPlay)
          }
        }
        
        if (sameVideoPlays.length > 1) {
          sameVideoPlays.sort((a, b) => getPlayPriority(b) - getPlayPriority(a))
          deduplicatedPlays.push(sameVideoPlays[0])
          sameVideoPlays.forEach(p => processedEventNums.add(p.eventNum))
          duplicatesSkipped += sameVideoPlays.length - 1
        } else {
          deduplicatedPlays.push(play)
          processedEventNums.add(play.eventNum)
        }
      }

      detected.push({
        id: `fun_score_${gameData.gameId}`,
        postType: 'fun_score',
        title,
        slideCount: totalSlideCount,
        selected: true,
        fantasyPoints: totalFantasyPoints,
        metadata: {
          funScore: scoreData.fun_score,
          plays: funScorePlays,
          scoreData,
          milestones: milestoneInfo,
          milestonePlayerIds: Array.from(milestonePlayerIds),
          storyAdvantages: storyAdvantages,
          duplicatesSkipped
        }
      })
    }
  }

  // 2. Detect Player Highlight Posts (players with >5 actions)
  // Also include plays where player has an assist
  const playerActionCounts = new Map<number, {
    count: number
    plays: PlayByPlayPlay[]
    playerName: string | null
    playerNameI: string | null
  }>()

  // Helper to parse assist player name from description
  // Format: "... (Player Name AST)" or "... (Player Name X AST)"
  const parseAssistPlayer = (description: string): string | null => {
    const assistMatch = description.match(/\(([^)]+)\s+\d+\s+AST\)/)
    if (assistMatch) {
      return assistMatch[1].trim()
    }
    return null
  }

  // Helper to find personId by player name
  const findPersonIdByName = (playerName: string): number | null => {
    if (!gameData.AggregatedPlayerStats) return null
    
    // Normalize the player name for matching (lowercase, trim)
    const normalizedPlayerName = playerName.trim().toLowerCase()
    
    // Try exact matches first
    for (const [personId, stats] of Object.entries(gameData.AggregatedPlayerStats)) {
      const fullName = `${stats.firstName || ''} ${stats.familyName || ''}`.trim()
      const nameI = stats.nameI || ''
      const lastName = stats.familyName || ''
      const firstName = stats.firstName || ''
      
      // Exact matches (case-insensitive)
      if (
        fullName.toLowerCase() === normalizedPlayerName ||
        nameI.toLowerCase() === normalizedPlayerName ||
        lastName.toLowerCase() === normalizedPlayerName ||
        (firstName && `${firstName} ${lastName}`.toLowerCase() === normalizedPlayerName)
      ) {
        return parseInt(personId)
      }
      
      // Match by last name (e.g., "Carter Jr." matches "Wendell Carter Jr.")
      // This handles cases where assist shows "Carter Jr." but full name is "Wendell Carter Jr."
      const normalizedLastName = lastName.toLowerCase()
      if (normalizedLastName && normalizedLastName.includes(normalizedPlayerName)) {
        return parseInt(personId)
      }
      
      // Match by last name parts (handles "Carter Jr." vs "Wendell Carter Jr.")
      const playerNameParts = normalizedPlayerName.split(' ')
      if (playerNameParts.length > 0) {
        const lastPart = playerNameParts[playerNameParts.length - 1]
        if (normalizedLastName && normalizedLastName.includes(lastPart) && lastPart.length > 2) {
          return parseInt(personId)
        }
      }
      
      // Try matching nameI format (e.g., "W. Carter Jr.")
      if (nameI) {
        const nameIParts = nameI.toLowerCase().split(' ')
        const playerNameParts = normalizedPlayerName.split(' ')
        if (nameIParts.length === playerNameParts.length) {
          // Check if last parts match
          if (nameIParts[nameIParts.length - 1] === playerNameParts[playerNameParts.length - 1]) {
            return parseInt(personId)
          }
        }
      }
    }
    
    // Also check existing plays for name matches
    for (const play of plays) {
      if (play.playerName && play.playerName.toLowerCase() === normalizedPlayerName) {
        return play.personId || null
      }
      if (play.playerNameI && play.playerNameI.toLowerCase() === normalizedPlayerName) {
        return play.personId || null
      }
      
      // Try matching by last name from plays
      if (play.playerName) {
        const playLastName = play.playerName.split(' ').slice(-1)[0].toLowerCase()
        const playerLastName = normalizedPlayerName.split(' ').slice(-1)[0]
        if (playLastName === playerLastName && playerLastName.length > 2) {
          return play.personId || null
        }
      }
    }
    
    return null
  }

  // First pass: Add plays where player is the primary actor (personId)
  for (const play of plays) {
    if (play.personId) {
      const existing = playerActionCounts.get(play.personId) || {
        count: 0,
        plays: [],
        playerName: play.playerName,
        playerNameI: play.playerNameI
      }
      existing.count++
      existing.plays.push(play)
      playerActionCounts.set(play.personId, existing)
    }
  }

  // Second pass: Add plays where player has an assist
  for (const play of plays) {
    if (!play.description) continue
    
    const assistPlayerName = parseAssistPlayer(play.description)
    if (!assistPlayerName) continue
    
    const assistPersonId = findPersonIdByName(assistPlayerName)
    if (!assistPersonId) continue
    
    // Only add if the play isn't already in their list (avoid duplicates)
    const existing = playerActionCounts.get(assistPersonId)
    if (existing) {
      // Check if this play is already in their plays list
      const alreadyHasPlay = existing.plays.some(p => p.eventNum === play.eventNum)
      if (!alreadyHasPlay) {
        existing.count++
        existing.plays.push(play)
      }
    } else {
      // Create new entry for this player if they don't have one yet
      // We'll filter out players with <5 actions later
      playerActionCounts.set(assistPersonId, {
        count: 1,
        plays: [play],
        playerName: assistPlayerName,
        playerNameI: assistPlayerName // Will be updated if we find better name
      })
    }
  }

  // Helper to parse clock to seconds for sorting
  const parseClockToSecondsForSort = (clock: string): number => {
    try {
      const match = clock.match(/PT(\d+)M([\d.]+)S/)
      if (match) {
        const minutes = parseInt(match[1])
        const seconds = parseFloat(match[2])
        return minutes * 60 + seconds
      }
    } catch (e) {
      return 0
    }
    return 0
  }

  // Sort all plays chronologically for each player (by period, then clock time)
  for (const [personId, data] of playerActionCounts.entries()) {
    data.plays.sort((a, b) => {
      // First sort by period
      if (a.period !== b.period) {
        return a.period - b.period
      }
      // Then by clock time (earlier in period = higher time remaining)
      const timeA = parseClockToSecondsForSort(a.clock || 'PT00M00.00S')
      const timeB = parseClockToSecondsForSort(b.clock || 'PT00M00.00S')
      // Higher time = earlier in period, so reverse the comparison
      return timeB - timeA
    })
  }

  // Get teams for chart calculations
  const teams = [
    gameData.gameMetadata?.homeTeam?.abbreviation,
    gameData.gameMetadata?.awayTeam?.abbreviation
  ].filter(Boolean) as string[]

  // Create posts for players with >5 actions
  for (const [personId, data] of playerActionCounts.entries()) {
    if (data.count > 5) {
      // Get fantasy points from player's traditional stats
      let fantasyPoints = 0
      if (gameData.AggregatedPlayerStats && gameData.AggregatedPlayerStats[personId.toString()]) {
        const playerStats = gameData.AggregatedPlayerStats[personId.toString()]
        fantasyPoints = calculateFantasyPointsFromStats(playerStats)
      }

      // Calculate chart information
      const chartInfo = calculatePlayerChartInfo(personId, gameData, teams)

      // Calculate duplicates skipped for player_highlight posts using smart deduplication
      // Helper to parse clock to seconds
      const parseClockToSeconds = (clock: string): number => {
        try {
          const match = clock.match(/PT(\d+)M([\d.]+)S/)
          if (match) {
            const minutes = parseInt(match[1])
            const seconds = parseFloat(match[2])
            return minutes * 60 + seconds
          }
        } catch (e) {
          return 0
        }
        return 0
      }
      
      // Helper to get play priority (higher = better to keep)
      const getPlayPriority = (play: PlayByPlayPlay): number => {
        let priority = 0
        if (play.shotResult === 'Made') priority += 100
        priority += (play.pointsTotal || 0) * 10
        if (play.isFieldGoal === 1) priority += 50
        if (play.shotResult) priority += 25
        return priority
      }
      
      // Smart deduplication: group plays with same mp4 OR plays within 5 seconds with related action types
      const deduplicatedPlays: PlayByPlayPlay[] = []
      const processedEventNums = new Set<number>()
      let duplicatesSkipped = 0
      
      for (let i = 0; i < data.plays.length; i++) {
        const play = data.plays[i]
        if (!play.mp4 || processedEventNums.has(play.eventNum)) continue
        
        const sameVideoPlays: PlayByPlayPlay[] = [play]
        const playTime = parseClockToSeconds(play.clock)
        
        for (let j = i + 1; j < data.plays.length; j++) {
          const otherPlay = data.plays[j]
          if (!otherPlay.mp4 || processedEventNums.has(otherPlay.eventNum)) continue
          
          if (otherPlay.period !== play.period || otherPlay.personId !== play.personId) continue
          
          const otherTime = parseClockToSeconds(otherPlay.clock)
          const timeDiff = Math.abs(playTime - otherTime)
          
          const isExactMatch = otherPlay.mp4 === play.mp4 && timeDiff <= 5
          const relatedActionTypes = ['Missed Shot', 'Rebound', 'Made Shot']
          const isRelatedAction = relatedActionTypes.includes(play.actionType) && 
                                 relatedActionTypes.includes(otherPlay.actionType)
          const isSequenceMatch = otherPlay.mp4 !== play.mp4 && timeDiff <= 5 && isRelatedAction
          
          if (isExactMatch || isSequenceMatch) {
            sameVideoPlays.push(otherPlay)
          }
        }
        
        if (sameVideoPlays.length > 1) {
          sameVideoPlays.sort((a, b) => getPlayPriority(b) - getPlayPriority(a))
          deduplicatedPlays.push(sameVideoPlays[0])
          sameVideoPlays.forEach(p => processedEventNums.add(p.eventNum))
          duplicatesSkipped += sameVideoPlays.length - 1
        } else {
          deduplicatedPlays.push(play)
          processedEventNums.add(play.eventNum)
        }
      }

      // Get player's team and opponent team for title
      const playerTeamTricode = data.plays[0]?.teamTricode || ''
      const homeTeam = gameData.gameMetadata?.homeTeam
      const awayTeam = gameData.gameMetadata?.awayTeam
      const playerTeam = playerTeamTricode === homeTeam?.abbreviation ? homeTeam : awayTeam
      const opponentTeam = playerTeamTricode === homeTeam?.abbreviation ? awayTeam : homeTeam
      const opponentTeamName = opponentTeam?.name || opponentTeam?.city || ''
      
      const playerName = data.playerNameI || data.playerName || `Player ${personId}`
      const title = `${playerName} vs ${opponentTeamName} (${fantasyPoints.toFixed(1)} FP)`

      detected.push({
        id: `player_${personId}_${gameData.gameId}`,
        postType: 'player_highlight',
        title,
        slideCount: data.plays.length,
        selected: true,
        fantasyPoints,
        metadata: {
          personId,
          playerName: data.playerName,
          playerNameI: data.playerNameI,
          plays: data.plays,
          actionCount: data.count,
          hasTop5FantasyChart: chartInfo.hasTop5FantasyChart,
          selectedCharts: chartInfo.selectedCharts,
          duplicatesSkipped
        }
      })
    }
  }

  return detected
}

/**
 * Component to check if props exist for a player in a specific game
 */
function PlayerPropsCheck({ personId, gameId, gameDate }: { personId: number; gameId: string; gameDate?: string }) {
  const { data: hasProps } = useQuery({
    queryKey: ['player-props-check', personId, gameId, gameDate],
    queryFn: async () => {
      if (!personId || !gameId) return false

      // First, get the player's UUID and nba_player_id
      const { data: playerData } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name')
        .eq('nba_player_id', personId)
        .maybeSingle()

      if (!playerData) return false

      const playerId = playerData.id
      const nbaPlayerId = playerData.nba_player_id
      const playerName = playerData.name

      // Get game info from nba_games to match with player_props_games
      const { data: nbaGame } = await supabase
        .from('nba_games')
        .select('game_date, home_team_tricode, away_team_tricode')
        .eq('game_id', gameId)
        .maybeSingle()
      
      if (!nbaGame?.game_date) return false

      const targetGameDate = nbaGame.game_date.split('T')[0] // Get date part only
      const homeTeamTricode = nbaGame.home_team_tricode
      const awayTeamTricode = nbaGame.away_team_tricode

      // Find matching player_props_games entry by teams and date
      const { data: propsGame } = await supabase
        .from('player_props_games')
        .select('id, event_id')
        .eq('game_date', targetGameDate)
        .or(`home_team_tricode.eq.${homeTeamTricode},away_team_tricode.eq.${homeTeamTricode},home_team_tricode.eq.${awayTeamTricode},away_team_tricode.eq.${awayTeamTricode}`)
        .limit(1)
        .maybeSingle()

      if (!propsGame) return false

      // Build query conditions for player
      const orConditions: string[] = []
      if (playerId) {
        orConditions.push(`player_id.eq.${playerId}`)
      }
      if (nbaPlayerId) {
        orConditions.push(`nba_player_id.eq.${nbaPlayerId}`)
      }
      if (playerName) {
        orConditions.push(`player_name.ilike.%${playerName}%`)
      }

      if (orConditions.length === 0) return false

      // Check if props exist for this player in this game
      // Use the join to ensure we're matching through player_props_games
      const { data: propsData, error } = await supabase
        .from('player_props')
        .select('id, raw_odd_data, bet_type_id, game_id')
        .eq('game_id', propsGame.id)
        .or(orConditions.join(','))

      if (error) {
        console.error('Error checking player props:', error)
        return false
      }

      if (!propsData || propsData.length === 0) return false

      // Filter to only game-level props (not quarter/half props)
      // Game-level props have periodID === 'game' or 'reg', or no periodID
      // Quarter props have periodID like '1q', '2q', '3q', '4q'
      // Half props have periodID like '1h', '2h'
      const gameLevelProps = propsData.filter(prop => {
        let period = 'game' // Default to game-level
        
        // Extract period from raw_odd_data
        if (prop.raw_odd_data) {
          try {
            const rawData = typeof prop.raw_odd_data === 'string' 
              ? JSON.parse(prop.raw_odd_data) 
              : prop.raw_odd_data
            
            if (rawData && typeof rawData === 'object') {
              period = rawData.periodID || rawData.period || 'game'
            }
          } catch (e) {
            // If parsing fails, check bet_type_id for period indicators
            if (prop.bet_type_id) {
              const betTypeId = prop.bet_type_id.toLowerCase()
              // Check for quarter indicators (1q, 2q, 3q, 4q) or half indicators (1h, 2h)
              if (betTypeId.includes('-1q-') || betTypeId.includes('-2q-') || 
                  betTypeId.includes('-3q-') || betTypeId.includes('-4q-') ||
                  betTypeId.includes('-1h-') || betTypeId.includes('-2h-')) {
                period = 'quarter' // Mark as quarter/half prop
              }
            }
          }
        } else if (prop.bet_type_id) {
          // Fallback: check bet_type_id for period indicators
          const betTypeId = prop.bet_type_id.toLowerCase()
          if (betTypeId.includes('-1q-') || betTypeId.includes('-2q-') || 
              betTypeId.includes('-3q-') || betTypeId.includes('-4q-') ||
              betTypeId.includes('-1h-') || betTypeId.includes('-2h-')) {
            period = 'quarter' // Mark as quarter/half prop
          }
        }
        
        // Only count game-level props (period === 'game' or 'reg')
        return period === 'game' || period === 'reg'
      })

      return gameLevelProps.length > 0
    },
    enabled: !!personId && !!gameId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })

  if (hasProps) {
    return (
      <CheckCircleIcon 
        sx={{ 
          color: '#4ade80', 
          fontSize: '1.2rem',
          verticalAlign: 'middle'
        }} 
      />
    )
  }

  return null
}

interface FeedContentManagerProps {
  initialView?: 'table' | 'form' | 'detection';
  onClose?: () => void;
}

export default function FeedContentManager({ initialView = 'table', onClose }: FeedContentManagerProps = {}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'table' | 'form' | 'detection'>(initialView)
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null)
  const [uploadedGameData, setUploadedGameData] = useState<GameData | null>(null)
  // Multi-file support: store all uploaded games with their detected posts
  const [uploadedGames, setUploadedGames] = useState<Array<{
    gameData: GameData
    gameId: string
    matchup: string
    detectedPosts: Array<{
      id: string
      postType: string
      title: string
      slideCount: number
      selected: boolean
      fantasyPoints: number
      metadata: any
    }>
    existingPostsCount: number
  }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Algorithmic detection state (for backward compatibility with single file mode)
  const [detectedPosts, setDetectedPosts] = useState<Array<{
    id: string
    postType: string
    title: string
    slideCount: number
    selected: boolean
    fantasyPoints: number
    metadata: any
  }>>([])
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  
  // Stepper state
  const [activeStep, setActiveStep] = useState(0)
  const [showMetadataModal, setShowMetadataModal] = useState(false)
  const [existingPostsCount, setExistingPostsCount] = useState(0)
  
  // Fun Score modal state
  const [showFunScoreModal, setShowFunScoreModal] = useState(false)
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    color: 'success' | 'danger' | 'warning' | 'neutral'
  }>({
    open: false,
    message: '',
    color: 'neutral'
  })
  
  // Filter state
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all')
  const [selectedActionType, setSelectedActionType] = useState<string>('all')
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all')
  const [showOnlyWithVideo, setShowOnlyWithVideo] = useState(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [expandedChartCategory, setExpandedChartCategory] = useState<string | null>(null)
  
  
  // Selected posts for bulk actions
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set())

  // Post Builder State
  const [postForm, setPostForm] = useState({
    post_type: 'game_highlight',
    title: '',
    description: '',
    game_id: '',
    game_date: '',
    team_tricodes: [] as string[],
    slides: [] as any[],
    metadata: {} as any
  })

  // Generate OG image for a feed post (async, non-blocking)
  // Includes retry logic for reliability
  const generateOGImageForPost = async (postId: string, postData: any, retries = 3): Promise<void> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🎨 Calling OG image generation for post (attempt ${attempt}/${retries}):`, postId, {
          team_tricodes: postData.team_tricodes,
          player_ids: postData.player_ids,
          has_metadata: !!postData.metadata
        })
        
        // Call Supabase Edge Function to generate OG image
        const { data, error } = await supabase.functions.invoke('generate-og-image', {
          body: {
            post_id: postId,
            team_tricodes: postData.team_tricodes || null,
            player_ids: postData.player_ids || null,
            metadata: postData.metadata || null,
            game_date: postData.game_date || null,
            title: postData.title || null
          }
        })
        
        if (error) {
          console.error(`❌ Failed to generate OG image (attempt ${attempt}/${retries}):`, error)
          if (attempt === retries) {
            console.error('❌ All retry attempts exhausted for OG image generation')
            return
          }
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
        
        if (data?.og_image_url) {
          console.log('✅ OG image generated:', data.og_image_url)
          // Post is already updated by the Edge Function, no need to update again
          return // Success, exit retry loop
        } else {
          console.warn(`⚠️ OG image function returned no URL (attempt ${attempt}/${retries}):`, data)
          if (attempt === retries) {
            console.error('❌ OG image generation failed after all retries')
            return
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }
      } catch (error) {
        console.error(`❌ Error generating OG image (attempt ${attempt}/${retries}):`, error)
        if (attempt === retries) {
          console.error('❌ All retry attempts exhausted due to errors')
          return
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  const loadPosts = async () => {
    setLoading(true)
    try {
      // Fetch all fun_score posts
      const { data: funScorePosts, error: funScoreError } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('post_type', 'fun_score')
        .order('created_at', { ascending: false })

      if (funScoreError) throw funScoreError

      // Only load fun_score posts
      setPosts(funScorePosts || [])
    } catch (error) {
      console.error('Error loading posts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Process JSON file
  const processJsonFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const gameData = JSON.parse(e.target?.result as string) as GameData
        setUploadedGameData(gameData)
        
        // Auto-populate form fields
        const firstScoreKey = Object.keys(gameData.score || {})[0]
        const scoreData = firstScoreKey ? gameData.score[firstScoreKey] : null
        
        // Extract team tricodes
        const teams = [
          gameData.gameMetadata?.homeTeam?.abbreviation,
          gameData.gameMetadata?.awayTeam?.abbreviation
        ].filter(Boolean)
        
        // Auto-generate title from team matchup
        const awayTeam = gameData.gameMetadata?.awayTeam
        const homeTeam = gameData.gameMetadata?.homeTeam
        const autoTitle = awayTeam && homeTeam 
          ? `${awayTeam.city} ${awayTeam.name} vs ${homeTeam.city} ${homeTeam.name}`
          : gameData.story?.matchup || `Game ${gameData.gameId}`
        
        setPostForm(prev => ({
          ...prev,
          title: autoTitle,
          game_id: gameData.gameId || '',
          game_date: gameData.gameMetadata?.date || '',
          team_tricodes: teams,
          metadata: {
            ...prev.metadata,
            arena: gameData.gameMetadata?.arena,
            season: gameData.gameMetadata?.season,
            homeTeam: gameData.gameMetadata?.homeTeam,
            awayTeam: gameData.gameMetadata?.awayTeam,
            story_data: gameData.story,
            fun_data: scoreData,
            fun_score: scoreData?.fun_score
          }
        }))

        // Check existing posts for this game
        const { data: existingPosts } = await supabase
          .from('feed_posts')
          .select('id')
          .eq('game_id', gameData.gameId)
        
        setExistingPostsCount(existingPosts?.length || 0)

        // Detect posts algorithmically
        const detected = detectFeedPosts(gameData)
        setDetectedPosts(detected)

        // Show metadata modal or go directly to detection view
        setShowMetadataModal(true)
      } catch (error) {
        console.error('Error parsing JSON:', error)
        setSnackbar({
          open: true,
          message: 'Invalid JSON file. Please check the format.',
          color: 'danger'
        })
      }
    }
    reader.readAsText(file)
  }

  // Process multiple JSON files
  const processMultipleJsonFiles = async (files: File[]) => {
    const jsonFiles = files.filter(file => file.name.endsWith('.json'))
    
    if (jsonFiles.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select JSON files',
        color: 'warning'
      })
      return
    }

    setLoading(true)
    const processedGames: Array<{
      gameData: GameData
      gameId: string
      matchup: string
      detectedPosts: Array<any>
      existingPostsCount: number
    }> = []

    try {
      // Process each file
      for (const file of jsonFiles) {
        try {
          const gameData = await new Promise<GameData>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => {
              try {
                const data = JSON.parse(e.target?.result as string) as GameData
                resolve(data)
              } catch (error) {
                reject(error)
              }
            }
            reader.onerror = reject
            reader.readAsText(file)
          })

          // Detect posts algorithmically
          const detected = detectFeedPosts(gameData)
          
          // Check existing posts for this game
          const { data: existingPosts } = await supabase
            .from('feed_posts')
            .select('id, title, status, created_at')
            .eq('game_id', gameData.gameId)
            .order('created_at', { ascending: false })

          const awayTeam = gameData.gameMetadata?.awayTeam
          const homeTeam = gameData.gameMetadata?.homeTeam
          const matchup = awayTeam && homeTeam 
            ? `${awayTeam.city} ${awayTeam.name} vs ${homeTeam.city} ${homeTeam.name}`
            : gameData.story?.matchup || `Game ${gameData.gameId}`

          // Alert if duplicate posts exist
          if (existingPosts && existingPosts.length > 0) {
            const existingTitles = existingPosts.map(p => p.title || 'Untitled').join(', ')
            const publishedCount = existingPosts.filter(p => p.status === 'published').length
            
            setSnackbar({
              open: true,
              message: `⚠️ Warning: ${existingPosts.length} existing post(s) found for game ${gameData.gameId} (${matchup}). ${publishedCount} published. Existing: ${existingTitles}`,
              color: 'warning',
              autoHideDuration: 10000 // Show for 10 seconds
            })
            
            console.warn(`⚠️ Duplicate game_id detected: ${gameData.gameId}`, {
              existingPosts: existingPosts.length,
              published: publishedCount,
              titles: existingTitles
            })
          }

          processedGames.push({
            gameData,
            gameId: gameData.gameId || file.name,
            matchup,
            detectedPosts: detected,
            existingPostsCount: existingPosts?.length || 0
          })
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error)
          setSnackbar({
            open: true,
            message: `Error processing ${file.name}: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
            color: 'danger'
          })
        }
      }

      if (processedGames.length > 0) {
        setUploadedGames(processedGames)
        // Switch to detection view to show all detected posts
        setView('detection')
        
        // Count games with duplicates
        const gamesWithDuplicates = processedGames.filter(g => g.existingPostsCount > 0)
        const duplicateCount = gamesWithDuplicates.length
        
        if (duplicateCount > 0) {
          // Show summary warning if any duplicates found
          setSnackbar({
            open: true,
            message: `⚠️ Processed ${processedGames.length} game(s). ${duplicateCount} game(s) have existing posts. Check warnings above.`,
            color: 'warning',
            autoHideDuration: 12000
          })
        } else {
          setSnackbar({
            open: true,
            message: `Successfully processed ${processedGames.length} game(s)`,
            color: 'success'
          })
        }
      }
    } catch (error) {
      console.error('Error processing files:', error)
      setSnackbar({
        open: true,
        message: 'Error processing files',
        color: 'danger'
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle JSON file upload from input
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    // If multiple files, use multi-file processing
    if (files.length > 1) {
      processMultipleJsonFiles(Array.from(files))
      return
    }
    
    // Single file - use existing flow for backward compatibility
    const file = files[0]
    if (uploadedGameData || uploadedGames.length > 0) {
      // Show confirmation if data already exists
      setPendingFile(file)
      setShowDiscardConfirm(true)
    } else {
      processJsonFile(file)
    }
  }

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const jsonFiles = files.filter(file => file.name.endsWith('.json'))

    if (jsonFiles.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please drop JSON file(s)',
        color: 'warning'
      })
      return
    }

    // If multiple files, use multi-file processing
    if (jsonFiles.length > 1) {
      processMultipleJsonFiles(jsonFiles)
      return
    }

    // Single file - use existing flow
    const jsonFile = jsonFiles[0]
    if (uploadedGameData || uploadedGames.length > 0) {
      // Show confirmation if data already exists
      setPendingFile(jsonFile)
      setShowDiscardConfirm(true)
    } else {
      processJsonFile(jsonFile)
    }
  }

  // Handle discard confirmation
  const handleDiscardAndLoad = () => {
    if (pendingFile) {
      processJsonFile(pendingFile)
      setPendingFile(null)
    }
    setShowDiscardConfirm(false)
  }

  const handleCancelDiscard = () => {
    setPendingFile(null)
    setShowDiscardConfirm(false)
  }

  // Toggle selection for detected post (single file mode)
  const handleToggleSelection = (id: string) => {
    setDetectedPosts(prev => 
      prev.map(post => 
        post.id === id ? { ...post, selected: !post.selected } : post
      )
    )
  }

  // Toggle selection for detected post (multi-file mode)
  const handleToggleSelectionMulti = (gameIndex: number, postId: string) => {
    setUploadedGames(prev => 
      prev.map((game, idx) => 
        idx === gameIndex 
          ? {
              ...game,
              detectedPosts: game.detectedPosts.map(post =>
                post.id === postId ? { ...post, selected: !post.selected } : post
              )
            }
          : game
      )
    )
  }

  // Select/Deselect all (single file mode)
  const handleSelectAll = () => {
    const allSelected = detectedPosts.every(p => p.selected)
    setDetectedPosts(prev => 
      prev.map(post => ({ ...post, selected: !allSelected }))
    )
  }

  // Select/Deselect all (multi-file mode)
  const handleSelectAllMulti = () => {
    const allSelected = uploadedGames.every(game => 
      game.detectedPosts.every(p => p.selected)
    )
    setUploadedGames(prev => 
      prev.map(game => ({
        ...game,
        detectedPosts: game.detectedPosts.map(post => ({ ...post, selected: !allSelected }))
      }))
    )
  }

  // Create posts from selected detected posts (multi-file mode)
  const handleBulkCreatePostsMulti = async () => {
    if (!user || uploadedGames.length === 0) {
      console.warn('⚠️ Missing user or uploadedGames:', { hasUser: !!user, hasGames: uploadedGames.length })
      return
    }

    // Collect all selected posts across all games
    const allSelected: Array<{ gameIndex: number; post: any; gameData: GameData }> = []
    uploadedGames.forEach((game, gameIndex) => {
      game.detectedPosts
        .filter(p => p.selected)
        .forEach(post => {
          allSelected.push({ gameIndex, post, gameData: game.gameData })
        })
    })

    if (allSelected.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one post to create',
        color: 'warning'
      })
      return
    }

    setLoading(true)
    let successCount = 0
    let errorCount = 0

    try {
      console.log('🔄 Starting bulk post creation for', allSelected.length, 'posts across', uploadedGames.length, 'games')

      // Process each selected post
      for (const { gameIndex, post: detected, gameData } of allSelected) {
        try {
          const teams = [
            gameData.gameMetadata?.homeTeam?.abbreviation,
            gameData.gameMetadata?.awayTeam?.abbreviation
          ].filter(Boolean) as string[]

          const firstScoreKey = Object.keys(gameData.score || {})[0]
          const scoreData = firstScoreKey ? gameData.score[firstScoreKey] : null
          
          // Create post with full slide generation
          const result = await createPostFromDetected(detected, gameData, teams, scoreData)
          if (result) {
            successCount++
          } else {
            // Post was skipped (no slides)
            console.warn(`⚠️ Skipped post for game ${gameData.gameId} - no slides generated`)
          }
        } catch (error) {
          console.error(`❌ Error creating post for game ${gameData.gameId}:`, error)
          errorCount++
        }
      }

      setSnackbar({
        open: true,
        message: `Successfully created ${successCount} post(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        color: successCount > 0 ? 'success' : 'danger'
      })

      loadPosts()
      setView('table')
      setUploadedGames([])
    } catch (error: any) {
      console.error('Error bulk creating posts:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error creating posts',
        color: 'danger'
      })
    } finally {
      setLoading(false)
    }
  }

  // Helper function to generate slides from a detected post and game data
  // This extracts the slide creation logic to work with any gameData
  const generateSlidesFromDetected = (
    detected: any,
    gameData: GameData,
    teams: string[],
    scoreData: any
  ): any[] => {
    const slides: any[] = []

    if (detected.postType === 'fun_score') {
      // Reuse the fun_score slide creation logic with gameData parameter
      const plays = detected.metadata.plays as PlayByPlayPlay[]
      const storyAdvantages = detected.metadata.storyAdvantages || []
      
      // Get the very last play from playByPlay that has an mp4
      let lastPlayMp4: PlayByPlayPlay | null = null
      if (gameData.playByPlay?.allPlays) {
        const allPlays = gameData.playByPlay.allPlays
        for (let i = allPlays.length - 1; i >= 0; i--) {
          if (allPlays[i].mp4) {
            lastPlayMp4 = allPlays[i]
            break
          }
        }
      }
      
      const videoSlides: any[] = []
      const seenVideoUrls = new Set<string>()
      
      const parseClockToSeconds = (clock: string): number => {
        try {
          const match = clock.match(/PT(\d+)M([\d.]+)S/)
          if (match) {
            const minutes = parseInt(match[1])
            const seconds = parseFloat(match[2])
            return minutes * 60 + seconds
          }
        } catch (e) {
          return 0
        }
        return 0
      }
      
      const getPlayPriority = (play: PlayByPlayPlay): number => {
        let priority = 0
        if (play.shotResult === 'Made') priority += 100
        priority += (play.pointsTotal || 0) * 10
        if (play.isFieldGoal === 1) priority += 50
        if (play.shotResult) priority += 25
        return priority
      }
      
      const deduplicatedPlays: PlayByPlayPlay[] = []
      const processedEventNums = new Set<number>()
      
      for (let i = 0; i < plays.length; i++) {
        const play = plays[i]
        if (!play.mp4 || processedEventNums.has(play.eventNum)) continue
        
        const sameVideoPlays: PlayByPlayPlay[] = [play]
        const playTime = parseClockToSeconds(play.clock)
        
        for (let j = i + 1; j < plays.length; j++) {
          const otherPlay = plays[j]
          if (!otherPlay.mp4 || processedEventNums.has(otherPlay.eventNum)) continue
          if (otherPlay.period !== play.period || otherPlay.personId !== play.personId) continue
          
          const otherTime = parseClockToSeconds(otherPlay.clock)
          const timeDiff = Math.abs(playTime - otherTime)
          const isExactMatch = otherPlay.mp4 === play.mp4 && timeDiff <= 5
          const relatedActionTypes = ['Missed Shot', 'Rebound', 'Made Shot']
          const isRelatedAction = relatedActionTypes.includes(play.actionType) && 
                                 relatedActionTypes.includes(otherPlay.actionType)
          const isSequenceMatch = otherPlay.mp4 !== play.mp4 && timeDiff <= 5 && isRelatedAction
          
          if (isExactMatch || isSequenceMatch) {
            sameVideoPlays.push(otherPlay)
          }
        }
        
        if (sameVideoPlays.length > 1) {
          sameVideoPlays.sort((a, b) => getPlayPriority(b) - getPlayPriority(a))
          deduplicatedPlays.push(sameVideoPlays[0])
          sameVideoPlays.forEach(p => processedEventNums.add(p.eventNum))
        } else {
          deduplicatedPlays.push(play)
          processedEventNums.add(play.eventNum)
        }
      }
      
      const addVideoSlide = (play: PlayByPlayPlay, extraMetadata?: any) => {
        if (!play.mp4 || seenVideoUrls.has(play.mp4)) return false
        seenVideoUrls.add(play.mp4)
        videoSlides.push({
          type: 'video',
          order: 0,
          video_url: play.mp4,
          thumbnail_url: play.mp4.replace('.mp4', '_thumbnail.jpg'),
          caption: play.description,
          metadata: {
            period: play.period,
            clock: play.clock,
            actionType: play.actionType,
            subType: play.subType,
            playerName: play.playerName,
            playerNameI: play.playerNameI,
            personId: play.personId,
            teamTricode: play.teamTricode,
            scoreHome: play.scoreHome,
            scoreAway: play.scoreAway,
            shotResult: play.shotResult,
            eventNum: play.eventNum,
            ...extraMetadata
          }
        })
        return true
      }
      
      for (const play of deduplicatedPlays) {
        addVideoSlide(play)
      }
      
      if (lastPlayMp4 && lastPlayMp4.mp4) {
        addVideoSlide(lastPlayMp4, { isLastPlay: true })
      }
      
      const margin = scoreData?.team_stats?.['Margin of Victory'] ?? null
      if (margin !== null && margin < 5 && gameData.playByPlay?.allPlays) {
        const allPlays = gameData.playByPlay.allPlays
        const playsWithMp4: PlayByPlayPlay[] = []
        for (let i = allPlays.length - 1; i >= 0; i--) {
          if (allPlays[i].mp4) {
            playsWithMp4.push(allPlays[i])
            if (playsWithMp4.length >= 5) break
          }
        }
        playsWithMp4.reverse()
        for (const play of playsWithMp4) {
          addVideoSlide(play, { isCloseGameFinalClip: true })
        }
      }
      
      const chartSlides: any[] = []
      
      // Add top fantasy scorers chart
      if (gameData.AggregatedPlayerStats) {
        // Build a map of personId to teamTricode from plays (fallback if not in stats)
        const playerTeamMap = new Map<number, string>()
        if (gameData.playByPlay?.allPlays) {
          for (const play of gameData.playByPlay.allPlays) {
            if (play.personId && play.teamTricode && !playerTeamMap.has(play.personId)) {
              playerTeamMap.set(play.personId, play.teamTricode)
            }
          }
        }
        
        const allPlayers = Object.entries(gameData.AggregatedPlayerStats)
          .map(([personId, stats]: [string, any]) => {
            const fantasyPoints = calculateFantasyPointsFromStats(stats)
            // Try to get teamTricode from stats first, then from plays map
            let teamTricode = stats.teamTricode || ''
            if (!teamTricode) {
              teamTricode = playerTeamMap.get(parseInt(personId)) || ''
            }
            const teamColor = getTeamPrimaryColor(teamTricode)
            
            return {
              personId: parseInt(personId),
              name: stats.nameI || `${stats.firstName || ''} ${stats.familyName || ''}`.trim(),
              teamTricode: teamTricode,
              teamColor: getContrastColor(teamColor),
              fantasyPoints: fantasyPoints,
              pts: stats.traditional_points || 0,
              reb: stats.traditional_reboundsTotal || 0,
              ast: stats.traditional_assists || 0,
              stl: stats.traditional_steals || 0,
              blk: stats.traditional_blocks || 0,
              tov: stats.traditional_turnovers || 0
            }
          })
          .filter(p => p.fantasyPoints > 0)
          .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
          .slice(0, 5)
        
        if (allPlayers.length > 0) {
          chartSlides.push({
            type: 'top_fantasy_scorers',
            order: 0,
            duration: 7000,
            players: allPlayers
          })
        }
      }
      
      // Add story advantage charts
      for (let i = 0; i < storyAdvantages.length; i++) {
        const advantage = storyAdvantages[i]
        const winnerTricode = advantage.teamTricode
        const homeTri = gameData.gameMetadata?.homeTeam?.abbreviation
        const awayTri = gameData.gameMetadata?.awayTeam?.abbreviation
        const primary = Math.max(advantage.value1 ?? 0, advantage.value2 ?? 0)
        const secondary = Math.min(advantage.value1 ?? 0, advantage.value2 ?? 0)
        const homeTeamIdentifier = gameData.gameMetadata?.homeTeam?.abbreviation || gameData.gameMetadata?.homeTeam?.name || ''
        const awayTeamIdentifier = gameData.gameMetadata?.awayTeam?.abbreviation || gameData.gameMetadata?.awayTeam?.name || ''
        
        chartSlides.push({
          type: 'story_comparison',
          order: 0,
          duration: 7000,
          advantage: {
            category: advantage.stat_name,
            home_value: winnerTricode === homeTri ? primary : (winnerTricode === awayTri ? secondary : advantage.value1),
            away_value: winnerTricode === awayTri ? primary : (winnerTricode === homeTri ? secondary : advantage.value2),
            winner: winnerTricode === homeTri ? 'home' : 'away'
          },
          home_team: {
            name: gameData.gameMetadata?.homeTeam?.name || '',
            city: gameData.gameMetadata?.homeTeam?.city || '',
            color: getContrastColor(getTeamPrimaryColor(homeTeamIdentifier))
          },
          away_team: {
            name: gameData.gameMetadata?.awayTeam?.name || '',
            city: gameData.gameMetadata?.awayTeam?.city || '',
            color: getContrastColor(getTeamPrimaryColor(awayTeamIdentifier))
          }
        })
      }
      
      if (chartSlides.length > 0 && videoSlides.length > 0) {
        const totalSlides = videoSlides.length + chartSlides.length
        const intervals = Math.floor(videoSlides.length / (chartSlides.length + 1))
        let videoIndex = 0
        let chartIndex = 0
        for (let i = 0; i < totalSlides; i++) {
          const chartsInserted = chartIndex
          const videosInserted = videoIndex
          const nextChartThreshold = (chartsInserted + 1) * intervals + chartsInserted
          if (chartIndex < chartSlides.length && videosInserted >= nextChartThreshold && videosInserted > 0) {
            chartSlides[chartIndex].order = slides.length
            slides.push(chartSlides[chartIndex])
            chartIndex++
          } else if (videoIndex < videoSlides.length) {
            videoSlides[videoIndex].order = slides.length
            slides.push(videoSlides[videoIndex])
            videoIndex++
          } else if (chartIndex < chartSlides.length) {
            chartSlides[chartIndex].order = slides.length
            slides.push(chartSlides[chartIndex])
            chartIndex++
          }
        }
      } else {
        [...videoSlides, ...chartSlides].forEach((slide, idx) => {
          slide.order = idx
          slides.push(slide)
        })
      }
    } else if (detected.postType === 'player_highlight') {
      // For player highlights, collect video slides first, then position shot chart based on total count
      const personId = detected.metadata.personId
      const playerName = detected.metadata.playerNameI || detected.metadata.playerName
      
      console.log('🎯 Generating player spotlight slides for:', { personId, playerName, postType: detected.postType })
      
      // First, collect all video slides
      const videoSlides: any[] = []
      const plays = detected.metadata.plays as PlayByPlayPlay[]
      const seenVideoUrls = new Set<string>()
      
      for (const play of plays) {
        if (!play.mp4 || seenVideoUrls.has(play.mp4)) continue
        seenVideoUrls.add(play.mp4)
        videoSlides.push({
          type: 'video',
          order: 0, // Will be reassigned
          video_url: play.mp4,
          thumbnail_url: play.mp4.replace('.mp4', '_thumbnail.jpg'),
          caption: play.description,
          metadata: {
            period: play.period,
            clock: play.clock,
            actionType: play.actionType,
            subType: play.subType,
            playerName: play.playerName,
            playerNameI: play.playerNameI,
            personId: play.personId,
            teamTricode: play.teamTricode,
            scoreHome: play.scoreHome,
            scoreAway: play.scoreAway,
            shotResult: play.shotResult
          }
        })
      }
      
      // Collect all field goals for this player from the game
      const fieldGoals: Array<{
        eventNum: number
        xLegacy: number
        yLegacy: number
        shotResult: string | null
        shotDistance: number | null
        period: number
        clock: string
        description: string
      }> = []
      
      if (gameData.playByPlay?.allPlays && personId) {
        console.log('📊 Checking plays for field goals. Total plays:', gameData.playByPlay.allPlays.length)
        for (const play of gameData.playByPlay.allPlays) {
          // Only include field goals for this player with coordinates
          if (
            play.personId === personId &&
            play.isFieldGoal === 1 &&
            play.xLegacy !== null &&
            play.xLegacy !== undefined &&
            play.yLegacy !== null &&
            play.yLegacy !== undefined
          ) {
            fieldGoals.push({
              eventNum: play.eventNum,
              xLegacy: play.xLegacy,
              yLegacy: play.yLegacy,
              shotResult: play.shotResult,
              shotDistance: play.shotDistance,
              period: play.period,
              clock: play.clock,
              description: play.description
            })
          }
        }
        console.log('🏀 Found field goals:', fieldGoals.length)
      } else {
        console.log('⚠️ Missing data:', { 
          hasPlays: !!gameData.playByPlay?.allPlays, 
          personId,
          playsCount: gameData.playByPlay?.allPlays?.length || 0
        })
      }
      
      // Get teamTricode from first play or player stats
      let teamTricode: string | undefined
      if (gameData.playByPlay?.allPlays && personId) {
        const firstPlay = gameData.playByPlay.allPlays.find((play: any) => play.personId === personId)
        if (firstPlay?.teamTricode) {
          teamTricode = firstPlay.teamTricode
        }
      }
      // Fallback to player stats if available
      if (!teamTricode && gameData.AggregatedPlayerStats) {
        const playerStats = gameData.AggregatedPlayerStats[personId.toString()] as any
        if (playerStats && (playerStats.teamTricode || (playerStats as any).teamTricode)) {
          teamTricode = (playerStats as any).teamTricode
        }
      }
      
      // Calculate total slides (video slides + shot chart if we have field goals)
      const hasShotChart = fieldGoals.length > 0
      const totalSlides = videoSlides.length + (hasShotChart ? 1 : 0)
      
      // Determine shot chart position based on total slide count
      // - Many slides (40+): put it early (around 10-15% through, but at least position 1)
      // - Few slides (5-10): put it last
      // - Medium slides (10-40): put it in the middle (around 20-30% through)
      let shotChartPosition = 0
      if (hasShotChart && totalSlides > 0) {
        if (totalSlides <= 10) {
          // Few slides: put it last
          shotChartPosition = totalSlides - 1
        } else if (totalSlides >= 40) {
          // Many slides: put it early (around 10-15% through, minimum position 1)
          shotChartPosition = Math.max(1, Math.floor(totalSlides * 0.12))
        } else {
          // Medium slides: put it in the middle (around 20-30% through)
          shotChartPosition = Math.max(1, Math.floor(totalSlides * 0.25))
        }
      }
      
      console.log(`📊 Total slides: ${totalSlides}, Shot chart position: ${shotChartPosition}`)
      
      // Build slides array: add video slides first, then insert shot chart at calculated position
      let currentOrder = 0
      for (let i = 0; i < videoSlides.length; i++) {
        if (hasShotChart && currentOrder === shotChartPosition) {
          // Insert shot chart at this position
          slides.push({
            type: 'shot_chart_table',
            order: currentOrder++,
            duration: fieldGoals.length > 0 ? Math.max(7000, fieldGoals.length * 500) : 7000,
            shots: fieldGoals,
            playerName: playerName,
            teamTricode: teamTricode
          })
          console.log(`✅ Added shot chart table slide at position ${shotChartPosition} with ${fieldGoals.length} shots`)
        }
        // Add video slide
        videoSlides[i].order = currentOrder++
        slides.push(videoSlides[i])
      }
      
      // If shot chart hasn't been added yet (shouldn't happen, but safety check)
      if (hasShotChart && slides.filter(s => s.type === 'shot_chart_table').length === 0) {
        slides.push({
          type: 'shot_chart_table',
          order: currentOrder++,
          duration: fieldGoals.length > 0 ? Math.max(7000, fieldGoals.length * 500) : 7000,
          shots: fieldGoals,
          playerName: playerName,
          teamTricode: teamTricode
        })
        console.log(`✅ Added shot chart table slide at end with ${fieldGoals.length} shots`)
      }
      
      console.log('📹 Added', videoSlides.length, 'video slides. Total slides:', slides.length)
      
      // If no slides generated, skip this post
      if (slides.length === 0) {
        return []
      }
    }

    return slides
  }

  // Helper function to create a post from detected post data
  const createPostFromDetected = async (
    detected: any,
    gameData: GameData,
    teams: string[],
    scoreData: any
  ) => {
    if (!user) throw new Error('User not authenticated')

    // Generate slides using the helper function
    const slides = generateSlidesFromDetected(detected, gameData, teams, scoreData)
    
    // Skip if no slides generated
    if (slides.length === 0) {
      console.warn('⚠️ Skipping post - no slides generated:', detected.title || detected.postType)
      return null
    }

    // Extract player IDs from slides
    const playerIds = Array.from(new Set(
      slides
        .map(s => s.metadata?.personId)
        .filter(Boolean)
    )).map(id => parseInt(id))

    const isPlayerSpotlight = detected.postType !== 'fun_score'
    const primaryPlayerId = isPlayerSpotlight ? (detected.metadata?.personId || playerIds[0]) : null
    const gameId = gameData.gameId || null
    
    // Parse game date - handle various formats
    let gameDate = null
    if (gameData.gameMetadata?.date) {
      try {
        const dateStr = gameData.gameMetadata.date
        // Handle ISO string, timestamp, or date string
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          // Format as YYYY-MM-DD
          gameDate = date.toISOString().split('T')[0]
        }
      } catch (e) {
        console.warn('⚠️ Could not parse game date:', gameData.gameMetadata.date)
      }
    }

    // Fetch player props and calculate hit rate for player_spotlight posts
    let playerPropsData = null
    let hitRate = null
    let propsIcon = null // 'fire' or 'snow' or null

    if (isPlayerSpotlight && primaryPlayerId && gameId && gameDate) {
      try {
        console.log('🎲 Fetching player props for player spotlight post:', { primaryPlayerId, gameId, gameDate })
        
        // First, get game info from nba_games to match with player_props_games
        const { data: nbaGame } = await supabase
          .from('nba_games')
          .select('game_date, home_team_tricode, away_team_tricode')
          .eq('game_id', gameId)
          .maybeSingle()
        
        if (!nbaGame?.game_date) {
          console.warn('⚠️ No nba_game found for gameId:', gameId)
        } else {
          const targetGameDate = nbaGame.game_date.split('T')[0]
          const homeTeamTricode = nbaGame.home_team_tricode
          const awayTeamTricode = nbaGame.away_team_tricode

          // Find matching player_props_games entry
          const { data: propsGame } = await supabase
            .from('player_props_games')
            .select('id, event_id')
            .eq('game_date', targetGameDate)
            .or(`home_team_tricode.eq.${homeTeamTricode},away_team_tricode.eq.${homeTeamTricode},home_team_tricode.eq.${awayTeamTricode},away_team_tricode.eq.${awayTeamTricode}`)
            .limit(1)
            .maybeSingle()

          if (propsGame) {
            // Fetch player props for this game using the player_props_games.id
            // Also try matching by nba_game_id if available
            let allProps = null
            let propsError = null
            
            // First try matching by game_id (player_props_games.id) and nba_player_id
            const { data: propsByGameId, error: error1 } = await supabase
              .from('player_props')
              .select('id, bet_type, line, bet_type_id, game_date, game_id, raw_odd_data')
              .eq('game_id', propsGame.id)
              .eq('nba_player_id', primaryPlayerId)
            
            if (error1 || !propsByGameId || propsByGameId.length === 0) {
              // Fallback: try matching by game_date and nba_player_id
              const { data: propsByDate, error: error2 } = await supabase
                .from('player_props')
                .select('id, bet_type, line, bet_type_id, game_date, game_id, raw_odd_data')
                .eq('game_date', targetGameDate)
                .eq('nba_player_id', primaryPlayerId)
              
              allProps = propsByDate
              propsError = error2
            } else {
              allProps = propsByGameId
              propsError = error1
            }

            // Filter to only game-level props (not quarter/half props)
            const props = allProps?.filter(prop => {
              let period = 'game' // Default to game-level
              
              // Extract period from raw_odd_data
              if (prop.raw_odd_data) {
                try {
                  const rawData = typeof prop.raw_odd_data === 'string' 
                    ? JSON.parse(prop.raw_odd_data) 
                    : prop.raw_odd_data
                  
                  if (rawData && typeof rawData === 'object') {
                    period = rawData.periodID || rawData.period || 'game'
                  }
                } catch (e) {
                  // If parsing fails, check bet_type_id for period indicators
                  if (prop.bet_type_id) {
                    const betTypeId = prop.bet_type_id.toLowerCase()
                    // Check for quarter indicators (1q, 2q, 3q, 4q) or half indicators (1h, 2h)
                    if (betTypeId.includes('-1q-') || betTypeId.includes('-2q-') || 
                        betTypeId.includes('-3q-') || betTypeId.includes('-4q-') ||
                        betTypeId.includes('-1h-') || betTypeId.includes('-2h-')) {
                      period = 'quarter' // Mark as quarter/half prop
                    }
                  }
                }
              } else if (prop.bet_type_id) {
                // Fallback: check bet_type_id for period indicators
                const betTypeId = prop.bet_type_id.toLowerCase()
                if (betTypeId.includes('-1q-') || betTypeId.includes('-2q-') || 
                    betTypeId.includes('-3q-') || betTypeId.includes('-4q-') ||
                    betTypeId.includes('-1h-') || betTypeId.includes('-2h-')) {
                  period = 'quarter' // Mark as quarter/half prop
                }
              }
              
              // Only include game-level props (period === 'game' or 'reg')
              return period === 'game' || period === 'reg'
            }) || []

            if (!propsError && props && props.length > 0) {
              // Fetch boxscore to calculate results
              const { data: boxscore, error: boxscoreError } = await supabase
                .from('nba_boxscores')
                .select('pts, reb, ast, stl, blk, tov, fg3m, ftm')
                .eq('nba_player_id', primaryPlayerId)
                .eq('game_id', gameId)
                .single()

              if (!boxscoreError && boxscore) {
                // Calculate results for each prop with proper over/under detection
                const propResults = props.map((prop, index) => {
                  // First, determine if this is an over or under prop
                  let overUnder: 'O' | 'U' | null = null
                  
                  // Extract from bet_type_id
                  const betTypeId = prop.bet_type_id || ''
                  if (betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over')) {
                    overUnder = 'O'
                  } else if (betTypeId.includes('-under') || betTypeId.endsWith('under') || betTypeId.toLowerCase().includes('under')) {
                    overUnder = 'U'
                  } else {
                    // Extract from raw_odd_data
                    try {
                      const rawData = typeof prop.raw_odd_data === 'string' 
                        ? JSON.parse(prop.raw_odd_data) 
                        : prop.raw_odd_data
                      
                      if (rawData && typeof rawData === 'object') {
                        const side = rawData.sideID || rawData.sideId || rawData.overUnder || ''
                        if (side === 'over' || side === 'Over' || side === 'O') {
                          overUnder = 'O'
                        } else if (side === 'under' || side === 'Under' || side === 'U') {
                          overUnder = 'U'
                        }
                      }
                    } catch (e) {
                      // If parsing fails, continue
                    }
                  }
                  
                  // Calculate the actual result
                  // Handle combined props (PTS+REB, PTS+AST, etc.)
                  let result = null
                  const normalizedBetType = prop.bet_type.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+')
                  
                  if (normalizedBetType.includes('points+rebounds+assists') || normalizedBetType.includes('par')) {
                    const actualValue = (boxscore.pts || 0) + (boxscore.reb || 0) + (boxscore.ast || 0)
                    const line = prop.line || 0
                    result = {
                      propId: `${prop.bet_type}-${line}`,
                      betType: prop.bet_type,
                      line,
                      actualValue,
                      hit: false, // Will be calculated below
                      result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                    }
                  } else if (normalizedBetType.includes('points+rebounds') || normalizedBetType.includes('pts+reb')) {
                    const actualValue = (boxscore.pts || 0) + (boxscore.reb || 0)
                    const line = prop.line || 0
                    result = {
                      propId: `${prop.bet_type}-${line}`,
                      betType: prop.bet_type,
                      line,
                      actualValue,
                      hit: false,
                      result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                    }
                  } else if (normalizedBetType.includes('points+assists') || normalizedBetType.includes('pts+ast')) {
                    const actualValue = (boxscore.pts || 0) + (boxscore.ast || 0)
                    const line = prop.line || 0
                    result = {
                      propId: `${prop.bet_type}-${line}`,
                      betType: prop.bet_type,
                      line,
                      actualValue,
                      hit: false,
                      result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                    }
                  } else if (normalizedBetType.includes('rebounds+assists') || normalizedBetType.includes('reb+ast')) {
                    const actualValue = (boxscore.reb || 0) + (boxscore.ast || 0)
                    const line = prop.line || 0
                    result = {
                      propId: `${prop.bet_type}-${line}`,
                      betType: prop.bet_type,
                      line,
                      actualValue,
                      hit: false,
                      result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                    }
                  } else if (normalizedBetType.includes('blocks+steals') || normalizedBetType.includes('stocks')) {
                    const actualValue = (boxscore.blk || 0) + (boxscore.stl || 0)
                    const line = prop.line || 0
                    result = {
                      propId: `${prop.bet_type}-${line}`,
                      betType: prop.bet_type,
                      line,
                      actualValue,
                      hit: false,
                      result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                    }
                  } else {
                    // Single stat props - use calculatePropResult
                    result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore)
                  }
                  
                  if (!result) {
                    return {
                      ...prop,
                      overUnder,
                      result: null
                    }
                  }
                  
                  // Determine if this prop HIT based on over/under
                  // Over prop: hit if actual > line
                  // Under prop: hit if actual < line
                  // Push: exactly on line (doesn't count as hit)
                  let hit = false
                  if (result.result === 'push') {
                    hit = false // Push doesn't count as hit
                  } else if (overUnder === 'O') {
                    hit = result.result === 'over' // Over prop hits if actual > line
                  } else if (overUnder === 'U') {
                    hit = result.result === 'under' // Under prop hits if actual < line
                  } else {
                    // If we don't know if it's over/under, default to checking if actual > line
                    hit = result.result === 'over'
                  }
                  
                  return {
                    id: prop.id || `${prop.bet_type}-${prop.line}-${index}`,
                    bet_type: prop.bet_type,
                    line: prop.line,
                    overUnder,
                    result: {
                      actualValue: result.actualValue,
                      hit,
                      result: result.result
                    }
                  }
                })

                // Calculate hit rate (percentage of props that hit)
                const hits = propResults.filter(p => p.result?.hit === true).length
                const totalProps = propResults.length
                hitRate = totalProps > 0 ? (hits / totalProps) : 0

                // Calculate overs/unders hit separately for display
                const oversHit = propResults.filter(p => {
                  return p.overUnder === 'O' && p.result?.result === 'over'
                }).length
                
                const undersHit = propResults.filter(p => {
                  return p.overUnder === 'U' && p.result?.result === 'under'
                }).length
                
                const pushes = propResults.filter(p => p.result?.result === 'push').length

                // Determine icon based on hit rate
                if (hitRate > 0.75) {
                  propsIcon = 'fire'
                } else if (hitRate < 0.25) {
                  propsIcon = 'snow'
                }

                playerPropsData = {
                  props: propResults,
                  hitRate,
                  totalProps,
                  oversHit,
                  undersHit,
                  pushes
                }

                console.log('✅ Player props calculated:', { 
                  hitRate, 
                  totalProps, 
                  oversHit, 
                  undersHit, 
                  hits, 
                  propsIcon,
                  propsCount: propResults.length,
                  sampleProp: propResults[0] ? {
                    id: propResults[0].id,
                    bet_type: propResults[0].bet_type,
                    line: propResults[0].line,
                    overUnder: propResults[0].overUnder,
                    hasResult: !!propResults[0].result
                  } : null
                })
              } else {
                console.warn('⚠️ No boxscore found for player props calculation')
              }
            } else {
              console.log('ℹ️ No player props found for this game')
            }
          } else {
            console.log('ℹ️ No player_props_games entry found for this game')
          }
        }
      } catch (error) {
        console.error('❌ Error fetching player props:', error)
      }
    }

    // Add props data to slides metadata
    const slidesWithProps = slides.map(slide => ({
      ...slide,
      metadata: {
        ...slide.metadata,
        ...(playerPropsData ? { playerProps: playerPropsData } : {})
      }
    }))

    // Log props data being stored
    if (playerPropsData) {
      console.log('📦 Storing player props in post:', {
        hasProps: !!playerPropsData,
        totalProps: playerPropsData.totalProps,
        hitRate: playerPropsData.hitRate,
        propsInSlides: slidesWithProps[0]?.metadata?.playerProps ? 'yes' : 'no',
        propsInMetadata: 'yes'
      })
    }

    const postData = {
      created_by: user.id,
      post_type: detected.postType === 'fun_score' ? 'fun_score' : 'player_spotlight',
      status: 'published',
      published_at: new Date().toISOString(),
      title: detected.title,
      description: detected.postType === 'fun_score' 
        ? `Fun Score breakdown with ${slides.length} exciting plays`
        : `${detected.metadata.playerNameI || detected.metadata.playerName}'s game highlights`,
      game_id: gameId,
      game_date: gameData.gameMetadata?.date || null,
      team_tricodes: teams,
      player_ids: playerIds,
      person_id: detected.postType === 'fun_score' ? null : (detected.metadata?.personId || null),
      slides: slidesWithProps,
      metadata: {
        arena: gameData.gameMetadata?.arena,
        season: gameData.gameMetadata?.season,
        homeTeam: gameData.gameMetadata?.homeTeam,
        awayTeam: gameData.gameMetadata?.awayTeam,
        story_data: gameData.story,
        fun_data: scoreData,
        fun_score: scoreData?.fun_score,
        fantasyPoints: detected.fantasyPoints,
        ...(playerPropsData ? {
          playerProps: playerPropsData,
          propsIcon: propsIcon
        } : {}),
        ...detected.metadata
      }
    }

    const { data: insertedPost, error } = await supabase
      .from('feed_posts')
      .insert([postData])
      .select()
      .single()

    if (error) {
      throw error
    }

    // Generate OG image asynchronously
    if (insertedPost?.id) {
      const hasTeams = postData.team_tricodes && postData.team_tricodes.length >= 2
      const hasPlayers = postData.player_ids && postData.player_ids.length > 0
      
      if (hasTeams || hasPlayers) {
        generateOGImageForPost(insertedPost.id, postData).catch(err => {
          console.error('❌ Failed to generate OG image:', err)
        })
      }
    }
    
    return insertedPost
  }

  // Create posts from selected detected posts (single file mode)
  const handleBulkCreatePosts = async () => {
    // SUPER VISIBLE LOGS - these should appear in console
    console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀')
    console.log('🚀 handleBulkCreatePosts CALLED!')
    console.log('🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀')
    console.error('🚀 ERROR LOG TEST - handleBulkCreatePosts called')
    console.warn('🚀 WARN LOG TEST - handleBulkCreatePosts called')
    console.log('🚀 handleBulkCreatePosts called')
    
    // Check if we're in multi-file mode
    if (uploadedGames.length > 0) {
      return handleBulkCreatePostsMulti()
    }
    
    if (!user || !uploadedGameData) {
      console.warn('⚠️ Missing user or uploadedGameData:', { hasUser: !!user, hasGameData: !!uploadedGameData })
      return
    }

    const selected = detectedPosts.filter(p => p.selected)
    console.log('📋 Selected posts:', selected.length)
    
    if (selected.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one post to create',
        color: 'warning'
      })
      return
    }

    setLoading(true)
    try {
      console.log('🔄 Starting bulk post creation for', selected.length, 'posts')
      const teams = [
        uploadedGameData.gameMetadata?.homeTeam?.abbreviation,
        uploadedGameData.gameMetadata?.awayTeam?.abbreviation
      ].filter(Boolean) as string[]

      const firstScoreKey = Object.keys(uploadedGameData.score || {})[0]
      const scoreData = firstScoreKey ? uploadedGameData.score[firstScoreKey] : null
      
      console.log('🏀 Game data:', {
        teams,
        teams_length: teams.length,
        hasScoreData: !!scoreData
      })

      for (const detected of selected) {
        console.log('🔄 Processing post:', detected.title || detected.postType)
        console.error('🔄 ERROR LEVEL: Processing post in handleBulkCreatePosts:', detected.title || detected.postType)
        const slides: any[] = []

        if (detected.postType === 'fun_score') {
          // Create slides from fun score plays
          const plays = detected.metadata.plays as PlayByPlayPlay[]
          const storyAdvantages = detected.metadata.storyAdvantages || []
          
          // Get the very last play from playByPlay that has an mp4
          let lastPlayMp4: PlayByPlayPlay | null = null
          if (uploadedGameData.playByPlay?.allPlays) {
            const allPlays = uploadedGameData.playByPlay.allPlays
            // Find the last play with an mp4, starting from the end
            for (let i = allPlays.length - 1; i >= 0; i--) {
              if (allPlays[i].mp4) {
                lastPlayMp4 = allPlays[i]
                break
              }
            }
          }
          
          // Create video slides from plays
          // Smart deduplication: group plays that are temporally close with same/similar video
          const videoSlides: any[] = []
          const seenVideoUrls = new Set<string>()
          let duplicatesSkipped = 0
          
          // Helper to parse clock to seconds
          const parseClockToSeconds = (clock: string): number => {
            try {
              const match = clock.match(/PT(\d+)M([\d.]+)S/)
              if (match) {
                const minutes = parseInt(match[1])
                const seconds = parseFloat(match[2])
                return minutes * 60 + seconds
              }
            } catch (e) {
              return 0
            }
            return 0
          }
          
          // Helper to get play priority (higher = better to keep)
          const getPlayPriority = (play: PlayByPlayPlay): number => {
            let priority = 0
            // Made shots are highest priority
            if (play.shotResult === 'Made') priority += 100
            // Points matter
            priority += (play.pointsTotal || 0) * 10
            // Field goals > free throws
            if (play.isFieldGoal === 1) priority += 50
            // Prefer non-null shot results
            if (play.shotResult) priority += 25
            return priority
          }
          
          // Group plays that might be duplicates
          // Strategy: Group plays with same mp4 OR plays within 3 seconds that are part of same sequence
          const deduplicatedPlays: PlayByPlayPlay[] = []
          const processedEventNums = new Set<number>()
          
          for (let i = 0; i < plays.length; i++) {
            const play = plays[i]
            if (!play.mp4 || processedEventNums.has(play.eventNum)) continue
            
            // Find other plays that might be duplicates
            const sameVideoPlays: PlayByPlayPlay[] = [play]
            const playTime = parseClockToSeconds(play.clock)
            
            for (let j = i + 1; j < plays.length; j++) {
              const otherPlay = plays[j]
              if (!otherPlay.mp4 || processedEventNums.has(otherPlay.eventNum)) continue
              
              // Must be same period and same player
              if (otherPlay.period !== play.period || otherPlay.personId !== play.personId) continue
              
              const otherTime = parseClockToSeconds(otherPlay.clock)
              const timeDiff = Math.abs(playTime - otherTime)
              
              // Group if:
              // 1. Same mp4 URL within 5 seconds, OR
              // 2. Different URLs but within 5 seconds AND related action types (missed shot -> rebound -> made shot sequence)
              const isExactMatch = otherPlay.mp4 === play.mp4 && timeDiff <= 5
              
              // Check for sequence matches: missed shot/rebound/made shot combinations within 5 seconds
              const relatedActionTypes = ['Missed Shot', 'Rebound', 'Made Shot']
              const isRelatedAction = relatedActionTypes.includes(play.actionType) && 
                                     relatedActionTypes.includes(otherPlay.actionType)
              const isSequenceMatch = otherPlay.mp4 !== play.mp4 && timeDiff <= 5 && isRelatedAction
              
              if (isExactMatch || isSequenceMatch) {
                sameVideoPlays.push(otherPlay)
              }
            }
            
            // Keep the best play from the group
            if (sameVideoPlays.length > 1) {
              // Sort by priority, keep the best one
              sameVideoPlays.sort((a, b) => getPlayPriority(b) - getPlayPriority(a))
              const bestPlay = sameVideoPlays[0]
              deduplicatedPlays.push(bestPlay)
              
              // Mark all as processed
              sameVideoPlays.forEach(p => processedEventNums.add(p.eventNum))
              
              // Count duplicates skipped
              duplicatesSkipped += sameVideoPlays.length - 1
            } else {
              // No duplicates, just add it
              deduplicatedPlays.push(play)
              processedEventNums.add(play.eventNum)
            }
          }
          
          const addVideoSlide = (play: PlayByPlayPlay, extraMetadata?: any) => {
            if (!play.mp4) return false
            
            // Final check: exact URL duplicate (shouldn't happen after deduplication, but safety check)
            if (seenVideoUrls.has(play.mp4)) {
              return false
            }
            
            seenVideoUrls.add(play.mp4)
              videoSlides.push({
                type: 'video',
                order: 0, // Will be set later
                video_url: play.mp4,
                thumbnail_url: play.mp4.replace('.mp4', '_thumbnail.jpg'),
                caption: play.description,
                metadata: {
                  period: play.period,
                  clock: play.clock,
                  actionType: play.actionType,
                  subType: play.subType,
                  playerName: play.playerName,
                  playerNameI: play.playerNameI,
                  personId: play.personId,
                  teamTricode: play.teamTricode,
                  scoreHome: play.scoreHome,
                  scoreAway: play.scoreAway,
                  shotResult: play.shotResult,
                eventNum: play.eventNum,
                ...extraMetadata
                }
              })
            return true
            }
          
          // Add deduplicated videos
          for (const play of deduplicatedPlays) {
            addVideoSlide(play)
          }
          
          // Add the very last play mp4 if it exists and isn't already included
          if (lastPlayMp4 && lastPlayMp4.mp4) {
            addVideoSlide(lastPlayMp4, { isLastPlay: true })
          }
          
          // For close games (margin < 5 points), automatically add the last 5 mp4s
          const margin = scoreData?.team_stats?.['Margin of Victory'] ?? null
          if (margin !== null && margin < 5 && uploadedGameData.playByPlay?.allPlays) {
            const allPlays = uploadedGameData.playByPlay.allPlays
            const playsWithMp4: PlayByPlayPlay[] = []
            
            // Collect all plays with mp4s, starting from the end
            for (let i = allPlays.length - 1; i >= 0; i--) {
              if (allPlays[i].mp4) {
                playsWithMp4.push(allPlays[i])
                if (playsWithMp4.length >= 5) break // Get last 5
              }
            }
            
            // Reverse to get chronological order (oldest to newest)
            // Since we collected from the end backwards, reverse puts them in game order
            playsWithMp4.reverse()
            
            // Add the last 5 mp4s if they're not already included (check handled by addVideoSlide)
            for (const play of playsWithMp4) {
              addVideoSlide(play, { isCloseGameFinalClip: true })
            }
          }
          
          // Store duplicates skipped for later use (will be shown in created posts info)
          
          // Create story_comparison slides from advantages
          const chartSlides: any[] = []
          for (let i = 0; i < storyAdvantages.length; i++) {
            const advantage = storyAdvantages[i]
            const winnerTricode = advantage.teamTricode
            const homeTri = uploadedGameData.gameMetadata?.homeTeam?.abbreviation
            const awayTri = uploadedGameData.gameMetadata?.awayTeam?.abbreviation
            const primary = Math.max(advantage.value1 ?? 0, advantage.value2 ?? 0)
            const secondary = Math.min(advantage.value1 ?? 0, advantage.value2 ?? 0)
            
            const homeTeamIdentifier = uploadedGameData.gameMetadata?.homeTeam?.abbreviation || uploadedGameData.gameMetadata?.homeTeam?.name || ''
            const awayTeamIdentifier = uploadedGameData.gameMetadata?.awayTeam?.abbreviation || uploadedGameData.gameMetadata?.awayTeam?.name || ''
            
            chartSlides.push({
              type: 'story_comparison',
              order: 0, // Will be set later
              duration: 7000,
              advantage: {
                category: advantage.stat_name,
                home_value: winnerTricode === homeTri ? primary : (winnerTricode === awayTri ? secondary : advantage.value1),
                away_value: winnerTricode === awayTri ? primary : (winnerTricode === homeTri ? secondary : advantage.value2),
                winner: winnerTricode === homeTri ? 'home' : 'away'
              },
              home_team: {
                name: uploadedGameData.gameMetadata?.homeTeam?.name || '',
                city: uploadedGameData.gameMetadata?.homeTeam?.city || '',
                color: getContrastColor(getTeamPrimaryColor(homeTeamIdentifier))
              },
              away_team: {
                name: uploadedGameData.gameMetadata?.awayTeam?.name || '',
                city: uploadedGameData.gameMetadata?.awayTeam?.city || '',
                color: getContrastColor(getTeamPrimaryColor(awayTeamIdentifier))
              }
            })
          }
          
          // Intersperse charts throughout video slides
          // Distribute charts evenly: place charts at intervals
          if (chartSlides.length > 0 && videoSlides.length > 0) {
            // Calculate where to place charts: distribute evenly
            const totalSlides = videoSlides.length + chartSlides.length
            const intervals = Math.floor(videoSlides.length / (chartSlides.length + 1))
            
            let videoIndex = 0
            let chartIndex = 0
            
            // Insert first batch of videos, then charts alternately
            for (let i = 0; i < totalSlides; i++) {
              // Calculate position thresholds for inserting charts
              const chartsInserted = chartIndex
              const videosInserted = videoIndex
              const nextChartThreshold = (chartsInserted + 1) * intervals + chartsInserted
              
              // Insert chart if we've reached threshold and have charts left
              if (chartIndex < chartSlides.length && 
                  videosInserted >= nextChartThreshold && 
                  videosInserted > 0) {
                chartSlides[chartIndex].order = slides.length
                slides.push(chartSlides[chartIndex])
                chartIndex++
              } else if (videoIndex < videoSlides.length) {
                // Otherwise add next video
                videoSlides[videoIndex].order = slides.length
                slides.push(videoSlides[videoIndex])
                videoIndex++
              } else if (chartIndex < chartSlides.length) {
                // Add remaining charts at the end
                chartSlides[chartIndex].order = slides.length
                slides.push(chartSlides[chartIndex])
                chartIndex++
              }
            }
          } else {
            // No charts or no videos, just add all slides
            [...videoSlides, ...chartSlides].forEach((slide, idx) => {
              slide.order = idx
              slides.push(slide)
            })
          }
        } else if (detected.postType === 'player_highlight') {
          // Create slides from player plays
          const plays = detected.metadata.plays as PlayByPlayPlay[]
          const videoSlides: any[] = []
          const chartSlides: any[] = []
          
          // Helper to parse clock to seconds
          const parseClockToSeconds = (clock: string): number => {
            try {
              const match = clock.match(/PT(\d+)M([\d.]+)S/)
              if (match) {
                const minutes = parseInt(match[1])
                const seconds = parseFloat(match[2])
                return minutes * 60 + seconds
              }
            } catch (e) {
              return 0
            }
            return 0
          }
          
          // Helper to get play priority (higher = better to keep)
          const getPlayPriority = (play: PlayByPlayPlay): number => {
            let priority = 0
            // Made shots are highest priority
            if (play.shotResult === 'Made') priority += 100
            // Points matter
            priority += (play.pointsTotal || 0) * 10
            // Field goals > free throws
            if (play.isFieldGoal === 1) priority += 50
            // Prefer non-null shot results
            if (play.shotResult) priority += 25
            return priority
          }
          
          // First, ensure plays are sorted chronologically (they should be from detectFeedPosts, but sort again to be sure)
          const sortedPlays = [...plays].sort((a, b) => {
            // First sort by period
            if (a.period !== b.period) {
              return a.period - b.period
            }
            // Then by clock time (earlier in period = higher time remaining)
            const timeA = parseClockToSeconds(a.clock || 'PT00M00.00S')
            const timeB = parseClockToSeconds(b.clock || 'PT00M00.00S')
            // Higher time = earlier in period, so reverse the comparison
            return timeB - timeA
          })

          // Group plays that might be duplicates
          // Strategy: Group plays with same mp4 OR plays within 5 seconds that are part of same sequence
          const deduplicatedPlays: PlayByPlayPlay[] = []
          const processedEventNums = new Set<number>()
          
          // Process all plays in chronological order
          for (let i = 0; i < sortedPlays.length; i++) {
            const play = sortedPlays[i]
            if (!play.mp4 || processedEventNums.has(play.eventNum)) continue
            
            // Find other plays that might be duplicates
            const sameVideoPlays: PlayByPlayPlay[] = [play]
            const playTime = parseClockToSeconds(play.clock || 'PT00M00.00S')
            
            // Look ahead to find duplicates (only check future plays to maintain chronological order)
            for (let j = i + 1; j < sortedPlays.length; j++) {
              const otherPlay = sortedPlays[j]
              if (!otherPlay.mp4 || processedEventNums.has(otherPlay.eventNum)) continue
              
              // Must be same period
              if (otherPlay.period !== play.period) break // Since sorted, if period differs, no more matches
              
              const otherTime = parseClockToSeconds(otherPlay.clock || 'PT00M00.00S')
              const timeDiff = Math.abs(playTime - otherTime)
              
              // For plays with same personId (primary actions), use normal deduplication
              if (play.personId && otherPlay.personId && play.personId === otherPlay.personId) {
                // Group if:
                // 1. Same mp4 URL within 5 seconds, OR
                // 2. Different URLs but within 5 seconds AND related action types (missed shot -> rebound -> made shot sequence)
                const isExactMatch = otherPlay.mp4 === play.mp4 && timeDiff <= 5
                
                // Check for sequence matches: missed shot/rebound/made shot combinations within 5 seconds
                const relatedActionTypes = ['Missed Shot', 'Rebound', 'Made Shot']
                const isRelatedAction = relatedActionTypes.includes(play.actionType) && 
                                       relatedActionTypes.includes(otherPlay.actionType)
                const isSequenceMatch = otherPlay.mp4 !== play.mp4 && timeDiff <= 5 && isRelatedAction
                
                if (isExactMatch || isSequenceMatch) {
                  sameVideoPlays.push(otherPlay)
                }
              } else {
                // Different personId - could be an assist play
                // Only dedupe if exact same mp4 and very close in time (within 2 seconds)
                // This prevents removing assists that show the same video but are legitimately different events
                if (otherPlay.mp4 === play.mp4 && timeDiff <= 2) {
                  sameVideoPlays.push(otherPlay)
                }
              }
            }
            
            // Keep the best play from the group
            if (sameVideoPlays.length > 1) {
              // Sort by priority, keep the best one
              sameVideoPlays.sort((a, b) => getPlayPriority(b) - getPlayPriority(a))
              const bestPlay = sameVideoPlays[0]
              deduplicatedPlays.push(bestPlay)
              
              // Mark all as processed
              sameVideoPlays.forEach(p => processedEventNums.add(p.eventNum))
            } else {
              // No duplicates, just add it
              deduplicatedPlays.push(play)
              processedEventNums.add(play.eventNum)
            }
          }
          
          // Sort deduplicated plays again to ensure chronological order after deduplication
          // This is critical - ensures assists are in the right place even after deduplication
          deduplicatedPlays.sort((a, b) => {
            // First sort by period
            if (a.period !== b.period) {
              return a.period - b.period
            }
            // Then by clock time (higher time = earlier in period)
            const timeA = parseClockToSeconds(a.clock || 'PT00M00.00S')
            const timeB = parseClockToSeconds(b.clock || 'PT00M00.00S')
            return timeB - timeA
          })
          
          const seenVideoUrls = new Set<string>()
          
          // Get target player info FIRST (before adding slides)
          const targetPersonId = detected.metadata.personId
          const targetPlayerName = detected.metadata.playerNameI || detected.metadata.playerName
          const targetTeamTricode = plays[0]?.teamTricode || teams[0] || ''
          
          // ADD SHOT CHART TABLE SLIDE FIRST (order 0)
          const fieldGoals: Array<{
            eventNum: number
            xLegacy?: number | null
            yLegacy?: number | null
            locX?: number | null  // NBA API coordinate (inches)
            locY?: number | null  // NBA API coordinate (inches)
            shotResult: string | null
            shotDistance: number | null
            period: number
            clock: string
            description: string
          }> = []
          
          // First, try to use shot chart data from NBA API (more accurate)
          if (uploadedGameData.shotChartData && targetPersonId) {
            const playerShotData = uploadedGameData.shotChartData[targetPersonId]
            if (playerShotData && Array.isArray(playerShotData)) {
              console.log('🎯 Using NBA API shot chart data. Total shots:', playerShotData.length)
              for (const shot of playerShotData) {
                // Handle different possible field names from NBA API
                const gameEventId = shot.GAME_EVENT_ID || shot.EVENT_NUM || shot.game_event_id || shot.event_num || 0
                const locX = shot.LOC_X ?? shot.loc_x ?? null
                const locY = shot.LOC_Y ?? shot.loc_y ?? null
                const shotMadeFlag = shot.SHOT_MADE_FLAG ?? shot.shot_made_flag ?? 0
                const shotDistance = shot.SHOT_DISTANCE ?? shot.shot_distance ?? null
                const period = shot.PERIOD ?? shot.period ?? 1
                const actionType = shot.ACTION_TYPE ?? shot.action_type ?? ''
                
                // Match shot to play-by-play event using GAME_EVENT_ID
                const matchingPlay = uploadedGameData.playByPlay?.allPlays?.find(
                  (p: any) => p.eventNum === gameEventId && p.personId === targetPersonId
                )
                
                fieldGoals.push({
                  eventNum: gameEventId,
                  locX: locX,
                  locY: locY,
                  shotResult: shotMadeFlag === 1 ? 'Made' : 'Missed',
                  shotDistance: shotDistance,
                  period: period,
                  clock: matchingPlay?.clock || '',
                  description: matchingPlay?.description || actionType || ''
                })
              }
              console.log('🏀 Found', fieldGoals.length, 'field goals from NBA API shot chart')
            }
          }
          
          // Fallback to xLegacy/yLegacy from play-by-play if shot chart data not available
          if (fieldGoals.length === 0 && uploadedGameData.playByPlay?.allPlays && targetPersonId) {
            console.log('🎯 Collecting field goals from play-by-play (fallback). Total plays:', uploadedGameData.playByPlay.allPlays.length)
            for (const play of uploadedGameData.playByPlay.allPlays) {
              if (
                play.personId === targetPersonId &&
                play.isFieldGoal === 1 &&
                play.xLegacy !== null &&
                play.xLegacy !== undefined &&
                play.yLegacy !== null &&
                play.yLegacy !== undefined
              ) {
                fieldGoals.push({
                  eventNum: play.eventNum,
                  xLegacy: play.xLegacy,
                  yLegacy: play.yLegacy,
                  shotResult: play.shotResult,
                  shotDistance: play.shotDistance,
                  period: play.period,
                  clock: play.clock,
                  description: play.description
                })
              }
            }
            console.log('🏀 Found', fieldGoals.length, 'field goals from play-by-play')
          }
          
          // Add video slides from deduplicated plays IN CHRONOLOGICAL ORDER (collect first, don't add to slides yet)
          for (const play of deduplicatedPlays) {
            if (!play.mp4) continue
            
            // Final safety check: exact URL duplicate
            if (seenVideoUrls.has(play.mp4)) {
              continue
            }
            
            seenVideoUrls.add(play.mp4)
            videoSlides.push({
              type: 'video',
              order: 0, // Will be reassigned
              video_url: play.mp4,
              thumbnail_url: play.mp4.replace('.mp4', '_thumbnail.jpg'),
              caption: play.description,
              metadata: {
                period: play.period,
                clock: play.clock,
                actionType: play.actionType,
                subType: play.subType,
                playerName: play.playerName,
                playerNameI: play.playerNameI,
                personId: play.personId,
                teamTricode: play.teamTricode,
                scoreHome: play.scoreHome,
                scoreAway: play.scoreAway,
                shotResult: play.shotResult
              }
            })
          }
          
          // Calculate total slides (video slides + shot chart if we have field goals)
          const hasShotChart = fieldGoals.length > 0
          const totalSlides = videoSlides.length + (hasShotChart ? 1 : 0)
          
          // Determine shot chart position based on total slide count
          // - Many slides (40+): put it early (around 10-15% through, but at least position 1)
          // - Few slides (5-10): put it last
          // - Medium slides (10-40): put it in the middle (around 20-30% through)
          let shotChartPosition = 0
          if (hasShotChart && totalSlides > 0) {
            if (totalSlides <= 10) {
              // Few slides: put it last
              shotChartPosition = totalSlides - 1
            } else if (totalSlides >= 40) {
              // Many slides: put it early (around 10-15% through, minimum position 1)
              shotChartPosition = Math.max(1, Math.floor(totalSlides * 0.12))
            } else {
              // Medium slides: put it in the middle (around 20-30% through)
              shotChartPosition = Math.max(1, Math.floor(totalSlides * 0.25))
            }
          }
          
          console.log(`📊 Total slides: ${totalSlides}, Shot chart position: ${shotChartPosition}`)
          
          // Build slides array: add video slides first, then insert shot chart at calculated position
          let currentOrder = 0
          for (let i = 0; i < videoSlides.length; i++) {
            if (hasShotChart && currentOrder === shotChartPosition) {
              // Insert shot chart at this position
              slides.push({
                type: 'shot_chart_table',
                order: currentOrder++,
                duration: fieldGoals.length > 0 ? Math.max(7000, fieldGoals.length * 500) : 7000,
                shots: fieldGoals,
                playerName: targetPlayerName
              })
              console.log(`✅ Added shot chart table slide at position ${shotChartPosition} with ${fieldGoals.length} shots`)
            }
            // Add video slide
            videoSlides[i].order = currentOrder++
            slides.push(videoSlides[i])
          }
          
          // If shot chart hasn't been added yet (shouldn't happen, but safety check)
          if (hasShotChart && slides.filter(s => s.type === 'shot_chart_table').length === 0) {
            slides.push({
              type: 'shot_chart_table',
              order: currentOrder++,
              duration: fieldGoals.length > 0 ? Math.max(7000, fieldGoals.length * 500) : 7000,
              shots: fieldGoals,
              playerName: targetPlayerName
            })
            console.log(`✅ Added shot chart table slide at end with ${fieldGoals.length} shots`)
          }
          
          // Get target stats early for use in debug logs
          const targetStats = uploadedGameData.AggregatedPlayerStats?.[targetPersonId.toString()]
          
          // Calculate fantasy points for all players and check if target is top 5
          if (uploadedGameData.AggregatedPlayerStats) {
            const allPlayers: Array<{
              personId: number
              name: string
              teamTricode: string
              fantasyPoints: number
            }> = []
            
            // Calculate fantasy points for all players
            Object.entries(uploadedGameData.AggregatedPlayerStats).forEach(([personIdStr, stats]: [string, any]) => {
              const personId = parseInt(personIdStr)
              const fantasyPoints = calculateFantasyPointsFromStats(stats)
              
              // Get player name and team
              const playerName = stats.nameI || stats.firstName + ' ' + stats.familyName || `Player ${personId}`
              const teamTricode = stats.teamTricode || ''
              
              allPlayers.push({
                personId,
                name: playerName,
                teamTricode,
                fantasyPoints
              })
            })
            
            // Sort by fantasy points descending
            allPlayers.sort((a, b) => b.fantasyPoints - a.fantasyPoints)
            
            // Check if target player is in top 5
            const targetPlayerIndex = allPlayers.findIndex(p => p.personId === targetPersonId)
            const isTop5 = targetPlayerIndex >= 0 && targetPlayerIndex < 5
            
            if (isTop5) {
              // Add Top 5 Fantasy Scorers chart highlighting target player
              // Assign unique colors to each player
              const usedColors = new Set<string>()
              const top5Players = allPlayers.slice(0, 5).map((player, index) => {
                // Target player gets gold (#FFC72C), others get unique team colors
                let teamColor: string
                if (player.personId === targetPersonId) {
                  teamColor = '#FFC72C' // Bright gold for target player
                } else {
                  teamColor = getUniquePlayerColor(player.teamTricode, index, usedColors)
                }
                
                const stats = uploadedGameData.AggregatedPlayerStats![player.personId.toString()]
                return {
                  name: player.name,
                  teamTricode: player.teamTricode,
                  teamColor,
                  fantasyPoints: player.fantasyPoints,
                  pts: stats.traditional_points || 0,
                  reb: stats.traditional_reboundsTotal || 0,
                  ast: stats.traditional_assists || 0,
                  stl: stats.traditional_steals || 0,
                  blk: stats.traditional_blocks || 0,
                  tov: stats.traditional_turnovers || 0,
                  personId: player.personId // Include personId for highlighting
                }
              })
              
              chartSlides.push({
                type: 'top_fantasy_scorers',
                order: 0, // Will be set later
                duration: 7000,
                players: top5Players,
                highlightedPlayerId: targetPersonId
              })
            }
            
            // Use dynamic chart selection instead of showing all charts
            if (targetStats && uploadedGameData.AggregatedPlayerStats) {
              // Select relevant charts based on game performance
              const relevantCharts = selectRelevantCharts(
                targetPersonId,
                targetStats,
                uploadedGameData.AggregatedPlayerStats
              )
              
              // Target player color will be bright gold (#FFC72C) in the chart component
              const targetColor = '#FFC72C' // Bright gold for target player
              
              // Get comparison players (other players in the game, excluding target)
              const comparisonPlayers = allPlayers
                .filter(p => p.personId !== targetPersonId)
                .slice(0, 5) // Compare to top 5 other players
              
              // Create radar chart slides for each selected chart
              relevantCharts.forEach(chartScore => {
                if (chartScore.chartType === 'player_comparison_radar' && chartScore.data) {
                  const chartData = chartScore.data
                  
                  // Assign unique colors to each comparison player
                  const usedColors = new Set<string>()
                  const comparisonPlayersData = comparisonPlayers.map((player, index) => {
                    const playerStats = uploadedGameData.AggregatedPlayerStats![player.personId.toString()]
                    const teamColor = getUniquePlayerColor(player.teamTricode, index, usedColors)
                    
                    // Map stats based on category - use bracket notation to access dynamic properties
                    let stats: Record<string, number> = {}
                    if (chartData.category === 'usage' && playerStats) {
                      stats = {
                        usagePercentage: (playerStats as any)['usage_usagePercentage'] ?? 0,
                        percentagePoints: (playerStats as any)['usage_percentagePoints'] ?? 0,
                        percentageAssists: (playerStats as any)['usage_percentageAssists'] ?? 0,
                        percentageReboundsTotal: (playerStats as any)['usage_percentageReboundsTotal'] ?? 0,
                        percentageTurnovers: (playerStats as any)['usage_percentageTurnovers'] ?? 0,
                        percentageFieldGoalsAttempted: (playerStats as any)['usage_percentageFieldGoalsAttempted'] ?? 0
                      }
                    } else if (chartData.category === 'hustle' && playerStats) {
                      stats = {
                        contestedShots: (playerStats as any)['hustle_contestedShots'] ?? 0,
                        deflections: (playerStats as any)['hustle_deflections'] ?? 0,
                        looseBallsRecoveredTotal: (playerStats as any)['hustle_looseBallsRecoveredTotal'] ?? 0,
                        boxOuts: (playerStats as any)['hustle_boxOuts'] ?? 0,
                        chargesDrawn: (playerStats as any)['hustle_chargesDrawn'] ?? 0,
                        screenAssists: (playerStats as any)['hustle_screenAssists'] ?? 0
                      }
                    } else if (chartData.category === 'fourfactors' && playerStats) {
                      stats = {
                        effectiveFieldGoalPercentage: (((playerStats as any)['fourFactors_effectiveFieldGoalPercentage'] ?? 0) * 100),
                        freeThrowAttemptRate: (((playerStats as any)['fourFactors_freeThrowAttemptRate'] ?? 0) * 100),
                        offensiveReboundPercentage: (((playerStats as any)['fourFactors_offensiveReboundPercentage'] ?? 0) * 100),
                        teamTurnoverPercentage: (((playerStats as any)['fourFactors_teamTurnoverPercentage'] ?? 0) * 100),
                        oppEffectiveFieldGoalPercentage: (((playerStats as any)['fourFactors_oppEffectiveFieldGoalPercentage'] ?? 0) * 100),
                        oppOffensiveReboundPercentage: (((playerStats as any)['fourFactors_oppOffensiveReboundPercentage'] ?? 0) * 100)
                      }
                    } else if (chartData.category === 'playmaking' && playerStats) {
                      stats = {
                        assists: playerStats.traditional_assists ?? 0,
                        assistPercentage: (playerStats.traditional_assists ?? 0) / ((playerStats.traditional_points ?? 1) / 100),
                        passes: (playerStats as any)['playerTrack_passes'] ?? 0,
                        secondaryAssists: (playerStats.traditional_assists ?? 0) * 0.3,
                        freeThrowAssists: 0
                      }
                    } else if (chartData.category === 'defensive' && playerStats) {
                      stats = {
                        steals: playerStats.traditional_steals ?? 0,
                        blocks: playerStats.traditional_blocks ?? 0,
                        deflections: (playerStats as any)['hustle_deflections'] ?? 0,
                        contestedShots: (playerStats as any)['hustle_contestedShots'] ?? 0,
                        defensiveRating: (playerStats as any)['advanced_defensiveRating'] ?? 0,
                        defensiveReboundPercentage: (((playerStats as any)['advanced_defensiveReboundPercentage'] ?? 0) * 100)
                      }
                    } else if (chartData.category === 'scoring' && playerStats) {
                      const pts = playerStats.traditional_points ?? 0
                      const pts3pt = ((playerStats as any)['traditional_threePointersMade'] ?? 0) * 3
                      const pts2pt = pts - pts3pt - ((playerStats as any)['traditional_freeThrowsMade'] ?? 0)
                      stats = {
                        pctPoints3pt: pts > 0 ? (pts3pt / pts) * 100 : 0,
                        pctPoints2pt: pts > 0 ? (pts2pt / pts) * 100 : 0,
                        pctPointsPaint: pts > 0 ? (pts2pt / pts) * 100 * 0.6 : 0,
                        pctPointsMidrange: pts > 0 ? (pts2pt / pts) * 100 * 0.4 : 0,
                        pctPointsFastBreak: 0,
                        pctAssisted: 0,
                        freeThrowRate: (((playerStats as any)['fourFactors_freeThrowAttemptRate'] ?? 0) * 100)
                      }
                    } else if (chartData.category === 'relative' && playerStats) {
                      // Use the top metrics from the chart data
                      stats = chartData.stats || {}
                    } else if (chartData.category === 'team-context' && playerStats) {
                      // Use the standout metrics from chart data
                      stats = chartData.stats || {}
                    }
                    
                    return {
                      name: player.name,
                      teamTricode: player.teamTricode,
                      color: teamColor,
                      stats
                    }
                  }).filter(p => Object.keys(p.stats).length > 0)
                  
                  chartSlides.push({
                    type: 'player_comparison_radar',
                    order: 0, // Will be set later
                    duration: 7000,
                    category: chartData.category,
                    categoryTitle: chartData.title,
                    targetPlayer: {
                      name: targetPlayerName,
                      teamTricode: targetTeamTricode,
                      color: targetColor,
                      stats: chartData.stats
                    },
                    comparisonPlayers: comparisonPlayersData,
                    relevanceReason: chartScore.reason // Store why this chart was selected
                  })
                }
              })
              
              // Debug logging for chart selection
              if (relevantCharts.length > 0) {
                console.log(`[Chart Selection] Player ${targetPersonId} (${targetPlayerName}):`, 
                  relevantCharts.map(c => ({ 
                    type: c.chartType, 
                    category: c.category, 
                    score: c.score, 
                    reason: c.reason 
                  }))
                )
              } else {
                console.log(`[Chart Selection] Player ${targetPersonId} (${targetPlayerName}): No relevant charts found`)
              }
            }
            
            // Old chart creation code removed - now using dynamic selection above
          }
          
          // Debug: Log chart creation
          if (chartSlides.length > 0) {
            console.log(`[Player Highlight] Created ${chartSlides.length} chart slides for player ${targetPersonId}:`, 
              chartSlides.map(c => ({ type: c.type, category: c.category })))
          } else {
            console.log(`[Player Highlight] No chart slides created for player ${targetPersonId} - targetStats exists:`, !!targetStats)
          }
          
          // Intersperse charts throughout video slides
          // Note: shot chart table is already positioned in slides array at calculated position
          // We need to rebuild slides array to properly intersperse other chart slides
          if (chartSlides.length > 0) {
            // Separate existing slides into shot chart and video slides
            const existingShotChart = slides.find(s => s.type === 'shot_chart_table')
            const existingVideoSlides = slides.filter(s => s.type === 'video').sort((a, b) => (a.order || 0) - (b.order || 0))
            
            // Get the shot chart's intended position
            const shotChartPosition = existingShotChart ? (existingShotChart.order || 0) : -1
            
            // Clear slides and rebuild
            slides.length = 0
            
            // Calculate intervals for interspersing other charts (excluding shot chart position)
            const videoCount = existingVideoSlides.length
            const otherChartCount = chartSlides.length
            const intervals = videoCount > 0 ? Math.floor(videoCount / (otherChartCount + 1)) : 0
            
            let videoIndex = 0
            let chartIndex = 0
            let currentOrder = 0
            
            // Build slides array, inserting shot chart at its calculated position
            while (videoIndex < existingVideoSlides.length || chartIndex < chartSlides.length) {
              // Check if we should insert shot chart at this position
              if (existingShotChart && currentOrder === shotChartPosition) {
                existingShotChart.order = currentOrder++
                slides.push(existingShotChart)
                continue
              }
              
              // Check if we should insert other chart
              const chartsInserted = chartIndex
              const videosInserted = videoIndex
              const nextChartThreshold = (chartsInserted + 1) * intervals + chartsInserted
              
              if (chartIndex < chartSlides.length && 
                  videosInserted >= nextChartThreshold && 
                  videosInserted > 0) {
                chartSlides[chartIndex].order = currentOrder++
                slides.push(chartSlides[chartIndex])
                chartIndex++
              } else if (videoIndex < existingVideoSlides.length) {
                existingVideoSlides[videoIndex].order = currentOrder++
                slides.push(existingVideoSlides[videoIndex])
                videoIndex++
              } else if (chartIndex < chartSlides.length) {
                chartSlides[chartIndex].order = currentOrder++
                slides.push(chartSlides[chartIndex])
                chartIndex++
              }
            }
            
            // If shot chart hasn't been added yet (shouldn't happen, but safety check)
            if (existingShotChart && !slides.find(s => s.type === 'shot_chart_table')) {
              existingShotChart.order = currentOrder++
              slides.push(existingShotChart)
            }
          } else {
            // No other charts, just ensure slides are properly ordered
            // Shot chart is already in slides at its calculated position
            slides.sort((a, b) => (a.order || 0) - (b.order || 0))
          }
          
          // Sort slides by order to ensure correct sequence
          slides.sort((a, b) => (a.order || 0) - (b.order || 0))
        }

        if (slides.length === 0) {
          console.warn('⚠️ Skipping post - no slides:', detected.title || detected.postType)
          continue
        }

        console.log('✅ Post has slides, proceeding to insert:', {
          title: detected.title,
          slideCount: slides.length
        })

        // Extract player IDs from slides
        const playerIds = Array.from(new Set(
          slides
            .map(s => s.metadata?.personId)
            .filter(Boolean)
        )).map(id => parseInt(id))

        // Fetch player props and calculate hit rate for player_spotlight posts
        const isPlayerSpotlight = detected.postType !== 'fun_score'
        const primaryPlayerId = isPlayerSpotlight ? (detected.metadata?.personId || playerIds[0]) : null
        const gameId = uploadedGameData.gameId || null
        
        // Parse game date - handle various formats
        let gameDate = null
        if (uploadedGameData.gameMetadata?.date) {
          try {
            const dateStr = uploadedGameData.gameMetadata.date
            const date = new Date(dateStr)
            if (!isNaN(date.getTime())) {
              gameDate = date.toISOString().split('T')[0]
            }
          } catch (e) {
            console.warn('⚠️ Could not parse game date:', uploadedGameData.gameMetadata.date)
          }
        }

        let playerPropsData = null
        let propsIcon = null

        if (isPlayerSpotlight && primaryPlayerId && gameId && gameDate) {
          try {
            console.log('🎲 Fetching player props for player spotlight post:', { primaryPlayerId, gameId, gameDate })
            
            // First, get game info from nba_games to match with player_props_games
            const { data: nbaGame } = await supabase
              .from('nba_games')
              .select('game_date, home_team_tricode, away_team_tricode')
              .eq('game_id', gameId)
              .maybeSingle()
            
            if (!nbaGame?.game_date) {
              console.warn('⚠️ No nba_game found for gameId:', gameId)
            } else {
              const targetGameDate = nbaGame.game_date.split('T')[0]
              const homeTeamTricode = nbaGame.home_team_tricode
              const awayTeamTricode = nbaGame.away_team_tricode

              // Find matching player_props_games entry
              const { data: propsGame } = await supabase
                .from('player_props_games')
                .select('id, event_id')
                .eq('game_date', targetGameDate)
                .or(`home_team_tricode.eq.${homeTeamTricode},away_team_tricode.eq.${homeTeamTricode},home_team_tricode.eq.${awayTeamTricode},away_team_tricode.eq.${awayTeamTricode}`)
                .limit(1)
                .maybeSingle()

              if (propsGame) {
                // Fetch player props for this game
                let allProps = null
                let propsError = null
                
                const { data: propsByGameId, error: error1 } = await supabase
                  .from('player_props')
                  .select('id, bet_type, line, bet_type_id, game_date, game_id, raw_odd_data')
                  .eq('game_id', propsGame.id)
                  .eq('nba_player_id', primaryPlayerId)
                
                if (error1 || !propsByGameId || propsByGameId.length === 0) {
                  const { data: propsByDate, error: error2 } = await supabase
                    .from('player_props')
                    .select('id, bet_type, line, bet_type_id, game_date, game_id, raw_odd_data')
                    .eq('game_date', targetGameDate)
                    .eq('nba_player_id', primaryPlayerId)
                  
                  allProps = propsByDate
                  propsError = error2
                } else {
                  allProps = propsByGameId
                  propsError = error1
                }

                // Filter to only game-level props
                const props = allProps?.filter(prop => {
                  let period = 'game'
                  
                  if (prop.raw_odd_data) {
                    try {
                      const rawData = typeof prop.raw_odd_data === 'string' 
                        ? JSON.parse(prop.raw_odd_data) 
                        : prop.raw_odd_data
                      
                      if (rawData && typeof rawData === 'object') {
                        period = rawData.periodID || rawData.period || 'game'
                      }
                    } catch (e) {
                      if (prop.bet_type_id) {
                        const betTypeId = prop.bet_type_id.toLowerCase()
                        if (betTypeId.includes('-1q-') || betTypeId.includes('-2q-') || 
                            betTypeId.includes('-3q-') || betTypeId.includes('-4q-') ||
                            betTypeId.includes('-1h-') || betTypeId.includes('-2h-')) {
                          period = 'quarter'
                        }
                      }
                    }
                  } else if (prop.bet_type_id) {
                    const betTypeId = prop.bet_type_id.toLowerCase()
                    if (betTypeId.includes('-1q-') || betTypeId.includes('-2q-') || 
                        betTypeId.includes('-3q-') || betTypeId.includes('-4q-') ||
                        betTypeId.includes('-1h-') || betTypeId.includes('-2h-')) {
                      period = 'quarter'
                    }
                  }
                  
                  return period === 'game' || period === 'reg'
                }) || []

                if (!propsError && props && props.length > 0) {
                  // Fetch boxscore to calculate results
                  const { data: boxscore, error: boxscoreError } = await supabase
                    .from('nba_boxscores')
                    .select('pts, reb, ast, stl, blk, tov, fg3m, ftm')
                    .eq('nba_player_id', primaryPlayerId)
                    .eq('game_id', gameId)
                    .single()

                  if (!boxscoreError && boxscore) {
                    // Calculate results for each prop
                    const propResults = props.map((prop, index) => {
                      let overUnder: 'O' | 'U' | null = null
                      
                      const betTypeId = prop.bet_type_id || ''
                      if (betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over')) {
                        overUnder = 'O'
                      } else if (betTypeId.includes('-under') || betTypeId.endsWith('under') || betTypeId.toLowerCase().includes('under')) {
                        overUnder = 'U'
                      } else {
                        try {
                          const rawData = typeof prop.raw_odd_data === 'string' 
                            ? JSON.parse(prop.raw_odd_data) 
                            : prop.raw_odd_data
                          
                          if (rawData && typeof rawData === 'object') {
                            const side = rawData.sideID || rawData.sideId || rawData.overUnder || ''
                            if (side === 'over' || side === 'Over' || side === 'O') {
                              overUnder = 'O'
                            } else if (side === 'under' || side === 'Under' || side === 'U') {
                              overUnder = 'U'
                            }
                          }
                        } catch (e) {
                          // Continue
                        }
                      }
                      
                      let result = null
                      const normalizedBetType = prop.bet_type.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+')
                      
                      if (normalizedBetType.includes('points+rebounds+assists') || normalizedBetType.includes('par')) {
                        const actualValue = (boxscore.pts || 0) + (boxscore.reb || 0) + (boxscore.ast || 0)
                        const line = prop.line || 0
                        result = {
                          propId: `${prop.bet_type}-${line}`,
                          betType: prop.bet_type,
                          line,
                          actualValue,
                          hit: false,
                          result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                        }
                      } else if (normalizedBetType.includes('points+rebounds') || normalizedBetType.includes('pts+reb')) {
                        const actualValue = (boxscore.pts || 0) + (boxscore.reb || 0)
                        const line = prop.line || 0
                        result = {
                          propId: `${prop.bet_type}-${line}`,
                          betType: prop.bet_type,
                          line,
                          actualValue,
                          hit: false,
                          result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                        }
                      } else if (normalizedBetType.includes('points+assists') || normalizedBetType.includes('pts+ast')) {
                        const actualValue = (boxscore.pts || 0) + (boxscore.ast || 0)
                        const line = prop.line || 0
                        result = {
                          propId: `${prop.bet_type}-${line}`,
                          betType: prop.bet_type,
                          line,
                          actualValue,
                          hit: false,
                          result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                        }
                      } else if (normalizedBetType.includes('rebounds+assists') || normalizedBetType.includes('reb+ast')) {
                        const actualValue = (boxscore.reb || 0) + (boxscore.ast || 0)
                        const line = prop.line || 0
                        result = {
                          propId: `${prop.bet_type}-${line}`,
                          betType: prop.bet_type,
                          line,
                          actualValue,
                          hit: false,
                          result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                        }
                      } else if (normalizedBetType.includes('blocks+steals') || normalizedBetType.includes('stocks')) {
                        const actualValue = (boxscore.blk || 0) + (boxscore.stl || 0)
                        const line = prop.line || 0
                        result = {
                          propId: `${prop.bet_type}-${line}`,
                          betType: prop.bet_type,
                          line,
                          actualValue,
                          hit: false,
                          result: actualValue > line ? 'over' : actualValue < line ? 'under' : 'push'
                        }
                      } else {
                        result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore)
                      }
                      
                      if (!result) {
                        return {
                          ...prop,
                          overUnder,
                          result: null
                        }
                      }
                      
                      let hit = false
                      if (result.result === 'push') {
                        hit = false
                      } else if (overUnder === 'O') {
                        hit = result.result === 'over'
                      } else if (overUnder === 'U') {
                        hit = result.result === 'under'
                      } else {
                        hit = result.result === 'over'
                      }
                      
                      return {
                        id: prop.id || `${prop.bet_type}-${prop.line}-${index}`,
                        bet_type: prop.bet_type,
                        line: prop.line,
                        overUnder,
                        result: {
                          actualValue: result.actualValue,
                          hit,
                          result: result.result
                        }
                      }
                    })

                    const hits = propResults.filter(p => p.result?.hit === true).length
                    const totalProps = propResults.length
                    const hitRate = totalProps > 0 ? (hits / totalProps) : 0

                    const oversHit = propResults.filter(p => {
                      return p.overUnder === 'O' && p.result?.result === 'over'
                    }).length
                    
                    const undersHit = propResults.filter(p => {
                      return p.overUnder === 'U' && p.result?.result === 'under'
                    }).length
                    
                    const pushes = propResults.filter(p => p.result?.result === 'push').length

                    if (hitRate > 0.75) {
                      propsIcon = 'fire'
                    } else if (hitRate < 0.25) {
                      propsIcon = 'snow'
                    }

                    playerPropsData = {
                      props: propResults,
                      hitRate,
                      totalProps,
                      oversHit,
                      undersHit,
                      pushes
                    }

                    console.log('✅ Player props calculated:', { 
                      hitRate, 
                      totalProps, 
                      oversHit, 
                      undersHit, 
                      hits, 
                      propsIcon,
                      propsCount: propResults.length
                    })
                  } else {
                    console.warn('⚠️ No boxscore found for player props calculation')
                  }
                } else {
                  console.log('ℹ️ No player props found for this game')
                }
              } else {
                console.log('ℹ️ No player_props_games entry found for this game')
              }
            }
          } catch (error) {
            console.error('❌ Error fetching player props:', error)
          }
        }

        // Add props data to slides metadata
        const slidesWithProps = slides.map(slide => ({
          ...slide,
          metadata: {
            ...slide.metadata,
            ...(playerPropsData ? { playerProps: playerPropsData } : {})
          }
        }))

        // Log props data being stored
        if (playerPropsData) {
          console.log('📦 Storing player props in post:', {
            hasProps: !!playerPropsData,
            totalProps: playerPropsData.totalProps,
            hitRate: playerPropsData.hitRate,
            propsInSlides: slidesWithProps[0]?.metadata?.playerProps ? 'yes' : 'no',
            propsInMetadata: 'yes'
          })
        }

        const postData = {
          created_by: user.id,
          post_type: detected.postType === 'fun_score' ? 'fun_score' : 'player_spotlight',
          status: 'published',
          published_at: new Date().toISOString(),
          title: detected.title,
          description: detected.postType === 'fun_score' 
            ? `Fun Score breakdown with ${slides.length} exciting plays`
            : `${detected.metadata.playerNameI || detected.metadata.playerName}'s game highlights`,
          game_id: uploadedGameData.gameId || null,
          game_date: uploadedGameData.gameMetadata?.date || null,
          team_tricodes: teams,
          player_ids: playerIds,
          person_id: detected.postType === 'fun_score' ? null : (detected.metadata?.personId || null),
          slides: slidesWithProps,
          metadata: {
            arena: uploadedGameData.gameMetadata?.arena,
            season: uploadedGameData.gameMetadata?.season,
            homeTeam: uploadedGameData.gameMetadata?.homeTeam,
            awayTeam: uploadedGameData.gameMetadata?.awayTeam,
            story_data: uploadedGameData.story,
            fun_data: scoreData,
            fun_score: scoreData?.fun_score,
            fantasyPoints: detected.fantasyPoints,
            ...(playerPropsData ? {
              playerProps: playerPropsData,
              propsIcon: propsIcon
            } : {}),
            ...detected.metadata
          }
        }

        console.log('📝 About to create post:', {
          title: postData.title,
          team_tricodes: postData.team_tricodes,
          player_ids: postData.player_ids
        })

        const { data: insertedPost, error } = await supabase
          .from('feed_posts')
          .insert([postData])
          .select()
          .single()

        console.log('📝 Post insert result:', {
          success: !error,
          error: error?.message,
          insertedPost: insertedPost ? { id: insertedPost.id, title: insertedPost.title } : null
        })

        if (error) {
          console.error('❌ Error creating post:', error)
          throw error
        }

        // Generate OG image asynchronously (don't block post creation)
        console.log('🔍 Checking if OG image generation needed:', {
          hasInsertedPost: !!insertedPost,
          hasId: !!insertedPost?.id,
          postId: insertedPost?.id,
          team_tricodes: postData.team_tricodes,
          team_tricodes_length: postData.team_tricodes?.length,
          player_ids: postData.player_ids,
          player_ids_length: postData.player_ids?.length
        })

        if (insertedPost && insertedPost.id) {
          // Only generate if we have team or player data
          const hasTeams = postData.team_tricodes && postData.team_tricodes.length >= 2
          const hasPlayers = postData.player_ids && postData.player_ids.length > 0
          
          console.log('🔍 OG Image Generation Check:', {
            postId: insertedPost.id,
            hasTeams,
            hasPlayers,
            team_tricodes: postData.team_tricodes,
            team_tricodes_length: postData.team_tricodes?.length,
            player_ids: postData.player_ids,
            player_ids_length: postData.player_ids?.length
          })
          
          if (hasTeams || hasPlayers) {
            console.log('✅ Calling generateOGImageForPost for post:', insertedPost.id)
            generateOGImageForPost(insertedPost.id, postData).catch(err => {
              console.error('❌ Failed to generate OG image:', err)
              // Don't throw - post creation succeeded
            })
          } else {
            console.log('⏭️ Skipping OG image generation - no teams or players', {
              team_tricodes: postData.team_tricodes,
              player_ids: postData.player_ids
            })
          }
        } else {
          console.warn('⚠️ No insertedPost.id, cannot generate OG image', {
            insertedPost: insertedPost,
            hasId: insertedPost?.id
          })
        }
      }

      setSnackbar({
        open: true,
        message: `Successfully created ${selected.length} post(s)!`,
        color: 'success'
      })

      loadPosts()
      setView('table')
    } catch (error: any) {
      console.error('Error bulk creating posts:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error creating posts',
        color: 'danger'
      })
    } finally {
      setLoading(false)
    }
  }

  // Add slide from uploaded game data
  const handleAddSlide = async (slideType: string, playIndex?: number) => {
    if (!uploadedGameData) {
      setSnackbar({
        open: true,
        message: 'Please upload a game JSON file first',
        color: 'warning'
      })
      return
    }

    let newSlide: any = {
      type: slideType,
      order: postForm.slides.length
    }

    // Handle different slide types
    if (slideType === 'video' && playIndex !== undefined) {
      const play = uploadedGameData.script?.video_script[playIndex]
      if (play) {
        // Find the video (might be from this play or next play in sequence)
        const videoUrl = findVideoForPlay(play, playIndex)
        
        if (videoUrl) {
          newSlide = {
            ...newSlide,
            video_url: videoUrl,
            thumbnail_url: videoUrl.replace('.mp4', '_thumbnail.jpg'),
            caption: play.description,
            metadata: {
              period: play.period,
              clock: play.clock,
              actionType: play.actionType,
              subType: play.subType,
              playerName: play.playerName,
              playerNameI: play.playerNameI,
              personId: play.personId,
              teamTricode: play.teamTricode,
              scoreHome: play.scoreHome,
              scoreAway: play.scoreAway,
              shotResult: play.shotResult,
              isSequence: !play.mp4 // Mark if video is from next play
            }
          }
        }
      }
    } else if (slideType === 'game_summary') {
      newSlide = {
        ...newSlide,
        home_team: uploadedGameData.gameMetadata?.homeTeam,
        away_team: uploadedGameData.gameMetadata?.awayTeam,
        game_date: uploadedGameData.gameMetadata?.date,
        arena: uploadedGameData.gameMetadata?.arena,
        matchup: uploadedGameData.story?.matchup,
        final_score: uploadedGameData.story?.final_score
      }
    } else if (slideType === 'story_comparison' && playIndex !== undefined) {
      const gameData = uploadedGameData as any
      const advantage = gameData.story?.advantages[playIndex]
      if (advantage) {
        // Determine which team the advantage belongs to; ensure the advantaged value is the larger one
        const winnerTricode = advantage.teamTricode
        const homeTri = uploadedGameData.gameMetadata?.homeTeam?.abbreviation
        const awayTri = uploadedGameData.gameMetadata?.awayTeam?.abbreviation
        const primary = Math.max(advantage.value1 ?? 0, advantage.value2 ?? 0)
        const secondary = Math.min(advantage.value1 ?? 0, advantage.value2 ?? 0)

        // Get team colors
        const homeTeamIdentifier = uploadedGameData.gameMetadata?.homeTeam?.abbreviation || uploadedGameData.gameMetadata?.homeTeam?.name || ''
        const awayTeamIdentifier = uploadedGameData.gameMetadata?.awayTeam?.abbreviation || uploadedGameData.gameMetadata?.awayTeam?.name || ''
        
        newSlide = {
          ...newSlide,
          duration: 7000, // 7 seconds for chart slides
          advantage: {
            category: advantage.stat_name,
            home_value: winnerTricode === homeTri ? primary : (winnerTricode === awayTri ? secondary : advantage.value1),
            away_value: winnerTricode === awayTri ? primary : (winnerTricode === homeTri ? secondary : advantage.value2),
            winner: winnerTricode === homeTri ? 'home' : 'away'
          },
          home_team: {
            name: uploadedGameData.gameMetadata?.homeTeam?.name || '',
            city: uploadedGameData.gameMetadata?.homeTeam?.city || '',
            color: getContrastColor(getTeamPrimaryColor(homeTeamIdentifier))
          },
          away_team: {
            name: uploadedGameData.gameMetadata?.awayTeam?.name || '',
            city: uploadedGameData.gameMetadata?.awayTeam?.city || '',
            color: getContrastColor(getTeamPrimaryColor(awayTeamIdentifier))
          }
        }
      }
    } else if (slideType === 'matchup_comparison' && playIndex !== undefined) {
      const topMatchups = getTopMatchups('minutes', 20)
      const matchup = topMatchups[playIndex]
      if (matchup) {
        newSlide = {
          ...newSlide,
          duration: 7000, // 7 seconds for chart slides
          playerA: {
            name: matchup.playerA.name,
            teamTricode: matchup.playerA.teamTricode,
            color: getContrastColor(getTeamPrimaryColor(matchup.playerA.teamTricode)),
            stats: {
              points: matchup.playerA.points,
              fgPercentage: matchup.playerA.fgPercentage,
              assists: matchup.playerA.assists,
              turnovers: matchup.playerA.turnovers,
              blocks: matchup.playerA.blocks,
              minutesPlayed: matchup.matchupMinutesSort / 60,
            }
          },
          playerB: {
            name: matchup.playerB.name,
            teamTricode: matchup.playerB.teamTricode,
            color: getContrastColor(getTeamPrimaryColor(matchup.playerB.teamTricode)),
            stats: {
              points: matchup.playerB.points,
              fgPercentage: matchup.playerB.fgPercentage,
              assists: matchup.playerB.assists,
              turnovers: matchup.playerB.turnovers,
              blocks: matchup.playerB.blocks,
              minutesPlayed: matchup.matchupMinutesSort / 60,
            }
          },
          matchupMinutes: matchup.matchupMinutes
        }
      }
    } else if (slideType === 'offensive_defensive_scatter') {
      const players = getChartPlayerData()
      if (players.length > 0) {
        newSlide = {
          ...newSlide,
          type: 'offensive_defensive_scatter',
          duration: 7000,
          players: players.map((p: any) => ({
            name: p.name,
            teamTricode: p.teamTricode,
            offensiveRating: p.offensiveRating,
            defensiveRating: p.defensiveRating,
            minutes: p.minutesStr,
            color: p.teamColor
          }))
        }
      } else {
        setSnackbar({
          open: true,
          message: 'No player data available for this chart',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'pace_space_bubble') {
      const players = getChartPlayerData()
      if (players.length > 0) {
        newSlide = {
          ...newSlide,
          type: 'pace_space_bubble',
          duration: 7000,
          players: players.map((p: any) => ({
            name: p.name,
            teamTricode: p.teamTricode,
            speed: p.speed,
            distance: p.distance,
            minutes: p.minutesStr,
            color: p.teamColor
          }))
        }
      } else {
        setSnackbar({
          open: true,
          message: 'No player tracking data available',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'hustle_radar' && playIndex !== undefined) {
      const players = getChartPlayerData()
      const player = players[playIndex]
      if (player) {
        newSlide = {
          ...newSlide,
          type: 'hustle_radar',
          duration: 7000,
          player: {
            name: player.name,
            teamTricode: player.teamTricode,
            color: player.teamColor,
            stats: {
              deflections: player.deflections,
              chargesDrawn: player.chargesDrawn,
              screenAssists: player.screenAssists,
              looseBalls: player.looseBalls,
              boxOuts: player.boxOuts,
              contestedShots: player.contestedShots
            }
          }
        }
      } else {
        setSnackbar({
          open: true,
          message: 'Player data not found',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'four_factors') {
      const players = getChartPlayerData()
      
      // Aggregate team stats
      const homeTeam = uploadedGameData.gameMetadata?.homeTeam
      const awayTeam = uploadedGameData.gameMetadata?.awayTeam
      
      const homePlayers = players.filter((p: any) => p.teamName === homeTeam?.name)
      const awayPlayers = players.filter((p: any) => p.teamName === awayTeam?.name)
      
      const avgStats = (players: any[]) => ({
        efg: players.reduce((sum, p) => sum + p.efg, 0) / players.length || 0,
        ftaRate: players.reduce((sum, p) => sum + p.ftaRate, 0) / players.length || 0,
        tovRate: players.reduce((sum, p) => sum + p.tovRate, 0) / players.length || 0,
        orbRate: players.reduce((sum, p) => sum + p.orbRate, 0) / players.length || 0,
      })
      
      // Get team colors
      const homeTeamIdentifier = homeTeam?.abbreviation || homeTeam?.name || ''
      const awayTeamIdentifier = awayTeam?.abbreviation || awayTeam?.name || ''
      
      if (homePlayers.length && awayPlayers.length) {
        newSlide = {
          ...newSlide,
          type: 'four_factors',
          duration: 7000,
          homeTeam: {
            teamName: homeTeam?.city + ' ' + homeTeam?.name,
            teamColor: getContrastColor(getTeamPrimaryColor(homeTeamIdentifier)),
            ...avgStats(homePlayers)
          },
          awayTeam: {
            teamName: awayTeam?.city + ' ' + awayTeam?.name,
            teamColor: getContrastColor(getTeamPrimaryColor(awayTeamIdentifier)),
            ...avgStats(awayPlayers)
          }
        }
      } else {
        setSnackbar({
          open: true,
          message: 'Not enough team data for Four Factors',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'shot_distribution' && playIndex !== undefined) {
      const players = getChartPlayerData()
      const player = players[playIndex]
      if (player) {
        newSlide = {
          ...newSlide,
          type: 'shot_distribution',
          duration: 7000,
          player: {
            name: player.name,
            teamTricode: player.teamTricode,
            totalPoints: player.points,
            distribution: {
              paint: player.paintPct,
              midrange: player.midrangePct,
              threePoint: player.threePointPct,
              freeThrow: player.freeThrowPct
            }
          }
        }
      } else {
        setSnackbar({
          open: true,
          message: 'Player data not found',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'shot_profile_efficiency' && playIndex !== undefined) {
      const players = getChartPlayerData()
      const player = players[playIndex]
      if (player) {
        const zones = [
          { zone: 'Paint', efg: player.paintEFG, attempts: player.rimFGA || 5, made: player.rimFGM || 2 },
          { zone: 'Midrange', efg: player.midrangeEFG, attempts: Math.round((player.points || 0) * 0.3), made: Math.round((player.points || 0) * 0.15) },
          { zone: '3PT', efg: player.threePointEFG, attempts: Math.round((player.points || 0) * 0.4), made: Math.round((player.points || 0) * 0.2) },
        ].filter(z => z.attempts > 0)
        
        newSlide = {
          ...newSlide,
          type: 'shot_profile_efficiency',
          duration: 7000,
          player: {
            name: player.name,
            teamTricode: player.teamTricode,
            teamColor: player.teamColor,
            zones
          }
        }
      } else {
        setSnackbar({ open: true, message: 'Player data not found', color: 'warning' })
        return
      }
    } else if (slideType === 'rim_pressure' && playIndex !== undefined) {
      const players = getChartPlayerData()
      const player = players[playIndex]
      if (player) {
        newSlide = {
          ...newSlide,
          type: 'rim_pressure',
          duration: 7000,
          player: {
            name: player.name,
            teamTricode: player.teamTricode,
            teamColor: player.teamColor,
            stats: {
              drives: player.drives,
              rimAttempts: player.rimAttempts,
              rimFTA: player.rimFTA,
              passOuts: player.passOuts,
              rimFGM: player.rimFGM,
              rimFGA: player.rimFGA
            }
          }
        }
      } else {
        setSnackbar({ open: true, message: 'Player data not found', color: 'warning' })
        return
      }
    } else if (slideType === 'on_ball_creation' && playIndex !== undefined) {
      const players = getChartPlayerData()
      const player = players[playIndex]
      if (player) {
        newSlide = {
          ...newSlide,
          type: 'on_ball_creation',
          duration: 7000,
          player: {
            name: player.name,
            teamTricode: player.teamTricode,
            teamColor: player.teamColor,
            stats: {
              touches: player.touches,
              potentialAssists: player.potentialAssists,
              paintTouches: player.paintTouches,
              secondaryAssists: player.secondaryAssists,
              assists: player.assists
            }
          }
        }
      } else {
        setSnackbar({ open: true, message: 'Player data not found', color: 'warning' })
        return
      }
    } else if (slideType === 'defensive_events' && playIndex !== undefined) {
      const players = getChartPlayerData()
      const player = players[playIndex]
      if (player) {
        newSlide = {
          ...newSlide,
          type: 'defensive_events',
          duration: 7000,
          player: {
            name: player.name,
            teamTricode: player.teamTricode,
            teamColor: player.teamColor,
            events: [
              {
                category: 'Overall',
                steals: player.steals,
                blocks: player.blocks,
                deflections: player.deflections,
                chargesDrawn: player.chargesDrawn,
                minutes: player.minutes
              }
            ]
          }
        }
      } else {
        setSnackbar({ open: true, message: 'Player data not found', color: 'warning' })
        return
      }
    } else if (slideType === 'foul_drawing' && playIndex !== undefined) {
      const players = getChartPlayerData()
      const player = players[playIndex]
      if (player) {
        newSlide = {
          ...newSlide,
          type: 'foul_drawing',
          duration: 7000,
          player: {
            name: player.name,
            teamTricode: player.teamTricode,
            teamColor: player.teamColor,
            stats: {
              ftRate: player.ftRate,
              ftRatePer36: player.ftRatePer36,
              andOneRate: player.andOneRate,
              shootingFoulsDrawn: player.shootingFoulsDrawn,
              offensiveFoulsDrawn: player.offensiveFoulsDrawn,
              totalFoulsDrawn: player.totalFoulsDrawn,
              fta: player.fta,
              ftm: player.ftm
            }
          }
        }
      } else {
        setSnackbar({ open: true, message: 'Player data not found', color: 'warning' })
        return
      }
    } else if (slideType === 'rebounding_battle') {
      const players = getChartPlayerData()
      if (players.length > 0) {
        newSlide = {
          ...newSlide,
          type: 'rebounding_battle',
          duration: 7000,
          players: players.map((p: any) => ({
            name: p.name,
            teamTricode: p.teamTricode,
            teamColor: p.teamColor,
            offensiveRebounds: p.offRebPct, // percentage based
            defensiveRebounds: p.defRebPct,
            totalRebounds: p.totalRebPct
          }))
        }
      } else {
        setSnackbar({
          open: true,
          message: 'No rebounding data available',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'playmaking_efficiency') {
      const players = getChartPlayerData()
      if (players.length > 0) {
        newSlide = {
          ...newSlide,
          type: 'playmaking_efficiency',
          duration: 7000,
          players: players.filter((p: any) => p.assists > 0).map((p: any) => ({
            name: p.name,
            teamTricode: p.teamTricode,
            teamColor: p.teamColor,
            assists: p.assists,
            turnovers: Math.round(p.turnovers),
            astToRatio: p.turnovers > 0 ? p.assists / p.turnovers : p.assists
          }))
        }
      } else {
        setSnackbar({
          open: true,
          message: 'No playmaking data available',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'turnover_analysis') {
      const gameData = uploadedGameData as any
      const homeTeam = uploadedGameData.gameMetadata?.homeTeam
      const awayTeam = uploadedGameData.gameMetadata?.awayTeam
      
      // Get team stats
      const homeStats = gameData.score?.[gameData.gameId]?.team_stats?.home
      const awayStats = gameData.score?.[gameData.gameId]?.team_stats?.away
      
      if (homeTeam && awayTeam && homeStats && awayStats) {
        const homeTeamIdentifier = homeTeam.abbreviation || homeTeam.name || ''
        const awayTeamIdentifier = awayTeam.abbreviation || awayTeam.name || ''
        
        newSlide = {
          ...newSlide,
          type: 'turnover_analysis',
          duration: 7000,
          teams: [
            {
              teamName: homeTeam.city + ' ' + homeTeam.name,
              teamTricode: homeTeam.abbreviation,
              teamColor: getContrastColor(getTeamPrimaryColor(homeTeamIdentifier)),
              turnovers: homeStats.turnovers || 0,
              pointsOffTurnovers: homeStats.pointsOffTurnovers || 0
            },
            {
              teamName: awayTeam.city + ' ' + awayTeam.name,
              teamTricode: awayTeam.abbreviation,
              teamColor: getContrastColor(getTeamPrimaryColor(awayTeamIdentifier)),
              turnovers: awayStats.turnovers || 0,
              pointsOffTurnovers: awayStats.pointsOffTurnovers || 0
            }
          ]
        }
      } else {
        setSnackbar({
          open: true,
          message: 'No turnover data available',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'plus_minus_impact') {
      const players = getChartPlayerData()
      if (players.length > 0) {
        newSlide = {
          ...newSlide,
          type: 'plus_minus_impact',
          duration: 7000,
          players: players.map((p: any) => ({
            name: p.name,
            teamTricode: p.teamTricode,
            teamColor: p.teamColor,
            plusMinus: Math.round(p.netRating),
            minutes: p.minutes
          }))
        }
      } else {
        setSnackbar({
          open: true,
          message: 'No plus/minus data available',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'usage_efficiency') {
      const players = getChartPlayerData()
      if (players.length > 0) {
        newSlide = {
          ...newSlide,
          type: 'usage_efficiency',
          duration: 7000,
          players: players.filter((p: any) => p.usageRate > 0).map((p: any) => ({
            name: p.name,
            teamTricode: p.teamTricode,
            teamColor: p.teamColor,
            usageRate: p.usageRate,
            trueShootingPct: p.trueShootingPct,
            points: p.points
          }))
        }
      } else {
        setSnackbar({
          open: true,
          message: 'No usage/efficiency data available',
          color: 'warning'
        })
        return
      }
    } else if (slideType === 'top_fantasy_scorers') {
      const gameId = uploadedGameData?.gameId || postForm.game_id
      if (!gameId) {
        setSnackbar({
          open: true,
          message: 'Game ID required to fetch fantasy scores',
          color: 'warning'
        })
        return
      }

      try {
        // Try live_player_stats first (for live/recent games)
        let { data: liveStats, error: liveError } = await supabase
          .from('live_player_stats')
          .select('nba_player_id, player_name, team_tricode, stats')
          .eq('game_id', gameId)

        let players: any[] = []

        if (liveStats && !liveError && liveStats.length > 0) {
          // Use live_player_stats
          players = liveStats.map((player: any) => {
            const stats = player.stats || {}
            const fantasyPoints = FANDUEL_SCORING.calculatePoints({
              pts: stats.pts || 0,
              reb: stats.reb || 0,
              ast: stats.ast || 0,
              stl: stats.stl || 0,
              blk: stats.blk || 0,
              tov: stats.tov || 0,
            } as any)

            const rawColor = getTeamPrimaryColor(player.team_tricode)
            const teamColor = getContrastColor(rawColor)

            return {
              name: player.player_name,
              teamTricode: player.team_tricode,
              teamColor,
              fantasyPoints,
              pts: stats.pts || 0,
              reb: stats.reb || 0,
              ast: stats.ast || 0,
              stl: stats.stl || 0,
              blk: stats.blk || 0,
              tov: stats.tov || 0,
            }
          })
        } else {
          // Fall back to nba_boxscores (for final games)
          const { data: boxscoreStats, error: boxscoreError } = await supabase
            .from('nba_boxscores')
            .select('nba_player_id, player_name, team_tricode, pts, reb, ast, stl, blk, tov')
            .eq('game_id', gameId)

          if (boxscoreStats && !boxscoreError && boxscoreStats.length > 0) {
            players = boxscoreStats.map((player: any) => {
              const fantasyPoints = FANDUEL_SCORING.calculatePoints({
                pts: player.pts || 0,
                reb: player.reb || 0,
                ast: player.ast || 0,
                stl: player.stl || 0,
                blk: player.blk || 0,
                tov: player.tov || 0,
              } as any)

              const rawColor = getTeamPrimaryColor(player.team_tricode)
              const teamColor = getContrastColor(rawColor)

              return {
                name: player.player_name,
                teamTricode: player.team_tricode,
                teamColor,
                fantasyPoints,
                pts: player.pts || 0,
                reb: player.reb || 0,
                ast: player.ast || 0,
                stl: player.stl || 0,
                blk: player.blk || 0,
                tov: player.tov || 0,
              }
            })
          }
        }

        if (players.length === 0) {
          setSnackbar({
            open: true,
            message: 'No player stats found in database for this game',
            color: 'warning'
          })
          return
        }

        // Sort by fantasy points and take top 5
        const top5 = players
          .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
          .slice(0, 5)

        newSlide = {
          ...newSlide,
          type: 'top_fantasy_scorers',
          duration: 7000,
          players: top5
        }
      } catch (error) {
        console.error('Error fetching fantasy scores:', error)
        setSnackbar({
          open: true,
          message: 'Error fetching fantasy scores from database',
          color: 'danger'
        })
        return
      }
    }

    setPostForm(prev => ({
      ...prev,
      slides: [...prev.slides, newSlide]
    }))
    
    // Switch to the newly created slide tab (2 base tabs + new slide index)
    // For video slides, stay on the video clips view (step 1) to expedite workflow
    if (slideType !== 'video') {
      setActiveStep(postForm.slides.length + 2)
    }
  }

  // Remove slide
  const handleRemoveSlide = (index: number) => {
    setPostForm(prev => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index).map((slide, i) => ({
        ...slide,
        order: i
      }))
    }))
    // Switch back to Add Slides tab
    setActiveStep(1)
  }

  // Update slide caption
  const handleUpdateSlideCaption = (index: number, caption: string) => {
    setPostForm(prev => ({
      ...prev,
      slides: prev.slides.map((slide, i) => 
        i === index ? { ...slide, caption } : slide
      )
    }))
  }

  // Update slide duration
  const handleUpdateSlideDuration = (index: number, duration: number) => {
    setPostForm(prev => ({
      ...prev,
      slides: prev.slides.map((slide, i) => 
        i === index ? { ...slide, duration: duration * 1000 } : slide // Convert seconds to milliseconds
      )
    }))
  }

  // Move slide
  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const newSlides = [...postForm.slides]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newSlides.length) return
    
    ;[newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]]
    
    // Update order values
    newSlides.forEach((slide, i) => {
      slide.order = i
    })
    
    setPostForm(prev => ({ ...prev, slides: newSlides }))
  }

  // Extract player IDs and team tricodes from slides
  const extractTagsFromSlides = () => {
    const playerIds = new Set<number>()
    const teamTricodes = new Set<string>()
    
    postForm.slides.forEach(slide => {
      if (slide.metadata?.personId) {
        playerIds.add(slide.metadata.personId)
      }
      if (slide.metadata?.teamTricode) {
        teamTricodes.add(slide.metadata.teamTricode)
      }
    })
    
    return {
      player_ids: Array.from(playerIds),
      team_tricodes: Array.from(teamTricodes)
    }
  }

  // Save as draft
  const handleSaveDraft = async (createNew: boolean = false) => {
    if (!user) return
    
    try {
      const tags = extractTagsFromSlides()
      
      const postData = {
        created_by: user.id,
        post_type: postForm.post_type,
        status: 'draft',
        title: postForm.title,
        description: postForm.description,
        game_id: postForm.game_id || null,
        game_date: postForm.game_date || null,
        team_tricodes: tags.team_tricodes,
        player_ids: tags.player_ids,
        slides: postForm.slides,
        metadata: postForm.metadata
      }

      if (editingPost) {
        const { error } = await supabase
          .from('feed_posts')
          .update(postData)
          .eq('id', editingPost.id)
        
        if (error) throw error
        setSnackbar({
          open: true,
          message: 'Post updated as draft',
          color: 'success'
        })
      } else {
        const { error } = await supabase
          .from('feed_posts')
          .insert([postData])
        
        if (error) throw error
        setSnackbar({
          open: true,
          message: 'Post saved as draft',
          color: 'success'
        })
        setExistingPostsCount(prev => prev + 1)
      }

      loadPosts()
      
      if (createNew) {
        // Reset form but keep JSON loaded
        resetForm()
      } else {
        // Close form and reset everything
        if (onClose) {
          onClose()
        } else {
          setView('table')
          resetAll()
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      setSnackbar({
        open: true,
        message: 'Error saving draft',
        color: 'danger'
      })
    }
  }

  // Publish post
  const handlePublish = async (createNew: boolean = false) => {
    if (!user) return
    
    if (postForm.slides.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please add at least one slide before publishing',
        color: 'warning'
      })
      return
    }

    try {
      const tags = extractTagsFromSlides()
      
      const postData = {
        created_by: user.id,
        post_type: postForm.post_type,
        status: 'published',
        title: postForm.title,
        description: postForm.description,
        game_id: postForm.game_id || null,
        game_date: postForm.game_date || null,
        team_tricodes: tags.team_tricodes,
        player_ids: tags.player_ids,
        slides: postForm.slides,
        metadata: postForm.metadata,
        published_at: new Date().toISOString()
      }

      if (editingPost) {
        // First update the post with new data
        const { error: updateError } = await supabase
          .from('feed_posts')
          .update(postData)
          .eq('id', editingPost.id)
        
        if (updateError) throw updateError

        // Then use the publish_post function to change status
        const { error: publishError } = await supabase.rpc('publish_post', { 
          post_id: editingPost.id 
        })
        
        if (publishError) throw publishError
      } else {
        const { error } = await supabase
          .from('feed_posts')
          .insert([postData])
        
        if (error) throw error
        setExistingPostsCount(prev => prev + 1)
      }

      setSnackbar({
        open: true,
        message: 'Post published successfully! 🎉',
        color: 'success'
      })
      loadPosts()
      
      // If creating a new post (not editing), go back to admin/create-post page
      if (!editingPost && onClose) {
        onClose()
        return
      }
      
      // If editing, reset form and stay on form view
      // Always go back to step 0 (Post Details) with the same JSON file loaded
      resetForm()
      setView('form')
    } catch (error: any) {
      console.error('Error publishing post:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error publishing post',
        color: 'danger'
      })
    }
  }

  // Reset form
  const resetForm = () => {
    // Auto-generate title from uploaded game data if available
    const awayTeam = uploadedGameData?.gameMetadata?.awayTeam
    const homeTeam = uploadedGameData?.gameMetadata?.homeTeam
    const autoTitle = awayTeam && homeTeam 
      ? `${awayTeam.city} ${awayTeam.name} vs ${homeTeam.city} ${homeTeam.name}`
      : uploadedGameData?.story?.matchup || ''
    
    setPostForm({
      post_type: 'game_highlight',
      title: autoTitle,
      description: '',
      game_id: uploadedGameData?.gameId || '',
      game_date: uploadedGameData?.gameMetadata?.date || '',
      team_tricodes: uploadedGameData ? [
        uploadedGameData.gameMetadata?.homeTeam?.abbreviation,
        uploadedGameData.gameMetadata?.awayTeam?.abbreviation
      ].filter(Boolean) : [],
      slides: [],
      metadata: uploadedGameData ? {
        arena: uploadedGameData.gameMetadata?.arena,
        season: uploadedGameData.gameMetadata?.season,
        homeTeam: uploadedGameData.gameMetadata?.homeTeam,
        awayTeam: uploadedGameData.gameMetadata?.awayTeam,
        story_data: uploadedGameData.story,
        fun_data: uploadedGameData.score?.[Object.keys(uploadedGameData.score || {})[0]],
        fun_score: uploadedGameData.score?.[Object.keys(uploadedGameData.score || {})[0]]?.fun_score
      } : {}
    })
    setEditingPost(null)
    setActiveStep(0)
  }
  
  const resetAll = () => {
    setPostForm({
      post_type: 'game_highlight',
      title: '',
      description: '',
      game_id: '',
      game_date: '',
      team_tricodes: [],
      slides: [],
      metadata: {}
    })
    setEditingPost(null)
    setUploadedGameData(null)
    setActiveStep(0)
    setExistingPostsCount(0)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Post to Reddit
  const handlePostToReddit = async (post: FeedPost) => {
    try {
      setSnackbar({
        open: true,
        message: 'Posting to Reddit...',
        color: 'neutral'
      })

      const { data, error } = await supabase.functions.invoke('post-to-reddit', {
        body: {
          post_id: post.id,
          subreddit: 'hoopgeek' // You can make this configurable
        }
      })

      if (error) {
        throw error
      }

      if (data?.success) {
        setSnackbar({
          open: true,
          message: `Posted to Reddit! ${data.reddit_post_url ? `View post: ${data.reddit_post_url}` : ''}`,
          color: 'success'
        })
        // Reload posts to update metadata
        loadPosts()
      } else {
        throw new Error(data?.error || 'Failed to post to Reddit')
      }
    } catch (error: any) {
      console.error('Error posting to Reddit:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error posting to Reddit. Please check Reddit credentials are configured.',
        color: 'danger'
      })
    }
  }

  // Post to Facebook
  const handlePostToFacebook = async (post: FeedPost) => {
    try {
      setSnackbar({
        open: true,
        message: 'Posting to Facebook...',
        color: 'neutral'
      })

      const { data, error } = await supabase.functions.invoke('post-to-facebook', {
        body: {
          post_id: post.id
        }
      })

      if (error) {
        throw error
      }

      if (data?.success) {
        setSnackbar({
          open: true,
          message: `Posted to Facebook! ${data.facebook_post_url ? `View post: ${data.facebook_post_url}` : ''}`,
          color: 'success'
        })
        // Reload posts to update metadata
        loadPosts()
      } else {
        throw new Error(data?.error || 'Failed to post to Facebook')
      }
    } catch (error: any) {
      console.error('Error posting to Facebook:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error posting to Facebook. Please check Facebook credentials are configured.',
        color: 'danger'
      })
    }
  }

  // Delete post
  const handleDeletePost = async (postId: string) => {
    // Get the post to check if it's a fun_score post
    const postToDelete = posts.find(p => p.id === postId)
    const isFunScore = postToDelete?.post_type === 'fun_score'
    const gameId = postToDelete?.game_id

    if (!confirm(isFunScore && gameId
      ? `Are you sure you want to delete this fun_score post and ALL posts (including player spotlights) with game_id ${gameId}?` 
      : 'Are you sure you want to delete this post?')) return

    try {
      if (isFunScore && gameId) {
        // Delete ALL posts with the same game_id (fun_score, player_spotlight, etc.)
        const { error: deleteAllError } = await supabase
          .from('feed_posts')
          .delete()
          .eq('game_id', gameId)

        if (deleteAllError) throw deleteAllError
        
        setSnackbar({
          open: true,
          message: `All posts with game_id ${gameId} deleted`,
          color: 'success'
        })
      } else {
        // Delete just this post
        const { error } = await supabase
          .from('feed_posts')
          .delete()
          .eq('id', postId)

        if (error) throw error
        setSnackbar({
          open: true,
          message: 'Post deleted',
          color: 'success'
        })
      }
      loadPosts()
    } catch (error) {
      console.error('Error deleting post:', error)
      setSnackbar({
        open: true,
        message: 'Error deleting post',
        color: 'danger'
      })
    }
  }

  // Edit post
  const handleEditPost = async (post: FeedPost) => {
    setEditingPost(post)
    setPostForm({
      post_type: post.post_type,
      title: post.title || '',
      description: post.description || '',
      game_id: post.game_id || '',
      game_date: post.game_date || '',
      team_tricodes: post.team_tricodes || [],
      slides: post.slides || [],
      metadata: {}
    })
    setView('form')
  }

  // Toggle post selection
  const handleTogglePostSelection = (postId: string) => {
    setSelectedPostIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  // Select/Deselect all visible posts
  const handleSelectAllPosts = () => {
    const allSelected = paginatedPosts.every(p => selectedPostIds.has(p.id))
    if (allSelected) {
      // Deselect all
      setSelectedPostIds(new Set())
    } else {
      // Select all visible
      setSelectedPostIds(new Set(paginatedPosts.map(p => p.id)))
    }
  }

  // Bulk delete selected posts
  const handleBulkDeletePosts = async () => {
    if (selectedPostIds.size === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one post to delete',
        color: 'warning'
      })
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedPostIds.size} post(s)?`)) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('feed_posts')
        .delete()
        .in('id', Array.from(selectedPostIds))

      if (error) throw error

      setSnackbar({
        open: true,
        message: `Successfully deleted ${selectedPostIds.size} post(s)`,
        color: 'success'
      })

      setSelectedPostIds(new Set())
      loadPosts()
    } catch (error) {
      console.error('Error bulk deleting posts:', error)
      setSnackbar({
        open: true,
        message: 'Error deleting posts',
        color: 'danger'
      })
    } finally {
      setLoading(false)
    }
  }

  // Bulk publish selected posts
  const handleBulkPublishPosts = async () => {
    if (selectedPostIds.size === 0) {
      setSnackbar({
        open: true,
        message: 'Please select at least one post to publish',
        color: 'warning'
      })
      return
    }

    setLoading(true)
    try {
      // Publish each post using the publish_post function
      for (const postId of selectedPostIds) {
        const { error } = await supabase.rpc('publish_post', { post_id: postId })
        if (error) {
          console.error(`Error publishing post ${postId}:`, error)
          throw error
        }
      }

      setSnackbar({
        open: true,
        message: `Successfully published ${selectedPostIds.size} post(s)! 🎉`,
        color: 'success'
      })

      setSelectedPostIds(new Set())
      loadPosts()
    } catch (error: any) {
      console.error('Error bulk publishing posts:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Error publishing posts',
        color: 'danger'
      })
    } finally {
      setLoading(false)
    }
  }

  // Extract unique players from game data
  const getUniquePlayers = () => {
    if (!uploadedGameData?.script?.video_script) return []
    
    const playersMap = new Map<string, { lastName: string, fullName: string, personId: number }>()
    
    uploadedGameData.script.video_script.forEach(play => {
      if (play.playerName && play.personId) {
        const key = `${play.personId}`
        if (!playersMap.has(key)) {
          // playerNameI is like "A. Nembhard", extract full name
          const fullName = play.playerNameI || play.playerName
          playersMap.set(key, {
            lastName: play.playerName,
            fullName: fullName,
            personId: play.personId
          })
        }
      }
      
      // Also check for assists in description
      const assistMatch = play.description.match(/\(([^)]+)\s+(\d+)\s+AST\)/)
      if (assistMatch) {
        const assistPlayerName = assistMatch[1]
        // Try to find the full player info
        const assistPlay = uploadedGameData.script.video_script.find(p => 
          p.playerName === assistPlayerName || p.playerNameI?.includes(assistPlayerName)
        )
        if (assistPlay && assistPlay.personId) {
          const key = `${assistPlay.personId}`
          if (!playersMap.has(key)) {
            playersMap.set(key, {
              lastName: assistPlay.playerName,
              fullName: assistPlay.playerNameI || assistPlay.playerName,
              personId: assistPlay.personId
            })
          }
        }
      }
    })
    
    return Array.from(playersMap.values())
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
  }
  
  // Extract unique action types
  const getUniqueActionTypes = () => {
    if (!uploadedGameData?.script?.video_script) return []
    
    const typesSet = new Set<string>()
    uploadedGameData.script.video_script.forEach(play => {
      if (play.actionType) {
        typesSet.add(play.actionType)
      }
    })
    
    return Array.from(typesSet).sort()
  }
  
  // Extract unique quarters
  const getUniqueQuarters = () => {
    if (!uploadedGameData?.script?.video_script) return []
    
    const quartersSet = new Set<number>()
    uploadedGameData.script.video_script.forEach(play => {
      if (play.period) {
        quartersSet.add(play.period)
      }
    })
    
    return Array.from(quartersSet).sort((a, b) => a - b)
  }
  
  // Check if play involves selected player (as player or assister)
  const playInvolvesPlayer = (play: any, playerId: string) => {
    if (playerId === 'all') return true
    
    // Check if player is the main actor
    if (play.personId.toString() === playerId) return true
    
    // Check if player assisted
    const assistMatch = play.description.match(/\(([^)]+)\s+(\d+)\s+AST\)/)
    if (assistMatch) {
      const assistPlayerName = assistMatch[1]
      const assistPlay = uploadedGameData?.script?.video_script.find(p => 
        p.playerName === assistPlayerName || p.playerNameI?.includes(assistPlayerName)
      )
      if (assistPlay && assistPlay.personId.toString() === playerId) {
        return true
      }
    }
    
    return false
  }
  
  // Find the video for a play (might be in the next play if sequence)
  const findVideoForPlay = (play: any, index: number) => {
    if (play.mp4) return play.mp4
    
    // Look forward for the next play with video (within 20 seconds)
    const videoScript = uploadedGameData?.script?.video_script || []
    for (let i = index + 1; i < Math.min(index + 10, videoScript.length); i++) {
      const nextPlay = videoScript[i]
      if (nextPlay.mp4 && nextPlay.period === play.period) {
        // Check if within ~20 seconds
        const currentTime = parseClockToSeconds(play.clock)
        const nextTime = parseClockToSeconds(nextPlay.clock)
        if (currentTime - nextTime <= 20) {
          return nextPlay.mp4
        }
      }
    }
    
    return null
  }
  
  // Parse clock to seconds
  const parseClockToSeconds = (clock: string) => {
    try {
      const match = clock.match(/PT(\d+)M([\d.]+)S/)
      if (match) {
        const minutes = parseInt(match[1])
        const seconds = parseFloat(match[2])
        return minutes * 60 + seconds
      }
    } catch (e) {
      return 0
    }
    return 0
  }
  
  // Filter plays based on selections
  const getFilteredPlays = () => {
    if (!uploadedGameData?.script?.video_script) return []
    
    return uploadedGameData.script.video_script
      .map((play, index) => ({
        ...play,
        video: findVideoForPlay(play, index),
        originalIndex: index
      }))
      .filter(play => {
        // Filter by search query (description)
        if (searchQuery && !play.description.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false
        }
        
        // Filter by player
        if (!playInvolvesPlayer(play, selectedPlayer)) return false
        
        // Filter by action type
        if (selectedActionType !== 'all' && play.actionType !== selectedActionType) return false
        
        // Filter by quarter
        if (selectedQuarter !== 'all' && play.period.toString() !== selectedQuarter) return false
        
        // Filter by video availability
        if (showOnlyWithVideo && !play.video) return false
        
        return true
      })
  }

  // Get matchup data from JSON (handles both old and new formats)
  const getMatchups = () => {
    const gameData = uploadedGameData as any
    
    // NEW FORMAT: Check for AggregatedPlayerStats with matchup_ fields
    if (gameData?.AggregatedPlayerStats) {
      const matchups: any[] = []
      Object.entries(gameData.AggregatedPlayerStats).forEach(([personId, stats]: [string, any]) => {
        if (stats.matchup_personIdOff && stats.matchup_personIdDef) {
          matchups.push({
            gameId: gameData.gameId,
            personIdOff: stats.matchup_personIdOff,
            nameIOff: stats.matchup_nameIOff,
            firstNameOff: stats.matchup_firstNameOff,
            familyNameOff: stats.matchup_familyNameOff,
            teamTricode: stats.teamTricode,
            jerseyNumOff: stats.matchup_jerseyNumOff,
            personIdDef: stats.matchup_personIdDef,
            nameIDef: stats.matchup_nameIDef,
            firstNameDef: stats.matchup_firstNameDef,
            familyNameDef: stats.matchup_familyNameDef,
            jerseyNumDef: stats.matchup_jerseyNumDef,
            matchupMinutes: stats.matchup_matchupMinutes,
            matchupMinutesSort: stats.matchup_matchupMinutesSort,
            playerPoints: stats.matchup_playerPoints,
            teamPoints: stats.matchup_teamPoints,
            matchupFieldGoalsMade: stats.matchup_matchupFieldGoalsMade,
            matchupFieldGoalsAttempted: stats.matchup_matchupFieldGoalsAttempted,
            matchupFieldGoalsPercentage: stats.matchup_matchupFieldGoalsPercentage,
            matchupAssists: stats.matchup_matchupAssists,
            matchupTurnovers: stats.matchup_matchupTurnovers,
            matchupBlocks: stats.matchup_matchupBlocks,
          })
        }
      })
      return matchups
    }
    
    // OLD FORMAT: Check score[gameId].matchups.PlayerStats
    if (gameData?.score) {
      const gameId = gameData.gameId
      if (gameId && gameData.score[gameId]?.matchups?.PlayerStats) {
        return gameData.score[gameId].matchups.PlayerStats
      }
    }
    
    return []
  }

  // Get top matchups by criteria
  const getTopMatchups = (criteria: 'minutes' | 'points' | 'competitive' = 'minutes', limit = 10) => {
    const matchups = getMatchups()
    if (!matchups.length) return []

    // Group matchups by player pair and aggregate stats
    const matchupMap = new Map()
    
    matchups.forEach((matchup: any) => {
      const key = `${Math.min(matchup.personIdOff, matchup.personIdDef)}-${Math.max(matchup.personIdOff, matchup.personIdDef)}`
      
      if (!matchupMap.has(key)) {
        matchupMap.set(key, {
          playerA: {
            personId: matchup.personIdOff,
            name: matchup.nameIOff,
            teamTricode: matchup.teamTricode,
            jerseyNum: matchup.jerseyNumOff,
            points: matchup.playerPoints || 0,
            fgMade: matchup.matchupFieldGoalsMade || 0,
            fgAttempted: matchup.matchupFieldGoalsAttempted || 0,
            fgPercentage: matchup.matchupFieldGoalsPercentage * 100 || 0,
            assists: matchup.matchupAssists || 0,
            turnovers: matchup.matchupTurnovers || 0,
            blocks: matchup.matchupBlocks || 0,
          },
          playerB: {
            personId: matchup.personIdDef,
            name: matchup.nameIDef,
            teamTricode: '', // Will be filled from reverse matchup
            jerseyNum: matchup.jerseyNumDef,
            points: 0,
            fgMade: 0,
            fgAttempted: 0,
            fgPercentage: 0,
            assists: 0,
            turnovers: 0,
            blocks: 0,
          },
          matchupMinutes: matchup.matchupMinutes,
          matchupMinutesSort: matchup.matchupMinutesSort || 0,
          totalPoints: matchup.playerPoints || 0,
        })
      } else {
        // This is the reverse perspective - update player B stats
        const existing = matchupMap.get(key)
        if (matchup.personIdOff === existing.playerB.personId) {
          existing.playerB.points = matchup.playerPoints || 0
          existing.playerB.fgMade = matchup.matchupFieldGoalsMade || 0
          existing.playerB.fgAttempted = matchup.matchupFieldGoalsAttempted || 0
          existing.playerB.fgPercentage = matchup.matchupFieldGoalsPercentage * 100 || 0
          existing.playerB.assists = matchup.matchupAssists || 0
          existing.playerB.turnovers = matchup.matchupTurnovers || 0
          existing.playerB.blocks = matchup.matchupBlocks || 0
          existing.playerB.teamTricode = matchup.teamTricode
          existing.totalPoints += matchup.playerPoints || 0
        }
      }
    })

    const matchupsArray = Array.from(matchupMap.values())
      .filter(m => m.matchupMinutesSort > 0) // Only include matchups with actual time

    // Sort by criteria
    if (criteria === 'minutes') {
      matchupsArray.sort((a, b) => b.matchupMinutesSort - a.matchupMinutesSort)
    } else if (criteria === 'points') {
      matchupsArray.sort((a, b) => b.totalPoints - a.totalPoints)
    } else if (criteria === 'competitive') {
      // Most competitive = closest in stats
      matchupsArray.sort((a, b) => {
        const aDiff = Math.abs(a.playerA.points - a.playerB.points)
        const bDiff = Math.abs(b.playerA.points - b.playerB.points)
        return aDiff - bDiff
      })
    }

    return matchupsArray.slice(0, limit)
  }

  // Get player data for chart types from AggregatedPlayerStats
  const getChartPlayerData = () => {
    const gameData = uploadedGameData as any
    if (!gameData?.AggregatedPlayerStats) return []

    const players: any[] = []
    Object.entries(gameData.AggregatedPlayerStats).forEach(([personId, stats]: [string, any]) => {
      if (stats.advanced_minutes) {
        const minutesStr = stats.advanced_minutes as string
        const [min, sec] = minutesStr.split(':').map(Number)
        const totalMinutes = min + sec / 60

        // Get team colors
        const rawColor = getTeamPrimaryColor(stats.teamTricode)
        const teamColor = getContrastColor(rawColor)

        players.push({
          personId,
          name: stats.nameI || `${stats.firstName} ${stats.familyName}`,
          fullName: `${stats.firstName} ${stats.familyName}`,
          teamTricode: stats.teamTricode,
          teamName: stats.teamName,
          teamColor,
          minutes: totalMinutes,
          minutesStr,
          // Advanced stats
          offensiveRating: stats.advanced_offensiveRating || 0,
          defensiveRating: stats.advanced_defensiveRating || 0,
          pace: stats.advanced_pace || 0,
          usage: stats.advanced_usagePercentage || 0,
          // Player tracking
          speed: stats.playerTrack_speed || 0,
          distance: stats.playerTrack_distance || 0,
          touches: stats.playerTrack_touches || 0,
          passes: stats.playerTrack_passes || 0,
          // Hustle
          deflections: stats.hustle_deflections || 0,
          chargesDrawn: stats.hustle_chargesDrawn || 0,
          screenAssists: stats.hustle_screenAssists || 0,
          looseBalls: stats.hustle_looseBallsRecoveredTotal || 0,
          boxOuts: stats.hustle_boxOuts || 0,
          contestedShots: stats.hustle_contestedShots || 0,
          // Four Factors
          efg: stats.fourFactors_effectiveFieldGoalPercentage || 0,
          ftaRate: stats.fourFactors_freeThrowAttemptRate || 0,
          tovRate: stats.fourFactors_teamTurnoverPercentage || 0,
          orbRate: stats.fourFactors_offensiveReboundPercentage || 0,
          // Scoring
          points: stats.hustle_points || 0,
          paintPct: stats.scoring_percentagePointsPaint || 0,
          midrangePct: stats.scoring_percentagePointsMidrange2pt || 0,
          threePointPct: stats.scoring_percentagePoints3pt || 0,
          freeThrowPct: stats.scoring_percentagePointsFreeThrow || 0,
          // Rebounding (for charts 6-10)
          offensiveRebounds: stats.rebounding_offensiveRebounds || 0,
          defensiveRebounds: stats.rebounding_defensiveRebounds || 0,
          totalRebounds: stats.rebounding_totalRebounds || 0,
          // Playmaking (for charts 6-10)
          assists: stats.playerTrack_assists ?? 0,
          // Derive turnovers from assist-to-turnover ratio when possible
          turnovers: stats.advanced_assistToTurnover ? (stats.playerTrack_assists ?? 0) / (stats.advanced_assistToTurnover || 1) : 0,
          // Plus/Minus (for charts 6-10)
          plusMinus: stats.advanced_plusMinus || 0,
          // Usage & Efficiency (for charts 6-10) - keep as 0-100 scale for charts
          usageRate: (stats.advanced_usagePercentage || 0) * 100,
          trueShootingPct: (stats.advanced_trueShootingPercentage || 0) * 100,
          // Rebounding rates (percentage based)
          offRebPct: (stats.advanced_offensiveReboundPercentage || 0) * 100,
          defRebPct: (stats.advanced_defensiveReboundPercentage || 0) * 100,
          totalRebPct: (stats.advanced_reboundPercentage || 0) * 100,
          // Net Rating as +/- proxy
          netRating: stats.advanced_netRating || 0,
          // Defensive events
          steals: stats.defensive_steals ?? 0,
          blocks: stats.defensive_blocks ?? 0,
          // Shot zones (for shot profile efficiency)
          paintEFG: stats.scoring_percentagePointsPaint ? (stats.paintPct || 0) / 100 : 0,
          midrangeEFG: stats.scoring_percentagePointsMidrange2pt ? (stats.midrangePct || 0) / 100 : 0,
          threePointEFG: stats.scoring_percentagePoints3pt ? (stats.threePointPct || 0) / 100 : 0,
          // Rim pressure data (estimated from available stats)
          drives: stats.playerTrack_touches ? Math.round(stats.playerTrack_touches * 0.3) : 0, // Estimate
          rimAttempts: stats.scoring_percentagePointsPaint ? Math.round((stats.points || 0) * 0.4) : 0, // Estimate
          rimFTA: stats.defensive_freeThrowAttempts || 0,
          passOuts: stats.playerTrack_assists || 0,
          rimFGM: stats.scoring_percentagePointsPaint ? Math.round((stats.points || 0) * 0.35) : 0,
          rimFGA: stats.scoring_percentagePointsPaint ? Math.round((stats.points || 0) * 0.5) : 0,
          // On-ball creation
          potentialAssists: stats.playerTrack_potentialAssists || stats.playerTrack_assists * 2 || 0,
          paintTouches: stats.playerTrack_touches ? Math.round(stats.playerTrack_touches * 0.2) : 0,
          secondaryAssists: stats.playerTrack_secondaryAssists || 0,
          // Foul drawing
          ftRate: stats.fourFactors_freeThrowAttemptRate || 0,
          ftRatePer36: stats.fourFactors_freeThrowAttemptRate ? (stats.fourFactors_freeThrowAttemptRate * stats.advanced_usagePercentage * 36 / (totalMinutes || 1)) : 0,
          andOneRate: stats.hustle_andOneRate || 0,
          shootingFoulsDrawn: stats.defensive_shootingFoulsDrawn || 0,
          offensiveFoulsDrawn: stats.defensive_offensiveFoulsDrawn || 0,
          totalFoulsDrawn: (stats.defensive_shootingFoulsDrawn || 0) + (stats.defensive_offensiveFoulsDrawn || 0),
          fta: stats.fourFactors_freeThrowAttempts || 0,
          ftm: stats.hustle_freeThrowsMade || 0,
        })
      }
    })

    return players.filter(p => p.minutes > 5) // Only players with >5 minutes
  }

  // Pagination state
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [filterType, setFilterType] = useState<string>('fun_score')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterTeam, setFilterTeam] = useState<string>('all')

  // Get unique teams from all posts for filter dropdown
  const allTeams = useMemo(() => {
    const teams = new Set<string>()
    posts.forEach(post => {
      if (post.team_tricodes && Array.isArray(post.team_tricodes)) {
        post.team_tricodes.forEach(team => teams.add(team))
      }
    })
    return Array.from(teams).sort()
  }, [posts])

  // Filter posts - only show fun_score posts
  const filteredPosts = posts.filter(post => {
    // Only show fun_score posts (already filtered in loadPosts, but double-check)
    if (post.post_type !== 'fun_score') return false
    if (filterStatus !== 'all' && post.status !== filterStatus) return false
    if (filterTeam !== 'all') {
      const teamTricodes = post.team_tricodes || []
      if (!teamTricodes.includes(filterTeam)) return false
    }
    return true
  })

  // Sort posts by game_date (newest first)
  const sortByGameDate = (a: FeedPost, b: FeedPost) => {
    const dateA = a.game_date ? new Date(a.game_date).getTime() : 0
    const dateB = b.game_date ? new Date(b.game_date).getTime() : 0
    
    if (dateB !== dateA) {
      return dateB - dateA
    }
    
    // Fallback to created_at if game_date is same or both null
    const createdA = new Date(a.created_at).getTime()
    const createdB = new Date(b.created_at).getTime()
    return createdB - createdA
  }
  
  // Sort filtered posts
  filteredPosts.sort(sortByGameDate)

  const paginatedPosts = filteredPosts.slice(page * rowsPerPage, (page + 1) * rowsPerPage)

  // Load posts on mount
  useState(() => {
    loadPosts()
  })

  return (
    <>
    <Box 
      sx={{ width: '100%', bgcolor: '#ffffff', minHeight: '100vh', p: 2 }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay for Table View */}
      {isDragging && view === 'table' && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(255, 199, 44, 0.1)',
            backdropFilter: 'blur(4px)',
            border: '3px dashed #FFC72C',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <Typography level="h2" sx={{ color: '#FFC72C', fontWeight: 700 }}>
            Drop JSON file(s) here to create feed posts
          </Typography>
        </Box>
      )}
      {/* Show Table View */}
      {view === 'table' && (
      <>
      {/* Header with Title and Create Button */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2
      }}>
        <Typography level="h3" sx={{ fontWeight: 700, color: '#000' }}>
          Feed Content
        </Typography>
        <Button
          size="md"
          variant="solid"
          startDecorator={<Add />}
          onClick={() => {
            resetForm()
            setView('form')
          }}
          sx={{
            bgcolor: '#6a59ff',
            color: '#000',
            fontWeight: 600,
            '&:hover': { bgcolor: '#5a49ef' }
          }}
        >
          Create Post
        </Button>
      </Box>

      {/* Compact Controls Bar */}
      <Box sx={{ 
        display: 'flex', 
        gap: 1.5, 
        mb: 1.5,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>

        <Select
          size="sm"
          value={filterType}
          onChange={(_, value) => {
            setFilterType(value as string)
            setPage(0)
          }}
          placeholder="Type"
          sx={{ minWidth: 150 }}
        >
          <Option value="fun_score">Fun Score</Option>
        </Select>

        <Select
          size="sm"
          value={filterStatus}
          onChange={(_, value) => {
            setFilterStatus(value as string)
            setPage(0)
          }}
          placeholder="Status"
          sx={{ minWidth: 120 }}
        >
          <Option value="all">All Status</Option>
          <Option value="published">Published</Option>
          <Option value="draft">Draft</Option>
        </Select>

        <Select
          size="sm"
          value={filterTeam}
          onChange={(_, value) => {
            setFilterTeam(value as string)
            setPage(0)
          }}
          placeholder="Team"
          sx={{ minWidth: 120 }}
        >
          <Option value="all">All Teams</Option>
          {allTeams.map(team => (
            <Option key={team} value={team}>{team}</Option>
          ))}
        </Select>

        <Typography level="body-sm" sx={{ ml: 'auto', color: 'rgba(0, 0, 0, 0.7)' }}>
          {filteredPosts.length} posts
        </Typography>
        
        {/* Bulk Actions */}
        {selectedPostIds.size > 0 && (
          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Button
              size="sm"
              variant="outlined"
              color="danger"
              startDecorator={<Delete />}
              onClick={handleBulkDeletePosts}
              disabled={loading}
              sx={{
                borderColor: '#ef4444',
                color: '#ef4444',
                '&:hover': { 
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                  borderColor: '#dc2626'
                }
              }}
            >
              Delete ({selectedPostIds.size})
            </Button>
            <Button
              size="sm"
              variant="solid"
              startDecorator={<Visibility />}
              onClick={handleBulkPublishPosts}
              disabled={loading}
              sx={{
                bgcolor: '#22c55e',
                color: '#000',
                fontWeight: 600,
                '&:hover': { bgcolor: '#16a34a' }
              }}
            >
              Publish ({selectedPostIds.size})
            </Button>
          </Stack>
        )}
      </Box>

      {/* Dense Data Table */}
      <Sheet 
        variant="plain"
        sx={{ 
          borderRadius: '8px',
          overflow: 'hidden',
          bgcolor: 'transparent',
          border: '1px solid rgba(255, 199, 44, 0.2)',
        }}
      >
        <Box sx={{ overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size="sm" />
            </Box>
          ) : filteredPosts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                No posts found
              </Typography>
            </Box>
          ) : (
            <Table 
              size="sm"
              sx={{
                '& thead th': {
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                  color: '#FFC72C',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  py: 0.5,
                  px: 1,
                  whiteSpace: 'nowrap'
                },
                '& tbody td': {
                  py: 0.25,
                  px: 1,
                  fontSize: '0.7rem',
                  color: '#000',
                  height: '40px',
                  maxHeight: '40px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'middle'
                },
                '& tbody tr': {
                  height: '40px',
                  maxHeight: '40px'
                },
                '& tbody tr:hover': {
                  bgcolor: 'rgba(255, 199, 44, 0.05)',
                  cursor: 'pointer',
                }
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <Checkbox
                      checked={paginatedPosts.length > 0 && paginatedPosts.every(p => selectedPostIds.has(p.id))}
                      indeterminate={paginatedPosts.some(p => selectedPostIds.has(p.id)) && !paginatedPosts.every(p => selectedPostIds.has(p.id))}
                      onChange={handleSelectAllPosts}
                      sx={{ color: '#FFC72C' }}
                      size="sm"
                    />
                  </th>
                  <th style={{ width: '40px' }}>Img</th>
                  <th style={{ width: '18%' }}>Title</th>
                  <th style={{ width: '10%' }}>Game ID</th>
                  <th style={{ width: '8%' }}>Type</th>
                  <th style={{ width: '8%' }}>Teams</th>
                  <th style={{ width: '7%' }}>Status</th>
                  <th style={{ width: '5%' }}>Slides</th>
                  <th style={{ width: '8%' }}>Engagement</th>
                  <th style={{ width: '6%' }}>Views</th>
                  <th style={{ width: '8%' }}>Date</th>
                  <th style={{ width: '10%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPosts.map((post) => {
                  const funScore = post.metadata?.fun_score || post.metadata?.funScore
                  const teamTricodes = post.team_tricodes || []
                  
                  return (
                    <tr 
                      key={post.id}
                    >
                      <td>
                        <Checkbox
                          checked={selectedPostIds.has(post.id)}
                          onChange={() => handleTogglePostSelection(post.id)}
                          sx={{ color: '#FFC72C' }}
                          size="sm"
                        />
                      </td>
                      <td>
                        {post.thumbnail_url ? (
                          <Box
                            component="img"
                            src={post.thumbnail_url}
                            alt={post.title || 'Post thumbnail'}
                            sx={{
                              width: 32,
                              height: 32,
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid rgba(255, 199, 44, 0.2)'
                            }}
                            onError={(e) => {
                              // Hide image if it fails to load
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '4px',
                              bgcolor: 'rgba(255, 199, 44, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(255, 199, 44, 0.2)'
                            }}
                          >
                            <ImageIcon sx={{ fontSize: 16, color: 'rgba(255, 199, 44, 0.5)' }} />
                          </Box>
                        )}
                      </td>
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography 
                            level="body-xs" 
                            sx={{ 
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '200px',
                              cursor: post.game_id ? 'pointer' : 'default',
                              color: post.game_id ? '#6a59ff' : '#000',
                              '&:hover': post.game_id ? { textDecoration: 'underline' } : {}
                            }}
                            onClick={(e) => {
                              if (post.game_id) {
                                e.stopPropagation()
                                navigate(`/game/${post.game_id}`)
                              }
                            }}
                          >
                            {post.title || post.game_id || 'Untitled'}
                          </Typography>
                          {post.game_id && (
                            <IconButton
                              size="sm"
                              variant="plain"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/game/${post.game_id}`)
                              }}
                              sx={{ p: 0.25, minWidth: 'auto', width: '16px', height: '16px' }}
                              title="View Game Page"
                            >
                              <OpenInNew sx={{ fontSize: '0.7rem', color: '#6a59ff' }} />
                            </IconButton>
                          )}
                        </Box>
                    </td>
                    <td>
                      {post.game_id ? (
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: '#6a59ff',
                            fontWeight: 500,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            '&:hover': {
                              color: '#5a49ef',
                              textDecoration: 'underline'
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/game/${post.game_id}`)
                          }}
                        >
                          {post.game_id}
                        </Typography>
                      ) : (
                        <Typography level="body-xs" sx={{ color: 'rgba(0, 0, 0, 0.4)' }}>
                          -
                        </Typography>
                      )}
                    </td>
                    <td>
                      <Typography level="body-xs" sx={{ color: '#FFC72C', fontWeight: 500 }}>
                        {post.post_type.replace('_', ' ')}
                      </Typography>
                    </td>
                    <td>
                      {teamTricodes.length > 0 ? (
                        <Typography level="body-xs" sx={{ color: 'rgba(0, 0, 0, 0.7)' }}>
                          {teamTricodes.slice(0, 2).join(', ')}{teamTricodes.length > 2 ? '...' : ''}
                        </Typography>
                      ) : (
                        <Typography level="body-xs" sx={{ color: 'rgba(0, 0, 0, 0.4)' }}>
                          -
                        </Typography>
                      )}
                    </td>
                    <td>
                      <Typography 
                        level="body-xs" 
                        sx={{ 
                          color: post.status === 'published' ? '#22c55e' : 'rgba(0, 0, 0, 0.7)',
                          fontWeight: post.status === 'published' ? 600 : 400
                        }}
                      >
                        {post.status}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-xs" sx={{ color: '#000' }}>
                        {post.slides?.length || 0}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-xs" sx={{ color: 'rgba(0, 0, 0, 0.7)' }}>
                        ❤️{post.likes_count || 0} 💬{post.comments_count || 0}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-xs" sx={{ color: '#000' }}>
                        {post.views_count || 0}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-xs" sx={{ color: 'rgba(0, 0, 0, 0.6)' }}>
                        {post.game_date ? new Date(post.game_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        }) : '-'}
                      </Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={0.25}>
                        {post.game_id && (
                          <IconButton
                            size="sm"
                            variant="plain"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/game/${post.game_id}`)
                            }}
                            sx={{ p: 0.5 }}
                            title="View Game Page"
                          >
                            <OpenInNew sx={{ fontSize: '0.9rem' }} />
                          </IconButton>
                        )}
                        <IconButton
                          size="sm"
                          variant="plain"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePostToReddit(post)
                          }}
                          sx={{ p: 0.5, color: '#FF4500' }}
                          title="Post to Reddit"
                        >
                          <Reddit sx={{ fontSize: '0.9rem' }} />
                        </IconButton>
                        <IconButton
                          size="sm"
                          variant="plain"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePostToFacebook(post)
                          }}
                          sx={{ p: 0.5, color: '#1877F2' }}
                          title="Post to Facebook"
                        >
                          <Facebook sx={{ fontSize: '0.9rem' }} />
                        </IconButton>
                        <IconButton
                          size="sm"
                          variant="plain"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditPost(post)
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <Edit sx={{ fontSize: '0.9rem' }} />
                        </IconButton>
                        <IconButton
                          size="sm"
                          variant="plain"
                          color="danger"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePost(post.id)
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <Delete sx={{ fontSize: '0.9rem' }} />
                        </IconButton>
                      </Stack>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Box>

        {/* Pagination */}
        {filteredPosts.length > rowsPerPage && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 1.5,
            borderTop: '1px solid rgba(255, 199, 44, 0.2)',
          }}>
            <Typography level="body-sm" sx={{ color: 'rgba(0, 0, 0, 0.7)' }}>
              Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, filteredPosts.length)} of {filteredPosts.length}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="sm"
                variant="soft"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                sx={{
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                  color: '#FFC72C',
                  '&:hover': {
                    bgcolor: 'rgba(255, 199, 44, 0.2)',
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  }
                }}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="soft"
                disabled={(page + 1) * rowsPerPage >= filteredPosts.length}
                onClick={() => setPage(page + 1)}
                sx={{
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                  color: '#FFC72C',
                  '&:hover': {
                    bgcolor: 'rgba(255, 199, 44, 0.2)',
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  }
                }}
              >
                Next
              </Button>
            </Stack>
          </Box>
        )}
      </Sheet>
      </>
      )}

      {/* Show Detection View */}
      {view === 'detection' && (
        <Box sx={{ width: '100%' }}>
          <Stack spacing={2}>
            {/* Header */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 2
            }}>
              <Box>
                <Typography level="h3" sx={{ color: '#FFC72C', fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                  <AutoAwesome sx={{ mr: 1 }} />
                  Algorithmic Feed Post Builder
                </Typography>
                <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  {uploadedGames.length > 0 
                    ? `${uploadedGames.length} game(s) processed`
                    : uploadedGameData?.gameId 
                      ? `Game: ${uploadedGameData.gameId}${uploadedGameData?.story?.matchup ? ` • ${uploadedGameData.story.matchup}` : ''}`
                      : 'No games loaded'}
                </Typography>
              </Box>
              <Button
                size="sm"
                variant="plain"
                onClick={() => {
                  setView('table')
                  setUploadedGames([])
                }}
                sx={{ color: '#000' }}
              >
                ← Back to Posts
              </Button>
            </Box>

            {/* Multi-file mode */}
            {uploadedGames.length > 0 ? (
              <>
                {/* Selection Summary */}
                {(() => {
                  const totalPosts = uploadedGames.reduce((sum, game) => sum + game.detectedPosts.length, 0)
                  const selectedPosts = uploadedGames.reduce((sum, game) => sum + game.detectedPosts.filter(p => p.selected).length, 0)
                  return (
                    <Box sx={{ 
                      bgcolor: 'rgba(255, 199, 44, 0.1)', 
                      borderRadius: '8px',
                      p: 1.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                        {selectedPosts} of {totalPosts} posts selected across {uploadedGames.length} game(s)
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="sm"
                          variant="outlined"
                          onClick={handleSelectAllMulti}
                          sx={{
                            borderColor: '#FFC72C',
                            color: '#FFC72C',
                            '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                          }}
                        >
                          {uploadedGames.every(game => game.detectedPosts.every(p => p.selected)) ? 'Deselect All' : 'Select All'}
                        </Button>
                        <Button
                          size="sm"
                          variant="solid"
                          onClick={handleBulkCreatePostsMulti}
                          disabled={selectedPosts === 0 || loading}
                          sx={{
                            bgcolor: '#6a59ff',
                            color: '#000',
                            fontWeight: 600,
                            '&:hover': { bgcolor: '#5a49ef' },
                            '&:disabled': {
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                              color: 'rgba(255, 255, 255, 0.3)'
                            }
                          }}
                        >
                          {loading ? <CircularProgress size="sm" /> : `Create ${selectedPosts} Post(s)`}
                        </Button>
                      </Stack>
                    </Box>
                  )
                })()}

                {/* Games grouped by game */}
                <Stack spacing={2}>
                  {uploadedGames.map((game, gameIndex) => {
                    const gameSelectedCount = game.detectedPosts.filter(p => p.selected).length
                    return (
                      <Box key={gameIndex} sx={{ 
                        border: '1px solid rgba(255, 199, 44, 0.2)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        bgcolor: 'rgba(0, 0, 0, 0.3)'
                      }}>
                        {/* Game Header */}
                        <Box sx={{
                          bgcolor: 'rgba(255, 199, 44, 0.1)',
                          p: 1.5,
                          borderBottom: '1px solid rgba(255, 199, 44, 0.2)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <Box>
                            <Typography level="title-md" sx={{ color: '#FFC72C', fontWeight: 700 }}>
                              {game.gameId}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                              {game.matchup}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography level="body-sm" sx={{ color: '#FFC72C' }}>
                              {gameSelectedCount} of {game.detectedPosts.length} selected
                            </Typography>
                            {game.existingPostsCount > 0 && (
                              <Chip size="sm" variant="soft" sx={{ bgcolor: 'rgba(106, 89, 255, 0.1)', color: '#000' }}>
                                {game.existingPostsCount} existing
                              </Chip>
                            )}
                          </Stack>
                        </Box>

                        {/* Posts for this game */}
                        {game.detectedPosts.length === 0 ? (
                          <Box sx={{ p: 2, textAlign: 'center' }}>
                            <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                              No posts detected for this game
                            </Typography>
                          </Box>
                        ) : (
                          <Sheet variant="plain" sx={{ bgcolor: 'transparent', borderRadius: 0 }}>
                            <Table sx={{
                              '& thead th': {
                                bgcolor: 'rgba(255, 199, 44, 0.05)',
                                color: '#FFC72C',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                py: 1,
                                px: 2
                              },
                              '& tbody td': {
                                py: 1,
                                px: 2,
                                fontSize: '0.875rem',
                                color: '#000',
                              },
                              '& tbody tr:hover': {
                                bgcolor: 'rgba(255, 199, 44, 0.05)',
                              }
                            }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '50px' }}>
                                    <Checkbox
                                      checked={game.detectedPosts.length > 0 && game.detectedPosts.every(p => p.selected)}
                                      indeterminate={game.detectedPosts.some(p => p.selected) && !game.detectedPosts.every(p => p.selected)}
                                      onChange={() => {
                                        const allSelected = game.detectedPosts.every(p => p.selected)
                                        setUploadedGames(prev => 
                                          prev.map((g, idx) => 
                                            idx === gameIndex 
                                              ? {
                                                  ...g,
                                                  detectedPosts: g.detectedPosts.map(p => ({ ...p, selected: !allSelected }))
                                                }
                                              : g
                                          )
                                        )
                                      }}
                                      sx={{ color: '#FFC72C' }}
                                    />
                                  </th>
                                  <th style={{ width: '15%' }}>Type</th>
                                  <th style={{ width: '25%' }}>Title</th>
                                  <th style={{ width: '10%' }}>Slides</th>
                                  <th style={{ width: '8%' }}>Props</th>
                                  <th style={{ width: '42%' }}>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {game.detectedPosts.map((post) => (
                                  <tr key={post.id}>
                                    <td>
                                      <Checkbox
                                        checked={post.selected}
                                        onChange={() => handleToggleSelectionMulti(gameIndex, post.id)}
                                        sx={{ color: '#FFC72C' }}
                                      />
                                    </td>
                                    <td>
                                      <Chip 
                                        size="sm" 
                                        variant="soft" 
                                        sx={{ 
                                          bgcolor: post.postType === 'fun_score' 
                                            ? 'rgba(255, 199, 44, 0.2)' 
                                            : 'rgba(59, 130, 246, 0.2)',
                                          color: post.postType === 'fun_score' ? '#FFC72C' : '#3b82f6'
                                        }}
                                      >
                                        {post.postType === 'fun_score' ? 'Fun Score' : 'Player Highlight'}
                                      </Chip>
                                    </td>
                                    <td>
                                      <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                        {post.title}
                                      </Typography>
                                    </td>
                                    <td>
                                      <Typography level="body-sm" sx={{ color: '#000' }}>
                                        {post.slideCount}
                                      </Typography>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {post.postType === 'player_highlight' && post.metadata.personId && (
                                        <PlayerPropsCheck 
                                          personId={post.metadata.personId} 
                                          gameId={game.gameId}
                                          gameDate={game.gameData.gameMetadata?.date}
                                        />
                                      )}
                                    </td>
                                    <td>
                                      {post.postType === 'fun_score' && post.metadata.funScore && (
                                        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                          Fun Score: {post.metadata.funScore}
                                        </Typography>
                                      )}
                                      {post.postType === 'player_highlight' && (
                                        <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                          {post.metadata.playerNameI || post.metadata.playerName}
                                        </Typography>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </Sheet>
                        )}
                      </Box>
                    )
                  })}
                </Stack>
              </>
            ) : (
              /* Single-file mode (existing logic) */
              <>
                {/* Detection Results */}
                {detectedPosts.length === 0 ? (
                  <Alert color="warning" sx={{ bgcolor: 'rgba(255, 199, 44, 0.1)', borderColor: '#FFC72C' }}>
                    No posts detected. Make sure the JSON file includes playByPlay data.
                  </Alert>
                ) : (
              <>
                {/* Selection Summary */}
                <Box sx={{ 
                  bgcolor: 'rgba(255, 199, 44, 0.1)', 
                  borderRadius: '8px',
                  p: 1.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                    {detectedPosts.filter(p => p.selected).length} of {detectedPosts.length} posts selected
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="sm"
                      variant="outlined"
                      onClick={handleSelectAll}
                      sx={{
                        borderColor: '#FFC72C',
                        color: '#FFC72C',
                        '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                      }}
                    >
                      {detectedPosts.every(p => p.selected) ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button
                      size="sm"
                      variant="solid"
                      onClick={handleBulkCreatePosts}
                      disabled={detectedPosts.filter(p => p.selected).length === 0 || loading}
                      sx={{
                        bgcolor: '#6a59ff',
                        color: '#000',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#5a49ef' },
                        '&:disabled': {
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          color: 'rgba(255, 255, 255, 0.3)'
                        }
                      }}
                    >
                      {loading ? <CircularProgress size="sm" /> : `Create ${detectedPosts.filter(p => p.selected).length} Post(s)`}
                    </Button>
                  </Stack>
                </Box>

                {/* Detected Posts Table */}
                <Sheet 
                  variant="plain"
                  sx={{ 
                    borderRadius: '8px',
                    overflow: 'hidden',
                    bgcolor: 'transparent',
                    border: '1px solid rgba(255, 199, 44, 0.2)',
                  }}
                >
                  <Table 
                    sx={{
                      '& thead th': {
                        bgcolor: 'rgba(255, 199, 44, 0.1)',
                        color: '#FFC72C',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        py: 1.5,
                        px: 2
                      },
                      '& tbody td': {
                        py: 1.5,
                        px: 2,
                        fontSize: '0.875rem',
                        color: '#000',
                      },
                      '& tbody tr:hover': {
                        bgcolor: 'rgba(255, 199, 44, 0.05)',
                      }
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>
                          <Checkbox
                            checked={detectedPosts.length > 0 && detectedPosts.every(p => p.selected)}
                            indeterminate={detectedPosts.some(p => p.selected) && !detectedPosts.every(p => p.selected)}
                            onChange={handleSelectAll}
                            sx={{ color: '#FFC72C' }}
                          />
                        </th>
                        <th style={{ width: '15%' }}>Post Type</th>
                        <th style={{ width: '20%' }}>Title</th>
                        <th style={{ width: '10%' }}>Number of Slides</th>
                        <th style={{ width: '8%' }}>Props</th>
                        {/* <th style={{ width: '8%' }}>Number of Actions</th> */}
                        {/* <th style={{ width: '10%' }}>Duplicates Skipped</th> */}
                        {/* <th style={{ width: '12%' }}>Fantasy Points</th> */}
                        <th style={{ width: '27%' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detectedPosts.map((post) => (
                        <tr key={post.id}>
                          <td>
                            <Checkbox
                              checked={post.selected}
                              onChange={() => handleToggleSelection(post.id)}
                              sx={{ color: '#FFC72C' }}
                            />
                          </td>
                          <td>
                            <Chip 
                              size="sm" 
                              variant="soft" 
                              sx={{ 
                                bgcolor: post.postType === 'fun_score' 
                                  ? 'rgba(255, 199, 44, 0.2)' 
                                  : 'rgba(59, 130, 246, 0.2)',
                                color: post.postType === 'fun_score' ? '#FFC72C' : '#3b82f6'
                              }}
                            >
                              {post.postType === 'fun_score' ? 'Fun Score' : 'Player Highlight'}
                            </Chip>
                          </td>
                          <td>
                            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                              {post.title}
                            </Typography>
                          </td>
                          <td>
                            <Typography level="body-sm" sx={{ color: '#000' }}>
                              {post.slideCount}
                            </Typography>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {post.postType === 'player_highlight' && post.metadata.personId && uploadedGameData && (
                              <PlayerPropsCheck 
                                personId={post.metadata.personId} 
                                gameId={uploadedGameData.gameId}
                                gameDate={uploadedGameData.gameMetadata?.date}
                              />
                            )}
                          </td>
                          {/* <td>
                            {post.postType === 'player_highlight' ? (
                              <Typography level="body-sm" sx={{ color: '#000' }}>
                                {post.metadata.actionCount || 0}
                              </Typography>
                            ) : (
                              <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                -
                              </Typography>
                            )}
                          </td> */}
                          {/* <td>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                color: post.metadata.duplicatesSkipped > 0 ? '#FFC72C' : 'rgba(255, 255, 255, 0.7)',
                                fontWeight: post.metadata.duplicatesSkipped > 0 ? 600 : 400
                              }}
                            >
                              {post.metadata.duplicatesSkipped || 0}
                            </Typography>
                          </td> */}
                          {/* <td>
                            <Typography 
                              level="body-sm" 
                              sx={{ 
                                color: '#FFC72C', 
                                fontWeight: 600,
                                fontFamily: 'monospace'
                              }}
                            >
                              {post.fantasyPoints.toFixed(1)} FP
                            </Typography>
                            <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                              FanDuel
                            </Typography>
                          </td> */}
                          <td>
                            {post.postType === 'fun_score' && (
                              <Stack spacing={0.5}>
                                <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                  Fun Score: {post.metadata.funScore}
                                </Typography>
                                {post.metadata.milestones && post.metadata.milestones.length > 0 && (
                                  <Stack spacing={0.25}>
                                    {post.metadata.milestones.map((milestone: any, idx: number) => (
                                      <Chip
                                        key={idx}
                                        size="sm"
                                        variant="soft"
                                        sx={{
                                          bgcolor: 'rgba(255, 199, 44, 0.2)',
                                          color: '#FFC72C',
                                          fontSize: '0.7rem',
                                          height: '20px',
                                          py: 0.25
                                        }}
                                      >
                                        {milestone.milestone === 'Triple Double' 
                                          ? `${milestone.playerName} Triple Double`
                                          : `${milestone.playerName} ${milestone.points}pt`}
                                      </Chip>
                                    ))}
                                  </Stack>
                                )}
                                {post.metadata.storyAdvantages && post.metadata.storyAdvantages.length > 0 && (
                                  <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                                    <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                                      Story Advantages:
                                    </Typography>
                                    {post.metadata.storyAdvantages.map((advantage: any, idx: number) => (
                                      <Typography 
                                        key={idx}
                                        level="body-xs" 
                                        sx={{ 
                                          color: 'rgba(255, 255, 255, 0.7)',
                                          fontSize: '0.7rem',
                                          pl: 1
                                        }}
                                      >
                                        • {advantage.stat_name}
                                      </Typography>
                                    ))}
                                  </Stack>
                                )}
                              </Stack>
                            )}
                            {post.postType === 'player_highlight' && (
                              <Stack spacing={0.5}>
                                {post.metadata.hasTop5FantasyChart !== undefined && (
                                  <Stack spacing={0.25}>
                                    <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                                      Charts:
                                    </Typography>
                                    {post.metadata.hasTop5FantasyChart && (
                                      <Chip
                                        size="sm"
                                        variant="soft"
                                        sx={{
                                          bgcolor: 'rgba(59, 130, 246, 0.2)',
                                          color: '#3b82f6',
                                          fontSize: '0.7rem',
                                          height: '20px',
                                          py: 0.25,
                                          width: 'fit-content'
                                        }}
                                      >
                                        Top 5 Fantasy Points
                                      </Chip>
                                    )}
                                    {post.metadata.selectedCharts && post.metadata.selectedCharts.length > 0 && (
                                      <Stack spacing={0.5}>
                                        {post.metadata.selectedCharts.map((chart: any, idx: number) => {
                                          const chartLabels: Record<string, string> = {
                                            usage: 'Usage',
                                            playertrack: 'Player Movement',
                                            hustle: 'Hustle',
                                            fourfactors: 'Four Factors',
                                            advanced: 'Advanced',
                                            playmaking: 'Playmaking',
                                            defensive: 'Defensive Impact',
                                            scoring: 'Scoring Breakdown',
                                            relative: 'Top of Game',
                                            'team-context': 'Vs Teammates',
                                            'triple-double-watch': 'Triple-Double Watch',
                                            'perfect-efficiency': 'Perfect Efficiency',
                                            'high-assist-rate': 'High Assist Rate',
                                            'complementary': 'Strengths & Weaknesses'
                                          }
                                          const chartName = chartLabels[chart.category || ''] || chart.category || 'Chart'
                                          return (
                                            <Stack key={idx} spacing={0.25}>
                                              <Chip
                                                size="sm"
                                                variant="soft"
                                                sx={{
                                                  bgcolor: 'rgba(255, 199, 44, 0.2)',
                                                  color: '#FFC72C',
                                                  fontSize: '0.7rem',
                                                  height: '20px',
                                                  py: 0.25,
                                                  width: 'fit-content'
                                                }}
                                              >
                                                {chartName} (Score: {chart.score})
                                              </Chip>
                                              <Typography 
                                                level="body-xs" 
                                                sx={{ 
                                                  color: 'rgba(255, 255, 255, 0.6)', 
                                                  fontSize: '0.65rem', 
                                                  pl: 1,
                                                  fontStyle: 'italic'
                                                }}
                                              >
                                                {chart.reason}
                                              </Typography>
                                            </Stack>
                                          )
                                        })}
                                      </Stack>
                                    )}
                                    {!post.metadata.hasTop5FantasyChart && 
                                     (!post.metadata.selectedCharts || post.metadata.selectedCharts.length === 0) && (
                                      <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.7rem', pl: 1 }}>
                                        No relevant charts for this game
                                      </Typography>
                                    )}
                                  </Stack>
                                )}
                              </Stack>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Sheet>
              </>
                )}
              </>
            )}
          </Stack>
        </Box>
      )}

      {/* Show Form View */}
      {view === 'form' && (
        <Box
          sx={{ 
            width: '100%',
            bgcolor: 'rgba(0, 0, 0, 0.95)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag Overlay */}
          {isDragging && !uploadedGameData && uploadedGames.length === 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(255, 199, 44, 0.1)',
                backdropFilter: 'blur(4px)',
                border: '3px dashed #FFC72C',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                pointerEvents: 'none'
              }}
            >
              <Stack alignItems="center" spacing={2}>
                <Upload sx={{ fontSize: 80, color: '#FFC72C' }} />
                <Typography level="h2" sx={{ color: '#FFC72C', fontWeight: 700 }}>
                  Drop JSON file(s) to load
                </Typography>
                <Typography level="body-lg" sx={{ color: '#000' }}>
                  Drop one or multiple JSON files to algorithmically build posts
                </Typography>
              </Stack>
            </Box>
          )}
          
          {/* Dynamic Tab Navigation */}
          <Box sx={{ 
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            px: 2,
            pt: 2,
            pb: 0,
            overflowX: 'auto',
            display: 'flex',
            gap: 0.5
          }}>
            {/* Details Tab */}
            <Button
              size="sm"
              variant={activeStep === 0 ? 'solid' : 'plain'}
              onClick={() => setActiveStep(0)}
              sx={{
                bgcolor: activeStep === 0 ? '#FFC72C' : 'transparent',
                color: activeStep === 0 ? '#000' : '#000',
                fontWeight: 600,
                px: 2,
                py: 0.75,
                borderRadius: '8px 8px 0 0',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: activeStep === 0 ? '#FFD700' : 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              1. Details
            </Button>

            {/* Build Slides Tab */}
            <Button
              size="sm"
              variant={activeStep === 1 ? 'solid' : 'plain'}
              onClick={() => setActiveStep(1)}
              disabled={!postForm.title}
              sx={{
                bgcolor: activeStep === 1 ? '#FFC72C' : 'transparent',
                color: activeStep === 1 ? '#000' : '#000',
                fontWeight: 600,
                px: 2,
                py: 0.75,
                borderRadius: '8px 8px 0 0',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: activeStep === 1 ? '#FFD700' : 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              2. Add Slides
            </Button>

            {/* Individual Slide Tabs */}
            {postForm.slides.map((slide, index) => (
              <Button
                key={index}
                size="sm"
                variant={activeStep === index + 2 ? 'solid' : 'plain'}
                onClick={() => setActiveStep(index + 2)}
                sx={{
                  bgcolor: activeStep === index + 2 ? '#FFC72C' : 'transparent',
                  color: activeStep === index + 2 ? '#000' : '#000',
                  fontWeight: 600,
                  px: 2,
                  py: 0.75,
                  borderRadius: '8px 8px 0 0',
                  flexShrink: 0,
                  '&:hover': {
                    bgcolor: activeStep === index + 2 ? '#FFD700' : 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                {index + 1}
              </Button>
            ))}
          </Box>

          {/* Step 1: Post Details */}
          {activeStep === 0 && (
            <Box sx={{ p: 2 }}>
              {/* JSON Status - Inline */}
              {uploadedGameData && (
                <Box sx={{ 
                  bgcolor: 'rgba(34, 197, 94, 0.2)', 
                  borderRadius: '8px',
                  p: 1.5,
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2
                }}>
                  <Stack spacing={0.25} flex={1}>
                    <Typography level="body-sm" sx={{ color: '#22c55e', fontWeight: 700 }}>
                      ✅ {uploadedGameData.gameId} • {uploadedGameData.script?.video_script?.length || 0} clips • Fun Score: {uploadedGameData.score?.[Object.keys(uploadedGameData.score || {})[0]]?.fun_score || 'N/A'}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: '#000', opacity: 0.9 }}>
                      {uploadedGameData.story?.matchup || ''}
                    </Typography>
                  </Stack>
                  <Button
                    size="sm"
                    variant="solid"
                    startDecorator={<EmojiEvents />}
                    onClick={() => setShowFunScoreModal(true)}
                    sx={{
                      bgcolor: '#6a59ff',
                      color: '#000',
                      fontWeight: 600,
                      '&:hover': { bgcolor: '#5a49ef' }
                    }}
                  >
                    Fun Score
                  </Button>
                </Box>
              )}

              {/* Post Details Form - Compact Grid */}
              <Grid container spacing={1.5}>
                <Grid xs={12} sm={4}>
                  <FormControl size="sm">
                    <FormLabel sx={{ color: '#000', fontWeight: 600, fontSize: '0.75rem', mb: 0.5 }}>Post Type</FormLabel>
                    <Select
                      size="sm"
                      value={postForm.post_type}
                      onChange={(_, value) => setPostForm(prev => ({ ...prev, post_type: value as string }))}
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        color: '#000',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                      }}
                    >
                      <Option value="game_highlight">Game Highlight</Option>
                      <Option value="fun_score">Fun Score</Option>
                      <Option value="buzzer_beater">Buzzer Beater</Option>
                      <Option value="player_spotlight">Player Spotlight</Option>
                      <Option value="rookie_watch">Rookie Watch</Option>
                      <Option value="team_performance">Team Performance</Option>
                      <Option value="stat_showcase">Stat Showcase</Option>
                      <Option value="milestone">Milestone</Option>
                      <Option value="custom">Custom</Option>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={12} sm={4}>
                  <FormControl size="sm">
                    <FormLabel sx={{ color: '#000', fontWeight: 600, fontSize: '0.75rem', mb: 0.5 }}>Game ID</FormLabel>
                    <Input
                      size="sm"
                      value={postForm.game_id}
                      onChange={(e) => setPostForm(prev => ({ ...prev, game_id: e.target.value }))}
                      placeholder="0022400123"
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        color: '#000',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                      }}
                    />
                  </FormControl>
                </Grid>
                <Grid xs={12} sm={4}>
                  <FormControl size="sm">
                    <FormLabel sx={{ color: '#000', fontWeight: 600, fontSize: '0.75rem', mb: 0.5 }}>Title</FormLabel>
                    <Input
                      size="sm"
                      value={postForm.title}
                      onChange={(e) => setPostForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Post title..."
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        color: '#000',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                      }}
                    />
                  </FormControl>
                </Grid>
                <Grid xs={12}>
                  <FormControl size="sm">
                    <FormLabel sx={{ color: '#000', fontWeight: 600, fontSize: '0.75rem', mb: 0.5 }}>Description</FormLabel>
                    <Textarea
                      size="sm"
                      value={postForm.description}
                      onChange={(e) => setPostForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description..."
                      minRows={2}
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        color: '#000',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                      }}
                    />
                  </FormControl>
                </Grid>
              </Grid>

              {/* Step 1 Navigation */}
              <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ mt: 2 }}>
                <Button 
                  size="sm"
                  variant="plain" 
                  onClick={() => {
                    if (confirm('Cancel and close?')) {
                      if (onClose) {
                        onClose()
                      } else {
                        setView('table')
                        resetAll()
                      }
                    }
                  }}
                  sx={{ color: '#000' }}
                >
                  ← Back to Posts
                </Button>
                <Button 
                  size="sm"
                  variant="solid" 
                  onClick={() => setActiveStep(1)}
                  disabled={!postForm.title}
                  sx={{
                    bgcolor: '#6a59ff',
                    color: '#000',
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#5a49ef' }
                  }}
                >
                  Next: Build Slides →
                </Button>
              </Stack>
            </Box>
          )}

          {/* Step 2: Build Slides */}
          {activeStep === 1 && (
            <Box sx={{ p: 2 }}>
                {uploadedGameData && (
                  <>
                    {/* Quick Add Slides - Categorical Chart Picker */}
                    <Box sx={{ 
                      bgcolor: 'rgba(255, 199, 44, 0.1)', 
                      border: '1px solid rgba(255, 199, 44, 0.3)',
                      borderRadius: '8px',
                      p: 2,
                      mb: 2
                    }}>
                      <Typography level="title-sm" sx={{ color: '#FFC72C', fontWeight: 700, mb: 1.5 }}>
                        📊 Data Visualizations
                      </Typography>
                      
                      <Stack spacing={1}>
                        {/* CATEGORY: Game Story */}
                        {uploadedGameData?.story?.advantages && uploadedGameData.story.advantages.length > 0 && (
                          <Box>
                            <Button
                              size="sm"
                              variant="plain"
                              fullWidth
                              onClick={() => setExpandedChartCategory(expandedChartCategory === 'story' ? null : 'story')}
                              sx={{
                                justifyContent: 'space-between',
                                color: '#FFC72C',
                                fontWeight: 600,
                                bgcolor: expandedChartCategory === 'story' ? 'rgba(255, 199, 44, 0.1)' : 'transparent',
                                '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.15)' }
                              }}
                            >
                              📖 Game Story ({uploadedGameData.story.advantages.length})
                              <Typography sx={{ color: '#000' }}>{expandedChartCategory === 'story' ? '▼' : '▶'}</Typography>
                            </Button>
                            {expandedChartCategory === 'story' && (
                              <Box sx={{ pl: 2, pt: 1 }}>
                                <Grid container spacing={0.5}>
                                  {uploadedGameData.story.advantages.map((advantage: any, index: number) => (
                                    <Grid xs={12} sm={6} key={index}>
                                      <Button
                                        size="sm"
                                        variant="outlined"
                                        fullWidth
                                        onClick={() => handleAddSlide('story_comparison', index)}
                                        sx={{
                                          borderColor: 'rgba(255, 199, 44, 0.3)',
                                          color: '#000',
                                          justifyContent: 'flex-start',
                                          fontSize: '0.75rem',
                                          '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                        }}
                                      >
                                        📊 {advantage.stat_name}
                                      </Button>
                                    </Grid>
                                  ))}
                                </Grid>
                              </Box>
                            )}
                          </Box>
                        )}

                        {/* CATEGORY: Player Analysis */}
                        {getChartPlayerData().length > 0 && (
                          <Box>
                            <Button
                              size="sm"
                              variant="plain"
                              fullWidth
                              onClick={() => setExpandedChartCategory(expandedChartCategory === 'player' ? null : 'player')}
                              sx={{
                                justifyContent: 'space-between',
                                color: '#FFC72C',
                                fontWeight: 600,
                                bgcolor: expandedChartCategory === 'player' ? 'rgba(255, 199, 44, 0.1)' : 'transparent',
                                '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.15)' }
                              }}
                            >
                              👤 Individual Players ({getChartPlayerData().length})
                              <Typography sx={{ color: '#000' }}>{expandedChartCategory === 'player' ? '▼' : '▶'}</Typography>
                            </Button>
                            {expandedChartCategory === 'player' && (
                              <Box sx={{ pl: 2, pt: 1 }}>
                                <Grid container spacing={0.5}>
                                  {getChartPlayerData().slice(0, 8).map((player: any, index: number) => (
                                    <Grid xs={12} sm={6} key={index}>
                                      <Select
                                        size="sm"
                                        placeholder={`${player.name} (${player.teamTricode})`}
                                        onChange={(_, value) => {
                                          if (value) handleAddSlide(value as string, index)
                                        }}
                                        sx={{
                                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                                          color: '#000',
                                          fontSize: '0.75rem',
                                          '& .MuiSelect-button': { color: '#000' }
                                        }}
                                      >
                                        <Option value="hustle_radar">💪 Hustle Stats</Option>
                                        <Option value="shot_distribution">🎯 Shot Distribution</Option>
                                        <Option value="shot_profile_efficiency">📊 Shot Profile Efficiency</Option>
                                        <Option value="rim_pressure">🏀 Rim Pressure</Option>
                                        <Option value="on_ball_creation">⚡ On-Ball Creation</Option>
                                        <Option value="defensive_events">🛡️ Defensive Events Map</Option>
                                        <Option value="foul_drawing">🎯 Foul Drawing Profile</Option>
                                      </Select>
                                    </Grid>
                                  ))}
                                </Grid>
                              </Box>
                            )}
                          </Box>
                        )}

                        {/* CATEGORY: Team Comparison */}
                        <Box>
                          <Button
                            size="sm"
                            variant="plain"
                            fullWidth
                            onClick={() => setExpandedChartCategory(expandedChartCategory === 'team' ? null : 'team')}
                            sx={{
                              justifyContent: 'space-between',
                              color: '#FFC72C',
                              fontWeight: 600,
                              bgcolor: expandedChartCategory === 'team' ? 'rgba(255, 199, 44, 0.1)' : 'transparent',
                              '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.15)' }
                            }}
                          >
                            🏆 Team Analysis
                            <Typography sx={{ color: '#000' }}>{expandedChartCategory === 'team' ? '▼' : '▶'}</Typography>
                          </Button>
                          {expandedChartCategory === 'team' && (
                            <Box sx={{ pl: 2, pt: 1 }}>
                              <Grid container spacing={0.5}>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('offensive_defensive_scatter')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    📈 OFF vs DEF Ratings
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('pace_space_bubble')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    ⚡ Pace & Space
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('four_factors')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    📊 Four Factors
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('game_summary')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    🏀 Game Summary
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('rebounding_battle')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    🏀 Rebounding Battle
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('playmaking_efficiency')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    🎯 Playmaking Efficiency
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('turnover_analysis')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    ⚠️ Turnover Analysis
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('plus_minus_impact')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    📊 Plus/Minus Impact
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleAddSlide('usage_efficiency')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    💡 Usage vs Efficiency
                                  </Button>
                                </Grid>
                                <Grid xs={12} sm={6}>
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    fullWidth
                                    onClick={async () => await handleAddSlide('top_fantasy_scorers')}
                                    sx={{
                                      borderColor: 'rgba(255, 199, 44, 0.3)',
                                      color: '#000',
                                      justifyContent: 'flex-start',
                                      fontSize: '0.75rem',
                                      '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                    }}
                                  >
                                    ⭐ Top Fantasy Scorers
                                  </Button>
                                </Grid>
                              </Grid>
                            </Box>
                          )}
                        </Box>

                        {/* CATEGORY: Matchups */}
                        {getTopMatchups('minutes', 10).length > 0 && (
                          <Box>
                            <Button
                              size="sm"
                              variant="plain"
                              fullWidth
                              onClick={() => setExpandedChartCategory(expandedChartCategory === 'matchup' ? null : 'matchup')}
                              sx={{
                                justifyContent: 'space-between',
                                color: '#FFC72C',
                                fontWeight: 600,
                                bgcolor: expandedChartCategory === 'matchup' ? 'rgba(255, 199, 44, 0.1)' : 'transparent',
                                '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.15)' }
                              }}
                            >
                              🎯 Player Matchups ({getTopMatchups('minutes', 20).length})
                              <Typography sx={{ color: '#000' }}>{expandedChartCategory === 'matchup' ? '▼' : '▶'}</Typography>
                            </Button>
                            {expandedChartCategory === 'matchup' && (
                              <Box sx={{ pl: 2, pt: 1 }}>
                                <Grid container spacing={0.5}>
                                  {getTopMatchups('minutes', 6).map((matchup: any, index: number) => (
                                    <Grid xs={12} sm={6} key={index}>
                                      <Button
                                        size="sm"
                                        variant="outlined"
                                        fullWidth
                                        onClick={() => handleAddSlide('matchup_comparison', index)}
                                        sx={{
                                          borderColor: 'rgba(255, 199, 44, 0.3)',
                                          color: '#000',
                                          justifyContent: 'flex-start',
                                          fontSize: '0.75rem',
                                          '&:hover': { bgcolor: 'rgba(255, 199, 44, 0.1)' }
                                        }}
                                      >
                                        🎯 {matchup.playerA.name} vs {matchup.playerB.name}
                                      </Button>
                                    </Grid>
                                  ))}
                                </Grid>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Stack>
                    </Box>

                    {/* Video Clips Section */}
                    <Typography level="title-sm" sx={{ color: '#FFC72C', fontWeight: 700, mb: 1.5 }}>
                      Video Clips
                    </Typography>
                    {/* Compact Filter Controls */}
                    <Box sx={{ 
                      bgcolor: 'rgba(255, 255, 255, 0.05)', 
                      borderRadius: '8px',
                      p: 1.5,
                      mb: 1.5
                    }}>
                      <Grid container spacing={1}>
                        <Grid xs={12} sm={5}>
                          <Input
                            size="sm"
                            placeholder="🔍 Search play descriptions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            sx={{
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                              color: '#000',
                              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                            }}
                            endDecorator={
                              searchQuery && (
                                <IconButton
                                  size="sm"
                                  variant="plain"
                                  onClick={() => setSearchQuery('')}
                                  sx={{ color: '#000' }}
                                >
                                  <Cancel />
                                </IconButton>
                              )
                            }
                          />
                        </Grid>
                        <Grid xs={12} sm={3}>
                          <Select
                            size="sm"
                            value={selectedPlayer}
                            onChange={(_, value) => setSelectedPlayer(value as string)}
                            placeholder="Player"
                            sx={{
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                              color: '#000',
                              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                            }}
                          >
                            <Option value="all">All Players</Option>
                            {getUniquePlayers().map(player => (
                              <Option key={player.personId} value={player.personId.toString()}>
                                {player.fullName}
                              </Option>
                            ))}
                          </Select>
                        </Grid>
                        <Grid xs={12} sm={2}>
                          <Select
                            size="sm"
                            value={selectedActionType}
                            onChange={(_, value) => setSelectedActionType(value as string)}
                            placeholder="Action"
                            sx={{
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                              color: '#000',
                              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                            }}
                          >
                            <Option value="all">All</Option>
                            {getUniqueActionTypes().map(type => (
                              <Option key={type} value={type}>
                                {type}
                              </Option>
                            ))}
                          </Select>
                        </Grid>
                        <Grid xs={12} sm={2}>
                          <Select
                            size="sm"
                            value={showOnlyWithVideo ? 'video' : 'all'}
                            onChange={(_, value) => setShowOnlyWithVideo(value === 'video')}
                            sx={{
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                              color: '#000',
                              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                            }}
                          >
                            <Option value="video">Video Only</Option>
                            <Option value="all">All</Option>
                          </Select>
                        </Grid>
                      </Grid>
                    </Box>
                    
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      mb: 1,
                      gap: 1
                    }}>
                      {/* Quarter Filter Chips */}
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip
                          size="sm"
                          variant={selectedQuarter === 'all' ? 'solid' : 'outlined'}
                          onClick={() => setSelectedQuarter('all')}
                          sx={{
                            bgcolor: selectedQuarter === 'all' ? '#FFC72C' : 'transparent',
                            color: selectedQuarter === 'all' ? '#000' : '#000',
                            borderColor: '#FFC72C',
                            fontWeight: 600,
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: selectedQuarter === 'all' ? '#FFD700' : 'rgba(255, 199, 44, 0.1)'
                            }
                          }}
                        >
                          All ({getFilteredPlays().length})
                        </Chip>
                        {getUniqueQuarters().map((quarter) => {
                          const quarterStr = quarter.toString()
                          const quarterLabel = quarter <= 4 ? `Q${quarter}` : 'OT'
                          const quarterPlayCount = uploadedGameData?.script?.video_script.filter(p => 
                            p.period === quarter && 
                            (selectedPlayer === 'all' || playInvolvesPlayer(p, selectedPlayer)) &&
                            (selectedActionType === 'all' || p.actionType === selectedActionType) &&
                            (searchQuery === '' || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
                          ).length || 0
                          
                          return (
                            <Chip
                              key={quarter}
                              size="sm"
                              variant={selectedQuarter === quarterStr ? 'solid' : 'outlined'}
                              onClick={() => setSelectedQuarter(quarterStr)}
                              sx={{
                                bgcolor: selectedQuarter === quarterStr ? '#FFC72C' : 'transparent',
                                color: selectedQuarter === quarterStr ? '#000' : '#000',
                                borderColor: '#FFC72C',
                                fontWeight: 600,
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: selectedQuarter === quarterStr ? '#FFD700' : 'rgba(255, 199, 44, 0.1)'
                                }
                              }}
                            >
                              {quarterLabel} ({quarterPlayCount})
                            </Chip>
                          )
                        })}
                      </Stack>

                      {/* Clear Filters Button */}
                      {(selectedPlayer !== 'all' || selectedActionType !== 'all' || selectedQuarter !== 'all' || searchQuery) && (
                        <Button
                          size="sm"
                          variant="plain"
                          onClick={() => {
                            setSelectedPlayer('all')
                            setSelectedActionType('all')
                            setSelectedQuarter('all')
                            setShowOnlyWithVideo(true)
                            setSearchQuery('')
                          }}
                          sx={{ color: '#6a59ff', flexShrink: 0 }}
                        >
                          Clear
                        </Button>
                      )}
                    </Box>
                    
                    <Box sx={{ 
                      maxHeight: '50vh', 
                      overflow: 'auto', 
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      bgcolor: 'rgba(255, 255, 255, 0.02)'
                    }}>
                      <Stack spacing={0.5}>
                        {getFilteredPlays().map((play, index) => {
                          // Check if this play has assist info
                          const assistMatch = play.description.match(/\(([^)]+)\s+(\d+)\s+AST\)/)
                          const isAssist = assistMatch && playInvolvesPlayer(play, selectedPlayer) && play.personId.toString() !== selectedPlayer
                          
                          // Check if this play has already been added
                          const isAlreadyAdded = postForm.slides.some(slide => 
                            slide.type === 'video' && 
                            slide.metadata?.personId === play.personId &&
                            slide.metadata?.period === play.period &&
                            slide.metadata?.clock === play.clock
                          )
                          
                          return (
                            <Box
                              key={index}
                              sx={{
                                p: 1,
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 1.5,
                                '&:hover': {
                                  bgcolor: 'rgba(255, 199, 44, 0.1)'
                                },
                                '&:last-child': {
                                  borderBottom: 'none'
                                }
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                                  <Chip size="sm" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: '#000', fontSize: '0.7rem', py: 0.25 }}>
                                    Q{play.period}
                                  </Chip>
                                  <Chip size="sm" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: '#000', fontSize: '0.7rem', py: 0.25 }}>
                                    {play.teamTricode}
                                  </Chip>
                                  {play.playerName && (
                                    <Chip size="sm" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', color: '#000', fontSize: '0.7rem', py: 0.25 }}>
                                      {play.playerName}
                                    </Chip>
                                  )}
                                </Stack>
                                <Typography level="body-sm" sx={{ color: '#000', fontSize: '0.85rem' }}>
                                  {play.description}
                                </Typography>
                              </Box>
                              <Button
                                size="sm"
                                variant="solid"
                                onClick={() => {
                                  handleAddSlide('video', play.originalIndex)
                                }}
                                sx={{ 
                                  flexShrink: 0,
                                  bgcolor: isAlreadyAdded ? '#10b981' : '#FFC72C',
                                  color: isAlreadyAdded ? '#000' : '#000',
                                  fontWeight: 600,
                                  minWidth: '60px',
                                  '&:hover': { 
                                    bgcolor: isAlreadyAdded ? '#059669' : '#FFD700' 
                                  }
                                }}
                                disabled={!play.video}
                              >
                                {isAlreadyAdded ? '✓' : '+'}
                              </Button>
                            </Box>
                          )
                        })}
                      </Stack>
                    </Box>
                  </>
                )}

              {/* Step 2 Navigation */}
              <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <Button
                  size="sm"
                  variant="plain"
                  onClick={() => setActiveStep(0)}
                  sx={{ color: '#000' }}
                >
                  ← Back
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="sm"
                    variant="soft"
                    startDecorator={<Save />}
                    onClick={() => handleSaveDraft(false)}
                    disabled={postForm.slides.length === 0 || !postForm.title}
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      color: '#000',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' }
                    }}
                  >
                    Save
                  </Button>
                  {uploadedGameData && (
                    <Button
                      size="sm"
                      variant="soft"
                      startDecorator={<Save />}
                      onClick={() => handleSaveDraft(true)}
                      disabled={postForm.slides.length === 0 || !postForm.title}
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        color: '#000',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' }
                      }}
                    >
                      Save + New
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="solid"
                    startDecorator={<Visibility />}
                    onClick={() => handlePublish(false)}
                    disabled={postForm.slides.length === 0 || !postForm.title}
                    sx={{
                      bgcolor: '#22c55e',
                      color: '#000',
                      fontWeight: 600,
                      '&:hover': { bgcolor: '#16a34a' }
                    }}
                  >
                    Publish
                  </Button>
                  {uploadedGameData && (
                    <Button
                      size="sm"
                      variant="solid"
                      startDecorator={<Visibility />}
                      onClick={() => handlePublish(true)}
                      disabled={postForm.slides.length === 0 || !postForm.title}
                      sx={{
                        bgcolor: '#6a59ff',
                        color: '#000',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#5a49ef' }
                      }}
                    >
                      Publish + New
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Box>
          )}

          {/* Individual Slide Edit/Preview Views */}
          {activeStep >= 2 && postForm.slides[activeStep - 2] && (
            <Box sx={{ p: 2 }}>
              {(() => {
                const slideIndex = activeStep - 2
                const slide = postForm.slides[slideIndex]
                
                return (
                  <>
                    {/* Slide Preview */}
                    <Box sx={{ mb: 2 }}>
                      <Typography level="body-sm" sx={{ color: '#000', mb: 1, fontWeight: 600 }}>
                        {slideIndex + 1} Preview
                      </Typography>
                      
                      {/* Video Preview */}
                      {slide.video_url && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2
                        }}>
                          <video
                            src={slide.video_url}
                            controls
                            style={{
                              width: '100%',
                              maxHeight: '400px',
                              display: 'block'
                            }}
                          />
                        </Box>
                      )}

                      {/* Story Comparison Chart Preview */}
                      {slide.type === 'story_comparison' && slide.advantage && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '300px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <StoryComparisonChart
                            advantage={slide.advantage}
                            homeTeam={slide.home_team}
                            awayTeam={slide.away_team}
                          />
                        </Box>
                      )}

                      {/* Game Summary Preview */}
                      {slide.type === 'game_summary' && (
                        <Box sx={{ 
                          bgcolor: 'rgba(255, 199, 44, 0.1)',
                          border: '1px solid rgba(255, 199, 44, 0.3)',
                          borderRadius: '8px',
                          p: 2,
                          mb: 2
                        }}>
                          <Typography level="h4" sx={{ color: '#FFC72C', mb: 1 }}>
                            {slide.matchup || 'Game Summary'}
                          </Typography>
                          <Typography level="body-md" sx={{ color: '#000' }}>
                            {slide.final_score}
                          </Typography>
                          <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.7)', mt: 1 }}>
                            {slide.arena} • {slide.game_date}
                          </Typography>
                        </Box>
                      )}

                      {/* Matchup Comparison Chart Preview */}
                      {slide.type === 'matchup_comparison' && slide.playerA && slide.playerB && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <MatchupRadarChart
                            playerA={slide.playerA}
                            playerB={slide.playerB}
                            matchupMinutes={slide.matchupMinutes}
                          />
                        </Box>
                      )}

                      {/* Offensive vs Defensive Scatter Preview */}
                      {slide.type === 'offensive_defensive_scatter' && slide.players && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <OffensiveDefensiveScatter players={slide.players} />
                        </Box>
                      )}

                      {/* Pace & Space Bubble Preview */}
                      {slide.type === 'pace_space_bubble' && slide.players && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <PaceSpaceBubble players={slide.players} />
                        </Box>
                      )}

                      {/* Hustle Radar Chart Preview */}
                      {slide.type === 'hustle_radar' && slide.player && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <HustleRadarChart player={slide.player} />
                        </Box>
                      )}

                      {/* Four Factors Chart Preview */}
                      {slide.type === 'four_factors' && slide.homeTeam && slide.awayTeam && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <FourFactorsChart 
                            homeTeam={slide.homeTeam}
                            awayTeam={slide.awayTeam}
                          />
                        </Box>
                      )}

                      {/* Shot Distribution Donut Preview */}
                      {slide.type === 'shot_distribution' && slide.player && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <ShotDistributionDonut player={slide.player} />
                        </Box>
                      )}

                      {/* Shot Profile Efficiency Preview */}
                      {slide.type === 'shot_profile_efficiency' && slide.player && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <ShotProfileEfficiencyChart player={slide.player} />
                        </Box>
                      )}

                      {/* Rim Pressure Preview */}
                      {slide.type === 'rim_pressure' && slide.player && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <RimPressureChart player={slide.player} />
                        </Box>
                      )}

                      {/* On-Ball Creation Preview */}
                      {slide.type === 'on_ball_creation' && slide.player && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <OnBallCreationChart player={slide.player} />
                        </Box>
                      )}

                      {/* Defensive Events Map Preview */}
                      {slide.type === 'defensive_events' && slide.player && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <DefensiveEventsMap player={slide.player} />
                        </Box>
                      )}

                      {/* Foul Drawing Profile Preview */}
                      {slide.type === 'foul_drawing' && slide.player && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <FoulDrawingProfile player={slide.player} />
                        </Box>
                      )}

                      {/* Rebounding Battle Preview */}
                      {slide.type === 'rebounding_battle' && slide.players && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <ReboundingBattleChart players={slide.players} />
                        </Box>
                      )}

                      {/* Playmaking Efficiency Preview */}
                      {slide.type === 'playmaking_efficiency' && slide.players && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <PlaymakingEfficiencyChart players={slide.players} />
                        </Box>
                      )}

                      {/* Turnover Analysis Preview */}
                      {slide.type === 'turnover_analysis' && slide.teams && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <TurnoverAnalysisChart teams={slide.teams} />
                        </Box>
                      )}

                      {/* Plus/Minus Impact Preview */}
                      {slide.type === 'plus_minus_impact' && slide.players && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <PlusMinusImpactChart players={slide.players} />
                        </Box>
                      )}

                      {/* Usage vs Efficiency Preview */}
                      {slide.type === 'usage_efficiency' && slide.players && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          minHeight: '500px',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <UsageEfficiencyScatter players={slide.players} />
                        </Box>
                      )}

                      {/* Top Fantasy Scorers Preview */}
                      {slide.type === 'top_fantasy_scorers' && slide.players && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          height: '500px',
                          width: '100%',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <TopFantasyScorersChart players={slide.players} />
                        </Box>
                      )}

                      {/* Shot Chart Table Preview */}
                      {slide.type === 'shot_chart_table' && slide.shots && (
                        <Box sx={{ 
                          bgcolor: '#ffffff',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          mb: 2,
                          height: '500px',
                          width: '100%',
                          border: '1px solid rgba(255, 199, 44, 0.3)'
                        }}>
                          <ShotChartTable shots={slide.shots} playerName={slide.playerName} />
                        </Box>
                      )}

                      {/* Slide Metadata */}
                      {slide.metadata && (
                        <Box sx={{ 
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          p: 1.5,
                          mb: 2
                        }}>
                          <Grid container spacing={1}>
                            <Grid xs={6} sm={3}>
                              <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                Quarter
                              </Typography>
                              <Typography level="body-sm" sx={{ color: '#000', fontWeight: 600 }}>
                                Q{slide.metadata.period}
                              </Typography>
                            </Grid>
                            <Grid xs={6} sm={3}>
                              <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                Team
                              </Typography>
                              <Typography level="body-sm" sx={{ color: '#000', fontWeight: 600 }}>
                                {slide.metadata.teamTricode}
                              </Typography>
                            </Grid>
                            <Grid xs={6} sm={3}>
                              <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                Player
                              </Typography>
                              <Typography level="body-sm" sx={{ color: '#000', fontWeight: 600 }}>
                                {slide.metadata.playerName}
                              </Typography>
                            </Grid>
                            <Grid xs={6} sm={3}>
                              <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                Score
                              </Typography>
                              <Typography level="body-sm" sx={{ color: '#000', fontWeight: 600 }}>
                                {slide.metadata.scoreHome} - {slide.metadata.scoreAway}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {/* Edit Caption */}
                      <FormControl size="sm" sx={{ mb: 2 }}>
                        <FormLabel sx={{ color: '#000', fontWeight: 600, fontSize: '0.75rem', mb: 0.5 }}>
                          Caption
                        </FormLabel>
                        <Textarea
                          size="sm"
                          value={slide.caption || ''}
                          onChange={(e) => handleUpdateSlideCaption(slideIndex, e.target.value)}
                          placeholder="Add a caption for this slide..."
                          minRows={3}
                          sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                            color: '#000',
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                          }}
                        />
                      </FormControl>

                      {/* Duration Control for Chart Slides */}
                      {(slide.type === 'story_comparison' || slide.type === 'matchup_comparison' || slide.type === 'game_summary' || slide.type === 'offensive_defensive_scatter' || slide.type === 'pace_space_bubble' || slide.type === 'hustle_radar' || slide.type === 'four_factors' || slide.type === 'shot_distribution') && (
                        <Box sx={{ 
                          bgcolor: 'rgba(255, 199, 44, 0.1)',
                          border: '1px solid rgba(255, 199, 44, 0.3)',
                          borderRadius: '8px',
                          p: 1.5
                        }}>
                          <FormControl size="sm">
                            <FormLabel sx={{ color: '#FFC72C', fontWeight: 600, fontSize: '0.75rem', mb: 1 }}>
                              Display Duration (seconds)
                            </FormLabel>
                            <Grid container spacing={2} alignItems="center">
                              <Grid xs={8}>
                                <Input
                                  type="number"
                                  size="sm"
                                  value={slide.duration ? Math.round(slide.duration / 1000) : 5}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 5
                                    handleUpdateSlideDuration(slideIndex, Math.max(1, Math.min(value, 30)))
                                  }}
                                  slotProps={{
                                    input: {
                                      min: 1,
                                      max: 30,
                                      step: 1
                                    }
                                  }}
                                  endDecorator={
                                    <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                      sec
                                    </Typography>
                                  }
                                  sx={{
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    color: '#000',
                                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                                  }}
                                />
                              </Grid>
                              <Grid xs={4}>
                                <Stack direction="row" spacing={0.5}>
                                  <Button
                                    size="sm"
                                    variant="plain"
                                    onClick={() => handleUpdateSlideDuration(slideIndex, 3)}
                                    sx={{ 
                                      minWidth: '40px',
                                      color: '#000',
                                      fontSize: '0.7rem',
                                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                                    }}
                                  >
                                    3s
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="plain"
                                    onClick={() => handleUpdateSlideDuration(slideIndex, 5)}
                                    sx={{ 
                                      minWidth: '40px',
                                      color: '#000',
                                      fontSize: '0.7rem',
                                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                                    }}
                                  >
                                    5s
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="plain"
                                    onClick={() => handleUpdateSlideDuration(slideIndex, 10)}
                                    sx={{ 
                                      minWidth: '40px',
                                      color: '#000',
                                      fontSize: '0.7rem',
                                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
                                    }}
                                  >
                                    10s
                                  </Button>
                                </Stack>
                              </Grid>
                            </Grid>
                            <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)', mt: 1 }}>
                              How long this chart will display during autoplay (1-30 seconds)
                            </Typography>
                      </FormControl>
                        </Box>
                      )}
                    </Box>

                    {/* Slide Navigation */}
                    <Stack 
                      direction="row" 
                      spacing={1} 
                      justifyContent="space-between" 
                      sx={{ pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
                    >
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="sm"
                          variant="plain"
                          onClick={() => setActiveStep(1)}
                          sx={{ color: '#000' }}
                        >
                          ← Add Slides
                        </Button>
                        {slideIndex > 0 && (
                          <Button
                            size="sm"
                            variant="plain"
                            onClick={() => setActiveStep(activeStep - 1)}
                            sx={{ color: '#000' }}
                          >
                            ← Prev Slide
                          </Button>
                        )}
                        {slideIndex < postForm.slides.length - 1 && (
                          <Button
                            size="sm"
                            variant="plain"
                            onClick={() => setActiveStep(activeStep + 1)}
                            sx={{ color: '#000' }}
                          >
                            Next Slide →
                          </Button>
                        )}
                      </Stack>
                      
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="sm"
                          variant="soft"
                          color="danger"
                          startDecorator={<Delete />}
                          onClick={() => handleRemoveSlide(slideIndex)}
                          sx={{
                            bgcolor: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.3)' }
                          }}
                        >
                          Delete Slide
                        </Button>
                        <Button
                          size="sm"
                          variant="soft"
                          startDecorator={<Save />}
                          onClick={() => handleSaveDraft(false)}
                          disabled={postForm.slides.length === 0 || !postForm.title}
                          sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                            color: '#000',
                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' }
                          }}
                        >
                          Save Draft
                        </Button>
                        <Button
                          size="sm"
                          variant="solid"
                          startDecorator={<Visibility />}
                          onClick={() => handlePublish(false)}
                          disabled={postForm.slides.length === 0 || !postForm.title}
                          sx={{
                            bgcolor: '#22c55e',
                            color: '#000',
                            fontWeight: 600,
                            '&:hover': { bgcolor: '#16a34a' }
                          }}
                        >
                          Publish
                        </Button>
                      </Stack>
                    </Stack>
                  </>
                )
              })()}
            </Box>
          )}
        </Box>
      )}
    </Box>

      {/* Metadata Confirmation Modal */}
      <Modal open={showMetadataModal} onClose={() => setShowMetadataModal(false)}>
        <ModalDialog 
          sx={{ 
            maxWidth: 500,
            bgcolor: '#000',
            border: '1px solid rgba(255, 199, 44, 0.3)',
            p: 2
          }}
        >
          <ModalClose sx={{ color: '#000' }} />
          
          <Typography level="title-lg" sx={{ color: '#FFC72C', fontWeight: 700, mb: 2 }}>
            📊 Game Data Loaded
          </Typography>
          
          {uploadedGameData && (
            <Stack spacing={2}>
              {/* Game Title */}
              <Box sx={{ 
                bgcolor: 'rgba(255, 199, 44, 0.1)',
                border: '1px solid rgba(255, 199, 44, 0.3)',
                borderRadius: '8px',
                p: 1.5
              }}>
                <Typography level="title-md" sx={{ color: '#000', fontWeight: 600 }}>
                  {uploadedGameData.story?.matchup || 'Game Matchup'}
                </Typography>
              </Box>

              {/* Game Details Grid */}
              <Grid container spacing={1.5}>
                <Grid xs={6}>
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 0.5 }}>
                      Game ID
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#000', fontWeight: 600 }}>
                      {uploadedGameData.gameId}
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={6}>
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 0.5 }}>
                      Date
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#000', fontWeight: 600 }}>
                      {uploadedGameData.gameMetadata?.date}
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={6}>
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 0.5 }}>
                      Arena
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#000', fontWeight: 600 }}>
                      {uploadedGameData.gameMetadata?.arena}
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={6}>
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 0.5 }}>
                      Fun Score
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 700 }}>
                      {uploadedGameData.score?.[Object.keys(uploadedGameData.score || {})[0]]?.fun_score || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={12}>
                  <Box>
                    <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 0.5 }}>
                      Highlights Available
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#000', fontWeight: 600 }}>
                      {uploadedGameData.script?.video_script?.length || 0} plays
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              {/* Success Message */}
              <Box sx={{ 
                bgcolor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                p: 1.5
              }}>
                <Typography level="body-sm" sx={{ color: '#10b981' }}>
                  ✓ Ready to create posts with this game data
                </Typography>
              </Box>
              
              {/* Action Buttons */}
              <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                <Button
                  size="md"
                  variant="outlined"
                  startDecorator={<AutoAwesome />}
                  onClick={() => {
                    setShowMetadataModal(false)
                    setView('detection')
                  }}
                  sx={{
                    borderColor: '#FFC72C',
                    color: '#FFC72C',
                    fontWeight: 600,
                    flex: 1,
                    '&:hover': { 
                      bgcolor: 'rgba(255, 199, 44, 0.1)',
                      borderColor: '#FFD700'
                    }
                  }}
                >
                  Algorithmic Builder
                </Button>
                <Button
                  size="md"
                  onClick={() => {
                    setShowMetadataModal(false)
                    setView('form')
                  }}
                  sx={{
                    bgcolor: '#6a59ff',
                    color: '#000',
                    fontWeight: 600,
                    flex: 1,
                    '&:hover': { bgcolor: '#5a49ef' }
                  }}
                >
                  Manual Builder
                </Button>
              </Stack>
            </Stack>
          )}
        </ModalDialog>
      </Modal>

      {/* Discard Confirmation Modal */}
      <Modal open={showDiscardConfirm} onClose={handleCancelDiscard}>
        <ModalDialog
          role="alertdialog"
          sx={{
            maxWidth: 400,
            bgcolor: '#000',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            p: 2,
          }}
        >
          <ModalClose sx={{ color: '#000' }} />
          
          <Typography level="title-lg" sx={{ color: '#ef4444', fontWeight: 700, mb: 2 }}>
            ⚠️ Replace JSON Data?
          </Typography>
          
          <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.8)', mb: 2 }}>
            You already have JSON data loaded. Do you want to discard it and load the new file?
          </Typography>
          
          {uploadedGameData && (
            <Box sx={{ 
              bgcolor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              p: 1.5,
              mb: 2
            }}>
              <Typography level="body-sm" sx={{ color: '#000' }}>
                Currently loaded: <strong style={{ color: '#FFC72C' }}>{uploadedGameData.gameId}</strong>
              </Typography>
            </Box>
          )}
          
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              size="sm"
              variant="plain"
              onClick={handleCancelDiscard}
              sx={{ color: '#000' }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="solid"
              onClick={handleDiscardAndLoad}
              sx={{
                bgcolor: '#ef4444',
                color: '#000',
                '&:hover': { bgcolor: '#dc2626' }
              }}
            >
              Discard & Load New
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Fun Score Data Modal */}
      <FunScoreDataModal
        open={showFunScoreModal}
        onClose={() => setShowFunScoreModal(false)}
        funScoreData={
          uploadedGameData && uploadedGameData.score 
            ? uploadedGameData.score[Object.keys(uploadedGameData.score)[0]] as any
            : null
        }
        gameId={uploadedGameData?.gameId}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        color={snackbar.color}
        variant="soft"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snackbar.message}
      </Snackbar>
    </>
  )
}

