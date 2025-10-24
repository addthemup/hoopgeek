import { useState, useEffect, useMemo } from 'react';
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
import { useMatchups, Matchup } from '../hooks/useMatchups';
import { useWeekDates } from '../hooks/usePlayerWeekGames';
import { usePlayerGameLogs } from '../hooks/usePlayerGameLogs';
import { useLineupSettings } from '../hooks/useLineupSettings';
import { useAutoLineup } from '../hooks/useAutoLineup';
import { useLineupSalary, formatSalary } from '../hooks/useLineupSalaryCap';
import BasketballCourt from '../components/BasketballCourt';
import { getScoringFormat, calculateFantasyPoints } from '../utils/fantasyScoring';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';

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
  const queryClient = useQueryClient();
  
  // State
  const [currentWeek, setCurrentWeek] = useState(1);

  // Get user's team data early for salary calculations
  const userTeam = teams?.find(team => team.user_id === user?.id);
  
  // Find current week matchup (need this early for week number)
  const { data: currentWeekMatchups } = useMatchups(leagueId, currentWeek);
  const currentMatchup = currentWeekMatchups?.find(matchup => 
    matchup.fantasy_team1_id === userTeam?.id || matchup.fantasy_team2_id === userTeam?.id
  );
  
  // Always use currentWeek for salary calculations (works for preseason and regular season)
  const actualWeekNumber = currentWeek;
  
  console.log('💰 Lineups: Week number for salary calc:', {
    currentWeek,
    matchupWeek: currentMatchup?.week_number,
    actualWeekNumber
  });
  
  // Get lineup salary data - use actualWeekNumber to ensure consistency
  const { data: lineupSalaryData, isLoading: salaryLoading } = useLineupSalary(
    leagueId,
    userTeam?.id || '',
    actualWeekNumber,
    2025
  );

  const totalWeeks = 26;

  // Get the league's scoring format
  const leagueScoringFormat = lineupSettings?.fantasy_scoring_format || 'FanDuel';
  const selectedScoringFormat = getScoringFormat(leagueScoringFormat);
  
  // Get week dates for the schedule header
  const { data: weekDates, isLoading: datesLoading } = useWeekDates(currentWeek);

  // Update current week when fantasy week loads
  useEffect(() => {
    if (fantasyWeek) {
        setCurrentWeek(fantasyWeek.week_number);
    } else {
      // Default to week 1 instead of 0 to match typical matchup structure
      setCurrentWeek(1);
    }
  }, [fantasyWeek]);
  
  // Get opponent team
  const opponentTeam = currentMatchup ? (
    currentMatchup.fantasy_team1_id === userTeam?.id ? currentMatchup.team2 : currentMatchup.team1
  ) : null;

  // Auto-lineup mutation
  const autoLineupMutation = useAutoLineup();

  // Clear lineup mutation
  const clearLineupMutation = useMutation({
    mutationFn: async () => {
      const weekNumber = actualWeekNumber;
      const seasonYearValue = 2025;
      
      console.log('🧹 Clearing all lineup positions for week:', weekNumber, 'season:', seasonYearValue);
      
      const { error } = await supabase
        .from('fantasy_lineups')
        .delete()
        .eq('league_id', leagueId)
        .eq('fantasy_team_id', userTeam?.id || '')
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
      queryClient.invalidateQueries({ queryKey: ['lineup-positions', leagueId, userTeam?.id] });
      // Also invalidate salary query
      queryClient.invalidateQueries({ 
        queryKey: ['lineup-salary'],
        predicate: (query) => {
          const [key, lid, tid] = query.queryKey as [string, string, string];
          return key === 'lineup-salary' && lid === leagueId && tid === userTeam?.id;
        }
      });
    },
    onError: (error) => {
      console.error('❌ Clear lineup failed:', error);
    }
  });

  // Handle auto-lineup
  const handleAutoLineup = async () => {
    if (!currentMatchup || !lineupSettings || !userTeam) {
      console.error('❌ Missing required data for auto-lineup');
      return;
    }

    const weekNumber = actualWeekNumber;
    const seasonYearValue = 2025;
    const seasonId = currentMatchup.season_id;
    const matchupId = currentMatchup.id;

    try {
      await autoLineupMutation.mutateAsync({
        leagueId,
        teamId: userTeam.id,
        weekNumber,
        seasonYear: seasonYearValue,
        seasonId,
        matchupId
      });
      
      // Invalidate salary query after auto-lineup
      queryClient.invalidateQueries({ 
        queryKey: ['lineup-salary'],
        predicate: (query) => {
          const [key, lid, tid] = query.queryKey as [string, string, string];
          return key === 'lineup-salary' && lid === leagueId && tid === userTeam.id;
        }
      });
    } catch (error) {
      console.error('❌ Auto-lineup failed:', error);
    }
  };

  // Handle clear lineup
  const handleClearLineup = async () => {
    if (!currentMatchup || !userTeam) {
      console.error('❌ Missing required data for clear lineup');
      return;
    }

    try {
      await clearLineupMutation.mutateAsync();
    } catch (error) {
      console.error('❌ Clear lineup failed:', error);
    }
  };
  
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



  // Debug logging
  console.log('🔍 Lineups Debug Info:');
  console.log('  Current week:', currentWeek);
  console.log('  Week dates:', weekDates);
  console.log('  Available players:', availablePlayers.map(p => `${p.name} (${p.team}) - NBA ID: ${p.nbaPlayerId}`));
  console.log('  Week loading:', weekLoading);
  console.log('  Dates loading:', datesLoading);

  // Loading states
  if (isLoading || weekLoading || rosterLoading || datesLoading) {
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

        {/* Right: Salary Cap & Scoring Format */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Salary Cap Display */}
          {lineupSalaryData && (
            <Chip 
              variant="soft" 
              color={lineupSalaryData.isOverCap ? 'danger' : lineupSalaryData.percentUsed > 90 ? 'warning' : 'success'} 
              size="sm" 
              sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}
            >
              💰 {formatSalary(lineupSalaryData.totalSalary)} / {formatSalary(lineupSalaryData.salaryCap)}
            </Chip>
          )}
          
          {/* Scoring Format */}
          <Chip variant="soft" color="primary" size="sm" sx={{ fontSize: '0.7rem' }}>
            {selectedScoringFormat.name}
          </Chip>
        </Box>
      </Box>

      {/* Lineup Action Buttons */}
      <Box sx={{ 
        display: 'flex', 
        gap: 1, 
        mb: 2,
        justifyContent: 'flex-start',
        flexWrap: 'wrap'
      }}>
        <Button
          variant="solid"
          color="primary"
          size="sm"
          startDecorator="🤖"
          onClick={handleAutoLineup}
          loading={autoLineupMutation.isPending}
          disabled={!currentMatchup || !lineupSettings || !userTeam}
        >
          Auto Fill Lineup
        </Button>
        <Button
          variant="outlined"
          color="danger"
          size="sm"
          startDecorator="🗑️"
          onClick={handleClearLineup}
          loading={clearLineupMutation.isPending}
          disabled={!currentMatchup || !userTeam}
        >
          Clear Lineup
        </Button>
      </Box>

      {/* Basketball Court Component */}
      <BasketballCourt
        leagueId={leagueId}
        teamId={userTeam.id}
        availablePlayers={availablePlayers}
        currentWeek={currentWeek}
        currentMatchup={currentMatchup}
        seasonYear={2025}
        weekDates={weekDates}
        selectedScoringFormat={selectedScoringFormat}
        lineupSalaryData={lineupSalaryData}
      />
    </Box>
  );
}

