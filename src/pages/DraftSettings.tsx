import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  FormControl,
  FormLabel,
  Select,
  Option,
  Input,
  Switch,
  Divider,
  Snackbar,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip
} from '@mui/joy'
import {
  ArrowBack,
  Save,
  Refresh
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useDraftSettings, useUpdateDraftSettings, useCreateDraftSettings } from '../hooks/useDraftSettings'
import { useTeams } from '../hooks/useTeams'

interface DraftSettingsProps {
  leagueId: string
}

export default function DraftSettings({ leagueId }: DraftSettingsProps) {
  const navigate = useNavigate()
  const { data: settings, isLoading, error } = useDraftSettings(leagueId)
  const { data: teams } = useTeams(leagueId)
  const updateSettingsMutation = useUpdateDraftSettings()
  const createSettingsMutation = useCreateDraftSettings()
  
  const [formData, setFormData] = useState({
    draft_type: 'snake' as 'snake' | 'linear' | 'auction',
    draft_rounds: 15,
    waiver_wire: true,
    waiver_period_days: 2,
    max_trades_per_team: 10,
    max_adds_per_team: 50,
    playoff_teams: 6,
    playoff_weeks: 3,
    playoff_start_week: 20,
    keeper_league: false,
    max_keepers: 0,
    public_league: false,
    allow_duplicate_players: false,
    lineup_deadline: 'daily',
    lineup_lock_time: '00:00'
  })
  
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color: 'success' | 'error' }>({
    open: false,
    message: '',
    color: 'success'
  })

  useEffect(() => {
    if (settings) {
      setFormData({
        draft_type: settings.draft_type || 'snake',
        draft_rounds: settings.draft_rounds || 15,
        waiver_wire: settings.waiver_wire ?? true,
        waiver_period_days: settings.waiver_period_days || 2,
        max_trades_per_team: settings.max_trades_per_team || 10,
        max_adds_per_team: settings.max_adds_per_team || 50,
        playoff_teams: settings.playoff_teams || 6,
        playoff_weeks: settings.playoff_weeks || 3,
        playoff_start_week: settings.playoff_start_week || 20,
        keeper_league: settings.keeper_league ?? false,
        max_keepers: settings.max_keepers || 0,
        public_league: settings.public_league ?? false,
        allow_duplicate_players: settings.allow_duplicate_players ?? false,
        lineup_deadline: settings.lineup_deadline || 'daily',
        lineup_lock_time: settings.lineup_lock_time || '00:00'
      })
    }
  }, [settings])

  const handleSave = async () => {
    try {
      if (settings) {
        await updateSettingsMutation.mutateAsync({
          leagueId,
          updates: formData
        })
      } else {
        await createSettingsMutation.mutateAsync({
          leagueId,
          settings: formData
        })
      }
      setSnackbar({ open: true, message: 'Draft settings saved successfully!', color: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save draft settings', color: 'error' })
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading draft settings...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography>Error loading draft settings: {error.message}</Typography>
        </Alert>
      </Box>
    )
  }

  const teamCount = teams?.length || 0
  const totalPicks = formData.draft_rounds * teamCount

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button 
            variant="outlined" 
            startDecorator={<ArrowBack />} 
            onClick={() => navigate(-1)} 
            size="sm" 
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography level="h2" component="h1" sx={{ fontWeight: 'bold' }}>
            Draft Settings
          </Typography>
        </Box>
        <Button
          variant="solid"
          color="primary"
          startDecorator={<Save />}
          onClick={handleSave}
          loading={updateSettingsMutation.isPending || createSettingsMutation.isPending}
        >
          Save Settings
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Draft Configuration */}
        <Grid xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-lg" sx={{ mb: 2 }}>
                Draft Configuration
              </Typography>
              <Stack spacing={2}>
                <FormControl>
                  <FormLabel>Draft Type</FormLabel>
                  <Select
                    value={formData.draft_type}
                    onChange={(_, value) => handleInputChange('draft_type', value)}
                  >
                    <Option value="snake">Snake Draft</Option>
                    <Option value="linear">Linear Draft</Option>
                    <Option value="auction">Auction Draft</Option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Draft Rounds</FormLabel>
                  <Input
                    type="number"
                    value={formData.draft_rounds}
                    onChange={(e) => handleInputChange('draft_rounds', parseInt(e.target.value) || 15)}
                    min={1}
                    max={20}
                  />
                </FormControl>

                <Box sx={{ p: 2, backgroundColor: 'neutral.50', borderRadius: 'sm' }}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Draft Summary
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Chip size="sm" color="primary" variant="soft">
                      {teamCount} Teams
                    </Chip>
                    <Chip size="sm" color="primary" variant="soft">
                      {formData.draft_rounds} Rounds
                    </Chip>
                    <Chip size="sm" color="primary" variant="soft">
                      {totalPicks} Total Picks
                    </Chip>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* League Rules */}
        <Grid xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-lg" sx={{ mb: 2 }}>
                League Rules
              </Typography>
              <Stack spacing={2}>
                <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <FormLabel>Waiver Wire</FormLabel>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      Allow waiver wire pickups
                    </Typography>
                  </Box>
                  <Switch
                    checked={formData.waiver_wire}
                    onChange={(e) => handleInputChange('waiver_wire', e.target.checked)}
                  />
                </FormControl>

                {formData.waiver_wire && (
                  <FormControl>
                    <FormLabel>Waiver Period (Days)</FormLabel>
                    <Input
                      type="number"
                      value={formData.waiver_period_days}
                      onChange={(e) => handleInputChange('waiver_period_days', parseInt(e.target.value) || 2)}
                      min={0}
                      max={7}
                    />
                  </FormControl>
                )}

                <FormControl>
                  <FormLabel>Max Trades per Team</FormLabel>
                  <Input
                    type="number"
                    value={formData.max_trades_per_team}
                    onChange={(e) => handleInputChange('max_trades_per_team', parseInt(e.target.value) || 10)}
                    min={0}
                    max={50}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Max Adds per Team</FormLabel>
                  <Input
                    type="number"
                    value={formData.max_adds_per_team}
                    onChange={(e) => handleInputChange('max_adds_per_team', parseInt(e.target.value) || 50)}
                    min={0}
                    max={100}
                  />
                </FormControl>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Playoff Settings */}
        <Grid xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-lg" sx={{ mb: 2 }}>
                Playoff Settings
              </Typography>
              <Stack spacing={2}>
                <FormControl>
                  <FormLabel>Playoff Teams</FormLabel>
                  <Input
                    type="number"
                    value={formData.playoff_teams}
                    onChange={(e) => handleInputChange('playoff_teams', parseInt(e.target.value) || 6)}
                    min={2}
                    max={teamCount}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Playoff Weeks</FormLabel>
                  <Input
                    type="number"
                    value={formData.playoff_weeks}
                    onChange={(e) => handleInputChange('playoff_weeks', parseInt(e.target.value) || 3)}
                    min={1}
                    max={6}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Playoff Start Week</FormLabel>
                  <Input
                    type="number"
                    value={formData.playoff_start_week}
                    onChange={(e) => handleInputChange('playoff_start_week', parseInt(e.target.value) || 20)}
                    min={1}
                    max={30}
                  />
                </FormControl>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Advanced Settings */}
        <Grid xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-lg" sx={{ mb: 2 }}>
                Advanced Settings
              </Typography>
              <Stack spacing={2}>
                <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <FormLabel>Keeper League</FormLabel>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      Allow teams to keep players
                    </Typography>
                  </Box>
                  <Switch
                    checked={formData.keeper_league}
                    onChange={(e) => handleInputChange('keeper_league', e.target.checked)}
                  />
                </FormControl>

                {formData.keeper_league && (
                  <FormControl>
                    <FormLabel>Max Keepers per Team</FormLabel>
                    <Input
                      type="number"
                      value={formData.max_keepers}
                      onChange={(e) => handleInputChange('max_keepers', parseInt(e.target.value) || 0)}
                      min={0}
                      max={15}
                    />
                  </FormControl>
                )}

                <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <FormLabel>Public League</FormLabel>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      League visible to all users
                    </Typography>
                  </Box>
                  <Switch
                    checked={formData.public_league}
                    onChange={(e) => handleInputChange('public_league', e.target.checked)}
                  />
                </FormControl>

                <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
                  <Box>
                    <FormLabel>Allow Duplicate Players</FormLabel>
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      Multiple teams can own same player
                    </Typography>
                  </Box>
                  <Switch
                    checked={formData.allow_duplicate_players}
                    onChange={(e) => handleInputChange('allow_duplicate_players', e.target.checked)}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Lineup Deadline</FormLabel>
                  <Select
                    value={formData.lineup_deadline}
                    onChange={(_, value) => handleInputChange('lineup_deadline', value)}
                  >
                    <Option value="daily">Daily</Option>
                    <Option value="weekly">Weekly</Option>
                    <Option value="monthly">Monthly</Option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Lineup Lock Time</FormLabel>
                  <Input
                    type="time"
                    value={formData.lineup_lock_time}
                    onChange={(e) => handleInputChange('lineup_lock_time', e.target.value)}
                  />
                </FormControl>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        color={snackbar.color}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        autoHideDuration={3000}
      >
        {snackbar.message}
      </Snackbar>
    </Box>
  )
}
