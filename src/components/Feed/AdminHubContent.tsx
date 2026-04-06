/**
 * Super-admin hub inside the profile drawer: tabbed admin UIs (same as /admin?view=…),
 * embedded like profile module tabs.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Tab, TabList, TabPanel, Tabs, Typography } from '@mui/joy';
import { useMediaQuery } from '@mui/material';
import {
  type LucideIcon,
  Home,
  FilePlus,
  DollarSign,
  BarChart3,
  LayoutDashboard,
  User,
  Users,
  GraduationCap,
  Volleyball,
  Gamepad2,
} from 'lucide-react';
import { AdminViewBody, type AdminView } from '../Admin/AdminViewBody';

export type AdminHubVariant = 'drawer' | 'page';

type AdminHubTabDef =
  | {
      id: 'home';
      label: string;
      icon: LucideIcon;
      kind: 'feed';
    }
  | {
      id: string;
      label: string;
      icon: LucideIcon;
      kind: 'admin';
      view: AdminView;
    };

const ADMIN_HUB_TABS: AdminHubTabDef[] = [
  { id: 'home', label: 'Home', icon: Home, kind: 'feed' },
  { id: 'create-post', label: 'Create post', icon: FilePlus, kind: 'admin', view: 'create-post' },
  { id: 'dfs', label: 'Create pool', icon: DollarSign, kind: 'admin', view: 'dfs' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, kind: 'admin', view: 'analytics' },
  { id: 'ui', label: 'Feed UI', icon: LayoutDashboard, kind: 'admin', view: 'ui' },
  { id: 'profile', label: 'Profile UI', icon: User, kind: 'admin', view: 'profile' },
  { id: 'player', label: 'Player UI', icon: User, kind: 'admin', view: 'player' },
  { id: 'team', label: 'Team UI', icon: Users, kind: 'admin', view: 'team' },
  { id: 'prospects', label: 'Prospects UI', icon: GraduationCap, kind: 'admin', view: 'prospects' },
  { id: 'draft', label: 'Draft UI', icon: Volleyball, kind: 'admin', view: 'draft' },
  { id: 'mock-draft', label: 'Mock draft', icon: Volleyball, kind: 'admin', view: 'mock-draft' },
  { id: 'game', label: 'Game UI', icon: Gamepad2, kind: 'admin', view: 'game' },
];

function FeedHomeInDrawer() {
  const navigate = useNavigate();
  return (
    <Box>
      <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
        Leave the drawer and open the main feed (drawer opens when you land).
      </Typography>
      <Button
        variant="solid"
        color="primary"
        onClick={() => navigate('/feed', { state: { openDrawer: true } })}
        sx={{ fontWeight: 600 }}
      >
        Go to feed
      </Button>
    </Box>
  );
}

export interface AdminHubContentProps {
  variant: AdminHubVariant;
}

export default function AdminHubContent({ variant }: AdminHubContentProps) {
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isDrawer = variant === 'drawer';

  const [activeTab, setActiveTab] = useState<string>(ADMIN_HUB_TABS[0]?.id ?? '');

  useEffect(() => {
    if (!ADMIN_HUB_TABS.some((t) => t.id === activeTab)) {
      setActiveTab(ADMIN_HUB_TABS[0]?.id ?? '');
    }
  }, [activeTab]);

  const px = isDrawer ? 0 : { xs: 2, sm: 3 };

  const tabListSx = useMemo(
    () => ({
      '--List-gap': '0.375rem',
      p: 0.5,
      mb: 1.5,
      overflowX: 'auto' as const,
      borderRadius: 'md',
      bgcolor: 'background.level1',
    }),
    []
  );

  /** Drawer: fill space below tab strip; scroll inside. Page: capped height for readability. */
  const panelScrollSx = isDrawer
    ? {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto' as const,
        overflowX: 'hidden' as const,
        pr: 0.5,
      }
    : {
        maxHeight: 'min(62vh, 760px)',
        overflowY: 'auto' as const,
        overflowX: 'hidden' as const,
        pr: 0.5,
      };

  return (
    <Box
      sx={{
        px,
        pt: isDrawer ? 0 : 3,
        pb: 2,
        ...(isDrawer
          ? {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              alignSelf: 'stretch',
            }
          : {}),
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(String(v ?? ''))}
        sx={
          isDrawer
            ? {
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }
            : undefined
        }
      >
        <TabList sx={{ ...tabListSx, flexShrink: 0 }} aria-label="Admin tools">
          {ADMIN_HUB_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <Tab
                key={tab.id}
                value={tab.id}
                sx={{
                  whiteSpace: 'nowrap',
                  borderRadius: 'sm',
                  fontSize: 'sm',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? 0 : 0.75,
                  minWidth: isMobile ? 42 : undefined,
                }}
              >
                <Icon size={16} />
                {!isMobile && tab.label}
              </Tab>
            );
          })}
        </TabList>

        {ADMIN_HUB_TABS.map((tab) => (
          <TabPanel
            key={tab.id}
            value={tab.id}
            sx={{
              p: 0,
              ...(isDrawer
                ? {
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }
                : {}),
            }}
          >
            {activeTab === tab.id && (
              <Box sx={panelScrollSx}>
                {tab.kind === 'feed' ? (
                  <FeedHomeInDrawer />
                ) : (
                  <AdminViewBody view={tab.view} embedded />
                )}
              </Box>
            )}
          </TabPanel>
        ))}
      </Tabs>
    </Box>
  );
}
