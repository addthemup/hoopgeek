import { useParams, useNavigate, useLocation } from 'react-router-dom'
import React from 'react'
import { Box, Typography, Button, Stack, Card, CardContent, Chip, Grid, Alert, IconButton } from '@mui/joy'
import { ArrowBack } from '@mui/icons-material'
import LeagueNavigation from '../components/LeagueNavigation'
import LeagueSettingsManager from '../components/LeagueSettings'
import LeagueHome from './LeagueHome'
import TeamRoster from './TeamRoster'
import Players from './Players'
import CommissionerTools from './CommissionerTools'
import DraftComponent from '../components/Draft/DraftComponent'
import { useAuth } from '../hooks/useAuth'
import { useLeague } from '../hooks/useLeagues'
import { useUpdateLeagueSettings } from '../hooks/useUpdateLeagueSettings'
import { useTeams } from '../hooks/useTeams'
import { useCurrentWeekMatchups } from '../hooks/useMatchups'

export default function League() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: league, isLoading, error } = useLeague(id || '')
  const { data: teams } = useTeams(id || '')
  const { data: matchups, isLoading: matchupsLoading } = useCurrentWeekMatchups(id || '')
  const updateLeagueSettings = useUpdateLeagueSettings()
  
  // State for showing team details within the league tab
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | undefined>(undefined)
  
  // Find user's team
  const userTeam = teams?.find(team => team.user_id === user?.id)
  
  // Check if selected team is the user's team
  const isUserTeam = selectedTeamId && userTeam && selectedTeamId === userTeam.id
  
  // Debug logging
  console.log('🔍 League component debug:', {
    leagueId: id,
    userId: user?.id,
    userEmail: user?.email,
    teamsCount: teams?.length,
    teams: teams?.map(t => ({ 
      id: t.id, 
      name: t.team_name, 
      user_id: t.user_id,
      isMyTeam: t.user_id === user?.id 
    })),
    userTeam: userTeam ? {
      id: userTeam.id,
      name: userTeam.team_name,
      user_id: userTeam.user_id
    } : null,
    userHasTeam: !!userTeam
  });

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h2">Loading league...</Typography>
      </Box>
    )
  }

  if (error || !league) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h2">Failed to load league</Typography>
        <Typography level="body-md" sx={{ mt: 1 }}>
          {error?.message || 'League not found'}
        </Typography>
      </Box>
    )
  }

  // Check if current user is commissioner
  // Note: league data is nested under 'league' property from get_league_data function
  const leagueData = league?.league || league;
  const isCommissioner = user?.id === leagueData?.commissioner_id
  
  // Debug logging for commissioner check
  console.log('League: Commissioner debug:', {
    userId: user?.id,
    commissionerId: leagueData?.commissioner_id,
    isCommissioner,
    leagueId: leagueData?.id,
    leagueName: leagueData?.name,
    rawLeague: league,
    leagueData: leagueData
  });


  const renderSettings = () => (
    <LeagueSettingsManager
      league={league as any} // Pass the actual league data from database
      isCommissioner={isCommissioner}
      onUpdateSettings={async (settings) => {
        console.log('Updating league settings:', settings)
        if (!id) throw new Error('League ID is required')
        await updateLeagueSettings.mutateAsync({ leagueId: id, settings })
      }}
      isLoading={updateLeagueSettings.isPending}
    />
  )


  // Component to show team details with back button
  const TeamDetailsView = ({ teamId, onBack }: { teamId: string, onBack: () => void }) => {
    const selectedTeam = teams?.find(t => t.id === teamId)
    
    if (!selectedTeam) {
      return (
        <Alert color="warning">
          <Typography>Team not found.</Typography>
        </Alert>
      )
    }

    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <IconButton onClick={onBack} variant="outlined">
            <ArrowBack />
          </IconButton>
          <Typography level="h3">{selectedTeam.team_name}</Typography>
        </Stack>
        <TeamRoster leagueId={id || ''} teamId={teamId} />
      </Box>
    )
  }

  const renderTabContent = (tabId: string) => {
    console.log('League: Rendering tab content for:', tabId);
    
    // If we have a selected team and we're on the home tab, show team details
    if (selectedTeamId && tabId === 'home') {
      return <TeamDetailsView teamId={selectedTeamId} onBack={() => setSelectedTeamId(undefined)} />
    }
    
    switch (tabId) {
      case 'home':
        console.log('League: Rendering LeagueHome component with leagueId:', id);
        return (
          <LeagueHome 
            leagueId={leagueData?.id || id || ''} 
            onTeamClick={setSelectedTeamId}
            onNavigateToTransactions={() => {
              // Dispatch custom event to change tab to My Team (where transactions are now)
              const event = new CustomEvent('changeLeagueTab', { 
                detail: { tabId: 'my-team' } 
              });
              window.dispatchEvent(event);
            }}
          />
        )
      case 'my-team':
        // Only show my-team tab if user has a team
        if (userTeam) {
          console.log('League: Rendering TeamRoster component for user team:', userTeam.id);
          return <TeamRoster leagueId={id || ''} teamId={userTeam.id} />
        } else {
          return (
            <Alert color="info">
              <Typography level="body-md">
                You don't have a team in this league yet.
              </Typography>
            </Alert>
          )
        }
      case 'players':
        console.log('League: Rendering Players component with leagueId:', id);
        return <Players leagueId={id || ''} />
      case 'commissioner':
        console.log('League: Rendering CommissionerTools component with leagueId:', id);
        return <CommissionerTools leagueId={id || ''} />
      case 'draft':
        console.log('League: Rendering DraftComponent with leagueId:', id);
        return <DraftComponent />
      case 'settings':
        console.log('League: Rendering settings');
        return renderSettings()
      default:
        console.log('League: Rendering default tab for:', tabId);
        return (
          <Alert color="info">
            <Typography level="body-md">
              This tab is coming soon! We're building out the {tabId} functionality.
            </Typography>
          </Alert>
        )
    }
  }

  if (!user) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h2">Please sign in to view this league</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      width: '100%',
      overflowX: 'hidden',
      bgcolor: 'background.body',
      minHeight: '100vh',
    }}>
      <LeagueNavigation 
        leagueId={leagueData?.id || id} 
        isCommissioner={isCommissioner}
        userHasTeam={!!userTeam}
        showMatchups={true}
        matchups={matchups}
        matchupsLoading={matchupsLoading}
      >
        {(activeTab) => renderTabContent(activeTab)}
      </LeagueNavigation>
    </Box>
  )
}
