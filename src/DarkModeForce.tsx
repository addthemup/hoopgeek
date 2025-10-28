import { useEffect } from 'react';
import { useColorScheme } from '@mui/joy/styles';

export default function DarkModeForce({ children }: { children: React.ReactNode }) {
  const { mode, setMode } = useColorScheme();

  useEffect(() => {
    // Force dark mode on mount
    if (mode !== 'dark') {
      console.log('Forcing dark mode, current mode:', mode);
      setMode('dark');
    }
  }, [mode, setMode]);

  // Debug: log current mode
  useEffect(() => {
    console.log('Current color mode:', mode);
  }, [mode]);

  return <>{children}</>;
}

