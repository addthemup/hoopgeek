import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  Avatar,
  Chip,
  Stack,
  Alert,
  LinearProgress,
  Button,
} from '@mui/joy';
import { useTeamSchedule, TeamMatchup } from '../hooks/useTeamSchedule';

interface TeamScheduleProps {
  teamId: string;
}

const TeamSchedule: React.FC<TeamScheduleProps> = ({ teamId }) => {
  const { data: schedule, isLoading, error } = useTeamSchedule(teamId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'live':
        return 'danger';
      case 'scheduled':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Final';
      case 'live':
        return 'Live';
      case 'scheduled':
        return 'Scheduled';
      default:
        return 'Unknown';
    }
  };

  const getMatchupTypeColor = (type: string, isDivision: boolean, isPreseason: boolean) => {
    if (isPreseason) return 'warning';
    if (isDivision) return 'primary';
    switch (type) {
      case 'playoff':
        return 'warning';
      case 'championship':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getMatchupTypeText = (type: string, isDivision: boolean, isPreseason: boolean) => {
    if (isPreseason) return 'Preseason (Practice)';
    if (isDivision) return 'Division Game';
    switch (type) {
      case 'playoff':
        return 'Playoff Game';
      case 'championship':
        return 'Championship';
      default:
        return 'Regular Season';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatWeekRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr}-${endStr}`;
  };

  const getResultColor = (teamScore: number, opponentScore: number, status: string) => {
    if (status !== 'completed') return 'neutral';
    return teamScore > opponentScore ? 'success' : 'danger';
  };

  const getResultText = (teamScore: number, opponentScore: number, status: string) => {
    if (status === 'scheduled') return '';
    if (status === 'live') return 'Live';
    if (status === 'completed') {
      return teamScore > opponentScore ? 'W' : 'L';
    }
    return '';
  };

  const getScoreText = (teamScore: number, opponentScore: number, status: string) => {
    if (status === 'scheduled') return '';
    return `${teamScore.toFixed(1)}-${opponentScore.toFixed(1)}`;
  };

  if (isLoading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <LinearProgress />
            <Typography level="body-sm" sx={{ mt: 1 }}>
              Loading team schedule...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Alert color="danger">
            <Typography level="body-sm">
              Error loading team schedule: {error.message}
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!schedule || schedule.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography level="body-md" color="neutral">
              No schedule data available.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h6" sx={{ fontWeight: 'bold' }}>
            Team Schedule
          </Typography>
          <Button size="sm" variant="outlined">
            View Full Schedule
          </Button>
        </Box>

        <Box sx={{ overflowX: 'auto' }}>
          <Table hoverRow size="sm">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Week</th>
                <th style={{ width: '120px' }}>Date Range</th>
                <th style={{ width: '200px' }}>Opponent</th>
                <th style={{ width: '100px' }}>Type</th>
                <th style={{ width: '100px' }}>Result</th>
                <th style={{ width: '80px' }}>Score</th>
                <th style={{ width: '60px' }}>Status</th>
                <th style={{ width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((matchup) => (
                <tr key={matchup.id}>
                  <td>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {matchup.week}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-xs" color="neutral">
                      {formatWeekRange(matchup.start_date, matchup.end_date)}
                    </Typography>
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar 
                        size="sm" 
                        sx={{ 
                          bgcolor: 'primary.500',
                          width: 24,
                          height: 24,
                          fontSize: '0.7rem'
                        }}
                      >
                        {matchup.opponent.team_name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {matchup.is_home ? 'vs' : '@'} {matchup.opponent.team_name}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          ({matchup.opponent.wins}-{matchup.opponent.losses})
                        </Typography>
                      </Box>
                    </Box>
                  </td>
                  <td>
                    <Chip 
                      size="sm" 
                      color={getMatchupTypeColor(matchup.matchup_type, matchup.division_game, matchup.is_preseason || false)}
                      variant="soft"
                    >
                      {getMatchupTypeText(matchup.matchup_type, matchup.division_game, matchup.is_preseason || false)}
                    </Chip>
                  </td>
                  <td>
                    {matchup.status === 'completed' && (
                      <Chip 
                        size="sm" 
                        color={getResultColor(matchup.team_score, matchup.opponent_score, matchup.status)}
                        variant="soft"
                      >
                        {getResultText(matchup.team_score, matchup.opponent_score, matchup.status)}
                      </Chip>
                    )}
                  </td>
                  <td>
                    <Typography 
                      level="body-sm" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: getResultColor(matchup.team_score, matchup.opponent_score, matchup.status) === 'success' ? 'success.500' :
                               getResultColor(matchup.team_score, matchup.opponent_score, matchup.status) === 'danger' ? 'danger.500' : 'neutral.500'
                      }}
                    >
                      {getScoreText(matchup.team_score, matchup.opponent_score, matchup.status)}
                    </Typography>
                  </td>
                  <td>
                    <Chip 
                      size="sm" 
                      color={getStatusColor(matchup.status)}
                      variant="outlined"
                    >
                      {getStatusText(matchup.status)}
                    </Chip>
                  </td>
                  <td>
                    <Button 
                      size="sm" 
                      variant="outlined"
                      disabled={matchup.status === 'scheduled'}
                    >
                      {matchup.status === 'scheduled' ? 'Box' : 
                       matchup.status === 'live' ? 'Live!' : 'Box'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TeamSchedule;
