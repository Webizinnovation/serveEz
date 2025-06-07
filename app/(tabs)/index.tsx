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
import * as Location from 'expo-location';
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

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;


const ITEMS_PER_PAGE = 20;
const LOCATION_TIMEOUT = 7000;
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
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [locationText, setLocationText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [page, setPage] = useState(0);
  const [prefetchedProviders, setPrefetchedProviders] = useState<{[key: string]: any}>({});
  const [loadingProviderId, setLoadingProviderId] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const lastActiveTime = useRef<number>(Date.now());
  

  const locationInitialized = useRef(false);

  const isNavigating = useRef(false);
  const isMounted = useRef(true);

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    if (!profile?.id) {
      router.replace('/(auth)/login');
    }
    return () => {
      isMounted.current = false;
    };
  }, [profile, router]);

  useEffect(() => {
    const now = Date.now();
    Object.keys(providerCache).forEach(key => {
      if (now - providerCache[key].timestamp > CACHE_EXPIRATION) {
        delete providerCache[key];
      }
    });
  }, []);

  
  const filteredProviders = useMemo(() => {
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
    if (nearbyProviders.length > 0) return [];  
    
   
    const shuffled = [...providers].sort(() => 0.5 - Math.random());
    
  
    return shuffled.slice(0, MAX_PROVIDERS_DISPLAY); 
  }, [providers, nearbyProviders]);

  const displayProviders = useMemo(() => {
    return nearbyProviders.length > 0 ? nearbyProviders : randomProviders;
  }, [nearbyProviders, randomProviders]);

  const getLocation = useCallback(async () => {
    if (isRetrying) return;
    try {
      setIsRetrying(true);
      
      // Create a main timeout for the entire location operation
      const locationMainTimeout = setTimeout(() => {
        if (isMounted.current) {
          console.warn('Location operation timed out completely');
          setLocationError(true);
          setIsRetrying(false);
          
          // Use a fallback "unknown" location so the rest of the app can function
          if (!location) {
            setLocation({
              coords: {
                latitude: 0,
                longitude: 0,
                altitude: null,
                accuracy: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: Date.now()
            });
            setLocationText('Unknown location');
          }
        }
      }, 20000); // 20 second hard timeout
        
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        clearTimeout(locationMainTimeout);
        if (isMounted.current) {
          setLocationError(true);
          setIsRetrying(false);
          
          // Use a fallback "unknown" location so providers still load
          if (!location) {
            setLocation({
              coords: {
                latitude: 0,
                longitude: 0,
                altitude: null,
                accuracy: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: Date.now()
            });
            setLocationText('Location access denied');
          }
        }
        return;
      }

      let position: Location.LocationObject | null = null;
      
      // Try high accuracy first
      try {
        position = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('High accuracy position timeout')), 8000)
          )
        ]) as Location.LocationObject;
      } catch (highAccuracyError) {
        console.warn('High accuracy position failed, trying low accuracy:', highAccuracyError);
      }
      
      // Fall back to low accuracy if needed
      if (!position) {
        try {
          position = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            }),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Low accuracy position timeout')), 8000)
            )
          ]) as Location.LocationObject;
        } catch (lowAccuracyError) {
          console.error('Low accuracy position also failed:', lowAccuracyError);
          throw new Error('Could not get location after multiple attempts');
        }
      }
      
      // Clear main timeout as we got a position
      clearTimeout(locationMainTimeout);
      
      if (!position) {
        throw new Error('No position returned but no error thrown');
      }

      if (isMounted.current) {
        setLocation(position);
        setLocationError(false);
      }

      try {
        const { latitude, longitude } = position.coords;
        
        // Attempt to get address from coordinates
        try {
          const addressResult = await Promise.race([
            Location.reverseGeocodeAsync({ latitude, longitude }),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Geocoding timeout')), 5000)
            )
          ]) as Location.LocationGeocodedAddress[];
          
          if (addressResult && addressResult.length > 0) {
            const address = addressResult[0];
            
            const region = address.region || address.country || 'Unknown';
            const subregion = address.city || address.subregion || '';
            const locationString = `${subregion ? subregion + ', ' : ''}${region}`.trim();
            
            if (isMounted.current) {
              setState(region);
              setLga(subregion);
              setLocationText(locationString || 'Location found');
            }

            if (profile?.id) {
              updateLocationInProfile(profile.id, {
                region,
                subregion,
                current_address: locationString,
                coords: { latitude, longitude }
              });
            }
          } else {
            handleNoAddressFound(position, profile?.id);
          }
        } catch (geocodeError) {
          console.warn('Geocoding failed:', geocodeError);
          handleNoAddressFound(position, profile?.id);
        }
      } catch (error) {
        console.error('Error processing location:', error);
        // We still have the basic coordinates, so not a complete failure
        if (isMounted.current) {
          setLocationText('Location found');
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      if (isMounted.current) {
        setLocationError(true);
        
        // If we don't have any location yet, use a fallback
        if (!location) {
          setLocation({
            coords: {
              latitude: 0,
              longitude: 0,
              altitude: null,
              accuracy: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            },
            timestamp: Date.now()
          });
          setLocationText('Location unavailable');
        }
      }
    } finally {
      if (isMounted.current) {
        setIsRetrying(false);
        locationInitialized.current = true;
      }
    }
  }, [profile, updateProfile, isRetrying, location]);

  // Helper function to update location in user profile
  const updateLocationInProfile = useCallback(async (userId: string, locationData: any) => {
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ location: locationData })
        .eq('id', userId);
        
      if (updateError) {
        console.error('Failed to update location in profile:', updateError);
      } else if (isMounted.current && profile) {
        updateProfile({
          ...profile,
          // @ts-ignore - ignoring TypeScript error for location property
          location: locationData
        });
      }
    } catch (dbError) {
      console.error('Database error updating location:', dbError);
    }
  }, [profile, updateProfile]);

  // Helper function for when no address is found from geocoding
  const handleNoAddressFound = useCallback((position: Location.LocationObject, userId?: string) => {
    const { latitude, longitude } = position.coords;
    const locationString = 'Location found';
    
    if (isMounted.current) {
      setState('Unknown region');
      setLga('');
      setLocationText(locationString);
    }
    
    if (userId) {
      const locationObject = {
        region: 'Unknown region',
        subregion: '',
        current_address: locationString,
        coords: { latitude, longitude }
      };
      
      updateLocationInProfile(userId, locationObject);
    }
  }, [updateLocationInProfile]);

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
    if (!profile?.id) return;
    
    try {
      if (isMounted.current) {
        setLoading(true);
      }
      
      // Add a hard timeout for the entire fetch operation
      const fetchTimeoutId = setTimeout(() => {
        if (isMounted.current) {
          console.log('Provider fetch operation timed out completely');
          setLoading(false);
          setProviders(prev => prev.length > 0 ? prev : []); // Keep existing providers if any
          
          // Show feedback to user
          const message = 'Loading timed out. Pull down to retry.';
          if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
          } else {
            setSnackbarMessage(message);
            setSnackbarVisible(true);
          }
        }
      }, 20000); // 20 second hard timeout
      
      let data;
      try {
        // First fetch basic provider data without the complex race promise
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
          console.error('Error fetching providers data:', fetchError);
          throw fetchError;
        }
        
        data = providerData;
        
        if (!data || data.length === 0) {
          clearTimeout(fetchTimeoutId);
          if (isMounted.current) {
            setProviders([]);
            setPage(0);
            setLoading(false);
          }
          return;
        }
      } catch (fetchError) {
        console.error('Error fetching providers data:', fetchError);
        clearTimeout(fetchTimeoutId);
        
        // Avoid setting providers to empty array if we already have data
        if (isMounted.current) {
          setLoading(false);
          // Only reset providers if we have no existing data
          setProviders(prev => prev.length > 0 ? prev : []);
        }
        return;
      }

      // We have basic provider data, now enhance it
      try {
        // Process all providers at once without complex batching
        const enhancedProviders = data.map(provider => {
          return {
            ...provider,
            calculatedRating: provider.rating,
            reviews: [],
            distance: location?.coords 
              ? calculateDistance(
                  location.coords.latitude,
                  location.coords.longitude,
                  provider.location?.latitude || 0,
                  provider.location?.longitude || 0
                )
              : null
          };
        });

        // Sort providers by distance if location available
        const providersWithDistance = location?.coords 
          ? enhancedProviders.sort((a, b) => {
              // Handle null/undefined distances
              if (a.distance === null && b.distance === null) return 0;
              if (a.distance === null) return 1;
              if (b.distance === null) return -1;
              return a.distance - b.distance;
            })
          : enhancedProviders;

        // First set providers with basic data quickly
        if (isMounted.current) {
          setProviders(providersWithDistance);
          setPage(0);
        }
        
        // Then enhance with reviews in the background
        const enhanceWithReviews = async () => {
          try {
            const enhancedWithReviews = await Promise.all(
              enhancedProviders.map(async (provider) => {
                const userId = provider.users?.id;
                
                if (!userId) return provider;
                
                try {
                  const { data: reviewsData, error: reviewsError } = await supabase
                    .from('reviews')
                    .select('rating')
                    .eq('provider_id', userId);
                    
                  if (reviewsError) return provider;
                  
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
                  console.warn(`Error fetching reviews for provider ${userId}:`, reviewError);
                  return provider;
                }
              })
            );
            
            // Sort by distance again with the enhanced data
            const sortedWithReviews = location?.coords 
              ? enhancedWithReviews.sort((a, b) => {
                  // Handle null/undefined distances
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
            console.warn('Error enhancing providers with reviews:', reviewsError);
            // We already have basic provider data, so this is not critical
          }
        };
        
        // Start the background enhancement
        enhanceWithReviews();
        
      } catch (processingError) {
        console.error('Error processing provider data:', processingError);
        // We might still have basic provider data, try to use it
        if (data && data.length > 0 && isMounted.current) {
          const basicProviders = data.map(provider => ({
            ...provider,
            calculatedRating: provider.rating,
            reviews: []
          }));
          setProviders(basicProviders);
        }
      } finally {
        // Always clear the timeout and set loading to false
        clearTimeout(fetchTimeoutId);
        if (isMounted.current) {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Unexpected error fetching providers:', error);
      if (isMounted.current) {
        setLoading(false);
        // Only reset providers if we have no existing data
        setProviders(prev => prev.length > 0 ? prev : []);
      }
    }
  }, [profile?.id, location, calculateDistance]);

  const loadMoreProviders = useCallback(async () => {
    if (loading || refreshing) return;
    
    // If we're searching or showing nearby/random providers, we don't need pagination
    if (searchQuery || (!searchQuery && nearbyProviders.length > 0)) {
      return;
    }
    
    const nextPage = page + 1;
    const startAfter = nextPage * ITEMS_PER_PAGE;
    
    try {
      // Set a temporary loading state for pagination
      if (isMounted.current) {
        setLoading(true);
      }
      
      // First fetch providers
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
        // No more data
        if (isMounted.current) {
          setLoading(false);
        }
        return;
      }

      // Process in batches like above
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
      
      // Process providers in batches of 5
      const batchSize = 5;
      let results: Provider[] = [];
      
      // Use Promise.all to process all batches concurrently for better performance
      const batchPromises = [];
      for (let i = 0; i < data.length; i += batchSize) {
        batchPromises.push(processProviderBatch(data, i, batchSize));
      }
      
      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten the results
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

  // Initialize data
  useEffect(() => {
    if (profile?.id) {
      fetchProviders();
      
      // Only initialize location once after login
      if (!locationInitialized.current) {
        try {
          // Try to load location from profile - using type assertion for TypeScript
          const userLocation = (profile as any).location;
          
          if (userLocation?.coords?.latitude && userLocation?.coords?.longitude) {
            // Create a location object from saved coordinates
            const savedLocation = {
              coords: {
                latitude: userLocation.coords.latitude,
                longitude: userLocation.coords.longitude,
                altitude: null,
                accuracy: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: Date.now()
            } as Location.LocationObject;
            
            // Set the location from the profile data
            setLocation(savedLocation);
            setState(userLocation.region || '');
            setLga(userLocation.subregion || '');
            setLocationText(userLocation.current_address || '');
            setLocationError(false);
            locationInitialized.current = true;
          } else {
            // If no location in profile, get it fresh
            getLocation();
          }
        } catch (error) {
          console.error('Error loading location from profile:', error);
          getLocation();
        }
      }
    }
  }, [profile?.id, fetchProviders, getLocation]);

  // Monitor app state changes - no longer update location on app resume
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // When app comes to the foreground from background or inactive state
      if (
        (appState.current === 'background' || appState.current === 'inactive') &&
        nextAppState === 'active'
      ) {
        // Check if the app was in background for more than 5 minutes
        const now = Date.now();
        const timeInBackground = now - lastActiveTime.current;
        const fiveMinutesInMs = 5 * 60 * 1000;
        
        if (timeInBackground > fiveMinutesInMs) {
          console.log('App was inactive for more than 5 minutes, refreshing provider data only...');
          
          // Reset provider data state only
          if (isMounted.current) {
            setLoading(true);
          }
          
          // Only refresh providers, not location
          InteractionManager.runAfterInteractions(() => {
            fetchProviders();
          });
        }
      }
      
      // Update the lastActiveTime when going to background
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        lastActiveTime.current = Date.now();
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [fetchProviders]);

  // Back button handler for Android
  useFocusEffect(
    useCallback(() => {
      let backPressCount = 0;
      let backPressTimer: NodeJS.Timeout | null = null;

      const handleBackPress = () => {
        if (backPressCount === 1) {
          // Exit the app on second press
          BackHandler.exitApp();
          return true;
        } else {
          // First press - show platform-specific notification and reset after timeout
          backPressCount += 1;
          
          const message = 'Press back again to exit';
          
          if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
          } else {
            setSnackbarMessage(message);
            setSnackbarVisible(true);
          }
          
          // Reset counter after 2 seconds
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

  // Clear any pending tasks when navigating away
  useFocusEffect(
    useCallback(() => {
      // When screen comes into focus, ensure navigation flag is reset
      isNavigating.current = false;
      
      return () => {
        // When screen loses focus, cancel any pending operations
        isNavigating.current = false; // Also reset navigation flag when leaving screen
        if (isMounted.current) {
          // Clear loading states
          setLoading(false);
          setRefreshing(false);
          setIsRetrying(false);
        }
      };
    }, [])
  );

  // Pre-fetch provider details for faster navigation
  const prefetchProviderDetails = useCallback(async (providerId: string) => {
    // Check cache first
    const now = Date.now();
    if (providerCache[providerId] && (now - providerCache[providerId].timestamp < CACHE_EXPIRATION)) {
      console.log('Using cached provider data for:', providerId);
      // Update prefetched state with cached data
      setPrefetchedProviders(prev => ({
        ...prev,
        [providerId]: providerCache[providerId].data
      }));
      return;
    }
    
    // Skip if already prefetched
    if (prefetchedProviders[providerId]) return;
    
    try {
      // Create a timeout controller to abort the fetch if it takes too long
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PREFETCH_TIMEOUT);
      
      // Fetch provider details in the background
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
        // Store in prefetched state
        setPrefetchedProviders(prev => ({
          ...prev,
          [providerId]: data
        }));
        
        // Store in cache
        providerCache[providerId] = {
          data,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      // Silently fail for prefetching - we'll fetch again when needed
      console.log('Prefetch failed for provider:', providerId);
    }
  }, [prefetchedProviders]);
  
  // Handle touch start on provider item - begin prefetching
  const handleProviderItemPress = useCallback((id: string) => {
    // Pre-fetch in the background
    InteractionManager.runAfterInteractions(() => {
      prefetchProviderDetails(id);
    });
  }, [prefetchProviderDetails]);

  // Add onRefresh function here, after all other functions it depends on are defined
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    
    // Set a timeout to force end refreshing after 15 seconds
    const refreshTimeoutId = setTimeout(() => {
      if (isMounted.current) {
        setRefreshing(false);
        console.log('Refresh operation timed out');
        
        // Notify user
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
      // Run operations in sequence rather than parallel to avoid race conditions
      await fetchProviders();
      
      // Only get location if it's not already available or if there was an error
      if (!location?.coords || locationError) {
        await getLocation();
      }
      
      // Clean up timeout as operations completed successfully
      clearTimeout(refreshTimeoutId);
    } catch (error) {
      console.error('Error during refresh:', error);
      
      // Show error message to user
      const message = 'Something went wrong. Please try again.';
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      }
      
      // Clean up timeout as we're handling the error
      clearTimeout(refreshTimeoutId);
    } finally {
      // Always reset refreshing state
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  }, [refreshing, fetchProviders, getLocation, location, locationError]);

  // Set up a variable to determine which view to render instead of using early returns
  const shouldRenderProviderView = profile?.role === 'provider';

  // Provider view (now rendered in the final return)
  const providerView = useMemo(() => (
    <ProviderHomeScreen 
      profile={profile}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  ), [profile, onRefresh, refreshing]);

  // Retry location handler - only used for manual refresh
  const retryLocation = useCallback(async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    try {
      await getLocation();
    } finally {
      if (isMounted.current) {
        setIsRetrying(false);
      }
    }
  }, [getLocation, isRetrying]);

  // Service navigation handlers
  const handleServicePress = useCallback((serviceName: string) => {
    router.push(`/services/${serviceName}`);
  }, [router]);

  const handleSeeAllPress = useCallback(() => {
    navigation.navigate('services' as never);
    setTimeout(() => {
      useUserStore.setState(state => ({
        ...state,
        selectedOrderTab: 'ALL'
      }));
    }, 100);
  }, [navigation]);

  // Safe navigation handler to prevent double clicks
  const handleProviderPress = useCallback((id: string) => {
    // Use local variable for immediate tap detection
    // This provides protection even before the React event cycle completes
    if (isNavigating.current) {
      console.log('Navigation already in progress, ignoring tap');
      return;
    }
    
    // Set navigation flag immediately
    isNavigating.current = true;
    
    // Set loading state for visual feedback
    setLoadingProviderId(id);
    
    // Add a small delay before navigation to ensure any potential second tap
    // will definitely encounter the isNavigating flag
    setTimeout(() => {
      try {
        // Store prefetched data for faster access on the detail screen
        const providerData = prefetchedProviders[id] || providerCache[id]?.data;
        
        // Navigate to provider details
        router.push({
          pathname: `./(provider)/${id}`,
          params: { prefetchedData: providerData ? JSON.stringify(providerData) : undefined }
        });
      } catch (error) {
        console.error('Navigation error:', error);
        // Reset flag in case of error
        isNavigating.current = false;
        setLoadingProviderId(null);
      }
    }, 10); // Very small delay that's imperceptible to user but helps catch rapid taps
    
    // Reset navigation flag after a longer delay to prevent any subsequent taps
    // This ensures the flag is eventually reset even if there's an error during navigation
    setTimeout(() => {
      isNavigating.current = false;
      setLoadingProviderId(null);
    }, 1000); // Extended to 1 second for maximum protection against rapid clicks
    
  }, [router, prefetchedProviders]);

  // Profile update handler
  const handleProfileUpdate = useCallback((url: string) => {
    useUserStore.setState(state => ({
      profile: { ...state.profile!, profile_pic: url }
    }));
  }, []);

  // Memoize ListHeaderComponent to prevent re-renders
  const ListHeaderComponent = useMemo(() => (
    <>
      <HeaderSection
        location={location}
        state={state}
        lga={lga}
        locationText={locationText}
        setState={setState}
        setLga={setLga}
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

  // Reset app state function - explicit user action
  const resetAppState = useCallback(async () => {
    if (isMounted.current) {
      // Clear app state
      setLoading(true);
      setLocationError(false);
      setProviders([]);
      setIsRetrying(false);
      setPrefetchedProviders({});
      setPage(0);

      Object.keys(providerCache).forEach(key => {
        delete providerCache[key];
      });
      
      setTimeout(() => {
        if (isMounted.current) {
          const message = 'App state reset';
          
          if (Platform.OS === 'android') {
            ToastAndroid.show(message, ToastAndroid.SHORT);
          } else {
            setSnackbarMessage(message);
            setSnackbarVisible(true);
          }
          
          getLocation();
          fetchProviders();
        }
      }, 300);
    }
  }, [getLocation, fetchProviders]);

  return (
    <SafeAreaView style={[
      styles.container, 
      { backgroundColor: isDark ? '#000' : '#f9f9f9' }
    ]}>
      {!profile ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          {/* Don't show any content - this is just a transient state during navigation */}
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