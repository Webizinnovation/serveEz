import React, { useEffect, useCallback, useState, useRef } from 'react';
import { SplashScreen, Stack, useRouter, useSegments, usePathname, useNavigation } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useUserStore } from '../store/useUserStore';
import { PaperProvider, adaptNavigationTheme, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { NetworkStatus } from '../components/common/NetworkStatus';
import { View, Animated, Easing, Text, useColorScheme, Platform } from 'react-native';
import Logo from '../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import { moderateScale, scale } from 'react-native-size-matters';
import { ThemeProvider } from '../components/ThemeProvider';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import FontProvider from '../components/FontProvider';
import { configurePushNotifications } from '../services/pushNotifications';
// import NavigationLoader from '../components/common/NavigationLoader';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://ef8b7d85db0a678da637dd0d3c6e87ec@o4509498758660096.ingest.de.sentry.io/4509498887372880',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

configurePushNotifications();


SplashScreen.preventAutoHideAsync();

export default Sentry.wrap(function RootLayout() {
  const authState = useAuth();
  const { isInitialized, user, session } = authState;
  const { profile } = useUserStore();
  const isAuthenticated = !!session;
  const isPhoneVerified = profile?.phone_verified || false;
  const fadeAnim = React.useRef(new Animated.Value(0.3)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const navigation = useNavigation();
  
  
  const isMountedRef = useRef(true);
  const [forceSplashHide, setForceSplashHide] = useState(false);
  const navigationInProgressRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const currentPathRef = useRef<string | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const splashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [fontLoadingComplete, setFontLoadingComplete] = useState(false);
  const [fontLoadingSuccess, setFontLoadingSuccess] = useState(false);
  const lastNavigationRef = useRef<string | null>(null);

  const { LightTheme, DarkTheme: PaperDarkTheme } = adaptNavigationTheme({
    reactNavigationLight: DefaultTheme,
    reactNavigationDark: DarkTheme,
  });

  const CombinedLightTheme = {
    ...MD3LightTheme,
    ...LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      ...LightTheme.colors,
      primary: '#1E8DCC',
      secondary: '#22C55E',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      error: '#EF4444',
    },
    fonts: {
      ...MD3LightTheme.fonts,
      regular: {
        fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Regular',
        fontWeight: 'normal',
      },
      medium: {
        fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Medium',
        fontWeight: 'normal',
      },
      bold: {
        fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Bold',
        fontWeight: 'normal',
      },
      heavy: {
        fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Black',
        fontWeight: 'normal',
      },
    },
  };

  const CombinedDarkTheme = {
    ...MD3DarkTheme,
    ...PaperDarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      ...PaperDarkTheme.colors,
      primary: '#33a9d4',
      secondary: '#22C55E',
      background: '#121212',
      surface: '#262626',
      error: '#EF4444',
    },
    fonts: {
      ...MD3DarkTheme.fonts,
      regular: {
        fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Regular',
        fontWeight: 'normal',
      },
      medium: {
        fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Medium',
        fontWeight: 'normal',
      },
      bold: {
        fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Bold',
        fontWeight: 'normal',
      },
      heavy: {
        fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Black',
        fontWeight: 'normal',
      },
    },
  };

  const paperTheme = isDark ? CombinedDarkTheme : CombinedLightTheme;

  const handleFontLoadingComplete = useCallback((success: boolean) => {
    if (!isMountedRef.current) return;
    setFontLoadingComplete(true);
    setFontLoadingSuccess(success);
  }, []);

  useEffect(() => {
    splashTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setForceSplashHide(true);
      SplashScreen.hideAsync().catch(() => {
      });
      requestAnimationFrame(() => {
        isMountedRef.current = true;
      });
    }, 6000);

    const shouldHideSplash = (fontLoadingComplete) && (!authState.isLoading || forceSplashHide);
    
    if (shouldHideSplash) {
      if (splashTimeoutRef.current) {
        clearTimeout(splashTimeoutRef.current);
        splashTimeoutRef.current = null;
      }
      
      requestAnimationFrame(() => {
        SplashScreen.hideAsync()
          .then(() => {
            if (!isMountedRef.current) return;
            setTimeout(() => {
              if (isMountedRef.current) {
                isMountedRef.current = true;
              }
            }, 100);
          })
          .catch(() => {
            if (isMountedRef.current) {
              isMountedRef.current = true;
            }
          });
      });
    }

    return () => {
      if (splashTimeoutRef.current) {
        clearTimeout(splashTimeoutRef.current);
        splashTimeoutRef.current = null;
      }
    };
  }, [fontLoadingComplete, authState.isLoading, forceSplashHide]);

  useEffect(() => {
    if (!authState.isLoading) return;
    
    const fadeInOut = () => {
      const sequence = Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800, 
          useNativeDriver: true,
          easing: Easing.ease
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 800, 
          useNativeDriver: true,
          easing: Easing.ease
        })
      ]);
      
      fadeAnimationRef.current = sequence;
      sequence.start(() => {
        if (isMountedRef.current && authState.isLoading) {
          fadeInOut();
        }
      });
    };

    fadeInOut();

    return () => {
      if (fadeAnimationRef.current) {
        fadeAnimationRef.current.stop();
        fadeAnimationRef.current = null;
      }
    };
  }, [authState.isLoading, fadeAnim]);

  const safeNavigate = useCallback((path: string, params?: object) => {
    if (!isMountedRef.current || navigationInProgressRef.current) {
      return;
    }
    
    const pathWithParams = params ? `${path}?${JSON.stringify(params)}` : path;
    if (lastNavigationRef.current === pathWithParams) {
      return;
    }
    
    lastNavigationRef.current = pathWithParams;
    navigationInProgressRef.current = true;
    setIsNavigating(true); 
    
    requestAnimationFrame(() => {
      try {
        if (params) {
          router.navigate({
            pathname: path as never,
            params: params as never
          });
        } else {
          router.replace(path as never);
        }
        
        if (navigationTimeoutRef.current) {
          clearTimeout(navigationTimeoutRef.current);
        }
        
        navigationTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            navigationInProgressRef.current = false;
            setIsNavigating(false); 
            navigationTimeoutRef.current = null;
          }
        }, 800); 
      } catch (error) {
        navigationInProgressRef.current = false;
        setIsNavigating(false); 
      }
    });
  }, [router]);

  useEffect(() => {
    if (currentPathRef.current === null) {
      currentPathRef.current = pathname;
      return;
    }

    previousPathRef.current = currentPathRef.current;
    currentPathRef.current = pathname;

    if (previousPathRef.current !== currentPathRef.current) {
      setIsNavigating(true);

      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      
      navigationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsNavigating(false);
          navigationTimeoutRef.current = null;
        }
      }, 800);
    }
  }, [pathname]);
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      setIsNavigating(true);
      
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      
      navigationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setIsNavigating(false);
          navigationTimeoutRef.current = null;
        }
      }, 800);
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!isInitialized || !fontLoadingComplete || !isMountedRef.current) {
      return;
    }
    
    requestAnimationFrame(() => {
      const inAuthGroup = segments[0] === '(auth)';
      const inOnboardingGroup = segments[0] === 'onboarding';
      const inTabsGroup = segments[0] === '(tabs)';
      const currentlyVerifyingOTP = segments[1] === 'verify-otp';
      
      const currentPath = `/${segments.join('/')}`;
      
      try {
        if (isAuthenticated) {
          if (!isPhoneVerified && !currentlyVerifyingOTP) {
            if (profile && profile.phone) {
              const targetPath = '/(auth)/verify-otp';
              const params = { phone: profile.phone, userId: user?.id };
              
              if (lastNavigationRef.current !== `${targetPath}?${JSON.stringify(params)}`) {
                safeNavigate(targetPath, params);
              }
            }
            return;
          }

          if (isPhoneVerified && (inAuthGroup || inOnboardingGroup)) {
            safeNavigate('/(tabs)');
            return;
          }
        } else {
          if (!inOnboardingGroup && !inAuthGroup) {
            safeNavigate('/(auth)/login');
            return;
          }
        }
      } catch (navError) {
      }
    });
  }, [isInitialized, isAuthenticated, isPhoneVerified, segments, safeNavigate, profile, user, fontLoadingComplete]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      
      if (splashTimeoutRef.current) {
        clearTimeout(splashTimeoutRef.current);
        splashTimeoutRef.current = null;
      }
      
      if (fadeAnimationRef.current) {
        fadeAnimationRef.current.stop();
        fadeAnimationRef.current = null;
      }
    };
  }, []);

  const appIsReady = (fontLoadingComplete || forceSplashHide);
  
  if (!appIsReady) {
    return (
      <FontProvider onFontLoadingComplete={handleFontLoadingComplete}>
        <View style={{ flex: 1, backgroundColor: isDark ? '#121212' : '#fff' }} />
      </FontProvider>
    );
  }

  if (authState.isLoading && !forceSplashHide) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: isDark ? '#121212' : '#fff' 
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

  const toastConfig = {
    success: (props: any) => (
      <View style={{
        position: 'relative',
        top: '80%',
        left: '10%',
        transform: [{ translateX: -45 }, { translateY: -50 }],
        width: '90%',
        backgroundColor: isDark ? '#262626' : '#fff',
        padding: moderateScale(20),
        borderRadius: moderateScale(12),
        borderLeftWidth: 4,
        borderLeftColor: '#22C55E',
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.4 : 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(12),
      }}>
        <MaterialIcons name="check-circle" size={30} color="#22C55E" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: scale(18),
            fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Bold',
            fontWeight: !fontLoadingSuccess ? 'bold' : 'normal',
            color: isDark ? '#fff' : '#333',
            marginBottom: moderateScale(4),
          }}>
            {props.text1}
          </Text>
          <Text style={{
            fontSize: scale(14),
            fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Regular',
            color: isDark ? '#aaa' : '#666',
          }}>
            {props.text2}
          </Text>
        </View>
      </View>
    ),
    
    error: (props: any) => (
      <View style={{
        position: 'relative',
        top: '80%',
        left: '10%',
        transform: [{ translateX: -45 }, { translateY: -50 }],
        width: '90%',
        backgroundColor: isDark ? '#262626' : '#fff',
        padding: moderateScale(20),
        borderRadius: moderateScale(12),
        borderLeftWidth: 4,
        borderLeftColor: '#EF4444',
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.4 : 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(12),
      }}>
        <MaterialIcons name="error" size={30} color="#EF4444" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: scale(18),
            fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Bold',
            fontWeight: !fontLoadingSuccess ? 'bold' : 'normal',
            color: isDark ? '#fff' : '#333',
            marginBottom: moderateScale(4),
          }}>
            {props.text1}
          </Text>
          <Text style={{
            fontSize: scale(14),
            fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Regular',
            color: isDark ? '#aaa' : '#666',
          }}>
            {props.text2}
          </Text>
        </View>
      </View>
    ),
    
    info: (props: any) => (
      <View style={{
        position: 'relative',
        top: '80%',
        left: '10%',
        transform: [{ translateX: -45 }, { translateY: -50 }],
        width: '90%',
        backgroundColor: isDark ? '#262626' : '#fff',
        padding: moderateScale(20),
        borderRadius: moderateScale(12),
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.4 : 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: moderateScale(12),
      }}>
        <MaterialIcons name="info" size={30} color="#3B82F6" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: scale(18),
            fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Bold',
            fontWeight: !fontLoadingSuccess ? 'bold' : 'normal',
            color: isDark ? '#fff' : '#333',
            marginBottom: moderateScale(4),
          }}>
            {props.text1}
          </Text>
          <Text style={{
            fontSize: scale(14),
            fontFamily: !fontLoadingSuccess ? undefined : 'Urbanist-Regular',
            color: isDark ? '#aaa' : '#666',
          }}>
            {props.text2}
          </Text>
        </View>
      </View>
    ),
  };

  return (
    <FontProvider onFontLoadingComplete={handleFontLoadingComplete}>
      <ThemeProvider>
        <PaperProvider theme={paperTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom', 
              animationDuration: 200, 
            }}
          >
            {!session || !profile ? (
              <>
                <Stack.Screen 
                  name="onboarding"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
                <Stack.Screen 
                  name="(auth)"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
              </>
            ) : (
              <>
                <Stack.Screen 
                  name="(tabs)"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
                <Stack.Screen 
                  name="request"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
                <Stack.Screen 
                  name="transactions"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
                <Stack.Screen 
                  name="services"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
                <Stack.Screen 
                  name="payment"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
                <Stack.Screen 
                  name="terms&condition"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
                <Stack.Screen 
                  name="(provider)"
                  options={{ 
                    headerShown: false,
                    animation: 'fade_from_bottom',
                    animationDuration: 200
                  }} 
                />
              </>
            )}
          </Stack>
          <NetworkStatus />
          <Toast config={toastConfig} />
          {/* <NavigationLoader isNavigating={isNavigating} /> */}
        </PaperProvider>
      </ThemeProvider>
    </FontProvider>
  );
});