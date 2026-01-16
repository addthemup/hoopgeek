import { supabase } from './supabase';

/**
 * Prop Result - whether a player hit or missed a prop
 */
export interface PropResult {
  propId: string;
  betType: string;
  line: number;
  actualValue: number;
  hit: boolean; // true if over hit, false if under hit
  result: 'over' | 'under' | 'push'; // push if exactly on the line
}

/**
 * Player Prop Hit Rate for a day
 */
export interface PlayerPropHitRate {
  playerId: string;
  nbaPlayerId: number;
  playerName: string;
  gameDate: string;
  totalProps: number;
  oversHit: number;
  undersHit: number;
  pushes: number;
  hitRate: number; // Percentage of overs hit (0-100)
  trend: 'hot' | 'cold' | 'neutral'; // hot = high hit rate, cold = low hit rate
}

/**
 * Calculate if a player hit a specific prop by comparing to boxscore
 */
export function calculatePropResult(
  betType: string,
  line: number,
  boxscore: {
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
    tov?: number;
    fg3m?: number;
    fg3a?: number;
    ftm?: number;
    fta?: number;
    fgm?: number;
    fga?: number;
  }
): PropResult | null {
  // Normalize bet type to lowercase and handle variations
  const normalizedBetType = betType.toLowerCase().trim().replace(/\s+/g, '').replace(/_/g, '+');
  
  let actualValue = 0;
  
  // Handle combined props first
  if (normalizedBetType.includes('points+rebounds+assists') || normalizedBetType.includes('par')) {
    actualValue = (boxscore.pts || 0) + (boxscore.reb || 0) + (boxscore.ast || 0);
  } else if (normalizedBetType.includes('points+rebounds') || normalizedBetType.includes('pts+reb')) {
    actualValue = (boxscore.pts || 0) + (boxscore.reb || 0);
  } else if (normalizedBetType.includes('points+assists') || normalizedBetType.includes('pts+ast')) {
    actualValue = (boxscore.pts || 0) + (boxscore.ast || 0);
  } else if (normalizedBetType.includes('rebounds+assists') || normalizedBetType.includes('reb+ast')) {
    actualValue = (boxscore.reb || 0) + (boxscore.ast || 0);
  } else if (normalizedBetType.includes('blocks+steals') || normalizedBetType.includes('stocks')) {
    actualValue = (boxscore.blk || 0) + (boxscore.stl || 0);
  } else {
    // Single stat props - map bet types to boxscore fields
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
    };

    // Find matching field
    const field = betTypeMap[normalizedBetType];
    if (!field) {
      // Silently return null for unknown bet types (don't spam console)
      return null;
    }

    actualValue = boxscore[field] ?? 0;
  }

  // Calculate result
  let hit: boolean;
  let result: 'over' | 'under' | 'push';

  if (actualValue > line) {
    hit = true; // Over hit
    result = 'over';
  } else if (actualValue < line) {
    hit = false; // Under hit
    result = 'under';
  } else {
    hit = false; // Push (exactly on line, typically doesn't count as hit)
    result = 'push';
  }

  return {
    propId: `${betType}-${line}`,
    betType,
    line,
    actualValue,
    hit,
    result,
  };
}

/**
 * Calculate prop results for all props for a player in a game
 */
export async function calculatePlayerPropResults(
  nbaPlayerId: number,
  gameId: string,
  gameDate: string
): Promise<PropResult[]> {
  // Fetch boxscore for this player/game
  const { data: boxscore, error: boxscoreError } = await supabase
    .from('nba_boxscores')
    .select('pts, reb, ast, stl, blk, tov, fg3m, ftm')
    .eq('nba_player_id', nbaPlayerId)
    .eq('game_id', gameId)
    .single();

  if (boxscoreError || !boxscore) {
    console.warn(`⚠️ No boxscore found for player ${nbaPlayerId} in game ${gameId}`);
    return [];
  }

  // Fetch all props for this player on this game date
  const { data: props, error: propsError } = await supabase
    .from('player_props')
    .select('id, bet_type, line, game_date')
    .eq('nba_player_id', nbaPlayerId)
    .eq('game_date', gameDate);

  if (propsError || !props || props.length === 0) {
    console.log(`ℹ️ No props found for player ${nbaPlayerId} on ${gameDate}`);
    return [];
  }

  // Calculate results for each prop
  const results: PropResult[] = [];
  for (const prop of props) {
    const result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore);
    if (result) {
      results.push({
        ...result,
        propId: prop.id,
      });
    }
  }

  return results;
}

/**
 * Calculate daily hit rate for a player (percentage of overs hit)
 */
export async function calculatePlayerDailyHitRate(
  nbaPlayerId: number,
  gameDate: string
): Promise<PlayerPropHitRate | null> {
  // Get player info
  const { data: player, error: playerError } = await supabase
    .from('nba_players')
    .select('id, nba_player_id, name')
    .eq('nba_player_id', nbaPlayerId)
    .single();

  if (playerError || !player) {
    console.warn(`⚠️ Player not found: ${nbaPlayerId}`);
    return null;
  }

  // Get all props for this player on this date
  const { data: props, error: propsError } = await supabase
    .from('player_props')
    .select('id, bet_type, line, game_id, game_date')
    .eq('nba_player_id', nbaPlayerId)
    .eq('game_date', gameDate);

  if (propsError || !props || props.length === 0) {
    return null; // No props available
  }

  // Get unique game IDs
  const gameIds = [...new Set(props.map(p => p.game_id))];

  // Fetch boxscores for all games this player played on this date
  const { data: boxscores, error: boxscoreError } = await supabase
    .from('nba_boxscores')
    .select('game_id, pts, reb, ast, stl, blk, tov, fg3m, ftm')
    .eq('nba_player_id', nbaPlayerId)
    .in('game_id', gameIds);

  if (boxscoreError || !boxscores || boxscores.length === 0) {
    // Game hasn't been played yet or no boxscore available
    return null;
  }

  // Create a map of game_id to boxscore
  const boxscoreMap = new Map(
    boxscores.map(bs => [bs.game_id, bs])
  );

  // Calculate results for each prop
  let oversHit = 0;
  let undersHit = 0;
  let pushes = 0;
  let totalProps = 0;

  for (const prop of props) {
    const boxscore = boxscoreMap.get(prop.game_id);
    if (!boxscore) continue; // No boxscore for this game yet

    const result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore);
    if (!result) continue;

    totalProps++;
    if (result.result === 'over') {
      oversHit++;
    } else if (result.result === 'under') {
      undersHit++;
    } else {
      pushes++;
    }
  }

  if (totalProps === 0) {
    return null;
  }

  // Calculate hit rate (percentage of overs hit)
  const hitRate = (oversHit / totalProps) * 100;

  // Determine trend
  let trend: 'hot' | 'cold' | 'neutral';
  if (hitRate >= 70) {
    trend = 'hot'; // Trending hot - hitting overs
  } else if (hitRate <= 30) {
    trend = 'cold'; // Trending cold - missing overs
  } else {
    trend = 'neutral';
  }

  return {
    playerId: player.id,
    nbaPlayerId: player.nba_player_id,
    playerName: player.name,
    gameDate,
    totalProps,
    oversHit,
    undersHit,
    pushes,
    hitRate,
    trend,
  };
}

/**
 * Get player prop hit rate for today
 */
export async function getPlayerPropHitRateToday(
  nbaPlayerId: number
): Promise<PlayerPropHitRate | null> {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  return calculatePlayerDailyHitRate(nbaPlayerId, todayStr);
}

