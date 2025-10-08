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
} from '@mui/joy';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import { useCurrentFantasyWeek, getWeekDisplayText, getSeasonPhaseColor } from '../hooks/useCurrentFantasyWeek';
import { useUserTeamRoster } from '../hooks/useUserTeamRoster';
import { useTeams } from '../hooks/useTeams';
import { useMatchups } from '../hooks/useMatchups';
import WeekCalendar from '../components/WeekCalendar';

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
  const { currentWeek: fantasyWeek, seasonPhase, isLoading: weekLoading } = useCurrentFantasyWeek();
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
  const totalWeeks = 26; // Total weeks in fantasy season
  
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  const [isLineupLocked, setIsLineupLocked] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Get matchup data for current week
  const { data: currentWeekMatchups } = useMatchups(leagueId, currentWeek);

  // Update current week when fantasy week loads
  useEffect(() => {
    if (fantasyWeek) {
      // If we're in preseason (week 0), default to week 1 for lineup setting
      if (fantasyWeek.week_number === 0) {
        setCurrentWeek(1);
      } else {
        setCurrentWeek(fantasyWeek.week_number);
      }
    }
  }, [fantasyWeek]);

  // Get user's team data
  const userTeam = teams?.find(team => team.user_id === user?.id);
  
  // Find current week matchup for user's team
  const currentMatchup = currentWeekMatchups?.find(matchup => 
    matchup.fantasy_team1_id === userTeam?.id || matchup.fantasy_team2_id === userTeam?.id
  );
  
  // Get opponent team info
  const opponentTeam = currentMatchup ? (
    currentMatchup.fantasy_team1_id === userTeam?.id ? currentMatchup.team2 : currentMatchup.team1
  ) : null;
  
  // Transform roster data to match the expected format
  const team = {
    id: userTeam?.id || 'my-team-id',
    name: userTeam?.team_name || 'My Team',
    logo: 'https://i.imgur.com/F02Qy2j.png',
    owner: user?.email || 'Current User',
    record: `${userTeam?.wins || 0}-${userTeam?.losses || 0}`,
    place: 'TBD', // TODO: Calculate from standings
    totalPoints: userTeam?.points_for || 0,
    streak: 'N/A', // TODO: Calculate from recent results
    fantasyLevel: 'Bronze', // TODO: Calculate from performance
    fantasyRating: 0, // TODO: Calculate from performance
    matchup: {
      week: currentWeek,
      opponentName: opponentTeam?.team_name || 'TBD',
      opponentRank: opponentTeam ? `${opponentTeam.wins}-${opponentTeam.losses}` : 'TBD',
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
      avatar: rosterPlayer.nba_player_id 
        ? `https://cdn.nba.com/headshots/nba/latest/260x190/${rosterPlayer.nba_player_id}.png`
        : '', // NBA headshot URL
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

  if (isLoading || weekLoading || rosterLoading) {
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

                {/* Combined Header - Week Navigation + Matchup Info */}
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                      {/* Left Section - Week Info & Navigation */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 auto', minWidth: '300px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
                            {getWeekDisplayText(fantasyWeek, seasonPhase)} Lineup
                          </Typography>
                          <Chip 
                            variant="soft" 
                            color={getSeasonPhaseColor(seasonPhase)}
                            size="sm"
                          >
                            {seasonPhase === 'preseason' ? 'Preseason' : 
                             seasonPhase === 'playoffs' ? 'Playoffs' : 
                             seasonPhase === 'regular_season' ? 'Regular Season' : 'Offseason'}
                          </Chip>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Button
                            variant="outlined"
                            size="sm"
                            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                            disabled={currentWeek <= 1}
                            sx={{ minWidth: 'auto', px: 1 }}
                          >
                            ←
                          </Button>
                          <Typography level="body-sm" sx={{ minWidth: '60px', textAlign: 'center' }}>
                            {currentWeek} of {totalWeeks}
                          </Typography>
                          <Button
                            variant="outlined"
                            size="sm"
                            onClick={() => setCurrentWeek(Math.min(totalWeeks, currentWeek + 1))}
                            disabled={currentWeek >= totalWeeks}
                            sx={{ minWidth: 'auto', px: 1 }}
                          >
                            →
                          </Button>
                        </Box>
                      </Box>

                      {/* Center Section - Matchup Info */}
                      {currentMatchup && opponentTeam && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 auto', minWidth: '400px' }}>
                          <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              {team.name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {team.record} • {team.totalPoints.toFixed(1)} PF
                            </Typography>
                          </Box>
                          
                          <Box sx={{ textAlign: 'center', minWidth: '60px' }}>
                            <Typography level="title-sm" sx={{ fontWeight: 'bold', color: 'primary.500', mb: 0.5 }}>
                              VS
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              Week {currentWeek}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ textAlign: 'center', minWidth: '80px' }}>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                              {opponentTeam.team_name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {opponentTeam.wins}-{opponentTeam.losses} • {opponentTeam.points_for?.toFixed(1) || '0.0'} PF
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Right Section - Status & Date */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
                        {currentMatchup && (
                          <Box sx={{ textAlign: 'right' }}>
                            <Chip 
                              variant="soft" 
                              color={currentMatchup.status === 'completed' ? 'success' : 
                                     currentMatchup.status === 'in_progress' ? 'warning' : 'neutral'}
                              size="sm"
                            >
                              {currentMatchup.status === 'completed' ? 'Completed' :
                               currentMatchup.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                            </Chip>
                          </Box>
                        )}
                        
                        {fantasyWeek && (
                          <Typography level="body-xs" color="neutral" sx={{ minWidth: '120px', textAlign: 'right' }}>
                            {fantasyWeek.start_date} - {fantasyWeek.end_date}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {/* Week Schedule - Real NBA Data */}
                <WeekCalendar weekNumber={currentWeek} />

      {/* Court Layout */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          {/* Basketball Court - Full Width with Player Bench on Left */}
          <Box sx={{ 
            width: '100%', 
            height: { xs: '500px', sm: '600px', md: '700px' }, 
            position: 'relative', 
            display: 'flex' 
          }}>
            {/* Player Bench - Left Side */}
            <Box
              sx={{
                width: '70px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                mr: 1,
                overflowY: 'auto',
                // Mobile responsive
                '@media (max-width: 768px)': {
                  width: '60px',
                  mr: 0.5
                }
              }}
                onDragOver={handleDragOver}
                onDrop={handleRosterDrop}
            >
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: 0.5,
                width: '100%',
                alignItems: 'center'
              }}>
                    {team.allPlayers.map((player) => {
                      const inLineup = isPlayerInLineup(player.id);
                      const isSelectable = !inLineup && !isPlayerLocked(player) && !isLineupLocked;
                  
                      return (
                    <Box
                          key={player.id}
                      sx={{
                        width: 50,
                        height: 50,
                        border: '1px dashed #666',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: inLineup ? 'rgba(25, 118, 210, 0.1)' : 'rgba(255,255,255,0.3)',
                        cursor: isSelectable ? 'grab' : 'not-allowed',
                        opacity: isLineupLocked ? 0.6 : 1,
                        transition: 'all 0.2s',
                        '&:hover': isSelectable ? {
                          borderColor: '#1976d2',
                          bgcolor: 'rgba(255,255,255,0.7)',
                          transform: 'scale(1.05)'
                        } : {},
                        position: 'relative',
                        // Mobile responsive
                        '@media (max-width: 768px)': {
                          width: 45,
                          height: 45
                        }
                      }}
                          draggable={isSelectable}
                          onDragStart={() => handleDragStart(player)}
                    >
                      <Avatar
                        src={player.avatar}
                        sx={{ 
                          width: 45, 
                          height: 45,
                          '& img': {
                            objectFit: 'cover'
                          },
                          // Mobile responsive
                          '@media (max-width: 768px)': {
                            width: 40,
                            height: 40
                          }
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.textContent = player.name.charAt(0);
                          }
                        }}
                      >
                        {player.name.charAt(0)}
                      </Avatar>
                      
                      {/* Position indicator */}
                      <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                          position: 'absolute',
                          bottom: -3,
                          right: -3,
                          minWidth: 16,
                          height: 16,
                          fontSize: '8px',
                          bgcolor: inLineup ? 'primary.500' : 'neutral.500',
                          color: 'white',
                          // Mobile responsive
                          '@media (max-width: 768px)': {
                            minWidth: 14,
                            height: 14,
                            fontSize: '7px',
                            bottom: -2,
                            right: -2
                          }
                        }}
                      >
                        {player.pos}
                      </Chip>
                    </Box>
                      );
                    })}
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
                      borderRadius: { xs: '8px', sm: '12px', md: '20px' },
                      border: { xs: '2px solid #000000', md: '3px solid #000000' },
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
                      borderRadius: { xs: '8px', sm: '12px', md: '20px' },
                      border: { xs: '2px solid #000000', md: '3px solid #000000' },
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
