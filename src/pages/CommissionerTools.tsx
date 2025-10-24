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
  Input,
  IconButton,
  Chip,
} from '@mui/joy';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import { useTeams } from '../hooks/useTeams';
import { useCurrentFantasyWeek } from '../hooks/useCurrentFantasyWeek';
import { useMatchups } from '../hooks/useMatchups';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
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
  AutoAwesome,
  Link as LinkIcon,
  ContentCopy,
  Check,
  Email,
} from '@mui/icons-material';
import TeamInvitationManager from '../components/TeamInvitationManager';

interface CommissionerToolsProps {
  leagueId: string;
}

export default function CommissionerTools({ leagueId }: CommissionerToolsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: league, isLoading, error } = useLeague(leagueId);
  const { data: teams } = useTeams(leagueId);
  const { currentWeek: fantasyWeek, seasonPhase } = useCurrentFantasyWeek();
  const [activeView, setActiveView] = useState<'tools' | 'team-invites'>('tools');
  const [copied, setCopied] = useState(false);
  
  // Get current week matchups
  const currentWeek = fantasyWeek?.week_number ?? 1; // Use nullish coalescing to preserve 0
  const { data: currentWeekMatchups } = useMatchups(leagueId, currentWeek);

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

  // Auto-lineup for all teams mutation
  const autoLineupAllTeamsMutation = useMutation({
    mutationFn: async () => {
      if (!teams || !currentWeekMatchups || !fantasyWeek || !league) {
        throw new Error('Missing required data for auto-lineup');
      }

      const weekNumber = currentWeek;
      const seasonYear = fantasyWeek.season_year;
      
      // Get the actual season_id from teams (they all share the same season_id)
      const seasonId = teams[0]?.season_id;
      
      if (!seasonId) {
        throw new Error('Could not determine season_id from teams');
      }

      console.log('🤖 Starting auto-lineup for all teams:', {
        leagueId,
        weekNumber,
        weekName: fantasyWeek?.week_name,
        seasonYear,
        seasonId,
        teamsCount: teams.length,
        matchupsCount: currentWeekMatchups.length
      });

      const results = [];
      
      for (const team of teams) {
        try {
          // Find the matchup for this team
          const matchup = currentWeekMatchups.find(m => 
            m.fantasy_team1_id === team.id || m.fantasy_team2_id === team.id
          );

          if (!matchup) {
            console.log(`⚠️ No matchup found for team ${team.team_name} in week ${weekNumber}`);
            continue;
          }

          console.log(`🤖 Running auto-lineup for team: ${team.team_name}`);
          
          const { data, error } = await supabase.functions.invoke('auto-lineup', {
            body: {
              leagueId,
              teamId: team.id,
              weekNumber,
              seasonYear,
              seasonId,
              matchupId: matchup.id
            }
          });

          if (error) {
            console.error(`❌ Auto-lineup failed for team ${team.team_name}:`, error);
            results.push({ team: team.team_name, success: false, error: error.message });
          } else {
            console.log(`✅ Auto-lineup successful for team: ${team.team_name}`);
            results.push({ team: team.team_name, success: true });
          }
        } catch (error) {
          console.error(`❌ Auto-lineup error for team ${team.team_name}:`, error);
          results.push({ 
            team: team.team_name, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`✅ Auto-lineup completed: ${successful} successful, ${failed} failed`);
    },
    onError: (error) => {
      console.error('❌ Auto-lineup for all teams failed:', error);
    }
  });

  const handleAutoLineupAllTeams = () => {
    if (!teams || teams.length === 0) {
      alert('No teams found in this league');
      return;
    }

    if (!currentWeekMatchups || currentWeekMatchups.length === 0) {
      alert(`No matchups found for ${fantasyWeek?.week_name || `week ${currentWeek}`}`);
      return;
    }

    const confirmMessage = `This will run auto-lineup for all ${teams.length} teams in ${fantasyWeek?.week_name || `week ${currentWeek}`}. Continue?`;
    if (confirm(confirmMessage)) {
      autoLineupAllTeamsMutation.mutate();
    }
  };

  const rosterTools = [
    {
      title: 'Edit Roster Settings',
      description: 'Edit the positional makeup of rosters in your league.',
      icon: <SportsBasketball />,
      action: () => navigate(`/league/${leagueId}/roster-settings`),
      color: 'primary' as const,
    },
    {
      title: 'Auto-Lineup All Teams',
      description: `Automatically generate optimal lineups for all teams in ${fantasyWeek?.week_name || `week ${currentWeek}`}.`,
      icon: <AutoAwesome />,
      action: handleAutoLineupAllTeams,
      color: 'success' as const,
      loading: autoLineupAllTeamsMutation.isPending,
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

  // Process waivers mutation
  const processWaiversMutation = useMutation({
    mutationFn: async () => {
      if (!league) {
        throw new Error('League data not loaded');
      }

      const leagueData = league?.league || league;
      const seasonId = leagueData?.season_id || teams?.[0]?.season_id;

      if (!seasonId) {
        throw new Error('No season ID found');
      }

      console.log('⚙️ Processing waivers:', { leagueId, seasonId });

      const { data, error } = await supabase.rpc('process_waiver_claims', {
        p_league_id: leagueId,
        p_season_id: seasonId,
      });

      if (error) {
        console.error('❌ Error processing waivers:', error);
        throw error;
      }

      console.log('✅ Waivers processed:', data);
      return data;
    },
    onSuccess: (result) => {
      console.log('✅ Waiver processing complete:', result);
      
      // Invalidate all waiver-related queries
      queryClient.invalidateQueries({ queryKey: ['league-waivers'] });
      queryClient.invalidateQueries({ queryKey: ['pending-waiver-claims'] });
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      queryClient.invalidateQueries({ queryKey: ['user-team-roster'] });
      queryClient.invalidateQueries({ queryKey: ['recent-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['league-transactions'] });
      
      alert(`Waivers processed successfully!\n\nAwarded: ${result.awarded_count || 0} claims\nFailed: ${result.failed_count || 0} claims`);
    },
    onError: (error) => {
      console.error('❌ Waiver processing failed:', error);
      alert(`Error processing waivers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const handleProcessWaivers = () => {
    const confirmMessage = `This will process all pending waiver claims immediately. Are you sure?`;
    if (confirm(confirmMessage)) {
      processWaiversMutation.mutate();
    }
  };

  const miscellaneousTools = [
    {
      title: 'Process Waivers Now',
      description: 'Manually process all pending waiver claims immediately.',
      icon: <AutoAwesome />,
      action: handleProcessWaivers,
      color: 'warning' as const,
      loading: processWaiversMutation.isPending,
    },
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
                cursor: tool.loading ? 'not-allowed' : 'pointer',
                opacity: tool.loading ? 0.7 : 1,
                transition: 'all 0.2s ease',
                '&:hover': tool.loading ? {} : {
                  borderColor: 'primary.500',
                  backgroundColor: 'primary.50',
                },
              }}
              onClick={tool.loading ? undefined : tool.action}
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
                  {tool.loading ? '⏳' : tool.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {tool.title}
                    {tool.loading && ' (Running...)'}
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
          {/* League Invite Link */}
          <Card variant="outlined" sx={{ mb: 4, bgcolor: 'background.level1' }}>
            <CardContent>
              <Stack spacing={2}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LinkIcon color="primary" />
                    <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                      League Invite Link
                    </Typography>
                  </Stack>
                  <Chip size="sm" color="success" variant="soft">
                    Ready to Share
                  </Chip>
                </Box>

                {/* Description */}
                <Typography level="body-sm" color="neutral">
                  Share this link with anyone you want to invite to <strong>{leagueData?.name || league?.name}</strong>. 
                  First {leagueData?.max_teams || 'available'} people to join get a team!
                </Typography>

                {/* URL Display with Copy Button */}
                {leagueData?.invite_code && (
                  <>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Input
                        value={(() => {
                          const baseUrl = window.location.hostname === 'localhost' 
                            ? window.location.origin 
                            : 'https://hoop-geek.com';
                          return `${baseUrl}/join/${leagueData.invite_code}`;
                        })()}
                        readOnly
                        sx={{ flex: 1 }}
                        endDecorator={
                          <IconButton
                            size="sm"
                            variant="plain"
                            onClick={() => {
                              const baseUrl = window.location.hostname === 'localhost' 
                                ? window.location.origin 
                                : 'https://hoop-geek.com';
                              const inviteUrl = `${baseUrl}/join/${leagueData.invite_code}`;
                              navigator.clipboard.writeText(inviteUrl);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            sx={{ minWidth: 32 }}
                          >
                            {copied ? <Check color="success" /> : <ContentCopy />}
                          </IconButton>
                        }
                      />
                    </Box>

                    {copied && (
                      <Alert color="success" variant="soft" size="sm">
                        <Typography level="body-xs">
                          ✓ Link copied to clipboard!
                        </Typography>
                      </Alert>
                    )}

                    {/* Stats */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <People sx={{ fontSize: 18, color: 'neutral.500' }} />
                        <Typography level="body-sm" color="neutral">
                          {teams?.filter(t => t.user_id).length || 0} / {leagueData?.max_teams || 0} teams joined
                        </Typography>
                      </Stack>
                      <Typography level="body-xs" color="neutral">
                        Code: <strong>{leagueData.invite_code}</strong>
                      </Typography>
                    </Box>

                    {/* Share Buttons */}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => {
                          const baseUrl = window.location.hostname === 'localhost' 
                            ? window.location.origin 
                            : 'https://hoop-geek.com';
                          const inviteUrl = `${baseUrl}/join/${leagueData.invite_code}`;
                          navigator.clipboard.writeText(inviteUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        fullWidth
                      >
                        {copied ? 'Copied!' : 'Copy Link'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => {
                          const baseUrl = window.location.hostname === 'localhost' 
                            ? window.location.origin 
                            : 'https://hoop-geek.com';
                          const inviteUrl = `${baseUrl}/join/${leagueData.invite_code}`;
                          const subject = encodeURIComponent(`Join my fantasy basketball league: ${leagueData?.name || league?.name}`);
                          const body = encodeURIComponent(
                            `You're invited to join my fantasy basketball league!\n\n` +
                            `League: ${leagueData?.name || league?.name}\n\n` +
                            `Click here to join: ${inviteUrl}`
                          );
                          window.location.href = `mailto:?subject=${subject}&body=${body}`;
                        }}
                        fullWidth
                        startDecorator={<Email />}
                      >
                        Share via Email
                      </Button>
                    </Stack>
                  </>
                )}
              </Stack>
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
