/**
 * Public shared NBA mock draft (read-only) — URL: /mock-draft/:shareToken
 */

import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Chip, CircularProgress, Alert } from '@mui/joy';
import { supabase } from '../utils/supabase';
import {
  usePublicMockDraftByShareToken,
  useUserMockDraftPicks,
  type UserMockDraftPickRow,
} from '../hooks/useMockDraftGame';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';

function usePublicMockDraftScore(userId: string | undefined, draftYear: number | null) {
  return useQuery({
    queryKey: ['public-mock-draft-score', userId, draftYear],
    queryFn: async () => {
      if (!userId || draftYear == null) return null;
      const { data, error } = await supabase
        .from('mock_draft_scores')
        .select('points_total, breakdown, computed_at')
        .eq('user_id', userId)
        .eq('draft_year', draftYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && draftYear != null,
  });
}

function useProspectsByIds(ids: string[]) {
  const uniq = useMemo(() => [...new Set(ids.filter(Boolean))], [ids]);
  return useQuery({
    queryKey: ['draft-prospects-public', uniq],
    queryFn: async () => {
      if (uniq.length === 0) return [];
      const { data, error } = await supabase
        .from('draft_prospects')
        .select('id, player_name_full, school_team, position_primary, image_url')
        .in('id', uniq);
      if (error) throw error;
      return data ?? [];
    },
    enabled: uniq.length > 0,
  });
}

export default function MockDraftSharePage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const { data: mock, isLoading, error } = usePublicMockDraftByShareToken(shareToken);
  const { data: picks = [], isLoading: picksLoading } = useUserMockDraftPicks(mock?.id);
  const { data: score } = usePublicMockDraftScore(mock?.user_id, mock?.draft_year ?? null);
  const prospectIds = useMemo(() => picks.map((p: UserMockDraftPickRow) => p.draft_prospect_id), [picks]);
  const { data: prospectRows = [] } = useProspectsByIds(prospectIds);

  const prospectById = useMemo(
    () => new Map(prospectRows.map((p: { id: string }) => [p.id, p])),
    [prospectRows]
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !mock) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
        <Alert color="warning" sx={{ mb: 2 }}>
          This mock draft link is invalid or sharing is turned off.
        </Alert>
        <Link to="/draft">Go to draft board</Link>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, sm: 3 }, pb: 6 }}>
      <Typography level="h3" sx={{ mb: 0.5 }}>
        {mock.draft_year} mock draft
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
        Shared on HoopGeek · {mock.status === 'completed' ? 'Completed' : 'In progress'}
      </Typography>

      {score?.points_total != null && (
        <Chip variant="soft" color="primary" sx={{ mb: 2 }}>
          Score: {Number(score.points_total).toFixed(1)} pts
        </Chip>
      )}

      {picksLoading ? (
        <CircularProgress size="sm" />
      ) : (
        <Card variant="outlined">
          <CardContent>
            {picks.length === 0 ? (
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                No picks yet.
              </Typography>
            ) : (
              picks.map((row: UserMockDraftPickRow) => {
                const p = prospectById.get(row.draft_prospect_id);
                return (
                  <Box
                    key={row.pick_number}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      py: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Typography level="body-sm" sx={{ width: 28, fontWeight: 700 }}>
                      {row.pick_number}
                    </Typography>
                    <Box
                      component="img"
                      src={getTeamLogoUrl(row.team_abbreviation)}
                      alt=""
                      sx={{ width: 40, height: 40, objectFit: 'contain' }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level="title-sm">{p?.player_name_full ?? 'Prospect'}</Typography>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {row.team_abbreviation} · {p?.school_team ?? '—'} · {p?.position_primary ?? '—'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      <Box sx={{ mt: 3 }}>
        <Link to="/draft">Build your own mock draft</Link>
      </Box>
    </Box>
  );
}
