import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Input,
  FormControl,
  FormLabel,
  Stack,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  Sheet,
  Switch,
  Select,
  Option,
  Divider,
  Grid,
  Alert,
  Chip,
  IconButton,
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/joy'
import { Edit, Save, Cancel, Settings as SettingsIcon } from '@mui/icons-material'
import { LeagueSettings, UpdateLeagueSettingsFormData, DEFAULT_LEAGUE_SETTINGS } from '../types/leagueSettings'

interface LeagueSettingsProps {
  league: LeagueSettings
  isCommissioner: boolean
  onUpdateSettings: (settings: UpdateLeagueSettingsFormData) => Promise<void>
  isLoading?: boolean
}

export default function LeagueSettingsManager({ league, isCommissioner, onUpdateSettings, isLoading = false }: LeagueSettingsProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [formData, setFormData] = useState<UpdateLeagueSettingsFormData>({})
  const [hasChanges, setHasChanges] = useState(false)

  const handleInputChange = (field: keyof UpdateLeagueSettingsFormData, value: any) => {
    // Convert datetime-local to UTC before saving
    let processedValue = value;
    if (field === 'draft_date' && value) {
      // datetime-local input gives us "2025-10-17T12:00" in local time
      // We need to convert it to ISO 8601 UTC format for the database
      const localDate = new Date(value);
      processedValue = localDate.toISOString();
      console.log('🕐 Converting draft_date:', {
        input: value,
        localDate: localDate.toString(),
        utcISO: processedValue
      });
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: processedValue
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      await onUpdateSettings(formData)
      setFormData({})
      setHasChanges(false)
      setEditingSection(null)
    } catch (error) {
      console.error('Error updating settings:', error)
    }
  }

  const handleCancel = () => {
    setFormData({})
    setHasChanges(false)
    setEditingSection(null)
  }

  const getCurrentValue = (field: keyof LeagueSettings) => {
    const value = formData[field as keyof UpdateLeagueSettingsFormData] ?? league[field];
    
    // Convert draft_date from UTC ISO to datetime-local format
    if (field === 'draft_date' && value) {
      // Database stores: "2025-10-17T12:00:00+00:00" (UTC)
      // datetime-local needs: "2025-10-17T05:00" (local time, no timezone)
      const date = new Date(value);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    return value;
  }

  const renderBasicSettings = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4">Basic Settings</Typography>
          {isCommissioner && (
            <Button
              variant="soft"
              size="sm"
              startDecorator={<Edit />}
              onClick={() => setEditingSection('basic')}
            >
              Edit
            </Button>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>League Name</FormLabel>
              <Input
                value={getCurrentValue('name')}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={editingSection !== 'basic'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Input
                value={getCurrentValue('description') || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                disabled={editingSection !== 'basic'}
                placeholder="League description..."
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Max Teams</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('max_teams')}
                onChange={(e) => handleInputChange('max_teams', parseInt(e.target.value))}
                disabled={editingSection !== 'basic'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Scoring Type</FormLabel>
              <Select
                value={getCurrentValue('scoring_type')}
                onChange={(_, value) => handleInputChange('scoring_type', value)}
                disabled={editingSection !== 'basic'}
              >
                <Option value="H2H_Points">Head-to-Head Points</Option>
                <Option value="Rotisserie">Rotisserie</Option>
                <Option value="H2H_Category">H2H Each Category</Option>
                <Option value="H2H_Most_Categories">H2H Most Categories</Option>
                <Option value="Season_Points">Season Points</Option>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {editingSection === 'basic' && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="solid"
              startDecorator={<Save />}
              onClick={handleSave}
              loading={isLoading}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              startDecorator={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )

  const renderHoopGeekSettings = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4">🏀 HoopGeek Features</Typography>
          {isCommissioner && (
            <Button
              variant="soft"
              size="sm"
              startDecorator={<Edit />}
              onClick={() => setEditingSection('hoopgeek')}
            >
              Edit
            </Button>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Lineup Frequency</FormLabel>
              <Select
                value={getCurrentValue('lineup_frequency')}
                onChange={(_, value) => handleInputChange('lineup_frequency', value)}
                disabled={editingSection !== 'hoopgeek'}
              >
                <Option value="daily">Daily</Option>
                <Option value="weekly">Weekly</Option>
                <Option value="bi-weekly">Bi-Weekly</Option>
              </Select>
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Auto IR Management</FormLabel>
              <Switch
                checked={getCurrentValue('auto_ir_management')}
                onChange={(e) => handleInputChange('auto_ir_management', e.target.checked)}
                disabled={editingSection !== 'hoopgeek'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Auto Substitution</FormLabel>
              <Switch
                checked={getCurrentValue('auto_substitution')}
                onChange={(e) => handleInputChange('auto_substitution', e.target.checked)}
                disabled={editingSection !== 'hoopgeek'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Global Leaderboard</FormLabel>
              <Switch
                checked={getCurrentValue('global_leaderboard')}
                onChange={(e) => handleInputChange('global_leaderboard', e.target.checked)}
                disabled={editingSection !== 'hoopgeek'}
              />
            </FormControl>
          </Grid>
        </Grid>

        {editingSection === 'hoopgeek' && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="solid"
              startDecorator={<Save />}
              onClick={handleSave}
              loading={isLoading}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              startDecorator={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )

  const renderSalaryCapSettings = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4">💰 Salary Cap Settings</Typography>
          {isCommissioner && (
            <Button
              variant="soft"
              size="sm"
              startDecorator={<Edit />}
              onClick={() => setEditingSection('salary')}
            >
              Edit
            </Button>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Salary Cap Enabled</FormLabel>
              <Switch
                checked={getCurrentValue('salary_cap_enabled')}
                onChange={(e) => handleInputChange('salary_cap_enabled', e.target.checked)}
                disabled={editingSection !== 'salary'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Salary Cap Amount</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('salary_cap_amount')}
                onChange={(e) => handleInputChange('salary_cap_amount', parseInt(e.target.value))}
                disabled={editingSection !== 'salary'}
                startDecorator="$"
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Soft Cap</FormLabel>
              <Switch
                checked={getCurrentValue('salary_cap_soft')}
                onChange={(e) => handleInputChange('salary_cap_soft', e.target.checked)}
                disabled={editingSection !== 'salary'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Cap Penalty (%)</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('salary_cap_penalty')}
                onChange={(e) => handleInputChange('salary_cap_penalty', parseFloat(e.target.value))}
                disabled={editingSection !== 'salary'}
                endDecorator="%"
              />
            </FormControl>
          </Grid>
        </Grid>

        {editingSection === 'salary' && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="solid"
              startDecorator={<Save />}
              onClick={handleSave}
              loading={isLoading}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              startDecorator={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )

  const renderTradeSettings = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4">🔄 Trade Settings</Typography>
          {isCommissioner && (
            <Button
              variant="soft"
              size="sm"
              startDecorator={<Edit />}
              onClick={() => setEditingSection('trades')}
            >
              Edit
            </Button>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Trade Limit</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('trade_limit') || ''}
                onChange={(e) => handleInputChange('trade_limit', e.target.value ? parseInt(e.target.value) : null)}
                disabled={editingSection !== 'trades'}
                placeholder="No limit"
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Trade Deadline</FormLabel>
              <Input
                type="date"
                value={getCurrentValue('trade_deadline') || ''}
                onChange={(e) => handleInputChange('trade_deadline', e.target.value)}
                disabled={editingSection !== 'trades'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Salary Matching Required</FormLabel>
              <Switch
                checked={getCurrentValue('trade_salary_matching')}
                onChange={(e) => handleInputChange('trade_salary_matching', e.target.checked)}
                disabled={editingSection !== 'trades'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Salary Tolerance (%)</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('trade_salary_tolerance')}
                onChange={(e) => handleInputChange('trade_salary_tolerance', parseFloat(e.target.value))}
                disabled={editingSection !== 'trades'}
                endDecorator="%"
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Votes Required to Veto</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('trade_veto_votes_required')}
                onChange={(e) => handleInputChange('trade_veto_votes_required', parseInt(e.target.value))}
                disabled={editingSection !== 'trades'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Allow Draft Pick Trades</FormLabel>
              <Switch
                checked={getCurrentValue('allow_draft_pick_trades')}
                onChange={(e) => handleInputChange('allow_draft_pick_trades', e.target.checked)}
                disabled={editingSection !== 'trades'}
              />
            </FormControl>
          </Grid>
        </Grid>

        {editingSection === 'trades' && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="solid"
              startDecorator={<Save />}
              onClick={handleSave}
              loading={isLoading}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              startDecorator={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )

  const renderRosterSettings = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4">👥 Roster Settings</Typography>
          {isCommissioner && (
            <Button
              variant="soft"
              size="sm"
              startDecorator={<Edit />}
              onClick={() => setEditingSection('roster')}
            >
              Edit
            </Button>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid xs={12} md={4}>
            <FormControl>
              <FormLabel>Roster Size</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('roster_size')}
                onChange={(e) => handleInputChange('roster_size', parseInt(e.target.value))}
                disabled={editingSection !== 'roster'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={4}>
            <FormControl>
              <FormLabel>Total Starters</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('total_starters')}
                onChange={(e) => handleInputChange('total_starters', parseInt(e.target.value))}
                disabled={editingSection !== 'roster'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={4}>
            <FormControl>
              <FormLabel>Total Bench</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('total_bench')}
                onChange={(e) => handleInputChange('total_bench', parseInt(e.target.value))}
                disabled={editingSection !== 'roster'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={4}>
            <FormControl>
              <FormLabel>Injured Reserve</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('total_ir')}
                onChange={(e) => handleInputChange('total_ir', parseInt(e.target.value))}
                disabled={editingSection !== 'roster'}
              />
            </FormControl>
          </Grid>
        </Grid>

        {editingSection === 'roster' && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="solid"
              startDecorator={<Save />}
              onClick={handleSave}
              loading={isLoading}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              startDecorator={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )

  const renderDraftSettings = () => (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h4">📋 Draft Settings</Typography>
          {isCommissioner && (
            <Button
              variant="soft"
              size="sm"
              startDecorator={<Edit />}
              onClick={() => setEditingSection('draft')}
            >
              Edit
            </Button>
          )}
        </Box>

        <Grid container spacing={2}>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Draft Type</FormLabel>
              <Select
                value={getCurrentValue('draft_type')}
                onChange={(_, value) => handleInputChange('draft_type', value)}
                disabled={editingSection !== 'draft'}
              >
                <Option value="snake">Snake Draft</Option>
                <Option value="linear">Linear Draft</Option>
                <Option value="auction">Auction Draft</Option>
              </Select>
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Draft Date</FormLabel>
              <Input
                type="datetime-local"
                value={getCurrentValue('draft_date') || ''}
                onChange={(e) => handleInputChange('draft_date', e.target.value)}
                disabled={editingSection !== 'draft'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Time Per Pick (seconds)</FormLabel>
              <Input
                type="number"
                value={getCurrentValue('draft_time_per_pick')}
                onChange={(e) => handleInputChange('draft_time_per_pick', parseInt(e.target.value))}
                disabled={editingSection !== 'draft'}
              />
            </FormControl>
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Draft Order Method</FormLabel>
              <Select
                value={getCurrentValue('draft_order_method')}
                onChange={(_, value) => handleInputChange('draft_order_method', value)}
                disabled={editingSection !== 'draft'}
              >
                <Option value="random">Random</Option>
                <Option value="manual">Manual</Option>
                <Option value="predetermined">Predetermined</Option>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {editingSection === 'draft' && (
          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="solid"
              startDecorator={<Save />}
              onClick={handleSave}
              loading={isLoading}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              startDecorator={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4 }}>
      <Typography level="h2" sx={{ mb: 4, textAlign: 'center' }}>
        <SettingsIcon sx={{ mr: 2 }} />
        League Settings
      </Typography>

      {!isCommissioner && (
        <Alert color="warning" sx={{ mb: 3 }}>
          You are viewing league settings. Only the commissioner can make changes.
        </Alert>
      )}

      {renderBasicSettings()}
      {renderHoopGeekSettings()}
      {renderSalaryCapSettings()}
      {renderTradeSettings()}
      {renderRosterSettings()}
      {renderDraftSettings()}
    </Box>
  )
}
