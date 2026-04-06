import React, { useMemo } from 'react';
import { Box, Grid } from '@mui/joy';
import { Dayjs } from 'dayjs';
import { useTodayModuleVisibility } from '../../hooks/useTodayModuleVisibility';

// Import all module components - these will be passed as props or imported
import { TeamOfNightModule, LiveTeamOfNightModule } from '../../pages/Today';
import { PropPredictionsModule, PropPerformanceModule } from '../../pages/Today';
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
  onOpenPropPredictions?: (propsData: { pastProps?: any[]; futureProps?: any[]; isLoading: boolean; activeTab: 'hottest' | 'coldest' }) => void;
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

  // Track which modules we've already processed to avoid duplicates
  const processedModules = new Set<string>();
  
  // Check each module
  Object.entries(moduleVisibility).forEach(([originalModuleName, config]) => {
    // Check per-tab visibility based on dateState
    const visibilityByTab = config.visibility_by_tab || {
      past: config.is_visible,
      present: config.is_visible,
      future: config.is_visible,
      weekly: config.is_visible,
    };
    
    // Determine if this module should be visible for the current dateState
    let isVisibleForCurrentTab = config.is_visible; // Fallback to old field
    if (dateState === 'past') {
      isVisibleForCurrentTab = visibilityByTab.past ?? config.is_visible;
    } else if (dateState === 'present') {
      isVisibleForCurrentTab = visibilityByTab.present ?? config.is_visible;
    } else if (dateState === 'future') {
      isVisibleForCurrentTab = visibilityByTab.future ?? config.is_visible;
    }
    
    if (!isVisibleForCurrentTab) return;
    
    // Skip team_of_week - it's only shown on week summary pages, not daily view
    if (originalModuleName === 'team_of_week') return;
    
    let moduleName = originalModuleName;
    
    // Handle legacy team_of_night name for backward compatibility
    // But skip it if the new modules already exist to avoid duplicates
    if (originalModuleName === 'team_of_night') {
      // Only use legacy if the new modules don't exist
      if (dateState === 'past' && moduleVisibility['team_of_night_past']) {
        return; // Skip legacy, use team_of_night_past instead
      }
      if (dateState === 'present' && moduleVisibility['team_of_night_live']) {
        return; // Skip legacy, use team_of_night_live instead
      }
      
      // Map to the appropriate module based on dateState
      if (dateState === 'past') {
        moduleName = 'team_of_night_past';
      } else if (dateState === 'present') {
        moduleName = 'team_of_night_live';
      } else {
        return; // Don't show on future dates
      }
    }
    
    // Skip if we've already processed this module (prevents duplicates)
    // Use the mapped moduleName to check for duplicates
    if (processedModules.has(moduleName)) {
      return;
    }
    processedModules.add(moduleName);

    let shouldRender = false;

    // Date state logic
    if (moduleName === 'team_of_night_live') {
      // Live: only show on present date when games are live
      shouldRender = dateState === 'present' && hasLiveGames;
    } else if (moduleName === 'team_of_night_past') {
      // Past: only show on past dates
      shouldRender = dateState === 'past';
    } else if (
      moduleName === 'prop_predictions' ||
      moduleName === 'prop_predictions_over' ||
      moduleName === 'prop_predictions_under' ||
      moduleName === 'prop_predictions_team_confidence' ||
      moduleName === 'prop_predictions_player_confidence'
    ) {
      // Only show for present/today dates
      shouldRender = dateState === 'present';
    } else if (moduleName === 'prop_performance') {
      // Only show for past dates
      shouldRender = dateState === 'past';
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
    if (
      moduleName === 'prop_predictions' ||
      moduleName === 'prop_predictions_over' ||
      moduleName === 'prop_predictions_under' ||
      moduleName === 'prop_predictions_team_confidence' ||
      moduleName === 'prop_predictions_player_confidence'
    ) {
      return dateState === 'past' ? 4 : 6;
    }
    
    // Team of the Night modules: use the baseSize from config (respects admin settings)
    if (moduleName === 'team_of_night_live' || moduleName === 'team_of_night_past') {
      return baseSize; // Use the configured size, don't override
    }
    
    // For all other modules, use the database value
    return baseSize;
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Grid container spacing={2}>
        {modulesToRender.map(({ name, gridSize }) => {
          const effectiveGridSize = getEffectiveGridSize(name, gridSize);

          // Regular module rendering
          switch (name) {
            case 'team_of_night_live':
              // Only show if there are actually live games
              if (dateState === 'present' && hasLiveGames) {
                return (
                  <Grid key={name} xs={12} md={effectiveGridSize}>
                    <LiveTeamOfNightModule 
                      navigate={navigate}
                      selectedDate={selectedDate}
                      nbaScoreboard={nbaScoreboard}
                    />
                  </Grid>
                );
              }
              return null;
            case 'team_of_night_past':
              // Only show on past dates
              if (dateState === 'past') {
                return (
                  <Grid key={name} xs={12} md={effectiveGridSize}>
                    <TeamOfNightModule 
                      navigate={navigate}
                      selectedDate={selectedDate}
                    />
                  </Grid>
                );
              }
              return null;
            case 'prop_predictions':
              if (dateState === 'present') {
                return (
                  <Grid key={name} xs={12} md={effectiveGridSize}>
                    <PropPredictionsModule
                      selectedDate={selectedDate}
                      navigate={navigate}
                      onOpen={onOpenPropPredictions}
                      nbaScoreboard={nbaScoreboard}
                      embedMode="full"
                    />
                  </Grid>
                );
              }
              return null;
            case 'prop_predictions_over':
              if (dateState === 'present') {
                return (
                  <Grid key={name} xs={12} md={effectiveGridSize}>
                    <PropPredictionsModule
                      embedMode="over"
                      selectedDate={selectedDate}
                      navigate={navigate}
                      onOpen={onOpenPropPredictions}
                      nbaScoreboard={nbaScoreboard}
                    />
                  </Grid>
                );
              }
              return null;
            case 'prop_predictions_under':
              if (dateState === 'present') {
                return (
                  <Grid key={name} xs={12} md={effectiveGridSize}>
                    <PropPredictionsModule
                      embedMode="under"
                      selectedDate={selectedDate}
                      navigate={navigate}
                      onOpen={onOpenPropPredictions}
                      nbaScoreboard={nbaScoreboard}
                    />
                  </Grid>
                );
              }
              return null;
            case 'prop_predictions_team_confidence':
              if (dateState === 'present') {
                return (
                  <Grid key={name} xs={12} md={effectiveGridSize}>
                    <PropPredictionsModule
                      embedMode="team_confidence"
                      selectedDate={selectedDate}
                      navigate={navigate}
                      onOpen={onOpenPropPredictions}
                      nbaScoreboard={nbaScoreboard}
                    />
                  </Grid>
                );
              }
              return null;
            case 'prop_predictions_player_confidence':
              if (dateState === 'present') {
                return (
                  <Grid key={name} xs={12} md={effectiveGridSize}>
                    <PropPredictionsModule
                      embedMode="player_confidence"
                      selectedDate={selectedDate}
                      navigate={navigate}
                      onOpen={onOpenPropPredictions}
                      nbaScoreboard={nbaScoreboard}
                    />
                  </Grid>
                );
              }
              return null;
            case 'prop_performance':
              // Only show for past dates
              if (dateState === 'past') {
                return (
                  <Grid key={name} xs={12} md={effectiveGridSize}>
                    <PropPerformanceModule 
                      selectedDate={selectedDate}
                      navigate={navigate}
                      onOpen={onOpenPropPredictions}
                    />
                  </Grid>
                );
              }
              return null;
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
