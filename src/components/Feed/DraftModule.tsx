/**
 * Draft rankings module for the feed inset drawer.
 * Shows top 30 prospects by aggregate rank. Click module header to open /draft for full list.
 */

import React from 'react';
import { Box, Typography, Card, CardContent, List, ListItem, ListItemButton, Avatar } from '@mui/joy';
import { Favorite, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useDraftProspectRankings } from '../../hooks/useDraftProspectRankings';
import { useProspectFavorites } from '../../hooks/useProspectFavorites';

interface DraftModuleProps {
  navigate: (path: string) => void;
}

export default function DraftModule({ navigate }: DraftModuleProps) {
  const { data: rankings, isLoading } = useDraftProspectRankings({ limit: 30 });
  const { data: favoriteProspects } = useProspectFavorites();
  const favoriteIds = new Set((favoriteProspects ?? []).map((p) => p.draft_prospect_id));

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ position: 'relative', bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            px: 1.5,
            py: 0.5,
            borderLeft: '1px solid',
            borderBottom: '1px solid',
            borderColor: '#333333',
            borderTopRightRadius: 6,
            bgcolor: '#252525',
            zIndex: 10,
          }}
        >
          <Typography level="body-xs" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', color: '#CCCCCC', textTransform: 'uppercase' }}>
            Draft
          </Typography>
        </Box>
        <CardContent sx={{ bgcolor: '#1a1a1a' }}>
          <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
            Loading…
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!rankings || rankings.length === 0) {
    return (
      <Card variant="outlined" sx={{ position: 'relative', bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            px: 1.5,
            py: 0.5,
            borderLeft: '1px solid',
            borderBottom: '1px solid',
            borderColor: '#333333',
            borderTopRightRadius: 6,
            bgcolor: '#252525',
            zIndex: 10,
          }}
        >
          <Typography level="body-xs" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', color: '#CCCCCC', textTransform: 'uppercase' }}>
            Draft
          </Typography>
        </Box>
        <CardContent sx={{ bgcolor: '#1a1a1a' }}>
          <Typography level="body-sm" sx={{ color: '#B0B0B0' }}>
            No draft rankings yet.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  /** Rows needed so items fill col1 top→bottom, then col2, then col3 (grid-auto-flow: column). */
  const columnMajorRows = Math.ceil(rankings.length / 3);

  return (
    <Card variant="outlined" sx={{ position: 'relative', bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          px: 1.5,
          py: 0.5,
          borderLeft: '1px solid',
          borderBottom: '1px solid',
          borderColor: '#333333',
          borderTopRightRadius: 6,
          bgcolor: '#252525',
          zIndex: 10,
          cursor: 'pointer',
        }}
        onClick={() => navigate('/draft')}
      >
        <Typography level="body-xs" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.06em', color: '#CCCCCC', textTransform: 'uppercase' }}>
          Draft
        </Typography>
      </Box>
      <CardContent sx={{ bgcolor: '#1a1a1a', px: 1, py: 1, '&:last-child': { pb: 1 } }}>
        <Box sx={{ px: 0.75, pb: 0.75 }}>
          <Typography level="body-xs" sx={{ color: '#AFAFAF', lineHeight: 1.3 }}>
            Track weekly movement and set your own board.
          </Typography>
        </Box>
        <List
          size="sm"
          sx={(theme) => ({
            '--List-item-paddingY': 0.25,
            '--List-decorator-size': '20px',
            bgcolor: '#1a1a1a',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 0.25,
            [theme.breakpoints.up('md')]: {
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gridTemplateRows: `repeat(${columnMajorRows}, auto)`,
              gridAutoFlow: 'column',
              columnGap: 0.75,
              rowGap: 0.25,
            },
            '& .MuiListItem-root': { minWidth: 0 },
            '& .MuiListItemButton-root': { borderRadius: 'sm', py: 0.35, minHeight: 0 },
            '& .MuiListItemButton-root:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
          })}
        >
          {rankings.map((p) => (
            <ListItem key={p.id} sx={{ alignItems: 'stretch', bgcolor: 'transparent', p: 0 }}>
              <ListItemButton
                onClick={() => navigate(`/prospect/${p.id}`)}
                sx={{
                  borderRadius: 'sm',
                  py: 0.35,
                  width: '100%',
                  alignItems: 'center',
                  minHeight: 0,
                }}
              >
                <Box sx={{ width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.125 }}>
                  <Typography
                    level="body-xs"
                    sx={{ color: '#999', minWidth: 16, fontSize: '0.65rem', lineHeight: 1 }}
                  >
                    {p.consensus_rank ?? '—'}
                  </Typography>
                  {p.rank_delta != null && p.rank_delta !== 0 && (
                    p.rank_delta > 0 ? (
                      <ArrowUpward sx={{ fontSize: 11, color: 'success.500' }} aria-label="Moved up" />
                    ) : (
                      <ArrowDownward sx={{ fontSize: 11, color: 'danger.500' }} aria-label="Moved down" />
                    )
                  )}
                </Box>
                <Avatar
                  src={p.image_url ?? undefined}
                  alt={p.player_name_full}
                  size="sm"
                  sx={{ mx: 0.5, bgcolor: 'neutral.700', width: 24, height: 24, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: 500,
                      color: '#E0E0E0',
                      fontSize: '0.7rem',
                      lineHeight: 1.15,
                    }}
                    noWrap
                  >
                    {p.player_name_full}
                  </Typography>
                  <Typography sx={{ color: '#999', fontSize: '0.6rem', lineHeight: 1.1, mt: 0.125 }} noWrap>
                    {p.school_team || '—'} • {p.position_primary || 'N/A'}
                  </Typography>
                </Box>
                {favoriteIds.has(p.id) && (
                  <Favorite sx={{ fontSize: 14, color: 'danger.500', flexShrink: 0 }} />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}
