import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../services/supabase';
import { useUserStore } from '../../../store/useUserStore';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../../constants/Colors';
import { useTheme } from '../../../components/ThemeProvider';
import Toast from 'react-native-toast-message';
import { sendBookingStatusNotification } from '../../../utils/notifications';

type BookingData = {
  status: string;
  payment_plan: string;
  first_payment_completed: boolean;
  user_id: string;
  provider_id: string;
};

export default function CancelBookingPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  
  const [cancelReason, setCancelReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check booking eligibility for cancellation
  useEffect(() => {
    const checkBooking = async () => {
      try {
        if (!id) {
          setError('Booking ID not provided');
          setInitialLoading(false);
          return;
        }

        const { data, error: bookingError } = await supabase
          .from('bookings')
          .select('status, payment_plan, first_payment_completed, user_id, provider_id')
          .eq('id', id)
          .single() as { data: BookingData | null; error: any };

        if (bookingError) {
          console.error('Error fetching booking:', bookingError);
          setError('Failed to fetch booking information');
          setInitialLoading(false);
          return;
        }

        // Save booking data
        setBookingData(data);

        // Check if booking belongs to the user
        if (data?.user_id !== profile?.id) {
          setError('You do not have permission to cancel this booking');
          setInitialLoading(false);
          return;
        }

        // Check if it's a half payment that's already been paid
        if (data?.payment_plan === 'half' && data?.first_payment_completed) {
          setError('You cannot cancel this booking after making the initial payment');
          setInitialLoading(false);
          return;
        }

        // Check if the booking is not in progress
        if (data?.status !== 'in_progress') {
          setError('This booking cannot be cancelled');
          setInitialLoading(false);
          return;
        }

        setInitialLoading(false);
      } catch (err) {
        console.error('Error checking booking:', err);
        setError('An error occurred while checking booking information');
        setInitialLoading(false);
      }
    };

    if (profile?.id) {
      checkBooking();
    }
  }, [id, profile?.id]);

  const handleCancel = useCallback(async () => {
    if (!cancelReason.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide a reason for cancellation.',
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    if (!id || !bookingData) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          cancelled_at: new Date().toISOString(),
          cancelled_by: profile?.id,
          cancellation_reason: cancelReason.trim()
        })
        .eq('id', id);

      if (error) throw error;

      if (bookingData?.provider_id) {
        try {
          await sendBookingStatusNotification(
            bookingData.provider_id,
            id,
            'cancelled',
            'Booking Cancelled'
          );
        } catch (notifError) {
          console.error('Failed to send notification, but booking was cancelled:', notifError);
        }
      }
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Booking has been cancelled successfully',
        position: 'top',
        visibilityTime: 3000,
      });

      // Navigate back to the services screen after a short delay
      setTimeout(() => {
        // Navigate user to the booking tab
        router.replace('/(tabs)/services');
      }, 1000);
    } catch (err) {
      console.error('Error:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to cancel booking. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  }, [cancelReason, id, bookingData, profile?.id, router]);

  // Handle back button
  const handleGoBack = () => {
    router.back();
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : '#f9f9f9' }]}>
        <Stack.Screen options={{ 
          title: 'Cancel Booking',
          headerShown: true,
          headerBackVisible: true,
          headerStyle: { 
            backgroundColor: isDark ? colors.cardBackground : '#fff' 
          },
          headerTintColor: isDark ? colors.text : '#000', 
        }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? colors.tint : Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : '#f9f9f9' }]}>
        <Stack.Screen options={{ 
          title: 'Cancel Booking',
          headerShown: true,
          headerBackVisible: true,
          headerStyle: { 
            backgroundColor: isDark ? colors.cardBackground : '#fff' 
          },
          headerTintColor: isDark ? colors.text : '#000', 
        }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={isDark ? colors.error : '#ff4b55'} />
          <Text style={[styles.errorText, { color: isDark ? colors.text : '#333' }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: isDark ? colors.cardBackground : '#fff' }]}
            onPress={handleGoBack}
          >
            <Text style={[styles.backButtonText, { color: isDark ? colors.tint : Colors.primary }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : '#f9f9f9' }]}>
      <Stack.Screen options={{ 
        title: 'Cancel Booking',
        headerShown: true,
        headerBackVisible: true,
        headerStyle: { 
          backgroundColor: isDark ? colors.cardBackground : '#fff' 
        },
        headerTintColor: isDark ? colors.text : '#000', 
      }} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[
            styles.content,
            { 
              backgroundColor: isDark ? colors.cardBackground : '#fff',
              borderColor: isDark ? colors.border : '#eee'
            }
          ]}>
            <View style={[
              styles.header,
              { borderBottomColor: isDark ? colors.border : '#EFEFEF' }
            ]}>
              <Text style={[
                styles.title,
                { color: isDark ? colors.text : '#000' }
              ]}>Cancel Booking</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? colors.text : '#333' }
                ]}>Why are you cancelling this booking?</Text>
                <TextInput
                  style={[
                    styles.reasonInput,
                    { 
                      backgroundColor: isDark ? colors.secondaryBackground : "#F9F9F9",
                      borderColor: isDark ? colors.border : '#DDD',
                      color: isDark ? colors.text : '#000'
                    }
                  ]}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder="Enter your reason here..."
                  placeholderTextColor={isDark ? colors.inactive : "#666"}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  autoFocus={false} 
                  returnKeyType="done"
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { opacity: loading ? 0.7 : 1 }]}
                  onPress={handleCancel}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.backButton, 
                    { backgroundColor: isDark ? 'rgba(51,51,51,0.1)' : '#f5f5f5' }
                  ]}
                  onPress={handleGoBack}
                  disabled={loading}
                >
                  <Text style={[
                    styles.backButtonText,
                    { color: isDark ? colors.text : '#555' }
                  ]}>Go Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scrollContent: {
    flexGrow: 1,
    padding: '16@s',
    justifyContent: 'center',
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: '16@s',
    padding: '20@s',
    borderWidth: 1,
    borderColor: '#eee',
    width: '100%',
    maxWidth: '500@s',
    alignSelf: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '20@s',
    paddingBottom: '10@s',
    borderBottomWidth: '1@s',
    borderBottomColor: '#EFEFEF',
  },
  title: {
    fontSize: '20@s',
    fontFamily: 'Urbanist-Bold',
    color: '#000',
    textAlign: 'center',
  },
  form: {
    gap: '16@s',
  },
  inputContainer: {
    gap: '8@s',
  },
  inputLabel: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  reasonInput: {
    width: '100%',
    minHeight: '120@s',
    borderWidth: '1@s',
    borderColor: '#DDD',
    borderRadius: '8@s',
    paddingHorizontal: '12@s',
    paddingVertical: '12@s',
    backgroundColor: '#F9F9F9',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Regular',
    marginBottom: '20@s',
    textAlignVertical: 'top',
  },
  buttonContainer: {
    gap: '12@s',
  },
  cancelButton: {
    backgroundColor: '#FF4B55',
    paddingVertical: '12@s',
    borderRadius: '8@s',
    alignItems: 'center',
    marginTop: '8@s',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
  backButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: '12@s',
    borderRadius: '8@s',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
    color: '#555',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20@s',
  },
  errorText: {
    fontSize: '18@s',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
    textAlign: 'center',
    marginTop: '12@s',
    marginBottom: '24@s',
  }
}); 