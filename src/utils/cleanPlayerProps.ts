/**
 * Utility functions to clean and enrich player_props data
 * Uses raw_odd_data to extract richer information and deduplicate over/under pairs
 */

export interface CleanedPlayerProp {
  // Original fields
  id: string;
  game_id: string;
  event_id: string;
  player_name: string;
  player_id: string | null;
  nba_player_id: number;
  bet_type: string;
  line: number;
  game_date: string;
  created_at: string;
  updated_at: string;
  
  // Enhanced fields from raw_odd_data
  period: 'game' | '1q' | '2q' | '3q' | '4q' | '1h' | '2h';
  scoringSupported: boolean;
  
  // Combined over/under data
  over: {
    id: string;
    price: string;
    american_odds: string;
    bookOdds: string;
    fairOdds: string;
    openBookOdds: string;
    openFairOdds: string;
    bookmaker: string;
    bookmaker_id: string;
  } | null;
  
  under: {
    id: string;
    price: string;
    american_odds: string;
    bookOdds: string;
    fairOdds: string;
    openBookOdds: string;
    openFairOdds: string;
    bookmaker: string;
    bookmaker_id: string;
  } | null;
  
  // Line information
  currentLine: number;
  fairLine: number;
  openLine: number;
  lineMovement: number; // positive = line moved up, negative = line moved down
  
  // Bookmaker breakdown (best odds from each book)
  bookmakerOdds: Record<string, {
    over: string;
    under: string;
    line: number;
  }>;
  
  // Best available odds across all books
  bestOverOdds: {
    odds: string;
    bookmaker: string;
  } | null;
  bestUnderOdds: {
    odds: string;
    bookmaker: string;
  } | null;
}

/**
 * Parse raw_odd_data JSON string
 */
function parseRawOddData(rawData: string | null | undefined): any {
  if (!rawData) return null;
  
  try {
    return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  } catch (e) {
    console.warn('Error parsing raw_odd_data:', e);
    return null;
  }
}

/**
 * Convert periodID to normalized period
 */
function normalizePeriod(periodID: string | undefined): 'game' | '1q' | '2q' | '3q' | '4q' | '1h' | '2h' {
  if (!periodID) return 'game';
  
  const normalized = periodID.toLowerCase().trim();
  if (normalized === 'game' || normalized === 'reg') return 'game';
  if (normalized === '1q' || normalized === 'first-quarter') return '1q';
  if (normalized === '2q' || normalized === 'second-quarter') return '2q';
  if (normalized === '3q' || normalized === 'third-quarter') return '3q';
  if (normalized === '4q' || normalized === 'fourth-quarter') return '4q';
  if (normalized === '1h' || normalized === 'first-half') return '1h';
  if (normalized === '2h' || normalized === 'second-half') return '2h';
  
  return 'game';
}

/**
 * Extract bookmaker odds from byBookmaker object
 */
function extractBookmakerOdds(byBookmaker: any): Record<string, { over: string; under: string; line: number }> {
  if (!byBookmaker || typeof byBookmaker !== 'object') return {};
  
  const result: Record<string, { over: string; under: string; line: number }> = {};
  
  Object.entries(byBookmaker).forEach(([bookmaker, data]: [string, any]) => {
    if (data && typeof data === 'object') {
      result[bookmaker] = {
        over: data.odds || '',
        under: '', // Will be filled when we process the under side
        line: data.overUnder || 0,
      };
    }
  });
  
  return result;
}

/**
 * Find best odds from bookmaker breakdown
 */
function findBestOdds(bookmakerOdds: Record<string, any>, side: 'over' | 'under'): { odds: string; bookmaker: string } | null {
  let best: { odds: string; bookmaker: string } | null = null;
  let bestValue = -Infinity;
  
  Object.entries(bookmakerOdds).forEach(([bookmaker, data]: [string, any]) => {
    const oddsStr = side === 'over' ? data.over : data.under;
    if (!oddsStr) return;
    
    // Convert to number for comparison (positive odds are better, negative odds closer to 0 are better)
    const oddsNum = parseInt(oddsStr);
    if (isNaN(oddsNum)) return;
    
    // For positive odds, higher is better; for negative, closer to 0 is better
    const value = oddsNum > 0 ? oddsNum : (1 / Math.abs(oddsNum));
    
    if (value > bestValue) {
      bestValue = value;
      best = { odds: oddsStr, bookmaker };
    }
  });
  
  return best;
}

/**
 * Clean and combine player props
 * Combines over/under pairs into single entries and enriches with raw_odd_data
 */
export function cleanPlayerProps(props: any[]): CleanedPlayerProp[] {
  if (!props || props.length === 0) return [];
  
  // Group props by: player_id + bet_type + line + period
  const propGroups = new Map<string, {
    over: any | null;
    under: any | null;
    base: any;
  }>();
  
  props.forEach((prop) => {
    const rawData = parseRawOddData(prop.raw_odd_data);
    
    // Determine period, stat, and line
    let period: 'game' | '1q' | '2q' | '3q' | '4q' | '1h' | '2h';
    let statID: string;
    let line: number;
    
    if (rawData) {
      period = normalizePeriod(rawData.periodID);
      statID = rawData.statID || prop.bet_type;
      line = rawData.bookOverUnder || prop.line || 0;
    } else {
      // If no raw data, still process but with limited info
      period = normalizePeriod(prop.period || 'game');
      statID = prop.bet_type;
      line = prop.line || 0;
    }
    
    // Create unique key: player + stat + line + period
    const key = `${prop.nba_player_id}_${statID}_${line}_${period}`;
    
    if (!propGroups.has(key)) {
      propGroups.set(key, {
        over: null,
        under: null,
        base: prop,
      });
    }
    
    const group = propGroups.get(key)!;
    
    if (rawData) {
      const sideID = rawData.sideID?.toLowerCase();
      if (sideID === 'over') {
        group.over = prop;
      } else if (sideID === 'under') {
        group.under = prop;
      }
    } else {
      // Fallback: determine side from bet_type_id
      const isOver = prop.bet_type_id?.includes('-over') || prop.bet_type_id?.endsWith('over');
      const isUnder = prop.bet_type_id?.includes('-under') || prop.bet_type_id?.endsWith('under');
      
      if (isOver) group.over = prop;
      if (isUnder) group.under = prop;
    }
  });
  
  // Convert groups to cleaned props
  const cleaned: CleanedPlayerProp[] = [];
  
  propGroups.forEach((group) => {
    const base = group.base;
    const overRaw = group.over ? parseRawOddData(group.over.raw_odd_data) : null;
    const underRaw = group.under ? parseRawOddData(group.under.raw_odd_data) : null;
    
    // Use over raw data as primary source, fallback to under, then base
    const primaryRaw = overRaw || underRaw || parseRawOddData(base.raw_odd_data);
    
    // If no raw data at all, create a minimal cleaned prop
    if (!primaryRaw) {
      const period = normalizePeriod(base.period || 'game');
      const currentLine = typeof base.line === 'number' 
        ? base.line 
        : (base.line ? parseFloat(String(base.line)) : 0);
      const numLine = isNaN(currentLine) ? 0 : currentLine;
      
      const cleanedProp: CleanedPlayerProp = {
        id: base.id,
        game_id: base.game_id,
        event_id: base.event_id || '',
        player_name: base.player_name,
        player_id: base.player_id,
        nba_player_id: base.nba_player_id,
        bet_type: base.bet_type,
        line: numLine,
        game_date: base.game_date,
        created_at: base.created_at,
        updated_at: base.updated_at,
        
        period,
        scoringSupported: true,
        
        over: group.over ? {
          id: group.over.id,
          price: group.over.price || group.over.american_odds || '',
          american_odds: group.over.american_odds || '',
          bookOdds: '',
          fairOdds: '',
          openBookOdds: '',
          openFairOdds: '',
          bookmaker: group.over.bookmaker || 'Consensus',
          bookmaker_id: group.over.bookmaker_id || 'consensus',
        } : null,
        
        under: group.under ? {
          id: group.under.id,
          price: group.under.price || group.under.american_odds || '',
          american_odds: group.under.american_odds || '',
          bookOdds: '',
          fairOdds: '',
          openBookOdds: '',
          openFairOdds: '',
          bookmaker: group.under.bookmaker || 'Consensus',
          bookmaker_id: group.under.bookmaker_id || 'consensus',
        } : null,
        
        currentLine: numLine,
        fairLine: numLine,
        openLine: numLine,
        lineMovement: 0,
        
        bookmakerOdds: {},
        bestOverOdds: null,
        bestUnderOdds: null,
      };
      
      cleaned.push(cleanedProp);
      return;
    }
    
    const period = normalizePeriod(primaryRaw.periodID);
    // Ensure lines are numbers
    const currentLineRaw = primaryRaw.bookOverUnder ?? base.line ?? 0;
    const currentLine = typeof currentLineRaw === 'number' 
      ? currentLineRaw 
      : (currentLineRaw ? parseFloat(String(currentLineRaw)) : 0);
    const numCurrentLine = isNaN(currentLine) ? 0 : currentLine;
    
    const fairLineRaw = primaryRaw.fairOverUnder ?? numCurrentLine;
    const fairLine = typeof fairLineRaw === 'number'
      ? fairLineRaw
      : (fairLineRaw ? parseFloat(String(fairLineRaw)) : numCurrentLine);
    const numFairLine = isNaN(fairLine) ? numCurrentLine : fairLine;
    
    const openLineRaw = primaryRaw.openBookOverUnder ?? numCurrentLine;
    const openLine = typeof openLineRaw === 'number'
      ? openLineRaw
      : (openLineRaw ? parseFloat(String(openLineRaw)) : numCurrentLine);
    const numOpenLine = isNaN(openLine) ? numCurrentLine : openLine;
    
    const lineMovement = numCurrentLine - numOpenLine;
    
    // Extract bookmaker odds
    const bookmakerOdds: Record<string, { over: string; under: string; line: number }> = {};
    
    // Process over side bookmakers
    if (overRaw?.byBookmaker) {
      Object.entries(overRaw.byBookmaker).forEach(([bookmaker, data]: [string, any]) => {
        if (!bookmakerOdds[bookmaker]) {
          bookmakerOdds[bookmaker] = { over: '', under: '', line: numCurrentLine };
        }
        bookmakerOdds[bookmaker].over = data.odds || '';
        const bookLine = data.overUnder ?? numCurrentLine;
        bookmakerOdds[bookmaker].line = typeof bookLine === 'number' ? bookLine : parseFloat(String(bookLine)) || numCurrentLine;
      });
    }
    
    // Process under side bookmakers
    if (underRaw?.byBookmaker) {
      Object.entries(underRaw.byBookmaker).forEach(([bookmaker, data]: [string, any]) => {
        if (!bookmakerOdds[bookmaker]) {
          bookmakerOdds[bookmaker] = { over: '', under: '', line: numCurrentLine };
        }
        bookmakerOdds[bookmaker].under = data.odds || '';
        const bookLine = data.overUnder ?? numCurrentLine;
        bookmakerOdds[bookmaker].line = typeof bookLine === 'number' ? bookLine : parseFloat(String(bookLine)) || numCurrentLine;
      });
    }
    
    // Build cleaned prop
    const cleanedProp: CleanedPlayerProp = {
      id: base.id,
      game_id: base.game_id,
      event_id: base.event_id,
      player_name: base.player_name,
      player_id: base.player_id,
      nba_player_id: base.nba_player_id,
        bet_type: primaryRaw.statID || base.bet_type,
        line: numCurrentLine,
      game_date: base.game_date,
      created_at: base.created_at,
      updated_at: base.updated_at,
      
      period,
      scoringSupported: primaryRaw.scoringSupported !== false,
      
      over: group.over ? {
        id: group.over.id,
        price: group.over.price || group.over.american_odds || '',
        american_odds: group.over.american_odds || '',
        bookOdds: overRaw?.bookOdds || '',
        fairOdds: overRaw?.fairOdds || '',
        openBookOdds: overRaw?.openBookOdds || overRaw?.bookOdds || '',
        openFairOdds: overRaw?.openFairOdds || '',
        bookmaker: group.over.bookmaker || 'Consensus',
        bookmaker_id: group.over.bookmaker_id || 'consensus',
      } : null,
      
      under: group.under ? {
        id: group.under.id,
        price: group.under.price || group.under.american_odds || '',
        american_odds: group.under.american_odds || '',
        bookOdds: underRaw?.bookOdds || '',
        fairOdds: underRaw?.fairOdds || '',
        openBookOdds: underRaw?.openBookOdds || underRaw?.bookOdds || '',
        openFairOdds: underRaw?.openFairOdds || '',
        bookmaker: group.under.bookmaker || 'Consensus',
        bookmaker_id: group.under.bookmaker_id || 'consensus',
      } : null,
      
      currentLine: numCurrentLine,
      fairLine: numFairLine,
      openLine: numOpenLine,
      lineMovement,
      
      bookmakerOdds,
      bestOverOdds: findBestOdds(bookmakerOdds, 'over'),
      bestUnderOdds: findBestOdds(bookmakerOdds, 'under'),
    };
    
    cleaned.push(cleanedProp);
  });
  
  return cleaned;
}

/**
 * Filter props by period (game, quarter, etc.)
 */
export function filterPropsByPeriod(props: CleanedPlayerProp[], period: 'game' | '1q' | '2q' | '3q' | '4q' | '1h' | '2h' | 'all'): CleanedPlayerProp[] {
  if (period === 'all') return props;
  return props.filter(p => p.period === period);
}

/**
 * Filter props to only game-level (exclude quarters/halves)
 */
export function filterGamePropsOnly(props: CleanedPlayerProp[]): CleanedPlayerProp[] {
  return props.filter(p => p.period === 'game');
}

/**
 * Sort props by various criteria
 */
export function sortProps(
  props: CleanedPlayerProp[],
  sortBy: 'line' | 'fairOdds' | 'lineMovement' | 'player' = 'player'
): CleanedPlayerProp[] {
  const sorted = [...props];
  
  switch (sortBy) {
    case 'line':
      sorted.sort((a, b) => b.currentLine - a.currentLine);
      break;
    case 'fairOdds':
      // Sort by best fair odds value (for over, prefer positive; for under, prefer negative)
      sorted.sort((a, b) => {
        const aOdds = a.over?.fairOdds ? parseInt(a.over.fairOdds) : 0;
        const bOdds = b.over?.fairOdds ? parseInt(b.over.fairOdds) : 0;
        return bOdds - aOdds; // Higher is better
      });
      break;
    case 'lineMovement':
      sorted.sort((a, b) => Math.abs(b.lineMovement) - Math.abs(a.lineMovement));
      break;
    case 'player':
    default:
      sorted.sort((a, b) => {
        const nameA = a.player_name.toLowerCase();
        const nameB = b.player_name.toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.bet_type.localeCompare(b.bet_type);
      });
      break;
  }
  
  return sorted;
}
