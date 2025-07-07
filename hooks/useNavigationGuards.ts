import { useEffect } from 'react';
import { useSegments } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store/useUserStore';
import { useSafeNavigate } from './useSafeNavigate';

export function useNavigationGuards(fontReady: boolean, appReady: boolean) {
  const segments = useSegments();
  const { session, isInitialized } = useAuth();
  const { profile } = useUserStore();
  const { safeNavigate } = useSafeNavigate();

  const isAuthenticated = !!session;
  const isPhoneVerified = profile?.phone_verified;

  useEffect(() => {
    if (!isInitialized || !fontReady || !appReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === 'onboarding';
    const currentlyVerifyingOTP = segments[1] === 'verify-otp';

    if (isAuthenticated) {
      if (!isPhoneVerified && !currentlyVerifyingOTP) {
        if (profile?.phone) {
          safeNavigate('/(auth)/verify-otp', {
            phone: profile.phone,
            userId: session.user.id,
          });
        }
        return;
      }

      if (isPhoneVerified && (inAuthGroup || inOnboardingGroup)) {
        safeNavigate('/(tabs)');
        return;
      }
    } else {
      if (!inAuthGroup && !inOnboardingGroup) {
        safeNavigate('/(auth)/login');
        return;
      }
    }
  }, [segments, isInitialized, isAuthenticated, isPhoneVerified, profile, fontReady, appReady]);
} 