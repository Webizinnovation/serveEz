import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';
import { useUserStore } from '../store/useUserStore';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';

interface User {
  id: string;
  role: 'user' | 'provider';
}

// Define allowed route paths to fix TypeScript error
type AllowedRoutes = '/(auth)/login' | '/onboarding/Welcome' | '/(tabs)';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setProfile, profile } = useUserStore();
  const [redirectInProgress, setRedirectInProgress] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use refs to track mounted state and navigation timeout
  const isMountedRef = useRef(true);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track OAuth state to prevent double-processing
  const oauthInProgressRef = useRef(false);
  const ignoreAuthChangeUntilRef = useRef(0);

  // Safe navigation function with debounce and safeguards
  const safeNavigate = useCallback((path: AllowedRoutes) => {
    if (!isInitialized || !isMountedRef.current || redirectInProgress) {
      return;
    }
    
    // Clear any existing navigation timeout
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
    
    setRedirectInProgress(true);
    
    // Use requestAnimationFrame for better UI performance during navigation
    requestAnimationFrame(() => {
      if (!isMountedRef.current) return;
      
      navigationTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        
        try {
          router.replace(path);
        } catch (error) {
          console.error('[safeNavigate] Navigation error:', error);
        }
        
        // Reset redirect flag after navigation completes
        setTimeout(() => {
          if (isMountedRef.current) {
            setRedirectInProgress(false);
          }
        }, 500);
      }, 50);
    });
  }, [isInitialized, redirectInProgress]);

  // Optimized user profile fetch with timeout
  const fetchUserProfile = useCallback(async (userId: string) => {
    if (!userId || !isMountedRef.current) return null;
    
    return Promise.race([
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 5000);
      }),
      (async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
            
          if (error || !isMountedRef.current) return null;
          return data;
        } catch (error) {
          return null;
        }
      })()
    ]);
  }, []);

  // Handle deep links more efficiently
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Set a single safety timeout for the entire auth process
    safetyTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && (isLoading || !isInitialized)) {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }, 10000);
    
    // Optimized deep link handler
    const handleDeepLink = async (event: { url: string }) => {
      if (!isMountedRef.current || oauthInProgressRef.current) return;
      
      // Check if this is our auth redirect
      if (event.url.startsWith('serveez://')) {
        oauthInProgressRef.current = true;
        setRedirectInProgress(true);
        
        // Set a timestamp to ignore auth changes for the next 5 seconds
        ignoreAuthChangeUntilRef.current = Date.now() + 5000;
        
        try {
          // Try to extract tokens from URL if present
          let sessionResult = null;
          
          if (event.url.includes('#access_token=')) {
            const fragmentStr = event.url.split('#')[1];
            const params = new URLSearchParams(fragmentStr);
            
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            
            if (accessToken) {
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              
              if (!error && data?.session) {
                sessionResult = data.session;
              }
            }
          }
          
          // Fall back to session refresh if token extraction failed
          if (!sessionResult) {
            const { data, error } = await supabase.auth.getSession();
            if (!error && data?.session) {
              sessionResult = data.session;
            }
          }
          
          // Process the session result
          if (sessionResult && isMountedRef.current) {
            setSession(sessionResult);
            
            // Get user profile
            const userProfile = await fetchUserProfile(sessionResult.user.id);
            
            if (isMountedRef.current) {
              if (userProfile) {
                setProfile(userProfile);
                
                // Delayed navigation to allow state to settle
                setTimeout(() => {
                  if (isMountedRef.current) {
                    router.replace('/(tabs)');
                    setRedirectInProgress(false);
                    oauthInProgressRef.current = false;
                  }
                }, 300);
              } else {
                // User doesn't exist in database
                await supabase.auth.signOut();
                
                setTimeout(() => {
                  if (isMountedRef.current) {
                    router.replace('/(auth)/signup');
                    setRedirectInProgress(false);
                    oauthInProgressRef.current = false;
                  }
                }, 300);
              }
            }
          } else {
            if (isMountedRef.current) {
              setRedirectInProgress(false);
              oauthInProgressRef.current = false;
            }
          }
        } catch (error) {
          if (isMountedRef.current) {
            setRedirectInProgress(false);
            oauthInProgressRef.current = false;
          }
        }
      }
    };
    
    // Set up URL subscription
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check for initial URL
    Linking.getInitialURL().then((url) => {
      if (url && isMountedRef.current) {
        handleDeepLink({ url });
      }
    });
    
    return () => {
      subscription.remove();
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [fetchUserProfile]);

  // Main authentication effect - streamlined
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Add initialization timeout safeguard
    initTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && isLoading && !isInitialized) {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }, 8000);
    
    // Optimized auth change handler
    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      if (!isMountedRef.current || redirectInProgress) return;
      
      // Ignore auth changes if we're within the ignore period (for OAuth redirects)
      if (Date.now() < ignoreAuthChangeUntilRef.current) return;
      
      // SIGNED_OUT event handler
      if (event === 'SIGNED_OUT') {
        if (isMountedRef.current) {
          setSession(null);
          setProfile(null);
          
          if (!isInitialized) setIsInitialized(true);
          if (isLoading) setIsLoading(false);
        }
        return;
      }
      
      // Session exists - process it
      if (currentSession) {
        if (isMountedRef.current) setSession(currentSession);
        
        // Only fetch profile if this is a sign-in or token refresh
        if (['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(event)) {
          const userProfile = await fetchUserProfile(currentSession.user.id);
          
          if (isMountedRef.current) {
            if (userProfile) setProfile(userProfile);
            
            // Initialize if needed
            if (!isInitialized) setIsInitialized(true);
            if (isLoading) setIsLoading(false);
          }
        }
      } else {
        // No session exists
        if (isMountedRef.current) {
          setSession(null);
          setProfile(null);
          
          if (!isInitialized) setIsInitialized(true);
          if (isLoading) setIsLoading(false);
        }
      }
    };

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMountedRef.current) return;
        
        if (error) {
          setIsLoading(false);
          setSession(null);
          setProfile(null);
          setIsInitialized(true);
          return;
        }
        
        if (session) {
          setSession(session);
          
          const userProfile = await fetchUserProfile(session.user.id);
          
          if (isMountedRef.current) {
            if (userProfile) setProfile(userProfile);
            
            setIsLoading(false);
            setIsInitialized(true);
            
            // Clear safety timeouts
            if (initTimeoutRef.current) {
              clearTimeout(initTimeoutRef.current);
              initTimeoutRef.current = null;
            }
          }
        } else {
          if (isMountedRef.current) {
            setIsLoading(false);
            setSession(null);
            setProfile(null);
            setIsInitialized(true);
            
            // Clear safety timeouts
            if (initTimeoutRef.current) {
              clearTimeout(initTimeoutRef.current);
              initTimeoutRef.current = null;
            }
          }
        }
      } catch (error) {
        if (isMountedRef.current) {
          setIsLoading(false);
          setSession(null);
          setProfile(null);
          setIsInitialized(true);
          
          // Clear safety timeouts
          if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current);
            initTimeoutRef.current = null;
          }
        }
      }
    };

    // Start initialization
    initializeAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, eventSession) => {
        // Immediately update session for valid events to prevent loss
        if (eventSession && event !== 'SIGNED_OUT' && isMountedRef.current) {
          setSession(eventSession);
        }
        
        // Process the full event
        handleAuthChange(event, eventSession);
      }
    );

    // Cleanup
    return () => {
      subscription.unsubscribe();
      
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [fetchUserProfile, redirectInProgress, isLoading, isInitialized]);

  // Set isMounted to false on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Clear all timeouts on unmount
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    session,
    isLoading,
    user: session?.user as User | null,
    isInitialized
  };
} 