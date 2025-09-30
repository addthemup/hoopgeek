import * as React from 'react';
import Box from '@mui/material/Box';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ThemeProvider, createTheme, Chip, Typography as MuiTypography } from '@mui/material';
import { 
  Typography, 
  Button, 
  Stack, 
  Alert,
  Drawer,
  DialogTitle,
  DialogContent,
  ModalClose,
  Divider,
  FormControl,
  FormLabel,
  FormHelperText,
  List,
  ListItem,
  RadioGroup,
  Radio,
  Sheet,
  Switch,
  Checkbox,
  AspectRatio,
  Card,
  CardContent
} from '@mui/joy';
import { 
  Tune as TuneIcon,
  SportsBasketball as SportsBasketballIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  EmojiEvents as EmojiEventsIcon,
  School as SchoolIcon,
  AttachMoney as AttachMoneyIcon,
  Done as DoneIcon
} from '@mui/icons-material';
import { usePlayers } from '../hooks/useNBAData';

// Create a theme for the DataGrid to fix border color issues
const dataGridTheme = createTheme({
  palette: {
    mode: 'light',
  },
  components: {
    MuiDataGrid: {
      styleOverrides: {
        root: {
          border: '1px solid #e0e0e0',
        },
        cell: {
          borderBottom: '1px solid #e0e0e0',
        },
        columnHeaders: {
          backgroundColor: '#f5f5f5',
          borderBottom: '2px solid #e0e0e0',
        },
        row: {
          '&:hover': {
            backgroundColor: '#f8f9fa',
          },
        },
      },
    },
  },
});

export default function Players() {
  const { data: players, isLoading, error } = usePlayers();
  
  // Filter state
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [showInactivePlayers, setShowInactivePlayers] = React.useState(false);
  const [selectedPositions, setSelectedPositions] = React.useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = React.useState<string[]>([]);
  const [showRookiesOnly, setShowRookiesOnly] = React.useState(false);
  const [showVeteransOnly, setShowVeteransOnly] = React.useState(false);
  const [minExperience, setMinExperience] = React.useState<number | null>(null);
  const [maxExperience, setMaxExperience] = React.useState<number | null>(null);
  const [hasSalary, setHasSalary] = React.useState(false);

  // Console logging for debugging
  React.useEffect(() => {
    console.log('🔍 Players component state:', {
      isLoading,
      error: error?.message,
      playersCount: players?.length || 0,
      hasPlayers: !!players
    });
  }, [isLoading, error, players]);

      // Filter players based on current filter state
      const filteredPlayers = React.useMemo(() => {
        if (!players) return [];
        
        return players.filter(player => {
          // Default: hide players without teams unless explicitly shown
          // A player is active if they have a team assigned
          const isPlayerActive = !!(player.team_name && player.team_name.trim() !== '');
          if (!showInactivePlayers && !isPlayerActive) {
            return false;
          }
      
      // Position filter
      if (selectedPositions.length > 0 && player.position && !selectedPositions.includes(player.position)) {
        return false;
      }
      
      // Team filter
      if (selectedTeams.length > 0 && player.team_name && !selectedTeams.includes(player.team_name)) {
        return false;
      }
      
      // Rookie filter
      if (showRookiesOnly && !player.is_rookie) {
        return false;
      }
      
      // Veteran filter (3+ years experience)
      if (showVeteransOnly && (player.years_pro || 0) < 3) {
        return false;
      }
      
      // Experience range filter
      const experience = player.years_pro || 0;
      if (minExperience !== null && experience < minExperience) {
        return false;
      }
      if (maxExperience !== null && experience > maxExperience) {
        return false;
      }
      
      // Salary filter
      if (hasSalary && (!player.salary || player.salary <= 0)) {
        return false;
      }
      
      return true;
    });
  }, [players, showInactivePlayers, selectedPositions, selectedTeams, showRookiesOnly, showVeteransOnly, minExperience, maxExperience, hasSalary]);

  // Get unique positions and teams for filter options
  const uniquePositions = React.useMemo(() => {
    if (!players) return [];
    const positions = players
      .map(p => p.position)
      .filter((pos): pos is string => pos !== null && pos !== undefined && pos !== '')
      .filter((pos, index, arr) => arr.indexOf(pos) === index)
      .sort();
    return positions;
  }, [players]);

  const uniqueTeams = React.useMemo(() => {
    if (!players) return [];
    const teams = players
      .map(p => p.team_name)
      .filter((team): team is string => team !== null && team !== undefined && team !== '')
      .filter((team, index, arr) => arr.indexOf(team) === index)
      .sort();
    return teams;
  }, [players]);

  const clearFilters = () => {
    setShowInactivePlayers(false);
    setSelectedPositions([]);
    setSelectedTeams([]);
    setShowRookiesOnly(false);
    setShowVeteransOnly(false);
    setMinExperience(null);
    setMaxExperience(null);
    setHasSalary(false);
  };

  const columns: GridColDef[] = [
    { 
      field: 'id', 
      headerName: 'ID', 
      width: 80,
      type: 'number'
    },
    {
      field: 'name',
      headerName: 'Player Name',
      width: 200,
      editable: false,
    },
    {
      field: 'first_name',
      headerName: 'First Name',
      width: 150,
      editable: false,
    },
    {
      field: 'last_name',
      headerName: 'Last Name',
      width: 150,
      editable: false,
    },
    {
      field: 'position',
      headerName: 'Position',
      width: 100,
      editable: false,
      renderCell: (params) => (
        params.value ? (
          <Chip 
            label={params.value} 
            size="small" 
            color="primary" 
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        ) : '-'
      ),
    },
    {
      field: 'team_name',
      headerName: 'Team',
      width: 120,
      editable: false,
      renderCell: (params) => (
        params.value ? (
          <Chip 
            label={params.value} 
            size="small" 
            color="default" 
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        ) : '-'
      ),
    },
    {
      field: 'jersey_number',
      headerName: 'Jersey #',
      width: 100,
      type: 'number',
      editable: false,
      renderCell: (params) => (
        params.value ? `#${params.value}` : '-'
      ),
    },
    {
      field: 'height',
      headerName: 'Height',
      width: 100,
      editable: false,
    },
    {
      field: 'weight',
      headerName: 'Weight',
      width: 100,
      type: 'number',
      editable: false,
      renderCell: (params) => (
        params.value ? `${params.value} lbs` : '-'
      ),
    },
    {
      field: 'age',
      headerName: 'Age',
      width: 80,
      type: 'number',
      editable: false,
    },
    {
      field: 'years_pro',
      headerName: 'Experience',
      width: 100,
      type: 'number',
      editable: false,
      renderCell: (params) => (
        params.value ? `${params.value} years` : '-'
      ),
    },
    {
      field: 'college',
      headerName: 'College',
      width: 150,
      editable: false,
    },
    {
      field: 'draft_year',
      headerName: 'Draft Year',
      width: 120,
      type: 'number',
      editable: false,
    },
        {
          field: 'is_active',
          headerName: 'Active',
          width: 100,
          type: 'boolean',
          editable: false,
          valueGetter: (value, row) => !!(row.team_name && row.team_name.trim() !== ''),
          renderCell: (params) => (
            <Chip 
              label={params.value ? 'Active' : 'Inactive'}
              size="small" 
              color={params.value ? "success" : "default"} 
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ),
        },
    {
      field: 'is_rookie',
      headerName: 'Rookie',
      width: 100,
      type: 'boolean',
      editable: false,
      renderCell: (params) => (
        params.value ? (
          <Chip 
            label="Rookie"
            size="small" 
            color="warning" 
            variant="outlined"
            sx={{ fontSize: '0.75rem' }}
          />
        ) : '-'
      ),
    },
    {
      field: 'salary',
      headerName: 'Salary',
      width: 120,
      type: 'number',
      editable: false,
      renderCell: (params) => (
        params.value > 0 ? `$${params.value.toLocaleString()}` : '-'
      ),
    },
  ];

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h3">Loading NBA players...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="h3" color="danger">
          Error loading players: {error.message}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto', p: 2 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography level="h2">NBA Players</Typography>
            <Typography level="body-sm" color="neutral">
              Showing {filteredPlayers.length} of {players?.length || 0} players
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              color="neutral"
              startDecorator={<TuneIcon />}
              onClick={() => setFiltersOpen(true)}
            >
              Filters
            </Button>
          </Stack>
        </Box>


        {filteredPlayers && filteredPlayers.length > 0 ? (
          <ThemeProvider theme={dataGridTheme}>
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={filteredPlayers}
                columns={columns}
                initialState={{
                  pagination: {
                    paginationModel: {
                      pageSize: 25,
                    },
                  },
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                checkboxSelection
                disableRowSelectionOnClick
                getRowId={(row) => row.id}
              />
            </Box>
          </ThemeProvider>
        ) : (
          <ThemeProvider theme={dataGridTheme}>
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={[]}
                columns={columns}
                initialState={{
                  pagination: {
                    paginationModel: {
                      pageSize: 25,
                    },
                  },
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                checkboxSelection
                disableRowSelectionOnClick
                getRowId={(row) => row.id}
                slots={{
                  noRowsOverlay: () => (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%',
                      gap: 2
                    }}>
                      <MuiTypography variant="h6" color="text.secondary">
                        No players found
                      </MuiTypography>
                      <MuiTypography variant="body2" color="text.secondary">
                        Try adjusting your filters or check back later for updated data.
                      </MuiTypography>
                    </Box>
                  )
                }}
              />
            </Box>
          </ThemeProvider>
        )}
      </Stack>

      {/* Filter Drawer */}
      <Drawer
        size="md"
        variant="plain"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        slotProps={{
          content: {
            sx: {
              bgcolor: 'transparent',
              p: { md: 3, sm: 0 },
              boxShadow: 'none',
            },
          },
        }}
      >
        <Sheet
          sx={{
            borderRadius: 'md',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            height: '100%',
            overflow: 'auto',
          }}
        >
          <DialogTitle>Player Filters</DialogTitle>
          <ModalClose />
          <Divider sx={{ mt: 'auto' }} />
          <DialogContent sx={{ gap: 2 }}>
            
            {/* Player Status */}
            <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
              Player Status
            </Typography>
            <FormControl orientation="horizontal">
              <Box sx={{ flex: 1, pr: 1 }}>
                <FormLabel sx={{ typography: 'title-sm' }}>
                  Show players without teams
                </FormLabel>
                <FormHelperText sx={{ typography: 'body-sm' }}>
                  Include players who don't currently have a team assigned.
                </FormHelperText>
              </Box>
              <Switch 
                checked={showInactivePlayers}
                onChange={(event) => setShowInactivePlayers(event.target.checked)}
              />
            </FormControl>

            {/* Position Filter */}
            <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
              Position
            </Typography>
            <List
              orientation="horizontal"
              size="sm"
              sx={{ '--List-gap': '12px', '--ListItem-radius': '20px' }}
            >
              {uniquePositions.map((position) => {
                const selected = selectedPositions.includes(position);
                return (
                  <ListItem key={position}>
                    <AspectRatio
                      variant={selected ? 'solid' : 'outlined'}
                      color={selected ? 'primary' : 'neutral'}
                      ratio={1}
                      sx={{ width: 20, borderRadius: 20, ml: -0.5, mr: 0.75 }}
                    >
                      <div>{selected && <DoneIcon fontSize="md" />}</div>
                    </AspectRatio>
                    <Checkbox
                      size="sm"
                      color="neutral"
                      disableIcon
                      overlay
                      label={position}
                      variant="outlined"
                      checked={selected}
                      onChange={(event) =>
                        setSelectedPositions((prev) => {
                          if (event.target.checked) {
                            return [...prev, position];
                          } else {
                            return prev.filter(p => p !== position);
                          }
                        })
                      }
                      slotProps={{
                        action: {
                          sx: {
                            '&:hover': {
                              bgcolor: 'transparent',
                            },
                          },
                        },
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>

            {/* Team Filter */}
            <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
              Team
            </Typography>
            <List
              orientation="horizontal"
              size="sm"
              sx={{ '--List-gap': '12px', '--ListItem-radius': '20px', flexWrap: 'wrap' }}
            >
              {uniqueTeams.slice(0, 10).map((team) => {
                const selected = selectedTeams.includes(team);
                return (
                  <ListItem key={team}>
                    <AspectRatio
                      variant={selected ? 'solid' : 'outlined'}
                      color={selected ? 'primary' : 'neutral'}
                      ratio={1}
                      sx={{ width: 20, borderRadius: 20, ml: -0.5, mr: 0.75 }}
                    >
                      <div>{selected && <DoneIcon fontSize="md" />}</div>
                    </AspectRatio>
                    <Checkbox
                      size="sm"
                      color="neutral"
                      disableIcon
                      overlay
                      label={team}
                      variant="outlined"
                      checked={selected}
                      onChange={(event) =>
                        setSelectedTeams((prev) => {
                          if (event.target.checked) {
                            return [...prev, team];
                          } else {
                            return prev.filter(t => t !== team);
                          }
                        })
                      }
                      slotProps={{
                        action: {
                          sx: {
                            '&:hover': {
                              bgcolor: 'transparent',
                            },
                          },
                        },
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>

            {/* Experience Filters */}
            <Typography level="title-md" sx={{ fontWeight: 'bold', mt: 2 }}>
              Experience
            </Typography>
            <FormControl orientation="horizontal">
              <Box sx={{ flex: 1, pr: 1 }}>
                <FormLabel sx={{ typography: 'title-sm' }}>
                  Rookies only
                </FormLabel>
                <FormHelperText sx={{ typography: 'body-sm' }}>
                  Show only first-year players.
                </FormHelperText>
              </Box>
              <Switch 
                checked={showRookiesOnly}
                onChange={(event) => setShowRookiesOnly(event.target.checked)}
              />
            </FormControl>

            <FormControl orientation="horizontal">
              <Box sx={{ flex: 1, pr: 1 }}>
                <FormLabel sx={{ typography: 'title-sm' }}>
                  Veterans only (3+ years)
                </FormLabel>
                <FormHelperText sx={{ typography: 'body-sm' }}>
                  Show only players with 3 or more years of experience.
                </FormHelperText>
              </Box>
              <Switch 
                checked={showVeteransOnly}
                onChange={(event) => setShowVeteransOnly(event.target.checked)}
              />
            </FormControl>

            {/* Salary Filter */}
            <FormControl orientation="horizontal">
              <Box sx={{ flex: 1, pr: 1 }}>
                <FormLabel sx={{ typography: 'title-sm' }}>
                  Has salary data
                </FormLabel>
                <FormHelperText sx={{ typography: 'body-sm' }}>
                  Show only players with available salary information.
                </FormHelperText>
              </Box>
              <Switch 
                checked={hasSalary}
                onChange={(event) => setHasSalary(event.target.checked)}
              />
            </FormControl>

          </DialogContent>

          <Divider sx={{ mt: 'auto' }} />
          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ justifyContent: 'space-between' }}
          >
            <Button
              variant="outlined"
              color="neutral"
              onClick={clearFilters}
            >
              Clear All
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              Show {filteredPlayers.length} players
            </Button>
          </Stack>
        </Sheet>
      </Drawer>
    </Box>
  );
}
