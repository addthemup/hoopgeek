import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Search,
  Person,
  AttachMoney,
  DynamicFeed,
} from '@mui/icons-material'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePlayerSearch, SearchResult } from '../hooks/usePlayerSearch'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useAdminUser } from '../hooks/useIsAdmin'
import { Box } from '@/components/ui/box'
import { Stack } from '@/components/ui/stack'
import { Typography } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { isFeedStorySlugPath } from '../utils/feedPaths'

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
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const [isFeedFilterBarOpen, setIsFeedFilterBarOpen] = useState(false)
  const searchDropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLDivElement>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement>(null)

  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isMobileHeight = useMediaQuery('(max-height: 600px)')
  const isLandscapeMobile = isLandscape && isMobileHeight
  const isMobile = useMediaQuery('(max-width: 900px)')

  const { data: searchResults, isLoading: searchLoading } = usePlayerSearch(searchQuery)
  const { data: adminUser } = useAdminUser()
  const isSuperAdmin = adminUser?.role === 'super_admin'

  useEffect(() => {
    const updatePosition = () => {
      if (searchFocused && searchInputRef.current) {
        const rect = searchInputRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
        })
      }
    }
    if (searchFocused) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
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
    { id: 'dfs', label: 'DFS', icon: <AttachMoney />, path: '/dfs' },
    ...(isSuperAdmin && !isMobile
      ? [{ id: 'admin', label: 'Admin', icon: <DynamicFeed />, path: '/admin' }]
      : []),
  ]

  const handleSignIn = () => navigate('/login')
  const handleNavigation = (path: string) => navigate(path)

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/'
    if (path === '/feed') return location.pathname === '/feed' || location.pathname === '/feed/' || location.pathname.startsWith('/feed/')
    return location.pathname.startsWith(path)
  }
  const isFeedPath = location.pathname === '/feed' || location.pathname === '/feed/' || location.pathname.startsWith('/feed/')
  const isSpecificFeedPostPath = isFeedStorySlugPath(location.pathname)

  useEffect(() => {
    const isOpen = isFeedPath && isFeedFilterBarOpen
    window.dispatchEvent(new CustomEvent('feed-filter-bar-toggle', { detail: { open: isOpen } }))
  }, [isFeedPath, isFeedFilterBarOpen])

  const getActiveTabIndex = () => {
    if (location.pathname === '/feed' || location.pathname === '/feed/' || location.pathname.startsWith('/feed/')) return 0
    if (location.pathname.startsWith('/dfs')) return 1
    return 0
  }
  const [activeTabIndex, setActiveTabIndex] = useState(getActiveTabIndex())
  useEffect(() => {
    setActiveTabIndex(getActiveTabIndex())
  }, [location.pathname])

  const handleTabChange = (index: number) => {
    setActiveTabIndex(index)
    const paths = ['/feed', '/dfs']
    if (paths[index]) navigate(paths[index])
  }

  const closeModal = () => {
    setSearchModalOpen(false)
    setSearchFocused(false)
    setSearchQuery('')
  }

  const navIconClass = (active: boolean) =>
    cn(
      'transition-all duration-200',
      active ? 'text-amber-400 bg-amber-400/10' : 'text-white/70 hover:text-amber-400 hover:bg-amber-400/10'
    )

  const renderSearchResult = (result: SearchResult, isMobileResult: boolean) => {
    const goTo = () => {
      if (result.type === 'player') navigate(`/player/${result.id}`)
      else if (result.type === 'prospect') navigate(`/prospect/${result.id}`)
      else navigate(`/team/${result.id}`)
      setSearchQuery('')
      setSearchFocused(false)
      if (isMobileResult) setTimeout(closeModal, 100)
    }
    const itemClass = isMobileResult
      ? 'flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-amber-400/15 cursor-pointer'
      : 'flex items-center gap-3 p-3 rounded-lg hover:bg-amber-400/10 cursor-pointer'
    return (
      <div
        key={result.id}
        className={itemClass}
        role="button"
        tabIndex={0}
        onMouseDown={(e) => {
          e.preventDefault()
          if (!isMobileResult) goTo()
        }}
        onClick={() => isMobileResult && goTo()}
      >
        {result.type === 'player' ? (
          <>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={`https://cdn.nba.com/headshots/nba/latest/260x190/${result.nba_player_id}.png`} alt={result.name} />
              <AvatarFallback>{result.name?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Typography className="font-semibold text-foreground">{result.name}</Typography>
              <Typography className="text-xs text-muted-foreground">{result.team_name || 'Free Agent'} • {result.position || 'N/A'}</Typography>
            </div>
          </>
        ) : result.type === 'prospect' ? (
          <>
            <Avatar className="h-9 w-9 shrink-0 bg-muted">
              <AvatarFallback>?</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Typography className="font-semibold text-foreground">{result.name}</Typography>
              <Typography className="text-xs text-muted-foreground">{result.school_team || '—'} • {result.position_primary || 'N/A'}</Typography>
            </div>
          </>
        ) : (
          <>
            <Avatar className="h-9 w-9 shrink-0 bg-primary text-primary-foreground text-sm font-semibold">
              <AvatarFallback>{result.abbreviation}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Typography className="font-semibold text-foreground">{result.city} {result.nickname}</Typography>
              <Typography className="text-xs text-muted-foreground">Team • {result.abbreviation}</Typography>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop nav - hidden on mobile */}
      {!isLandscapeMobile && (
        <Box
          component={motion.nav}
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="fixed top-0 left-0 right-0 w-full min-w-full z-[1200] bg-[rgba(10,10,13,0.85)] backdrop-blur-xl border-b border-white/10 transition-colors"
          style={{ height: 'calc((100vh - 40px) / 16)' }}
        >
          <div
            className="max-w-[1035px] min-w-[805px] mx-auto px-4 md:px-6 h-full flex items-center justify-between gap-4 relative z-[1]"
            style={{ height: 'calc((100vh - 40px) / 16)' }}
          >
            {/* Logo */}
            <button
              type="button"
              onClick={() => {
                if (isSpecificFeedPostPath) {
                  setIsFeedFilterBarOpen(false)
                  handleNavigation('/feed')
                  return
                }
                if (location.pathname === '/feed' || location.pathname === '/feed/') {
                  setIsFeedFilterBarOpen((prev) => !prev)
                  return
                }
                setIsFeedFilterBarOpen(false)
                handleNavigation('/feed')
              }}
              className="flex items-center shrink-0 min-w-[130px] cursor-pointer"
            >
              <span className="text-xl md:text-2xl font-extrabold bg-gradient-to-br from-amber-400 to-amber-600 bg-clip-text text-transparent tracking-tight lowercase">
                geek
              </span>
            </button>

            {/* Mobile nav icons (inside same bar, shown only on mobile - but bar is hidden on mobile so this is unused) */}
            <div className="flex flex-1 items-center gap-0 md:hidden">
              <Button variant="ghost" size="icon" className={navIconClass(isActivePath('/feed'))} onClick={() => handleNavigation('/feed')} title="Home">
                <Home />
              </Button>
              {navigationItems.map((item) => (
                <Button key={item.id} variant="ghost" size="icon" className={navIconClass(isActivePath(item.path))} onClick={() => handleNavigation(item.path)} title={item.label}>
                  {item.icon}
                </Button>
              ))}
            </div>

            {/* Desktop nav icons */}
            <div className="hidden md:flex flex-1 items-center gap-0 ml-6">
              <Button variant="ghost" size="icon" className={cn('size-10', navIconClass(isActivePath('/feed')))} onClick={() => handleNavigation('/feed')} title="Home">
                <Home />
              </Button>
              {navigationItems.map((item) => (
                <Button key={item.id} variant="ghost" size="icon" className={cn('size-10', navIconClass(isActivePath(item.path)))} onClick={() => handleNavigation(item.path)} title={item.label}>
                  {item.icon}
                </Button>
              ))}
            </div>

            {/* Desktop search - hidden on /feed */}
            {!(location.pathname === '/feed' || location.pathname === '/feed/') && (
              <div
                ref={searchInputRef}
                className="hidden md:block fixed top-[calc((100vh-40px)/32)] right-[calc((100vw-1035px)/2+16px+48px)] translate-y-[-50%] w-[300px] max-w-[400px] min-w-[200px] z-[10001] isolate"
                onClick={(e) => {
                  const input = searchInputRef.current?.querySelector('input')
                  if (input && e.target !== input) input.focus()
                }}
              >
                <div className="flex items-center gap-2 w-full rounded-2xl border border-white/10 bg-white/5 py-1.5 px-3 text-foreground transition-all focus-within:border-amber-400 focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-amber-400/20">
                  <Search className="shrink-0 text-muted-foreground size-4" />
                  <Input
                    placeholder="Search players and teams..."
                    value={searchQuery}
                    onChange={(e) => {
                      const v = e.target.value
                      setSearchQuery(v)
                      if (v.length >= 2) setSearchFocused(true)
                      else if (v.length === 0) setSearchFocused(false)
                    }}
                    onFocus={(e) => {
                      setSearchFocused(true)
                      e.target.select?.()
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        if (!searchDropdownRef.current?.contains(document.activeElement)) setSearchFocused(false)
                      }, 200)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchResults?.length) {
                        e.preventDefault()
                        const first = searchResults[0]
                        if (first.type === 'player') navigate(`/player/${first.id}`)
                        else if (first.type === 'prospect') navigate(`/prospect/${first.id}`)
                        else navigate(`/team/${first.id}`)
                        setSearchQuery('')
                        setSearchFocused(false)
                      }
                      if (e.key === 'Escape') {
                        setSearchFocused(false)
                        setSearchQuery('')
                      }
                    }}
                    className="flex-1 min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0 placeholder:text-white/40"
                  />
                </div>
              </div>
            )}

            {/* Search dropdown portal */}
            {!(location.pathname === '/feed' || location.pathname === '/feed/') &&
              typeof document !== 'undefined' &&
              createPortal(
                <AnimatePresence>
                  {searchFocused && searchQuery.length >= 2 && (
                    <motion.div
                      ref={searchDropdownRef}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      onMouseDown={(e) => e.preventDefault()}
                      className="fixed hidden md:block max-h-[400px] overflow-y-auto rounded-xl border border-white/10 bg-[rgba(18,18,26,0.98)] backdrop-blur-xl shadow-2xl z-[10001]"
                      style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
                    >
                      {searchLoading ? (
                        <div className="p-6 flex justify-center items-center gap-2">
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          <Typography className="text-sm text-muted-foreground">Searching...</Typography>
                        </div>
                      ) : searchResults && searchResults.length > 0 ? (
                        <div className="p-1.5 space-y-0">
                          {searchResults.map((r) => renderSearchResult(r, false))}
                        </div>
                      ) : searchQuery.length >= 2 ? (
                        <div className="p-6 text-center">
                          <Typography className="text-sm text-muted-foreground">No results found</Typography>
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>,
                document.body
              )}

            {/* Right: login hint */}
            <Stack direction="row" spacing={1} className="shrink-0 ml-auto">
              {!user && (
                <Button variant="ghost" size="icon" className="size-8 text-white/40 hover:text-white/70" title="Sign in for personalized features" onClick={handleSignIn}>
                  <Person className="size-[1.1rem]" />
                </Button>
              )}
            </Stack>
          </div>
        </Box>
      )}

      {/* Bottom nav - mobile only */}
      {isMobile && !isLandscapeMobile && (
        <div className="fixed bottom-0 left-0 right-0 w-full min-w-full z-[1000] px-4 py-3 bg-[rgba(10,10,13,0.95)] backdrop-blur-xl border-t border-white/10">
          <div className="flex justify-between items-center relative rounded-2xl max-w-full mx-auto shadow-sm">
            <button
              type="button"
              onClick={() => handleTabChange(0)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-sm font-medium transition-colors rounded-lg',
                activeTabIndex === 0 ? 'text-amber-400 bg-amber-400/15 font-bold' : 'text-white/70 hover:text-white/90 hover:bg-white/5'
              )}
            >
              <Home className="size-5" />
              Home
            </button>

            {!(location.pathname === '/feed' || location.pathname === '/feed/') && (
              <div className="absolute left-1/2 top-[-28px] -translate-x-1/2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-14 rounded-full bg-white/10 text-white/80 border-2 border-white/20 hover:bg-amber-400/20 hover:text-amber-400 hover:border-amber-400 hover:scale-110 hover:shadow-lg hover:shadow-amber-400/30 transition-all"
                  onClick={() => {
                    setSearchModalOpen(true)
                    setTimeout(() => mobileSearchInputRef.current?.focus(), 100)
                  }}
                >
                  <Search className="size-6" />
                </Button>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleTabChange(1)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-sm font-medium transition-colors rounded-lg',
                activeTabIndex === 1 ? 'text-amber-400 bg-amber-400/15 font-bold' : 'text-white/70 hover:text-white/90 hover:bg-white/5'
              )}
            >
              <AttachMoney className="size-5" />
              DFS
            </button>
          </div>
        </div>
      )}

      {/* Mobile search modal */}
      <Dialog open={searchModalOpen && isMobile} onOpenChange={(open) => !open && closeModal()}>
        {searchModalOpen && isMobile && (
          <DialogContent
            className="md:hidden w-full max-w-full h-full max-h-full m-0 rounded-none border-0 bg-[rgba(10,10,13,0.98)] backdrop-blur-xl p-4 flex flex-col"
            onClose={closeModal}
          >
            <DialogClose className="text-white right-4 top-4 text-2xl" onClick={closeModal}>
              ×
            </DialogClose>
            <div className="mt-8 mb-4">
              <div className="flex items-center gap-2 w-full rounded-2xl border-2 border-amber-400/30 bg-white/10 py-3 px-4 text-base focus-within:border-amber-400 focus-within:bg-white/15 focus-within:ring-4 focus-within:ring-amber-400/10">
                <Search className="shrink-0 text-muted-foreground size-5" />
                <Input
                  ref={mobileSearchInputRef}
                  placeholder="Search players and teams..."
                  value={searchQuery}
                  onChange={(e) => {
                    const v = e.target.value
                    setSearchQuery(v)
                    if (v.length >= 2) setSearchFocused(true)
                    else if (v.length === 0) setSearchFocused(false)
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults?.length) {
                      e.preventDefault()
                      const first = searchResults[0]
                      if (first.type === 'player') navigate(`/player/${first.id}`)
                      else if (first.type === 'prospect') navigate(`/prospect/${first.id}`)
                      else navigate(`/team/${first.id}`)
                      closeModal()
                    }
                    if (e.key === 'Escape') closeModal()
                  }}
                  className="flex-1 min-w-0 border-0 bg-transparent text-white text-base placeholder:text-white/50 focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto mt-4">
              {searchLoading ? (
                <div className="p-6 flex justify-center items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <Typography className="text-sm text-muted-foreground">Searching...</Typography>
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((r) => renderSearchResult(r, true))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="p-6 text-center">
                  <Typography className="text-muted-foreground">No results found</Typography>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Typography className="text-white/50">Start typing to search for players and teams...</Typography>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
