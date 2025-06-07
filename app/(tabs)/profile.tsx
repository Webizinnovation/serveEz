import React, { useState } from 'react';
import { Platform, BackHandler } from 'react-native';
import { useUserStore } from '../../store/useUserStore';
import { useRouter } from 'expo-router';
import ProviderProfileScreen from '../../components/provider/profile';
import { useFocusEffect } from 'expo-router';
import { UserProfile } from '../../components/user/UserProfile';

export default function ProfileScreen() {
  const { profile } = useUserStore();
  const router = useRouter();

  useFocusEffect(
    React.useCallback(() => {
      const handleBackPress = () => {
        if (router.canGoBack()) {
          return false;
        }
        // handleLogout();
        return true;
      };

      let backHandlerSubscription: { remove: () => void } | undefined;
      if (Platform.OS === 'android') {
        backHandlerSubscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      }
      
      return () => {
        if (Platform.OS === 'android' && backHandlerSubscription) {
          backHandlerSubscription.remove();
        }
      };
    }, [])
  );

  if (profile?.role === 'provider') {
    return <ProviderProfileScreen />;
  }

  if (profile?.role === 'user') {
    return <UserProfile />;
  }

  return null;
}
