import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  Sheet,
  Table,
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
  Grid,
  Checkbox,
  FormHelperText,
  CircularProgress,
  IconButton,
  Tooltip,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import { MonetizationOn, Add, Warning, CalendarToday, CheckCircle, Edit, Delete, Visibility, ChevronLeft, ChevronRight, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { format } from 'date-fns';
import { useCreateDFSPool, CreateDFSPoolParams } from '../../hooks/useCreateDFSPool';
import { useUpdateDFSPool, UpdateDFSPoolParams } from '../../hooks/useUpdateDFSPool';
import { useDeleteDFSPool } from '../../hooks/useDeleteDFSPool';
import { DFS_POOL_ICONS, getIconByName, getIconCategories, getIconsByCategory, searchIcons } from '../../utils/dfsPoolIcons';
import { FaCalendar, FaClock, FaCheckCircle, FaRocket } from 'react-icons/fa';

interface FormData {
  pool_name: string;
  slate_name: string;
  description: string;
  entry_fee: number;
  max_entries: number;
  difficulty: 'elite' | 'pro' | 'standard';
  prize_type: 'top_n' | 'top_percent' | '50_50' | 'winner_take_all' | 'satellites';
  is_guaranteed: boolean;
  guaranteed_amount: number;
  roster_config: 'compact' | 'full';
  scoring_format: 'FanDuel' | 'DraftKings' | 'Yahoo' | 'ESPN' | 'Custom';
  icon_name?: string;
  html_color_primary?: string;
  html_color_secondary?: string;
  // Point configuration
  points_enabled: boolean;
  points_entry: number;
  points_win: number;
  points_placement: Array<{ rank: number; points: number }>;
  points_top_percent: Array<{ percent: number; points: number }>;
  group_id?: string | null; // null = public, string = private group
}

// Common form field styling - white background, black text
const formFieldStyle = {
  bgcolor: '#ffffff',
  color: '#000000',
  '& input': {
    color: '#000000',
  },
  '& textarea': {
    color: '#000000',
  },
  '&::placeholder': {
    color: '#666666',
  },
  '& .MuiSelect-select': {
    color: '#000000',
  },
  '& .MuiSelect-icon': {
    color: '#000000',
  },
};

export default function DFSPoolManager() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading } = useIsAdmin();
  const [activeTab, setActiveTab] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<{ poolId: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [formData, setFormData] = useState<FormData>({
    pool_name: '',
    slate_name: 'Main Slate',
    description: '',
    entry_fee: 0,
    max_entries: 1000,
    difficulty: 'standard',
    prize_type: 'top_n',
    is_guaranteed: false,
    guaranteed_amount: 0,
    roster_config: 'compact',
    scoring_format: 'FanDuel',
    icon_name: '',
    html_color_primary: '#FFC72C',
    html_color_secondary: '#000000',
    // Point configuration defaults
    points_enabled: true,
    points_entry: 10,
    points_win: 100,
    points_placement: [],
    points_top_percent: [],
    group_id: null, // Default to public
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  
  // Icon selection state
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [iconCategoryFilter, setIconCategoryFilter] = useState<string>('All');
  const [iconPage, setIconPage] = useState(0);
  const iconsPerPage = 24;

  const createPool = useCreateDFSPool();
  const updatePool = useUpdateDFSPool();
  const deletePool = useDeleteDFSPool();

  // Fetch all groups for admin selection (with error handling for RLS recursion)
  const { data: allGroups } = useQuery({
    queryKey: ['dfs-all-groups'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('dfs_groups')
          .select('id, name, slug')
          .order('name', { ascending: true });

        if (error) {
          console.warn('Error fetching groups (RLS recursion may be blocking):', error);
          // Return empty array instead of throwing to prevent page break
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn('Exception fetching groups:', err);
        return [];
      }
    },
    enabled: !!isAdmin,
    retry: false, // Don't retry on RLS errors
  });

  // Fetch admin pool summary (simplified to avoid RLS recursion)
  const { data: pools, refetch: refetchPools, isLoading: poolsLoading } = useQuery({
    queryKey: ['dfs-admin-pools'],
    queryFn: async () => {
      // Fetch pools without nested relations to avoid RLS recursion
      const { data, error } = await supabase
        .from('dfs_admin_pool_summary')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pools:', error);
        throw error;
      }
      
      console.log('📊 Fetched pools:', {
        count: data?.length || 0,
        statuses: data?.map(p => ({ id: p.pool_id, status: p.status, name: p.name })) || []
      });
      
      return data;
    },
    enabled: !!isAdmin,
  });

  // Fetch available games for selected date
  const { data: availableGames } = useQuery({
    queryKey: ['available-games', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_available_nba_games_for_dfs', {
        p_date: selectedDate,
      });

      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin && !!selectedDate,
  });

  // Handle game selection toggle
  const handleGameToggle = (gameId: string) => {
    setSelectedGames(prev => 
      prev.includes(gameId) 
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.pool_name.trim()) {
      errors.push('Pool name is required');
    }
    if (!formData.slate_name.trim()) {
      errors.push('Slate name is required');
    }
    if (formData.entry_fee < 0) {
      errors.push('Entry fee cannot be negative');
    }
    if (formData.max_entries <= 0) {
      errors.push('Max entries must be greater than 0');
    }
    if (selectedGames.length === 0) {
      errors.push('Select at least one game');
    }
    if (formData.is_guaranteed && formData.guaranteed_amount <= 0) {
      errors.push('Guaranteed amount must be greater than 0 if guaranteed is enabled');
    }

    setFormErrors(errors);
    return errors.length === 0;
  };

  // Handle form submission
  const handleCreatePool = async () => {
    if (!validateForm()) {
      return;
    }

    const params: CreateDFSPoolParams = {
      pool_name: formData.pool_name,
      slate_name: formData.slate_name,
      description: formData.description,
      slate_date: selectedDate,
      game_ids: selectedGames,
      entry_fee: formData.entry_fee,
      max_entries: formData.max_entries,
      difficulty: formData.difficulty,
      prize_type: formData.prize_type,
      is_guaranteed: formData.is_guaranteed,
      scoring_format: formData.scoring_format,
      guaranteed_amount: formData.is_guaranteed ? formData.guaranteed_amount : undefined,
      roster_config: formData.roster_config,
      icon_name: formData.icon_name || undefined,
      html_color_primary: formData.html_color_primary || undefined,
      html_color_secondary: formData.html_color_secondary || undefined,
      // Point configuration
      points_enabled: formData.points_enabled,
      points_entry: formData.points_entry,
      points_win: formData.points_win,
      points_placement: formData.points_placement.length > 0 ? formData.points_placement : undefined,
      points_top_percent: formData.points_top_percent.length > 0 ? formData.points_top_percent : undefined,
      group_id: formData.group_id || undefined,
    };

    try {
      await createPool.mutateAsync(params);
      // Success! Reset form and switch to Scheduled tab to see the new pool
      resetForm();
      setActiveTab(2); // Switch to Scheduled tab (now tab 2)
      refetchPools(); // Refresh the pools list
    } catch (error) {
      console.error('Failed to create pool:', error);
    }
  };

  // Handle edit pool
  const handleEditPool = async () => {
    if (!selectedPoolId) return;

    const errors: string[] = [];
    if (!formData.pool_name.trim()) errors.push('Pool name is required');
    if (formData.entry_fee < 0) errors.push('Entry fee cannot be negative');
    if (formData.max_entries <= 0) errors.push('Max entries must be greater than 0');

    setFormErrors(errors);
    if (errors.length > 0) return;

    const params: UpdateDFSPoolParams = {
      pool_id: selectedPoolId,
      pool_name: formData.pool_name,
      description: formData.description,
      entry_fee: formData.entry_fee,
      max_entries: formData.max_entries,
      is_guaranteed: formData.is_guaranteed,
      icon_name: formData.icon_name || undefined,
      html_color_primary: formData.html_color_primary || undefined,
      html_color_secondary: formData.html_color_secondary || undefined,
    };

    try {
      await updatePool.mutateAsync(params);
      setShowEditModal(false);
      setSelectedPoolId(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update pool:', error);
    }
  };

  // Handle delete pool
  const handleDeletePool = async () => {
    if (!selectedPoolId) return;

    try {
      await deletePool.mutateAsync(selectedPoolId);
      setShowDeleteDialog(false);
      setSelectedPoolId(null);
      // Force refetch the pools list
      setTimeout(() => refetchPools(), 500);
    } catch (error) {
      console.error('Failed to delete pool:', error);
    }
  };

  // Open edit modal with pool data
  const openEditModal = (pool: any) => {
    setSelectedPoolId(pool.pool_id);
    setFormData({
      pool_name: pool.name,
      slate_name: pool.slate_name,
      description: pool.description || '',
      entry_fee: pool.entry_fee,
      max_entries: pool.max_entries,
      difficulty: pool.difficulty_tier || 'standard',
      prize_type: pool.prize_type || 'top_n',
      is_guaranteed: pool.is_guaranteed || false,
      guaranteed_amount: pool.prize_pool || 0,
      roster_config: 'compact', // Cannot change roster config after creation
      scoring_format: pool.scoring_format || 'FanDuel', // Default to FanDuel if not set
      icon_name: pool.icon_name || '',
      html_color_primary: pool.html_color_primary || '#FFC72C',
      html_color_secondary: pool.html_color_secondary || '#000000',
    });
    setShowEditModal(true);
  };

  // Open delete confirmation
  const openDeleteDialog = (poolId: string) => {
    setSelectedPoolId(poolId);
    setShowDeleteDialog(true);
  };

  // Navigate to pool details page
  const openViewModal = (poolId: string) => {
    navigate(`/admin/dfs/pool/${poolId}`);
  };

  // Handle inline editing
  const startEditing = (poolId: string, field: string, currentValue: any) => {
    setEditingCell({ poolId, field });
    setEditingValue(String(currentValue || ''));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const saveEditing = async () => {
    if (!editingCell) return;

    const { poolId, field } = editingCell;
    const updates: any = {};

    // Convert value based on field type
    if (field === 'entry_fee' || field === 'max_entries') {
      const numValue = Number(editingValue);
      if (isNaN(numValue) || numValue < 0) {
        alert(`Invalid value for ${field}`);
        cancelEditing();
        return;
      }
      updates[field] = numValue;
    } else if (field === 'name') {
      if (!editingValue.trim()) {
        alert('Name cannot be empty');
        cancelEditing();
        return;
      }
      updates.name = editingValue.trim();
    }

    try {
      const { error } = await supabase
        .from('dfs_pools')
        .update(updates)
        .eq('id', poolId);

      if (error) throw error;

      // Refresh pools list
      refetchPools();
      cancelEditing();
    } catch (error: any) {
      console.error('Failed to update pool:', error);
      alert(`Failed to update: ${error.message}`);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      pool_name: '',
      slate_name: 'Main Slate',
      description: '',
      entry_fee: 0,
      max_entries: 1000,
      difficulty: 'standard',
      prize_type: 'top_n',
      is_guaranteed: false,
      guaranteed_amount: 0,
      roster_config: 'compact',
      scoring_format: 'FanDuel',
      icon_name: '',
      html_color_primary: '#FFC72C',
      html_color_secondary: '#000000',
    });
    setSelectedGames([]);
    setFormErrors([]);
    setIconSearchQuery('');
    setIconCategoryFilter('All');
    setIconPage(0);
    setFormData(prev => ({ ...prev, group_id: null }));
  };

  // Filter pools by status (case-insensitive, handle null/undefined)
  // MUST be before any conditional returns (Rules of Hooks)
  const scheduledPools = useMemo(() => {
    if (!pools) return [];
    return pools.filter(p => {
      const status = String(p.status || '').toLowerCase().trim();
      return status === 'scheduled';
    });
  }, [pools]);
  
  const ongoingPools = useMemo(() => {
    if (!pools) return [];
    return pools.filter(p => {
      const status = String(p.status || '').toLowerCase().trim();
      return status === 'live' || status === 'ongoing' || status === 'in progress';
    });
  }, [pools]);
  
  const completedPools = useMemo(() => {
    if (!pools) {
      console.log('🔍 completedPools: pools is null/undefined');
      return [];
    }
    const filtered = pools.filter(p => {
      const status = String(p.status || '').toLowerCase().trim();
      const isCompleted = status === 'completed' || status === 'complete' || status === 'finished' || status === 'final';
      return isCompleted;
    });
    console.log('🔍 completedPools filter result:', {
      totalPools: pools.length,
      completedCount: filtered.length,
      allStatuses: [...new Set(pools.map(p => String(p.status || 'null')))],
      completedIds: filtered.map(p => p.pool_id),
      sampleCompleted: filtered.slice(0, 3).map(p => ({ id: p.pool_id, name: p.name, status: p.status }))
    });
    return filtered;
  }, [pools]);
  
  // Debug logging - compute values inside useEffect to avoid dependency issues
  useEffect(() => {
    if (pools && pools.length > 0) {
      const allStatuses = [...new Set(pools.map(p => String(p.status || 'null')))];
      const scheduled = pools.filter(p => {
        const status = String(p.status || '').toLowerCase().trim();
        return status === 'scheduled';
      });
      const ongoing = pools.filter(p => {
        const status = String(p.status || '').toLowerCase().trim();
        return status === 'live' || status === 'ongoing' || status === 'in progress';
      });
      const completed = pools.filter(p => {
        const status = String(p.status || '').toLowerCase().trim();
        return status === 'completed' || status === 'complete' || status === 'finished' || status === 'final';
      });
      
      console.log('🔍 DFS Pools Debug:', {
        totalPools: pools.length,
        scheduled: scheduled.length,
        ongoing: ongoing.length,
        completed: completed.length,
        allStatuses: allStatuses,
        completedPoolIds: completed.map(p => p.pool_id),
        samplePools: pools.slice(0, 5).map(p => ({ 
          id: p.pool_id, 
          name: p.name, 
          status: p.status,
          statusType: typeof p.status,
          statusLower: String(p.status || '').toLowerCase().trim()
        })),
        completedSample: completed.slice(0, 3).map(p => ({
          id: p.pool_id,
          name: p.name,
          status: p.status
        }))
      });
    }
  }, [pools]);

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography level="body-sm">Loading...</Typography>
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Alert color="danger" startDecorator={<Warning />}>
        Unauthorized: You do not have admin access
      </Alert>
    );
  }

  // Render pools table
  const renderPoolsTable = (poolList: any[]) => {
    console.log('🔍 renderPoolsTable called with:', {
      poolListLength: poolList?.length || 0,
      poolList: poolList?.slice(0, 3) || [],
      isArray: Array.isArray(poolList)
    });
    
    if (!poolList || poolList.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4, bgcolor: '#ffffff' }}>
          <Typography level="body-sm" sx={{ color: '#000000', fontWeight: 'bold' }}>
            No pools in this category.
          </Typography>
        </Box>
      );
    }

    return (
      <Sheet variant="outlined" sx={{ 
        borderRadius: 0, 
        border: '1px solid #e0e0e0', 
        overflow: 'auto',
        bgcolor: '#ffffff'
      }}>
        <Table sx={{
          bgcolor: '#ffffff',
          '& thead th': {
            bgcolor: '#ffffff',
            color: '#000000',
            fontFamily: 'serif',
            fontWeight: 900,
            textTransform: 'uppercase',
            borderBottom: '2px solid #000000',
            fontSize: '0.85rem',
            letterSpacing: '0.05em'
          },
          '& tbody td': {
            borderBottom: '1px solid #e0e0e0',
            fontFamily: 'serif',
            bgcolor: '#ffffff',
            color: '#000000'
          },
          '& tbody tr:hover': {
            bgcolor: '#f5f5f5'
          }
        }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Date</th>
              <th>Status</th>
              <th>Visibility</th>
              <th>Entries</th>
              <th>Prize Pool</th>
              <th>Games</th>
              <th style={{ width: '140px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {poolList.map((pool) => (
              <tr key={pool.pool_id}>
                <td>
                  {editingCell?.poolId === pool.pool_id && editingCell?.field === 'name' ? (
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={saveEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      autoFocus
                      size="sm"
                      sx={{ ...formFieldStyle, width: '100%' }}
                    />
                  ) : (
                    <Box
                      onClick={() => startEditing(pool.pool_id, 'name', pool.name)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f0f0f0', p: 0.5, borderRadius: 1 } }}
                    >
                      <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#000000' }}>
                        {pool.name}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#000000', fontWeight: 'bold' }}>
                        {pool.slate_name}
                      </Typography>
                    </Box>
                  )}
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#000000' }}>
                    {format(new Date(pool.slate_date), 'MMM dd, yyyy')}
                  </Typography>
                </td>
                <td>
                  <Chip 
                    size="sm" 
                    variant="outlined" 
                    sx={{ 
                      borderColor: '#000000',
                      color: '#000000',
                      bgcolor: '#ffffff',
                      '&:hover': {
                        bgcolor: '#f5f5f5'
                      }
                    }}
                  >
                    {pool.status}
                  </Chip>
                </td>
                <td>
                  {pool.dfs_group_pools && pool.dfs_group_pools.length > 0 && pool.dfs_group_pools[0]?.dfs_groups ? (
                    <Chip 
                      size="sm" 
                      variant="outlined"
                      sx={{ 
                        borderColor: '#000000',
                        color: '#000000',
                        bgcolor: '#ffffff',
                        '&:hover': {
                          bgcolor: '#f5f5f5'
                        }
                      }}
                    >
                      🔒 {pool.dfs_group_pools[0].dfs_groups.name}
                    </Chip>
                  ) : (
                    <Chip 
                      size="sm" 
                      variant="soft"
                      color="success"
                      sx={{ 
                        borderColor: '#000000',
                        color: '#000000',
                        bgcolor: '#e8f5e9',
                      }}
                    >
                      🌐 Public
                    </Chip>
                  )}
                </td>
                <td>
                  {editingCell?.poolId === pool.pool_id && editingCell?.field === 'max_entries' ? (
                    <Input
                      type="number"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={saveEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      autoFocus
                      size="sm"
                      sx={{ ...formFieldStyle, width: '80px' }}
                      slotProps={{
                        input: {
                          min: 2,
                          step: 1,
                        }
                      }}
                    />
                  ) : (
                    <Box
                      onClick={() => startEditing(pool.pool_id, 'max_entries', pool.max_entries)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f0f0f0', p: 0.5, borderRadius: 1 } }}
                    >
                      <Typography level="body-sm" sx={{ color: '#000000' }}>
                        {pool.current_entries} / {pool.max_entries}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#000000', fontWeight: 'bold' }}>
                        {pool.fill_pct}% full
                      </Typography>
                    </Box>
                  )}
                </td>
                <td>
                  {editingCell?.poolId === pool.pool_id && editingCell?.field === 'entry_fee' ? (
                    <Input
                      type="number"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={saveEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing();
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      autoFocus
                      size="sm"
                      startDecorator="$"
                      sx={{ ...formFieldStyle, width: '100px' }}
                      slotProps={{
                        input: {
                          min: 0,
                          step: 0.01,
                        }
                      }}
                    />
                  ) : (
                    <Box
                      onClick={() => startEditing(pool.pool_id, 'entry_fee', pool.entry_fee)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f0f0f0', p: 0.5, borderRadius: 1 } }}
                    >
                      <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#000000' }}>
                        ${pool.entry_fee?.toLocaleString()}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#000000', fontWeight: 'bold' }}>
                        Prize: ${pool.prize_pool?.toLocaleString()}
                      </Typography>
                    </Box>
                  )}
                </td>
                <td>
                  <Chip 
                    size="sm" 
                    variant="outlined"
                    sx={{ 
                      borderColor: '#000000',
                      color: '#000000',
                      bgcolor: '#ffffff',
                      '&:hover': {
                        bgcolor: '#f5f5f5'
                      }
                    }}
                  >
                    {pool.games_count} games
                  </Chip>
                </td>
                <td>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="View pool details">
                      <IconButton
                        size="sm"
                        variant="outlined"
                        sx={{
                          borderColor: '#000000',
                          color: '#000000',
                          bgcolor: '#ffffff',
                          '&:hover': {
                            bgcolor: '#f5f5f5',
                            borderColor: '#000000',
                            color: '#000000'
                          }
                        }}
                        onClick={() => openViewModal(pool.pool_id)}
                      >
                        <Visibility sx={{ color: '#000000' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit pool">
                      <IconButton
                        size="sm"
                        variant="outlined"
                        sx={{
                          borderColor: '#000000',
                          color: '#000000',
                          bgcolor: '#ffffff',
                          '&:hover': {
                            bgcolor: '#f5f5f5',
                            borderColor: '#000000',
                            color: '#000000'
                          }
                        }}
                        onClick={() => openEditModal(pool)}
                      >
                        <Edit sx={{ color: '#000000' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete pool">
                      <IconButton
                        size="sm"
                        variant="outlined"
                        sx={{
                          borderColor: '#000000',
                          color: '#000000',
                          bgcolor: '#ffffff',
                          '&:hover': {
                            bgcolor: '#f5f5f5',
                            borderColor: '#000000',
                            color: '#000000'
                          }
                        }}
                        onClick={() => openDeleteDialog(pool.pool_id)}
                      >
                        <Delete sx={{ color: '#000000' }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sheet>
    );
  };

  return (
    <Box sx={{ 
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      bgcolor: '#ffffff',
    }}>
      <Tabs 
        value={activeTab} 
        onChange={(_, value) => setActiveTab(value as number)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          bgcolor: '#ffffff',
        }}
      >
        <TabList sx={{ 
          flexShrink: 0,
          bgcolor: '#ffffff',
          borderBottom: '2px solid #000000',
          '& button': {
            fontFamily: 'serif',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#000000',
            borderRight: '1px solid #e0e0e0',
            borderRadius: 0,
            bgcolor: '#ffffff',
            '&:last-child': {
              borderRight: 'none',
            },
            '&.Mui-selected': {
              bgcolor: '#ffffff',
              color: '#000000',
              borderBottom: '3px solid #000000',
            },
            '&:hover': {
              bgcolor: '#f5f5f5',
              color: '#000000',
            },
            '& svg, & .react-icons': {
              color: '#000000',
            }
          },
        }}>
          <Tab>
            <FaCheckCircle style={{ marginRight: 8, color: '#000000' }} />
            Complete
          </Tab>
          <Tab>
            <FaClock style={{ marginRight: 8, color: '#000000' }} />
            Ongoing
          </Tab>
          <Tab>
            <FaCalendar style={{ marginRight: 8, color: '#000000' }} />
            Scheduled
          </Tab>
          <Tab>
            <FaRocket style={{ marginRight: 8, color: '#000000' }} />
            Create
          </Tab>
        </TabList>

        <TabPanel value={0} sx={{ flex: 1, overflow: 'hidden', p: 0, bgcolor: '#ffffff' }}>
          <Box sx={{ 
            mt: 2,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: '#ffffff',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#ffffff',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#e0e0e0',
              borderRadius: '4px',
              '&:hover': {
                background: '#bdbdbd',
              },
            },
          }}>
            {poolsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              renderPoolsTable(completedPools)
            )}
          </Box>
        </TabPanel>

        <TabPanel value={1} sx={{ flex: 1, overflow: 'hidden', p: 0, bgcolor: '#ffffff' }}>
          <Box sx={{ 
            mt: 2,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: '#ffffff',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#ffffff',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#e0e0e0',
              borderRadius: '4px',
              '&:hover': {
                background: '#bdbdbd',
              },
            },
          }}>
            {renderPoolsTable(ongoingPools)}
          </Box>
        </TabPanel>

        <TabPanel value={2} sx={{ flex: 1, overflow: 'hidden', p: 0, bgcolor: '#ffffff' }}>
          <Box sx={{ 
            mt: 2,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: '#ffffff',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#ffffff',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#e0e0e0',
              borderRadius: '4px',
              '&:hover': {
                background: '#bdbdbd',
              },
            },
          }}>
            {renderPoolsTable(scheduledPools)}
          </Box>
        </TabPanel>

        <TabPanel value={3} sx={{ flex: 1, overflow: 'hidden', p: 0, bgcolor: '#ffffff' }}>
          <Box sx={{ 
            mt: 2,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            bgcolor: '#ffffff',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#ffffff',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#e0e0e0',
              borderRadius: '4px',
              '&:hover': {
                background: '#bdbdbd',
              },
            },
          }}>
            {/* Create Pool Form */}
            <Card variant="outlined" sx={{ bgcolor: '#ffffff', borderColor: '#e0e0e0' }}>
              <CardContent sx={{ bgcolor: '#ffffff' }}>
                <Stack spacing={3}>
                  {/* Validation Errors */}
                  {formErrors.length > 0 && (
                    <Alert color="danger" size="sm">
                      <Stack spacing={0.5}>
                        {formErrors.map((error, i) => (
                          <Typography key={i} level="body-xs">• {error}</Typography>
                        ))}
                      </Stack>
                    </Alert>
                  )}

                  {/* Success Message */}
                  {createPool.isSuccess && (
                    <Alert color="success" startDecorator={<CheckCircle />}>
                      <Typography level="body-sm">
                        Pool created successfully! {createPool.data?.players_added} players added from {createPool.data?.games_added} games.
                      </Typography>
                    </Alert>
                  )}

                  {/* Pool Name & Slate Name */}
                  <Grid container spacing={2}>
                    <Grid xs={8}>
                      <FormControl required>
                        <FormLabel>Pool Name</FormLabel>
                        <Input 
                          placeholder="e.g., Sunday Night Showdown" 
                          value={formData.pool_name}
                          onChange={(e) => setFormData({...formData, pool_name: e.target.value})}
                          disabled={createPool.isPending}
                          sx={formFieldStyle}
                        />
                      </FormControl>
                    </Grid>
                    <Grid xs={4}>
                      <FormControl required>
                        <FormLabel>Slate Name</FormLabel>
                        <Input 
                          placeholder="Main Slate" 
                          value={formData.slate_name}
                          onChange={(e) => setFormData({...formData, slate_name: e.target.value})}
                          disabled={createPool.isPending}
                          sx={formFieldStyle}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Description */}
                  <FormControl>
                    <FormLabel>Description (optional)</FormLabel>
                    <Textarea 
                      placeholder="Brief description of the pool" 
                      minRows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      disabled={createPool.isPending}
                      sx={formFieldStyle}
                    />
                  </FormControl>

                  {/* Entry Fee & Max Entries */}
                  <Grid container spacing={2}>
                    <Grid xs={4}>
                      <FormControl required>
                        <FormLabel>Entry Fee</FormLabel>
                        <Input 
                          type="number" 
                          startDecorator="$" 
                          value={formData.entry_fee}
                          onChange={(e) => setFormData({...formData, entry_fee: Number(e.target.value)})}
                          disabled={createPool.isPending}
                          sx={formFieldStyle}
                          slotProps={{
                            input: {
                              min: 0,
                              step: 1,
                            }
                          }}
                        />
                        <FormHelperText>Set to $0 for testing/free pools</FormHelperText>
                      </FormControl>
                    </Grid>
                    <Grid xs={4}>
                      <FormControl required>
                        <FormLabel>Max Entries</FormLabel>
                        <Input 
                          type="number" 
                          value={formData.max_entries}
                          onChange={(e) => setFormData({...formData, max_entries: Number(e.target.value)})}
                          disabled={createPool.isPending}
                          sx={formFieldStyle}
                          slotProps={{
                            input: {
                              min: 2,
                              step: 1,
                            }
                          }}
                        />
                      </FormControl>
                    </Grid>
                    <Grid xs={4}>
                      <FormControl>
                        <FormLabel>Prize Type</FormLabel>
                        <Select 
                          value={formData.prize_type}
                          onChange={(_, value) => setFormData({...formData, prize_type: value as any})}
                          disabled={createPool.isPending}
                          sx={formFieldStyle}
                        >
                          <Option value="top_n">Top N</Option>
                          <Option value="top_percent">Top %</Option>
                          <Option value="50_50">50/50</Option>
                          <Option value="winner_take_all">Winner Takes All</Option>
                          <Option value="satellites">Satellites</Option>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Difficulty (Salary Cap) */}
                  <FormControl required>
                    <FormLabel>Difficulty Level (Salary Cap)</FormLabel>
                    <Select 
                      value={formData.difficulty}
                      onChange={(_, value) => setFormData({...formData, difficulty: value as any})}
                      disabled={createPool.isPending}
                      sx={formFieldStyle}
                    >
                      <Option value="elite">⚡ Standard ($154.6M cap) - Hardest</Option>
                      <Option value="pro">💪 Apron 1 ($195.9M cap) - First Apron</Option>
                      <Option value="standard">🔥 Apron 2 ($207.8M cap) - Second Apron (Easiest)</Option>
                    </Select>
                    <FormHelperText>
                      Users must build lineups under this salary cap using REAL NBA salaries
                    </FormHelperText>
                  </FormControl>

                  {/* Roster Configuration */}
                  <FormControl required>
                    <FormLabel>Roster Configuration</FormLabel>
                    <Select 
                      value={formData.roster_config}
                      onChange={(_, value) => setFormData({...formData, roster_config: value as any})}
                      disabled={createPool.isPending}
                      sx={formFieldStyle}
                    >
                      <Option value="compact">
                        <Box>
                          <Typography level="title-sm">🎯 Compact (10 players)</Typography>
                          <Typography level="body-xs">
                            Starters (5): G G F F C at 1.0x | Rotation (3): G F C at 0.75x | Bench (2): UTIL UTIL at 0.5x
                          </Typography>
                        </Box>
                      </Option>
                      <Option value="full">
                        <Box>
                          <Typography level="title-sm">🏀 Full Roster (13 players)</Typography>
                          <Typography level="body-xs">
                            Starters (5): G G F F C at 1.0x | Rotation (5): G G F F C at 0.75x | Bench (3): UTIL UTIL UTIL at 0.5x
                          </Typography>
                        </Box>
                      </Option>
                    </Select>
                    <FormHelperText>
                      Choose lineup size and structure. Full roster provides more lineup combinations.
                    </FormHelperText>
                  </FormControl>

                  {/* Scoring Format */}
                  <FormControl required>
                    <FormLabel>Scoring Format</FormLabel>
                    <Select 
                      value={formData.scoring_format}
                      onChange={(_, value) => setFormData({...formData, scoring_format: value as any})}
                      disabled={createPool.isPending}
                      sx={formFieldStyle}
                    >
                      <Option value="FanDuel">
                        <Box>
                          <Typography level="title-sm">📊 FanDuel</Typography>
                          <Typography level="body-xs">
                            PTS: 1, REB: 1.2, AST: 1.5, STL/BLK: 2, TOV: -1
                          </Typography>
                        </Box>
                      </Option>
                      <Option value="DraftKings">
                        <Box>
                          <Typography level="title-sm">👑 DraftKings</Typography>
                          <Typography level="body-xs">
                            PTS: 1, REB: 1.25, AST: 1.5, STL/BLK: 2, TOV: -0.5, Bonuses for 2x2/3x3
                          </Typography>
                        </Box>
                      </Option>
                      <Option value="Yahoo">
                        <Box>
                          <Typography level="title-sm">🟣 Yahoo Fantasy</Typography>
                          <Typography level="body-xs">
                            PTS: 1, REB: 1, AST: 1, STL/BLK: 2, TOV: -1, FG/FT Made/Missed: ±0.5
                          </Typography>
                        </Box>
                      </Option>
                      <Option value="ESPN">
                        <Box>
                          <Typography level="title-sm">🔴 ESPN Fantasy</Typography>
                          <Typography level="body-xs">
                            PTS: 1, REB: 1, AST: 1, STL/BLK: 2, TOV: -1
                          </Typography>
                        </Box>
                      </Option>
                    </Select>
                    <FormHelperText>
                      Select the fantasy scoring system for this pool
                    </FormHelperText>
                  </FormControl>

                  {/* Points Configuration */}
                  <Box sx={{ border: '2px solid #333', borderRadius: '8px', p: 2, bgcolor: '#ffffff' }}>
                    <Typography level="title-md" sx={{ mb: 2, color: '#000000' }}>
                      🎯 Points Configuration
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Checkbox
                        label="Enable Points for this Pool"
                        checked={formData.points_enabled}
                        onChange={(e) => setFormData({...formData, points_enabled: e.target.checked})}
                        disabled={createPool.isPending}
                      />
                      <FormHelperText sx={{ mt: 0.5, ml: 4 }}>
                        Users will earn points for entering and placing in this pool
                      </FormHelperText>
                    </Box>

                    {formData.points_enabled && (
                      <Stack spacing={2}>
                        <Grid container spacing={2}>
                          <Grid xs={6}>
                            <FormControl>
                              <FormLabel>Points for Entry</FormLabel>
                              <Input
                                type="number"
                                value={formData.points_entry}
                                onChange={(e) => setFormData({...formData, points_entry: Number(e.target.value)})}
                                disabled={createPool.isPending}
                                sx={formFieldStyle}
                                slotProps={{
                                  input: {
                                    min: 0,
                                    step: 1,
                                  }
                                }}
                              />
                              <FormHelperText>Points awarded when user enters pool</FormHelperText>
                            </FormControl>
                          </Grid>
                          <Grid xs={6}>
                            <FormControl>
                              <FormLabel>Points for 1st Place</FormLabel>
                              <Input
                                type="number"
                                value={formData.points_win}
                                onChange={(e) => setFormData({...formData, points_win: Number(e.target.value)})}
                                disabled={createPool.isPending}
                                sx={formFieldStyle}
                                slotProps={{
                                  input: {
                                    min: 0,
                                    step: 1,
                                  }
                                }}
                              />
                              <FormHelperText>Points awarded for winning (1st place)</FormHelperText>
                            </FormControl>
                          </Grid>
                        </Grid>

                        <Alert color="info" size="sm">
                          <Typography level="body-sm">
                            💡 Tip: You can add incremental placement points (2nd, 3rd, etc.) and top percentage points after pool creation.
                          </Typography>
                        </Alert>
                      </Stack>
                    )}
                  </Box>

                  {/* Icon Selection - will be added in next section */}
                  {/* Date Selection */}
                  <FormControl required>
                    <FormLabel>Slate Date</FormLabel>
                    <Input 
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      disabled={createPool.isPending}
                      sx={formFieldStyle}
                    />
                  </FormControl>

                  {/* Game Selection */}
                  <Box>
                    <FormLabel required sx={{ mb: 1, display: 'block' }}>Select Games</FormLabel>
                    {availableGames && availableGames.length > 0 ? (
                      <Box sx={{ 
                        border: '2px solid #000', 
                        borderRadius: '8px', 
                        p: 2, 
                        maxHeight: '300px', 
                        overflowY: 'auto' 
                      }}>
                        <Stack spacing={1}>
                          {availableGames.map((game: any) => (
                            <Checkbox
                              key={game.game_id}
                              label={`${game.away_team} @ ${game.home_team} - ${format(new Date(game.game_date), 'h:mm a')}`}
                              checked={selectedGames.includes(game.game_id)}
                              onChange={() => handleGameToggle(game.game_id)}
                              disabled={createPool.isPending}
                            />
                          ))}
                        </Stack>
                      </Box>
                    ) : (
                      <Alert color="warning" size="sm">
                        No games available for the selected date. Please choose a different date.
                      </Alert>
                    )}
                    <FormHelperText sx={{ mt: 1 }}>
                      Select at least one game to include in this pool
                    </FormHelperText>
                  </Box>

                  {/* Pool Visibility: Public or Private Group */}
                  <FormControl required>
                    <FormLabel>Pool Visibility</FormLabel>
                    <Select 
                      value={formData.group_id === null ? 'public' : formData.group_id}
                      onChange={(_, value) => {
                        if (value === 'public') {
                          setFormData({...formData, group_id: null});
                        } else {
                          setFormData({...formData, group_id: value as string});
                        }
                      }}
                      disabled={createPool.isPending}
                      sx={formFieldStyle}
                    >
                      <Option value="public">🌐 Public (Available to Everyone)</Option>
                      {allGroups?.map((group) => (
                        <Option key={group.id} value={group.id}>
                          🔒 {group.name}
                        </Option>
                      ))}
                    </Select>
                    <FormHelperText>
                      {formData.group_id === null 
                        ? 'This pool will be visible to all users'
                        : `This pool will only be visible to members of the selected group`}
                    </FormHelperText>
                  </FormControl>

                  {/* Guaranteed Prize Pool */}
                  <FormControl>
                    <Checkbox
                      label="Guaranteed Prize Pool"
                      checked={formData.is_guaranteed}
                      onChange={(e) => setFormData({...formData, is_guaranteed: e.target.checked})}
                      disabled={createPool.isPending}
                    />
                  </FormControl>
                  {formData.is_guaranteed && (
                    <FormControl>
                      <FormLabel>Guaranteed Amount</FormLabel>
                      <Input
                        type="number"
                        startDecorator="$"
                        placeholder="Guaranteed amount"
                        value={formData.guaranteed_amount}
                        onChange={(e) => setFormData({...formData, guaranteed_amount: Number(e.target.value)})}
                        disabled={createPool.isPending}
                        sx={{
                          bgcolor: '#ffffff',
                          color: '#000000',
                          '& input': {
                            color: '#000000',
                          },
                          '&::placeholder': {
                            color: '#666666',
                          },
                        }}
                        slotProps={{
                          input: {
                            min: 0,
                            step: 1,
                          }
                        }}
                      />
                    </FormControl>
                  )}

                  {/* Icon Selection */}
                  <FormControl>
                    <FormLabel>Pool Icon (Optional)</FormLabel>
                    <FormHelperText sx={{ mb: 1 }}>
                      Choose an icon to represent this pool. Icons help users quickly identify different pool types.
                    </FormHelperText>
                    
                    {/* Selected Icon Preview */}
                    {formData.icon_name && (
                      <Box sx={{ mb: 2, p: 2, bgcolor: '#f9f9f9', border: '2px solid #000', borderRadius: '8px' }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Box>
                            {(() => {
                              const IconComponent = getIconByName(formData.icon_name);
                              return IconComponent ? (
                                <IconComponent 
                                  size={32} 
                                  color={formData.html_color_primary || '#FFC72C'} 
                                />
                              ) : null;
                            })()}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography level="body-sm" fontWeight={600}>
                              Selected: {DFS_POOL_ICONS.find(i => i.name === formData.icon_name)?.label || formData.icon_name}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: '#666' }}>
                              {DFS_POOL_ICONS.find(i => i.name === formData.icon_name)?.category || 'Unknown'}
                            </Typography>
                          </Box>
                          <Button
                            size="sm"
                            variant="outlined"
                            onClick={() => setFormData({...formData, icon_name: ''})}
                          >
                            Clear
                          </Button>
                        </Stack>
                      </Box>
                    )}

                    {/* Icon Search and Filter */}
                    <Stack spacing={2} sx={{ mb: 2 }}>
                      <Input
                        placeholder="Search icons..."
                        value={iconSearchQuery}
                        onChange={(e) => {
                          setIconSearchQuery(e.target.value);
                          setIconPage(0);
                        }}
                        startDecorator={<Search />}
                        disabled={createPool.isPending}
                        sx={formFieldStyle}
                      />
                      
                      {/* Category Filter */}
                      <Select
                        value={iconCategoryFilter}
                        onChange={(_, value) => {
                          setIconCategoryFilter(value as string);
                          setIconPage(0);
                        }}
                        disabled={createPool.isPending}
                        sx={formFieldStyle}
                      >
                        <Option value="All">All Categories</Option>
                        {getIconCategories().map(category => (
                          <Option key={category} value={category}>{category}</Option>
                        ))}
                      </Select>
                    </Stack>

                    {/* Filtered Icons */}
                    {(() => {
                      let filteredIcons = iconCategoryFilter === 'All' 
                        ? DFS_POOL_ICONS 
                        : getIconsByCategory(iconCategoryFilter);
                      
                      if (iconSearchQuery) {
                        filteredIcons = searchIcons(iconSearchQuery);
                      }
                      
                      const totalPages = Math.ceil(filteredIcons.length / iconsPerPage);
                      const startIndex = iconPage * iconsPerPage;
                      const endIndex = startIndex + iconsPerPage;
                      const paginatedIcons = filteredIcons.slice(startIndex, endIndex);
                      
                      return (
                        <Box>
                          <Box sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                            gap: 1.5,
                            p: 2,
                            bgcolor: '#f9f9f9',
                            border: '2px solid #000',
                            borderRadius: '8px',
                            maxHeight: '400px',
                            overflowY: 'auto',
                            mb: 2
                          }}>
                            {paginatedIcons.map((icon) => {
                              const IconComponent = icon.component;
                              const isSelected = formData.icon_name === icon.name;
                              return (
                                <Box
                                  key={icon.name}
                                  onClick={() => setFormData({...formData, icon_name: icon.name})}
                                  sx={{
                                    p: 1.5,
                                    border: `2px solid ${isSelected ? '#000' : '#ddd'}`,
                                    borderRadius: '8px',
                                    bgcolor: isSelected ? '#fff' : '#fff',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                      borderColor: '#000',
                                      bgcolor: '#f5f5f5',
                                      transform: 'scale(1.05)',
                                    },
                                  }}
                                >
                                  <IconComponent 
                                    size={24} 
                                    color={isSelected ? (formData.html_color_primary || '#FFC72C') : '#666'} 
                                  />
                                  <Typography level="body-xs" sx={{ 
                                    color: '#000',
                                    fontSize: '10px',
                                    textAlign: 'center',
                                    wordBreak: 'break-word'
                                  }}>
                                    {icon.label}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                          
                          {/* Pagination Controls */}
                          {totalPages > 1 && (
                            <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
                              <IconButton
                                variant="outlined"
                                size="sm"
                                onClick={() => setIconPage(Math.max(0, iconPage - 1))}
                                disabled={iconPage === 0 || createPool.isPending}
                              >
                                <ChevronLeft />
                              </IconButton>
                              <Typography level="body-sm">
                                Page {iconPage + 1} of {totalPages} ({filteredIcons.length} icons)
                              </Typography>
                              <IconButton
                                variant="outlined"
                                size="sm"
                                onClick={() => setIconPage(Math.min(totalPages - 1, iconPage + 1))}
                                disabled={iconPage >= totalPages - 1 || createPool.isPending}
                              >
                                <ChevronRight />
                              </IconButton>
                            </Stack>
                          )}
                        </Box>
                      );
                    })()}
                  </FormControl>

                  {/* Color Selection */}
                  <Grid container spacing={2}>
                    <Grid xs={6}>
                      <FormControl>
                        <FormLabel>Primary Color</FormLabel>
                        <Input
                          type="color"
                          value={formData.html_color_primary || '#FFC72C'}
                          onChange={(e) => setFormData({...formData, html_color_primary: e.target.value})}
                          disabled={createPool.isPending}
                          sx={formFieldStyle}
                        />
                      </FormControl>
                    </Grid>
                    <Grid xs={6}>
                      <FormControl>
                        <FormLabel>Secondary Color</FormLabel>
                        <Input
                          type="color"
                          value={formData.html_color_secondary || '#000000'}
                          onChange={(e) => setFormData({...formData, html_color_secondary: e.target.value})}
                          disabled={createPool.isPending}
                          sx={formFieldStyle}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Action Buttons */}
                  <Stack direction="row" spacing={2}>
                    <Button 
                      variant="outlined" 
                      onClick={resetForm}
                      fullWidth
                      disabled={createPool.isPending}
                    >
                      Reset
                    </Button>
                    <Button 
                      fullWidth
                      onClick={handleCreatePool}
                      disabled={createPool.isPending}
                      startDecorator={createPool.isPending ? <CircularProgress size="sm" /> : <Add />}
                      sx={{
                        bgcolor: '#000',
                        color: '#fff',
                        fontFamily: 'serif',
                        fontWeight: 900,
                        borderRadius: 0,
                        border: '2px solid #000',
                        '&:hover': {
                          bgcolor: '#333',
                        },
                        '&:disabled': {
                          bgcolor: '#666',
                          color: '#999',
                        },
                      }}
                    >
                      {createPool.isPending ? 'Creating...' : 'Create Pool'}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
      </Tabs>

      {/* Edit Pool Modal */}
      <Modal open={showEditModal} onClose={() => !updatePool.isPending && setShowEditModal(false)}>
        <ModalDialog sx={{ minWidth: 500, maxWidth: 700 }}>
          <DialogTitle>✏️ Edit DFS Pool</DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              {/* Validation Errors */}
              {formErrors.length > 0 && (
                <Alert color="danger" size="sm">
                  <Stack spacing={0.5}>
                    {formErrors.map((error, i) => (
                      <Typography key={i} level="body-xs">• {error}</Typography>
                    ))}
                  </Stack>
                </Alert>
              )}

              {/* Success Message */}
              {updatePool.isSuccess && (
                <Alert color="success" startDecorator={<CheckCircle />}>
                  <Typography level="body-sm">
                    Pool updated successfully!
                  </Typography>
                </Alert>
              )}

              {/* Pool Name */}
              <FormControl required>
                <FormLabel>Pool Name</FormLabel>
                <Input 
                  placeholder="e.g., Sunday Night Showdown" 
                  value={formData.pool_name}
                  onChange={(e) => setFormData({...formData, pool_name: e.target.value})}
                  disabled={updatePool.isPending}
                  sx={formFieldStyle}
                />
              </FormControl>

              {/* Description */}
              <FormControl>
                <FormLabel>Description (optional)</FormLabel>
                <Textarea 
                  placeholder="Brief description of the pool" 
                  minRows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  disabled={updatePool.isPending}
                  sx={formFieldStyle}
                />
              </FormControl>

              {/* Entry Fee & Max Entries */}
              <Grid container spacing={2}>
                <Grid xs={6}>
                  <FormControl required>
                    <FormLabel>Entry Fee</FormLabel>
                    <Input 
                      type="number" 
                      startDecorator="$" 
                      value={formData.entry_fee}
                      onChange={(e) => setFormData({...formData, entry_fee: Number(e.target.value)})}
                      disabled={updatePool.isPending}
                      sx={formFieldStyle}
                      slotProps={{
                        input: {
                          min: 0,
                          step: 1,
                        }
                      }}
                    />
                  </FormControl>
                </Grid>
                <Grid xs={6}>
                  <FormControl required>
                    <FormLabel>Max Entries</FormLabel>
                    <Input 
                      type="number" 
                      value={formData.max_entries}
                      onChange={(e) => setFormData({...formData, max_entries: Number(e.target.value)})}
                      disabled={updatePool.isPending}
                      sx={formFieldStyle}
                      slotProps={{
                        input: {
                          min: 2,
                          step: 1,
                        }
                      }}
                    />
                  </FormControl>
                </Grid>
              </Grid>

              {/* Icon Selection - Same as create modal */}
              <FormControl>
                <FormLabel>Pool Icon (Optional)</FormLabel>
                <FormHelperText sx={{ mb: 1 }}>
                  Choose an icon to represent this pool. Icons help users quickly identify different pool types.
                </FormHelperText>
                
                {/* Selected Icon Preview */}
                {formData.icon_name && (
                  <Box sx={{ mb: 2, p: 2, bgcolor: '#f9f9f9', border: '2px solid #000', borderRadius: '8px' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box>
                        {(() => {
                          const IconComponent = getIconByName(formData.icon_name);
                          return IconComponent ? (
                            <IconComponent 
                              size={32} 
                              color={formData.html_color_primary || '#FFC72C'} 
                            />
                          ) : null;
                        })()}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography level="body-sm" fontWeight={600}>
                          Selected: {DFS_POOL_ICONS.find(i => i.name === formData.icon_name)?.label || formData.icon_name}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: '#666' }}>
                          {DFS_POOL_ICONS.find(i => i.name === formData.icon_name)?.category || 'Unknown'}
                        </Typography>
                      </Box>
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => setFormData({...formData, icon_name: ''})}
                      >
                        Clear
                      </Button>
                    </Stack>
                  </Box>
                )}

                {/* Icon Search and Filter */}
                <Stack spacing={2} sx={{ mb: 2 }}>
                  <Input
                    placeholder="Search icons..."
                    value={iconSearchQuery}
                    onChange={(e) => {
                      setIconSearchQuery(e.target.value);
                      setIconPage(0);
                    }}
                    startDecorator={<Search />}
                    disabled={updatePool.isPending}
                    sx={formFieldStyle}
                  />
                  
                  {/* Category Filter */}
                  <Select
                    value={iconCategoryFilter}
                    onChange={(_, value) => {
                      setIconCategoryFilter(value as string);
                      setIconPage(0);
                    }}
                    disabled={updatePool.isPending}
                    sx={formFieldStyle}
                  >
                    <Option value="All">All Categories</Option>
                    {getIconCategories().map(category => (
                      <Option key={category} value={category}>{category}</Option>
                    ))}
                  </Select>
                </Stack>

                {/* Filtered Icons */}
                {(() => {
                  let filteredIcons = iconCategoryFilter === 'All' 
                    ? DFS_POOL_ICONS 
                    : getIconsByCategory(iconCategoryFilter);
                  
                  if (iconSearchQuery) {
                    filteredIcons = searchIcons(iconSearchQuery);
                  }
                  
                  const totalPages = Math.ceil(filteredIcons.length / iconsPerPage);
                  const startIndex = iconPage * iconsPerPage;
                  const endIndex = startIndex + iconsPerPage;
                  const paginatedIcons = filteredIcons.slice(startIndex, endIndex);
                  
                  return (
                    <Box>
                      <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                        gap: 1.5,
                        p: 2,
                        bgcolor: '#f9f9f9',
                        border: '2px solid #000',
                        borderRadius: '8px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        mb: 2
                      }}>
                        {paginatedIcons.map((icon) => {
                          const IconComponent = icon.component;
                          const isSelected = formData.icon_name === icon.name;
                          return (
                            <Box
                              key={icon.name}
                              onClick={() => setFormData({...formData, icon_name: icon.name})}
                              sx={{
                                p: 1.5,
                                border: `2px solid ${isSelected ? '#000' : '#ddd'}`,
                                borderRadius: '8px',
                                bgcolor: isSelected ? '#fff' : '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 0.5,
                                transition: 'all 0.2s',
                                '&:hover': {
                                  borderColor: '#000',
                                  bgcolor: '#f5f5f5',
                                  transform: 'scale(1.05)',
                                },
                              }}
                            >
                              <IconComponent 
                                size={24} 
                                color={isSelected ? (formData.html_color_primary || '#FFC72C') : '#666'} 
                              />
                              <Typography level="body-xs" sx={{ 
                                color: '#000',
                                fontSize: '10px',
                                textAlign: 'center',
                                wordBreak: 'break-word'
                              }}>
                                {icon.label}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                      
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
                          <IconButton
                            variant="outlined"
                            size="sm"
                            onClick={() => setIconPage(Math.max(0, iconPage - 1))}
                            disabled={iconPage === 0 || updatePool.isPending}
                          >
                            <ChevronLeft />
                          </IconButton>
                          <Typography level="body-sm">
                            Page {iconPage + 1} of {totalPages} ({filteredIcons.length} icons)
                          </Typography>
                          <IconButton
                            variant="outlined"
                            size="sm"
                            onClick={() => setIconPage(Math.min(totalPages - 1, iconPage + 1))}
                            disabled={iconPage >= totalPages - 1 || updatePool.isPending}
                          >
                            <ChevronRight />
                          </IconButton>
                        </Stack>
                      )}
                    </Box>
                  );
                })()}
                
                {/* Color Pickers */}
                {formData.icon_name && (
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid xs={6}>
                      <FormControl>
                        <FormLabel>Primary Color</FormLabel>
                        <Input
                          type="color"
                          value={formData.html_color_primary || '#FFC72C'}
                          onChange={(e) => setFormData({...formData, html_color_primary: e.target.value})}
                          disabled={updatePool.isPending}
                          sx={{
                            ...formFieldStyle,
                            height: '50px',
                            border: '2px solid #000',
                            borderRadius: '8px',
                            cursor: 'pointer',
                          }}
                        />
                      </FormControl>
                    </Grid>
                    <Grid xs={6}>
                      <FormControl>
                        <FormLabel>Secondary Color</FormLabel>
                        <Input
                          type="color"
                          value={formData.html_color_secondary || '#000000'}
                          onChange={(e) => setFormData({...formData, html_color_secondary: e.target.value})}
                          disabled={updatePool.isPending}
                          sx={{
                            ...formFieldStyle,
                            height: '50px',
                            border: '2px solid #000',
                            borderRadius: '8px',
                            cursor: 'pointer',
                          }}
                        />
                      </FormControl>
                    </Grid>
                  </Grid>
                )}
              </FormControl>

              {/* Guaranteed Prize Pool */}
              <Box>
                <Checkbox 
                  label="Guaranteed Prize Pool"
                  checked={formData.is_guaranteed}
                  onChange={(e) => setFormData({...formData, is_guaranteed: e.target.checked})}
                  disabled={updatePool.isPending}
                />
              </Box>

              <Alert color="neutral" size="sm">
                <Typography level="body-xs">
                  Note: You cannot change games, date, or salary cap after pool creation.
                </Typography>
              </Alert>

              {/* Action Buttons */}
              <Stack direction="row" spacing={2}>
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedPoolId(null);
                    resetForm();
                  }}
                  fullWidth
                  disabled={updatePool.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  fullWidth
                  onClick={handleEditPool}
                  disabled={updatePool.isPending}
                  startDecorator={updatePool.isPending ? <CircularProgress size="sm" /> : <Edit />}
                  sx={{
                    bgcolor: '#000',
                    color: '#fff',
                    fontFamily: 'serif',
                    fontWeight: 900,
                    borderRadius: 0,
                    border: '2px solid #000',
                    '&:hover': {
                      bgcolor: '#333',
                    },
                    '&:disabled': {
                      bgcolor: '#666',
                      color: '#999',
                    },
                  }}
                >
                  {updatePool.isPending ? 'Updating...' : 'Update Pool'}
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
        </ModalDialog>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal open={showDeleteDialog} onClose={() => !deletePool.isPending && setShowDeleteDialog(false)}>
        <ModalDialog variant="outlined" role="alertdialog" sx={{ maxWidth: 500 }}>
          <DialogTitle>
            <Warning color="warning" />
            Delete Pool?
          </DialogTitle>
          <DialogContent>
            <Typography level="body-md" sx={{ mb: 2 }}>
              Are you sure you want to delete this pool? This action cannot be undone.
            </Typography>
            <Alert color="danger" size="sm">
              <Typography level="body-xs">
                This will delete:
              </Typography>
              <Typography level="body-xs">
                • The pool and all its settings<br />
                • All user lineups for this pool<br />
                • All player salaries<br />
                • All associated game data
              </Typography>
            </Alert>
          </DialogContent>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedPoolId(null);
              }}
              fullWidth
              disabled={deletePool.isPending}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onClick={handleDeletePool}
              disabled={deletePool.isPending}
              startDecorator={deletePool.isPending ? <CircularProgress size="sm" /> : <Delete />}
              fullWidth
              sx={{
                bgcolor: '#ef4444',
                color: '#fff',
                fontFamily: 'serif',
                fontWeight: 900,
                borderRadius: 0,
                border: '2px solid #ef4444',
                '&:hover': {
                  bgcolor: '#dc2626',
                },
                '&:disabled': {
                  bgcolor: '#fca5a5',
                  color: '#fff',
                },
              }}
            >
              {deletePool.isPending ? 'Deleting...' : 'Delete Pool'}
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
}

