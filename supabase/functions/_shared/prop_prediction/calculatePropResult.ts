/**
 * Same logic as src/utils/playerPropsCalculator.ts calculatePropResult (Deno bundle).
 */
export function calculatePropResult(
  betType: string,
  line: number,
  boxscore: {
    pts?: number
    reb?: number
    ast?: number
    stl?: number
    blk?: number
    tov?: number
    fg3m?: number
    fg3a?: number
    ftm?: number
    fta?: number
    fgm?: number
    fga?: number
  },
): { result: 'over' | 'under' | 'push'; actualValue: number } | null {
  const normalizedBetType = betType.toLowerCase().trim().replace(/\s+/g, '').replace(/_/g, '+')

  let actualValue = 0

  if (normalizedBetType.includes('points+rebounds+assists') || normalizedBetType.includes('par')) {
    actualValue = (boxscore.pts || 0) + (boxscore.reb || 0) + (boxscore.ast || 0)
  } else if (normalizedBetType.includes('points+rebounds') || normalizedBetType.includes('pts+reb')) {
    actualValue = (boxscore.pts || 0) + (boxscore.reb || 0)
  } else if (normalizedBetType.includes('points+assists') || normalizedBetType.includes('pts+ast')) {
    actualValue = (boxscore.pts || 0) + (boxscore.ast || 0)
  } else if (normalizedBetType.includes('rebounds+assists') || normalizedBetType.includes('reb+ast')) {
    actualValue = (boxscore.reb || 0) + (boxscore.ast || 0)
  } else if (normalizedBetType.includes('blocks+steals') || normalizedBetType.includes('stocks')) {
    actualValue = (boxscore.blk || 0) + (boxscore.stl || 0)
  } else if (
    normalizedBetType.includes('twopointersmade') ||
    normalizedBetType.includes('two-pointers-made') ||
    normalizedBetType === '2pm'
  ) {
    const fgm = boxscore.fgm ?? 0
    const fg3m = boxscore.fg3m ?? 0
    actualValue = Math.max(0, fgm - fg3m)
  } else if (
    normalizedBetType.includes('twopointersattempted') ||
    normalizedBetType.includes('two-pointers-attempted') ||
    normalizedBetType === '2pa'
  ) {
    const fga = boxscore.fga ?? 0
    const fg3a = boxscore.fg3a ?? 0
    actualValue = Math.max(0, fga - fg3a)
  } else {
    const betTypeMap: Record<string, keyof typeof boxscore> = {
      points: 'pts',
      point: 'pts',
      pts: 'pts',
      rebounds: 'reb',
      rebound: 'reb',
      reb: 'reb',
      assists: 'ast',
      assist: 'ast',
      ast: 'ast',
      steals: 'stl',
      steal: 'stl',
      stl: 'stl',
      blocks: 'blk',
      block: 'blk',
      blk: 'blk',
      turnovers: 'tov',
      turnover: 'tov',
      tov: 'tov',
      'three-pointers': 'fg3m',
      'three-pointer': 'fg3m',
      '3-pointers': 'fg3m',
      '3-pointer': 'fg3m',
      '3pt': 'fg3m',
      '3pm': 'fg3m',
      threes: 'fg3m',
      threepointersmade: 'fg3m',
      threepointersattempted: 'fg3a',
      'three-pointers-attempted': 'fg3a',
      '3-pointers-attempted': 'fg3a',
      '3pta': 'fg3a',
      'free-throws': 'ftm',
      'free-throw': 'ftm',
      freethrowsmade: 'ftm',
      freethrowsattempted: 'fta',
      'free-throws-made': 'ftm',
      'free-throws-attempted': 'fta',
      ftm: 'ftm',
      fta: 'fta',
      fieldgoalsmade: 'fgm',
      fieldgoalsattempted: 'fga',
      'field-goals-made': 'fgm',
      'field-goals-attempted': 'fga',
      fgm: 'fgm',
      fga: 'fga',
      twopointersmade: 'fgm',
      twopointersattempted: 'fga',
      'two-pointers-made': 'fgm',
      'two-pointers-attempted': 'fga',
      '2pm': 'fgm',
      '2pa': 'fga',
    }

    const field = betTypeMap[normalizedBetType]
    if (!field) return null
    actualValue = boxscore[field] ?? 0
  }

  let result: 'over' | 'under' | 'push'
  if (actualValue > line) result = 'over'
  else if (actualValue < line) result = 'under'
  else result = 'push'

  return { result, actualValue }
}
