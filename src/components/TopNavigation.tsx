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
  Badge
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

  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home />,
      path: '/',
      description: 'Latest highlights and news'
    },
    {
      id: 'highlights',
      label: 'Highlights',
      icon: <VideoLibrary />,
      path: '/highlights',
      description: 'Daily game highlights with advanced stats',
      badge: 'New'
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
      id: 'analysis',
      label: 'Analysis',
      icon: <Analytics />,
      path: '/analysis',
      description: 'Advanced basketball analytics',
      children: [
        { id: 'stats', label: 'Player Stats', icon: <Assessment />, path: '/analysis/stats' },
        { id: 'trends', label: 'Trends', icon: <TrendingUp />, path: '/analysis/trends' },
        { id: 'predictions', label: 'Predictions', icon: <Psychology />, path: '/analysis/predictions' }
      ]
    },
    {
      id: 'betting',
      label: 'Betting',
      icon: <MonetizationOn />,
      path: '/betting',
      description: 'Betting insights and odds',
      badge: 'Coming Soon'
    },
    {
      id: 'community',
      label: 'Community',
      icon: <Forum />,
      path: '/community',
      description: 'Discussions and debates'
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
        borderColor: 'primary.300'
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
        width: '100%'
      }}>
        {/* Logo and Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
          <Chip 
            size="sm" 
            variant="soft" 
            color="warning"
            sx={{ 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Basketball Mecca
          </Chip>
        </Box>

        {/* Desktop Navigation */}
        <Box sx={{ 
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 1
        }}>
          {navigationItems.map(item => renderNavigationItem(item))}
        </Box>

        {/* Search and User Actions */}
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Search */}
          <IconButton
            variant="plain"
            color="neutral"
            onClick={() => setSearchOpen(!searchOpen)}
            sx={{ color: 'inherit' }}
          >
            <Search />
          </IconButton>

          {/* Notifications */}
          {user && (
            <IconButton
              variant="plain"
              color="neutral"
              sx={{ color: 'inherit' }}
            >
              <Badge badgeContent={3} color="danger" size="sm">
                <Notifications />
              </Badge>
            </IconButton>
          )}

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
              <Typography level="body-sm" sx={{ color: 'inherit', display: { xs: 'none', sm: 'block' } }}>
                {user.email}
              </Typography>
              <Button variant="soft" size="sm" onClick={handleSignOut}>
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
          <Input
            placeholder="Search players, teams, highlights..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startDecorator={<Search />}
            endDecorator={
              <IconButton
                variant="plain"
                size="sm"
                onClick={() => setSearchOpen(false)}
              >
                <Close />
              </IconButton>
            }
            sx={{ maxWidth: '600px', mx: 'auto' }}
          />
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
