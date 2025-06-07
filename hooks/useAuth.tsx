import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  event: string;
  isPhoneVerified: boolean;
  isInitialized: boolean;
}

const useAuth = () => {
  // Use a single state object to reduce re-renders
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    session: null,
    event: 'INITIAL_SESSION',
    isPhoneVerified: false,
    isInitialized: false,
  });
  
  // Track component mounted state to prevent memory leaks
  const isMountedRef = useRef(true);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Optimized phone verification check with timeout
  const checkPhoneVerification = useCallback(async (userId: string): Promise<boolean> => {
    if (!userId || !isMountedRef.current) return false;
    
    try {
      const verificationPromise = Promise.race([
        new Promise<{data: any, error: any}>((resolve) => {
          setTimeout(() => {
            resolve({data: null, error: new Error('Timeout checking verification')});
          }, 3000); // Reduced from 5000ms to 3000ms for faster response
        }),
        supabase
          .from('users')
          .select('phone_verified')
          .eq('id', userId)
          .single()
      ]);
      
      const { data, error } = await verificationPromise;
      
      if (error || !isMountedRef.current) return false;
      
      return data?.phone_verified ?? false;
    } catch (error) {
      return false;
    }
  }, []);

  // Main auth effect with optimized subscriptions and cleanup
  useEffect(() => {
    // Set a safety timeout to ensure we don't get stuck in uninitialized state
    safetyTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !authState.isInitialized) {
        setAuthState(prev => ({
          ...prev,
          isInitialized: true
        }));
      }
    }, 8000); // Reduced from 10s to 8s
    
    const subscribeToAuthChanges = async () => {
      // Subscribe to auth changes with optimized handler
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
          if (!isMountedRef.current) return;
          
          // Create a new state object
          let newState: Partial<AuthState> = { event };
          
          // Handle sign out immediately
          if (event === 'SIGNED_OUT') {
            if (isMountedRef.current) {
              setAuthState({
                isAuthenticated: false,
                user: null,
                session: null,
                event,
                isPhoneVerified: false,
                isInitialized: true,
              });
            }
            return;
          }

          // Handle sign in and token refresh events
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
            newState = {
              ...newState,
              isAuthenticated: true,
              user: session.user,
              session,
            };
            
            // Check phone verification only if needed
            try {
              const isPhoneVerified = await checkPhoneVerification(session.user.id);
              
              if (!isMountedRef.current) return;
              
              // Update the auth state with all changes at once
              setAuthState(prev => ({
                ...prev,
                ...newState,
                isPhoneVerified,
                isInitialized: true,
              }));
            } catch (error) {
              if (!isMountedRef.current) return;
              
              // Update state even if verification check fails
              setAuthState(prev => ({
                ...prev,
                ...newState,
                isPhoneVerified: false,
                isInitialized: true,
              }));
            }
          }
        }
      );

      // Check the initial session
      try {
        // Set an initialization timeout 
        initTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && !authState.isInitialized) {
            setAuthState(prev => ({
              ...prev,
              isInitialized: true
            }));
          }
        }, 5000); // Reduced from 8000ms to 5000ms
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMountedRef.current) return;
        
        if (session?.user) {
          // Check phone verification for initial session
          const isPhoneVerified = await checkPhoneVerification(session.user.id);
          
          if (!isMountedRef.current) return;
          
          // Update with initial session data
          setAuthState({
            isAuthenticated: true,
            user: session.user,
            session,
            event: 'INITIAL_SESSION',
            isPhoneVerified,
            isInitialized: true,
          });
          
          // Clear the initialization timeout
          if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current);
            initTimeoutRef.current = null;
          }
        } else {
          // No user is signed in
          if (!isMountedRef.current) return;
          
          setAuthState({
            isAuthenticated: false,
            user: null,
            session: null,
            event: 'INITIAL_SESSION',
            isPhoneVerified: false,
            isInitialized: true,
          });
          
          // Clear the initialization timeout
          if (initTimeoutRef.current) {
            clearTimeout(initTimeoutRef.current);
            initTimeoutRef.current = null;
          }
        }
      } catch (error) {
        // Error handling with safety state update
        if (!isMountedRef.current) return;
        
        setAuthState(prev => ({ 
          ...prev, 
          isInitialized: true, 
          isPhoneVerified: false 
        }));
        
        // Clear the initialization timeout
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
      }
      
      // Return unsubscribe function for cleanup
      return () => {
        if (authListener) {
          authListener.subscription.unsubscribe();
        }
      };
    };

    // Start auth subscription
    const unsubscribePromise = subscribeToAuthChanges();

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      
      // Clean up all timeouts
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      // Clean up subscription
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, [checkPhoneVerification]);

  return authState;
};

export default useAuth; 