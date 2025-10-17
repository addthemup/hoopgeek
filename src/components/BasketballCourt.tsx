import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Tabs,
  TabList,
  Tab,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Button,
} from '@mui/joy';
import { Clear } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import PlayerJersey from './PlayerJersey';
import { useLineupSettings } from '../hooks/useLineupSettings';
import { useAutoLineup } from '../hooks/useAutoLineup';

interface Player {
  id: string;
  name: string;
  team: string;
  position: string; // Simplified position (G, F, C)
  originalPosition?: string; // Original position from database (e.g., "Guard-Forward")
  jerseyNumber?: number | string;
  nbaPlayerId?: number;
  avatar: string;
}

interface CourtPlayer extends Player {
  x: number; // Percentage position (0-100)
  y: number; // Percentage position (0-100)
  lineupPositionId?: string;
  jersey_num?: number | string;
}

interface LineupPosition {
  id: string;
  player_id: string;
  lineup_type: LineupType;
  position_x: number;
  position_y: number;
  player_name: string;
  player_team: string;
  player_position: string;
  player_avatar: string;
  nba_player_id: number;
  jersey_number: string;
}

interface BasketballCourtProps {
  leagueId: string;
  teamId: string;
  availablePlayers: Player[];
  currentWeek?: number;
  currentMatchup?: any;
  seasonYear?: number;
}

type LineupType = 'starters' | 'rotation' | 'bench';

export default function BasketballCourt({ leagueId, teamId, availablePlayers, currentWeek, currentMatchup, seasonYear }: BasketballCourtProps) {
  const [activeTab, setActiveTab] = useState<LineupType>('starters');
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  
  // Get lineup settings including position unit assignments
  const { data: lineupSettings } = useLineupSettings(leagueId);
  
  // Debug logging for lineup settings
  console.log('🔍 BasketballCourt: Lineup settings:', lineupSettings);
  console.log('🔍 BasketballCourt: Position unit assignments:', lineupSettings?.position_unit_assignments);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedJerseyId, setSelectedJerseyId] = useState<string | null>(null);
  const [draggedCourtPlayer, setDraggedCourtPlayer] = useState<CourtPlayer | null>(null);

  const queryClient = useQueryClient();
  
  // Auto-lineup mutation
  const autoLineupMutation = useAutoLineup();

  // Clear lineup mutation
  const clearLineupMutation = useMutation({
    mutationFn: async () => {
      const weekNumber = currentWeek || 1;
      const seasonYearValue = seasonYear || 2025;
      
      console.log('🧹 Clearing all lineup positions for week:', weekNumber, 'season:', seasonYearValue);
      
      const { error } = await supabase
        .from('fantasy_lineups')
        .delete()
        .eq('league_id', leagueId)
        .eq('fantasy_team_id', teamId)
        .eq('week_number', weekNumber)
        .eq('season_year', seasonYearValue);

      if (error) {
        console.error('❌ Error clearing lineup positions:', error);
        throw error;
      }
      
      console.log('✅ Successfully cleared all lineup positions');
    },
    onSuccess: () => {
      // Invalidate and refetch lineup positions
      queryClient.invalidateQueries({ queryKey: ['lineup-positions', leagueId, teamId] });
    },
    onError: (error) => {
      console.error('❌ Clear lineup failed:', error);
    }
  });

  // Handle auto-lineup
  const handleAutoLineup = async () => {
    if (!currentMatchup || !lineupSettings) {
      console.error('❌ Missing required data for auto-lineup');
      return;
    }

    const weekNumber = currentWeek || 1;
    const seasonYearValue = seasonYear || 2025;
    const seasonId = currentMatchup.season_id;
    const matchupId = currentMatchup.id;

    try {
      await autoLineupMutation.mutateAsync({
        leagueId,
        teamId,
        weekNumber,
        seasonYear: seasonYearValue,
        seasonId,
        matchupId
      });
    } catch (error) {
      console.error('❌ Auto-lineup failed:', error);
    }
  };

  // Handle clear lineup
  const handleClearLineup = async () => {
    if (!currentMatchup) {
      console.error('❌ Missing required data for clear lineup');
      return;
    }

    try {
      await clearLineupMutation.mutateAsync();
    } catch (error) {
      console.error('❌ Clear lineup failed:', error);
    }
  };
  
  // Helper function to get position requirements for a unit
  const getPositionRequirements = (unit: LineupType): string[] => {
    if (!lineupSettings?.position_unit_assignments) {
      console.log('🔍 No position_unit_assignments in lineupSettings:', lineupSettings);
      // Return default positions based on unit type
      return getDefaultPositions(unit);
    }
    
    const assignments = lineupSettings.position_unit_assignments[unit];
    console.log(`🔍 Position assignments for ${unit}:`, assignments);
    
    if (!assignments || Object.keys(assignments).length === 0) {
      console.log(`🔍 No assignments found for ${unit}, using defaults`);
      return getDefaultPositions(unit);
    }
    
    const positions: string[] = [];
    
    Object.entries(assignments).forEach(([position, count]) => {
      for (let i = 0; i < count; i++) {
        positions.push(position);
      }
    });
    
    console.log(`🔍 Final positions for ${unit}:`, positions);
    return positions.sort();
  };

  // Helper function to get default positions when no assignments are configured
  const getDefaultPositions = (unit: LineupType): string[] => {
    switch (unit) {
      case 'starters':
        return ['PG', 'SG', 'SF', 'PF', 'C'];
      case 'rotation':
        return ['G', 'F', 'UTIL', 'UTIL', 'UTIL'];
      case 'bench':
        return ['UTIL', 'UTIL', 'UTIL'];
      default:
        return [];
    }
  };

  // Helper function to calculate position and position_order based on lineup type and court position
  const calculatePositionAndOrder = (lineupType: LineupType, x: number, y: number): { position: string; position_order: number } => {
    const positions = getPositionRequirements(lineupType);
    
    // For now, use a simple mapping based on court position
    // This could be enhanced to be more sophisticated
    let position: string;
    let position_order: number;
    
    if (lineupType === 'bench') {
      // For bench, all positions are UTIL
      position = 'UTIL';
      // Calculate order based on x position (left to right)
      position_order = Math.floor((x / 100) * positions.length) + 1;
    } else {
      // For starters and rotation, determine position based on court area
      if (y > 60) {
        // Bottom area - Guards
        position = 'G';
        position_order = x < 50 ? 1 : 2;
      } else if (y < 40) {
        // Top area - Forwards and Center
        if (x < 30 || x > 70) {
          position = 'F';
          position_order = x < 30 ? 1 : 2;
        } else {
          position = 'C';
          position_order = 1;
        }
      } else {
        // Middle area - default to Forward
        position = 'F';
        position_order = x < 50 ? 1 : 2;
      }
    }
    
    return { position, position_order };
  };

  // Helper function to check if a player is available for a specific unit
  const isPlayerAvailableForUnit = (player: Player, targetUnit: LineupType): boolean => {
    // Check if player is already assigned to a different unit
    const existingAssignment = allLineupPositions?.find(pos => pos.player_id === player.id);
    if (existingAssignment && existingAssignment.lineup_type !== targetUnit) {
      return false; // Player is already in a different unit
    }
    
    // Check if the target unit has space
    const currentCount = allLineupPositions?.filter(pos => pos.lineup_type === targetUnit).length || 0;
    const maxCount = getMaxPlayersForLineupType(targetUnit);
    
    if (currentCount >= maxCount) {
      return false; // Unit is full
    }
    
    // Check if player's position is allowed in this unit
    const positionRequirements = lineupSettings?.position_unit_assignments?.[targetUnit] || {};
    const playerPosition = player.position;
    
    // If no specific position requirements, allow any position
    if (Object.keys(positionRequirements).length === 0) {
      return true;
    }
    
    // Check if player's position is in the requirements
    // Use originalPosition if available (for dual positions), otherwise use simplified position
    const positionToCheck = player.originalPosition || playerPosition;
    
    // For dual positions, check if ANY of the player's positions are allowed
    if (positionToCheck.includes('-')) {
      const playerPositions = positionToCheck.split('-').map(p => p.trim());
      // Map each position to simplified form and check if any are allowed
      const simplifiedPositions = playerPositions.map(pos => {
        const posLower = pos.toLowerCase();
        if (posLower.includes('guard')) return 'G';
        if (posLower.includes('forward')) return 'F';
        if (posLower.includes('center')) return 'C';
        return pos; // Already simplified
      });
      return simplifiedPositions.some(pos => positionRequirements[pos] > 0);
    }
    
    // For single positions, check if the position is allowed
    return positionRequirements[playerPosition] > 0;
  };
  
  // Helper function to get max players for lineup type
  const getMaxPlayersForLineupType = (lineupType: LineupType): number => {
    if (!lineupSettings) return 5; // Default fallback
    
    switch (lineupType) {
      case 'starters':
        return lineupSettings.starters_count;
      case 'rotation':
        return lineupSettings.rotation_count;
      case 'bench':
        return lineupSettings.bench_count;
      default:
        return 5;
    }
  };

  // Helper function to check if a position is filled
  const isPositionFilled = (position: string, unit: LineupType): boolean => {
    const playersInUnit = allLineupPositions?.filter(pos => pos.lineup_type === unit) || [];
    return playersInUnit.some(pos => pos.player_position === position);
  };

  // Fetch ALL lineup positions (for all units) to check player availability
  const { data: allLineupPositions, isLoading: lineupLoading, error: lineupError } = useQuery<LineupPosition[]>({
    queryKey: ['lineup-positions', leagueId, teamId],
    queryFn: async () => {
      const weekNumber = currentWeek || 1;
      const seasonYearValue = seasonYear || 2025;
      
      console.log('🏀 BasketballCourt: Calling get_lineup_positions with:', {
        p_fantasy_team_id: teamId,
        p_league_id: leagueId,
        p_lineup_type: null // Get all lineup types
      });
      
      const { data, error } = await supabase.rpc('get_lineup_positions', {
        p_fantasy_team_id: teamId,
        p_league_id: leagueId,
        p_lineup_type: null // Get all lineup types
      });

      if (error) {
        console.error('❌ BasketballCourt: Error calling get_lineup_positions:', error);
        throw error;
      }
      
      console.log('✅ BasketballCourt: All lineup positions fetched:', data);
      console.log('🔍 BasketballCourt: Number of lineup positions:', data?.length || 0);
      console.log('🔍 BasketballCourt: Lineup positions for current tab:', data?.filter(pos => pos.lineup_type === activeTab) || []);
      return (data || []) as LineupPosition[];
    },
    enabled: !!leagueId && !!teamId,
  });

  // Debug query state
  console.log('🔍 BasketballCourt: Query state:', {
    isLoading: lineupLoading,
    error: lineupError,
    dataLength: allLineupPositions?.length || 0,
    enabled: !!leagueId && !!teamId,
    leagueId,
    teamId,
    currentWeek,
    seasonYear
  });

  // Filter lineup positions for the current active tab
  const lineupPositions = allLineupPositions?.filter(pos => pos.lineup_type === activeTab) || [];

  // Transform lineup positions to court players
  const playersOnCourt: CourtPlayer[] = lineupPositions?.map(pos => ({
    id: pos.player_id,
    name: pos.player_name,
    team: pos.player_team,
    position: pos.player_position,
    nbaPlayerId: pos.nba_player_id,
    avatar: pos.player_avatar,
    jerseyNumber: pos.jersey_number,
    jersey_num: pos.jersey_number,
    x: pos.position_x,
    y: pos.position_y,
    lineupPositionId: pos.id,
  })) || [];

  // Debug logging for court players
  console.log('🔍 BasketballCourt: Active tab:', activeTab);
  console.log('🔍 BasketballCourt: Lineup positions for active tab:', lineupPositions);
  console.log('🔍 BasketballCourt: Players on court:', playersOnCourt);

  // Mutation to add/update lineup position
  const upsertLineupPosition = useMutation({
    mutationFn: async ({ playerId, x, y }: { playerId: string; x: number; y: number }) => {
      // Calculate position and position_order based on lineup type and court position
      const { position, position_order } = calculatePositionAndOrder(activeTab, x, y);
      
      // Get required data for the function call
      const weekNumber = currentWeek || 1;
      const seasonYearValue = seasonYear || 2025;
      const matchupId = currentMatchup?.id || '00000000-0000-0000-0000-000000000000'; // Default UUID if no matchup
      
      // Get season_id from the current matchup (which already has it)
      const seasonId = currentMatchup?.season_id || '00000000-0000-0000-0000-000000000000';
      
      // Look up the UUID id from nba_players table using the nba_player_id
      const { data: playerData, error: playerError } = await supabase
        .from('nba_players')
        .select('id')
        .eq('nba_player_id', parseInt(playerId))
        .single();
      
      if (playerError || !playerData) {
        console.error('❌ BasketballCourt: Error finding player UUID:', playerError);
        throw new Error(`Player not found: ${playerId}`);
      }
      
      const playerUuid = playerData.id;
      
      console.log('🏀 BasketballCourt: Calling upsert_lineup_position with:', {
        p_league_id: leagueId,
        p_season_id: seasonId,
        p_fantasy_team_id: teamId,
        p_matchup_id: matchupId,
        p_week_number: weekNumber,
        p_season_year: seasonYearValue,
        p_lineup_type: activeTab,
        p_position: position,
        p_position_order: position_order,
        p_player_id: playerUuid,
        p_position_x: x,
        p_position_y: y
      });
      
      const { data, error } = await supabase.rpc('upsert_lineup_position', {
        p_league_id: leagueId,
        p_season_id: seasonId,
        p_fantasy_team_id: teamId,
        p_matchup_id: matchupId,
        p_week_number: weekNumber,
        p_season_year: seasonYearValue,
        p_lineup_type: activeTab,
        p_position: position,
        p_position_order: position_order,
        p_player_id: playerUuid,
        p_position_x: x,
        p_position_y: y,
        p_created_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('❌ BasketballCourt: Error calling upsert_lineup_position:', error);
        throw error;
      }
      
      console.log('✅ BasketballCourt: upsert_lineup_position success:', data);
      return data;
    },
    onSuccess: () => {
      // Invalidate the query that fetches ALL lineup positions
      queryClient.invalidateQueries({ queryKey: ['lineup-positions', leagueId, teamId] });
    },
  });

  // Mutation to remove lineup position
  const removeLineupPosition = useMutation({
    mutationFn: async (playerId: string) => {
      const { data, error } = await supabase.rpc('remove_lineup_position', {
        p_league_id: leagueId,
        p_fantasy_team_id: teamId,
        p_player_id: playerId
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate the query that fetches ALL lineup positions
      queryClient.invalidateQueries({ queryKey: ['lineup-positions', leagueId, teamId] });
    },
  });

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
    setDraggedPlayer(null);
    setDraggedCourtPlayer(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnCourt = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Get drop position relative to court
    const courtElement = e.currentTarget as HTMLElement;
    const rect = courtElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    // If dragging a player from roster
    if (draggedPlayer && !isPlayerOnCourt(draggedPlayer.id)) {
      // Check if player is available for this unit
      if (!isPlayerAvailableForUnit(draggedPlayer, activeTab)) {
        console.warn(`Player ${draggedPlayer.name} is not available for ${activeTab} unit`);
        setIsDragging(false);
        setDraggedPlayer(null);
        return;
      }
      
      const nbaPlayerId = draggedPlayer.nbaPlayerId?.toString();
      if (!nbaPlayerId) {
        console.error('❌ BasketballCourt: No NBA player ID found for player:', draggedPlayer);
        return;
      }
      
      upsertLineupPosition.mutate({
        playerId: nbaPlayerId,
        x,
        y
      });
    }
    
    // If repositioning a jersey already on court
    if (draggedCourtPlayer) {
      const nbaPlayerId = draggedCourtPlayer.nbaPlayerId?.toString();
      if (!nbaPlayerId) {
        console.error('❌ BasketballCourt: No NBA player ID found for court player:', draggedCourtPlayer);
        return;
      }
      
      upsertLineupPosition.mutate({
        playerId: nbaPlayerId,
        x,
        y
      });
    }

    setIsDragging(false);
  };

  const handleJerseyDragStart = (e: React.DragEvent, player: CourtPlayer) => {
    e.stopPropagation();
    setDraggedCourtPlayer(player);
    setIsDragging(true);
    setSelectedJerseyId(null);
  };

  const handleJerseyClick = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    setSelectedJerseyId(prev => prev === playerId ? null : playerId);
  };

  const handleRemoveFromCourt = (playerId: string) => {
    removeLineupPosition.mutate(playerId);
    setSelectedJerseyId(null);
  };

  const handleCourtClick = () => {
    setSelectedJerseyId(null);
  };

  const getLineupTypeColor = (type: LineupType) => {
    switch (type) {
      case 'starters': return 'primary';
      case 'rotation': return 'warning';
      case 'bench': return 'neutral';
      default: return 'neutral';
    }
  };

  const getLineupTypeLabel = (type: LineupType) => {
    switch (type) {
      case 'starters': return 'Starters';
      case 'rotation': return 'Rotation';
      case 'bench': return 'Bench';
      default: return type;
    }
  };

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Tabs Row with Auto Button and Position Requirements */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
          {/* Tabs */}
          <Box sx={{ flex: 1 }}>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value as LineupType)}
              sx={{ '--Tabs-gap': '0px' }}
            >
              <TabList>
                {(['starters', 'rotation', 'bench'] as LineupType[]).map((type) => {
                  // Count players for this specific lineup type
                  const currentCount = allLineupPositions?.filter(pos => pos.lineup_type === type).length || 0;
                  const maxCount = getMaxPlayersForLineupType(type);
                  const multiplier = lineupSettings ? 
                    (type === 'starters' ? lineupSettings.starters_multiplier :
                     type === 'rotation' ? lineupSettings.rotation_multiplier :
                     lineupSettings.bench_multiplier) : 1.0;
                  const positionRequirements = getPositionRequirements(type);
                  
                  return (
                    <Tab key={type} value={type} sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={getLineupTypeColor(type)}
                            sx={{ minWidth: 20, height: 20 }}
                          >
                            {currentCount}/{maxCount}
                          </Chip>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {getLineupTypeLabel(type)}
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            {multiplier}x
                          </Typography>
                        </Box>
                        {positionRequirements.length > 0 && (
                          <Typography level="body-xs" color="neutral" sx={{ textAlign: 'center', lineHeight: 1.2 }}>
                            {positionRequirements.join(', ')}
                          </Typography>
                        )}
                      </Box>
                    </Tab>
                  );
                })}
              </TabList>
            </Tabs>
          </Box>

          {/* Auto Button and Position Requirements */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1 }}>
            {/* Auto Lineup Button */}
            <Button
              variant="solid"
              color="primary"
              startDecorator="🤖"
              size="sm"
              onClick={handleAutoLineup}
              loading={autoLineupMutation.isPending}
              disabled={!currentMatchup || !lineupSettings}
              sx={{ 
                minWidth: 'auto',
                px: 2,
                fontSize: '0.8rem'
              }}
            >
              Auto
            </Button>

            {/* Position Requirements for Active Tab */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography level="body-xs" color="neutral" sx={{ fontWeight: 'bold' }}>
                {getLineupTypeLabel(activeTab)}:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {getPositionRequirements(activeTab).map((position, index) => {
                  const isFilled = isPositionFilled(position, activeTab);
                  return (
                    <Chip
                      key={index}
                      size="sm"
                      variant="soft"
                      color={isFilled ? getLineupTypeColor(activeTab) : 'danger'}
                      sx={{ 
                        fontSize: '0.7rem', 
                        height: 20,
                        opacity: isFilled ? 1 : 0.8
                      }}
                    >
                      {position}
                    </Chip>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Court + Roster Container */}
        <Box sx={{ 
          display: 'flex', 
          height: '500px',
          overflow: 'hidden'
        }}>
          {/* Player Roster - Left Side */}
          <Box
            sx={{
              width: '100px',
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
              const isAvailable = isPlayerAvailableForUnit(player, activeTab);
              const existingAssignment = allLineupPositions?.find(pos => pos.player_id === player.id);
              const assignedUnit = existingAssignment?.lineup_type;
              
              return (
                <Tooltip 
                  key={player.id} 
                  title={
                    <Box>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.name}</Typography>
                      <Typography level="body-xs">
                        {player.originalPosition || player.position} - {player.team}
                      </Typography>
                      {assignedUnit && (
                        <Typography level="body-xs" color="warning">
                          Assigned to: {assignedUnit}
                        </Typography>
                      )}
                      {!isAvailable && !assignedUnit && (
                        <Typography level="body-xs" color="danger">
                          Not available for this unit
                        </Typography>
                      )}
                    </Box>
                  } 
                  placement="right"
                >
                  <Box
                    draggable={isAvailable}
                    onDragStart={() => isAvailable && handleDragStart(player)}
                    onDragEnd={handleDragEnd}
                    sx={{
                      position: 'relative',
                      cursor: isAvailable ? 'grab' : 'not-allowed',
                      opacity: isAvailable ? 1 : 0.4,
                      transition: 'all 0.2s',
                      '&:hover': isAvailable ? {
                        transform: 'scale(1.05)',
                        opacity: 0.9,
                      } : {},
                    }}
                  >
                    <Avatar
                      src={player.avatar}
                      sx={{ 
                        width: 72, 
                        height: 72,
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
                    
                    {/* Position badge */}
                    <Chip
                      size="sm"
                      variant="solid"
                      sx={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        minWidth: 24,
                        height: 24,
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        bgcolor: onCourt ? 'primary.500' : 'neutral.700',
                      }}
                    >
                      {player.originalPosition || player.position}
                    </Chip>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>

          {/* Half Court - Right Side */}
          <Box
            onDragOver={handleDragOver}
            onDrop={handleDropOnCourt}
            onClick={handleCourtClick}
            sx={{
              position: 'relative',
              flex: 1,
              height: '100%',
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
              border: '2px solid #dee2e6',
              overflow: 'hidden',
            }}
          >

            {/* Court Lines - Half Court Design */}
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
              {/* Three-point line */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '20%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '60%',
                  height: '40%',
                  border: '3px solid #212529',
                  borderRadius: '50%',
                  background: 'transparent',
                  borderTop: 'none',
                }}
              />
              
              {/* Free throw line */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '35%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '25%',
                  height: '15%',
                  border: '3px solid #212529',
                  borderBottom: 'none',
                  background: 'transparent',
                }}
              />
              
              {/* Basket */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '45%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '8%',
                  height: '8%',
                  border: '4px solid #dc3545',
                  borderRadius: '50%',
                  background: 'transparent',
                }}
              />
              
              {/* Center line */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '0',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '3px',
                  height: '100%',
                  bgcolor: '#212529',
                }}
              />
              
              {/* Court markings */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '4px',
                  height: '4px',
                  bgcolor: '#212529',
                  borderRadius: '50%',
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
                  zIndex: 10,
                }}
              >
                <Typography 
                  level="h4" 
                  sx={{ 
                    color: '#6c757d',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                  }}
                >
                  Drop Player Here
                </Typography>
                <Typography 
                  level="body-md" 
                  sx={{
                    color: '#6c757d',
                    textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
                  }}
                >
                  Position them on the court
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
                    <IconButton
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
                    </IconButton>
                  )}
                </Box>
              );
            })}

            {/* Roster Configuration Overlay - Top Right */}
            <Box sx={{ 
              position: 'absolute', 
              top: 16, 
              right: 16, 
              zIndex: 5, // Higher than court but lower than jerseys (which are zIndex 10+)
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(4px)',
              borderRadius: 'md',
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Typography level="body-xs" color="neutral" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {getLineupTypeLabel(activeTab)} Requirements:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {getPositionRequirements(activeTab).map((position, index) => {
                  const isFilled = isPositionFilled(position, activeTab);
                  return (
                    <Chip
                      key={index}
                      size="sm"
                      variant="soft"
                      color={isFilled ? getLineupTypeColor(activeTab) : 'danger'}
                      sx={{ 
                        fontSize: '0.7rem', 
                        height: 18,
                        opacity: isFilled ? 1 : 0.8
                      }}
                    >
                      {position}
                    </Chip>
                  );
                })}
              </Box>
            </Box>

            {/* Loading overlay */}
            {lineupLoading && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(255, 255, 255, 0.8)',
                  zIndex: 1000,
                }}
              >
                <CircularProgress />
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
