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
  Grid,
  IconButton,
  Tooltip,
} from '@mui/joy';
import { Save, Lock, LockOpen, Refresh } from '@mui/icons-material';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import { useCurrentSeasonInfo } from '../hooks/useNBASchedule';
import { useUserTeamRoster } from '../hooks/useUserTeamRoster';
import WeekCalendar from '../components/WeekCalendar';
import { supabase } from '../lib/supabase';

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
  nba_player_id: number;
}

interface LineupPosition {
  id: string;
  position: string;
  player: Player | null;
  x: number;
  y: number;
  isStarter: boolean;
}

interface WeeklyLineup {
  starters: LineupPosition[];
  bench: LineupPosition[];
  isLocked: boolean;
  lockedAt?: string;
}

interface LineupsNewProps {
  leagueId: string;
}

export default function LineupsNew({ leagueId }: LineupsNewProps) {
  const { user } = useAuth();
  const { data: league, isLoading, error } = useLeague(leagueId);
  const { data: seasonInfo, isLoading: seasonLoading } = useCurrentSeasonInfo();
  const { data: userTeamRoster, isLoading: rosterLoading } = useUserTeamRoster(leagueId);
  
  // State for lineup management
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isLoadingLineup, setIsLoadingLineup] = useState(false);
  const [isSavingLineup, setIsSavingLineup] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Lineup state
  const [lineup, setLineup] = useState<WeeklyLineup>({
    starters: [
      { id: 'pg', position: 'PG', player: null, x: 20, y: 85, isStarter: true },
      { id: 'sg', position: 'SG', player: null, x: 80, y: 85, isStarter: true },
      { id: 'sf', position: 'SF', player: null, x: 20, y: 20, isStarter: true },
      { id: 'pf', position: 'PF', player: null, x: 80, y: 20, isStarter: true },
      { id: 'c', position: 'C', player: null, x: 50, y: 20, isStarter: true },
    ],
    bench: [],
    isLocked: false
  });
  
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  const [draggedFromPosition, setDraggedFromPosition] = useState<string | null>(null);

  // Get user's team
  const userTeam = userTeamRoster?.[0]?.fantasy_team_id ? {
    id: userTeamRoster[0].fantasy_team_id,
    name: 'My Team'
  } : null;

  // Convert roster data to players
  const allPlayers: Player[] = userTeamRoster?.map(rosterPlayer => ({
    id: rosterPlayer.id.toString(),
    name: rosterPlayer.name,
    team: rosterPlayer.team_abbreviation || rosterPlayer.team_name || 'N/A',
    pos: rosterPlayer.position || 'N/A',
    status: 'Active',
    game: 'TBD',
    gameTime: 'TBD',
    projPts: 0,
    actualPts: 0,
    startPct: 100,
    rosPct: 100,
    matchupRating: 'Neutral',
    avatar: `https://cdn.nba.com/headshots/nba/latest/260x190/${rosterPlayer.nba_player_id}.png`,
    nba_player_id: rosterPlayer.nba_player_id
  })) || [];

  // Load lineup for current week
  useEffect(() => {
    if (userTeam && currentWeek) {
      loadWeeklyLineup();
    }
  }, [userTeam, currentWeek]);

  const loadWeeklyLineup = async () => {
    if (!userTeam) return;
    
    setIsLoadingLineup(true);
    try {
      const { data, error } = await supabase.rpc('get_weekly_lineup', {
        team_id_param: userTeam.id,
        week_num: currentWeek,
        season_year_param: new Date().getFullYear()
      });

      if (error) {
        console.error('Error loading lineup:', error);
        return;
      }

      if (data && Object.keys(data).length > 0) {
        setLineup(data);
      } else {
        // Initialize empty lineup with bench players
        const benchPlayers = allPlayers.filter(player => 
          !lineup.starters.some(starter => starter.player?.id === player.id)
        );
        
        setLineup(prev => ({
          ...prev,
          bench: benchPlayers.map((player, index) => ({
            id: `bench-${index}`,
            position: 'BENCH',
            player,
            x: 5 + (index % 4) * 20, // Arrange in rows
            y: 5 + Math.floor(index / 4) * 15,
            isStarter: false
          }))
        }));
      }
    } catch (error) {
      console.error('Error loading lineup:', error);
    } finally {
      setIsLoadingLineup(false);
    }
  };

  const saveWeeklyLineup = async () => {
    if (!userTeam) return;
    
    setIsSavingLineup(true);
    try {
      const { data, error } = await supabase.rpc('save_weekly_lineup', {
        team_id_param: userTeam.id,
        week_num: currentWeek,
        season_year_param: new Date().getFullYear(),
        lineup_data_param: lineup
      });

      if (error) {
        throw error;
      }

      setSaveMessage({ type: 'success', text: 'Lineup saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving lineup:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save lineup. Please try again.' });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSavingLineup(false);
    }
  };

  const handleDragStart = (player: Player, fromPositionId?: string) => {
    setDraggedPlayer(player);
    setDraggedFromPosition(fromPositionId || null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetPositionId: string, isStarter: boolean) => {
    e.preventDefault();
    if (!draggedPlayer) return;

    // Remove player from their current position
    if (draggedFromPosition) {
      if (isStarter) {
        setLineup(prev => ({
          ...prev,
          starters: prev.starters.map(pos => 
            pos.id === draggedFromPosition ? { ...pos, player: null } : pos
          )
        }));
      } else {
        setLineup(prev => ({
          ...prev,
          bench: prev.bench.map(pos => 
            pos.id === draggedFromPosition ? { ...pos, player: null } : pos
          )
        }));
      }
    }

    // Add player to new position
    if (isStarter) {
      setLineup(prev => ({
        ...prev,
        starters: prev.starters.map(pos => 
          pos.id === targetPositionId ? { ...pos, player: draggedPlayer } : pos
        )
      }));
    } else {
      setLineup(prev => ({
        ...prev,
        bench: prev.bench.map(pos => 
          pos.id === targetPositionId ? { ...pos, player: draggedPlayer } : pos
        )
      }));
    }

    setDraggedPlayer(null);
    setDraggedFromPosition(null);
  };

  const handleDropToBench = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedPlayer) return;

    // Find first empty bench spot or create new one
    const emptyBenchSpot = lineup.bench.find(pos => !pos.player);
    if (emptyBenchSpot) {
      handleDrop(e, emptyBenchSpot.id, false);
    } else {
      // Create new bench spot
      const newBenchSpot: LineupPosition = {
        id: `bench-${lineup.bench.length}`,
        position: 'BENCH',
        player: draggedPlayer,
        x: 5 + (lineup.bench.length % 4) * 20,
        y: 5 + Math.floor(lineup.bench.length / 4) * 15,
        isStarter: false
      };
      
      setLineup(prev => ({
        ...prev,
        bench: [...prev.bench, newBenchSpot]
      }));
    }

    setDraggedPlayer(null);
    setDraggedFromPosition(null);
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'PG':
      case 'SG':
      case 'G':
        return 'primary';
      case 'SF':
      case 'PF':
      case 'F':
        return 'success';
      case 'C':
        return 'warning';
      case 'BENCH':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  if (isLoading || rosterLoading || seasonLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <LinearProgress />
        <Typography sx={{ ml: 2 }}>Loading lineup...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <Typography>Error loading league data: {error.message}</Typography>
      </Alert>
    );
  }

  if (!userTeam) {
    return (
      <Alert color="warning">
        <Typography>You don't have a team in this league yet.</Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography level="h2" sx={{ fontWeight: 'bold' }}>
          {userTeam.name} Lineup - Week {currentWeek}
        </Typography>
        
        <Stack direction="row" spacing={2} alignItems="center">
          <WeekCalendar
            currentWeek={currentWeek}
            totalWeeks={seasonInfo?.totalWeeks || 26}
            onWeekChange={setCurrentWeek}
          />
          
          <Button
            variant="solid"
            color="primary"
            startDecorator={isSavingLineup ? <LinearProgress size="sm" /> : <Save />}
            onClick={saveWeeklyLineup}
            disabled={isSavingLineup || lineup.isLocked}
          >
            {isSavingLineup ? 'Saving...' : 'Save Lineup'}
          </Button>
          
          <Tooltip title={lineup.isLocked ? 'Lineup is locked' : 'Lineup is unlocked'}>
            <IconButton
              color={lineup.isLocked ? 'danger' : 'success'}
              variant="outlined"
            >
              {lineup.isLocked ? <Lock /> : <LockOpen />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Save Message */}
      {saveMessage && (
        <Alert 
          color={saveMessage.type} 
          sx={{ mb: 2 }}
          onClose={() => setSaveMessage(null)}
        >
          {saveMessage.text}
        </Alert>
      )}

      {/* Loading Overlay */}
      {isLoadingLineup && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          bgcolor: 'rgba(255,255,255,0.8)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <LinearProgress />
          <Typography sx={{ ml: 2 }}>Loading lineup...</Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Court Layout */}
        <Grid xs={12} lg={9}>
          <Card sx={{ height: '600px', position: 'relative', overflow: 'hidden' }}>
            <CardContent sx={{ height: '100%', p: 0 }}>
              {/* Basketball Court Background */}
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  background: `
                    linear-gradient(90deg, #8B4513 0%, #8B4513 10%, #FFD700 10%, #FFD700 90%, #8B4513 90%, #8B4513 100%),
                    linear-gradient(0deg, #8B4513 0%, #8B4513 10%, #FFD700 10%, #FFD700 90%, #8B4513 90%, #8B4513 100%)
                  `,
                  backgroundSize: '100% 100%',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  p: 2
                }}
              >
                {/* Starting Lineup Positions */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  height: '40%',
                  position: 'relative'
                }}>
                  {/* Frontcourt */}
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {lineup.starters.filter(pos => ['SF', 'PF', 'C'].includes(pos.position)).map((position) => (
                      <Box
                        key={position.id}
                        sx={{
                          width: 80,
                          height: 80,
                          border: '2px dashed #666',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: position.player ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: '#1976d2',
                            bgcolor: 'rgba(255,255,255,0.7)'
                          }
                        }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, position.id, true)}
                      >
                        {position.player ? (
                          <Avatar
                            src={position.player.avatar}
                            sx={{ width: 60, height: 60 }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.textContent = position.player?.name?.charAt(0) || '?';
                              }
                            }}
                            draggable
                            onDragStart={() => handleDragStart(position.player!, position.id)}
                          >
                            {position.player.name.charAt(0)}
                          </Avatar>
                        ) : (
                          <Typography level="body-sm" color="neutral">
                            {position.position}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Backcourt */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  height: '40%',
                  position: 'relative'
                }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {lineup.starters.filter(pos => ['PG', 'SG'].includes(pos.position)).map((position) => (
                      <Box
                        key={position.id}
                        sx={{
                          width: 80,
                          height: 80,
                          border: '2px dashed #666',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: position.player ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: '#1976d2',
                            bgcolor: 'rgba(255,255,255,0.7)'
                          }
                        }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, position.id, true)}
                      >
                        {position.player ? (
                          <Avatar
                            src={position.player.avatar}
                            sx={{ width: 60, height: 60 }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.textContent = position.player?.name?.charAt(0) || '?';
                              }
                            }}
                            draggable
                            onDragStart={() => handleDragStart(position.player!, position.id)}
                          >
                            {position.player.name.charAt(0)}
                          </Avatar>
                        ) : (
                          <Typography level="body-sm" color="neutral">
                            {position.position}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Bench Area (Left Side) */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 120,
                    height: '80%',
                    border: '2px dashed #666',
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1
                  }}
                  onDragOver={handleDragOver}
                  onDrop={handleDropToBench}
                >
                  <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                    Bench
                  </Typography>
                  
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: 1,
                    width: '100%'
                  }}>
                    {lineup.bench.map((position) => (
                      <Box
                        key={position.id}
                        sx={{
                          width: 40,
                          height: 40,
                          border: '1px dashed #666',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: position.player ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: '#1976d2',
                            bgcolor: 'rgba(255,255,255,0.7)'
                          }
                        }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, position.id, false)}
                      >
                        {position.player ? (
                          <Avatar
                            src={position.player.avatar}
                            size="sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.textContent = position.player?.name?.charAt(0) || '?';
                              }
                            }}
                            draggable
                            onDragStart={() => handleDragStart(position.player!, position.id)}
                          >
                            {position.player.name.charAt(0)}
                          </Avatar>
                        ) : (
                          <Typography level="body-xs" color="neutral">
                            ?
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Lineup Summary */}
        <Grid xs={12} lg={3}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ mb: 2 }}>
                  Starting Lineup
                </Typography>
                <Stack spacing={1}>
                  {lineup.starters.map((position) => (
                    <Box key={position.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip size="sm" color={getPositionColor(position.position)}>
                        {position.position}
                      </Chip>
                      <Typography level="body-sm">
                        {position.player ? position.player.name : 'Empty'}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography level="h4" sx={{ mb: 2 }}>
                  Bench ({lineup.bench.filter(p => p.player).length})
                </Typography>
                <Stack spacing={1}>
                  {lineup.bench.filter(p => p.player).map((position) => (
                    <Box key={position.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={position.player?.avatar} size="sm">
                        {position.player?.name.charAt(0)}
                      </Avatar>
                      <Typography level="body-sm">
                        {position.player?.name}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography level="h4" sx={{ mb: 2 }}>
                  Available Players
                </Typography>
                <Stack spacing={1}>
                  {allPlayers
                    .filter(player => 
                      !lineup.starters.some(s => s.player?.id === player.id) &&
                      !lineup.bench.some(b => b.player?.id === player.id)
                    )
                    .map((player) => (
                    <Box 
                      key={player.id} 
                      sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        p: 1,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        cursor: 'grab',
                        '&:hover': { bgcolor: 'background.level1' }
                      }}
                      draggable
                      onDragStart={() => handleDragStart(player)}
                    >
                      <Avatar src={player.avatar} size="sm">
                        {player.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {player.name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {player.pos} • {player.team}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
