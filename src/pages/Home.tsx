import {
  Box,
  Typography,
  Stack,
  CircularProgress,
  Card,
  IconButton,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Divider,
  Chip,
  Button,
  Modal,
  ModalDialog,
  ModalClose,
} from '@mui/joy';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useAuth } from '../hooks/useAuth';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import { useBettingOdds } from '../hooks/useBettingOdds';
import { useLivePlayerStats } from '../hooks/useLivePlayerStats';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import GamesAvatarBar from '../components/GamesAvatarBar';
import DFSContestTable from '../components/TodayFeed/DFSContestCard';
import GameScoreCard from '../components/TodayFeed/GameScoreCard';
import TeamOfTheWeek from '../components/DFS/TeamOfTheWeek';
import UserStatsAndEntries from '../components/DFS/UserStatsAndEntries';
import PlayersOfTheNight from '../components/PlayersOfTheNight';
import PoolDetailsModal from '../components/DFS/PoolDetailsModal';
import {
  TrendingUp,
  TrendingDown,
  Remove,
} from '@mui/icons-material';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { getTeamPrimaryColor } from '../utils/nbaTeamColors';

// DFS Contest interface
interface DFSContest {
  pool_id: string;
  name: string;
  description: string;
  slate_name: string;
  slate_date: string;
  lock_time: string;
  entry_fee: number;
  prize_pool: number;
  current_entries: number;
  max_entries: number;
  min_entries: number;
  max_entries_per_user: number;
  difficulty_tier: 'elite' | 'pro' | 'standard';
  salary_cap: number;
  prize_type: string;
  is_guaranteed: boolean;
  is_featured: boolean;
  status: string;
  fill_percentage: number;
  games_count: number;
  active_players_count: number;
  seconds_until_lock: number;
  games: Array<{
    game_id: string;
    home_team: string;
    away_team: string;
    game_date: string;
  }>;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: nbaScoreboard, isLoading: scoreboardLoading } = useNBAScoreboard();
  const { data: bettingOdds, isLoading: oddsLoading } = useBettingOdds();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [poolModalView, setPoolModalView] = useState<'details' | 'leaderboard' | 'entry' | 'lineup-builder'>('details');
  const [activeTab, setActiveTab] = useState<number>(0);

  // Fetch DFS contests
  const { data: dfsContests, isLoading: dfsLoading } = useQuery<DFSContest[]>({
    queryKey: ['dfs-todays-contests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_todays_contests')
        .select('*')
        .order('lock_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Filter contests by selected game
  const filteredContests = selectedGameId
    ? dfsContests?.filter((contest) =>
        contest.games?.some((g) => g.game_id === selectedGameId)
      )
    : dfsContests;

  // Get selected game data
  const selectedGame = selectedGameId
    ? nbaScoreboard?.games.find((g: any) => g.gameId === selectedGameId)
    : null;
  const selectedGameOdds = selectedGameId
    ? bettingOdds?.games.find((g: any) => g.gameId === selectedGameId)
    : null;
  
  // Fetch live player stats for selected game
  const { data: livePlayerStats, isLoading: liveStatsLoading } = useLivePlayerStats(selectedGameId);

  // Handle game avatar click
  const handleGameClick = (gameId: string) => {
    if (selectedGameId === gameId) {
      setSelectedGameId(null);
    } else {
      setSelectedGameId(gameId);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp sx={{ fontSize: '1rem', color: '#16A34A' }} />;
      case 'down':
        return <TrendingDown sx={{ fontSize: '1rem', color: '#DC2626' }} />;
      default:
        return <Remove sx={{ fontSize: '1rem', color: '#000' }} />;
    }
  };

  const formatOdds = (odds: number): string => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const isLoading = scoreboardLoading || dfsLoading;

  return (
    <Box sx={{ 
      bgcolor: 'background.body',
      minHeight: '100vh',
      overflowX: 'hidden',
      width: '100%',
    }}>
      {/* Games Avatar Bar */}
      <GamesAvatarBar 
        games={nbaScoreboard?.games || []} 
        isLoading={scoreboardLoading}
        selectedGameId={selectedGameId}
        onGameClick={handleGameClick}
      />

      {/* Main Container */}
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        minWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto', 
        pt: { xs: '117px', md: '126px' },
        pb: 2,
        px: { xs: 0, sm: 2, md: 2 },
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Selected Game Info Modal */}
        <Modal
          open={!!selectedGame}
          onClose={() => setSelectedGameId(null)}
        >
          <ModalDialog
            sx={{
              maxWidth: { xs: '90vw', sm: '600px', md: '700px' },
              maxHeight: '90vh',
              width: '100%',
              bgcolor: '#fff',
              border: '3px solid #000',
              borderRadius: 0,
              boxShadow: '6px 6px 0px #000',
              overflow: 'auto',
              p: 0,
            }}
          >
            <ModalClose
              sx={{
                top: '12px',
                right: '12px',
                bgcolor: '#000',
                color: '#fff',
                borderRadius: 0,
                border: '2px solid #fff',
                '&:hover': {
                  bgcolor: '#333',
                },
              }}
            />
            <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
              <Typography sx={{ 
                fontFamily: 'serif',
                fontWeight: 900,
                fontSize: '1.1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                🏀 Game Details
              </Typography>
            </Box>
            
            {selectedGame && (
              <Box sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                  {/* Teams */}
                  <Box sx={{ flex: 1 }}>
                    <Stack spacing={2}>
                      {/* Away Team */}
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          component="img"
                          src={getTeamLogoUrl(selectedGame.awayTeam.abbreviation)}
                        alt={selectedGame.awayTeam.abbreviation}
                        sx={{ width: 40, height: 40 }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ 
                          fontFamily: 'serif',
                          fontWeight: 900,
                          fontSize: '1.25rem',
                          color: getTeamPrimaryColor(selectedGame.awayTeam.abbreviation)
                        }}>
                          {selectedGame.awayTeam.abbreviation}
                        </Typography>
                        <Typography sx={{ fontFamily: 'serif', fontSize: '0.75rem', color: '#000', fontWeight: 'bold' }}>
                          ({selectedGame.awayTeam.wins || 0}-{selectedGame.awayTeam.losses || 0})
                        </Typography>
                      </Box>
                      <Typography sx={{ 
                        fontFamily: 'serif',
                        fontWeight: 900,
                        fontSize: '2rem'
                      }}>
                        {selectedGame.awayTeam.points || '-'}
                      </Typography>
                    </Stack>

                    <Divider sx={{ borderColor: '#000', borderWidth: 1 }} />

                    {/* Home Team */}
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box
                        component="img"
                        src={getTeamLogoUrl(selectedGame.homeTeam.abbreviation)}
                        alt={selectedGame.homeTeam.abbreviation}
                        sx={{ width: 40, height: 40 }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ 
                          fontFamily: 'serif',
                          fontWeight: 900,
                          fontSize: '1.25rem',
                          color: getTeamPrimaryColor(selectedGame.homeTeam.abbreviation)
                        }}>
                          {selectedGame.homeTeam.abbreviation}
                        </Typography>
                        <Typography sx={{ fontFamily: 'serif', fontSize: '0.75rem', color: '#000', fontWeight: 'bold' }}>
                          ({selectedGame.homeTeam.wins || 0}-{selectedGame.homeTeam.losses || 0})
                        </Typography>
                      </Box>
                      <Typography sx={{ 
                        fontFamily: 'serif',
                        fontWeight: 900,
                        fontSize: '2rem'
                      }}>
                        {selectedGame.homeTeam.points || '-'}
                      </Typography>
                    </Stack>

                    <Chip
                      size="sm"
                      sx={{
                        bgcolor: selectedGame.gameStatus === 2 ? '#ef4444' : '#000',
                        color: '#fff',
                        borderRadius: 0,
                        fontFamily: 'serif',
                        fontWeight: 'bold',
                        width: 'fit-content',
                      }}
                    >
                      {selectedGame.gameStatus === 2 ? '🔴 LIVE' : selectedGame.gameStatus === 3 ? 'FINAL' : selectedGame.gameStatusText}
                    </Chip>
                  </Stack>
                </Box>

                {/* Odds */}
                {selectedGameOdds && (
                  <Box sx={{ flex: 1, borderLeft: { xs: 'none', md: '2px solid #000' }, pl: { xs: 0, md: 3 }, pt: { xs: 2, md: 0 }, borderTop: { xs: '2px solid #000', md: 'none' } }}>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontSize: '0.9rem',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      mb: 1.5,
                    }}>
                      Betting Lines
                    </Typography>
                    
                    <Stack spacing={1.5}>
                      {(() => {
                        const twoWayMarket = selectedGameOdds.markets?.find((m: any) => m.name === '2way');
                        const spreadMarket = selectedGameOdds.markets?.find((m: any) => m.name === 'spread');

                        return (
                          <>
                            {twoWayMarket && twoWayMarket.books?.[0] && (
                              <Box>
                                <Typography sx={{ fontFamily: 'serif', fontSize: '0.75rem', fontWeight: 700, mb: 0.75, color: '#000' }}>
                                  MONEYLINE
                                </Typography>
                                <Stack spacing={0.5}>
                                  {twoWayMarket.books[0].outcomes.map((outcome: any) => (
                                    <Stack key={outcome.type} direction="row" justifyContent="space-between" alignItems="center">
                                      <Typography sx={{ fontFamily: 'serif', fontSize: '0.85rem', fontWeight: 700 }}>
                                        {outcome.type === 'home' ? selectedGame.homeTeam.abbreviation : selectedGame.awayTeam.abbreviation}
                                      </Typography>
                                      <Stack direction="row" spacing={0.5} alignItems="center">
                                        <Typography sx={{ fontFamily: 'serif', fontSize: '0.9rem', fontWeight: 900 }}>
                                          {formatOdds(outcome.odds)}
                                        </Typography>
                                        {getTrendIcon(outcome.odds_trend)}
                                      </Stack>
                                    </Stack>
                                  ))}
                                </Stack>
                              </Box>
                            )}

                            {spreadMarket && spreadMarket.books?.[0] && (
                              <Box>
                                <Typography sx={{ fontFamily: 'serif', fontSize: '0.75rem', fontWeight: 700, mb: 0.75, color: '#000' }}>
                                  SPREAD
                                </Typography>
                                <Stack spacing={0.5}>
                                  {spreadMarket.books[0].outcomes.map((outcome: any) => (
                                    <Stack key={outcome.type} direction="row" justifyContent="space-between" alignItems="center">
                                      <Typography sx={{ fontFamily: 'serif', fontSize: '0.85rem', fontWeight: 700 }}>
                                        {outcome.type === 'home' ? selectedGame.homeTeam.abbreviation : selectedGame.awayTeam.abbreviation} {outcome.spread > 0 ? '+' : ''}{outcome.spread}
                                      </Typography>
                                      <Stack direction="row" spacing={0.5} alignItems="center">
                                        <Typography sx={{ fontFamily: 'serif', fontSize: '0.9rem', fontWeight: 900 }}>
                                          {formatOdds(outcome.odds)}
                                        </Typography>
                                        {getTrendIcon(outcome.odds_trend)}
                                      </Stack>
                                    </Stack>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                          </>
                        );
                      })()}
                    </Stack>
                  </Box>
                )}
              </Stack>

              {/* Live Player Stats with Fantasy Points */}
              {livePlayerStats && (livePlayerStats.awayTeam.length > 0 || livePlayerStats.homeTeam.length > 0) && (
                <Box sx={{ mt: 3, borderTop: '2px solid #000', pt: 3 }}>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontSize: '1rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    mb: 2,
                  }}>
                    Player Stats (FanDuel Fantasy Points)
                  </Typography>

                  <Stack spacing={3}>
                    {/* Away Team Players */}
                    {livePlayerStats.awayTeam.length > 0 && (
                      <Box>
                        <Typography sx={{ 
                          fontFamily: 'serif',
                          fontSize: '0.9rem',
                          fontWeight: 900,
                          mb: 1.5,
                          color: getTeamPrimaryColor(selectedGame.awayTeam.abbreviation),
                        }}>
                          {selectedGame.awayTeam.abbreviation} Players
                        </Typography>
                        <Stack spacing={1}>
                          {livePlayerStats.awayTeam.slice(0, 5).map((player) => (
                            <Box
                              key={player.nba_player_id}
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                py: 1,
                                px: 1.5,
                                bgcolor: '#f0f0f0',
                                border: '2px solid #000',
                                borderRadius: 0,
                              }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontFamily: 'serif', fontWeight: 900, fontSize: '0.9rem' }}>
                                  {player.player_name}
                                </Typography>
                                <Typography sx={{ fontFamily: 'serif', fontSize: '0.75rem', color: '#000', fontWeight: 'bold' }}>
                                  {player.stats.pts || 0} PTS • {player.stats.reb || 0} REB • {player.stats.ast || 0} AST • {player.stats.stl || 0} STL • {player.stats.blk || 0} BLK
                                </Typography>
                              </Box>
                              <Chip
                                size="lg"
                                sx={{
                                  bgcolor: '#FFC72C',
                                  color: '#000',
                                  fontFamily: 'serif',
                                  fontWeight: 900,
                                  borderRadius: 0,
                                  border: '2px solid #000',
                                  fontSize: '1rem',
                                  minWidth: '60px',
                                }}
                              >
                                {player.fantasy_points?.toFixed(1) || '0.0'}
                              </Chip>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Home Team Players */}
                    {livePlayerStats.homeTeam.length > 0 && (
                      <Box>
                        <Typography sx={{ 
                          fontFamily: 'serif',
                          fontSize: '0.9rem',
                          fontWeight: 900,
                          mb: 1.5,
                          color: getTeamPrimaryColor(selectedGame.homeTeam.abbreviation),
                        }}>
                          {selectedGame.homeTeam.abbreviation} Players
                        </Typography>
                        <Stack spacing={1}>
                          {livePlayerStats.homeTeam.slice(0, 5).map((player) => (
                            <Box
                              key={player.nba_player_id}
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                py: 1,
                                px: 1.5,
                                bgcolor: '#f0f0f0',
                                border: '2px solid #000',
                                borderRadius: 0,
                              }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontFamily: 'serif', fontWeight: 900, fontSize: '0.9rem' }}>
                                  {player.player_name}
                                </Typography>
                                <Typography sx={{ fontFamily: 'serif', fontSize: '0.75rem', color: '#000', fontWeight: 'bold' }}>
                                  {player.stats.pts || 0} PTS • {player.stats.reb || 0} REB • {player.stats.ast || 0} AST • {player.stats.stl || 0} STL • {player.stats.blk || 0} BLK
                                </Typography>
                              </Box>
                              <Chip
                                size="lg"
                                sx={{
                                  bgcolor: '#FFC72C',
                                  color: '#000',
                                  fontFamily: 'serif',
                                  fontWeight: 900,
                                  borderRadius: 0,
                                  border: '2px solid #000',
                                  fontSize: '1rem',
                                  minWidth: '60px',
                                }}
                              >
                                {player.fantasy_points?.toFixed(1) || '0.0'}
                              </Chip>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}

              {/* Loading indicator for live stats */}
              {liveStatsLoading && (
                <Box sx={{ mt: 3, borderTop: '2px solid #000', pt: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontFamily: 'serif', color: '#000', fontWeight: 'bold' }}>
                    Loading player stats...
                  </Typography>
                </Box>
              )}
            </Box>
            )}
          </ModalDialog>
        </Modal>

        {/* Tabs Navigation */}
        <Tabs 
          value={activeTab} 
          onChange={(event, value) => setActiveTab(value as number)}
          sx={{ 
            bgcolor: 'transparent',
            mb: 3,
            mt: 0,
          }}
        >
          <TabList
            sx={{
              bgcolor: '#fff',
              border: '3px solid #000',
              borderRadius: 0,
              boxShadow: '3px 3px 0px #000',
              '--List-padding': '0px',
              '--List-radius': '0px',
              '--ListItem-minHeight': '48px',
              mx: { xs: 2, sm: 0 },
            }}
          >
            <Tab
              value={0}
              sx={{
                fontFamily: 'serif',
                fontWeight: 900,
                fontSize: { xs: '0.9rem', md: '1rem' },
                textTransform: 'uppercase',
                borderRadius: 0,
                borderRight: '2px solid #000',
                '&.Mui-selected': {
                  bgcolor: '#000',
                  color: '#fff',
                },
                '&:hover': {
                  bgcolor: '#f0f0f0',
                },
                '&.Mui-selected:hover': {
                  bgcolor: '#333',
                },
              }}
            >
              🏆 Contests
            </Tab>
            {user && (
              <Tab
                value={1}
                sx={{
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: { xs: '0.9rem', md: '1rem' },
                  textTransform: 'uppercase',
                  borderRadius: 0,
                  borderRight: '2px solid #000',
                  '&.Mui-selected': {
                    bgcolor: '#000',
                    color: '#fff',
                  },
                  '&:hover': {
                    bgcolor: '#f0f0f0',
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: '#333',
                  },
                }}
              >
                📊 Your Stats
              </Tab>
            )}
            <Tab
              value={user ? 2 : 1}
              sx={{
                fontFamily: 'serif',
                fontWeight: 900,
                fontSize: { xs: '0.9rem', md: '1rem' },
                textTransform: 'uppercase',
                borderRadius: 0,
                borderRight: '2px solid #000',
                '&.Mui-selected': {
                  bgcolor: '#000',
                  color: '#fff',
                },
                '&:hover': {
                  bgcolor: '#f0f0f0',
                },
                '&.Mui-selected:hover': {
                  bgcolor: '#333',
                },
              }}
            >
              ⭐ Team of Week
            </Tab>
            <Tab
              value={user ? 3 : 2}
              sx={{
                fontFamily: 'serif',
                fontWeight: 900,
                fontSize: { xs: '0.9rem', md: '1rem' },
                textTransform: 'uppercase',
                borderRadius: 0,
                '&.Mui-selected': {
                  bgcolor: '#000',
                  color: '#fff',
                },
                '&:hover': {
                  bgcolor: '#f0f0f0',
                },
                '&.Mui-selected:hover': {
                  bgcolor: '#333',
                },
              }}
            >
              🌟 Players
            </Tab>
          </TabList>

          {/* Tab Panels */}
          <TabPanel value={0} sx={{ p: 0, pt: 3 }}>
            {isLoading ? (
              <Stack spacing={3}>
                {[1, 2, 3].map((i) => (
                  <Card
                    key={i}
                    sx={{
                      height: 400,
                      bgcolor: 'background.level1',
                      border: '3px solid #000',
                      borderRadius: 0,
                      animation: 'pulse 1.5s ease-in-out infinite',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 0.6 },
                        '50%': { opacity: 1 },
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
                      <CircularProgress size="lg" />
                      <Typography level="body-sm" sx={{ fontFamily: 'serif' }}>
                        Loading contests...
                      </Typography>
                    </Box>
                  </Card>
                ))}
              </Stack>
            ) : filteredContests && filteredContests.length > 0 ? (
              <DFSContestTable
                contests={filteredContests}
                onDetailsClick={(contest) => {
                  setPoolModalView('details');
                  setSelectedPoolId(contest.pool_id);
                }}
                onJoinClick={(contest) => {
                  setPoolModalView('lineup-builder');
                  setSelectedPoolId(contest.pool_id);
                }}
              />
            ) : (
              <Card
                variant="outlined"
                sx={{
                  bgcolor: '#fff',
                  border: '3px solid #000',
                  borderRadius: 0,
                  p: 4,
                  textAlign: 'center',
                }}
              >
                <Typography level="h4" sx={{ fontFamily: 'serif', fontWeight: 900, mb: 1 }}>
                  No Contests Available
                </Typography>
                <Typography sx={{ fontFamily: 'serif', color: '#000', fontWeight: 'bold' }}>
                  {selectedGameId ? 'No contests for this game right now' : 'Check back later for new contests'}
                </Typography>
              </Card>
            )}
          </TabPanel>

          {user && (
            <TabPanel value={1} sx={{ p: 0, pt: 3 }}>
              <UserStatsAndEntries userId={user.id} />
            </TabPanel>
          )}

          <TabPanel value={user ? 2 : 1} sx={{ p: 0, pt: 3 }}>
            <TeamOfTheWeek />
          </TabPanel>

          <TabPanel value={user ? 3 : 2} sx={{ p: 0, pt: 3 }}>
            <PlayersOfTheNight />
          </TabPanel>
        </Tabs>
      </Box>

      {/* Pool Details Modal */}
      <PoolDetailsModal
        poolId={selectedPoolId}
        open={!!selectedPoolId}
        onClose={() => {
          setSelectedPoolId(null);
          setPoolModalView('details');
        }}
        initialView={poolModalView}
      />
    </Box>
  );
}
