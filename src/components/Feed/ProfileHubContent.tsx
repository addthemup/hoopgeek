/**
 * Shared profile hub body: account, saved posts, messages entry, and profile tools modules.
 * Used on /profile and inside any layout drawer when "profile mode" replaces drawer content.
 */

import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  CircularProgress,
  Button,
  IconButton,
  Input,
} from '@mui/joy';
import dayjs, { Dayjs } from 'dayjs';
import { useMediaQuery } from '@mui/material';
import {
  BarChart3,
  Star,
  Trophy,
  Ticket,
  TrendingUp,
  TrendingDown,
  Users,
  UserCircle,
  PenSquare,
  Bookmark,
  MessageCircle,
  ArrowLeft,
  Send,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNBAScoreboard } from '../../hooks/useNBAScoreboard';
import { useStandings } from '../../hooks/useStandings';
import { getTodayEST } from '../../utils/nbaDateUtils';
import { supabase } from '../../utils/supabase';
import { renderFeedDrawerModule, type FeedDrawerModuleContext } from './FeedDrawerModules';
import { useProfileModuleVisibility, DEFAULT_PROFILE_MODULES } from '../../hooks/useProfileModuleVisibility';
import { useFeedDrawerRestoreOptional } from '../../contexts/FeedDrawerRestoreContext';
import {
  cancelFriendRequest,
  createOrGetDirectConversation,
  listBookmarkedPosts,
  listMyFriendRequests,
  listMyFriends,
  respondFriendRequest,
  searchUsersForSocial,
  sendConversationMessage,
  sendFriendRequest,
} from '../../pages/socialService';
import type { ActiveFilter } from '../../types/feed';

function getCurrentWeekBounds(): { start_date: string; end_date: string } {
  const todayEST = getTodayEST();
  const d = dayjs(todayEST);
  const start = d.startOf('isoWeek').format('YYYY-MM-DD');
  const end = d.endOf('isoWeek').format('YYYY-MM-DD');
  return { start_date: start, end_date: end };
}

const PROFILE_MODULE_META: Record<string, { label: string; icon: LucideIcon }> = {
  favorite_players: { label: 'Favorite players', icon: Star },
  dfs_pools: { label: 'DFS pools', icon: Trophy },
  slip_builder: { label: 'Slip builder', icon: Ticket },
  prop_predictions_over: { label: 'Props — Over', icon: TrendingUp },
  prop_predictions_under: { label: 'Props — Under', icon: TrendingDown },
  prop_predictions_team_confidence: { label: 'Props — Team confidence', icon: Users },
  prop_predictions_player_confidence: { label: 'Props — Player confidence', icon: UserCircle },
  prop_performance: { label: 'Prop performance', icon: BarChart3 },
  draft: { label: 'Draft', icon: PenSquare },
};

const CORE_PROFILE_TABS: Array<{ name: string; label: string; icon: LucideIcon }> = [
  { name: 'messages', label: 'Messages', icon: MessageCircle },
  // TODO(saved-posts): Re-enable Saved Posts tab/module in a follow-up pass.
  // { name: 'saved_posts', label: 'Saved posts', icon: Bookmark },
];

export function ProfileModulesTabs({
  isDrawer,
  userId,
  bookmarkedPosts,
  bookmarksLoading,
}: {
  isDrawer: boolean;
  userId: string;
  bookmarkedPosts: Array<{ id: string; slug: string; title: string; subtitle: string | null; post_type: string }>;
  bookmarksLoading: boolean;
}) {
  const isMobile = useMediaQuery('(max-width: 900px)');
  const todayEST = getTodayEST();
  const selectedDate = dayjs(todayEST) as Dayjs;
  const { data: nbaScoreboard } = useNBAScoreboard(todayEST);
  const { data: standings, isLoading: standingsLoading } = useStandings();
  const weekBounds = useMemo(() => getCurrentWeekBounds(), []);
  const hasLiveGames = useMemo(() => {
    if (!nbaScoreboard?.games) return false;
    return nbaScoreboard.games.some((game: any) => {
      const status = game.gameStatus ?? game.game_status;
      const text = (game.gameStatusText ?? game.game_status_text ?? '').toLowerCase();
      return status === 2 || text.includes('live') || text.includes('in progress');
    });
  }, [nbaScoreboard?.games]);

  const activeFilters: ActiveFilter[] = [];
  const { data: moduleVisibility, isPending: visibilityPending } = useProfileModuleVisibility();
  const queryClient = useQueryClient();
  const [friendsSearchOpen, setFriendsSearchOpen] = React.useState(false);
  const [friendsSearchQuery, setFriendsSearchQuery] = React.useState('');
  const [newMessageMode, setNewMessageMode] = React.useState(false);
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [composerText, setComposerText] = React.useState('');
  const [requestMessage, setRequestMessage] = React.useState<string | null>(null);

  const { data: myFriends = [] } = useQuery({
    queryKey: ['social-my-friends'],
    queryFn: listMyFriends,
    enabled: !!userId,
  });
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['social-my-friend-requests'],
    queryFn: listMyFriendRequests,
    enabled: !!userId,
  });
  const { data: searchResults = [] } = useQuery({
    queryKey: ['social-search-users', friendsSearchQuery.trim()],
    queryFn: () => searchUsersForSocial(friendsSearchQuery.trim(), 20),
    enabled: !!userId && friendsSearchOpen && friendsSearchQuery.trim().length >= 2,
  });
  const exactCaseSearchResults = useMemo(() => {
    const q = friendsSearchQuery.trim();
    if (!q) return [];
    return searchResults.filter(
      (result) => result.display_name === q || result.username === q
    );
  }, [friendsSearchQuery, searchResults]);
  const friendLabelById = useMemo(() => {
    const map = new Map<string, string>();
    myFriends.forEach((friend) => {
      map.set(friend.user_id, friend.email || friend.username || friend.display_name || friend.user_id);
    });
    return map;
  }, [myFriends]);

  const refreshSocialQueries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['social-my-friends'] });
    queryClient.invalidateQueries({ queryKey: ['social-my-friend-requests'] });
    queryClient.invalidateQueries({ queryKey: ['social-search-users'] });
  }, [queryClient]);

  const sendRequestMutation = useMutation({
    mutationFn: (targetUserId: string) => sendFriendRequest(targetUserId),
    onSuccess: () => {
      refreshSocialQueries();
      setRequestMessage('Friend request sent.');
    },
  });
  const cancelRequestMutation = useMutation({
    mutationFn: (requestId: string) => cancelFriendRequest(requestId),
    onSuccess: () => {
      refreshSocialQueries();
      setRequestMessage('Friend request cancelled.');
    },
  });
  const respondRequestMutation = useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) => respondFriendRequest(requestId, accept),
    onSuccess: (_, vars) => {
      refreshSocialQueries();
      setRequestMessage(vars.accept ? 'Friend request accepted.' : 'Friend request declined.');
    },
  });

  const { data: conversationMemberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: ['profile-messages-memberships', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id, joined_at, last_read_at')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });
      if (error) return [];
      return (data ?? []) as Array<{
        conversation_id: string;
        user_id: string;
        joined_at: string;
        last_read_at: string | null;
      }>;
    },
    enabled: !!userId,
  });
  const conversationIds = useMemo(
    () => Array.from(new Set(conversationMemberships.map((m) => m.conversation_id).filter(Boolean))),
    [conversationMemberships]
  );
  const lastReadByConversation = useMemo(() => {
    const map = new Map<string, string | null>();
    conversationMemberships.forEach((row) => map.set(row.conversation_id, row.last_read_at ?? null));
    return map;
  }, [conversationMemberships]);
  const { data: conversationMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['profile-messages-items', conversationIds.join(',')],
    queryFn: async () => {
      if (!conversationIds.length) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) return [];
      return (data ?? []) as Array<{
        id: string;
        conversation_id: string;
        sender_id: string;
        body: string;
        created_at: string;
      }>;
    },
    enabled: conversationIds.length > 0,
  });
  const { data: conversationMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['profile-messages-all-members', conversationIds.join(',')],
    queryFn: async () => {
      if (!conversationIds.length) return [];
      const { data, error } = await supabase
        .from('conversation_members')
        .select('conversation_id, user_id, joined_at')
        .in('conversation_id', conversationIds);
      if (error) return [];
      return (data ?? []) as Array<{ conversation_id: string; user_id: string; joined_at: string }>;
    },
    enabled: conversationIds.length > 0,
  });
  const otherUserIds = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...conversationMembers.map((m) => m.user_id),
            ...pendingRequests.map((r) => r.requester_id),
            ...pendingRequests.map((r) => r.addressee_id),
          ].filter((id) => id && id !== userId)
        )
      ),
    [conversationMembers, pendingRequests, userId]
  );
  const { data: otherProfiles = [] } = useQuery({
    queryKey: ['profile-messages-other-profiles', otherUserIds.join(',')],
    queryFn: async () => {
      if (!otherUserIds.length) return [];
      const withEmail = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, email')
        .in('id', otherUserIds);
      if (!withEmail.error) {
        return (withEmail.data ?? []) as Array<{
          id: string;
          display_name: string | null;
          username: string | null;
          avatar_url: string | null;
          email: string | null;
        }>;
      }
      const fallback = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', otherUserIds);
      if (fallback.error) return [];
      return (fallback.data ?? []) as Array<{
        id: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
        email: string | null;
      }>;
    },
    enabled: otherUserIds.length > 0,
  });
  const profileById = useMemo(() => {
    const map = new Map<
      string,
      { display_name: string | null; username: string | null; avatar_url: string | null; email: string | null }
    >();
    otherProfiles.forEach((p) =>
      map.set(p.id, {
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url,
        email: p.email ?? null,
      })
    );
    return map;
  }, [otherProfiles]);
  const threadItems = useMemo(() => {
    const latestByConversation = new Map<
      string,
      { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
    >();
    conversationMessages.forEach((msg) => {
      if (!latestByConversation.has(msg.conversation_id)) {
        latestByConversation.set(msg.conversation_id, msg);
      }
    });
    const membersByConversation = new Map<string, string[]>();
    conversationMembers.forEach((row) => {
      const list = membersByConversation.get(row.conversation_id) ?? [];
      list.push(row.user_id);
      membersByConversation.set(row.conversation_id, list);
    });

    const items = conversationIds.map((conversationId) => {
      const members = membersByConversation.get(conversationId) ?? [];
      const peers = members.filter((memberId) => memberId !== userId);
      const peer = peers[0] ?? null;
      const profile = peer ? profileById.get(peer) : null;
      const latest = latestByConversation.get(conversationId) ?? null;
      const readAt = lastReadByConversation.get(conversationId) ?? null;
      const unread = !!latest && !!readAt ? dayjs(latest.created_at).isAfter(dayjs(readAt)) : !!latest;
      const peerLabel =
        profile?.email ||
        profile?.username ||
        profile?.display_name ||
        (peer ? friendLabelById.get(peer) || peer : 'Group chat');
      return {
        conversationId,
        peerId: peer,
        peerLabel,
        peerAvatar: profile?.avatar_url || null,
        lastBody: latest?.body ?? 'No messages yet.',
        lastCreatedAt: latest?.created_at ?? null,
        unread,
      };
    });
    return items.sort((a, b) => {
      if (!a.lastCreatedAt && !b.lastCreatedAt) return 0;
      if (!a.lastCreatedAt) return 1;
      if (!b.lastCreatedAt) return -1;
      return dayjs(b.lastCreatedAt).valueOf() - dayjs(a.lastCreatedAt).valueOf();
    });
  }, [conversationIds, conversationMembers, conversationMessages, friendLabelById, lastReadByConversation, profileById, userId]);
  const friendsItems = useMemo(
    () =>
      myFriends.map((friend) => ({
        peerId: friend.user_id,
        label: friend.email || friend.username || friend.display_name || friend.user_id,
        avatar: friend.avatar_url,
      })),
    [myFriends]
  );
  const incomingRequests = useMemo(
    () => pendingRequests.filter((r) => r.status === 'pending' && r.addressee_id === userId),
    [pendingRequests, userId]
  );
  const outgoingRequests = useMemo(
    () => pendingRequests.filter((r) => r.status === 'pending' && r.requester_id === userId),
    [pendingRequests, userId]
  );

  const selectedThread = useMemo(
    () => threadItems.find((item) => item.conversationId === selectedConversationId) ?? null,
    [threadItems, selectedConversationId]
  );
  const filteredFriendsForComposer = useMemo(() => {
    const q = friendsSearchQuery.trim().toLowerCase();
    if (!q) return friendsItems;
    return friendsItems.filter((friend) => friend.label.toLowerCase().includes(q));
  }, [friendsItems, friendsSearchQuery]);
  const selectedMessages = useMemo(() => {
    if (!selectedConversationId) return [];
    return conversationMessages
      .filter((m) => m.conversation_id === selectedConversationId)
      .sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf());
  }, [conversationMessages, selectedConversationId]);

  const createOrGetThreadMutation = useMutation({
    mutationFn: (peerId: string) => createOrGetDirectConversation(peerId),
    onSuccess: async (conversationId) => {
      setSelectedConversationId(conversationId);
      setNewMessageMode(false);
      setFriendsSearchOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['profile-messages-memberships', userId] });
      await queryClient.invalidateQueries({ queryKey: ['profile-messages-all-members'] });
      await queryClient.invalidateQueries({ queryKey: ['profile-messages-items'] });
    },
  });
  const sendMessageMutation = useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      sendConversationMessage(conversationId, body),
    onSuccess: async () => {
      setComposerText('');
      await queryClient.invalidateQueries({ queryKey: ['profile-messages-items'] });
    },
  });

  /** `null` = still fetching admin visibility — do not use DEFAULT_PROFILE_MODULES or tabs flash wrong. */
  const modules = useMemo((): string[] | null => {
    if (visibilityPending) return null;
    const effectiveVisibility = moduleVisibility ?? DEFAULT_PROFILE_MODULES;
    return Object.entries(effectiveVisibility)
      .filter(([name, config]) => {
        if (!config.is_visible) return false;
        return true;
      })
      .sort((a, b) => (a[1].display_order ?? 0) - (b[1].display_order ?? 0))
      .map(([name]) => name)
      .filter((name) => name in PROFILE_MODULE_META);
  }, [moduleVisibility, visibilityPending]);

  const tabs = useMemo(() => {
    if (modules === null) return null;
    return [...CORE_PROFILE_TABS, ...modules.map((name) => ({ name, ...PROFILE_MODULE_META[name] }))];
  }, [modules]);

  const ctx: FeedDrawerModuleContext = useMemo(
    () => ({
      navigate: (path: string) => {
        if (path.startsWith('/')) {
          if (typeof window !== 'undefined') window.location.assign(path);
        }
      },
      selectedDate,
      nbaScoreboard,
      standings,
      standingsLoading,
      weekBounds,
      hasLiveGames,
      activeFilters,
      setDrawerOpen: () => {},
    }),
    [selectedDate, nbaScoreboard, standings, standingsLoading, weekBounds, hasLiveGames]
  );

  const [activeTab, setActiveTab] = React.useState<string>('');
  const feedRestore = useFeedDrawerRestoreOptional();
  const requestedProfileTab = feedRestore?.requestedProfileTab;
  const clearRequestedProfileTab = feedRestore?.clearRequestedProfileTab;
  const takePendingMessagePayload = feedRestore?.takePendingMessagePayload;

  React.useEffect(() => {
    if (!tabs?.length) {
      if (activeTab !== '') setActiveTab('');
      return;
    }
    if (!tabs.some((tab) => tab.name === activeTab)) {
      setActiveTab(tabs[0].name);
    }
  }, [activeTab, tabs]);

  /** Feed drawer: jump to Slip builder after add-to-slip from Props modules. */
  React.useEffect(() => {
    if (!isDrawer || !requestedProfileTab || !clearRequestedProfileTab) return;
    if (tabs == null) return;
    if (!tabs.length) {
      clearRequestedProfileTab();
      return;
    }
    if (tabs.some((t) => t.name === requestedProfileTab)) {
      setActiveTab(requestedProfileTab);
    }
    clearRequestedProfileTab();
  }, [isDrawer, requestedProfileTab, clearRequestedProfileTab, tabs]);

  React.useEffect(() => {
    if (!isDrawer || activeTab !== 'messages' || !takePendingMessagePayload) return;
    const payload = takePendingMessagePayload();
    if (!payload) return;
    setComposerText(payload.text || '');
    if (payload.preferredRecipientId) {
      createOrGetThreadMutation.mutate(payload.preferredRecipientId);
    }
  }, [activeTab, createOrGetThreadMutation, isDrawer, takePendingMessagePayload]);

  if (modules === null) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: isDrawer ? 5 : 4,
          minHeight: isDrawer ? 160 : undefined,
        }}
      >
        <CircularProgress size="sm" variant="soft" sx={{ '--CircularProgress-size': '28px' }} />
      </Box>
    );
  }

  if (!tabs?.length) {
    return (
      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
        No modules enabled
      </Typography>
    );
  }

  /** Icon-only on mobile; larger icons on desktop */
  const tabIconSize = isMobile ? 18 : 30;

  const panelScrollSx = isDrawer
    ? {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto' as const,
        overflowX: 'hidden' as const,
        pr: 0.5,
      }
    : {
        maxHeight: 'min(62vh, 760px)',
        overflowY: 'auto' as const,
        overflowX: 'hidden' as const,
        pr: 0.5,
      };

  return (
    <Tabs
      value={activeTab}
      onChange={(_, value) => setActiveTab((value as string) ?? '')}
      sx={
        isDrawer
          ? {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }
          : undefined
      }
    >
      <TabList
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          gap: 0.5,
          p: 0.5,
          mb: 1.5,
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'auto',
          overflowY: 'hidden',
          borderRadius: 'md',
          bgcolor: 'background.level1',
          flexShrink: 0,
          alignItems: 'stretch',
          '--List-gap': '0px',
          '& [role="tab"]': {
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            flex: 'unset',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 'sm',
            ...(isDrawer
              ? {
                  flexDirection: 'column',
                  gap: 0.5,
                  py: 1,
                  px: 0.25,
                  fontSize: '0.65rem',
                  lineHeight: 1.2,
                  textAlign: 'center',
                  whiteSpace: 'normal',
                }
              : {
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? 0.35 : 0.85,
                  py: isMobile ? 0.75 : 1,
                  px: 0.35,
                  fontSize: isMobile ? '0.65rem' : 'sm',
                  whiteSpace: 'normal',
                  textAlign: 'center',
                }),
          },
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const iconSize = isDrawer ? 18 : tabIconSize;
          return (
            <Tab key={tab.name} value={tab.name}>
              <Icon size={iconSize} strokeWidth={isDrawer ? 2 : isMobile ? 2 : 2.35} />
              {isDrawer || isMobile ? (
                <span>{tab.label}</span>
              ) : (
                tab.label
              )}
            </Tab>
          );
        })}
      </TabList>

      <TabPanel
        value="messages"
        sx={{
          p: 0,
          ...(isDrawer
            ? {
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        <Box
          sx={
            isDrawer
              ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
              : panelScrollSx
          }
        >
          <Box
            sx={
              isDrawer
                ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', pr: 0.5, pb: 1 }
                : undefined
            }
          >
            {selectedConversationId ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: isDrawer ? '100%' : 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <IconButton
                    size="sm"
                    variant="soft"
                    onClick={() => {
                      setSelectedConversationId(null);
                      setNewMessageMode(false);
                    }}
                  >
                    <ArrowLeft size={15} />
                  </IconButton>
                  <Typography level="title-sm">{selectedThread?.peerLabel || 'Thread'}</Typography>
                </Box>
                <Box sx={{ flex: 1, minHeight: 140, maxHeight: isDrawer ? '100%' : 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {selectedMessages.map((msg) => {
                    const isMine = msg.sender_id === userId;
                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          alignSelf: isMine ? 'flex-end' : 'flex-start',
                          maxWidth: '82%',
                          px: 1,
                          py: 0.75,
                          borderRadius: 'md',
                          bgcolor: isMine ? 'primary.softBg' : 'neutral.softBg',
                        }}
                      >
                        <Typography level="body-sm" sx={{ whiteSpace: 'pre-wrap' }}>
                          {msg.body}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.35 }}>
                          {dayjs(msg.created_at).format('h:mm A')}
                        </Typography>
                      </Box>
                    );
                  })}
                  {selectedMessages.length === 0 && (
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      Start the conversation.
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, mt: 1 }}>
                  <Input
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder="Write a message..."
                    sx={{ flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!composerText.trim() || !selectedConversationId) return;
                        sendMessageMutation.mutate({ conversationId: selectedConversationId, body: composerText });
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!composerText.trim() || !selectedConversationId) return;
                      sendMessageMutation.mutate({ conversationId: selectedConversationId, body: composerText });
                    }}
                    loading={sendMessageMutation.isPending}
                    startDecorator={<Send size={15} />}
                  >
                    Send
                  </Button>
                </Box>
              </Box>
            ) : (
              <>
                <Typography level="body-sm" sx={{ color: 'primary.500', mb: 1.25, display: 'inline-block' }}>
                  Messages
                </Typography>
                {newMessageMode ? (
                  <Box sx={{ mb: 1.1 }}>
                    <Input
                      size="sm"
                      value={friendsSearchQuery}
                      onChange={(e) => setFriendsSearchQuery(e.target.value)}
                      placeholder="Select a friend"
                      sx={{ mb: 0.75 }}
                    />
                    {filteredFriendsForComposer.length === 0 ? (
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        No matching friends.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                        {filteredFriendsForComposer.map((friend) => (
                          <Card
                            key={`compose-${friend.peerId}`}
                            variant="outlined"
                            onClick={() => createOrGetThreadMutation.mutate(friend.peerId)}
                            sx={{
                              cursor: 'pointer',
                              borderColor: 'divider',
                              '&:hover': { bgcolor: 'background.level1' },
                            }}
                          >
                            <CardContent orientation="horizontal" sx={{ p: 1.15, gap: 1, alignItems: 'center' }}>
                              <Avatar src={friend.avatar || undefined} size="sm">
                                {friend.label.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                                {friend.label}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}
                  </Box>
                ) : null}
                {requestMessage ? (
                  <Typography level="body-xs" sx={{ color: 'success.600', mb: 1 }}>
                    {requestMessage}
                  </Typography>
                ) : null}

                {incomingRequests.length > 0 && (
                  <Box sx={{ mb: 1.1 }}>
                    <Typography level="title-sm" sx={{ mb: 0.55 }}>
                      Incoming requests
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55 }}>
                      {incomingRequests.map((req) => {
                        const profile = profileById.get(req.requester_id);
                        const label =
                          profile?.email || profile?.username || profile?.display_name || friendLabelById.get(req.requester_id) || req.requester_id;
                        return (
                          <Card key={req.id} variant="soft">
                            <CardContent orientation="horizontal" sx={{ p: 0.9, alignItems: 'center', gap: 1 }}>
                              <Avatar src={profile?.avatar_url || undefined} size="sm">
                                {label.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography level="body-sm" sx={{ flex: 1 }}>
                                {label}
                              </Typography>
                              <Button
                                size="sm"
                                variant="solid"
                                onClick={() => respondRequestMutation.mutate({ requestId: req.id, accept: true })}
                                loading={respondRequestMutation.isPending}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outlined"
                                color="neutral"
                                onClick={() => respondRequestMutation.mutate({ requestId: req.id, accept: false })}
                                loading={respondRequestMutation.isPending}
                              >
                                Decline
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {outgoingRequests.length > 0 && (
                  <Box sx={{ mb: 1.1 }}>
                    <Typography level="title-sm" sx={{ mb: 0.55 }}>
                      Sent requests
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55 }}>
                      {outgoingRequests.map((req) => {
                        const profile = profileById.get(req.addressee_id);
                        const label =
                          profile?.email || profile?.username || profile?.display_name || friendLabelById.get(req.addressee_id) || req.addressee_id;
                        return (
                          <Card key={req.id} variant="outlined">
                            <CardContent orientation="horizontal" sx={{ p: 0.9, alignItems: 'center', gap: 1 }}>
                              <Avatar src={profile?.avatar_url || undefined} size="sm">
                                {label.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography level="body-sm" sx={{ flex: 1 }}>
                                {label}
                              </Typography>
                              <Button
                                size="sm"
                                variant="outlined"
                                color="neutral"
                                onClick={() => cancelRequestMutation.mutate(req.id)}
                                loading={cancelRequestMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {membershipsLoading || messagesLoading || membersLoading ? (
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    Loading conversations...
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Card
                      variant="outlined"
                      onClick={() => {
                        setFriendsSearchOpen(true);
                        setNewMessageMode(true);
                      }}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: 'background.surface',
                        borderColor: 'divider',
                        transition: 'background 0.15s',
                        '&:hover': { bgcolor: 'background.level1' },
                      }}
                    >
                      <CardContent orientation="horizontal" sx={{ gap: 1.1, alignItems: 'center', p: 1.1 }}>
                        <Avatar size="sm" variant="soft" color="primary">
                          <Plus size={14} />
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography level="body-sm" sx={{ fontWeight: 700 }} noWrap>
                            New message
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }} noWrap>
                            Select a friend and start a conversation
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                    {threadItems.map((thread) => (
                      <Card
                        key={thread.conversationId}
                        variant="outlined"
                        onClick={() => {
                          setSelectedConversationId(thread.conversationId);
                          setNewMessageMode(false);
                        }}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: 'background.surface',
                          borderColor: thread.unread ? 'primary.400' : 'divider',
                          transition: 'background 0.15s',
                          '&:hover': { bgcolor: 'background.level1' },
                        }}
                      >
                        <CardContent orientation="horizontal" sx={{ gap: 1.1, alignItems: 'center', p: 1.1 }}>
                          <Avatar src={thread.peerAvatar || undefined} size="sm">
                            {thread.peerLabel.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography level="body-sm" sx={{ fontWeight: thread.unread ? 700 : 600 }} noWrap>
                              {thread.peerLabel}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: 'text.secondary' }} noWrap>
                              {thread.lastBody}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                              {thread.lastCreatedAt ? dayjs(thread.lastCreatedAt).format('h:mm A') : '--'}
                            </Typography>
                            {thread.unread && <Chip size="sm" color="primary" variant="soft">New</Chip>}
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              borderTop: isDrawer ? '1px solid' : undefined,
              borderColor: 'divider',
              pt: 1.1,
              mt: isDrawer ? 0 : 1.25,
              bgcolor: isDrawer ? 'background.surface' : 'transparent',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.85 }}>
              <IconButton
                size="sm"
                variant={friendsSearchOpen ? 'solid' : 'soft'}
                color={friendsSearchOpen ? 'primary' : 'neutral'}
                onClick={() => setFriendsSearchOpen((v) => !v)}
              >
                <Plus size={15} />
              </IconButton>
              <Box
                sx={{
                  px: 1.1,
                  py: 0.3,
                  borderRadius: 'sm',
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.level1',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}
              >
                Friends
              </Box>
            </Box>
            {friendsSearchOpen ? (
              <Box sx={{ mb: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                <Input
                  size="sm"
                  value={friendsSearchQuery}
                  onChange={(e) => setFriendsSearchQuery(e.target.value)}
                  placeholder="Exact case username/display name"
                />
                {friendsSearchQuery.trim().length < 2 ? (
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    Type at least 2 characters.
                  </Typography>
                ) : exactCaseSearchResults.length === 0 ? (
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    No exact-case matches.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, maxHeight: 180, overflowY: 'auto', pr: 0.25 }}>
                    {exactCaseSearchResults.map((result) => {
                      const canRequest =
                        !result.is_friend && !result.has_outgoing_request && !result.has_incoming_request;
                      return (
                        <Card key={result.user_id} variant="outlined">
                          <CardContent orientation="horizontal" sx={{ alignItems: 'center', gap: 1, p: 0.9 }}>
                            <Avatar src={result.avatar_url || undefined} size="sm">
                              {(result.email || result.username || result.display_name || 'U').charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography level="body-sm" noWrap>
                                {result.email || result.username || result.display_name || result.user_id}
                              </Typography>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }} noWrap>
                                {result.email || result.username || result.display_name || ''}
                              </Typography>
                            </Box>
                            {result.is_friend ? (
                              <Button
                                size="sm"
                                variant="soft"
                                onClick={() => createOrGetThreadMutation.mutate(result.user_id)}
                                loading={createOrGetThreadMutation.isPending}
                              >
                                Message
                              </Button>
                            ) : result.has_incoming_request ? (
                              <Button
                                size="sm"
                                variant="soft"
                                onClick={() => {
                                  const req = incomingRequests.find((r) => r.requester_id === result.user_id);
                                  if (!req) return;
                                  respondRequestMutation.mutate({ requestId: req.id, accept: true });
                                }}
                                loading={respondRequestMutation.isPending}
                              >
                                Accept
                              </Button>
                            ) : result.has_outgoing_request ? (
                              <Typography level="body-xs" sx={{ color: 'warning.700', fontWeight: 700 }}>
                                Pending
                              </Typography>
                            ) : canRequest ? (
                              <Button
                                size="sm"
                                onClick={() => sendRequestMutation.mutate(result.user_id)}
                                loading={sendRequestMutation.isPending}
                              >
                                Add
                              </Button>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}
              </Box>
            ) : null}
            {friendsItems.length === 0 ? (
              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                Friends will appear here as you connect.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 0.6, overflowX: 'auto', pb: 0.25 }}>
                {friendsItems.map((friend) => (
                  <Card
                    key={friend.peerId}
                    variant="soft"
                    onClick={() => {
                      createOrGetThreadMutation.mutate(friend.peerId);
                    }}
                    sx={{
                      cursor: 'pointer',
                      minWidth: 110,
                      borderRadius: 'md',
                      bgcolor: 'background.level1',
                    }}
                  >
                    <CardContent sx={{ p: 0.8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Avatar src={friend.avatar || undefined} size="sm">
                        {friend.label.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography level="body-xs" sx={{ textAlign: 'center', lineHeight: 1.2 }} noWrap>
                        {friend.label}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </TabPanel>

      <TabPanel
        value="saved_posts"
        sx={{
          p: 0,
          ...(isDrawer
            ? {
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        <Box sx={panelScrollSx}>
          <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
            Posts you bookmarked from the feed.
          </Typography>
          {bookmarksLoading ? (
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
              Loading…
            </Typography>
          ) : bookmarkedPosts.length === 0 ? (
            <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
              No saved posts yet. Open a story and tap bookmark to save it here.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {bookmarkedPosts.map((post) => (
                <Card
                  key={post.id}
                  variant="outlined"
                  component={RouterLink}
                  to={`/feed/${post.slug}`}
                  sx={{
                    textDecoration: 'none',
                    bgcolor: 'background.surface',
                    transition: 'background 0.15s',
                    '&:hover': { bgcolor: 'background.level1' },
                  }}
                >
                  <CardContent orientation="horizontal" sx={{ gap: 2, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography level="title-sm" sx={{ color: 'text.primary' }}>
                        {post.title}
                      </Typography>
                      {post.subtitle && (
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mt: 0.5 }}>
                          {post.subtitle}
                        </Typography>
                      )}
                    </Box>
                    <Chip size="sm" variant="soft" color="neutral">
                      {post.post_type.replace(/_/g, ' ')}
                    </Chip>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </TabPanel>

      {modules.map((name) => {
        const content = renderFeedDrawerModule(name, ctx);
        if (content === null) return null;
        return (
          <TabPanel
            key={name}
            value={name}
            sx={{
              p: 0,
              ...(isDrawer
                ? {
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }
                : {}),
            }}
          >
            <Box sx={panelScrollSx}>{content}</Box>
          </TabPanel>
        );
      })}
    </Tabs>
  );
}

export interface ProfileHubContentProps {
  variant: 'page' | 'drawer';
}

export default function ProfileHubContent({ variant }: ProfileHubContentProps) {
  const { user } = useAuth();
  const isDrawer = variant === 'drawer';

  const { data: bookmarkedPosts = [], isLoading: bookmarksLoading } = useQuery({
    queryKey: ['profile-bookmarks', user?.id],
    queryFn: () => listBookmarkedPosts(user!.id),
    enabled: !!user?.id,
  });

  if (!user) {
    return (
      <Box sx={{ px: isDrawer ? 0 : { xs: 2, sm: 3 }, pt: isDrawer ? 0 : 3, pb: 2 }}>
        <Typography
          component={RouterLink}
          to="/login"
          level="body-sm"
          sx={{ color: 'primary.500' }}
        >
          Log in
        </Typography>
      </Box>
    );
  }

  const px = isDrawer ? 0 : { xs: 2, sm: 3 };

  return (
    <Box
      sx={{
        px,
        pt: isDrawer ? 0 : 3,
        pb: 2,
        ...(isDrawer
          ? {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              alignSelf: 'stretch',
            }
          : {}),
      }}
    >
      {!isDrawer && user.email ? (
        <Typography
          level="body-xs"
          sx={{
            color: 'text.secondary',
            mb: 1.25,
            wordBreak: 'break-all',
          }}
        >
          {user.email}
        </Typography>
      ) : !isDrawer && !user.email ? (
        <Typography
          component={RouterLink}
          to="/login"
          level="body-sm"
          sx={{ color: 'primary.500', mb: 1.25, display: 'inline-block' }}
        >
          Log in
        </Typography>
      ) : null}
      <ProfileModulesTabs
        isDrawer={isDrawer}
        userId={user.id}
        bookmarkedPosts={bookmarkedPosts}
        bookmarksLoading={bookmarksLoading}
      />
    </Box>
  );
}
