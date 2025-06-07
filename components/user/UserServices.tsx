import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  Alert, 
  Image, 
  Modal, 
  TextInput, 
  ActivityIndicator,
  TouchableWithoutFeedback, 
  Keyboard, 
  Platform, 
  KeyboardAvoidingView,
  Animated,
  Easing,
  AppState
} from 'react-native';
import { verticalScale } from 'react-native-size-matters';
import SearchBar from '../SearchBar';
import BookingCard from '../BookingCard';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { useRouter } from 'expo-router';
import { sendBookingStatusNotification } from '../../utils/notifications';
import { sendBookingAcceptedNotification, sendBookingStatusUpdatePushNotification } from '../../services/pushNotifications';
import Toast from 'react-native-toast-message';
import { UserServicesStyles } from '../../utils/styles';
import { useTheme } from '../../components/ThemeProvider';
import { useNotificationStore } from '../../store/useNotificationStore';
import Logo from '../../assets/images/Svg/logo1.svg';
type MainTab = 'ALL' | 'YOUR BOOKINGS' | 'FAVORITES';
type BookingStatus = 'InProgress' | 'Completed' | 'Cancelled';


type ServiceCategory = {
  name: string;
  subcategories?: string[]; 
};

const services: ServiceCategory[] = [
  {
    name: "Appliances",
    subcategories: ["Air Conditioners", "Washing Machines", "Home Theaters", "Kitchen Appliances"]
  },
  { name: "Refrigerator Services" },
  {
    name: "Mechanics",
    subcategories: ["Benz Specialists", "Toyota Specialists", "BMW Specialists", "Honda Specialists", "General Mechanics", "Heavy-Duty Mechanics"]
  },
  { name: "Barbers" },
  { name: "Brick Layers" },
  { name: "Carpentry Services" },
  { name: "Laundry" },
  { name: "Car Washers" },
  { name: "Catering" },
  { name: "Shipping Services" },
  { name: "Electrician" },
  { name: "Fumigation Services" },
  {
    name: "Generator Services",
    subcategories: ["Installation", "Maintenance", "Repair", "Troubleshooting", "Parts Replacement", "Fuel Delivery"]
  },
  {
    name: "Hairstylist",
    subcategories: ["Braiding", "Natural Hair", "Locks/Dreadlocks", "Weave/Extensions", "Hair Coloring", "Wedding Styles", "Men's Hair"]
  },
  { name: "Movers" },
  { name: "Home Interior Designers" },
  { name: "Make-Up Artist" },
  { name: "Nail Technician" },
  { name: "Painter" },
  {
    name: "Phone Repairers",
    subcategories: ["iPhone Specialists", "Samsung Specialists", "General Phone Repair", "Tablet Repair"]
  },
  { 
    name: "Photographer",
    subcategories: ["Wedding Photography", "Portrait Photography", "Commercial Photography", "Event Photography"]
  },
  { name: "Plumber" },
  { name: "POP" },
  { name: "Tiller" },
  { 
    name: "Video Editor",
    subcategories: ["Commercial Video Editing", "Wedding Video Editing", "Social Media Content"]
  },
  { name: "Welder" },
  { name: "Legal service (Lawyer)" },
  {
    name: "Borehole service",
    subcategories: ["Drilling", "Maintenance", "Pump Installation"]
  },
  { name: "Water treatment services" },
  { name: "Geophysical survey" },
  { 
    name: "Fashion designer",
    subcategories: ["Traditional Wear", "Wedding Outfits", "Casual Wear", "Corporate Outfits"]
  },
  { 
    name: "Event Planner",
    subcategories: ["Wedding Planning", "Corporate Events", "Birthday Parties"]
  },
  { name: "Event Decorator" },
  { name: "Event Photographer" },
  { name: "Event Videographer" },
  { name: "Event Caterer" },
];

type Booking = {
  id: string;
  service: string;
  booking_date: string;
  booking_time: string;
  address: string;
  amount: number;
  status: string;
  provider: {
    id: string;
    services: string[];
    users: {
      name: string;
      profile_pic: string | null;
    };
  };
  provider_id: string;
  payment_plan?: string;
  first_payment_completed?: boolean;
};

type BookingsState = {
  inProgress: Booking[];
  completed: Booking[];
  cancelled: Booking[];
};


type BookingStatusMap = {
  InProgress: 'inProgress';
  Completed: 'completed';
  Cancelled: 'cancelled';
};

type Provider = {
  id: string;
  services: string[];
  users: {
    name: string;
    profile_pic: string | null;
  };
};

type BookingData = {
  status: string;
  payment_plan: string;
  first_payment_completed: boolean;
  user_id: string;
  provider_id: string;
};


const MemoizedBookingCard = memo(BookingCard, (prevProps, nextProps) => {
  return prevProps.item.code === nextProps.item.code && 
         prevProps.loading === nextProps.loading &&
         prevProps.type === nextProps.type;
});


const MemoizedSearchBar = memo(SearchBar, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value && prevProps.isDark === nextProps.isDark;
});

// Add this new component for Cancelled bookings for better performance
const MemoizedCancelledBookingItem = memo(({ item, onReport, isDark, colors }: { 
  item: Booking; 
  onReport: (providerId: string, bookingId: string) => void;
  isDark: boolean;
  colors: any;
}) => {
  return (
    <View style={[
      UserServicesStyles.container, 
      UserServicesStyles.cancelledCard,
      isDark && { backgroundColor: colors.cardBackground, borderColor: colors.border }
    ]}>
      <View style={UserServicesStyles.cancelledHeader}>
        <Text style={[
          UserServicesStyles.cancelledDate,
          isDark && { color: colors.text }
        ]}>{new Date(item.booking_date).toLocaleDateString()}</Text>
        <View style={[
          UserServicesStyles.statusContainer, 
          { backgroundColor: isDark ? colors.secondaryBackground : '#F5F5F5' }
        ]}>
          <Text style={[
            UserServicesStyles.statusText, 
            { color: isDark ? colors.subtext : '#666' }
          ]}>#{item.id.slice(0, 8)}</Text>
        </View>
      </View>
      <View style={UserServicesStyles.providerInfoContainer}>
        <Image
          source={{ uri: item.provider.users.profile_pic || 'https://via.placeholder.com/150' }}
          style={UserServicesStyles.cancelledProviderImage}
        />
        <View style={UserServicesStyles.providerDetails}>
          <Text style={[
            UserServicesStyles.providerName,
            isDark && { color: colors.text }
          ]} numberOfLines={1} ellipsizeMode="tail">{item.provider.users.name}</Text>
          <View style={UserServicesStyles.rightColumn}>
            <Text style={[
              UserServicesStyles.serviceText, 
              { color: isDark ? colors.subtext : '#666', marginTop: 4 }
            ]} numberOfLines={2} ellipsizeMode="tail">
              {Array.isArray(item.provider.services) 
                ? item.provider.services.length > 2
                  ? `${item.provider.services.slice(0, 2).join(', ')} +${item.provider.services.length - 2}`
                  : item.provider.services.join(', ')
                : item.service}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity 
        style={[
          UserServicesStyles.reportButton,
          isDark && { 
            backgroundColor: 'rgba(209, 45, 45, 0.15)',
            borderColor: 'rgba(209, 45, 45, 0.3)',
            borderWidth: 1
          }
        ]}
        onPress={() => onReport(item.provider.id, item.id)}
      >
        <Text style={[
          UserServicesStyles.reportButtonText,
          { color: isDark ? '#FF4B55' : '#D12D2D' }
        ]}>Report this server</Text>
      </TouchableOpacity>
    </View>
  );
}, (prevProps, nextProps) => {
  // Optimize re-renders by comparing only what matters
  return prevProps.item.id === nextProps.item.id && 
         prevProps.isDark === nextProps.isDark;
});

export default function UserServices() {
  const router = useRouter();
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  const { 
    hasAcceptedBookings, 
    checkAcceptedBookings, 
    clearAcceptedBookingsNotification 
  } = useNotificationStore();
  const [selectedMainTab, setSelectedMainTab] = useState<MainTab>(
    useUserStore.getState().selectedOrderTab
  );
  const [selectedTab, setSelectedTab] = useState<BookingStatus>('InProgress');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookings, setBookings] = useState<BookingsState>({
    inProgress: [],
    completed: [],
    cancelled: []
  });
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState<{ [key: string]: boolean }>({});
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [appState, setAppState] = useState(AppState.currentState);
  const appStateRef = useRef(AppState.currentState);

 
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  // Add a ref for storing cached data and a timestamp
  const bookingsCache = useRef<{
    data: BookingsState | null;
    timestamp: number;
    userId: string | null;
  }>({
    data: null,
    timestamp: 0,
    userId: null
  });
  
  // Add a ref for fetch request debouncing
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add refs to track channel subscriptions
  const bookingsChannelRef = useRef<any>(null);
  const favoritesChannelRef = useRef<any>(null);

  useEffect(() => {
    if (loading || loadingServices || loadingFavorites || 
        (selectedMainTab === 'YOUR BOOKINGS' && bookings[statusMap[selectedTab]].length === 0 && loading) || 
        (selectedMainTab === 'FAVORITES' && favorites.length === 0 && loadingFavorites)) {
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
  }, [loading, loadingServices, loadingFavorites, selectedMainTab, selectedTab]);

 
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const keyboardWillShowListener = Keyboard.addListener(
        'keyboardWillShow',
        () => {
        }
      );
      
      const keyboardWillHideListener = Keyboard.addListener(
        'keyboardWillHide',
        () => {
        }
      );
      
      return () => {
        keyboardWillShowListener.remove();
        keyboardWillHideListener.remove();
      };
    }
  }, []);


  const fixKeyboardSpacing = useCallback(() => {
    if (Platform.OS === 'ios') {
        
      setTimeout(() => {
        Keyboard.dismiss();
  
        setTimeout(() => {
        }, 50);
      }, 10);
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    if (!profile || !profile.id) {
      return;
    }
    
    try {
      setLoadingFavorites(true);
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          providers!provider_id (
            id,
            services,
            location,
            users (
              name,
              profile_pic
            )
          )
        `)
        .eq('user_id', profile?.id);

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoadingFavorites(false);
    }
  }, [profile?.id]);

  const fetchBookings = useCallback(async (forceRefresh = false) => {
    if (!profile || !profile.id) {
      return;
    }
    
    try {
      // Check if we need to use cached data
      const currentTime = Date.now();
      const cacheMaxAge = 60000; // 1 minute cache validity
      const isCacheValid = bookingsCache.current.data && 
                          bookingsCache.current.userId === profile.id && 
                          currentTime - bookingsCache.current.timestamp < cacheMaxAge && 
                          !forceRefresh;
      
      // If we're not forcing a refresh and we have valid cached data, use it
      if (isCacheValid && !loading) {
        console.log('Using cached bookings data');
        setBookings(bookingsCache.current.data!);
        
        // Check for notifications in the background without showing loading state
        await checkAcceptedBookings(profile.id);
        
        if (selectedMainTab === 'YOUR BOOKINGS' && selectedTab === 'InProgress') {
          await supabase.rpc('mark_user_bookings_as_viewed', {
            user_id_param: profile.id
          });
          clearAcceptedBookingsNotification();
        }
        
        return;
      }
      
      setLoading(true);
      await checkAcceptedBookings(profile.id);
      
      if (selectedMainTab === 'YOUR BOOKINGS' && selectedTab === 'InProgress') {
        await supabase.rpc('mark_user_bookings_as_viewed', {
          user_id_param: profile.id
        });
        clearAcceptedBookingsNotification();
      }

      // Optimize the query by:
      // 1. Only selecting fields we actually need
      // 2. Filtering data on the server side where possible
      // 3. Using a more targeted query for the current tab to reduce data transfer
      let query = supabase
        .from('bookings')
        .select(`
          id,
          service,
          booking_date,
          booking_time,
          address,
          amount,
          status,
          provider_id,
          payment_plan,
          first_payment_completed,
          provider:providers!bookings_provider_id_fkey (
            id,
            services,
            users!providers_user_id_fkey (
              name,
              profile_pic
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('booking_date', { ascending: false });
      
      // If not forcing a refresh, we can optimize by only fetching recent bookings 
      // or only the specific tab's data
      if (selectedMainTab === 'YOUR BOOKINGS' && !forceRefresh) {
        if (selectedTab === 'InProgress') {
          query = query.in('status', ['pending', 'in_progress', 'accepted']);
        } else if (selectedTab === 'Completed') {
          query = query.eq('status', 'completed');
        } else if (selectedTab === 'Cancelled') {
          query = query.eq('status', 'cancelled');
        }
      }
      
      // Execute the query
      const { data, error } = await query;

      if (error) throw error;

      // Optimize data transformation by directly creating the filtered arrays instead of filtering later
      const inProgress: Booking[] = [];
      const completed: Booking[] = [];
      const cancelled: Booking[] = [];
      
      // Optimize by processing data in a single pass
      data.forEach(item => {
        const providerData = item.provider as unknown as Provider;
        const bookingItem: Booking = {
          id: item.id,
          service: item.service,
          booking_date: item.booking_date,
          booking_time: item.booking_time,
          address: item.address,
          amount: item.amount,
          status: item.status,
          provider_id: item.provider_id,
          provider: {
            id: providerData.id,
            services: providerData.services,
            users: {
              name: providerData.users.name,
              profile_pic: providerData.users.profile_pic
            }
          },
          payment_plan: item.payment_plan,
          first_payment_completed: item.first_payment_completed
        };
        
        // Sort into appropriate arrays in a single pass
        if (['pending', 'in_progress', 'accepted'].includes(item.status)) {
          inProgress.push(bookingItem);
        } else if (item.status === 'completed') {
          completed.push(bookingItem);
        } else if (item.status === 'cancelled') {
          cancelled.push(bookingItem);
        }
      });
      
      // Update state with the new bookings data
      const newBookingsState = {
        inProgress,
        completed,
        cancelled
      };
      
      // Update the cache
      bookingsCache.current = {
        data: newBookingsState,
        timestamp: Date.now(),
        userId: profile.id
      };
      
      setBookings(newBookingsState);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, selectedMainTab, selectedTab, loading, checkAcceptedBookings, clearAcceptedBookingsNotification]);

  // Implement a debounced version of fetchBookings to prevent rapid successive calls
  const debouncedFetchBookings = useCallback((forceRefresh = false) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
      fetchBookings(forceRefresh);
    }, 300); // 300ms debounce time
  }, [fetchBookings]);

  // Use a single onRefresh function (remove the duplicate below)
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedMainTab === 'YOUR BOOKINGS') {
      fetchBookings(true).then(() => setRefreshing(false));
    } else if (selectedMainTab === 'FAVORITES') {
      fetchFavorites().then(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  }, [selectedMainTab, fetchBookings, fetchFavorites]);

  const refreshData = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  // Update other functions that call fetchBookings to use the debounced version
  useEffect(() => {
    if (selectedMainTab === 'YOUR BOOKINGS') {
      debouncedFetchBookings();
    } else if (selectedMainTab === 'FAVORITES') {
      fetchFavorites();
    } else if (selectedMainTab === 'ALL') {
      setLoadingServices(true);
      setTimeout(() => {
        setLoadingServices(false);
      }, 1000);
    }
  }, [selectedMainTab, debouncedFetchBookings, fetchFavorites]);

  // Update initial data loading to use caching and proper channel management
  useEffect(() => {
    debouncedFetchBookings();
    fetchFavorites();
    
    // Clean up existing channels if they exist
    if (bookingsChannelRef.current) {
      supabase.removeChannel(bookingsChannelRef.current);
    }
    
    if (favoritesChannelRef.current) {
      supabase.removeChannel(favoritesChannelRef.current);
    }
    
    const bookingsChannel = supabase
      .channel('bookings-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${profile?.id}` },
        async (payload: {
          new: {
            status?: string;
            provider_id?: string;
            service?: string;
            [key: string]: any;
          };
          old?: {
            status?: string;
            [key: string]: any;
          };
        }) => {
          console.log('Booking change detected:', payload);
          
          // Check if status changed to 'accepted' - send push notification
          if (payload.new && payload.old && 
              payload.new.status === 'accepted' && 
              payload.old.status === 'pending') {
            try {
              // Get provider details to include in the notification
              const { data: providerData, error: providerError } = await supabase
                .from('providers')
                .select(`
                  id,
                  users!providers_user_id_fkey (
                    name,
                    phone
                  )
                `)
                .eq('id', payload.new.provider_id)
                .single();
                
              if (!providerError && providerData && providerData.users) {
                // Handle users property which might be an array or a single object
                const providerUser = Array.isArray(providerData.users) 
                  ? providerData.users[0] 
                  : providerData.users;
                
                const providerName = providerUser?.name || 'Your provider';
                const serviceName = payload.new.service || 'requested service';
                
                // First, try the enhanced notification function for better reliability
                try {
                  await sendBookingStatusUpdatePushNotification(
                    'accepted',
                    serviceName,
                    providerName,
                    'You can now proceed to payment.'
                  );
                  console.log('Enhanced push notification sent successfully');
                } catch (pushError) {
                  console.error('Enhanced push notification failed, falling back to regular notification:', pushError);
                  
                  // Fall back to the original notification method if the enhanced one fails
                  await sendBookingAcceptedNotification(serviceName, providerName);
                }
              }
            } catch (error) {
              console.error('Error sending booking accepted notification:', error);
            }
          }
          
          // Force refresh when a real-time change is detected
          debouncedFetchBookings(true); 
        }
      )
      .subscribe();
      
    // Store the channel reference
    bookingsChannelRef.current = bookingsChannel;
      
    const favoritesChannel = supabase
      .channel('favorites-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${profile?.id}` },
        (payload) => {
          console.log('Favorites change detected:', payload);
          fetchFavorites(); 
        }
      )
      .subscribe();
      
    // Store the channel reference
    favoritesChannelRef.current = favoritesChannel;
      
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      if (bookingsChannelRef.current) {
        supabase.removeChannel(bookingsChannelRef.current);
      }
      
      if (favoritesChannelRef.current) {
        supabase.removeChannel(favoritesChannelRef.current);
      }
    };
  }, [profile?.id, debouncedFetchBookings, fetchFavorites]);

  const handleCancel = useCallback(async (bookingId: string) => {
    try {
      console.log('Starting cancellation for booking:', bookingId); 
      
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('status, payment_plan, first_payment_completed, user_id, provider_id')
        .eq('id', bookingId)
        .single() as { data: BookingData | null; error: any };

      if (bookingError) {
        console.error('Error fetching booking:', bookingError); 
        throw bookingError;
      }

      console.log('Booking data:', bookingData); 

      if (bookingData?.user_id !== profile?.id) {
        Toast.show({
          type: 'error',
          text1: 'Unauthorized',
          text2: 'You do not have permission to cancel this booking.',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }

      if (bookingData?.payment_plan === 'half' && bookingData?.first_payment_completed) {
        Toast.show({
          type: 'error',
          text1: 'Cannot Cancel',
          text2: 'You cannot cancel this booking after making the initial payment.',
          position: 'top',
          visibilityTime: 4000,
        });
        return;
      }

      if (bookingData?.status === 'in_progress') {
        router.push(`/booking/cancel/${bookingId}`);
      } else {
        Alert.alert(
          "Cancel Booking",
          "Are you sure you want to cancel this booking?",
          [
            {
              text: "No",
              style: "cancel"
            },
            {
              text: "Yes, Cancel",
              style: "destructive",
              onPress: async () => {
                try {
                  setLoadingBookings(prev => ({ ...prev, [bookingId]: true }));
                  
                  const { error } = await supabase
                    .from('bookings')
                    .update({ 
                      status: 'cancelled',
                      updated_at: new Date().toISOString(),
                      cancelled_at: new Date().toISOString(),
                      cancelled_by: profile?.id,
                      cancellation_reason: 'user_cancelled'
                    })
                    .eq('id', bookingId);

                  if (error) throw error;

                  if (bookingData?.provider_id) {
                    try {
                      await sendBookingStatusNotification(
                        bookingData.provider_id,
                        bookingId,
                        'cancelled',
                        'Booking Cancelled'
                      );
                    } catch (notifError) {
                      console.error('Failed to send notification, but booking was cancelled:', notifError);
                    }
                  }

                  await fetchBookings();
                  
                  Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Booking has been cancelled successfully',
                    position: 'top',
                    visibilityTime: 3000,
                  });
                } catch (error) {
                  console.error('Error:', error);
                  Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to cancel booking. Please try again.',
                    position: 'top',
                    visibilityTime: 4000,
                  });
                } finally {
                  setLoadingBookings(prev => ({ ...prev, [bookingId]: false }));
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error showing alert:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process cancellation. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    }
  }, [profile?.id, fetchBookings, router]);

  const handleFavorite = useCallback(async (providerId: string) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .insert([{ user_id: profile?.id, provider_id: providerId }]);

      if (error) throw error;
      fetchFavorites();
    } catch (error) {
      console.error('Error adding to favorites:', error);
    }
  }, [profile?.id, fetchFavorites]);

  const handleReport = useCallback((providerId: string, bookingId: string) => {
    router.push(`/booking/report/${bookingId}`);
  }, [router]);

  const handleReview = useCallback((providerId: string, bookingId: string) => {
    router.push(`/booking/review/${bookingId}`);
  }, [router]);

  const handlePayment = useCallback(async (bookingId: string) => {
    try {
      setLoadingBookings(prev => ({ ...prev, [bookingId]: true }));
      

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
          is_viewed: false 
        })
        .eq('id', bookingId);
        
      if (updateError) {
        console.error('Error updating booking status:', updateError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to process payment request',
          position: 'top'
        });
        return;
      }

      const booking = [...bookings.inProgress, ...bookings.completed, ...bookings.cancelled]
        .find(b => b.id === bookingId);
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      const routeData = {
        provider_id: booking.provider_id,
        service: booking.service,
        date: booking.booking_date,
        time: booking.booking_time,
        status: 'in_progress', 
        price: booking.amount,
        address: booking.address,
        code: booking.id,
        name: booking.provider.users.name,
        payment_plan: booking.payment_plan,
        amount: booking.amount,
        details: booking.address
      };

    
      setBookings(prev => {
        const updatedBooking = {
          ...booking,
          status: 'in_progress'
        };
        
  
        const filteredInProgress = prev.inProgress.filter(b => b.id !== bookingId);
        
     
        return {
          ...prev,
          inProgress: [updatedBooking, ...filteredInProgress]
        };
      });

      router.push({
        pathname: "/request/details/[id]",
        params: {
          id: booking.id,
          data: JSON.stringify(routeData)
        }
      });
    } catch (error) {
      console.error('Error navigating to payment screen:', error);
      Alert.alert('Error', 'Failed to navigate to payment screen');
    } finally {
      setLoadingBookings(prev => ({ ...prev, [bookingId]: false }));
    }
  }, [bookings, router, setBookings]);

  const handleRemoveFavorite = useCallback(async (providerId: string) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', profile?.id)
        .eq('provider_id', providerId);

      if (error) throw error;
      fetchFavorites();
      setSelectedFavoriteId(null);
    } catch (error) {
      console.error('Error removing from favorites:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to remove from favorites',
        position: 'top'
      });
    }
  }, [profile?.id, fetchFavorites]);


  const bookingKeyExtractor = useCallback((item: Booking) => item.id, []);
  const serviceKeyExtractor = useCallback((item: ServiceCategory) => item.name, []);
  const favoriteKeyExtractor = useCallback((item: any) => item.id, []);

  const bookingItemLayout = useMemo(() => (
    (data: any, index: number) => ({
      length: verticalScale(230),
      offset: verticalScale(230) * index,
      index,
    })
  ), []);

  const serviceItemLayout = useMemo(() => (
    (data: any, index: number) => ({
      length: verticalScale(60), 
      offset: verticalScale(60) * index,
      index,
    })
  ), []);

  const favoriteItemLayout = useMemo(() => (
    (data: any, index: number) => ({
      length: verticalScale(160),
      offset: verticalScale(160) * index,
      index,
    })
  ), []);

  const statusMap: BookingStatusMap = {
    'InProgress': 'inProgress',
    'Completed': 'completed',
    'Cancelled': 'cancelled'
  };

  const bookingArray = useMemo(() => 
    bookings[statusMap[selectedTab] as keyof BookingsState],
    [bookings, selectedTab]
  );

  const filteredData = useMemo(() => {
    if (selectedMainTab === 'FAVORITES') return favorites;
    
    if (!searchQuery.trim()) return bookingArray;
    
    const query = searchQuery.toLowerCase().trim();
    return bookingArray.filter((item: Booking) => {
      const providerName = item.provider?.users?.name?.toLowerCase() || '';
      const service = item.service?.toLowerCase() || '';
      
      return providerName.includes(query) || service.includes(query);
    });
  }, [selectedMainTab, bookingArray, favorites, searchQuery]);

  const filteredServices = useMemo(() => {
    let result = services;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = services.filter(service => {
        // Check if main category matches
        if (service.name.toLowerCase().includes(query)) {
          return true;
        }
        
        // Check if any subcategory matches
        if (service.subcategories) {
          return service.subcategories.some(sub => 
            sub.toLowerCase().includes(query)
          );
        }
        
        return false;
      });
    }
    
    // Sort alphabetically by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery]);

  const ListFooterComponent = useMemo(() => {
    if (loading) {
      return (
        <ActivityIndicator 
          size="small" 
          color={isDark ? colors.text : colors.tint} 
          style={{ marginVertical: 20 }}
        />
      );
    }
    
    return null;
  }, [loading, isDark, colors]);

  const FavoritesListFooterComponent = useMemo(() => {
    return null;
  }, []);

  const EmptyBookingListComponent = useCallback(() => (
    <View style={UserServicesStyles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color={isDark ? colors.inactive : "#ccc"} />
      <Text style={[
        UserServicesStyles.emptyTitle,
        isDark && { color: colors.text }
      ]}>No Bookings Yet</Text>
      <Text style={[
        UserServicesStyles.emptyText,
        isDark && { color: colors.subtext }
      ]}>
        Your {selectedTab.toLowerCase()} bookings will appear here
      </Text>
    </View>
  ), [selectedTab, isDark, colors]);

  const EmptyFavoriteListComponent = useCallback(() => (
    <View style={UserServicesStyles.emptyContainer}>
      <Ionicons name="heart-outline" size={64} color={isDark ? colors.inactive : "#ccc"} />
      <Text style={[
        UserServicesStyles.emptyTitle,
        isDark && { color: colors.text }
      ]}>No Favorites Yet</Text>
      <Text style={[
        UserServicesStyles.emptyText,
        isDark && { color: colors.subtext }
      ]}>
        Providers you add to favorites will appear here
      </Text>
    </View>
  ), [isDark, colors]);

  const EmptyServiceListComponent = useCallback(() => (
    <View style={UserServicesStyles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color={isDark ? colors.inactive : "#ccc"} />
      <Text style={[
        UserServicesStyles.emptyTitle,
        isDark && { color: colors.text }
      ]}>No Results Found</Text>
      <Text style={[
        UserServicesStyles.emptyText,
        isDark && { color: colors.subtext }
      ]}>
        Try searching with different keywords
      </Text>
    </View>
  ), [isDark, colors]);

  const BookingTabsComponent = useMemo(() => (
    <View style={[
      UserServicesStyles.bookingTabs,
      isDark && { borderBottomColor: colors.border }
    ]}>
      {(['InProgress', 'Completed', 'Cancelled'] as BookingStatus[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[
            UserServicesStyles.bookingTabButton,
            isDark && { backgroundColor: colors.cardBackground },
            selectedTab === tab && UserServicesStyles.selectedBookingTab,
            isDark && selectedTab === tab && { borderBottomColor: colors.tint }
          ]}
          onPress={() => {
            setSelectedTab(tab);
            setLoading(true);
            setTimeout(() => setLoading(false), 500);
          }}
        >
          <Text
            style={[
              UserServicesStyles.bookingTabText,
              isDark && { color: colors.text },
              selectedTab === tab && UserServicesStyles.selectedBookingTabText,
              isDark && selectedTab === tab && { color: colors.tint }
            ]}
          >
            {tab.replace(/([A-Z])/g, ' $1').trim()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [selectedTab, isDark, colors]);

  const renderService = useCallback(({ item }: { item: ServiceCategory }) => {
    const isExpanded = expandedCategories[item.name] || false;
    const hasSubcategories = item.subcategories && item.subcategories.length > 0;
    
    return (
      <View>
        <View 
          style={[
            UserServicesStyles.serviceButton,
            isDark && {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border
            }
          ]} 
        >
          {/* Make service name clickable to navigate */}
          <TouchableOpacity 
            style={{ flex: 1 }}
            onPress={() => router.push(`/services/${item.name}`)}
          >
            <Text style={[
              UserServicesStyles.serviceText,
              isDark && { color: colors.text }
            ]}>{item.name}</Text>
          </TouchableOpacity>
          
          {/* Show arrow for services with subcategories */}
          {hasSubcategories && (
            <TouchableOpacity
              onPress={() => {
                // Toggle expanded state
                setExpandedCategories(prev => ({
                  ...prev,
                  [item.name]: !prev[item.name]
                }));
              }}
            >
              <Ionicons 
                name={isExpanded ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={isDark ? colors.text : "#333"} 
              />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Render subcategories if they exist and category is expanded */}
        {hasSubcategories && isExpanded && item.subcategories?.map((subCategory, index) => (
          <TouchableOpacity 
            key={`${item.name}-${subCategory}-${index}`}
            style={[
              UserServicesStyles.subCategoryButton,
              isDark && {
                backgroundColor: colors.secondaryBackground,
                borderColor: colors.border
              }
            ]} 
            onPress={() => router.push(`/services/${subCategory}`)}
          >
            <Text style={[
              UserServicesStyles.subCategoryText,
              isDark && { color: colors.subtext }
            ]}>• {subCategory}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [router, isDark, colors, expandedCategories]);

  const renderBooking = useCallback(({ item }: { item: Booking }) => {
    if (!item.provider?.users) {
      return null;
    }

    if (selectedTab === 'Cancelled') {
      return (
        <MemoizedCancelledBookingItem 
          item={item}
          onReport={handleReport}
          isDark={isDark}
          colors={colors}
        />
      );
    }

    return (
      <MemoizedBookingCard
        item={{
          category: item.service,
          price: item.amount,
          image: item.provider.users.profile_pic || undefined,
          name: item.provider.users.name,
          date: new Date(item.booking_date).toLocaleDateString(),
          time: item.booking_time,
          service: item.service, 
          code: item.id,
          details: item.address,
          skill: Array.isArray(item.provider.services) ? item.provider.services[0] : item.provider.services,
          provider_id: item.provider_id,
          status: item.status,
          payment_plan: item.payment_plan,
          first_payment_completed: item.first_payment_completed
        }}
        type={selectedTab}
        onCancel={() => handleCancel(item.id)}
        onFavorite={() => handleFavorite(item.provider.id)}
        onReport={() => handleReport(item.provider.id, item.id)}
        onReview={(provider_id, booking_id) => handleReview(provider_id, booking_id)}
        loading={loadingBookings[item.id]}
        showPayButton={item.status === 'accepted'}
        onPay={() => handlePayment(item.id)}
        isDark={isDark}
        colors={colors}
      />
    );
  }, [selectedTab, handleCancel, handleFavorite, handleReport, handleReview, handlePayment, loadingBookings, isDark, colors]);

  const renderFavoriteProvider = useCallback(({ item }: { item: any }) => {
    const provider = item.providers;
    const isMenuVisible = selectedFavoriteId === item.id;

    return (
      <TouchableOpacity 
        style={[
          UserServicesStyles.favoriteProviderCard,
          isDark && { backgroundColor: colors.cardBackground, borderColor: colors.border }
        ]}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: provider.users.profile_pic || 'https://via.placeholder.com/300' }}
          style={UserServicesStyles.favoriteProviderImage}
        />
        <View style={UserServicesStyles.favoriteProviderInfo}>
          <Text style={[
            UserServicesStyles.favoriteProviderName,
            isDark && { color: colors.text }
          ]}>{provider.users.name}</Text>
          <Text style={[
            UserServicesStyles.favoriteProviderService,
            isDark && { color: colors.subtext }
          ]}>
            {provider.services && provider.services[0]}
          </Text>
          <View style={UserServicesStyles.locationContainer}>
            <Ionicons name="location" size={12} color={isDark ? colors.subtext : "#666"} />
            <Text style={[
              UserServicesStyles.locationText,
              isDark && { color: colors.subtext }
            ]}>
              {typeof provider.location === 'object' 
                ? `${provider.location.city || ''}, ${provider.location.state || ''}`
                : provider.location || 'Location not specified'}
            </Text>
          </View>
          <View style={UserServicesStyles.levelContainer}>
            <Ionicons name="shield-checkmark" size={12} color={isDark ? colors.tint : "#007BFF"} />
            <Text style={[
              UserServicesStyles.levelText,
              isDark && { color: colors.subtext }
            ]}>Level 1 Server</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[
            UserServicesStyles.moreButton,
            isDark && { backgroundColor: colors.secondaryBackground }
          ]}
          onPress={() => setSelectedFavoriteId(isMenuVisible ? null : item.id)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={isDark ? colors.text : "#666"} />
        </TouchableOpacity>
        {isMenuVisible && (
          <View style={[
            UserServicesStyles.optionsMenu,
            isDark && { backgroundColor: colors.cardBackground, borderColor: colors.border }
          ]}>
            <TouchableOpacity 
              style={[
                UserServicesStyles.optionButton,
                isDark && { borderBottomColor: colors.border }
              ]}
              onPress={() => {
                setSelectedFavoriteId(null);
                router.push(`/services/${provider.services[0]}`);
              }}
            >
              <Text style={[
                UserServicesStyles.optionText,
                isDark && { color: colors.text }
              ]}>Book Again</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                UserServicesStyles.optionButton, 
                UserServicesStyles.removeButton
              ]}
              onPress={() => handleRemoveFavorite(provider.id)}
            >
              <Text style={[
                UserServicesStyles.optionText, 
                UserServicesStyles.removeText
              ]}>Remove from Favorites</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedFavoriteId, router, handleRemoveFavorite, isDark, colors]);

  const renderLoadingState = useCallback(() => (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: isDark ? colors.background : '#fff'
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
  ), [fadeAnim, isDark, colors.background]);

  useEffect(() => {
    if (profile?.id) {
      checkAcceptedBookings(profile.id);
      
      const interval = setInterval(() => {
        checkAcceptedBookings(profile.id);
      }, 60000);
      
      return () => clearInterval(interval);
    }
  }, [profile?.id, checkAcceptedBookings]);
  
  useEffect(() => {
    if (selectedMainTab === 'YOUR BOOKINGS' && selectedTab === 'InProgress' && profile?.id) {
      (async () => {
        try {
          await supabase.rpc('mark_user_bookings_as_viewed', {
            user_id_param: profile.id
          });
          clearAcceptedBookingsNotification();
        } catch (error) {
          console.error('Error marking bookings as viewed:', error);
        }
      })();
    }
  }, [selectedMainTab, selectedTab, profile?.id, clearAcceptedBookingsNotification]);

 
  const getMemoizedBookingRenderItem = useCallback((type: BookingStatus) => {
    return ({ item }: { item: Booking }) => {
      
      return renderBooking({ item });
    };
  }, [renderBooking]);

  // Handle AppState changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // Track previous state using ref to avoid dependency issues
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;
      setAppState(nextAppState);
      
      // If app comes back to foreground (active) from background or inactive state
      if (
        (previousAppState === 'background' || previousAppState === 'inactive') &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        // Refresh data when app comes to foreground
        if (selectedMainTab === 'YOUR BOOKINGS') {
          fetchBookings(true);
        } else if (selectedMainTab === 'FAVORITES') {
          fetchFavorites();
        }
        
        // Check for any new notifications
        if (profile?.id) {
          checkAcceptedBookings(profile.id);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [selectedMainTab, fetchBookings, fetchFavorites, profile?.id, checkAcceptedBookings]);

  return (
    <View style={[
      UserServicesStyles.container,
      isDark && { backgroundColor: colors.background }
    ]}>
      <MemoizedSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={
          selectedMainTab === 'ALL' 
            ? "Search for a service..." 
            : selectedMainTab === 'YOUR BOOKINGS'
            ? "Search your bookings..."
            : "Search favorites..."
        }
        isDark={isDark}
        colors={colors}
      />

      <View style={UserServicesStyles.mainTabs}>
        {['ALL', 'YOUR BOOKINGS', 'FAVORITES'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              UserServicesStyles.mainTabButton,
              isDark && { 
                backgroundColor: 'transparent',
                borderColor: selectedMainTab === tab ? colors.tint : colors.border 
              },
              selectedMainTab === tab && UserServicesStyles.selectedMainTab,
              isDark && selectedMainTab === tab && { 
                borderBottomWidth: 2,
                borderBottomColor: colors.tint
              }
            ]}
            onPress={() => {
              setSelectedMainTab(tab as MainTab);
              if (tab === 'YOUR BOOKINGS') {
                fetchBookings();
              } else if (tab === 'FAVORITES') {
                fetchFavorites();
              } else {
                setLoadingServices(true);
                setTimeout(() => {
                  setLoadingServices(false);
                }, 1000);
              }
            }}
          >
            <Text
              style={[
                UserServicesStyles.mainTabText,
                isDark && { 
                  color: selectedMainTab === tab ? colors.tint : colors.text 
                },
                selectedMainTab === tab && UserServicesStyles.selectedMainTabText,
                isDark && selectedMainTab === tab && { color: colors.tint }
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedMainTab === 'ALL' ? (
        loadingServices ? (
          renderLoadingState()
        ) : (
          <FlatList
            key="all"
            data={filteredServices}
            keyExtractor={serviceKeyExtractor}
            renderItem={renderService}
            contentContainerStyle={[
              UserServicesStyles.servicesContainer,
              isDark && { backgroundColor: colors.background },
              filteredServices.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
            ]}
            ListEmptyComponent={EmptyServiceListComponent}
            initialNumToRender={10}
            maxToRenderPerBatch={12}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={50}
            showsVerticalScrollIndicator={false}
            bounces={true}
            overScrollMode="always"
            getItemLayout={serviceItemLayout}
          />
        )
      ) : selectedMainTab === 'YOUR BOOKINGS' ? (
        <>
          {BookingTabsComponent}
          {loading ? (
            renderLoadingState()
          ) : (
            <FlatList
              key={`bookings-${selectedTab}`}
              data={filteredData}
              renderItem={renderBooking}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                UserServicesStyles.bookingContainer,
                isDark && { backgroundColor: colors.background },
                { flexGrow: 1, paddingBottom: 20 }
              ]}
              refreshing={refreshing}
              onRefresh={onRefresh}
              ListEmptyComponent={EmptyBookingListComponent}
              ListFooterComponent={ListFooterComponent}
              getItemLayout={bookingItemLayout}
              initialNumToRender={5}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews={true}
              updateCellsBatchingPeriod={50}
              showsVerticalScrollIndicator={false}
              bounces={true}
              overScrollMode="always"
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 10
              }}
              onEndReachedThreshold={0.5}
              extraData={[selectedTab, isDark]}
            />
          )}
        </>
      ) : (
        loadingFavorites ? (
          renderLoadingState()
        ) : (
          <FlatList
            key="favorites"
            data={filteredData}
            renderItem={renderFavoriteProvider}
            keyExtractor={favoriteKeyExtractor}
            numColumns={2}
            columnWrapperStyle={UserServicesStyles.favoriteColumnWrapper}
            contentContainerStyle={[
              UserServicesStyles.favoritesContainer,
              isDark && { backgroundColor: colors.background },
              filteredData.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
            ]}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={EmptyFavoriteListComponent}
            ListFooterComponent={FavoritesListFooterComponent}
            initialNumToRender={4}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={100}
            getItemLayout={favoriteItemLayout}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </View>
  );
}

