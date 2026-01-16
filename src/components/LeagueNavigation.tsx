import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip
} from '@mui/joy'
import {
  Home,
  Group,
  SportsBasketball,
  Scoreboard,
  SwapHoriz,
  Message,
  Settings,
  Assignment,
  People,
  Sports,
  Leaderboard,
  AdminPanelSettings
} from '@mui/icons-material'
import { useLeague } from '../hooks/useLeagues'
import MatchupsAvatarBar from './MatchupsAvatarBar'

interface FantasyTeam {
  id: string;
  team_name: string;
  primary_color?: string;
  secondary_color?: string;
}

interface Matchup {
  id: string;
  week_number: number;
  status: string;
  fantasy_team1_id: string;
  fantasy_team2_id: string;
  fantasy_team1_score: number;
  fantasy_team2_score: number;
  team1?: FantasyTeam;
  team2?: FantasyTeam;
}

interface LeagueNavigationProps {
  leagueId: string
  isCommissioner: boolean
  children: (activeTab: string) => React.ReactNode
  userHasTeam?: boolean
  defaultTab?: number
  onTabChange?: (tabIndex: number, tabId: string) => void
  showMatchups?: boolean
  matchups?: Matchup[]
  matchupsLoading?: boolean
}

export default function LeagueNavigation({ leagueId, isCommissioner, children, userHasTeam = false, defaultTab = 0, onTabChange, showMatchups = false, matchups = [], matchupsLoading = false }: LeagueNavigationProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [selectedMatchupId, setSelectedMatchupId] = useState<string | null>(null)
  const { data: league } = useLeague(leagueId)
  
  // Get draft status from league data
  const leagueData = league?.league || league
  const draftStatus = leagueData?.draft_status
  const isDraftActive = draftStatus === 'in_progress' || draftStatus === 'active'
  
  // Debug logging for navigation props
  console.log('LeagueNavigation: Props debug:', {
    leagueId,
    isCommissioner,
    userHasTeam,
    defaultTab,
    draftStatus,
    isDraftActive
  });

  const tabs = [
    {
      id: 'home',
      label: 'League',
      icon: <Home />,
      description: 'League overview, standings, and matchups'
    },
    ...(userHasTeam ? [{
      id: 'my-team',
      label: 'My Team',
      icon: <Group />,
      description: 'Your roster, lineups, and transactions'
    }] : []),
    {
      id: 'players',
      label: 'Free Agents',
      icon: <SportsBasketball />,
      description: 'Player database and available free agents'
    },
    {
      id: 'draft',
      label: 'Draft',
      icon: <Assignment />,
      description: 'Draft room and results'
    },
    {
      id: 'settings',
      label: 'Rules',
      icon: <Settings />,
      description: 'League settings and scoring rules'
    },
    ...(isCommissioner ? [
      {
        id: 'commissioner',
        label: 'Commissioner',
        icon: <AdminPanelSettings />,
        description: 'League manager tools and administration',
        desktopOnly: true
      }
    ] : [])
  ]
  
  // Debug logging for tabs
  console.log('LeagueNavigation: Generated tabs:', {
    totalTabs: tabs.length,
    tabIds: tabs.map(t => t.id),
    commissionerTabs: tabs.filter(t => t.id === 'settings' || t.id === 'commissioner'),
    isCommissioner
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
    if (onTabChange) {
      const tab = tabs[newValue]
      onTabChange(newValue, tab.id)
    }
  }
  
  // Expose method to programmatically change tab
  React.useEffect(() => {
    // Listen for custom events to change tabs
    const handleChangeTab = (e: CustomEvent) => {
      const tabId = e.detail.tabId
      const tabIndex = tabs.findIndex(t => t.id === tabId)
      if (tabIndex !== -1) {
        setActiveTab(tabIndex)
      }
    }
    
    window.addEventListener('changeLeagueTab' as any, handleChangeTab as any)
    return () => {
      window.removeEventListener('changeLeagueTab' as any, handleChangeTab as any)
    }
  }, [tabs])

  // Handle matchup click
  const handleMatchupClick = (matchupId: string) => {
    if (selectedMatchupId === matchupId) {
      setSelectedMatchupId(null);
    } else {
      setSelectedMatchupId(matchupId);
    }
  };

  return (
    <Box sx={{ 
      width: '100%',
      bgcolor: 'background.body',
      minHeight: '100vh',
    }}>
      {/* Matchups Avatar Bar - Only show if showMatchups is true */}
      {showMatchups && (
        <MatchupsAvatarBar 
          matchups={matchups} 
          isLoading={matchupsLoading}
          selectedMatchupId={selectedMatchupId}
          onMatchupClick={handleMatchupClick}
        />
      )}

      {/* Content Container with proper spacing */}
      <Box sx={{
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        minWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        pt: { xs: showMatchups ? '117px' : '49px', md: showMatchups ? '132px' : '69px' }, // Desktop adjusted for 1.5x taller nav bar
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Navigation Tabs - Sticky within content container */}
        <Box sx={{ 
          position: 'sticky',
          top: { xs: '49px', md: '63px' }, // Adjusted for 1.5x taller desktop nav bar
          zIndex: 1000,
          bgcolor: 'background.body',
          borderBottom: '3px solid',
          borderColor: 'divider',
          mb: 0,
          boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.1)', md: 'none' },
          mx: { xs: 0, sm: 0, md: 0 }, // Full width within container
        }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            '--Tabs-gap': '0px',
            '--TabList-radius': '0px',
            '--TabList-gap': '0px',
            '--Tab-radius': '0px',
            '--Tab-minHeight': '48px',
            '--Tab-paddingX': '16px',
            '--Tab-paddingY': '8px',
            '--TabList-justifyContent': 'flex-start',
            '--TabList-overflow': 'auto',
            '--TabList-scrollbarWidth': 'none',
            '& .MuiTabList-root': {
              overflow: 'auto',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': {
                display: 'none'
              }
            }
          }}
        >
          <TabList
            variant="plain"
            size="md"
            sx={{
              '--TabList-gap': '0px',
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              overflow: 'visible',
              '& .MuiTabList-root': {
                width: '100%',
              }
            }}
          >
            {tabs.map((tab, index) => {
              const isDraftTab = tab.id === 'draft'
              const isActive = isDraftTab && isDraftActive
              const desktopOnly = (tab as any).desktopOnly
              
              return (
                <Tab
                  key={tab.id}
                  value={index}
                  sx={{
                    minWidth: 'auto',
                    flex: 1, // Make tabs evenly spaced
                    px: 2,
                    py: 1,
                    // Hide on mobile if desktopOnly
                    ...(desktopOnly && {
                      display: { xs: 'none', md: 'flex' }
                    }),
                    // Draft active styling
                    ...(isActive && {
                      bgcolor: 'success.softBg',
                      color: 'success.softColor',
                      '&:hover': {
                        bgcolor: 'success.100'
                      }
                    }),
                    // Selected tab styling
                    '&.Mui-selected': {
                      bgcolor: isActive ? 'success.softBg' : 'primary.softBg',
                      color: isActive ? 'success.softColor' : 'primary.softColor',
                      borderBottom: '2px solid',
                      borderColor: isActive ? 'success.500' : 'primary.500'
                    },
                    // Hover styling
                    ...(!isActive && {
                      '&:hover': {
                        bgcolor: 'primary.50'
                      }
                    })
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    {tab.icon}
                    <Typography level="body-sm" fontWeight="md">
                      {tab.label}
                    </Typography>
                    {isActive && (
                      <Chip size="sm" color="success" variant="solid">
                        Live
                      </Chip>
                    )}
                  </Stack>
                </Tab>
              )
            })}
          </TabList>

          {/* Tab Content - TabPanels must be direct children of Tabs */}
          {tabs.map((tab, index) => (
            <TabPanel key={tab.id} value={index} sx={{ p: 0 }}>
              <Box sx={{ mt: 3 }}>
                {children(tab.id)}
              </Box>
            </TabPanel>
          ))}
        </Tabs>
        </Box>
      </Box>
    </Box>
  )
}
