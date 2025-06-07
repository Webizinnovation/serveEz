import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ScaledSheet } from 'react-native-size-matters';
import { sendBookingStatusNotification, updateBookingStatus } from '../../../utils/notifications';
import { useUserStore } from '../../../store/useUserStore';
import { useTheme } from '../../../components/ThemeProvider';
import Logo from '../../../assets/images/Svg/logo1.svg';
import { sendBookingAcceptedNotification, sendBookingStatusUpdatePushNotification } from '../../../services/pushNotifications';

type BookingDetails = {
  id: string;
  service: string;
  booking_date: string;
  booking_time: string;
  address: string;
  landmark?: string;
  amount: number;
  status: string;
  payment_plan: 'full_upfront' | 'half';
  activities: string[];
  user_id: string;
  service_details?: Array<{
    service_name: string;
    details: string;
  }>;
  user: {
    id: string;
    name: string;
    profile_pic: string | null;
    phone: string;
  };
};

type BookingPayload = {
  new: {
    status: string;
    [key: string]: any;
  };
};

export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isDark, colors } = useTheme();

  useEffect(() => {
    fetchBookingDetails();

    const channel = supabase
      .channel(`booking_${id}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${id}`,
        },
        (payload: BookingPayload) => {
          if (payload.new) {
            setBooking(prev => prev ? {
              ...prev,
              status: payload.new.status,
            } : null);

            if (payload.new.status === 'accepted') {
              Alert.alert(
                'Booking Accepted',
                'You have accepted the request.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchBookingDetails = async () => {
    setIsLoading(true);
    try {
      const { data: bookingData, error: bookingError } = await supabase
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
          payment_plan,
          user_id,
          service_details
        `)
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          profile_pic,
          phone
        `)
        .eq('id', bookingData.user_id)
        .single();

      if (userError) throw userError;

      const transformedData: BookingDetails = {
        ...bookingData,
        activities: [bookingData.service],
        user: userData
      };

      setBooking(transformedData);
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      const { profile } = useUserStore.getState();
      if (!profile) {
        throw new Error('User profile not found');
      }

      // Update booking status and reset is_viewed flag
      const updated = await updateBookingStatus(
        String(id),
        'accepted',
        profile.id
      );

      if (!updated) {
        throw new Error('Failed to update booking status');
      }

      if (booking?.user_id) {
        // Send in-app notification
        await sendBookingStatusNotification(
          booking.user_id,
          String(id),
          'accepted',
          booking.service
        );
        
        // Even though notifications are handled via Supabase subscription in UserServices,
        // we'll also try to send a direct notification here as a fallback
        // to ensure the user receives the notification
        try {
          await sendBookingStatusUpdatePushNotification(
            'accepted',
            booking.service || 'requested service',
            profile.name || 'Your provider',
            'You can now proceed to payment.'
          );
          console.log('[BookingDetails] Direct push notification sent successfully as fallback');
        } catch (pushError) {
          console.error('[BookingDetails] Direct push notification failed:', pushError);
          // We'll continue even if this fails, as the UserServices should handle it
        }
      }

      router.back();
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', 'Failed to accept booking');
    }
  };

  const handleReject = async () => {
    try {
      const { profile } = useUserStore.getState();
      if (!profile) {
        throw new Error('User profile not found');
      }

      // Update booking status and reset is_viewed flag
      const updated = await updateBookingStatus(
        String(id),
        'cancelled',
        profile.id
      );
      
      if (!updated) {
        throw new Error('Failed to update booking status');
      }
      
      if (booking?.user_id) {
        try {
          await sendBookingStatusNotification(
            booking.user_id,
            String(id),
            'cancelled',
            booking.service
          );
        } catch (notifError) {
          console.error('Failed to send notification, but booking was rejected:', notifError);
          // Continue with the process even if notification fails
        }
      }

      router.back();
    } catch (error) {
      console.error('Error rejecting booking:', error);
      Alert.alert('Error', 'Failed to reject booking');
    }
  };

  const getStatusColor = (status: string, isDark: boolean = false) => {
    switch (status) {
      case 'accepted':
        return '#4CAF50';
      case 'cancelled':
        return isDark ? '#ff6b6b' : '#FF4B55';
      default:
        return isDark ? '#aaa' : '#666';
    }
  };

  if (!booking && isLoading) {
    return (
      <View style={[styles.container, isDark && { backgroundColor: colors.secondaryBackground }]}>
        <View style={[styles.header, isDark && { 
          backgroundColor: colors.cardBackground,
          borderBottomColor: '#333'
        }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#000"} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Logo width={30} height={30} />
          </View>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.loadingContainer}>
          <Logo width={80} height={80} />
          <Text style={[styles.loadingText, isDark && { color: colors.text }]}>
            Loading booking details...
          </Text>
        </View>
      </View>
    );
  }

  if (!booking) return null;

  return (
    <View style={[styles.container, isDark && { backgroundColor: colors.secondaryBackground }]}>
      <View style={[styles.header, isDark && { 
        backgroundColor: colors.cardBackground,
        borderBottomColor: '#333'
      }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#000"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && { color: colors.text }]}>Booking Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[
          styles.statusContainer, 
          { borderColor: getStatusColor(booking.status, isDark) }
        ]}>
          <Text style={[
            styles.statusText, 
            { color: getStatusColor(booking.status, isDark) }
          ]}>
            Status: {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Text>
        </View>

        <View style={[styles.section, isDark && { borderColor: '#333' }]}>
          <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>Customer Information</Text>
          <View style={styles.customerInfoContainer}>
            <View style={styles.customerDetails}>
              <View style={styles.nameContainer}>
                <Text style={[styles.customerName, isDark && { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                  {booking.user.name}
                </Text>
                <TouchableOpacity 
                  style={[styles.chatButton, isDark && { backgroundColor: 'rgba(51,169,212,0.2)' }]}
                  onPress={async () => {
                    try {
                      const { data: currentUser } = await supabase.auth.getUser();
                      if (!currentUser?.user?.id) {
                        throw new Error('Auth user not found');
                      } 

                      const { data: providerData, error: providerError } = await supabase
                        .from('providers')
                        .select(`
                          id,
                          user_id,
                          users:user_id (
                            name
                          )
                        `)
                        .eq('user_id', currentUser.user.id)
                        .single();

                      if (providerError) throw providerError;
                      if (!providerData) throw new Error('Provider not found');

                      const providerName = providerData.users[0]?.name;

                      const { data: existingChats, error: searchError } = await supabase
                        .from('chat_rooms')
                        .select('*')
                        .eq('user_id', booking.user.id)
                        .eq('provider_id', providerData.user_id);

                      if (searchError) throw searchError;

                      let chatId;

                      if (existingChats && existingChats.length > 0) {
                        chatId = existingChats[0].id;
                      } else {
                        const { data: newChat, error: createError } = await supabase
                          .from('chat_rooms')
                          .insert({
                            user_id: booking.user.id,
                            provider_id: providerData.user_id,
                            user_name: booking.user.name,
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
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={20} color={isDark ? "#fff" : "#0066CC"} />
                  <Text style={[styles.chatButtonText, isDark && { color: "#fff" }]}>Chat</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.customerPhone, isDark && { color: '#aaa' }]} numberOfLines={1} ellipsizeMode="tail">
                {booking.user.phone}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push(`/provider/customer/${booking.user.id}`)}
            >
              <Image 
                source={{ 
                  uri: booking.user.profile_pic || 'https://via.placeholder.com/40'
                }}
                style={styles.customerImage}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, isDark && { borderColor: '#333' }]}>
          <View style={styles.serviceHeaderContainer}>
            <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>Service Details</Text>
             <View style={[
               styles.bookingIdContainer, 
               isDark && { backgroundColor: 'rgba(51,169,212,0.2)' }
             ]}>
              <Text style={[
                styles.bookingId,
                isDark && { color: "#fff" }
              ]} numberOfLines={1} ellipsizeMode="tail">
                PL{typeof id === 'string' ? id.slice(0, 4).toUpperCase() : ''}
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && { color: '#aaa' }]}>Date:</Text>
            <Text style={[styles.detailValue, isDark && { color: colors.text }]}>{booking.booking_date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && { color: '#aaa' }]}>Time:</Text>
            <Text style={[styles.detailValue, isDark && { color: colors.text }]}>{booking.booking_time}</Text>
          </View>
          <TouchableOpacity 
            style={styles.detailRow}
            onPress={() => router.push(`/provider/map/${id}`)}
          >
            <Text style={[styles.detailLabel, isDark && { color: '#aaa' }]}>Location:</Text>
            <View style={styles.locationContainer}>
              <Text style={[
                styles.detailValue, 
                styles.locationText,
                isDark && { color: colors.text }
              ]} numberOfLines={2} ellipsizeMode="tail">
                {booking.address}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={isDark ? "#fff" : "#666"} />
            </View>
          </TouchableOpacity>
          {booking.landmark && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, isDark && { color: '#aaa' }]}>Landmark:</Text>
              <Text style={[
                styles.detailValue,
                styles.landmarkText,
                isDark && { color: colors.text }
              ]} numberOfLines={2} ellipsizeMode="tail">
                {booking.landmark}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, isDark && { color: '#aaa' }]}>Payment Plan:</Text>
            <Text style={[styles.detailValue, isDark && { color: colors.text }]}>
              {booking.payment_plan === 'half' ? '50% Upfront' : 'Full Payment'}
            </Text>
          </View>
        </View>

        <View style={[styles.section, isDark && { borderColor: '#333' }]}>
          <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>Activities Included</Text>
          {booking.activities?.map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <Ionicons name="checkmark-circle" size={20} color={isDark ? "#4CAF50" : "#4CAF50"} />
              <View style={styles.activityContent}>
                <Text style={[styles.activityText, isDark && { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                  {activity}
                </Text>
                {booking.service_details?.find(detail => detail.service_name === activity)?.details && (
                  <Text style={[styles.activityDetails, isDark && { color: '#aaa' }]} numberOfLines={2} ellipsizeMode="tail">
                    {booking.service_details.find(detail => detail.service_name === activity)?.details}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.section, isDark && { borderColor: '#333' }]}>
          <Text style={[styles.sectionTitle, isDark && { color: colors.text }]}>Payment</Text>
          <View style={[styles.paymentContainer, isDark && { backgroundColor: '#262626' }]}>
            <Text style={[styles.paymentLabel, isDark && { color: '#aaa' }]}>Total Amount:</Text>
            <Text style={[styles.paymentAmount, isDark && { color: colors.text }]}>
              NGN {booking.amount.toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {booking.status === 'pending' && (
        <View style={[styles.footer, isDark && { borderTopColor: '#333' }]}>
          <TouchableOpacity 
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
          >
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.rejectButton]}
            onPress={handleReject}
          >
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: '16@ms',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: '16@ms',
  },
  section: {
    marginBottom: '24@ms',
    width: '100%',
  },
  sectionTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    marginBottom: '12@ms',
  },
  customerInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerDetails: {
    flex: 1,
    marginRight: '8@ms',
  },
  customerName: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#000',
    marginBottom: '4@ms',
    flex: 1,
  },
  customerPhone: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  customerImage: {
    width: '50@ms',
    height: '50@ms',
    borderRadius: '25@ms',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: '8@ms',
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    width: '80@ms',
    paddingTop: '2@ms',
  },
  detailValue: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#000',
    flex: 1,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: '8@ms',
  },
  activityContent: {
    flex: 1,
    marginLeft: '8@ms',
  },
  activityText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#000',
    marginBottom: '4@ms',
  },
  activityDetails: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: '16@ms',
  },
  paymentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: '16@ms',
    borderRadius: '12@ms',
  },
  paymentLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  paymentAmount: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
  },
  footer: {
    flexDirection: 'row',
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    gap: '12@ms',
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#FF4B55',
  },
  buttonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  statusContainer: {
    margin: '16@ms',
    padding: '12@ms',
    borderRadius: '8@ms',
    borderWidth: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  statusText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
  },
  serviceHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
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
  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationText: {
    flex: 1,
    marginRight: '8@ms',
  },
  landmarkText: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8@s',
    flexWrap: 'wrap',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5F3FF',
    paddingVertical: '4@s',
    paddingHorizontal: '8@s',
    borderRadius: '6@s',
    gap: '4@s',
  },
  chatButtonText: {
    color: '#0066CC',
    fontFamily: 'Urbanist-SemiBold',
    fontSize: '12@s',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: '16@ms',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 