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

export default function ReportServicePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>('this provider');
  const [serviceName, setServiceName] = useState<string>('this service');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check booking and load data
  useEffect(() => {
    const fetchData = async () => {
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
        
        if (data.service) {
          setServiceName(data.service);
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
          setError('You do not have permission to report this service');
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
      fetchData();
    }
  }, [id, profile?.id]);

  const handleSubmitReport = useCallback(async () => {
    if (!reportReason.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide a reason for your report.',
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    if (!reportDescription.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide details for your report.',
        position: 'top',
        visibilityTime: 4000,
      });
      return;
    }

    if (!id || !bookingData?.provider_id) return;

    try {
      setIsSubmitting(true);
      
      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select('user_id')
        .eq('id', bookingData.provider_id)
        .single();

      if (providerError) throw providerError;

      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: profile?.id,
          reported_id: providerData.user_id,
          booking_id: id,
          report_type: 'service_report',
          reason: reportReason.trim(),
          description: reportDescription.trim(),
          service_name: bookingData.service,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Try to send notification but don't let it block the report process if it fails
      try {
        // Send notification to admin about new report
        await sendBookingStatusNotification(
          bookingData.provider_id,
          id,
          'cancelled',
          'Service Reported'
        );
      } catch (notifError) {
        // Log notification error but don't break the report flow
        console.error('Failed to send report notification:', notifError);
        // Continue with the success flow regardless of notification error
      }
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Your service report has been submitted successfully',
        position: 'top',
        visibilityTime: 3000,
      });

      // Navigate back to the services screen after a short delay
      setTimeout(() => {
        router.replace('/(tabs)/services');
      }, 1000);
    } catch (err) {
      console.error('Error submitting report:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit your report. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [reportReason, reportDescription, id, bookingData?.provider_id, bookingData?.service, profile?.id, router]);

  // Handle back button
  const handleGoBack = () => {
    router.back();
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : '#f9f9f9' }]}>
        <Stack.Screen options={{ 
          title: 'Report Service',
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
          title: 'Report Service',
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
        title: 'Report Service',
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
              ]}>Report Service Issue</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.serviceContainer}>
                <Text style={[
                  styles.serviceText,
                  { color: isDark ? colors.inactive : '#666' }
                ]}>
                  Service: {serviceName || 'N/A'}
                </Text>
                <Text style={[
                  styles.providerText,
                  { color: isDark ? colors.inactive : '#666' }
                ]}>
                  Provider: {providerName || 'N/A'}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? colors.text : '#333' }
                ]}>Reason for Report</Text>
                <TextInput
                  style={[
                    styles.reasonInput,
                    { 
                      backgroundColor: isDark ? colors.secondaryBackground : "#F9F9F9",
                      borderColor: isDark ? colors.border : '#DDD',
                      color: isDark ? colors.text : '#000'
                    }
                  ]}
                  value={reportReason}
                  onChangeText={setReportReason}
                  placeholder="Enter reason for report"
                  placeholderTextColor={isDark ? colors.inactive : "#666"}
                  editable={!isSubmitting}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? colors.text : '#333' }
                ]}>Description</Text>
                <TextInput
                  style={[
                    styles.descriptionInput,
                    { 
                      backgroundColor: isDark ? colors.secondaryBackground : "#F9F9F9",
                      borderColor: isDark ? colors.border : '#DDD',
                      color: isDark ? colors.text : '#000'
                    }
                  ]}
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  placeholder="Provide more details about the service issue"
                  placeholderTextColor={isDark ? colors.inactive : "#666"}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isSubmitting}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[styles.submitButton, { opacity: isSubmitting ? 0.7 : 1 }]}
                  onPress={handleSubmitReport}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Report</Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.backButton, 
                    { backgroundColor: isDark ? 'rgba(51,51,51,0.1)' : '#f5f5f5' }
                  ]}
                  onPress={handleGoBack}
                  disabled={isSubmitting}
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
  serviceContainer: {
    alignItems: 'center',
    marginBottom: '8@s',
  },
  serviceText: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '4@s',
  },
  providerText: {
    fontSize: '14@s',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
  },
  inputContainer: {
    gap: '8@s',
    marginBottom: '16@s',
  },
  inputLabel: {
    fontSize: '16@s',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  reasonInput: {
    width: '100%',
    height: '48@s',
    borderWidth: '1@s',
    borderColor: '#DDD',
    borderRadius: '8@s',
    paddingHorizontal: '12@s',
    backgroundColor: '#F9F9F9',
    fontSize: '16@s',
    fontFamily: 'Urbanist-Regular',
  },
  descriptionInput: {
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
    backgroundColor: '#FF4B55',
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
  }
}); 