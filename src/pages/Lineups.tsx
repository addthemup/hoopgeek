import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  Avatar,
  Button,
  Alert,
  LinearProgress,
  Modal,
  ModalDialog,
  ModalClose,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Table,
} from '@mui/joy';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import { useCurrentSeasonInfo } from '../hooks/useNBASchedule';
import { useUserTeamRoster } from '../hooks/useUserTeamRoster';
import { useTeams } from '../hooks/useTeams';
import WeekCalendar from '../components/WeekCalendar';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

interface GameMatchup {
  opponent: string;
  date: string;
  time: string;
  fantasyPoints?: number;
  isCompleted: boolean;
}

interface Player {
  id: string;
  name: string;
  team: string;
  pos: string;
  status: string;
  game: string;
  gameTime: string;
  projPts: number;
  actualPts: number;
  startPct: number;
  rosPct: number;
  matchupRating: string;
  avatar: string;
  weekMatchups?: GameMatchup[];
}

interface LineupPosition {
  id: string;
  position: string;
  player: Player | null;
  x: number;
  y: number;
}

interface LineupsProps {
  leagueId: string;
}

export default function Lineups({ leagueId }: LineupsProps) {
  const { user } = useAuth();
  const { data: league, isLoading, error } = useLeague(leagueId);
  const { data: seasonInfo, isLoading: seasonLoading } = useCurrentSeasonInfo();
  const { data: userTeamRoster, isLoading: rosterLoading } = useUserTeamRoster(leagueId);
  const { data: teams } = useTeams(leagueId);
  
  // State for lineup management
  const [activeTab, setActiveTab] = useState(0);
  
  const [starters, setStarters] = useState<LineupPosition[]>([
    // Starting 5 - F-C-F, G-G layout
    { id: 'f1', position: 'F', player: null, x: 20, y: 20 }, // Forward - top left
    { id: 'c', position: 'C', player: null, x: 50, y: 20 },   // Center - top
    { id: 'f2', position: 'F', player: null, x: 80, y: 20 }, // Forward - top right
    { id: 'g1', position: 'G', player: null, x: 20, y: 85 }, // Guard - bottom left
    { id: 'g2', position: 'G', player: null, x: 80, y: 85 }, // Guard - bottom right
  ]);

  const [bench, setBench] = useState<LineupPosition[]>([
    // Bench players - 8 slots
    { id: 'bench1', position: 'F', player: null, x: 20, y: 20 }, // Forward - top
    { id: 'bench2', position: 'C', player: null, x: 50, y: 20 }, // Center - top
    { id: 'bench3', position: 'F', player: null, x: 80, y: 20 }, // Forward - top
    { id: 'bench4', position: 'UTIL', player: null, x: 30, y: 50 }, // Utility - middle
    { id: 'bench5', position: 'UTIL', player: null, x: 70, y: 50 }, // Utility - middle
    { id: 'bench6', position: 'G', player: null, x: 20, y: 85 }, // Guard - bottom
    { id: 'bench7', position: 'G', player: null, x: 50, y: 85 }, // Guard - bottom
    { id: 'bench8', position: 'G', player: null, x: 80, y: 85 }, // Guard - bottom
  ]);

  // Week management state - use real season data
  const [currentWeek, setCurrentWeek] = useState(1);
  const totalWeeks = seasonInfo?.totalWeeks || 26;
  
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  const [isLineupLocked, setIsLineupLocked] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Update current week when season info loads
  useEffect(() => {
    if (seasonInfo?.currentWeek) {
      setCurrentWeek(seasonInfo.currentWeek);
    }
  }, [seasonInfo]);

  // Get user's team data
  const userTeam = teams?.find(team => team.user_id === user?.id);
  
  // Transform roster data to match the expected format
  const team = {
    id: userTeam?.id || 'my-team-id',
    name: userTeam?.team_name || 'My Team',
    logo: 'https://i.imgur.com/F02Qy2j.png',
    owner: user?.email || 'Current User',
    record: '0-0-0', // TODO: Calculate from matchups
    place: 'TBD', // TODO: Calculate from standings
    totalPoints: 0, // TODO: Calculate from season points
    streak: 'N/A', // TODO: Calculate from recent results
    fantasyLevel: 'Bronze', // TODO: Calculate from performance
    fantasyRating: 0, // TODO: Calculate from performance
    matchup: {
      week: currentWeek,
      opponentName: 'TBD', // TODO: Get from weekly matchups
      opponentRank: 'TBD',
      projectedScore: 0,
      opponentProjectedScore: 0,
      matchupRating: 'TBD',
      lastWeekResult: 'No games yet'
    },
    allPlayers: userTeamRoster?.map(rosterPlayer => ({
      id: rosterPlayer.id.toString(),
      name: rosterPlayer.name,
      team: rosterPlayer.team_abbreviation,
      pos: rosterPlayer.position,
      status: 'Active', // TODO: Get real status from NBA API
      game: 'TBD', // TODO: Get from NBA schedule
      gameTime: 'TBD', // TODO: Get from NBA schedule
      projPts: 0, // TODO: Get from projections
      actualPts: 0, // TODO: Get from actual stats
      startPct: 100, // TODO: Calculate from usage
      rosPct: 100, // TODO: Calculate from rest of season projections
      matchupRating: 'Neutral', // TODO: Calculate from matchup analysis
      avatar: `https://cdn.nba.com/headshots/nba/latest/260x190/${rosterPlayer.id}.png`, // NBA headshot URL
      weekMatchups: [] // TODO: Get from NBA schedule
    })) || [],
  };

  // No initialization - start with empty lineup

  const handleDragStart = (player: Player) => {
    setDraggedPlayer(player);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, positionId: string, isStarter: boolean) => {
    e.preventDefault();
    if (!draggedPlayer) return;

    if (isStarter) {
      setStarters(prev => prev.map(pos => {
        if (pos.id === positionId) {
          return { ...pos, player: draggedPlayer };
        }
        return pos;
      }));
    } else {
      setBench(prev => prev.map(pos => {
        if (pos.id === positionId) {
          return { ...pos, player: draggedPlayer };
        }
        return pos;
      }));
    }

    setDraggedPlayer(null);
  };

  // Handle dropping a player back to the roster (remove from lineup)
  const handleRosterDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedPlayer) return;

    // Remove player from lineup
    setStarters(prev => prev.map(pos => {
      if (pos.player?.id === draggedPlayer.id) {
        return { ...pos, player: null };
      }
      return pos;
    }));

    setBench(prev => prev.map(pos => {
      if (pos.player?.id === draggedPlayer.id) {
        return { ...pos, player: null };
      }
      return pos;
    }));

    setDraggedPlayer(null);
  };

  // Helper function to check if a player is in the lineup
  const isPlayerInLineup = (playerId: string) => {
    return [...starters, ...bench].some(pos => pos.player?.id === playerId);
  };

  // Helper function to get player's matchups for current week
  const getPlayerWeekMatchups = (player: Player) => {
    return player.weekMatchups || [];
  };

  // Helper function to check if player is locked (first game has started)
  const isPlayerLocked = (player: Player) => {
    const matchups = getPlayerWeekMatchups(player);
    return matchups.some(matchup => matchup.isCompleted);
  };

  // Helper function to render court with positions
  const renderCourt = (positions: LineupPosition[], isStarter: boolean) => {
    return (
      <>
        {/* Basketball Court Lines */}
        {/* Baseline (Top - where the rim is) */}
        <Box
          sx={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            height: '3px',
            background: 'black',
            opacity: 0.8,
          }}
        />
        
        {/* Sidelines */}
        <Box
          sx={{
            position: 'absolute',
            left: '0',
            top: '0',
            bottom: '0',
            width: '3px',
            background: 'black',
            opacity: 0.8,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            right: '0',
            top: '0',
            bottom: '0',
            width: '3px',
            background: 'black',
            opacity: 0.8,
          }}
        />
        
        {/* Free Throw Line */}
        <Box
          sx={{
            position: 'absolute',
            top: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            height: '3px',
            background: 'black',
            opacity: 0.8,
          }}
        />
        
        {/* Free Throw Circle */}
        <Box
          sx={{
            position: 'absolute',
            top: '120px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            height: '200px',
            border: '3px solid black',
            borderRadius: '50%',
            opacity: 0.6,
          }}
        />
        
        {/* Three Point Line */}
        <Box
          sx={{
            position: 'absolute',
            bottom: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '300px',
            height: '150px',
            border: '3px solid black',
            borderTop: 'none',
            borderRadius: '0 0 150px 150px',
            opacity: 0.6,
          }}
        />
        
                {/* Basketball Rim */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60px',
                    height: '40px',
                    border: '4px solid #1976d2',
                    borderRadius: '50%',
                    background: 'transparent',
                    opacity: 0.9,
                  }}
                />

        {/* Player Positions */}
        {positions.map((pos) => (
          <Box
            key={pos.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, pos.id, isStarter)}
            sx={{
              position: 'absolute',
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
                      width: isStarter ? '200px' : '150px',
                      height: isStarter ? '220px' : '180px',
                      border: pos.player ? '2px solid #1976d2' : '2px dashed #ccc',
                      borderRadius: '12px',
                      background: pos.player 
                        ? 'rgba(25, 118, 210, 0.1)' 
                        : 'rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translate(-50%, -50%) scale(1.02)',
                        border: '2px solid #1976d2',
                        background: 'rgba(25, 118, 210, 0.15)',
                      }
            }}
          >
            <Typography 
              level="h4" 
              sx={{ 
                color: 'white', 
                mb: 1, 
                fontWeight: 'bold', 
                textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                fontSize: isStarter ? '1.2rem' : '1rem',
                letterSpacing: '0.1em'
              }}
            >
              {pos.position}
            </Typography>
            {pos.player ? (
              <Box sx={{ textAlign: 'center' }}>
                <Avatar
                  src={pos.player.avatar}
                  alt={pos.player.name}
                  sx={{ 
                    mb: 1.5, 
                    border: '3px solid rgba(255, 255, 255, 0.8)',
                    width: isStarter ? '60px' : '50px',
                    height: isStarter ? '60px' : '50px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                  }}
                />
                        <Typography 
                          level="body-md" 
                          sx={{ 
                            color: 'black', 
                            textAlign: 'center', 
                            fontWeight: 'bold',
                            fontSize: isStarter ? '0.9rem' : '0.8rem',
                            mb: 0.5
                          }}
                        >
                          {pos.player.name.split(' ')[0]}
                        </Typography>
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            color: '#666', 
                            textAlign: 'center',
                            fontWeight: '600',
                            fontSize: isStarter ? '0.75rem' : '0.7rem'
                          }}
                        >
                          {pos.player.team}
                        </Typography>
              </Box>
            ) : (
              <Typography 
                level="body-sm" 
                sx={{ 
                  color: '#999', 
                  textAlign: 'center',
                  fontStyle: 'italic',
                  fontSize: isStarter ? '0.8rem' : '0.7rem'
                }}
              >
                Drop {pos.position} Here
              </Typography>
            )}
          </Box>
        ))}
      </>
    );
  };

  if (isLoading || seasonLoading || rosterLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <Typography level="body-md">
          Error loading league data: {error.message}
        </Typography>
      </Alert>
    );
  }

  if (!league) {
    return (
      <Alert color="warning">
        <Typography level="body-md">
          League not found.
        </Typography>
      </Alert>
    );
  }

  if (!userTeam) {
    return (
      <Alert color="warning">
        <Typography level="body-md">
          You are not a member of this league.
        </Typography>
      </Alert>
    );
  }

  if (!userTeamRoster || userTeamRoster.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          No Players Drafted Yet
        </Typography>
        <Typography level="body-md" color="neutral" sx={{ mb: 3 }}>
          Your team roster is empty. Once you draft players, they will appear here for lineup management.
        </Typography>
        <Alert color="neutral">
          <Typography>
            Go to the Draft tab to start building your team!
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>

                {/* Week Navigation Header */}
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                          Week {currentWeek} Lineup
                        </Typography>
                        <Chip 
                          variant="soft" 
                          color={seasonInfo?.isPlayoffs ? 'warning' : seasonInfo?.isAllStarWeek ? 'neutral' : 'primary'}
                          size="sm"
                        >
                          {seasonInfo?.isPlayoffs ? 'Playoffs' : seasonInfo?.isAllStarWeek ? 'All-Star Break' : 'Regular Season'}
                        </Chip>
                        {seasonInfo && (
                          <Chip 
                            variant="outlined" 
                            color="neutral"
                            size="sm"
                            sx={{ fontSize: '0.7rem' }}
                          >
                            Mock Date: {new Date(seasonInfo.mockCurrentDate).toLocaleDateString()}
                          </Chip>
                        )}
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="sm"
                          onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                          disabled={currentWeek <= 1}
                        >
                          ← Previous Week
                        </Button>
                        
                        <Typography level="body-sm" sx={{ mx: 2, minWidth: '80px', textAlign: 'center' }}>
                          {currentWeek} of {totalWeeks}
                        </Typography>
                        
                        <Button
                          variant="outlined"
                          size="sm"
                          onClick={() => setCurrentWeek(Math.min(totalWeeks, currentWeek + 1))}
                          disabled={currentWeek >= totalWeeks}
                        >
                          Next Week →
                        </Button>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* Week Schedule - Real NBA Data */}
                <WeekCalendar weekNumber={currentWeek} />

      {/* Court Layout */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          {/* Main Layout Container */}
          <Box sx={{ display: 'flex', gap: 3, height: '700px' }}>
            {/* Team Roster - Left Side */}
            <Box sx={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
              <Typography level="body-sm" sx={{ mb: 2, fontWeight: 'bold' }}>
                Roster (15)
              </Typography>
              <Box
                onDragOver={handleDragOver}
                onDrop={handleRosterDrop}
                sx={{
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  maxHeight: '600px',
                }}
              >
                <Table size="sm" sx={{ '& tbody tr': { height: '40px' } }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', padding: '8px' }}></th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Player</th>
                      <th style={{ width: '50px', padding: '8px' }}>Pos</th>
                      <th style={{ width: '60px', padding: '8px' }}>Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.allPlayers.map((player) => {
                      const inLineup = isPlayerInLineup(player.id);
                      const isSelectable = !inLineup && !isPlayerLocked(player) && !isLineupLocked;
                      return (
                        <tr
                          key={player.id}
                          draggable={isSelectable}
                          onDragStart={() => handleDragStart(player)}
                          style={{
                            cursor: isSelectable ? 'grab' : 'not-allowed',
                            opacity: isLineupLocked ? 0.6 : 1,
                            backgroundColor: inLineup ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (isSelectable) {
                              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = inLineup ? 'rgba(25, 118, 210, 0.1)' : 'transparent';
                          }}
                        >
                          <td style={{ padding: '8px' }}>
                            {isSelectable && (
                              <DragIndicatorIcon sx={{ color: 'text.secondary', fontSize: '16px' }} />
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {player.name}
                            </Typography>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <Typography level="body-sm">{player.pos}</Typography>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <Typography level="body-sm">{player.team}</Typography>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Box>
            </Box>

            {/* Basketball Court - Right Side with Tabs */}
            <Box sx={{ flex: 1 }}>
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue as number)}
                sx={{ height: '100%' }}
              >
                <TabList>
                  <Tab>Starters</Tab>
                  <Tab>Bench</Tab>
                </TabList>
                
                <TabPanel value={0} sx={{ p: 0, height: 'calc(100% - 48px)' }}>
                  <Box
                    sx={{
                      height: '100%',
                      position: 'relative',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%)',
                      borderRadius: '20px',
                      border: '3px solid #000000',
                      overflow: 'hidden',
                    }}
                  >
                    {renderCourt(starters, true)}
                  </Box>
                </TabPanel>
                
                <TabPanel value={1} sx={{ p: 0, height: 'calc(100% - 48px)' }}>
                  <Box
                    sx={{
                      height: '100%',
                      position: 'relative',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%)',
                      borderRadius: '20px',
                      border: '3px solid #000000',
                      overflow: 'hidden',
                    }}
                  >
                    {renderCourt(bench, false)}
                  </Box>
                </TabPanel>
              </Tabs>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Save Modal */}
      <Modal open={showSaveModal} onClose={() => setShowSaveModal(false)}>
        <ModalDialog>
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2 }}>
            Save Lineup
          </Typography>
          <Typography level="body-md" sx={{ mb: 3 }}>
            Are you sure you want to save this lineup for Week {team.matchup.week}? 
            Once saved, you won't be able to make changes until the next week.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={() => setShowSaveModal(false)}>
              Cancel
            </Button>
            <Button 
              variant="solid" 
              onClick={() => {
                setIsLineupLocked(true);
                setShowSaveModal(false);
              }}
            >
              Save & Lock Lineup
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
