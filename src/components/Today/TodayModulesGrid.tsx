import React, { useMemo } from 'react';
import { Box, Grid } from '@mui/joy';
import { Dayjs } from 'dayjs';
import { useTodayModuleVisibility } from '../../hooks/useTodayModuleVisibility';

// Import all module components - these will be passed as props or imported
import { TeamOfNightModule, LiveTeamOfNightModule } from '../../pages/Today';
import { PropPredictionsModule } from '../../pages/Today';
import { StandingsModule } from '../../pages/Today';
import { FavoritePlayersModule } from '../../pages/Today';
import { LeadersModule } from '../../pages/Today';
import { InjuriesModule } from '../../pages/Today';

interface TodayModulesGridProps {
  dateState: 'past' | 'present' | 'future';
  selectedDate: Dayjs;
  navigate: (path: string) => void;
  nbaScoreboard?: any;
  standings?: any;
  standingsLoading?: boolean;
}

export default function TodayModulesGrid({
  dateState,
  selectedDate,
  navigate,
  nbaScoreboard,
  standings,
  standingsLoading,
  onOpenPropPredictions,
}: TodayModulesGridProps) {
  const { data: moduleVisibility, isLoading: moduleVisibilityLoading } = useTodayModuleVisibility();

  // Check if there are any live games (for present date) - MUST be before early return (Rules of Hooks)
  // Live games have status 2 (Live) or statusText includes "Live" or "In Progress"
  const hasLiveGames = useMemo(() => {
    if (dateState !== 'present' || !nbaScoreboard?.games) return false;
    
    return nbaScoreboard.games.some((game: any) => {
      const status = game.gameStatus || game.game_status;
      const statusText = (game.gameStatusText || game.game_status_text || '').toLowerCase();
      return status === 2 || statusText.includes('live') || statusText.includes('in progress');
    });
  }, [dateState, nbaScoreboard?.games]);

  if (moduleVisibilityLoading || !moduleVisibility) {
    return null;
  }

  // Get all visible modules and sort by display_order
  const modulesToRender: Array<{
    name: string;
    order: number;
    gridSize: number;
    shouldRender: boolean;
  }> = [];

  // Check each module
  Object.entries(moduleVisibility).forEach(([moduleName, config]) => {
    if (!config.is_visible) return;
    
    // Skip team_of_week - it's only shown on week summary pages, not daily view
    if (moduleName === 'team_of_week') return;

    let shouldRender = false;

    // Date state logic
    if (moduleName === 'team_of_night') {
      // Past: show Team of Night (jersey format)
      // Present: show Live Team of Night (table format) if games are live
      shouldRender = dateState === 'past' || dateState === 'present';
    } else if (moduleName === 'prop_predictions') {
      // Show for all states, but only if no live games for present
      shouldRender = true;
    } else {
      // All other modules show for all states
      shouldRender = true;
    }

    if (shouldRender) {
      modulesToRender.push({
        name: moduleName,
        order: config.display_order,
        gridSize: config.grid_size,
        shouldRender: true,
      });
    }
  });

  // Sort by display_order
  modulesToRender.sort((a, b) => a.order - b.order);

  // Calculate effective grid size based on dateState and module type
  const getEffectiveGridSize = (moduleName: string, baseSize: number): number => {
    // Prop Predictions: smaller on past dates (1/3), larger on present/future (2/3)
    if (moduleName === 'prop_predictions') {
      return dateState === 'past' ? 4 : 8;
    }
    
    // Team of the Night: different sizes based on dateState
    if (moduleName === 'team_of_night') {
      if (dateState === 'past') {
        return 8; // Jersey format, larger
      } else if (dateState === 'present') {
        return 4; // Table format, smaller (top right)
      }
    }
    
    // For all other modules, use the database value
    return baseSize;
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Grid container spacing={2}>
        {modulesToRender.map(({ name, gridSize }) => {
          const effectiveGridSize = getEffectiveGridSize(name, gridSize);

          // Special handling for Live Team of the Night (present date)
          // Only show if there are actually live games
          if (name === 'team_of_night' && dateState === 'present' && hasLiveGames) {
            return (
              <Grid key={`live-${name}`} xs={12} md={effectiveGridSize}>
                <LiveTeamOfNightModule 
                  navigate={navigate}
                  selectedDate={selectedDate}
                  nbaScoreboard={nbaScoreboard}
                />
              </Grid>
            );
          }
          
          // If team_of_night on present date but no live games, skip it (props predictions will show instead)
          if (name === 'team_of_night' && dateState === 'present' && !hasLiveGames) {
            return null;
          }

          // Regular module rendering
          switch (name) {
            case 'team_of_night':
              return (
                <Grid key={name} xs={12} md={effectiveGridSize}>
                  <TeamOfNightModule 
                    navigate={navigate}
                    selectedDate={selectedDate}
                  />
                </Grid>
              );
            case 'prop_predictions':
              return (
                <Grid key={name} xs={12} md={effectiveGridSize}>
                  <PropPredictionsModule 
                    selectedDate={selectedDate}
                    navigate={navigate}
                    onOpen={onOpenPropPredictions}
                  />
                </Grid>
              );
            case 'standings':
              return (
                <Grid key={name} xs={12} md={effectiveGridSize}>
                  <StandingsModule 
                    standings={standings}
                    standingsLoading={standingsLoading}
                    navigate={navigate}
                  />
                </Grid>
              );
            case 'favorite_players':
              return (
                <Grid key={name} xs={12} md={effectiveGridSize}>
                  <FavoritePlayersModule 
                    navigate={navigate}
                  />
                </Grid>
              );
            case 'leaders':
              return (
                <Grid key={name} xs={12} md={effectiveGridSize}>
                  <LeadersModule 
                    navigate={navigate}
                  />
                </Grid>
              );
            case 'injuries':
              return (
                <Grid key={name} xs={12} md={effectiveGridSize}>
                  <InjuriesModule 
                    navigate={navigate}
                    selectedDate={selectedDate}
                  />
                </Grid>
              );
            default:
              return null;
          }
        })}
      </Grid>
    </Box>
  );
}
