import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Avatar,
  Sheet,
  Divider,
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Option,
  Checkbox,
  Table,
} from '@mui/joy';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth';
import EntriesTab from '../components/DFS/EntriesTab';
import PoolDetailsTab from '../components/DFS/PoolDetailsTab';
import { useDFSUserStats } from '../hooks/useDFSUserStats';
import { 
  useDFSUserGroups, 
  useCreateDFSGroup, 
  useJoinDFSGroup,
  useDFSGroup,
  useDFSGroupMembers,
  useDFSGroupPools,
} from '../hooks/useDFSGroups';
import { useDFSPoints } from '../hooks/useDFSPoints';
import { Add, People, Share, Settings, AttachMoney, CheckCircle, PlayArrow, Schedule, Group } from '@mui/icons-material';
import { format } from 'date-fns';
import { getIconByName } from '../utils/dfsPoolIcons';

export default function DFS() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: userStats } = useDFSUserStats(user?.id);
  const { data: userPoints } = useDFSPoints(user?.id);
  const { data: userGroups } = useDFSUserGroups(user?.id);
  // Default tab: Upcoming Pools (visible without login)
  const [activeTab, setActiveTab] = useState(2); // 0: Stats, 1: Completed, 2: Upcoming (default), 3: Ongoing, 4: Groups
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [poolView, setPoolView] = useState<'details' | 'leaderboard' | 'entry' | 'lineup-builder'>('details');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [joinGroupCode, setJoinGroupCode] = useState('');
  const [showCreateGroupPoolModal, setShowCreateGroupPoolModal] = useState(false);
  const [selectedGroupForPool, setSelectedGroupForPool] = useState<string | null>(null);
  
  // Create group mutation
  const createGroupMutation = useCreateDFSGroup();
  const joinGroupMutation = useJoinDFSGroup();
  
  // Form state for create group
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    slug: '',
    is_public: false,
    is_open: true,
    max_members: '',
    icon_color_primary: '#FFC72C',
    icon_color_secondary: '#000000',
  });

  // Fetch all pools (for filtering by status)
  const { data: allPoolsData, isLoading: allPoolsLoading } = useQuery({
    queryKey: ['dfs-all-pools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_pools')
        .select('*')
        .eq('is_public', true)
        .order('lock_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Filter pools by status (using logic from admin manager)
  const upcomingPools = useMemo(() => {
    if (!allPoolsData) return [];
    return allPoolsData.filter(p => {
      const status = String(p.status || '').toLowerCase().trim();
      return status === 'scheduled';
    });
  }, [allPoolsData]);

  const ongoingPools = useMemo(() => {
    if (!allPoolsData) return [];
    return allPoolsData.filter(p => {
      const status = String(p.status || '').toLowerCase().trim();
      return status === 'live' || status === 'ongoing' || status === 'in progress';
    });
  }, [allPoolsData]);

  const completedPools = useMemo(() => {
    if (!allPoolsData) return [];
    return allPoolsData.filter(p => {
      const status = String(p.status || '').toLowerCase().trim();
      return status === 'completed' || status === 'complete' || status === 'finished' || status === 'final';
    });
  }, [allPoolsData]);

  // Get current pools based on active tab
  const currentPools = useMemo(() => {
    if (activeTab === 1) return completedPools;
    if (activeTab === 2) return upcomingPools;
    if (activeTab === 3) return ongoingPools;
    return [];
  }, [activeTab, completedPools, upcomingPools, ongoingPools]);


  // Helper functions for pool display
  const getDifficultyColor = (tier: string) => {
    switch (tier) {
      case 'elite': return '#ef4444';
      case 'pro': return '#f59e0b';
      case 'standard': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatMoney = (amount: number) => {
    if (amount === 0) return 'FREE';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };


  // Handle pool selection from entries tab
  const handlePoolSelect = (poolId: string, view?: 'details' | 'lineup-builder', entryId?: string) => {
    setSelectedPoolId(poolId);
    setPoolView(view || 'details');
    setSelectedEntryId(entryId || null);
  };

  // Handle back from pool details
  const handlePoolBack = () => {
    setSelectedPoolId(null);
    setPoolView('details');
    setSelectedEntryId(null);
  };

  // Handle create group pool button click
  const handleCreateGroupPool = () => {
    if (userGroups && userGroups.length > 0) {
      if (userGroups.length === 1) {
        // If only one group, use it directly
        setSelectedGroupForPool(userGroups[0].id);
        setShowCreateGroupPoolModal(true);
      } else {
        // Show group selection modal
        setShowCreateGroupPoolModal(true);
      }
    } else {
      // No groups, show create group modal first
      setShowCreateGroupModal(true);
    }
  };

  // Handle group click
  const handleGroupClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedPoolId(null);
    setActiveTab(4); // Switch to Groups tab
  };

  // Handle create group
  const handleCreateGroup = async () => {
    try {
      // If slug is provided, clear it to let the backend generate a unique one
      // This avoids "slug already exists" errors
      const groupId = await createGroupMutation.mutateAsync({
        name: groupFormData.name,
        description: groupFormData.description || undefined,
        slug: undefined, // Always let backend generate slug to avoid conflicts
        is_public: groupFormData.is_public,
        is_open: groupFormData.is_open,
        max_members: groupFormData.max_members ? parseInt(groupFormData.max_members) : undefined,
        icon_color_primary: groupFormData.icon_color_primary,
        icon_color_secondary: groupFormData.icon_color_secondary,
      });
      
      setShowCreateGroupModal(false);
      setGroupFormData({
        name: '',
        description: '',
        slug: '',
        is_public: false,
        is_open: true,
        max_members: '',
        icon_color_primary: '#FFC72C',
        icon_color_secondary: '#000000',
      });
      
      // Navigate to the new group
      setSelectedGroupId(groupId);
    } catch (error: any) {
      console.error('Error creating group:', error);
      // Show user-friendly error message
      if (error?.message?.includes('slug already exists')) {
        alert('A group with a similar name already exists. Please try a different name.');
      } else {
        alert(`Failed to create group: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  // Handle pool click
  const handlePoolClick = (poolId: string) => {
    setSelectedPoolId(poolId);
    setPoolView('details');
    setSelectedEntryId(null);
  };

  // Handle join group
  const handleJoinGroup = async () => {
    if (!joinGroupCode.trim()) {
      alert('Please enter a group code');
      return;
    }

    try {
      // First, fetch the group by slug
      const { data: group, error: fetchError } = await supabase
        .from('dfs_groups')
        .select('*')
        .eq('slug', joinGroupCode.trim().toLowerCase())
        .maybeSingle();

      if (fetchError) {
        throw new Error('Failed to find group');
      }

      if (!group) {
        alert('Group not found. Please check the code and try again.');
        return;
      }

      // Join the group
      await joinGroupMutation.mutateAsync({
        groupId: group.id,
      });

      // Success - close modal and refresh
      setShowJoinGroupModal(false);
      setJoinGroupCode('');
      setSelectedGroupId(group.id);
      alert('Successfully joined group!');
    } catch (error: any) {
      console.error('Error joining group:', error);
      if (error?.message?.includes('already a member')) {
        alert('You are already a member of this group.');
      } else if (error?.message?.includes('not open')) {
        alert('This group is not accepting new members.');
      } else if (error?.message?.includes('max members')) {
        alert('This group has reached its maximum number of members.');
      } else {
        alert(`Failed to join group: ${error?.message || 'Unknown error'}`);
      }
    }
  };

  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      pt: { xs: 2, md: 3 },
      pb: 6,
      boxSizing: 'border-box',
      overflowX: 'hidden',
    }}>
      <Box sx={{ 
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}>
        <Stack spacing={4}>
          {/* Main Table Card */}
          <Card variant="outlined" sx={{ bgcolor: '#111111', borderColor: '#222222', position: 'relative' }}>
            <CardContent sx={{ p: 2 }}>
              {/* Header with Tab Icons */}
              <Box sx={{ mb: 2, position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography level="h3" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                    DFS Pools
                  </Typography>

                  {/* Tab Icons */}
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {/* Stats Tab (only if logged in) */}
                    {user && (
                      <IconButton
                        size="sm"
                        variant={activeTab === 0 ? "outlined" : "plain"}
                        color={activeTab === 0 ? "primary" : "neutral"}
                        onClick={() => setActiveTab(0)}
            sx={{
                          minWidth: 'auto',
                          width: '32px',
                          height: '32px',
                          p: 0.5,
                          ...(activeTab === 0 && {
                            borderColor: '#FFFFFF',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                          }),
                        }}
                        title="Stats"
                      >
                        <AttachMoney />
                      </IconButton>
                    )}

                    {/* Completed Pools (logged in only) */}
                    {user && (
                      <IconButton
                        size="sm"
                        variant={activeTab === 1 ? "outlined" : "plain"}
                        color={activeTab === 1 ? "primary" : "neutral"}
                        onClick={() => setActiveTab(1)}
                sx={{
                          minWidth: 'auto',
                          width: '32px',
                          height: '32px',
                          p: 0.5,
                          ...(activeTab === 1 && {
                            borderColor: '#FFFFFF',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                          }),
                        }}
                        title="Completed Pools"
                      >
                        <CheckCircle />
                      </IconButton>
                    )}

                    {/* Upcoming Pools (default, visible without login) */}
                    <IconButton
                      size="sm"
                      variant={activeTab === 2 ? "outlined" : "plain"}
                      color={activeTab === 2 ? "primary" : "neutral"}
                      onClick={() => setActiveTab(2)}
                    sx={{
                        minWidth: 'auto',
                        width: '32px',
                        height: '32px',
                        p: 0.5,
                        ...(activeTab === 2 && {
                          borderColor: '#FFFFFF',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                        }),
                      }}
                      title="Upcoming Pools"
                    >
                      <Schedule />
                    </IconButton>

                    {/* Ongoing Pools (logged in only) */}
                    {user && (
                      <IconButton
                        size="sm"
                        variant={activeTab === 3 ? "outlined" : "plain"}
                        color={activeTab === 3 ? "primary" : "neutral"}
                        onClick={() => setActiveTab(3)}
                      sx={{
                          minWidth: 'auto',
                          width: '32px',
                          height: '32px',
                          p: 0.5,
                          ...(activeTab === 3 && {
                            borderColor: '#FFFFFF',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                          }),
                        }}
                        title="Ongoing Pools"
                      >
                        <PlayArrow />
                      </IconButton>
                    )}

                    {/* Groups (logged in only) */}
                    {user && (
                      <IconButton
                        size="sm"
                        variant={activeTab === 4 ? "outlined" : "plain"}
                        color={activeTab === 4 ? "primary" : "neutral"}
                        onClick={() => {
                          setActiveTab(4);
                          setSelectedPoolId(null);
                        }}
                      sx={{
                          minWidth: 'auto',
                          width: '32px',
                          height: '32px',
                          p: 0.5,
                          ...(activeTab === 4 && {
                            borderColor: '#FFFFFF',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                          }),
                        }}
                        title="Groups"
                      >
                        <Group />
                      </IconButton>
                    )}
                  </Stack>
          </Box>
        </Box>

              {/* Table Content */}
          {selectedPoolId ? (
            // Pool Details View
              <PoolDetailsTab
                poolId={selectedPoolId}
                initialView={poolView}
                entryId={selectedEntryId}
                  onBack={() => {
                    setSelectedPoolId(null);
                    setPoolView('details');
                    setSelectedEntryId(null);
                  }}
                />
          ) : selectedGroupId ? (
            // Group Details View
            <GroupDetailsView 
              groupId={selectedGroupId}
              onBack={() => setSelectedGroupId(null)}
            />
              ) : activeTab === 0 ? (
                // Stats Table
                user && userStats ? (
                  <Table sx={{ bgcolor: '#000000' }}>
                    <thead>
                      <tr>
                        <th style={{ color: '#FFFFFF', fontSize: '0.75rem' }}>Stat</th>
                        <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #333333', cursor: 'pointer' }}>
                        <td style={{ color: '#FFFFFF', padding: '12px' }}>Total Points</td>
                        <td style={{ color: '#FFC72C', padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                            {userPoints?.total_points || 0}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #333333', cursor: 'pointer' }}>
                        <td style={{ color: '#FFFFFF', padding: '12px' }}>Contests Won</td>
                        <td style={{ color: '#FFC72C', padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                            {userStats.contestsWon}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #333333', cursor: 'pointer' }}>
                        <td style={{ color: '#FFFFFF', padding: '12px' }}>Contests Entered</td>
                        <td style={{ color: '#FFFFFF', padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                            {userStats.contestsEntered}
                        </td>
                      </tr>
                      <tr style={{ cursor: 'pointer' }}>
                        <td style={{ color: '#FFFFFF', padding: '12px' }}>Win Rate</td>
                        <td style={{ color: '#FFFFFF', padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                            {userStats.winRate.toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      Please sign in to view your stats
                          </Typography>
                        </Box>
                )
              ) : activeTab === 4 ? (
                // Groups View
                user ? (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography level="title-md" sx={{ color: '#FFFFFF' }}>
                      My Groups
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="sm"
                        variant="outlined"
                        color="primary"
                        startDecorator={<Add />}
                        onClick={() => setShowCreateGroupModal(true)}
                        sx={{
                          borderColor: '#FFFFFF',
                          color: '#FFFFFF',
                          '&:hover': {
                            borderColor: '#FFC72C',
                            bgcolor: 'rgba(255, 199, 44, 0.1)',
                          },
                        }}
                      >
                        Create Group
                      </Button>
                      <Button
                        size="sm"
                        variant="outlined"
                        color="primary"
                        startDecorator={<People />}
                        onClick={() => setShowJoinGroupModal(true)}
                        sx={{
                          borderColor: '#FFFFFF',
                          color: '#FFFFFF',
                          '&:hover': {
                            borderColor: '#FFC72C',
                            bgcolor: 'rgba(255, 199, 44, 0.1)',
                          },
                        }}
                      >
                        Join Group
                      </Button>
                    </Stack>
                  </Stack>
                  
                  {userGroups && userGroups.length > 0 ? (
                    <Grid container spacing={2}>
                      {userGroups.map((group) => (
                        <Grid xs={12} sm={6} md={4} key={group.id}>
                          <Sheet
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 'md',
                              bgcolor: '#1a1a1a',
                              borderColor: '#333333',
                              cursor: 'pointer',
                              '&:hover': {
                                borderColor: group.icon_color_primary || '#FFC72C',
                                transform: 'translateY(-2px)',
                              },
                              transition: 'all 0.2s',
                            }}
                            onClick={() => handleGroupClick(group.id)}
                          >
                            <Stack spacing={2}>
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Avatar
                                  src={group.avatar_url || undefined}
                                  sx={{
                                    width: 48,
                                    height: 48,
                                    bgcolor: group.icon_color_primary || '#FFC72C',
                                  }}
                                >
                                  {group.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography level="title-md" sx={{ color: '#FFFFFF' }}>
                                    {group.name}
                                  </Typography>
                                  <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                                    {group.member_count} members • {group.pool_count} pools
                                  </Typography>
                                </Box>
                              </Stack>
                              {group.description && (
                                <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.8 }}>
                                  {group.description}
                                </Typography>
                              )}
                            </Stack>
                          </Sheet>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                      <CardContent>
                        <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
                          <People sx={{ fontSize: 48, color: '#666666' }} />
                          <Typography level="title-md" sx={{ color: '#FFFFFF' }}>
                            No Groups Yet
                          </Typography>
                          <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.7, textAlign: 'center' }}>
                            Create a group to start private pools with friends, or join an existing group with a code
                          </Typography>
                          <Stack direction="row" spacing={2} sx={{ width: '100%', justifyContent: 'center' }}>
                            <Button
                              variant="outlined"
                              color="primary"
                              startDecorator={<Add />}
                              onClick={() => setShowCreateGroupModal(true)}
                              sx={{
                                borderColor: '#FFFFFF',
                                color: '#FFFFFF',
                                '&:hover': {
                                  borderColor: '#FFC72C',
                                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                                },
                              }}
                            >
                              Create Group
                            </Button>
                            <Button
                              variant="outlined"
                              color="primary"
                              startDecorator={<People />}
                              onClick={() => setShowJoinGroupModal(true)}
                              sx={{
                                borderColor: '#FFFFFF',
                                color: '#FFFFFF',
                                '&:hover': {
                                  borderColor: '#FFC72C',
                                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                                },
                              }}
                            >
                              Join Group
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}
                </Box>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      Please sign in to view groups
                  </Typography>
                  </Box>
                )
              ) : (
                // Pools Table (Completed, Upcoming, or Ongoing)
                allPoolsLoading ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading pools...</Typography>
                  </Box>
                ) : currentPools && currentPools.length > 0 ? (
                  <Box>
                    <Box sx={{ maxHeight: '500px', overflow: 'auto' }}>
                      <Table sx={{ bgcolor: '#000000' }}>
                        <thead>
                          <tr>
                            <th style={{ color: '#FFFFFF', fontSize: '0.75rem' }}>Pool Name</th>
                            <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>Entry Fee</th>
                            <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>Prize Pool</th>
                            <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>Entries</th>
                            <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPools.map((pool: any) => {
                            const IconComponent = pool.icon_name ? getIconByName(pool.icon_name) : null;
                            const primaryColor = pool.html_color_primary || getDifficultyColor(pool?.difficulty_tier);
                            
                            return (
                              <tr
                                key={pool.id}
                                onClick={() => handlePoolClick(pool.id)}
                                style={{
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #333333',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <td style={{ color: '#FFFFFF', padding: '12px' }}>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    {IconComponent && (
                                      <Box
                                        sx={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: '50%',
                                          bgcolor: primaryColor,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        <IconComponent size={16} color={pool.html_color_secondary || '#000000'} />
                </Box>
              )}
                                    <Typography level="body-sm">{pool.name}</Typography>
            </Stack>
                                </td>
                                <td style={{ color: '#FFFFFF', padding: '12px', textAlign: 'right' }}>
                                  {formatMoney(pool.entry_fee || 0)}
                                </td>
                                <td style={{ color: '#FFC72C', padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                                  {formatMoney(pool.prize_pool || 0)}
                                </td>
                                <td style={{ color: '#FFFFFF', padding: '12px', textAlign: 'right' }}>
                                  {pool.current_entries || 0} / {pool.max_entries || '∞'}
                                </td>
                                <td style={{ color: '#FFFFFF', padding: '12px', textAlign: 'right' }}>
                                  <Chip size="sm" variant="soft" color={pool.status === 'live' ? 'danger' : 'neutral'}>
                                    {pool.status || 'scheduled'}
                                  </Chip>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
        </Box>
                  </Box>
                ) : (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      No pools available
                    </Typography>
                  </Box>
                )
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {/* Create Group Modal */}
      <Modal open={showCreateGroupModal} onClose={() => setShowCreateGroupModal(false)}>
        <ModalDialog sx={{ maxWidth: 500, bgcolor: '#1a1a1a' }}>
          <DialogTitle sx={{ color: '#FFFFFF' }}>Create New Group</DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              <FormControl>
                <FormLabel sx={{ color: '#FFFFFF' }}>Group Name *</FormLabel>
                <Input
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="Enter group name"
                  sx={{ bgcolor: '#000000', color: '#FFFFFF' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel sx={{ color: '#FFFFFF' }}>Description</FormLabel>
                <Textarea
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  placeholder="Enter group description"
                  minRows={3}
                  sx={{ bgcolor: '#000000', color: '#FFFFFF' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel sx={{ color: '#FFFFFF' }}>URL Slug (optional)</FormLabel>
                <Input
                  value={groupFormData.slug}
                  onChange={(e) => setGroupFormData({ ...groupFormData, slug: e.target.value })}
                  placeholder="my-group-name"
                  sx={{ bgcolor: '#000000', color: '#FFFFFF' }}
                />
                <Typography level="body-xs" sx={{ color: '#FFFFFF', opacity: 0.7, mt: 0.5 }}>
                  Leave empty to auto-generate from name
                </Typography>
              </FormControl>

              <FormControl>
                <FormLabel sx={{ color: '#FFFFFF' }}>Max Members (optional)</FormLabel>
                <Input
                  type="number"
                  value={groupFormData.max_members}
                  onChange={(e) => setGroupFormData({ ...groupFormData, max_members: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  sx={{ bgcolor: '#000000', color: '#FFFFFF' }}
                />
              </FormControl>

              <FormControl>
                <Checkbox
                  checked={groupFormData.is_public}
                  onChange={(e) => setGroupFormData({ ...groupFormData, is_public: e.target.checked })}
                  label="Public Group (appears in search)"
                  sx={{ color: '#FFFFFF' }}
                />
              </FormControl>

              <FormControl>
                <Checkbox
                  checked={groupFormData.is_open}
                  onChange={(e) => setGroupFormData({ ...groupFormData, is_open: e.target.checked })}
                  label="Open Group (anyone can join)"
                  sx={{ color: '#FFFFFF' }}
                />
              </FormControl>

              <Stack direction="row" spacing={2}>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel sx={{ color: '#FFFFFF' }}>Primary Color</FormLabel>
                  <Input
                    type="color"
                    value={groupFormData.icon_color_primary}
                    onChange={(e) => setGroupFormData({ ...groupFormData, icon_color_primary: e.target.value })}
                    sx={{ bgcolor: '#000000' }}
                  />
                </FormControl>
                <FormControl sx={{ flex: 1 }}>
                  <FormLabel sx={{ color: '#FFFFFF' }}>Secondary Color</FormLabel>
                  <Input
                    type="color"
                    value={groupFormData.icon_color_secondary}
                    onChange={(e) => setGroupFormData({ ...groupFormData, icon_color_secondary: e.target.value })}
                    sx={{ bgcolor: '#000000' }}
                  />
                </FormControl>
              </Stack>

              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowCreateGroupModal(false);
                    setGroupFormData({
                      name: '',
                      description: '',
                      slug: '',
                      is_public: false,
                      is_open: true,
                      max_members: '',
                      icon_color_primary: '#FFC72C',
                      icon_color_secondary: '#000000',
                    });
                  }}
                  sx={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateGroup}
                  disabled={!groupFormData.name || createGroupMutation.isPending}
                  loading={createGroupMutation.isPending}
                  sx={{ flex: 1, bgcolor: '#FFC72C', color: '#000000' }}
                >
                  Create Group
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
        </ModalDialog>
      </Modal>

      {/* Join Group Modal */}
      <Modal open={showJoinGroupModal} onClose={() => {
        setShowJoinGroupModal(false);
        setJoinGroupCode('');
      }}>
        <ModalDialog sx={{ maxWidth: 500, bgcolor: '#1a1a1a' }}>
          <DialogTitle sx={{ color: '#FFFFFF' }}>Join Group</DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.8 }}>
                Enter the unique group code to join a group. The group code is generated when a group is created.
              </Typography>
              
              <FormControl>
                <FormLabel sx={{ color: '#FFFFFF' }}>Group Code *</FormLabel>
                <Input
                  value={joinGroupCode}
                  onChange={(e) => setJoinGroupCode(e.target.value)}
                  placeholder="Enter group code"
                  sx={{ bgcolor: '#000000', color: '#FFFFFF' }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleJoinGroup();
                    }
                  }}
                />
              </FormControl>

              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setShowJoinGroupModal(false);
                    setJoinGroupCode('');
                  }}
                  sx={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleJoinGroup}
                  disabled={!joinGroupCode.trim() || joinGroupMutation.isPending}
                  loading={joinGroupMutation.isPending}
                  sx={{ flex: 1, bgcolor: '#FFC72C', color: '#000000' }}
                >
                  Join Group
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
        </ModalDialog>
      </Modal>

      {/* Create Group Pool Modal */}
      <Modal open={showCreateGroupPoolModal} onClose={() => setShowCreateGroupPoolModal(false)}>
        <ModalDialog sx={{ maxWidth: 500, bgcolor: '#1a1a1a' }}>
          <DialogTitle sx={{ color: '#FFFFFF' }}>Create Pool for Group</DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              {userGroups && userGroups.length > 1 && !selectedGroupForPool ? (
                <>
                  <FormControl>
                    <FormLabel sx={{ color: '#FFFFFF' }}>Select Group *</FormLabel>
                    <Select
                      placeholder="Choose a group"
                      sx={{ bgcolor: '#000000', color: '#FFFFFF' }}
                      onChange={(_, value) => setSelectedGroupForPool(value as string)}
                    >
                      {userGroups.map((group) => (
                        <Option key={group.id} value={group.id}>
                          {group.name}
                        </Option>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    onClick={() => {
                      if (selectedGroupForPool) {
                        navigate('/admin/dfs', { state: { groupId: selectedGroupForPool } });
                        setShowCreateGroupPoolModal(false);
                      }
                    }}
                    disabled={!selectedGroupForPool}
                    sx={{ bgcolor: '#FFC72C', color: '#000000' }}
                  >
                    Continue to Pool Creator
                  </Button>
                </>
              ) : (
                <>
                  <Typography level="body-md" sx={{ color: '#FFFFFF' }}>
                    {selectedGroupForPool
                      ? `Creating pool for: ${userGroups?.find(g => g.id === selectedGroupForPool)?.name}`
                      : userGroups && userGroups.length === 1
                      ? `Creating pool for: ${userGroups[0].name}`
                      : 'No groups available'}
                  </Typography>
                  <Button
                    onClick={() => {
                      const groupId = selectedGroupForPool || (userGroups && userGroups[0]?.id);
                      if (groupId) {
                        navigate('/admin/dfs', { state: { groupId } });
                        setShowCreateGroupPoolModal(false);
                      }
                    }}
                    disabled={!selectedGroupForPool && (!userGroups || userGroups.length === 0)}
                    sx={{ bgcolor: '#FFC72C', color: '#000000' }}
                  >
                    Continue to Pool Creator
                  </Button>
                </>
              )}
              <Button
                variant="outlined"
                onClick={() => {
                  setShowCreateGroupPoolModal(false);
                  setSelectedGroupForPool(null);
                }}
              >
                Cancel
              </Button>
            </Stack>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </Box>
  );
}

// Group Details View Component
function GroupDetailsView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const { data: group } = useDFSGroup(groupId);
  const { data: members } = useDFSGroupMembers(groupId);
  const { data: pools } = useDFSGroupPools(groupId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const inviteLink = group ? `${window.location.origin}/dfs/group/${group.slug}` : '';

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
  };

  return (
    <Stack spacing={4} sx={{ px: { xs: 2, sm: 0 } }}>
      <Button variant="plain" onClick={onBack} sx={{ alignSelf: 'flex-start', color: '#FFFFFF' }}>
        ← Back to Dashboard
      </Button>

      {group && (
        <>
          {/* Group Header */}
          <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
            <CardContent>
              <Stack direction="row" spacing={3} alignItems="center">
                <Avatar
                  src={group.avatar_url || undefined}
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: group.icon_color_primary || '#FFC72C',
                  }}
                >
                  {group.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography level="h2" sx={{ color: '#FFFFFF', fontFamily: 'serif' }}>
                    {group.name}
                  </Typography>
                  {group.description && (
                    <Typography level="body-md" sx={{ color: '#FFFFFF', opacity: 0.8, mt: 1 }}>
                      {group.description}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                      {group.member_count} members
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                      {group.pool_count} pools
                    </Typography>
                  </Stack>
                </Box>
                <Stack spacing={1}>
                  <Button
                    size="sm"
                    startDecorator={<Share />}
                    onClick={handleCopyInvite}
                  >
                    Copy Invite Link
                  </Button>
                  {user?.id === group.owner_id && (
                    <Button
                      size="sm"
                      variant="outlined"
                      startDecorator={<Settings />}
                    >
                      Settings
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* Members Section */}
          {members && members.length > 0 && (
            <Box>
              <Typography level="h3" sx={{ mb: 2, color: '#FFFFFF', fontFamily: 'serif' }}>
                Members
              </Typography>
              <Sheet variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', borderRadius: 'md' }}>
                <Stack divider={<Divider />}>
                  {members.map((member, index) => (
                    <Box key={member.id} sx={{ p: 2 }}>
                      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography level="body-md" sx={{ color: '#FFFFFF', minWidth: 24 }}>
                            {index + 1}
                          </Typography>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {member.nickname?.charAt(0) || 'U'}
                          </Avatar>
                          <Box>
                            <Typography level="body-md" sx={{ color: '#FFFFFF' }}>
                              {member.nickname || 'Member'}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                              {member.role}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={3}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography level="body-xs" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                              Points
                            </Typography>
                            <Typography level="body-md" sx={{ color: '#FFC72C' }}>
                              {member.total_points}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography level="body-xs" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                              Wins
                            </Typography>
                            <Typography level="body-md" sx={{ color: '#FFFFFF' }}>
                              {member.total_wins}
                            </Typography>
                          </Box>
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Sheet>
            </Box>
          )}

          {/* Pools Section */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography level="h3" sx={{ color: '#FFFFFF', fontFamily: 'serif' }}>
                Pools
              </Typography>
              <Button
                size="sm"
                startDecorator={<Add />}
                onClick={() => navigate('/admin/dfs')}
              >
                Create Pool
              </Button>
            </Stack>
            
            {pools && pools.length > 0 ? (
              <Stack spacing={2}>
                {pools.map((groupPool) => (
                  <Sheet
                    key={groupPool.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 'md',
                      bgcolor: '#1a1a1a',
                      borderColor: '#333333',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: '#FFC72C',
                      },
                    }}
                    onClick={() => navigate(`/dfs/pool/${groupPool.pool_id}`)}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography level="title-md" sx={{ color: '#FFFFFF' }}>
                          {groupPool.pool.name}
                        </Typography>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.7 }}>
                          {format(new Date(groupPool.pool.slate_date), 'MMM d, yyyy')} • {groupPool.pool.status}
                        </Typography>
                      </Box>
                      <Chip size="sm" color={groupPool.pool.status === 'live' ? 'danger' : 'neutral'}>
                        {groupPool.pool.status}
                      </Chip>
                    </Stack>
                  </Sheet>
                ))}
              </Stack>
            ) : (
              <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                <CardContent>
                  <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
                    <Typography level="title-md" sx={{ color: '#FFFFFF' }}>
                      No Pools Yet
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#FFFFFF', opacity: 0.7, textAlign: 'center' }}>
                      Create a pool for this group
                    </Typography>
                    <Button
                      startDecorator={<Add />}
                      onClick={() => navigate('/admin/dfs')}
                    >
                      Create Pool
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
}

