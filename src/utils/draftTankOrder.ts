/**
 * Tank tab ordering + lottery display odds (same as StandingsModule in Today.tsx).
 * Worst record first; GB relative to worst team; lottery % for picks 1–14.
 */

/** NBA draft lottery odds by pick position (1 = worst record). Top 4% and #1 Ovr% per tankathon-style. */
export const LOTTERY_TOP4_PCT = [
  52.1, 52.1, 52.1, 48.1, 42.1, 37.2, 32.0, 26.3, 20.3, 13.9, 9.4, 7.1, 4.8, 2.4,
];
export const LOTTERY_ONE_OVR_PCT = [
  14.0, 14.0, 14.0, 12.5, 10.5, 9.0, 7.5, 6.0, 4.5, 3.0, 2.0, 1.5, 1.0, 0.5,
];

export interface TankStandingsRow {
  team_id: number;
  team_abbreviation: string;
  team_name?: string;
  wins: number;
  losses: number;
  win_percentage: number;
}

export interface TankOrderRow extends TankStandingsRow {
  pick: number;
  tankGb: number;
  top4Pct: number | null;
  oneOvrPct: number | null;
}

export function buildTankOrder(east: TankStandingsRow[], west: TankStandingsRow[]): TankOrderRow[] {
  const all = [...east, ...west];
  all.sort((a, b) => {
    const pctA = a.win_percentage ?? 0;
    const pctB = b.win_percentage ?? 0;
    return pctA - pctB;
  });
  const leader = all[0];
  const leaderW = leader?.wins ?? 0;
  const leaderL = leader?.losses ?? 0;
  return all.map((t, i) => {
    const w = t.wins ?? 0;
    const l = t.losses ?? 0;
    const gb = leader ? w - leaderW + (leaderL - l) / 2 : 0;
    const pick = i + 1;
    const top4 = pick <= 14 ? LOTTERY_TOP4_PCT[pick - 1] : null;
    const oneOvr = pick <= 14 ? LOTTERY_ONE_OVR_PCT[pick - 1] : null;
    return { ...t, pick, tankGb: gb, top4Pct: top4, oneOvrPct: oneOvr };
  });
}
