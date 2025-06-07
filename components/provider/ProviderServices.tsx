import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, StyleSheet, Modal, TextInput, ActivityIndicator, RefreshControl, Platform, Dimensions, Animated, Easing, AppState, InteractionManager } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { supabase } from '../../services/supabase';
import SearchBar from '../SearchBar';
import { Colors } from '../../constants/Colors';
import { useUserStore } from '../../store/useUserStore';
import { router } from 'expo-router';
import { sendBookingStatusNotification } from '../../utils/notifications';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useTheme } from '../../components/ThemeProvider';
import Logo from '../../assets/images/Svg/logo1.svg';
import { sendNewBookingNotification } from '../../services/pushNotifications';

type TabType = 'New' | 'InProgress' | 'Completed' | 'Cancelled';

type Request = {
  id: string;
  service: string;
  service_date: string;
  service_time: string;
  address: string;
  landmark?: string;
  amount: number;
  status: string;
  provider_accepted: boolean;
  user_id: string;
  user_details?: {
    id: string;
    name: string;
    profile_pic: string | null;
  };
  bookingId: string;
};

type ReportType = 'provider_report' | 'user_report';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;

export default function ProviderServices() {
  const [activeTab, setActiveTab] = useState<TabType>('New');
  const [newRequests, setNewRequests] = useState<Request[]>([]);
  const [inProgressRequests, setInProgressRequests] = useState<Request[]>([]);
  const [completedRequests, setCompletedRequests] = useState<Request[]>([]);
  const [cancelledRequests, setCancelledRequests] = useState<Request[]>([]);

  const [tabsLoaded, setTabsLoaded] = useState<Record<TabType, boolean>>({
    New: false,
    InProgress: false,
    Completed: false,
    Cancelled: false
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { profile } = useUserStore();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const { 
    hasNewRequests, 
    checkNewRequests, 
    clearNewRequestsNotification 
  } = useNotificationStore();
  const { isDark, colors } = useTheme();
  const [tabLoading, setTabLoading] = useState(false);
  
  // Keep track of the provider ID to avoid repeated lookups
  const [providerId, setProviderId] = useState<string | null>(null);
  
  // Add app state tracking
  const appState = useRef(AppState.currentState);
  const lastActiveTime = useRef<number>(Date.now());
  
  // Keep reference to the previous active tab for smoother transitions
  const previousTab = useRef<TabType>(activeTab);
  
  // Animation for the loading logo
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  // Fade animation function
  const fadeInOut = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.4,
        duration: 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true
      })
    ]).start(() => {
      if (isLoading || tabLoading) {
        fadeInOut();
      }
    });
  };

  // Start animation when loading
  useEffect(() => {
    if (isLoading || tabLoading) {
      fadeInOut();
    }
    return () => {
      fadeAnim.stopAnimation();
    };
  }, [isLoading, tabLoading]);
  
  // Get provider ID once on component mount
  useEffect(() => {
    const getProviderId = async () => {
      if (!profile?.id) return null;
      
      try {
        const { data, error } = await supabase
          .from('providers')
          .select('id, user_id')
          .eq('user_id', profile.id)
          .single();
          
        if (error) throw error;
        
        setProviderId(data.id);
        return data.id;
      } catch (error) {
        console.error('Error fetching provider ID:', error);
        return null;
      }
    };
    
    getProviderId();
  }, [profile?.id]);

  const fetchRequests = useCallback(async (showLoading = true, forceRefresh = false) => {
    if (!providerId) return;
    
    // If this tab has already been loaded and we're not forcing a refresh, don't show loading
    const isTabAlreadyLoaded = tabsLoaded[activeTab];
    const shouldShowLoading = showLoading && (!isTabAlreadyLoaded || forceRefresh);
    
    if (shouldShowLoading) {
      setTabLoading(true);
    }

    try {
      // Check for new notifications when fetching requests
      await checkNewRequests(providerId);

      // If we're on the New tab, mark these requests as viewed
      if (activeTab === 'New') {
        await supabase.rpc('mark_provider_bookings_as_viewed', {
          provider_id_param: providerId
        });
        clearNewRequestsNotification();
      }

      const statusMap = {
        'New': ['pending'],
        'InProgress': ['accepted'],
        'Completed': ['completed'],
        'Cancelled': ['cancelled']
      };

      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          service,
          booking_date,
          booking_time,
          address,
          landmark,
          amount,
          status,
          user_id,
          provider_id
        `)
        .eq('provider_id', providerId)
        .in('status', statusMap[activeTab]);

      if (bookingsError) throw bookingsError;
      
      // Mark this tab as loaded
      setTabsLoaded(prev => ({
        ...prev,
        [activeTab]: true
      }));

      if (!bookings?.length) {
        // Update only the active tab's requests state
        updateRequestsForTab(activeTab, []);
        return;
      }

      const userIds = bookings.map(booking => booking.user_id);
      const { data: userDetails, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          profile_pic
        `)
        .in('id', userIds);

      if (userError) throw userError;

      const transformedData = bookings.map(booking => {
        const userDetail = userDetails?.find(user => user.id === booking.user_id);
        return {
          id: booking.id,
          bookingId: `PL${booking.id.slice(0, 4).toUpperCase()}`,
          service: booking.service,
          service_date: booking.booking_date,
          service_time: booking.booking_time,
          address: booking.address,
          landmark: booking.landmark,
          amount: booking.amount,
          status: booking.status,
          provider_accepted: booking.status === 'accepted',
          user_id: booking.user_id,
          user_details: {
            id: userDetail?.id || booking.user_id,
            name: userDetail?.name || 'Unknown User',
            profile_pic: userDetail?.profile_pic || null
          }
        };
      });

      // Update only the active tab's requests state
      updateRequestsForTab(activeTab, transformedData);
    } catch (error: any) {
      console.error('Error in fetchRequests:', error);
      Alert.alert('Error', 'Failed to load requests');
    } finally {
      if (shouldShowLoading) {
        // Add a small delay to ensure smooth transition
        setTimeout(() => {
          setTabLoading(false);
        }, 300);
      }
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, providerId, checkNewRequests, clearNewRequestsNotification, tabsLoaded]);
  
  // Helper function to update the correct state based on active tab
  const updateRequestsForTab = useCallback((tab: TabType, data: Request[]) => {
    switch(tab) {
      case 'New':
        setNewRequests(data);
        break;
      case 'InProgress':
        setInProgressRequests(data);
        break;
      case 'Completed':
        setCompletedRequests(data);
        break;
      case 'Cancelled':
        setCancelledRequests(data);
        break;
    }
  }, []);
  
  // Get the requests for the current active tab
  const getActiveRequests = useCallback(() => {
    switch(activeTab) {
      case 'New':
        return newRequests;
      case 'InProgress':
        return inProgressRequests;
      case 'Completed':
        return completedRequests;
      case 'Cancelled':
        return cancelledRequests;
      default:
        return [];
    }
  }, [activeTab, newRequests, inProgressRequests, completedRequests, cancelledRequests]);

  // Memoize filtered requests to prevent unnecessary recalculations
  const filteredRequests = useMemo(() => {
    const currentRequests = getActiveRequests();
    if (!searchQuery.trim()) return currentRequests;
    
    const query = searchQuery.toLowerCase().trim();
    return currentRequests.filter(request => 
      request.service.toLowerCase().includes(query) ||
      request.user_details?.name.toLowerCase().includes(query) ||
      request.address.toLowerCase().includes(query)
    );
  }, [activeTab, searchQuery, getActiveRequests]);

  // Create a stable key that changes when tab switches to force a re-render of ScrollView
  const scrollViewKey = useMemo(() => `tab-${activeTab}-${tabLoading ? 'loading' : 'loaded'}`, [activeTab, tabLoading]);

  // Keep track of whether a specific tab is currently visible
  const isCurrentTabVisible = useCallback((tab: TabType) => {
    // Only render the active tab's content
    return tab === activeTab && !tabLoading;
  }, [activeTab, tabLoading]);

  // Handle tab switching more gracefully
  const handleTabChange = useCallback((newTab: TabType) => {
    if (newTab === activeTab) return;
    
    // Remember the previous tab
    previousTab.current = activeTab;
    
    // Set the active tab immediately
    setActiveTab(newTab);
    
    // Show loading state
    setTabLoading(true);
    
    // Use InteractionManager to wait until the tab animation is complete
    InteractionManager.runAfterInteractions(() => {
      // If this tab has not been loaded yet, fetch its data
      if (!tabsLoaded[newTab]) {
        fetchRequests(true);
      } else {
        // If already loaded, just clear the loading state after a short delay
        setTimeout(() => {
          setTabLoading(false);
        }, 300);
      }
    });
  }, [activeTab, tabsLoaded, fetchRequests]);

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
        
        if (timeInBackground > fiveMinutesInMs && providerId) {
          console.log('App was inactive for more than 5 minutes, refreshing service requests...');
          
          // Refresh data without showing full loading state
          InteractionManager.runAfterInteractions(() => {
            fetchRequests(false, true); // Force refresh data but don't show loading
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
  }, [providerId, fetchRequests]);

  useEffect(() => {
    if (providerId) {
      fetchRequests();
    }

    // Use a longer interval for background refreshes to reduce API calls and battery usage
    const refreshInterval = setInterval(() => {
      if (providerId) {
        fetchRequests(false, true); // Don't show loading for interval updates
      }
    }, 60000); // Increase to 60 seconds (from 30) to reduce API calls

    return () => clearInterval(refreshInterval);
  }, [activeTab, providerId, fetchRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests(false, true); // Force refresh data
  }, [fetchRequests]);

  const handleMarkAsDone = async (bookingId: string) => {
    try {
      Alert.alert(
        "Mark as Done",
        "Are you sure you want to mark this booking as completed?. This means the user has made all payments.",
        [
          {
            text: "No",
            style: "cancel"
          },
          {
            text: "Yes",
            style: "default",
            onPress: async () => {
              const request = getActiveRequests().find(req => req.id === bookingId);
              
              const { error } = await supabase
                .from('bookings')
                .update({
                  status: 'completed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);

              if (error) throw error;

              if (request?.user_id) {
                try {
                  await sendBookingStatusNotification(
                    request.user_id,
                    bookingId,
                    'completed',
                    request.service
                  );
                } catch (notifError) {
                  console.error('Failed to send notification, but booking was marked as completed:', notifError);
                }
              }

              fetchRequests(true, true); // Force refresh with loading
              Alert.alert('Success', 'Booking marked as completed');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error marking as done:', error);
      Alert.alert('Error', 'Failed to update booking status');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
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
              const request = getActiveRequests().find(req => req.id === bookingId);
              
              const { error } = await supabase
                .from('bookings')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString()
                })
                .eq('id', bookingId);

              if (error) throw error;
              
              if (request?.user_id) {
                try {
                  await sendBookingStatusNotification(
                    request.user_id,
                    bookingId,
                    'cancelled',
                    request.service
                  );
                } catch (notifError) {
                  console.error('Failed to send notification, but booking was cancelled:', notifError);
                }
              }

              fetchRequests(true, true); // Force refresh with loading
              Alert.alert('Success', 'Booking has been cancelled');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error cancelling booking:', error);
      Alert.alert('Error', 'Failed to cancel booking');
    }
  };

  const handleReport = async (userId: string, bookingId: string) => {
    setSelectedUserId(userId);
    setSelectedBookingId(bookingId);
    setShowReportModal(true);
  };

  const submitReport = async () => {
    if (!reportReason.trim() || !reportDescription.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all fields',
        position: 'top'
      });
      return;
    }

    setIsSubmittingReport(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert([{ 
          reporter_id: profile?.id,
          reported_id: selectedUserId,
          booking_id: selectedBookingId,
          report_type: 'provider_report',
          reason: reportReason,
          description: reportDescription,
          status: 'pending'
        }]);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Report submitted successfully',
        position: 'top'
      });
      
      setShowReportModal(false);
      setReportReason('');
      setReportDescription('');
      setSelectedUserId(null);
      setSelectedBookingId(null);
    } catch (error) {
      console.error('Error submitting report:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit report. Please try again.',
        position: 'top'
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // When ActiveTab changes to 'New', mark requests as viewed
  useEffect(() => {
    if (activeTab === 'New' && providerId) {
      const markAsViewed = async () => {
        try {
          await supabase.rpc('mark_provider_bookings_as_viewed', {
            provider_id_param: providerId
          });
          
          clearNewRequestsNotification();
        } catch (error) {
          console.error('Error marking bookings as viewed:', error);
        }
      };
      
      markAsViewed();
    }
  }, [activeTab, providerId]);

  // Add a ref for the bookings channel
  const bookingsChannelRef = useRef<any>(null);

  // Add real-time subscription for new bookings
  useEffect(() => {
    if (!providerId) return;
    
    // Clean up existing channel if it exists
    if (bookingsChannelRef.current) {
      supabase.removeChannel(bookingsChannelRef.current);
    }
    
    // Subscribe to booking changes, especially new bookings
    const bookingsChannel = supabase
      .channel('provider-services-bookings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `provider_id=eq.${providerId}`,
        },
        async (payload) => {
          console.log('New booking detected:', payload);
          
          if (payload.new && payload.new.status === 'pending') {
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
              
              // Refresh the requests list
              fetchRequests(false, true);
            } catch (error) {
              console.error('Error handling new booking notification:', error);
              // Still refresh data even if notification fails
              fetchRequests(false, true);
            }
          }
        }
      )
      .subscribe();
    
    // Store the channel reference
    bookingsChannelRef.current = bookingsChannel;
    
    return () => {
      if (bookingsChannelRef.current) {
        supabase.removeChannel(bookingsChannelRef.current);
      }
    };
  }, [providerId]);

  // Render loading state with the logo
  const renderLoading = () => {
    // Get appropriate loading message based on tab
    let loadingMessage = 'Loading requests...';
    switch (activeTab) {
      case 'New':
        loadingMessage = 'Loading new requests...';
        break;
      case 'InProgress':
        loadingMessage = 'Loading in-progress bookings...';
        break;
      case 'Completed':
        loadingMessage = 'Loading completed bookings...';
        break;
      case 'Cancelled':
        loadingMessage = 'Loading cancelled bookings...';
        break;
    }
    
    return (
      <View style={[
        styles.loadingContainer,
        isDark && { backgroundColor: colors.secondaryBackground }
      ]}>
        <Animated.View style={{ 
          opacity: fadeAnim,
          transform: [{
            scale: fadeAnim.interpolate({
              inputRange: [0.4, 1],
              outputRange: [0.95, 1.05]
            })
          }]
        }}>
          <Logo width={80} height={80} />
        </Animated.View>
        <Text style={[
          { 
            marginTop: 16, 
            fontSize: 16, 
            fontFamily: 'Urbanist-Medium', 
            color: '#666', 
            textAlign: 'center' 
          },
          isDark && { color: colors.text }
        ]}>{loadingMessage}</Text>
      </View>
    );
  };

  const renderRequests = () => {
    if (filteredRequests.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateTitle, isDark && { color: colors.text }]}>
            No {activeTab} Requests
          </Text>
          <Text style={[styles.emptyStateText, isDark && { color: '#aaa' }]}>
            {activeTab === 'New' ? 'New booking requests will appear here' :
             activeTab === 'InProgress' ? 'No in-progress requests found' :
             activeTab === 'Completed' ? 'Completed requests will appear here' :
             'Cancelled requests will appear here'}
          </Text>
        </View>
      );
    }

    // Render the correct tab content
    switch (activeTab) {
      case 'New':
        if (!isCurrentTabVisible('New')) return null;
        return filteredRequests.map(request => (
          <View key={request.id} style={[
            styles.newRequestCard, 
            isDark && { 
              backgroundColor: colors.cardBackground, 
              borderColor: '#444'
            }
          ]}>
            <View style={styles.userNameContainer}>
              <Text style={[styles.userNamez, isDark && { color: colors.text }]}>
                {request.user_details?.name}
              </Text>
              <Text style={styles.amountz}>NGN {request.amount.toLocaleString()}</Text>
            </View>
            
            <Text style={[styles.serviceDate, isDark && { color: '#aaa' }]}>
              Service Date: {request.service_date} {request.service_time}
            </Text>
            <Text style={[styles.address, isDark && { color: '#aaa' }]}>Address: {request.address}</Text>

            <View style={styles.bottomRow}>
              <View style={styles.activitiesContainer}>
                {request.service.split(', ').slice(0, 1).map((service, index) => (
                  <View key={index} style={[
                    styles.activityTag, 
                    isDark && { backgroundColor: 'rgba(51,169,212,0.2)' }
                  ]}>
                    <Text style={[
                      styles.activityText, 
                      isDark && { color: '#fff' }
                    ]}>
                      {service}
                      {request.service.split(', ').length > 1 && 
                        ` +${request.service.split(', ').length - 1}`}
                    </Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity 
                style={[
                  styles.viewDetailsButton,
                  isDark && { backgroundColor: '#333' }
                ]}
                onPress={() => router.push(`/provider/details/${request.id}`)}
              >
                <Text style={styles.viewDetailsText}>View details</Text>
              </TouchableOpacity>
            </View>
          </View>
        ));
      
      case 'InProgress':
        if (!isCurrentTabVisible('InProgress')) return null;
        return filteredRequests.map((request) => (
          <View key={request.id} style={[
            styles.inProgressCard, 
            isDark && { 
              backgroundColor: colors.cardBackground, 
              borderColor: '#444'
            }
          ]}>
            <View style={styles.locationContainer}>
              <Text style={[styles.locationLabel, isDark && { color: '#aaa' }]}>Location: [Office]</Text>
              <View style={[
                styles.bookingIdContainer, 
                isDark && { backgroundColor: 'rgba(51,169,212,0.2)' }
              ]}>
                <Text style={[styles.bookingId, isDark && { color: '#fff' }]}>{request.bookingId}</Text>
              </View>
            </View>

            <Text style={[styles.locationAddress, isDark && { color: colors.text }]}>
              {request.address}
            </Text>
            
            {request.landmark ? (
              <TouchableOpacity style={styles.locateButton}>
                <Text style={[styles.locateText, isDark && { color: '#fff' }]}>{request.landmark}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={[styles.divider, isDark && { backgroundColor: '#444' }]} />

            <Text style={[styles.customerName, isDark && { color: colors.text }]}>{request.user_details?.name}</Text>
            
            <View style={styles.detailsRow}>
              <Text style={[styles.detailLabel, isDark && { color: '#aaa' }]}>Start Date:</Text>
              <Text style={[styles.detailValue, isDark && { color: colors.text }]}>{request.service_date}</Text>
            </View>

            <View style={styles.detailsRow}>
              <Text style={[styles.detailLabel, isDark && { color: '#aaa' }]}>Service Fee:</Text>
              <Text style={[styles.detailValue, isDark && { color: colors.text }]}>NGN {request.amount.toLocaleString()}</Text>
            </View>

            <TouchableOpacity style={styles.initiatePaymentButton}>
              <Text style={[styles.initiatePaymentText, isDark && { color: '#fff' }]}>Initiate payment</Text>
            </TouchableOpacity>

            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.markAsDoneButton}
                onPress={() => handleMarkAsDone(request.id)}
              >
                <Text style={styles.buttonText}>Mark as done</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.cancelReportButton}
                onPress={() => handleCancelBooking(request.id)}
              >
                <Text style={styles.buttonText}>Cancel/Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        ));
      
      case 'Completed':
        if (!isCurrentTabVisible('Completed')) return null;
        return filteredRequests.map(request => (
          <View key={request.id} style={[
            styles.completedCard, 
            isDark && { 
              backgroundColor: colors.cardBackground, 
              borderColor: '#444'
            }
          ]}>
            <View style={styles.completedHeader}>
              <Text style={[styles.completedUserName, isDark && { color: colors.text }]}>
                {request.user_details?.name}
              </Text>
              <View style={[
                styles.bookingIdBadge, 
                isDark && { backgroundColor: 'rgba(51,169,212,0.2)' }
              ]}>
                <Text style={[styles.bookingIdText, isDark && { color: '#fff' }]}>{request.bookingId}</Text>
              </View>
            </View>

            <Text style={[styles.completedServiceDate, isDark && { color: '#aaa' }]}>
              Service Date: {request.service_date} {request.service_time}
            </Text>
            <Text style={[styles.completedAddress, isDark && { color: '#aaa' }]}>{request.address}</Text>

            <View style={styles.completedActions}>
              <TouchableOpacity style={styles.queryPaymentButton}>
                <Text style={[styles.queryPaymentText, isDark && { color: '#ff6b6b' }]}>Query payment</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.viewOrderButton}
                onPress={() => router.push(`/provider/details/${request.id}`)}
              >
                <Text style={[styles.viewOrderText, isDark && { color: '#fff' }]}>View order details</Text>
              </TouchableOpacity>
            </View>
          </View>
        ));
      
      case 'Cancelled':
        if (!isCurrentTabVisible('Cancelled')) return null;
        return filteredRequests.map((request) => (
          <View key={request.id} style={[
            styles.cancelledCard, 
            isDark && { 
              backgroundColor: colors.cardBackground, 
              borderColor: '#444'
            }
          ]}>
            <View style={styles.cancelledHeader}>
              <View style={styles.userInfoContainer}>
                <Image 
                  source={request.user_details?.profile_pic ? { uri: request.user_details.profile_pic } : require('../../assets/images/logo.png')} 
                  style={styles.userProfilePic} 
                />
                <Text style={[styles.cancelledName, isDark && { color: colors.text }]}>
                  {request.user_details?.name}
                </Text>
              </View>
              <View style={[
                styles.bookingIdBadge, 
                isDark && { backgroundColor: 'rgba(51,169,212,0.2)' }
              ]}>
                <Text style={[styles.bookingIdText, isDark && { color: '#fff' }]}>{request.bookingId}</Text>
              </View>
            </View>
            <View style={styles.serviceDetails}>
              <Text style={[styles.serviceDate, isDark && { color: '#aaa' }]}>
                Service Date: {request.service_date} {request.service_time}
              </Text>
              <Text style={[styles.serviceLocation, isDark && { color: '#aaa' }]}>{request.address}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity 
                style={styles.reportLink}
                onPress={() => handleReport(request.user_id, request.id)}
              >
                <Text style={[styles.reportLinkText, isDark && { color: '#ff6b6b' }]}>Report this user</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.viewBookingsButton}
                onPress={() => router.push(`/provider/details/${request.id}`)}
              >
                <Text style={[styles.viewBookingsText, isDark && { color: '#fff' }]}>View Bookings</Text>
              </TouchableOpacity>
            </View>
          </View>
        ));
      
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.secondaryBackground }]}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by service or customer name..."
      />
      <View style={[styles.tabsContainer, isDark && { borderBottomColor: '#333' }]}>
        {(['New', 'InProgress', 'Completed', 'Cancelled'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab, 
              activeTab === tab && styles.activeTab,
              isDark && activeTab !== tab && { backgroundColor: 'transparent' },
              isDark && activeTab === tab && { backgroundColor: '#444' }
            ]}
            onPress={() => handleTabChange(tab)}
          >
            <Text 
              style={[
                styles.tabText, 
                activeTab === tab && styles.activeTabText,
                isDark && { color: activeTab === tab ? '#fff' : '#aaa' }
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        key={scrollViewKey}
        style={[styles.requestsList, isDark && { backgroundColor: 'transparent' }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={isDark ? "#fff" : "#0066CC"}
          />
        }
      >
        {isLoading || tabLoading ? (
          renderLoading()
        ) : (
          renderRequests()
        )}
      </ScrollView>

      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.reportModalContent, 
            isDark && { 
              backgroundColor: colors.cardBackground,
              borderColor: '#444',
              borderWidth: 1
            }
          ]}>
            <View style={styles.reportModalHeader}>
              <Text style={[styles.reportModalTitle, isDark && { color: colors.text }]}>Report User</Text>
              <TouchableOpacity 
                onPress={() => setShowReportModal(false)}
                style={styles.closeButton}
                disabled={isSubmittingReport}
              >
                <Ionicons name="close" size={24} color={isDark ? "#fff" : "#000"} />
              </TouchableOpacity>
            </View>

            <View style={styles.reportForm}>
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>Reason for Report</Text>
                <TextInput
                  style={[
                    styles.reasonInput, 
                    isDark && { 
                      borderColor: '#444',
                      color: colors.text,
                      backgroundColor: 'rgba(30,30,30,0.5)'
                    }
                  ]}
                  value={reportReason}
                  onChangeText={setReportReason}
                  placeholder="Enter reason for report"
                  placeholderTextColor={isDark ? "#777" : "#666"}
                  editable={!isSubmittingReport}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, isDark && { color: colors.text }]}>Description</Text>
                <TextInput
                  style={[
                    styles.descriptionInput,
                    isDark && { 
                      borderColor: '#444',
                      color: colors.text,
                      backgroundColor: 'rgba(30,30,30,0.5)'
                    }
                  ]}
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  placeholder="Provide more details about the issue"
                  placeholderTextColor={isDark ? "#777" : "#666"}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isSubmittingReport}
                />
              </View>

              <TouchableOpacity 
                style={[
                  styles.submitReportButton, 
                  isSubmittingReport && styles.submitReportButtonDisabled,
                  isDark && { backgroundColor: '#ff4b55' }
                ]}
                onPress={submitReport}
                disabled={isSubmittingReport}
              >
                {isSubmittingReport ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitReportButtonText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: '30@ms',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: '16@ms',
    paddingVertical: '12@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: '8@ms',
    paddingHorizontal: '14@ms',
    borderRadius: '20@ms',
  },
  activeTab: {
    backgroundColor: '#222',
  },
  tabText: {
    fontSize: isSmallDevice ? '10@ms' : '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  requestsList: {
    flex: 1,
    paddingHorizontal: '16@ms',
    paddingTop: '8@ms',
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: '12@ms',
    padding: '16@ms',
    marginBottom: '16@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  userImage: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
    marginRight: '12@ms',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '4@ms',
  },
  serviceInfo: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.primary,
    marginBottom: '4@ms',
  },
  serviceDate: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '4@ms',
  },
  address: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: '12@ms',
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12@ms',
  },
  amount: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '32@ms',
  },
  emptyStateTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#222',
    marginBottom: '8@ms',
  },
  emptyStateText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    textAlign: 'center',
  },
  newRequestCard: {
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  userNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  userNamez: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#000',
  },
  amountz: {
    fontSize: '15@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#FF9500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8@s',
  },
  activitiesContainer: {
    flex: 1,
    marginRight: '8@s',
  },
  activityTag: {
    backgroundColor: '#E5F3FF',
    paddingHorizontal: '8@s',
    paddingVertical: '4@s',
    borderRadius: '4@s',
    alignSelf: 'flex-start',
  },
  activityText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-Medium',
    color: '#0066CC',
  },
  viewDetailsButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: '12@s',
    paddingVertical: '6@s',
    borderRadius: '4@s',
  },
  viewDetailsText: {
    fontSize: '12@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#fff',
  },
  inProgressCard: {
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  locationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  locationLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  bookingIdContainer: {
    backgroundColor: '#E5F3FF',
    paddingHorizontal: '12@ms',
    paddingVertical: '4@ms',
    borderRadius: '16@ms',
  },
  bookingId: {
    fontSize: '13@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
  },
  locationAddress: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#222',
    marginBottom: '8@ms',
  },
  locateButton: {
    alignSelf: 'flex-start',
  },
  locateText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: '16@ms',
  },
  customerName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#222',
    marginBottom: '16@ms',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  detailLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  detailValue: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#222',
  },
  initiatePaymentButton: {
    alignSelf: 'flex-start',
    marginVertical: '12@ms',
  },
  initiatePaymentText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
    textDecorationLine: 'underline',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: '16@ms',
    gap: '8@ms',
  },
  markAsDoneButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  cancelReportButton: {
    flex: 1,
    backgroundColor: '#FF4B55',
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
  cancelledCard: {
    backgroundColor: '#fff',
    borderRadius: '12@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  cancelledHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12@ms',
  },
  userProfilePic: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
  },
  cancelledName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  serviceDetails: {
    marginBottom: '12@ms',
  },
  serviceLocation: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
  },
  bookingIdWrapper: {
    marginBottom: '12@ms',
  },
  bookingIdBadge: {
    backgroundColor: '#E5F3FF',
    paddingHorizontal: '12@ms',
    paddingVertical: '4@ms',
    borderRadius: '16@ms',
  },
  bookingIdText: {
    fontSize: '13@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#0066CC',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8@ms',
  },
  reportLink: {
    alignSelf: 'flex-start',
  },
  reportLinkText: {
    fontSize: '14@ms',
    color: '#FF4B55',
    textDecorationLine: 'underline',
    fontFamily: 'Urbanist-Medium',
  },
  viewBookingsButton: {
    alignSelf: 'flex-start',
  },
  viewBookingsText: {
    fontSize: '14@ms',
    color: '#0066CC',
    textDecorationLine: 'underline',
    fontFamily: 'Urbanist-Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: '16@ms',
  },
  reportModalContent: {
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    padding: '20@ms',
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20@ms',
  },
  reportModalTitle: {
    fontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  closeButton: {
    padding: '4@ms',
  },
  reportForm: {
    gap: '16@ms',
  },
  inputContainer: {
    gap: '8@ms',
  },
  inputLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: '8@ms',
    paddingHorizontal: '12@ms',
    paddingVertical: '10@ms',
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#000',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: '8@ms',
    paddingHorizontal: '12@ms',
    paddingVertical: '10@ms',
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#000',
    height: '100@ms',
  },
  submitReportButton: {
    backgroundColor: '#FF4B55',
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    marginTop: '8@ms',
  },
  submitReportButtonDisabled: {
    opacity: 0.7,
  },
  submitReportButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '32@ms',
    minHeight: '200@ms', // Ensure container has enough height
  },
  completedCard: {
    backgroundColor: '#fff',
    borderRadius: '12@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  completedUserName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#000',
  },
  completedServiceDate: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: '4@ms',
  },
  completedAddress: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: '16@ms',
  },
  completedActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queryPaymentButton: {
    alignSelf: 'flex-start',
  },
  queryPaymentText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#FF4B55',
    textDecorationLine: 'underline',
  },
  viewOrderButton: {
    alignSelf: 'flex-start',
  },
  viewOrderText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#0066CC',
    textDecorationLine: 'underline',
  },
}); 