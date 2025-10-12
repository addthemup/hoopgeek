import { useParams, useNavigate, useLocation } from 'react-router-dom'
import React from 'react'
import { Box, Typography, Button, Stack, Card, CardContent, Chip, Grid, Alert, IconButton } from '@mui/joy'
import { ArrowBack } from '@mui/icons-material'
import LeagueNavigation from '../components/LeagueNavigation'
import LeagueSettingsManager from '../components/LeagueSettings'
import LeagueHome from './LeagueHome'
import TeamRoster from './TeamRoster'
import LeagueScoreboard from './LeagueScoreboard'
import Lineups from './Lineups'
import Trades from './Trades'
import Standings from './Standings'
import Players from './Players'
import CommissionerTools from './CommissionerTools'
import DraftComponent from '../components/Draft/DraftComponent'
import Transactions from './Transactions'
import { useAuth } from '../hooks/useAuth'
import { useLeague } from '../hooks/useLeagues'
import { useUpdateLeagueSettings } from '../hooks/useUpdateLeagueSettings'
import { useTeams } from '../hooks/useTeams'

export default function League() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: league, isLoading, error } = useLeague(id || '')
  const { data: teams } = useTeams(id || '')
  const updateLeagueSettings = useUpdateLeagueSettings()
  
  // State for showing team details within the league tab
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | undefined>(undefined)
  
  // Find user's team
  const userTeam = teams?.find(team => team.user_id === user?.id)
  
  // Check if selected team is the user's team
  const isUserTeam = selectedTeamId && userTeam && selectedTeamId === userTeam.id
  
  // Debug logging
  console.log('League component debug:', {
    id,
    user,
    leagueId: id,
    league,
    isLoading,
    error,
    selectedTeamId,
    userTeam,
    isUserTeam
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
  const isCommissioner = user?.id === league.commissioner_id


  const renderSettings = () => (
    <LeagueSettingsManager
      league={{
        id: league.id,
        name: league.name,
        description: league.description,
        commissioner_id: league.commissioner_id,
        max_teams: league.max_teams,
        scoring_type: league.scoring_type || 'H2H_Points',
        lineup_frequency: league.lineup_frequency || 'weekly',
        salary_cap_enabled: league.salary_cap_enabled,
        salary_cap_amount: league.salary_cap_amount,
        auto_ir_management: true,
        auto_substitution: true,
        global_leaderboard: true,
        optimal_team_challenges: true,
        weekly_achievements: true,
        social_sharing: true,
        team_branding: false,
        custom_scoring: false,
        trade_salary_matching: true,
        trade_salary_tolerance: 10.0,
        trade_limit: null,
        trade_deadline: null,
        trade_review_period: 1,
        trade_veto_votes_required: 5,
        allow_draft_pick_trades: false,
        waiver_period: 1,
        waiver_type: 'rolling',
        waiver_mode: 'standard',
        faab_budget: 100,
        acquisition_limit_season: null,
        acquisition_limit_week: 7,
        acquisition_limit_matchup: 7,
        undroppable_players_list: 'ESPN',
        player_universe: 'NBA',
        allow_injured_waiver_adds: true,
        post_draft_players: 'waiver',
        regular_season_start: 'NBA Week 1',
        weeks_per_matchup: 1,
        regular_season_matchups: 19,
        matchup_tiebreaker: 'none',
        home_field_advantage: false,
        home_field_advantage_points: 0.0,
        playoff_teams: 4,
        playoff_weeks_round1: 2,
        playoff_weeks_championship: 2,
        playoff_seeding_tiebreaker: 'head_to_head',
        playoff_home_field_advantage: false,
        playoff_reseeding: false,
        lock_eliminated_teams: false,
        divisions_enabled: false,
        division_count: 2,
        division_names: ['East', 'West'],
        keepers_enabled: false,
        keeper_count: 0,
        keeper_cost_inflation: 0.0,
        keeper_deadline: null,
        invite_permissions: 'commissioner',
        send_reminder_emails: true,
        lock_benched_players: false,
        public_league: false,
        league_password: null,
        league_logo_url: null,
        auto_renew_enabled: false,
        cash_league: false,
        entry_fee: 0,
        prize_pool: 0,
        draft_type: 'snake',
        draft_date: league.draft_date,
        draft_time_per_pick: 90,
        draft_order_method: 'random',
        draft_order_reveal_time: 60,
        roster_size: 13,
        total_starters: 10,
        total_bench: 3,
        total_ir: 1,
        position_limits: {
          PG: { starters: 1, max: null },
          SG: { starters: 1, max: null },
          SF: { starters: 1, max: null },
          PF: { starters: 1, max: null },
          C: { starters: 1, max: 4 },
          G: { starters: 1, max: null },
          F: { starters: 1, max: null },
          UTIL: { starters: 3, max: null },
          BENCH: { starters: 3, max: null },
          IR: { starters: 1, max: null }
        },
        games_played_limits: {
          all_players: null,
          by_position: {}
        },
        salary_cap_soft: false,
        salary_cap_penalty: 0.0,
        email_notifications: {
          draft_reminders: true,
          trade_notifications: true,
          waiver_notifications: true,
          matchup_updates: true,
          playoff_updates: true
        },
        invite_code: 'ABC123',
        season_year: 2024,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }}
      isCommissioner={isCommissioner}
      onUpdateSettings={async (settings) => {
        console.log('Updating league settings:', settings)
        if (!id) throw new Error('League ID is required')
        await updateLeagueSettings.mutateAsync({ leagueId: id, settings })
      }}
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
            leagueId={id || ''} 
            onTeamClick={setSelectedTeamId}
            onNavigateToTransactions={() => {
              // Dispatch custom event to change tab
              const event = new CustomEvent('changeLeagueTab', { 
                detail: { tabId: 'transactions' } 
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
      case 'lineups':
        console.log('League: Rendering Lineups component with leagueId:', id);
        return <Lineups leagueId={id || ''} />
      case 'trades':
        console.log('League: Rendering Trades component with leagueId:', id);
        return <Trades leagueId={id || ''} />
      case 'standings':
        console.log('League: Rendering Standings component with leagueId:', id);
        return <Standings leagueId={id || ''} />
      case 'players':
        console.log('League: Rendering Players component with leagueId:', id);
        return <Players leagueId={id || ''} />
      case 'commissioner':
        console.log('League: Rendering CommissionerTools component with leagueId:', id);
        return <CommissionerTools leagueId={id || ''} />
      case 'scoreboard':
        console.log('League: Rendering LeagueScoreboard component with leagueId:', id);
        return <LeagueScoreboard leagueId={id || ''} />
      case 'matchups':
        console.log('League: Rendering LeagueScoreboard component with leagueId:', id);
        return <LeagueScoreboard leagueId={id || ''} />
      case 'draft':
        console.log('League: Rendering DraftComponent with leagueId:', id);
        return <DraftComponent />
      case 'transactions':
        console.log('League: Rendering Transactions component with leagueId:', id);
        return <Transactions leagueId={id || ''} />
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
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: 2 }}>
      <LeagueNavigation 
        leagueId={league.id} 
        isCommissioner={isCommissioner}
        userHasTeam={!!userTeam}
      >
        {(activeTab) => renderTabContent(activeTab)}
      </LeagueNavigation>
    </Box>
  )
}
