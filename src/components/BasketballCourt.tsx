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
  CircularProgress,
  Button,
  Modal,
  ModalDialog,
  ModalClose,
  Sheet,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
} from '@mui/joy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
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

interface LineupPosition {
  id: string;
  player_id: string;
  lineup_type: LineupType;
  position: string;
  position_order: number;
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
  const [selectedPosition, setSelectedPosition] = useState<{ position: string; positionOrder: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Get lineup settings including position unit assignments
  const { data: lineupSettings } = useLineupSettings(leagueId);
  
  // Debug logging for lineup settings
  console.log('🔍 BasketballCourt: Lineup settings:', lineupSettings);
  console.log('🔍 BasketballCourt: Position unit assignments:', lineupSettings?.position_unit_assignments);

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
  
  // Helper function to sort positions in desired order: G, F, C, UTIL
  const sortPositions = (positions: string[]): string[] => {
    const positionOrder: { [key: string]: number } = {
      'G': 1,
      'PG': 1,
      'SG': 1,
      'F': 2,
      'SF': 2,
      'PF': 2,
      'C': 3,
      'UTIL': 4,
    };
    
    return positions.sort((a, b) => {
      const orderA = positionOrder[a] || 999;
      const orderB = positionOrder[b] || 999;
      return orderA - orderB;
    });
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
    return sortPositions(positions);
  };

  // Helper function to get default positions when no assignments are configured
  const getDefaultPositions = (unit: LineupType): string[] => {
    let positions: string[] = [];
    
    switch (unit) {
      case 'starters':
        positions = ['PG', 'SG', 'SF', 'PF', 'C'];
        break;
      case 'rotation':
        positions = ['G', 'F', 'UTIL', 'UTIL', 'UTIL'];
        break;
      case 'bench':
        positions = ['UTIL', 'UTIL', 'UTIL'];
        break;
      default:
        positions = [];
    }
    
    // Sort positions in desired order: G, F, C, UTIL
    return sortPositions(positions);
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

  // Debug logging
  console.log('🔍 BasketballCourt: Active tab:', activeTab);
  console.log('🔍 BasketballCourt: Lineup positions for active tab:', lineupPositions);

  // Mutation to add/update lineup position
  const upsertLineupPosition = useMutation({
    mutationFn: async ({ playerId, position, positionOrder, x, y }: { 
      playerId: string; 
      position: string; 
      positionOrder: number; 
      x: number; 
      y: number; 
    }) => {
      // Use the provided position and position_order directly
      const position_order = positionOrder;
      
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

  // Handle opening modal for position selection
  const handlePositionClick = (position: string, positionOrder: number) => {
    setSelectedPosition({ position, positionOrder });
    setIsModalOpen(true);
  };

  // Handle selecting a player from the modal
  const handlePlayerSelect = async (player: Player) => {
    if (!selectedPosition) return;
    
    const nbaPlayerId = player.nbaPlayerId?.toString();
    if (!nbaPlayerId) {
      console.error('❌ No NBA player ID found for player:', player);
      return;
    }
    
    // DUPLICATE PREVENTION: Check if player is already assigned to ANY position in ANY lineup type
    const existingAssignment = allLineupPositions?.find(
      pos => pos.player_id === player.id
    );
    
    if (existingAssignment) {
      console.log('⚠️ Player already assigned to another position:', {
        player: player.name,
        currentLineupType: existingAssignment.lineup_type,
        currentPosition: existingAssignment.position,
        currentPositionOrder: existingAssignment.position_order,
        newLineupType: activeTab,
        newPosition: selectedPosition.position,
        newPositionOrder: selectedPosition.positionOrder
      });
      
      // Remove player from their previous position first
      console.log('🔄 Removing player from previous position before reassigning...');
      await removeLineupPosition.mutateAsync(existingAssignment.player_id);
      
      // Explicitly invalidate and wait for the query to refetch
      console.log('🔄 Invalidating query cache and waiting for refetch...');
      await queryClient.invalidateQueries({ queryKey: ['lineup-positions', leagueId, teamId] });
      
      // Additional small delay to ensure DB and cache are in sync
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Set a default position on court based on position type
    const x = 50; // Center horizontally
    const y = selectedPosition.position === 'G' ? 75 : selectedPosition.position === 'C' ? 25 : 50;
    
    console.log('✅ Adding player to new position:', {
      position: selectedPosition.position,
      positionOrder: selectedPosition.positionOrder,
      playerId: nbaPlayerId
    });
    
    await upsertLineupPosition.mutateAsync({
      playerId: nbaPlayerId,
      position: selectedPosition.position,
      positionOrder: selectedPosition.positionOrder,
      x,
      y
    });
    
    setIsModalOpen(false);
    setSelectedPosition(null);
  };

  // Handle clearing a position (removing player from that spot)
  const handleClearPosition = async () => {
    if (!selectedPosition) return;
    
    // Find the player currently in this position slot by matching position AND position_order
    const assignedPlayer = lineupPositions.find(
      pos => pos.position === selectedPosition.position && pos.position_order === selectedPosition.positionOrder
    );
    
    if (assignedPlayer) {
      await removeLineupPosition.mutateAsync(assignedPlayer.player_id);
    }
    
    setIsModalOpen(false);
    setSelectedPosition(null);
  };

  // Handle removing a player from lineup
  const handleRemovePlayer = (playerId: string) => {
    removeLineupPosition.mutate(playerId);
  };

  // Helper to get lineup type label with multiplier
  const getLineupTypeLabel = (lineupType: LineupType): string => {
    switch (lineupType) {
      case 'starters': return 'Starters x1';
      case 'rotation': return 'Rotation x0.5';
      case 'bench': return 'Bench x0.25';
      default: return lineupType;
    }
  };

  // Get available players for a specific position WITH assignment status
  const getAvailablePlayersForPosition = (position: string): (Player & { assignmentInfo?: string })[] => {
    console.log('🔍 getAvailablePlayersForPosition called:', {
      position,
      totalPlayers: availablePlayers.length,
      allLineupPositionsCount: allLineupPositions?.length || 0,
      allLineupPositions: allLineupPositions
    });
    
    return availablePlayers
      .filter(player => {
        // Check position eligibility
        if (position === 'UTIL') {
          console.log(`✅ ${player.name} eligible for UTIL`);
          return true; // UTIL accepts any position
        }
        
        // Check if player's position matches
        const playerPosition = player.position;
        const originalPosition = player.originalPosition || '';
        
        // Handle dual positions (e.g., "Guard-Forward")
        if (originalPosition.includes('-')) {
          const positions = originalPosition.split('-');
          const isEligible = positions.some(pos => {
            const posLower = pos.trim().toLowerCase();
            if (position === 'G' && posLower.includes('guard')) return true;
            if (position === 'F' && posLower.includes('forward')) return true;
            if (position === 'C' && posLower.includes('center')) return true;
            return false;
          });
          console.log(`${isEligible ? '✅' : '🚫'} ${player.name} (${originalPosition}) for ${position}`);
          return isEligible;
        }
        
        // Direct match
        const isMatch = playerPosition === position;
        console.log(`${isMatch ? '✅' : '🚫'} ${player.name} (${playerPosition}) for ${position}`);
        return isMatch;
      })
      .map(player => {
        // Check if player is already assigned to ANY lineup type
        const existingAssignment = allLineupPositions?.find(pos => pos.player_id === player.id);
        
        if (existingAssignment) {
          console.log(`📍 ${player.name} is assigned to ${existingAssignment.lineup_type} at ${existingAssignment.position}`);
          return {
            ...player,
            assignmentInfo: `${getLineupTypeLabel(existingAssignment.lineup_type as LineupType)}`
          };
        }
        
        return player;
      });
  };

  const getLineupTypeColor = (type: LineupType) => {
    switch (type) {
      case 'starters': return 'primary';
      case 'rotation': return 'warning';
      case 'bench': return 'neutral';
      default: return 'neutral';
    }
  };

  // Get available players filtered by selected position (for modal)
  const filteredPlayers = selectedPosition 
    ? getAvailablePlayersForPosition(selectedPosition.position)
    : [];

  return (
    <>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>

          {/* Simplified Tabs Row */}
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value as LineupType)}
              sx={{ '--Tabs-gap': '0px' }}
            >
              <TabList>
                {(['starters', 'rotation', 'bench'] as LineupType[]).map((type) => {
                  const multiplier = lineupSettings ? 
                    (type === 'starters' ? lineupSettings.starters_multiplier :
                     type === 'rotation' ? lineupSettings.rotation_multiplier :
                     lineupSettings.bench_multiplier) : 1.0;
                  
                  return (
                    <Tab key={type} value={type} sx={{ flex: 1 }}>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                        {getLineupTypeLabel(type)} {multiplier}x
                      </Typography>
                    </Tab>
                  );
                })}
              </TabList>
            </Tabs>
          </Box>

          {/* Position Slot Avatars Row - Full Width */}
          <Box sx={{ 
            p: 2, 
            borderBottom: '1px solid', 
            borderColor: 'divider',
          }}>
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: {
                xs: `repeat(${getPositionRequirements(activeTab).length}, 1fr)`,
                sm: `repeat(${getPositionRequirements(activeTab).length}, 1fr)`,
                md: `repeat(${getPositionRequirements(activeTab).length}, 1fr)`,
              },
              gap: { xs: 1, sm: 2 },
              width: '100%'
            }}>
              {getPositionRequirements(activeTab).map((position, index) => {
                // Find if this position is filled by matching position AND position_order
                const positionOrder = index + 1;
                const assignedPlayer = lineupPositions.find(
                  pos => pos.position === position && pos.position_order === positionOrder
                );
                
                console.log(`🔍 Position ${position} #${positionOrder}:`, assignedPlayer ? assignedPlayer.player_name : 'empty');
                
                return (
                  <Box
                    key={`${position}-${index}`}
                    onClick={() => handlePositionClick(position, positionOrder)}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      p: 1,
                      borderRadius: 'md',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        bgcolor: 'background.level1',
                      },
                      '&:active': {
                        transform: 'scale(0.98)',
                      },
                    }}
                  >
                    <Box sx={{ position: 'relative' }}>
                      <Avatar
                        src={assignedPlayer?.player_avatar}
                        size="lg"
                        sx={{
                          width: { xs: 56, sm: 64, md: 72 },
                          height: { xs: 56, sm: 64, md: 72 },
                          bgcolor: assignedPlayer ? 'primary.500' : 'neutral.300',
                          border: '3px solid',
                          borderColor: assignedPlayer ? 'primary.700' : 'neutral.400',
                          opacity: (upsertLineupPosition.isPending || removeLineupPosition.isPending) ? 0.5 : 1,
                        }}
                      >
                        {assignedPlayer ? assignedPlayer.player_name.charAt(0) : '?'}
                      </Avatar>
                      {(upsertLineupPosition.isPending || removeLineupPosition.isPending) && (
                        <CircularProgress
                          size="sm"
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                          }}
                        />
                      )}
                    </Box>
                    <Chip
                      size="sm"
                      variant="solid"
                      color={assignedPlayer ? getLineupTypeColor(activeTab) : 'neutral'}
                      sx={{ 
                        fontWeight: 'bold',
                        fontSize: { xs: '0.65rem', sm: '0.75rem' }
                      }}
                    >
                      {position}
                    </Chip>
                    {assignedPlayer && (
                      <Typography level="body-xs" sx={{ 
                        maxWidth: '100%',
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        fontSize: { xs: '0.65rem', sm: '0.75rem' }
                      }}>
                        {assignedPlayer.player_name.split(' ').pop()}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Auto Lineup Button */}
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Button
              variant="solid"
              color="primary"
              startDecorator="🤖"
              size="sm"
              fullWidth
              onClick={handleAutoLineup}
              loading={autoLineupMutation.isPending}
              disabled={!currentMatchup || !lineupSettings}
            >
              Auto Fill Lineup
            </Button>
          </Box>

          {/* Lineup Summary / Stats Area */}
          <Box sx={{ 
            flex: 1,
            p: 2,
            overflowY: 'auto'
          }}>
            {lineupLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                <Typography level="title-md" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Current Lineup
                </Typography>
                
                {lineupPositions.length === 0 ? (
                  <Typography level="body-sm" color="neutral">
                    Tap a position above to add players to your lineup
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {lineupPositions.map((pos, index) => (
                      <Card key={index} variant="outlined" size="sm">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar
                            src={pos.player_avatar}
                            size="md"
                            sx={{ width: 48, height: 48 }}
                          >
                            {pos.player_name.charAt(0)}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {pos.player_name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {pos.player_team} • {pos.player_position}
                            </Typography>
                          </Box>
                          <Button
                            variant="soft"
                            color="danger"
                            size="sm"
                            onClick={() => handleRemovePlayer(pos.player_id)}
                          >
                            Remove
                          </Button>
                        </Box>
                      </Card>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>

        </CardContent>
      </Card>

      {/* Player Selection Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      >
        <ModalDialog
          sx={{
            maxWidth: 500,
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <ModalClose />
          <Typography level="title-lg" sx={{ mb: 1 }}>
            Select Player for {selectedPosition?.position} Position
          </Typography>
          
          {/* Info message about player assignments */}
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'primary.50', borderRadius: 'sm', border: '1px solid', borderColor: 'primary.200' }}>
            <Typography level="body-xs" color="primary">
              💡 Players with a badge are already in a lineup. Selecting them will move them from their current position.
            </Typography>
          </Box>
          
          {/* Clear Position Option (if position is currently filled) */}
          {selectedPosition && lineupPositions[selectedPosition.positionOrder - 1] && (
            <Box sx={{ mb: 2 }}>
              <Button
                variant="soft"
                color="danger"
                fullWidth
                onClick={handleClearPosition}
                startDecorator="✕"
                loading={removeLineupPosition.isPending}
              >
                Clear This Position
              </Button>
            </Box>
          )}
          
          <Sheet
            sx={{
              flex: 1,
              overflow: 'auto',
              borderRadius: 'sm',
            }}
          >
            {filteredPlayers.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography level="body-sm" color="neutral">
                  No available players for this position
                </Typography>
              </Box>
            ) : (
              <List>
                {filteredPlayers.map((player) => {
                  const isAssigned = !!player.assignmentInfo;
                  return (
                  <ListItem key={player.id}>
                    <ListItemButton
                      onClick={() => handlePlayerSelect(player)}
                      disabled={upsertLineupPosition.isPending}
                      sx={{
                        borderRadius: 'sm',
                        bgcolor: isAssigned ? 'warning.50' : 'transparent',
                        border: isAssigned ? '1px solid' : 'none',
                        borderColor: isAssigned ? 'warning.300' : 'transparent',
                        '&:hover': {
                          bgcolor: isAssigned ? 'warning.100' : 'primary.50',
                        },
                      }}
                    >
                      <ListItemDecorator>
                        <Avatar
                          src={player.avatar}
                          size="md"
                          sx={{ width: 48, height: 48 }}
                        >
                          {player.name.charAt(0)}
                        </Avatar>
                      </ListItemDecorator>
                      <ListItemContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                            {player.name}
                          </Typography>
                          {player.assignmentInfo && (
                            <Chip 
                              size="sm" 
                              variant="solid" 
                              color="warning"
                              sx={{ fontSize: '0.65rem' }}
                            >
                              {player.assignmentInfo}
                            </Chip>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Chip size="sm" variant="soft">
                            {player.team}
                          </Chip>
                          <Typography level="body-xs" color="neutral">
                            {player.originalPosition || player.position}
                          </Typography>
                          {player.jerseyNumber && (
                            <Typography level="body-xs" color="neutral">
                              #{player.jerseyNumber}
                            </Typography>
                          )}
                        </Box>
                      </ListItemContent>
                    </ListItemButton>
                  </ListItem>
                  );
                })}
              </List>
            )}
          </Sheet>
        </ModalDialog>
      </Modal>
    </>
  );
}
