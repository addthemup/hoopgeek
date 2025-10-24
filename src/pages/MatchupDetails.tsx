import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Avatar,
  Button,
  Alert,
  LinearProgress,
  Divider,
} from '@mui/joy';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useMatchupDetails } from '../hooks/useMatchupDetails';
import { useLineupSettings } from '../hooks/useLineupSettings';
import { useMatchupPlayerStats } from '../hooks/useMatchupPlayerStats';
import { getTeamColors } from '../utils/nbaTeamColors';
import { getScoringFormat } from '../utils/fantasyScoring';
import { ArrowBack, EmojiEvents } from '@mui/icons-material';
import PlayerJersey from '../components/PlayerJersey';

interface LineupPlayer {
  player_id: string;
  lineup_type: 'starters' | 'rotation' | 'bench';
  position_x: number;
  position_y: number;
  player_name: string;
  player_team: string;
  player_position: string;
  nba_player_id: number;
  jersey_number?: string;
}

interface PlayerWithStats extends LineupPlayer {
  averagePoints: number;
  multipliedPoints: number;
  gamesPlayed: number;
}

interface MatchupDetailsProps {
  leagueId?: string;
  matchupId?: string;
  onClose?: () => void;
}

export default function MatchupDetails({ 
  leagueId: propLeagueId, 
  matchupId: propMatchupId,
  onClose 
}: MatchupDetailsProps = {}) {
  const params = useParams<{ leagueId: string; matchupId: string }>();
  const navigate = useNavigate();
  
  // Use props first, fallback to URL params
  const leagueId = propLeagueId || params.leagueId;
  const matchupId = propMatchupId || params.matchupId;
  
  // Removed activeTab state - no longer using tabs
  const { data: matchup, isLoading: matchupLoading, error: matchupError } = useMatchupDetails(matchupId || '');
  const { data: lineupSettings } = useLineupSettings(leagueId || '');

  // Get lineup positions for both teams
  const { data: team1Lineup = [], isLoading: team1Loading } = useQuery({
    queryKey: ['team-lineup-positions', matchup?.fantasy_team1_id],
    queryFn: async (): Promise<LineupPlayer[]> => {
      if (!matchup?.fantasy_team1_id || !leagueId) return [];
      
      const { data, error } = await supabase.rpc('get_lineup_positions', {
        p_league_id: leagueId,
        p_fantasy_team_id: matchup.fantasy_team1_id,
        p_lineup_type: null // Get all lineup types
      });

      if (error) {
        console.error('Error fetching team1 lineup:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!matchup?.fantasy_team1_id && !!leagueId,
  });

  const { data: team2Lineup = [], isLoading: team2Loading } = useQuery({
    queryKey: ['team-lineup-positions', matchup?.fantasy_team2_id],
    queryFn: async (): Promise<LineupPlayer[]> => {
      if (!matchup?.fantasy_team2_id || !leagueId) return [];
      
      const { data, error } = await supabase.rpc('get_lineup_positions', {
        p_league_id: leagueId,
        p_fantasy_team_id: matchup.fantasy_team2_id,
        p_lineup_type: null // Get all lineup types
      });

      if (error) {
        console.error('Error fetching team2 lineup:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!matchup?.fantasy_team2_id && !!leagueId,
  });

  // Combine all player IDs and their lineup types for stats fetching
  const allPlayers = [...team1Lineup, ...team2Lineup];
  const playerIds = allPlayers.map(p => p.player_id);
  const lineupTypesMap = allPlayers.reduce((acc, p) => {
    acc[p.player_id] = p.lineup_type;
    return acc;
  }, {} as Record<string, 'starters' | 'rotation' | 'bench'>);

  // Fetch player stats
  const { data: playerStats = {}, isLoading: statsLoading } = useMatchupPlayerStats({
    weekStartDate: matchup?.week_info?.start_date || '',
    weekEndDate: matchup?.week_info?.end_date || '',
    playerIds,
    lineupTypes: lineupTypesMap,
    scoringFormat: lineupSettings?.fantasy_scoring_format || 'FanDuel',
    enabled: !!matchup && allPlayers.length > 0,
  });

  const isLoading = matchupLoading || team1Loading || team2Loading || statsLoading;

  // Debug logging
  console.log('🏀 MatchupDetails Debug:', {
    matchupLoading,
    team1Loading,
    team2Loading,
    statsLoading,
    matchupId,
    leagueId,
    team1LineupCount: team1Lineup.length,
    team2LineupCount: team2Lineup.length,
    team1Lineup,
    team2Lineup,
    playerStats: Object.keys(playerStats).length,
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography level="body-md" sx={{ mt: 2 }}>
          Loading matchup details...
        </Typography>
      </Box>
    );
  }

  if (matchupError || !matchup) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-md">
            Failed to load matchup details. Please try again.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Get multipliers based on lineup type
  const getMultiplier = (lineupType: 'starters' | 'rotation' | 'bench'): number => {
    switch (lineupType) {
      case 'starters': return 1.0;
      case 'rotation': return 0.75;
      case 'bench': return 0.5;
      default: return 1.0;
    }
  };

  // Get scoring format
  const scoringFormat = getScoringFormat(lineupSettings?.fantasy_scoring_format || 'FanDuel');

  // Calculate live team totals from player stats
  const team1Total = team1Lineup.reduce((sum, player) => {
    const stats = playerStats[player.player_id];
    return sum + (stats?.multipliedPoints || 0);
  }, 0);

  const team2Total = team2Lineup.reduce((sum, player) => {
    const stats = playerStats[player.player_id];
    return sum + (stats?.multipliedPoints || 0);
  }, 0);

  // Use live totals if available, otherwise fall back to stored scores
  const team1Score = team1Total > 0 ? team1Total : (matchup.fantasy_team1_score || 0);
  const team2Score = team2Total > 0 ? team2Total : (matchup.fantasy_team2_score || 0);
  const team1IsWinner = team1Score > team2Score;
  const team2IsWinner = team2Score > team1Score;

  const team1Colors = getTeamColors(matchup.team1.team_name);
  const team2Colors = getTeamColors(matchup.team2.team_name);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'live': return 'warning';
      case 'scheduled': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Final';
      case 'live': return 'Live';
      case 'scheduled': return 'Scheduled';
      default: return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Render jersey with NBA team colors
  const renderJersey = (
    player: LineupPlayer,
    isWhiteJersey: boolean,
    multiplier: number,
    stats?: { averagePoints: number; multipliedPoints: number; gamesPlayed: number }
  ) => {
    // Get the player's actual NBA team colors
    const nbaTeamColors = getTeamColors(player.player_team);
    
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {/* Jersey SVG */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: 60, md: 80 },
            height: { xs: 60, md: 80 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'scale(1.1)',
              cursor: 'pointer',
            }
          }}
        >
          {/* SVG Jersey Shape */}
          <svg
            viewBox="0 0 100 100"
            width="100%"
            height="100%"
            style={{ 
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            {/* Main jersey body - white with NBA team trim OR full NBA team color */}
            <path
              d="M 30 15 L 20 25 L 25 35 L 25 85 L 35 95 L 65 95 L 75 85 L 75 35 L 80 25 L 70 15 L 65 20 L 55 15 L 45 15 L 35 20 Z"
              fill={isWhiteJersey ? '#FFFFFF' : nbaTeamColors.primary}
              stroke={nbaTeamColors.secondary}
              strokeWidth={isWhiteJersey ? "3" : "2"}
            />
            
            {/* Sleeves */}
            <path
              d="M 30 15 L 20 25 L 25 35 L 30 30 Z"
              fill={isWhiteJersey ? nbaTeamColors.primary : nbaTeamColors.secondary}
              opacity={isWhiteJersey ? "1" : "0.7"}
            />
            <path
              d="M 70 15 L 80 25 L 75 35 L 70 30 Z"
              fill={isWhiteJersey ? nbaTeamColors.primary : nbaTeamColors.secondary}
              opacity={isWhiteJersey ? "1" : "0.7"}
            />
            
            {/* Neckline */}
            <ellipse
              cx="50"
              cy="18"
              rx="8"
              ry="5"
              fill={isWhiteJersey ? nbaTeamColors.primary : nbaTeamColors.secondary}
            />
            
            {/* Side stripes */}
            <line
              x1="30"
              y1="40"
              x2="30"
              y2="85"
              stroke={isWhiteJersey ? nbaTeamColors.primary : nbaTeamColors.secondary}
              strokeWidth="2"
              opacity="0.8"
            />
            <line
              x1="70"
              y1="40"
              x2="70"
              y2="85"
              stroke={isWhiteJersey ? nbaTeamColors.primary : nbaTeamColors.secondary}
              strokeWidth="2"
              opacity="0.8"
            />
          </svg>

          {/* Jersey Number */}
          <Typography
            sx={{
              position: 'relative',
              zIndex: 10,
              fontSize: { xs: '1.4rem', md: '1.8rem' },
              fontWeight: 'bold',
              color: isWhiteJersey ? nbaTeamColors.primary : '#FFFFFF',
              textShadow: isWhiteJersey 
                ? `1px 1px 2px rgba(0,0,0,0.2)` 
                : `2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px ${nbaTeamColors.secondary}`,
              lineHeight: 1,
              marginTop: '8px',
            }}
          >
            {player.jersey_number || '??'}
          </Typography>
          
          {/* Multiplier Badge */}
          <Box
            sx={{
              position: 'absolute',
              top: -4,
              right: -4,
              bgcolor: multiplier === 1.0 ? 'success.500' : multiplier === 0.75 ? 'warning.500' : 'neutral.400',
              color: 'white',
              borderRadius: '50%',
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: { xs: '0.6rem', md: '0.65rem' },
              fontWeight: 'bold',
              border: '2px solid white',
              zIndex: 20,
            }}
          >
            {multiplier}×
          </Box>
        </Box>

        {/* Player Name */}
        <Typography
          level="body-xs"
          sx={{
            fontWeight: 'bold',
            textAlign: 'center',
            fontSize: { xs: '0.65rem', md: '0.75rem' },
            color: '#000',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
          }}
        >
          {player.player_name.split(' ').pop()}
        </Typography>
        
        {/* Fantasy Points */}
        {stats && stats.gamesPlayed > 0 && (
          <Chip
            size="sm"
            variant="solid"
            color="success"
            sx={{ 
              fontSize: { xs: '0.6rem', md: '0.7rem' },
              fontWeight: 'bold',
            }}
          >
            {stats.multipliedPoints.toFixed(1)}
          </Chip>
        )}
      </Box>
    );
  };

  // Helper function to get court position based on player position
  const getCourtPosition = (
    position: string, 
    isTeam1: boolean, // true = offensive (white jerseys), false = defensive (colored)
    index: number
  ): { x: number; y: number } => {
    const pos = position.toUpperCase();
    
    // Team 1 (white) positions on left side, Team 2 (colored) on right side
    // Offensive vs defensive positioning
    
    // Guards
    if (pos.includes('G') || pos === 'PG' || pos === 'SG') {
      if (isTeam1) {
        // Offensive guards - near half court
        return index === 0 
          ? { x: 35, y: 75 }  // Point guard - top of key
          : { x: 15, y: 65 };  // Shooting guard - wing
      } else {
        // Defensive guards - guarding
        return index === 0
          ? { x: 38, y: 72 }  // Guarding point
          : { x: 18, y: 68 };  // Guarding wing
      }
    }
    
    // Forwards
    if (pos.includes('F') || pos === 'SF' || pos === 'PF') {
      if (isTeam1) {
        // Offensive forwards
        return index === 0
          ? { x: 65, y: 65 }  // Small forward - opposite wing
          : { x: 30, y: 45 };  // Power forward - block
      } else {
        // Defensive forwards - guarding
        return index === 0
          ? { x: 62, y: 68 }  // Guarding wing
          : { x: 33, y: 48 };  // Guarding block
      }
    }
    
    // Centers
    if (pos === 'C') {
      if (isTeam1) {
        return { x: 60, y: 45 };  // Offensive center - low post
      } else {
        return { x: 57, y: 48 };  // Defensive center - defending
      }
    }
    
    // Default fallback
    return isTeam1 ? { x: 40, y: 60 } : { x: 43, y: 63 };
  };

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(`/league/${leagueId}`);
    }
  };

  return (
    <Box sx={{ p: { xs: 0, md: 0 } }}>
      {/* Back Button - only show if not in modal */}
      {!onClose && (
        <Button
          variant="plain"
          startDecorator={<ArrowBack />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Back to League
        </Button>
      )}

      {/* Header */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            {/* Team 1 */}
            <Grid xs={12} md={5}>
              <Stack spacing={1}>
                <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                  {matchup.team1.team_name}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  {matchup.team1.wins}-{matchup.team1.losses}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    level="h1"
                    sx={{ fontWeight: 'bold', color: team1IsWinner ? 'success.500' : 'neutral' }}
                  >
                    {team1Score.toFixed(1)}
                  </Typography>
                  {team1IsWinner && matchup.status === 'completed' && (
                    <EmojiEvents sx={{ fontSize: 40, color: 'success.500' }} />
                  )}
                </Stack>
              </Stack>
            </Grid>

            {/* VS Section */}
            <Grid xs={12} md={2}>
              <Box sx={{ textAlign: 'center' }}>
                <Chip color={getStatusColor(matchup.status)} variant="soft" size="sm" sx={{ mb: 1 }}>
                  {getStatusText(matchup.status)}
                </Chip>
                <Typography level="h2" sx={{ fontWeight: 'bold', color: 'neutral.500' }}>
                  VS
                </Typography>
                <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                  {matchup.week_info.week_name}
                </Typography>
                <Typography level="body-xs" color="neutral">
                  {formatDate(matchup.week_info.start_date)} - {formatDate(matchup.week_info.end_date)}
                </Typography>
              </Box>
            </Grid>

            {/* Team 2 */}
            <Grid xs={12} md={5}>
              <Stack spacing={1} sx={{ textAlign: 'right' }}>
                <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                  {matchup.team2.team_name}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  {matchup.team2.wins}-{matchup.team2.losses}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ justifyContent: 'flex-end' }}>
                  {team2IsWinner && matchup.status === 'completed' && (
                    <EmojiEvents sx={{ fontSize: 40, color: 'success.500' }} />
                  )}
                  <Typography
                    level="h1"
                    sx={{ fontWeight: 'bold', color: team2IsWinner ? 'success.500' : 'neutral' }}
                  >
                    {team2Score.toFixed(1)}
                  </Typography>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>


      {/* Basketball Court View with Positioned Jerseys */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          {/* Header with Team Names */}
          <Stack direction="row" spacing={2} sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 12, height: 12, bgcolor: '#FFFFFF', border: `3px solid ${team1Colors.primary}`, borderRadius: '50%' }} />
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                {matchup.team1.team_name}
              </Typography>
            </Stack>

            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
              Matchup
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                {matchup.team2.team_name}
              </Typography>
              <Box sx={{ width: 12, height: 12, bgcolor: team2Colors.primary, borderRadius: '50%' }} />
            </Stack>
          </Stack>

          {/* Court Container */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: { xs: '70vh', md: '80vh' },
              minHeight: { xs: '500px', md: '700px' },
              overflow: 'hidden',
              bgcolor: '#eac696',
              borderRadius: 'md',
            }}
          >
            {/* SVG Basketball Court */}
            <svg 
              viewBox="0 0 940 500" 
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            >
              {/* whole court rectangle */}
              <rect width="100%" height="100%" fill="#eac696" stroke="#5d5c63" strokeWidth="2" />
              
              {/* half court line and circle */}
              <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#5d5c63" strokeWidth="1" />
              <circle cx="50%" cy="50%" r="12%" fill="none" stroke="#5d5c63" strokeWidth="1" />
              
              {/* 3-point arc (left) */}
              <line x1="0%" y1="6%" x2="14.89%" y2="6%" stroke="#5d5c63" strokeWidth="1" />
              <line x1="0%" y1="94%" x2="14.89%" y2="94%" stroke="#5d5c63" strokeWidth="1" />  
              <path d="M 138.97 470.2 A 237.5 237.5 0 0 0 138.97 29.79" fill="none" stroke="#5d5c63" strokeWidth="1.1" />
              
              {/* shaded area (left) */}
              <rect y="170" width="190" height="160" fill="#116cb6" stroke="#fff" strokeWidth="1" />
              
              {/* board and rim (left) */}
              <line x1="40" y1="220" x2="40" y2="280" stroke="#b37336" strokeWidth="1" />
              <circle cx="55" cy="250" r="15" fill="none" stroke="#b37336" strokeWidth="1" />    
              
              {/* restricted area (left) */}
              <path d="M 55 290 A 40 40 0 0 0 55 210" fill="none" stroke="#fff" strokeWidth="1" />
              
              {/* free throw circle (left) */}
              <path d="M 190 190 A 60 60 0 0 0 190 310" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="10,10" />
              <path d="M 190 310 A 60 60 0 0 0 190 190" fill="none" stroke="#fff" strokeWidth="1" />
              
              {/* 3-point arc (right) */}
              <line x1="85.11%" y1="6%" x2="100%" y2="6%" stroke="#5d5c63" strokeWidth="1" />
              <line x1="85.11%" y1="94%" x2="100%" y2="94%" stroke="#5d5c63" strokeWidth="1" />  
              <path d="M 801.03 29.79 A 237.5 237.5 0 0 0 801.03 470.21" fill="none" stroke="#5d5c63" strokeWidth="1.1" />
              
              {/* shaded area (right) */}
              <rect x="750" y="170" width="190" height="160" fill="#116cb6" stroke="#fff" strokeWidth="1" />
              
              {/* board and rim (right) */}
              <line x1="900" y1="220" x2="900" y2="280" stroke="#b37336" strokeWidth="1" />
              <circle cx="885" cy="250" r="15" fill="none" stroke="#b37336" strokeWidth="1" />
              
              {/* restricted area (right) */}
              <path d="M 885 210 A 40 40 0 0 0 885 290" fill="none" stroke="#fff" strokeWidth="1" />
              
              {/* free throw circle (right) */}
              <path d="M 750 310 A 60 60 0 0 0 750 190" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="10,10" />
              <path d="M 750 190 A 60 60 0 0 0 750 310" fill="none" stroke="#fff" strokeWidth="1" />  
            </svg>

            {/* Players Positioned on Court - STARTERS ONLY */}
            {(() => {
              const startersMultiplier = getMultiplier('starters');
              const team1Starters = team1Lineup.filter(p => p.lineup_type === 'starters');
              const team2Starters = team2Lineup.filter(p => p.lineup_type === 'starters');

              // Group starters by position type
              const team1Guards = team1Starters.filter(p => p.player_position.includes('G'));
              const team1Forwards = team1Starters.filter(p => p.player_position.includes('F'));
              const team1Centers = team1Starters.filter(p => p.player_position === 'C');

              const team2Guards = team2Starters.filter(p => p.player_position.includes('G'));
              const team2Forwards = team2Starters.filter(p => p.player_position.includes('F'));
              const team2Centers = team2Starters.filter(p => p.player_position === 'C');

              const allStarters = [
                ...team1Guards.map((p, i) => ({ player: p, isTeam1: true, position: getCourtPosition(p.player_position, true, i) })),
                ...team1Forwards.map((p, i) => ({ player: p, isTeam1: true, position: getCourtPosition(p.player_position, true, i) })),
                ...team1Centers.map((p, i) => ({ player: p, isTeam1: true, position: getCourtPosition(p.player_position, true, i) })),
                ...team2Guards.map((p, i) => ({ player: p, isTeam1: false, position: getCourtPosition(p.player_position, false, i) })),
                ...team2Forwards.map((p, i) => ({ player: p, isTeam1: false, position: getCourtPosition(p.player_position, false, i) })),
                ...team2Centers.map((p, i) => ({ player: p, isTeam1: false, position: getCourtPosition(p.player_position, false, i) })),
              ];

              return allStarters.map((item, index) => {
                const { player, isTeam1, position } = item;

                return (
                  <Box
                    key={`${player.player_id}-${index}`}
                    sx={{
                      position: 'absolute',
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 10,
                    }}
                  >
                    {renderJersey(
                      player,
                      isTeam1, // Team 1 = white jerseys, Team 2 = colored
                      startersMultiplier,
                      playerStats[player.player_id]
                    )}
                  </Box>
                );
              });
            })()}
          </Box>

          {/* Rotation and Bench Players - Side by Side Grid */}
          <Grid container spacing={2} sx={{ mt: 3 }}>
            {/* Rotation Players */}
            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="sm" color="warning">0.75×</Chip>
                    Rotation
                  </Typography>
                  
                  {/* Team 1 Rotation */}
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {matchup.team1.team_name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                    {team1Lineup.filter(p => p.lineup_type === 'rotation').map((player, index) => (
                      <Box key={`team1-rot-${player.player_id}`}>
                        {renderJersey(
                          player,
                          true, // White jerseys
                          getMultiplier('rotation'),
                          playerStats[player.player_id]
                        )}
                      </Box>
                    ))}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Team 2 Rotation */}
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {matchup.team2.team_name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {team2Lineup.filter(p => p.lineup_type === 'rotation').map((player, index) => (
                      <Box key={`team2-rot-${player.player_id}`}>
                        {renderJersey(
                          player,
                          false, // Colored jerseys
                          getMultiplier('rotation'),
                          playerStats[player.player_id]
                        )}
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Bench Players */}
            <Grid xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="title-md" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size="sm" color="neutral">0.5×</Chip>
                    Bench
                  </Typography>
                  
                  {/* Team 1 Bench */}
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {matchup.team1.team_name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                    {team1Lineup.filter(p => p.lineup_type === 'bench').map((player, index) => (
                      <Box key={`team1-bench-${player.player_id}`}>
                        {renderJersey(
                          player,
                          true, // White jerseys
                          getMultiplier('bench'),
                          playerStats[player.player_id]
                        )}
                      </Box>
                    ))}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Team 2 Bench */}
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {matchup.team2.team_name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {team2Lineup.filter(p => p.lineup_type === 'bench').map((player, index) => (
                      <Box key={`team2-bench-${player.player_id}`}>
                        {renderJersey(
                          player,
                          false, // Colored jerseys
                          getMultiplier('bench'),
                          playerStats[player.player_id]
                        )}
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Team Totals Summary */}
      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Typography level="h4" sx={{ mb: 2, textAlign: 'center' }}>
            Team Totals
          </Typography>
          <Grid container spacing={3}>
            {/* Team 1 Total */}
            <Grid xs={12} md={6}>
              <Card variant="soft" color={team1IsWinner ? 'success' : 'neutral'}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography level="title-lg" sx={{ fontWeight: 'bold', color: team1Colors.primary }}>
                      {matchup.team1.team_name}
                    </Typography>
                    <Divider />
                    {['starters', 'rotation', 'bench'].map((unitType) => {
                      const typedUnit = unitType as 'starters' | 'rotation' | 'bench';
                      const unitPlayers = team1Lineup.filter(p => p.lineup_type === typedUnit);
                      const unitTotal = unitPlayers.reduce((sum, player) => {
                        const stats = playerStats[player.player_id];
                        return sum + (stats?.multipliedPoints || 0);
                      }, 0);
                      const multiplier = getMultiplier(typedUnit);
                      
                      return (
                        <Box key={unitType}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip 
                                size="sm" 
                                color={multiplier === 1.0 ? 'success' : multiplier === 0.75 ? 'warning' : 'neutral'}
                              >
                                {multiplier}×
                              </Chip>
                              <Typography level="body-sm" sx={{ textTransform: 'capitalize' }}>
                                {unitType} ({unitPlayers.length})
                              </Typography>
                            </Stack>
                            <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                              {unitTotal.toFixed(1)}
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                        Total Score
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 'bold', color: team1IsWinner ? 'success.500' : 'neutral' }}>
                        {team1Score.toFixed(1)}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Team 2 Total */}
            <Grid xs={12} md={6}>
              <Card variant="soft" color={team2IsWinner ? 'success' : 'neutral'}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography level="title-lg" sx={{ fontWeight: 'bold', color: team2Colors.primary }}>
                      {matchup.team2.team_name}
                    </Typography>
                    <Divider />
                    {['starters', 'rotation', 'bench'].map((unitType) => {
                      const typedUnit = unitType as 'starters' | 'rotation' | 'bench';
                      const unitPlayers = team2Lineup.filter(p => p.lineup_type === typedUnit);
                      const unitTotal = unitPlayers.reduce((sum, player) => {
                        const stats = playerStats[player.player_id];
                        return sum + (stats?.multipliedPoints || 0);
                      }, 0);
                      const multiplier = getMultiplier(typedUnit);
                      
                      return (
                        <Box key={unitType}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip 
                                size="sm" 
                                color={multiplier === 1.0 ? 'success' : multiplier === 0.75 ? 'warning' : 'neutral'}
                              >
                                {multiplier}×
                              </Chip>
                              <Typography level="body-sm" sx={{ textTransform: 'capitalize' }}>
                                {unitType} ({unitPlayers.length})
                              </Typography>
                            </Stack>
                            <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                              {unitTotal.toFixed(1)}
                            </Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                        Total Score
                      </Typography>
                      <Typography level="h4" sx={{ fontWeight: 'bold', color: team2IsWinner ? 'success.500' : 'neutral' }}>
                        {team2Score.toFixed(1)}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
