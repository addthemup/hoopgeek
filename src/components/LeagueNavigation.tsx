import { useState } from 'react'
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
  TrendingUp,
  Scoreboard,
  SwapHoriz,
  Message,
  Settings,
  EmojiEvents,
  Analytics,
  Assignment,
  People,
  Sports,
  Leaderboard,
  AdminPanelSettings
} from '@mui/icons-material'

interface LeagueNavigationProps {
  leagueId: string
  isCommissioner: boolean
  children: (activeTab: string) => React.ReactNode
  userHasTeam?: boolean
}

export default function LeagueNavigation({ leagueId, isCommissioner, children, userHasTeam = false }: LeagueNavigationProps) {
  const [activeTab, setActiveTab] = useState(0)

  const tabs = [
    {
      id: 'home',
      label: 'League',
      icon: <Home />,
      description: 'League overview and standings'
    },
    ...(userHasTeam ? [{
      id: 'my-team',
      label: 'My Team',
      icon: <Group />,
      description: 'Your roster and lineup'
    }] : []),
    {
      id: 'lineups',
      label: 'Lineups',
      icon: <Sports />,
      description: 'NBA 2K-style rotation management'
    },
    {
      id: 'trades',
      label: 'Trades',
      icon: <SwapHoriz />,
      description: 'Trade machine and proposals'
    },
    {
      id: 'players',
      label: 'Players',
      icon: <SportsBasketball />,
      description: 'Player database and stats'
    },
    {
      id: 'matchups',
      label: 'Matchups',
      icon: <TrendingUp />,
      description: 'Weekly matchups and scores'
    },
    {
      id: 'scoreboard',
      label: 'Scoreboard',
      icon: <Scoreboard />,
      description: 'Live scores and results'
    },
    {
      id: 'draft',
      label: 'Draft',
      icon: <Assignment />,
      description: 'Draft room and results'
    },
    {
      id: 'standings',
      label: 'Standings',
      icon: <Leaderboard />,
      description: 'League standings and rankings'
    },
    {
      id: 'research',
      label: 'Research',
      icon: <Analytics />,
      description: 'Advanced stats and analysis'
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <Message />,
      description: 'League activity and messages'
    },
            {
              id: 'members',
              label: 'Members',
              icon: <People />,
              description: 'League members and teams'
            },
            ...(isCommissioner ? [
              {
                id: 'settings',
                label: 'Rules',
                icon: <Settings />,
                description: 'League settings and management'
              },
              {
                id: 'commissioner',
                label: 'Commissioner',
                icon: <AdminPanelSettings />,
                description: 'League manager tools and administration'
              }
            ] : [])
  ]

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  return (
    <Box sx={{ width: '100%' }}>

      {/* Navigation Tabs */}
      <Box sx={{ 
        borderBottom: '1px solid',
        borderColor: 'divider',
        mb: 3
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
            {tabs.map((tab, index) => (
              <Tab
                key={tab.id}
                value={index}
                sx={{
                  minWidth: 'auto',
                  px: 2,
                  py: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.softBg',
                    color: 'primary.softColor',
                    borderBottom: '2px solid',
                    borderColor: 'primary.500'
                  },
                  '&:hover': {
                    bgcolor: 'primary.50'
                  }
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  {tab.icon}
                  <Typography level="body-sm" fontWeight="md">
                    {tab.label}
                  </Typography>
                </Stack>
              </Tab>
            ))}
          </TabList>

          {/* Tab Content - TabPanels must be direct children of Tabs */}
          {tabs.map((tab, index) => (
            <TabPanel key={tab.id} value={index} sx={{ p: 0 }}>
              {children(tab.id)}
            </TabPanel>
          ))}
        </Tabs>
      </Box>
    </Box>
  )
}
