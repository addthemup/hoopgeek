import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Avatar,
  Stack,
  Chip,
  Grid,
  Alert,
  Divider,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeagues';
import { useTeams } from '../hooks/useTeams';
import { useUserTeamRoster } from '../hooks/useUserTeamRoster';
import { useTeamDraftedPlayers } from '../hooks/useTeamDraftData';
import { useTeamSchedule } from '../hooks/useTeamSchedule';
import TeamSchedule from '../components/TeamSchedule';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayerDetail from '../components/PlayerDetail';

interface Player {
  id: string;
  name: string;
  team: string;
  pos: string;
  salary: number;
  contractYears: number;
  avatar: string;
}

export default function TeamPage() {
  const { id: leagueId, teamId } = useParams<{ id: string; teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Debug logging
  console.log('TeamPage Debug Info:', {
    leagueId,
    teamId,
    user,
    url: window.location.href
  });
  
  const { data: league, isLoading: leagueLoading, error: leagueError } = useLeague(leagueId || '');
  const { data: teams, isLoading: teamsLoading } = useTeams(leagueId || '');
  const { data: userTeamRoster, isLoading: rosterLoading } = useUserTeamRoster(leagueId || '');
  const { data: teamRoster } = useTeamDraftedPlayers(leagueId || '', teamId || '');
  const { data: teamSchedule } = useTeamSchedule(teamId || '');
  
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Find the current team
  const currentTeam = teams?.find(team => team.id === teamId);
  const userTeam = teams?.find(team => team.user_id === user?.id);
  const isUserTeam = currentTeam?.id === userTeam?.id;

  // Transform roster data to Player interface
  const transformRosterToPlayers = (rosterData: any[]): Player[] => {
    return rosterData.map(player => ({
      id: player.id.toString(),
      name: player.name,
      team: player.team_abbreviation,
      pos: player.position,
      salary: 0, // TODO: Get real salary data
      contractYears: 1, // TODO: Get real contract data
      avatar: `https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`,
    }));
  };

  // Get the appropriate roster data
  const teamPlayers = isUserTeam ? userTeamRoster : teamRoster;
  const players = teamPlayers ? transformRosterToPlayers(teamPlayers) : [];

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
  };

  const handleBackToTeam = () => {
    setSelectedPlayer(null);
  };

  const handleProposeTrade = () => {
    navigate(`/league/${leagueId}/trade?team=${teamId}`);
  };

  const handleBackToLeague = () => {
    navigate(`/league/${leagueId}`);
  };

  // Loading states
  if (leagueLoading || teamsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Typography>Loading team data...</Typography>
      </Box>
    );
  }

  // Error states
  if (leagueError) {
    console.error('League loading error:', leagueError);
    return (
      <Alert color="danger">
        <Typography>Error loading league: {leagueError.message}</Typography>
        <Typography level="body-sm" sx={{ mt: 1 }}>
          League ID: {leagueId}
        </Typography>
      </Alert>
    );
  }

  if (!league && !leagueLoading) {
    console.error('League not found:', { leagueId, league, leagueLoading, leagueError });
    return (
      <Alert color="warning">
        <Typography>League not found.</Typography>
        <Typography level="body-sm" sx={{ mt: 1 }}>
          League ID: {leagueId}
        </Typography>
      </Alert>
    );
  }

  if (!currentTeam) {
    return (
      <Alert color="warning">
        <Typography>Team not found.</Typography>
      </Alert>
    );
  }

  // Show player detail if a player is selected
  if (selectedPlayer) {
    return (
      <PlayerDetail 
        playerId={selectedPlayer.id}
        playerName={selectedPlayer.name}
        onBack={handleBackToTeam}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Button
            variant="outlined"
            startDecorator={<ArrowBackIcon />}
            onClick={handleBackToLeague}
          >
            Back to League
          </Button>
          {!isUserTeam && (
            <Button
              variant="solid"
              color="primary"
              startDecorator={<SwapHorizIcon />}
              onClick={handleProposeTrade}
            >
              Propose Trade
            </Button>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Avatar
            size="lg"
            sx={{ 
              bgcolor: 'primary.500',
              fontSize: '1.5rem',
              fontWeight: 'bold'
            }}
          >
            {currentTeam.team_name.charAt(0)}
          </Avatar>
          <Box>
            <Typography level="h2" sx={{ fontWeight: 'bold', mb: 1 }}>
              {currentTeam.team_name}
            </Typography>
            <Typography level="body-md" color="neutral">
              {isUserTeam ? 'Your Team' : `Owner: ${currentTeam.user_id ? 'Unknown' : 'Empty Team'}`}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Team Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="body-sm" color="neutral">
                Record
              </Typography>
              <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                {currentTeam.wins}-{currentTeam.losses}-{currentTeam.ties}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="body-sm" color="neutral">
                Points For
              </Typography>
              <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                {currentTeam.points_for || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="body-sm" color="neutral">
                Points Against
              </Typography>
              <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                {currentTeam.points_against || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="body-sm" color="neutral">
                Salary Cap Used
              </Typography>
              <Typography level="h3" sx={{ fontWeight: 'bold' }}>
                ${((currentTeam.salary_cap_used || 0) / 1000000).toFixed(1)}M
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Roster Section */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
            Roster ({players.length} players)
          </Typography>
          
          {players.length === 0 ? (
            <Alert color="neutral">
              <Typography>
                {isUserTeam ? 'No players on your roster yet. Complete the draft to build your team!' : 'This team has no players yet.'}
              </Typography>
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {players.map((player) => (
                <Grid xs={12} sm={6} md={4} lg={3} key={player.id}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { 
                        bgcolor: 'background.level1',
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s ease-in-out'
                      }
                    }}
                    onClick={() => handlePlayerClick(player)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          src={player.avatar}
                          alt={player.name}
                          size="md"
                        />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography level="title-sm" sx={{ fontWeight: 'bold' }}>
                            {player.name}
                          </Typography>
                          <Typography level="body-sm" color="neutral">
                            {player.pos} • {player.team}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            ${(player.salary / 1000000).toFixed(1)}M • {player.contractYears}y
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Team Schedule */}
      {teamSchedule && teamSchedule.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
              Schedule
            </Typography>
            <TeamSchedule teamId={teamId || ''} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}