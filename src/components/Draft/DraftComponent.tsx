import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  LinearProgress,
  Chip,
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
import { useAuth } from '../../hooks/useAuth';
import { useLeague } from '../../hooks/useLeagues';
import { useTeams } from '../../hooks/useTeams';
import { useJoinDraftLobby, useUpdateLobbyStatus } from '../../hooks/useDraftLobby';
import { useNextPick } from '../../hooks/useNextPick';
import { useDraftOrder } from '../../hooks/useDraftOrder';
import PostDraftModal from '../PostDraftModal';

export default function DraftComponent() {
  const { id: leagueId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: league, isLoading: leagueLoading } = useLeague(leagueId || '');
  const { data: teams } = useTeams(leagueId || '');
  const joinLobby = useJoinDraftLobby();
  const updateLobbyStatus = useUpdateLobbyStatus();
  const { data: nextPick } = useNextPick(leagueId || '');
  const { data: draftOrder } = useDraftOrder(leagueId || '');
  const [activeTab, setActiveTab] = useState(0);
  const [timeUntilDraft, setTimeUntilDraft] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [showPostDraftModal, setShowPostDraftModal] = useState(false);

  // Check if user is commissioner
  const isCommissioner = league?.commissioner_id === user?.id;

  // Find user's team
  const userTeam = teams?.find(team => team.user_id === user?.id);

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

  // Get draft start time from league data
  const draftStartTime = league?.draft_date ? new Date(league.draft_date) : null;
  
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
  
  // Determine if draft has started
  const isDraftStarted = useMemo(() => {
    if (!draftStartTime) return false;
    return new Date() >= draftStartTime;
  }, [draftStartTime]);
  
  // Determine if we should show the carousel (within 1 hour of draft or draft started)
  const shouldShowCarousel = useMemo(() => {
    if (!draftStartTime) return false;
    
    const now = new Date();
    const timeDiff = draftStartTime.getTime() - now.getTime();
    const hoursUntilDraft = timeDiff / (1000 * 60 * 60);
    
    return hoursUntilDraft <= 1 || isDraftStarted;
  }, [draftStartTime, isDraftStarted]);

  // Countdown timer effect
  useEffect(() => {
    if (!draftStartTime) {
      setTimeUntilDraft('Draft date not set');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const timeDiff = draftStartTime.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setTimeUntilDraft('Draft Starting Now!');
        setIsLobbyOpen(false); // Close lobby when draft starts
        return;
      }

      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      // Open lobby when 1 hour or less remaining
      if (hours === 0 && minutes <= 60) {
        setIsLobbyOpen(true);
      }

      if (hours > 0) {
        setTimeUntilDraft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeUntilDraft(`${minutes}m ${seconds}s`);
      } else {
        setTimeUntilDraft(`${seconds}s`);
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [draftStartTime]);

  // Check if draft is complete (no more picks available)
  useEffect(() => {
    if (nextPick === null && leagueId) {
      // Draft is complete, show modal after a short delay
      const timer = setTimeout(() => {
        setShowPostDraftModal(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
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
        return <DraftPicks leagueId={leagueId || ''} />;
      case 4:
        return <DraftTrade leagueId={leagueId || ''} />;
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
      pb: '80px', // Space for bottom nav
      bgcolor: 'background.body'
    }}>
      {/* Draft Header - Only show when draft is more than 1 hour away */}
      {!shouldShowCarousel && (
        <Card variant="outlined" sx={{ mb: 2, borderRadius: 0 }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <Typography level="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
              🏀 {league.name} Draft
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography level="body-sm" color="neutral">
                Round {currentPickInfo.currentRound} • Pick {currentPickInfo.currentPick} of {currentPickInfo.totalPicks} • {currentPickInfo.timeRemaining} remaining
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
              <Typography level="body-sm" color="neutral">
                {draftStartTime ? 'Draft starts in:' : 'Draft date:'}
              </Typography>
              <Chip 
                color={draftStartTime ? "primary" : "warning"} 
                variant="soft" 
                size="sm"
                sx={{ fontWeight: 'bold' }}
              >
                {draftStartTime ? timeUntilDraft : 'Not scheduled'}
              </Chip>
            </Box>
            {draftStartTime && (
              <Typography level="body-xs" color="neutral" sx={{ mt: 1 }}>
                Scheduled for: {draftStartTime.toLocaleString()}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Draft Picks Carousel - Show when within 1 hour of draft or draft started */}
      {shouldShowCarousel && (
        <Box sx={{ mb: 2 }}>
          <DraftPicksCarousel
            leagueId={leagueId || ''}
            currentPickNumber={currentPickInfo.currentPick}
            timeRemaining={currentPickInfo.timeRemaining}
            isDraftStarted={isDraftStarted}
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
      />

      {/* Post-Draft Modal */}
      <PostDraftModal
        open={showPostDraftModal}
        onClose={() => setShowPostDraftModal(false)}
        leagueId={leagueId || ''}
      />
    </Box>
  );
}
