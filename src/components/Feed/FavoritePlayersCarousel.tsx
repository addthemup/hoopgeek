/**
 * Carousel of favorite players and prospects with a + button to add via search.
 * Used in the feed drawer. Players show headshots; prospects use blank avatars.
 */

import React, { useState } from 'react';
import {
  Box,
  Avatar,
  IconButton,
  Typography,
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  Input,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  CircularProgress,
} from '@mui/joy';
import { Add, Close, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { usePlayerFavorites, useAddToFavorites, useRemoveFromFavorites } from '../../hooks/usePlayerFavorites';
import { useProspectFavorites, useAddToProspectFavorites, useRemoveFromProspectFavorites } from '../../hooks/useProspectFavorites';
import { usePlayerSearch, type SearchResult, type PlayerSearchResult, type ProspectSearchResult } from '../../hooks/usePlayerSearch';

const HEADSHOT_BASE = 'https://cdn.nba.com/headshots/nba/latest/260x190';

interface FavoritePlayersCarouselProps {
  navigate: (path: string) => void;
  onAddFilter?: (filter: { type: 'post_type' | 'team' | 'player'; value: string; label: string }) => void;
}

export default function FavoritePlayersCarousel({ navigate, onAddFilter }: FavoritePlayersCarouselProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: favoritePlayers } = usePlayerFavorites();
  const { data: favoriteProspects } = useProspectFavorites();
  const addPlayerMutation = useAddToFavorites();
  const removePlayerMutation = useRemoveFromFavorites();
  const addProspectMutation = useAddToProspectFavorites();
  const removeProspectMutation = useRemoveFromProspectFavorites();
  const { data: searchResults, isLoading: searchLoading } = usePlayerSearch(searchQuery);
  const favoritePlayerIds = new Set((favoritePlayers || []).map((p) => p.player_id));
  const favoriteProspectIds = new Set((favoriteProspects || []).map((p) => p.draft_prospect_id));
  const addableResults = (searchResults || []).filter(
    (r): r is PlayerSearchResult | ProspectSearchResult => r.type === 'player' || r.type === 'prospect'
  );

  const handleAddPlayer = (playerId: string) => {
    addPlayerMutation.mutate(
      { playerId },
      {
        onSuccess: () => {
          setAddOpen(false);
          setSearchQuery('');
        },
      }
    );
  };

  const handleAddProspect = (draftProspectId: string) => {
    addProspectMutation.mutate(
      { draftProspectId },
      {
        onSuccess: () => {
          setAddOpen(false);
          setSearchQuery('');
        },
      }
    );
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          overflowX: 'auto',
          pb: 1,
          minHeight: 64,
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'neutral.500' },
        }}
      >
        {(favoritePlayers || []).map((fav) => {
          const nbaId = fav.nba_players?.nba_player_id;
          const name = fav.nba_players?.name ?? 'Unknown';

          return (
            <Box
              key={`player-${fav.id}`}
              sx={{ position: 'relative', flexShrink: 0 }}
            >
              <IconButton
                variant="plain"
                color="neutral"
                onClick={() => {
                  if (nbaId != null && name) {
                    onAddFilter?.({ type: 'player', value: String(nbaId), label: name });
                  }
                  if (onAddFilter) return;
                  navigate(`/player/${fav.player_id}`);
                }}
                sx={{
                  p: 0,
                  borderRadius: '50%',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                aria-label={name}
              >
                <Avatar
                  src={nbaId ? `${HEADSHOT_BASE}/${nbaId}.png` : undefined}
                  alt={name}
                  sx={{ width: 56, height: 56 }}
                >
                  {name.charAt(0)}
                </Avatar>
              </IconButton>
              <IconButton
                size="sm"
                variant="solid"
                color="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removePlayerMutation.mutate({ playerId: fav.player_id });
                }}
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 22,
                  minHeight: 22,
                  '--IconButton-size': '22px',
                  borderRadius: '50%',
                  boxShadow: 1,
                }}
                aria-label={`Remove ${name} from favorites`}
              >
                <Close sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          );
        })}
        {(favoriteProspects || []).map((fav) => {
          const name = fav.draft_prospects?.player_name_full ?? 'Prospect';
          const prospectId = fav.draft_prospect_id;

          return (
            <Box
              key={`prospect-${fav.id}`}
              sx={{ position: 'relative', flexShrink: 0 }}
            >
              <IconButton
                variant="plain"
                color="neutral"
                onClick={() => navigate(`/prospect/${prospectId}`)}
                sx={{
                  p: 0,
                  borderRadius: '50%',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                aria-label={name}
              >
                <Avatar alt={name} sx={{ width: 56, height: 56, bgcolor: 'neutral.700' }} />
              </IconButton>
              <IconButton
                size="sm"
                variant="solid"
                color="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProspectMutation.mutate({ draftProspectId: prospectId });
                }}
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 22,
                  minHeight: 22,
                  '--IconButton-size': '22px',
                  borderRadius: '50%',
                  boxShadow: 1,
                }}
                aria-label={`Remove ${name} from favorites`}
              >
                <Close sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          );
        })}
        <IconButton
          variant="outlined"
          color="neutral"
          onClick={() => setAddOpen(true)}
          sx={{
            flexShrink: 0,
            width: 56,
            height: 56,
            borderRadius: '50%',
            borderStyle: 'dashed',
          }}
          aria-label="Add favorite player or prospect"
        >
          <Add />
        </IconButton>
      </Box>

      <Modal open={addOpen} onClose={() => { setAddOpen(false); setSearchQuery(''); }}>
        <ModalDialog sx={{ maxWidth: 400, width: '100%' }}>
          <ModalClose />
          <DialogTitle>Add favorite player or prospect</DialogTitle>
          <DialogContent>
            <Input
              placeholder="Search players and prospects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startDecorator={<Search sx={{ color: 'text.secondary' }} />}
              sx={{ mb: 2 }}
              autoFocus
            />
            <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {searchQuery.length < 2 ? (
                <Typography level="body-sm" color="neutral">
                  Type at least 2 characters to search.
                </Typography>
              ) : searchLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size="sm" />
                </Box>
              ) : addableResults.length === 0 ? (
                <Typography level="body-sm" color="neutral">
                  No players or prospects found.
                </Typography>
              ) : (
                <List sx={{ '--List-decorator-size': '40px' }}>
                  {addableResults.map((r: SearchResult) => {
                    if (r.type === 'player') {
                      const isFav = favoritePlayerIds.has(r.id);
                      return (
                        <ListItem key={`player-${r.id}`}>
                          <ListItemButton
                            disabled={isFav}
                            onClick={() => !isFav && handleAddPlayer(r.id)}
                            sx={{ borderRadius: 'sm' }}
                          >
                            <Avatar
                              src={`${HEADSHOT_BASE}/${r.nba_player_id}.png`}
                              alt={r.name}
                              size="sm"
                              sx={{ mr: 1.5 }}
                            />
                            <ListItemContent>
                              <Typography level="title-sm">{r.name}</Typography>
                              <Typography level="body-xs" color="neutral">
                                {r.team_abbreviation || 'FA'} • {r.position || '—'}
                              </Typography>
                            </ListItemContent>
                            {isFav && (
                              <Typography level="body-xs" color="success">
                                Added
                              </Typography>
                            )}
                          </ListItemButton>
                        </ListItem>
                      );
                    }
                    const isFav = favoriteProspectIds.has(r.id);
                    return (
                      <ListItem key={`prospect-${r.id}`}>
                        <ListItemButton
                          disabled={isFav}
                          onClick={() => !isFav && handleAddProspect(r.id)}
                          sx={{ borderRadius: 'sm' }}
                        >
                          <Avatar size="sm" sx={{ mr: 1.5, bgcolor: 'neutral.700' }} />
                          <ListItemContent>
                            <Typography level="title-sm">{r.name}</Typography>
                            <Typography level="body-xs" color="neutral">
                              {r.school_team || '—'} • {r.position_primary || 'N/A'}
                            </Typography>
                          </ListItemContent>
                          {isFav && (
                            <Typography level="body-xs" color="success">
                              Added
                            </Typography>
                          )}
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Box>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </>
  );
}
