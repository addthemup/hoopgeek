/**
 * Shared feed drawer module rendering — used by FeedModulesGrid and ProfilePage
 * so module JSX is not duplicated.
 */

import React from 'react';
import { Card, CardContent } from '@mui/joy';
import type { NavigateFunction } from 'react-router-dom';
import type { Dayjs } from 'dayjs';
import { GamesCarouselHeader } from '../../pages/Today';
import { TeamOfNightWeekCombinedModule } from '../../pages/Today';
import { PropPredictionsModule, PropPerformanceModule } from '../../pages/Today';
import { StandingsModule, LeadersModule, InjuriesModule } from '../../pages/Today';
import FavoritePlayersCarousel from './FavoritePlayersCarousel';
import DraftModule from './DraftModule';
import DFSModule from './DFSModule';
import BestGamesModule from '../Today/BestGamesModule';
import SlipBuilderModule from './SlipBuilderModule';
import type { ActiveFilter } from '../../types/feed';

/** Game payload when user clicks a game in the carousel */
export type FeedGameClickPayload = {
  game_id: string;
  home_team_tricode: string;
  away_team_tricode: string;
};

/** Default module ids for /profile — overridden by `profile_module_visibility` (admin PROFILE UI). */
export const PROFILE_HUB_MODULE_NAMES = [
  'favorite_players',
  'dfs_pools',
  'slip_builder',
  'prop_predictions_over',
  'prop_predictions_under',
  'prop_predictions_team_confidence',
  'prop_predictions_player_confidence',
  'prop_performance',
  'draft',
] as const;

export type ProfileHubModuleName = (typeof PROFILE_HUB_MODULE_NAMES)[number];

export interface FeedDrawerModuleContext {
  navigate: NavigateFunction;
  selectedDate: Dayjs;
  nbaScoreboard: unknown;
  standings: unknown;
  standingsLoading: boolean;
  weekBounds: { start_date: string; end_date: string };
  hasLiveGames: boolean;
  activeFilters: ActiveFilter[];
  onAddFilter?: (filter: Omit<ActiveFilter, 'id'>) => void;
  onRemoveFilter?: (id: string) => void;
  onGameClick?: (game: FeedGameClickPayload) => void;
  setDrawerOpen: (open: boolean) => void;
}

export function renderFeedDrawerModule(name: string, ctx: FeedDrawerModuleContext): React.ReactNode {
  const {
    navigate,
    selectedDate,
    nbaScoreboard,
    standings,
    standingsLoading,
    weekBounds,
    hasLiveGames,
    activeFilters,
    onAddFilter,
    onRemoveFilter,
    onGameClick,
    setDrawerOpen,
  } = ctx;

  switch (name) {
    case 'games_carousel':
      return (
        <GamesCarouselHeader
          selectedDate={selectedDate}
          navigate={navigate}
          onGameClickOverride={
            onAddFilter || onGameClick
              ? (game) => {
                  onGameClick?.(game);
                  if (onAddFilter) {
                    activeFilters.filter((f) => f.type === 'team').forEach((f) => onRemoveFilter?.(f.id));
                    onAddFilter({ type: 'team', value: game.home_team_tricode, label: game.home_team_tricode });
                    onAddFilter({ type: 'team', value: game.away_team_tricode, label: game.away_team_tricode });
                  }
                }
              : undefined
          }
        />
      );
    case 'feed_posts':
      return null;
    case 'prop_predictions':
      // Legacy combined module — hidden after migration; keep so old DB rows don’t error.
      return null;
    case 'prop_predictions_over':
      return (
        <PropPredictionsModule
          embedMode="over"
          selectedDate={selectedDate}
          navigate={navigate}
          onOpen={() => {
            setDrawerOpen(false);
            navigate('/feed/prop-predictions');
          }}
          nbaScoreboard={nbaScoreboard as any}
        />
      );
    case 'prop_predictions_under':
      return (
        <PropPredictionsModule
          embedMode="under"
          selectedDate={selectedDate}
          navigate={navigate}
          onOpen={() => {
            setDrawerOpen(false);
            navigate('/feed/prop-predictions');
          }}
          nbaScoreboard={nbaScoreboard as any}
        />
      );
    case 'prop_predictions_team_confidence':
      return (
        <PropPredictionsModule
          embedMode="team_confidence"
          selectedDate={selectedDate}
          navigate={navigate}
          onOpen={() => {
            setDrawerOpen(false);
            navigate('/feed/prop-predictions');
          }}
          nbaScoreboard={nbaScoreboard as any}
        />
      );
    case 'prop_predictions_player_confidence':
      return (
        <PropPredictionsModule
          embedMode="player_confidence"
          selectedDate={selectedDate}
          navigate={navigate}
          onOpen={() => {
            setDrawerOpen(false);
            navigate('/feed/prop-predictions');
          }}
          nbaScoreboard={nbaScoreboard as any}
        />
      );
    case 'slip_builder':
      return <SlipBuilderModule />;
    case 'prop_performance':
      return (
        <PropPerformanceModule
          selectedDate={selectedDate}
          navigate={navigate}
          onOpen={() => {}}
        />
      );
    case 'standings':
      return (
        <StandingsModule
          standings={standings as any}
          standingsLoading={standingsLoading}
          navigate={navigate}
          onAddFilter={onAddFilter}
        />
      );
    case 'favorite_players':
      return <FavoritePlayersCarousel navigate={navigate} onAddFilter={onAddFilter} />;
    case 'leaders':
      return <LeadersModule navigate={navigate} onAddFilter={onAddFilter} />;
    case 'injuries':
      return <InjuriesModule navigate={navigate} selectedDate={selectedDate} />;
    case 'totn_totw':
      return (
        <TeamOfNightWeekCombinedModule
          navigate={navigate}
          selectedDate={selectedDate}
          nbaScoreboard={nbaScoreboard as any}
          hasLiveGames={hasLiveGames}
        />
      );
    case 'best_games':
      return (
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
          <CardContent>
            <BestGamesModule
              weekStartDate={weekBounds.start_date}
              weekEndDate={weekBounds.end_date}
              navigate={navigate}
            />
          </CardContent>
        </Card>
      );
    case 'draft':
      return <DraftModule navigate={navigate} />;
    case 'dfs_pools':
      return <DFSModule navigate={navigate} />;
    default:
      return null;
  }
}
