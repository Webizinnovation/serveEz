import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../../components/ThemeProvider';

export default function ReportLayout() {
  const { isDark, colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? colors.cardBackground : '#fff',
        },
        headerTintColor: isDark ? colors.text : '#000',
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: isDark ? colors.background : '#f9f9f9',
        },
      }}
    />
  );
} 