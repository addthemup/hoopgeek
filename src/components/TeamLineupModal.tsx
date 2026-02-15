import { useState, useEffect } from 'react';
import {
  Box,
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Stack,
  Chip,
  CircularProgress,
  Avatar,
} from '@mui/joy';
import { supabase } from '../utils/supabase';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';

// ── Slot definitions ──
const SLOTS = ['s1', 's2', 's3', 's4', 's5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] as const;

interface PlayerSlot {
  slot: string;
  role: 'Starter' | 'Bench';
  playerName: string;
  teamAbbreviation: string | null;
  fantasyPoints: number;
  salary: number;
  gamesPlayed?: number; // only TOTW
  playerId: string | null;
}

interface TeamLineupData {
  players: PlayerSlot[];
  totalSalary: number;
  totalFP: number;
  salaryCap: number;
}

// ── Props ──
export interface TeamLineupModalProps {
  open: boolean;
  onClose: () => void;
  type: 'totn' | 'totw';
  // TOTN identifier
  gameDate?: string;
  // TOTW identifier
  weekStart?: string;
  weekEnd?: string;
  weekNumber?: number;
  // highlight which player this was opened from
  highlightPlayerId?: string;
}

// ── Fetch helpers ──
async function fetchTotnRow(gameDate: string) {
  const cols = [
    'salary_cap', 'total_salary', 'total_fantasy_points',
    ...SLOTS.flatMap(s => [`${s}_player_id`, `${s}_fantasy_points`, `${s}_salary`]),
  ].join(',');

  const { data, error } = await supabase
    .from('nba_totn')
    .select(cols)
    .eq('game_date', gameDate)
    .single();

  if (error || !data) return null;
  return data;
}

async function fetchTotwRow(weekStart: string, weekEnd: string) {
  const cols = [
    'salary_cap', 'total_salary', 'total_avg_fantasy_points',
    ...SLOTS.flatMap(s => [`${s}_player_id`, `${s}_avg_fantasy_points`, `${s}_salary`, `${s}_games_played`]),
  ].join(',');

  const { data, error } = await supabase
    .from('nba_totw')
    .select(cols)
    .eq('week_start', weekStart)
    .eq('week_end', weekEnd)
    .single();

  if (error || !data) return null;
  return data;
}

async function fetchPlayerNames(ids: string[]): Promise<Record<string, { name: string; team_abbreviation: string | null }>> {
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from('nba_players')
    .select('id, name, team_abbreviation')
    .in('id', ids);

  const map: Record<string, { name: string; team_abbreviation: string | null }> = {};
  for (const p of data || []) {
    map[p.id] = { name: p.name, team_abbreviation: p.team_abbreviation };
  }
  return map;
}

// ── Component ──
export default function TeamLineupModal({
  open,
  onClose,
  type,
  gameDate,
  weekStart,
  weekEnd,
  weekNumber,
  highlightPlayerId,
}: TeamLineupModalProps) {
  const [loading, setLoading] = useState(false);
  const [lineup, setLineup] = useState<TeamLineupData | null>(null);

  useEffect(() => {
    if (!open) {
      setLineup(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let row: any = null;
        if (type === 'totn' && gameDate) {
          row = await fetchTotnRow(gameDate);
        } else if (type === 'totw' && weekStart && weekEnd) {
          row = await fetchTotwRow(weekStart, weekEnd);
        }
        if (!row || cancelled) return;

        // Collect all player IDs
        const playerIds: string[] = [];
        for (const s of SLOTS) {
          const pid = row[`${s}_player_id`];
          if (pid) playerIds.push(pid);
        }

        const names = await fetchPlayerNames(playerIds);
        if (cancelled) return;

        const players: PlayerSlot[] = [];
        for (const s of SLOTS) {
          const pid = row[`${s}_player_id`];
          if (!pid) continue;

          const info = names[pid] || { name: 'Unknown', team_abbreviation: null };
          const fpKey = type === 'totn' ? `${s}_fantasy_points` : `${s}_avg_fantasy_points`;

          players.push({
            slot: s,
            role: s.startsWith('s') ? 'Starter' : 'Bench',
            playerName: info.name,
            teamAbbreviation: info.team_abbreviation,
            fantasyPoints: Number(row[fpKey]) || 0,
            salary: Number(row[`${s}_salary`]) || 0,
            gamesPlayed: type === 'totw' ? (Number(row[`${s}_games_played`]) || 0) : undefined,
            playerId: pid,
          });
        }

        const totalSalary = Number(row.total_salary) || 0;
        const totalFP = Number(type === 'totn' ? row.total_fantasy_points : row.total_avg_fantasy_points) || 0;
        const salaryCap = Number(row.salary_cap) || 208_000_000;

        setLineup({ players, totalSalary, totalFP, salaryCap });
      } catch (err) {
        console.error('Failed to load team lineup:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open, type, gameDate, weekStart, weekEnd]);

  // ── Title ──
  let title = '';
  if (type === 'totn' && gameDate) {
    title = `Team of the Night — ${new Date(gameDate + 'T00:00:00').toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  } else if (type === 'totw' && weekStart && weekEnd) {
    const ws = new Date(weekStart + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' });
    const we = new Date(weekEnd + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' });
    title = `Team of the Week ${weekNumber ? `#${weekNumber}` : ''} — ${ws} – ${we}`;
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          bgcolor: '#0a0a0a',
          borderColor: '#333333',
          border: '1px solid #333333',
          p: 0,
          width: { xs: '95vw', sm: '540px' },
          maxHeight: '90vh',
          overflow: 'hidden',
          borderRadius: '12px',
        }}
      >
        <ModalClose
          sx={{
            color: '#FFFFFF',
            bgcolor: 'rgba(255,255,255,0.08)',
            borderRadius: '50%',
            top: 12,
            right: 12,
            zIndex: 10,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
          }}
        />

        {/* Header */}
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2, borderBottom: '1px solid #1a1a1a' }}>
          <Typography level="title-lg" sx={{ color: '#FFFFFF', fontWeight: 700, fontSize: { xs: '15px', sm: '17px' }, pr: 4 }}>
            {title}
          </Typography>
          {lineup && (
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Typography level="body-xs" sx={{ color: '#999999' }}>
                Total FP: <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{lineup.totalFP.toFixed(1)}</span>
              </Typography>
              <Typography level="body-xs" sx={{ color: '#999999' }}>
                Salary: <span style={{ color: lineup.totalSalary > lineup.salaryCap ? '#ff6b6b' : '#FFFFFF', fontWeight: 600 }}>${lineup.totalSalary.toLocaleString()}</span>
              </Typography>
            </Stack>
          )}
        </Box>

        {/* Body */}
        <Box sx={{ overflowY: 'auto', maxHeight: 'calc(90vh - 100px)' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size="md" sx={{ '--CircularProgress-trackColor': '#333', '--CircularProgress-progressColor': '#fff' }} />
            </Box>
          ) : !lineup || lineup.players.length === 0 ? (
            <Typography level="body-sm" sx={{ color: '#999999', textAlign: 'center', py: 6 }}>
              No lineup data available.
            </Typography>
          ) : (
            <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 2 }}>
              {/* Starters */}
              <Typography level="body-xs" sx={{ color: '#666666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', px: 1, pt: 1.5, pb: 0.5 }}>
                Starters
              </Typography>
              <Stack spacing={0}>
                {lineup.players.filter(p => p.role === 'Starter').map((p) => (
                  <PlayerRow key={p.slot} player={p} isHighlighted={p.playerId === highlightPlayerId} type={type} />
                ))}
              </Stack>

              {/* Bench */}
              <Typography level="body-xs" sx={{ color: '#666666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', px: 1, pt: 2, pb: 0.5 }}>
                Bench
              </Typography>
              <Stack spacing={0}>
                {lineup.players.filter(p => p.role === 'Bench').map((p) => (
                  <PlayerRow key={p.slot} player={p} isHighlighted={p.playerId === highlightPlayerId} type={type} />
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </ModalDialog>
    </Modal>
  );
}

// ── Individual player row ──
function PlayerRow({ player, isHighlighted, type }: { player: PlayerSlot; isHighlighted: boolean; type: 'totn' | 'totw' }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, sm: 1.5 },
        px: 1,
        py: 1,
        borderRadius: '8px',
        bgcolor: isHighlighted ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
        border: isHighlighted ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
        transition: 'background 0.15s',
        '&:hover': {
          bgcolor: isHighlighted ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
        },
      }}
    >
      {/* Team logo */}
      <Avatar
        src={player.teamAbbreviation ? getTeamLogoUrl(player.teamAbbreviation) : undefined}
        alt={player.teamAbbreviation || ''}
        sx={{ width: 28, height: 28, bgcolor: '#1a1a1a', flexShrink: 0 }}
      />

      {/* Name + team */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          level="body-sm"
          sx={{
            color: isHighlighted ? '#93bbfc' : '#FFFFFF',
            fontWeight: isHighlighted ? 700 : 500,
            fontSize: { xs: '13px', sm: '14px' },
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {player.playerName}
        </Typography>
        <Typography level="body-xs" sx={{ color: '#666666', fontSize: '11px' }}>
          {player.teamAbbreviation || '—'}
          {type === 'totw' && player.gamesPlayed !== undefined && ` · ${player.gamesPlayed} GP`}
        </Typography>
      </Box>

      {/* FP */}
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600, fontSize: { xs: '13px', sm: '14px' } }}>
          {player.fantasyPoints.toFixed(1)}
        </Typography>
        <Typography level="body-xs" sx={{ color: '#666666', fontSize: '11px' }}>
          {type === 'totn' ? 'FP' : 'Avg FP'}
        </Typography>
      </Box>

      {/* Salary chip */}
      <Chip
        size="sm"
        variant="soft"
        sx={{
          bgcolor: '#1a1a1a',
          color: '#CCCCCC',
          fontWeight: 500,
          fontSize: { xs: '10px', sm: '11px' },
          borderRadius: '6px',
          flexShrink: 0,
          minWidth: { xs: '60px', sm: '72px' },
          justifyContent: 'center',
        }}
      >
        ${(player.salary / 1_000_000).toFixed(1)}M
      </Chip>
    </Box>
  );
}
