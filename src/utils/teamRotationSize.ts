import { supabase } from './supabase';

export interface TeamRotationSizeSummary {
  averageRotationSize: number;
  gamesCount: number;
}

interface FetchTeamRotationSizeParams {
  teamTricodes: string[];
  asOfDate?: string | null;
  lookbackGames?: number;
}

function toDateOnly(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10);
}

export async function fetchTeamAverageRotationSize({
  teamTricodes,
  asOfDate,
  lookbackGames = 10,
}: FetchTeamRotationSizeParams): Promise<Map<string, TeamRotationSizeSummary>> {
  const teams = Array.from(
    new Set(teamTricodes.map((t) => String(t ?? '').trim().toUpperCase()).filter(Boolean))
  );
  const result = new Map<string, TeamRotationSizeSummary>();
  teams.forEach((team) => result.set(team, { averageRotationSize: 0, gamesCount: 0 }));
  if (!teams.length) return result;

  let query = supabase
    .from('nba_boxscores')
    .select('team_tricode, game_id, game_date, nba_player_id, min')
    .in('team_tricode', teams)
    .gt('min', 0)
    .not('nba_player_id', 'is', null)
    .order('game_date', { ascending: false })
    .limit(Math.max(3000, teams.length * 900));

  const asOfDateOnly = toDateOnly(asOfDate);
  if (asOfDateOnly) {
    query = query.lt('game_date', `${asOfDateOnly}T23:59:59Z`);
  }

  const { data, error } = await query;
  if (error || !data?.length) return result;

  teams.forEach((team) => {
    const teamRows = (data || []).filter((row: any) => String(row.team_tricode ?? '').trim().toUpperCase() === team);
    const gameIds = new Set<string>();
    const playerIdsByGame = new Map<string, Set<number>>();

    for (const row of teamRows) {
      const gameId = String((row as any).game_id ?? '').trim();
      if (!gameId) continue;
      if (!gameIds.has(gameId) && gameIds.size >= lookbackGames) continue;
      gameIds.add(gameId);

      const id = Number((row as any).nba_player_id);
      if (!Number.isFinite(id)) continue;
      const set = playerIdsByGame.get(gameId) ?? new Set<number>();
      set.add(id);
      playerIdsByGame.set(gameId, set);
    }

    const sizes = Array.from(playerIdsByGame.values()).map((set) => set.size);
    if (!sizes.length) {
      result.set(team, { averageRotationSize: 0, gamesCount: 0 });
      return;
    }
    const avg = sizes.reduce((acc, n) => acc + n, 0) / sizes.length;
    result.set(team, {
      averageRotationSize: Number(avg.toFixed(1)),
      gamesCount: sizes.length,
    });
  });

  return result;
}
