/**
 * Rich favorite players module for feed/profile drawer:
 * - Horizontal favorite selector
 * - Expanded DraftKings-style spotlight card for selected player
 * - Last 3 game log with FanDuel fantasy points
 * - Links to matching player_spotlight posts
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
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
  Stack,
  Chip,
  Button,
  Table,
} from '@mui/joy';
import { Add, Close, Search, SportsBasketball, OpenInNew } from '@mui/icons-material';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import { useQuery } from '@tanstack/react-query';
import { usePlayerFavorites, useAddToFavorites, useRemoveFromFavorites } from '../../hooks/usePlayerFavorites';
import { useProspectFavorites, useAddToProspectFavorites } from '../../hooks/useProspectFavorites';
import { usePlayerSearch, type SearchResult, type PlayerSearchResult, type ProspectSearchResult } from '../../hooks/usePlayerSearch';
import { usePlayerComprehensive } from '../../hooks/usePlayerComprehensive';
import { usePlayerAwards } from '../../hooks/usePlayerAwards';
import { supabase } from '../../utils/supabase';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';
import { calculateFantasyPoints, FANDUEL_SCORING } from '../../utils/fantasyScoring';

const HEADSHOT_BASE = 'https://cdn.nba.com/headshots/nba/latest/260x190';

interface FavoritePlayersCarouselProps {
  navigate: (path: string) => void;
  onAddFilter?: (filter: { type: 'post_type' | 'team' | 'player'; value: string; label: string }) => void;
}

type SpotlightPost = {
  id: string;
  slug: string;
  title: string;
  game_id: string | null;
  game_date: string | null;
  published_at: string | null;
};

function formatGameDate(dateValue: string | null | undefined): string {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMinutes(value: string | number | null | undefined): string {
  if (value == null) return '—';
  if (typeof value === 'number') return `${value.toFixed(1)}m`;
  return value;
}

function formatHeight(height: string | null | undefined): string {
  if (!height) return '—';
  return String(height).replace('-', "'");
}

function formatSalary(salary: number | undefined): string {
  if (!salary) return '—';
  return `$${(salary / 1000000).toFixed(1)}M`;
}

export default function FavoritePlayersCarousel({ navigate, onAddFilter }: FavoritePlayersCarouselProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const { data: favoritePlayers } = usePlayerFavorites();
  const { data: favoriteProspects } = useProspectFavorites();
  const addPlayerMutation = useAddToFavorites();
  const removePlayerMutation = useRemoveFromFavorites();
  const addProspectMutation = useAddToProspectFavorites();
  const { data: searchResults, isLoading: searchLoading } = usePlayerSearch(searchQuery);

  const favoritePlayerIds = new Set((favoritePlayers || []).map((p) => p.player_id));
  const favoriteProspectIds = new Set((favoriteProspects || []).map((p) => p.draft_prospect_id));
  const addableResults = (searchResults || []).filter(
    (r): r is PlayerSearchResult | ProspectSearchResult => r.type === 'player' || r.type === 'prospect'
  );

  useEffect(() => {
    const list = favoritePlayers || [];
    if (list.length === 0) {
      setSelectedPlayerId(null);
      return;
    }
    const stillExists = selectedPlayerId ? list.some((p) => p.player_id === selectedPlayerId) : false;
    if (!selectedPlayerId || !stillExists) {
      setSelectedPlayerId(list[0].player_id);
    }
  }, [favoritePlayers, selectedPlayerId]);

  const selectedFavorite = useMemo(
    () => (favoritePlayers || []).find((p) => p.player_id === selectedPlayerId) || null,
    [favoritePlayers, selectedPlayerId]
  );
  const selectedIndex = useMemo(
    () => (favoritePlayers || []).findIndex((p) => p.player_id === selectedPlayerId),
    [favoritePlayers, selectedPlayerId]
  );
  const totalFavorites = favoritePlayers?.length || 0;

  const selectedPlayerDetails = usePlayerComprehensive(selectedFavorite?.player_id || '', 1, 8);
  const { data: awardsData } = usePlayerAwards(selectedFavorite?.player_id);
  const selectedNbaPlayerId = selectedFavorite?.nba_players?.nba_player_id ?? null;

  const { data: spotlightPosts = [] } = useQuery({
    queryKey: ['favorite-player-spotlights', selectedNbaPlayerId],
    enabled: !!selectedNbaPlayerId,
    queryFn: async () => {
      if (!selectedNbaPlayerId) return [];
      const { data, error } = await supabase
        .from('feed_posts')
        .select('id, slug, title, game_id, game_date, published_at')
        .eq('post_type', 'player_spotlight')
        .eq('status', 'published')
        .eq('person_id', selectedNbaPlayerId)
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as SpotlightPost[];
    },
  });

  const spotlightByGameId = useMemo(() => {
    const map = new Map<string, SpotlightPost>();
    for (const post of spotlightPosts) {
      if (post.game_id && !map.has(post.game_id)) {
        map.set(post.game_id, post);
      }
    }
    return map;
  }, [spotlightPosts]);

  const recentGames = (selectedPlayerDetails.data?.recentGameLogs || []).slice(0, 3);
  const selectedPlayer = selectedPlayerDetails.data?.player;
  const teamAbbreviation = selectedPlayer?.team_abbreviation || selectedFavorite?.nba_players?.team_abbreviation || '';
  const teamColor = getTeamPrimaryColor(teamAbbreviation);
  const latestInjury = selectedPlayerDetails.data?.latestInjury;
  const injuryHistoryCount = selectedPlayerDetails.data?.injuryHistory?.length || 0;
  const contract = selectedPlayer?.nba_hoopshype_salaries?.[0];

  const handleSelectPrevPlayer = () => {
    if (!favoritePlayers || favoritePlayers.length < 2 || selectedIndex < 0) return;
    const prevIdx = selectedIndex === 0 ? favoritePlayers.length - 1 : selectedIndex - 1;
    setSelectedPlayerId(favoritePlayers[prevIdx].player_id);
  };

  const handleSelectNextPlayer = () => {
    if (!favoritePlayers || favoritePlayers.length < 2 || selectedIndex < 0) return;
    const nextIdx = selectedIndex === favoritePlayers.length - 1 ? 0 : selectedIndex + 1;
    setSelectedPlayerId(favoritePlayers[nextIdx].player_id);
  };

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
    <Card variant="outlined" sx={{ position: 'relative', bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          px: 0.75,
          py: 0.5,
          borderRight: '1px solid',
          borderBottom: '1px solid',
          borderColor: '#333333',
          borderTopLeftRadius: 6,
          bgcolor: '#252525',
          zIndex: 10,
        }}
      >
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          startDecorator={<Add />}
          onClick={() => setAddOpen(true)}
          sx={{ minHeight: 0, py: 0, px: 0.5, color: '#D6D6D6' }}
        >
          Add
        </Button>
      </Box>
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
          Favorites
        </Typography>
      </Box>

      <CardContent sx={{ bgcolor: '#1a1a1a', pt: 2, pb: 2 }}>
        <Stack spacing={2}>
          {selectedFavorite ? (
            <Box
              sx={{
                borderRadius: '12px',
                border: '1px solid #2F2F2F',
                p: 1.5,
                background: `linear-gradient(135deg, ${teamColor}30 0%, rgba(22,22,22,0.95) 38%, rgba(18,18,18,1) 100%)`,
                position: 'relative',
              }}
            >
              {totalFavorites > 1 && (
                <>
                  <IconButton
                    variant="soft"
                    color="neutral"
                    size="sm"
                    aria-label="Previous favorite player"
                    onClick={handleSelectPrevPlayer}
                    sx={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 2,
                      bgcolor: 'rgba(0,0,0,0.55)',
                      color: '#EAEAEA',
                      border: '1px solid #3A3A3A',
                    }}
                  >
                    <ArrowBackIosNewRounded sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton
                    variant="soft"
                    color="neutral"
                    size="sm"
                    aria-label="Next favorite player"
                    onClick={handleSelectNextPlayer}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 2,
                      bgcolor: 'rgba(0,0,0,0.55)',
                      color: '#EAEAEA',
                      border: '1px solid #3A3A3A',
                    }}
                  >
                    <ArrowBackIosNewRounded sx={{ fontSize: 14, transform: 'rotate(180deg)' }} />
                  </IconButton>
                </>
              )}

              <Stack spacing={1.5} sx={{ px: totalFavorites > 1 ? 4.5 : 0 }}>
                <Stack direction="row" justifyContent="center">
                  <Chip size="sm" variant="soft" color="neutral">
                    {Math.max(1, selectedIndex + 1)} / {totalFavorites}
                  </Chip>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                  <Avatar
                    src={
                      selectedFavorite.nba_players?.nba_player_id
                        ? `${HEADSHOT_BASE}/${selectedFavorite.nba_players.nba_player_id}.png`
                        : undefined
                    }
                    alt={selectedFavorite.nba_players?.name || 'Player'}
                    sx={{ width: 90, height: 90, bgcolor: teamColor }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography level="title-lg" sx={{ color: '#FFFFFF', fontWeight: 800 }}>
                      {selectedFavorite.nba_players?.name || 'Unknown Player'}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#D6D6D6', mt: 0.25 }}>
                      {selectedPlayer?.team_name || selectedFavorite.nba_players?.team_name || 'Free Agent'} ({teamAbbreviation || 'FA'})
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                      <Chip size="sm" variant="soft" color="neutral">POS {selectedPlayer?.position || selectedFavorite.nba_players?.position || '—'}</Chip>
                      <Chip size="sm" variant="soft" color="neutral">#{selectedPlayer?.jersey_number || '—'}</Chip>
                      <Chip size="sm" variant="soft" color="neutral">AGE {selectedPlayer?.age || '—'}</Chip>
                      <Chip size="sm" variant="soft" color="neutral">HT {formatHeight(selectedPlayer?.height)}</Chip>
                      <Chip size="sm" variant="soft" color="neutral">WT {selectedPlayer?.weight ? `${selectedPlayer.weight} lb` : '—'}</Chip>
                    </Stack>
                  </Box>
                  <Stack direction="column" spacing={1}>
                    <Button
                      size="sm"
                      variant="solid"
                      startDecorator={<SportsBasketball />}
                      onClick={() => navigate(`/player/${selectedFavorite.player_id}`)}
                    >
                      Player Page
                    </Button>
                    {onAddFilter && selectedFavorite.nba_players?.nba_player_id && (
                      <Button
                        size="sm"
                        variant="soft"
                        color="neutral"
                        onClick={() =>
                          onAddFilter?.({
                            type: 'player',
                            value: String(selectedFavorite.nba_players.nba_player_id),
                            label: selectedFavorite.nba_players?.name || 'Player',
                          })
                        }
                      >
                        Filter Feed
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="soft"
                      color="danger"
                      onClick={() => removePlayerMutation.mutate({ playerId: selectedFavorite.player_id })}
                    >
                      Remove Favorite
                    </Button>
                  </Stack>
                </Stack>

                <Box sx={{ borderTop: '1px solid #2A2A2A', pt: 1.25 }}>
                  <Typography level="title-sm" sx={{ color: '#FFFFFF', mb: 1 }}>
                    Last 3 Games (FanDuel Fantasy Points)
                  </Typography>

                  {selectedPlayerDetails.isLoading ? (
                    <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                      <CircularProgress size="sm" />
                    </Box>
                  ) : recentGames.length === 0 ? (
                    <Typography level="body-sm" sx={{ color: '#9E9E9E' }}>
                      No recent games available yet.
                    </Typography>
                  ) : (
                    <Table
                      size="sm"
                      variant="plain"
                      sx={{
                        '--TableCell-paddingX': '6px',
                        '--TableCell-paddingY': '6px',
                        '& thead th': {
                          color: '#F4F4F4',
                          fontWeight: 700,
                          borderBottom: '1px solid #3A3A3A',
                          bgcolor: 'transparent',
                          fontSize: '0.72rem',
                        },
                        '& tbody td': {
                          color: '#CFCFCF',
                          borderBottom: '1px solid #252525',
                          fontSize: '0.76rem',
                        },
                      }}
                    >
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Opp</th>
                          <th>Min</th>
                          <th>PTS</th>
                          <th>REB</th>
                          <th>AST</th>
                          <th>FPTS</th>
                          <th>Spotlight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentGames.map((game) => {
                          const fantasyPoints = calculateFantasyPoints(
                            {
                              pts: game.pts || 0,
                              reb: game.reb || 0,
                              ast: game.ast || 0,
                              stl: game.stl || 0,
                              blk: game.blk || 0,
                              tov: game.tov || 0,
                            } as any,
                            FANDUEL_SCORING
                          );
                          const spotlight = spotlightByGameId.get(game.game_id);
                          return (
                            <tr key={`${game.game_id}-${game.game_date}`}>
                              <td>{formatGameDate(game.game_date)}</td>
                              <td>{game.matchup || '—'}</td>
                              <td>{formatMinutes(game.min)}</td>
                              <td>{game.pts || 0}</td>
                              <td>{game.reb || 0}</td>
                              <td>{game.ast || 0}</td>
                              <td style={{ color: '#7CE8A6', fontWeight: 700 }}>{fantasyPoints.toFixed(1)}</td>
                              <td>
                                {spotlight ? (
                                  <Button
                                    size="sm"
                                    variant="soft"
                                    color="neutral"
                                    endDecorator={<OpenInNew sx={{ fontSize: 14 }} />}
                                    onClick={() => navigate(`/feed/${spotlight.slug}`)}
                                  >
                                    Reel
                                  </Button>
                                ) : (
                                  <Typography level="body-xs" sx={{ color: '#757575' }}>
                                    —
                                  </Typography>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  )}
                </Box>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                  <Box sx={{ flex: 1, p: 1.25, border: '1px solid #333', borderRadius: 8, bgcolor: '#151515' }}>
                    <Typography level="title-sm" sx={{ color: '#FFF', mb: 0.75 }}>Info</Typography>
                    <Typography level="body-xs" sx={{ color: '#BDBDBD' }}>
                      {selectedPlayer?.college || 'No college listed'}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: '#DADADA', mt: 0.5 }}>
                      Draft: {selectedPlayer?.draft_year ? `${selectedPlayer.draft_year} • Rd ${selectedPlayer.draft_round || '—'} • Pick ${selectedPlayer.draft_number || '—'}` : 'Undrafted / N/A'}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: '#DADADA', mt: 0.5 }}>
                      Contract: {contract ? `${contract.contract_years_remaining || 0} yrs • ${formatSalary(contract.salary_2025_26)} this season` : 'N/A'}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: '#DADADA', mt: 0.5 }}>
                      Experience: {selectedPlayer?.years_pro ?? '—'} years • {selectedPlayer?.country || '—'}
                    </Typography>
                    {(selectedPlayer?.current_pts != null || selectedPlayer?.current_reb != null || selectedPlayer?.current_ast != null) && (
                      <Typography level="body-xs" sx={{ color: '#DADADA', mt: 0.5 }}>
                        Current: {selectedPlayer?.current_pts ?? 0} PTS • {selectedPlayer?.current_reb ?? 0} REB • {selectedPlayer?.current_ast ?? 0} AST
                      </Typography>
                    )}
                    {selectedPlayerDetails.data?.espnProjections?.outlook_2026 && (
                      <Typography level="body-xs" sx={{ color: '#AFAFAF', mt: 0.75 }}>
                        2026 Outlook: {selectedPlayerDetails.data.espnProjections.outlook_2026}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ flex: 1, p: 1.25, border: '1px solid #333', borderRadius: 8, bgcolor: '#151515' }}>
                    <Typography level="title-sm" sx={{ color: '#FFF', mb: 0.75 }}>Availability</Typography>
                    {latestInjury && latestInjury.is_current ? (
                      <>
                        <Chip
                          size="sm"
                          variant="solid"
                          color={latestInjury.injury_status === 'Out' ? 'danger' : 'warning'}
                          sx={{ fontWeight: 700, mb: 0.75 }}
                        >
                          {latestInjury.injury_status}
                        </Chip>
                        <Typography level="body-xs" sx={{ color: '#DADADA' }}>
                          {(latestInjury.injury_type || '').replace(/^Injury\/Illness\s*-\s*/i, '') || 'Current issue'}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: '#A8A8A8', mt: 0.5 }}>
                          Updated {formatGameDate(latestInjury.date_updated)}
                        </Typography>
                      </>
                    ) : (
                      <Typography level="body-xs" sx={{ color: '#10B981' }}>No current injuries</Typography>
                    )}
                    <Typography level="body-xs" sx={{ color: '#A8A8A8', mt: 0.75 }}>
                      {injuryHistoryCount} injury record(s) on file
                    </Typography>
                  </Box>

                  <Box sx={{ flex: 1, p: 1.25, border: '1px solid #333', borderRadius: 8, bgcolor: '#151515' }}>
                    <Typography level="title-sm" sx={{ color: '#FFF', mb: 0.75 }}>Awards</Typography>
                    <Typography level="body-xs" sx={{ color: '#DADADA' }}>Player of Month: {awardsData?.pom.length || 0}</Typography>
                    <Typography level="body-xs" sx={{ color: '#DADADA', mt: 0.5 }}>Player of Week: {awardsData?.pow.length || 0}</Typography>
                    <Typography level="body-xs" sx={{ color: '#DADADA', mt: 0.5 }}>Team of Night: {awardsData?.totn.length || 0}</Typography>
                    <Typography level="body-xs" sx={{ color: '#DADADA', mt: 0.5 }}>Team of Week: {awardsData?.totw.length || 0}</Typography>
                  </Box>
                </Stack>

                {spotlightPosts.length > 0 && (
                  <Box sx={{ borderTop: '1px solid #2A2A2A', pt: 1 }}>
                    <Typography level="title-sm" sx={{ color: '#FFF', mb: 1 }}>Recent Spotlight Reels</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {spotlightPosts.slice(0, 4).map((post) => (
                        <Button
                          key={post.id}
                          size="sm"
                          variant="soft"
                          color="neutral"
                          endDecorator={<OpenInNew sx={{ fontSize: 12 }} />}
                          onClick={() => navigate(`/feed/${post.slug}`)}
                        >
                          {formatGameDate(post.game_date)}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          ) : (
            <Box sx={{ p: 2, border: '1px dashed #3A3A3A', borderRadius: 8, textAlign: 'center' }}>
              <Typography level="body-sm" sx={{ color: '#AFAFAF', mb: 1.25 }}>
                No favorite players yet.
              </Typography>
              <Button size="sm" startDecorator={<Add />} onClick={() => setAddOpen(true)}>
                Add your first favorite
              </Button>
            </Box>
          )}
        </Stack>
      </CardContent>

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
                    if (r.type === 'prospect') {
                      const isFav = favoriteProspectIds.has(r.id);
                      return (
                        <ListItem key={`prospect-${r.id}`}>
                          <ListItemButton
                            disabled={isFav}
                            onClick={() => !isFav && handleAddProspect(r.id)}
                            sx={{ borderRadius: 'sm' }}
                          >
                            <Avatar
                              src={r.image_url ?? undefined}
                              alt={r.name}
                              size="sm"
                              sx={{ mr: 1.5, bgcolor: 'neutral.700' }}
                            />
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
                    }
                    return null;
                  })}
                </List>
              )}
            </Box>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </Card>
  );
}
