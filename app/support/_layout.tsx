import { Stack } from 'expo-router';

export default function SupportLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="report"
        options={{
          headerShown: false,
          title: "Report"
        }}
      />
      <Stack.Screen 
        name="chat"
        options={{
          headerShown: false,
          title: "Chat"
        }}
      />
      <Stack.Screen 
        name="ticket"
        options={{
          headerShown: false,
          title: "Ticket"
        }}
      />
    </Stack>
  );
} 