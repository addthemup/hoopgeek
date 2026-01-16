import { motion, AnimatePresence } from 'framer-motion';
import { Box } from '@mui/joy';
import { useEffect, useState } from 'react';

interface SplitFlapCharacterProps {
  value: string | number;
  delay?: number;
  duration?: number;
  height?: string;
  fontSize?: string;
  color?: string;
}

/**
 * Individual split-flap character component
 * Animates a single character/symbol with a 3D flip effect
 */
export default function SplitFlapCharacter({
  value,
  delay = 0,
  duration = 0.4,
  height = '100%',
  fontSize = 'inherit',
  color = 'inherit',
}: SplitFlapCharacterProps) {
  const [displayValue, setDisplayValue] = useState<string>(String(value));
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    const newValue = String(value);
    if (newValue !== displayValue) {
      setIsFlipping(true);
      // Wait for flip animation to complete before changing value
      const timer = setTimeout(() => {
        setDisplayValue(newValue);
        setIsFlipping(false);
      }, duration * 1000 * 0.5); // Change value at midpoint of flip
      return () => clearTimeout(timer);
    }
  }, [value, displayValue, duration]);

  return (
    <Box
      sx={{
        display: 'inline-block',
        perspective: '200px',
        height,
        minWidth: '1ch',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={displayValue}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ 
            rotateX: 0, 
            opacity: 1,
          }}
          exit={{ 
            rotateX: 90, 
            opacity: 0,
          }}
          transition={{
            duration,
            delay,
            ease: [0.16, 1, 0.3, 1], // Mechanical easing
          }}
          style={{
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
            willChange: 'transform, opacity',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize,
            color,
            fontWeight: 700,
            textShadow: isFlipping 
              ? '0 2px 4px rgba(0, 0, 0, 0.3)' 
              : '0 1px 2px rgba(0, 0, 0, 0.2)',
          }}
        >
          {displayValue}
        </motion.div>
      </AnimatePresence>
    </Box>
  );
}

