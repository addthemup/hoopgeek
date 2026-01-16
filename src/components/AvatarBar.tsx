import { Box, Skeleton } from '@mui/joy';
import { useRef, useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface AvatarBarProps<T> {
  items: T[];
  isLoading?: boolean;
  selectedId?: string | null;
  onItemClick?: (id: string) => void;
  renderAvatar: (item: T | null, index: number, hasData: boolean) => React.ReactNode;
  getBorderStyles?: (item: T | null, index: number, hasData: boolean, isSelected: boolean) => {
    border?: string;
    borderColor?: string;
    bgcolor?: string;
  };
  getItemId: (item: T) => string;
  minItems?: number; // Minimum number of skeleton items to show
}

export default function AvatarBar<T>({
  items,
  isLoading = false,
  selectedId,
  onItemClick,
  renderAvatar,
  getBorderStyles,
  getItemId,
  minItems = 5,
}: AvatarBarProps<T>) {
  // Detect landscape mobile orientation
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileHeight = useMediaQuery('(max-height: 600px)');
  const isLandscapeMobile = isLandscape && isMobileHeight;
  const isMobile = useMediaQuery('(max-width: 900px)');
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which items have loaded to enable fade-in animation
  const [loadedItems, setLoadedItems] = useState<Set<string>>(new Set());
  const [visibleItemCount, setVisibleItemCount] = useState(1); // Start with 1 item visible

  // Always render up to 20 items total
  const maxItems = Math.min(20, Math.max(1, items?.length || 1));
  const location = useLocation();
  
  // Track scrollable state
  const [needsScroll, setNeedsScroll] = useState(false);

  // Memoize mobile items to prevent rerenders during scroll
  const mobileItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.slice(0, 20);
  }, [items]);

  // Auto-load first item immediately, then progressively load the rest
  // On mobile, skip all this - we render items directly without state management
  useEffect(() => {
    // Skip all state management on mobile - items render directly
    if (isMobile) {
      return;
    }

    // Desktop: progressive loading logic
    // Always show at least 1 skeleton
    if (!items || items.length === 0) {
      setVisibleItemCount(1);
      if (!isLoading) {
        setLoadedItems(new Set());
      }
      return;
    }

    // When items are available and not loading, start the loading sequence (desktop)
    if (items.length > 0) {
      // First, mark first item as loaded immediately (auto-load)
      const firstId = getItemId(items[0]);
      setLoadedItems((prev) => {
        const newSet = new Set(prev);
        newSet.add(firstId);
        return newSet;
      });
      
      // Show first item immediately
      setVisibleItemCount(1);
      
      // Then progressively load the rest after first item is visible
      if (items.length > 1) {
        const timeoutId = setTimeout(() => {
          // Mark all items as loaded
          setLoadedItems((prev) => {
            const newSet = new Set(prev);
            items.forEach((item) => {
              const id = getItemId(item);
              newSet.add(id);
            });
            return newSet;
          });
          // Show all remaining items progressively
          const totalItems = Math.min(20, items.length);
          let currentCount = 1;
          const intervalId = setInterval(() => {
            currentCount += 1;
            if (currentCount <= totalItems) {
              setVisibleItemCount(currentCount);
            } else {
              clearInterval(intervalId);
            }
          }, 100); // Load one item every 100ms after first one
          
          return () => clearInterval(intervalId);
        }, 200); // 200ms delay after first item loads
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [items, isLoading, getItemId, isMobile]);

  // Check if scrolling is needed - use ref to avoid rerenders during scroll
  useEffect(() => {
    const checkScroll = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const needsScrollbar = container.scrollWidth > container.clientWidth;
        // Only update state if it actually changed to prevent unnecessary rerenders
        setNeedsScroll(prev => prev !== needsScrollbar ? needsScrollbar : prev);
      }
    };

    checkScroll();
    // Recheck on resize and when items change, but debounce to avoid excessive checks
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(checkScroll, 150);
    };
    
    window.addEventListener('resize', handleResize);
    const timeoutId = setTimeout(checkScroll, 100); // Small delay to ensure DOM is updated

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
      clearTimeout(resizeTimeout);
    };
  }, [items, isLoading]);


  // ALWAYS render on mobile - even if empty, show debug info
  return (
    <Box
      sx={{
        position: 'fixed',
        top: { xs: '59px', md: 'calc((100vh - 40px) / 16)' }, // 10px below top nav on mobile to avoid overlap
        left: 0,
        right: 0,
        zIndex: 1200,
        borderBottom: { xs: '3px solid', md: 'none' },
        borderColor: 'divider',
        pt: 0, // No padding-top - flush with nav bar
        pb: { xs: 1, md: 1 },
        bgcolor: 'background.body',
        boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
        overflowY: 'hidden',
        margin: 0,
        // Always render on mobile - never hide
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        ...(isLandscapeMobile && {
          maxWidth: '66.67%',
          minWidth: '66.67%',
          mx: 'auto',
          marginTop: 0,
        }),
      }}
    >
      <Box
        sx={{
          maxWidth: isLandscapeMobile
            ? '100%'
            : { xs: '100%', sm: 805, md: 1035 },
          minWidth: isLandscapeMobile
            ? '100%'
            : { xs: '100%', sm: 805, md: 1035 },
          mx: isLandscapeMobile
            ? 0
            : { xs: 'auto', sm: 'auto', md: 'calc(325px + (100% - 650px - 1035px) / 2)' },
          px: isLandscapeMobile ? 1 : { xs: 2, md: 2 },
          overflowY: 'hidden',
          margin: 0,
        }}
      >
        {/* Scrollable Avatars Container */}
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            gap: '12px',
            // On mobile, always enable scroll for smooth horizontal scrolling
            // On desktop, only enable when needed
            overflowX: isMobile ? 'auto' : (needsScroll ? 'auto' : 'hidden'),
            overflowY: 'hidden',
            pb: 0,
            position: 'relative',
            // Hide scrollbar on mobile for cleaner look, show on desktop when needed
            scrollbarWidth: isMobile ? 'none' : (needsScroll ? 'thin' : 'none'),
            msOverflowStyle: isMobile ? 'none' : (needsScroll ? 'auto' : 'none'),
            '&::-webkit-scrollbar': {
              display: isMobile ? 'none' : (needsScroll ? 'block' : 'none'),
              height: '4px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
            },
            // Enable smooth scrolling on mobile
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* On mobile: Skip AnimatePresence to prevent rerenders during scroll */}
          {isMobile ? (
            // MOBILE: Direct rendering without AnimatePresence wrapper for smooth scrolling
            mobileItems.length === 0 ? null : (
              <Box
                sx={{
                  display: 'flex',
                  gap: '12px',
                  width: '100%',
                }}
              >
                {mobileItems.map((item, index) => {
                  const itemId = getItemId(item);
                  const isSelected = selectedId === itemId;
                  
                  return (
                    <Box
                      key={itemId}
                      onClick={() => !isLoading && onItemClick?.(itemId)}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.5,
                        minWidth: 'fit-content',
                        cursor: !isLoading && onItemClick ? 'pointer' : 'default',
                        position: 'relative',
                        zIndex: isSelected ? 10 : 2,
                        opacity: 1, // Always fully visible on mobile
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 77, md: 83 },
                          height: { xs: 77, md: 83 },
                          ...(getBorderStyles
                            ? getBorderStyles(item, index, true, isSelected)
                            : {
                                border: '3px solid',
                                borderColor: isSelected ? '#FFC72C' : 'text.primary',
                                bgcolor: 'background.level1',
                              }),
                          borderRadius: '50%',
                          overflow: 'hidden',
                          position: 'relative',
                          transition: 'all 0.2s',
                          cursor: onItemClick ? 'pointer' : 'default',
                          boxShadow: isSelected ? '0 0 16px rgba(255,215,0,0.5)' : 'none',
                        }}
                      >
                        {/* Content - NO skeleton wrapper on mobile */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            zIndex: 2,
                          }}
                        >
                          {renderAvatar(item, index, true)}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )
          ) : (
            // DESKTOP: Progressive loading with skeleton, wrapped in AnimatePresence
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{
                  display: 'flex',
                  gap: '12px',
                  width: '100%',
                }}
              >
                {/* DESKTOP: Progressive loading with skeleton */}
                {[...Array(Math.max(1, Math.min(visibleItemCount, maxItems)))].map((_, index) => {
                  const item = items?.[index];
                  const hasData = !!item;
                  const itemId = item ? getItemId(item) : null;
                  const isSelected = selectedId === itemId;
                  const isLoaded = itemId ? loadedItems.has(itemId) : false;
                  const showSkeleton = index < 1 && (!hasData || (hasData && isLoading && !isLoaded));
                  const shouldRender = index < 1 || hasData;

                  if (!shouldRender) return null;

                  return (
                    <Box
                      key={itemId || `skeleton-${index}`}
                      onClick={() => hasData && !isLoading && itemId && onItemClick?.(itemId)}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.5,
                        minWidth: 'fit-content',
                        cursor: hasData && !isLoading && onItemClick ? 'pointer' : 'default',
                        position: 'relative',
                        zIndex: isSelected ? 10 : 2,
                        opacity: hasData && isLoaded && !isLoading ? 1 : hasData && !isLoaded ? 0 : showSkeleton ? 1 : 0,
                        transition: hasData ? 'opacity 0.3s ease-in' : 'none',
                      }}
                    >
                      {/* Always render circle structure - skeleton for first 2, data for all */}
                      <Box
                        sx={{
                          width: { xs: 77, md: 83 },
                          height: { xs: 77, md: 83 },
                          ...(hasData && getBorderStyles
                            ? getBorderStyles(item, index, hasData, isSelected)
                            : {
                                border: '3px dashed', // Blank avatar: dashed border
                                borderColor: 'text.primary', // Blank avatar: primary text color
                                bgcolor: '#000000', // Blank avatar: black background
                              }),
                          borderRadius: '50%',
                          overflow: 'hidden',
                          position: 'relative',
                          transition: 'all 0.2s',
                          cursor: hasData && onItemClick ? 'pointer' : 'default',
                          boxShadow: isSelected ? '0 0 16px rgba(255,215,0,0.5)' : 'none',
                        }}
                      >
                        {/* Skeleton base - only for first item when loading */}
                        {showSkeleton && isLoading && (
                          <Skeleton
                            variant="circular"
                            width="100%"
                            height="100%"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              bgcolor: 'background.level1',
                              zIndex: 0,
                            }}
                          />
                        )}

                        {/* Content - rendered by renderAvatar prop */}
                        {hasData ? (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              zIndex: 2, // Always above skeleton
                            }}
                          >
                            {renderAvatar(item, index, true)}
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              zIndex: 1,
                            }}
                          >
                            {renderAvatar(null, index, false)}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </Box>
      </Box>
    </Box>
  );
}

