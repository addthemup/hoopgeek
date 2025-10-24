import React from 'react';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  Table,
  Sheet,
  CircularProgress,
} from '@mui/joy';
import { usePlayerWeekGames } from '../hooks/usePlayerWeekGames';
import { usePlayerStatsForPlayer } from '../hooks/usePlayerGameLogs';
import { calculateFantasyPoints } from '../utils/fantasyScoring';

interface WeekDates {
  startDate: string;
  endDate: string;
  weekName: string;
}

interface LineupPosition {
  id: string;
  player_id: string;
  lineup_type: string;
  position: string;
  position_order: number;
  player_name: string;
  player_team: string;
  player_position: string;
  player_avatar: string;
  nba_player_id: number;
  jersey_number: string;
}

interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  originalPosition?: string;
  jerseyNumber?: number | string;
  nbaPlayerId?: number;
  avatar: string;
}

interface ScheduleTableProps {
  lineupPositions: LineupPosition[];
  availablePlayers: Player[];
  weekDates?: WeekDates;
  currentWeek: number;
  selectedScoringFormat?: any;
}

/**
 * Component to render schedule row for a single player
 */
function PlayerScheduleRow({ 
  pos, 
  player, 
  weekDates, 
  currentWeek, 
  selectedScoringFormat 
}: { 
  pos: LineupPosition; 
  player: Player;
  weekDates?: WeekDates;
  currentWeek: number;
  selectedScoringFormat?: any;
}) {
  // Fetch games for this player's team for the current week
  console.log(`🏀 PlayerScheduleRow BEFORE hook for ${player.name}:`, {
    playerName: player.name,
    playerTeam: player.team,
    playerTeamType: typeof player.team,
    currentWeek,
    pos
  });
  
  const { data: playerGames, isLoading } = usePlayerWeekGames(
    player.team,
    currentWeek,
    true
  );

  // Fetch this player's box score logs for the week's games (if any)
  const gameIds = (playerGames || []).map((g: any) => g.game_id);
  const { data: statsByGame } = usePlayerStatsForPlayer(player.nbaPlayerId || 0, gameIds);

  console.log(`🎯 PlayerScheduleRow AFTER hook for ${player.name} (${player.team}):`, {
    weekNumber: currentWeek,
    gamesCount: playerGames?.length || 0,
    games: playerGames
  });

  // Calculate average fantasy points for completed games this week
  const calculateWeekAverage = () => {
    if (!playerGames || !statsByGame || !selectedScoringFormat) return null;
    
    const completedGames = playerGames.filter(game => 
      (game.game_status_text || '').toLowerCase() === 'final' &&
      statsByGame[game.game_id]
    );
    
    if (completedGames.length === 0) return null;
    
    const totalPoints = completedGames.reduce((sum, game) => {
      try {
        const stats = statsByGame[game.game_id];
        return sum + calculateFantasyPoints(stats as any, selectedScoringFormat);
      } catch (e) {
        return sum;
      }
    }, 0);
    
    return totalPoints / completedGames.length;
  };

  const weekAverage = calculateWeekAverage();

  // Parse week dates to calculate number of days
  const getDaysInWeek = () => {
    if (!weekDates) return 7;
    
    const [startYear, startMonth, startDay] = weekDates.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = weekDates.endDate.split('-').map(Number);
    
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(days, 7);
  };

  // Create date strings for each day of the week
  const getWeekDates = () => {
    if (!weekDates) return [];
    
    // Parse the start date components
    const [year, month, day] = weekDates.startDate.split('-').map(Number);
    
    const days = getDaysInWeek();
    return Array.from({ length: days }, (_, i) => {
      // Calculate the date by adding days directly to avoid timezone issues
      const currentDay = day + i;
      const date = new Date(year, month - 1, currentDay);
      
      // Format as YYYY-MM-DD
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      console.log(`🗓️ getWeekDates day ${i}: input=${weekDates.startDate}, calculated=${dateStr}`);
      return dateStr;
    });
  };

  // Group games by date - extract just the date part (YYYY-MM-DD) from the timestamp
  // Store as arrays since a team could potentially have multiple games on the same day
  const gamesByDate = playerGames?.reduce((acc, game) => {
    // game_date might be a timestamp like "2025-10-20 19:00:07.942786+00"
    // Extract just the date part
    const dateOnly = game.game_date.split('T')[0].split(' ')[0]; // Get YYYY-MM-DD
    if (!acc[dateOnly]) {
      acc[dateOnly] = [];
    }
    acc[dateOnly].push(game);
    console.log(`📅 Grouping game: ${game.game_date} -> ${dateOnly}`);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const weekDatesArray = getWeekDates();
  const daysInWeek = currentWeek === 0 ? 7 : getDaysInWeek();
  
  console.log(`📅 ${player.name} date matching debug:`, {
    playerGames: playerGames?.map(g => ({ date: g.game_date, home: g.home_team_tricode, away: g.away_team_tricode })),
    gamesByDate: Object.keys(gamesByDate),
    weekDatesArray,
    daysInWeek,
    currentWeek
  });

  return (
    <tr key={pos.player_id}>
      <td 
        style={{ 
          position: 'sticky', 
          left: 0, 
          zIndex: 99, 
          backgroundColor: 'var(--joy-palette-background-surface)' 
        }}
        className="player-column-cell"
      >
        <style>{`
          @media (max-width: 899px) {
            .player-column-cell {
              min-width: 50px !important;
              max-width: 80px !important;
              width: auto !important;
              padding: 8px 4px !important;
            }
          }
          @media (min-width: 900px) {
            .player-column-cell {
              min-width: 200px !important;
              width: 200px !important;
            }
          }
        `}</style>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'center', 
          gap: { xs: 0.25, md: 1 },
          justifyContent: { xs: 'center', md: 'flex-start' }
        }}>
          <Avatar
            src={pos.player_avatar}
            size="sm"
            sx={{ 
              width: { xs: 24, md: 28 }, 
              height: { xs: 24, md: 28 },
              flexShrink: 0
            }}
          >
            {pos.player_name.charAt(0)}
          </Avatar>
          {/* Hide name and team on mobile, show on md+ */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography level="body-xs" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
              {pos.player_name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography level="body-xs" color="neutral" sx={{ fontSize: '0.7rem' }}>
                {pos.player_team}
              </Typography>
              {weekAverage !== null && (
                <Chip 
                  size="sm" 
                  variant="soft" 
                  color="success"
                  sx={{ fontSize: '0.65rem', minHeight: '16px', px: 0.5 }}
                >
                  {weekAverage.toFixed(1)} avg
                </Chip>
              )}
            </Box>
          </Box>
          {/* Show average chip alone on mobile, below avatar */}
          {weekAverage !== null && (
            <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
              <Chip 
                size="sm" 
                variant="soft" 
                color="success"
                sx={{ fontSize: '0.6rem', minHeight: '14px', px: 0.4, py: 0.1 }}
              >
                {weekAverage.toFixed(1)}
              </Chip>
            </Box>
          )}
        </Box>
      </td>
      
      {isLoading ? (
        <td colSpan={daysInWeek}>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size="sm" />
          </Box>
        </td>
      ) : (
        Array.from({ length: daysInWeek }, (_, idx) => {
          let game;
          
          if (currentWeek === 0) {
            // Preseason: Show games in order (Game 1, Game 2, etc.)
            game = playerGames && playerGames[idx] ? playerGames[idx] : null;
          } else {
            // Regular season: Show games by date
            const dateStr = weekDatesArray[idx];
            // Get the first game for this date (teams typically play once per day)
            const gamesOnDate = dateStr && gamesByDate[dateStr] ? gamesByDate[dateStr] : null;
            game = gamesOnDate && gamesOnDate.length > 0 ? gamesOnDate[0] : null;
            
            if (idx === 0) {
              console.log(`🔍 ${player.name} day ${idx} matching:`, {
                dateStr,
                hasGameForDate: !!(gamesOnDate && gamesOnDate.length > 0),
                gamesCount: gamesOnDate?.length || 0,
                allGameDates: Object.keys(gamesByDate)
              });
            }
          }

          const opponent = game 
            ? (game.home_team_tricode === player.team ? game.away_team_tricode : game.home_team_tricode)
            : null;
          const isHome = game?.home_team_tricode === player.team;

          // If the game is final and we have a box score for this player, compute fantasy points
          let fantasyPoints: number | null = null;
          if (game && statsByGame && statsByGame[game.game_id] && (game.game_status_text || '').toLowerCase() === 'final') {
            try {
              fantasyPoints = calculateFantasyPoints(statsByGame[game.game_id] as any, selectedScoringFormat);
            } catch (e) {
              fantasyPoints = null;
            }
          }

          return (
            <td key={idx}>
              {game && opponent ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 0.5,
                    borderRadius: 'sm',
                    bgcolor: 'background.level1',
                  }}
                >
                  <Typography level="body-xs" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                    {isHome ? 'vs' : '@'} {opponent}
                    {fantasyPoints !== null ? ` ${fantasyPoints.toFixed(1)}` : ''}
                  </Typography>
                </Box>
              ) : (
                <Typography level="body-xs" color="neutral" sx={{ fontSize: '0.7rem', textAlign: 'center' }}>
                  -
                </Typography>
              )}
            </td>
          );
        })
      )}
    </tr>
  );
}

/**
 * Main schedule table component
 */
export default function LineupScheduleTable({
  lineupPositions,
  availablePlayers,
  weekDates,
  currentWeek,
  selectedScoringFormat,
}: ScheduleTableProps) {
  console.log('📊 LineupScheduleTable render:', {
    positionsCount: lineupPositions.length,
    weekDates,
    currentWeek
  });

  // Parse week dates for header
  const getDaysInWeek = () => {
    if (!weekDates) return 7;
    
    const [startYear, startMonth, startDay] = weekDates.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = weekDates.endDate.split('-').map(Number);
    
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.min(days, 7);
  };

  const renderTableHeaders = () => {
    if (currentWeek === 0) {
      // Preseason: Show Game 1, Game 2, etc.
      return Array.from({ length: 7 }, (_, index) => (
        <th key={index} style={{ minWidth: 120 }}>
          Game {index + 1}
        </th>
      ));
    }

    if (!weekDates) {
      return Array.from({ length: 7 }, (_, index) => (
        <th key={index} style={{ minWidth: 120 }}>
          Day {index + 1}
        </th>
      ));
    }

    // Regular season: Show days of the week with dates
    const [year, month, day] = weekDates.startDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    const daysInWeek = getDaysInWeek();

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Array.from({ length: daysInWeek }, (_, index) => {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + index);
      
      const dayOfWeek = dayDate.getDay();
      // Adjust for Monday as first day (0=Sunday in JS, but we want 0=Monday)
      const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const dayName = dayNames[adjustedDayOfWeek];
      const dateStr = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;

      console.log(`📅 Header day ${index}:`, {
        dayDate: dayDate.toISOString(),
        dayOfWeek,
        adjustedDayOfWeek,
        dayName,
        dateStr
      });

      return (
        <th key={index} style={{ minWidth: 120 }}>
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
  };

  return (
    <Sheet
      variant="outlined"
      sx={{
        overflow: 'auto',
        overflowX: 'auto', // Enable horizontal scrolling
        WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        borderRadius: 'sm',
        // On mobile, show scrollbar hint
        '&::-webkit-scrollbar': {
          height: { xs: '8px', md: '12px' },
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: 'background.level1',
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: 'neutral.400',
          borderRadius: '4px',
          '&:hover': {
            bgcolor: 'neutral.500',
          },
        },
      }}
    >
      <Table
        stickyHeader
        hoverRow
        size="sm"
        sx={{
          // Force table to not auto-resize columns on mobile
          tableLayout: { xs: 'auto', md: 'auto' },
          minWidth: { xs: 'max-content', md: 'auto' },
          '& thead th': {
            bgcolor: 'background.surface',
            fontWeight: 'bold',
            fontSize: '0.75rem',
          },
          '& td': {
            fontSize: '0.75rem',
            p: 1,
            verticalAlign: 'top',
            whiteSpace: 'nowrap', // Prevent text wrapping in game cells
          },
        }}
      >
        <thead>
          <tr>
            <th 
              style={{ 
                position: 'sticky', 
                left: 0, 
                zIndex: 100, 
                backgroundColor: 'var(--joy-palette-background-surface)',
              }}
              className="player-column-header"
            >
              <style>{`
                @media (max-width: 899px) {
                  .player-column-header {
                    min-width: 50px !important;
                    max-width: 80px !important;
                    width: auto !important;
                  }
                }
                @media (min-width: 900px) {
                  .player-column-header {
                    min-width: 200px !important;
                    width: 200px !important;
                  }
                }
              `}</style>
              Player
            </th>
            {renderTableHeaders()}
          </tr>
        </thead>
        <tbody>
          {lineupPositions.map((pos) => {
            const player = availablePlayers.find(p => p.id === pos.player_id);
            
            if (!player) {
              console.error(`❌ Player not found for lineup position:`, pos);
              return (
                <tr key={pos.player_id}>
                  <td colSpan={100} style={{ textAlign: 'center', padding: '16px' }}>
                    <Typography level="body-sm" color="danger">
                      ⚠️ Player data not found for {pos.player_name}. Try refreshing the page.
                    </Typography>
                  </td>
                </tr>
              );
            }

            return (
              <PlayerScheduleRow
                key={pos.player_id}
                pos={pos}
                player={player}
                weekDates={weekDates}
                currentWeek={currentWeek}
                selectedScoringFormat={selectedScoringFormat}
              />
            );
          })}
        </tbody>
      </Table>
    </Sheet>
  );
}

