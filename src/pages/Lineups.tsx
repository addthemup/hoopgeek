import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  Alert,
  LinearProgress,
  Chip,
  Stack,
  Table,
  Sheet,
} from '@mui/joy';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import { useCurrentFantasyWeek, getWeekDisplayText, getSeasonPhaseColor } from '../hooks/useCurrentFantasyWeek';
import { useUserTeamRoster } from '../hooks/useUserTeamRoster';
import { useTeams } from '../hooks/useTeams';
import { useMatchups } from '../hooks/useMatchups';
import { supabase } from '../utils/supabase';
import { useQuery } from '@tanstack/react-query';
import PlayerJersey from '../components/PlayerJersey';

interface Player {
  id: string;
  name: string;
  team: string; // NBA team abbreviation
  position: string;
  jerseyNumber?: number | string;
  nbaPlayerId?: number;
  avatar: string;
}

interface CourtPlayer extends Player {
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
}

interface RosterPosition {
  position: string;
  count: number;
  is_bench: boolean;
  is_injured_reserve: boolean;
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
  
  // State
  const [currentWeek, setCurrentWeek] = useState(1);
  const [playersOnCourt, setPlayersOnCourt] = useState<CourtPlayer[]>([]);
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedJerseyId, setSelectedJerseyId] = useState<string | null>(null);
  const [draggedCourtPlayer, setDraggedCourtPlayer] = useState<CourtPlayer | null>(null);

  const totalWeeks = 26;

  // Get matchup data
  const { data: currentWeekMatchups } = useMatchups(leagueId, currentWeek);

  // Fetch league roster positions
  const { data: rosterPositions } = useQuery({
    queryKey: ['roster-positions', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roster_spots')
        .select('position, is_bench, is_injured_reserve')
        .eq('league_id', leagueId)
        .order('position_order');

      if (error) throw error;

      // Group by position and count
      const positionCounts: Record<string, RosterPosition> = {};
      
      data?.forEach(spot => {
        const key = spot.position;
        if (!positionCounts[key]) {
          positionCounts[key] = {
            position: spot.position,
            count: 0,
            is_bench: spot.is_bench || false,
            is_injured_reserve: spot.is_injured_reserve || false,
          };
        }
        positionCounts[key].count++;
      });

      return Object.values(positionCounts);
    },
    enabled: !!leagueId,
  });

  // Update current week when fantasy week loads
  useEffect(() => {
    if (fantasyWeek) {
      if (fantasyWeek.week_number === 0) {
        setCurrentWeek(1);
      } else {
        setCurrentWeek(fantasyWeek.week_number);
      }
    }
  }, [fantasyWeek]);

  // Get user's team data
  const userTeam = teams?.find(team => team.user_id === user?.id);
  
  // Find current week matchup
  const currentMatchup = currentWeekMatchups?.find(matchup => 
    matchup.fantasy_team1_id === userTeam?.id || matchup.fantasy_team2_id === userTeam?.id
  );
  
  // Get opponent team
  const opponentTeam = currentMatchup ? (
    currentMatchup.fantasy_team1_id === userTeam?.id ? currentMatchup.team2 : currentMatchup.team1
  ) : null;
  
  // Transform roster to player format
  const availablePlayers: Player[] = userTeamRoster?.map(rosterPlayer => ({
      id: rosterPlayer.id.toString(),
      name: rosterPlayer.name,
    team: rosterPlayer.team_abbreviation || 'NBA',
    position: rosterPlayer.position || 'F',
    jerseyNumber: rosterPlayer.jersey_number || '??',
    nbaPlayerId: rosterPlayer.nba_player_id,
      avatar: rosterPlayer.nba_player_id 
        ? `https://cdn.nba.com/headshots/nba/latest/260x190/${rosterPlayer.nba_player_id}.png`
      : '',
  })) || [];

  // Check if player is on court
  const isPlayerOnCourt = (playerId: string) => {
    return playersOnCourt.some(p => p.id === playerId);
  };

  // Drag handlers
  const handleDragStart = (player: Player) => {
    setDraggedPlayer(player);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnCourt = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Get drop position relative to court
    const courtElement = e.currentTarget as HTMLElement;
    const rect = courtElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // If dragging a player from roster
    if (draggedPlayer && !isPlayerOnCourt(draggedPlayer.id)) {
      setPlayersOnCourt(prev => [...prev, { ...draggedPlayer, x, y }]);
      setDraggedPlayer(null);
    }
    
    // If repositioning a jersey already on court
    if (draggedCourtPlayer) {
      setPlayersOnCourt(prev => 
        prev.map(p => 
          p.id === draggedCourtPlayer.id 
            ? { ...p, x, y }
            : p
        )
      );
      setDraggedCourtPlayer(null);
    }

    setIsDragging(false);
  };

  const handleJerseyDragStart = (e: React.DragEvent, player: CourtPlayer) => {
    e.stopPropagation();
    setDraggedCourtPlayer(player);
    setIsDragging(true);
    setSelectedJerseyId(null); // Deselect when dragging
  };

  const handleJerseyClick = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    // Toggle selection
    setSelectedJerseyId(prev => prev === playerId ? null : playerId);
  };

  const handleRemoveFromCourt = (playerId: string) => {
    setPlayersOnCourt(prev => prev.filter(p => p.id !== playerId));
    setSelectedJerseyId(null);
  };

  const handleClearCourt = () => {
    setPlayersOnCourt([]);
    setSelectedJerseyId(null);
  };

  const handleCourtClick = () => {
    // Deselect jersey when clicking empty court area
    setSelectedJerseyId(null);
  };

  // Loading states
  if (isLoading || weekLoading || rosterLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <LinearProgress />
      </Box>
    );
  }

  if (error || !league) {
    return (
      <Alert color="danger">
        <Typography>Error loading league data</Typography>
      </Alert>
    );
  }

  if (!userTeam) {
    return (
      <Alert color="warning">
        <Typography>You are not a member of this league.</Typography>
      </Alert>
    );
  }

  if (!availablePlayers || availablePlayers.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography level="h4" sx={{ mb: 2 }}>
          No Players Drafted Yet
        </Typography>
        <Typography level="body-md" color="neutral" sx={{ mb: 3 }}>
          Your team roster is empty. Once you draft players, they will appear here for lineup management.
        </Typography>
        <Alert color="neutral">
          <Typography>Go to the Draft tab to start building your team!</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      {/* Header */}
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            {/* Week Info */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                  Week {currentWeek} of {totalWeeks}
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

            {/* Matchup Info */}
                      {currentMatchup && opponentTeam && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {userTeam.team_name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                    {userTeam.wins}-{userTeam.losses}
                            </Typography>
                          </Box>
                          
                <Typography level="title-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                              VS
                            </Typography>
                          
                <Box sx={{ textAlign: 'left' }}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {opponentTeam.team_name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                    {opponentTeam.wins}-{opponentTeam.losses}
                            </Typography>
                          </Box>
                        </Box>
                      )}

            {/* Actions */}
            <Stack direction="row" spacing={1}>
              <Chip variant="soft" color="neutral" size="sm">
                {playersOnCourt.length} on court
              </Chip>
              {playersOnCourt.length > 0 && (
                <Button
                  variant="outlined"
                              size="sm"
                  color="danger"
                  onClick={handleClearCourt}
                >
                  Clear
                </Button>
              )}
            </Stack>
                    </Box>
                  </CardContent>
                </Card>

      {/* Main Layout - Court with integrated roster */}
      <Card variant="outlined">
        <CardContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Lineup Requirements Header */}
          {rosterPositions && rosterPositions.length > 0 && (
            <Box 
              sx={{ 
                py: 0.75,
                px: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'neutral.50',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap'
              }}
            >
              {rosterPositions.map((pos, idx) => (
                <Typography
                  key={idx}
                  level="body-sm"
                  sx={{
                    fontWeight: pos.is_bench || pos.is_injured_reserve ? 'normal' : 'bold',
                    color: pos.is_bench || pos.is_injured_reserve ? 'neutral.500' : 'text.primary',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {pos.count} {pos.position}
                </Typography>
              ))}
            </Box>
          )}

          {/* Court + Roster Container */}
          <Box sx={{ 
            display: 'flex', 
            height: { xs: '600px', md: '400px' },
            overflow: 'hidden'
          }}>
            {/* Player Roster - Left Side (always) */}
            <Box
              sx={{
                width: '88px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                p: 1,
                overflowY: 'auto',
                borderRight: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.level1',
                flexShrink: 0
              }}
            >
              {availablePlayers.map((player) => {
                const onCourt = isPlayerOnCourt(player.id);
                  
                      return (
                    <Box
                          key={player.id}
                    draggable={!onCourt}
                    onDragStart={() => handleDragStart(player)}
                    onDragEnd={handleDragEnd}
                      sx={{
                      position: 'relative',
                      cursor: onCourt ? 'not-allowed' : 'grab',
                      opacity: onCourt ? 0.4 : 1,
                        transition: 'all 0.2s',
                      '&:hover': !onCourt ? {
                        transform: 'scale(1.05)',
                        opacity: 0.9,
                        } : {},
                    }}
                    >
                      <Avatar
                        src={player.avatar}
                        sx={{ 
                        width: 64, 
                        height: 64,
                        border: '2px solid',
                        borderColor: onCourt ? 'primary.500' : 'divider',
                        '& img': { objectFit: 'cover' }
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
                      
                    {/* Small position badge */}
                      <Chip
                        size="sm"
                      variant="solid"
                        sx={{
                          position: 'absolute',
                        bottom: 0,
                        right: 0,
                        minWidth: 20,
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        bgcolor: onCourt ? 'primary.500' : 'neutral.700',
                      }}
                    >
                      {player.position}
                      </Chip>
                    </Box>
                      );
                    })}
              </Box>

            {/* Basketball Court - Right Side */}
            <Box
              onDragOver={handleDragOver}
              onDrop={handleDropOnCourt}
              onClick={handleCourtClick}
              sx={{
                position: 'relative',
                flex: 1,
                height: '100%',
                background: 'linear-gradient(135deg, #d4a373 0%, #c4935a 100%)',
                overflow: 'hidden',
              }}
            >
              {/* Court Lines - Responsive */}
              {/* Horizontal layout (desktop) */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                {/* Left hoop */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: '5%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '40px',
                    height: '60px',
                    border: '4px solid #C8102E',
                    borderRadius: '50%',
                    background: 'transparent',
                  }}
                />
                
                {/* Center line */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: '50%',
                    top: '0',
                    bottom: '0',
                    width: '4px',
                    bgcolor: 'white',
                    opacity: 0.8,
                  }}
                />
                
                {/* Right hoop */}
                <Box
                  sx={{
                    position: 'absolute',
                    right: '5%',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '40px',
                    height: '60px',
                    border: '4px solid #C8102E',
                    borderRadius: '50%',
                    background: 'transparent',
                  }}
                />
            </Box>

              {/* Vertical layout (mobile) */}
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                {/* Top hoop */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '5%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60px',
                    height: '40px',
                    border: '4px solid #C8102E',
                    borderRadius: '50%',
                    background: 'transparent',
                  }}
                />
                
                {/* Center line */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '0',
                    right: '0',
                    height: '4px',
                    bgcolor: 'white',
                    opacity: 0.8,
                  }}
                />
                
                {/* Bottom hoop */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: '5%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '60px',
                    height: '40px',
                    border: '4px solid #C8102E',
                    borderRadius: '50%',
                    background: 'transparent',
                  }}
                />
              </Box>

              {/* Drop Zone Hint */}
              {isDragging && playersOnCourt.length === 0 && (
                  <Box
                    sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Typography 
                    level="h3" 
                    sx={{ 
                      color: 'white',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      fontWeight: 'bold'
                    }}
                  >
                    Drop Player Here
                  </Typography>
                  <Typography 
                    level="body-md" 
                    sx={{
                      color: 'white',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                    }}
                  >
                    Position them anywhere on the court
                  </Typography>
                  </Box>
              )}

              {/* Players on Court */}
              {playersOnCourt.map((player) => {
                const isSelected = selectedJerseyId === player.id;
                
                return (
                  <Box
                    key={player.id}
                    draggable
                    onDragStart={(e) => handleJerseyDragStart(e, player)}
                    onClick={(e) => handleJerseyClick(e, player.id)}
                    sx={{
                      position: 'absolute',
                      left: `${player.x}%`,
                      top: `${player.y}%`,
                      transform: 'translate(-50%, -50%)',
                      cursor: 'grab',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translate(-50%, -50%) scale(1.05)',
                        filter: 'brightness(1.05)',
                      },
                      '&:active': {
                        cursor: 'grabbing',
                      },
                      zIndex: isSelected ? 100 : 10,
                    }}
                  >
                    <PlayerJersey
                      playerName={player.name}
                      jerseyNumber={player.jerseyNumber}
                      nbaTeam={player.team}
                      position={player.position}
                      size="medium"
                    />
                    
                    {/* Remove Button (X) - shown when selected */}
                    {isSelected && (
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromCourt(player.id);
                        }}
                        sx={{
                          position: 'absolute',
                          top: -12,
                          right: -12,
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: 'danger.500',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          border: '2px solid white',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: 'danger.600',
                            transform: 'scale(1.15)',
                          }
                        }}
                      >
                        ×
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Weekly Schedule Table */}
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2, fontWeight: 'bold' }}>
            Week {currentWeek} Schedule
          </Typography>

          <Sheet
            variant="outlined"
            sx={{
              overflow: 'auto',
              borderRadius: 'sm',
            }}
          >
            <Table
              stickyHeader
              hoverRow
              sx={{
                '& thead th': {
                  bgcolor: 'background.surface',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                },
                '& td': {
                  fontSize: '0.8rem',
                  p: 1.5,
                },
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: 200, position: 'sticky', left: 0, zIndex: 100, backgroundColor: 'var(--joy-palette-background-surface)' }}>
                    Player
                  </th>
                  <th style={{ width: 80 }}>Team</th>
                  <th style={{ width: 60 }}>Pos</th>
                  <th style={{ minWidth: 180 }}>Mon 10/21</th>
                  <th style={{ minWidth: 180 }}>Tue 10/22</th>
                  <th style={{ minWidth: 180 }}>Wed 10/23</th>
                  <th style={{ minWidth: 180 }}>Thu 10/24</th>
                  <th style={{ minWidth: 180 }}>Fri 10/25</th>
                  <th style={{ minWidth: 180 }}>Sat 10/26</th>
                  <th style={{ minWidth: 180 }}>Sun 10/27</th>
                </tr>
              </thead>
              <tbody>
                {availablePlayers.map((player) => {
                  // Mock game data - will be replaced with real API data later
                  const mockGames = generateMockGamesForPlayer(player.team);
                  
                  return (
                    <tr key={player.id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 99, backgroundColor: 'var(--joy-palette-background-surface)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            src={player.avatar}
                            size="sm"
                            sx={{ width: 32, height: 32 }}
                          >
                            {player.name.charAt(0)}
                          </Avatar>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {player.name}
                          </Typography>
                        </Box>
                      </td>
                      <td>
                        <Chip size="sm" variant="soft">
                          {player.team}
                        </Chip>
                      </td>
                      <td>
                        <Typography level="body-xs">{player.position}</Typography>
                      </td>
                      {mockGames.map((game, idx) => (
                        <td key={idx}>
                          {game ? (
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.5,
                                p: 1,
                                bgcolor: game.isHome ? 'primary.50' : 'neutral.50',
                                borderRadius: 'sm',
                                border: '1px solid',
                                borderColor: game.isHome ? 'primary.200' : 'neutral.200',
                              }}
                            >
                              <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                                {game.isHome ? 'vs' : '@'} {game.opponent}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {game.time}
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ textAlign: 'center', color: 'neutral.400' }}>
                              <Typography level="body-xs">—</Typography>
                            </Box>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Sheet>
        </CardContent>
      </Card>
    </Box>
  );
}

// Helper function to generate mock game data (will be replaced with real API)
function generateMockGamesForPlayer(team: string): (null | { opponent: string; time: string; isHome: boolean })[] {
  // Mock schedule for preseason week (7 days)
  const schedules: Record<string, number[]> = {
    'LAL': [0, 2, 4, 6], // Games on Mon, Wed, Fri, Sun
    'GSW': [1, 3, 5], // Games on Tue, Thu, Sat
    'BOS': [0, 2, 5], // Games on Mon, Wed, Sat
    'MIA': [1, 4, 6], // Games on Tue, Fri, Sun
    'DAL': [0, 3, 5], // Games on Mon, Thu, Sat
    'PHX': [2, 4, 6], // Games on Wed, Fri, Sun
    'DEN': [1, 3, 6], // Games on Tue, Thu, Sun
    'MIL': [0, 2, 4], // Games on Mon, Wed, Fri
    'PHI': [1, 3, 5], // Games on Tue, Thu, Sat
    'LAC': [0, 4, 6], // Games on Mon, Fri, Sun
  };

  const opponents = ['ATL', 'CHI', 'CLE', 'DET', 'IND', 'MEM', 'MIN', 'NOP', 'NYK', 'ORL', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];
  const times = ['7:00 PM ET', '7:30 PM ET', '8:00 PM ET', '8:30 PM ET', '9:00 PM ET', '10:00 PM ET', '10:30 PM ET'];
  
  const gameDays = schedules[team] || [1, 4]; // Default schedule if team not in mock data
  const games: (null | { opponent: string; time: string; isHome: boolean })[] = Array(7).fill(null);

  gameDays.forEach((day) => {
    games[day] = {
      opponent: opponents[Math.floor(Math.random() * opponents.length)],
      time: times[Math.floor(Math.random() * times.length)],
      isHome: Math.random() > 0.5,
    };
  });

  return games;
}
