import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  Divider,
  Grid,
  Chip,
  IconButton,
  Select,
  Option,
  Switch,
} from '@mui/joy';
import { Add, Remove, ArrowBack, Save } from '@mui/icons-material';
import { useLeague } from '../hooks/useLeagues';
import { useLineupSettings } from '../hooks/useLineupSettings';
import { supabase } from '../utils/supabase';

interface RosterSettings {
  roster_positions: Record<string, number>;
  starters_count: number;
  starters_multiplier: number;
  rotation_count: number;
  rotation_multiplier: number;
  bench_count: number;
  bench_multiplier: number;
  position_unit_assignments: {
    starters: Record<string, number>;
    rotation: Record<string, number>;
    bench: Record<string, number>;
  };
}

export default function EditRosterSettings() {
  const navigate = useNavigate();
  const { id: leagueId } = useParams<{ id: string }>();
  
  console.log('🔧 EditRosterSettings: leagueId from params:', leagueId);
  
  const { data: league, isLoading: leagueLoading, error: leagueError } = useLeague(leagueId || '');
  const { data: lineupSettings, isLoading: settingsLoading, error: settingsError } = useLineupSettings(leagueId || '');
  
  console.log('🔧 EditRosterSettings: league data:', league);
  console.log('🔧 EditRosterSettings: league error:', leagueError);
  console.log('🔧 EditRosterSettings: lineup settings:', lineupSettings);
  console.log('🔧 EditRosterSettings: settings error:', settingsError);
  
  const [settings, setSettings] = useState<RosterSettings>({
    roster_positions: {
      "G": 2,
      "F": 2,
      "C": 1,
      "UTIL": 3
    },
    starters_count: 5,
    starters_multiplier: 1.00,
    rotation_count: 5,
    rotation_multiplier: 0.75,
    bench_count: 3,
    bench_multiplier: 0.50,
    position_unit_assignments: {
      starters: {
        "G": 1,
        "F": 1,
        "C": 1,
        "UTIL": 2
      },
      rotation: {
        "G": 1,
        "F": 1,
        "UTIL": 1
      },
      bench: {
        "UTIL": 3
      }
    }
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  console.log('🔧 EditRosterSettings: current settings state:', settings);

  // Load existing settings when they're available
  useEffect(() => {
    if (lineupSettings) {
      console.log('🔧 EditRosterSettings: Loading lineup settings:', lineupSettings);
      console.log('🔧 EditRosterSettings: roster_positions from DB:', lineupSettings.roster_positions);
      console.log('🔧 EditRosterSettings: position_unit_assignments from DB:', lineupSettings.position_unit_assignments);
      
      const newSettings = {
        roster_positions: lineupSettings.roster_positions || {
          "G": 2,
          "F": 2,
          "C": 1,
          "UTIL": 3
        },
        starters_count: lineupSettings.starters_count || 5,
        starters_multiplier: lineupSettings.starters_multiplier || 1.00,
        rotation_count: lineupSettings.rotation_count || 5,
        rotation_multiplier: lineupSettings.rotation_multiplier || 0.75,
        bench_count: lineupSettings.bench_count || 3,
        bench_multiplier: lineupSettings.bench_multiplier || 0.50,
        position_unit_assignments: lineupSettings.position_unit_assignments || {
          starters: {
            "G": 1,
            "F": 1,
            "C": 1,
            "UTIL": 2
          },
          rotation: {
            "G": 1,
            "F": 1,
            "UTIL": 1
          },
          bench: {
            "UTIL": 3
          }
        }
      };
      
      console.log('🔧 EditRosterSettings: Setting new settings:', newSettings);
      setSettings(newSettings);
    }
  }, [lineupSettings]);

  const handleRosterPositionChange = (position: string, count: number) => {
    setSettings(prev => ({
      ...prev,
      roster_positions: {
        ...prev.roster_positions,
        [position]: Math.max(0, count)
      }
    }));
  };

  const handleUnitCountChange = (unit: 'starters' | 'rotation' | 'bench', count: number) => {
    setSettings(prev => ({
      ...prev,
      [`${unit}_count`]: Math.max(0, count)
    }));
  };

  const handleMultiplierChange = (unit: 'starters' | 'rotation' | 'bench', multiplier: number) => {
    setSettings(prev => ({
      ...prev,
      [`${unit}_multiplier`]: Math.max(0, Math.min(2, multiplier))
    }));
  };

  const handlePositionAssignmentChange = (unit: 'starters' | 'rotation' | 'bench', position: string, count: number) => {
    setSettings(prev => ({
      ...prev,
      position_unit_assignments: {
        ...prev.position_unit_assignments,
        [unit]: {
          ...prev.position_unit_assignments[unit],
          [position]: Math.max(0, count)
        }
      }
    }));
  };

  const getAvailablePositions = () => {
    const validPositions = ['G', 'F', 'C', 'UTIL'];
    return validPositions.filter(pos => settings.roster_positions[pos] > 0);
  };

  const getAssignedCount = (unit: 'starters' | 'rotation' | 'bench') => {
    return Object.values(settings.position_unit_assignments[unit] || {}).reduce((sum, count) => sum + count, 0);
  };

  const getMaxForUnit = (unit: 'starters' | 'rotation' | 'bench') => {
    switch (unit) {
      case 'starters': return settings.starters_count;
      case 'rotation': return settings.rotation_count;
      case 'bench': return settings.bench_count;
      default: return 0;
    }
  };

  const getRemainingPositions = () => {
    const assigned: Record<string, number> = {};
    getAvailablePositions().forEach(pos => {
      assigned[pos] = settings.roster_positions[pos];
    });
    
    (['starters', 'rotation', 'bench'] as const).forEach(unit => {
      Object.keys(settings.position_unit_assignments[unit] || {}).forEach(pos => {
        assigned[pos] -= (settings.position_unit_assignments[unit][pos] || 0);
      });
    });
    
    return Object.entries(assigned)
      .filter(([pos, count]) => count > 0)
      .map(([pos, count]) => ({ position: pos, count }));
  };

  const getUnitPositions = (unit: 'starters' | 'rotation' | 'bench') => {
    return Object.entries(settings.position_unit_assignments[unit] || {})
      .filter(([pos, count]) => count > 0)
      .map(([pos, count]) => ({ position: pos, count }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      console.log('🔧 EditRosterSettings: Saving settings:', settings);
      console.log('🔧 EditRosterSettings: League ID:', leagueId);
      
      // Update league settings in the database
      const updateData = {
        roster_positions: settings.roster_positions,
        starters_count: settings.starters_count,
        starters_multiplier: settings.starters_multiplier,
        rotation_count: settings.rotation_count,
        rotation_multiplier: settings.rotation_multiplier,
        bench_count: settings.bench_count,
        bench_multiplier: settings.bench_multiplier,
        position_unit_assignments: settings.position_unit_assignments,
        updated_at: new Date().toISOString()
      };
      
      console.log('🔧 EditRosterSettings: Update data:', updateData);
      
      const { error } = await supabase
        .from('fantasy_leagues')
        .update(updateData)
        .eq('id', leagueId);

      if (error) {
        throw error;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving roster settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    navigate(`/league/${leagueId}/commissioner-tools`);
  };

  if (!leagueId) {
    return (
      <Alert color="danger">
        <Typography level="body-md">
          No league ID provided.
        </Typography>
      </Alert>
    );
  }

  if (leagueLoading || settingsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Typography>Loading roster settings...</Typography>
      </Box>
    );
  }

  if (leagueError) {
    return (
      <Alert color="danger">
        <Typography level="body-md">
          Error loading league: {leagueError.message}
        </Typography>
      </Alert>
    );
  }

  if (!league) {
    return (
      <Alert color="danger">
        <Typography level="body-md">
          League not found.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <IconButton variant="outlined" onClick={handleBack}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography level="h2" component="h1" sx={{ fontWeight: 'bold' }}>
              Edit Roster Settings
            </Typography>
            <Typography level="body-md" sx={{ color: 'text.secondary' }}>
              {league.name}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Save Status */}
      {saveError && (
        <Alert color="danger" sx={{ mb: 3 }}>
          <Typography level="body-sm">{saveError}</Typography>
        </Alert>
      )}
      
      {saveSuccess && (
        <Alert color="success" sx={{ mb: 3 }}>
          <Typography level="body-sm">Roster settings saved successfully!</Typography>
        </Alert>
      )}

      {/* Current Configuration Summary */}
      <Card variant="outlined" sx={{ mb: 3, backgroundColor: 'primary.50' }}>
        <CardContent>
          <Typography level="title-md" sx={{ mb: 2, fontWeight: 'bold' }}>
            Current League Configuration
          </Typography>
          <Grid container spacing={2}>
            <Grid xs={12} md={6}>
              <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                Roster Positions:
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                {Object.entries(settings.roster_positions)
                  .filter(([_, count]) => count > 0)
                  .map(([pos, count]) => `${pos}: ${count}`)
                  .join(', ')}
              </Typography>
            </Grid>
            <Grid xs={12} md={6}>
              <Typography level="body-sm" sx={{ fontWeight: 'bold', mb: 1 }}>
                Lineup Units:
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                Starters: {settings.starters_count} ({settings.starters_multiplier}x) | 
                Rotation: {settings.rotation_count} ({settings.rotation_multiplier}x) | 
                Bench: {settings.bench_count} ({settings.bench_multiplier}x)
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Roster Positions */}
        <Grid xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-lg" sx={{ mb: 2, fontWeight: 'bold' }}>
                Roster Positions
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
                Configure how many players of each position can be on a roster.
              </Typography>
              <Alert color="info" variant="soft" sx={{ mb: 3 }}>
                <Typography level="body-xs">
                  <strong>Updated Position System:</strong> We now use simplified positions: G (Guard), F (Forward), C (Center), and UTIL (Utility). 
                  This replaces the old PG, SG, SF, PF, BENCH, and IR positions for a cleaner roster structure.
                </Typography>
              </Alert>
              
              <Stack spacing={2}>
                {Object.entries(settings.roster_positions).map(([position, count]) => (
                  <Box key={position} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold', minWidth: '60px' }}>
                      {position}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <IconButton
                        size="sm"
                        variant="outlined"
                        onClick={() => handleRosterPositionChange(position, count - 1)}
                        disabled={count <= 0}
                      >
                        <Remove />
                      </IconButton>
                      <Typography level="body-sm" sx={{ minWidth: '20px', textAlign: 'center' }}>
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
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Unit Configuration */}
        <Grid xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-lg" sx={{ mb: 2, fontWeight: 'bold' }}>
                Lineup Units
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 3 }}>
                Configure lineup units, player counts, and multipliers.
              </Typography>
              
              <Stack spacing={3}>
                {(['starters', 'rotation', 'bench'] as const).map((unit) => (
                  <Box key={unit}>
                    <Typography level="title-sm" sx={{ mb: 2, textTransform: 'capitalize', fontWeight: 'bold' }}>
                      {unit}
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid xs={6}>
                        <FormControl>
                          <FormLabel>Player Count</FormLabel>
                          <Input
                            type="number"
                            value={settings[`${unit}_count`]}
                            onChange={(e) => handleUnitCountChange(unit, parseInt(e.target.value) || 0)}
                            slotProps={{ input: { min: 0, max: 15 } }}
                          />
                        </FormControl>
                      </Grid>
                      <Grid xs={6}>
                        <FormControl>
                          <FormLabel>Multiplier</FormLabel>
                          <Input
                            type="number"
                            step="0.01"
                            value={settings[`${unit}_multiplier`]}
                            onChange={(e) => handleMultiplierChange(unit, parseFloat(e.target.value) || 0)}
                            slotProps={{ input: { min: 0, max: 2, step: 0.01 } }}
                          />
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Position Unit Assignments */}
        <Grid xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-lg" sx={{ mb: 2, fontWeight: 'bold' }}>
                Position Unit Assignments
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
                Assign roster positions to lineup units. Players in unassigned positions won't accrue points.
              </Typography>
              <Alert color="success" variant="soft" sx={{ mb: 3 }}>
                <Typography level="body-xs">
                  <strong>Default Assignment:</strong> Starters: 1G, 1F, 1C, 2UTIL | Rotation: 1G, 1F, 1UTIL | Bench: 3UTIL
                </Typography>
              </Alert>

              <Grid container spacing={3}>
                {/* Available Positions */}
                <Grid xs={12} md={3}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography level="title-sm" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Available Positions
                      </Typography>
                      <Stack spacing={1}>
                        {getRemainingPositions().map(({ position, count }) => (
                          <Chip
                            key={position}
                            variant="outlined"
                            color="neutral"
                            sx={{ justifyContent: 'space-between' }}
                          >
                            {position} ({count})
                          </Chip>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Unit Assignments */}
                {(['starters', 'rotation', 'bench'] as const).map((unit) => (
                  <Grid xs={12} md={3} key={unit}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography level="title-sm" sx={{ mb: 2, textTransform: 'capitalize', fontWeight: 'bold' }}>
                          {unit}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 2 }}>
                          {getAssignedCount(unit)}/{getMaxForUnit(unit)} players
                        </Typography>
                        
                        <Stack spacing={1}>
                          {getUnitPositions(unit).map(({ position, count }) => (
                            <Box key={position} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Typography level="body-xs">{position}</Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <IconButton
                                  size="sm"
                                  variant="plain"
                                  onClick={() => handlePositionAssignmentChange(unit, position, count - 1)}
                                  disabled={count <= 0}
                                >
                                  <Remove />
                                </IconButton>
                                <Typography level="body-xs" sx={{ minWidth: '15px', textAlign: 'center' }}>
                                  {count}
                                </Typography>
                                <IconButton
                                  size="sm"
                                  variant="plain"
                                  onClick={() => handlePositionAssignmentChange(unit, position, count + 1)}
                                  disabled={getAssignedCount(unit) >= getMaxForUnit(unit)}
                                >
                                  <Add />
                                </IconButton>
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2} sx={{ mt: 4, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={handleBack}
          disabled={isSaving}
        >
          Back to Commissioner Tools
        </Button>
        <Button
          variant="solid"
          onClick={handleSave}
          loading={isSaving}
          startDecorator={<Save />}
        >
          Save Settings
        </Button>
      </Stack>
    </Box>
  );
}
