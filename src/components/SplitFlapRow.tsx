import { motion } from 'framer-motion';
import { Box } from '@mui/joy';
import { ReactNode, forwardRef } from 'react';

interface SplitFlapRowProps {
  children: ReactNode;
  index: number;
  keyValue: string | number;
  delay?: number;
}

/**
 * Wrapper component that applies split-flap animation to any row
 * Use this to wrap Sheet components in margin bar views
 */
const SplitFlapRow = forwardRef<HTMLDivElement, SplitFlapRowProps>(({ 
  children, 
  index, 
  keyValue,
  delay = 0 
}, ref) => {
  return (
    <Box
      ref={ref}
      component={motion.div}
      key={keyValue}
      initial={{ 
        rotateY: -90,
        opacity: 0,
        scale: 0.95,
        transformOrigin: 'center center',
      }}
      animate={{ 
        rotateY: 0,
        opacity: 1,
        scale: 1,
        transformOrigin: 'center center',
      }}
      exit={{ 
        rotateY: 90,
        opacity: 0,
        scale: 0.95,
        transformOrigin: 'center center',
      }}
      transition={{ 
        duration: 0.3,
        delay: delay + index * 0.03, // Stagger each row by 30ms (reduced)
        ease: [0.16, 1, 0.3, 1], // Custom easing for mechanical feel
      }}
      style={{
        transformStyle: 'preserve-3d',
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </Box>
  );
});

SplitFlapRow.displayName = 'SplitFlapRow';

export default SplitFlapRow;

