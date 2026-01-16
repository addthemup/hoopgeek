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
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  IconButton,
  Alert,
  LinearProgress,
  Sheet,
  Table,
  Textarea,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import {
  SportsBasketball,
  SwapHoriz,
  Notifications,
  Settings,
  EmojiEvents,
  Edit,
  ExpandMore,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useLeague } from '../hooks/useLeagues';
import { useTeams } from '../hooks/useTeams';
import { useCurrentWeekMatchups } from '../hooks/useMatchups';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import { useCurrentFantasyWeek, getWeekDisplayText, getSeasonPhaseColor } from '../hooks/useCurrentFantasyWeek';
import { useDivisions } from '../hooks/useDivisions';
import { FantasyTeam } from '../types';
import { supabase } from '../utils/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import WaiverClaimModal from '../components/WaiverClaimModal';
import { useLeagueWaiverOrder } from '../hooks/useWaiverOrder';
import { usePendingWaiverClaims, useCancelWaiverClaim } from '../hooks/useWaiverClaims';
import { formatDistanceToNow } from 'date-fns';

// Mock data for demonstration (keeping for other sections)

// Transform database teams to standings format
const transformTeamToStanding = (dbTeam: FantasyTeam, rank: number) => {
  const winPercentage = dbTeam.wins + dbTeam.losses > 0 
    ? (dbTeam.wins / (dbTeam.wins + dbTeam.losses)) 
    : 0;
  
  return {
    rank,
    team: dbTeam.team_name,
    owner: dbTeam.user_id ? 'Owner Assigned' : 'TBD',
    wins: dbTeam.wins,
    losses: dbTeam.losses,
    pct: winPercentage,
    pointsFor: dbTeam.points_for,
    pointsAgainst: dbTeam.points_against,
    streak: dbTeam.wins > dbTeam.losses ? 'W2' : dbTeam.losses > dbTeam.wins ? 'L1' : '--',
  };
};

// Removed mockNews - replaced with real waiver data


interface LeagueHomeProps {
  leagueId: string;
  onTeamClick?: (teamId: string) => void;
  onNavigateToTransactions?: () => void;
}

export default function LeagueHome({ leagueId, onTeamClick, onNavigateToTransactions }: LeagueHomeProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: league, isLoading, error } = useLeague(leagueId);
  const { data: teams, isLoading: teamsLoading, error: teamsError } = useTeams(leagueId);
  const { data: matchups, isLoading: matchupsLoading, error: matchupsError } = useCurrentWeekMatchups(leagueId);
  const { data: nbaScoreboard, isLoading: scoreboardLoading, error: scoreboardError } = useNBAScoreboard();
  const { currentWeek, seasonPhase, isLoading: weekLoading } = useCurrentFantasyWeek();
  const { data: divisions = [], isLoading: divisionsLoading } = useDivisions(leagueId);
  
  // Find user's team
  const userTeam = teams?.find(team => team.user_id === user?.id);
  
  // Commissioner notes state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  
  // Mobile collapsible state
  const [standingsExpanded, setStandingsExpanded] = useState(true);
  const [salaryCapExpanded, setSalaryCapExpanded] = useState(false);
  
  // Waiver claim modal state
  const [waiverModalOpen, setWaiverModalOpen] = useState(false);
  const [selectedWaiverPlayer, setSelectedWaiverPlayer] = useState<any | null>(null);
  
  // Waiver tab state
  const [waiverTab, setWaiverTab] = useState<number>(0);
  
  // Check if current user is commissioner
  const isCommissioner = user && league && user.id === league.commissioner_id;
  
  // Load commissioner notes when league data is available
  useEffect(() => {
    if (league?.commissioner_notes) {
      setNotesText(league.commissioner_notes);
    }
  }, [league?.commissioner_notes]);
  
  // Mutation to update commissioner notes
  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase
        .from('fantasy_leagues')
        .update({ commissioner_notes: notes })
        .eq('id', leagueId);
      
      if (error) throw error;
      return notes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
      setEditingNotes(false);
    },
  });
  
  const handleSaveNotes = () => {
    updateNotesMutation.mutate(notesText);
  };
  
  const handleCancelEdit = () => {
    setNotesText(league?.commissioner_notes || '');
    setEditingNotes(false);
  };

  // Fetch salary cap usage for all teams - moved to top to avoid hooks order issues
  const { data: teamSalaryData } = useQuery({
    queryKey: ['team-salary-cap-usage', leagueId],
    queryFn: async () => {
      if (!teams || teams.length === 0) return {};

      console.log('💰 Fetching salary cap data for teams:', teams.map(t => ({ id: t.id, name: t.team_name })));

      const salaryData: Record<string, number> = {};

      // Fetch salary data for all teams in parallel
      const promises = teams.map(async (team) => {
        try {
          // Fetch roster spots with player salary data using proper joins
          const { data: rosterData, error } = await supabase
            .from('fantasy_roster_spots')
            .select(`
              player_id,
              nba_players!inner(
                id,
                nba_hoopshype_salaries!inner(
                  salary_2025_26
                )
              )
            `)
            .eq('fantasy_team_id', team.id)
            .not('player_id', 'is', null); // Only include spots with actual players

          if (error) {
            console.error(`❌ Error fetching roster for team ${team.id}:`, error);
            return { teamId: team.id, salary: 0 };
          }

          console.log(`📊 Team ${team.team_name} roster data:`, rosterData);

          const totalSalary = rosterData?.reduce((sum, rosterSpot) => {
            const player = rosterSpot.nba_players as any;
            const salaryData = player?.nba_hoopshype_salaries?.[0];
            const playerSalary = salaryData?.salary_2025_26 || 0;
            console.log(`  Player salary: ${playerSalary}`);
            return sum + playerSalary;
          }, 0) || 0;

          console.log(`💰 Team ${team.team_name} total salary: $${(totalSalary / 1000000).toFixed(1)}M`);

          return { teamId: team.id, salary: totalSalary };
        } catch (error) {
          console.error(`❌ Error calculating salary for team ${team.id}:`, error);
          return { teamId: team.id, salary: 0 };
        }
      });

      const results = await Promise.all(promises);
      
      results.forEach(({ teamId, salary }) => {
        salaryData[teamId] = salary;
      });

      console.log('💰 Final salary data:', salaryData);
      return salaryData;
    },
    enabled: !!teams && teams.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch recent transactions (adds and cuts)
  const { data: recentTransactions = [] } = useQuery({
    queryKey: ['recent-transactions', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fantasy_transactions')
        .select(`
          id,
          transaction_type,
          transaction_date,
          status,
          notes,
          fantasy_team:fantasy_teams!fantasy_team_id(team_name, user_id),
          player:nba_players!player_id(id, name, position, team_abbreviation, nba_player_id)
        `)
        .eq('league_id', leagueId)
        .in('transaction_type', ['add', 'cut'])
        .eq('status', 'completed')
        .order('transaction_date', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching recent transactions:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!leagueId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get season ID for waiver queries
  const leagueData = league as any;
  const seasonId = leagueData?.season_id || 
                   leagueData?.current_season_id || 
                   leagueData?.season?.id ||
                   teams?.[0]?.season_id;

  // Fetch waiver order
  const { data: waiverOrder = [], isLoading: waiverOrderLoading } = useLeagueWaiverOrder(
    leagueId,
    seasonId || ''
  );

  // Fetch pending waiver claims for user's team
  const { data: pendingClaims = [], isLoading: claimsLoading } = usePendingWaiverClaims(
    leagueId,
    userTeam?.id || ''
  );

  // Cancel waiver claim mutation
  const cancelClaimMutation = useCancelWaiverClaim();

  // Fetch players currently on waivers
  const { data: waiverPlayers = [], isLoading: waiversLoading } = useQuery({
    queryKey: ['league-waivers', leagueId, league],
    queryFn: async () => {
      // Get the current season ID - try multiple possible locations
      const leagueData = league as any;
      const seasonId = leagueData?.season_id || 
                       leagueData?.current_season_id || 
                       leagueData?.season?.id ||
                       teams?.[0]?.season_id;
      
      console.log('🕐 Fetching waivers:', { 
        leagueId, 
        seasonId, 
        leagueSeasonId: leagueData?.season_id,
        leagueCurrentSeasonId: leagueData?.current_season_id,
        teamSeasonId: teams?.[0]?.season_id,
        league 
      });
      
      if (!seasonId) {
        console.error('⚠️ No season ID available for waiver query. League data:', league);
        console.error('⚠️ Teams data:', teams);
        
        // Try to fetch waivers without season_id filter (not recommended but will help debug)
        const { data: debugData, error: debugError } = await supabase
          .from('fantasy_players_on_waivers')
          .select('*')
          .eq('league_id', leagueId)
          .eq('waiver_status', 'on_waivers')
          .limit(10);
          
        console.log('🔍 Debug query (no season filter):', { data: debugData, error: debugError });
        
        return [];
      }

      const { data, error } = await supabase
        .from('fantasy_players_on_waivers')
        .select(`
          id,
          player_id,
          waiver_status,
          dropped_by_team_id,
          dropped_at,
          becomes_free_agent_at,
          nba_players!player_id(
            id,
            name,
            position,
            team_abbreviation,
            nba_player_id
          ),
          fantasy_teams!dropped_by_team_id(
            team_name
          )
        `)
        .eq('league_id', leagueId)
        .eq('season_id', seasonId)
        .eq('waiver_status', 'on_waivers')
        .order('becomes_free_agent_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('❌ Error fetching waiver players:', error);
        return [];
      }

      console.log('✅ Waiver players fetched:', data?.length || 0, 'players');
      console.log('📊 Waiver data:', data);

      return data || [];
    },
    enabled: !!leagueId && !!league,
    refetchInterval: 60000, // Refetch every minute
  });

  // Debug logging
  console.log('LeagueHome Debug Info:', {
    leagueId,
    league,
    isLoading,
    error,
    errorMessage: error?.message,
    errorStack: error?.stack
  });

  if (isLoading || teamsLoading || matchupsLoading || weekLoading || divisionsLoading) {
    console.log('LeagueHome: Loading state');
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2 }}>Loading league...</Typography>
      </Box>
    );
  }

  if (error || !league || teamsError || matchupsError) {
    console.log('LeagueHome: Error or no league data', { error, league, teamsError });
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          Failed to load league. Please try again later.
          {error && (
            <Box sx={{ mt: 2 }}>
              <Typography level="body-xs" color="danger">
                League Error: {error.message || 'Unknown error'}
              </Typography>
            </Box>
          )}
          {teamsError && (
            <Box sx={{ mt: 2 }}>
              <Typography level="body-xs" color="danger">
                Teams Error: {teamsError.message || 'Unknown error'}
              </Typography>
            </Box>
          )}
        </Alert>
      </Box>
    );
  }

  // Generate standings grouped by divisions
  const generateDivisionStandings = () => {
    if (!teams || !divisions) return { divisionStandings: [], unassignedTeams: [] };

    const divisionStandings: Array<{
      division: { id: string; name: string; division_order: number };
      teams: Array<ReturnType<typeof transformTeamToStanding>>;
    }> = [];

    const unassignedTeams: Array<ReturnType<typeof transformTeamToStanding>> = [];

    // Sort divisions by order
    const sortedDivisions = [...divisions].sort((a, b) => a.division_order - b.division_order);

    // Process each division
    sortedDivisions.forEach(division => {
      const divisionTeams = teams.filter(team => team.division_id === division.id);
      
      if (divisionTeams.length > 0) {
        const sortedTeams = divisionTeams
          .sort((a, b) => {
            const aWinPct = a.wins / (a.wins + a.losses + a.ties);
            const bWinPct = b.wins / (b.wins + b.losses + b.ties);
            if (aWinPct !== bWinPct) return bWinPct - aWinPct;
            return b.points_for - a.points_for;
          })
          .map((team, index) => transformTeamToStanding(team, index + 1));

        divisionStandings.push({
          division,
          teams: sortedTeams
        });
      }
    });

    // Handle unassigned teams
    const assignedTeamIds = new Set(teams.filter(team => team.division_id).map(team => team.id));
    const unassigned = teams.filter(team => !assignedTeamIds.has(team.id));
    
    if (unassigned.length > 0) {
      const sortedUnassigned = unassigned
        .sort((a, b) => {
          const aWinPct = a.wins / (a.wins + a.losses + a.ties);
          const bWinPct = b.wins / (b.wins + b.losses + b.ties);
          if (aWinPct !== bWinPct) return bWinPct - aWinPct;
          return b.points_for - a.points_for;
        })
        .map((team, index) => transformTeamToStanding(team, index + 1));

      unassignedTeams.push(...sortedUnassigned);
    }

    return { divisionStandings, unassignedTeams };
  };

  const { divisionStandings, unassignedTeams } = generateDivisionStandings();

  return (
    <Box sx={{ 
      pb: 2,
      px: { xs: 2, sm: 2, md: 2 },
    }}>
      {/* League Header - Compact Newspaper Nav */}
      <Box 
        sx={{ 
          border: '2px solid var(--ink-black)',
          mb: 2,
          backgroundColor: '#fff',
          px: { xs: 1.5, md: 2 },
          py: { xs: 1, md: 1.5 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: { xs: 1, md: 2 },
          flexWrap: 'wrap'
        }}
      >
        {/* League Name & Season */}
        <Stack 
          direction="row" 
          spacing={1.5} 
          alignItems="center" 
          sx={{ flex: 1, minWidth: { xs: '100%', sm: 'auto' } }}
        >
          <Typography 
            level="h4" 
            sx={{ 
              fontFamily: '"Libre Baskerville", Georgia, serif',
              fontWeight: 700,
              fontSize: { xs: '1.1rem', md: '1.3rem' },
              textTransform: 'uppercase',
              letterSpacing: '0.02em'
            }}
          >
            {league.name || 'Unnamed League'}
          </Typography>
          <Chip 
            size="sm"
            color={getSeasonPhaseColor(seasonPhase) as any} 
            variant="solid"
            sx={{ 
              fontWeight: 600,
              fontSize: { xs: '0.7rem', md: '0.75rem' }
            }}
          >
            {getWeekDisplayText(currentWeek, seasonPhase)}
          </Chip>
        </Stack>
        
        {/* Quick Stats */}
        <Stack 
          direction="row" 
          spacing={{ xs: 2, md: 3 }}
          alignItems="center"
          sx={{ 
            fontSize: '0.85rem',
            '& > div': {
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }
          }}
        >
          <Box>
            <Typography level="body-xs" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
              Teams:
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              {league.max_teams}
            </Typography>
          </Box>
          {league.salary_cap_enabled && (
            <Box>
              <Typography level="body-xs" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                Cap:
              </Typography>
              <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                ${(league.salary_cap_amount || 200000000) / 1000000}M
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>


      <Grid container spacing={3}>
        {/* Left Column - Matchups, Standings, and Commish Notes */}
        <Grid xs={12} lg={8}>
          <Stack spacing={3}>
            {/* Commissioner Notes */}
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography 
                    level="h4" 
                    sx={{ 
                      fontWeight: 'bold',
                      fontFamily: '"Libre Baskerville", Georgia, serif'
                    }}
                  >
                    Commish Notes
                  </Typography>
                  {isCommissioner && !editingNotes && (
                    <IconButton
                      size="sm"
                      variant="plain"
                      onClick={() => setEditingNotes(true)}
                      title="Edit commissioner notes"
                    >
                      <Edit />
                    </IconButton>
                  )}
                </Stack>
                
                {editingNotes ? (
                  <Stack spacing={2}>
                    <Textarea
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      minRows={4}
                      placeholder="Add a note for all league members..."
                      sx={{
                        fontFamily: '"Crimson Text", Georgia, serif',
                        fontSize: '1rem'
                      }}
                    />
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={updateNotesMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="solid"
                        size="sm"
                        onClick={handleSaveNotes}
                        loading={updateNotesMutation.isPending}
                      >
                        Save
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <>
                    {notesText ? (
                      <Alert color="primary">
                        <Typography 
                          level="body-sm"
                          sx={{
                            fontFamily: '"Crimson Text", Georgia, serif',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {notesText}
                        </Typography>
                      </Alert>
                    ) : (
                      <Alert color="neutral">
                        <Typography level="body-sm" sx={{ fontStyle: 'italic' }}>
                          {isCommissioner 
                            ? 'Click the edit icon to add a note for all league members.'
                            : 'No commissioner notes at this time.'}
                        </Typography>
                      </Alert>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
            {/* Matchups Section - Only show during regular season and playoffs */}
            {seasonPhase !== 'preseason' && seasonPhase !== 'offseason' && (
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {getWeekDisplayText(currentWeek, seasonPhase)} Matchups
                    </Typography>
                  <Chip size="sm" color="neutral">Not started yet</Chip>
                </Stack>
                
                <Stack spacing={2}>
                  {matchups && matchups.length > 0 ? (
                    matchups.map((matchup) => (
                    <Sheet key={matchup.id} variant="outlined" sx={{ p: 2 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid xs={5}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.500', cursor: 'pointer' }} onClick={() => onTeamClick?.(matchup.fantasy_team1_id)}>
                              {matchup.team1?.team_name?.charAt(0) || '?'}
                            </Avatar>
                            <Box>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => onTeamClick?.(matchup.fantasy_team1_id)}>
                                {matchup.team1?.team_name || 'Team 1'}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {matchup.team1?.user_id ? 'Owner Assigned' : 'TBD'}
                              </Typography>
                            </Box>
                          </Stack>
                        </Grid>
                        <Grid xs={2} sx={{ textAlign: 'center' }}>
                          <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                            {matchup.fantasy_team1_score} - {matchup.fantasy_team2_score}
                          </Typography>
                          <Chip 
                            size="sm" 
                            color={matchup.status === 'completed' ? 'success' : 'neutral'}
                            sx={{ mt: 0.5 }}
                          >
                            {matchup.status === 'completed' ? 'Final' : 'Scheduled'}
                          </Chip>
                        </Grid>
                        <Grid xs={5}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => onTeamClick?.(matchup.fantasy_team2_id)}>
                                {matchup.team2?.team_name || 'Team 2'}
                              </Typography>
                              <Typography level="body-xs" color="neutral">
                                {matchup.team2?.user_id ? 'Owner Assigned' : 'TBD'}
                              </Typography>
                            </Box>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.500', cursor: 'pointer' }} onClick={() => onTeamClick?.(matchup.fantasy_team2_id)}>
                              {matchup.team2?.team_name?.charAt(0) || '?'}
                            </Avatar>
                          </Stack>
                        </Grid>
                      </Grid>
                    </Sheet>
                    ))
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography level="body-md" color="neutral">
                        No matchups scheduled for Week 1 yet.
                      </Typography>
                      <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                        The commissioner will generate the schedule once teams are set up.
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
            )}

            {/* Preseason Message */}
            {seasonPhase === 'preseason' && (
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar sx={{ bgcolor: 'warning.500' }}>
                      <EmojiEvents />
                    </Avatar>
                    <Box>
                      <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                        Preseason
                      </Typography>
                      <Typography level="body-md" color="neutral">
                        The regular season hasn't started yet. Matchups will appear once Week 1 begins on {currentWeek?.start_date}.
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Standings Section */}
            <Card>
              <CardContent>
                <Stack 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center" 
                  sx={{ mb: 2, cursor: { xs: 'pointer', md: 'default' } }}
                  onClick={() => window.innerWidth < 900 && setStandingsExpanded(!standingsExpanded)}
                >
                  <Typography 
                    level="h4" 
                    sx={{ 
                      fontWeight: 'bold',
                      fontFamily: '"Libre Baskerville", Georgia, serif'
                    }}
                  >
                    League Standings
                  </Typography>
                  <IconButton
                    size="sm"
                    variant="plain"
                    sx={{ display: { xs: 'flex', md: 'none' } }}
                  >
                    <ExpandMore 
                      sx={{ 
                        transform: standingsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s'
                      }}
                    />
                  </IconButton>
                </Stack>
                
                <Box sx={{ display: { xs: standingsExpanded ? 'block' : 'none', md: 'block' } }}>
                  <Stack spacing={3}>
                  {/* Division Standings */}
                  {divisionStandings.map(({ division, teams: divisionTeams }) => (
                    <Box key={division.id}>
                      <Typography level="title-md" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.600' }}>
                        {division.name}
                      </Typography>
                      <Table size="sm" hoverRow>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th style={{ textAlign: 'center' }}>W</th>
                            <th style={{ textAlign: 'center' }}>L</th>
                            <th style={{ textAlign: 'center' }}>PCT</th>
                            <th style={{ textAlign: 'center' }}>PF</th>
                            <th style={{ textAlign: 'center' }}>PA</th>
                            <th style={{ textAlign: 'center' }}>Streak</th>
                          </tr>
                        </thead>
                        <tbody>
                          {divisionTeams.map((team) => (
                            <tr key={team.rank} onClick={() => {
                              const found = teams?.find(t => t.team_name === team.team)
                              if (found) onTeamClick?.(found.id)
                            }} style={{ cursor: 'pointer' }}>
                              <td>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team.rank}
                                  </Typography>
                                  {team.rank <= 3 && (
                                    <EmojiEvents sx={{ fontSize: 16, color: team.rank === 1 ? 'gold' : team.rank === 2 ? 'silver' : '#CD7F32' }} />
                                  )}
                                </Stack>
                              </td>
                              <td>
                                <Box>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team.team}
                                  </Typography>
                                  <Typography level="body-xs" color="neutral">
                                    {team.owner}
                                  </Typography>
                                </Box>
                              </td>
                              <td style={{ textAlign: 'center' }}>{team.wins}</td>
                              <td style={{ textAlign: 'center' }}>{team.losses}</td>
                              <td style={{ textAlign: 'center' }}>{team.pct.toFixed(3)}</td>
                              <td style={{ textAlign: 'center' }}>{team.pointsFor.toFixed(1)}</td>
                              <td style={{ textAlign: 'center' }}>{team.pointsAgainst.toFixed(1)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <Chip 
                                  size="sm" 
                                  color={team.streak.startsWith('W') ? 'success' : 'danger'}
                                  variant="outlined"
                                >
                                  {team.streak}
                                </Chip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Box>
                  ))}

                  {/* Unassigned Teams */}
                  {unassignedTeams.length > 0 && (
                    <Box>
                      <Typography level="title-md" sx={{ fontWeight: 'bold', mb: 1, color: 'neutral.600' }}>
                        Unassigned Teams
                      </Typography>
                      <Table size="sm" hoverRow>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th style={{ textAlign: 'center' }}>W</th>
                            <th style={{ textAlign: 'center' }}>L</th>
                            <th style={{ textAlign: 'center' }}>PCT</th>
                            <th style={{ textAlign: 'center' }}>PF</th>
                            <th style={{ textAlign: 'center' }}>PA</th>
                            <th style={{ textAlign: 'center' }}>Streak</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unassignedTeams.map((team) => (
                            <tr key={team.rank} onClick={() => {
                              const found = teams?.find(t => t.team_name === team.team)
                              if (found) onTeamClick?.(found.id)
                            }} style={{ cursor: 'pointer' }}>
                              <td>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team.rank}
                                  </Typography>
                                </Stack>
                              </td>
                              <td>
                                <Box>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team.team}
                                  </Typography>
                                  <Typography level="body-xs" color="neutral">
                                    {team.owner}
                                  </Typography>
                                </Box>
                              </td>
                              <td style={{ textAlign: 'center' }}>{team.wins}</td>
                              <td style={{ textAlign: 'center' }}>{team.losses}</td>
                              <td style={{ textAlign: 'center' }}>{team.pct.toFixed(3)}</td>
                              <td style={{ textAlign: 'center' }}>{team.pointsFor.toFixed(1)}</td>
                              <td style={{ textAlign: 'center' }}>{team.pointsAgainst.toFixed(1)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <Chip 
                                  size="sm" 
                                  color={team.streak.startsWith('W') ? 'success' : 'danger'}
                                  variant="outlined"
                                >
                                  {team.streak}
                                </Chip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Box>
                  )}

                  {/* No divisions message */}
                  {divisionStandings.length === 0 && unassignedTeams.length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography level="body-md" color="neutral">
                        No teams found in standings.
                      </Typography>
                    </Box>
                  )}
                  </Stack>
                </Box>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                    Recent Transactions
                  </Typography>
                  <Button 
                    size="sm" 
                    variant="outlined"
                    onClick={onNavigateToTransactions}
                  >
                    View All
                  </Button>
                </Stack>
                
                {recentTransactions.length > 0 ? (
                  <List>
                    {recentTransactions.map((transaction: any) => {
                      const teamName = transaction.fantasy_team?.team_name || 'Unknown Team';
                      const playerData = transaction.player;
                      const transactionTime = transaction.transaction_date 
                        ? new Date(transaction.transaction_date).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })
                        : 'Recently';
                      const isAdd = transaction.transaction_type === 'add';
                      
                      return (
                        <ListItem key={transaction.id} sx={{ alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider', pb: 2, mb: 2 }}>
                          <ListItemDecorator sx={{ mt: 0.5 }}>
                            <Avatar sx={{ 
                              bgcolor: isAdd ? 'success.500' : 'danger.500',
                              width: 36,
                              height: 36
                            }}>
                              {isAdd ? '+' : '−'}
                            </Avatar>
                          </ListItemDecorator>
                          <ListItemContent>
                            <Stack spacing={1}>
                              {/* Transaction Header */}
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                  {teamName} {isAdd ? 'added' : 'dropped'}
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip size="sm" color={isAdd ? 'success' : 'danger'} variant="soft">
                                    {isAdd ? '+ Added' : '− Dropped'}
                                  </Chip>
                                  <Typography level="body-xs" color="neutral">
                                    {transactionTime}
                                  </Typography>
                                </Stack>
                              </Stack>
                              
                              {/* Player Details */}
                              {playerData && (
                                <Box 
                                  onClick={() => navigate(`/players/${playerData.id}`)}
                                  sx={{ 
                                    bgcolor: 'background.level1', 
                                    p: 1.5, 
                                    borderRadius: 'sm',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'primary.50' },
                                    transition: 'background-color 0.2s'
                                  }}
                                >
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Avatar 
                                      size="sm" 
                                      src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerData.nba_player_id}.png`}
                                      sx={{ width: 32, height: 32 }}
                                    >
                                      {playerData.name?.charAt(0)}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                        {playerData.name}
                                      </Typography>
                                      <Typography level="body-xs" color="neutral">
                                        {playerData.position} • {playerData.team_abbreviation}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </Box>
                              )}
                            </Stack>
                          </ListItemContent>
                        </ListItem>
                      );
                    })}
                  </List>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography level="body-md" color="neutral">
                      No transactions yet
                    </Typography>
                    <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                      Player adds and drops will appear here
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Right Column - NBA Scoreboard and Salary Table */}
        <Grid xs={12} lg={4}>
          <Stack spacing={3}>
            {/* NBA Scoreboard */}
            <Card>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  NBA Scoreboard
                </Typography>
                
                {scoreboardLoading ? (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <LinearProgress />
                    <Typography level="body-sm" sx={{ mt: 1 }}>
                      Loading NBA games...
                    </Typography>
                  </Box>
                ) : scoreboardError ? (
                  <Alert color="warning">
                    <Typography level="body-sm">
                      Unable to load NBA games. Showing mock data.
                    </Typography>
                  </Alert>
                ) : nbaScoreboard && nbaScoreboard.games.length > 0 ? (
                  <Stack spacing={2}>
                    {nbaScoreboard.games.map((game) => (
                      <Sheet key={game.gameId} variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                          <Typography level="body-xs" color="neutral">
                            {game.gameStatus === 1 ? 'Scheduled' : 
                             game.gameStatus === 2 ? 'Live' : 'Final'}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {game.gameStatusText}
                          </Typography>
                        </Stack>
                        <Grid container spacing={1} alignItems="center">
                          <Grid xs={5}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.500', fontSize: '0.7rem' }}>
                                {game.awayTeam.abbreviation}
                              </Avatar>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {game.awayTeam.name}
                              </Typography>
                            </Stack>
                          </Grid>
                          <Grid xs={2} sx={{ textAlign: 'center' }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {game.awayTeam.points}
                            </Typography>
                          </Grid>
                          <Grid xs={5}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                {game.homeTeam.name}
                              </Typography>
                              <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.500', fontSize: '0.7rem' }}>
                                {game.homeTeam.abbreviation}
                              </Avatar>
                            </Stack>
                          </Grid>
                        </Grid>
                        <Grid container spacing={1} sx={{ mt: 0.5 }}>
                          <Grid xs={5}></Grid>
                          <Grid xs={2} sx={{ textAlign: 'center' }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {game.homeTeam.points}
                            </Typography>
                          </Grid>
                          <Grid xs={5}></Grid>
                        </Grid>
                        {game.arena && game.arena !== 'Unknown Arena' && (
                          <Typography level="body-xs" color="neutral" sx={{ mt: 1, textAlign: 'center' }}>
                            {game.arena}
                          </Typography>
                        )}
                      </Sheet>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography level="body-md" color="neutral">
                      No NBA games scheduled for today.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Salary Table - Only show if league has salary cap enabled */}
            {league.salary_cap_enabled && (
              <Card>
                <CardContent>
                  <Stack 
                    direction="row" 
                    justifyContent="space-between" 
                    alignItems="center" 
                    sx={{ mb: 2, cursor: { xs: 'pointer', md: 'default' } }}
                    onClick={() => window.innerWidth < 900 && setSalaryCapExpanded(!salaryCapExpanded)}
                  >
                    <Typography 
                      level="h4" 
                      sx={{ 
                        fontWeight: 'bold',
                        fontFamily: '"Libre Baskerville", Georgia, serif'
                      }}
                    >
                      League Salary Cap
                    </Typography>
                    <IconButton
                      size="sm"
                      variant="plain"
                      sx={{ display: { xs: 'flex', md: 'none' } }}
                    >
                      <ExpandMore 
                        sx={{ 
                          transform: salaryCapExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s'
                        }}
                      />
                    </IconButton>
                  </Stack>
                  
                  <Box sx={{ display: { xs: salaryCapExpanded ? 'block' : 'none', md: 'block' } }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                        League Cap: ${(league.salary_cap_amount || 200000000) / 1000000}M
                      </Typography>
                      {teamSalaryData && Object.keys(teamSalaryData).length > 0 && (
                        <Typography level="body-xs" color="neutral">
                          {Object.keys(teamSalaryData).length} teams with salary data
                        </Typography>
                      )}
                    </Box>
                    
                    <Table size="sm" hoverRow>
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th style={{ textAlign: 'right' }}>Used</th>
                        <th style={{ textAlign: 'right' }}>Available</th>
                        <th style={{ textAlign: 'right' }}>% Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams && teams.length > 0 ? (
                        teams
                          .sort((a, b) => {
                            const aSalary = teamSalaryData?.[a.id] || 0;
                            const bSalary = teamSalaryData?.[b.id] || 0;
                            return bSalary - aSalary; // Sort by salary used (highest first)
                          })
                          .map((team) => {
                            const salaryCapMax = league.salary_cap_amount || 200000000;
                            const used = teamSalaryData?.[team.id] || 0;
                            const available = salaryCapMax - used;
                            const percentUsed = (used / salaryCapMax) * 100;
                            
                            return (
                              <tr 
                                key={team.id} 
                                onClick={() => onTeamClick?.(team.id)} 
                                style={{ cursor: 'pointer' }}
                              >
                                <td>
                                  <Box>
                                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                      {team.team_name}
                                    </Typography>
                                    <Typography level="body-xs" color="neutral">
                                      {team.user_id ? 'Owner Assigned' : 'TBD'}
                                    </Typography>
                                  </Box>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    ${(used / 1000000).toFixed(1)}M
                                  </Typography>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Typography 
                                    level="body-sm" 
                                    sx={{ 
                                      fontWeight: 'bold',
                                      color: available < 0 ? 'danger.500' : 'success.500'
                                    }}
                                  >
                                    ${(available / 1000000).toFixed(1)}M
                                  </Typography>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Chip 
                                    size="sm" 
                                    color={percentUsed > 90 ? 'danger' : percentUsed > 75 ? 'warning' : 'success'}
                                    variant="outlined"
                                  >
                                    {percentUsed.toFixed(1)}%
                                  </Chip>
                                </td>
                              </tr>
                            );
                          })
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>
                            <Typography level="body-sm" color="neutral">
                              No teams found
                            </Typography>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Waivers */}
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography 
                    level="h4" 
                    sx={{ 
                      fontWeight: 'bold',
                      fontFamily: '"Libre Baskerville", Georgia, serif'
                    }}
                  >
                    🕐 Waivers
                  </Typography>
                  <Chip 
                    size="sm" 
                    variant="soft" 
                    color="warning"
                  >
                    {waiverPlayers.length}
                  </Chip>
                </Stack>
                
                <Tabs value={waiverTab} onChange={(e, newValue) => setWaiverTab(newValue as number)}>
                  <TabList>
                    <Tab>Players</Tab>
                    <Tab>
                      {leagueData?.waiver_type === 'faab' ? 'Budgets' : 'Order'}
                    </Tab>
                    {userTeam && <Tab>Claims ({pendingClaims.length})</Tab>}
                  </TabList>
                  
                  {/* Tab 1: Players on Waivers */}
                  <TabPanel value={0} sx={{ p: 0, pt: 2 }}>
                    {waiversLoading ? (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <LinearProgress />
                        <Typography level="body-sm" sx={{ mt: 1 }}>
                          Loading waivers...
                        </Typography>
                      </Box>
                    ) : waiverPlayers.length > 0 ? (
                      <Stack spacing={2}>
                        {waiverPlayers.map((waiver: any) => {
                          const player = waiver.nba_players;
                          const droppedByTeam = waiver.fantasy_teams?.team_name || 'Unknown Team';
                          const becomesFA = new Date(waiver.becomes_free_agent_at);
                          const now = new Date();
                          const hoursRemaining = Math.max(0, Math.ceil((becomesFA.getTime() - now.getTime()) / (1000 * 60 * 60)));
                          const minutesRemaining = Math.max(0, Math.ceil((becomesFA.getTime() - now.getTime()) / (1000 * 60)));
                          
                          const timeDisplay = hoursRemaining > 0 
                            ? `${hoursRemaining}h` 
                            : minutesRemaining > 0 
                            ? `${minutesRemaining}m` 
                            : 'Clearing...';
                          
                          return (
                            <Sheet 
                              key={waiver.id} 
                              variant="outlined" 
                              sx={{ 
                                p: 2,
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'background.level1' },
                                transition: 'background-color 0.2s'
                              }}
                              onClick={() => {
                                setSelectedWaiverPlayer({ ...player, waiver });
                                setWaiverModalOpen(true);
                              }}
                            >
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar 
                                  src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                                  sx={{ width: 40, height: 40 }}
                                >
                                  {player.name?.charAt(0)}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {player.name}
                                  </Typography>
                                  <Typography level="body-xs" color="neutral">
                                    {player.position} • {player.team_abbreviation}
                                  </Typography>
                                  <Typography level="body-xs" color="neutral" sx={{ mt: 0.5 }}>
                                    Dropped by {droppedByTeam}
                                  </Typography>
                                </Box>
                                <Stack alignItems="flex-end" spacing={0.5}>
                                  <Chip 
                                    size="sm" 
                                    color="warning"
                                    variant="solid"
                                  >
                                    {timeDisplay}
                                  </Chip>
                                  <Typography level="body-xs" color="neutral">
                                    remaining
                                  </Typography>
                                </Stack>
                              </Stack>
                            </Sheet>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography level="body-md" color="neutral">
                          No players on waivers
                        </Typography>
                        <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                          Dropped players will appear here during their waiver period
                        </Typography>
                      </Box>
                    )}
                  </TabPanel>
                  
                  {/* Tab 2: Waiver Order or FAAB Budgets */}
                  <TabPanel value={1} sx={{ p: 0, pt: 2 }}>
                    {waiverOrderLoading ? (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <LinearProgress />
                        <Typography level="body-sm" sx={{ mt: 1 }}>
                          Loading waiver {leagueData?.waiver_type === 'faab' ? 'budgets' : 'order'}...
                        </Typography>
                      </Box>
                    ) : waiverOrder.length > 0 ? (
                      <Table size="sm" hoverRow>
                        <thead>
                          <tr>
                            {leagueData?.waiver_type !== 'faab' && <th style={{ width: '60px' }}>Priority</th>}
                            <th>Team</th>
                            {leagueData?.waiver_type === 'faab' ? (
                              <>
                                <th style={{ textAlign: 'right' }}>Remaining</th>
                                <th style={{ textAlign: 'right' }}>Spent</th>
                              </>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {waiverOrder.map((order: any) => {
                            const team = order.fantasy_teams;
                            const isFAAB = leagueData?.waiver_type === 'faab';
                            
                            return (
                              <tr 
                                key={order.id}
                                onClick={() => team?.id && onTeamClick?.(team.id)}
                                style={{ cursor: 'pointer' }}
                              >
                                {!isFAAB && (
                                  <td>
                                    <Chip 
                                      size="sm" 
                                      color="primary" 
                                      variant="solid"
                                    >
                                      #{order.waiver_priority}
                                    </Chip>
                                  </td>
                                )}
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {team?.team_name || 'Unknown Team'}
                                  </Typography>
                                </td>
                                {isFAAB && (
                                  <>
                                    <td style={{ textAlign: 'right' }}>
                                      <Chip 
                                        size="sm" 
                                        color="success" 
                                        variant="soft"
                                      >
                                        ${order.remaining_budget || 0}
                                      </Chip>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <Typography level="body-sm" color="neutral">
                                        ${order.total_spent || 0}
                                      </Typography>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography level="body-md" color="neutral">
                          No waiver {leagueData?.waiver_type === 'faab' ? 'budget' : 'order'} data
                        </Typography>
                        <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                          {isCommissioner 
                            ? 'Run "Initialize Waiver Order" in Commissioner Tools to set up.'
                            : 'The commissioner needs to initialize waiver settings.'}
                        </Typography>
                      </Box>
                    )}
                  </TabPanel>
                  
                  {/* Tab 3: My Claims */}
                  {userTeam && (
                    <TabPanel value={2} sx={{ p: 0, pt: 2 }}>
                      {claimsLoading ? (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                          <LinearProgress />
                          <Typography level="body-sm" sx={{ mt: 1 }}>
                            Loading claims...
                          </Typography>
                        </Box>
                      ) : pendingClaims.length > 0 ? (
                        <Stack spacing={2}>
                          {pendingClaims.map((claim: any) => {
                            const player = claim.nba_players;
                            const playerToDrop = claim.player_to_drop;
                            const isFAAB = leagueData?.waiver_type === 'faab';
                            
                            return (
                              <Sheet 
                                key={claim.id} 
                                variant="outlined" 
                                sx={{ p: 2 }}
                              >
                                <Stack spacing={2}>
                                  {/* Header */}
                                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Stack direction="row" spacing={2} alignItems="center">
                                      <Avatar 
                                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                                        sx={{ width: 40, height: 40 }}
                                      >
                                        {player.name?.charAt(0)}
                                      </Avatar>
                                      <Box>
                                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                          {player.name}
                                        </Typography>
                                        <Typography level="body-xs" color="neutral">
                                          {player.position} • {player.team_abbreviation}
                                        </Typography>
                                      </Box>
                                    </Stack>
                                    
                                    <Stack alignItems="flex-end" spacing={0.5}>
                                      {isFAAB && (
                                        <Chip size="sm" color="success" variant="solid">
                                          ${claim.bid_amount}
                                        </Chip>
                                      )}
                                      {!isFAAB && (
                                        <Chip size="sm" color="primary" variant="solid">
                                          Priority #{claim.priority}
                                        </Chip>
                                      )}
                                      <Typography level="body-xs" color="neutral">
                                        {formatDistanceToNow(new Date(claim.submitted_at), { addSuffix: true })}
                                      </Typography>
                                    </Stack>
                                  </Stack>
                                  
                                  {/* Player to drop */}
                                  {playerToDrop && (
                                    <Box sx={{ bgcolor: 'background.level1', p: 1.5, borderRadius: 'sm' }}>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography level="body-xs" color="neutral">
                                          Dropping:
                                        </Typography>
                                        <Avatar 
                                          size="sm"
                                          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerToDrop.nba_player_id}.png`}
                                          sx={{ width: 24, height: 24 }}
                                        >
                                          {playerToDrop.name?.charAt(0)}
                                        </Avatar>
                                        <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>
                                          {playerToDrop.name}
                                        </Typography>
                                        <Typography level="body-xs" color="neutral">
                                          ({playerToDrop.position})
                                        </Typography>
                                      </Stack>
                                    </Box>
                                  )}
                                  
                                  {/* Cancel button */}
                                  <Button
                                    size="sm"
                                    variant="outlined"
                                    color="danger"
                                    onClick={() => {
                                      if (confirm(`Cancel claim for ${player.name}?`)) {
                                        cancelClaimMutation.mutate({
                                          claimId: claim.id,
                                          leagueId,
                                          fantasyTeamId: userTeam.id
                                        });
                                      }
                                    }}
                                    loading={cancelClaimMutation.isPending}
                                  >
                                    Cancel Claim
                                  </Button>
                                </Stack>
                              </Sheet>
                            );
                          })}
                        </Stack>
                      ) : (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                          <Typography level="body-md" color="neutral">
                            No pending claims
                          </Typography>
                          <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                            Click on a player in the "Players" tab to submit a waiver claim
                          </Typography>
                        </Box>
                      )}
                    </TabPanel>
                  )}
                </Tabs>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

        {/* Waiver Claim Modal */}
        {selectedWaiverPlayer && userTeam && (
          <WaiverClaimModal
            open={waiverModalOpen}
            onClose={() => {
              setWaiverModalOpen(false);
              setSelectedWaiverPlayer(null);
            }}
            player={selectedWaiverPlayer}
            leagueId={leagueId}
            seasonId={(league as any)?.season_id || (league as any)?.current_season_id || teams?.[0]?.season_id || ''}
            fantasyTeamId={userTeam.id}
            waiverType={(league as any)?.waiver_type || 'rolling'}
            waiverBudgetAmount={(league as any)?.waiver_budget_amount || 100}
            waiverMinBid={(league as any)?.waiver_min_bid || 0}
            becomesFreAgent={selectedWaiverPlayer.waiver?.becomes_free_agent_at ? new Date(selectedWaiverPlayer.waiver.becomes_free_agent_at) : undefined}
          />
        )}
    </Box>
  );
}
