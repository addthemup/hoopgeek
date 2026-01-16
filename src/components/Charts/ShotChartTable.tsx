import { Box, Typography } from '@mui/joy'
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors'

interface ShotData {
  eventNum: number
  xLegacy?: number | null
  yLegacy?: number | null
  locX?: number | null  // NBA API coordinate (inches from basket center)
  locY?: number | null  // NBA API coordinate (inches from basket)
  shotResult: string | null
  shotDistance: number | null
  period: number
  clock: string
  description: string
}

interface ShotChartTableProps {
  shots: ShotData[]
  playerName?: string
  teamTricode?: string
}

/**
 * Normalize shot coordinates to always show from the same end of the court
 * 
 * Supports two coordinate systems:
 * 1. NBA API (LOC_X/LOC_Y): Coordinates in inches from basket center
 *    - LOC_X: horizontal position in inches (negative = left, positive = right, 0 = center)
 *    - LOC_Y: distance from basket in inches (positive = away from basket)
 * 2. Legacy (xLegacy/yLegacy): Calibrated coordinate system
 *    - Scale factor: 10 coordinate units = 1 foot
 *    - Basket is at (0, 0)
 *    - xLegacy: negative = left, positive = right (range: -250 to +250)
 *    - yLegacy: positive = away from basket (range: 0 to 470 for half court)
 * 
 * SVG coordinate system:
 * - SVG viewBox: 0 0 250 235 (width x height)
 * - 5 SVG units = 1 foot (so 250 units = 50 feet wide, 235 units = 47 feet deep)
 * - Basket at top center: x=125, y=0
 */
const normalizeShotCoordinates = (
  xLegacy: number | null | undefined,
  yLegacy: number | null | undefined,
  locX: number | null | undefined,
  locY: number | null | undefined,
  period: number
) => {
  // SVG dimensions (5 SVG units = 1 foot)
  const SVG_WIDTH = 250   // 50 feet = 250 SVG units
  const SVG_HEIGHT = 235  // 47 feet = 235 SVG units
  const SVG_CENTER_X = 125  // Center of court in SVG
  
  // Prefer NBA API coordinates (LOC_X/LOC_Y) if available
  if (locX !== null && locX !== undefined && locY !== null && locY !== undefined) {
    // NBA API coordinates are in inches from basket center
    // Court: 50 feet wide = 600 inches (-300 to +300 for LOC_X)
    // Half court: 47 feet = 564 inches (0 to 564 for LOC_Y)
    
    // Convert inches to SVG units
    // LOC_X: -300 inches (left sideline) → 0 SVG, 0 inches (center) → 125 SVG, +300 inches (right sideline) → 250 SVG
    // Formula: svgX = (LOC_X / 12) * 5 + 125 = (LOC_X * 5 / 12) + 125
    const svgX = (locX * 5 / 12) + SVG_CENTER_X
    
    // LOC_Y: 0 inches (basket) → 0 SVG, 564 inches (half court) → 235 SVG
    // Formula: svgY = (LOC_Y / 12) * 5 = LOC_Y * 5 / 12
    let svgY = (locY * 5 / 12)
    
    // Clamp to half court (47 feet = 564 inches = 235 SVG units)
    if (svgY > SVG_HEIGHT) {
      svgY = SVG_HEIGHT
    }
    
    // Clamp to SVG bounds
    const clampedX = Math.max(0, Math.min(SVG_WIDTH, svgX))
    const clampedY = Math.max(0, Math.min(SVG_HEIGHT, svgY))
    
    return { x: clampedX, y: clampedY }
  }
  
  // Fallback to legacy coordinates (xLegacy/yLegacy)
  if (xLegacy !== null && xLegacy !== undefined && yLegacy !== null && yLegacy !== undefined) {
    // NBA court dimensions in legacy coordinate units (10 units = 1 foot)
    const COURT_WIDTH_LEGACY = 500  // 50 feet wide (-250 to +250)
    const HALF_COURT_LEGACY = 470   // 47 feet to half court line
    
    // Handle negative yLegacy (shots behind basket - rare but possible)
    let normalizedY = Math.max(0, yLegacy)
    
    // Clamp y to half court range (0 to 470 legacy units = 0 to 47 feet)
    if (normalizedY > HALF_COURT_LEGACY) {
      normalizedY = HALF_COURT_LEGACY
    }

    // Convert from legacy coordinates to SVG coordinates
    // Legacy: 10 units = 1 foot
    // SVG: 5 units = 1 foot
    // Conversion factor: svgUnit = legacyUnit / 2
    
    // For x: center is at xLegacy=0, court extends -250 to +250 in legacy units
    // Map to SVG: -250→0, 0→125, +250→250
    // Formula: svgX = (xLegacy + 250) / 2
    const svgX = (xLegacy + COURT_WIDTH_LEGACY / 2) / 2
    
    // For y: basket at yLegacy=0, half court at yLegacy=470
    // Map to SVG: 0→0, 470→235
    // Formula: svgY = yLegacy / 2
    const svgY = normalizedY / 2

    // Clamp to SVG bounds for safety
    const clampedX = Math.max(0, Math.min(SVG_WIDTH, svgX))
    const clampedY = Math.max(0, Math.min(SVG_HEIGHT, svgY))

    return { x: clampedX, y: clampedY }
  }
  
  // No valid coordinates available
  return { x: SVG_CENTER_X, y: 0 }
}

/**
 * Convert normalized coordinates to SVG coordinates
 * Vertical half court: basket at top (y=0), half court line at bottom (y=235)
 * SVG viewBox: 0 0 250 235 (width x height)
 * 
 * Note: normalizeShotCoordinates already returns SVG coordinates, so this is a passthrough
 */
const convertToSVGCoords = (x: number, y: number) => {
  // Coordinates are already in SVG space from normalizeShotCoordinates
  return { svgX: x, svgY: y }
}

export default function ShotChartTable({ shots, playerName, teamTricode }: ShotChartTableProps) {
  // Get team colors for paint area and shot markers, default to blue if not provided
  const paintColor = teamTricode ? getTeamPrimaryColor(teamTricode) : '#116cb6'
  const madeShotColor = teamTricode ? getTeamPrimaryColor(teamTricode) : '#4caf50'
  const missedShotColor = teamTricode ? getTeamSecondaryColor(teamTricode) : '#f44336'
  if (!shots || shots.length === 0) {
    return (
      <Box sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          No shot data available
        </Typography>
      </Box>
    )
  }

  // Normalize and convert all shots
  const normalizedShots = shots.map(shot => {
    const normalized = normalizeShotCoordinates(
      shot.xLegacy,
      shot.yLegacy,
      shot.locX,
      shot.locY,
      shot.period
    )
    const svgCoords = convertToSVGCoords(normalized.x, normalized.y)
    return {
      ...shot,
      svgX: svgCoords.svgX,
      svgY: svgCoords.svgY
    }
  })

  const madeShots = normalizedShots.filter(s => s.shotResult === 'Made')
  const missedShots = normalizedShots.filter(s => s.shotResult !== 'Made')

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.body',
      p: 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden', // Prevent any overflow
      // Hide scrollbars
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      '& *': {
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
      },
    }}>
      {/* Shot Chart Court */}
      <Box sx={{
        width: { xs: '95%', md: '60%' }, // Narrower on desktop with black sidelines
        flex: 1,
        minHeight: 0,
        position: 'relative',
        bgcolor: '#eac696',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '2px solid #5d5c63',
        mt: '75px', // Move court down 75px
        mx: 'auto', // Center the court
        // Ensure no scrollbars
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
      }}>
        {/* Black sidelines for desktop */}
        <Box sx={{
          display: { xs: 'none', md: 'block' },
          position: 'absolute',
          left: '-20%',
          top: 0,
          bottom: 0,
          width: '20%',
          bgcolor: '#000',
          zIndex: -1
        }} />
        <Box sx={{
          display: { xs: 'none', md: 'block' },
          position: 'absolute',
          right: '-20%',
          top: 0,
          bottom: 0,
          width: '20%',
          bgcolor: '#000',
          zIndex: -1
        }} />
        <svg
          viewBox="0 0 250 235"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Court background */}
          <rect width="250" height="235" fill="#eac696" />

          {/* Baseline */}
          <line x1="0" y1="0" x2="250" y2="0" stroke="#5d5c63" strokeWidth="2" />

          {/* Basket center */}
          {/* Rim center at (125, 10) */}
          <circle cx="125" cy="10" r="7.5" stroke="#b37336" strokeWidth="2" fill="none" />

          {/* Backboard */}
          <line x1="110" y1="0" x2="140" y2="0" stroke="#b37336" strokeWidth="2" />

          {/* Key (paint) - 16ft wide → 80 units, 19ft deep → 95 units */}
          <rect x="85" y="0" width="80" height="95" fill={paintColor} stroke="#fff" strokeWidth="1.5" />

          {/* Free throw line (15ft → 75 units) */}
          <line x1="85" y1="75" x2="165" y2="75" stroke="#fff" strokeWidth="1.5" />

          {/* Free throw circle (radius 30 units) */}
          <circle cx="125" cy="75" r="30" fill="none" stroke="#fff" strokeWidth="1.5" />

          {/* Restricted area (radius 20 units) */}
          <path
            d="M105 10 A20 20 0 0 1 145 10"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
          />

          {/* Corner 3-point lines (22ft → 110 units) */}
          <line x1="0" y1="0" x2="0" y2="60" stroke="#5d5c63" strokeWidth="1.5" />
          <line x1="250" y1="0" x2="250" y2="60" stroke="#5d5c63" strokeWidth="1.5" />

          {/* 3-pt arc (23.75ft → radius 118.75 units) - curves upward toward basket */}
          <path
            d="M 0 60 A 118.75 118.75 0 0 0 250 60"
            fill="none"
            stroke="#5d5c63"
            strokeWidth="1.5"
          />

          {/* Half court line */}
          <line x1="0" y1="235" x2="250" y2="235" stroke="#5d5c63" strokeWidth="2" />

          {/* Center circle (6ft → 30 units) */}
          <circle cx="125" cy="235" r="30" fill="none" stroke="#5d5c63" strokeWidth="1.5" />

          {/* SHOT MARKERS – using team colors */}
          {madeShots.map((shot, index) => (
            <circle
              key={`made-${shot.eventNum}-${index}`}
              cx={shot.svgX}
              cy={shot.svgY}
              r="4"
              fill={madeShotColor}
              stroke="#fff"
              strokeWidth="1"
              opacity="0.9"
            />
          ))}
          {missedShots.map((shot, index) => (
            <g key={`missed-${shot.eventNum}-${index}`}>
              <line
                x1={shot.svgX - 3}
                y1={shot.svgY - 3}
                x2={shot.svgX + 3}
                y2={shot.svgY + 3}
                stroke={missedShotColor}
                strokeWidth="2"
                opacity="0.9"
              />
              <line
                x1={shot.svgX - 3}
                y1={shot.svgY + 3}
                x2={shot.svgX + 3}
                y2={shot.svgY - 3}
                stroke={missedShotColor}
                strokeWidth="2"
                opacity="0.9"
              />
            </g>
          ))}
        </svg>

      </Box>

      {/* Legend */}
      <Box sx={{
        display: 'flex',
        gap: 3,
        mt: 1,
        mb: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: madeShotColor, border: '1px solid #fff' }} />
          <Typography level="body-sm">Made ({madeShots.length})</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{
            width: 12,
            height: 12,
            position: 'relative',
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              width: '100%',
              height: 2,
              bgcolor: missedShotColor,
              top: '50%',
              left: 0,
              transform: 'translateY(-50%) rotate(45deg)'
            },
            '&::after': {
              transform: 'translateY(-50%) rotate(-45deg)'
            }
          }} />
          <Typography level="body-sm">Missed ({missedShots.length})</Typography>
        </Box>
      </Box>
    </Box>
  )
}
