import { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeType = 'light' | 'dark';

export const useTheme = () => {
  const systemColorScheme = useColorScheme() as ThemeType;
  const [theme, setTheme] = useState<ThemeType>(systemColorScheme || 'light');
  
  // Load saved theme preference on startup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          setTheme(savedTheme as ThemeType);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      }
    };
    
    loadTheme();
  }, []);
  
  // Save theme preference when it changes
  useEffect(() => {
    const saveTheme = async () => {
      try {
        await AsyncStorage.setItem('theme', theme);
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    };
    
    saveTheme();
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };
  
  const colors = theme === 'light' ? Colors.light : Colors.dark;
  const isDark = theme === 'dark';
  
  return { theme, colors, toggleTheme, isDark };
}; 