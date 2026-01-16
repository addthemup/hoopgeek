import { Box, Typography } from '@mui/joy'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts'
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors'
import { useMemo } from 'react'

// Helper function to ensure good contrast on black background
const getContrastColor = (hexColor: string): string => {
  if (!hexColor) return '#FFFFFF'
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
    return '#FFFFFF'
  }
  
  return hexColor
}

interface ComparisonPlayer {
  name: string
  teamTricode: string
  color: string
  stats: Record<string, number>
}

interface PlayerComparisonRadarChartProps {
  targetPlayer: ComparisonPlayer
  comparisonPlayers: ComparisonPlayer[]
  category: 'usage' | 'playertrack' | 'hustle' | 'fourfactors' | 'advanced' | 'defensive' | 'playmaking' | 'scoring' | 'relative' | 'team-context' | 'complementary'
  categoryTitle: string
}

export default function PlayerComparisonRadarChart({ 
  targetPlayer, 
  comparisonPlayers, 
  category,
  categoryTitle 
}: PlayerComparisonRadarChartProps) {
  // Define metrics for each category
  const getMetrics = () => {
    switch (category) {
      case 'usage':
        return [
          { key: 'usagePercentage', label: 'Usage %' },
          { key: 'percentagePoints', label: 'Points %' },
          { key: 'percentageAssists', label: 'Assists %' },
          { key: 'percentageReboundsTotal', label: 'Rebounds %' },
          { key: 'percentageTurnovers', label: 'Turnovers %' },
          { key: 'percentageFieldGoalsAttempted', label: 'FGA %' }
        ]
      case 'playertrack':
        return [
          { key: 'speed', label: 'Speed' },
          { key: 'distance', label: 'Distance' },
          { key: 'touches', label: 'Touches' },
          { key: 'passes', label: 'Passes' },
          { key: 'contestedFieldGoalPercentage', label: 'Contested FG%' },
          { key: 'reboundChancesTotal', label: 'Rebound Chances' }
        ]
      case 'hustle':
        return [
          { key: 'contestedShots', label: 'Contested Shots' },
          { key: 'deflections', label: 'Deflections' },
          { key: 'looseBallsRecoveredTotal', label: 'Loose Balls' },
          { key: 'boxOuts', label: 'Box Outs' },
          { key: 'chargesDrawn', label: 'Charges Drawn' },
          { key: 'screenAssists', label: 'Screen Assists' }
        ]
      case 'fourfactors':
        return [
          { key: 'effectiveFieldGoalPercentage', label: 'eFG%' },
          { key: 'freeThrowAttemptRate', label: 'FTA Rate' },
          { key: 'offensiveReboundPercentage', label: 'OReb %' },
          { key: 'teamTurnoverPercentage', label: 'TOV %' },
          { key: 'oppEffectiveFieldGoalPercentage', label: 'Opp eFG%' },
          { key: 'oppOffensiveReboundPercentage', label: 'Opp OReb %' }
        ]
      case 'advanced':
        return [
          { key: 'offensiveRating', label: 'ORtg' },
          { key: 'defensiveRating', label: 'DRtg' },
          { key: 'netRating', label: 'Net Rating' },
          { key: 'effectiveFieldGoalPercentage', label: 'eFG%' },
          { key: 'trueShootingPercentage', label: 'TS%' },
          { key: 'PIE', label: 'PIE' }
        ]
      case 'defensive':
        return [
          { key: 'steals', label: 'Steals' },
          { key: 'blocks', label: 'Blocks' },
          { key: 'deflections', label: 'Deflections' },
          { key: 'contestedShots', label: 'Contested Shots' },
          { key: 'defensiveRating', label: 'DRtg' },
          { key: 'defensiveReboundPercentage', label: 'DReb %' }
        ]
      case 'playmaking':
        return [
          { key: 'assists', label: 'Assists' },
          { key: 'assistPercentage', label: 'AST %' },
          { key: 'passes', label: 'Passes' },
          { key: 'secondaryAssists', label: '2nd AST' },
          { key: 'freeThrowAssists', label: 'FT AST' }
        ]
      case 'scoring':
        return [
          { key: 'pctPoints3pt', label: '3PT %' },
          { key: 'pctPoints2pt', label: '2PT %' },
          { key: 'pctPointsPaint', label: 'Paint %' },
          { key: 'pctPointsMidrange', label: 'Mid %' },
          { key: 'pctPointsFastBreak', label: 'Fast Break %' },
          { key: 'freeThrowRate', label: 'FT Rate' }
        ]
      case 'relative':
      case 'team-context':
      case 'complementary':
        // Dynamic metrics based on what's in the stats object
        // Extract keys from targetPlayer stats
        const dynamicKeys = Object.keys(targetPlayer.stats || {})
        return dynamicKeys.map(key => ({
          key,
          label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
        }))
      default:
        return []
    }
  }

  const metrics = getMetrics()
  
  // Early return if no metrics available
  if (metrics.length === 0) {
    return (
      <Box sx={{ 
        width: '100%', 
        height: '100%',
        bgcolor: '#000',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography sx={{ color: '#FFC72C' }}>
          No metrics available for {categoryTitle}
        </Typography>
      </Box>
    )
  }
  
  // Get all players including target player
  const allPlayers = [targetPlayer, ...comparisonPlayers]
  
  // Determine if this is a percentage-based category (0-100 scale)
  const isPercentageCategory = category === 'usage' || category === 'fourfactors' || category === 'scoring'
  
  // Defensive and playmaking stats need normalization but aren't percentage-based
  const needsNormalization = category === 'defensive' || category === 'playmaking' || category === 'relative' || category === 'team-context' || category === 'complementary'
  
  // Calculate dynamic constraints for each metric and normalize values
  const { maxValue, chartData, metricRanges } = useMemo(() => {
    // Calculate min/max range for each metric across all players
    const ranges: Record<string, { min: number; max: number }> = {}
    
    metrics.forEach(metric => {
      const values = allPlayers.map(player => player.stats[metric.key] || 0)
      const min = Math.min(...values)
      const max = Math.max(...values)
      
      // Handle edge case where all values are the same (or very close)
      if (max - min < 0.01) {
        // If all values are essentially the same, center them in the middle of the scale
        const centerValue = max || 0
        ranges[metric.key] = {
          min: Math.max(0, centerValue - 1),
          max: centerValue + 1
        }
      } else {
        // Add 10% padding to the range for better visualization
        const range = max - min
        const padding = Math.max(range * 0.1, 0.1) // At least 0.1 padding
        
        ranges[metric.key] = {
          min: Math.max(0, min - padding), // Don't go below 0
          max: max + padding
        }
      }
    })
    
    // Normalize all values to 0-100 scale based on each metric's own range
    const data = metrics.map(metric => {
      const dataPoint: any = {
        metric: metric.label
      }
      
      const range = ranges[metric.key]
      const rangeSpan = range.max - range.min || 1 // Avoid division by zero
      
      // Normalize target player value
      const targetValue = targetPlayer.stats[metric.key] || 0
      const normalizedTarget = ((targetValue - range.min) / rangeSpan) * 100
      dataPoint[targetPlayer.name] = Math.max(0, Math.min(100, normalizedTarget)) // Clamp to 0-100
      
      // Normalize comparison player values
      comparisonPlayers.forEach(player => {
        const playerValue = player.stats[metric.key] || 0
        const normalizedPlayer = ((playerValue - range.min) / rangeSpan) * 100
        dataPoint[player.name] = Math.max(0, Math.min(100, normalizedPlayer)) // Clamp to 0-100
      })
      
      return dataPoint
    })
    
    // For percentage categories, we still use 0-100 domain
    // For others, we use 0-100 as the normalized scale
    return { 
      maxValue: 100, 
      chartData: data,
      metricRanges: ranges // Store ranges for potential future use (tooltips, etc.)
    }
  }, [metrics, allPlayers, targetPlayer, comparisonPlayers, isPercentageCategory, category])

  // Generate colors for comparison players
  const getPlayerColor = (player: ComparisonPlayer) => {
    return player.color || getContrastColor(getTeamPrimaryColor(player.teamTricode))
  }

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%',
      bgcolor: '#000',
      p: 0.25,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      pb: 0 // Remove bottom padding to give more room
    }}>
      {/* Radar Chart */}
      <Box sx={{ position: 'relative', mb: 0 }}>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={chartData}>
            <PolarGrid stroke="rgba(255, 199, 44, 0.2)" />
            <PolarAngleAxis 
              dataKey="metric" 
              tick={{ fill: '#FFC72C', fontSize: 12, fontWeight: 600 }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, maxValue]} 
              tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}
              tickCount={5}
            />
            
            {/* Target Player Radar - Use color from props (should be gold #FFC72C) */}
            <Radar
              name={targetPlayer.name}
              dataKey={targetPlayer.name}
              stroke={targetPlayer.color || '#FFC72C'} // Use passed color (bright gold)
              fill={targetPlayer.color || '#FFC72C'}
              fillOpacity={1.0} // 100% opacity for target player
              strokeOpacity={1.0} // 100% stroke opacity for target player
              strokeWidth={8} // Very thick stroke
              dot={{ r: 6, fill: targetPlayer.color || '#FFC72C', strokeWidth: 2, stroke: '#000', opacity: 1.0 }} // Large, outlined dots at 100% opacity
            />
            
            {/* Comparison Players Radars - 25% opacity */}
            {comparisonPlayers.map((player, idx) => (
              <Radar
                key={idx}
                name={player.name}
                dataKey={player.name}
                stroke={getPlayerColor(player)}
                fill={getPlayerColor(player)}
                fillOpacity={0.25} // 25% opacity for comparison players
                strokeOpacity={0.25} // 25% stroke opacity for comparison players
                strokeWidth={1} // Thin stroke
                dot={{ r: 1, fill: getPlayerColor(player), opacity: 0.25 }} // Small, faint dots at 25% opacity
              />
            ))}
            
            <Legend 
              wrapperStyle={{ 
                paddingTop: '5px',
                paddingBottom: '0px',
                marginTop: '-10px',
                fontSize: '11px',
                fontWeight: 600
              }}
              iconType="circle"
            />
          </RadarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  )
}

