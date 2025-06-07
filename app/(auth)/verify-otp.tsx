import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { AntDesign } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Logo from '../../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';
import { createClient } from '@supabase/supabase-js';
import TermiiXHRService from '../../services/termiiXHR';
import { useUserStore } from '../../store/useUserStore';

const { width, height } = Dimensions.get('window');

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function VerifyOTP() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const phone = params.phone as string;
  const userId = params.userId as string;
  const referenceId = params.referenceId as string;
  const colorScheme = useColorScheme();
  const { refreshProfile } = useUserStore();
  
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  
  // References for text inputs to enable auto-focus on next input
  const inputRefs = useRef<Array<TextInput | null>>([null, null, null, null]);

  // Get theme colors
  const primaryColor = colorScheme === 'dark' ? Colors.dark.tint : Colors.light.tint;
  const backgroundColor = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;
  const textColor = colorScheme === 'dark' ? Colors.dark.text : Colors.light.text;
  const cardColor = colorScheme === 'dark' ? Colors.dark.cardBackground : Colors.light.cardBackground;

  // Validate parameters when component mounts
  useEffect(() => {
    if (!phone) {
      console.error('[VerifyOTP] Missing phone number in parameters');
      setPhoneError('Missing phone number. Please go back and try again.');
    } else if (!userId) {
      console.error('[VerifyOTP] Missing user ID in parameters');
      setPhoneError('Missing user information. Please go back and try again.');
    } else {
      console.log(`[VerifyOTP] Initialized with phone: ${phone}, userId: ${userId}, referenceId: ${referenceId || 'None'}`);
      // Start the countdown immediately
      setResendDisabled(true); 
      setCountdown(60); // Start with a 60 second countdown
    }
  }, [phone, userId, referenceId]);

  // Start countdown for resend button
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    
    if (countdown > 0 && resendDisabled) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setResendDisabled(false);
    }
    
    return () => clearInterval(interval);
  }, [countdown, resendDisabled]);

  // Add a function to find and set the latest reference ID
  const findLatestReferenceId = async () => {
    if (referenceId) return referenceId; // Already have it
    
    console.log('[VerifyOTP] Attempting to find latest reference ID for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('otp_references')
        .select('reference_id, created_at')
        .eq('user_id', userId)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (error) {
        console.error('[VerifyOTP] Error finding reference ID:', error);
        return null;
      }
      
      if (data && data.length > 0) {
        const foundReferenceId = data[0].reference_id;
        console.log('[VerifyOTP] Found reference ID:', foundReferenceId);
        
        // Update router params with the found reference ID
        router.setParams({ referenceId: foundReferenceId });
        
        return foundReferenceId;
      }
      
      console.log('[VerifyOTP] No reference ID found in database');
      return null;
    } catch (error) {
      console.error('[VerifyOTP] Error in findLatestReferenceId:', error);
      return null;
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    // Only allow numbers
    if (!/^\d*$/.test(text)) return;
    
    // Update OTP array
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    
    // Auto-focus next input if current input is filled
    if (text.length === 1 && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all 4 digits are entered
    if (text.length === 1 && index === 3) {
      // Check if all digits are filled
      const allFilled = newOtp.every(digit => digit.length === 1);
      if (allFilled) {
        // Wait a moment to show the filled state before submitting
        setTimeout(() => {
          verifyOTPCode();
        }, 300);
      }
    }
  };

  const handleBackspace = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      // Focus previous input when backspace is pressed on an empty input
      inputRefs.current[index - 1]?.focus();
    }
  };

  const resendOTP = async () => {
    setLoading(true);
    try {
      console.log(`[VerifyOTP] Resending OTP to ${phone} for user ${userId}`);
      
      const otpResult = await TermiiXHRService.sendOTP(userId, phone);
      
      if (!otpResult.success) {
        throw new Error('Failed to send OTP');
      }
      
      // Update the reference ID in the component state
      if (otpResult.referenceId) {
        console.log(`[VerifyOTP] New reference ID received: ${otpResult.referenceId}`);
        
        // Update URL params to include the new reference ID without refreshing the page
        router.setParams({ 
          referenceId: otpResult.referenceId 
        });
        
        // Store in Supabase directly if database operations failed earlier
        try {
          console.log('[VerifyOTP] Ensuring reference ID is stored in database');
          
          // Check if this reference already exists
          const { data: existingRef, error: checkError } = await supabase
            .from('otp_references')
            .select('id')
            .eq('reference_id', otpResult.referenceId)
            .eq('user_id', userId)
            .single();
            
          if (checkError || !existingRef) {
            console.log('[VerifyOTP] Reference not found in database, storing it now');
            
            // Store the reference in the database
            const { error: insertError } = await supabase
              .from('otp_references')
              .insert({
                user_id: userId,
                phone_number: phone,
                reference_id: otpResult.referenceId,
                code: '', // We don't have the code from the API
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                created_at: new Date().toISOString(),
                verified: false
              });
              
            if (insertError) {
              console.error('[VerifyOTP] Error storing reference ID:', insertError);
            } else {
              console.log('[VerifyOTP] Successfully stored reference ID in database');
            }
          } else {
            console.log('[VerifyOTP] Reference ID already exists in database');
          }
        } catch (dbError) {
          console.error('[VerifyOTP] Error updating database with reference ID:', dbError);
          // Continue anyway since we've updated the reference ID in URL params
        }
      }
      
      // Reset countdown and disable resend button
      setCountdown(30);
      setResendDisabled(true);
      
      // Clear the OTP input fields
      setOtp(['', '', '', '']);
      
      // Focus on the first input field
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 500);
      
      Toast.show({
        type: 'success',
        text1: 'OTP Resent!',
        text2: 'A new verification code has been sent to your phone number.',
        position: 'top',
        visibilityTime: 4000,
      });
    } catch (error: any) {
      console.error('[VerifyOTP] Error resending OTP:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to resend verification code. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Update the verifyOTPCode function with sign-in logic
  const verifyOTPCode = async () => {
    // Join OTP array to a single string
    const otpCode = otp.join('');
    
    setLoading(true);
    
    try {
      // First check if phone is already verified to avoid unnecessary API calls
      const { data: userData, error: userCheckError } = await supabase
        .from('users')
        .select('phone_verified')
        .eq('id', userId)
        .single();
        
      if (!userCheckError && userData && userData.phone_verified === true) {
        console.log('[VerifyOTP] Phone already verified for user:', userId);
        
        // Show success message
        Toast.show({
          type: 'success',
          text1: 'Already Verified',
          text2: 'Your phone number is already verified. Redirecting...',
          position: 'top',
          visibilityTime: 3000,
        });
        
        // Redirect to app after a short delay
        setTimeout(() => router.push('/'), 1500);
        setLoading(false);
        return;
      }
      
      // Try to find the latest reference ID if not provided
      const verificationReferenceId = referenceId || await findLatestReferenceId();
      
      // Ensure we have a reference ID
      if (!verificationReferenceId) {
        console.error('[VerifyOTP] No reference ID found for verification');
        Toast.show({
          type: 'error',
          text1: 'Verification Error',
          text2: 'No valid reference ID found. Please request a new code.',
          position: 'top',
          visibilityTime: 4000,
        });
        setLoading(false);
        return;
      }
      
      console.log(`[VerifyOTP] Verifying OTP code for user ${userId} with code ${otpCode} and reference ${verificationReferenceId}`);
      
      // Use TermiiXHRService to verify the OTP code with the Termii API
      const verified = await TermiiXHRService.verifyOTP(otpCode, userId, verificationReferenceId);
      
      if (!verified) {
        console.log('[VerifyOTP] Verification failed');
        Toast.show({
          type: 'error',
          text1: 'Incorrect Verification Code',
          text2: 'The code you entered is incorrect or has expired. Please try again or request a new code.',
          position: 'top',
          visibilityTime: 5000,
        });
        setLoading(false);
        return;
      }
      
      console.log('[VerifyOTP] Verification successful');
      
      // Update the user's profile to set phone_verified to true
      try {
        console.log('[VerifyOTP] Updating phone_verified status for user:', userId);
        
        // Make sure we're authenticated before trying to update
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          console.warn('[VerifyOTP] No active session found, attempting to get session');
          
          // If no active session but we have credentials, try to sign in first
          const credentials = await getUserCredentials(userId);
          if (credentials) {
            console.log('[VerifyOTP] Found credentials, attempting to sign in');
            await supabase.auth.signInWithPassword({
              email: credentials.email,
              password: credentials.password
            });
          } else {
            console.error('[VerifyOTP] No credentials found and no active session');
          }
        }
        
        // Direct update of phone_verified field - this works because of our RLS policy
        const { data: updateResult, error: updateError } = await supabase
          .from('users')
          .update({ 
            phone_verified: true,
            updated_at: new Date().toISOString() 
          })
          .eq('id', userId)
          .select('phone_verified');
        
        if (updateError) {
          console.error('[VerifyOTP] Error updating phone verification status:', updateError);
          
          // Try using database functions as backup approach
          console.log('[VerifyOTP] Trying database function as backup...');
          const { data: verifyResult, error: verifyError } = await supabase
            .rpc('verify_user_phone', {
              user_id: userId
            });
            
          if (verifyError) {
            console.error('[VerifyOTP] Error with backup verification method:', verifyError);
          } else {
            console.log('[VerifyOTP] Backup verification result:', verifyResult);
          }
        } else {
          console.log('[VerifyOTP] Phone verification update successful:', updateResult);
        }
        
        // Always refresh the profile to ensure UI is updated correctly
        try {
          console.log('[VerifyOTP] Refreshing user profile');
          await refreshProfile();
          
          // Double-check that the profile was updated properly
          const { data: updatedProfile } = await supabase
            .from('users')
            .select('phone_verified')
            .eq('id', userId)
            .single();
            
          console.log('[VerifyOTP] Updated phone_verified status in database:', updatedProfile?.phone_verified);
          
          // Force another profile refresh after a short delay
          setTimeout(async () => {
            await refreshProfile();
          }, 500);
        } catch (refreshError) {
          console.error('[VerifyOTP] Error refreshing profile:', refreshError);
        }
        
        // Update reference in the otp_references table if it exists
        if (verificationReferenceId) {
          const { error: refUpdateError } = await supabase
            .from('otp_references')
            .update({ verified: true })
            .eq('reference_id', verificationReferenceId);
            
          if (refUpdateError) {
            console.error('[VerifyOTP] Error updating reference:', refUpdateError);
          }
        }
      } catch (updateError) {
        console.error('[VerifyOTP] Exception updating phone_verified status:', updateError);
        // Continue with the flow even if this update fails
      }
      
      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Verification Successful',
        text2: 'Your phone number has been verified successfully!',
        position: 'top',
        visibilityTime: 3000,
      });
      
      // Try to get the user's credentials for auto-login
      const credentials = await getUserCredentials(userId);
      
      if (credentials) {
        // Attempt to sign in automatically
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password
        });
        
        if (signInError) {
          console.error('[VerifyOTP] Auto-login failed:', signInError);
          
          // Check for email not confirmed error
          if (signInError.message && signInError.message.includes("Email not confirmed")) {
            Toast.show({
              type: 'info',
              text1: 'Email Verification Required',
              text2: 'Please check your email and confirm your account before signing in.',
              position: 'top',
              visibilityTime: 5000,
            });
          }
          
          // Fallback to login page if auto-login fails
          setTimeout(() => router.push('/(auth)/login'), 1500);
        } else {
          // Successful sign-in, try refreshing profile once more
          await refreshProfile();
          
          // Navigate to main app
          setTimeout(() => router.push('/'), 1500);
        }
      } else {
        // No credentials found, redirect to login
        setTimeout(() => router.push('/(auth)/login'), 1500);
      }
    } catch (error: any) {
      console.error('[VerifyOTP] Error during verification:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Error',
        text2: error.message || 'An unexpected error occurred. Please try again.',
        position: 'top',
        visibilityTime: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Retrieves stored user credentials from the temp_credentials table
   * @param userId - The user ID to look up credentials for
   * @returns The stored credentials or null if not found
   */
  const getUserCredentials = async (userId: string): Promise<{ email: string, password: string } | null> => {
    console.log('[VerifyOTP] Retrieving stored credentials for user:', userId);
    try {
      // Check if the table exists and has valid schema (without using count(*))
      const { data: tableCheck, error: tableError } = await supabase
        .from('temp_credentials')
        .select('user_id')
        .limit(1);
        
      if (tableError) {
        console.error('[VerifyOTP] Error checking temp_credentials table:', tableError);
        return null;
      }
      
      // Get all credentials for this user
      const { data: userCreds, error: credsError } = await supabase
        .from('temp_credentials')
        .select('email, password, created_at')
        .eq('user_id', userId);
        
      if (credsError) {
        console.error('[VerifyOTP] Error retrieving credentials:', credsError);
        return null;
      }
      
      console.log(`[VerifyOTP] Found ${userCreds?.length || 0} credential records for user ${userId}`);
      
      if (!userCreds || userCreds.length === 0) {
        console.log('[VerifyOTP] No credentials found for user');
        return null;
      }
      
      // Sort by created_at date (most recent first) if there are multiple records
      const sortedCreds = userCreds.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      console.log('[VerifyOTP] Retrieved stored credentials successfully');
      return {
        email: sortedCreds[0].email,
        password: sortedCreds[0].password
      };
    } catch (err) {
      console.error('[VerifyOTP] Unexpected error retrieving credentials:', err);
      return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: primaryColor }]}>
      <StatusBar backgroundColor={primaryColor} barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <AntDesign name="arrowleft" size={24} color={colorScheme === 'dark' ? "white" : "white"} />
      </TouchableOpacity>
      
      <View style={styles.header}>
        <View style={[styles.logoContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'white' }]}>
          <Logo width={60} height={60} style={styles.logo} />
        </View>
        <Animated.Text
          entering={FadeInDown.duration(800).springify()}
          style={[styles.title, { color: colorScheme === 'dark' ? "white" : "white" }]}
        >
          Verify Your Phone
        </Animated.Text>
        <Text style={[styles.subtitle, { color: colorScheme === 'dark' ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.8)" }]}>
          {phoneError ? 
            phoneError : 
            `We've sent a 4-digit verification code to ${phone || 'your phone'}`
          }
        </Text>
      </View>
      
      {phoneError ? (
        <View style={[styles.errorContainer, { backgroundColor: cardColor }]}>
          <TouchableOpacity
            style={[styles.goBackButton, { backgroundColor: primaryColor }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.goBackButtonText, { color: colorScheme === 'dark' ? "white" : "white" }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.formContainer, { backgroundColor: cardColor }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpInput,
                    { 
                      color: textColor,
                      backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
                      borderColor: digit ? primaryColor : colorScheme === 'dark' ? '#444' : '#ddd'
                    },
                    digit ? styles.otpInputFilled : {}
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleBackspace(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={index === 0}
                />
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.resendButton, resendDisabled && styles.resendButtonDisabled]} 
              onPress={resendOTP}
              disabled={resendDisabled}
            >
              <Text style={[
                styles.resendText, 
                { color: resendDisabled ? (colorScheme === 'dark' ? '#666' : '#999') : primaryColor }
              ]}>
                {resendDisabled ? `Resend code (${countdown}s)` : 'Resend code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.verifyButton, { backgroundColor: primaryColor }, loading && styles.loadingButton]}
              onPress={verifyOTPCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  header: {
    height: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  logo: {
    marginBottom: 0,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Urbanist-Bold',
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    marginBottom: 5,
    textAlign: 'center',
    maxWidth: '80%',
  },
  formContainer: {
    height: '50%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingTop: 40,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    alignSelf: 'center',
    marginBottom: 40,
  },
  otpInput: {
    width: 55,
    height: 65,
    borderWidth: 1.5,
    borderRadius: 16,
    fontSize: 24,
    fontFamily: 'Urbanist-Bold',
    textAlign: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  otpInputFilled: {
    backgroundColor: 'rgba(0, 132, 255, 0.05)',
  },
  resendButton: {
    alignSelf: 'center',
    marginBottom: 30,
    padding: 12,
    borderRadius: 8,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: 15,
    fontFamily: 'Urbanist-Medium',
  },
  verifyButton: {
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  loadingButton: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 17,
    fontFamily: 'Urbanist-Bold',
  },
  errorContainer: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  goBackButton: {
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  goBackButtonText: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
  },
}); 