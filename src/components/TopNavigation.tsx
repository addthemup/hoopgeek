import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Typography,
  Button,
  Stack,
  IconButton,
  Input,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  CircularProgress,
  Avatar,
  Divider
} from '@mui/joy'
import {
  Home,
  SportsBasketball,
  Search,
  Menu as MenuIcon,
  Close,
  Schedule,
  Settings,
  Logout
} from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import { usePlayerSearch, PlayerSearchResult } from '../hooks/usePlayerSearch'
import { useUserProfile } from '../hooks/useUserSettings'

interface NavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  description?: string
}

export default function TopNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchDropdownRef = useRef<HTMLDivElement>(null)
  
  const { data: searchResults, isLoading: searchLoading } = usePlayerSearch(searchQuery)
  const { data: userProfile } = useUserProfile(user?.id)
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    
    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [searchOpen])
  
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home />,
      path: '/',
    },
    {
      id: 'today',
      label: 'Today',
      icon: <Schedule />,
      path: '/today',
    },
    {
      id: 'fantasy',
      label: 'Fantasy',
      icon: <SportsBasketball />,
      path: '/fantasy',
    }
  ]

  const handleSignOut = async () => {
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
    await signOut()
  }

  const handleSignIn = () => {
    navigate('/login')
    setMobileMenuOpen(false)
  }

  const handleSettingsClick = () => {
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
    navigate('/settings')
  }
  
  const handleNavigation = (path: string) => {
    navigate(path)
    setMobileMenuOpen(false)
  }

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Modern Navigation Bar - Glassmorphic with backdrop blur */}
      <Box
        component={motion.nav}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: 'rgba(10, 10, 13, 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(232, 230, 224, 0.1)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
        }}
      >
        <Box sx={{ 
          maxWidth: '1400px', 
          mx: 'auto',
          px: { xs: 2, md: 3 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1
        }}>
          {/* Logo */}
          <Box 
            onClick={() => handleNavigation('/')}
            sx={{ 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              minWidth: '160px'
            }}
          >
            <Typography 
              sx={{ 
                fontSize: { xs: '1.25rem', md: '1.5rem' },
                fontWeight: 800,
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              🏀 HoopGeek
            </Typography>
          </Box>

          {/* Desktop Navigation */}
          <Box 
            sx={{ 
              display: { xs: 'none', md: 'flex' },
              flex: 1,
              justifyContent: 'space-between',
              alignItems: 'center',
              mx: 0,
              minWidth: 0,
              px: 0,
              ml: 3,
              mr: '5px'
            }}
          >
            {navigationItems.map((item) => {
              const isActive = isActivePath(item.path)
              return (
                <Button
                  key={item.id}
                  variant="plain"
                  onClick={() => handleNavigation(item.path)}
                  startDecorator={item.icon}
                  sx={{
                    color: isActive ? '#FFD700' : 'rgba(232, 230, 224, 0.7)',
                    fontWeight: 600,
                    px: 2,
                    py: 1,
                    borderRadius: '12px',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    '&:hover': {
                      color: '#FFD700',
                      bgcolor: 'rgba(255, 215, 0, 0.1)',
                    },
                    '&::before': isActive ? {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '60%',
                      height: '2px',
                      bgcolor: '#FFD700',
                      borderRadius: '2px 2px 0 0',
                    } : {}
                  }}
                >
                  {item.label}
                </Button>
              )
            })}
          </Box>

          {/* Actions */}
          <Stack 
            direction="row" 
            spacing={1} 
            alignItems="center"
            sx={{ 
              flexShrink: 0,
              justifyContent: 'flex-end'
            }}
          >
            {/* Search Button */}
            <IconButton
              variant="plain"
              onClick={() => setSearchOpen(!searchOpen)}
              sx={{ 
                color: 'rgba(232, 230, 224, 0.7)',
                '&:hover': {
                  color: '#FFD700',
                  bgcolor: 'rgba(255, 215, 0, 0.1)',
                }
              }}
            >
              <Search />
            </IconButton>

            {/* User Avatar / Sign In */}
            {user ? (
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={userProfile?.avatar_url || undefined}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  sx={{
                    '--Avatar-size': '36px',
                    cursor: 'pointer',
                    border: '2px solid rgba(255, 215, 0, 0.3)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#FFD700',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  {user.email?.charAt(0).toUpperCase()}
                </Avatar>
                
                {/* User Dropdown */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <Box
                      component={motion.div}
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                      sx={{
                        position: 'absolute',
                        top: 'calc(100% + 12px)',
                        right: 0,
                        width: 240,
                        bgcolor: 'rgba(18, 18, 26, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(232, 230, 224, 0.1)',
                        borderRadius: '16px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                        overflow: 'hidden',
                        zIndex: 10000,
                      }}
                    >
                      {/* User Info */}
                      <Box sx={{ p: 2, borderBottom: '1px solid rgba(232, 230, 224, 0.1)' }}>
                        <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 700 }}>
                          {userProfile?.display_name || user.email?.split('@')[0]}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mt: 0.5 }}>
                          {user.email}
                        </Typography>
                      </Box>
                      
                      {/* Menu Items */}
                      <Stack sx={{ p: 1 }}>
                        <Button
                          variant="plain"
                          onClick={handleSettingsClick}
                          startDecorator={<Settings />}
                          sx={{
                            justifyContent: 'flex-start',
                            color: 'text.secondary',
                            px: 2,
                            py: 1.5,
                            borderRadius: '12px',
                            '&:hover': {
                              bgcolor: 'rgba(255, 215, 0, 0.1)',
                              color: 'text.primary',
                            }
                          }}
                        >
                          Settings
                        </Button>
                        <Button
                          variant="plain"
                          onClick={handleSignOut}
                          startDecorator={<Logout />}
                          sx={{
                            justifyContent: 'flex-start',
                            color: '#ef4444',
                            px: 2,
                            py: 1.5,
                            borderRadius: '12px',
                            '&:hover': {
                              bgcolor: 'rgba(239, 68, 68, 0.1)',
                            }
                          }}
                        >
                          Sign Out
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </AnimatePresence>
              </Box>
            ) : (
              <Button
                variant="soft"
                onClick={handleSignIn}
                size="sm"
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  bgcolor: 'rgba(255, 215, 0, 0.1)',
                  color: '#FFD700',
                  fontWeight: 700,
                  px: 3,
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 215, 0, 0.2)',
                    borderColor: '#FFD700',
                  }
                }}
              >
                Sign In
              </Button>
            )}

            {/* Mobile Menu Button */}
            <IconButton
              variant="plain"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              sx={{ 
                display: { xs: 'flex', md: 'none' },
                color: 'rgba(232, 230, 224, 0.7)',
                '&:hover': {
                  color: '#FFD700',
                  bgcolor: 'rgba(255, 215, 0, 0.1)',
                }
              }}
            >
              {mobileMenuOpen ? <Close /> : <MenuIcon />}
            </IconButton>
          </Stack>
        </Box>

        {/* Desktop Search Dropdown */}
        <AnimatePresence>
          {searchOpen && (
            <Box
              ref={searchDropdownRef}
              component={motion.div}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              sx={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: { xs: 16, md: 80 },
                width: { xs: 'calc(100vw - 32px)', sm: 400 },
                bgcolor: 'rgba(18, 18, 26, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                border: '1px solid rgba(232, 230, 224, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                zIndex: 10000,
              }}
            >
              <Box sx={{ p: 2 }}>
                <Input
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults && searchResults.length > 0) {
                      navigate(`/player/${searchResults[0].id}`)
                      setSearchOpen(false)
                      setSearchQuery('')
                    }
                  }}
                  startDecorator={<Search sx={{ color: 'text.secondary' }} />}
                  endDecorator={
                    searchQuery && (
                      <IconButton
                        variant="plain"
                        size="sm"
                        onClick={() => setSearchQuery('')}
                        sx={{ color: 'text.secondary' }}
                      >
                        <Close fontSize="small" />
                      </IconButton>
                    )
                  }
                  autoFocus
                  sx={{
                    bgcolor: 'rgba(232, 230, 224, 0.05)',
                    border: '1px solid rgba(232, 230, 224, 0.1)',
                    color: 'text.primary',
                    '&:focus-within': {
                      borderColor: '#FFD700',
                    },
                    '& input::placeholder': {
                      color: 'rgba(232, 230, 224, 0.4)',
                    }
                  }}
                />
              </Box>

              {searchQuery.length >= 2 && (
                <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {searchLoading ? (
                    <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
                      <CircularProgress size="sm" />
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Searching...</Typography>
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
                                bgcolor: 'rgba(255, 215, 0, 0.1)',
                              }
                            }}
                          >
                            <Avatar
                              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                              alt={player.name}
                              size="sm"
                              sx={{ mr: 2 }}
                            />
                            <ListItemContent>
                              <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                {player.name}
                              </Typography>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                {player.team_name || 'Free Agent'} • {player.position || 'N/A'}
                              </Typography>
                            </ListItemContent>
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        No players found
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </AnimatePresence>
      </Box>

      {/* Modern Mobile Menu - Slide-in Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <Box
              component={motion.div}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(4px)',
                zIndex: 1099,
              }}
            />

            {/* Drawer */}
            <Box
              component={motion.div}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: { xs: '85%', sm: '400px' },
                maxWidth: '400px',
                bgcolor: 'rgba(18, 18, 26, 0.98)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(232, 230, 224, 0.1)',
                zIndex: 1100,
                overflowY: 'auto',
                boxShadow: '8px 0 32px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Header */}
              <Box sx={{ p: 3, borderBottom: '1px solid rgba(232, 230, 224, 0.1)' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography sx={{ 
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    🏀 HoopGeek
                  </Typography>
                  <IconButton
                    variant="plain"
                    onClick={() => setMobileMenuOpen(false)}
                    sx={{ color: 'text.secondary' }}
                  >
                    <Close />
                  </IconButton>
                </Stack>
              </Box>

              {/* Navigation Items */}
              <Stack spacing={1} sx={{ p: 2 }}>
                {navigationItems.map((item) => {
                  const isActive = isActivePath(item.path)
                  return (
                    <Button
                      key={item.id}
                      variant="plain"
                      onClick={() => handleNavigation(item.path)}
                      startDecorator={item.icon}
                      sx={{
                        justifyContent: 'flex-start',
                        color: isActive ? '#FFD700' : 'rgba(232, 230, 224, 0.7)',
                        bgcolor: isActive ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                        fontWeight: 600,
                        px: 3,
                        py: 2,
                        borderRadius: '12px',
                        fontSize: '1.1rem',
                        '&:hover': {
                          bgcolor: 'rgba(255, 215, 0, 0.1)',
                          color: '#FFD700',
                        }
                      }}
                    >
                      {item.label}
                    </Button>
                  )
                })}
              </Stack>

              <Divider sx={{ my: 2, borderColor: 'rgba(232, 230, 224, 0.1)' }} />

              {/* User Actions */}
              {user ? (
                <Stack spacing={1} sx={{ p: 2 }}>
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>
                      Account
                    </Typography>
                    <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 700 }}>
                      {userProfile?.display_name || user.email?.split('@')[0]}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      {user.email}
                    </Typography>
                  </Box>
                  <Button
                    variant="plain"
                    onClick={handleSettingsClick}
                    startDecorator={<Settings />}
                    sx={{
                      justifyContent: 'flex-start',
                      color: 'text.secondary',
                      px: 3,
                      py: 2,
                      borderRadius: '12px',
                      '&:hover': {
                        bgcolor: 'rgba(255, 215, 0, 0.1)',
                        color: 'text.primary',
                      }
                    }}
                  >
                    Settings
                  </Button>
                  <Button
                    variant="plain"
                    onClick={handleSignOut}
                    startDecorator={<Logout />}
                    sx={{
                      justifyContent: 'flex-start',
                      color: '#ef4444',
                      px: 3,
                      py: 2,
                      borderRadius: '12px',
                      '&:hover': {
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                      }
                    }}
                  >
                    Sign Out
                  </Button>
                </Stack>
              ) : (
                <Box sx={{ p: 2 }}>
                  <Button
                    variant="soft"
                    onClick={handleSignIn}
                    fullWidth
                    sx={{
                      bgcolor: 'rgba(255, 215, 0, 0.1)',
                      color: '#FFD700',
                      fontWeight: 700,
                      py: 2,
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 215, 0, 0.3)',
                      fontSize: '1.1rem',
                      '&:hover': {
                        bgcolor: 'rgba(255, 215, 0, 0.2)',
                        borderColor: '#FFD700',
                      }
                    }}
                  >
                    Sign In
                  </Button>
                </Box>
              )}
            </Box>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
