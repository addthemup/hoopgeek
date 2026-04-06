/**
 * Public shared bet slip — URL: /slip/:shareToken
 */

import { useParams, Link } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Chip, CircularProgress, Alert, Divider } from '@mui/joy';
import { usePublicSlipByShareToken, usePublicSlipLegs } from '../hooks/useSharedSlip';

function formatBetType(betType: string): string {
  const n = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+');
  const map: Record<string, string> = {
    points: 'PTS',
    rebounds: 'REB',
    assists: 'AST',
    threes: '3PM',
    steals: 'STL',
    blocks: 'BLK',
    turnovers: 'TOV',
  };
  return map[n] ?? betType?.toUpperCase?.() ?? '—';
}

export default function SharedSlipPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { data: slip, isLoading, error } = usePublicSlipByShareToken(shareToken);
  const { data: legs = [], isLoading: legsLoading } = usePublicSlipLegs(slip?.id);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !slip) {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
        <Alert color="warning" sx={{ mb: 2 }}>
          This slip link is invalid or sharing is turned off.
        </Alert>
        <Link to="/feed">Back to feed</Link>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', p: { xs: 2, sm: 3 }, pb: 6 }}>
      <Typography level="h3" sx={{ mb: 1 }}>
        Shared parlay
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
        HoopGeek slip · {slip.game_date ?? '—'}
      </Typography>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 2 }}>
            <Chip size="sm" variant="soft" color="neutral">
              Stake ${(slip.stake_cents / 100).toFixed(2)}
            </Chip>
            <Chip size="sm" variant="soft" color="primary">
              {Number(slip.total_odds_decimal).toFixed(2)}×
            </Chip>
            <Chip size="sm" variant="soft" color="success">
              Payout ${(slip.potential_payout_cents / 100).toFixed(2)}
            </Chip>
            <Chip size="sm" variant="outlined" color="neutral">
              {String(slip.status).replace(/_/g, ' ')}
            </Chip>
          </Box>
          <Divider sx={{ my: 1 }} />
          {legsLoading ? (
            <CircularProgress size="sm" />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {legs.map((leg: { id: string; player_name: string; bet_type: string; line: number; side: string; odds_american: string | null }) => (
                <Box key={leg.id}>
                  <Typography level="title-sm">{leg.player_name}</Typography>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    {formatBetType(leg.bet_type)} {leg.line} {leg.side === 'over' ? 'Over' : 'Under'}
                    {leg.odds_american ? ` (${leg.odds_american})` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Link to="/feed/prop-predictions">Build your own props</Link>
    </Box>
  );
}
