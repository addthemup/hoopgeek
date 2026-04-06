/**
 * Shared display for Team of the Week lineup (frozen data).
 * Used by PostStory for team_of_week_module sections.
 * Each player in a card (5 per row, 20% width); click jersey scrolls to that player's section.
 */

import { Box, Typography, Card, Chip, Stack } from '@mui/joy'
import PlayerJersey from '../PlayerJersey'
import type { TeamOfWeekModuleContent, TeamOfWeekPlayerEntry } from '../../types/feed'

function abbreviatePosition(pos: string | null | undefined): string {
  if (!pos) return ''
  const u = pos.toUpperCase()
  if (u.includes('CENTER') || u === 'C') return 'C'
  if (u.includes('FORWARD') || u === 'F') return 'F'
  if (u.includes('GUARD') || u === 'G') return 'G'
  return pos
}

interface Props {
  players: TeamOfWeekPlayerEntry[]
  weekName?: string
  startDate?: string
  endDate?: string
  title?: string
  compact?: boolean
  onPlayerClick?: (playerId: string | null, nbaPlayerId: number) => void
}

export default function TeamOfWeekModuleDisplay({
  players,
  weekName,
  startDate,
  endDate,
  title = 'Team of the Week',
  compact = false,
  onPlayerClick,
}: Props) {
  const weekLabel =
    weekName && startDate && endDate
      ? `${weekName} (${new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
      : weekName || (startDate && endDate ? `${startDate} – ${endDate}` : '')

  const renderPlayer = (player: TeamOfWeekPlayerEntry) => {
    const key = player.player_id ?? player.nba_player_id
    const pos = abbreviatePosition(player.player_position)
    const salaryMillions = (player.salary / 1_000_000).toFixed(2)
    return (
      <Card
        key={key}
        variant="outlined"
        onClick={() => onPlayerClick?.(player.player_id, player.nba_player_id)}
        sx={{
          minWidth: 0,
          boxSizing: 'border-box',
          bgcolor: '#0f0f0f',
          borderColor: '#2a2a2a',
          cursor: onPlayerClick ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          '&:hover': onPlayerClick
            ? { borderColor: '#FFC72C', transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(255, 199, 44, 0.25)' }
            : {},
        }}
      >
        <PlayerJersey
          playerName={player.player_name}
          jerseyNumber={player.jersey_number}
          nbaTeam={player.team}
          position={pos}
          size="xs"
          textColor="#FFFFFF"
          showName={false}
          showPosition={false}
          showTeam={false}
        />
        <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600, fontSize: '0.75rem', mt: 0.5, textAlign: 'center', lineHeight: 1.2 }}>
          {player.player_name}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25, flexWrap: 'wrap', justifyContent: 'center', gap: 0.25 }}>
          <Typography level="body-xs" sx={{ color: '#888', fontSize: '0.65rem' }}>
            {player.team}{pos ? ` · ${pos}` : ''}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', justifyContent: 'center', gap: 0.25 }}>
          <Chip size="sm" variant="soft" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.7rem', py: 0.25 }}>
            {player.avg_fantasy_points.toFixed(1)} FP
          </Chip>
          <Chip size="sm" variant="soft" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.7rem', py: 0.25 }}>
            ${salaryMillions}M
          </Chip>
        </Stack>
      </Card>
    )
  }

  if (players.length === 0) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333' }}>
        <Box sx={{ p: 2 }}>
          <Typography level="body-md" sx={{ color: '#888' }}>
            No Team of the Week data for this period.
          </Typography>
        </Box>
      </Card>
    )
  }

  return (
    <Box sx={{ bgcolor: '#000' }}>
      <Typography
        level="title-lg"
        sx={{ color: '#FFF', fontWeight: 800, mb: 0.5, fontSize: '1.25rem' }}
      >
        {title}
      </Typography>
      {weekLabel && (
        <Typography level="body-sm" sx={{ color: '#999', mb: 2, fontSize: '0.875rem' }}>
          {weekLabel}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 1.5,
          '@media (max-width: 900px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
          '@media (max-width: 500px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
        }}
      >
        {players.map(renderPlayer)}
      </Box>
    </Box>
  )
}
