import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Input,
  Textarea,
  Modal,
  ModalDialog,
  ModalClose,
  Stack,
  Alert,
  Select,
  Option,
  Switch,
  FormControl,
  FormLabel,
  FormHelperText,
  Divider,
  Grid,
  Chip,
  IconButton,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useCreateLeagueMinimal as useCreateLeague } from '../hooks/useLeagueInitializationMinimal';
import { validateLeagueSettings, getDefaultLeagueSettings } from '../hooks/useLeagueInitialization';
import { LeagueSettings, LeagueCreationData } from '../types/leagueSettings';
import { Add, Remove, ContentCopy, Check, Link as LinkIcon, People } from '@mui/icons-material';

interface LeagueCreationFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (leagueId: string) => void;
}

export default function LeagueCreationForm({ open, onClose, onSuccess }: LeagueCreationFormProps) {
  const { user, loading: userLoading } = useAuth();
  const createLeague = useCreateLeague();
  
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<LeagueSettings>(() => {
    const defaults = getDefaultLeagueSettings(user?.id || '');
    // Set default salary cap to $200M
    return {
      ...defaults,
      salary_cap_amount: 200000000 // $200M default
    };
  });

  // Update settings when user becomes available
  useEffect(() => {
    if (user?.id && !settings.commissioner_id) {
      const defaults = getDefaultLeagueSettings(user.id);
      setSettings(prev => ({
        ...defaults,
        ...prev,
        commissioner_id: user.id,
        salary_cap_amount: prev.salary_cap_amount || 200000000
      }));
    }
  }, [user?.id, settings.commissioner_id]);
  const [createdLeague, setCreatedLeague] = useState<{id: string, inviteCode: string, name: string} | null>(null);
  const [copied, setCopied] = useState(false);

  // Update settings when user changes
  React.useEffect(() => {
    if (user?.id) {
      setSettings(prev => ({ ...prev, commissioner_id: user.id }));
    }
  }, [user?.id]);
  const [commissionerTeamName, setCommissionerTeamName] = useState('');
  const [autoFillTeams, setAutoFillTeams] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSettingsChange = (field: keyof LeagueSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleRosterPositionChange = (position: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      roster_positions: {
        ...prev.roster_positions,
        [position]: Math.max(0, value)
      }
    }));
  };


  const validateCurrentStep = (): boolean => {
    const newErrors = validateLeagueSettings(settings);
    
    if (!user?.id) {
      newErrors.push('You must be logged in to create a league');
    }
    
    if (step === 1) {
      if (!commissionerTeamName.trim()) {
        newErrors.push('Commissioner team name is required');
      }
    }
    
    if (step === 3) {
      const rosterSize = Object.values(settings.roster_positions).reduce((sum, count) => sum + count, 0);
      const lineupSize = settings.starters_count + settings.rotation_count + settings.bench_count;
      
      if (lineupSize > rosterSize) {
        newErrors.push(`Lineup size (${lineupSize}) cannot exceed roster size (${rosterSize})`);
      }
      
      if (settings.starters_count !== 5) {
        newErrors.push('Starters count must be 5');
      }
      
      if (settings.rotation_count < 3 || settings.rotation_count > 7) {
        newErrors.push('Rotation count must be between 3 and 7');
      }
      
      if (settings.bench_count < 3 || settings.bench_count > 5) {
        newErrors.push('Bench count must be between 3 and 5');
      }
    }
    
    if (step === 4) {
      const positionUnitAssignments = settings.position_unit_assignments || {
        starters: {},
        rotation: {},
        bench: {}
      };
      
      const startersCount = Object.values(positionUnitAssignments.starters || {}).reduce((sum: number, count: any) => sum + count, 0);
      const rotationCount = Object.values(positionUnitAssignments.rotation || {}).reduce((sum: number, count: any) => sum + count, 0);
      const benchCount = Object.values(positionUnitAssignments.bench || {}).reduce((sum: number, count: any) => sum + count, 0);
      
      if (startersCount !== settings.starters_count) {
        newErrors.push(`Starters must have exactly ${settings.starters_count} players assigned`);
      }
      
      if (rotationCount !== settings.rotation_count) {
        newErrors.push(`Rotation must have exactly ${settings.rotation_count} players assigned`);
      }
      
      if (benchCount !== settings.bench_count) {
        newErrors.push(`Bench must have exactly ${settings.bench_count} players assigned`);
      }
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    
    if (!user?.id) {
      setErrors(['You must be logged in to create a league']);
      return;
    }

    try {
      // COMPREHENSIVE LOGGING FOR DEBUGGING
      console.log('🔧 ===== LEAGUE CREATION FORM DEBUG =====');
      console.log('🔧 User ID:', user.id);
      console.log('🔧 Commissioner Team Name:', commissionerTeamName);
      console.log('🔧 Auto Fill Teams:', autoFillTeams);
      console.log('🔧 Current Step:', step);
      console.log('🔧 Settings Object:', JSON.stringify(settings, null, 2));
      console.log('🔧 Roster Positions:', settings.roster_positions);
      console.log('🔧 Position Unit Assignments:', settings.position_unit_assignments);
      console.log('🔧 Starters Count:', settings.starters_count);
      console.log('🔧 Rotation Count:', settings.rotation_count);
      console.log('🔧 Bench Count:', settings.bench_count);
      console.log('🔧 Starters Multiplier:', settings.starters_multiplier);
      console.log('🔧 Rotation Multiplier:', settings.rotation_multiplier);
      console.log('🔧 Bench Multiplier:', settings.bench_multiplier);
      console.log('🔧 Salary Cap Amount:', settings.salary_cap_amount);
      console.log('🔧 Max Teams:', settings.max_teams);
      console.log('🔧 Draft Type:', settings.draft_type);
      console.log('🔧 Draft Rounds:', settings.draft_rounds);
      console.log('🔧 Draft Date:', settings.draft_date);
      console.log('🔧 Trade Deadline:', settings.trade_deadline);
      console.log('🔧 Playoff Teams:', settings.playoff_teams);
      console.log('🔧 Playoff Weeks:', settings.playoff_weeks);
      console.log('🔧 Scoring Type:', settings.scoring_type);
      console.log('🔧 Fantasy Scoring Format:', settings.fantasy_scoring_format);
      console.log('🔧 Public League:', settings.public_league);
      console.log('🔧 Keeper League:', settings.keeper_league);
      console.log('🔧 ======================================');
      
      console.log('🔧 LeagueCreationForm: Current settings before submission:', settings);
      console.log('🔧 LeagueCreationForm: scoring_type:', settings.scoring_type);
      console.log('🔧 LeagueCreationForm: fantasy_scoring_format:', settings.fantasy_scoring_format);
      
      const creationData: LeagueCreationData = {
        settings: { ...settings, commissioner_id: user.id }, // Ensure user ID is set
        commissioner_team_name: commissionerTeamName,
        auto_fill_teams: autoFillTeams,
        invite_emails: [], // No longer using email invites
      };
      
      console.log('🔧 LeagueCreationForm: Final creation data:', creationData);
      
      // LOG WHAT WILL BE SENT TO EDGE FUNCTION
      console.log('🔧 ===== DATA BEING SENT TO EDGE FUNCTION =====');
      console.log('🔧 name:', settings.name);
      console.log('🔧 description:', settings.description);
      console.log('🔧 maxTeams:', settings.max_teams);
      console.log('🔧 scoringType:', settings.scoring_type);
      console.log('🔧 teamName:', commissionerTeamName);
      console.log('🔧 rosterConfig:', settings.roster_positions);
      console.log('🔧 draftDate:', settings.draft_date);
      console.log('🔧 tradeDeadline:', settings.trade_deadline);
      console.log('🔧 salaryCapAmount:', settings.salary_cap_amount);
      console.log('🔧 startersCount:', settings.starters_count);
      console.log('🔧 startersMultiplier:', settings.starters_multiplier);
      console.log('🔧 rotationCount:', settings.rotation_count);
      console.log('🔧 rotationMultiplier:', settings.rotation_multiplier);
      console.log('🔧 benchCount:', settings.bench_count);
      console.log('🔧 benchMultiplier:', settings.bench_multiplier);
      console.log('🔧 positionUnitAssignments:', settings.position_unit_assignments);
      console.log('🔧 fantasyScoringFormat:', settings.fantasy_scoring_format);
      console.log('🔧 ===========================================');

      const result = await createLeague.mutateAsync(creationData);
      
      console.log('🏀 League creation result:', result);
      console.log('🏀 League object:', result.league);
      console.log('🏀 Invite code:', result.league.invite_code);
      
      // Set the created league data to show invite link
      setCreatedLeague({
        id: result.league.id,
        inviteCode: result.league.invite_code,
        name: result.league.name
      });
      
      // Don't call onSuccess yet - let user see the invite link first
      // if (onSuccess) {
      //   onSuccess(result.league.id);
      // }
      
      // Don't close the modal yet - show the invite link
      // onClose();
    } catch (error) {
      console.error('Failed to create league:', error);
    }
  };

  const renderStep1 = () => (
    <Stack spacing={3}>
      <Typography level="h4" sx={{ mb: 2 }}>
        Basic League Information
      </Typography>
      
      <FormControl>
        <FormLabel>League Name *</FormLabel>
        <Input
          value={settings.name}
          onChange={(e) => handleSettingsChange('name', e.target.value)}
          placeholder="Enter league name"
        />
      </FormControl>

      <FormControl>
        <FormLabel>Description</FormLabel>
        <Textarea
          value={settings.description || ''}
          onChange={(e) => handleSettingsChange('description', e.target.value)}
          placeholder="Enter league description (optional)"
          minRows={3}
        />
      </FormControl>

      <FormControl>
        <FormLabel>Commissioner Team Name *</FormLabel>
        <Input
          value={commissionerTeamName}
          onChange={(e) => setCommissionerTeamName(e.target.value)}
          placeholder="Enter your team name"
        />
      </FormControl>

      <Grid container spacing={2}>
        <Grid xs={6}>
          <FormControl>
            <FormLabel>Number of Teams *</FormLabel>
            <Select
              value={settings.max_teams}
              onChange={(_, value) => handleSettingsChange('max_teams', value)}
            >
              {Array.from({ length: 19 }, (_, i) => i + 2).map(num => (
                <Option key={num} value={num}>{num} Teams</Option>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid xs={6}>
          <FormControl>
            <FormLabel>Draft Rounds *</FormLabel>
            <Select
              value={settings.draft_rounds}
              onChange={(_, value) => handleSettingsChange('draft_rounds', value)}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                <Option key={num} value={num}>{num} Rounds</Option>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <FormControl>
        <FormLabel>Draft Type</FormLabel>
        <Select
          value={settings.draft_type}
          onChange={(_, value) => handleSettingsChange('draft_type', value)}
        >
          <Option value="snake">Snake Draft</Option>
          <Option value="linear">Linear Draft</Option>
          <Option value="auction">Auction Draft</Option>
        </Select>
        <FormHelperText>
          Snake: Order reverses each round. Linear: Same order every round. Auction: Bid on players.
        </FormHelperText>
      </FormControl>

      <Grid container spacing={2}>
        <Grid xs={6}>
          <FormControl>
            <FormLabel>Draft Date & Time</FormLabel>
            <Input
              type="datetime-local"
              value={settings.draft_date || ''}
              onChange={(e) => handleSettingsChange('draft_date', e.target.value)}
            />
          </FormControl>
        </Grid>
        <Grid xs={6}>
          <FormControl>
            <FormLabel>Trade Deadline</FormLabel>
            <Input
              type="date"
              value={settings.trade_deadline || ''}
              onChange={(e) => handleSettingsChange('trade_deadline', e.target.value)}
            />
            <FormHelperText>
              Last day teams can make trades (optional)
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
    </Stack>
  );

  const renderStep2 = () => (
    <Stack spacing={3}>
      <Typography level="h4" sx={{ mb: 2 }}>
        Roster Configuration
      </Typography>
      
      <Typography level="body-md" sx={{ color: 'text.secondary' }}>
        Configure how many players at each position each team can have.
      </Typography>

      <Grid container spacing={2}>
        {Object.entries(settings.roster_positions).map(([position, count]) => (
          <Grid xs={6} md={4} key={position}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography level="body-md" sx={{ fontWeight: 'bold' }}>
                    {position}
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={() => handleRosterPositionChange(position, count - 1)}
                      disabled={count <= 0}
                    >
                      <Remove />
                    </IconButton>
                    <Typography level="body-lg" sx={{ minWidth: '20px', textAlign: 'center' }}>
                      {count}
                    </Typography>
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={() => handleRosterPositionChange(position, count + 1)}
                    >
                      <Add />
                    </IconButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Alert color="primary">
        <Typography level="body-sm">
          Total roster spots: {Object.values(settings.roster_positions).reduce((sum, count) => sum + count, 0)}
        </Typography>
      </Alert>
    </Stack>
  );

  const renderStep3 = () => {
    const rosterSize = Object.values(settings.roster_positions).reduce((sum, count) => sum + count, 0);
    const lineupSize = settings.starters_count + settings.rotation_count + settings.bench_count;
    const isLineupValid = lineupSize <= rosterSize;

    return (
      <Stack spacing={3}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Weekly Lineup Configuration
        </Typography>
        
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          Set up how many players are active each week and their fantasy point multipliers.
          Each week, you'll select players from your roster to fill these spots.
        </Typography>

        <Alert color={isLineupValid ? 'success' : 'danger'}>
          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
            Roster Size: {rosterSize} players
          </Typography>
          <Typography level="body-sm">
            Lineup Size: {lineupSize} players ({settings.starters_count} + {settings.rotation_count} + {settings.bench_count})
          </Typography>
          {!isLineupValid && (
            <Typography level="body-sm" color="danger" sx={{ mt: 1 }}>
              ❌ Lineup cannot exceed roster size!
            </Typography>
          )}
        </Alert>

        {/* STARTERS */}
        <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
          <CardContent>
            <Typography level="title-lg" sx={{ mb: 2, color: 'primary.700' }}>
              ⭐ Starters (Locked at 5)
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={6}>
                <FormControl>
                  <FormLabel>Number of Starters</FormLabel>
                  <Input
                    value={5}
                    disabled
                    endDecorator="players"
                  />
                  <FormHelperText>Always 5 starters (NBA lineup)</FormHelperText>
                </FormControl>
              </Grid>
              <Grid xs={6}>
                <FormControl>
                  <FormLabel>Points Multiplier</FormLabel>
                  <Input
                    type="number"
                    value={settings.starters_multiplier}
                    onChange={(e) => handleSettingsChange('starters_multiplier', parseFloat(e.target.value))}
                    slotProps={{
                      input: {
                        min: 0,
                        max: 2,
                        step: 0.05
                      }
                    }}
                    endDecorator="x"
                  />
                  <FormHelperText>Default: 1.0x (100%)</FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* ROTATION */}
        <Card variant="outlined" sx={{ bgcolor: 'warning.50' }}>
          <CardContent>
            <Typography level="title-lg" sx={{ mb: 2, color: 'warning.700' }}>
              🔄 Rotation Players
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={6}>
                <FormControl>
                  <FormLabel>Number of Rotation Players</FormLabel>
                  <Select
                    value={settings.rotation_count}
                    onChange={(_, value) => handleSettingsChange('rotation_count', value)}
                  >
                    {[3, 4, 5, 6, 7].map(num => (
                      <Option key={num} value={num}>{num} players</Option>
                    ))}
                  </Select>
                  <FormHelperText>Range: 3-7 players</FormHelperText>
                </FormControl>
              </Grid>
              <Grid xs={6}>
                <FormControl>
                  <FormLabel>Points Multiplier</FormLabel>
                  <Input
                    type="number"
                    value={settings.rotation_multiplier}
                    onChange={(e) => handleSettingsChange('rotation_multiplier', parseFloat(e.target.value))}
                    slotProps={{
                      input: {
                        min: 0,
                        max: 2,
                        step: 0.05
                      }
                    }}
                    endDecorator="x"
                  />
                  <FormHelperText>Default: 0.75x (75%)</FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* BENCH */}
        <Card variant="outlined" sx={{ bgcolor: 'neutral.50' }}>
          <CardContent>
            <Typography level="title-lg" sx={{ mb: 2, color: 'neutral.700' }}>
              📋 Bench Players
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={6}>
                <FormControl>
                  <FormLabel>Number of Bench Players</FormLabel>
                  <Select
                    value={settings.bench_count}
                    onChange={(_, value) => handleSettingsChange('bench_count', value)}
                  >
                    {[3, 4, 5].map(num => (
                      <Option key={num} value={num}>{num} players</Option>
                    ))}
                  </Select>
                  <FormHelperText>Range: 3-5 players</FormHelperText>
                </FormControl>
              </Grid>
              <Grid xs={6}>
                <FormControl>
                  <FormLabel>Points Multiplier</FormLabel>
                  <Input
                    type="number"
                    value={settings.bench_multiplier}
                    onChange={(e) => handleSettingsChange('bench_multiplier', parseFloat(e.target.value))}
                    slotProps={{
                      input: {
                        min: 0,
                        max: 2,
                        step: 0.05
                      }
                    }}
                    endDecorator="x"
                  />
                  <FormHelperText>Default: 0.5x (50%)</FormHelperText>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Alert color="primary" variant="soft">
          <Typography level="body-sm">
            💡 <strong>How it works:</strong> Each week, you'll set your lineup by assigning players from your roster to these tiers. 
            Starters get full points, rotation players get reduced points, and bench players get even fewer points.
          </Typography>
        </Alert>
      </Stack>
    );
  };

  const renderStep4 = () => {
    const rosterPositions = settings.roster_positions;
    const positionUnitAssignments = settings.position_unit_assignments || {
      starters: {},
      rotation: {},
      bench: {}
    };

    const getAvailablePositions = () => {
      const allPositions = ['G', 'F', 'C', 'UTIL'];
      return allPositions.filter(pos => rosterPositions[pos] > 0);
    };

    const getAssignedCount = (unit: string) => {
      return Object.values(positionUnitAssignments[unit] || {}).reduce((sum: number, count: any) => sum + count, 0);
    };

    const getMaxForUnit = (unit: string) => {
      switch (unit) {
        case 'starters': return settings.starters_count;
        case 'rotation': return settings.rotation_count;
        case 'bench': return settings.bench_count;
        default: return 0;
      }
    };

    const getRemainingPositions = () => {
      const assigned = {};
      getAvailablePositions().forEach(pos => {
        assigned[pos] = rosterPositions[pos];
      });
      
      ['starters', 'rotation', 'bench'].forEach(unit => {
        Object.keys(positionUnitAssignments[unit] || {}).forEach(pos => {
          assigned[pos] -= (positionUnitAssignments[unit][pos] || 0);
        });
      });
      
      return Object.entries(assigned)
        .filter(([pos, count]) => count > 0)
        .map(([pos, count]) => ({ position: pos, count }));
    };

    const getUnitPositions = (unit: string) => {
      return Object.entries(positionUnitAssignments[unit] || {})
        .filter(([pos, count]) => count > 0)
        .map(([pos, count]) => ({ position: pos, count }));
    };

    const addPositionToUnit = (unit: string, position: string) => {
      if (getAssignedCount(unit) >= getMaxForUnit(unit)) {
        return; // Unit is full
      }
      
      const currentCount = positionUnitAssignments[unit]?.[position] || 0;
      const availableCount = rosterPositions[position] - 
        (positionUnitAssignments.starters?.[position] || 0) -
        (positionUnitAssignments.rotation?.[position] || 0) -
        (positionUnitAssignments.bench?.[position] || 0) +
        currentCount;
      
      if (availableCount <= 0) {
        return; // No more available
      }
      
      const newAssignments = {
        ...positionUnitAssignments,
        [unit]: {
          ...positionUnitAssignments[unit],
          [position]: currentCount + 1
        }
      };
      setSettings(prev => ({ ...prev, position_unit_assignments: newAssignments }));
    };

    const removePositionFromUnit = (unit: string, position: string) => {
      const currentCount = positionUnitAssignments[unit]?.[position] || 0;
      if (currentCount <= 0) return;
      
      const newAssignments = {
        ...positionUnitAssignments,
        [unit]: {
          ...positionUnitAssignments[unit],
          [position]: currentCount - 1
        }
      };
      setSettings(prev => ({ ...prev, position_unit_assignments: newAssignments }));
    };

    const unitColors = {
      starters: 'primary',
      rotation: 'warning', 
      bench: 'neutral'
    };

    const unitIcons = {
      starters: '⭐',
      rotation: '🔄',
      bench: '📋'
    };

    return (
      <Stack spacing={3}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Position Unit Assignment
        </Typography>
        
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          Use the plus/minus buttons to assign positions to each unit. Players in unassigned positions won't accrue points.
        </Typography>

        {/* Available Positions Summary */}
        <Card variant="outlined" sx={{ bgcolor: 'background.level1' }}>
          <CardContent>
            <Typography level="title-md" sx={{ mb: 2 }}>
              📊 Available Positions
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {getRemainingPositions().map(({ position, count }) => (
                <Chip
                  key={position}
                  variant="soft"
                  color="success"
                  size="lg"
                >
                  {position}: {count} available
                </Chip>
              ))}
              {getRemainingPositions().length === 0 && (
                <Typography level="body-sm" color="text.secondary">
                  All positions have been assigned to units
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Unit Assignment Cards */}
        <Grid container spacing={3}>
          {['starters', 'rotation', 'bench'].map(unit => (
            <Grid xs={12} md={4} key={unit}>
              <Card 
                variant="outlined" 
                sx={{ 
                  height: '100%',
                  borderColor: getAssignedCount(unit) >= getMaxForUnit(unit) ? 'success.500' : 'neutral.300',
                  bgcolor: getAssignedCount(unit) >= getMaxForUnit(unit) ? 'success.50' : 'background.surface'
                }}
              >
                <CardContent>
                  <Stack spacing={3}>
                    {/* Unit Header */}
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="title-lg" sx={{ color: `${unitColors[unit]}.700`, mb: 1 }}>
                        {unitIcons[unit]} {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </Typography>
                      <Typography level="body-sm" color="text.secondary">
                        {getAssignedCount(unit)}/{getMaxForUnit(unit)} players assigned
                      </Typography>
                    </Box>
                    
                    {/* Position Controls */}
                    <Stack spacing={2}>
                      {getAvailablePositions().map(position => {
                        const currentCount = positionUnitAssignments[unit]?.[position] || 0;
                        const maxAvailable = rosterPositions[position] - 
                          (positionUnitAssignments.starters?.[position] || 0) -
                          (positionUnitAssignments.rotation?.[position] || 0) -
                          (positionUnitAssignments.bench?.[position] || 0) +
                          currentCount;
                        const canAdd = getAssignedCount(unit) < getMaxForUnit(unit) && maxAvailable > 0;
                        const canRemove = currentCount > 0;
                        
                        return (
                          <Card key={position} variant="soft" size="sm">
                            <CardContent sx={{ py: 1.5 }}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Box>
                                  <Typography level="body-md" sx={{ fontWeight: 'bold' }}>
                                    {position}
                                  </Typography>
                                  <Typography level="body-xs" color="text.secondary">
                                    {currentCount} assigned
                                  </Typography>
                                </Box>
                                
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <IconButton
                                    size="sm"
                                    variant="outlined"
                                    color="danger"
                                    onClick={() => removePositionFromUnit(unit, position)}
                                    disabled={!canRemove}
                                  >
                                    <Remove />
                                  </IconButton>
                                  
                                  <Typography level="body-lg" sx={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold' }}>
                                    {currentCount}
                                  </Typography>
                                  
                                  <IconButton
                                    size="sm"
                                    variant="outlined"
                                    color="success"
                                    onClick={() => addPositionToUnit(unit, position)}
                                    disabled={!canAdd}
                                  >
                                    <Add />
                                  </IconButton>
                                </Stack>
                              </Stack>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                    
                    {/* Unit Status */}
                    {getAssignedCount(unit) >= getMaxForUnit(unit) && (
                      <Alert color="success" variant="soft" size="sm">
                        <Typography level="body-xs">
                          ✅ Unit is complete!
                        </Typography>
                      </Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Assignment Summary */}
        <Alert color="info">
          <Typography level="body-sm">
            <strong>Assignment Summary:</strong>
          </Typography>
          <Typography level="body-sm">
            ⭐ Starters: {getAssignedCount('starters')}/{settings.starters_count} | 
            🔄 Rotation: {getAssignedCount('rotation')}/{settings.rotation_count} | 
            📋 Bench: {getAssignedCount('bench')}/{settings.bench_count}
          </Typography>
          <Typography level="body-sm" sx={{ mt: 1 }}>
            Unassigned: {getRemainingPositions().reduce((sum, { count }) => sum + count, 0)} players
          </Typography>
        </Alert>
      </Stack>
    );
  };

  const renderStep5 = () => (
    <Stack spacing={3}>
      <Typography level="h4" sx={{ mb: 2 }}>
        League Settings
      </Typography>

      <FormControl>
        <FormLabel>Scoring Type</FormLabel>
        <Select
          value={settings.scoring_type}
          onChange={(_, value) => handleSettingsChange('scoring_type', value)}
        >
          <Option value="H2H_Weekly">Weekly Head-to-Head</Option>
        </Select>
        <FormHelperText>All leagues use weekly head-to-head matchups</FormHelperText>
      </FormControl>

      <FormControl>
        <FormLabel>Fantasy Scoring Format</FormLabel>
        <Select
          value={settings.fantasy_scoring_format || 'FanDuel'}
          onChange={(_, value) => handleSettingsChange('fantasy_scoring_format', value)}
        >
          <Option value="FanDuel">
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>FanDuel</Typography>
              <Typography level="body-xs" color="neutral">FanDuel DFS scoring system</Typography>
            </Box>
          </Option>
          <Option value="DraftKings">
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>DraftKings</Typography>
              <Typography level="body-xs" color="neutral">DraftKings DFS scoring system</Typography>
            </Box>
          </Option>
          <Option value="Yahoo">
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>Yahoo</Typography>
              <Typography level="body-xs" color="neutral">Yahoo Fantasy Basketball scoring system</Typography>
            </Box>
          </Option>
          <Option value="ESPN">
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>ESPN</Typography>
              <Typography level="body-xs" color="neutral">ESPN Fantasy Basketball scoring system</Typography>
            </Box>
          </Option>
          <Option value="Custom">
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>Custom</Typography>
              <Typography level="body-xs" color="neutral">Customizable scoring system</Typography>
            </Box>
          </Option>
        </Select>
        <FormHelperText>Choose how fantasy points are calculated for your league</FormHelperText>
      </FormControl>

      <FormControl>
        <FormLabel>Salary Cap (in millions)</FormLabel>
        <Input
          type="number"
          value={(settings.salary_cap_amount || 200000000) / 1000000}
          onChange={(e) => handleSettingsChange('salary_cap_amount', parseInt(e.target.value) * 1000000)}
          placeholder="200"
          slotProps={{
            input: {
              min: 50,
              max: 500,
              step: 10
            }
          }}
          startDecorator="$"
          endDecorator="M"
        />
        <FormHelperText>
          Total salary cap per team. Default is $200M. Range: $50M - $500M
        </FormHelperText>
      </FormControl>

      <Grid container spacing={2}>
        <Grid xs={6}>
          <FormControl>
            <FormLabel>Playoff Teams</FormLabel>
            <Select
              value={settings.playoff_teams}
              onChange={(_, value) => handleSettingsChange('playoff_teams', value)}
            >
              {Array.from({ length: Math.floor(settings.max_teams / 2) }, (_, i) => (i + 1) * 2).map(num => (
                <Option key={num} value={num}>{num} Teams</Option>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid xs={6}>
          <FormControl>
            <FormLabel>Playoff Weeks</FormLabel>
            <Select
              value={settings.playoff_weeks}
              onChange={(_, value) => handleSettingsChange('playoff_weeks', value)}
            >
              <Option value={1}>1 Week</Option>
              <Option value={2}>2 Weeks</Option>
              <Option value={3}>3 Weeks</Option>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Divider />

      <Stack spacing={2}>
        <Typography level="title-md">Additional Options</Typography>
        
        <FormControl orientation="horizontal">
          <FormLabel>Auto-fill empty teams</FormLabel>
          <Switch
            checked={autoFillTeams}
            onChange={(e) => setAutoFillTeams(e.target.checked)}
          />
        </FormControl>

        <FormControl orientation="horizontal">
          <FormLabel>Public league</FormLabel>
          <Switch
            checked={settings.public_league}
            onChange={(e) => handleSettingsChange('public_league', e.target.checked)}
          />
        </FormControl>

        <FormControl orientation="horizontal">
          <FormLabel>Keeper league</FormLabel>
          <Switch
            checked={settings.keeper_league}
            onChange={(e) => handleSettingsChange('keeper_league', e.target.checked)}
          />
        </FormControl>
      </Stack>
    </Stack>
  );

  const renderStep6 = () => {
    // If league was just created, show invite link
    if (createdLeague) {
      const inviteUrl = `${window.location.origin}/join/${createdLeague.inviteCode}`;
      
      const handleCopy = () => {
        navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      };

      return (
    <Stack spacing={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography level="h4" sx={{ mb: 1, color: 'success.600' }}>
              🎉 League Created Successfully!
            </Typography>
            <Typography level="h5" sx={{ mb: 2 }}>
              {createdLeague.name}
            </Typography>
          </Box>

          <Card variant="outlined" sx={{ bgcolor: 'background.level1' }}>
            <CardContent>
              <Stack spacing={2}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LinkIcon color="primary" />
                    <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                      Invite Link
      </Typography>
                  </Stack>
                  <Chip size="sm" color="success" variant="soft">
                    Ready to Share
                  </Chip>
                </Box>

                {/* Description */}
                <Typography level="body-sm" color="neutral">
                  Share this link with anyone you want to invite to <strong>{createdLeague.name}</strong>. 
                  First {settings.max_teams} people to join get a team!
      </Typography>

                {/* URL Display with Copy Button */}
                <Box sx={{ display: 'flex', gap: 1 }}>
            <Input
                    value={inviteUrl}
                    readOnly
              sx={{ flex: 1 }}
                    endDecorator={
              <IconButton
                        size="sm"
                        variant="plain"
                        onClick={handleCopy}
                        sx={{ minWidth: 32 }}
                      >
                        {copied ? <Check color="success" /> : <ContentCopy />}
              </IconButton>
                    }
                  />
                </Box>

                {copied && (
                  <Alert color="success" variant="soft" size="sm">
                    <Typography level="body-xs">
                      ✓ Link copied to clipboard!
                    </Typography>
                  </Alert>
                )}

                {/* Stats */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <People sx={{ fontSize: 18, color: 'neutral.500' }} />
                    <Typography level="body-sm" color="neutral">
                      1 / {settings.max_teams} teams joined (you're the commissioner)
                    </Typography>
          </Stack>
                  <Typography level="body-xs" color="neutral">
                    Code: <strong>{createdLeague.inviteCode}</strong>
                  </Typography>
                </Box>

                {/* Share Buttons */}
                <Stack direction="row" spacing={1}>
                  <Button
                    size="sm"
                    variant="outlined"
                    onClick={handleCopy}
                    fullWidth
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </Button>
        <Button
                    size="sm"
          variant="outlined"
                    onClick={() => {
                      // Open email client with pre-filled invite
                      const subject = encodeURIComponent(`Join my fantasy basketball league: ${createdLeague.name}`);
                      const body = encodeURIComponent(
                        `Hey! I created a fantasy basketball league and I'd love for you to join.\n\n` +
                        `League: ${createdLeague.name}\n` +
                        `Join here: ${inviteUrl}\n\n` +
                        `First ${settings.max_teams} people to join get a spot. Hope to see you there!`
                      );
                      window.location.href = `mailto:?subject=${subject}&body=${body}`;
                    }}
                    fullWidth
                  >
                    Email Invite
        </Button>
      </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Alert color="primary" variant="soft">
            <Typography level="body-sm">
              💡 <strong>Pro tip:</strong> Share this link on social media, group chats, or email. 
              The first {settings.max_teams} people to join automatically get team spots!
            </Typography>
          </Alert>
    </Stack>
  );
    }

    // Default invite step (before league creation)
    return (
      <Stack spacing={3}>
        <Typography level="h4" sx={{ mb: 2 }}>
          Ready to Create League
        </Typography>
        
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          Your league is ready! After creation, you'll get a shareable invite link to send to friends.
        </Typography>

        <Alert color="primary" variant="soft">
          <Typography level="body-sm">
            🎯 <strong>How it works:</strong> Once created, you'll get a unique invite link. 
            Share it with as many people as you want - the first {settings.max_teams} to join get team spots!
          </Typography>
        </Alert>
      </Stack>
    );
  };

  const renderStepContent = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3(); // Weekly Lineup Config
      case 4: return renderStep4(); // Position Unit Assignment
      case 5: return renderStep5(); // League Settings
      case 6: return renderStep6(); // Invite Members
      default: return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'Basic Information';
      case 2: return 'Roster Setup';
      case 3: return 'Weekly Lineup Configuration';
      case 4: return 'Position Assignment';
      case 5: return 'League Rules';
      case 6: return 'Invite Members';
      default: return '';
    }
  };

  // Show loading state if user is still loading
  if (userLoading) {
    return (
      <Modal open={open} onClose={onClose}>
        <ModalDialog>
          <Typography>Loading user information...</Typography>
        </ModalDialog>
      </Modal>
    );
  }

  // Show error if user is not authenticated
  if (!user) {
    return (
      <Modal open={open} onClose={onClose}>
        <ModalDialog>
          <Alert color="danger">
            <Typography>You must be logged in to create a league.</Typography>
          </Alert>
        </ModalDialog>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ maxWidth: '800px', width: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
        <ModalClose />
        
        <Typography level="h3" sx={{ mb: 2 }}>
          Create New League
        </Typography>

        {/* Progress Indicator */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1} justifyContent="center">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <Chip
                key={stepNum}
                color={stepNum <= step ? 'primary' : 'neutral'}
                variant={stepNum === step ? 'solid' : 'outlined'}
                size="sm"
              >
                {stepNum}
              </Chip>
            ))}
          </Stack>
          <Typography level="body-sm" sx={{ textAlign: 'center', mt: 1, color: 'text.secondary' }}>
            Step {step} of 6: {getStepTitle()}
          </Typography>
        </Box>

        {/* Errors */}
        {errors.length > 0 && (
          <Alert color="danger" sx={{ mb: 3 }}>
            <Typography level="body-sm">
              Please fix the following errors:
            </Typography>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              {errors.map((error, index) => (
                <li key={index}>
                  <Typography level="body-sm">{error}</Typography>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation */}
        <Stack direction="row" spacing={2} sx={{ mt: 4, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            onClick={step === 1 ? onClose : handleBack}
            disabled={createLeague.isPending}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          
          <Button
            variant="solid"
            onClick={step === 6 ? (createdLeague ? () => {
              if (onSuccess) {
                onSuccess(createdLeague.id);
              }
              onClose();
            } : handleSubmit) : handleNext}
            loading={createLeague.isPending}
            disabled={createLeague.isPending}
          >
            {step === 6 ? (createdLeague ? 'Done' : 'Create League') : 'Next'}
          </Button>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
