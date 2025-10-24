import { useEffect, useRef } from 'react';
import swishSound from '../assets/swish.mp3';
import ballBounceSound from '../assets/ball-bounce.mp3';

/**
 * Hook for playing draft sound effects
 */
export function useDraftSounds() {
  const swishAudioRef = useRef<HTMLAudioElement | null>(null);
  const ballBounceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    swishAudioRef.current = new Audio(swishSound);
    ballBounceAudioRef.current = new Audio(ballBounceSound);

    // Set volume
    if (swishAudioRef.current) swishAudioRef.current.volume = 0.5;
    if (ballBounceAudioRef.current) ballBounceAudioRef.current.volume = 0.6;

    return () => {
      // Cleanup
      swishAudioRef.current?.pause();
      ballBounceAudioRef.current?.pause();
      swishAudioRef.current = null;
      ballBounceAudioRef.current = null;
    };
  }, []);

  const playSwish = () => {
    try {
      if (swishAudioRef.current) {
        // Reset and play
        swishAudioRef.current.currentTime = 0;
        swishAudioRef.current.play().catch(err => {
          console.warn('Could not play swish sound:', err);
        });
      }
    } catch (error) {
      console.warn('Error playing swish sound:', error);
    }
  };

  const playBallBounce = () => {
    try {
      if (ballBounceAudioRef.current) {
        // Reset and play
        ballBounceAudioRef.current.currentTime = 0;
        ballBounceAudioRef.current.play().catch(err => {
          console.warn('Could not play ball bounce sound:', err);
        });
      }
    } catch (error) {
      console.warn('Error playing ball bounce sound:', error);
    }
  };

  return {
    playSwish,
    playBallBounce
  };
}

