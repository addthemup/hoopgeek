import { Box, Avatar, Typography, Stack, CircularProgress } from '@mui/joy';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { Add } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect, useMemo, startTransition } from 'react';
import { useMediaQuery } from '@mui/material';
interface FeedPost {
  id: string;
  title?: string;
  post_type: string;
  player_ids: number[] | null;
  person_id?: number | null;
  team_tricodes: string[] | null;
  status: string;
  created_at: string;
  slides?: any;
  metadata?: any;
}

export interface PostsStoriesProps {
  posts?: FeedPost[]
  currentViewingPost?: string | null | undefined
  currentSlideIndex?: number
  totalSlides?: number
  onAvatarClick?: (postId: string) => void
  onLoadMorePosts?: () => void // Callback to load more posts when scrolling near end
  favoritePlayerIds?: Set<number> // NBA player IDs that are favorited
}

export default function PostsStories({ 
  posts: externalPosts,
  currentViewingPost,
  currentSlideIndex = 0,
  totalSlides = 0,
  onAvatarClick,
  onAvatarDoubleClick,
  onAvatarHold,
  onLoadMorePosts,
  favoritePlayerIds = new Set()
}: PostsStoriesProps & {
  onAvatarDoubleClick?: (postId: string, playerId: number) => void
  onAvatarHold?: (type: 'game' | 'player' | 'post', data: any) => void
}) {
  // Detect landscape mobile orientation
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isMobileHeight = useMediaQuery('(max-height: 600px)')
  const isLandscapeMobile = isLandscape && isMobileHeight
  const isMobile = useMediaQuery('(max-width: 900px)')
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  
  // Use external posts if provided, otherwise use fetched posts
  const posts = externalPosts || fetchedPosts;
  
  // Extract unique game IDs from fun_score posts to fetch scores from nba_games table
  const gameIds = useMemo(() => {
    if (!posts) return [];
    const ids = new Set<string>();
    posts.forEach((post) => {
      if (post.post_type === 'fun_score' && (post.game_id || post.metadata?.game_id)) {
        ids.add(post.game_id || post.metadata?.game_id);
      }
    });
    return Array.from(ids);
  }, [posts]);
  
  // Fetch game scores directly from nba_games table
  const gameScoresQuery = useQuery({
    queryKey: ['nba-games-scores', gameIds],
    queryFn: async () => {
      if (gameIds.length === 0) return new Map();
      
      const { data, error } = await supabase
        .from('nba_games')
        .select('game_id, away_team_score, home_team_score')
        .in('game_id', gameIds);
      
      if (error) {
        console.error('Error fetching game scores:', error);
        return new Map();
      }
      
      const results = new Map<string, { awayPoints: number; homePoints: number }>();
      if (data) {
        data.forEach((game: any) => {
          results.set(game.game_id, {
            awayPoints: game.away_team_score || 0,
            homePoints: game.home_team_score || 0,
          });
        });
      }
      
      console.log('Fetched game scores from nba_games:', {
        requested: gameIds.length,
        found: results.size,
        gameIds: Array.from(results.keys())
      });
      
      return results;
    },
    enabled: gameIds.length > 0,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });
  
  // Create a map of gameId -> game data for quick lookup
  const gameScoresMap = useMemo(() => {
    return gameScoresQuery.data || new Map();
  }, [gameScoresQuery.data]);
  
  // State for tracking selected game and avatar positions
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [pathKey, setPathKey] = useState(0); // Force re-render of paths
  const avatarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for infinite avatar scrolling
  // Start with 1 avatar (will be updated immediately on mobile in useEffect)
  const [visibleAvatarCount, setVisibleAvatarCount] = useState(1);
  const [loadingMoreAvatars, setLoadingMoreAvatars] = useState(false);
  const [loadedAvatars, setLoadedAvatars] = useState<Set<string>>(new Set()); // Track which avatars have loaded
  const [avatarImageErrors, setAvatarImageErrors] = useState<Set<string>>(new Set()); // Track which avatar images failed to load
  const [avatarImageLoaded, setAvatarImageLoaded] = useState<Set<string>>(new Set()); // Track which avatar images successfully loaded
  const lastScrollLeft = useRef<number>(0);
  const isLoadingRef = useRef<boolean>(false);
  const visibleCountRef = useRef<number>(1); // Keep ref in sync with state
  const loadMoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track click timers for double-click detection (per avatar)
  const clickTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const holdTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastClickTimeRef = useRef<Map<string, number>>(new Map());
  
  // Banner display mode per avatar: 'fp' | 'pts-reb-ast' | 'prop-hit-rate'
  const [bannerModes, setBannerModes] = useState<Map<string, 'fp' | 'pts-reb-ast' | 'prop-hit-rate'>>(new Map());
  
  // Cycle banner mode for an avatar
  const cycleBannerMode = (postId: string, hasPropHitRate: boolean) => {
    setBannerModes(prev => {
      const newModes = new Map(prev)
      const currentMode = newModes.get(postId) || 'fp'
      
      let nextMode: 'fp' | 'pts-reb-ast' | 'prop-hit-rate'
      if (currentMode === 'fp') {
        nextMode = 'pts-reb-ast'
      } else if (currentMode === 'pts-reb-ast') {
        nextMode = hasPropHitRate ? 'prop-hit-rate' : 'fp'
      } else {
        nextMode = 'fp'
      }
      
      newModes.set(postId, nextMode)
      return newModes
    })
  }
  
  // Effect to slide active avatar to left when currentViewingPost changes
  useEffect(() => {
    if (!currentViewingPost || !containerRef.current) {
      return;
    }
    
    // Use retry mechanism to ensure avatar is rendered before scrolling
    let retries = 0;
    const maxRetries = 20; // Try for up to 2 seconds (20 * 100ms)
    
    const scrollToActiveAvatar = () => {
      const activeAvatar = avatarRefs.current.get(currentViewingPost);
      const container = containerRef.current;
      
      if (!activeAvatar || !container) {
        if (retries < maxRetries) {
          retries++;
          setTimeout(scrollToActiveAvatar, 100); // Retry every 100ms
        } else {
          console.warn('⚠️ PostsStories: Active avatar not found after retries:', currentViewingPost);
        }
        return;
      }
      
      // Calculate scroll position to put avatar at far left of visible container
      const containerRect = container.getBoundingClientRect();
      const avatarRect = activeAvatar.getBoundingClientRect();
      const currentScrollLeft = container.scrollLeft;
      
      // Calculate avatar's position relative to the scrollable content
      // avatarRect.left is relative to viewport, containerRect.left is container's viewport position
      const avatarOffsetFromContainer = avatarRect.left - containerRect.left;
      const avatarAbsolutePosition = currentScrollLeft + avatarOffsetFromContainer;
      
      // Scroll so the avatar is at the far left (position 0) of the scrollable container
      // This will position it at the left edge of the visible area
      const targetScrollLeft = Math.max(0, avatarAbsolutePosition);
      
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
      
      console.log('📍 PostsStories: Scrolled active avatar to left', {
        postId: currentViewingPost,
        targetScrollLeft,
        currentScrollLeft,
        avatarOffsetFromContainer
      });
    };
    
    // Start scrolling after a small delay to ensure DOM is updated
    setTimeout(scrollToActiveAvatar, 50);
  }, [currentViewingPost]); // Only depend on currentViewingPost, not posts.length (prevents scroll reset when loading more)
  
  // Get the most featured player from each post's slides
  const getPostRepresentatives = () => {
    if (!posts) return [];
    
    return posts.map((post) => {
      // Parse slides
      const slides = typeof post.slides === 'string' ? JSON.parse(post.slides) : (post.slides || []);
      
      // Use person_id from database if available (new approach)
      let mostFeaturedPlayer = 0;
      if (post.person_id) {
        mostFeaturedPlayer = post.person_id;
      } else {
        // Fallback: Count personId occurrences in slides (old approach for backwards compatibility)
        const playerCounts = new Map<number, number>();
        slides.forEach((slide: any) => {
          const personId = slide.metadata?.personId;
          if (personId) {
            playerCounts.set(personId, (playerCounts.get(personId) || 0) + 1);
          }
        });
        
        // Find the player that appears most
        let maxCount = 0;
        playerCounts.forEach((count, playerId) => {
          if (count > maxCount) {
            maxCount = count;
            mostFeaturedPlayer = playerId;
          }
        });
        
        // Fallback to first player_id if no personId found in slides
        if (!mostFeaturedPlayer && post.player_ids && post.player_ids.length > 0) {
          mostFeaturedPlayer = post.player_ids[0];
        }
      }
      
      // Get the team tricode and player name for the most featured player by finding them from slides
      let teamTricode = '';
      let playerName = '';
      if (mostFeaturedPlayer > 0) {
        // Find the teamTricode and playerName from slides where this player appears
        for (const slide of slides) {
          if (slide.metadata?.personId === mostFeaturedPlayer) {
            if (slide.metadata?.teamTricode && !teamTricode) {
              teamTricode = slide.metadata.teamTricode;
            }
            // Try to get player name from various metadata fields
            if (!playerName) {
              playerName = slide.metadata?.playerName || 
                          slide.metadata?.playerNameI || 
                          slide.metadata?.name ||
                          (slide.metadata?.firstName && slide.metadata?.lastName 
                            ? `${slide.metadata.firstName} ${slide.metadata.lastName}` 
                            : '');
            }
            // If we found both, we can break
            if (teamTricode && playerName) break;
          }
        }
      }
      
      // Fallback: use first team in array if we couldn't find player's team from slides
      if (!teamTricode && post.team_tricodes && post.team_tricodes.length > 0) {
        teamTricode = post.team_tricodes[0];
      }
      
      // Fallback: use post title if no player name found
      if (!playerName) {
        playerName = post.title || '';
      }
      
      // Parse metadata for fun_score posts
      const parsedMetadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {});
      
      return {
        postId: post.id,
        playerId: mostFeaturedPlayer,
        teamTricode: teamTricode,
        playerName: playerName,
        postType: post.post_type,
        postTitle: post.title || 'Highlight',
        slideCount: slides.length,
        metadata: parsedMetadata,
        teamTricodes: post.team_tricodes || [],
        gameDate: post.game_date || post.created_at,
        gameId: post.game_id || parsedMetadata?.game_id // Also check post.game_id directly
      };
    }).filter(rep => {
      // Include fun_score posts even without a player, or posts with valid players
      return rep.postType === 'fun_score' || rep.playerId > 0;
    });
  };

  // Memoize post representatives - use ref to cache result and prevent unnecessary recalculations
  const allPostRepresentativesRef = useRef<any[]>([])
  const postsIdsRef = useRef<string>('')
  
  const allPostRepresentatives = useMemo(() => {
    // Create a stable ID string from posts to detect actual changes
    const currentPostsIds = (posts || []).map(p => p?.id).join(',')
    
    // Only recalculate if post IDs actually changed
    if (currentPostsIds !== postsIdsRef.current) {
      postsIdsRef.current = currentPostsIds
      const newReps = getPostRepresentatives()
      allPostRepresentativesRef.current = newReps
      return newReps
    }
    
    // Return cached result if posts haven't actually changed
    return allPostRepresentativesRef.current
  }, [posts])
  
  // Progressive loading: Load initial batch, then lazy load more on scroll
  // Only reset if we're starting fresh (no avatars visible) or if posts decreased
  const prevPostsLengthRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!allPostRepresentatives || allPostRepresentatives.length === 0) {
      setVisibleAvatarCount(1);
      setLoadedAvatars(new Set());
      prevPostsLengthRef.current = 0;
      hasInitializedRef.current = false;
      return;
    }

    const currentLength = allPostRepresentatives.length;
    const prevLength = prevPostsLengthRef.current;
    const currentVisible = visibleCountRef.current;
    const hasInitialized = hasInitializedRef.current;
    
    // On mobile: Only initialize once, never reset after that
    if (isMobile && allPostRepresentatives.length > 0) {
      // Only set initial batch if we haven't initialized yet
      if (!hasInitialized) {
        // Mark initial batch as loaded
        const initialBatch = Math.min(30, allPostRepresentatives.length);
        setLoadedAvatars((prev) => {
          const newSet = new Set(prev);
          allPostRepresentatives.slice(0, initialBatch).forEach((rep) => {
            newSet.add(rep.postId);
          });
          return newSet;
        });
        // Show initial batch on mobile
        setVisibleAvatarCount(initialBatch);
        visibleCountRef.current = initialBatch;
        prevPostsLengthRef.current = currentLength;
        hasInitializedRef.current = true;
        console.log('📱 PostsStories: Mobile - showing initial batch', {
          totalAvatars: allPostRepresentatives.length,
          visibleCount: initialBatch
        });
      } else {
        // Already initialized - just update the ref, don't reset anything
        prevPostsLengthRef.current = currentLength;
      }
      return;
    }
    
    // First, mark first avatar as loaded immediately (auto-load)
    const firstPostId = allPostRepresentatives[0]?.postId;
    if (firstPostId) {
      setLoadedAvatars((prev) => {
        const newSet = new Set(prev);
        newSet.add(firstPostId);
        return newSet;
      });
      
      // Show first avatar immediately
      setVisibleAvatarCount(1);
      visibleCountRef.current = 1;
    }
    
    // Then progressively load the rest after first avatar is visible
    if (allPostRepresentatives.length > 1) {
      const timeoutId = setTimeout(() => {
        // Mark all avatars as loaded
        setLoadedAvatars((prev) => {
          const newSet = new Set(prev);
          allPostRepresentatives.forEach((rep) => {
            newSet.add(rep.postId);
          });
          return newSet;
        });
        
        // Show all remaining avatars progressively
        const totalAvatars = Math.min(20, allPostRepresentatives.length);
        let currentCount = 1;
        const intervalId = setInterval(() => {
          currentCount += 1;
          if (currentCount <= totalAvatars) {
            setVisibleAvatarCount(currentCount);
            visibleCountRef.current = currentCount;
          } else {
            clearInterval(intervalId);
          }
        }, 100); // Load one avatar every 100ms after first one
        
        return () => clearInterval(intervalId);
      }, 200); // 200ms delay after first avatar loads
      
      return () => clearTimeout(timeoutId);
    }
  }, [allPostRepresentatives, isMobile]);
  
  // Keep ref in sync with state
  useEffect(() => {
    visibleCountRef.current = visibleAvatarCount;
  }, [visibleAvatarCount]);

  // Clean up image loading state when posts change
  useEffect(() => {
    if (!allPostRepresentatives || allPostRepresentatives.length === 0) {
      setAvatarImageErrors(new Set());
      setAvatarImageLoaded(new Set());
      return;
    }
    
    // Keep only state for posts that still exist
    const currentPostIds = new Set(allPostRepresentatives.map(rep => rep.postId));
    setAvatarImageErrors(prev => {
      const filtered = new Set<string>();
      prev.forEach(postId => {
        if (currentPostIds.has(postId)) {
          filtered.add(postId);
        }
      });
      return filtered;
    });
    setAvatarImageLoaded(prev => {
      const filtered = new Set<string>();
      prev.forEach(postId => {
        if (currentPostIds.has(postId)) {
          filtered.add(postId);
        }
      });
      return filtered;
    });
  }, [allPostRepresentatives]);

  // Track previous length to detect when new posts are loaded
  const prevAllPostRepresentativesLength = useRef<number>(0);
  const wasLoadingMoreRef = useRef<boolean>(false);
  
  // Initialize ref on mount
  useEffect(() => {
    prevAllPostRepresentativesLength.current = allPostRepresentatives.length;
  }, []);
  
  // Effect to append new avatars when new posts are loaded (instead of replacing)
  // On mobile, this should NOT run if we're already showing avatars - let scroll handler manage it
  useEffect(() => {
    const currentLength = allPostRepresentatives.length;
    const prevLength = prevAllPostRepresentativesLength.current;
    const wasLoading = wasLoadingMoreRef.current;
    const currentVisible = visibleCountRef.current;
    
    // On mobile: Don't auto-append if we already have avatars showing - let user scroll to trigger load
    // Only append on desktop or if we're starting fresh
    if (isMobile && currentVisible > 1) {
      // Just update the ref, don't add avatars automatically
      prevAllPostRepresentativesLength.current = currentLength;
      if (wasLoading) {
        wasLoadingMoreRef.current = false;
        setLoadingMoreAvatars(false);
        isLoadingRef.current = false;
      }
      return;
    }
    
    // If new posts were added (length increased)
    if (currentLength > prevLength && prevLength > 0) {
      const container = containerRef.current;
      
      if (container) {
        // Preserve current scroll position
        const preservedScrollLeft = container.scrollLeft;
        
        // Always add 15 more avatars (same as initial load) when new posts are loaded
        // This matches the initial load behavior and provides consistent infinite scrolling
        const avatarsToAdd = 15;
        setVisibleAvatarCount(prev => {
          const newCount = Math.min(prev + avatarsToAdd, currentLength);
          visibleCountRef.current = newCount;
          console.log('📈 PostsStories: Appending new avatars', {
            prevCount: prev,
            newCount,
            avatarsToAdd,
            totalAvatars: currentLength,
            wasLoading
          });
          return newCount;
        });
        
        // Restore scroll position after DOM update
        // Use multiple requestAnimationFrame calls to ensure DOM is fully updated
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (container) {
              container.scrollLeft = preservedScrollLeft;
              console.log('📍 PostsStories: Preserved scroll position', {
                preservedScrollLeft,
                actualScrollLeft: container.scrollLeft
              });
            }
          });
        });
        
        // Reset loading flag
        wasLoadingMoreRef.current = false;
        setLoadingMoreAvatars(false);
        isLoadingRef.current = false;
        
        // Clear timeout if posts arrived
        if (loadMoreTimeoutRef.current) {
          clearTimeout(loadMoreTimeoutRef.current);
          loadMoreTimeoutRef.current = null;
        }
      } else {
        // Container not ready yet, but still update the ref and reset loading
        console.log('⚠️ PostsStories: Container not ready, but new posts detected', {
          currentLength,
          prevLength
        });
        wasLoadingMoreRef.current = false;
        setLoadingMoreAvatars(false);
        isLoadingRef.current = false;
        if (loadMoreTimeoutRef.current) {
          clearTimeout(loadMoreTimeoutRef.current);
          loadMoreTimeoutRef.current = null;
        }
      }
      
      // Update ref after processing
      prevAllPostRepresentativesLength.current = currentLength;
    } else if (wasLoading && currentLength === prevLength) {
      // We were loading but no new posts arrived - this can happen if loadMorePosts returns early
      // Check if we've actually reached the end by checking if visible count equals total
      const currentVisible = visibleCountRef.current;
      if (currentVisible >= currentLength) {
        // We've shown all available avatars, but loadMorePosts might have returned early
        // Reset loading state and let the scroll handler try again
        console.log('⚠️ PostsStories: Loading but no new posts - resetting state (will retry on next scroll)', {
          currentVisible,
          currentLength,
          prevLength
        });
        wasLoadingMoreRef.current = false;
        setLoadingMoreAvatars(false);
        isLoadingRef.current = false;
        if (loadMoreTimeoutRef.current) {
          clearTimeout(loadMoreTimeoutRef.current);
          loadMoreTimeoutRef.current = null;
        }
      }
    }
    
    // Always update ref for next comparison (even if we didn't show new avatars)
    prevAllPostRepresentativesLength.current = currentLength;
  }, [allPostRepresentatives.length]);
  
  
  // Only show first N avatars (for infinite scroll effect)
  // On mobile, show visible count (starts at 30, increases as user scrolls)
  // Memoize to prevent re-renders during scroll
  const postRepresentatives = useMemo(() => {
    return allPostRepresentatives.slice(0, visibleAvatarCount);
  }, [allPostRepresentatives, visibleAvatarCount]);

  // Effect to detect horizontal scroll and load more avatars
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // On mobile, use passive scroll listener to prevent re-renders
    let scrollTimeout: NodeJS.Timeout | null = null;
    let lastPathUpdate = 0;
    let lastScrollCheck = 0;
    const PATH_UPDATE_THROTTLE = 100; // Only update path every 100ms
    const SCROLL_CHECK_THROTTLE = 200; // Only check for loading more every 200ms on mobile
    
    const handleScroll = () => {
      // On mobile, DON'T update path during horizontal scroll - it causes re-renders
      // Only update path on desktop where it's needed for connection lines
      if (!isMobile) {
        const now = Date.now();
        if (now - lastPathUpdate > PATH_UPDATE_THROTTLE) {
          setPathKey(prev => prev + 1);
          lastPathUpdate = now;
        }
      }
      
      // On mobile, throttle the loading check to prevent excessive checks during scroll
      const now = Date.now();
      if (isMobile && now - lastScrollCheck < SCROLL_CHECK_THROTTLE) {
        return; // Skip this scroll event on mobile if too soon
      }
      lastScrollCheck = now;
      
      // Check if scrolling right (loading more avatars)
      const currentScrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      
      // If scrolled near the end (within 500px of right edge on mobile, 300px on desktop), load more avatars
      // Increased threshold on mobile to prevent loading too early during scroll
      const loadThreshold = isMobile ? 500 : 300;
      const distanceFromEnd = scrollWidth - (currentScrollLeft + clientWidth);
      const totalAvatars = allPostRepresentatives.length;
      const currentVisible = visibleCountRef.current;
      
      // Check if we should load more (and not already loading)
      // On mobile: load more avatars from current batch, reset after 100
      if (distanceFromEnd < loadThreshold && !isLoadingRef.current) {
        if (currentVisible < totalAvatars && currentVisible < 100) {
          // We have more avatars to show from existing posts (up to 100)
          isLoadingRef.current = true;
          setLoadingMoreAvatars(true);
          
          // Clear any existing timeout
          if (loadMoreTimeoutRef.current) {
            clearTimeout(loadMoreTimeoutRef.current);
          }
          
          // After loading delay, add more avatars (load 20 more at a time)
          // Use startTransition to mark as non-urgent update to prevent blocking scroll
          loadMoreTimeoutRef.current = setTimeout(() => {
            startTransition(() => {
              setVisibleAvatarCount(prev => {
                const newCount = Math.min(prev + 20, Math.min(totalAvatars, 100));
                visibleCountRef.current = newCount;
                
                // Mark new avatars as loaded
                setLoadedAvatars((prevLoaded) => {
                  const newSet = new Set(prevLoaded);
                  allPostRepresentatives.slice(prev, newCount).forEach((rep) => {
                    newSet.add(rep.postId);
                  });
                  return newSet;
                });
                
                return newCount;
              });
            });
            setLoadingMoreAvatars(false);
            isLoadingRef.current = false;
            loadMoreTimeoutRef.current = null;
          }, 300); // 300ms loading animation
        } else if (currentVisible >= 100) {
          // After 100 avatars, reset and load new deck
          console.log('🔄 PostsStories: Reached 100 avatars, resetting deck');
          setVisibleAvatarCount(30); // Reset to initial batch
          visibleCountRef.current = 30;
          setLoadedAvatars((prev) => {
            const newSet = new Set();
            allPostRepresentatives.slice(0, 30).forEach((rep) => {
              newSet.add(rep.postId);
            });
            return newSet;
          });
          // Scroll back to start
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else if (onLoadMorePosts && !isMobile) {
          // On desktop: trigger loading more posts from database
          // On mobile: DON'T auto-load more posts during scroll - let user explicitly trigger it
          // This prevents re-renders during horizontal scrolling
          const postsLengthBefore = allPostRepresentatives.length;
          isLoadingRef.current = true;
          wasLoadingMoreRef.current = true;
          setLoadingMoreAvatars(true);
          
          // Clear any existing timeout
          if (loadMoreTimeoutRef.current) {
            clearTimeout(loadMoreTimeoutRef.current);
          }
          
          // Set a fallback timeout to reset loading state if no new posts arrive
          loadMoreTimeoutRef.current = setTimeout(() => {
            const postsLengthAfter = allPostRepresentatives.length;
            if (postsLengthAfter === postsLengthBefore) {
              // No new posts were added - reset loading state
              console.warn('PostsStories: Timeout waiting for new posts, resetting loading state (will retry on next scroll)', {
                postsLengthBefore,
                postsLengthAfter,
                currentVisible: visibleCountRef.current
              });
              setLoadingMoreAvatars(false);
              isLoadingRef.current = false;
              wasLoadingMoreRef.current = false;
              loadMoreTimeoutRef.current = null;
            } else {
              // Posts were added but effect might not have run - clear timeout but keep loading state
              console.log('PostsStories: Posts were added during timeout, clearing timeout');
              loadMoreTimeoutRef.current = null;
            }
          }, 5000);
          
          // Call the callback to load more posts
          console.log('PostsStories: Calling onLoadMorePosts', {
            currentVisible,
            totalAvatars,
            postsLengthBefore
          });
          if (typeof onLoadMorePosts === 'function') {
            try {
              (onLoadMorePosts as any)(true);
            } catch {
              onLoadMorePosts();
            }
          } else {
            onLoadMorePosts();
          }
        }
      }
      
      lastScrollLeft.current = currentScrollLeft;
    };
    
    // Throttle scroll handler on mobile to prevent re-renders
    const throttledHandleScroll = isMobile 
      ? () => {
          if (scrollTimeout) return;
          scrollTimeout = setTimeout(() => {
            handleScroll();
            scrollTimeout = null;
          }, 50); // Throttle to 50ms on mobile
        }
      : handleScroll;
    
    container.addEventListener('scroll', throttledHandleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    
    // Initial update
    setPathKey(prev => prev + 1);
    
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll);
      window.removeEventListener('resize', handleScroll);
      // Clear timeout on cleanup
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
        loadMoreTimeoutRef.current = null;
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = null;
      }
    };
  }, [selectedGameId, allPostRepresentatives.length, onLoadMorePosts, isMobile]);

  // Fetch feed posts (published only) - only if not provided externally
  const { data: fetchedPosts, isLoading } = useQuery({
    queryKey: ['feed-posts-stories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_posts')
        .select('id, title, post_type, player_ids, team_tricodes, status, created_at, slides, metadata, game_id, game_date, person_id')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching feed posts:', error);
        throw error;
      }

      return data as FeedPost[];
    },
    enabled: !externalPosts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Function to calculate connection paths
  const getConnectionPaths = () => {
    if (!selectedGameId || !containerRef.current) {
      console.log('No paths: selectedGameId or containerRef missing', { selectedGameId, hasContainer: !!containerRef.current });
      return [];
    }
    
    const paths: Array<{
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      height: number;
    }> = [];
    
    // Find all posts with the selected game_id
    const relatedPosts = postRepresentatives
      .map((rep, index) => ({
        ...rep,
        index,
      }))
      .filter(rep => 
        rep.postType === 'fun_score' && 
        rep.metadata?.game_id === selectedGameId
      )
      .sort((a, b) => a.index - b.index);
    
    console.log('Related posts for game', selectedGameId, ':', relatedPosts.length, relatedPosts);
    
    if (relatedPosts.length < 2) {
      console.log('Not enough related posts to connect');
      return [];
    }
    
    // Get container bounds for relative positioning
    const containerBounds = containerRef.current.getBoundingClientRect();
    
    // Create connections between consecutive related posts
    for (let i = 0; i < relatedPosts.length - 1; i++) {
      const currentPost = relatedPosts[i];
      const nextPost = relatedPosts[i + 1];
      
      const currentEl = avatarRefs.current.get(currentPost.postId);
      const nextEl = avatarRefs.current.get(nextPost.postId);
      
      console.log('Checking connection:', i, { 
        currentPost: currentPost.postId, 
        nextPost: nextPost.postId,
        hasCurrentEl: !!currentEl,
        hasNextEl: !!nextEl
      });
      
      if (currentEl && nextEl) {
        const currentBounds = currentEl.getBoundingClientRect();
        const nextBounds = nextEl.getBoundingClientRect();
        
        // Calculate relative positions within the container
        const startX = currentBounds.right - containerBounds.left;
        const endX = nextBounds.left - containerBounds.left;
        const startY = currentBounds.top - containerBounds.top + (currentBounds.height / 2);
        const endY = nextBounds.top - containerBounds.top + (nextBounds.height / 2);
        const height = currentBounds.height;
        
        console.log('Created path:', { startX, endX, startY, endY, height });
        
        paths.push({
          startX,
          startY,
          endX,
          endY,
          height,
        });
      }
    }
    
    console.log('Total paths created:', paths.length);
    return paths;
  };

  const connectionPaths = getConnectionPaths();

  // Calculate PostsStories height in landscape mobile:
  // pt (0px) + avatar height (77px) + pb (0px) + border (3px) = 80px
  // Using minimal padding to get as close to avatar height as possible
  const postsStoriesHeight = isLandscapeMobile ? 80 : 100

  return (
    <Box
      sx={{
        position: 'fixed',
        top: { xs: 0, md: 'calc((100vh - 40px) / 16)' }, // At top on mobile (nav is at bottom), below nav on desktop
        left: 0,
        right: 0,
        zIndex: 1201, // Above other avatar bars (1200) so post avatars are visible
        borderBottom: { xs: '3px solid', md: 'none' },
        borderColor: 'divider',
        pt: 0, // No padding-top - flush with nav bar
        pb: isLandscapeMobile ? 0 : { xs: 1, md: 1 }, // No padding-bottom in landscape mobile
        bgcolor: 'background.body',
        boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
        overflowY: 'hidden',
        margin: 0, // No margin
        // In landscape mobile, constrain width to 2/3 and center
        ...(isLandscapeMobile && {
          maxWidth: '66.67%',
          minWidth: '66.67%',
          mx: 'auto',
          marginTop: 0,
          marginBottom: 0,
        }),
      }}
    >
      <Box
        sx={{
          maxWidth: isLandscapeMobile 
            ? '100%' // Full width of the 2/3 container
            : { xs: '100%', sm: 805, md: 1035 }, // 15% wider, matching feed
          minWidth: isLandscapeMobile 
            ? '100%' // Full width of the 2/3 container
            : { xs: '100%', sm: 805, md: 1035 }, // Fixed width
          mx: isLandscapeMobile 
            ? 0 // No margin needed, parent handles centering
            : { xs: 'auto', sm: 'auto', md: 'calc(325px + (100% - 650px - 1035px) / 2)' }, // Center in space between standings (325px each side) on desktop
          px: isLandscapeMobile ? 0 : { xs: 2, md: 2 }, // No horizontal padding in landscape mobile
          overflowY: 'hidden',
          margin: 0, // No margin
          paddingTop: isLandscapeMobile ? 0 : undefined,
          paddingBottom: isLandscapeMobile ? 0 : undefined,
        }}
      >
        {/* Scrollable Player Avatars Container */}
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            gap: isLandscapeMobile ? '8px' : '12px', // Smaller gap in landscape mobile
            overflowX: 'auto',
            overflowY: 'hidden',
            pb: 0,
            pt: isLandscapeMobile ? 0 : undefined, // No padding-top in landscape mobile
            position: 'relative',
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
            '&::-webkit-scrollbar': {
              display: 'none', // Chrome/Safari/Opera
            },
          }}
        >
          {/* Player Avatars */}
          {isLoading && (!postRepresentatives || postRepresentatives.length === 0) ? (
            // Show subtle loading state only if we have no posts at all
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                py: 3,
              }}
            >
              <CircularProgress 
                size="sm" 
                thickness={3}
                sx={{
                  color: 'text.tertiary',
                }}
              />
            </Box>
          ) : postRepresentatives && postRepresentatives.length > 0 ? (
            <>
              {(() => {
                if (isMobile) {
                  console.log('📱 PostsStories: Rendering avatars on mobile', {
                    totalAvatars: postRepresentatives.length,
                    allPostRepresentativesLength: allPostRepresentatives.length,
                    visibleAvatarCount
                  });
                }
                return null;
              })()}
              {postRepresentatives.map((rep, index) => {
              const isActive = currentViewingPost === rep.postId;
              const progress = isActive && totalSlides > 0 
                ? ((currentSlideIndex + 1) / totalSlides) * 100 
                : 0;
              
              // Check if this avatar has loaded (for fade-in animation)
              // On mobile, always show immediately to avoid skeleton-only state
              const isLoaded = isMobile ? true : loadedAvatars.has(rep.postId);
              // On mobile, always show all avatars (postRepresentatives already contains all on mobile)
              const shouldShow = isMobile ? true : index < visibleAvatarCount;
              
              // Get team colors with fallback to prevent black avatars
              const primaryColor = getTeamPrimaryColor(rep.teamTricode) || '#1a1a1a';
              const secondaryColor = getTeamSecondaryColor(rep.teamTricode) || '#333333';
              
              // Check if this is a fun_score post
              const isFunScore = rep.postType === 'fun_score';
              const isGameSelected = isFunScore && rep.metadata?.game_id === selectedGameId;
              
              // Extract team tricodes and scores for fun_score posts
              let awayTricode = '';
              let homeTricode = '';
              let awayPoints = 0;
              let homePoints = 0;
              
              if (isFunScore) {
                // Try to get team tricodes and scores from multiple sources
                const storyData = rep.metadata?.story_data || {};
                
                // First, try to get from metadata directly
                let awayTeam = rep.metadata?.awayTeam;
                let homeTeam = rep.metadata?.homeTeam;
                
                // If not in metadata root, try story_data.teams
                if (!awayTeam || !homeTeam) {
                  const teams = storyData?.teams || {};
                  awayTeam = awayTeam || teams?.away || teams?.loser;
                  homeTeam = homeTeam || teams?.home || teams?.winner;
                }
                
                // Extract tricodes - try multiple field names
                let awayAbbr = awayTeam?.abbreviation || awayTeam?.tricode || awayTeam?.teamTricode;
                let homeAbbr = homeTeam?.abbreviation || homeTeam?.tricode || homeTeam?.teamTricode;
                
                // If we have team_tricodes array, use it (might be [away, home] or [home, away])
                if (rep.teamTricodes && rep.teamTricodes.length >= 2) {
                  // Check if we can match them to away/home
                  if (awayAbbr && homeAbbr) {
                    // We know the order, use metadata to determine array order
                    const awayIdx = rep.teamTricodes.indexOf(awayAbbr);
                    const homeIdx = rep.teamTricodes.indexOf(homeAbbr);
                    if (awayIdx >= 0 && homeIdx >= 0) {
                      awayTricode = rep.teamTricodes[awayIdx];
                      homeTricode = rep.teamTricodes[homeIdx];
                    } else {
                      // Fallback: assume first is away, second is home
                      awayTricode = rep.teamTricodes[0];
                      homeTricode = rep.teamTricodes[1];
                    }
                  } else {
                    // No metadata to verify order, assume [away, home]
                    awayTricode = rep.teamTricodes[0];
                    homeTricode = rep.teamTricodes[1];
                  }
                } else if (awayAbbr && homeAbbr) {
                  // Use abbreviations from metadata
                  awayTricode = awayAbbr;
                  homeTricode = homeAbbr;
                }
                
                // Get scores from metadata (prioritize metadata over database)
                // First try direct metadata points (can be number or null)
                if (typeof awayTeam?.points === 'number' && typeof homeTeam?.points === 'number') {
                  awayPoints = awayTeam.points;
                  homePoints = homeTeam.points;
                } else {
                  // Try story_data.teams structure (most reliable source)
                  const teams = storyData?.teams || {};
                  const winnerPoints = teams?.winner?.points;
                  const loserPoints = teams?.loser?.points;
                  
                  if (typeof winnerPoints === 'number' && typeof loserPoints === 'number') {
                    // Determine which is away/home based on tricodes
                    const winnerTricode = teams?.winner?.tricode || teams?.winner?.abbreviation;
                    const loserTricode = teams?.loser?.tricode || teams?.loser?.abbreviation;
                    
                    if (awayTricode && homeTricode && winnerTricode && loserTricode) {
                      if (winnerTricode === homeTricode) {
                        homePoints = winnerPoints;
                        awayPoints = loserPoints;
                      } else if (winnerTricode === awayTricode) {
                        awayPoints = winnerPoints;
                        homePoints = loserPoints;
                      } else {
                        // Can't determine, use winner/loser as fallback (winner = home)
                        homePoints = winnerPoints;
                        awayPoints = loserPoints;
                      }
                    } else {
                      // Fallback: assume winner is home
                      homePoints = winnerPoints;
                      awayPoints = loserPoints;
                    }
                  } else {
                    // Last resort: try final_score string parsing
                    if (storyData?.final_score) {
                      const scoreMatch = storyData.final_score.match(/(\d+)\s*-\s*(\d+)/);
                      if (scoreMatch) {
                        const matchup = storyData.matchup || '';
                        if (awayTricode && homeTricode && matchup.includes(awayTricode) && matchup.includes(homeTricode)) {
                          const awayIdx = matchup.indexOf(awayTricode);
                          const homeIdx = matchup.indexOf(homeTricode);
                          if (awayIdx < homeIdx) {
                            // Away team mentioned first
                            awayPoints = parseInt(scoreMatch[1], 10);
                            homePoints = parseInt(scoreMatch[2], 10);
                          } else {
                            // Home team mentioned first
                            awayPoints = parseInt(scoreMatch[2], 10);
                            homePoints = parseInt(scoreMatch[1], 10);
                          }
                        } else {
                          // Fallback: assume first score is away
                          awayPoints = parseInt(scoreMatch[1], 10);
                          homePoints = parseInt(scoreMatch[2], 10);
                        }
                      }
                    }
                  }
                }
                
                // Fallback to database if metadata doesn't have scores
                if ((awayPoints === 0 && homePoints === 0) || (awayPoints == null && homePoints == null)) {
                  const gameId = rep.gameId || rep.metadata?.game_id;
                  if (gameId && gameScoresMap.has(gameId)) {
                    const scores = gameScoresMap.get(gameId)!;
                    awayPoints = scores.awayPoints;
                    homePoints = scores.homePoints;
                  }
                }
              }

              // Mobile interaction handlers
              const isMobileDevice = window.innerWidth < 900
              
              const handleTouchStart = (e: React.TouchEvent) => {
                if (!isMobileDevice) return
                e.preventDefault()
                
                // Clear any existing timers for this avatar
                const existingHoldTimer = holdTimersRef.current.get(rep.postId)
                if (existingHoldTimer) {
                  clearTimeout(existingHoldTimer)
                }
                
                // Start hold timer (500ms)
                const holdTimer = setTimeout(() => {
                  // Hold detected - show modal
                  if (isActive) {
                    // Active avatar: show module based on banner mode
                    const bannerMode = bannerModes.get(rep.postId) || 'fp'
                    if (onAvatarHold) {
                      onAvatarHold('player', {
                        playerId: rep.playerId,
                        playerName: rep.postTitle,
                        bannerMode: bannerMode,
                        metadata: rep.metadata
                      })
                    }
                  } else {
                    // Inactive avatar: show description + share
                    if (onAvatarHold) {
                      onAvatarHold('post', {
                        postId: rep.postId,
                        postTitle: rep.postTitle,
                        playerName: rep.playerName,
                        description: `View ${rep.postTitle}'s highlights`
                      })
                    }
                  }
                  holdTimersRef.current.delete(rep.postId)
                }, 500)
                
                holdTimersRef.current.set(rep.postId, holdTimer)
              }
              
              const handleTouchEnd = (e: React.TouchEvent) => {
                if (!isMobileDevice) return
                e.preventDefault()
                
                // Scroll avatar bar all the way to the left to show what's playing
                if (containerRef.current) {
                  containerRef.current.scrollTo({
                    left: 0,
                    behavior: 'smooth'
                  });
                }
                
                // Clear hold timer
                const holdTimer = holdTimersRef.current.get(rep.postId)
                if (holdTimer) {
                  clearTimeout(holdTimer)
                  holdTimersRef.current.delete(rep.postId)
                  
                  // Check for double click
                  const now = Date.now()
                  const lastClick = lastClickTimeRef.current.get(rep.postId) || 0
                  const timeSinceLastClick = now - lastClick
                  
                  if (timeSinceLastClick < 300 && lastClick > 0) {
                    // Double click detected - queue player posts
                    if (rep.playerId && onAvatarDoubleClick) {
                      onAvatarDoubleClick(rep.postId, rep.playerId)
                    }
                    lastClickTimeRef.current.set(rep.postId, 0)
                  } else {
                    // Single click - cycle banner mode if active, otherwise navigate
                    lastClickTimeRef.current.set(rep.postId, now)
                    
                    const clickTimer = setTimeout(() => {
                      if (isActive) {
                        // Active avatar: cycle banner mode
                        const hasPropHitRate = rep.metadata?.propHitRate !== undefined
                        cycleBannerMode(rep.postId, hasPropHitRate)
                      } else {
                        // Inactive avatar: navigate to post
                        // Handle fun_score game selection (toggle)
                        if (isFunScore && rep.metadata?.game_id) {
                          const gameId = rep.metadata.game_id;
                          const newSelectedId = selectedGameId === gameId ? null : gameId;
                          setSelectedGameId(newSelectedId);
                        }
                        
                        if (onAvatarClick) {
                          console.log('🎯 PostsStories: Avatar clicked, calling onAvatarClick with postId:', rep.postId, 'rep:', rep)
                          onAvatarClick(rep.postId);
                        } else {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }
                      clickTimersRef.current.delete(rep.postId)
                    }, 300)
                    
                    clickTimersRef.current.set(rep.postId, clickTimer)
                  }
                }
              }
              
              const handleMouseDown = (e: React.MouseEvent) => {
                if (isMobileDevice) return
                
                // Desktop: same as old onClick
                if (isFunScore && rep.metadata?.game_id) {
                  const gameId = rep.metadata.game_id;
                  const newSelectedId = selectedGameId === gameId ? null : gameId;
                  setSelectedGameId(newSelectedId);
                }
                
                if (onAvatarClick) {
                  console.log('🎯 PostsStories: Avatar clicked (desktop), calling onAvatarClick with postId:', rep.postId, 'rep:', rep)
                  // Scroll avatar bar all the way to the left to show what's playing
                  if (containerRef.current) {
                    containerRef.current.scrollTo({
                      left: 0,
                      behavior: 'smooth'
                    });
                  }
                  onAvatarClick(rep.postId);
                } else {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }

              // Only render if this avatar should be visible
              if (!shouldShow) return null;

              // On mobile, use regular div to prevent re-renders during scroll
              // Use stable key to prevent React from re-rendering on scroll
              // Always use regular div - don't fade in/out entire avatar to prevent black appearance
              const AvatarWrapper = 'div';
              const avatarProps = {};

              return (
                <AvatarWrapper
                  key={`avatar-${rep.postId}`} // Stable key
                  ref={(el) => {
                    if (el) {
                      avatarRefs.current.set(rep.postId, el);
                    } else {
                      avatarRefs.current.delete(rep.postId);
                    }
                  }}
                  // Touch handlers moved to overlay on mobile
                  {...(isMobile ? {} : {
                    onTouchStart: handleTouchStart,
                    onTouchEnd: handleTouchEnd,
                    onMouseDown: handleMouseDown,
                  })}
                  {...avatarProps}
                  style={{
                    cursor: 'pointer',
                    flexShrink: 0,
                    textAlign: 'center',
                    position: 'relative',
                    zIndex: isGameSelected ? 10 : 2,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    opacity: 1, // Always visible - don't fade entire avatar
                    // Prevent layout shifts during scroll
                    willChange: isMobile ? 'auto' : 'transform',
                  }}
                >
                  {/* Circular Progress Indicator */}
                  {isActive && (
                    <CircularProgress
                      determinate
                      value={progress}
                      size="lg"
                      sx={{
                        position: 'absolute',
                        top: -3,
                        left: -3,
                        '--CircularProgress-size': { xs: '85px', md: '91px' },
                        '--CircularProgress-trackThickness': '3px',
                        '--CircularProgress-progressThickness': '3px',
                        '--CircularProgress-progressColor': secondaryColor,
                        '--CircularProgress-trackColor': 'rgba(0,0,0,0.1)',
                        zIndex: 2,
                      }}
                    />
                  )}
                  
                  {isFunScore ? (
                    // Fun Score Avatar - Split Team Logos with Score (like GamesAvatarBar)
                    <Box
                      sx={{
                        width: { xs: 77, md: 83 },
                        height: { xs: 77, md: 83 },
                        border: isGameSelected 
                          ? `4px solid`
                          : isActive 
                            ? `3px solid #FFC72C` 
                            : `3px dashed`,
                        borderColor: isGameSelected 
                          ? 'text.primary'
                          : isActive 
                            ? '#FFC72C'
                            : 'text.primary',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        bgcolor: 'background.level1',
                        position: 'relative',
                        transition: 'all 0.2s',
                        boxShadow: isGameSelected ? '0 0 16px rgba(255,215,0,0.5)' : 'none',
                        '&:hover': {
                          transform: 'scale(1.05)',
                        },
                      }}
                    >
                      {/* Split background with team colors */}
                      {awayTricode && homeTricode ? (
                        <>
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: '50%',
                              height: '100%',
                              bgcolor: getTeamPrimaryColor(awayTricode) || '#1a1a1a',
                            }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              width: '50%',
                              height: '100%',
                              bgcolor: getTeamPrimaryColor(homeTricode) || '#1a1a1a',
                            }}
                          />
                        </>
                      ) : (
                        // Fallback: solid background if no team data
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            bgcolor: 'background.level1',
                          }}
                        />
                      )}
                      
                      {/* Team logos - positioned like GamesAvatarBar */}
                      {awayTricode && homeTricode ? (
                        <>
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: '50%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 1,
                            }}
                          >
                            <Box
                              component="img"
                              src={getTeamLogoUrl(awayTricode)}
                              alt={awayTricode}
                              sx={{
                                width: { xs: 28, md: 32 },
                                height: { xs: 28, md: 32 },
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </Box>
                          
                          <Box
                            sx={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              width: '50%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 1,
                            }}
                          >
                            <Box
                              component="img"
                              src={getTeamLogoUrl(homeTricode)}
                              alt={homeTricode}
                              sx={{
                                width: { xs: 28, md: 32 },
                                height: { xs: 28, md: 32 },
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </Box>
                        </>
                      ) : null}

                      {/* Vertical divider line */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: '50%',
                          top: '10%',
                          bottom: '30%',
                          width: '1px',
                          bgcolor: 'rgba(0, 0, 0, 0.3)',
                          transform: 'translateX(-50%)',
                          zIndex: 1,
                        }}
                      />
                      
                      {/* Score Badge at bottom (get game score from metadata, fallback to database) */}
                      {awayTricode && homeTricode && (awayPoints != null || homePoints != null) ? (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: '8%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            bgcolor: '#FFC72C',
                            color: '#000',
                            px: 1,
                            py: 0.25,
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            fontSize: { xs: '0.7rem', md: '0.75rem' },
                            fontFamily: '"Libre Baskerville", Georgia, serif',
                            border: '2px solid',
                            borderColor: 'background.body',
                            zIndex: 2,
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {awayPoints ?? 0}-{homePoints ?? 0}
                        </Box>
                      ) : null}

                      {/* Date at top (MONTH/DAY format) */}
                      {rep.gameDate && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: '8%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            bgcolor: 'rgba(0,0,0,0.75)',
                            color: '#fff',
                            px: 0.75,
                            py: 0.25,
                            borderRadius: '4px',
                            fontSize: '0.5rem',
                            fontWeight: 'bold',
                            fontFamily: '"Libre Baskerville", Georgia, serif',
                            lineHeight: 1,
                            zIndex: 2,
                            whiteSpace: 'nowrap',
                            maxWidth: '90%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {(() => {
                            try {
                              const dateStr = String(rep.gameDate);
                              let date = new Date(dateStr);
                              
                              // If the date is stored as midnight UTC (00:00:00), it will show as previous day in EST
                              // Add 12 hours to ensure we get the correct calendar date when converting to EST
                              const utcHours = date.getUTCHours();
                              if (utcHours < 6) {
                                // If it's early morning UTC (likely stored as date-only), add 12 hours
                                date = new Date(date.getTime() + 12 * 60 * 60 * 1000);
                              }
                              
                              // Convert to EST/EDT and get the date
                              const formatter = new Intl.DateTimeFormat('en-US', {
                                timeZone: 'America/New_York',
                                month: 'numeric',
                                day: 'numeric',
                              });
                              const parts = formatter.formatToParts(date);
                              const month = parts.find(p => p.type === 'month')?.value || '';
                              const day = parts.find(p => p.type === 'day')?.value || '';
                              return `${month}/${day}`;
                            } catch {
                              return '';
                            }
                          })()}
                      </Box>
                      )}
                    </Box>
                  ) : (
                    // Player Spotlight Avatar - Same structure as fun_score but with player face in center
                    (() => {
                      // Determine player's team and opponent team
                      const playerTeamTricode = rep.teamTricode || '';
                      let opponentTeamTricode = '';
                      
                      // Find opponent team from team_tricodes array
                      if (rep.teamTricodes && rep.teamTricodes.length >= 2) {
                        // Find the team that's not the player's team
                        opponentTeamTricode = rep.teamTricodes.find(t => t !== playerTeamTricode) || rep.teamTricodes[1] || '';
                      } else if (rep.teamTricodes && rep.teamTricodes.length === 1) {
                        // Only one team in array, use it as opponent (player's team is from rep.teamTricode)
                        opponentTeamTricode = rep.teamTricodes[0] !== playerTeamTricode ? rep.teamTricodes[0] : '';
                      }
                      
                      // If we have game_id, try to get opponent from metadata
                      if (!opponentTeamTricode && rep.gameId) {
                        const storyData = rep.metadata?.story_data || {};
                        const teams = storyData?.teams || {};
                        const awayTeam = teams?.away || rep.metadata?.awayTeam;
                        const homeTeam = teams?.home || rep.metadata?.homeTeam;
                        const awayTricode = awayTeam?.tricode || awayTeam?.abbreviation || awayTeam?.teamTricode;
                        const homeTricode = homeTeam?.tricode || homeTeam?.abbreviation || homeTeam?.teamTricode;
                        
                        // Find opponent (the team that's not the player's team)
                        if (awayTricode && awayTricode !== playerTeamTricode) {
                          opponentTeamTricode = awayTricode;
                        } else if (homeTricode && homeTricode !== playerTeamTricode) {
                          opponentTeamTricode = homeTricode;
                        } else if (awayTricode) {
                          opponentTeamTricode = awayTricode;
                        } else if (homeTricode) {
                          opponentTeamTricode = homeTricode;
                        }
                      }
                      
                      const hasOpponent = !!opponentTeamTricode;
                      const opponentColor = hasOpponent ? getTeamPrimaryColor(opponentTeamTricode) : null;
                      const isFavorited = favoritePlayerIds.has(rep.playerId);
                      
                      return (
                        <Box
                          sx={{
                            width: { xs: 77, md: 83 },
                            height: { xs: 77, md: 83 },
                            border: isFavorited 
                              ? `4px solid #FF69B4` // Pink ring for favorited players
                              : isActive 
                                ? `3px solid ${secondaryColor}` 
                                : `3px dashed ${primaryColor}`,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            // Ensure background is always visible - use team color or fallback
                            bgcolor: (primaryColor === '#000000' || !primaryColor) ? '#1a1a1a' : primaryColor,
                            position: 'relative',
                            transition: 'all 0.2s',
                            boxShadow: isFavorited 
                              ? '0 0 12px rgba(255, 105, 180, 0.6)' // Pink glow for favorited
                              : 'none',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              boxShadow: isFavorited 
                                ? '0 0 16px rgba(255, 105, 180, 0.8)' 
                                : 'none',
                            },
                          }}
                        >
                          {/* Split background: player's team (left) vs opponent (right) - EXACTLY like fun_score */}
                          {hasOpponent && opponentColor ? (
                            <>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: '50%',
                                  height: '100%',
                                  bgcolor: primaryColor || '#1a1a1a',
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  width: '50%',
                                  height: '100%',
                                  bgcolor: opponentColor || '#1a1a1a',
                                }}
                              />
                            </>
                          ) : (
                            // Fallback: solid player's team color
                            <Box
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                bgcolor: primaryColor || '#1a1a1a',
                              }}
                            />
                          )}
                          
                          {/* Team logos - EXACTLY like fun_score posts */}
                          {playerTeamTricode ? (
                            <>
                              {/* Player's team logo on left side */}
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: '50%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  zIndex: 1,
                                }}
                              >
                                <Box
                                  component="img"
                                  src={getTeamLogoUrl(playerTeamTricode)}
                                  alt={playerTeamTricode}
                                  sx={{
                                    width: { xs: 28, md: 32 },
                                    height: { xs: 28, md: 32 },
                                    objectFit: 'contain',
                                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                                  }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              </Box>
                              
                              {/* Opponent team logo on right side */}
                              {hasOpponent && opponentTeamTricode ? (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    width: '50%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 1,
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={getTeamLogoUrl(opponentTeamTricode)}
                                    alt={opponentTeamTricode}
                                    sx={{
                                      width: { xs: 28, md: 32 },
                                      height: { xs: 28, md: 32 },
                                      objectFit: 'contain',
                                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                                    }}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                </Box>
                              ) : null}
                            </>
                          ) : null}

                          {/* Vertical divider line - EXACTLY like fun_score */}
                          {hasOpponent && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: '50%',
                                top: '10%',
                                bottom: '30%',
                                width: '1px',
                                bgcolor: 'rgba(0, 0, 0, 0.3)',
                                transform: 'translateX(-50%)',
                                zIndex: 1,
                              }}
                            />
                          )}
                          
                          {/* Player's face - centered, overlapping both sides */}
                          <Box
                            sx={{
                              position: 'absolute',
                              left: '50%',
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              zIndex: 2,
                              width: { xs: 65, md: 70 },
                              height: { xs: 65, md: 70 },
                              borderRadius: '50%',
                              overflow: 'hidden',
                              border: '2px solid rgba(0,0,0,0.2)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                              bgcolor: (primaryColor === '#000000' || !primaryColor) ? '#1a1a1a' : primaryColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Box
                              component="img"
                              src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${rep.playerId}.png`}
                              alt={`Player ${rep.playerId}`}
                              loading="eager"
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: avatarImageErrors.has(rep.postId) ? 'none' : 'block',
                                opacity: avatarImageLoaded.has(rep.postId) ? 1 : 0,
                                transition: 'opacity 0.3s ease-in-out',
                                // Ensure visible background while loading (not black)
                                bgcolor: (primaryColor === '#000000' || !primaryColor) ? '#1a1a1a' : primaryColor,
                                minHeight: '100%', // Ensure it takes up space
                              }}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                // Mark this avatar's image as failed
                                setAvatarImageErrors(prev => new Set(prev).add(rep.postId));
                                setAvatarImageLoaded(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(rep.postId);
                                  return newSet;
                                });
                                target.style.display = 'none';
                              }}
                              onLoad={(e) => {
                                const target = e.target as HTMLImageElement;
                                // Mark this avatar's image as loaded
                                setAvatarImageLoaded(prev => new Set(prev).add(rep.postId));
                                setAvatarImageErrors(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(rep.postId);
                                  return newSet;
                                });
                                target.style.display = 'block';
                                target.style.opacity = '1';
                              }}
                            />
                            {/* Fallback initial - shown when image fails or while loading */}
                            <Box
                              className="avatar-fallback-initial"
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontSize: { xs: '24px', md: '28px' },
                                fontWeight: 'bold',
                                pointerEvents: 'none',
                                // Always show fallback for active post until image loads, or for any post if image failed/not loaded
                                opacity: (isActive && !avatarImageLoaded.has(rep.postId)) || avatarImageErrors.has(rep.postId) || (!avatarImageLoaded.has(rep.postId) && !avatarImageErrors.has(rep.postId)) ? 1 : 0,
                                transition: 'opacity 0.3s ease-in-out',
                                zIndex: avatarImageLoaded.has(rep.postId) ? 0 : 3, // Behind image when loaded, in front when not (higher than player face zIndex: 2)
                              }}
                            >
                              {rep.playerName?.charAt(0)?.toUpperCase() || 'P'}
                            </Box>
                          </Box>
                          
                          {/* Vertical divider line (subtle) */}
                          {hasOpponent && (
                            <Box
                              sx={{
                                position: 'absolute',
                                left: '50%',
                                top: '15%',
                                bottom: '35%',
                                width: '1px',
                                bgcolor: 'rgba(0, 0, 0, 0.2)',
                                transform: 'translateX(-50%)',
                                zIndex: 1,
                              }}
                            />
                          )}
                          
                          {/* Banner Badge at bottom - cycles between FP, Pts-Reb-Ast, Prop Hit Rate */}
                          {(() => {
                            const bannerMode = bannerModes.get(rep.postId) || 'fp'
                            let badgeText = ''
                            let showBadge = false
                            
                            if (bannerMode === 'fp' && rep.metadata?.fantasyPoints !== undefined && rep.metadata.fantasyPoints > 0) {
                              badgeText = `${rep.metadata.fantasyPoints.toFixed(1)} FP`
                              showBadge = true
                            } else if (bannerMode === 'pts-reb-ast') {
                              const pts = rep.metadata?.points || 0
                              const reb = rep.metadata?.rebounds || 0
                              const ast = rep.metadata?.assists || 0
                              if (pts > 0 || reb > 0 || ast > 0) {
                                badgeText = `${pts}-${reb}-${ast}`
                                showBadge = true
                              }
                            } else if (bannerMode === 'prop-hit-rate' && rep.metadata?.propHitRate !== undefined) {
                              badgeText = `${(rep.metadata.propHitRate * 100).toFixed(0)}% Hit`
                              showBadge = true
                            }
                            
                            return showBadge ? (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: '8%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  bgcolor: '#FFC72C',
                                  color: '#000',
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: '6px',
                                  fontWeight: 'bold',
                                  fontSize: { xs: '0.7rem', md: '0.75rem' },
                                  fontFamily: '"Libre Baskerville", Georgia, serif',
                                  border: '2px solid',
                                  borderColor: 'background.body',
                                  zIndex: 3,
                                  lineHeight: 1,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {badgeText}
                              </Box>
                            ) : null
                          })()}
                        </Box>
                      );
                    })()
                  )}
                  
                  {/* Button overlay on mobile to prevent image download and make entire avatar clickable */}
                  {isMobile && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10,
                        cursor: 'pointer',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                      onMouseDown={handleMouseDown}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Prevent default image download behavior
                      }}
                    />
                  )}
                </AvatarWrapper>
              );
            })}
            
            {/* Loading indicator for more avatars */}
            {loadingMoreAvatars && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 'fit-content',
                  px: 2,
                  flexShrink: 0,
                }}
              >
                <CircularProgress size="sm" thickness={3} />
                <Typography level="body-xs" sx={{ mt: 1, color: 'text.secondary' }}>
                  Loading...
                </Typography>
              </Box>
            )}
            
            </>
          ) : null}
          
          {/* SVG Overlay for Connection Paths */}
          <AnimatePresence mode="wait">
            {connectionPaths.length > 0 && containerRef.current && (() => {
              console.log('Rendering SVG with', connectionPaths.length, 'paths');
              return (
                <motion.svg
                  key={pathKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 5,
                    overflow: 'visible',
                  }}
                >
                  {connectionPaths.map((path, index) => {
                  // Calculate the bar height (from top and bottom of avatar)
                  const barTopY = path.startY - (path.height / 2);
                  const barBottomY = path.startY + (path.height / 2);
                  const barHeight = path.height;
                  
                  // Create a path that extends from the right edge of one avatar to the left edge of the next
                  // with rounded ends that match the circular avatars
                  return (
                    <motion.g key={index}>
                      {/* Main connecting bar */}
                      <motion.rect
                        initial={{ width: 0 }}
                        animate={{ width: path.endX - path.startX }}
                        transition={{ 
                          duration: 0.5,
                          delay: index * 0.1,
                          ease: "easeInOut"
                        }}
                        x={path.startX}
                        y={barTopY}
                        height={barHeight}
                        fill="white"
                        opacity={0.9}
                        style={{
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                        }}
                      />
                      
                      {/* Left circular cap */}
                      <motion.circle
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ 
                          duration: 0.3,
                          delay: index * 0.1,
                          ease: "easeOut"
                        }}
                        cx={path.startX}
                        cy={path.startY}
                        r={path.height / 2}
                        fill="white"
                        opacity={0.9}
                        style={{
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                        }}
                      />
                      
                      {/* Right circular cap */}
                      <motion.circle
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ 
                          duration: 0.3,
                          delay: index * 0.1 + 0.5,
                          ease: "easeOut"
                        }}
                        cx={path.endX}
                        cy={path.endY}
                        r={path.height / 2}
                        fill="white"
                        opacity={0.9}
                        style={{
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                        }}
                      />
                    </motion.g>
                  );
                  })}
                </motion.svg>
              );
            })()}
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
}

