import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Sheet,
  Typography,
  Button,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  ListItemDecorator,
  ListDivider,
  Chip,
  Input,
  Badge,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  CircularProgress,
  Avatar
} from '@mui/joy'
import {
  Home,
  SportsBasketball,
  PlayArrow,
  Analytics,
  TrendingUp,
  EmojiEvents,
  People,
  Settings,
  Search,
  Notifications,
  Menu as MenuIcon,
  Close,
  VideoLibrary,
  Assessment,
  Timeline,
  Psychology,
  MonetizationOn,
  Forum,
  Star,
  Schedule,
  Group
} from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import { usePlayerSearch, PlayerSearchResult } from '../hooks/usePlayerSearch'

interface NavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  description?: string
  badge?: string
  children?: NavigationItem[]
}

export default function TopNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Player search
  const { data: searchResults, isLoading: searchLoading } = usePlayerSearch(searchQuery)

  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home />,
      path: '/',
      description: 'Latest NBA news and analysis'
    },
    {
      id: 'dfs',
      label: 'DFS',
      icon: <MonetizationOn />,
      path: '/dfs',
      description: 'Daily Fantasy Sports'
    },
    {
      id: 'highlights',
      label: 'Highlights',
      icon: <VideoLibrary />,
      path: '/highlights',
      description: 'Daily game highlights with advanced stats'
    },
    {
      id: 'fantasy',
      label: 'Fantasy',
      icon: <SportsBasketball />,
      path: '/fantasy',
      description: 'Fantasy basketball leagues',
      children: [
        { id: 'dashboard', label: 'My Leagues', icon: <Group />, path: '/dashboard' },
        { id: 'create-league', label: 'Create League', icon: <EmojiEvents />, path: '/create-league' },
        { id: 'players', label: 'Player Database', icon: <People />, path: '/players' }
      ]
    },
    {
      id: 'betting',
      label: 'Betting',
      icon: <TrendingUp />,
      path: '/betting',
      description: 'Live betting odds and lines'
    }
  ]

  const handleSignOut = async () => {
    await signOut()
  }

  const handleSignIn = () => {
    navigate('/login')
  }

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const renderNavigationItem = (item: NavigationItem, isMobile = false) => {
    const isActive = isActivePath(item.path)
    
    if (item.children) {
      return (
        <Box key={item.id}>
          <Button
            variant={isActive ? 'solid' : 'plain'}
            color={isActive ? 'primary' : 'neutral'}
            startDecorator={item.icon}
            endDecorator={item.badge ? <Chip size="sm" color="danger" variant="soft">{item.badge}</Chip> : undefined}
            onClick={() => navigate(item.path)}
            sx={{
              color: isMobile ? 'inherit' : undefined,
              justifyContent: isMobile ? 'flex-start' : 'center',
              minWidth: isMobile ? 'auto' : '120px',
              px: isMobile ? 2 : 1,
              py: isMobile ? 1.5 : 1
            }}
          >
            {item.label}
          </Button>
        </Box>
      )
    }

    return (
      <Button
        key={item.id}
        variant={isActive ? 'solid' : 'plain'}
        color={isActive ? 'primary' : 'neutral'}
        startDecorator={item.icon}
        endDecorator={item.badge ? <Chip size="sm" color="danger" variant="soft">{item.badge}</Chip> : undefined}
        onClick={() => navigate(item.path)}
        sx={{
          color: isMobile ? 'inherit' : undefined,
          justifyContent: isMobile ? 'flex-start' : 'center',
          minWidth: isMobile ? 'auto' : '120px',
          px: isMobile ? 2 : 1,
          py: isMobile ? 1.5 : 1
        }}
      >
        {item.label}
      </Button>
    )
  }

  return (
    <Sheet 
      variant="solid" 
      color="primary" 
      sx={{ 
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        borderBottom: '1px solid',
        borderColor: 'primary.300',
        overflowX: 'hidden'
      }}
    >
      {/* Main Navigation Bar */}
      <Box sx={{ 
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1400px',
        mx: 'auto',
        width: '100%',
        gap: 2
      }}>
        {/* Logo and Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Typography 
            level="h3" 
            sx={{ 
              cursor: 'pointer',
              fontWeight: 'bold',
              background: 'linear-gradient(45deg, #FFD700, #FFA500)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }} 
            onClick={() => navigate('/')}
          >
            🏀 HoopGeek
          </Typography>
        </Box>

        {/* Desktop Navigation */}
        <Box sx={{ 
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 1,
          flex: 1,
          justifyContent: 'center',
          minWidth: 0,
          overflow: 'hidden'
        }}>
          {navigationItems.map(item => renderNavigationItem(item))}
        </Box>

        {/* Search and User Actions */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {/* Search */}
          <IconButton
            variant="plain"
            color="neutral"
            onClick={() => setSearchOpen(!searchOpen)}
            sx={{ color: 'inherit' }}
          >
            <Search />
          </IconButton>

          {/* Mobile Menu Button */}
          <IconButton
            variant="plain"
            color="neutral"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            sx={{ 
              color: 'inherit',
              display: { xs: 'flex', md: 'none' }
            }}
          >
            {mobileMenuOpen ? <Close /> : <MenuIcon />}
          </IconButton>

          {/* User Actions */}
          {user ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Button 
                variant="plain" 
                size="sm"
                onClick={() => navigate('/settings')}
                sx={{ 
                  color: 'inherit', 
                  display: { xs: 'none', lg: 'flex' },
                  '&:hover': {
                    textDecoration: 'underline'
                  },
                  whiteSpace: 'nowrap'
                }}
              >
                {user.email}
              </Button>
              <Button 
                variant="soft" 
                size="sm" 
                onClick={handleSignOut}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Sign Out
              </Button>
            </Stack>
          ) : (
            <Button 
              variant="solid" 
              size="sm"
              onClick={handleSignIn}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              Sign In
            </Button>
          )}
        </Stack>
      </Box>

      {/* Search Bar */}
      {searchOpen && (
        <Box sx={{ 
          p: 2, 
          borderTop: '1px solid',
          borderColor: 'primary.300',
          bgcolor: 'primary.600'
        }}>
          <Box sx={{ 
            maxWidth: '600px', 
            mx: 'auto', 
            position: 'relative'
          }}>
            <Input
              placeholder="Search players by name... (e.g., LeBron James, Steph Curry)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults && searchResults.length > 0) {
                  // Navigate to first result on Enter
                  navigate(`/player/${searchResults[0].id}`)
                  setSearchOpen(false)
                  setSearchQuery('')
                }
              }}
              startDecorator={<Search />}
              endDecorator={
                <IconButton
                  variant="plain"
                  size="sm"
                  onClick={() => {
                    setSearchOpen(false)
                    setSearchQuery('')
                  }}
                >
                  <Close />
                </IconButton>
              }
              autoFocus
              sx={{ 
                bgcolor: 'background.surface',
                '--Input-focusedThickness': '2px'
              }}
            />
            
            {/* Search Results - Floating Dropdown */}
            {searchQuery.length >= 2 && (
              <Box sx={{
                position: 'fixed',
                top: '140px', // Adjust based on navbar height
                left: '50%',
                transform: 'translateX(-50%)',
                width: '600px',
                maxWidth: 'calc(100vw - 32px)',
                maxHeight: '400px',
                overflowY: 'auto',
                bgcolor: 'background.surface',
                borderRadius: 'sm',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                border: '1px solid',
                borderColor: 'neutral.300',
                zIndex: 9999
              }}>
                {searchLoading ? (
                  <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size="sm" />
                    <Typography level="body-sm">Searching players...</Typography>
                  </Box>
                ) : searchResults && searchResults.length > 0 ? (
                  <List sx={{ p: 0 }}>
                    {searchResults.map((player: PlayerSearchResult) => (
                      <ListItem key={player.id} sx={{ p: 0 }}>
                        <ListItemButton
                          onClick={() => {
                            navigate(`/player/${player.id}`)
                            setSearchOpen(false)
                            setSearchQuery('')
                          }}
                          sx={{
                            p: 2,
                            '&:hover': {
                              bgcolor: 'primary.50'
                            }
                          }}
                        >
                          <ListItemDecorator>
                            <Avatar
                              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                              alt={player.name}
                              size="sm"
                            />
                          </ListItemDecorator>
                          <ListItemContent>
                            <Typography level="title-sm" sx={{ fontWeight: 'bold' }}>
                              {player.name}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {player.team_name || 'Free Agent'} • {player.position || 'N/A'}
                            </Typography>
                          </ListItemContent>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ p: 3 }}>
                    <Typography level="body-sm" color="neutral">
                      No players found matching "{searchQuery}"
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
            {searchQuery.length === 1 && (
              <Box sx={{
                position: 'fixed',
                top: '140px', // Adjust based on navbar height
                left: '50%',
                transform: 'translateX(-50%)',
                width: '600px',
                maxWidth: 'calc(100vw - 32px)',
                bgcolor: 'background.surface',
                borderRadius: 'sm',
                p: 2,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                border: '1px solid',
                borderColor: 'neutral.300',
                zIndex: 9999
              }}>
                <Typography level="body-sm" color="neutral">
                  💡 Type at least 2 characters to start searching...
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <Box sx={{ 
          p: 2, 
          borderTop: '1px solid',
          borderColor: 'primary.300',
          bgcolor: 'primary.600'
        }}>
          <Stack spacing={1}>
            {navigationItems.map(item => (
              <Box key={item.id}>
                {renderNavigationItem(item, true)}
                {item.children && (
                  <Box sx={{ ml: 4, mt: 1 }}>
                    <Stack spacing={0.5}>
                      {item.children.map(child => (
                        <Button
                          key={child.id}
                          variant="plain"
                          color="neutral"
                          startDecorator={child.icon}
                          onClick={() => {
                            navigate(child.path)
                            setMobileMenuOpen(false)
                          }}
                          sx={{
                            justifyContent: 'flex-start',
                            color: 'inherit',
                            px: 2,
                            py: 1
                          }}
                        >
                          {child.label}
                        </Button>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            ))}
            {!user && (
              <>
                <ListDivider />
                <Button 
                  variant="solid" 
                  onClick={handleSignIn}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  Sign In
                </Button>
              </>
            )}
          </Stack>
        </Box>
      )}
    </Sheet>
  )
}
