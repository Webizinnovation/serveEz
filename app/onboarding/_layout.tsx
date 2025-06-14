import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        animation: 'fade'
      }}
    >
      <Stack.Screen name="Welcome" />
      <Stack.Screen name="Skip" />
      <Stack.Screen name="getStarted" />
    </Stack>
  );
} 