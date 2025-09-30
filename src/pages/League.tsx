import { useParams } from 'react-router-dom'
import { Box, Typography, Button, Stack, Card, CardContent, Chip, Grid, Alert } from '@mui/joy'
import LeagueNavigation from '../components/LeagueNavigation'
import LeagueSettingsManager from '../components/LeagueSettings'
import { useAuth } from '../hooks/useAuth'

export default function League() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  
  // Mock data for now - in real app, this would come from API
  const league = {
    id: id || '1',
    name: 'My Awesome League',
    description: 'A competitive fantasy basketball league with weekly lineups and salary cap',
    teams: 12,
    draftDate: '2024-01-15',
    draftStatus: 'scheduled' as const,
    members: [
      { id: '1', name: 'Team Alpha', owner: 'John Doe', wins: 8, losses: 2 },
      { id: '2', name: 'Team Beta', owner: 'Jane Smith', wins: 7, losses: 3 },
      { id: '3', name: 'Team Gamma', owner: 'Bob Johnson', wins: 6, losses: 4 },
      { id: '4', name: 'Team Delta', owner: 'Alice Brown', wins: 5, losses: 5 },
    ],
    isCommissioner: true // Mock - would check if current user is commissioner
  }

  const renderLeagueHome = () => (
    <Stack spacing={3}>
      {/* Quick Actions */}
      <Card variant="outlined">
        <CardContent>
          <Typography level="h4" sx={{ mb: 2 }}>
            Quick Actions
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button 
              size="lg" 
              onClick={() => window.location.href = `/draft/${league.id}`}
              disabled={league.draftStatus !== 'scheduled'}
            >
              {league.draftStatus === 'scheduled' ? 'Join Draft' : 'View Draft Results'}
            </Button>
            <Button variant="outlined" size="lg">
              Invite Members
            </Button>
            <Button variant="outlined" size="lg">
              View Standings
            </Button>
            <Button variant="outlined" size="lg">
              Trade Center
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* League Overview */}
      <Grid container spacing={3}>
        <Grid xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h4" sx={{ mb: 2 }}>
                League Standings
              </Typography>
              <Stack spacing={1}>
                {league.members.map((member, index) => (
                  <Box 
                    key={member.id}
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      p: 2,
                      border: '1px solid',
                      borderColor: 'neutral.200',
                      borderRadius: 'sm',
                      bgcolor: index < 4 ? 'success.50' : 'background.surface'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography level="title-sm" sx={{ minWidth: '2rem' }}>
                        #{index + 1}
                      </Typography>
                      <Box>
                        <Typography level="title-sm">
                          {member.name}
                        </Typography>
                        <Typography level="body-sm" color="neutral">
                          {member.owner}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography level="body-sm">
                        {member.wins}-{member.losses}
                      </Typography>
                      <Chip 
                        variant="soft" 
                        color={index < 4 ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {index < 4 ? 'Playoff' : 'Active'}
                      </Chip>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={4}>
          <Stack spacing={3}>
            {/* League Info */}
            <Card variant="outlined">
              <CardContent>
                <Typography level="h4" sx={{ mb: 2 }}>
                  League Info
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography level="body-sm" color="neutral">
                      League Type
                    </Typography>
                    <Typography level="title-sm">
                      Head-to-Head Points
                    </Typography>
                  </Box>
                  <Box>
                    <Typography level="body-sm" color="neutral">
                      Lineup Frequency
                    </Typography>
                    <Typography level="title-sm">
                      Weekly
                    </Typography>
                  </Box>
                  <Box>
                    <Typography level="body-sm" color="neutral">
                      Salary Cap
                    </Typography>
                    <Typography level="title-sm">
                      $100,000,000
                    </Typography>
                  </Box>
                  <Box>
                    <Typography level="body-sm" color="neutral">
                      Draft Status
                    </Typography>
                    <Chip 
                      variant="soft" 
                      color={league.draftStatus === 'scheduled' ? 'warning' : 'success'}
                      size="sm"
                    >
                      {league.draftStatus}
                    </Chip>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card variant="outlined">
              <CardContent>
                <Typography level="h4" sx={{ mb: 2 }}>
                  Recent Activity
                </Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography level="body-sm">
                      Team Alpha traded LeBron James to Team Beta
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      2 hours ago
                    </Typography>
                  </Box>
                  <Box>
                    <Typography level="body-sm">
                      Team Gamma picked up Anthony Davis from waivers
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      4 hours ago
                    </Typography>
                  </Box>
                  <Box>
                    <Typography level="body-sm">
                      Week 5 matchups completed
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      1 day ago
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  )

  const renderSettings = () => (
    <LeagueSettingsManager
      league={{
        id: league.id,
        name: league.name,
        description: league.description,
        commissioner_id: 'user-id',
        max_teams: league.teams,
        scoring_type: 'H2H_Points',
        lineup_frequency: 'weekly',
        salary_cap_enabled: true,
        salary_cap_amount: 100000000,
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
        draft_date: league.draftDate,
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
      isCommissioner={league.isCommissioner}
      onUpdateSettings={async (settings) => {
        console.log('Updating league settings:', settings)
        // In real app, this would call the API
      }}
    />
  )

  const renderTabContent = (tabId: string) => {
    switch (tabId) {
      case 'home':
        return renderLeagueHome()
      case 'settings':
        return renderSettings()
      default:
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
        isCommissioner={league.isCommissioner}
      >
        {(activeTab) => renderTabContent(activeTab)}
      </LeagueNavigation>
    </Box>
  )
}
