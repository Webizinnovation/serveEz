import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
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
  id: string;
  provider_id: string;
  service: string;
  provider?: {
    users?: {
      name?: string;
    };
  };
};

export default function ReviewBookingPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('this provider');

  // Check booking eligibility for review
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
          .select(`
            id,
            provider_id,
            service,
            provider:providers!bookings_provider_id_fkey (
              users:user_id (
                name
              )
            )
          `)
          .eq('id', id)
          .single();

        if (bookingError) {
          console.error('Error fetching booking:', bookingError);
          setError('Failed to fetch booking information');
          setInitialLoading(false);
          return;
        }

        // Save booking data
        const bookingInfo: BookingData = {
          id: data.id,
          provider_id: data.provider_id,
          service: data.service
        };
        
        // Use any type to handle complex nested data
        const providerData: any = data.provider;
        
        if (providerData && providerData.users && providerData.users.name) {
          setProviderName(providerData.users.name);
        }
        
        setBookingData(bookingInfo);

        // Check if booking belongs to the user
        const { data: bookingUser, error: userError } = await supabase
          .from('bookings')
          .select('user_id')
          .eq('id', id)
          .single();

        if (userError) {
          console.error('Error fetching booking user:', userError);
          setError('Failed to verify booking ownership');
          setInitialLoading(false);
          return;
        }

        if (bookingUser?.user_id !== profile?.id) {
          setError('You do not have permission to review this booking');
          setInitialLoading(false);
          return;
        }

        // Check if user has already reviewed this booking
        const { data: existingReviews, error: reviewError } = await supabase
          .from('reviews')
          .select('id')
          .eq('booking_id', id)
          .eq('user_id', profile?.id);

        if (reviewError) {
          console.error('Error checking existing reviews:', reviewError);
        } else if (existingReviews && existingReviews.length > 0) {
          setError('You have already reviewed this booking');
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

  const handleSubmitReview = useCallback(async () => {
    if (reviewRating === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select a rating for your review.',
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    if (!reviewComment.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide a comment for your review.',
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    if (!id || !bookingData?.provider_id) return;

    try {
      setLoading(true);
      
      // Get the provider's user ID first - this is crucial
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', bookingData.provider_id)
        .single();

      if (providerError) throw providerError;

      // Now use the user_id from the provider record as the provider_id in reviews
      const { error } = await supabase
        .from('reviews')
        .insert({
          user_id: profile?.id,
          provider_id: providerData.user_id, // Use user_id from provider, not provider_id directly
          booking_id: id,
          rating: reviewRating,
          comment: reviewComment.trim(),
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Mark booking as reviewed and attempt to send notification
      try {
        // Update the booking to mark as reviewed
        await supabase
          .from('bookings')
          .update({ reviewed: true })
          .eq('id', id);

        // Try to send notification but don't let it block the review process if it fails
        try {
          await sendBookingStatusNotification(
            bookingData.provider_id,
            id,
            'completed',
            'New Review Received'
          );
        } catch (notifError) {
          // Log notification error but don't break the review flow
          console.error('Failed to send review notification:', notifError);
          // Continue with the success flow regardless of notification error
        }
      } catch (updateError) {
        console.error('Error updating booking as reviewed:', updateError);
        // Even if marking as reviewed fails, consider the review submission successful
      }
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Your review has been submitted successfully',
        position: 'top',
        visibilityTime: 3000,
      });

      // Navigate back to the services screen after a short delay
      setTimeout(() => {
        router.replace('/(tabs)/services');
      }, 1000);
    } catch (err) {
      console.error('Error submitting review:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit your review. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  }, [reviewRating, reviewComment, id, bookingData?.provider_id, profile?.id, router]);

  // Handle back button
  const handleGoBack = () => {
    router.back();
  };

  // Render star rating
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setReviewRating(i)}
          disabled={loading}
          style={styles.starContainer}
        >
          <Ionicons
            name={i <= reviewRating ? 'star' : 'star-outline'}
            size={36}
            color={i <= reviewRating ? '#FFD700' : isDark ? colors.inactive : '#DDD'}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : '#f9f9f9' }]}>
        <Stack.Screen options={{ 
          title: 'Review Booking',
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
          title: 'Review Booking',
          headerShown: true,
          headerBackVisible: true,
          headerStyle: { 
            backgroundColor: isDark ? colors.cardBackground : '#fff' 
          },
          headerTintColor: isDark ? colors.text : '#000', 
        }} />
        <View style={styles.errorContainer}>
          {error === 'You have already reviewed this booking' ? (
            <>
              <Ionicons name="checkmark-circle" size={80} color={isDark ? colors.tint : '#4CD964'} />
              <Text style={[styles.errorTitle, { color: isDark ? colors.text : '#333' }]}>
                Review Already Submitted
              </Text>
              <Text style={[styles.errorText, { color: isDark ? colors.text : '#333' }]}>
                You've already shared your feedback for this booking. Thank you for your contribution!
              </Text>
              <View style={styles.errorButtonContainer}>
                <TouchableOpacity 
                  style={[styles.errorButton, { backgroundColor: isDark ? colors.cardBackground : '#fff' }]}
                  onPress={() => router.replace('/(tabs)/services')}
                >
                  <Text style={[styles.errorButtonText, { color: isDark ? colors.tint : Colors.primary }]}>
                    Go to My Bookings
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.errorButton, { backgroundColor: isDark ? colors.tint : Colors.primary }]}
                  onPress={handleGoBack}
                >
                  <Text style={[styles.errorButtonText, { color: '#fff' }]}>
                    Go Back
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
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
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : '#f9f9f9' }]}>
      <Stack.Screen options={{ 
        title: 'Review Booking',
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
              ]}>Review {providerName}</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.ratingContainer}>
                {renderStars()}
              </View>
              
              <View style={styles.serviceContainer}>
                <Text style={[
                  styles.serviceText,
                  { color: isDark ? colors.inactive : '#666' }
                ]}>
                  Service: {bookingData?.service || 'N/A'}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? colors.text : '#333' }
                ]}>Your Review</Text>
                <TextInput
                  style={[
                    styles.reviewInput,
                    { 
                      backgroundColor: isDark ? colors.secondaryBackground : "#F9F9F9",
                      borderColor: isDark ? colors.border : '#DDD',
                      color: isDark ? colors.text : '#000'
                    }
                  ]}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Write your review here..."
                  placeholderTextColor={isDark ? colors.inactive : "#666"}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  autoFocus={false} 
                  returnKeyType="done"
                  editable={!loading}
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.submitButton, { opacity: loading ? 0.7 : 1 }]}
                  onPress={handleSubmitReview}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Review</Text>
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
                  ]}>Cancel</Text>
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
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: '8@s',
    marginBottom: '16@s',
  },
  starContainer: {
    padding: '4@s',
  },
  serviceContainer: {
    alignItems: 'center',
    marginBottom: '8@s',
  },
  serviceText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  inputContainer: {
    gap: '8@s',
  },
  inputLabel: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  reviewInput: {
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
  submitButton: {
    backgroundColor: '#007BFF',
    paddingVertical: '12@s',
    borderRadius: '8@s',
    alignItems: 'center',
    marginTop: '8@s',
  },
  submitButtonText: {
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
  },
  errorTitle: {
    fontSize: '22@s',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    textAlign: 'center',
    marginTop: '16@s',
    marginBottom: '8@s',
  },
  errorButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: '12@s',
    marginTop: '24@s',
  },
  errorButton: {
    paddingVertical: '12@s',
    paddingHorizontal: '20@s',
    borderRadius: '8@s',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '140@s',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  errorButtonText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Bold',
  },
}); 