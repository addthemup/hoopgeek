import React, { useState } from 'react';
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
} from '@mui/joy';
import { MonetizationOn, Add, Warning, CalendarToday, CheckCircle, Edit, Delete, Visibility } from '@mui/icons-material';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { format } from 'date-fns';
import { useCreateDFSPool, CreateDFSPoolParams } from '../../hooks/useCreateDFSPool';
import { useUpdateDFSPool, UpdateDFSPoolParams } from '../../hooks/useUpdateDFSPool';
import { useDeleteDFSPool } from '../../hooks/useDeleteDFSPool';
import AdminPoolViewModal from './AdminPoolViewModal';

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
}

export default function DFSPoolManager() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
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
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const createPool = useCreateDFSPool();
  const updatePool = useUpdateDFSPool();
  const deletePool = useDeleteDFSPool();

  // Fetch admin pool summary
  const { data: pools, refetch: refetchPools } = useQuery({
    queryKey: ['dfs-admin-pools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_admin_pool_summary')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
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
    };

    try {
      await createPool.mutateAsync(params);
      // Success! Close modal and reset form
      setShowCreateModal(false);
      resetForm();
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
    });
    setShowEditModal(true);
  };

  // Open delete confirmation
  const openDeleteDialog = (poolId: string) => {
    setSelectedPoolId(poolId);
    setShowDeleteDialog(true);
  };

  // Open view modal
  const openViewModal = (poolId: string) => {
    setSelectedPoolId(poolId);
    setShowViewModal(true);
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
    });
    setSelectedGames([]);
    setFormErrors([]);
  };

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

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography level="h2" startDecorator={<MonetizationOn />}>
              🏀 DFS Pool Management
            </Typography>
            <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
              Create and manage Daily Fantasy Sports contests with REAL NBA salaries
            </Typography>
          </Box>
          <Chip color="warning" variant="soft" size="sm">
            Admin Only
          </Chip>
        </Stack>
      </Box>

      {/* Quick Stats */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Pools</Typography>
            <Typography level="h3">{pools?.length || 0}</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Today</Typography>
            <Typography level="h3">
              {pools?.filter(p => p.slate_date === format(new Date(), 'yyyy-MM-dd')).length || 0}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ flex: 1 }}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Entries</Typography>
            <Typography level="h3">
              {pools?.reduce((sum, p) => sum + (p.current_entries || 0), 0) || 0}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Actions */}
      <Box sx={{ mb: 3 }}>
        <Button 
          startDecorator={<Add />} 
          size="lg" 
          fullWidth
          onClick={() => setShowCreateModal(true)}
          sx={{
            bgcolor: '#000',
            color: '#fff',
            fontFamily: 'serif',
            fontWeight: 900,
            borderRadius: 0,
            border: '2px solid #000',
            '&:hover': {
              bgcolor: '#333',
              transform: 'translate(-2px, -2px)',
              boxShadow: '4px 4px 0px #000',
            },
          }}
        >
          Create New DFS Pool
        </Button>
      </Box>

      {/* Pools List */}
      <Card variant="outlined">
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2 }}>
            Recent Pools
          </Typography>
          
          {pools && pools.length > 0 ? (
            <Sheet variant="outlined" sx={{ borderRadius: 0, border: '3px solid #000', overflow: 'auto' }}>
              <Table sx={{
                '& thead th': {
                  bgcolor: '#000',
                  color: '#fff',
                  fontFamily: 'serif',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  borderBottom: '3px solid #000',
                  fontSize: '0.85rem',
                  letterSpacing: '0.05em'
                },
                '& tbody td': {
                  borderBottom: '2px solid #000',
                  fontFamily: 'serif'
                },
                '& tbody tr:hover': {
                  bgcolor: '#f0f0f0'
                }
              }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Entries</th>
                    <th>Prize Pool</th>
                    <th>Games</th>
                    <th style={{ width: '140px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pools.map((pool) => (
                    <tr key={pool.pool_id}>
                      <td>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {pool.name}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>
                          {pool.slate_name}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {format(new Date(pool.slate_date), 'MMM dd, yyyy')}
                        </Typography>
                      </td>
                      <td>
                        <Chip size="sm" variant="soft" color="primary">
                          {pool.status}
                        </Chip>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {pool.current_entries} / {pool.max_entries}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>
                          {pool.fill_pct}% full
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          ${pool.prize_pool?.toLocaleString()}
                        </Typography>
                      </td>
                      <td>
                        <Chip size="sm" variant="outlined">
                          {pool.games_count} games
                        </Chip>
                      </td>
                      <td>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="View pool details">
                            <IconButton
                              size="sm"
                              variant="outlined"
                              color="success"
                              onClick={() => openViewModal(pool.pool_id)}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit pool">
                            <IconButton
                              size="sm"
                              variant="outlined"
                              color="primary"
                              onClick={() => openEditModal(pool)}
                            >
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete pool">
                            <IconButton
                              size="sm"
                              variant="outlined"
                              color="danger"
                              onClick={() => openDeleteDialog(pool.pool_id)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Sheet>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography level="body-sm" sx={{ color: '#000', fontWeight: 'bold' }}>
                No pools yet. Create your first DFS pool to get started!
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Alert color="primary" sx={{ mt: 3 }}>
        <Typography level="body-sm">
          <strong>How it works:</strong> Select NBA games → Players from those teams are 
          automatically added with their REAL NBA salaries. Users build lineups under 
          salary caps of $154.6M (Elite), $195.9M (Pro), or $207.8M (Standard).
        </Typography>
      </Alert>

      {/* Create Pool Modal */}
      <Modal open={showCreateModal} onClose={() => !createPool.isPending && setShowCreateModal(false)}>
        <ModalDialog sx={{ minWidth: 600, maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
          <DialogTitle>🏀 Create New DFS Pool</DialogTitle>
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

              {/* Guaranteed Prize Pool */}
              <Box>
                <Checkbox 
                  label="Guaranteed Prize Pool"
                  checked={formData.is_guaranteed}
                  onChange={(e) => setFormData({...formData, is_guaranteed: e.target.checked})}
                  disabled={createPool.isPending}
                />
                {formData.is_guaranteed && (
                  <FormControl sx={{ mt: 1 }}>
                    <Input 
                      type="number" 
                      startDecorator="$" 
                      placeholder="Guaranteed amount"
                      value={formData.guaranteed_amount}
                      onChange={(e) => setFormData({...formData, guaranteed_amount: Number(e.target.value)})}
                      disabled={createPool.isPending}
                      slotProps={{
                        input: {
                          min: 0,
                          step: 100,
                        }
                      }}
                    />
                  </FormControl>
                )}
              </Box>

              {/* Game Date */}
              <FormControl required>
                <FormLabel>Game Date</FormLabel>
                <Input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  startDecorator={<CalendarToday />}
                  disabled={createPool.isPending}
                />
              </FormControl>

              {/* Available Games */}
              {availableGames && availableGames.length > 0 ? (
                <Box>
                  <FormLabel required>
                    Select Games ({selectedGames.length} of {availableGames.length} selected)
                  </FormLabel>
                  <Sheet variant="outlined" sx={{ p: 2, maxHeight: 250, overflow: 'auto', borderRadius: 'sm', mt: 1 }}>
                    <Stack spacing={1}>
                      {availableGames.map((game: any) => (
                        <Box 
                          key={game.game_id} 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            p: 1, 
                            borderRadius: 'sm',
                            '&:hover': { bgcolor: 'background.level1' },
                          }}
                        >
                          <Checkbox
                            checked={selectedGames.includes(game.game_id)}
                            onChange={() => handleGameToggle(game.game_id)}
                            disabled={createPool.isPending}
                            sx={{ mr: 1 }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {game.away_team} @ {game.home_team}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }}>
                              {format(new Date(game.game_date), 'EEEE, MMM dd • h:mm a')}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Sheet>
                  <FormHelperText sx={{ mt: 1 }}>
                    Players from selected teams will be automatically added with their real NBA salaries
                  </FormHelperText>
                </Box>
              ) : (
                <Alert color="warning" size="sm">
                  No games available for selected date. Try a different date.
                </Alert>
              )}

              {/* Estimated Prize Pool */}
              {selectedGames.length > 0 && (
                <Alert color={formData.entry_fee === 0 ? 'warning' : 'primary'} size="sm">
                  <Typography level="body-xs">
                    {formData.entry_fee === 0 ? (
                      <>
                        <strong>Free Pool (Testing Mode):</strong> No prize pool. Perfect for testing!
                      </>
                    ) : (
                      <>
                        <strong>Estimated Prize Pool:</strong> ${(formData.entry_fee * formData.max_entries * 0.9).toLocaleString()} 
                        {' '}(90% of entry fees, 10% rake)
                      </>
                    )}
                  </Typography>
                </Alert>
              )}

              {/* Action Buttons */}
              <Stack direction="row" spacing={2}>
                <Button 
                  variant="outlined" 
                  onClick={() => setShowCreateModal(false)} 
                  fullWidth
                  disabled={createPool.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  fullWidth
                  onClick={handleCreatePool}
                  disabled={createPool.isPending || selectedGames.length === 0}
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
                  {createPool.isPending ? 'Creating Pool...' : 'Create Pool'}
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
        </ModalDialog>
      </Modal>

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

      {/* View Pool Modal */}
      <AdminPoolViewModal
        poolId={selectedPoolId}
        open={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedPoolId(null);
        }}
      />

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

