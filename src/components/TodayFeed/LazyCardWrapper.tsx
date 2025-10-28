import { Box, Card, CircularProgress, Typography } from '@mui/joy';
import { useState, useEffect, useRef } from 'react';

interface LazyCardWrapperProps {
  children: React.ReactNode;
  cardId: string;
  minHeight?: string;
}

export default function LazyCardWrapper({ 
  children, 
  cardId, 
  minHeight = '400px' 
}: LazyCardWrapperProps) {
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasBeenViewed(true);
          }
        });
      },
      {
        root: null,
        rootMargin: '200px', // Start loading 200px before viewport
        threshold: 0.1
      }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);
  
  return (
    <Box 
      ref={containerRef}
      sx={{ minHeight: hasBeenViewed ? 'auto' : minHeight }}
    >
      {hasBeenViewed ? children : (
        <Card 
          variant="outlined"
          sx={{
            height: minHeight,
            bgcolor: 'background.level1',
            border: { xs: 'none', md: '3px solid' },
            borderColor: 'divider',
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 2, md: 3 },
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 0.6 },
              '50%': { opacity: 1 },
            }
          }}
        >
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}>
            <CircularProgress size="lg" />
            <Typography level="body-sm" sx={{ color: 'text.secondary', fontFamily: 'serif' }}>
              Loading content...
            </Typography>
          </Box>
        </Card>
      )}
    </Box>
  );
}

