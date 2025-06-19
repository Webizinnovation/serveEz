import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useColorScheme,
  Pressable,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { registerForPushNotifications, sendLoginNotification, sendFirstLoginNotification } from '../../services/pushNotifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight, useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import Logo from '../../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useUserStore } from '../../store/useUserStore';
import LoadingOverlay from '../../components/common/LoadingOverlay';


WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

interface SocialButtonProps {
  icon: string;
  text: string;
  onPress: () => void;
  loading: boolean;
  color: string;
  disabled: boolean;
}

const SocialButton = ({ 
  icon, 
  text, 
  onPress, 
  loading, 
  color, 
  disabled 
}: SocialButtonProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }]
    };
  });
  
  return (
    <Pressable
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 100 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 200 });
      }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.9 : 1,
        }
      ]}
    >
      <Animated.View
        style={[
          styles.socialButton,
          { backgroundColor: isDark ? '#2C2C2C' : '#E8E8E8' },
          animatedStyle
        ]}
      >
        <FontAwesome name={icon as any} size={20} color={color} />
        <Text
          style={[
            styles.socialButtonText,
            { color: isDark ? '#fff' : '#333' }
          ]}
        >
          {text}
        </Text>
        {loading && <View style={styles.socialLoader} />}
      </Animated.View>
    </Pressable>
  );
};

export default function Login() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Define theme colors based on system preference
  const colors = {
    background: isDark ? '#121212' : Colors.primary,
    cardBackground: isDark ? '#1E1E1E' : 'white',
    text: isDark ? 'white' : '#333',
    subtext: isDark ? 'rgba(255,255,255,0.6)' : '#666',
    tint: isDark ? '#F58220' : Colors.primary,
    secondaryBackground: isDark ? '#2C2C2C' : '#D9D9D9',
    border: isDark ? 'rgba(255,255,255,0.2)' : '#ccc',
  };
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);


  useEffect(() => {
    const checkSessionAndUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          if (userError && userError.code !== 'PGRST116') throw userError;
          
          if (userData && userData.role === role) {
            router.replace('/');
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      }
    };

    checkSessionAndUser();
  }, [role]);

  const handleLogin = async () => {
    try {
      if (!email || !password) {
        Toast.show({
          type: 'error',
          text1: 'Missing Information',
          text2: 'Please fill in all fields to log in.',
        });
        return;
      }

      setLoading(true);
      setShowLoadingOverlay(true);

      // First sign in with Supabase Auth
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          Toast.show({
            type: 'error',
            text1: 'Email Not Confirmed',
            text2: 'Please check your email to confirm your account.',
          });
        } else {
          Toast.show({ type: 'error', text1: 'Login Failed', text2: signInError.message });
        }
        setShowLoadingOverlay(false);
        return;
      }

      if (!signInData.user) {
        Toast.show({
          type: 'error',
          text1: 'Login Error',
          text2: 'An unexpected error occurred. Please try again.',
        });
        setShowLoadingOverlay(false);
        return;
      }

      // Get the user profile from the database to check verification status
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('phone_verified, phone, first_login_at')
        .eq('id', signInData.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        // Continue with sign-in even if we can't fetch the profile
      }

      // Log user data for debugging
      console.log('User signed in successfully:', {
        id: signInData.user.id,
        email: signInData.user.email,
        phone_verified: userProfile?.phone_verified,
        first_login_at: userProfile?.first_login_at
      });

      // Store the user in the UserStore
      try {
        await useUserStore.getState().fetchProfile();
      } catch (refreshError) {
        console.error('Error refreshing profile after login:', refreshError);
      }

      // Register for push notifications
      try {
        const { success, error: pushError, token } = await registerForPushNotifications(signInData.user.id);
        if (success) {
          console.log('Successfully registered for push notifications with token:', token);
          
          // Check if this is the first login
          const isFirstLogin = !userProfile?.first_login_at;
          
          if (isFirstLogin) {
            // Update the first_login_at timestamp
            const { error: updateError } = await supabase
              .from('users')
              .update({ first_login_at: new Date().toISOString() })
              .eq('id', signInData.user.id);
              
            if (updateError) {
              console.error('Error updating first login timestamp:', updateError);
            }
            
            // Send first-time login notification
            await sendFirstLoginNotification(email);
            console.log('Sent first-time login notification');
          } else {
            // Display regular login notification
            await sendLoginNotification(email);
          }
        } else {
          console.warn('Push notification registration failed:', pushError);
          // Continue with login even if push registration fails
        }
      } catch (pushError) {
        console.error('Error registering for push notifications:', pushError);
        // Continue with login even if push registration fails
      }

      // Check if phone verification is needed
      const needsPhoneVerification = !userProfile?.phone_verified && userProfile?.phone;
      
      if (needsPhoneVerification) {
        console.log('User needs phone verification, redirecting to verify-otp');
        
        // Navigate to the OTP verification screen
        router.navigate({
          pathname: '/(auth)/verify-otp',
          params: {
            phone: userProfile?.phone,
            userId: signInData.user.id
          }
        });
      } else {
        // User is fully verified, navigate to the main app
        Toast.show({
          type: 'success',
          text1: 'Login Successful',
          text2: 'Welcome back!',
        });
        router.replace('/');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Toast.show({ type: 'error', text1: 'Login Error', text2: error.message || 'An unexpected error occurred' });
    } finally {
      setLoading(false);
      // Keep the loading overlay a bit longer until navigation completes
      setTimeout(() => {
        setShowLoadingOverlay(false);
      }, 1000);
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handleGoogleSignIn = async () => {
    console.log('[handleGoogleSignIn] Starting Google sign-in process');
    setGoogleLoading(true);
    setShowLoadingOverlay(true);
    try {
      const redirectUrl = 'serveez://';
      
      console.log('[handleGoogleSignIn] Using redirect URL:', redirectUrl);
      
      console.log('[handleGoogleSignIn] Initiating supabase OAuth with Google');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('[handleGoogleSignIn] OAuth initiation error:', error);
        throw error;
      }

      if (data?.url) {
        console.log('[handleGoogleSignIn] Opening auth URL:', data.url);
        
        Toast.show({
          type: 'info',
          text1: 'Google Sign-In',
          text2: 'Please complete the sign-in process in the browser',
          position: 'top',
          topOffset: 40,
          visibilityTime: 3000,
        });
        
        console.log('[handleGoogleSignIn] Opening WebBrowser for authentication');
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );
        
        console.log('[handleGoogleSignIn] Auth result type:', result.type);

        if (result.type === 'success') {
          console.log('[handleGoogleSignIn] Authentication successful in browser');
          
          if (result.url && result.url.includes('#access_token=')) {
            console.log('[handleGoogleSignIn] Found access token in URL fragment');
            
            const fragmentStr = result.url.split('#')[1];
            const params = new URLSearchParams(fragmentStr);
            
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            
            if (accessToken) {
              console.log('[handleGoogleSignIn] Manually setting session with extracted tokens');
              
              const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              
              if (setSessionError) {
                console.error('[handleGoogleSignIn] Error setting session:', setSessionError);
                throw setSessionError;
              }
              
              console.log('[handleGoogleSignIn] Session set successfully:', sessionData.session ? 'Yes' : 'No');
              
              if (sessionData?.session?.user) {
                console.log('[handleGoogleSignIn] User ID from session in setSession handler:', sessionData.session.user.id);
                
                try {
                  console.log('[handleGoogleSignIn] Checking if user exists in database');
                  const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('role, phone_verified, phone')
                    .eq('id', sessionData.session.user.id)
                    .single();
                    
                  if (userError && userError.code === 'PGRST116') {
                    console.log('[handleGoogleSignIn] User not found in database');
                    console.log('[handleGoogleSignIn] Showing sign-up prompt');
                    
                    await supabase.auth.signOut();
                    
                    Toast.show({
                      type: 'error',
                      text1: 'Account Not Found',
                      text2: 'Please sign up first to create your account',
                      position: 'top',
                      visibilityTime: 4000,
                    });
                    
                    setTimeout(() => {
                      router.replace('/(auth)/signup');
                    }, 2000);
                    
                  } else if (userError) {
                    console.error('[handleGoogleSignIn] Error checking user existence:', userError);
                    throw userError;
                  } else {
                    console.log('[handleGoogleSignIn] User exists with role:', userData.role);
                    
                    // Step 1: Check if the role matches the selected role
                    const userDbRole = String(userData?.role || '').toLowerCase().trim();
                    const selectedRole = String(role || '').toLowerCase().trim();
                    
                    console.log(`[handleGoogleSignIn] Role verification: Database role [${userDbRole}], Selected role [${selectedRole}]`);
                    
                    if (!userDbRole) {
                      console.error('[handleGoogleSignIn] User role is missing in database');
                      await supabase.auth.signOut();
                      Toast.show({
                        type: 'error',
                        text1: 'Account Error',
                        text2: 'Your account has no assigned role. Please contact support.',
                        position: 'bottom',
                        visibilityTime: 4000,
                      });
                      return;
                    }
                    
                    if (userDbRole !== selectedRole) {
                      console.log(`[handleGoogleSignIn] Role mismatch detected: DB role [${userDbRole}] vs Selected role [${selectedRole}]`);
                      await supabase.auth.signOut();
                      Toast.show({
                        type: 'error',
                        text1: 'Access Denied',
                        text2: `This account is registered as a ${userData.role}. Please select the correct role.`,
                        position: 'bottom',
                        visibilityTime: 4000,
                      });
                      return;
                    }
                    
                    console.log('[handleGoogleSignIn] Role verification passed: User has the correct role');
                    
                    // Register for push notifications
                    try {
                      const { success, error: pushError } = await registerForPushNotifications(sessionData.session.user.id);
                      if (success) {
                        console.log('[handleGoogleSignIn] Successfully registered for push notifications');
                        
                        // Display a login notification with user's email
                        await sendLoginNotification(sessionData.session.user.email || 'your account');
                      } else {
                        console.warn('[handleGoogleSignIn] Push notification registration failed:', pushError);
                        // Continue with login even if push registration fails
                      }
                    } catch (pushError) {
                      console.error('[handleGoogleSignIn] Error registering for push notifications:', pushError);
                      // Continue with login even if push registration fails
                    }
                    
                    // Step 2: Check if phone verification is required
                    if (userData.phone_verified === false && userData.phone) {
                      console.log('[handleGoogleSignIn] Phone verification required');
                      Toast.show({
                        type: 'info',
                        text1: 'Phone Verification Required',
                        text2: 'Please verify your phone number to continue',
                        position: 'top',
                        visibilityTime: 3000,
                      });
                      
                      setTimeout(() => {
                        router.replace({
                          pathname: '/(auth)/verify-otp',
                          params: { 
                            phone: userData.phone,
                            userId: sessionData.session?.user?.id || ''
                          }
                        });
                      }, 1500);
                      return;
                    }
                    
                    // Step 3: Final verification before redirect
                    console.log('[handleGoogleSignIn] Performing final role verification before redirect');
                    const { data: latestUserData, error: latestUserError } = await supabase
                      .from('users')
                      .select('role')
                      .eq('id', sessionData.session?.user?.id || '')
                      .single();
                      
                    if (latestUserError) {
                      console.error('[handleGoogleSignIn] Error in final role verification:', latestUserError);
                      throw latestUserError;
                    }
                    
                    if (!latestUserData?.role) {
                      console.error('[handleGoogleSignIn] User role is missing in final verification');
                      await supabase.auth.signOut();
                      Toast.show({
                        type: 'error',
                        text1: 'Account Error',
                        text2: 'Your account has no assigned role. Please contact support.',
                        position: 'bottom',
                        visibilityTime: 4000,
                      });
                      return;
                    }
                    
                    // Normalize roles for final comparison
                    const finalDbRole = String(latestUserData.role).toLowerCase().trim();
                    
                    if (finalDbRole !== selectedRole) {
                      console.log(`[handleGoogleSignIn] FINAL role mismatch detected: DB role [${finalDbRole}] vs Selected role [${selectedRole}]`);
                      await supabase.auth.signOut();
                      Toast.show({
                        type: 'error',
                        text1: 'Access Denied',
                        text2: `Role verification failed. Please try again.`,
                        position: 'bottom',
                        visibilityTime: 4000,
                      });
                      return;
                    }
                    
                    console.log(`[handleGoogleSignIn] FINAL role verification successful: Confirmed as ${finalDbRole}`);
                    
                    // Step 4: Success message
                    Toast.show({
                      type: 'success',
                      text1: 'Welcome back!',
                      text2: 'Successfully logged in with Google',
                      visibilityTime: 3000,
                      position: 'top',
                      topOffset: 40,
                    });
                    
                    // FINALLY redirect to home page (this is the LAST step)
                    console.log('[handleGoogleSignIn] Login successful, redirecting as', role);
                    setTimeout(() => {
                      router.replace('/(tabs)');
                    }, 1500);
                  }
                } catch (userCheckError) {
                  console.error('[handleGoogleSignIn] Error during user check:', userCheckError);
                  Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'An error occurred during authentication. Please try again.',
                    position: 'bottom',
                    visibilityTime: 4000,
                  });
                }
              }
            }
          }
        } else if (result.type === 'dismiss') {
          Toast.show({
            type: 'info',
            text1: 'Sign-In Cancelled',
            text2: 'You cancelled the authentication process',
            position: 'top',
          });
        } else {
          Toast.show({
            type: 'error',
            text1: 'Sign-In Failed',
            text2: 'The authentication process failed',
            position: 'top',
          });
        }
      }
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      Toast.show({
        type: 'error',
        text1: 'Sign-In Failed',
        text2: error instanceof Error ? error.message : 'Failed to sign in with Google',
        position: 'top',
      });
    } finally {
      setGoogleLoading(false);
      setTimeout(() => {
        setShowLoadingOverlay(false);
      }, 1000);
    }
  };

  const toastConfig = {
    success: (props: any) => (
      <View style={{
        width: '90%',
        backgroundColor: isDark ? colors.cardBackground : '#fff',
        padding: 20,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#22C55E',
        shadowColor: isDark ? '#000' : '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.4 : 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <MaterialIcons name="check-circle" size={30} color="#22C55E" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 18,
            fontFamily: 'Urbanist-Bold',
            color: isDark ? colors.text : '#333',
            marginBottom: 4,
          }}>
            {props.text1}
          </Text>
          <Text style={{
            fontSize: 14,
            fontFamily: 'Urbanist-Regular',
            color: isDark ? colors.subtext : '#666',
          }}>
            {props.text2}
          </Text>
        </View>
      </View>
    ),
    info: (props: any) => (
      <View style={{
        width: '90%',
        backgroundColor: isDark ? colors.cardBackground : '#fff',
        padding: 20,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3B82F6',
        shadowColor: isDark ? '#000' : '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.4 : 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <MaterialIcons name="info" size={30} color="#3B82F6" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 18,
            fontFamily: 'Urbanist-Bold',
            color: isDark ? colors.text : '#333',
            marginBottom: 4,
          }}>
            {props.text1}
          </Text>
          <Text style={{
            fontSize: 14,
            fontFamily: 'Urbanist-Regular',
            color: isDark ? colors.subtext : '#666',
          }}>
            {props.text2}
          </Text>
        </View>
      </View>
    ),
    error: (props: any) => (
      <View style={{
        width: '90%',
        backgroundColor: isDark ? colors.cardBackground : '#fff',
        padding: 20,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#EF4444',
        shadowColor: isDark ? '#000' : '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: isDark ? 0.4 : 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <MaterialIcons name="error" size={30} color="#EF4444" />
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 18,
            fontFamily: 'Urbanist-Bold',
            color: isDark ? colors.text : '#333',
            marginBottom: 4,
          }}>{props.text1}</Text>
          <Text style={{ fontSize: 14, fontFamily: 'Urbanist-Regular', color: isDark ? colors.subtext : '#666' }}>{props.text2}</Text>
        </View>
      </View>
    ),
  };

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : Colors.primary }]}>
        <LoadingOverlay visible={showLoadingOverlay} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView>
            <StatusBar backgroundColor={isDark ? colors.background : Colors.primary} barStyle={isDark ? "light-content" : "light-content"} />

            <Link href="/onboarding/getStarted" style={styles.backLink}>
              <FontAwesome name="arrow-left" size={24} color={isDark ? colors.text : "white"} />
            </Link>

            <View style={[styles.header, { backgroundColor: isDark ? colors.background : Colors.primary }]}>
              <Animated.View 
                entering={FadeInDown.duration(800).springify()}
                style={styles.logoContainer}
              >
                <Logo width={111} height={111} style={[styles.logo, { backgroundColor: isDark ? colors.cardBackground : "white" }]} />
              </Animated.View>

              <Animated.View 
                entering={FadeInDown.delay(200).duration(800).springify()}
                style={styles.roleSelector}
              >
                <TouchableOpacity
                  style={[
                    styles.roleButton, 
                    role === 'user' && [
                      styles.activeRole, 
                      { backgroundColor: isDark ? colors.cardBackground : 'white' }
                    ]
                  ]}
                  onPress={() => setRole('user')}
                >
                  <Ionicons 
                    name="person" 
                    size={16} 
                    color={role === 'user' ? 
                      (isDark ? colors.tint : Colors.primary) : 
                      (isDark ? colors.text : 'white')} 
                    style={styles.roleIcon}
                  />
                  <Text 
                    style={[
                      styles.roleText, 
                      { color: isDark ? colors.text : 'white' },
                      role === 'user' && [
                        styles.activeRoleText, 
                        { color: isDark ? colors.tint : Colors.primary }
                      ]
                    ]}
                  >
                    User
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton, 
                    role === 'provider' && [
                      styles.activeRole, 
                      { backgroundColor: isDark ? colors.cardBackground : 'white' }
                    ]
                  ]}
                  onPress={() => setRole('provider')}
                >
                  <MaterialCommunityIcons 
                    name="briefcase-outline" 
                    size={16}
                    color={role === 'provider' ? 
                      (isDark ? colors.tint : Colors.primary) : 
                      (isDark ? colors.text : 'white')}
                    style={styles.roleIcon}
                  />
                  <Text 
                    style={[
                      styles.roleText, 
                      { color: isDark ? colors.text : 'white' },
                      role === 'provider' && [
                        styles.activeRoleText, 
                        { color: isDark ? colors.tint : Colors.primary }
                      ]
                    ]}
                  >
                    Provider
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <View style={[styles.formContainer, { 
                backgroundColor: isDark ? colors.cardBackground : 'white',
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30, 
              }]}>
                <Animated.Text
                  entering={FadeInDown.duration(800).springify()}
                  style={[styles.title, { color: isDark ? colors.text : Colors.primary }]}
                >
                  Welcome Back! 
                </Animated.Text>

                <Animated.View 
                  entering={FadeInRight.delay(300).duration(800).springify()}
                  style={styles.inputGroup}
                >
                  <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Email</Text>
                  <View style={[styles.inputContainer, { 
                    backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                    borderWidth: 1,
                    borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)'
                  }]}>
                    <MaterialCommunityIcons 
                      name="email-outline" 
                      size={20} 
                      color={isDark ? colors.subtext : "#666"} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                        color: isDark ? "white" : '#000'
                      }]}
                      placeholder="Enter your email"
                      placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "#666"}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                      inputAccessoryViewID="loginEmail"
                      disableFullscreenUI={true}
                      theme={{
                        colors: {
                          primary: isDark ? colors.tint : Colors.primary,
                          text: isDark ? "white" : '#000',
                          placeholder: isDark ? "rgba(255,255,255,0.6)" : '#666',
                          background: isDark ? colors.secondaryBackground : "#D9D9D9"
                        }
                      }}
                    />
                  </View>
                </Animated.View>

                <Animated.View 
                  entering={FadeInRight.delay(400).duration(800).springify()}
                  style={styles.inputGroup}
                >
                  <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Password</Text>
                  <View style={[styles.passwordContainer, { 
                    backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                    borderWidth: 1,
                    borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)'
                  }]}>
                    <Ionicons 
                      name="lock-closed-outline" 
                      size={20} 
                      color={isDark ? colors.subtext : "#666"} 
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                        color: isDark ? "white" : '#000'
                      }]}
                      placeholder="Enter your password"
                      placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "#666"}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!isPasswordVisible}
                      autoComplete="password"
                      textContentType="password"
                      inputAccessoryViewID="loginPassword"
                      disableFullscreenUI={true}
                      theme={{
                        colors: {
                          primary: isDark ? colors.tint : Colors.primary,
                          text: isDark ? "white" : '#000',
                          placeholder: isDark ? "rgba(255,255,255,0.6)" : '#666',
                          background: isDark ? colors.secondaryBackground : "#D9D9D9"
                        }
                      }}
                    />
                    <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeButton}>
                      <FontAwesome
                        name={isPasswordVisible ? "eye" : "eye-slash"}
                        size={18}
                        color={isDark ? colors.subtext : "#666"}
                      />
                    </TouchableOpacity>
                  </View>
                </Animated.View>

                <View style={styles.forgotPasswordContainer}>
                  <TouchableOpacity 
                    onPress={() => router.push('/(auth)/reset-password')}
                  >
                    <Text style={[styles.forgotPassword, { color: isDark ? colors.tint : Colors.primary }]}>
                      <MaterialIcons name="help-outline" size={14} color={isDark ? colors.tint : Colors.primary} /> Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>

                <Animated.View entering={FadeInDown.delay(500).duration(800).springify()}>
                  <Button 
                    mode="contained"
                    onPress={handleLogin}
                    loading={loading}
                    disabled={loading || googleLoading}
                    style={[styles.loginButton, { 
                      backgroundColor: isDark ? colors.tint : "#00456C",
                      borderRadius: 12,
                      elevation: 4
                    }]}
                    contentStyle={styles.buttonContent}
                    icon={() => <Ionicons name="log-in-outline" size={20} color="white" />}
                  >
                    {loading ? 'Logging in...' : `Login as ${role === 'user' ? 'User' : 'Provider'}`}
                  </Button>
                </Animated.View>
                    
                <Animated.View 
                  entering={FadeInDown.delay(600).duration(800).springify()}
                  style={styles.dividerContainer}
                >
                  <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E0' }]} />
                  <Text style={[styles.dividerText, { color: isDark ? colors.subtext : '#666' }]}>or continue with</Text>
                  <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E0E0E0' }]} />
                </Animated.View>

                <Animated.View 
                  entering={FadeInDown.delay(700).duration(800).springify()}
                  style={styles.socialLinks}
                >
                  <SocialButton
                    icon="google"
                    text="Google"
                    color="#DB4437"
                    onPress={handleGoogleSignIn}
                    loading={googleLoading}
                    disabled={loading || googleLoading}
                  />
                  
                  <SocialButton
                    icon="apple"
                    text="Apple"
                    color={isDark ? "#fff" : "#000000"}
                    onPress={() => {
                      Toast.show({
                        type: 'info',
                        text1: 'Coming Soon',
                        text2: 'Apple Sign-in will be available in the next update!',
                        position: 'bottom',
                        visibilityTime: 3000,
                      });
                    }}
                    loading={false}
                    disabled={loading || googleLoading}
                  />
                </Animated.View>

                <Link href="/(auth)/signup" asChild>
                  <TouchableOpacity style={styles.signupLink}>
                    <Text style={[styles.signupText, { color: isDark ? colors.subtext : '#666' }]}>
                      Don't have an account? <Text style={[styles.signupHighlight, { color: isDark ? colors.tint : Colors.primary }]}>Sign up</Text>
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Toast config={toastConfig} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  backLink: {
    margin: 20,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
    backgroundColor: Colors.primary,
  },
  logoContainer: {
    marginTop: 0,
    marginBottom: width > 400 ? 150 : 35,
  },
  logo: {
    width: width > 400 ? 160 : 140,
    height: width > 400 ? 160 : 140,
    backgroundColor: "white",
    borderRadius: 300,
    resizeMode: "contain",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 8,
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    padding: 5,
  },
  roleButton: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIcon: {
    marginRight: 6,
  },
  activeRole: {
    backgroundColor: 'white',
  },
  roleText: {
    color: 'white',
    fontSize: 16,
    fontFamily: "Urbanist-Bold",
  },
  activeRoleText: {
    color: Colors.primary,
  },
  formContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    width: '100%',
    height: height > 400 ? '100%' : '50%',
    flex: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontFamily: "Urbanist-Bold",
    marginBottom: 30,
    textAlign: 'left',
    color: Colors.primary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Urbanist-Medium",
    fontSize: 16,
    marginBottom: 10,
    marginLeft: 13,
    color: '#333',
  },
  inputContainer: {
    backgroundColor: "#D9D9D9",
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    marginLeft: 15,
  },
  input: {
    flex: 1,
    backgroundColor: "#D9D9D9",
    height: 50,
    paddingHorizontal: 10,
    fontSize: 16,
    fontFamily: "Urbanist-Medium",
    color: '#000',
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D9D9D9",
    borderRadius: 12,
    overflow: 'hidden',
  },
  eyeButton: {
    padding: 15,
  },
  loginButton: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: "#00456C",
    width: width > 400 ? 320 : 300,
    alignSelf: "center",
    fontFamily: "Urbanist-Medium",
    borderRadius: 12,
    elevation: 4,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#666',
    fontFamily: "Urbanist-Medium",
    fontSize: 14,
  },
  signupLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  signupText: {
    fontSize: 16,
    color: '#666',
    fontFamily: "Urbanist-Medium",
  },
  signupHighlight: {
    color: Colors.primary,
    fontFamily: "Urbanist-Bold",
  },
  forgotPasswordContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: -3,
    marginTop: -13,
  },
  forgotPassword: {
    textAlign: "right",
    color: Colors.primary,
    fontFamily: "Urbanist-MediumItalic",
    fontSize: 14,
    marginTop: 5,
  },
  socialLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    minWidth: width > 400 ? 140 : 120,
    height: 40,
    backgroundColor: '#E8E8E8',
  },
  socialButtonText: {
    fontFamily: "Urbanist-Medium",
    fontSize: 14,
    marginLeft: 8,
  },
  buttonContent: {
    padding: 10,
    fontFamily: "Urbanist-Medium",
  },
  socialLoader: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
}); 