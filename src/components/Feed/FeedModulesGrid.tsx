/**
 * Feed page layout using MUI Joy inset drawer pattern.
 * Main area: feed posts only (full width). A button top-right opens an
 * inset drawer containing all other modules (games carousel, props,
 * standings, etc.). Which modules appear in the drawer is controlled by
 * /admin (Drawer Modules).
 */

import React, { useMemo, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  ChipDelete,
  Drawer,
  Sheet,
  DialogTitle,
  DialogContent,
  ModalClose,
  Divider,
  IconButton,
  Typography,
  Alert,
} from '@mui/joy';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Logout from '@mui/icons-material/Logout';
import Google from '@mui/icons-material/Google';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import { useNavigate, Link } from 'react-router-dom';
import PlayerTeamSearchBar from '../PlayerTeamSearchBar';
import { useAuth } from '../../hooks/useAuth';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { supabase } from '../../utils/supabase';
import dayjs, { Dayjs } from 'dayjs';
import { useFeedModuleVisibility, DEFAULT_FEED_MODULES } from '../../hooks/useFeedModuleVisibility';
import { useNBAScoreboard } from '../../hooks/useNBAScoreboard';
import { useStandings } from '../../hooks/useStandings';
import { getTodayEST } from '../../utils/nbaDateUtils';
import { GamesCarouselHeader } from '../../pages/Today';
import { TeamOfNightModule, LiveTeamOfNightModule } from '../../pages/Today';
import { PropPredictionsModule, PropPerformanceModule } from '../../pages/Today';
import { StandingsModule, LeadersModule, InjuriesModule, TeamOfWeekSection } from '../../pages/Today';
import FavoritePlayersCarousel from './FavoritePlayersCarousel';
import DraftModule from './DraftModule';
import BestGamesModule from '../Today/BestGamesModule';
import type { ActiveFilter } from '../../types/feed';

/** Height of the fixed header bar (search + filter + More). Used for spacer and positioning. */
const FEED_HEADER_BAR_HEIGHT = 52;

interface FeedModulesGridProps {
  children: React.ReactNode; // Rendered when feed_posts module is visible (the stories card grid)
  /** Content for the filter section in the mobile inset drawer (e.g. filter chips). */
  filterDrawerContent?: React.ReactNode;
  /** Active feed filters (shown as chips to the left of the search bar). */
  activeFilters?: ActiveFilter[];
  onAddFilter?: (filter: Omit<ActiveFilter, 'id'>) => void;
  onRemoveFilter?: (id: string) => void;
}

function getCurrentWeekBounds(): { start_date: string; end_date: string } {
  const todayEST = getTodayEST();
  const d = dayjs(todayEST);
  const start = d.startOf('isoWeek').format('YYYY-MM-DD');
  const end = d.endOf('isoWeek').format('YYYY-MM-DD');
  return { start_date: start, end_date: end };
}

export default function FeedModulesGrid({
  children,
  filterDrawerContent,
  activeFilters = [],
  onAddFilter,
  onRemoveFilter,
}: FeedModulesGridProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/feed` },
      });
      if (error) {
        setGoogleError(error.message);
      }
    } catch (err: unknown) {
      setGoogleError(err instanceof Error ? err.message : 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };
  const todayEST = getTodayEST();
  const selectedDate = dayjs(todayEST) as Dayjs;

  const { data: moduleVisibility, isLoading: visibilityLoading } = useFeedModuleVisibility();
  const { data: nbaScoreboard } = useNBAScoreboard(todayEST);
  const { data: standings, isLoading: standingsLoading } = useStandings();

  const hasLiveGames = useMemo(() => {
    if (!nbaScoreboard?.games) return false;
    return nbaScoreboard.games.some((game: any) => {
      const status = game.gameStatus ?? game.game_status;
      const text = (game.gameStatusText ?? game.game_status_text ?? '').toLowerCase();
      return status === 2 || text.includes('live') || text.includes('in progress');
    });
  }, [nbaScoreboard?.games]);

  const weekBounds = useMemo(() => getCurrentWeekBounds(), []);

  // Always show button + drawer; use default module list when still loading or missing data
  const effectiveVisibility = moduleVisibility ?? DEFAULT_FEED_MODULES;

  const modulesToRender: Array<{ name: string; gridSize: number; gridSizeMobile: number; display_order: number }> = [];
  Object.entries(effectiveVisibility).forEach(([name, config]) => {
    if (!config.is_visible) return;
    modulesToRender.push({
      name,
      gridSize: config.grid_size ?? 4,
      gridSizeMobile: config.grid_size_mobile ?? 12,
      display_order: config.display_order ?? 0,
    });
  });
  modulesToRender.sort((a, b) => a.display_order - b.display_order);

  const renderModule = (name: string) => {
    switch (name) {
      case 'games_carousel':
        return (
          <GamesCarouselHeader selectedDate={selectedDate} navigate={navigate} />
        );
      case 'feed_posts':
        return <>{children}</>;
      case 'team_of_night_live':
        if (!hasLiveGames) return null;
        return (
          <LiveTeamOfNightModule
            navigate={navigate}
            selectedDate={selectedDate}
            nbaScoreboard={nbaScoreboard}
          />
        );
      case 'team_of_night_past':
        return (
          <TeamOfNightModule navigate={navigate} selectedDate={selectedDate} showJersey={false} />
        );
      case 'prop_predictions':
        return (
          <PropPredictionsModule
            selectedDate={selectedDate}
            navigate={navigate}
            onOpen={() => {}}
            nbaScoreboard={nbaScoreboard}
          />
        );
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
            standings={standings}
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
        return (
          <InjuriesModule
            navigate={navigate}
            selectedDate={selectedDate}
          />
        );
      case 'team_of_week':
        return (
          <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
            <CardContent>
              <TeamOfWeekSection navigate={navigate} hideHeader={false} showJersey={false} />
            </CardContent>
          </Card>
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
      default:
        return null;
    }
  };

  // Main area: always the feed (children). Drawer: every other visible module. Hide favorite_players when not logged in.
  const otherModules = modulesToRender.filter(
    (m) => m.name !== 'feed_posts' && (!!user || m.name !== 'favorite_players')
  );

  const moduleLabels: Record<string, string> = {
    games_carousel: 'Games',
    feed_posts: 'Feed Posts',
    team_of_night_live: 'Team of the Night (Live)',
    team_of_night_past: 'Team of the Night',
    prop_predictions: 'Prop Predictions',
    prop_performance: 'Prop Performance',
    standings: 'Standings',
    favorite_players: 'Favorite Players',
    leaders: 'Leaders',
    injuries: 'Injuries',
    team_of_week: 'Team of the Week',
    best_games: 'Best Games',
    draft: 'Draft',
  };

  /** Module names whose header should link to a route (e.g. Draft → /draft). */
  const moduleHeaderLinks: Record<string, string> = {
    draft: '/draft',
  };

  const insetDrawer = (
    <Drawer
      anchor="right"
      size="md"
      variant="plain"
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      slotProps={{
        root: { sx: { zIndex: 1300 } },
        content: {
          sx: {
            bgcolor: 'transparent',
            p: { xs: 0, sm: 0, md: 3 },
            boxShadow: 'none',
            // Wide-but-still-drawer on mobile: ~90% leaves a visible strip so it reads as overlay
            '@media (max-width: 900px)': {
              width: '90vw',
              maxWidth: '90vw',
              '--Drawer-horizontalSize': '90vw',
            },
          },
        },
      }}
    >
      <Sheet
        sx={(theme) => ({
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          height: '100%',
          overflow: 'hidden',
          bgcolor: 'background.surface',
          [theme.breakpoints.down('md')]: { borderRadius: 'var(--joy-radius-md) 0 0 var(--joy-radius-md)' },
          [theme.breakpoints.up('md')]: { borderRadius: 'md' },
        })}
      >
        <DialogTitle>More</DialogTitle>
        <ModalClose />

        {!user && (
          <Box sx={{ flexShrink: 0 }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 1.5 }}>
              Sign in to save favorites and get personalized content.
            </Typography>
            {googleError && (
              <Alert color="danger" size="sm" sx={{ mb: 1.5 }}>{googleError}</Alert>
            )}
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={<Google />}
              onClick={handleGoogleSignIn}
              loading={googleLoading}
              fullWidth
            >
              Continue with Google
            </Button>
            <Divider sx={{ my: 2 }} />
          </Box>
        )}

        {user && filterDrawerContent != null && (
          <>
            <Box sx={{ flexShrink: 0 }}>{filterDrawerContent}</Box>
            <Divider />
          </>
        )}
        <DialogContent sx={{ gap: 0, flex: 1, overflow: 'auto', p: 0, minHeight: 0 }}>
          {otherModules.map(({ name }, index) => {
            const content = renderModule(name);
            if (content === null) return null;
            const label = moduleLabels[name] ?? name.replace(/_/g, ' ');
            return (
              <Box
                key={name}
                sx={{
                  pt: index === 0 ? 0 : 3,
                  pb: 2,
                  borderBottom: index < otherModules.length - 1 ? '1px solid' : undefined,
                  borderColor: 'divider',
                }}
              >
                {moduleHeaderLinks[name] ? (
                  <Link
                    to={moduleHeaderLinks[name]}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <Typography level="title-sm" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.primary', '&:hover': { color: 'primary.500' } }}>
                      {label}
                    </Typography>
                  </Link>
                ) : (
                  <Typography level="title-sm" sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.primary' }}>
                    {label}
                  </Typography>
                )}
                {content}
              </Box>
            );
          })}
        </DialogContent>

        {user && (
          <Box
            sx={{
              flexShrink: 0,
              borderTop: '1px solid',
              borderColor: 'divider',
              pt: 2,
              mt: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {isAdmin && (
              <Button
                variant="outlined"
                color="neutral"
                fullWidth
                startDecorator={<AdminPanelSettings />}
                onClick={() => {
                  setDrawerOpen(false);
                  navigate('/admin');
                }}
                sx={{ color: '#FFFFFF', '&:hover': { borderColor: 'primary.500', color: 'primary.500' } }}
              >
                Admin
              </Button>
            )}
            <Button
              variant="outlined"
              color="neutral"
              fullWidth
              startDecorator={<Logout />}
              onClick={async () => {
                await signOut();
                setDrawerOpen(false);
                navigate('/feed');
              }}
              sx={{ color: '#FFFFFF', '&:hover': { borderColor: 'primary.500', color: 'primary.500' } }}
            >
              Log out
            </Button>
          </Box>
        )}
      </Sheet>
    </Drawer>
  );

  const activeFilterChips =
    activeFilters.length > 0 && onRemoveFilter ? (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: 0.75,
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          py: 0.5,
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'neutral.600' },
        }}
      >
        {activeFilters.map((f) => (
          <Chip
            key={f.id}
            size="sm"
            variant="soft"
            color="neutral"
            endDecorator={<ChipDelete onDelete={() => onRemoveFilter(f.id)} />}
            sx={{
              flexShrink: 0,
              color: '#FFFFFF',
              bgcolor: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              '& .MuiChipDelete-root': { color: 'rgba(255,255,255,0.9)', '&:hover': { color: '#FFF' } },
            }}
          >
            {f.label}
          </Chip>
        ))}
      </Box>
    ) : (
      <Box sx={{ flex: 1, minWidth: 0 }} />
    );

  // Mobile: fixed header at top; spacer; scrollable content
  if (isMobile) {
    return (
      <Box sx={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 0,
            minHeight: FEED_HEADER_BAR_HEIGHT,
            px: 1.5,
            py: 1,
            bgcolor: 'background.body',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {activeFilterChips}
          <PlayerTeamSearchBar compact maxWidth={280} sx={{ width: 280, minWidth: 0, flexShrink: 0 }} />
          <IconButton
            variant="outlined"
            color="neutral"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open drawer"
            sx={{ flexShrink: 0 }}
          >
            <TuneRoundedIcon />
          </IconButton>
        </Box>
        <Box sx={{ flexShrink: 0, height: FEED_HEADER_BAR_HEIGHT, minHeight: FEED_HEADER_BAR_HEIGHT }} aria-hidden />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
          }}
        >
          {children}
        </Box>
        {insetDrawer}
      </Box>
    );
  }

  // Desktop: feed header fixed to top of viewport (app level); no gap so feed doesn’t show above it when scrolling
  return (
    <Box sx={{ width: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          maxWidth: 1200,
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 0,
          minHeight: FEED_HEADER_BAR_HEIGHT,
          px: 3,
          py: 1,
          bgcolor: 'background.body',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {activeFilterChips}
        <PlayerTeamSearchBar compact maxWidth={360} sx={{ width: 360, minWidth: 0, flexShrink: 0 }} />
        <Button
          variant="outlined"
          color="neutral"
          startDecorator={<TuneRoundedIcon />}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open drawer"
        >
          More
        </Button>
      </Box>
      <Box
        sx={{
          flexShrink: 0,
          height: FEED_HEADER_BAR_HEIGHT,
          minHeight: FEED_HEADER_BAR_HEIGHT,
        }}
        aria-hidden
      />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        }}
      >
        {children}
      </Box>
      {insetDrawer}
    </Box>
  );
}
