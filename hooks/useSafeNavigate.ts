import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';

export function useSafeNavigate() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationInProgressRef = useRef(false);
  const lastNavigationRef = useRef<string | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const safeNavigate = useCallback((path: string, params?: object) => {
    if (navigationInProgressRef.current) return;

    const pathWithParams = params ? `${path}?${JSON.stringify(params)}` : path;
    if (lastNavigationRef.current === pathWithParams) return;

    navigationInProgressRef.current = true;
    lastNavigationRef.current = pathWithParams;
    setIsNavigating(true);

    try {
      requestAnimationFrame(() => {
        if (params) {
          router.navigate({ pathname: path as never, params: params as never });
        } else {
          router.replace(path as never);
        }

        if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = setTimeout(() => {
          navigationInProgressRef.current = false;
          setIsNavigating(false);
          navigationTimeoutRef.current = null;
        }, 1200);
      });
    } catch (error) {
      navigationInProgressRef.current = false;
      setIsNavigating(false);
      console.error('Safe navigate error:', error);
      Sentry.captureException(error);
    }
  }, [router]);

  return { safeNavigate, isNavigating };
} 