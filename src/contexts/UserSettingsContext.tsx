import { createContext, useContext, useState, ReactNode } from 'react';

interface UserSettingsContextType {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  toggleNav: () => void;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  const toggleNav = () => {
    setNavOpen(prev => !prev);
  };

  return (
    <UserSettingsContext.Provider value={{ navOpen, setNavOpen, toggleNav }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettingsNav() {
  const context = useContext(UserSettingsContext);
  if (context === undefined) {
    throw new Error('useUserSettingsNav must be used within a UserSettingsProvider');
  }
  return context;
}







