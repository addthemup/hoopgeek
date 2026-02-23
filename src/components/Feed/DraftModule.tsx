/**
 * Draft rankings module for the feed inset drawer.
 * Shows top 30 prospects by aggregate rank. Click module header to open /draft for full list.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, List, ListItem, ListItemButton, Avatar } from '@mui/joy';
import { Favorite } from '@mui/icons-material';
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
      <Box sx={{ py: 1 }}>
        <Typography level="body-sm" color="neutral">
          Loading…
        </Typography>
      </Box>
    );
  }

  if (!rankings || rankings.length === 0) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography level="body-sm" color="neutral">
          No draft rankings yet.
        </Typography>
      </Box>
    );
  }

  return (
    <List size="sm" sx={{ '--List-item-paddingY': 0.5, '--List-decorator-size': '24px' }}>
      {rankings.map((p) => (
        <ListItem key={p.id} sx={{ alignItems: 'center' }}>
          <ListItemButton
            onClick={() => navigate(`/prospect/${p.id}`)}
            sx={{ borderRadius: 'sm', py: 0.75 }}
          >
            <Typography level="body-xs" sx={{ width: 20, flexShrink: 0, color: 'text.secondary' }}>
              {p.consensus_rank ?? '—'}
            </Typography>
            <Avatar
              size="sm"
              sx={{ mx: 1, bgcolor: 'neutral.700', width: 28, height: 28 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                {p.player_name_full}
              </Typography>
              <Typography level="body-xs" color="neutral">
                {p.school_team || '—'} • {p.position_primary || 'N/A'}
              </Typography>
            </Box>
            {favoriteIds.has(p.id) && (
              <Favorite sx={{ fontSize: 18, color: 'danger.500' }} />
            )}
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
