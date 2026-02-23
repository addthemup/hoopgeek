import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  Tabs,
  TabList,
  Tab,
  ListItemDecorator,
  Modal,
  ModalDialog,
  ModalClose,
} from '@mui/joy'
import { tabClasses } from '@mui/joy/Tab'
import {
  Home,
  SportsBasketball,
  Search,
  Close,
  Schedule,
  Menu as MenuIcon,
  Person,
  AttachMoney,
  DynamicFeed,
} from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import { usePlayerSearch, SearchResult, PlayerSearchResult, TeamSearchResult } from '../hooks/usePlayerSearch'
import { useUserProfile } from '../hooks/useUserSettings'
import { useMediaQuery } from '@mui/material'
import { useAdminUser } from '../hooks/useIsAdmin'

interface NavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  path: string
  description?: string
  pages?: Array<{ id: string; name: string; path: string; condition?: boolean }>
}

export default function TopNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false) // Mobile search modal
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const searchDropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLDivElement>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)
  
  // Detect landscape mobile orientation
  // Check for landscape orientation with height constraint (mobile devices have shorter heights in landscape)
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isMobileHeight = useMediaQuery('(max-height: 600px)')
  const isLandscapeMobile = isLandscape && isMobileHeight
  // Also check for mobile width (for portrait mode and general mobile detection)
  const isMobile = useMediaQuery('(max-width: 900px)')
  
  const { data: searchResults, isLoading: searchLoading } = usePlayerSearch(searchQuery)
  const { data: userProfile } = useUserProfile(user?.id)
  const { data: adminUser } = useAdminUser()
  const isSuperAdmin = adminUser?.role === 'super_admin'
  
  // Calculate dropdown position when search is focused or window resizes/scrolls
  useEffect(() => {
    const updatePosition = () => {
      if (searchFocused && searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + 8, // 8px gap
          left: rect.left,
          width: rect.width
        })
      }
    }

    if (searchFocused) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true) // Use capture to catch all scroll events
      
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [searchFocused, searchQuery])


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setSearchFocused(false)
      }
    }
    
    if (searchFocused) {
      // Use a slight delay to allow click events on dropdown items to fire first
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [searchFocused])


  const navigationItems: NavigationItem[] = [
    {
      id: 'dfs',
      label: 'DFS',
      icon: <AttachMoney />,
      path: '/dfs',
    },
    // Fantasy tab disabled – branching away from fantasy feature
    // { id: 'fantasy', label: 'Fantasy', icon: <SportsBasketball />, path: '/fantasy' },
    // Only show admin items on desktop (not mobile)
    ...(isSuperAdmin && !isMobile ? [
      {
        id: 'admin',
        label: 'Admin',
        icon: <DynamicFeed />,
        path: '/admin',
      },
    ] : [])
  ]

  const handleSignIn = () => {
    navigate('/login')
  }
  
  const handleNavigation = (path: string) => {
    navigate(path)
  }

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    if (path === '/feed') {
      return location.pathname === '/feed' || location.pathname === '/feed/'
    }
    return location.pathname.startsWith(path)
  }


  // Get current active tab index for bottom nav (Home = feed, DFS)
  const getActiveTabIndex = () => {
    if (location.pathname === '/feed' || location.pathname === '/feed/') return 0
    if (location.pathname.startsWith('/dfs')) return 1
    return 0
  }

  const [activeTabIndex, setActiveTabIndex] = useState(getActiveTabIndex())

  // Update active tab when location changes
  useEffect(() => {
    setActiveTabIndex(getActiveTabIndex())
  }, [location.pathname])

  const handleTabChange = (event: React.SyntheticEvent | null, value: number | string) => {
    const index = typeof value === 'number' ? value : parseInt(value as string, 10)
    setActiveTabIndex(index)
    
    const paths = ['/feed', '/dfs']
    if (paths[index]) {
      navigate(paths[index])
    }
  }

  return (
    <>
      {/* Main Navigation Bar - Desktop Only (Top) - Hidden on mobile */}
      {!isLandscapeMobile && (
        <Box
          component={motion.nav}
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: { xs: 'auto', md: 'calc((100vh - 40px) / 16)' }, // Match margin bar row height
            zIndex: 1000, // Lowered so avatar bars (1200) can overlay on top
            bgcolor: 'rgba(10, 10, 13, 0.85)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(232, 230, 224, 0.1)',
            transition: 'background-color 0.3s',
            display: { xs: 'none', md: 'block' }, // Hide on mobile
          }}
        >
          <Box sx={{ 
            maxWidth: { xs: '100%', sm: 805, md: 1035 },
            minWidth: { xs: '100%', sm: 805, md: 1035 },
            mx: 'auto',
            px: { xs: 1.5, sm: 2, md: 3 },
            py: { xs: 1, md: 0 }, // No vertical padding on desktop - height will be set explicitly
            height: { xs: 'auto', md: 'calc((100vh - 40px) / 16)' }, // Match margin bar row height
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            position: 'relative',
            zIndex: 1, // Lower z-index for the container, allowing search bar to escape
          }}>
            {/* Logo - Desktop Only */}
            <Box 
              onClick={() => handleNavigation('/feed')}
              sx={{ 
                cursor: 'pointer',
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                flexShrink: 0,
                minWidth: { xs: 'auto', md: '130px' }
              }}
            >
              <Typography 
                sx={{ 
                  fontSize: { xs: '1.1rem', md: '1.5rem' },
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                🏀 HoopGeek
              </Typography>
            </Box>

            {/* Mobile Navigation Icons - Home, Feed, DFS */}
            <Box 
              sx={{ 
                display: { xs: 'flex', md: 'none' },
                flex: 1,
                alignItems: 'center',
                gap: 0,
                justifyContent: 'flex-start',
              }}
            >
              {/* Home Icon -> /feed */}
              <IconButton
                variant={isActivePath('/feed') ? 'soft' : 'plain'}
                onClick={() => handleNavigation('/feed')}
                sx={{
                  color: isActivePath('/feed') ? '#FFD700' : 'rgba(232, 230, 224, 0.7)',
                  bgcolor: isActivePath('/feed') ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                  '--IconButton-size': '40px',
                  transition: 'all 0.2s',
                  '&:hover': {
                    color: '#FFD700',
                    bgcolor: 'rgba(255, 215, 0, 0.1)',
                  },
                }}
                title="Home"
              >
                <Home />
              </IconButton>

              {navigationItems.map((item) => {
                const isActive = isActivePath(item.path)
                
                return (
                  <IconButton
                    key={item.id}
                    variant={isActive ? 'soft' : 'plain'}
                    onClick={() => handleNavigation(item.path)}
                    sx={{
                      color: isActive ? '#FFD700' : 'rgba(232, 230, 224, 0.7)',
                      bgcolor: isActive ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                      '--IconButton-size': '40px',
                      transition: 'all 0.2s',
                      '&:hover': {
                        color: '#FFD700',
                        bgcolor: 'rgba(255, 215, 0, 0.1)',
                      },
                    }}
                    title={item.label}
                  >
                    {item.icon}
                  </IconButton>
                )
              })}
            </Box>

            {/* Navigation Items - Desktop - Icons Only */}
            <Box 
              sx={{ 
                display: { xs: 'none', md: 'flex' },
                flex: 1,
                alignItems: 'center',
                gap: 0,
                ml: { md: 3 },
              }}
            >
              {/* Home Icon -> /feed */}
              <IconButton
                variant={isActivePath('/feed') ? 'soft' : 'plain'}
                onClick={() => handleNavigation('/feed')}
                sx={{
                  color: isActivePath('/feed') ? '#FFD700' : 'rgba(232, 230, 224, 0.7)',
                  bgcolor: isActivePath('/feed') ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                  '--IconButton-size': '40px',
                  transition: 'all 0.2s',
                  '&:hover': {
                    color: '#FFD700',
                    bgcolor: 'rgba(255, 215, 0, 0.1)',
                  },
                }}
                title="Home"
              >
                <Home />
              </IconButton>

              {navigationItems.map((item) => {
                const isActive = isActivePath(item.path)
                
                return (
                  <IconButton
                    key={item.id}
                    variant={isActive ? 'soft' : 'plain'}
                    onClick={() => handleNavigation(item.path)}
                    sx={{
                      color: isActive ? '#FFD700' : 'rgba(232, 230, 224, 0.7)',
                      bgcolor: isActive ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                      '--IconButton-size': '40px',
                      transition: 'all 0.2s',
                      '&:hover': {
                        color: '#FFD700',
                        bgcolor: 'rgba(255, 215, 0, 0.1)',
                      },
                    }}
                    title={item.label}
                  >
                    {item.icon}
                  </IconButton>
                )
              })}
            </Box>


            {/* Integrated Search Bar - Desktop Only - Hidden on /feed/ (search is beside More button there) */}
            {!(location.pathname === '/feed' || location.pathname === '/feed/') && (
            <Box
              ref={searchInputRef}
              onClick={(e) => {
                // Ensure clicking the container focuses the input
                const input = searchInputRef.current?.querySelector('input')
                if (input && e.target !== input) {
                  input.focus()
                }
              }}
              sx={{
                position: { md: 'fixed' }, // Fixed positioning to escape nav bar stacking context
                top: { md: 'calc((100vh - 40px) / 32)' }, // Center vertically within nav bar (half of nav height)
                transform: { md: 'translateY(-50%)' }, // Center vertically
                // Adjust right position - subtle login icon is small
                right: { 
                  md: 'calc((100vw - 1035px) / 2 + 16px + 48px)' // Small icon: 32px + 16px spacing
                },
                flex: { xs: 0, md: '0 0 auto' },
                maxWidth: { md: '400px' },
                minWidth: { md: '200px' },
                width: { md: '300px' },
                display: { xs: 'none', md: 'block' },
                zIndex: 10001, // Highest z-index to ensure search appears above everything (avatar bars: 1200, user menu: 10000)
                isolation: 'isolate', // Create new stacking context
              }}
            >
              <Input
                placeholder="Search players and teams..."
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchQuery(value)
                  if (value.length >= 2) {
                    setSearchFocused(true)
                  } else if (value.length === 0) {
                    setSearchFocused(false)
                  }
                }}
                onFocus={(e) => {
                  setSearchFocused(true)
                  e.target.select?.()
                }}
                onBlur={(e) => {
                  // Don't close if clicking on dropdown results
                  const relatedTarget = e.relatedTarget as Node | null
                  if (!searchDropdownRef.current?.contains(relatedTarget)) {
                    setTimeout(() => {
                      // Only close if we're not clicking on a result
                      if (!searchDropdownRef.current?.contains(document.activeElement)) {
                        setSearchFocused(false)
                      }
                    }, 200)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults && searchResults.length > 0) {
                    e.preventDefault()
                    const firstResult = searchResults[0]
                    if (firstResult.type === 'player') {
                      navigate(`/player/${firstResult.id}`)
                    } else if (firstResult.type === 'prospect') {
                      navigate(`/prospect/${firstResult.id}`)
                    } else {
                      navigate(`/team/${firstResult.id}`)
                    }
                    setSearchQuery('')
                    setSearchFocused(false)
                  }
                  if (e.key === 'Escape') {
                    setSearchFocused(false)
                    setSearchQuery('')
                  }
                }}
                startDecorator={<Search sx={{ color: 'text.secondary', fontSize: '1rem', pointerEvents: 'none' }} />}
                sx={{
                  width: '100%',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(232, 230, 224, 0.1)',
                  borderRadius: '16px',
                  py: 0.75,
                  px: 1.5,
                  color: 'text.primary',
                  transition: 'all 0.2s',
                  position: 'relative',
                  zIndex: 10001, // Match parent z-index
                  '& input': {
                    color: 'text.primary',
                    cursor: 'text',
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield',
                    position: 'relative',
                    zIndex: 10001,
                  },
                  '&:focus-within': {
                    borderColor: '#FFD700',
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 0 0 3px rgba(255, 215, 0, 0.1)',
                  },
                  '& input::placeholder': {
                    color: 'rgba(232, 230, 224, 0.4)',
                  },
                  '& input:focus': {
                    outline: 'none',
                  }
                }}
              />

            </Box>
            )}

            {/* Search Results Dropdown - Rendered via Portal (hidden on /feed/) */}
            {!(location.pathname === '/feed' || location.pathname === '/feed/') && typeof document !== 'undefined' ? createPortal(
              <AnimatePresence>
                {searchFocused && searchQuery.length >= 2 ? (
                  <Box
                    ref={searchDropdownRef}
                    component={motion.div}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking dropdown
                    sx={{
                      position: 'fixed',
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                      width: `${dropdownPosition.width}px`,
                      maxHeight: '400px',
                      overflowY: 'auto',
                      bgcolor: 'rgba(18, 18, 26, 0.98)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(232, 230, 224, 0.1)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                      zIndex: 10001, // Highest z-index to ensure search dropdown appears above everything (avatar bars: 1200, user menu: 10000)
                      display: { xs: 'none', md: 'block' },
                    }}
                  >
                    {searchLoading ? (
                      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
                        <CircularProgress size="sm" />
                        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Searching...</Typography>
                      </Box>
                    ) : searchResults && searchResults.length > 0 ? (
                      <List sx={{ p: 0.5 }}>
                        {searchResults.map((result: SearchResult) => (
                          <ListItem key={result.id} sx={{ p: 0 }}>
                            <ListItemButton
                              onMouseDown={(e) => {
                                e.preventDefault()
                                if (result.type === 'player') {
                                  navigate(`/player/${result.id}`)
                                } else if (result.type === 'prospect') {
                                  navigate(`/prospect/${result.id}`)
                                } else {
                                  navigate(`/team/${result.id}`)
                                }
                                setSearchQuery('')
                                setSearchFocused(false)
                              }}
                              sx={{
                                p: 1.5,
                                borderRadius: '8px',
                                '&:hover': {
                                  bgcolor: 'rgba(255, 215, 0, 0.1)',
                                }
                              }}
                            >
                              {result.type === 'player' ? (
                                <>
                                  <Avatar
                                    src={`https://cdn.nba.com/headshots/nba/latest/260x190/${result.nba_player_id}.png`}
                                    alt={result.name}
                                    size="sm"
                                    sx={{ mr: 1.5 }}
                                  />
                                  <ListItemContent>
                                    <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                      {result.name}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                      {result.team_name || 'Free Agent'} • {result.position || 'N/A'}
                                    </Typography>
                                  </ListItemContent>
                                </>
                              ) : result.type === 'prospect' ? (
                                <>
                                  <Avatar
                                    size="sm"
                                    sx={{ mr: 1.5, bgcolor: 'neutral.700' }}
                                  />
                                  <ListItemContent>
                                    <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                      {result.name}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                      {result.school_team || '—'} • {result.position_primary || 'N/A'}
                                    </Typography>
                                  </ListItemContent>
                                </>
                              ) : (
                                <>
                                  <Avatar
                                    sx={{ 
                                      mr: 1.5,
                                      bgcolor: 'primary.500',
                                      fontSize: '0.875rem',
                                      fontWeight: 600
                                    }}
                                    size="sm"
                                  >
                                    {result.abbreviation}
                                  </Avatar>
                                  <ListItemContent>
                                    <Typography level="title-sm" sx={{ color: 'text.primary', fontWeight: 600 }}>
                                      {result.city} {result.nickname}
                                    </Typography>
                                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                      Team • {result.abbreviation}
                                    </Typography>
                                  </ListItemContent>
                                </>
                              )}
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    ) : searchQuery.length >= 2 ? (
                      <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                          No results found
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                ) : null}
              </AnimatePresence>,
              document.body
            ) : null}


            {/* Right Side Actions */}
            <Stack 
              direction="row" 
              spacing={1} 
              alignItems="center"
              sx={{ 
                flexShrink: 0,
                ml: 'auto',
              }}
            >
              {/* Subtle Login Hint - Only show when not logged in */}
              {!user && (
                <IconButton
                    onClick={handleSignIn}
                  variant="plain"
                  size="sm"
                    sx={{
                    color: 'rgba(232, 230, 224, 0.4)',
                    '--IconButton-size': '32px',
                      transition: 'all 0.2s',
                      '&:hover': {
                      color: 'rgba(232, 230, 224, 0.7)',
                    },
                  }}
                  title="Sign in for personalized features"
                >
                  <Person sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              )}
            </Stack>
          </Box>
        </Box>
      )}


      {/* Bottom Navigation - Mobile Only */}
      {isMobile && !isLandscapeMobile && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            bgcolor: 'rgba(10, 10, 13, 0.95)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(232, 230, 224, 0.1)',
            px: 2,
            py: 1.5,
          }}
        >
          <Tabs
            size="lg"
            aria-label="Bottom Navigation"
            value={activeTabIndex}
            onChange={handleTabChange}
            sx={(theme) => ({
              p: 0,
              borderRadius: 16,
              maxWidth: '100%',
              mx: 'auto',
              boxShadow: theme.shadow.sm,
              '--joy-shadowChannel': theme.vars.palette.primary.darkChannel,
              [`& .${tabClasses.root}`]: {
                py: 1,
                flex: 1,
                transition: '0.3s',
                fontWeight: 'md',
                fontSize: 'sm',
                color: 'rgba(255, 255, 255, 0.7)',
                [`&.${tabClasses.selected}`]: {
                  color: '#FFD700',
                  bgcolor: 'rgba(255, 215, 0, 0.15)',
                  fontWeight: 700,
                },
                [`&:not(.${tabClasses.selected}):not(:hover)`]: {
                  opacity: 0.7,
                },
                '&:hover': {
                  color: 'rgba(255, 255, 255, 0.9)',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                },
              },
            })}
          >
            <TabList
              variant="plain"
              size="sm"
              disableUnderline
              sx={{ borderRadius: 'lg', p: 0, gap: 0, position: 'relative', display: 'flex', justifyContent: 'space-between' }}
            >
              <Tab
                disableIndicator
                orientation="vertical"
                {...(activeTabIndex === 0 && { color: 'primary' })}
                sx={{ flex: 1 }}
              >
                <ListItemDecorator>
                  <Home />
                </ListItemDecorator>
                Home
              </Tab>
              
              {/* Center Search Button - Hidden on /feed/ (mobile feed has no search bar) */}
              {!(location.pathname === '/feed' || location.pathname === '/feed/') && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: '50%',
                    top: '-28px',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                  }}
                >
                  <IconButton
                    variant="plain"
                    onClick={() => {
                      setSearchModalOpen(true)
                      setTimeout(() => {
                        mobileSearchInputRef.current?.focus()
                      }, 100)
                    }}
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      bgcolor: 'rgba(255, 255, 255, 0.1)',
                      color: 'rgba(255, 255, 255, 0.8)',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      '&:hover': {
                        bgcolor: 'rgba(255, 215, 0, 0.2)',
                        color: '#FFD700',
                        borderColor: '#FFD700',
                        transform: 'scale(1.1)',
                        boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
                      },
                      transition: 'all 0.2s',
                    }}
                  >
                    <Search sx={{ fontSize: '1.5rem' }} />
                  </IconButton>
                </Box>
              )}
              
              <Tab
                disableIndicator
                orientation="vertical"
                {...(activeTabIndex === 1 && { color: 'primary' })}
                sx={{ flex: 1 }}
              >
                <ListItemDecorator>
                  <AttachMoney />
                </ListItemDecorator>
                DFS
              </Tab>
            </TabList>
          </Tabs>
        </Box>
      )}

      {/* Mobile Search Modal */}
      <Modal
        open={searchModalOpen}
        onClose={() => {
          setSearchModalOpen(false)
          setSearchFocused(false)
          setSearchQuery('')
        }}
        sx={{
          display: { xs: 'flex', md: 'none' },
        }}
      >
        <ModalDialog
          sx={{
            width: '100%',
            maxWidth: '100%',
            height: '100%',
            maxHeight: '100%',
            m: 0,
            borderRadius: 0,
            bgcolor: 'rgba(10, 10, 13, 0.98)',
            backdropFilter: 'blur(20px)',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ModalClose sx={{ color: '#fff', top: 16, right: 16 }} />
          <Box sx={{ mt: 2, mb: 2 }}>
            <Input
              inputRef={mobileSearchInputRef}
              placeholder="Search players and teams..."
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value
                setSearchQuery(value)
                if (value.length >= 2) {
                  setSearchFocused(true)
                } else if (value.length === 0) {
                  setSearchFocused(false)
                }
              }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults && searchResults.length > 0) {
                  e.preventDefault()
                  const firstResult = searchResults[0]
                  if (firstResult.type === 'player') {
                    navigate(`/player/${firstResult.id}`)
                  } else if (firstResult.type === 'prospect') {
                    navigate(`/prospect/${firstResult.id}`)
                  } else {
                    navigate(`/team/${firstResult.id}`)
                  }
                  setSearchQuery('')
                  setSearchFocused(false)
                  setSearchModalOpen(false)
                }
                if (e.key === 'Escape') {
                  setSearchFocused(false)
                  setSearchQuery('')
                  setSearchModalOpen(false)
                }
              }}
              startDecorator={<Search sx={{ color: 'text.secondary', fontSize: '1.25rem' }} />}
              sx={{
                width: '100%',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                border: '2px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '16px',
                py: 1.5,
                px: 2,
                fontSize: '1.1rem',
                '& input': {
                  color: '#fff',
                  fontSize: '1.1rem',
                },
                '&:focus-within': {
                  borderColor: '#FFD700',
                  bgcolor: 'rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 0 0 4px rgba(255, 215, 0, 0.1)',
                },
                '& input::placeholder': {
                  color: 'rgba(255, 255, 255, 0.5)',
                },
              }}
            />
          </Box>
          
          {/* Search Results */}
          <Box sx={{ flex: 1, overflowY: 'auto', mt: 2 }}>
            {searchLoading ? (
              <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
                <CircularProgress size="sm" />
                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Searching...</Typography>
              </Box>
            ) : searchResults && searchResults.length > 0 ? (
              <List sx={{ p: 0 }}>
                {searchResults.map((result: SearchResult) => (
                  <ListItem key={result.id} sx={{ p: 0, mb: 1 }}>
                    <ListItemButton
                      onClick={() => {
                        // Close modal first, then navigate
                        setSearchModalOpen(false)
                        setSearchQuery('')
                        setSearchFocused(false)
                        // Small delay to ensure modal closes before navigation
                        setTimeout(() => {
                          if (result.type === 'player') {
                            navigate(`/player/${result.id}`)
                          } else if (result.type === 'prospect') {
                            navigate(`/prospect/${result.id}`)
                          } else {
                            navigate(`/team/${result.id}`)
                          }
                        }, 100)
                      }}
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 215, 0, 0.15)',
                        }
                      }}
                    >
                      {result.type === 'player' ? (
                        <>
                          <Avatar
                            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${result.nba_player_id}.png`}
                            alt={result.name}
                            size="md"
                            sx={{ mr: 2 }}
                          />
                          <ListItemContent>
                            <Typography level="title-md" sx={{ color: '#fff', fontWeight: 600 }}>
                              {result.name}
                            </Typography>
                            <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                              {result.team_name || 'Free Agent'} • {result.position || 'N/A'}
                            </Typography>
                          </ListItemContent>
                        </>
                      ) : result.type === 'prospect' ? (
                        <>
                          <Avatar
                            size="md"
                            sx={{ mr: 2, bgcolor: 'neutral.700', width: 48, height: 48 }}
                          />
                          <ListItemContent>
                            <Typography level="title-md" sx={{ color: '#fff', fontWeight: 600 }}>
                              {result.name}
                            </Typography>
                            <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                              {result.school_team || '—'} • {result.position_primary || 'N/A'}
                            </Typography>
                          </ListItemContent>
                        </>
                      ) : (
                        <>
                          <Avatar
                            sx={{ 
                              mr: 2,
                              bgcolor: 'primary.500',
                              fontSize: '1rem',
                              fontWeight: 600,
                              width: 48,
                              height: 48,
                            }}
                            size="md"
                          >
                            {result.abbreviation}
                          </Avatar>
                          <ListItemContent>
                            <Typography level="title-md" sx={{ color: '#fff', fontWeight: 600 }}>
                              {result.city} {result.nickname}
                            </Typography>
                            <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                              Team • {result.abbreviation}
                            </Typography>
                          </ListItemContent>
                        </>
                      )}
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            ) : searchQuery.length >= 2 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography level="body-md" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  No results found
                </Typography>
              </Box>
            ) : (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography level="body-md" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Start typing to search for players and teams...
                </Typography>
              </Box>
            )}
          </Box>
        </ModalDialog>
      </Modal>

    </>
  )
}
