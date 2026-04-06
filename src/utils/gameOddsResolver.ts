export type TeamSide = 'away' | 'home';

export interface TeamLinesByGame {
  homeSpread: number;
  awaySpread: number;
  homeSpreadOdds: string | null;
  awaySpreadOdds: string | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  homeMoneylineOdds: string | null;
  awayMoneylineOdds: string | null;
}

export interface ResolvedGameTeamLines {
  homeSpread: number | null;
  awaySpread: number | null;
  homeSpreadOdds: string | null;
  awaySpreadOdds: string | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  homeMoneylineOdds: string | null;
  awayMoneylineOdds: string | null;
}

function mlToImplied(american: number): number {
  if (american >= 0) return 100 / (100 + american);
  return Math.abs(american) / (Math.abs(american) + 100);
}

export function moneylineToApproxSpread(homeMl: number, awayMl: number): { homeSpread: number; awaySpread: number } | null {
  const homeImplied = mlToImplied(homeMl);
  const awayImplied = mlToImplied(awayMl);
  const sum = homeImplied + awayImplied;
  if (sum < 0.01) return null;
  const homeFair = homeImplied / sum;
  const diff = homeFair - 0.5;
  const spreadHalf = Math.max(-15, Math.min(15, diff * 24));
  const homeSpread = Math.round(spreadHalf * 2) / 2;
  const awaySpread = Math.round(-spreadHalf * 2) / 2;
  return { homeSpread, awaySpread };
}

export function parseAmericanOddsNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatAmericanOdds(value: unknown): string | null {
  const parsed = parseAmericanOddsNumber(value);
  if (parsed == null) return null;
  const rounded = Math.round(parsed);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

export function inferPropSide(text: string, homeTricode: string, awayTricode: string): TeamSide | null {
  const lower = text.toLowerCase();
  if (lower.includes('-home') || lower.includes(' home')) return 'home';
  if (lower.includes('-away') || lower.includes(' away')) return 'away';
  if (homeTricode && lower.includes(homeTricode.toLowerCase())) return 'home';
  if (awayTricode && lower.includes(awayTricode.toLowerCase())) return 'away';
  return null;
}

export function resolveGameTeamLines(params: {
  homeTricode: string;
  awayTricode: string;
  gameProps: any[];
  initial: Partial<ResolvedGameTeamLines>;
}): ResolvedGameTeamLines {
  let homeSpread = params.initial.homeSpread ?? null;
  let awaySpread = params.initial.awaySpread ?? null;
  let homeSpreadOdds = params.initial.homeSpreadOdds ?? null;
  let awaySpreadOdds = params.initial.awaySpreadOdds ?? null;
  let homeMoneyline = params.initial.homeMoneyline ?? null;
  let awayMoneyline = params.initial.awayMoneyline ?? null;
  let homeMoneylineOdds = params.initial.homeMoneylineOdds ?? null;
  let awayMoneylineOdds = params.initial.awayMoneylineOdds ?? null;

  if (params.gameProps.length > 0) {
    const homeTri = String(params.homeTricode || '').toUpperCase();
    const awayTri = String(params.awayTricode || '').toUpperCase();
    for (const prop of params.gameProps) {
      const text = `${prop?.bet_type_id ?? ''} ${prop?.bet_type ?? ''}`;
      const side = inferPropSide(text, homeTri, awayTri);
      if (!side) continue;
      const lower = text.toLowerCase();
      const lineNum = typeof prop?.line === 'number' ? prop.line : parseFloat(String(prop?.line ?? ''));
      const oddsText = formatAmericanOdds(prop?.american_odds ?? prop?.price);
      const isSpreadProp = lower.includes('spread');
      const isMoneylineProp = lower.includes('moneyline') || lower.includes('-ml-') || lower.includes(' game ml');

      if (isSpreadProp && Number.isFinite(lineNum)) {
        if (side === 'away' && awaySpread == null) awaySpread = lineNum;
        if (side === 'home' && homeSpread == null) homeSpread = lineNum;
        if (side === 'away' && awaySpreadOdds == null) awaySpreadOdds = oddsText;
        if (side === 'home' && homeSpreadOdds == null) homeSpreadOdds = oddsText;
      }

      if (isMoneylineProp) {
        const ml = Number.isFinite(lineNum) ? lineNum : parseAmericanOddsNumber(prop?.american_odds ?? prop?.price);
        if (side === 'away' && awayMoneyline == null) awayMoneyline = ml;
        if (side === 'home' && homeMoneyline == null) homeMoneyline = ml;
        if (side === 'away' && awayMoneylineOdds == null) awayMoneylineOdds = oddsText;
        if (side === 'home' && homeMoneylineOdds == null) homeMoneylineOdds = oddsText;
      }
    }
  }

  if ((homeSpread == null || awaySpread == null) && homeMoneyline != null && awayMoneyline != null) {
    const derived = moneylineToApproxSpread(homeMoneyline, awayMoneyline);
    if (derived) {
      if (homeSpread == null) homeSpread = derived.homeSpread;
      if (awaySpread == null) awaySpread = derived.awaySpread;
      if (homeSpreadOdds == null) homeSpreadOdds = homeMoneylineOdds;
      if (awaySpreadOdds == null) awaySpreadOdds = awayMoneylineOdds;
    }
  }

  if (homeSpread != null && awaySpread == null) awaySpread = -homeSpread;
  if (awaySpread != null && homeSpread == null) homeSpread = -awaySpread;

  return {
    homeSpread,
    awaySpread,
    homeSpreadOdds,
    awaySpreadOdds,
    homeMoneyline,
    awayMoneyline,
    homeMoneylineOdds,
    awayMoneylineOdds,
  };
}
