/**
 * Full draft prospects board at /draft.
 * Lists every scraped prospect with aggregate score; heart for user favorites.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  Avatar,
  Chip,
} from '@mui/joy';
import { Favorite } from '@mui/icons-material';
import { useDraftProspectRankings } from '../hooks/useDraftProspectRankings';
import { useProspectFavorites } from '../hooks/useProspectFavorites';

export default function DraftProspectsPage() {
  const navigate = useNavigate();
  const { data: prospects, isLoading } = useDraftProspectRankings({
    includeUnranked: true,
  });
  const { data: favoriteProspects } = useProspectFavorites();
  const favoriteIds = new Set((favoriteProspects ?? []).map((p) => p.draft_prospect_id));

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, py: 3 }}>
      <Typography level="h2" sx={{ fontWeight: 700, mb: 1 }}>
        Draft
      </Typography>
      <Typography level="body-md" sx={{ color: 'text.secondary', mb: 3 }}>
        Aggregate rankings from Tankathon, NBADraft.net, ESPN, The Athletic. Click a prospect for details.
      </Typography>

      {isLoading ? (
        <Typography level="body-sm" color="neutral">
          Loading…
        </Typography>
      ) : !prospects || prospects.length === 0 ? (
        <Typography level="body-sm" color="neutral">
          No prospects yet.
        </Typography>
      ) : (
        <List size="sm" sx={{ '--List-item-paddingY': 0 }}>
          {prospects.map((p) => (
            <ListItem key={p.id} sx={{ alignItems: 'stretch' }}>
              <ListItemButton
                onClick={() => navigate(`/prospect/${p.id}`)}
                sx={{ borderRadius: 'sm', py: 1.25, alignItems: 'center' }}
              >
                <Typography
                  level="body-sm"
                  sx={{
                    width: 36,
                    flexShrink: 0,
                    color: 'text.secondary',
                    fontWeight: p.consensus_rank != null ? 600 : 400,
                  }}
                >
                  {p.consensus_rank ?? '—'}
                </Typography>
                <Avatar
                  size="sm"
                  sx={{ mx: 1.5, bgcolor: 'neutral.700', width: 40, height: 40 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                    {p.player_name_full}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {p.school_team || '—'} • {p.position_primary || 'N/A'}
                    {p.draft_year ? ` • ${p.draft_year}` : ''}
                  </Typography>
                </Box>
                {p.aggregate_rank_avg != null && (
                  <Chip size="sm" variant="soft" color="neutral" sx={{ mr: 1 }}>
                    Avg {p.aggregate_rank_avg.toFixed(1)}
                  </Chip>
                )}
                {favoriteIds.has(p.id) && (
                  <Favorite sx={{ fontSize: 22, color: 'danger.500' }} />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
