import {
  Box,
  Typography,
  Stack,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import { useState, useMemo, useEffect } from 'react';
import { useMediaQuery } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import GamesAvatarBar from '../components/GamesAvatarBar';
import TeamOfTheWeek from '../components/DFS/TeamOfTheWeek';
import PlayersOfTheNight from '../components/PlayersOfTheNight';
import ContestsTab from '../components/DFS/ContestsTab';
import EntriesTab from '../components/DFS/EntriesTab';
import PoolDetailsTab from '../components/DFS/PoolDetailsTab';
import { supabase } from '../utils/supabase';

export default function Home() {
  const { user } = useAuth();
  const { data: nbaScoreboard, isLoading: scoreboardLoading } = useNBAScoreboard();
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [poolView, setPoolView] = useState<'details' | 'leaderboard' | 'entry' | 'lineup-builder'>('details');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [favoriteTeamAbbreviations, setFavoriteTeamAbbreviations] = useState<Set<string>>(new Set());
  const [favoritePlayerIds, setFavoritePlayerIds] = useState<Set<number>>(new Set());

  // Detect landscape mobile orientation to adjust padding
  const isMobile = useMediaQuery('(max-width: 900px)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isLandscapeMobile = isMobile && isLandscape
  const isDesktop = useMediaQuery('(min-width: 1200px)')

  // Fetch user favorites for game prioritization
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user?.id) {
        setFavoriteTeamAbbreviations(new Set())
        setFavoritePlayerIds(new Set())
        return
      }

      try {
        // Fetch favorite players
        const { data: favoritePlayers } = await supabase
          .from('player_favorites')
          .select(`
            player_id,
            nba_players (
              nba_player_id
            )
          `)
          .eq('user_id', user.id)
        
        const playerIds = new Set<number>()
        if (favoritePlayers) {
          favoritePlayers.forEach((fp: any) => {
            const nbaPlayerId = fp.nba_players?.nba_player_id
            if (nbaPlayerId && typeof nbaPlayerId === 'number') {
              playerIds.add(nbaPlayerId)
            }
          })
        }
        setFavoritePlayerIds(playerIds)
        
        // Fetch favorite teams
        const { data: favoriteTeams } = await supabase
          .from('user_favorite_teams')
          .select(`
            team_id,
            nba_teams (
              abbreviation
            )
          `)
          .eq('user_id', user.id)
        
        const teamAbbreviations = new Set<string>()
        if (favoriteTeams) {
          favoriteTeams.forEach((ft: any) => {
            const abbreviation = ft.nba_teams?.abbreviation
            if (abbreviation) {
              teamAbbreviations.add(abbreviation)
            }
          })
        }
        setFavoriteTeamAbbreviations(teamAbbreviations)
      } catch (error) {
        console.error('Error fetching favorites:', error)
      }
    }
    
    fetchFavorites()
  }, [user?.id])

  // Sort games to prioritize favorited teams
  const sortedGames = useMemo(() => {
    if (!nbaScoreboard?.games) return []
    
    const games = [...nbaScoreboard.games]
    
    // If user has favorites, prioritize games with favorited teams
    if (favoriteTeamAbbreviations.size > 0 || favoritePlayerIds.size > 0) {
      return games.sort((a, b) => {
        const aHasFavoriteTeam = favoriteTeamAbbreviations.has(a.awayTeam.abbreviation) || 
                                  favoriteTeamAbbreviations.has(a.homeTeam.abbreviation)
        const bHasFavoriteTeam = favoriteTeamAbbreviations.has(b.awayTeam.abbreviation) || 
                                  favoriteTeamAbbreviations.has(b.homeTeam.abbreviation)
        
        // Prioritize games with favorited teams
        if (aHasFavoriteTeam && !bHasFavoriteTeam) return -1
        if (!aHasFavoriteTeam && bHasFavoriteTeam) return 1
        
        // Then prioritize by status (LIVE > Scheduled > Final)
        if (a.gameStatus === 2 && b.gameStatus !== 2) return -1 // LIVE first
        if (a.gameStatus !== 2 && b.gameStatus === 2) return 1
        if (a.gameStatus === 3 && b.gameStatus !== 3) return 1 // Final last
        if (a.gameStatus !== 3 && b.gameStatus === 3) return -1
        
        return 0
      })
    }
    
    // Default: sort by status (LIVE > Scheduled > Final)
    return games.sort((a, b) => {
      if (a.gameStatus === 2 && b.gameStatus !== 2) return -1 // LIVE first
      if (a.gameStatus !== 2 && b.gameStatus === 2) return 1
      if (a.gameStatus === 3 && b.gameStatus !== 3) return 1 // Final last
      if (a.gameStatus !== 3 && b.gameStatus === 3) return -1
      return 0
    })
  }, [nbaScoreboard?.games, favoriteTeamAbbreviations, favoritePlayerIds])

  // Handle game avatar click
  const handleGameClick = (gameId: string) => {
    if (selectedGameId === gameId) {
      setSelectedGameId(null);
    } else {
      setSelectedGameId(gameId);
    }
  };

  // Handle pool selection from contests tab
  const handlePoolSelect = (poolId: string, view?: 'details' | 'lineup-builder', entryId?: string) => {
    setSelectedPoolId(poolId);
    setPoolView(view || 'details');
    setSelectedEntryId(entryId || null);
    // Switch to Pool Details tab (index 2 if user exists, 1 if not)
    setSelectedTabIndex(user ? 2 : 1);
  };

  // Handle back from pool details
  const handlePoolBack = () => {
    setSelectedPoolId(null);
    setPoolView('details');
    setSelectedEntryId(null);
    setSelectedTabIndex(0); // Switch back to Contests tab
  };

  const handleTabSelect = (index: number) => {
    setSelectedTabIndex(index);
    // If switching away from pool details, clear pool selection
    const poolDetailsTabIndex = user ? 2 : 1;
    if (index !== poolDetailsTabIndex) {
      setSelectedPoolId(null);
      setPoolView('details');
      setSelectedEntryId(null);
    }
  };

  return (
    <Box sx={{ 
      bgcolor: '#000000',
      minHeight: '100vh',
      overflowX: 'hidden',
      overflowY: 'auto', // Allow vertical scrolling
      width: '100%',
      // Hide scrollbar but keep functionality
      scrollbarWidth: 'none', // Firefox
      msOverflowStyle: 'none', // IE/Edge
      '&::-webkit-scrollbar': {
        display: 'none', // Chrome/Safari
      },
    }}>
      {/* Games Avatar Bar */}
      <GamesAvatarBar 
        games={sortedGames} 
        isLoading={scoreboardLoading}
        selectedGameId={selectedGameId}
        onGameClick={handleGameClick}
      />

      {/* Main Container */}
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        minWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto', // Normal centering for /today page
        pt: isLandscapeMobile 
          ? '60px' // Only account for GamesAvatarBar in landscape mobile (nav bar is hidden)
          : { xs: '113px', md: '132px' }, // Desktop adjusted for 1.5x taller nav bar (was 126px)
        pb: 2,
        px: { xs: 0, sm: 2, md: 2 },
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Tab Navigation */}
        <Tabs
          value={selectedTabIndex}
          onChange={(event, value) => {
            console.log('Tab change event:', { event, value, selectedTabIndex })
            if (value !== null && value !== undefined) {
              handleTabSelect(value as number)
            }
          }}
          sx={{ 
            mb: 3,
            bgcolor: '#000000',
            '& .MuiTabList-root': {
              bgcolor: '#000000',
              borderBottom: '2px solid #333333',
            },
            '& .MuiTab-root': {
              color: '#FFFFFF',
              '&:hover': {
                bgcolor: '#1a1a1a',
              },
              '&.Mui-selected': {
                color: '#FFC72C',
                bgcolor: '#000000',
              },
            },
            '& .MuiTabPanel-root': {
              bgcolor: '#000000',
              color: '#FFFFFF',
              overflow: 'visible', // Ensure no scrollbars in tab panels
            },
          }}
        >
          <TabList>
            <Tab>Contests</Tab>
            {user && <Tab>My Entries</Tab>}
            {selectedPoolId && <Tab>Pool Details</Tab>}
          </TabList>

          {/* Contests Tab */}
          <TabPanel value={0}>
            <Stack spacing={4} sx={{ px: { xs: 2, sm: 0 } }}>
              <ContestsTab 
                selectedGameId={selectedGameId}
                onPoolSelect={handlePoolSelect}
              />
              
              {/* Team of the Week Section */}
              <Box>
                <TeamOfTheWeek />
              </Box>

              {/* Players of the Night Section */}
              <Box>
                <PlayersOfTheNight />
              </Box>
            </Stack>
          </TabPanel>

          {/* My Entries Tab */}
          {user && (
            <TabPanel value={1}>
              <Stack spacing={4} sx={{ px: { xs: 2, sm: 0 } }}>
                <EntriesTab onPoolSelect={handlePoolSelect} />
              </Stack>
            </TabPanel>
          )}

          {/* Pool Details Tab */}
          {selectedPoolId && (
            <TabPanel value={user ? 2 : 1}>
              <Stack spacing={4} sx={{ px: { xs: 2, sm: 0 } }}>
                <PoolDetailsTab
                  poolId={selectedPoolId}
                  initialView={poolView}
                  entryId={selectedEntryId}
                  onBack={handlePoolBack}
                />
              </Stack>
            </TabPanel>
          )}
        </Tabs>
      </Box>
    </Box>
  );
}
