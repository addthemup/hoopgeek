import { Box } from '@mui/joy';
import { motion } from 'framer-motion';

interface SplitFlapTextProps {
  value: string | number;
  delay?: number;
  characterDelay?: number; // Kept for API compatibility but not used
  duration?: number;
  height?: string;
  fontSize?: string;
  color?: string;
}

/**
 * Split-flap text component that animates entire text blocks
 * Optimized for performance - no character-level animations
 */
export default function SplitFlapText({
  value,
  delay = 0,
  characterDelay = 0.03, // Not used but kept for compatibility
  duration = 0.3,
  height = '100%',
  fontSize = 'inherit',
  color = 'inherit',
}: SplitFlapTextProps) {
  const text = String(value);

  return (
    <Box
      component={motion.div}
      initial={{ 
        rotateX: -90,
        opacity: 0,
      }}
      animate={{ 
        rotateX: 0,
        opacity: 1,
      }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        willChange: 'transform, opacity',
        height,
        fontSize,
        color,
        display: 'inline-block',
      }}
      sx={{
        fontWeight: 700,
      }}
    >
      {text}
    </Box>
  );
}

