import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Button,
  Alert,
} from '@mui/joy';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import {
  People,
  Settings,
  SportsBasketball,
  GroupAdd,
  Delete,
  AdminPanelSettings,
  Edit,
  Schedule,
  SwapHoriz,
  Assessment,
  Poll,
  Calculate,
} from '@mui/icons-material';
import LeagueInvitationManager from '../components/LeagueInvitationManager';
import TeamInvitationManager from '../components/TeamInvitationManager';

interface CommissionerToolsProps {
  leagueId: string;
}

export default function CommissionerTools({ leagueId }: CommissionerToolsProps) {
  const navigate = useNavigate();
  const { data: league, isLoading, error } = useLeague(leagueId);
  const [activeView, setActiveView] = useState<'tools' | 'team-invites'>('tools');

  // Mock data for tools - these would be real functions in production
  const leagueMembershipTools = [
    {
      title: 'Edit Managers and Send Invitations',
      description: 'Add and update team managers and invite friends to join your league.',
      icon: <GroupAdd />,
      action: () => setActiveView('team-invites'),
      color: 'primary' as const,
    },
    {
      title: 'Add Team(s)',
      description: 'Manage teams in your league - add new teams or edit existing ones.',
      icon: <People />,
      action: () => navigate(`/league/${leagueId}/teams`),
      color: 'primary' as const,
    },
    {
      title: 'Delete Team(s)',
      description: 'Remove teams from your league.',
      icon: <Delete />,
      action: () => console.log('Delete teams'),
      color: 'danger' as const,
    },
    {
      title: 'Assign League Manager Powers',
      description: 'Provide other league members with the powers available to LMs.',
      icon: <AdminPanelSettings />,
      action: () => console.log('Assign powers'),
      color: 'primary' as const,
    },
  ];

  const draftTools = [
    {
      title: 'Edit Draft Settings',
      description: 'Adjust the time, type and other draft settings.',
      icon: <SportsBasketball />,
      action: () => navigate(`/league/${leagueId}/draft-settings`),
      color: 'primary' as const,
    },
    {
      title: 'Edit Draft Order',
      description: 'Determine the order of selections in your draft.',
      icon: <Edit />,
      action: () => navigate(`/league/${leagueId}/draft-order`),
      color: 'primary' as const,
    },
  ];

  const leagueSettingsTools = [
    {
      title: 'Edit League Settings',
      description: 'Update general settings including playoffs, trade and keeper rules.',
      icon: <Settings />,
      action: () => console.log('Edit league settings'),
      color: 'primary' as const,
    },
    {
      title: 'Edit Scoring Settings',
      description: 'Edit how your league is scored.',
      icon: <Assessment />,
      action: () => console.log('Edit scoring settings'),
      color: 'primary' as const,
    },
    {
      title: 'Edit Teams and Divisions',
      description: 'Change team names and division configuration.',
      icon: <People />,
      action: () => navigate(`/league/${leagueId}/teams-and-divisions`),
      color: 'primary' as const,
    },
    {
      title: 'Delete League',
      description: 'Permanently delete your league.',
      icon: <Delete />,
      action: () => navigate(`/league/${leagueId}/delete`),
      color: 'danger' as const,
    },
    {
      title: 'Adjust Scoring',
      description: 'Make adjustments to scores that have already been accumulated.',
      icon: <Calculate />,
      action: () => console.log('Adjust scoring'),
      color: 'warning' as const,
    },
  ];

  const rosterTools = [
    {
      title: 'Edit Roster Settings',
      description: 'Edit the positional makeup of rosters in your league.',
      icon: <SportsBasketball />,
      action: () => navigate(`/league/${leagueId}/roster-settings`),
      color: 'primary' as const,
    },
    {
      title: 'Roster Moves',
      description: 'Adjust the rosters of league members.',
      icon: <SwapHoriz />,
      action: () => console.log('Roster moves'),
      color: 'primary' as const,
    },
    {
      title: 'Trade Review',
      description: 'Review trades across your league.',
      icon: <SwapHoriz />,
      action: () => console.log('Trade review'),
      color: 'primary' as const,
    },
  ];

  const scheduleTools = [
    {
      title: 'Edit Schedule Settings',
      description: 'Edit matchup settings or reset your schedule.',
      icon: <Schedule />,
      action: () => console.log('Edit schedule settings'),
      color: 'primary' as const,
    },
    {
      title: 'Edit Head-to-Head Schedule',
      description: 'Update matchups for your league.',
      icon: <Schedule />,
      action: () => console.log('Edit schedule'),
      color: 'primary' as const,
    },
  ];

  const miscellaneousTools = [
    {
      title: 'Transaction Counter',
      description: 'Manage league transactions.',
      icon: <Calculate />,
      action: () => console.log('Transaction counter'),
      color: 'primary' as const,
    },
    {
      title: 'Create/Edit League Manager Poll',
      description: 'Ask a question for league members to vote on.',
      icon: <Poll />,
      action: () => console.log('Create poll'),
      color: 'primary' as const,
    },
  ];

  const renderToolCard = (title: string, tools: any[]) => (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography level="title-md" sx={{ mb: 2, fontWeight: 'bold' }}>
          {title}
        </Typography>
        <Stack spacing={1}>
          {tools.map((tool, index) => (
            <Box
              key={index}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.500',
                  backgroundColor: 'primary.50',
                },
              }}
              onClick={tool.action}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box
                  sx={{
                    color: `${tool.color}.500`,
                    display: 'flex',
                    alignItems: 'center',
                    mt: 0.5,
                  }}
                >
                  {tool.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {tool.title}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    {tool.description}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Typography>Loading commissioner tools...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <Typography level="body-md">
          Error loading league data: {error.message}
        </Typography>
      </Alert>
    );
  }

  if (!league) {
    return (
      <Alert color="warning">
        <Typography level="body-md">
          League not found.
        </Typography>
      </Alert>
    );
  }

  // Check if user is commissioner
  const { user } = useAuth();
  // Note: league data is nested under 'league' property from get_league_data function
  const leagueData = league?.league || league;
  const isCommissioner = user?.id === leagueData?.commissioner_id;
  
  // Debug logging for commissioner check
  console.log('CommissionerTools: Commissioner debug:', {
    userId: user?.id,
    commissionerId: leagueData?.commissioner_id,
    isCommissioner,
    leagueId: leagueData?.id,
    leagueName: leagueData?.name,
    rawLeague: league,
    leagueData: leagueData
  });

  if (!isCommissioner) {
    return (
      <Alert color="warning">
        <Typography level="body-md">
          You must be a league commissioner to access these tools.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography level="h2" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
          League Manager Tools
        </Typography>
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          {leagueData?.name || league.name}
        </Typography>
      </Box>

      {/* Navigation */}
      <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
        <Button
          variant={activeView === 'tools' ? 'solid' : 'outlined'}
          onClick={() => setActiveView('tools')}
        >
          All Tools
        </Button>
        <Button
          variant={activeView === 'team-invites' ? 'solid' : 'outlined'}
          onClick={() => setActiveView('team-invites')}
        >
          Team Invitations
        </Button>
      </Stack>

      {activeView === 'team-invites' ? (
        <TeamInvitationManager leagueId={leagueId} />
      ) : (
        <>
          {/* League Invitation Manager */}
          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardContent>
              <LeagueInvitationManager leagueId={leagueId} />
            </CardContent>
          </Card>

      {/* Tools Grid */}
      <Grid container spacing={3}>
        {/* League Membership Tools */}
        <Grid xs={12} md={6} lg={4}>
          {renderToolCard('League Membership Tools', leagueMembershipTools)}
        </Grid>

        {/* Draft Tools */}
        <Grid xs={12} md={6} lg={4}>
          {renderToolCard('Draft Tools', draftTools)}
        </Grid>

        {/* League and Scoring Settings Tools */}
        <Grid xs={12} md={6} lg={4}>
          {renderToolCard('League and Scoring Settings Tools', leagueSettingsTools)}
        </Grid>

        {/* Roster Tools */}
        <Grid xs={12} md={6} lg={4}>
          {renderToolCard('Roster Tools', rosterTools)}
        </Grid>

        {/* Schedule and Standings Tools */}
        <Grid xs={12} md={6} lg={4}>
          {renderToolCard('Schedule and Standings Tools', scheduleTools)}
        </Grid>

        {/* Miscellaneous Tools */}
        <Grid xs={12} md={6} lg={4}>
          {renderToolCard('Miscellaneous Tools', miscellaneousTools)}
        </Grid>
      </Grid>

          {/* Coming Soon Notice */}
          <Card variant="outlined" sx={{ mt: 4, backgroundColor: 'warning.50' }}>
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2, color: 'warning.700' }}>
                🚧 Development Notice
              </Typography>
              <Typography level="body-sm" sx={{ color: 'warning.700' }}>
                These tools are currently in development. Full functionality will be available once we're hosted and can implement 
                real-time features like user invitations, live draft management, and league administration.
              </Typography>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
