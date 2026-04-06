import type { PlayerRecentMinuteGame } from './minutesEstimator';

export interface StarterRateSummary {
  starterRate: number;
  starts: number;
  gamesPlayed: number;
}

export function buildStarterRateMapFromRecentMinutes(
  rows: PlayerRecentMinuteGame[],
  lookbackGames = 10
): Map<number, StarterRateSummary> {
  const byGame = new Map<string, Array<{ nba_player_id: number; min: number }>>();

  rows.forEach((row) => {
    const gameId = String((row as any).game_id ?? '').trim();
    const id = Number(row.nba_player_id);
    const minRaw = typeof row.min === 'number' ? row.min : parseFloat(String(row.min ?? '0'));
    if (!gameId || !Number.isFinite(id) || !Number.isFinite(minRaw) || minRaw <= 0) return;
    const list = byGame.get(gameId) ?? [];
    list.push({ nba_player_id: id, min: minRaw });
    byGame.set(gameId, list);
  });

  const gameIds = Array.from(byGame.keys()).slice(0, Math.max(1, lookbackGames));
  const startsByPlayer = new Map<number, number>();
  const gamesByPlayer = new Map<number, number>();

  gameIds.forEach((gid) => {
    const players = byGame.get(gid) ?? [];
    const ranked = [...players].sort((a, b) => b.min - a.min);
    const starters = new Set(ranked.slice(0, 5).map((p) => p.nba_player_id));

    ranked.forEach((p) => {
      gamesByPlayer.set(p.nba_player_id, (gamesByPlayer.get(p.nba_player_id) ?? 0) + 1);
      if (starters.has(p.nba_player_id)) {
        startsByPlayer.set(p.nba_player_id, (startsByPlayer.get(p.nba_player_id) ?? 0) + 1);
      }
    });
  });

  const summary = new Map<number, StarterRateSummary>();
  Array.from(gamesByPlayer.keys()).forEach((id) => {
    const gamesPlayed = gamesByPlayer.get(id) ?? 0;
    const starts = startsByPlayer.get(id) ?? 0;
    const starterRate = gamesPlayed > 0 ? starts / gamesPlayed : 0;
    summary.set(id, { starterRate, starts, gamesPlayed });
  });

  return summary;
}
