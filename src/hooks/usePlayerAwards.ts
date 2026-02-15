import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

// ── nba_pow row ──
export interface PlayerOfWeekAward {
  id: string;
  season: string;
  week_start_date: string;
  conference: string | null;
  is_tie: boolean;
}

// ── nba_pom row ──
export interface PlayerOfMonthAward {
  id: string;
  season: string;
  award_year: number;
  award_month: number;
  conference: string | null;
  is_tie: boolean;
}

// ── nba_totn occurrence ──
export interface TeamOfNightAppearance {
  game_date: string;
  slot: string;          // e.g. "s1", "b3"
  fantasy_points: number;
  salary: number;
}

// ── nba_totw occurrence ──
export interface TeamOfWeekAppearance {
  week_start: string;
  week_end: string;
  week_number: number;
  slot: string;
  avg_fantasy_points: number;
  salary: number;
  games_played: number;
}

export interface PlayerAwards {
  pow: PlayerOfWeekAward[];
  pom: PlayerOfMonthAward[];
  totn: TeamOfNightAppearance[];
  totw: TeamOfWeekAppearance[];
}

const TOTN_SLOTS = ['s1', 's2', 's3', 's4', 's5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] as const;
const TOTW_SLOTS = ['s1', 's2', 's3', 's4', 's5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] as const;

/**
 * Fetch all award appearances for a player across nba_pow, nba_pom, nba_totn, nba_totw.
 */
export function usePlayerAwards(playerId: string | undefined) {
  return useQuery<PlayerAwards>({
    queryKey: ['player-awards', playerId],
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!playerId) throw new Error('No playerId');

      // ── POW: direct player_id FK ──
      const powPromise = supabase
        .from('nba_pow')
        .select('id, season, week_start_date, conference, is_tie')
        .eq('player_id', playerId)
        .order('week_start_date', { ascending: false });

      // ── POM: direct player_id FK ──
      const pomPromise = supabase
        .from('nba_pom')
        .select('id, season, award_year, award_month, conference, is_tie')
        .eq('player_id', playerId)
        .order('award_year', { ascending: false });

      // ── TOTN: denormalized – need to check 12 columns ──
      const totnOrFilter = TOTN_SLOTS.map(s => `${s}_player_id.eq.${playerId}`).join(',');
      const totnPromise = supabase
        .from('nba_totn')
        .select([
          'game_date',
          ...TOTN_SLOTS.flatMap(s => [`${s}_player_id`, `${s}_fantasy_points`, `${s}_salary`]),
        ].join(','))
        .or(totnOrFilter)
        .order('game_date', { ascending: false });

      // ── TOTW: denormalized – need to check 12 columns ──
      const totwOrFilter = TOTW_SLOTS.map(s => `${s}_player_id.eq.${playerId}`).join(',');
      const totwPromise = supabase
        .from('nba_totw')
        .select([
          'week_start', 'week_end', 'week_number',
          ...TOTW_SLOTS.flatMap(s => [`${s}_player_id`, `${s}_avg_fantasy_points`, `${s}_salary`, `${s}_games_played`]),
        ].join(','))
        .or(totwOrFilter)
        .order('week_start', { ascending: false });

      const [powRes, pomRes, totnRes, totwRes] = await Promise.all([
        powPromise, pomPromise, totnPromise, totwPromise,
      ]);

      // ── Parse POW ──
      const pow: PlayerOfWeekAward[] = (powRes.data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        season: r.season as string,
        week_start_date: r.week_start_date as string,
        conference: r.conference as string | null,
        is_tie: r.is_tie as boolean,
      }));

      // ── Parse POM ──
      const pom: PlayerOfMonthAward[] = (pomRes.data || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        season: r.season as string,
        award_year: r.award_year as number,
        award_month: r.award_month as number,
        conference: r.conference as string | null,
        is_tie: r.is_tie as boolean,
      }));

      // ── Parse TOTN: find which slot the player is in per row ──
      const totn: TeamOfNightAppearance[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (totnRes.data || []) as any[]) {
        for (const slot of TOTN_SLOTS) {
          if (row[`${slot}_player_id`] === playerId) {
            totn.push({
              game_date: row.game_date as string,
              slot,
              fantasy_points: Number(row[`${slot}_fantasy_points`]) || 0,
              salary: Number(row[`${slot}_salary`]) || 0,
            });
          }
        }
      }

      // ── Parse TOTW: find which slot the player is in per row ──
      const totw: TeamOfWeekAppearance[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (totwRes.data || []) as any[]) {
        for (const slot of TOTW_SLOTS) {
          if (row[`${slot}_player_id`] === playerId) {
            totw.push({
              week_start: row.week_start as string,
              week_end: row.week_end as string,
              week_number: row.week_number as number,
              slot,
              avg_fantasy_points: Number(row[`${slot}_avg_fantasy_points`]) || 0,
              salary: Number(row[`${slot}_salary`]) || 0,
              games_played: Number(row[`${slot}_games_played`]) || 0,
            });
          }
        }
      }

      return { pow, pom, totn, totw };
    },
  });
}
