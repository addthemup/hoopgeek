import { Box, Avatar, Typography, Stack, CircularProgress, Skeleton } from '@mui/joy';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { Add } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
interface FeedPost {
  id: string;
  title?: string;
  post_type: string;
  player_ids: number[] | null;
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
}

export default function PostsStories({ 
  posts: externalPosts,
  currentViewingPost,
  currentSlideIndex = 0,
  totalSlides = 0,
  onAvatarClick
}: PostsStoriesProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  
  // State for tracking selected game and avatar positions
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [pathKey, setPathKey] = useState(0); // Force re-render of paths
  const avatarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Effect to update paths on scroll or selection change
  useEffect(() => {
    if (!selectedGameId || !containerRef.current) return;
    
    const container = containerRef.current;
    const handleScroll = () => {
      setPathKey(prev => prev + 1);
    };
    
    container.addEventListener('scroll', handleScroll);
    
    // Also update on resize
    window.addEventListener('resize', handleScroll);
    
    // Initial update
    setPathKey(prev => prev + 1);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [selectedGameId]);

  // Fetch feed posts (published only) - only if not provided externally
  const { data: fetchedPosts, isLoading } = useQuery({
    queryKey: ['feed-posts-stories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_posts')
        .select('id, title, post_type, player_ids, team_tricodes, status, created_at, slides, metadata')
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

  // Use external posts if provided, otherwise use fetched posts
  const posts = externalPosts || fetchedPosts;

  // Get the most featured player from each post's slides
  const getPostRepresentatives = () => {
    if (!posts) return [];
    
    return posts.map((post) => {
      // Parse slides
      const slides = typeof post.slides === 'string' ? JSON.parse(post.slides) : (post.slides || []);
      
      // Count personId occurrences in slides
      const playerCounts = new Map<number, number>();
      slides.forEach((slide: any) => {
        const personId = slide.metadata?.personId;
        if (personId) {
          playerCounts.set(personId, (playerCounts.get(personId) || 0) + 1);
        }
      });
      
      // Find the player that appears most
      let mostFeaturedPlayer = 0;
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
      
      // Get the team tricode (use first team in array)
      const teamTricode = post.team_tricodes && post.team_tricodes.length > 0 
        ? post.team_tricodes[0] 
        : '';
      
      // Parse metadata for fun_score posts
      const parsedMetadata = typeof post.metadata === 'string' ? JSON.parse(post.metadata) : (post.metadata || {});
      
      return {
        postId: post.id,
        playerId: mostFeaturedPlayer,
        teamTricode: teamTricode,
        postType: post.post_type,
        postTitle: post.title || 'Highlight',
        slideCount: slides.length,
        metadata: parsedMetadata,
        teamTricodes: post.team_tricodes || []
      };
    }).filter(rep => {
      // Include fun_score posts even without a player, or posts with valid players
      return rep.postType === 'fun_score' || rep.playerId > 0;
    });
  };

  const postRepresentatives = getPostRepresentatives();

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

  return (
    <Box
      sx={{
        position: 'fixed',
        top: { xs: '49px', md: '57px' }, // Flush against TopNavigation
        left: 0,
        right: 0,
        zIndex: 1050,
        borderBottom: { xs: '3px solid', md: 'none' },
        borderColor: 'divider',
        pt: { xs: 1.5, md: 1.5 }, // Extra top padding for breathing room
        pb: { xs: 1, md: 1 },
        bgcolor: 'background.body',
        boxShadow: { xs: '0 2px 4px rgba(0,0,0,0.3)', md: 'none' },
      }}
    >
      <Box
        sx={{
          maxWidth: { xs: '100%', sm: 805, md: 1035 }, // 15% wider, matching feed
          minWidth: { xs: '100%', sm: 805, md: 1035 }, // Fixed width
          mx: 'auto',
          px: { xs: 2, md: 2 },
        }}
      >
        {/* Scrollable Player Avatars Container */}
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            gap: '12px', // 12px gap between avatars for better spacing
            overflowX: 'auto',
            pb: 0.5,
            position: 'relative',
            '&::-webkit-scrollbar': {
              height: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'var(--joy-palette-neutral-600)',
              borderRadius: '4px',
            },
          }}
        >
          {/* Player Avatars */}
          {isLoading ? (
            // Show skeleton avatars while loading
            <>
              {[...Array(5)].map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    minWidth: 'fit-content',
                  }}
                >
                  {/* Skeleton Circle */}
                  <Skeleton
                    variant="circular"
                    width={{ xs: 77, md: 83 }}
                    height={{ xs: 77, md: 83 }}
                    sx={{
                      bgcolor: 'background.level1',
                      border: '3px solid',
                      borderColor: 'text.primary',
                    }}
                  />
                  
                  {/* Skeleton Text */}
                  <Skeleton
                    variant="text"
                    width={{ xs: 60, md: 70 }}
                    height={16}
                    sx={{
                      bgcolor: 'background.level1',
                    }}
                  />
                </Box>
              ))}
            </>
          ) : postRepresentatives && postRepresentatives.length > 0 ? (
            postRepresentatives.map((rep) => {
              const isActive = currentViewingPost === rep.postId;
              const progress = isActive && totalSlides > 0 
                ? ((currentSlideIndex + 1) / totalSlides) * 100 
                : 0;
              
              // Get team colors
              const primaryColor = getTeamPrimaryColor(rep.teamTricode);
              const secondaryColor = getTeamSecondaryColor(rep.teamTricode);
              
              // Check if this is a fun_score post
              const isFunScore = rep.postType === 'fun_score';
              const isGameSelected = isFunScore && rep.metadata?.game_id === selectedGameId;

              return (
                <Box
                  key={rep.postId}
                  ref={(el) => {
                    if (el) {
                      avatarRefs.current.set(rep.postId, el);
                    } else {
                      avatarRefs.current.delete(rep.postId);
                    }
                  }}
                  onClick={() => {
                    // Handle fun_score game selection
                    if (isFunScore && rep.metadata?.game_id) {
                      const gameId = rep.metadata.game_id;
                      const newSelectedId = selectedGameId === gameId ? null : gameId;
                      console.log('Fun Score clicked:', {
                        gameId,
                        currentSelected: selectedGameId,
                        newSelected: newSelectedId,
                        metadata: rep.metadata
                      });
                      setSelectedGameId(newSelectedId);
                    }
                    
                    if (onAvatarClick) {
                      onAvatarClick(rep.postId);
                    } else {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    flexShrink: 0,
                    textAlign: 'center',
                    position: 'relative',
                    zIndex: isGameSelected ? 10 : 2,
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
                    // Fun Score Avatar - Split Team Logos with Score
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
                      {rep.teamTricodes.length >= 2 && (
                        <>
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: '50%',
                              height: '100%',
                              bgcolor: getTeamPrimaryColor(rep.teamTricodes[0]),
                            }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              width: '50%',
                              height: '100%',
                              bgcolor: getTeamPrimaryColor(rep.teamTricodes[1]),
                            }}
                          />
                        </>
                      )}
                      
                      {/* Team Logos - 100% bigger */}
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{
                          position: 'absolute',
                          top: '8%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          zIndex: 1,
                        }}
                      >
                        {rep.teamTricodes.slice(0, 2).map((tricode, idx) => (
                          <Box
                            key={tricode}
                            component="img"
                            src={getTeamLogoUrl(tricode)}
                            alt={tricode}
                            sx={{
                              width: { xs: 40, md: 44 }, // 100% bigger (was 20/22)
                              height: { xs: 40, md: 44 },
                              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ))}
                      </Stack>
                      
                      {/* Fun Score Badge - 250% bigger with decimal */}
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: '8%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          bgcolor: '#FFC72C',
                          color: '#000',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          fontSize: { xs: '1.1rem', md: '1.2rem' }, // 250% bigger (was 0.65/0.7rem)
                          fontFamily: '"Libre Baskerville", Georgia, serif',
                          border: '2px solid',
                          borderColor: 'background.body',
                          zIndex: 2,
                          lineHeight: 1,
                        }}
                      >
                        {((rep.metadata?.fun_score || 0) / 10).toFixed(1)}
                      </Box>
                    </Box>
                  ) : (
                    // Regular Player Avatar
                    <Avatar
                      src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${rep.playerId}.png`}
                      alt={`Player ${rep.playerId}`}
                      sx={{
                        width: { xs: 77, md: 83 },
                        height: { xs: 77, md: 83 },
                        border: isActive ? `3px solid ${secondaryColor}` : `3px dashed ${primaryColor}`,
                        bgcolor: primaryColor,
                        mb: 0,
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          borderColor: isActive ? secondaryColor : primaryColor,
                        },
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    >
                      ?
                    </Avatar>
                  )}
                </Box>
              );
            })
          ) : (
            // Show skeleton avatars when there are no posts
            <>
              {[...Array(5)].map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.5,
                    minWidth: 'fit-content',
                  }}
                >
                  {/* Skeleton Circle */}
                  <Skeleton
                    variant="circular"
                    width={{ xs: 77, md: 83 }}
                    height={{ xs: 77, md: 83 }}
                    sx={{
                      bgcolor: 'background.level1',
                      border: '3px solid',
                      borderColor: 'text.primary',
                    }}
                  />
                  
                  {/* Skeleton Text */}
                  <Skeleton
                    variant="text"
                    width={{ xs: 60, md: 70 }}
                    height={16}
                    sx={{
                      bgcolor: 'background.level1',
                    }}
                  />
                </Box>
              ))}
            </>
          )}
          
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

