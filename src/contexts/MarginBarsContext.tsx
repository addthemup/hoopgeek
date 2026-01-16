import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type ViewType = 'standings' | 'leaders' | 'players-of-the-night' | 'team-of-the-week';
type CategoryType = 'PTS' | 'REB' | 'AST' | 'STL' | 'BLK' | 'FG_PCT' | 'FG3_PCT' | 'FT_PCT';

interface MarginBarsContextType {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  activeCategoryLeft: CategoryType;
  activeCategoryRight: CategoryType;
  setActiveCategoryLeft: (category: CategoryType) => void;
  setActiveCategoryRight: (category: CategoryType) => void;
  currentRoute: string;
  marginBarsVisible: boolean;
  setMarginBarsVisible: (visible: boolean) => void;
}

const MarginBarsContext = createContext<MarginBarsContextType | undefined>(undefined);

export function MarginBarsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [activeView, setActiveView] = useState<ViewType>('standings');
  const [activeCategoryLeft, setActiveCategoryLeft] = useState<CategoryType>('PTS');
  const [activeCategoryRight, setActiveCategoryRight] = useState<CategoryType>('STL');
  const [marginBarsVisible, setMarginBarsVisible] = useState<boolean>(false); // Start with margin bars hidden

  // Reset to standings view when route changes
  useEffect(() => {
    setActiveView('standings');
  }, [location.pathname]);

  return (
    <MarginBarsContext.Provider value={{ 
      activeView, 
      setActiveView,
      activeCategoryLeft,
      activeCategoryRight,
      setActiveCategoryLeft,
      setActiveCategoryRight,
      currentRoute: location.pathname,
      marginBarsVisible,
      setMarginBarsVisible,
    }}>
      {children}
    </MarginBarsContext.Provider>
  );
}

export function useMarginBars() {
  const context = useContext(MarginBarsContext);
  if (context === undefined) {
    throw new Error('useMarginBars must be used within a MarginBarsProvider');
  }
  return context;
}

