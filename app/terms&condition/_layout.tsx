import { Stack } from 'expo-router';

export default function TermsAndConditionLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="page"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Privacy"
        options={{
          headerShown: false,
          title: "Privacy"
        }}
      />
    </Stack>
  );
} 