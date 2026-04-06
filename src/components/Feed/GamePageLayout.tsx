/**
 * Game page layout using the same MUI Joy inset drawer pattern as /feed/ and player page.
 *
 * Main area: game header + game feed posts. A button top-right opens an
 * inset drawer containing all game modules (basic stats, advanced stats,
 * team comparison, props, hit rates). Which modules appear in the drawer
 * is controlled by /admin?view=game (Game Page Modules).
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import {
  Box,
  Button,
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
import { HiOutlineHome } from 'react-icons/hi';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Logout from '@mui/icons-material/Logout';
import Google from '@mui/icons-material/Google';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import { useNavigate } from 'react-router-dom';
import PlayerTeamSearchBar from '../PlayerTeamSearchBar';
import { useAuth } from '../../hooks/useAuth';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { supabase } from '../../utils/supabase';
import {
  useGameModuleVisibility,
  DEFAULT_GAME_MODULES,
  GAME_MODULE_DEFINITIONS,
} from '../../hooks/useGameModuleVisibility';
import { useSetGameDrawerContent } from '../../contexts/FeedLayoutContext';
import { CONTENT_MAX_WIDTH, INSET_DRAWER_CONTENT_SX } from '../../constants/layout';

const FEED_HEADER_BAR_HEIGHT = 52;

/** When header is hidden (embedded in feed), children can open the game drawer via this context. */
export const GameDrawerContext = createContext<{ openDrawer: () => void } | null>(null);

export function useGameDrawer() {
  const ctx = useContext(GameDrawerContext);
  return ctx;
}

export interface GameDrawerModule {
  name: string;
  content: React.ReactNode;
}

interface GamePageLayoutProps {
  children: React.ReactNode;
  drawerModules?: GameDrawerModule[];
  /** When true (e.g. game embedded in feed), do not render the top bar; parent provides it. */
  hideHeader?: boolean;
  /** When true with hideHeader, game modules render in the feed drawer instead of a local drawer. */
  injectDrawerIntoFeed?: boolean;
  drawerHeaderContent?: React.ReactNode;
}

const MODULE_LABELS: Record<string, string> = {
  stats: 'Stats',
  team_comparison: 'Team Comparison',
  props: 'Props',
  hit_rates: 'Hit Rates',
};

export default function GamePageLayout({
  children,
  drawerModules = [],
  hideHeader = false,
  injectDrawerIntoFeed = false,
  drawerHeaderContent = null,
}: GamePageLayoutProps) {
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
      if (error) setGoogleError(error.message);
    } catch (err: unknown) {
      setGoogleError(err instanceof Error ? err.message : 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const { data: moduleVisibility } = useGameModuleVisibility();
  const effectiveVisibility = moduleVisibility ?? DEFAULT_GAME_MODULES;

  const visibleModuleNames = Object.entries(effectiveVisibility)
    .filter(([, config]) => config.is_visible)
    .sort((a, b) => a[1].display_order - b[1].display_order)
    .map(([name]) => name);

  const modulesToRender = visibleModuleNames
    .map((name) => drawerModules.find((m) => m.name === name))
    .filter(Boolean) as GameDrawerModule[];

  const drawerContextValue = React.useMemo(() => ({ openDrawer: () => setDrawerOpen(true) }), []);

  const renderGameDrawerContent = useCallback(() => {
    return (
      <>
        {drawerHeaderContent && (
          <Box sx={{ pb: 2, mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            {drawerHeaderContent}
          </Box>
        )}
        {modulesToRender.map(({ name, content }, index) => {
          const label = MODULE_LABELS[name] ?? name.replace(/_/g, ' ');
          return (
            <Box
              key={name}
              sx={{
                pt: index === 0 ? 0 : 3,
                pb: 2,
                borderBottom:
                  index < modulesToRender.length - 1 ? '1px solid' : undefined,
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <Typography
                level="title-sm"
                sx={{ fontWeight: 'bold', mb: 1.5, color: 'text.primary', flexShrink: 0 }}
              >
                {label}
              </Typography>
              <Box
                sx={{
                  overflowX: 'auto',
                  overflowY: 'auto',
                  minWidth: 0,
                  minHeight: 120,
                  '& table': { minWidth: 'max-content' },
                }}
              >
                {content}
              </Box>
            </Box>
          );
        })}
        {modulesToRender.length === 0 && (
          <Typography level="body-sm" sx={{ color: '#888', py: 4, textAlign: 'center' }}>
            No modules enabled
          </Typography>
        )}
      </>
    );
  }, [modulesToRender, drawerHeaderContent]);

  useSetGameDrawerContent(null);

  /** Parent (FeedModulesGrid + Highlights) owns scrolling; avoid 100vh + flex:1 or the game block eats the viewport and leaves a white gap above the feed. */
  if (hideHeader) {
    return (
      <GameDrawerContext.Provider value={drawerContextValue}>
        <Box sx={{ width: '100%', minWidth: 0 }}>{children}</Box>
      </GameDrawerContext.Provider>
    );
  }

  const insetDrawer = null;

  if (isMobile) {
    return (
      <GameDrawerContext.Provider value={drawerContextValue}>
      <Box
        sx={{
          width: '100%',
          flex: 1,
          height: '100vh',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!hideHeader && (
          <>
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 950,
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
              <Button
                variant="plain"
                color="warning"
                onClick={() => navigate('/feed')}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, ml: 'auto' }}>
                <PlayerTeamSearchBar
                  compact
                  maxWidth={280}
                  sx={{ width: 280, minWidth: 0, flexShrink: 0 }}
                />
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
          </>
        )}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
            bgcolor: '#ffffff',
          }}
        >
          {children}
        </Box>
        {insetDrawer}
      </Box>
      </GameDrawerContext.Provider>
    );
  }

  return (
    <GameDrawerContext.Provider value={drawerContextValue}>
    <Box
      sx={{
        width: '100%',
        height: '100vh',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {!hideHeader && (
        <>
          {/* Outer: full-width fixed strip (no bg). Inner: constrained bar so width never shifts. */}
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 950,
              display: 'flex',
              justifyContent: 'center',
              minHeight: FEED_HEADER_BAR_HEIGHT,
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: CONTENT_MAX_WIDTH,
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
              <Button
                variant="plain"
                color="warning"
                onClick={() => navigate('/feed')}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, ml: 'auto' }}>
                <PlayerTeamSearchBar
                  compact
                  maxWidth={360}
                  sx={{ width: 360, minWidth: 0, flexShrink: 0 }}
                />
              </Box>
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
        </>
      )}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          bgcolor: '#ffffff',
        }}
      >
        <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', width: '100%' }}>
          {children}
        </Box>
      </Box>
      {insetDrawer}
    </Box>
    </GameDrawerContext.Provider>
  );
}
