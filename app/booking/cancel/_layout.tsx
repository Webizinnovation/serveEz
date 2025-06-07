import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../components/ThemeProvider';

export default function CancelBookingLayout() {
  const { isDark, colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? colors.cardBackground : '#fff',
        },
        headerShown: false,
        headerTintColor: isDark ? colors.text : '#000',
        headerTitleStyle: {
          fontFamily: 'Urbanist-Bold',
        },
        contentStyle: {
          backgroundColor: isDark ? colors.background : '#f9f9f9',
        },
      }}
    />
  );
} 