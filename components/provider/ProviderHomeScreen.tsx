import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Switch,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Linking,
  Platform,
  BackHandler,
  AppState,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, removeAllSubscriptions } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { ScaledSheet } from 'react-native-size-matters';
import * as Location from 'expo-location';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { formatDate } from '../../utils/dateFormatter';
import { useTheme } from '../../components/ThemeProvider';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoadingOverlay from '../common/LoadingOverlay';
import { unregisterPushNotifications, sendNewBookingNotification } from '../../services/pushNotifications';

interface ProviderHomeScreenProps {
  profile: any;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}

interface Transaction {
  id: string;
  amount: number;
  service?: string;
  status: string;
  created_at: string;
  due_date: string;
  user: {
    id: string;
    name: string;
    profile_pic: string | null;
    phone: string | null;
  }[];
}

export default function ProviderHomeScreen({ profile, onRefresh: parentOnRefresh, refreshing: parentRefreshing }: ProviderHomeScreenProps) {
    const { profile: userProfile } = useUserStore();
    const [isOnline, setIsOnline] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const router = useRouter();
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [earnings, setEarnings] = useState(0);
    const [completedJobs, setCompletedJobs] = useState(0);
    const [pendingRequests, setPendingRequests] = useState({ count: 0, activities: 0 });
    const [state, setState] = useState('');
    const [lga, setLga] = useState('');
    const [filteredProviders, setFilteredProviders] = useState<any[]>([]);
    const [latestRequest, setLatestRequest] = useState<{
      id: string;
      activities_count: number;
      created_at: string;
    } | null>(null);
    const [locationText, setLocationText] = useState<string>('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [pendingBookings, setPendingBookings] = useState<{
      count: number;
      latest?: {
        id: string;
        service: string;
        created_at: string;
      };
    }>({ count: 0 });
    const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [providerId, setProviderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { isDark, colors, toggleTheme } = useTheme();
    const isLoggingOut = useRef(false);
    const [showLoading, setShowLoading] = useState(false);
    
    // Track if location has been initialized
    const locationInitialized = useRef(false);
  
    // For tracking app state changes
    const appState = useRef(AppState.currentState);
    const lastActiveTime = useRef<number>(Date.now());
  
    // Add refs for channel subscriptions
    const notificationsChannelRef = useRef<any>(null);
    const bookingsChannelRef = useRef<any>(null);
    const notificationsChannelRef2 = useRef<any>(null);
    const transactionsChannelRef = useRef<any>(null);
  
    const fetchProviderStats = async () => {
      try {
        // Don't attempt to fetch if profile is null/undefined
        if (!userProfile || !userProfile.id) {
          console.log('Skipping provider stats fetch because profile is not available');
          return;
        }
        
        // First get provider ID
        const { data: providerData, error: providerError } = await supabase
          .from('providers')
          .select('id, availability')
          .eq('user_id', userProfile?.id)
          .single();
  
        if (providerError) throw providerError;

        setIsOnline(providerData?.availability || false);

        // Get total earnings from transactions
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('amount')
          .eq('provider_id', providerData.id)
          .in('type', ['payment', 'booking_payment']);

        if (transactionsError) throw transactionsError;

        const totalEarnings = transactionsData?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
        setEarnings(totalEarnings);

        // Get completed jobs count from bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('id')
          .eq('provider_id', providerData.id)
          .eq('status', 'completed');

        if (bookingsError) throw bookingsError;

        setCompletedJobs(bookingsData?.length || 0);
  
        // Separately fetch job requests
        const { data: requests, error: requestsError } = await supabase
          .from('bookings')
          .select('id, service')
          .eq('provider_id', providerData.id)
          .eq('status', 'pending');
  
        if (requestsError) throw requestsError;
        
        setPendingRequests({
          count: requests?.length || 0,
          activities: requests?.reduce((sum, req) => sum + (req.service.length || 0), 0) || 0
        });
  
        return Promise.resolve();
      } catch (error) {
        console.error('Error fetching provider stats:', error);
        Alert.alert('Error', 'Failed to load provider statistics');
        return Promise.reject(error);
      }
    };
  
    const fetchPendingBookings = async () => {
      try {
        const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('id, user_id')
        .eq('user_id', userProfile?.id)
        .single();

      if (providerError) throw providerError;

        const { data, error } = await supabase
          .from('bookings')
          .select('id, service, created_at')
          .eq('provider_id', providerData.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
  
        if (error) throw error;
  
        setPendingBookings({
          count: data?.length || 0,
          latest: data?.[0]
        });
      } catch (error) {
        console.error('Error fetching pending bookings:', error);
      }
    };
  
    const fetchUnreadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('count')
          .eq('user_id', userProfile?.id)
          .eq('read', false)
          .single();
  
        if (error) throw error;
        setUnreadNotifications(data?.count || 0);
        return Promise.resolve();
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return Promise.reject(error);
      }
    };
  
    const fetchUnreadCount = async () => {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userProfile?.id)
          .eq('read', false);
        
        setUnreadCount(count || 0);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };
  
    const fetchPendingTransactions = async () => {
      setIsLoading(true);
      try {
        // First get the provider id
        const { data: providerData, error: providerError } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', userProfile?.id)
          .single();

        if (providerError) throw providerError;

        // Get all accepted bookings that aren't completed
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            service,
            booking_date,
            booking_time,
            amount,
            user_id,
            status,
            created_at
          `)
          .eq('provider_id', providerData.id)
          .eq('status', 'in_progress');

        if (bookingsError) throw bookingsError;

        if (!bookings?.length) {
          setPendingTransactions([]);
          return;
        }

        // Fetch user details separately
        const userIds = bookings.map(booking => booking.user_id);
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, name, profile_pic, phone')
          .in('id', userIds);

        if (usersError) throw usersError;

        // Transform bookings to match the transaction format
        const transformedBookings: Transaction[] = bookings.map(booking => {
          const user = users?.find(u => u.id === booking.user_id);
          return {
            id: booking.id,
            amount: booking.amount,
            service: booking.service,
            status: booking.status,
            created_at: booking.created_at,
            due_date: booking.booking_date,
            user: [{
              id: user?.id || booking.user_id,
              name: user?.name || 'Unknown User',
              profile_pic: user?.profile_pic || null,
              phone: user?.phone || null
            }]
          };
        });

        setPendingTransactions(transformedBookings);
      } catch (error) {
        console.error('Error fetching pending transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };
  
    useEffect(() => {
      fetchProviderStats();
      fetchPendingBookings();
    }, []);
  
    useEffect(() => {
      fetchUnreadNotifications();
  
      // Clean up existing channel if it exists
      if (notificationsChannelRef.current) {
        supabase.removeChannel(notificationsChannelRef.current);
      }
  
      // Subscribe to new notifications
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile?.id}`,
          },
          () => {
            fetchUnreadNotifications();
          }
        )
        .subscribe();
      
      // Store the channel reference
      notificationsChannelRef.current = channel;
  
      return () => {
        if (notificationsChannelRef.current) {
          supabase.removeChannel(notificationsChannelRef.current);
        }
      };
    }, [userProfile?.id]);
  
    useEffect(() => {
      const checkInitialStatus = async () => {
        try {
          const { data, error } = await supabase
            .from('providers')
            .select('availability')
            .eq('user_id', userProfile?.id)
            .single();
  
          if (error) throw error;
          setIsOnline(data?.availability || false);
        } catch (error) {
          console.error('Error checking initial status:', error);
        }
      };
  
      if (userProfile?.id) {
        checkInitialStatus();
      }
    }, [userProfile?.id]);
  
    useEffect(() => {
      if (!userProfile?.id) return;
  
      // Clean up existing channel if it exists
      if (bookingsChannelRef.current) {
        supabase.removeChannel(bookingsChannelRef.current);
      }
  
      // Subscribe to new job requests
      const channel = supabase
        .channel('bookings')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bookings',
            filter: `provider_id=eq.${userProfile.id}`,
          },
          (payload) => {
            console.log('New request received:', payload);
            setLatestRequest({
              id: payload.new.id,
              activities_count: payload.new.activities_count || 0,
              created_at: payload.new.created_at,
            });
          }
        )
        .subscribe();
      
      // Store the channel reference  
      bookingsChannelRef.current = channel;
  
      return () => {
        if (bookingsChannelRef.current) {
          supabase.removeChannel(bookingsChannelRef.current);
        }
      };
    }, [userProfile?.id]);
  
    useEffect(() => {
      if (!userProfile?.id) return;

      fetchUnreadCount();

      // Clean up existing channel if it exists
      if (notificationsChannelRef2.current) {
        supabase.removeChannel(notificationsChannelRef2.current);
      }

      const channel = supabase
        .channel('notifications-count')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile?.id}`,
          },
          () => {
            fetchUnreadNotifications();
          }
        )
        .subscribe();
      
      // Store the channel reference
      notificationsChannelRef2.current = channel;

      return () => {
        if (notificationsChannelRef2.current) {
          supabase.removeChannel(notificationsChannelRef2.current);
        }
      };
    }, [userProfile?.id]);
  
    useEffect(() => {
      // Show welcome message for new providers without profile picture
      if (userProfile && !userProfile.profile_pic && showWelcomeMessage) {
        Toast.show({
          type: 'info',
          text1: `Welcome ${userProfile.name}! 👋`,
          text2: 'Complete your profile by adding a profile picture to build trust with potential clients.',
          position: 'top',
          visibilityTime: 5000,
          onPress: () => {
            router.push('/profile');
          }
        });
        setShowWelcomeMessage(false);
      }
    }, [userProfile]);
  
    useEffect(() => {
      fetchPendingTransactions();
    }, []);
  
    const handleToggleAvailability = async (value: boolean) => {
      try {
        const { error } = await supabase
          .from('providers')
          .update({ availability: value })
          .eq('user_id', userProfile?.id);
  
        if (error) throw error;
    
        setIsOnline(value);
      } catch (error) {
        console.error('Error updating availability:', error);
        Alert.alert('Error', 'Failed to update availability');
        setIsOnline(!value);
      }
    };
  
    // Callback for refreshing data only (no location)
    const refreshDataOnly = useCallback(async () => {
      try {
        setIsLoading(true);
        await Promise.all([
          fetchProviderStats(),
          fetchPendingBookings(),
          fetchUnreadNotifications(),
          fetchPendingTransactions()
        ]);
      } catch (error) {
        console.error('Error refreshing data:', error);
      } finally {
        setIsLoading(false);
      }
    }, [fetchProviderStats, fetchPendingBookings, fetchUnreadNotifications, fetchPendingTransactions]);
    
    // Full refresh function for user-initiated refresh that includes location
    const handleRefresh = useCallback(async () => {
      setRefreshing(true);
      try {
        // Run these in parallel
        const dataPromise = Promise.all([
          fetchProviderStats(),
          fetchPendingBookings(),
          fetchUnreadNotifications(),
          fetchPendingTransactions()
        ]);
        
        // Get location separately
        getLocation();
        
        // Wait for data to finish loading
        await dataPromise;
      } catch (error) {
        console.error('Error refreshing data:', error);
      } finally {
        setRefreshing(false);
      }
    }, [fetchProviderStats, fetchPendingBookings, fetchUnreadNotifications, fetchPendingTransactions]);
  
    // Monitor app state changes
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
            
            // Only refresh provider data, not location
            InteractionManager.runAfterInteractions(() => {
              refreshDataOnly();
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
    }, [refreshDataOnly]);
  
    // Initialize provider ID and subscriptions
    useEffect(() => {
      const initializeProvider = async () => {
        if (!userProfile?.id) return;

        try {
          const { data: providerData, error } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', userProfile.id)
            .single();

          if (error) throw error;
          setProviderId(providerData.id);

          // Subscribe to transactions
          const transactionsChannel = supabase
            .channel('transactions-channel')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'transactions',
                filter: `provider_id=eq.${providerData.id}`,
              },
              () => {
                fetchProviderStats();
              }
            )
            .subscribe();

          // Subscribe to bookings
          const bookingsChannel = supabase
            .channel('bookings-channel')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'bookings',
                filter: `provider_id=eq.${providerData.id}`,
              },
              async (payload) => {
                console.log('Booking change detected:', payload);
                
                // Check if this is a new booking (INSERT event)
                if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
                  fetchProviderStats();
                  fetchPendingBookings();
                  fetchPendingTransactions();
                  
                  try {
                    // Get user details to display in notification
                    const { data: userData, error: userError } = await supabase
                      .from('users')
                      .select('name')
                      .eq('id', payload.new.user_id)
                      .single();
                    
                    if (userError) throw userError;
                    
                    // Send push notification for new booking
                    const userName = userData?.name || 'A user';
                    const serviceName = payload.new.service || 'a service';
                    
                    await sendNewBookingNotification(serviceName, userName);
                    
                    // Also display a toast notification if the app is open
                    Toast.show({
                      type: 'success',
                      text1: 'New Booking Request!',
                      text2: `${userName} has requested your services`,
                      position: 'top',
                      visibilityTime: 4000,
                    });
                  } catch (error) {
                    console.error('Error handling new booking notification:', error);
                    // Still fetch updated data even if notification fails
                    fetchProviderStats();
                    fetchPendingBookings();
                    fetchPendingTransactions();
                  }
                } else {
                  // For other events, just refresh the data
                  fetchProviderStats();
                  fetchPendingBookings();
                  fetchPendingTransactions();
                }
              }
            )
            .subscribe();

          return () => {
            supabase.removeChannel(transactionsChannel);
            supabase.removeChannel(bookingsChannel);
          };
        } catch (error) {
          console.error('Error initializing provider:', error);
        }
      };

      initializeProvider();
      
      // Reset app state tracking on mount
      appState.current = AppState.currentState;
      lastActiveTime.current = Date.now();
      
    }, [userProfile?.id]);
    
    // Clear all subscriptions and timers on unmount
    useEffect(() => {
      return () => {
        // This will run when the component unmounts
        console.log('Provider home screen unmounting, cleaning up resources');
      };
    }, []);
  
    // Add automatic refresh interval for pending transactions
    useEffect(() => {
      const refreshInterval = setInterval(() => {
        fetchPendingTransactions();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(refreshInterval);
    }, []);
  
    const handleActionPress = (action: string) => {
      switch (action) {
        case 'Locate':
          if (!locationText) {
            getLocation(); // Only get location if not already set
          }
          break;
        case 'Requests':
          router.push('/(tabs)/services');
          break;
        case 'Initiate\nPayment':
          router.push('/(tabs)/wallet');
          break;
        case 'Query\nPayment':
          router.push('/(tabs)/wallet');
          break;
      }
    };
  
    const handleCall = (userId: string, phone: string | null) => {
      if (!phone) {
        Alert.alert('Error', 'Phone number not available');
        return;
      }

      Alert.alert(
        'Call Customer',
        phone,
        [
          {
            text: 'Copy Number',
            onPress: () => {
              Clipboard.setString(phone);
              Alert.alert('Success', 'Phone number copied to clipboard');
            },
          },
          {
            text: 'Call',
            onPress: () => {
              Linking.openURL(`tel:${phone}`);
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    };
  
    const handleChat = async (userId: string): Promise<void> => {
      try {
        const { data: currentUser } = await supabase.auth.getUser();
        if (!currentUser?.user?.id) {
          throw new Error('Auth user not found');
        }

        const { data: providerData, error: providerError } = await supabase
          .from('providers')
          .select('id, user_id, users:user_id (name)')
          .eq('user_id', currentUser.user.id)
          .single();

        if (providerError) throw providerError;
        if (!providerData) throw new Error('Provider not found');

        const providerName = providerData.users[0]?.name;

        const { data: existingChats, error: searchError } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('user_id', userId)
          .eq('provider_id', providerData.user_id);

        if (searchError) throw searchError;

        let chatId: string | undefined;

        if (existingChats && existingChats.length > 0) {
          chatId = existingChats[0].id;
        } else {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('name')
            .eq('id', userId)
            .single();

          if (userError) throw userError;

          const { data: newChat, error: createError } = await supabase
            .from('chat_rooms')
            .insert({
              user_id: userId,
              provider_id: providerData.user_id,
              user_name: userData?.name,
              provider_name: providerName,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_message: null,
              last_message_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (createError) throw createError;
          chatId = newChat?.id;
        }

        if (chatId) {
          router.push(`/provider/chat/${chatId}`);
        }
      } catch (error) {
        console.error('Error handling chat:', error);
        Alert.alert('Error', 'Failed to open chat');
      }
    };
  
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Location access is required to show nearby providers');
          return;
        }
        
        // Create a timeout promise
        const locationTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Location request timed out')), 15000); // 15 second timeout
        });
  
        // Get location with timeout
        let location;
        try {
          location = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            locationTimeoutPromise
          ]) as Location.LocationObject;
        } catch (positionError) {
          console.warn('Position fetch error:', positionError);
          // Try with low accuracy as fallback
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
        }
        
        if (!location) {
          throw new Error('Could not get location');
        }
        
        setLocation(location);
  
        // Get address from coordinates
        const { latitude, longitude } = location.coords;
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Geocoding timeout')), 7000);
        });
        
        const addressResponse = await Promise.race([
          Location.reverseGeocodeAsync({ latitude, longitude }),
          timeoutPromise
        ]) as Location.LocationGeocodedAddress[];
        
        const address = addressResponse[0];
  
        if (!address) {
          console.warn('Could not get address from location, using coords only');
          
          const locationString = 'Location found';
          setState('Unknown region');
          setLga('');
          setLocationText(locationString);
          
          if (userProfile?.id) {
            const locationObject = {
              coords: { latitude, longitude },
              region: 'Unknown region',
              subregion: '',
              current_address: locationString
            };
            
            const { error: updateError } = await supabase
              .from('users')
              .update({ location: locationObject })
              .eq('id', userProfile.id);
  
            if (updateError) throw updateError;
          }
          
          locationInitialized.current = true;
          return;
        }
        
        const region = address.region || address.country || '';
        const subregion = address.subregion || address.city || '';
        const locationString = `${address.street ? address.street + ', ' : ''}${subregion ? subregion + ', ' : ''}${region}`.trim();
        
        setState(region);
        setLga(subregion);
        setLocationText(locationString);
        
        // Update user profile with location
        if (userProfile?.id) {
          const locationObject = {
            coords: { latitude, longitude },
            region: region,
            subregion: subregion,
            current_address: locationString
          };
          
          const { error: updateError } = await supabase
            .from('users')
            .update({ location: locationObject })
            .eq('id', userProfile.id);

          if (updateError) throw updateError;
        }
        
        // Mark location as initialized after fetching
        locationInitialized.current = true;
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Failed to get location');
      }
    };
    
    // Function to load location from user profile
    const loadLocationFromProfile = () => {
      if (!userProfile || locationInitialized.current) return false;
      
      try {
        // Use type assertion to access location property
        const userLocation = (userProfile as any).location;
        
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
          
          // Update the state with saved location data
          setLocation(savedLocation);
          setState(userLocation.region || '');
          setLga(userLocation.subregion || '');
          setLocationText(userLocation.current_address || '');
          
          locationInitialized.current = true;
          return true;
        }
      } catch (error) {
        console.error('Error loading location from profile:', error);
      }
      
      return false;
    };
  
    // Initialize location once
    useEffect(() => {
      if (userProfile?.id && !locationInitialized.current) {
        const locationLoaded = loadLocationFromProfile();
        
        
        if (!locationLoaded) {
          getLocation();
        }
      }
    }, [userProfile?.id]);

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
            // First press - show toast and reset after timeout
            backPressCount += 1;
            Toast.show({
              type: 'info',
              text1: 'Press back again to exit',
              position: 'bottom',
              visibilityTime: 2000,
            });
            
            // Reset counter after 2 seconds
            if (backPressTimer) clearTimeout(backPressTimer);
            backPressTimer = setTimeout(() => {
              backPressCount = 0;
            }, 2000);
            
            return true;
          }
        };

        let backHandlerSubscription: any = null;
        if (Platform.OS === 'android') {
          backHandlerSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            handleBackPress
          );
        }
          
        return () => {
          if (Platform.OS === 'android' && backHandlerSubscription) {
            backHandlerSubscription.remove();
          }
          if (backPressTimer) {
            clearTimeout(backPressTimer);
          }
        };
      }, [])
    );
  
    // Add logout handler
    const handleLogout = useCallback(async () => {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              try {
                // Prevent multiple logouts
                if (isLoggingOut.current) return;
                isLoggingOut.current = true;
                
                setShowLoading(true);
                
                // Show a toast first
                Toast.show({
                  type: 'info',
                  text1: 'Logging out...',
                  position: 'top',
                  visibilityTime: 2000,
                });
                
                // Get the user ID before clearing the profile
                const userId = profile?.id;
                
                // Clear profile data before signing out to reduce race conditions
                useUserStore.setState({ profile: null });
                
                // Clean up all Supabase real-time subscriptions to prevent errors
                removeAllSubscriptions();
                
                // Unregister push notifications if we have a user ID
                if (userId) {
                  try {
                    const { success, error: pushError } = await unregisterPushNotifications(userId);
                    if (!success) {
                      console.warn('Failed to unregister push notifications:', pushError);
                    }
                  } catch (pushError) {
                    console.error('Error unregistering push notifications:', pushError);
                    // Continue with logout even if this fails
                  }
                }
                
                // Delay the actual logout operation briefly to allow the toast to render
                setTimeout(async () => {
                  try {
                    // Sign out
                    await supabase.auth.signOut();
                    
                    // Force clear session data for extra reliability
                    await AsyncStorage.removeItem('supabase.auth.token');
                    
                    // Add a small delay to ensure auth state is updated
                    setTimeout(() => {
                      // Use the router to navigate to welcome screen directly 
                      // This can avoid waiting for the auth state change detection
                      router.replace('/(auth)/login');
                      
                      // Reset logout flag after navigation
                      setTimeout(() => {
                        isLoggingOut.current = false;
                        setShowLoading(false);
                      }, 1000);
                    }, 300);
                  } catch (error: any) {
                    isLoggingOut.current = false;
                    setShowLoading(false);
                    Toast.show({
                      type: 'error',
                      text1: 'Error',
                      text2: error.message || 'Failed to logout. Please try again.',
                      position: 'top',
                    });
                  }
                }, 300);
              } catch (error: any) {
                isLoggingOut.current = false;
                setShowLoading(false);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: error.message || 'Failed to logout. Please try again.',
                  position: 'top',
                });
              }
            }
          }
        ]
      );
    }, [profile?.id, router]);
  
    // Helper function to render content when userProfile exists
    const renderContent = () => {
      if (!userProfile) {
        // Empty view for when userProfile is null (during logout transition)
        return <View style={{ flex: 1, height: 300 }} />;
      }

      return (
        <>
          <LoadingOverlay visible={showLoading} />
          {/* Profile Section */}
          <View style={[styles.profileHeader, isDark && { borderBottomColor: '#333' }]}>
            <View style={styles.profileSection}>
              {!userProfile?.profile_pic && (
                <TouchableOpacity 
                  onPress={() => router.push('/profile')}
                  style={[styles.profilePic, styles.uploadPrompt, isDark && { backgroundColor: 'rgba(51,169,212,0.2)' }]}
                >
                  <Ionicons name="camera" size={24} color={isDark ? "#fff" : Colors.primary} />
                  <Text style={[styles.uploadText, isDark && { color: "#fff" }]}>Add Photo</Text>
                </TouchableOpacity>
              )}
              {userProfile?.profile_pic && (
              <Image 
                  source={{ uri: userProfile.profile_pic }} 
                style={styles.profilePic} 
              />
              )}
              <Text style={[styles.greeting, isDark && { color: colors.text }]}>Hi, {userProfile?.name}</Text>
            </View>
            <View style={styles.headerActions}>
              <ThemeToggle style={styles.themeToggle} />
              <TouchableOpacity 
                style={styles.notificationButton} 
                onPress={() => router.push('/notifications')}
              >
                <Ionicons name="notifications-outline" size={24} color={isDark ? "#fff" : "#000"} />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={24} color={isDark ? "#fff" : "#000"} />
              </TouchableOpacity>
            </View>
          </View>
    
          {/* Online Toggle */}
          <View style={[styles.onlineToggle, isDark && { backgroundColor: '#333' }]}>
            <Text style={styles.onlineText}>
              You're {isOnline ? 'online' : 'offline'}
            </Text>
            <Switch 
              value={isOnline}
              onValueChange={handleToggleAvailability}
              trackColor={{ false: '#767577', true: '#4CD964' }}
              thumbColor="#fff"
              ios_backgroundColor="#3e3e3e"
              style={styles.switch}
            />
          </View>
    
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={[styles.earningsCard, isDark && { backgroundColor: '#2A7DAE' }]}>
              <Text style={styles.amount}>₦{earnings.toLocaleString()}.36</Text>
              <View style={styles.labelContainer}>
                <Ionicons name="card-outline" size={20} color="#fff" />
                <Text style={styles.label}>Total earnings</Text>
              </View>
            </View>
            <View style={[styles.jobsCard, isDark && { backgroundColor: '#A38768' }]}>
              <Text style={styles.amount}>{completedJobs}</Text>
              <View style={styles.labelContainer}>
                <Ionicons name="briefcase-outline" size={20} color={isDark ? "#fff" : "#000"} />
                <Text style={[styles.label, isDark ? styles.label : styles.darkLabel]}>Completed jobs</Text>
              </View>
            </View>
          </View>
    
          {/* Request Card */}
          {pendingBookings.latest ? (
            <TouchableOpacity 
              style={[styles.requestCard, isDark && { borderColor: '#444', backgroundColor: colors.cardBackground }]} 
              onPress={() => router.push("/(tabs)/services")}
            >
              <View style={[styles.requestDot, isDark && { backgroundColor: '#fff' }]} />
              <Text style={[styles.linkText, isDark && { color: '#fff' }]}>New request{pendingBookings.count > 1 ? 's' : ''}</Text>
              <Text style={[styles.grayText, isDark && { color: '#aaa' }]}>
                {pendingBookings.count} pending request{pendingBookings.count > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.openText, isDark && { color: '#fff' }]}>Open</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.requestCard, { opacity: 0.5 }, isDark && { borderColor: '#444', backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.grayText, isDark && { color: '#aaa' }]}>No new requests</Text>
            </View>
          )}
    
          <Text style={[styles.actionTitle, isDark && { color: colors.text }]}>What would you like to do?</Text>
    
          {/* Quick Actions */}
          <View style={styles.actionsContainer}>
            {[
              { icon: 'location-outline', text: 'Locate', onPress: () => handleActionPress('Locate') },
              { icon: 'list-outline', text: 'Requests', onPress: () => handleActionPress('Requests') },
              { icon: 'cash-outline', text: 'Initiate\nPayment', onPress: () => handleActionPress('Initiate\nPayment') },
              { icon: 'help-circle-outline', text: 'Query\nPayment', onPress: () => handleActionPress('Query\nPayment') },
            ].map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.actionItem}
                onPress={item.onPress}
              >
                <View style={[styles.actionIconBg, isDark && { backgroundColor: '#333' }]}>
                  <Ionicons name={item.icon as any} size={24} color={isDark ? "#fff" : Colors.primary} />
                </View>
                <Text style={[styles.actionText, isDark && { color: '#aaa' }]}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
    
          {/* Location Section */}
          {locationText && (
            <View style={[styles.locationSection, isDark && { backgroundColor: '#262626' }]}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={24} color={isDark ? "#fff" : Colors.primary} />
                <Text style={[styles.locationTitle, isDark && { color: colors.text }]}>Current Location</Text>
              </View>
              <Text style={[styles.locationAddress, isDark && { color: '#aaa' }]}>{locationText}</Text>
            </View>
          )}
    
          {/* Pending Transaction */}
          <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>Pending Transaction</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color={isDark ? "#fff" : Colors.primary} style={styles.loader} />
          ) : pendingTransactions.length > 0 ? (
            <View style={styles.transactionsContainer}>
              {pendingTransactions.map((transaction) => (
                <View key={transaction.id} style={[styles.transactionCard, isDark && { 
                  backgroundColor: colors.cardBackground, 
                  borderColor: '#444',
                  shadowOpacity: 0.3
                }]}>
                  <View style={styles.transactionInfo}>
                    <View style={styles.userInfo}>
                      <Image 
                        source={{ uri: transaction.user[0].profile_pic || 'https://via.placeholder.com/30' }} 
                        style={styles.userAvatar} 
                      />
                      <View>
                        <Text style={[styles.userName, isDark && { color: colors.text }]}>{transaction.user[0].name}</Text>
                        <Text style={[styles.serviceText, isDark && { color: '#aaa' }]}>{transaction.service}</Text>
                      </View>
                    </View>
                    <Text style={styles.dueAmount}>
                      ₦{transaction.amount?.toLocaleString()} • Due {formatDate(transaction.due_date)}
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.actionButton, isDark && { backgroundColor: '#333' }]}
                      onPress={() => handleCall(transaction.user[0].id, transaction.user[0].phone)}
                    >
                      <Ionicons name="call-outline" size={24} color={isDark ? "#fff" : Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, isDark && { backgroundColor: '#333' }]}
                      onPress={() => handleChat(transaction.user[0].id)}
                    >
                      <Ionicons name="chatbubble-outline" size={24} color={isDark ? "#fff" : Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyTransactionState, isDark && { backgroundColor: '#262626' }]}>
              <Ionicons name="receipt-outline" size={48} color={isDark ? '#fff' : "#CCC"} />
              <Text style={[styles.emptyStateTitle, isDark && { color: colors.text }]}>No Pending Transactions</Text>
              <Text style={[styles.emptyStateText, isDark && { color: '#aaa' }]}>
                Transactions will appear here when users book your services
              </Text>
            </View>
          )}
        </>
      );
    };
  
    return (
      <>
        <LoadingOverlay visible={showLoading} />
        <ScrollView 
          style={[styles.Providercontainer, isDark && { backgroundColor: colors.secondaryBackground }]}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing || parentRefreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={isDark ? colors.tint : Colors.primary}
            />
          }
        >
          {renderContent()}
        </ScrollView>
      </>
    );
  }
  

  const styles = ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#f9f9f9',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '32@ms',
      paddingHorizontal: '16@ms',
    },
    emptyTitle: {
      fontSize: '18@ms',
      fontFamily: 'Urbanist-Bold',
      marginVertical: '8@ms',
    },
    emptyText: {
      fontSize: '14@ms',
      fontFamily: 'Urbanist-Medium',
      color: '#666',
      textAlign: 'center',
    },
    providerContainer: {
      flex: 1,
      backgroundColor: '#f9f9f9',
    },
    header: {
      backgroundColor: Colors.primary,
      padding: 20,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '20@ms',
      paddingTop: '10@ms',
    },
    headerInfo: {
      flex: 1,
      marginLeft: 20,
      justifyContent: 'center',
    },
    welcomeText: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 16,
      fontFamily: 'Urbanist-Medium',
      marginBottom: 4,
    },
    nameText: {
      color: 'white',
      fontSize: 24,
      fontFamily: 'Urbanist-Bold',
    },
    statusButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.1)',
      padding: 12,
      borderRadius: 20,
      marginTop: 15,
      alignSelf: 'flex-start',
    },
    onlineButton: {
      backgroundColor: 'rgba(46,204,113,0.15)',
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#666',
      marginRight: 8,
    },
    onlineDot: {
      backgroundColor: '#2ecc71',
    },
    locationContainer: {
      margin: '20@ms',
      padding: '20@ms',
      backgroundColor: 'white',
      borderRadius: '15@ms',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    locationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '10@ms',
    },
    locationTitle: {
      fontSize: '18@ms',
      fontFamily: 'Urbanist-Bold',
      marginLeft: '10@ms',
      color: '#333',
    },
    locationText: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Medium',
      color: '#666',
      marginLeft: '34@ms',
    },
    notificationButton: {
      padding: '8@ms',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    themeToggle: {
      marginRight: '8@ms',
    },
    badge: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: '#FF4B55',
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#fff',
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontFamily: 'Urbanist-Bold',
    },
    profileButton: {
      borderRadius: '35@ms',
      overflow: 'hidden',
    },
    retryButton: {
      marginLeft: 'auto',
      padding: '4@ms',
    },
    locationLoadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginLeft: '34@ms',
    },
    retryButtonLarge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(28,126,222,0.1)',
      padding: '8@ms',
      borderRadius: '8@ms',
      gap: '4@ms',
    },
    retryText: {
      fontSize: '12@ms',
      color: Colors.primary,
      fontFamily: 'Urbanist-Medium',
    },
    Providercontainer: {
      flex: 1,
      backgroundColor: '#fff',
      paddingVertical: "30@ms",
      paddingHorizontal: "15@ms",
    },
    profileHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20@ms',
      marginTop: '-20@ms',
    },
    profileSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profilePic: {
      width: '40@ms',
      height: '40@ms',
      borderRadius: '20@ms',
    },
    greeting: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Bold',
      marginLeft: '10@ms',
    },
    onlineToggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#222',
      padding: '16@ms',
      borderRadius: '10@ms',
      marginBottom: '20@ms',
      marginHorizontal: '4@ms',
    },
    onlineText: {
      color: '#fff',
      fontFamily: 'Urbanist-Medium',
      fontSize: '14@ms',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: '20@ms',
      gap: '12@ms',
    },
    earningsCard: {
      flex: 1,
      backgroundColor: '#1E8DCC',
      padding: '16@ms',
      borderRadius: '12@ms',
    },
    jobsCard: {
      flex: 1,
      backgroundColor: '#C4A484',
      padding: '16@ms',
      borderRadius: '12@ms',
    },
    amount: {
      fontSize: '20@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#fff',
      marginBottom: '8@ms',
    },
    labelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@ms',
    },
    label: {
      color: '#fff',
      fontFamily: 'Urbanist-Medium',
      fontSize: '14@ms',
    },
    darkLabel: {
      color: '#000',
    },
    requestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '12@ms',
      borderWidth: 1,
      borderColor: '#E5E5E5',
      borderRadius: '12@ms',
      marginBottom: '24@ms',
      gap: '8@ms',
    },
    requestDot: {
      width: '8@ms',
      height: '8@ms',
      borderRadius: '4@ms',
      backgroundColor: Colors.primary,
    },
    linkText: {
      color: Colors.primary,
      fontFamily: 'Urbanist-Medium',
      fontSize: '14@ms',
    },
    grayText: {
      color: '#666',
      fontFamily: 'Urbanist-Regular',
      fontSize: '14@ms',
      flex: 1,
    },
    openText: {
      color: Colors.primary,
      fontFamily: 'Urbanist-Medium',
      fontSize: '14@ms',
    },
    actionTitle: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Medium',
      marginBottom: '16@ms',
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: '24@ms',
    },
    actionItem: {
      alignItems: 'center',
      width: '70@ms',
    },
    actionIconBg: {
      width: '48@ms',
      height: '48@ms',
      borderRadius: '24@ms',
      backgroundColor: '#F5F5F5',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '8@ms',
    },
    actionText: {
      fontSize: '12@ms',
      fontFamily: 'Urbanist-Medium',
      textAlign: 'center',
      color: '#666',
    },
    sectionTitle: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Bold',
      marginBottom: '12@ms',
    },
    transactionsContainer: {
      marginBottom: '24@ms',
    },
    transactionCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E5E5E5',
      padding: '16@ms',
      borderRadius: '12@ms',
      marginBottom: '12@ms',
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    transactionInfo: {
      flex: 1,
      gap: '8@ms',
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@ms',
    },
    userAvatar: {
      width: '40@ms',
      height: '40@ms',
      borderRadius: '20@ms',
    },
    userName: {
      fontFamily: 'Urbanist-Medium',
      fontSize: '14@ms',
      color: '#000',
    },
    serviceText: {
      fontSize: '12@ms',
      color: '#666',
      fontFamily: 'Urbanist-Regular',
      marginTop: '2@ms',
    },
    dueAmount: {
      color: '#FF3B30',
      fontFamily: 'Urbanist-Medium',
      fontSize: '12@ms',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: '16@ms',
    },
    actionButton: {
      padding: '8@ms',
      backgroundColor: '#F5F5F5',
      borderRadius: '8@ms',
    },
    switch: {
      transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
    },
    locationSection: {
      backgroundColor: '#F8F9FA',
      padding: '16@ms',
      borderRadius: '12@ms',
      marginBottom: '24@ms',
    },
    locationHeade: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '8@ms',
    },
    locationTitl: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Bold',
      marginLeft: '8@ms',
      color: '#333',
    },
    locationAddress: {
      fontSize: '14@ms',
      fontFamily: 'Urbanist-Regular',
      color: '#666',
      marginLeft: '32@ms',
    },
    emptyTransactionState: {
      alignItems: 'center',
      padding: '24@ms',
      backgroundColor: '#F8F9FA',
      borderRadius: '12@ms',
      marginBottom: '24@ms',
    },
    emptyStateTitle: {
      fontSize: '16@ms',
      fontFamily: 'Urbanist-Bold',
      color: '#333',
      marginTop: '12@ms',
      marginBottom: '4@ms',
    },
    emptyStateText: {
      fontSize: '14@ms',
      fontFamily: 'Urbanist-Regular',
      color: '#666',
      textAlign: 'center',
    },
    uploadPrompt: {
      backgroundColor: 'rgba(28,126,222,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadText: {
      fontSize: '10@ms',
      color: Colors.primary,
      fontFamily: 'Urbanist-Medium',
      marginTop: '4@ms',
    },
    loader: {
      marginTop: '20@ms',
    },
    logoutButton: {
      padding: 8,
      marginLeft: 5,
    }
  });