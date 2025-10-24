import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Alert,
  LinearProgress,
  Chip,
  Button,
} from '@mui/joy';
import { useParams } from 'react-router-dom';
import DraftBottomNav from './DraftBottomNav';
import DraftRoster from './DraftRoster';
import DraftPlayers from './DraftPlayers';
import DraftBestAvailable from './DraftBestAvailable';
import DraftPicks from './DraftPicks';
import DraftTrade from './DraftTrade';
import DraftChat from './DraftChat';
import DraftRules from './DraftRules';
import DraftCommish from './DraftCommish';
import DraftLobby from './DraftLobby';
import DraftPicksCarousel from './DraftPicksCarousel';
import AutodraftToggle from './AutodraftToggle';
import { useAuth } from '../../hooks/useAuth';
import { useLeague } from '../../hooks/useLeagues';
import { useTeams } from '../../hooks/useTeams';
import { useJoinDraftLobby, useUpdateLobbyStatus } from '../../hooks/useDraftLobby';
import { useNextPick } from '../../hooks/useNextPick';
import { useDraftOrder } from '../../hooks/useDraftOrder';
import { useDraftState } from '../../hooks/useDraftState';
import { useStartDraft } from '../../hooks/useStartDraft';
import { useDraftSounds } from '../../hooks/useDraftSounds';
import { supabase } from '../../utils/supabase';

export default function DraftComponent() {
  const { id: leagueId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: league, isLoading: leagueLoading } = useLeague(leagueId || '');
  const { data: teams } = useTeams(leagueId || '');
  const joinLobby = useJoinDraftLobby();
  const updateLobbyStatus = useUpdateLobbyStatus();
  const { data: nextPick } = useNextPick(leagueId || '');
  const { data: draftOrder } = useDraftOrder(leagueId || '');
  const { data: draftState } = useDraftState(leagueId || '');
  const startDraft = useStartDraft();
  const { playSwish, playBallBounce } = useDraftSounds();
  const [activeTab, setActiveTab] = useState(0);
  const [timeUntilDraft, setTimeUntilDraft] = useState<string>('');
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [tradeContext, setTradeContext] = useState<{
    teamId: string;
    teamName: string;
    asset: {
      type: 'player' | 'pick';
      playerId?: number;
      playerName?: string;
      position?: string;
      nbaPlayerId?: number;
      pickNumber?: number;
      round?: number;
    };
  } | null>(null);

  // Track previous pick count for swish sound
  const prevCompletedPicksRef = useRef<number>(0);
  // Track previous current pick number for ball bounce sound
  const prevCurrentPickRef = useRef<number | null>(null);

  // Check if user is commissioner
  const isCommissioner = league?.commissioner_id === user?.id;

  // Find user's team
  const userTeam = teams?.find(team => team.user_id === user?.id);

  // Handler to initiate trade from carousel
  const handleInitiateTrade = (pick: any) => {
    if (!teams) return;
    
    // Find the team that owns this pick
    // ✅ Use current_owner_id to handle traded picks correctly
    const ownerId = pick.current_owner_id || pick.team_id;
    const owningTeam = teams.find(t => t.id === ownerId);
    if (!owningTeam) return;

    // Build trade context based on whether pick is completed
    if (pick.is_completed && pick.player_id) {
      // Trading a drafted player
      setTradeContext({
        teamId: owningTeam.id,
        teamName: owningTeam.team_name,
        asset: {
          type: 'player',
          playerId: pick.player_id,
          playerName: pick.player_name,
          position: pick.position,
          nbaPlayerId: pick.nba_player_id,
        }
      });
    } else {
      // Trading a future pick
      setTradeContext({
        teamId: owningTeam.id,
        teamName: owningTeam.team_name,
        asset: {
          type: 'pick',
          pickNumber: pick.pick_number,
          round: pick.round,
        }
      });
    }

    // Switch to trade tab (index 4)
    setActiveTab(4);
  };

  // Auto-join lobby when component mounts
  useEffect(() => {
    if (userTeam && leagueId && !joinLobby.isPending) {
      joinLobby.mutate({
        leagueId,
        fantasyTeamId: userTeam.id
      });
    }
  }, [userTeam, leagueId]);

  // Update lobby status periodically to show as online
  useEffect(() => {
    if (userTeam && leagueId) {
      const interval = setInterval(() => {
        updateLobbyStatus.mutate({ leagueId });
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [userTeam, leagueId]);

  // Get draft start time from draft state (fantasy_league_seasons.draft_date)
  // This is the ACTUAL draft start time, not the old fantasy_leagues.draft_date
  const draftStartTime = draftState?.draft_date ? new Date(draftState.draft_date) : null;
  
  // Debug: Log timezone info
  useEffect(() => {
    if (draftState?.draft_date) {
      const now = new Date();
      const draftDate = new Date(draftState.draft_date);
      console.log('🕐 Timezone Debug:', {
        rawDraftDate: draftState.draft_date,
        parsedDraftDate: draftDate.toString(),
        draftDateISO: draftDate.toISOString(),
        draftDateLocal: draftDate.toLocaleString(),
        now: now.toString(),
        nowISO: now.toISOString(),
        nowLocal: now.toLocaleString(),
        timezoneOffset: now.getTimezoneOffset(),
        timeDiff: draftDate.getTime() - now.getTime(),
        timeDiffMinutes: (draftDate.getTime() - now.getTime()) / 1000 / 60
      });
    }
  }, [draftState?.draft_date]);
  
  // Calculate current pick information
  const currentPickInfo = useMemo(() => {
    if (!draftOrder || draftOrder.length === 0) {
      return { currentPick: 1, currentRound: 1, totalPicks: 12, timeRemaining: '2:00' };
    }
    
    const nextPick = draftOrder.find(pick => !pick.is_completed);
    const currentPick = nextPick?.pick_number || draftOrder.length + 1;
    const currentRound = nextPick?.round || 1;
    const totalPicks = draftOrder.length;
    
    // Mock time remaining for now - this would come from draft settings
    const timeRemaining = '2:00';
    
    return { currentPick, currentRound, totalPicks, timeRemaining };
  }, [draftOrder]);
  
  // Determine if draft has started (check actual draft status, not just time)
  const isDraftStarted = useMemo(() => {
    // Check if draft is actually in progress in the database
    return draftState?.draft_status === 'in_progress';
  }, [draftState]);

  // 🔊 SOUND EFFECTS: Play swish when a pick is made
  useEffect(() => {
    if (!draftOrder || !isDraftStarted) return;

    const completedPicks = draftOrder.filter(pick => pick.is_completed).length;
    
    // If picks increased (someone just drafted), play swish sound
    if (completedPicks > prevCompletedPicksRef.current && prevCompletedPicksRef.current > 0) {
      console.log('🏀 Playing swish sound - pick completed');
      playSwish();
    }
    
    prevCompletedPicksRef.current = completedPicks;
  }, [draftOrder, isDraftStarted, playSwish]);

  // 🔊 SOUND EFFECTS: Play ball bounce when it becomes user's turn
  useEffect(() => {
    if (!draftState || !userTeam || !isDraftStarted) return;

    const currentPickNumber = draftState.current_pick_number;
    
    // If current pick changed and is now the user's pick
    if (currentPickNumber !== prevCurrentPickRef.current && 
        prevCurrentPickRef.current !== null) {
      
      // Find the current pick to check if it's the user's team
      const currentPick = draftOrder?.find(pick => pick.pick_number === currentPickNumber);
      
      if (currentPick && currentPick.team_id === userTeam.id) {
        console.log('🏀 Playing ball bounce sound - it\'s your turn!');
        playBallBounce();
      }
    }
    
    prevCurrentPickRef.current = currentPickNumber;
  }, [draftState?.current_pick_number, userTeam, isDraftStarted, draftOrder, playBallBounce]);

  // Check if there are picks remaining to be made
  const hasPicksRemaining = useMemo(() => {
    if (!draftOrder || draftOrder.length === 0) return true;
    return draftOrder.some(pick => !pick.is_completed);
  }, [draftOrder]);

  // Note: Timer logic is now handled by the useDraftTimer hook in DraftPicksCarousel
  
  // Close lobby when draft actually starts
  useEffect(() => {
    if (isDraftStarted) {
      setIsLobbyOpen(false);
    }
  }, [isDraftStarted]);
  
  // Always show carousel
  const shouldShowCarousel = true;

  // Note: Global draft manager service now handles polling for ALL active drafts
  // This runs in the background even when users switch tabs or close the page
  // See src/services/draftManagerService.ts

  // Countdown timer effect - DISPLAY ONLY, does not trigger draft
  // Draft is triggered by pg_cron every minute checking draft_date
  useEffect(() => {
    if (!draftStartTime) {
      setTimeUntilDraft('Draft date not set');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const timeDiff = draftStartTime.getTime() - now.getTime();

      // If time has expired, stop updating (component will hide countdown section)
      if (timeDiff <= 0) {
        setTimeUntilDraft('0s');
        return;
      }

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeUntilDraft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setTimeUntilDraft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeUntilDraft(`${minutes}m ${seconds}s`);
      } else {
        setTimeUntilDraft(`${seconds}s`);
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second for accurate countdown
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [draftStartTime]);

  // Check if draft is complete (no more picks available)
  useEffect(() => {
    // Draft completion is now handled by the header status
  }, [nextPick, leagueId]);

  if (leagueLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <LinearProgress />
        <Typography sx={{ ml: 2 }}>Loading draft...</Typography>
      </Box>
    );
  }

  if (!league) {
    return (
      <Alert color="danger">
        <Typography>League not found.</Typography>
      </Alert>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return <DraftRoster leagueId={leagueId || ''} />;
      case 1:
        return <DraftPlayers leagueId={leagueId || ''} />;
      case 2:
        return <DraftBestAvailable leagueId={leagueId || ''} />;
      case 3:
        return <DraftPicks leagueId={leagueId || ''} userTeamId={userTeam?.id} />;
      case 4:
        return <DraftTrade leagueId={leagueId || ''} tradeContext={tradeContext} onClearContext={() => setTradeContext(null)} isCommissioner={isCommissioner} />;
      case 5:
        return <DraftChat leagueId={leagueId || ''} />;
      case 6:
        return <DraftRules leagueId={leagueId || ''} />;
      case 7:
        return isCommissioner ? <DraftCommish leagueId={leagueId || ''} /> : null;
      default:
        return <DraftRoster leagueId={leagueId || ''} />;
    }
  };

  // Show lobby if it's open
  if (isLobbyOpen) {
    return (
      <Box sx={{ 
        minHeight: 'calc(100vh - 200px)',
        pb: '100px', // Space for fixed bottom nav
        bgcolor: 'background.body'
      }}>
        <DraftLobby 
          leagueId={leagueId || ''} 
          onStartDraft={() => setIsLobbyOpen(false)}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: 'calc(100vh - 200px)', // Adjust for league header
      pb: '100px', // Space for fixed bottom nav
      bgcolor: 'background.body'
    }}>
      {/* Compact Draft Status Bar - Always visible */}
      <Box 
        sx={{ 
          position: 'sticky',
          top: 0,
          zIndex: 999,
          bgcolor: 'background.surface',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 1,
          px: 2,
          mb: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '100%' }}>
          {/* Left: League name and draft info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
            <Typography level="title-sm" sx={{ fontWeight: 'bold', color: 'primary.600' }}>
              🏀 {league.name}
            </Typography>
            <Typography level="body-xs" color="neutral" sx={{ whiteSpace: 'nowrap' }}>
              Round {currentPickInfo.currentRound} • Pick {currentPickInfo.currentPick} of {currentPickInfo.totalPicks}
            </Typography>
            {isDraftStarted && userTeam && (
              <AutodraftToggle 
                leagueId={leagueId || ''} 
                teamId={userTeam.id}
                isCommissioner={isCommissioner}
                size="sm"
              />
            )}
            {isDraftStarted && !hasPicksRemaining && (
              <Typography level="body-xs" color="success" sx={{ whiteSpace: 'nowrap' }}>
                • Completed
              </Typography>
            )}
            {isDraftStarted && hasPicksRemaining && (
              <Typography level="body-xs" color="success" sx={{ whiteSpace: 'nowrap' }}>
                • Draft in progress
              </Typography>
            )}
          </Box>

          {/* Right: Draft timing info - Only show countdown BEFORE draft starts */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {!isDraftStarted && draftStartTime && (
              <>
                <Typography level="body-xs" color="neutral">
                  Starts in:
                </Typography>
                <Chip 
                  color="primary" 
                  variant="soft" 
                  size="sm"
                  sx={{ 
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    height: '20px',
                    px: 1
                  }}
                >
                  {timeUntilDraft}
                </Chip>
              </>
            )}
            {!isDraftStarted && !draftStartTime && (
              <Chip 
                color="warning" 
                variant="soft" 
                size="sm"
                sx={{ 
                    fontWeight: 'bold',
                    fontSize: '0.75rem',
                    height: '20px',
                    px: 1
                }}
              >
                Not scheduled
              </Chip>
            )}
            
            {/* Auto-Complete Button - Only show for commissioners when draft hasn't started */}
            {isCommissioner && !isDraftStarted && hasPicksRemaining && (
              <Button
                size="sm"
                color="warning"
                variant="solid"
                onClick={() => {
                  if (leagueId) {
                    startDraft.mutate(leagueId);
                  }
                }}
                loading={startDraft.isPending}
                title="Development Tool: Starts draft and enables auto-draft for all teams to test draft-manager functionality"
                sx={{ 
                  fontSize: '0.75rem',
                  height: '24px',
                  px: 1.5,
                  fontWeight: 'bold'
                }}
              >
                🤖 Auto-Complete
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Draft Picks Carousel - Always visible */}
      {shouldShowCarousel && (
        <Box sx={{ mb: 2 }}>
          <DraftPicksCarousel
            leagueId={leagueId || ''}
            currentPickNumber={currentPickInfo.currentPick}
            isDraftStarted={isDraftStarted}
            isCommissioner={isCommissioner}
            onInitiateTrade={handleInitiateTrade}
          />
        </Box>
      )}

      {/* Tab Content */}
      <Box sx={{ px: 2 }}>
        {renderTabContent()}
      </Box>

      {/* Bottom Navigation */}
      <DraftBottomNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        isCommissioner={isCommissioner}
        userTeamId={userTeam?.id}
        leagueId={leagueId}
      />

    </Box>
  );
}
