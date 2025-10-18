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
  Table,
  Sheet,
} from '@mui/joy';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import { useCurrentFantasyWeek, getWeekDisplayText, getSeasonPhaseColor } from '../hooks/useCurrentFantasyWeek';
import { useUserTeamRoster } from '../hooks/useUserTeamRoster';
import { useTeams } from '../hooks/useTeams';
import { useMatchups } from '../hooks/useMatchups';
import { useWeekSchedule, getGameTime } from '../hooks/useNBASchedule';
import { usePlayerGameLogs } from '../hooks/usePlayerGameLogs';
import { useLineupSettings } from '../hooks/useLineupSettings';
import BasketballCourt from '../components/BasketballCourt';
import { getScoringFormat, calculateFantasyPoints } from '../utils/fantasyScoring';

interface Player {
  id: string;
  name: string;
  team: string; // NBA team abbreviation
  position: string; // Simplified position (G, F, C)
  originalPosition?: string; // Original position from database (e.g., "Guard-Forward")
  jerseyNumber?: number | string;
  nbaPlayerId?: number;
  avatar: string;
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
  const { data: lineupSettings } = useLineupSettings(leagueId);
  
  // State
  const [currentWeek, setCurrentWeek] = useState(1);

  const totalWeeks = 26;

  // Get the league's scoring format
  const leagueScoringFormat = lineupSettings?.fantasy_scoring_format || 'FanDuel';
  const selectedScoringFormat = getScoringFormat(leagueScoringFormat);

  // Get matchup data
  const { data: currentWeekMatchups } = useMatchups(leagueId, currentWeek);
  
  // Get NBA schedule for the current week
  const { data: weekSchedule, isLoading: scheduleLoading } = useWeekSchedule(currentWeek);


  // Update current week when fantasy week loads
  useEffect(() => {
    if (fantasyWeek) {
        setCurrentWeek(fantasyWeek.week_number);
    } else {
      // Default to preseason (week 0) if no current week is determined
      setCurrentWeek(0);
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
  
  // Helper function to map full position names to simplified positions
  const mapPositionToSimplified = (position: string): string => {
    // Handle dual positions first (e.g., "Guard-Forward", "Forward-Center")
    if (position.includes('-')) {
      const positions = position.split('-').map(p => p.trim());
      // For dual positions, return the first position as primary
      // The BasketballCourt component should handle dual position logic
      const firstPosition = positions[0];
      if (firstPosition.toLowerCase().includes('guard')) return 'G';
      if (firstPosition.toLowerCase().includes('forward')) return 'F';
      if (firstPosition.toLowerCase().includes('center')) return 'C';
    }
    
    // Handle single positions
    const positionLower = position.toLowerCase();
    if (positionLower.includes('guard')) return 'G';
    if (positionLower.includes('forward')) return 'F';
    if (positionLower.includes('center')) return 'C';
    
    // Handle already simplified positions
    if (position === 'G' || position === 'F' || position === 'C') return position;
    
    // If we can't determine the position, default to Forward (not UTIL)
    console.warn(`🔍 Unknown position "${position}" for player, defaulting to Forward`);
    return 'F';
  };

  // Transform roster to player format
  const availablePlayers: Player[] = userTeamRoster?.map(rosterPlayer => {
    console.log('🔍 Roster Player ID:', rosterPlayer.id, 'Type:', typeof rosterPlayer.id);
    const originalPosition = rosterPlayer.position || 'F';
    const simplifiedPosition = mapPositionToSimplified(originalPosition);
    
    console.log(`🔍 Player ${rosterPlayer.name}: ${originalPosition} -> ${simplifiedPosition}`);
    
    return {
      id: rosterPlayer.id.toString(),
      name: rosterPlayer.name,
      team: rosterPlayer.team_abbreviation || 'NBA',
      position: simplifiedPosition,
      originalPosition: originalPosition, // Preserve original position for dual position handling
      jerseyNumber: rosterPlayer.jersey_number || '??',
      nbaPlayerId: rosterPlayer.nba_player_id,
      avatar: rosterPlayer.nba_player_id 
        ? `https://cdn.nba.com/headshots/nba/latest/260x190/${rosterPlayer.nba_player_id}.png`
        : ''
    };
  }) || [];



  // Helper function to get games for a specific player's team
  const getPlayerGames = (playerTeam: string) => {
    if (!weekSchedule?.games) {
      console.log('🔍 No week schedule games available');
      return [];
    }
    
    console.log(`🔍 Looking for games for team: ${playerTeam}`);
    console.log(`🔍 Available games:`, weekSchedule.games.map(g => `${g.away_team_tricode} @ ${g.home_team_tricode}`));
    
    const teamGames = weekSchedule.games
      .filter(game => 
        game.home_team_tricode === playerTeam || game.away_team_tricode === playerTeam
      )
      .sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime())
      .map(game => ({
        gameId: game.game_id,
        opponent: game.home_team_tricode === playerTeam ? game.away_team_tricode : game.home_team_tricode,
        isHome: game.home_team_tricode === playerTeam,
        gameDate: game.game_date,
        gameTime: getGameTime(game),
        status: game.game_status_text
      }));
    
    // For preseason, limit to exactly 7 games
    const limitedGames = currentWeek === 0 ? teamGames.slice(0, 7) : teamGames;
    
    console.log(`🔍 Found ${limitedGames.length} games for ${playerTeam}:`, limitedGames);
    return limitedGames;
  };

  // Helper function to get games for a specific day of the week
  const getPlayerGamesForDay = (playerTeam: string, dayIndex: number) => {
    if (!weekSchedule?.startDate) {
      return null;
    }
    
    // Calculate the date for this day of the week
    const startDate = new Date(weekSchedule.startDate);
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + dayIndex);
    const dayDateStr = dayDate.toISOString().split('T')[0];
    
    // Find games for this player's team on this specific date
    const dayGames = weekSchedule.games.filter(game => 
      game.game_date === dayDateStr && 
      (game.home_team_tricode === playerTeam || game.away_team_tricode === playerTeam)
    );
    
    if (dayGames.length === 0) {
      return null;
    }
    
    // Return the first game (teams typically play once per day)
    const game = dayGames[0];
    const isHome = game.home_team_tricode === playerTeam;
    const opponent = isHome ? game.away_team_tricode : game.home_team_tricode;
    
    return {
      gameId: game.game_id,
      opponent,
      isHome,
      gameTime: getGameTime(game),
      status: game.game_status_text,
      gameDate: game.game_date
    };
  };

  // Get all unique game IDs for all players
  const allGameIds = availablePlayers?.flatMap(player => {
    const playerGames = getPlayerGames(player.team);
    return playerGames.map(game => game.gameId);
  }) || [];

  // Get all unique player IDs
  const allPlayerIds = availablePlayers?.map(player => player.nbaPlayerId || 0).filter(id => id > 0) || [];

  // Fetch all player stats for all games at the top level
  const { data: allPlayerStats } = usePlayerGameLogs({
    playerIds: allPlayerIds,
    gameIds: allGameIds,
    seasonYear: '2025-26'
  });

  // Debug logging
  console.log('🔍 Lineups Debug Info:');
  console.log('  Current week:', currentWeek);
  console.log('  Week schedule:', weekSchedule);
  console.log('  Available players:', availablePlayers.map(p => `${p.name} (${p.team}) - NBA ID: ${p.nbaPlayerId}`));
  console.log('  Week loading:', weekLoading);
  console.log('  Schedule loading:', scheduleLoading);
  console.log('  All player stats:', allPlayerStats?.length || 0, 'total stats');
  console.log('  Sample player stats:', allPlayerStats?.slice(0, 3));
  console.log('  Unique NBA player IDs in stats:', [...new Set(allPlayerStats?.map(s => s.nba_player_id) || [])]);

  // Loading states
  if (isLoading || weekLoading || rosterLoading || scheduleLoading) {
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
      {/* Compact Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        mb: 2,
        p: 1,
        bgcolor: 'background.surface',
        borderRadius: 'sm',
        border: '1px solid',
        borderColor: 'divider'
      }}>
        {/* Left: Week Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="plain"
            size="sm"
            onClick={() => setCurrentWeek(Math.max(0, currentWeek - 1))}
            disabled={currentWeek <= 0}
            sx={{ minWidth: 'auto', px: 0.5 }}
          >
            ←
          </Button>
          <Chip 
            variant="soft" 
            color={getSeasonPhaseColor(seasonPhase)}
            size="sm"
            sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
          >
            {currentWeek === 0 ? 'Preseason' : `Week ${currentWeek}`}
          </Chip>
          <Button
            variant="plain"
            size="sm"
            onClick={() => setCurrentWeek(Math.min(totalWeeks, currentWeek + 1))}
            disabled={currentWeek >= totalWeeks}
            sx={{ minWidth: 'auto', px: 0.5 }}
          >
            →
          </Button>
        </Box>

        {/* Center: Matchup (if exists) */}
        {currentMatchup && opponentTeam && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
              {userTeam.team_name.split(' ').pop()}
            </Typography>
            <Typography level="body-xs" color="neutral">vs</Typography>
            <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
              {opponentTeam.team_name.split(' ').pop()}
            </Typography>
          </Box>
        )}

        {/* Right: Scoring Format */}
        <Chip variant="soft" color="primary" size="sm" sx={{ fontSize: '0.7rem' }}>
          {selectedScoringFormat.name}
        </Chip>
      </Box>

      {/* Basketball Court Component */}
      <BasketballCourt
        leagueId={leagueId}
        teamId={userTeam.id}
        availablePlayers={availablePlayers}
        currentWeek={currentWeek}
        currentMatchup={currentMatchup}
        seasonYear={2025}
      />

      {/* Weekly Schedule Table */}
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
              {currentWeek === 0 ? 'Preseason' : `Week ${currentWeek}`} Schedule
            </Typography>
            <Chip variant="soft" color="primary" size="sm">
              {selectedScoringFormat.name} Scoring
            </Chip>
          </Box>

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
                  minHeight: currentWeek === 0 ? '60px' : 'auto',
                },
                '& td': {
                  fontSize: '0.8rem',
                  p: 1.5,
                  verticalAlign: 'top',
                  minHeight: currentWeek === 0 ? '120px' : 'auto',
                },
                '& tbody tr': {
                  minHeight: currentWeek === 0 ? '120px' : 'auto',
                }
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: 280, position: 'sticky', left: 0, zIndex: 100, backgroundColor: 'var(--joy-palette-background-surface)' }}>
                    Player Info
                  </th>
                  {weekSchedule?.games && weekSchedule.games.length > 0 ? (
                    currentWeek === 0 ? (
                      // Preseason: Show Game 1, Game 2, etc. (exactly 7 games per team)
                      Array.from({ 
                        length: 7 
                      }, (_, index) => (
                        <th key={index} style={{ minWidth: 220 }}>
                          Game {index + 1}
                        </th>
                      ))
                    ) : (
                      // Regular season: Show days of the week with dates from fantasy_season_weeks
                      (() => {
                        const startDate = new Date(weekSchedule.startDate);
                        const endDate = new Date(weekSchedule.endDate);
                        const daysInWeek = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const actualDays = Math.min(daysInWeek, 7); // Cap at 7 days
                        
                        return Array.from({ length: actualDays }, (_, index) => {
                          const dayDate = new Date(startDate);
                          dayDate.setDate(startDate.getDate() + index);
                          
                          const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                          const dayName = dayNames[index];
                          const dateStr = dayDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                          
                          return (
                            <th key={index} style={{ minWidth: 220 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                                  {dayName}
                                </Typography>
                                <Typography level="body-xs" color="neutral">
                                  {dateStr}
                                </Typography>
                              </Box>
                            </th>
                          );
                        });
                      })()
                    )
                  ) : (
                    // Fallback to 7 game columns if no schedule data
                    Array.from({ length: 7 }, (_, index) => (
                      <th key={index} style={{ minWidth: 220 }}>
                        Game {index + 1}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {availablePlayers.map((player) => {
                  // Get real game data for this player's team
                  const playerGames = getPlayerGames(player.team);
                  
                  // Get player stats for this player from the fetched data
                  const playerStats = allPlayerStats?.filter(stat => stat.nba_player_id === player.nbaPlayerId) || [];
                  
                  // Debug logging for this specific player
                  console.log(`🔍 Player ${player.name} (NBA ID: ${player.nbaPlayerId}):`, {
                    totalStats: allPlayerStats?.length || 0,
                    filteredStats: playerStats.length,
                    stats: playerStats
                  });
                  
                  // Create a map of game_id to player stats for easy lookup
                  const playerStatsByGame = playerStats.reduce((acc, stat) => {
                    acc[stat.game_id] = stat;
                    return acc;
                  }, {} as Record<string, any>);
                  
                  // Determine how many game columns to show
                  // For preseason (week 0), show exactly 7 games. For regular season, show actual days in week
                  const maxGames = weekSchedule?.games 
                    ? (currentWeek === 0 
                        ? 7 // Preseason always shows 7 games
                        : (() => {
                            const startDate = new Date(weekSchedule.startDate);
                            const endDate = new Date(weekSchedule.endDate);
                            const daysInWeek = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            return Math.min(daysInWeek, 7); // Cap at 7 days
                          })()
                      )
                    : 7;
                  
                  // Calculate weekly average for this player
                  const weeklyFantasyPoints = playerStats.map(stat => calculateFantasyPoints(stat, selectedScoringFormat));
                  const weeklyAverage = weeklyFantasyPoints.length > 0 
                    ? Math.round((weeklyFantasyPoints.reduce((sum, points) => sum + points, 0) / weeklyFantasyPoints.length) * 100) / 100
                    : 0;

                  return (
                    <tr key={player.id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 99, backgroundColor: 'var(--joy-palette-background-surface)' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1 }}>
                          {/* Player Info */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar
                              src={player.avatar}
                              size="sm"
                              sx={{ width: 32, height: 32 }}
                            >
                              {player.name.charAt(0)}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {player.name}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Chip size="sm" variant="soft" sx={{ fontSize: '0.7rem', height: 20 }}>
                                  {player.team}
                                </Chip>
                                <Typography level="body-xs" color="neutral">
                                  {player.position}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                          
                          {/* Weekly Average */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                            <Typography level="body-xs" color="neutral">
                              Avg:
                            </Typography>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.600' }}>
                              {weeklyAverage} FP
                            </Typography>
                          </Box>
                        </Box>
                      </td>
                      {Array.from({ length: maxGames }, (_, idx) => {
                        // For preseason, use sequential games. For regular season, use day-specific games
                        const game = currentWeek === 0 
                          ? playerGames[idx] 
                          : getPlayerGamesForDay(player.team, idx);
                        const playerGameStats = game ? playerStatsByGame[game.gameId] : null;
                        
                        // Debug logging for player stats
                        if (game && player.nbaPlayerId) {
                          console.log(`🔍 Player ${player.name} (${player.nbaPlayerId}) - Game ${game.gameId}:`, {
                            hasStats: !!playerGameStats,
                            points: playerGameStats?.pts,
                            gameStatus: game.status
                          });
                        }
                        
                        return (
                        <td key={idx}>
                          {game ? (
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                                p: 1.5,
                                minHeight: currentWeek === 0 ? '140px' : '120px',
                                bgcolor: game.isHome ? 'primary.50' : 'neutral.50',
                                borderRadius: 'md',
                                border: '2px solid',
                                borderColor: game.isHome ? 'primary.300' : 'neutral.300',
                                overflow: 'hidden',
                                wordWrap: 'break-word',
                                boxShadow: 'sm',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  boxShadow: 'md',
                                  transform: 'translateY(-1px)',
                                }
                              }}
                            >
                                <Typography 
                                  level="body-xs" 
                                  sx={{ 
                                    fontWeight: 'bold',
                                    lineHeight: 1.2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                {game.isHome ? 'vs' : '@'} {game.opponent}
                              </Typography>
                                <Typography 
                                  level="body-xs" 
                                  color="neutral"
                                  sx={{ 
                                    lineHeight: 1.2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {game.gameTime || 'TBD'}
                                </Typography>
                                
                                {/* Show player fantasy points if stats are available (regardless of game status) */}
                                {playerGameStats && (
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      p: 1,
                                      bgcolor: 'success.50',
                                      borderRadius: 'sm',
                                      border: '1px solid',
                                      borderColor: 'success.200',
                                      mt: 'auto'
                                    }}
                                  >
                                    <Typography
                                      level="body-xs"
                                      sx={{
                                        fontWeight: 'bold',
                                        color: 'success.700',
                                        fontSize: '0.7rem',
                                        lineHeight: 1.2,
                                        textAlign: 'center',
                                        mb: 0.5
                                      }}
                                    >
                                      FANTASY POINTS
                                    </Typography>
                                    <Typography
                                      level="title-sm"
                                      sx={{
                                        fontWeight: 'bold',
                                        color: 'success.800',
                                        fontSize: '1.1rem',
                                        lineHeight: 1,
                                        textAlign: 'center'
                                      }}
                                    >
                                      {calculateFantasyPoints(playerGameStats, selectedScoringFormat)}
                                    </Typography>
                                  </Box>
                                )}
                                
                                {game.status && (
                                  <Chip 
                                    size="sm" 
                                    variant="solid" 
                                    color={game.status === 'Final' ? 'success' : game.status === 'In Progress' ? 'warning' : 'neutral'}
                                    sx={{ 
                                      fontSize: '0.7rem', 
                                      height: 20,
                                      fontWeight: 'bold',
                                      alignSelf: 'flex-start',
                                      mt: playerGameStats ? 0.5 : 'auto'
                                    }}
                                  >
                                    {game.status}
                                  </Chip>
                                )}
                            </Box>
                          ) : (
                              <Box sx={{ 
                                textAlign: 'center', 
                                color: 'neutral.400',
                                minHeight: currentWeek === 0 ? '120px' : 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                              <Typography level="body-xs">—</Typography>
                            </Box>
                          )}
                        </td>
                        );
                      })}
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

