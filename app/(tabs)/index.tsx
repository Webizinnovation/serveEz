import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  Platform,
  BackHandler,
  Dimensions,
  InteractionManager,
  View,
  AppState,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { Provider } from '../../types';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import BannerSlider from '../../components/BannerSlider';
import { ScaledSheet } from 'react-native-size-matters';
import Header from '../../components/Header';
import ProviderHomeScreen from '../../components/provider/ProviderHomeScreen';
import { ProviderList } from '../../components/user/home/ProviderList';
import { ServicesSection } from '../../components/user/home/ServicesSection';
import { HeaderSection } from '../../components/user/home/HeaderSection';
import { useTheme } from '../../components/ThemeProvider';
import { Snackbar } from 'react-native-paper';
import { useLocation } from '../../hooks/useLocation';

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;


const ITEMS_PER_PAGE = 20;
const NEARBY_DISTANCE_THRESHOLD = 15; 
const MAX_PROVIDERS_DISPLAY = 10; 
const PREFETCH_TIMEOUT = 5000; 


const providerCache: {[key: string]: {data: any, timestamp: number}} = {};

const CACHE_EXPIRATION = 15 * 60 * 1000;

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { profile, updateProfile } = useUserStore();
  const { isDark, colors } = useTheme();

  const {
    location,
    locationText,
    state,
    lga,
    locationError,
    isRetrying,
    isInitialized: locationInitialized,
    retryLocation
  } = useLocation();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [prefetchedProviders, setPrefetchedProviders] = useState<{[key: string]: any}>({});
  const [loadingProviderId, setLoadingProviderId] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const lastActiveTime = useRef<number>(Date.now());

  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    console.log('HomeScreen mounted. Profile ID:', profile?.id);
    if (!profile?.id) {
      router.replace('/(auth)/login');
    }
    return () => {
      isMounted.current = false;
      console.log('HomeScreen unmounted. isMounted set to false.');
    };
  }, [profile, router]);

  useEffect(() => {
    console.log('Clearing old provider cache...');
    const now = Date.now();
    Object.keys(providerCache).forEach(key => {
      if (now - providerCache[key].timestamp > CACHE_EXPIRATION) {
        delete providerCache[key];
        console.log('Deleted expired cache for:', key);
      }
    });
  }, []);

  
  const filteredProviders = useMemo(() => {
    console.log('Recalculating filteredProviders. Query:', searchQuery, 'Providers count:', providers.length);
    if (!searchQuery.trim()) return providers;
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = providers.filter(provider => {
      const name = provider.users?.name?.toLowerCase() || '';
      const services = provider.services.map(s => s.toLowerCase());
      
      return (
        name.includes(query) ||
        services.some(service => service.includes(query))
      );
    });
    
    
    if (location?.coords) {
      filtered.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }
    
   
    return filtered.slice(0, MAX_PROVIDERS_DISPLAY);
  }, [providers, searchQuery, location]);

  const nearbyProviders = useMemo(() => {
    console.log('Recalculating nearbyProviders. Location:', location ? 'available' : 'unavailable', 'Providers count:', providers.length);
    if (!location?.coords) return [];
    
    const nearby = providers.filter(provider => {
      return typeof provider.distance === 'number' && 
             provider.distance <= NEARBY_DISTANCE_THRESHOLD && 
             provider.distance >= 0.1; 
    });
    
 
    nearby.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    
    
    return nearby.slice(0, MAX_PROVIDERS_DISPLAY); 
  }, [providers, location]);

 
  const randomProviders = useMemo(() => {
    console.log('Recalculating randomProviders. Nearby count:', nearbyProviders.length, 'Providers count:', providers.length);
    if (nearbyProviders.length > 0) return [];  
    
   
    const shuffled = [...providers].sort(() => 0.5 - Math.random());
    
  
    return shuffled.slice(0, MAX_PROVIDERS_DISPLAY); 
  }, [providers, nearbyProviders]);

  const displayProviders = useMemo(() => {
    console.log('Determining displayProviders. Nearby count:', nearbyProviders.length, 'Random count:', randomProviders.length);
    return nearbyProviders.length > 0 ? nearbyProviders : randomProviders;
  }, [nearbyProviders, randomProviders]);

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; 
    return d;
  }, []);

  const deg2rad = useCallback((deg: number) => {
    return deg * (Math.PI/180);
  }, []);

  const fetchProviders = useCallback(async () => {
    console.log('fetchProviders called. Profile ID:', profile?.id);
    if (!profile?.id) {
      console.log('No profile ID, aborting fetchProviders.');
      return;
    }
    
    try {
      if (isMounted.current) {
        setLoading(true);
        console.log('setLoading(true) in fetchProviders.');
      }
      
      const fetchTimeoutId = setTimeout(() => {
        if (isMounted.current) {
          console.log('Provider fetch operation timed out completely');
          setLoading(false);
          setProviders(prev => {
            console.log('Setting providers on timeout. Previous count:', prev.length);
            return prev.length > 0 ? prev : []; 
          }); 
          
          
          const message = 'Loading timed out. Pull down to retry.';
          if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
          } else {
            setSnackbarMessage(message);
            setSnackbarVisible(true);
          }
        }
      }, 20000); 
      
      let data;
      try {
        console.log('Fetching providers from Supabase...');
        const { data: providerData, error: fetchError } = await supabase
          .from('providers')
          .select(`
            *,
            users:user_id (id, name, email, profile_pic)
          `)
          .eq('availability', true)
          .not('user_id', 'eq', profile.id)
          .order('created_at', { ascending: false });
        
        if (fetchError) {
          console.error('Error fetching providers data from Supabase:', fetchError);
          throw fetchError;
        }
        
        data = providerData;
        console.log('Raw providers data received (count):', data ? data.length : 0, 'Data:', data);
        
        if (!data || data.length === 0) {
          clearTimeout(fetchTimeoutId);
          if (isMounted.current) {
            setProviders([]);
            setPage(0);
            setLoading(false);
            console.log('No providers found, setting empty array and setLoading(false).');
          }
          return;
        }
      } catch (fetchError) {
        console.error('Error fetching providers data (Supabase catch):', fetchError);
        clearTimeout(fetchTimeoutId);
        
        if (isMounted.current) {
          setLoading(false);
          setProviders(prev => {
            console.log('Setting providers on fetch error. Previous count:', prev.length);
            return prev.length > 0 ? prev : [];
          });
        }
        return;
      }

      try {
        console.log('Enhancing providers with calculated distance...');
        const enhancedProviders = data.map(provider => {
          return {
            ...provider,
            calculatedRating: provider.rating,
            reviews: [],
            distance: (location?.coords && provider.location?.latitude && provider.location?.longitude)
              ? calculateDistance(
                  location.coords.latitude,
                  location.coords.longitude,
                  provider.location.latitude,
                  provider.location.longitude
                )
              : null
          };
        });
        console.log('Providers enhanced with distance. First item distance:', enhancedProviders[0]?.distance);

        const providersWithDistance = location?.coords 
          ? enhancedProviders.sort((a, b) => {
              if (a.distance === null && b.distance === null) return 0;
              if (a.distance === null) return 1;
              if (b.distance === null) return -1;
              return a.distance - b.distance;
            })
          : enhancedProviders;

        if (isMounted.current) {
          setProviders(providersWithDistance);
          setPage(0);
          console.log('setProviders called with distance-sorted data. Count:', providersWithDistance.length);
        }

        const enhanceWithReviews = async () => {
          try {
            const enhancedWithReviews = await Promise.all(
              enhancedProviders.map(async (provider) => {
                const userId = provider.users?.id;
                
                if (!userId) {
                  return provider;
                }
                
                try {
                  const { data: reviewsData, error: reviewsError } = await supabase
                    .from('reviews')
                    .select('rating')
                    .eq('provider_id', userId);
                    
                  if (reviewsError) {
                    return provider;
                  }
                  
                  let averageRating = 0;
                  if (reviewsData && reviewsData.length > 0) {
                    const sum = reviewsData.reduce((acc, review) => acc + review.rating, 0);
                    averageRating = Number((sum / reviewsData.length).toFixed(1));
                  }
                    
                  return {
                    ...provider,
                    calculatedRating: averageRating,
                    reviews: reviewsData || []
                  };
                } catch (reviewError) {
                  return provider;
                }
              })
            );
            const sortedWithReviews = location?.coords 
              ? enhancedWithReviews.sort((a, b) => {
                  if (a.distance === null && b.distance === null) return 0;
                  if (a.distance === null) return 1;
                  if (b.distance === null) return -1;
                  return a.distance - b.distance;
                })
              : enhancedWithReviews;

            if (isMounted.current) {
              setProviders(sortedWithReviews);
            }
          } catch (reviewsError) {
          }
        };
        
        enhanceWithReviews();
        
      } catch (processingError) {
        if (data && data.length > 0 && isMounted.current) {
          const basicProviders = data.map(provider => ({
            ...provider,
            calculatedRating: provider.rating,
            reviews: []
          }));
          setProviders(basicProviders);
        }
      } finally {
        clearTimeout(fetchTimeoutId);
        if (isMounted.current) {
          setLoading(false);
        }
      }
    } catch (error) {
      if (isMounted.current) {
        setLoading(false);
        setProviders(prev => {
          console.log('Setting providers on unexpected error. Previous count:', prev.length);
          return prev.length > 0 ? prev : [];
        });
      }
    }
  }, [profile?.id, location, calculateDistance]);

  const loadMoreProviders = useCallback(async () => {
    console.log('loadMoreProviders called. Loading:', loading, 'Refreshing:', refreshing, 'SearchQuery:', searchQuery, 'Nearby count:', nearbyProviders.length);
    if (loading || refreshing) return;
    
    if (searchQuery || (!searchQuery && nearbyProviders.length > 0)) {
      console.log('Skipping loadMoreProviders due to search query or existing nearby providers.');
      return;
    }
    
    const nextPage = page + 1;
    const startAfter = nextPage * ITEMS_PER_PAGE;
    
    try {
      if (isMounted.current) {
        setLoading(true);
      }
      const { data, error } = await supabase
        .from('providers')
        .select(`
          *,
          users:user_id (id, name, email, profile_pic)
        `)
        .eq('availability', true)
        .not('user_id', 'eq', profile?.id || '')
        .range(startAfter, startAfter + ITEMS_PER_PAGE - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data.length === 0) {
        if (isMounted.current) {
          setLoading(false);
        }
        return;
      }

      const processProviderBatch = async (providers: any[], startIdx: number, batchSize: number) => {
        const endIdx = Math.min(startIdx + batchSize, providers.length);
        const batch = providers.slice(startIdx, endIdx);
        
        const processedBatch = await Promise.all(
          batch.map(async (provider) => {
            const userId = provider.users?.id;
            
            if (!userId) {
              return {
                ...provider,
                calculatedRating: provider.rating,
                distance: location?.coords 
                  ? calculateDistance(
                      location.coords.latitude,
                      location.coords.longitude,
                      provider.location?.latitude || 0,
                      provider.location?.longitude || 0
                    )
                  : 0
              };
            }
            
            const { data: reviewsData, error: reviewsError } = await supabase
              .from('reviews')
              .select('rating')
              .eq('provider_id', userId);
              
            if (reviewsError) {
              return {
                ...provider,
                calculatedRating: provider.rating,
                distance: location?.coords 
                  ? calculateDistance(
                      location.coords.latitude,
                      location.coords.longitude,
                      provider.location?.latitude || 0,
                      provider.location?.longitude || 0
                    )
                  : 0
              };
            }
              
            let averageRating = 0;
            if (reviewsData && reviewsData.length > 0) {
              const sum = reviewsData.reduce((acc, review) => acc + review.rating, 0);
              averageRating = Number((sum / reviewsData.length).toFixed(1));
            }
              
            return {
              ...provider,
              calculatedRating: averageRating,
              reviews: reviewsData || [],
              distance: location?.coords 
                ? calculateDistance(
                    location.coords.latitude,
                    location.coords.longitude,
                    provider.location?.latitude || 0,
                    provider.location?.longitude || 0
                  )
                : 0
            };
          })
        );
        
        return processedBatch;
      };
      
      const batchSize = 5;
      let results: Provider[] = [];
      
      const batchPromises = [];
      for (let i = 0; i < data.length; i += batchSize) {
        batchPromises.push(processProviderBatch(data, i, batchSize));
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      results = batchResults.flat();

      const newProvidersWithDistance = location?.coords 
        ? results.sort((a, b) => (a.distance || 0) - (b.distance || 0))
        : results;

      if (isMounted.current) {
        setProviders(prev => [...prev, ...newProvidersWithDistance]);
        setPage(nextPage);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading more providers:', error);
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [loading, refreshing, page, profile?.id, location, calculateDistance, searchQuery, nearbyProviders.length]);

  useEffect(() => {
    console.log('Main useEffect for data initialization. Profile ID:', profile?.id);
    if (!profile?.id) return;

    console.log('Calling fetchProviders from main useEffect.');
    fetchProviders();
  }, [profile?.id]); 

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        (appState.current === 'background' || appState.current === 'inactive') &&
        nextAppState === 'active'
      ) {
        const now = Date.now();
        const timeInBackground = now - lastActiveTime.current;
        const fiveMinutesInMs = 5 * 60 * 1000;
        
        if (timeInBackground > fiveMinutesInMs) {
          
          if (isMounted.current) {
            setLoading(true);
          }

          InteractionManager.runAfterInteractions(() => {
            fetchProviders();
          });
        }
      }
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        lastActiveTime.current = Date.now();
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [fetchProviders]);

  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect for BackHandler added.');
      let backPressCount = 0;
      let backPressTimer: NodeJS.Timeout | null = null;

      const handleBackPress = () => {
        if (backPressCount === 1) {
          BackHandler.exitApp();
          return true;
        } else {
          backPressCount += 1;
          
          const message = 'Press back again to exit';
          
          if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
          } else {
            setSnackbarMessage(message);
            setSnackbarVisible(true);
          }
          
          if (backPressTimer) clearTimeout(backPressTimer);
          backPressTimer = setTimeout(() => {
            backPressCount = 0;
          }, 2000);
          
          return true;
        }
      };

      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
        return () => {
          subscription.remove();
          if (backPressTimer) clearTimeout(backPressTimer);
        };
      }
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      console.log('useFocusEffect for navigation cleanup.');
      isNavigating.current = false;
      
      return () => {
        isNavigating.current = false;
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
          console.log('useFocusEffect cleanup: Loading, Refreshing set to false.');
        }
      };
    }, [])
  );

  const prefetchProviderDetails = useCallback(async (providerId: string) => {
    console.log('prefetchProviderDetails called for:', providerId);
    const now = Date.now();
    if (providerCache[providerId] && (now - providerCache[providerId].timestamp < CACHE_EXPIRATION)) {
      console.log('Using cached provider data for:', providerId);
      setPrefetchedProviders(prev => ({
        ...prev,
        [providerId]: providerCache[providerId].data
      }));
      return;
    }
    
    if (prefetchedProviders[providerId]) return;
    
    try { 
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PREFETCH_TIMEOUT);
      
      const { data, error } = await supabase
        .from('providers')
        .select(`
          *,
          users:user_id (id, name, email, profile_pic, phone)
        `)
        .eq('id', providerId)
        .single();
        
      clearTimeout(timeoutId);
      
      if (error) throw error;
      
      if (data && isMounted.current) {
        setPrefetchedProviders(prev => ({
          ...prev,
          [providerId]: data
        }));
        
        providerCache[providerId] = {
          data,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.log('Prefetch failed for provider:', providerId);
    }
  }, [prefetchedProviders]);
  
  const handleProviderItemPress = useCallback((id: string) => {
    console.log('handleProviderItemPress called for:', id);
    InteractionManager.runAfterInteractions(() => {
      prefetchProviderDetails(id);
    });
  }, [prefetchProviderDetails]);

  const onRefresh = useCallback(async () => {
    console.log('onRefresh called. Refreshing state:', refreshing);
    if (refreshing) return;
    setRefreshing(true);
    console.log('setRefreshing(true) in onRefresh.');
    
    const refreshTimeoutId = setTimeout(() => {
      if (isMounted.current) {
        setRefreshing(false);
        console.log('Refresh operation timed out.');
        
        const message = 'Refresh timed out. Try again later.';
        if (Platform.OS === 'android') {
          ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
          setSnackbarMessage(message);
          setSnackbarVisible(true);
        }
      }
    }, 15000);
    
    try {
      console.log('Calling fetchProviders from onRefresh.');
      await fetchProviders();
      
      // Only retry location if it's not initialized and there's an error
      if (!locationInitialized && locationError) {
        console.log('Location not initialized and has error, retrying location.');
        await retryLocation();
      }
      
      clearTimeout(refreshTimeoutId);
      console.log('Refresh successful.');
    } catch (error) {
      console.error('Error during refresh:', error);

      const message = 'Something went wrong. Please try again.';
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      }
      
      clearTimeout(refreshTimeoutId);
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
        console.log('setRefreshing(false) in onRefresh finally block.');
      }
    }
  }, [refreshing, fetchProviders, retryLocation, locationError, locationInitialized]);

  const shouldRenderProviderView = profile?.role === 'provider';

  const providerView = useMemo(() => (
    console.log('Rendering ProviderHomeScreen for role: provider'),
    <ProviderHomeScreen 
      profile={profile}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  ), [profile, onRefresh, refreshing]);


  const handleServicePress = useCallback((serviceName: string) => {
    console.log('handleServicePress called for:', serviceName);
    router.push(`/services/${serviceName}`);
  }, [router]);

  const handleSeeAllPress = useCallback(() => {
    console.log('handleSeeAllPress called.');
    navigation.navigate('services' as never);
    setTimeout(() => {
      useUserStore.setState(state => ({
        ...state,
        selectedOrderTab: 'ALL'
      }));
      console.log('Selected order tab set to ALL.');
    }, 100);
  }, [navigation]);

  const handleProviderPress = useCallback((id: string) => {
    console.log('handleProviderPress called for:', id, 'isNavigating:', isNavigating.current);
    if (isNavigating.current) {
      console.log('Navigation already in progress, ignoring tap');
      return;
    }
    
    isNavigating.current = true;
    
    setLoadingProviderId(id);
    console.log('setLoadingProviderId to:', id);
    
    setTimeout(() => {
      try {
        const providerData = prefetchedProviders[id] || providerCache[id]?.data;
        console.log('Navigating to provider details for:', id, 'Prefetched data available:', !!providerData);
        
        router.push({
          pathname: `./(provider)/${id}`,
          params: { prefetchedData: providerData ? JSON.stringify(providerData) : undefined }
        });
      } catch (error) {
        console.error('Navigation error:', error);
        isNavigating.current = false;
        setLoadingProviderId(null);
      }
    }, 10);
    
    setTimeout(() => {
      isNavigating.current = false;
      setLoadingProviderId(null);
      console.log('Navigation debounce ended. isNavigating:', false, 'loadingProviderId:', null);
    }, 1000);
    
  }, [router, prefetchedProviders]);
  
  const handleProfileUpdate = useCallback((url: string) => {
    console.log('handleProfileUpdate called with URL:', url);
    useUserStore.setState(state => ({
      profile: { ...state.profile!, profile_pic: url }
    }));
  }, []);

  const ListHeaderComponent = useMemo(() => (
    console.log('Re-rendering ListHeaderComponent. LocationText:', locationText, 'Nearby Providers Count:', nearbyProviders.length),
    <>
      <HeaderSection
        location={location}
        state={state}
        lga={lga}
        locationText={locationText}
        setState={() => {}}
        setLga={() => {}}
        getLocation={retryLocation}
        isRetrying={isRetrying}
        locationError={locationError}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <BannerSlider profile={profile} />
      <ServicesSection
        onServicePress={handleServicePress}
        onSeeAllPress={handleSeeAllPress}
      />
      <Text style={[
        styles.sectionTitle, 
        { color: isDark ? colors.text : '#333' }
      ]}>
        {nearbyProviders.length > 0 ? 'Providers Nearby' : 'Recommended Providers'}
      </Text>
    </>
  ), [
    location, state, lga, locationText, retryLocation, 
    isRetrying, locationError, searchQuery, profile,
    handleServicePress, handleSeeAllPress, isDark, colors.text,
    nearbyProviders.length
  ]);

  const resetAppState = useCallback(async () => {
    console.log('resetAppState called.');
    if (isMounted.current) {
      setLoading(true);
      setProviders([]);
      setPrefetchedProviders({});
      setPage(0);

      Object.keys(providerCache).forEach(key => {
        delete providerCache[key];
      });
      console.log('App state variables reset. Cache cleared.');
      
      setTimeout(() => {
        if (isMounted.current) {
          const message = 'App state reset';
          
          if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
          } else {
            setSnackbarMessage(message);
            setSnackbarVisible(true);
          }
          
          retryLocation();
          fetchProviders();
        }
      }, 300);
    }
  }, [retryLocation, fetchProviders]);

  return (
    <SafeAreaView style={[
      styles.container, 
      { backgroundColor: isDark ? '#000' : '#f9f9f9' }
    ]}>
      {!profile ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          {/* transient state during navigation */}
          <Text style={{color: isDark ? '#fff' : '#000'}}>Loading profile...</Text>
        </View>
      ) : shouldRenderProviderView ? (
        providerView
      ) : (
        <>
          <Header 
            profile={profile}
            onUpdateProfilePic={handleProfileUpdate}
            onReset={resetAppState}
          />
          {!profile?.profile_pic && (
            <TouchableOpacity 
              style={[
                styles.profilePrompt, 
                { 
                  backgroundColor: isDark ? 'rgba(51,169,212,0.2)' : 'rgba(28,126,222,0.1)' 
                }
              ]}
              onPress={() => router.push('/profile')}
            >
              <Ionicons 
                name="person-add-outline" 
                size={isSmallDevice ? 20 : 24} 
                color={isDark ? colors.tint : Colors.primary} 
              />
              <Text style={[
                styles.promptText, 
                { color: isDark ? colors.tint : Colors.primary }
              ]}>
                Complete your profile by adding a photo
              </Text>
              <Ionicons 
                name="chevron-forward" 
                size={isSmallDevice ? 20 : 24} 
                color={isDark ? colors.tint : Colors.primary} 
              />
            </TouchableOpacity>
          )}
          <ProviderList
            providers={searchQuery ? filteredProviders : displayProviders}
            loading={loading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onLoadMore={loadMoreProviders}
            onProviderPress={handleProviderPress}
            searchQuery={searchQuery}
            ListHeaderComponent={ListHeaderComponent}
            isDark={isDark}
            themeColors={colors}
            loadingProviderId={loadingProviderId}
          />
        </>
      )}
      <Snackbar
        visible={snackbarVisible && Platform.OS !== 'android'}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  profilePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,126,222,0.1)',
    padding: isSmallDevice ? '8@ms' : '12@ms',
    marginHorizontal: isSmallDevice ? '12@ms' : '16@ms',
    borderRadius: 8,
    marginTop: isSmallDevice ? '6@ms' : '8@ms',
  },
  promptText: {
    color: Colors.primary,
    fontFamily: 'Urbanist-Medium',
    marginHorizontal: isSmallDevice ? '6@ms' : '8@ms',
    fontSize: isSmallDevice ? '12@ms' : '14@ms',
  },
  sectionTitle: {
    fontSize: isSmallDevice ? '16@ms' : '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: isSmallDevice ? '12@ms' : '16@ms',
    paddingHorizontal: isSmallDevice ? '12@ms' : '16@ms',
    marginTop: isSmallDevice ? '12@ms' : '16@ms',
  },
});