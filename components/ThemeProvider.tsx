import React, { createContext, useContext } from 'react';
import { useTheme as useThemeHook } from '../hooks/useTheme';
import { StatusBar } from 'expo-status-bar';

// Create context
type ThemeContextType = ReturnType<typeof useThemeHook>;
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme provider component
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeContext = useThemeHook();
  
  return (
    <ThemeContext.Provider value={themeContext}>
      <StatusBar style={themeContext.isDark ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}; 