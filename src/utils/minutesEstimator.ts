export type InjuryStatus = 'Out' | 'Questionable' | 'Day-to-Day' | string;

export interface RotationRosterPlayer {
  nba_player_id: number | null;
  player_id?: string | null;
  player_name: string;
  position?: string | null;
  jersey_number?: string | null;
}

export interface PlayerRecentMinuteGame {
  nba_player_id: number | null;
  player_name: string;
  team_tricode?: string | null;
  game_id?: string | null;
  min: number | string | null;
  game_date?: string | null;
}

export interface PlayerInjurySignal {
  nba_player_id: number | null;
  player_name?: string | null;
  injury_status: InjuryStatus;
}

export interface EstimatedRotationPlayer {
  nba_player_id: number | null;
  player_name: string;
  position?: string | null;
  jersey_number?: string | null;
  baseline_minutes: number;
  injury_delta_minutes: number;
  estimated_minutes: number;
  confidence: 'high' | 'medium' | 'low';
  recent_games_used: number;
  signals: string[];
}

export interface EstimateMinutesOptions {
  lookbackGames?: number;
  floorMinutes?: number;
  ceilingMinutes?: number;
  teamMinutesTarget?: number;
  rotationSizeTarget?: number | null;
  forcedOutPlayerIds?: number[];
  starterRateByPlayerId?: Map<number, number>;
  spread?: number | null;
  spreadThreshold?: number;
  benchShiftPct?: number;
}

const DEFAULT_LOOKBACK = 10;
const DEFAULT_FLOOR = 8;
const DEFAULT_CEILING = 40;
const DEFAULT_BASELINE_IF_NO_DATA = 12;
const DEFAULT_TEAM_MINUTES_TARGET = 240;
const DEFAULT_SPREAD_THRESHOLD = 12;
const DEFAULT_BENCH_SHIFT_PCT = 0.04;

function toMinuteNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function averageRecent(values: number[], n: number): number | null {
  if (!values.length) return null;
  const sample = values.slice(0, Math.min(n, values.length));
  if (!sample.length) return null;
  return sample.reduce((acc, v) => acc + v, 0) / sample.length;
}

function weightedRecentBlend(values: number[]): { blended: number; recentGamesUsed: number } {
  if (!values.length) {
    return {
      blended: DEFAULT_BASELINE_IF_NO_DATA,
      recentGamesUsed: 0,
    };
  }

  const avg3 = averageRecent(values, 3);
  const avg5 = averageRecent(values, 5);
  const avg10 = averageRecent(values, 10);

  const components: Array<{ value: number; weight: number }> = [];
  if (avg3 != null) components.push({ value: avg3, weight: 0.5 });
  if (avg5 != null) components.push({ value: avg5, weight: 0.3 });
  if (avg10 != null) components.push({ value: avg10, weight: 0.2 });

  const weightSum = components.reduce((acc, c) => acc + c.weight, 0);
  if (weightSum <= 0) {
    return {
      blended: DEFAULT_BASELINE_IF_NO_DATA,
      recentGamesUsed: values.length,
    };
  }

  const blended = components.reduce((acc, c) => acc + c.value * c.weight, 0) / weightSum;
  return {
    blended,
    recentGamesUsed: values.length,
  };
}

function normalizePosition(position?: string | null): string {
  return (position ?? '').toUpperCase();
}

function injuryRemovalFactor(status: InjuryStatus): number {
  const normalized = (status ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.includes('out')) return 1;
  if (normalized.includes('questionable')) return 0.15;
  if (normalized.includes('probable')) return 0.075;
  if (normalized.includes('day-to-day') || normalized.includes('day to day')) return 0.3;
  return 0;
}

function normalizeToTeamMinutes(params: {
  players: EstimatedRotationPlayer[];
  targetMinutes: number;
  ceilingMinutes: number;
}) {
  const { players, targetMinutes, ceilingMinutes } = params;
  if (!players.length) return;

  const clamp = (v: number) => Math.max(0, Math.min(ceilingMinutes, v));
  const working = players.map((p) => ({ p, v: clamp(p.estimated_minutes) }));

  for (let i = 0; i < 6; i += 1) {
    const total = working.reduce((acc, row) => acc + row.v, 0);
    if (total <= 0) break;
    const scale = targetMinutes / total;
    let anyClamped = false;
    working.forEach((row) => {
      const next = row.v * scale;
      const bounded = clamp(next);
      anyClamped = anyClamped || Math.abs(next - bounded) > 1e-6;
      row.v = bounded;
    });
    if (!anyClamped) break;
  }

  let total = working.reduce((acc, row) => acc + row.v, 0);
  const diff = targetMinutes - total;
  if (Math.abs(diff) > 1e-6) {
    const ordered = [...working].sort((a, b) => b.v - a.v);
    if (diff > 0) {
      for (const row of ordered) {
        const room = ceilingMinutes - row.v;
        if (room <= 0) continue;
        const add = Math.min(room, targetMinutes - total);
        row.v += add;
        total += add;
        if (total >= targetMinutes - 1e-6) break;
      }
    } else {
      for (const row of ordered) {
        const removable = row.v;
        if (removable <= 0) continue;
        const remove = Math.min(removable, total - targetMinutes);
        row.v -= remove;
        total -= remove;
        if (total <= targetMinutes + 1e-6) break;
      }
    }
  }

  working.forEach(({ p, v }) => {
    p.estimated_minutes = v;
  });
}

export function estimateTeamRotationMinutes(params: {
  roster: RotationRosterPlayer[];
  recentMinutes: PlayerRecentMinuteGame[];
  injuries: PlayerInjurySignal[];
  options?: EstimateMinutesOptions;
}): EstimatedRotationPlayer[] {
  const lookbackGames = Math.max(10, Math.min(15, params.options?.lookbackGames ?? DEFAULT_LOOKBACK));
  const floorMinutes = params.options?.floorMinutes ?? DEFAULT_FLOOR;
  const ceilingMinutes = params.options?.ceilingMinutes ?? DEFAULT_CEILING;
  const teamMinutesTarget = params.options?.teamMinutesTarget ?? DEFAULT_TEAM_MINUTES_TARGET;
  const rotationSizeTarget = params.options?.rotationSizeTarget;
  const forcedOutPlayerIds = params.options?.forcedOutPlayerIds ?? [];
  const starterRateByPlayerId = params.options?.starterRateByPlayerId ?? new Map<number, number>();
  const spread = params.options?.spread;
  const spreadThreshold = params.options?.spreadThreshold ?? DEFAULT_SPREAD_THRESHOLD;
  const benchShiftPct = params.options?.benchShiftPct ?? DEFAULT_BENCH_SHIFT_PCT;

  const recentByPlayer = new Map<number, number[]>();
  const injuryByPlayer = new Map<number, PlayerInjurySignal>();

  params.injuries.forEach((injury) => {
    if (injury.nba_player_id == null) return;
    const existing = injuryByPlayer.get(injury.nba_player_id);
    if (!existing) {
      injuryByPlayer.set(injury.nba_player_id, injury);
      return;
    }

    // If multiple "current" injury rows exist, keep the one with the highest
    // removal factor so OUT beats Questionable/Day-to-Day/other statuses.
    const existingFactor = injuryRemovalFactor(existing.injury_status);
    const nextFactor = injuryRemovalFactor(injury.injury_status);
    if (nextFactor > existingFactor) {
      injuryByPlayer.set(injury.nba_player_id, injury);
    }
  });

  // Ensure utility-flagged OUT players are treated as OUT in the estimator so
  // their minutes are redistributed into the remaining rotation.
  forcedOutPlayerIds.forEach((id) => {
    if (id == null || !Number.isFinite(id)) return;
    const existing = injuryByPlayer.get(id);
    if (!existing || injuryRemovalFactor(existing.injury_status) < 1) {
      injuryByPlayer.set(id, {
        nba_player_id: id,
        player_name: existing?.player_name ?? null,
        injury_status: 'Out',
      });
    }
  });

  params.recentMinutes.forEach((game) => {
    if (game.nba_player_id == null) return;
    const minuteValue = toMinuteNumber(game.min);
    if (minuteValue <= 0) return;
    const existing = recentByPlayer.get(game.nba_player_id) ?? [];
    if (existing.length < lookbackGames) {
      existing.push(minuteValue);
      recentByPlayer.set(game.nba_player_id, existing);
    }
  });

  const estimated: EstimatedRotationPlayer[] = params.roster
    .filter((player) => player.nba_player_id != null)
    .map((player) => {
      const nbaPlayerId = player.nba_player_id as number;
      const recents = recentByPlayer.get(nbaPlayerId) ?? [];
      const recency = weightedRecentBlend(recents);
      const baselineRaw = recency.blended;
      const starterRate = starterRateByPlayerId.get(nbaPlayerId) ?? 0;
      const starterBoost = starterRate >= 0.45 ? Math.min(4, starterRate * 3) : 0;
      const baseline = Math.max(floorMinutes, Math.min(ceilingMinutes, baselineRaw + starterBoost));

      const injury = injuryByPlayer.get(nbaPlayerId);
      const status = injury?.injury_status;
      const outFactor = status ? injuryRemovalFactor(status) : 0;
      const selfPenalty = baseline * outFactor * -1;

      const signals: string[] = [];
      if (status) {
        signals.push(`${status} status`);
      }
      if (recents.length === 0) {
        signals.push('No recent game minutes; fallback baseline applied');
      }
      if (recents.length > 0) {
        signals.push(`3/5/10 blend from ${Math.min(recency.recentGamesUsed, 10)} recent games`);
      }
      if (starterRate > 0) {
        signals.push(`Start rate ${(starterRate * 100).toFixed(0)}% (last 10)`);
      }

      return {
        nba_player_id: nbaPlayerId,
        player_name: player.player_name,
        position: player.position ?? null,
        jersey_number: player.jersey_number ?? null,
        baseline_minutes: baseline,
        injury_delta_minutes: selfPenalty,
        estimated_minutes: Math.max(0, baseline + selfPenalty),
        confidence: recents.length >= 6 ? 'high' : recents.length >= 3 ? 'medium' : 'low',
        recent_games_used: recency.recentGamesUsed,
        signals,
      };
    });

  const removedPlayers = estimated.filter((p) => p.injury_delta_minutes < 0);
  if (!removedPlayers.length) {
    return estimated
      .map((p) => ({
        ...p,
        baseline_minutes: Number(p.baseline_minutes.toFixed(1)),
        injury_delta_minutes: Number(p.injury_delta_minutes.toFixed(1)),
        estimated_minutes: Number(p.estimated_minutes.toFixed(1)),
      }))
      .sort((a, b) => b.estimated_minutes - a.estimated_minutes);
  }

  const distributed = estimated.map((player) => ({ ...player }));
  removedPlayers.forEach((removed) => {
    const removedMinutes = Math.abs(removed.injury_delta_minutes);
    if (removedMinutes <= 0) return;

    const removedPos = normalizePosition(removed.position);
    const removedStarterRate = removed.nba_player_id != null
      ? (starterRateByPlayerId.get(removed.nba_player_id) ?? 0)
      : 0;
    const recipients = distributed.filter((p) => p.injury_delta_minutes >= 0);
    if (!recipients.length) return;

    const weights = recipients.map((candidate) => {
      const candidatePos = normalizePosition(candidate.position);
      const candidateStarterRate = candidate.nba_player_id != null
        ? (starterRateByPlayerId.get(candidate.nba_player_id) ?? 0)
        : 0;
      const samePosition =
        !!removedPos &&
        !!candidatePos &&
        (candidatePos.includes(removedPos) || removedPos.includes(candidatePos));
      const belowInRotation = candidate.baseline_minutes <= removed.baseline_minutes;

      // Prioritize same-position players below the removed player;
      // give smaller spillover to same-position above, then cross-position depth.
      let baseWeight = 0.3;
      if (samePosition && belowInRotation) baseWeight = 2.4;
      else if (samePosition && !belowInRotation) baseWeight = 1.2;
      else if (!samePosition && belowInRotation) baseWeight = 0.6;

      // When a high-minute starter is removed, favor players who have also recently started.
      const starterMultiplier =
        removedStarterRate >= 0.4
          ? 1 + candidateStarterRate * (samePosition ? 1.4 : 0.7)
          : 1 + candidateStarterRate * 0.4;
      return baseWeight * starterMultiplier;
    });

    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    if (totalWeight <= 0) return;

    recipients.forEach((recipient, idx) => {
      const share = weights[idx] / totalWeight;
      const delta = removedMinutes * share;
      if (delta <= 0) return;
      const room = Math.max(0, ceilingMinutes - recipient.estimated_minutes);
      if (room <= 0) return;
      const applied = Math.min(delta, room);
      recipient.injury_delta_minutes += applied;
      recipient.estimated_minutes += applied;
      recipient.signals.push(`Injury boost (${removed.player_name}) +${applied.toFixed(1)}m`);
    });
  });

  // Spread-driven bench bump: in bigger spread games, shift minutes from top rotation to depth.
  if (typeof spread === 'number' && Number.isFinite(spread) && Math.abs(spread) >= spreadThreshold && benchShiftPct > 0) {
    const sortedByMinutes = [...distributed].sort((a, b) => b.estimated_minutes - a.estimated_minutes);
    const topBucketCount = Math.max(3, Math.min(7, Math.round(sortedByMinutes.length * 0.45)));
    const topBucket = sortedByMinutes.slice(0, topBucketCount);
    const benchBucket = sortedByMinutes.slice(topBucketCount);
    if (topBucket.length > 0 && benchBucket.length > 0) {
      const shiftPool = teamMinutesTarget * benchShiftPct;
      const topTotal = topBucket.reduce((acc, p) => acc + p.estimated_minutes, 0);
      if (topTotal > 0 && shiftPool > 0) {
        // Remove from top proportionally.
        topBucket.forEach((player) => {
          const share = player.estimated_minutes / topTotal;
          const delta = shiftPool * share;
          player.estimated_minutes = Math.max(0, player.estimated_minutes - delta);
          player.signals.push(`Spread bench tilt -${delta.toFixed(1)}m`);
        });

        // Give to bench with inverse-minute weighting (favor lower-minute players).
        const benchMax = Math.max(...benchBucket.map((p) => p.estimated_minutes), 0);
        const benchWeights = benchBucket.map((p) => Math.max(0.1, benchMax - p.estimated_minutes + 1));
        const benchWeightTotal = benchWeights.reduce((acc, w) => acc + w, 0);
        benchBucket.forEach((player, idx) => {
          const weight = benchWeights[idx];
          const delta = benchWeightTotal > 0 ? (shiftPool * weight) / benchWeightTotal : 0;
          if (delta > 0) {
            player.estimated_minutes = Math.min(ceilingMinutes, player.estimated_minutes + delta);
            player.signals.push(`Spread bench tilt +${delta.toFixed(1)}m`);
          }
        });
      }
    }
  }

  if (typeof rotationSizeTarget === 'number' && Number.isFinite(rotationSizeTarget) && rotationSizeTarget > 0) {
    const targetCount = Math.max(5, Math.min(distributed.length, Math.round(rotationSizeTarget)));
    const boostedIds = new Set(
      distributed
        .filter((player) => player.injury_delta_minutes >= 1.5 && player.nba_player_id != null)
        .map((player) => player.nba_player_id)
    );
    const keepSet = new Set<number | null>(boostedIds);
    const sortedByMinutes = [...distributed].sort((a, b) => b.estimated_minutes - a.estimated_minutes);
    for (const player of sortedByMinutes) {
      if (keepSet.size >= targetCount) break;
      keepSet.add(player.nba_player_id);
    }
    distributed.forEach((player) => {
      if (!keepSet.has(player.nba_player_id)) {
        if (player.estimated_minutes > 0) {
          player.signals.push('Outside projected rotation');
        }
        player.estimated_minutes = 0;
      }
    });
  }

  normalizeToTeamMinutes({ players: distributed, targetMinutes: teamMinutesTarget, ceilingMinutes });

  return distributed
    .map((p) => ({
      ...p,
      baseline_minutes: Number(p.baseline_minutes.toFixed(1)),
      injury_delta_minutes: Number(p.injury_delta_minutes.toFixed(1)),
      estimated_minutes: Number(p.estimated_minutes.toFixed(1)),
    }))
    .sort((a, b) => b.estimated_minutes - a.estimated_minutes);
}
