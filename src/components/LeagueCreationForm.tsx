import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Input,
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
  Tooltip,
} from '@mui/joy';
import { useAuth } from '../hooks/useAuth';
import { useCreateLeagueMinimal as useCreateLeague } from '../hooks/useLeagueInitializationMinimal';
import { validateLeagueSettings, getDefaultLeagueSettings } from '../hooks/useLeagueInitialization';
import { LeagueSettings, LeagueCreationData } from '../types/leagueSettings';
import { Add, Remove, Settings, People, SportsBasketball, Schedule } from '@mui/icons-material';

interface LeagueCreationFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (leagueId: string) => void;
}

export default function LeagueCreationForm({ open, onClose, onSuccess }: LeagueCreationFormProps) {
  const { user, isLoading: userLoading } = useAuth();
  const createLeague = useCreateLeague();
  
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<LeagueSettings>(() => 
    getDefaultLeagueSettings(user?.id || '')
  );

  // Update settings when user changes
  React.useEffect(() => {
    if (user?.id) {
      setSettings(prev => ({ ...prev, commissioner_id: user.id }));
    }
  }, [user?.id]);
  const [commissionerTeamName, setCommissionerTeamName] = useState('');
  const [autoFillTeams, setAutoFillTeams] = useState(true);
  const [inviteEmails, setInviteEmails] = useState<string[]>(['']);
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

  const addInviteEmail = () => {
    setInviteEmails(prev => [...prev, '']);
  };

  const removeInviteEmail = (index: number) => {
    setInviteEmails(prev => prev.filter((_, i) => i !== index));
  };

  const updateInviteEmail = (index: number, value: string) => {
    setInviteEmails(prev => prev.map((email, i) => i === index ? value : email));
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
      const creationData: LeagueCreationData = {
        settings: { ...settings, commissioner_id: user.id }, // Ensure user ID is set
        commissioner_team_name: commissionerTeamName,
        auto_fill_teams: autoFillTeams,
        invite_emails: inviteEmails.filter(email => email.trim()),
      };

      const result = await createLeague.mutateAsync(creationData);
      
      if (onSuccess) {
        onSuccess(result.league.id);
      }
      
      onClose();
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
        <Input
          value={settings.description || ''}
          onChange={(e) => handleSettingsChange('description', e.target.value)}
          placeholder="Enter league description (optional)"
          multiline={true}
          sx={{ minHeight: '80px' }}
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

      <FormControl>
        <FormLabel>Draft Date & Time</FormLabel>
        <Input
          type="datetime-local"
          value={settings.draft_date || ''}
          onChange={(e) => handleSettingsChange('draft_date', e.target.value)}
        />
      </FormControl>
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

      <Alert color="info">
        <Typography level="body-sm">
          Total roster spots: {Object.values(settings.roster_positions).reduce((sum, count) => sum + count, 0)}
        </Typography>
      </Alert>
    </Stack>
  );

  const renderStep3 = () => (
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
          <Option value="H2H_Points">Head-to-Head Points</Option>
          <Option value="H2H_Category">Head-to-Head Category</Option>
          <Option value="H2H_Most_Categories">Head-to-Head Most Categories</Option>
          <Option value="Roto">Rotisserie</Option>
          <Option value="Season_Points">Season Points</Option>
        </Select>
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
        <Typography level="h6">Additional Options</Typography>
        
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

  const renderStep4 = () => (
    <Stack spacing={3}>
      <Typography level="h4" sx={{ mb: 2 }}>
        Invite Members
      </Typography>
      
      <Typography level="body-md" sx={{ color: 'text.secondary' }}>
        Send invitations to friends to join your league. You can also invite them later.
      </Typography>

      <Stack spacing={2}>
        {inviteEmails.map((email, index) => (
          <Stack key={index} direction="row" spacing={1} alignItems="center">
            <Input
              type="email"
              value={email}
              onChange={(e) => updateInviteEmail(index, e.target.value)}
              placeholder="Enter email address"
              sx={{ flex: 1 }}
            />
            {inviteEmails.length > 1 && (
              <IconButton
                color="danger"
                variant="outlined"
                onClick={() => removeInviteEmail(index)}
              >
                <Remove />
              </IconButton>
            )}
          </Stack>
        ))}
        
        <Button
          variant="outlined"
          startDecorator={<Add />}
          onClick={addInviteEmail}
        >
          Add Another Email
        </Button>
      </Stack>
    </Stack>
  );

  const renderStepContent = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'Basic Information';
      case 2: return 'Roster Setup';
      case 3: return 'League Rules';
      case 4: return 'Invite Members';
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
            {[1, 2, 3, 4].map((stepNum) => (
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
            Step {step} of 4: {getStepTitle()}
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
            onClick={step === 4 ? handleSubmit : handleNext}
            loading={createLeague.isPending}
            disabled={createLeague.isPending}
          >
            {step === 4 ? 'Create League' : 'Next'}
          </Button>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
