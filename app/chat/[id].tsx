import React from 'react';
import { View, StatusBar, Platform } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import UserChatRoom from '../../components/chat/UserChatRoom';
import ProviderChatRoom from '../../components/chat/ProviderChatRoom';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeProvider';

export default function ChatRoomScreen() {
  const { user } = useAuth();
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isProvider = user?.role === 'provider';

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: isDark ? colors?.background || '#121212' : '#fff',
      paddingTop: Platform.OS === 'ios' ? 0 : insets.top,
    }}>
      <StatusBar 
        barStyle={isDark ? "light-content" : "dark-content"} 
        backgroundColor={isDark ? colors?.background || '#121212' : '#fff'}
        translucent={Platform.OS === 'android'}
      />
      {isProvider ? <ProviderChatRoom /> : <UserChatRoom />}
    </View>
  );
} 