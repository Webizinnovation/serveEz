import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from 'react-native-size-matters';

type ThemeToggleProps = {
  style?: any;
};

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ style }) => {
  const { toggleTheme, isDark } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isDark ? 'sunny' : 'moon'}
        size={moderateScale(24)}
        color={isDark ? '#FFD700' : '#6B8096'}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: moderateScale(40),
    height: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: moderateScale(20),
  },
}); 