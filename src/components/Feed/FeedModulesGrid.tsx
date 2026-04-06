/**
 * Feed page layout using MUI Joy inset drawer pattern.
 * Main area: feed posts only (full width). A button top-right opens an
 * inset drawer containing all other modules (games carousel, props,
 * standings, etc.). Which modules appear in the drawer is controlled by
 * /admin (Drawer Modules).
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useMediaQuery } from '@mui/material';
import {
  Box,
  Button,
  Chip,
  ChipDelete,
  CircularProgress,
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
import Google from '@mui/icons-material/Google';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';
import PlayerTeamSearchBar from '../PlayerTeamSearchBar';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase';
import dayjs, { Dayjs } from 'dayjs';
import { useFeedModuleVisibility, DEFAULT_FEED_MODULES } from '../../hooks/useFeedModuleVisibility';
import { useNBAScoreboard } from '../../hooks/useNBAScoreboard';
import { useStandings } from '../../hooks/useStandings';
import { getTodayEST, getSiteDayEST, normalizeESTDateString } from '../../utils/nbaDateUtils';
import { renderFeedDrawerModule } from './FeedDrawerModules';
import type { FeedGameClickPayload } from './FeedDrawerModules';
import { SlipBuilderProvider, useSlipBuilder } from '../../contexts/SlipBuilderContext';
import { FeedDrawerRestoreProvider } from '../../contexts/FeedDrawerRestoreContext';
import { FeedDrawerTabProvider } from '../../contexts/FeedDrawerTabContext'
import { CONTENT_MAX_WIDTH, INSET_DRAWER_CONTENT_SX } from '../../constants/layout';
import type { ActiveFilter } from '../../types/feed';
import ProfileHubContent from './ProfileHubContent';
import AdminHubContent from './AdminHubContent';
import AccountCircleRounded from '@mui/icons-material/AccountCircleRounded';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useIsSuperAdmin } from '../../hooks/useIsAdmin';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import { packFeedDrawerDesktopSlides } from '../../utils/feedDrawerDesktopPack';
import { isFeedStorySlugPath } from '../../utils/feedPaths';
import {
  countVisibleModulesPerFeedDrawerTab,
  filterModulesForFeedDrawerTab,
  type FeedDrawerTabId,
} from '../../constants/feedDrawerTabs';
import { useFeedLayout } from '../../contexts/FeedLayoutContext';
import {
  MiniCalendar,
  MiniCalendarDay,
  MiniCalendarDays,
  MiniCalendarNavigation,
} from '@/components/kibo-ui/mini-calendar';

/** Height of the fixed header bar (search + filter + Home). Used for spacer and positioning. */
const FEED_HEADER_BAR_HEIGHT = 52;
const FEED_DRAWER_TAB_STORAGE_KEY = 'feed:drawerTab'

/** Renders drawer module list; uses SlipBuilder context to ghost slip_builder and scroll ref when adding a leg. */
function DrawerModulesList({
  otherModules,
  renderModule,
  setDrawerOpen,
  openDrawerRef,
  isMobile,
}: {
  otherModules: Array<{ name: string; desktop_layout: string }>;
  renderModule: (name: string) => React.ReactNode;
  setDrawerOpen: (v: boolean) => void;
  openDrawerRef: React.MutableRefObject<(() => void) | null>;
  isMobile: boolean;
}) {
  const { showSlipBuilder } = useSlipBuilder();
  const slipBuilderSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openDrawerRef.current = () => {
      setDrawerOpen(true);
      setTimeout(() => slipBuilderSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 150);
    };
    return () => {
      openDrawerRef.current = null;
    };
  }, [setDrawerOpen, openDrawerRef]);

  const visibleModules = useMemo(
    () => otherModules.filter((m) => m.name !== 'slip_builder' || showSlipBuilder),
    [otherModules, showSlipBuilder]
  );
  const gamesCarouselModule = useMemo(
    () => visibleModules.find((m) => m.name === 'games_carousel') ?? null,
    [visibleModules]
  );
  const bodyModules = useMemo(
    () => visibleModules.filter((m) => m.name !== 'games_carousel'),
    [visibleModules]
  );

  const desktopSlides = useMemo(
    () => packFeedDrawerDesktopSlides(bodyModules),
    [bodyModules]
  );

  const moduleTileSx = {
    minHeight: 0,
    height: '100%',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 'md',
    p: 0,
    overflow: 'auto',
    bgcolor: 'transparent',
    display: 'flex',
    width: '100%',
    '& > *': {
      width: '100%',
      minWidth: 0,
    },
  } as const;

  if (isMobile) {
    return (
      <>
        {visibleModules.map(({ name }, index) => {
          const content = renderModule(name);
          if (content === null) return null;
          const isSlipBuilder = name === 'slip_builder';
          return (
            <Box
              key={name}
              ref={isSlipBuilder ? slipBuilderSectionRef : undefined}
              sx={{
                pt: index === 0 ? 0 : 3,
                pb: 2,
                borderBottom: index < visibleModules.length - 1 ? '1px solid' : undefined,
                borderColor: 'divider',
              }}
            >
              {content}
            </Box>
          );
        })}
      </>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
        gap: 2,
        pb: 0,
      }}
    >
      {gamesCarouselModule && (
        <Box
          sx={{
            flexShrink: 0,
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {renderModule(gamesCarouselModule.name)}
        </Box>
      )}

      {bodyModules.length > 0 ? (
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            // Match games carousel: no extra horizontal inset (carousel is full width of this column)
            px: 0,
          }}
        >
          <Carousel
            opts={{ align: 'start', loop: false, dragFree: false }}
            className="relative flex min-h-0 w-full flex-1 flex-col"
          >
            <CarouselContent
              viewportClassName="min-h-0 flex-1"
              className="-ml-0 flex h-full min-h-0 items-stretch pl-0"
            >
              {desktopSlides.map((placements, slideIndex) => (
                <CarouselItem key={slideIndex} className="flex h-full min-h-0 basis-full flex-col pl-0">
                  <Box
                    sx={{
                      display: 'grid',
                      height: '100%',
                      minHeight: 0,
                      flex: 1,
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                      gap: 1.5,
                      alignItems: 'stretch',
                    }}
                  >
                    {placements.map((placement) => {
                      const content = renderModule(placement.name);
                      if (content === null) {
                        return <Box key={placement.name} sx={{ minHeight: 0 }} />;
                      }
                      const isSlipBuilder = placement.name === 'slip_builder';
                      return (
                        <Box
                          key={`${slideIndex}-${placement.name}`}
                          ref={isSlipBuilder ? slipBuilderSectionRef : undefined}
                          sx={{
                            ...moduleTileSx,
                            gridColumn: placement.gridColumn,
                            gridRow: placement.gridRow,
                          }}
                        >
                          {content}
                        </Box>
                      );
                    })}
                  </Box>
                </CarouselItem>
              ))}
            </CarouselContent>
            {desktopSlides.length > 1 && (
              <>
                <CarouselPrevious className="left-1 top-1/2 z-20 h-9 w-9 -translate-y-1/2 border-[#333] bg-[#252525] text-white hover:bg-[#333] hover:text-white disabled:opacity-30" />
                <CarouselNext className="right-1 top-1/2 z-20 h-9 w-9 -translate-y-1/2 border-[#333] bg-[#252525] text-white hover:bg-[#333] hover:text-white disabled:opacity-30" />
              </>
            )}
          </Carousel>
        </Box>
      ) : (
        !gamesCarouselModule && (
          <Typography level="body-sm" sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
            No modules enabled
          </Typography>
        )
      )}
    </Box>
  );
}

function FeedDrawerTabModulePane({
  tab,
  otherModules,
  isMobile,
  renderModule,
  setDrawerOpen,
  openDrawerRef,
  modulesLoading,
}: {
  tab: FeedDrawerTabId;
  otherModules: Array<{ name: string; desktop_layout: string }>;
  isMobile: boolean;
  renderModule: (name: string) => React.ReactNode;
  setDrawerOpen: (v: boolean) => void;
  openDrawerRef: React.MutableRefObject<(() => void) | null>;
  modulesLoading: boolean;
}) {
  const tabModules = useMemo(
    () => filterModulesForFeedDrawerTab(otherModules, tab),
    [otherModules, tab]
  );
  const list = isMobile ? (
    <DrawerModulesList
      otherModules={tabModules}
      renderModule={renderModule}
      setDrawerOpen={setDrawerOpen}
      openDrawerRef={openDrawerRef}
      isMobile
    />
  ) : (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <DrawerModulesList
        otherModules={tabModules}
        renderModule={renderModule}
        setDrawerOpen={setDrawerOpen}
        openDrawerRef={openDrawerRef}
        isMobile={false}
      />
    </Box>
  );

  return (
    <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {list}
      {modulesLoading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.45)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <CircularProgress
            size="lg"
            sx={{
              '--CircularProgress-trackColor': '#222',
              '--CircularProgress-progressColor': '#FFC72C',
            }}
          />
        </Box>
      )}
    </Box>
  );
}

export type { FeedGameClickPayload } from './FeedDrawerModules';

interface FeedModulesGridProps {
  children: React.ReactNode; // Main /feed/ story grid (always in page layout; not a drawer module)
  /** @deprecated Filters live above the feed; drawer no longer shows filter chips. */
  filterDrawerContent?: React.ReactNode;
  /** Filter icon row rendered above feed posts (sticky within content). */
  feedTopBar?: React.ReactNode;
  /** Active feed filters (team/player chips in header; post-type filters use icon bar). */
  activeFilters?: ActiveFilter[];
  onAddFilter?: (filter: Omit<ActiveFilter, 'id'>) => void;
  onRemoveFilter?: (id: string) => void;
  /** When user clicks a game in the carousel: called with game info so feed can navigate to ?game= and set team filters. */
  onGameClick?: (game: FeedGameClickPayload) => void;
  /** When true, a game header is shown above the feed; used to ensure the content area has a bounded height so it can scroll. */
  hasGameHeader?: boolean;
  /** When true, content is in normal flow (no inner scroll container) so the page scrolls; use for single-post view. */
  flowContent?: boolean;
}

function getCurrentWeekBounds(): { start_date: string; end_date: string } {
  const todayEST = getTodayEST();
  const d = dayjs(todayEST);
  const start = d.startOf('week').format('YYYY-MM-DD');
  const end = d.endOf('week').format('YYYY-MM-DD');
  return { start_date: start, end_date: end };
}

export default function FeedModulesGrid({
  children,
  filterDrawerContent,
  feedTopBar,
  activeFilters = [],
  onAddFilter,
  onRemoveFilter,
  onGameClick,
  hasGameHeader = false,
  flowContent = false,
}: FeedModulesGridProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { siteDate, setSiteDate } = useFeedLayout();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isGameRoute = location.pathname.startsWith('/game/');
  const [drawerOpen, setDrawerOpen] = useState(() => {
    const s = location.state as { openDrawer?: boolean; keepDrawerOpen?: boolean } | null
    return s?.openDrawer === true || s?.keepDrawerOpen === true
  })
  const [drawerProfileMode, setDrawerProfileMode] = useState(false);
  const [feedDrawerTab, setFeedDrawerTab] = useState<FeedDrawerTabId>(() => {
    try {
      const raw = window.localStorage.getItem(FEED_DRAWER_TAB_STORAGE_KEY)
      if (raw === 'home' || raw === 'props' || raw === 'dfs' || raw === 'draft') return raw
    } catch {}
    return 'home'
  });
  const { user } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const openedDrawerFromMessagesRef = useRef(false);

  // After navigation: keep drawer open when requested (tab switches, admin "open drawer", etc.)
  React.useEffect(() => {
    const s = location.state as { openDrawer?: boolean; keepDrawerOpen?: boolean } | null
    if (s?.openDrawer === true || s?.keepDrawerOpen === true) {
      setDrawerOpen(true)
    }
  }, [location.key, location.state])

  // Keep drawer tab in sync with the current section route.
  React.useEffect(() => {
    const p = location.pathname || '/'
    const next: FeedDrawerTabId =
      p === '/' || p.startsWith('/feed') ? 'home' :
      p.startsWith('/props') ? 'props' :
      p.startsWith('/dfs') ? 'dfs' :
      p.startsWith('/draft') ? 'draft' :
      feedDrawerTab
    if (next !== feedDrawerTab) setFeedDrawerTab(next)
    // Intentionally do not depend on feedDrawerTab to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  React.useEffect(() => {
    const wantsDrawerMessages = searchParams.get('drawer') === 'messages';
    if (!wantsDrawerMessages || openedDrawerFromMessagesRef.current) return;
    openedDrawerFromMessagesRef.current = true;
    setDrawerOpen(true);
    setDrawerProfileMode(true);
    setFeedDrawerTab('home');
  }, [searchParams]);

  /** Profile hub hides DFS/Draft triggers; keep tab value off missing triggers. */
  React.useEffect(() => {
    if (drawerProfileMode && (feedDrawerTab === 'dfs' || feedDrawerTab === 'draft')) {
      setFeedDrawerTab('home');
    }
  }, [drawerProfileMode, feedDrawerTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FEED_DRAWER_TAB_STORAGE_KEY, feedDrawerTab)
    } catch {}
  }, [feedDrawerTab])

  const closeDrawer = () => {
    setDrawerProfileMode(false);
    setDrawerOpen(false);
  };

  /** Only the explicit ModalClose control should dismiss; backdrop/Escape keep the drawer stationary. */
  const handleDrawerModalClose = (
    _event: unknown,
    reason?: 'backdropClick' | 'escapeKeyDown' | 'closeClick'
  ) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
    closeDrawer();
  };
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
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
  const defaultSiteDate = getSiteDayEST(3);
  const dateFromQuery = normalizeESTDateString(searchParams.get('date'));
  const selectedDateYmd = siteDate || defaultSiteDate;
  const selectedDate = dayjs(selectedDateYmd) as Dayjs;
  const hydratedDateFromUrlRef = React.useRef(false);

  React.useEffect(() => {
    if (hydratedDateFromUrlRef.current) return;
    hydratedDateFromUrlRef.current = true;
    if (dateFromQuery && siteDate !== dateFromQuery) {
      setSiteDate(dateFromQuery);
    }
  }, [dateFromQuery, setSiteDate, siteDate]);

  const { data: moduleVisibility, isLoading: visibilityLoading } = useFeedModuleVisibility();
  const { data: nbaScoreboard } = useNBAScoreboard(selectedDateYmd);
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

  const modulesToRender: Array<{
    name: string;
    gridSize: number;
    gridSizeMobile: number;
    display_order: number;
    desktop_layout: string;
  }> = [];
  Object.entries(effectiveVisibility).forEach(([name, config]) => {
    if (name === 'feed_posts') return;
    if (!config.is_visible) return;
    modulesToRender.push({
      name,
      gridSize: config.grid_size ?? 4,
      gridSizeMobile: config.grid_size_mobile ?? 12,
      display_order: config.display_order ?? 0,
      desktop_layout: config.desktop_layout ?? 'cell',
    });
  });
  modulesToRender.sort((a, b) => a.display_order - b.display_order);

  const openDrawerToSlipBuilderRef = useRef<(() => void) | null>(null);

  const renderModule = (name: string) =>
    renderFeedDrawerModule(name, {
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
    });

  // Main area: always the feed (children). Drawer: every other visible module.
  const otherModules = modulesToRender
    .filter((m) => !user && m.name === 'favorite_players' ? false : true)
    .map((m) => ({ name: m.name, desktop_layout: m.desktop_layout }));
  const feedTabsMode = Boolean(user);

  const feedDrawerTabBadgeCounts = useMemo(() => {
    const names = modulesToRender
      .filter((m) => (user ? true : m.name !== 'favorite_players'))
      .map((m) => m.name);
    return countVisibleModulesPerFeedDrawerTab(new Set(names));
  }, [modulesToRender, user]);


  const handleFeedDrawerTabChange = (v: string) => {
    const next = v as FeedDrawerTabId;
    setFeedDrawerTab(next);
    // Keep drawer open while switching tabs so new tab modules can load,
    // and the destination page can route/render "behind" the drawer.
    setDrawerOpen(true);
    const navState = {
      ...(location.state as Record<string, unknown> | null),
      keepDrawerOpen: true as const,
    }
    if (next === 'home') navigate('/', { replace: false, state: navState });
    if (next === 'props') navigate('/props', { replace: false, state: navState });
    if (next === 'dfs') navigate('/dfs', { replace: false, state: navState });
    if (next === 'draft') navigate('/draft', { replace: false, state: navState });
    if (next === 'dfs' || next === 'draft') {
      setDrawerProfileMode(false);
    }
  };

  const insetDrawer = (
    <Drawer
      anchor="right"
      size="md"
      variant="plain"
      open={drawerOpen}
      onClose={handleDrawerModalClose as (event: unknown, reason?: string) => void}
      disableEscapeKeyDown
      slotProps={{
        root: { sx: { zIndex: 1300 } },
        content: {
          sx: INSET_DRAWER_CONTENT_SX,
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
        {feedTabsMode ? (
          <Tabs
            value={feedDrawerTab}
            onValueChange={handleFeedDrawerTabChange}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-0"
          >
            <DialogTitle
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 1,
                pb: 0,
                mb: '7px',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'stretch',
                  width: '100%',
                  minWidth: 0,
                  pr: '5%',
                  border: '1px solid',
                  borderColor: '#333',
                  bgcolor: '#000000',
                }}
              >
                {drawerProfileMode && (
                  <IconButton
                    variant="plain"
                    color="neutral"
                    size="sm"
                    onClick={() => setDrawerProfileMode(false)}
                    aria-label="Back to feed drawer"
                    sx={{
                      flexShrink: 0,
                      alignSelf: 'stretch',
                      width: 44,
                      minWidth: 44,
                      borderRadius: 0,
                      borderRight: '1px solid',
                      borderColor: '#333',
                      bgcolor: '#000000',
                      color: '#737373',
                      '&:hover': {
                        bgcolor: '#141414',
                        color: '#FFC72C',
                      },
                    }}
                  >
                    <ArrowBackIosNewRounded sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
                <TabsList
                  className={
                    drawerProfileMode
                      ? 'grid h-auto min-h-[40px] w-full min-w-0 flex-1 grid-cols-2 gap-0 rounded-none border-0 bg-transparent p-0 text-zinc-500'
                      : 'grid h-auto min-h-[40px] w-full min-w-0 flex-1 grid-cols-4 gap-0 rounded-none border-0 bg-transparent p-0 text-zinc-500'
                  }
                >
                  <TabsTrigger
                    value="home"
                    className="group w-full min-w-0 gap-1 rounded-none px-1 py-1.5 text-xs font-medium text-zinc-500 shadow-none transition-colors not-last:border-r not-last:border-[#333] hover:bg-[#141414] hover:text-zinc-300 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFC72C]/35 focus-visible:ring-offset-0 data-[state=active]:bg-[#141414] data-[state=active]:text-[#FFC72C] data-[state=active]:shadow-none sm:px-2 sm:text-sm"
                  >
                    {drawerProfileMode ? 'Profile' : 'Home'}
                    {!drawerProfileMode && (
                      <Badge
                        className="ml-1 rounded-none border-0 bg-[#1a1a1a] px-1.5 py-0 text-[10px] font-semibold text-zinc-500 group-data-[state=active]:bg-[#262626] group-data-[state=active]:text-[#FFC72C] sm:ml-1.5 sm:text-xs"
                        variant="secondary"
                      >
                        {feedDrawerTabBadgeCounts.home}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="props"
                    className="group w-full min-w-0 gap-1 rounded-none px-1 py-1.5 text-xs font-medium text-zinc-500 shadow-none transition-colors not-last:border-r not-last:border-[#333] hover:bg-[#141414] hover:text-zinc-300 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFC72C]/35 focus-visible:ring-offset-0 data-[state=active]:bg-[#141414] data-[state=active]:text-[#FFC72C] data-[state=active]:shadow-none sm:px-2 sm:text-sm"
                  >
                    {drawerProfileMode && isSuperAdmin ? 'Admin' : 'Props'}
                    {(!drawerProfileMode || !isSuperAdmin) && (
                      <Badge className="ml-1 rounded-none border-0 bg-[#1a1a1a] px-1.5 py-0 text-[10px] font-semibold text-zinc-500 group-data-[state=active]:bg-[#262626] group-data-[state=active]:text-[#FFC72C] sm:ml-1.5 sm:text-xs">
                        {feedDrawerTabBadgeCounts.props}
                      </Badge>
                    )}
                  </TabsTrigger>
                  {!drawerProfileMode && (
                    <>
                      <TabsTrigger
                        value="dfs"
                        className="group w-full min-w-0 gap-1 rounded-none px-1 py-1.5 text-xs font-medium text-zinc-500 shadow-none transition-colors not-last:border-r not-last:border-[#333] hover:bg-[#141414] hover:text-zinc-300 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFC72C]/35 focus-visible:ring-offset-0 data-[state=active]:bg-[#141414] data-[state=active]:text-[#FFC72C] data-[state=active]:shadow-none sm:px-2 sm:text-sm"
                      >
                        DFS
                        <Badge
                          className="ml-1 rounded-none border-0 bg-[#1a1a1a] px-1.5 py-0 text-[10px] font-semibold text-zinc-500 group-data-[state=active]:bg-[#262626] group-data-[state=active]:text-[#FFC72C] sm:ml-1.5 sm:text-xs"
                          variant="secondary"
                        >
                          {feedDrawerTabBadgeCounts.dfs}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger
                        value="draft"
                        className="group w-full min-w-0 gap-1 rounded-none px-1 py-1.5 text-xs font-medium text-zinc-500 shadow-none transition-colors hover:bg-[#141414] hover:text-zinc-300 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFC72C]/35 focus-visible:ring-offset-0 data-[state=active]:bg-[#141414] data-[state=active]:text-[#FFC72C] data-[state=active]:shadow-none sm:px-2 sm:text-sm"
                      >
                        Draft
                        <Badge
                          className="ml-1 rounded-none border-0 bg-[#1a1a1a] px-1.5 py-0 text-[10px] font-semibold text-zinc-500 group-data-[state=active]:bg-[#262626] group-data-[state=active]:text-[#FFC72C] sm:ml-1.5 sm:text-xs"
                          variant="secondary"
                        >
                          {feedDrawerTabBadgeCounts.draft}
                        </Badge>
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>
                {user?.email && (
                  <Box
                    sx={{
                      display: { xs: 'none', sm: 'flex' },
                      flex: 1,
                      minWidth: 0,
                      maxWidth: { xs: 'min(42vw, 200px)', sm: 220 },
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      alignSelf: 'stretch',
                      px: 1,
                      borderLeft: '1px solid',
                      borderColor: '#333',
                      bgcolor: '#000000',
                    }}
                  >
                    <Typography
                      level="body-xs"
                      title={user.email}
                      sx={{
                        color: '#a3a3a3',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        textAlign: 'right',
                        lineHeight: 1.2,
                      }}
                    >
                      {user.email}
                    </Typography>
                  </Box>
                )}
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => {
                    if (drawerProfileMode) {
                      setDrawerProfileMode(false);
                    } else {
                      setFeedDrawerTab('home');
                      setDrawerProfileMode(true);
                      setDrawerOpen(true);
                    }
                  }}
                  aria-label={drawerProfileMode ? 'Exit profile hub' : user ? 'Open profile' : 'Open login'}
                  title={drawerProfileMode ? 'Profile' : user ? 'Profile' : 'Login'}
                  sx={{
                    flexShrink: 0,
                    alignSelf: 'stretch',
                    width: 44,
                    minWidth: 44,
                    borderRadius: 0,
                    borderLeft: '1px solid',
                    borderColor: '#333',
                    bgcolor: '#000000',
                    color: '#737373',
                    '&:hover': {
                      bgcolor: '#141414',
                      color: '#FFC72C',
                    },
                  }}
                >
                  <AccountCircleRounded sx={{ fontSize: 22 }} />
                </IconButton>
              </Box>
            </DialogTitle>
            <ModalClose />
            <DialogContent
              sx={{
                gap: 0,
                flex: 1,
                p: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <TabsContent value="home" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden outline-none">
                {drawerProfileMode ? (
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      px: 2,
                      pt: 1,
                      pb: 2,
                    }}
                  >
                    <ProfileHubContent variant="drawer" />
                  </Box>
                ) : (
                  <FeedDrawerTabModulePane
                    tab="home"
                    otherModules={otherModules}
                    isMobile={isMobile}
                    renderModule={renderModule}
                    setDrawerOpen={setDrawerOpen}
                    openDrawerRef={openDrawerToSlipBuilderRef}
                    modulesLoading={visibilityLoading}
                  />
                )}
              </TabsContent>
              <TabsContent value="props" className="mt-0 flex min-h-0 flex-1 flex-col outline-none">
                {drawerProfileMode && isSuperAdmin ? (
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      px: 2,
                      pt: 1,
                      pb: 2,
                    }}
                  >
                    <AdminHubContent variant="drawer" />
                  </Box>
                ) : (
                  <FeedDrawerTabModulePane
                    tab="props"
                    otherModules={otherModules}
                    isMobile={isMobile}
                    renderModule={renderModule}
                    setDrawerOpen={setDrawerOpen}
                    openDrawerRef={openDrawerToSlipBuilderRef}
                    modulesLoading={visibilityLoading}
                  />
                )}
              </TabsContent>
              <TabsContent value="dfs" className="mt-0 flex min-h-0 flex-1 flex-col outline-none">
                <FeedDrawerTabModulePane
                  tab="dfs"
                  otherModules={otherModules}
                  isMobile={isMobile}
                  renderModule={renderModule}
                  setDrawerOpen={setDrawerOpen}
                  openDrawerRef={openDrawerToSlipBuilderRef}
                  modulesLoading={visibilityLoading}
                />
              </TabsContent>
              <TabsContent value="draft" className="mt-0 flex min-h-0 flex-1 flex-col outline-none">
                <FeedDrawerTabModulePane
                  tab="draft"
                  otherModules={otherModules}
                  isMobile={isMobile}
                  renderModule={renderModule}
                  setDrawerOpen={setDrawerOpen}
                  openDrawerRef={openDrawerToSlipBuilderRef}
                  modulesLoading={visibilityLoading}
                />
              </TabsContent>
            </DialogContent>
          </Tabs>
        ) : (
          <>
            <DialogTitle>Home</DialogTitle>
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

            <DialogContent
              sx={{
                gap: 0,
                flex: 1,
                p: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
              }}
            >
              {isMobile ? (
                <DrawerModulesList
                  otherModules={otherModules}
                  renderModule={renderModule}
                  setDrawerOpen={setDrawerOpen}
                  openDrawerRef={openDrawerToSlipBuilderRef}
                  isMobile
                />
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <DrawerModulesList
                    otherModules={otherModules}
                    renderModule={renderModule}
                    setDrawerOpen={setDrawerOpen}
                    openDrawerRef={openDrawerToSlipBuilderRef}
                    isMobile={false}
                  />
                </Box>
              )}
            </DialogContent>
          </>
        )}

      </Sheet>
    </Drawer>
  );

  const headerChipFilters = activeFilters.filter((f) => f.type === 'team' || f.type === 'player')
  const activeFilterChips =
    headerChipFilters.length > 0 && onRemoveFilter ? (
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
        {headerChipFilters.map((f) => (
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

  const selectedDateAsUtcDate = React.useMemo(() => {
    const [year, month, day] = selectedDateYmd.split('-').map((n) => Number(n));
    return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
  }, [selectedDateYmd]);

  const miniCalendar = (
    <MiniCalendar
      className="w-full"
      selectedDate={selectedDateAsUtcDate}
      onSelectDate={(date) => {
        const picked = date.toISOString().slice(0, 10);
        setSiteDate(picked);
        if (isGameRoute) {
          navigate('/');
          return;
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, width: '100%', minWidth: 0 }}>
        <MiniCalendarNavigation asChild direction="prev">
          <IconButton size="sm" variant="outlined" color="neutral" aria-label="Previous day">
            <ArrowBackIosNewRounded sx={{ fontSize: 14 }} />
          </IconButton>
        </MiniCalendarNavigation>
        <MiniCalendarDays className="flex-1 justify-between gap-1 min-w-0">
          {(date) => <MiniCalendarDay className="flex-1 min-w-0 px-1" date={date} key={date.toISOString()} />}
        </MiniCalendarDays>
        <MiniCalendarNavigation asChild direction="next">
          <IconButton size="sm" variant="outlined" color="neutral" aria-label="Next day">
            <ArrowBackIosNewRounded sx={{ fontSize: 14, transform: 'rotate(180deg)' }} />
          </IconButton>
        </MiniCalendarNavigation>
      </Box>
    </MiniCalendar>
  );

  /** Reserve space for vertical scrollbar so cards are not covered (overlay scrollbars). */
  const scrollGutterSx = {
    scrollbarGutter: 'stable' as const,
  }

  const contentBoxSx = flowContent
    ? {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'auto' as const,
        WebkitOverflowScrolling: 'touch' as const,
        overscrollBehaviorY: 'contain' as const,
        width: '100%',
        ...scrollGutterSx,
      }
    : {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'auto' as const,
        WebkitOverflowScrolling: 'touch' as const,
        overscrollBehaviorY: 'contain' as const,
        ...scrollGutterSx,
        ...(hasGameHeader ? { maxHeight: `calc(100vh - ${FEED_HEADER_BAR_HEIGHT}px)`, height: '100%' } : {}),
      };

  // Mobile: fixed header at top; spacer; scrollable content (or flow content)
  if (isMobile) {
    return (
      <SlipBuilderProvider onLegAddedRef={openDrawerToSlipBuilderRef}>
      <FeedDrawerTabProvider value={{ feedDrawerTab, setFeedDrawerTab }}>
      <FeedDrawerRestoreProvider
        setDrawerOpen={setDrawerOpen}
        setDrawerProfileMode={setDrawerProfileMode}
        setFeedDrawerTab={setFeedDrawerTab}
      >
      <Box sx={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: (hasGameHeader || flowContent) ? '100%' : undefined }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexShrink: 1 }}>
            <Button
              variant="plain"
              color="warning"
              onClick={() => navigate('/')}
              sx={{
                flexShrink: 0,
                fontWeight: 800,
                textTransform: 'lowercase',
                letterSpacing: '-0.02em',
                px: 0.75,
                minHeight: 32,
              }}
            >
              geek
            </Button>
            {activeFilterChips}
          </Box>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', flexShrink: 0 }}>
            {miniCalendar}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, ml: 'auto' }}>
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
        </Box>
        <Box sx={{ flexShrink: 0, height: FEED_HEADER_BAR_HEIGHT, minHeight: FEED_HEADER_BAR_HEIGHT }} aria-hidden />
        <Box
          sx={{
            px: 1.5,
            pt: 0.5,
            pb: 0.75,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.body',
            display: { xs: 'flex', sm: 'none' },
            position: 'fixed',
            top: FEED_HEADER_BAR_HEIGHT,
            left: 0,
            right: 0,
            zIndex: 1099,
            justifyContent: 'center',
          }}
        >
          <Box sx={{ width: '100%', minWidth: 0, maxWidth: CONTENT_MAX_WIDTH }}>{miniCalendar}</Box>
        </Box>
        <Box sx={{ flexShrink: 0, height: { xs: 42, sm: 0 }, minHeight: { xs: 42, sm: 0 } }} aria-hidden />
        <Box
          sx={{
            ...contentBoxSx,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            px: { xs: 2, sm: 2, md: 2 },
            // Lets feed grid use @container for column count vs viewport breakpoints.
            containerType: 'inline-size',
          }}
        >
          {children}
        </Box>
        {insetDrawer}
      </Box>
      </FeedDrawerRestoreProvider>
      </FeedDrawerTabProvider>
      </SlipBuilderProvider>
    );
  }

  // Desktop: feed header fixed to top of viewport (app level); no gap so feed doesn’t show above it when scrolling
  return (
    <SlipBuilderProvider onLegAddedRef={openDrawerToSlipBuilderRef}>
    <FeedDrawerTabProvider value={{ feedDrawerTab, setFeedDrawerTab }}>
    <FeedDrawerRestoreProvider
      setDrawerOpen={setDrawerOpen}
      setDrawerProfileMode={setDrawerProfileMode}
      setFeedDrawerTab={setFeedDrawerTab}
    >
    <Box sx={{ width: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', height: (hasGameHeader || flowContent) ? '100%' : undefined }}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          maxWidth: CONTENT_MAX_WIDTH,
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flexShrink: 1 }}>
          <Button
            variant="plain"
            color="warning"
            onClick={() => navigate('/')}
            sx={{
              flexShrink: 0,
              fontWeight: 800,
              textTransform: 'lowercase',
              letterSpacing: '-0.02em',
              px: 0.75,
              minHeight: 32,
            }}
          >
            geek
          </Button>
          {activeFilterChips}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          {miniCalendar}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, ml: 'auto' }}>
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
          ...contentBoxSx,
          maxWidth: CONTENT_MAX_WIDTH,
          mx: 'auto',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          px: { xs: 2, sm: 2, md: 2 },
          containerType: 'inline-size',
        }}
      >
        {children}
      </Box>
      {insetDrawer}
    </Box>
    </FeedDrawerRestoreProvider>
    </FeedDrawerTabProvider>
    </SlipBuilderProvider>
  );
}
