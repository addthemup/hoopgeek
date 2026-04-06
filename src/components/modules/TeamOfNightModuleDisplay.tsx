/**
 * Shared display for Team of the Night lineup (frozen data).
 * Used by PostStory for team_of_night_module sections.
 * All players in a grid (5 per row); click jersey scrolls to that player's section.
 */

import { useMemo } from 'react'
import { Box, Typography, Card, Chip, Stack } from '@mui/joy'
import PlayerJersey from '../PlayerJersey'
import type { TeamOfNightModuleContent, TeamOfNightPlayerEntry } from '../../types/feed'

function abbreviatePosition(pos: string | null | undefined): string {
  if (!pos) return ''
  const u = pos.toUpperCase()
  if (u.includes('CENTER') || u === 'C') return 'C'
  if (u.includes('FORWARD') || u === 'F') return 'F'
  if (u.includes('GUARD') || u === 'G') return 'G'
  return pos
}

interface Props {
  players: TeamOfNightPlayerEntry[]
  date: string
  title?: string
  compact?: boolean
  showJersey?: boolean
  onPlayerClick?: (playerId: string | null, nbaPlayerId: number) => void
}

export default function TeamOfNightModuleDisplay({
  players,
  date,
  title = 'Team of the Night',
  compact = false,
  showJersey = true,
  onPlayerClick,
}: Props) {
  const allPlayers = useMemo(
    () => [...players].sort((a, b) => (a.lineup_order ?? 99) - (b.lineup_order ?? 99)),
    [players]
  )

  const renderPlayer = (player: TeamOfNightPlayerEntry) => {
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
        {showJersey ? (
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
        ) : (
          <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography level="body-xs" sx={{ color: '#888' }}>{player.jersey_number}</Typography>
          </Box>
        )}
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
            {player.fantasy_points.toFixed(1)} FP
          </Chip>
          <Chip size="sm" variant="soft" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#FFF', fontSize: '0.7rem', py: 0.25 }}>
            ${salaryMillions}M
          </Chip>
        </Stack>
      </Card>
    )
  }

  return (
    <Box sx={{ bgcolor: '#000' }}>
      <Typography
        level="title-lg"
        sx={{ color: '#FFF', fontWeight: 800, mb: 2, fontSize: '1.25rem' }}
      >
        {title} — {date}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 1.5,
          '@media (max-width: 900px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
          '@media (max-width: 500px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
        }}
      >
        {allPlayers.map(renderPlayer)}
      </Box>
    </Box>
  )
}
