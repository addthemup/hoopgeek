import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Select,
  Option,
  Stack,
  Button,
  Alert,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeagues';
import { useTeams } from '../hooks/useTeams';
import { useDivisions } from '../hooks/useDivisions';
import { useNavigate } from 'react-router-dom';
import { FantasyTeam as DatabaseTeam } from '../types';

interface Team {
  id: string;
  name: string;
  owner: string;
  logo: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  division: string;
  divisionRecord: string;
  homeRecord: string;
  awayRecord: string;
  streak: string;
  moves: number;
  playoffPercent: number;
  gamesBack: string;
  isUserTeam?: boolean;
}

interface StandingsProps {
  leagueId: string;
}

export default function Standings({ leagueId }: StandingsProps) {
  const { user } = useAuth();
  const { data: league, isLoading: leagueLoading, error: leagueError } = useLeague(leagueId);
  const { data: teams, isLoading: teamsLoading, error: teamsError } = useTeams(leagueId);
  const { data: divisions = [], isLoading: divisionsLoading } = useDivisions(leagueId);
  const navigate = useNavigate();
  
  const [selectedSeason, setSelectedSeason] = useState('2025');

  // Transform database teams to display format
  const transformTeam = (dbTeam: DatabaseTeam): Team => {
    const winPercentage = dbTeam.wins + dbTeam.losses > 0 
      ? (dbTeam.wins / (dbTeam.wins + dbTeam.losses)) * 100 
      : 0;
    
    // Find the division name for this team
    const teamDivision = divisions.find(div => div.id === dbTeam.division_id);
    const divisionName = teamDivision ? teamDivision.name : 'Unassigned';
    
    return {
      id: dbTeam.id,
      name: dbTeam.team_name,
      owner: dbTeam.user_id ? 'Owner Assigned' : 'TBD',
      logo: `https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg`, // Default logo
      wins: dbTeam.wins,
      losses: dbTeam.losses,
      ties: dbTeam.ties,
      pointsFor: dbTeam.points_for,
      pointsAgainst: dbTeam.points_against,
      division: divisionName,
      divisionRecord: `${dbTeam.wins}-${dbTeam.losses}`,
      homeRecord: `${Math.floor(dbTeam.wins * 0.6)}-${Math.floor(dbTeam.losses * 0.4)}`,
      awayRecord: `${Math.floor(dbTeam.wins * 0.4)}-${Math.floor(dbTeam.losses * 0.6)}`,
      streak: dbTeam.wins > dbTeam.losses ? 'W2' : dbTeam.losses > dbTeam.wins ? 'L1' : '--',
      moves: Math.floor(Math.random() * 20) + 5, // Mock moves for now
      playoffPercent: winPercentage > 60 ? 85.2 : winPercentage > 50 ? 65.1 : 25.3,
      gamesBack: dbTeam.draft_position === 1 ? '--' : `${dbTeam.draft_position - 1}.0`,
      isUserTeam: dbTeam.user_id === user?.id,
    };
  };

  const displayTeams = teams ? teams.map(transformTeam) : [];
  
  // Get unique division names from the transformed teams, sorted by division order
  const divisionNames = [...new Set(displayTeams.map(team => team.division))]
    .filter(division => division !== 'Unassigned')
    .sort((a, b) => {
      const divA = divisions.find(d => d.name === a);
      const divB = divisions.find(d => d.name === b);
      return (divA?.division_order || 0) - (divB?.division_order || 0);
    });
  
  // Add 'Unassigned' at the end if there are unassigned teams
  const hasUnassigned = displayTeams.some(team => team.division === 'Unassigned');
  if (hasUnassigned) {
    divisionNames.push('Unassigned');
  }

  // Sort teams by overall record for season stats
  const overallStandings = [...displayTeams].sort((a, b) => {
    const aWinPct = a.wins / (a.wins + a.losses + a.ties);
    const bWinPct = b.wins / (b.wins + b.losses + b.ties);
    if (aWinPct !== bWinPct) return bWinPct - aWinPct;
    return b.pointsFor - a.pointsFor;
  });

  const getDivisionTeams = (division: string) => {
    return displayTeams
      .filter(team => team.division === division)
      .sort((a, b) => {
        const aWinPct = a.wins / (a.wins + a.losses + a.ties);
        const bWinPct = b.wins / (b.wins + b.losses + b.ties);
        if (aWinPct !== bWinPct) return bWinPct - aWinPct;
        return b.pointsFor - a.pointsFor;
      });
  };

  const getWinPercentage = (wins: number, losses: number, ties: number) => {
    const total = wins + losses + ties;
    return total > 0 ? (wins + ties * 0.5) / total : 0;
  };

  const getStreakColor = (streak: string) => {
    return streak.startsWith('W') ? 'success' : 'danger';
  };

  if (leagueLoading || teamsLoading || divisionsLoading) return <Typography>Loading standings...</Typography>;
  if (leagueError) return <Alert color="danger">Failed to load league data: {leagueError.message}</Alert>;
  if (teamsError) return <Alert color="danger">Failed to load teams data: {teamsError.message}</Alert>;
  if (!league) return <Alert color="warning">League not found.</Alert>;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography level="h2" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
            Standings
          </Typography>
          <Typography level="h4" sx={{ color: 'text.secondary' }}>
            {league.name || 'Unnamed League'}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Select
            value={selectedSeason}
            onChange={(event, newValue) => setSelectedSeason(newValue || '2025')}
            sx={{ minWidth: 120 }}
          >
            <Option value="2025">2025</Option>
            <Option value="2024">2024</Option>
            <Option value="2023">2023</Option>
          </Select>
          
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="sm">
              Projected Playoff Bracket
            </Button>
            <Button variant="outlined" size="sm">
              Game Lines
            </Button>
            <Button variant="outlined" size="sm">
              Final Standing Projections
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Division Standings */}
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3, 
          mb: 4,
          width: '100%'
        }}
      >
        {divisionNames.map((division) => (
          <Box 
            key={division}
            sx={{ 
              flex: 1,
              minWidth: { xs: '100%', md: 0 }
            }}
          >
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography 
                  level="h4" 
                  sx={{ 
                    fontWeight: 'bold', 
                    mb: 2, 
                    textAlign: 'center',
                    color: division === 'Unassigned' ? 'neutral.600' : 'primary.600'
                  }}
                >
                  {division}
                </Typography>
                
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--joy-palette-divider)' }}>
                      <th style={{ width: '30px', textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>RK</th>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Team</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>W</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>L</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>T</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>PCT</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>GB</th>
                      <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Playoff %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getDivisionTeams(division).map((team, index) => (
                      <tr 
                        key={team.id} 
                        style={{ 
                          backgroundColor: team.isUserTeam ? 'rgba(0, 200, 81, 0.1)' : 'transparent',
                          borderBottom: '1px solid var(--joy-palette-divider)',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          if (!team.isUserTeam) {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!team.isUserTeam) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar 
                              src={team.logo} 
                              alt={team.name} 
                              size="sm"
                              sx={{ width: 20, height: 20 }}
                            />
                            <Box>
                              <Typography 
                                level="body-sm" 
                                sx={{ 
                                  fontWeight: team.isUserTeam ? 'bold' : 'normal',
                                  color: team.isUserTeam ? 'primary.500' : 'text.primary'
                                }}
                              >
                                {team.name}
                              </Typography>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                {team.owner}
                              </Typography>
                            </Box>
                          </Box>
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                          {team.wins}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                          {team.losses}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                          {team.ties}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                          {getWinPercentage(team.wins, team.losses, team.ties).toFixed(3)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                          {team.gamesBack}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                          {team.playoffPercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Standings Glossary */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
            Standings Glossary
          </Typography>
          <Grid container spacing={2}>
            <Grid xs={12} sm={6} md={2}>
              <Typography level="body-sm">
                <strong>x:</strong> Clinched Playoffs
              </Typography>
            </Grid>
            <Grid xs={12} sm={6} md={2}>
              <Typography level="body-sm">
                <strong>y:</strong> Clinched Division
              </Typography>
            </Grid>
            <Grid xs={12} sm={6} md={2}>
              <Typography level="body-sm">
                <strong>z:</strong> Clinched Bye
              </Typography>
            </Grid>
            <Grid xs={12} sm={6} md={2}>
              <Typography level="body-sm">
                <strong>*:</strong> Clinched No. 1 Seed
              </Typography>
            </Grid>
            <Grid xs={12} sm={6} md={2}>
              <Typography level="body-sm">
                <strong>e:</strong> Eliminated From Playoff Contention
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Season Stats */}
      <Card variant="outlined">
        <CardContent>
          <Typography level="h4" sx={{ fontWeight: 'bold', mb: 3 }}>
            Season Stats
          </Typography>
          
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--joy-palette-divider)' }}>
                  <th style={{ width: '40px', textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>RK</th>
                  <th style={{ minWidth: '200px', textAlign: 'left', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>Team</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>PF</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>PA</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>DIV</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>HOME</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>AWAY</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>STRK</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontSize: '0.875rem', fontWeight: 'bold' }}>MOVES</th>
                </tr>
              </thead>
              <tbody>
                {overallStandings.map((team, index) => (
                  <tr 
                    key={team.id}
                    style={{ 
                      backgroundColor: team.isUserTeam ? 'rgba(0, 200, 81, 0.1)' : 'transparent',
                      borderBottom: '1px solid var(--joy-palette-divider)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (!team.isUserTeam) {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!team.isUserTeam) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar 
                          src={team.logo} 
                          alt={team.name} 
                          size="sm"
                          sx={{ width: 20, height: 20 }}
                        />
                        <Box>
                          <Typography 
                            level="body-sm" 
                            sx={{ 
                              fontWeight: team.isUserTeam ? 'bold' : 'normal',
                              color: team.isUserTeam ? 'primary.500' : 'text.primary'
                            }}
                          >
                            {team.name}
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            {team.owner}
                          </Typography>
                        </Box>
                      </Box>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                      {team.pointsFor.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                      {team.pointsAgainst.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                      {team.divisionRecord}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                      {team.homeRecord}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                      {team.awayRecord}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px' }}>
                      <Chip 
                        size="sm" 
                        color={getStreakColor(team.streak)}
                        variant="soft"
                        sx={{ fontWeight: team.isUserTeam ? 'bold' : 'normal' }}
                      >
                        {team.streak}
                      </Chip>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px', fontWeight: team.isUserTeam ? 'bold' : 'normal' }}>
                      {team.moves}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
