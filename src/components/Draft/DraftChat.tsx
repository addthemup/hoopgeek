import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Input,
  Button,
  Stack,
  Avatar,
  Chip,
  Divider,
  Alert,
  Grid,
} from '@mui/joy';
import { Send, Chat } from '@mui/icons-material';
import { useDraftChatMessages, useSendDraftChatMessage } from '../../hooks/useDraftChat';
import { useDraftLobbyParticipants, useUpdateLobbyStatus, useJoinDraftLobby } from '../../hooks/useDraftLobby';
import { useAuth } from '../../hooks/useAuth';
import { useTeams } from '../../hooks/useTeams';
import { useLeagueMembers } from '../../hooks/useLeagueMembers';
import { DraftUserList } from './DraftUserList';

interface DraftChatProps {
  leagueId: string;
}

export default function DraftChat({ leagueId }: DraftChatProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { data: messages, isLoading: messagesLoading, error: messagesError } = useDraftChatMessages(leagueId);
  const { data: participants } = useDraftLobbyParticipants(leagueId);
  const { data: teams } = useTeams(leagueId);
  const { data: leagueMembers } = useLeagueMembers(leagueId);
  const sendMessage = useSendDraftChatMessage();
  const updateLobbyStatus = useUpdateLobbyStatus();
  const joinLobby = useJoinDraftLobby();

  // Find user's team
  const userTeam = teams?.find(team => team.user_id === user?.id);
  const isUserInLobby = participants?.some(p => p.user_id === user?.id);

  // Debug logging
  console.log('🔍 DraftChat Debug:', {
    userId: user?.id,
    userTeam: userTeam?.id,
    userTeamName: userTeam?.team_name,
    participants: participants?.map(p => ({ userId: p.user_id, teamName: p.fantasy_team?.team_name })),
    isUserInLobby,
    leagueMembers: leagueMembers?.map(m => ({ userId: m.user_id, teamName: m.team_name, isOnline: m.is_online }))
  });

  // Auto-join lobby when component mounts if user has a team but isn't in lobby
  useEffect(() => {
    console.log('🔍 DraftChat Auto-join check:', {
      userTeam: !!userTeam,
      isUserInLobby,
      joinLobbyPending: joinLobby.isPending,
      shouldJoin: userTeam && !isUserInLobby && !joinLobby.isPending
    });
    
    if (userTeam && !isUserInLobby && !joinLobby.isPending) {
      console.log('🚀 Auto-joining draft lobby for user:', user?.id, 'team:', userTeam.id);
      joinLobby.mutate({ leagueId, fantasyTeamId: userTeam.id });
    }
  }, [userTeam, isUserInLobby, leagueId, joinLobby]);

  // Update lobby status periodically to show as online
  useEffect(() => {
    if (userTeam && isUserInLobby) {
      const interval = setInterval(() => {
        updateLobbyStatus.mutate({ leagueId });
      }, 30000); // Update every 30 seconds

      return () => clearInterval(interval);
    }
  }, [userTeam, isUserInLobby, leagueId]);

  // Count online members from league members data instead of participants
  const onlineCount = leagueMembers?.filter(member => member.is_online).length || 0;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !userTeam) return;

    try {
      await sendMessage.mutateAsync({
        leagueId,
        fantasyTeamId: userTeam.id,
        message: message.trim()
      });
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUserMention = (username: string) => {
    const mention = `@${username} `;
    setMessage(prev => prev + mention);
    inputRef.current?.focus();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const mention = e.dataTransfer.getData('text/plain');
    if (mention.startsWith('@')) {
      setMessage(prev => prev + mention + ' ');
      inputRef.current?.focus();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const getMessageTypeColor = (messageType: string) => {
    switch (messageType) {
      case 'system':
        return 'warning';
      case 'pick_announcement':
        return 'success';
      case 'trade_announcement':
        return 'primary';
      default:
        return 'neutral';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (messagesError) {
    return (
      <Alert color="danger" variant="soft">
        Error loading chat messages: {messagesError.message}
      </Alert>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Chat Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chat />
          <Typography level="h4">Draft Chat</Typography>
          <Chip size="sm" color="success" variant="soft">
            {onlineCount} online
          </Chip>
        </Stack>
      </Box>

      {/* Main Content Area */}
      <Box 
        sx={{ 
          flex: 1, 
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0 
        }}
      >
        <Grid container sx={{ flex: 1 }}>
        {/* User List - Left Column */}
        <Grid xs={3} sx={{ borderRight: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <DraftUserList 
            leagueId={leagueId} 
            onUserMention={handleUserMention}
          />
        </Grid>

        {/* Chat Area - Right Column */}
        <Grid xs={9} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Messages Area */}
          <Box 
            sx={{ 
              flex: 1, 
              overflowY: 'auto',
              overflowX: 'hidden',
              p: 2,
              minHeight: 0
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {messagesLoading ? (
              <Typography>Loading messages...</Typography>
            ) : messages && messages.length > 0 ? (
              <Stack spacing={2}>
                {messages.map((msg) => (
                  <Box key={msg.id}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                        {msg.fantasy_team?.team_name?.charAt(0) || '?'}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography level="body-sm" fontWeight="bold">
                            {msg.fantasy_team?.team_name || 'Unknown Team'}
                          </Typography>
                          {msg.message_type !== 'chat' && (
                            <Chip 
                              size="sm" 
                              color={getMessageTypeColor(msg.message_type)}
                              variant="soft"
                            >
                              {msg.message_type.replace('_', ' ')}
                            </Chip>
                          )}
                          <Typography level="body-xs" color="neutral">
                            {formatTime(msg.created_at)}
                          </Typography>
                        </Stack>
                        <Typography level="body-sm">
                          {msg.message}
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))}
                <div ref={messagesEndRef} />
              </Stack>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography level="body-md" color="neutral">
                  No messages yet. Start the conversation!
                </Typography>
                <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                  Drag usernames from the left to mention them
                </Typography>
              </Box>
            )}
          </Box>

          {/* Message Input */}
          <Box 
            sx={{ 
              p: 2, 
              borderTop: '1px solid', 
              borderColor: 'divider',
              flexShrink: 0,
              backgroundColor: 'background.surface'
            }}
          >
            <Stack direction="row" spacing={1}>
              <Input
                ref={inputRef}
                placeholder={userTeam ? `Message as ${userTeam.team_name}...` : 'Join a team to chat'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!userTeam || sendMessage.isPending}
                sx={{ flex: 1 }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || !userTeam || sendMessage.isPending}
                startDecorator={<Send />}
                loading={sendMessage.isPending}
              >
                Send
              </Button>
            </Stack>
          </Box>
        </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
