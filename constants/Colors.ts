const tintColorLight = '#0a7ea4';
const tintColorDark = '#33a9d4';

export const Colors = {
  light: {
    text: '#000',
    subtext: '#666',
    background: '#fff',
    secondaryBackground: '#f9f9f9',
    cardBackground: '#fff',
    tint: '#2f95dc',
    icon: '#000',
    tabIconDefault: '#ccc',
    tabIconSelected: '#2f95dc',
    border: '#E5E7EB',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    inactive: 'rgba(0,0,0,0.65)',
    shadow: 'rgba(0,0,0,0.1)',
  },
  dark: {
    text: '#fff',
    subtext: '#aaa',
    background: '#121212',
    secondaryBackground: '#1E1E1E',
    cardBackground: '#262626',
    tint: '#33a9d4',
    icon: '#fff',
    tabIconDefault: '#777',
    tabIconSelected: '#33a9d4',
    border: '#333',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
    inactive: 'rgba(255,255,255,0.65)',
    shadow: 'rgba(0,0,0,0.5)',
  },
  primary: '#1E8DCC',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  border: '#E5E7EB',
  text: '#333333',
  background: '#FFFFFF'
};

export type ColorScheme = typeof Colors;
