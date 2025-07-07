import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { View, Animated, Easing } from 'react-native';
import Logo from '../assets/images/Svg/logo1.svg';
import React, { useRef, useEffect, useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import * as Sentry from '@sentry/react-native';

export default function Index() {
  const { session, isLoading, isInitialized } = useAuth();
  const { profile } = useUserStore();
  const fadeAnim = useRef(new Animated.Value(0.3)).current;
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const didRedirectRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      const fadeInOut = () => {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.ease
          }),
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.ease
          })
        ]).start(() => fadeInOut());
      };

      fadeInOut();
      return () => fadeAnim.stopAnimation();
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && isInitialized && !didRedirectRef.current) {
      didRedirectRef.current = true;
      try {
        if (session && profile) {
          setRedirectPath('/(tabs)');
        } else {
          setRedirectPath('/onboarding/Welcome');
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    }
  }, [isLoading, isInitialized, session, profile]);

  if (isLoading || !isInitialized) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{
            scale: fadeAnim.interpolate({
              inputRange: [0.3, 1],
              outputRange: [0.9, 1.1]
            })
          }]
        }}>
          <Logo width={100} height={100} />
        </Animated.View>
      </View>
    );
  }

  if (redirectPath) {
    return <Redirect href={redirectPath as any} />;
  }

  return null;
} 