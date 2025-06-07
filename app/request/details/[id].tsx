import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Modal, Pressable, Animated, Easing } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../../constants/Colors';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../../store/useUserStore';
import { supabase } from '../../../services/supabase';
import { router } from 'expo-router';
import { UserProfile } from '../../../types/index';
import Toast from 'react-native-toast-message';
import { BlurView } from 'expo-blur';
import { sendBookingStatusNotification } from '../../../utils/notifications';
import { createUserNotification } from '../../../utils/notifications';
import { useTheme } from '../../../components/ThemeProvider';
import Logo from '../../../assets/images/Svg/logo1.svg';
import { sendPaymentNotification } from '../../../services/pushNotifications';

type BookingStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

interface BookingDetailsType {
  id: string;
  service: string;
  price: number;
  name: string;
  date: string;
  time?: string;
  details?: string;
  status: BookingStatus;
  payment_plan: 'full_upfront' | 'half';
  payment_details: {
    workmanship_fee: number;
    tools_hardware: number;
    vat: number;
  };
  landmark?: string;
  address?: string;
  service_details?: Array<{
    service_name: string;
    details: string;
  }>;
  payment_status?: 'pending' | 'completed';
  additional_services?: string[];
  provider_id?: string;
  provider_accepted?: boolean;
  user_id?: string;
  first_payment_completed?: boolean;
  final_payment_completed?: boolean;
}

interface ProviderDetails {
  id: string;
  services: Record<string, number>;
  users: {
    id: string;
    name: string;
    profile_pic?: string;
    phone?: string;
  };
  booking?: {
    id: string;
    service: string;
    booking_date: string;
    booking_time?: string;
    address?: string;
    amount: number;
    status: BookingStatus;
  };
}

interface PaymentConfirmationDialogProps {
  visible: boolean;
  amount: number;
  isHalfPayment: boolean;
  totalAmount: number;
  isFirstPayment: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const PaymentConfirmationDialog = ({ 
  visible, 
  amount, 
  isHalfPayment, 
  totalAmount,
  isFirstPayment,
  onConfirm, 
  onCancel 
}: PaymentConfirmationDialogProps) => {
  const { isDark, colors } = useTheme();
  
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <BlurView intensity={10} style={styles.blurContainer}>
        <View style={[
          styles.dialogContainer,
          isDark && { 
            backgroundColor: colors.cardBackground,
            borderColor: colors.border,
            borderWidth: 1
          }
        ]}>
          <View style={styles.dialogContent}>
            <Text style={[
              styles.dialogTitle,
              isDark && { color: colors.text }
            ]}>Confirm Payment</Text>
            
            <View style={[
              styles.amountContainer,
              isDark && { backgroundColor: colors.secondaryBackground }
            ]}>
              <Text style={[
                styles.amountLabel,
                isDark && { color: colors.subtext }
              ]}>Amount to Pay:</Text>
              <Text style={[
                styles.amountValue,
                isDark && { color: colors.tint }
              ]}>₦{amount.toLocaleString()}</Text>
            </View>

            {isHalfPayment && isFirstPayment && (
              <View style={[
                styles.infoContainer,
                isDark && { backgroundColor: 'rgba(255, 248, 225, 0.2)' }
              ]}>
                <Text style={[
                  styles.infoText,
                  isDark && { color: '#FFD700' }
                ]}>
                  This is the initial payment (50%). You will need to pay the remaining ₦{Math.floor(totalAmount/2).toLocaleString()} after the service begins.
                </Text>
              </View>
            )}

            {isHalfPayment && !isFirstPayment && (
              <View style={[
                styles.infoContainer,
                isDark && { backgroundColor: 'rgba(255, 248, 225, 0.2)' }
              ]}>
                <Text style={[
                  styles.infoText,
                  isDark && { color: '#FFD700' }
                ]}>
                  This is the final payment (50%) to complete your service payment.
                </Text>
              </View>
            )}

            <Text style={[
              styles.confirmText,
              isDark && { color: colors.subtext }
            ]}>
              Are you sure you want to proceed with this payment?
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.dialogCancelButton,
                  isDark && { backgroundColor: 'rgba(241, 245, 249, 0.2)' }
                ]} 
                onPress={onCancel}
              >
                <Text style={[
                  styles.cancelButtonText,
                  isDark && { color: colors.subtext }
                ]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.confirmButton]}
                onPress={onConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

export default function BookingDetailsScreen() {
  const params = useLocalSearchParams();
  const { profile } = useUserStore();
  const [booking, setBooking] = useState<BookingDetailsType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [providerData, setProviderData] = useState<ProviderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const bookingData = params.data ? JSON.parse(params.data as string) : null;
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState<Record<string, boolean>>({});
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const fadeAnim = useState(new Animated.Value(0.3))[0];

  const fadeInOut = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ]).start(() => {
      if (loading) {
        fadeInOut();
      }
    });
  }, [fadeAnim, loading]);

  useEffect(() => {
    if (loading) {
      fadeInOut();
    }
  }, [loading, fadeInOut]);

  const activities = useMemo(() => {
    if (!booking?.service) return [];
    const services = booking.service.split(', ').filter(Boolean);
    return services.map((service, index) => ({
      id: index + 1,
      name: service.trim()
    }));
  }, [booking?.service]);

  const handleChat = useCallback(async () => {
    if (!profile || !providerData?.users?.id) return;
    
    try {
      const { data: existingChats, error: searchError } = await supabase
        .from('chat_rooms')
        .select('id') 
        .eq('user_id', profile.id)
        .eq('provider_id', providerData.users.id);

      if (searchError) throw searchError;

      let chatId;

      if (existingChats && existingChats.length > 0) {
        chatId = existingChats[0].id;
      } else {
        const { data: newChat, error: createError } = await supabase
          .from('chat_rooms')
          .insert({
            user_id: profile.id,
            provider_id: providerData.users.id,
            user_name: profile.name,
            provider_name: providerData.users.name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message: null,
            last_message_at: new Date().toISOString(),
          })
          .select('id') 
          .single();

        if (createError) throw createError;
        chatId = newChat?.id;
      }

      if (chatId) {
        router.push(`/chat/${chatId}`);
      }
    } catch (error: any) {
      Alert.alert('Chat Error', error.message || 'Failed to start chat');
    }
  }, [profile, providerData, router]);

  const fetchProviderData = useCallback(async () => {
    if (!params.id) return;
    
    try {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          service,
          booking_date,
          booking_time,
          address,
          amount,
          status,
          payment_plan,
          provider_id,
          user_id,
          landmark,
          service_details,
          first_payment_completed,
          final_payment_completed,
          price
        `)
        .eq('id', params.id)
        .single();
      
      if (bookingError) throw bookingError;
      if (!booking) throw new Error('Booking not found');
      
      console.log('Fresh booking data from database:', {
        first_payment_completed: booking.first_payment_completed,
        final_payment_completed: booking.final_payment_completed,
        payment_plan: booking.payment_plan
      });

      if (booking.provider_id && (!providerData || loading)) {
        const { data: provider, error: providerError } = await supabase
          .from('providers')
          .select(`
            id,
            services,
            users!inner (
              id,
              name,
              profile_pic,
              phone
            )
          `)
          .eq('id', booking.provider_id)
          .single();
          
        if (providerError) throw providerError;
        if (!provider) throw new Error('Provider not found');

        const transformedData: ProviderDetails = {
          id: provider.id,
          services: provider.services,
          users: {
            id: (provider.users as any).id,
            name: (provider.users as any).name,
            profile_pic: (provider.users as any).profile_pic || undefined,
            phone: (provider.users as any).phone || undefined
          }
        };

        setProviderData(transformedData);
      }

      const payment_status = booking.first_payment_completed && booking.final_payment_completed 
        ? 'completed' 
        : 'pending';
        
      const price = booking.price || booking.amount || (providerData?.services?.[booking.service] || 0);
        
      const freshBookingData: BookingDetailsType = {
        id: booking.id,
        user_id: booking.user_id,
        provider_id: booking.provider_id,
        service: booking.service,
        name: booking.service,
        address: booking.address || '',
        landmark: booking.landmark || '',
        date: booking.booking_date,
        time: booking.booking_time || '',
        price: price,
        status: booking.status as BookingStatus,
        payment_status: payment_status as 'pending' | 'completed',
        payment_plan: booking.payment_plan || 'full_upfront',
        service_details: booking.service_details || {},
        first_payment_completed: !!booking.first_payment_completed,
        final_payment_completed: !!booking.final_payment_completed,
        payment_details: {
          workmanship_fee: Math.floor(price * 0.6),
          tools_hardware: Math.floor(price * 0.35),
          vat: Math.floor(price * 0.052),
        }
      };
      
      setBooking(freshBookingData);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }, [params.id, providerData, loading]);

    // --------------- PAYMENT FUNCTIONS ---------------

  const initiatePayment = useCallback(async () => {
    
    if (!profile || !booking) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Unable to process payment. Missing booking or profile data.',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', profile.id)
        .single();

      if (walletError) {
        console.error('Error fetching wallet balance:', walletError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not fetch wallet balance. Please try again.',
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60,
        });
        return;
      }

      const payment_plan = booking.payment_plan || 'full_upfront';
      const isSecondPayment = payment_plan === 'half' && booking.first_payment_completed === true;
      const paymentAmount = payment_plan === 'half' 
        ? Math.floor(booking.price / 2) 
        : booking.price;

      
      if ((walletData?.balance || 0) < paymentAmount) {
        Toast.show({
          type: 'error',
          text1: 'Insufficient Balance',
          text2: `You need ₦${paymentAmount.toLocaleString()} to complete this payment. Please top up your wallet.`,
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60,
        });
        return;
      }

      setWalletBalance(walletData?.balance || 0);
      setShowConfirmation(true);
    } catch (error) {
      console.error('Error initiating payment:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not initiate payment process. Please try again.',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  }, [profile, booking]);


  const executePayment = useCallback(async () => {
    console.log('Executing payment after confirmation');
    setShowConfirmation(false);
    
    if (!profile || !booking || !providerData?.users?.id) {
      console.error('Missing required data for payment:', { 
        hasProfile: !!profile, 
        hasBooking: !!booking, 
        hasProviderUserId: !!providerData?.users?.id 
      });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Missing data required for payment. Please try again.',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
      return;
    }
    
    setIsProcessing(true);

    const payment_plan = booking.payment_plan || 'full_upfront';
    const isSecondPayment = payment_plan === 'half' && booking.first_payment_completed === true;
    const paymentAmount = payment_plan === 'half' 
      ? Math.floor(booking.price / 2) 
      : booking.price;

    let newStatus: BookingStatus = 'in_progress';
    if (payment_plan === 'full_upfront' || (payment_plan === 'half' && isSecondPayment)) {
      newStatus = 'completed';
    }
    
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      price: booking.price, 
      ...(payment_plan === 'half' 
        ? { 
            first_payment_completed: isSecondPayment ? true : true,
            final_payment_completed: isSecondPayment ? true : false
          } 
        : { 
            first_payment_completed: true,
            final_payment_completed: true
          }
      )
    };


    if (payment_plan === 'half') {
      if (isSecondPayment) {
        updateData.first_payment_completed = true;
        updateData.final_payment_completed = true;
      } else {
        updateData.first_payment_completed = true;
        updateData.final_payment_completed = false;
      }
    }

    try {
      
      // TRANSACTION PROCESSING - SEQUENTIAL FOR SAFETY
      
      const transactionRef = `TRX-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
      
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          reference: transactionRef,
          amount: paymentAmount,
          type: 'payment',
          status: 'completed',
          user_id: profile.id,
          provider_id: booking.provider_id,
          booking_id: booking.id,
          metadata: {
            payment_type: isSecondPayment ? 'final_payment' : payment_plan === 'half' ? 'first_payment' : 'full_payment',
            provider_name: providerData?.users?.name,
            service: booking.service,
            user_name: profile.name,
            user_id: profile.id
          }
        });

      if (transactionError) {
        throw new Error(`Transaction creation failed: ${transactionError.message}`);
      }

      const { error: userWalletError } = await supabase
        .from('wallets')
        .update({ 
          balance: walletBalance - paymentAmount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profile.id);

      if (userWalletError) {
        throw new Error(`User wallet update failed: ${userWalletError.message}`);
      }

      const { error: providerWalletError } = await supabase.rpc(
        'increase_wallet_balance',
        { 
          p_user_id: providerData.users.id,
          amount: paymentAmount
        }
      );

      if (providerWalletError) {
        throw new Error(`Provider wallet update failed: ${providerWalletError.message}`);
      }

      const { error: bookingUpdateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (bookingUpdateError) {
        throw new Error(`Booking update failed: ${bookingUpdateError.message}`);
      }

      if (booking.provider_id && booking.provider_id !== profile.id) {
        try {
          await supabase.rpc('create_user_notification', {
            p_user_id: booking.provider_id,
            p_title: isSecondPayment ? 'Final Payment Received' : 'Payment Received',
            p_message: isSecondPayment 
              ? `Final payment for ${booking.service} has been received.` 
              : `Payment for ${booking.service} has been received.`,
            p_type: 'payment'
          });
        } catch (notifError) {
          console.error('Failed to send in-app notification to provider:', notifError);
        }
      }

      // Send push notification to the user about successful payment
      try {
        const isFullPayment = payment_plan === 'full_upfront';
        const isFinalPayment = payment_plan === 'half' && isSecondPayment;
        
        await sendPaymentNotification(
          booking.service,
          paymentAmount,
          isFullPayment,
          isFinalPayment
        );
      } catch (notifError) {
        console.error('Failed to send push notification for payment:', notifError);
        // Continue with the process even if notification fails
      }

      setBooking(prev => {
        if (!prev) return null;
        
        const updatedState = {
          ...prev,
          status: newStatus,
          payment_status: 'completed' as 'pending' | 'completed',
        };

        if (payment_plan === 'half') {
          if (isSecondPayment) {
            updatedState.first_payment_completed = true;
            updatedState.final_payment_completed = true;
          } else {
            updatedState.first_payment_completed = true;
            updatedState.final_payment_completed = false;
          }
        } else {
          updatedState.first_payment_completed = true;
          updatedState.final_payment_completed = true;
        }
        
        return updatedState;
      });

      setWalletBalance(walletBalance - paymentAmount);

      Toast.show({
        type: 'success',
        text1: 'Payment Successful',
        text2: payment_plan === 'half' ? 
          (isSecondPayment ? 'Final payment completed. Your service is now complete.' : 'Initial payment made. You will need to make the final payment after service begins.') :
          'Payment completed successfully.',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
    } catch (error) {
      console.error('Payment processing error:', error);
      Toast.show({
        type: 'error',
        text1: 'Payment Error',
        text2: error instanceof Error ? error.message : 'Failed to process payment. Please try again.',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [profile, booking, providerData, walletBalance]);

  const handlePayment = useCallback(() => {
    initiatePayment();
  }, [initiatePayment]);
  
  const handlePaymentConfirm = useCallback(() => {
    executePayment();
  }, [executePayment]);

  const handleCancel = useCallback(async (bookingId: string) => {
    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('status, payment_plan, first_payment_completed, provider_id')
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;

      if (bookingData?.payment_plan === 'half' && bookingData?.first_payment_completed) {
        Toast.show({
          type: 'error',
          text1: 'Cannot Cancel',
          text2: 'You cannot cancel this booking after making the initial payment.',
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60,
        });
        return;
      }

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
                  sendBookingStatusNotification(
                    bookingData.provider_id,
                    bookingId,
                    'cancelled',
                    booking?.service || 'Booking'
                  ).catch(err => console.error('Notification error:', err));
                }

                setBooking(prev => prev ? {...prev, status: 'cancelled'} : null);
                
                Toast.show({
                  type: 'success',
                  text1: 'Success',
                  text2: 'Booking has been cancelled successfully',
                  position: 'top',
                  visibilityTime: 3000,
                  topOffset: 60,
                });
              } catch (error) {
                console.error('Error:', error);
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Failed to cancel booking. Please try again.',
                  position: 'top',
                  visibilityTime: 4000,
                  topOffset: 60,
                });
              } finally {
                setLoadingBookings(prev => ({ ...prev, [bookingId]: false }));
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process cancellation. Please try again.',
        position: 'top',
        visibilityTime: 4000,
        topOffset: 60,
      });
    }
  }, [profile, booking]);

 
  const formatDate = useCallback((date: string, time?: string) => {
    try {
      console.log('Formatting date:', date, typeof date);
      
      if (!date) return 'Date not available';
      
      let dateObj;
      

      if (typeof date === 'string') {
        if (date.includes('/')) {
          const [day, month, year] = date.split('/').map(Number);
          const fixedYear = year < 100 ? 2000 + year : year;
          dateObj = new Date(fixedYear, month - 1, day);
        } else if (date.includes('-')) {
          const [year, month, day] = date.split('-').map(Number);
          dateObj = new Date(year, month - 1, day);
        } else if (!isNaN(Date.parse(date))) {
          dateObj = new Date(date);
        } else {
          console.log('Invalid date format:', date);
          return date; 
        }
      } else {
        return 'Invalid date';
      }
      
      if (isNaN(dateObj.getTime())) {
        console.log('Invalid date object:', date);
        return date; 
      }

      try {
        const dateString = dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        if (time) {
          return `${dateString} at ${time}`;
        }

        return dateString;
      } catch (formatError) {
        console.log('Error in date formatting:', formatError);
        return `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
      }
    } catch (error) {
      console.log('Error processing date:', date, error);
      return String(date);
    }
  }, []);
  
  useEffect(() => {
    if (params.id) {
      fetchProviderData();
      
      if (!booking && params.data) {
        try {
          const parsedData = JSON.parse(params.data as string);
          
          const payment_plan = parsedData.payment_plan || 'full_upfront';

          const transformedData: BookingDetailsType = {
            ...parsedData,
            id: params.id as string,
            payment_plan: payment_plan,
            payment_details: {
              workmanship_fee: Math.floor((parsedData.price || 0) * 0.6),
              tools_hardware: Math.floor((parsedData.price || 0) * 0.35),
              vat: Math.floor((parsedData.price || 0) * 0.052),
            },
            first_payment_completed: parsedData.first_payment_completed || false,
            final_payment_completed: parsedData.final_payment_completed || false
          };
          
          setBooking(transformedData);
        } catch (error) {
          console.error('Error parsing booking data:', error);
        }
      }
    }
  }, [params.id, fetchProviderData]);

  const getActivities = useCallback((booking: BookingDetailsType) => {
    return activities;
  }, [activities]);

  if (!booking) return null;

  return (
    <SafeAreaView style={[
      styles.container,
      isDark && { backgroundColor: colors.background }
    ]}>
      <Stack.Screen 
        options={{
          title: 'Booking Details',
          headerShown: true,
          headerStyle: {
            backgroundColor: isDark ? colors.background : '#fff',
          },
          headerTintColor: isDark ? colors.text : '#000',
          headerTitleStyle: {
            color: isDark ? colors.text : '#000',
          },
        }}
      />

      {loading ? (
        <View style={[
          styles.loadingContainer,
          isDark && { backgroundColor: colors.background }
        ]}>
          <Animated.View style={{ opacity: fadeAnim }}>
            <Logo width={80} height={80} />
          </Animated.View>
          <Text style={[
            styles.loadingText,
            isDark && { color: colors.text }
          ]}>Loading booking details...</Text>
        </View>
      ) : error ? (
        <View style={[
          styles.errorContainer,
          isDark && { backgroundColor: colors.background }
        ]}>
          <Text style={[
            styles.errorText,
            isDark && { color: colors.error }
          ]}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchProviderData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : providerData ? (
        <ScrollView style={[
          styles.scrollView,
          isDark && { backgroundColor: colors.background }
        ]}>
          <View style={styles.idBadgeContainer}>
            <View style={[
              styles.idBadge,
              isDark && { 
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderColor: colors.tint 
              }
            ]}>
              <MaterialIcons name="confirmation-number" size={16} color={isDark ? colors.tint : Colors.primary} />
              <Text style={[
                styles.idText,
                isDark && { color: colors.subtext }
              ]}>Booking ID:</Text>
              <Text style={[
                styles.idNumber,
                isDark && { color: colors.tint }
              ]}>#{booking.id.slice(0, 8)}</Text>
            </View>
          </View>

          <View style={[
            styles.section,
            isDark && { borderBottomColor: colors.border }
          ]}>
            <Text style={[
              styles.sectionTitle,
              isDark && { color: colors.text }
            ]}>Service Provider</Text>
            <View style={styles.providerHeader}>
              <View style={styles.providerInfo}>
                <Text style={[
                  styles.providerName,
                  isDark && { color: colors.text }
                ]}>{bookingData?.name}</Text>
                {providerData?.users?.phone && (
                  <Text style={[
                    styles.providerPhone,
                    isDark && { color: colors.subtext }
                  ]}>
                    <Ionicons name="call-outline" size={14} color={isDark ? colors.subtext : "#666"} />
                    {' '}{providerData.users.phone}
                  </Text>
                )}
              </View>
              <TouchableOpacity 
                style={[
                  styles.chatButton,
                  isDark && { backgroundColor: 'rgba(0, 123, 255, 0.1)' }
                ]}
                onPress={handleChat}
              >
                <Ionicons name="chatbubbles" size={20} color={isDark ? colors.tint : Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[
              styles.bookingDate,
              isDark && { color: colors.subtext }
            ]}>
              {formatDate(booking?.date || bookingData?.date, booking?.time || bookingData?.time)}
            </Text>
            
            {bookingData?.details && (
              <View style={[
                styles.addressContainer,
                isDark && { borderTopColor: colors.border }
              ]}>
                <Text style={[
                  styles.addressLabel,
                  isDark && { color: colors.subtext }
                ]}>Address</Text>
                <Text style={[
                  styles.addressText,
                  isDark && { color: colors.text }
                ]}>{bookingData.details}</Text>
                {bookingData.landmark && (
                  <>
                    <Text style={[
                      styles.landmarkLabel,
                      isDark && { color: colors.subtext }
                    ]}>Landmark</Text>
                    <Text style={[
                      styles.landmarkText,
                      isDark && { color: colors.text }
                    ]}>{bookingData.landmark}</Text>
                  </>
                )}
              </View>
            )}
          </View>

          <View style={[
            styles.section,
            isDark && { borderBottomColor: colors.border }
          ]}>
            <Text style={[
              styles.sectionTitle,
              isDark && { color: colors.text }
            ]}>Service Details</Text>
            <View style={[
              styles.locationContainer,
              isDark && { backgroundColor: colors.secondaryBackground }
            ]}>
              {getActivities(booking).map((activity, index) => (
                <View key={index} style={[
                  styles.serviceDetailItem,
                  isDark && { borderBottomColor: colors.border }
                ]}>
                  <Text style={[
                    styles.serviceName,
                    isDark && { color: colors.text }
                  ]}>{activity.name}</Text>
                  {booking.service_details?.find((detail: { service_name: string; details: string }) => 
                    detail.service_name === activity.name
                  )?.details ? (
                    <Text style={[
                      styles.serviceDetails,
                      isDark && { color: colors.subtext }
                    ]}>
                      {booking.service_details.find((detail: { service_name: string; details: string }) => 
                        detail.service_name === activity.name
                      )?.details}
                    </Text>
                  ) : (
                    <Text style={[
                      styles.noDetailsText,
                      isDark && { color: colors.inactive }
                    ]}>No additional details provided</Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View style={[
            styles.section,
            isDark && { borderBottomColor: colors.border }
          ]}>
            <Text style={[
              styles.sectionTitle,
              isDark && { color: colors.text }
            ]}>Payment details</Text>
            
            <View style={styles.paymentItem}>
              <Text style={[
                styles.paymentLabel,
                isDark && { color: colors.subtext }
              ]}>Workmanship fee (60%)</Text>
              <Text style={[
                styles.paymentValue,
                isDark && { color: colors.text }
              ]}>
                ₦{Math.floor((booking?.price || 0) * 0.6).toLocaleString()}
              </Text>
            </View>

            <View style={styles.paymentItem}>
              <Text style={[
                styles.paymentLabel,
                isDark && { color: colors.subtext }
              ]}>Tools and hardware (36.6%)</Text>
              <Text style={[
                styles.paymentValue,
                isDark && { color: colors.text }
              ]}>
                ₦{Math.floor((booking?.price || 0) * 0.366).toLocaleString()}
              </Text>
            </View>

            <View style={styles.paymentItem}>
              <Text style={[
                styles.paymentLabel,
                isDark && { color: colors.subtext }
              ]}>VAT (3.2%)</Text>
              <Text style={[
                styles.paymentValue,
                isDark && { color: colors.text }
              ]}>
                ₦{Math.floor((booking?.price || 0) * 0.032).toLocaleString()}
              </Text>
            </View>

           <View style={[
             styles.paymentItem, 
             styles.totalItem,
             isDark && { borderTopColor: colors.border }
           ]}>
              <View>
                <Text style={[
                  styles.totalLabel,
                  isDark && { color: colors.text }
                ]}>Total</Text>
                <Text style={[
                  styles.paymentPlan,
                  isDark && { color: colors.subtext }
                ]}>
                  {booking?.payment_plan === 'half' ? 
                    (booking?.first_payment_completed ? '(50% Final Payment)' : '(50% Initial Payment)') 
                    : '(Full Payment)'}
                </Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={[
                  styles.totalValue,
                  isDark && { color: colors.tint }
                ]}>₦{(booking?.price || 0).toLocaleString()}</Text>
                {booking?.payment_plan === 'half' && (
                  <Text style={[
                    styles.paymentAmountText,
                    isDark && { color: colors.tint }
                  ]}>
                    Pay Now: ₦{Math.floor((booking?.price || 0) / 2).toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={[
            styles.section,
            isDark && { borderBottomColor: colors.border }
          ]}>
            <Text style={[
              styles.sectionTitle,
              isDark && { color: colors.text }
            ]}>Payment</Text>
            {(bookingData?.status || booking?.status) === 'pending' ? (
              <View style={[
                styles.pendingContainer,
                isDark && { backgroundColor: 'rgba(0, 123, 255, 0.1)' }
              ]}>
                <MaterialIcons name="hourglass-empty" size={24} color={isDark ? colors.tint : Colors.primary} />
                <Text style={[
                  styles.pendingText,
                  isDark && { color: colors.tint }
                ]}>Waiting for provider to accept your request</Text>
              </View>
            ) : booking?.final_payment_completed || (booking?.first_payment_completed && booking?.payment_plan === 'full_upfront') ? (
              <View style={[
                styles.completedContainer,
                isDark && { backgroundColor: 'rgba(0, 200, 83, 0.1)' }
              ]}>
                <MaterialIcons name="check-circle" size={24} color={isDark ? '#00C853' : Colors.success} />
                <Text style={[
                  styles.completedText,
                  isDark && { color: '#00C853' }
                ]}>Payment Completed</Text>
              </View>
            ) : booking?.first_payment_completed && booking?.payment_plan === 'half' ? (
              <TouchableOpacity 
                style={styles.paymentButton}
                onPress={handlePayment}
                disabled={isProcessing || booking?.final_payment_completed}
              >
                <Text style={styles.buttonText}>
                  Proceed to Final Payment (₦{Math.floor((booking?.price || 0) / 2).toLocaleString()})
                </Text>
              </TouchableOpacity>
            ) : ((bookingData?.status || booking?.status) === 'accepted' || (bookingData?.status || booking?.status) === 'in_progress') ? (
              <TouchableOpacity 
                style={styles.paymentButton}
                onPress={handlePayment}
                disabled={isProcessing}
              >
                <Text style={styles.buttonText}>
                  {booking?.payment_plan === 'half' ? 
                    'Proceed to Initial Payment (₦' + Math.floor((booking?.price || 0) / 2).toLocaleString() + ')' :
                    'Proceed to Payment (₦' + (booking?.price || 0).toLocaleString() + ')'
                  }
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>
      ) : null}

      {isProcessing && (
        <View style={[
          styles.overlay,
          isDark && { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
        ]}>
          <View style={[
            styles.loadingBox,
            isDark && { backgroundColor: colors.cardBackground }
          ]}>
            <Animated.View style={{ opacity: fadeAnim }}>
              <Logo width={60} height={60} />
            </Animated.View>
            <Text style={[
              styles.loadingText,
              isDark && { color: colors.text }
            ]}>Processing payment...</Text>
          </View>
        </View>
      )}

      <PaymentConfirmationDialog
        visible={showConfirmation}
        amount={booking?.payment_plan === 'half' ? Math.floor((booking?.price || 0) / 2) : booking?.price || 0}
        isHalfPayment={booking?.payment_plan === 'half'}
        totalAmount={booking?.price || 0}
        isFirstPayment={!booking?.first_payment_completed}
        onConfirm={handlePaymentConfirm}
        onCancel={() => setShowConfirmation(false)}
      />
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: '16@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '16@ms',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '8@ms',
    paddingVertical: '4@ms',
  },
  activityNumber: {
    width: '24@ms',
    height: '24@ms',
    borderRadius: '12@ms',
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  activityNumberText: {
    color: '#fff',
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Bold',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
  activityDetails: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: '4@ms',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12@ms',
  },
  paymentPlan: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginTop: '2@ms',
  },
  paymentLabel: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  paymentValue: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  totalItem: {
    marginTop: '16@ms',
    paddingTop: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  totalValue: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  rateButton: {
    backgroundColor: Colors.primary,
    margin: '16@ms',
    padding: '16@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  rateButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '8@ms',
  },
  providerInfo: {
    flex: 1,
    marginRight: '12@ms',
  },
  providerName: {
    fontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '4@ms',
  },
  providerPhone: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '8@ms',
  },
  chatButton: {
    padding: '8@ms',
    borderRadius: '8@ms',
    backgroundColor: '#F0F9FF',
  },
  bookingDate: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  addressContainer: {
    marginTop: '16@ms',
    paddingTop: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addressLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#666',
    marginBottom: '4@ms',
  },
  addressText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
    marginBottom: '16@ms',
  },
  landmarkLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#666',
    marginBottom: '4@ms',
  },
  landmarkText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  },
  idBadgeContainer: {
    paddingHorizontal: '16@ms',
    paddingTop: '12@ms',
    paddingBottom: '4@ms',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#F0F9FF',
    paddingVertical: '6@ms',
    paddingHorizontal: '12@ms',
    borderRadius: '20@ms',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  idText: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginLeft: '4@ms',
  },
  idNumber: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
    marginLeft: '4@ms',
  },
  paymentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: '12@ms',
    borderRadius: '8@ms',
    gap: '8@ms',
  },
  paymentStatusText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.success,
  },
  paymentActionContainer: {
    gap: '16@ms',
  },
  walletInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: '12@ms',
    borderRadius: '8@ms',
  },
  walletLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  walletBalance: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  payButton: {
    backgroundColor: Colors.primary,
    padding: '16@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: '16@ms',
    borderRadius: '8@ms',
    gap: '12@ms',
  },
  pendingText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.primary,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: '16@ms',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16@s',
  },
  errorText: {
    fontSize: '16@s',
    color: Colors.error,
    textAlign: 'center',
    marginBottom: '16@vs',
    fontFamily: 'Urbanist-Medium',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: '24@s',
    paddingVertical: '12@vs',
    borderRadius: '8@s',
  },
  retryButtonText: {
    color: "red",
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  dialogCancelButton: {
    backgroundColor: '#F1F5F9',
  },
  paymentButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    marginHorizontal: '16@ms',
    marginBottom: '16@ms',
  },
  buttonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    padding: '16@ms',
    borderRadius: '8@ms',
    gap: '12@ms',
  },
  completedText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.success,
    flex: 1,
  },
  paymentAmountText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: Colors.primary,
    marginTop: '4@ms',
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: '16@ms',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dialogContent: {
    padding: '24@ms',
  },
  dialogTitle: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '16@ms',
    textAlign: 'center',
  },
  amountContainer: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '16@ms',
  },
  amountLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '4@ms',
  },
  amountValue: {
    fontSize: '28@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  infoContainer: {
    backgroundColor: '#FFF8E1',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '16@ms',
  },
  infoText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#B7791F',
    lineHeight: '20@ms',
  },
  confirmText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    textAlign: 'center',
    marginBottom: '24@ms',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: '12@ms',
  },
  button: {
    flex: 1,
    paddingVertical: '12@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#64748B',
  },
  confirmButtonText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
  },
  locationContainer: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
  },
  locationLabel: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#666',
    marginBottom: '4@ms',
  },
  locationText: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
    marginBottom: '12@ms',
  },
  serviceDetailItem: {
    marginBottom: '16@ms',
    paddingBottom: '16@ms',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  serviceName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '8@ms',
  },
  serviceDetails: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: '20@ms',
  },
  noDetailsText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#999',
    fontStyle: 'italic',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12@ms',
    padding: '20@ms',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '200@ms',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
}); 