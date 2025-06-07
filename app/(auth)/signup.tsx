import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  useColorScheme,
  useWindowDimensions
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Link, router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { FontAwesome, AntDesign, Ionicons, MaterialCommunityIcons, Feather, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight, useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import Logo from '../../assets/images/Svg/logo1.svg';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';
import { Alert } from 'react-native';
import TermiiXHRService from '../../services/termiiXHR';
import { registerForPushNotifications, sendSignupSuccessNotification } from '../../services/pushNotifications';
// import { useTheme } from '../../components/ThemeProvider';

const { width } = Dimensions.get('window');

// Simplified country and states list with proper typing
const countries: { [key: string]: string[] } = {
  Nigeria: [
    'Abuja',
    'Lagos',
    'Rivers',
  ],
};

// Define a type for service categories
type ServiceCategory = {
  name: string;
  subcategories?: string[]; // Optional subcategories
};

export default function Signup() {
  // const { colors, isDark } = useTheme();
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
  
  const [role, setRole] = useState('user');
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    service: '',
    price: '',
    address: '',
  });
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [states, setStates] = useState<string[]>([]);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  // Add error visibility state
  const [showErrors, setShowErrors] = useState(false);

  // Add password validation states
  const [passwordCriteria, setPasswordCriteria] = useState({
    hasLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    isValid: false
  });

  // Toast helper function
  const showToast = (type: string, message: string) => {
    Toast.show({
      type: type,
      text1: type === 'error' ? 'Error' : 'Success',
      text2: message,
      visibilityTime: 3000
    });
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
  ].sort((a, b) => a.name.localeCompare(b.name));

  // Function to check password criteria in real-time
  const checkPasswordCriteria = (password: string) => {
    setPasswordCriteria({
      hasLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      isValid: password.length >= 8 &&
              /[A-Z]/.test(password) &&
              /[a-z]/.test(password) &&
              /[0-9]/.test(password)
    });
  };

  // Update the password change handler to check criteria
  const handlePasswordChange = (text: string) => {
    setForm(prev => ({ ...prev, password: text }));
    checkPasswordCriteria(text);
  };

  const validateInput = () => {
    // Reset error visibility
    setShowErrors(false);

    if (form.username.trim() === '') {
      showToast('error', 'Username is required');
      return false;
    }

    if (form.email.trim() === '') {
      showToast('error', 'Email is required');
      return false;
    }

    if (!form.email.match(/^\S+@\S+\.\S+$/)) {
      showToast('error', 'Please enter a valid email');
      return false;
    }

    if (form.password.trim() === '') {
      showToast('error', 'Password is required');
      return false;
    }

    if (form.password.length < 8) {
      showToast('error', 'Password must be at least 8 characters');
      return false;
    }

    if (!passwordCriteria.isValid) {
      showToast('error', 'Password does not meet requirements');
      setShowErrors(true);
      return false;
    }

    if (form.password !== form.confirmPassword) {
      showToast('error', 'Passwords do not match');
      return false;
    }

    if (selectedCountry.trim() === '') {
      showToast('error', 'Country is required');
      return false;
    }

    if (selectedState.trim() === '') {
      showToast('error', 'State is required');
      return false;
    }

    if (role === 'provider') {
      if (form.service.trim() === '') {
        showToast('error', 'Service is required');
        return false;
      }

      if (form.price.trim() === '') {
        showToast('error', 'Price is required');
        return false;
      }

      if (isNaN(parseFloat(form.price)) || parseFloat(form.price) <= 0) {
        showToast('error', 'Please enter a valid price');
        return false;
      }
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateInput()) return;
    
    setLoading(true);
    
    try {
      // Prepare form data
      const userData = {
        role,
        username: form.username,
        email: form.email,
        password: form.password,
        country: selectedCountry,
        state: selectedState,
        ...(role === 'provider' && {
          service: form.service,
          price: form.price,
        }),
      };
      
      // First check if the email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', form.email)
        .maybeSingle();
        
      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "Results contain 0 rows" - not an error for our purposes
        console.error('Error checking for existing user:', checkError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'An error occurred while checking your account. Please try again.',
          visibilityTime: 3000
        });
        setLoading(false);
        return;
      }
      
      if (existingUser) {
        console.log('User with this email already exists');
        Toast.show({
          type: 'error',
          text1: 'Account Exists',
          text2: 'An account with this email already exists. Please use a different email or sign in.',
          visibilityTime: 4000
        });
        setLoading(false);
        return;
      }
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.username
          }
        }
      });

      if (signUpError) {
        // Check specifically for duplicate email error from Auth API
        if (signUpError.message?.includes('already registered') || 
            signUpError.message?.includes('already in use') || 
            signUpError.message?.includes('User already registered')) {
          Toast.show({
            type: 'error',
            text1: 'Account Exists',
            text2: 'An account with this email already exists. Please use a different email or sign in.',
            visibilityTime: 4000
          });
          setLoading(false);
          return;
        }
        
        console.error('Error signing up:', signUpError);
        Alert.alert('Error', signUpError.message);
        setLoading(false);
        return;
      }
      
      console.log('Signup successful');
      
      if (!authData?.user?.id) {
        console.error('No user ID returned from signup');
        Alert.alert('Error', 'Failed to create account. Please try again.');
        setLoading(false);
        return;
      }
      
      const userId = authData.user.id;
      
      // Insert user profile data
      const { error: profileError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            email: form.email,
            name: form.username,
            phone: form.phone,
            password: form.password,
            role,
            phone_verified: false,
            location: {
              country: selectedCountry,
              state: selectedState,
            },
          }
        ]);
      
      if (profileError) {
        console.error('Error inserting user profile:', profileError);
        
        // If we couldn't create the user profile, we should clean up the auth user
        // to avoid orphaned auth users without profiles
        try {
          // This requires admin rights, so we'll just sign out for now
          await supabase.auth.signOut();
          
          // Show an error message to the user
          Alert.alert(
            'Account Creation Failed', 
            'We could not complete your registration. This email may already be registered.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return; // Exit the function early
        } catch (cleanupError) {
          console.error('Error cleaning up after failed profile creation:', cleanupError);
        }
      }
      
      if (role === 'provider') {
        const { error: providerError } = await supabase
          .from('providers')
          .insert([
            {
              user_id: authData.user.id,
              services: [form.service],
              experience: 0,
              rating: 0,
              reviews_count: 0,
              availability: true,
              location: {
                city: selectedState,
                state: selectedCountry,
              },
              pricing: {
                [form.service]: parseFloat(form.price),
              },
            },
          ]);

        if (providerError) {
          console.error('Error creating provider profile:', providerError);
          // Continue with the flow - we still want to create the basic user account
        }
      }

    
      try {
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 24); 
        
        const { error: credError } = await supabase
          .from('temp_credentials')
          .insert({
            user_id: userId,
            email: form.email,
            password: form.password,
            expires_at: expirationTime.toISOString()
          });
        
        if (credError) {
          console.error('Error storing temporary credentials:', credError);
          // Continue with the flow - we don't want to block verification
          // just because temp credentials failed to store
        } else {
          console.log('Temporary credentials stored successfully');
        }
      } catch (credStoreError) {
        console.error('Exception storing temporary credentials:', credStoreError);
        // Continue with the flow
      }
      
      // Send OTP using the SMS API service
      console.log(`[handleSignup] Sending OTP to phone ${form.phone} for user ${userId}`);
      let otpReferenceId = null;
      
      try {
        // Add a small delay to ensure the user record is committed to the database
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Use the XMLHttpRequest implementation (matching the user's snippet)
        const otpResult = await TermiiXHRService.sendOTP(userId, form.phone);
        
        if (!otpResult.success) {
          console.error('[handleSignup] Error sending OTP via Termii API:', otpResult);
          throw new Error(`Failed to send verification code: ${otpResult.message || 'Unknown error'}`);
        } else {
          console.log('[handleSignup] SMS OTP sent successfully. Reference ID:', otpResult.referenceId);
          otpReferenceId = otpResult.referenceId;
        }
      } catch (otpError: any) {
        console.error('[handleSignup] Error sending OTP via Termii API:', otpError);
        
        // No fallback methods - just inform the user
        Alert.alert(
          'Verification Error', 
          'Account created, but we could not send a verification code. Please use the Resend button on the next screen to try again.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                // Navigate to verify-otp screen even though OTP sending failed
                // The user will need to click Resend there
                router.push({
                  pathname: "/(auth)/verify-otp",
                  params: { 
                    phone: form.phone, 
                    userId
                    // No referenceId since we don't have one
                  }
                });
              }
            }
          ]
        );
        return; // Don't continue to the finally block
      } finally {
        // Only navigate here if OTP was successfully sent
        if (otpReferenceId) {
          router.push({
            pathname: "/(auth)/verify-otp",
            params: { 
              phone: form.phone, 
              userId,
              referenceId: otpReferenceId 
            }
          });
        }
      }

      // Send signup success notification
      await sendSignupSuccessNotification(form.username);
    } catch (error: any) { // Catch errors from signup, profile insert, provider insert, OR the OTP call
      console.error('Error during signup process:', error);
      Alert.alert('Signup Error', error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
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
        marginTop: 50,
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
    error: (props: any) => (
      <View style={{
        width: '90%',
        backgroundColor: isDark ? colors.cardBackground : '#fff',
        padding: 20,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
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
        marginTop: 50,
      }}>
        <MaterialIcons name="error" size={30} color="#ef4444" />
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
  };

  // Function to toggle category expansion
  const toggleCategoryExpansion = (categoryName: string, e: any) => {
    e.stopPropagation(); // Prevent triggering the parent's onPress
    setExpandedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(name => name !== categoryName) 
        : [...prev, categoryName]
    );
  };

  return (
    <>
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.background : Colors.primary }]}>
      <ScrollView>
        <StatusBar backgroundColor={isDark ? colors.background : Colors.primary} barStyle="light-content" />
        <Link href="/(auth)/login" style={styles.backLink}>
          <AntDesign name="left" size={24} color={isDark ? colors.text : "white"} />
        </Link>

        <View style={[styles.header, { backgroundColor: isDark ? colors.background : Colors.primary }]}>
          <Animated.View
            entering={FadeInDown.duration(800).springify()}
            style={styles.logoContainer}
          >
            <Logo width={77} height={77} style={[styles.logo, { 
              backgroundColor: isDark ? colors.cardBackground : "white",
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 8,
            }]} />
            <Text style={[styles.description, { color: isDark ? colors.text : "white" }]}>
              Join 750+ professionals in providing services and meeting needs near you.
            </Text>
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
          </Animated.View>
        </View>

        <View style={[styles.formContainer, { 
          backgroundColor: isDark ? colors.cardBackground : '#fff',
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 5,
        }]}>
          <Animated.Text
            entering={FadeInDown.duration(800).springify()}
            style={[styles.title, { color: isDark ? colors.text : "rgba(0,0,0,0.78)" }]}
          >
            To create a {role} account, <Ionicons name="rocket" size={24} color={isDark ? "#F58220" : "#FF7675"} />
          </Animated.Text>
          <Text style={[styles.subtitle, { color: isDark ? colors.subtext : '#666' }]}>
            Fill in your accurate details below.
          </Text>

          {/* Common Fields */}
          <Animated.View 
            entering={FadeInRight.delay(200).duration(800).springify()}
            style={styles.inputGroup}
          >
            <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Username</Text>
            <View style={[styles.inputContainer, { 
              backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
              borderWidth: 1,
              borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)'
            }]}>
              <Ionicons 
                name="person-circle-outline" 
                size={20} 
                color={isDark ? colors.subtext : "#666"} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  color: isDark ? "white" : '#000'
                }]}
                placeholder="Enter your username"
                placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "gray"}
                value={form.username}
                onChangeText={(text) => setForm(prev => ({ ...prev, username: text }))}
                autoComplete="username"
                textContentType="username"
                inputAccessoryViewID="username"
                disableFullscreenUI={true}
              />
            </View>
          </Animated.View>

          {/* Email field */}
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
                placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "gray"}
                value={form.email}
                onChangeText={(text) => setForm(prev => ({ ...prev, email: text }))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                inputAccessoryViewID="email"
                disableFullscreenUI={true}
              />
            </View>
          </Animated.View>

          {/* Phone field */}
          <Animated.View 
            entering={FadeInRight.delay(400).duration(800).springify()}
            style={styles.inputGroup}
          >
            <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Phone</Text>
            <View style={[styles.inputContainer, { 
              backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
              borderWidth: 1,
              borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)'
            }]}>
              <Feather 
                name="phone" 
                size={20} 
                color={isDark ? colors.subtext : "#666"} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  color: isDark ? "white" : '#000'
                }]}
                placeholder="+234"
                placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "gray"}
                value={form.phone}
                onChangeText={(text) => setForm(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                inputAccessoryViewID="phone"
                disableFullscreenUI={true}
              />
            </View>
          </Animated.View>

          {/* Password field */}
          <Animated.View 
            entering={FadeInRight.delay(500).duration(800).springify()}
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
                style={[styles.input, styles.passwordInput, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  color: isDark ? "white" : '#000'
                }]}
                placeholder="Enter your password"
                placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "gray"}
                value={form.password}
                onChangeText={handlePasswordChange}
                secureTextEntry={!showPassword}
                autoComplete="password-new"
                textContentType="newPassword"
                inputAccessoryViewID="password"
                disableFullscreenUI={true}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <FontAwesome 
                  name={showPassword ? "eye" : "eye-slash"} 
                  size={20} 
                  color={isDark ? colors.subtext : "gray"} 
                />
              </TouchableOpacity>
            </View>

            {/* Password criteria indicators */}
            {form.password.length > 0 && (
              <View style={{marginTop: 15}}>
                <View style={{flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 20}}>
                    <View style={[
                      {
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 8,
                        backgroundColor: passwordCriteria.hasLength ? 
                          '#4CAF50' : isDark ? colors.secondaryBackground : '#D9D9D9'
                      }
                    ]}>
                      {passwordCriteria.hasLength && (
                        <AntDesign name="check" size={12} color="white" />
                      )}
                    </View>
                    <Text style={[
                      {
                        fontFamily: 'Urbanist-Medium',
                        fontSize: 14,
                        color: isDark ? colors.text : '#333'
                      }
                    ]}>8+ characters</Text>
                  </View>
                  
                  <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 20}}>
                    <View style={[
                      {
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 8,
                        backgroundColor: passwordCriteria.hasUppercase ? 
                          '#4CAF50' : isDark ? colors.secondaryBackground : '#D9D9D9'
                      }
                    ]}>
                      {passwordCriteria.hasUppercase && (
                        <AntDesign name="check" size={12} color="white" />
                      )}
                    </View>
                    <Text style={[
                      {
                        fontFamily: 'Urbanist-Medium',
                        fontSize: 14,
                        color: isDark ? colors.text : '#333'
                      }
                    ]}>Uppercase letter</Text>
                  </View>
                </View>

                <View style={{flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 20}}>
                    <View style={[
                      {
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 8,
                        backgroundColor: passwordCriteria.hasLowercase ? 
                          '#4CAF50' : isDark ? colors.secondaryBackground : '#D9D9D9'
                      }
                    ]}>
                      {passwordCriteria.hasLowercase && (
                        <AntDesign name="check" size={12} color="white" />
                      )}
                    </View>
                    <Text style={[
                      {
                        fontFamily: 'Urbanist-Medium',
                        fontSize: 14,
                        color: isDark ? colors.text : '#333'
                      }
                    ]}>Lowercase letter</Text>
                  </View>
                  
                  <View style={{flexDirection: 'row', alignItems: 'center', marginRight: 20}}>
                    <View style={[
                      {
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 8,
                        backgroundColor: passwordCriteria.hasNumber ? 
                          '#4CAF50' : isDark ? colors.secondaryBackground : '#D9D9D9'
                      }
                    ]}>
                      {passwordCriteria.hasNumber && (
                        <AntDesign name="check" size={12} color="white" />
                      )}
                    </View>
                    <Text style={[
                      {
                        fontFamily: 'Urbanist-Medium',
                        fontSize: 14,
                        color: isDark ? colors.text : '#333'
                      }
                    ]}>Number</Text>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Confirm Password field */}
          <Animated.View 
            entering={FadeInRight.delay(600).duration(800).springify()}
            style={styles.inputGroup}
          >
            <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Confirm Password</Text>
            <View style={[styles.passwordContainer, { 
              backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
              borderWidth: 1,
              borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)'
            }]}>
              <Ionicons 
                name="shield-checkmark-outline" 
                size={20} 
                color={isDark ? colors.subtext : "#666"} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.passwordInput, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  color: isDark ? "white" : '#000'
                }]}
                placeholder="Confirm your password"
                placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "gray"}
                value={form.confirmPassword}
                onChangeText={(text) => setForm(prev => ({ ...prev, confirmPassword: text }))}
                secureTextEntry={!showConfirmPassword}
                autoComplete="password-new"
                textContentType="newPassword"
                inputAccessoryViewID="confirmPassword"
                disableFullscreenUI={true}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <FontAwesome 
                  name={showConfirmPassword ? "eye" : "eye-slash"} 
                  size={20} 
                  color={isDark ? colors.subtext : "gray"} 
                />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Country field */}
          <Animated.View 
            entering={FadeInRight.delay(700).duration(800).springify()}
            style={styles.inputGroup}
          >
            <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Country</Text>
            <TouchableOpacity 
              style={[styles.inputContainer, { 
                backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                borderWidth: 1,
                borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)',
              }]} 
              onPress={() => setShowCountryModal(true)}
            >
              <Ionicons 
                name="earth" 
                size={20} 
                color={isDark ? colors.subtext : "#666"} 
                style={styles.inputIcon}
              />
              <Text style={[styles.pickerText, { color: isDark ? "white" : '#666' }]}>
                {selectedCountry || "Select a country"}
              </Text>
              <AntDesign name="down" size={16} color={isDark ? colors.subtext : "#666"} style={{ position: 'absolute', right: 15 }} />
            </TouchableOpacity>
          </Animated.View>

          {selectedCountry && (
            <Animated.View 
              entering={FadeInRight.delay(800).duration(800).springify()}
              style={styles.inputGroup}
            >
              <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>State</Text>
              <TouchableOpacity 
                style={[styles.inputContainer, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  borderWidth: 1,
                  borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)',
                }]} 
                onPress={() => setShowStateModal(true)}
              >
                <Ionicons 
                  name="location-outline" 
                  size={20} 
                  color={isDark ? colors.subtext : "#666"} 
                  style={styles.inputIcon}
                />
                <Text style={[styles.pickerText, { color: isDark ? "white" : '#666' }]}>
                  {selectedState || "Select a state"}
                </Text>
                <AntDesign name="down" size={16} color={isDark ? colors.subtext : "#666"} style={{ position: 'absolute', right: 15 }} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Provider-specific Fields */}
          {role === 'provider' && (
            <>
              <Animated.View 
                entering={FadeInRight.delay(1100).duration(800).springify()}
                style={styles.inputGroup}
              >
                <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Service</Text>
                <TouchableOpacity 
                  style={[styles.inputContainer, { 
                    backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                    borderWidth: 1,
                    borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)'
                  }]} 
                  onPress={() => setShowServiceModal(true)}
                >
                  <MaterialCommunityIcons 
                    name="briefcase-outline" 
                    size={20} 
                    color={isDark ? colors.subtext : "#666"} 
                    style={styles.inputIcon}
                  />
                  <Text style={[styles.pickerText, { color: isDark ? "white" : '#666' }]}>
                    {form.service || "Select a service"}
                  </Text>
                  <AntDesign name="down" size={16} color={isDark ? colors.subtext : "#666"} style={{ position: 'absolute', right: 15 }} />
                </TouchableOpacity>
              </Animated.View>

              <Modal
                visible={showServiceModal}
                animationType="slide"
                transparent={true}
              >
                <View style={[styles.modalView, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]}>
                  <View style={[styles.modalContent, { 
                    backgroundColor: isDark ? colors.cardBackground : 'white',
                    borderRadius: 16,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                  }]}>
                    <View style={[styles.modalHeader, { 
                      backgroundColor: isDark ? colors.cardBackground : 'white',
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? colors.border : '#eee',
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16
                    }]}>
                      <Text style={[styles.modalTitle, { color: isDark ? colors.text : '#333' }]}>
                        <MaterialCommunityIcons name="briefcase-outline" size={20} color={isDark ? colors.tint : '#00456C'} /> Select a Service
                      </Text>
                      <TouchableOpacity onPress={() => setShowServiceModal(false)}>
                        <AntDesign name="close" size={24} color={isDark ? colors.text : '#333'} />
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.searchContainer, { backgroundColor: isDark ? colors.cardBackground : 'white' }]}>
                      <View style={[styles.searchInputContainer, {
                        backgroundColor: isDark ? colors.secondaryBackground : '#f5f5f5',
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 10,
                        margin: 10
                      }]}>
                        <Feather name="search" size={18} color={isDark ? colors.subtext : "#999"} style={{ marginRight: 8 }} />
                        <TextInput
                          style={[styles.searchInput, { 
                            backgroundColor: 'transparent',
                            color: isDark ? "white" : '#333',
                            flex: 1,
                            height: 40,
                            paddingRight: 10
                          }]}
                          placeholder="Search services..."
                          placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "#999"}
                          value={serviceSearch}
                          onChangeText={setServiceSearch}
                        />
                        {serviceSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setServiceSearch('')}>
                            <AntDesign name="close" size={16} color={isDark ? colors.subtext : "#999"} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <ScrollView style={[styles.modalScrollView, { backgroundColor: isDark ? colors.cardBackground : 'white' }]}>
                      {services
                        .filter((serviceItem: ServiceCategory) => 
                          serviceItem.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                          (serviceItem.subcategories?.some((sub: string) => 
                            sub.toLowerCase().includes(serviceSearch.toLowerCase())) ?? false)
                        )
                        .map((serviceItem: ServiceCategory) => (
                          <View key={serviceItem.name}>
                            <TouchableOpacity
                              style={[styles.modalItem, { 
                                backgroundColor: isDark ? colors.cardBackground : 'white',
                                borderBottomColor: isDark ? colors.border : '#eee',
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }]}
                              onPress={() => {
                                setForm(prev => ({ ...prev, service: serviceItem.name }));
                                setShowServiceModal(false);
                                setServiceSearch('');
                              }}
                            >
                              <Text style={[styles.modalItemText, { color: isDark ? colors.text : '#333' }]}>
                                {serviceItem.name}
                              </Text>
                              {serviceItem.subcategories && serviceItem.subcategories.length > 0 && (
                                <TouchableOpacity
                                  onPress={(e) => toggleCategoryExpansion(serviceItem.name, e)}
                                  style={{ padding: 8 }}
                                >
                                  <AntDesign 
                                    name={expandedCategories.includes(serviceItem.name) ? "down" : "right"} 
                                    size={16} 
                                    color={isDark ? colors.subtext : "#999"} 
                                  />
                                </TouchableOpacity>
                              )}
                            </TouchableOpacity>
                            
                            {serviceItem.subcategories && expandedCategories.includes(serviceItem.name) &&
                              serviceItem.subcategories.filter((subcat: string) => 
                                !serviceSearch || subcat.toLowerCase().includes(serviceSearch.toLowerCase())
                              ).map((subcategory: string, index: number) => (
                                <TouchableOpacity
                                  key={`${serviceItem.name}-${subcategory}-${index}`}
                                  style={[styles.modalSubItem, { 
                                    backgroundColor: isDark ? colors.secondaryBackground : '#f8f9fa',
                                    borderBottomColor: isDark ? colors.border : '#eee' 
                                  }]}
                                  onPress={() => {
                                    setForm(prev => ({ ...prev, service: `${serviceItem.name} - ${subcategory}` }));
                                    setShowServiceModal(false);
                                    setServiceSearch('');
                                  }}
                                >
                                  <Text style={[styles.modalSubItemText, { color: isDark ? colors.subtext : '#666' }]}>
                                    • {subcategory}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                          </View>
                        ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <Animated.View 
                entering={FadeInRight.delay(1200).duration(800).springify()}
                style={styles.inputGroup}
              >
                <Text style={[styles.inputLabel, { color: isDark ? colors.text : '#333' }]}>Price</Text>
                <View style={[styles.inputContainer, { 
                  backgroundColor: isDark ? colors.secondaryBackground : "#D9D9D9",
                  borderWidth: 1,
                  borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.05)'
                }]}>
                  <FontAwesome 
                    name="dollar" 
                    size={20} 
                    color={isDark ? colors.subtext : "#666"} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: isDark ? "white" : '#000' }]}
                    placeholder="Enter your price"
                    placeholderTextColor={isDark ? "rgba(255,255,255,0.6)" : "gray"}
                    value={form.price}
                    onChangeText={(text) => setForm(prev => ({ ...prev, price: text }))}
                    keyboardType="numeric"
                    inputAccessoryViewID="priceInput"
                  />
                </View>
              </Animated.View>
            </>
          )}

          {/* Button section */}
          <Animated.View entering={FadeInDown.delay(1000).duration(800).springify()}>
            <Button 
              mode="contained"
              onPress={handleSignup}
              loading={loading}
              disabled={loading}
              style={[styles.signupButton, { 
                backgroundColor: isDark ? colors.tint : "#00456C",
                borderRadius: 12,
                elevation: 4
              }]}
              contentStyle={styles.buttonContent}
              icon={() => <Ionicons name="person-add-outline" size={20} color="white" />}
            >
              {loading ? 'Creating Account...' : `Sign up as ${role === 'user' ? 'User' : 'Provider'}`}
            </Button>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(1100).duration(800).springify()}>
            <Text style={[styles.loginText, { color: isDark ? colors.subtext : '#666' }]}>
              Already have an account?{' '}
              <Text 
                style={[styles.loginLink, { color: isDark ? colors.tint : '#00456C' }]} 
                onPress={() => router.push("/login")}
              >
                Login <MaterialCommunityIcons name="login" size={16} color={isDark ? colors.tint : '#00456C'} />
              </Text>
            </Text>
          </Animated.View>

          {/* Country Modal */}
          <Modal
            visible={showCountryModal}
            animationType="slide"
            transparent={true}
          >
            <View style={[styles.modalView, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]}>
              <View style={[styles.modalContent, { 
                backgroundColor: isDark ? colors.cardBackground : 'white',
                borderRadius: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }]}>
                <View style={[styles.modalHeader, { 
                  backgroundColor: isDark ? colors.cardBackground : 'white',
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? colors.border : '#eee',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                }]}>
                  <Text style={[styles.modalTitle, { color: isDark ? colors.text : '#333' }]}>
                    <Ionicons name="earth" size={20} color={isDark ? colors.tint : '#00456C'} /> Select Country
                  </Text>
                  <TouchableOpacity onPress={() => setShowCountryModal(false)}>
                    <AntDesign name="close" size={24} color={isDark ? colors.text : '#333'} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={[styles.modalScrollView, { backgroundColor: isDark ? colors.cardBackground : 'white' }]}>
                  {Object.keys(countries).map((country) => (
                    <TouchableOpacity
                      key={country}
                      style={[styles.modalItem, { 
                        backgroundColor: selectedCountry === country ? 
                          (isDark ? colors.secondaryBackground : '#f0f0f0') : 
                          (isDark ? colors.cardBackground : 'white'),
                        borderBottomColor: isDark ? colors.border : '#eee'
                      }]}
                      onPress={() => {
                        setSelectedCountry(country);
                        setStates(countries[country]);
                        setSelectedState('');
                        setShowCountryModal(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, { color: isDark ? colors.text : '#333' }]}>{country}</Text>
                      {selectedCountry === country && (
                        <Ionicons name="checkmark-circle" size={20} color={isDark ? colors.tint : '#00456C'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* State Modal */}
          <Modal
            visible={showStateModal}
            animationType="slide"
            transparent={true}
          >
            <View style={[styles.modalView, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]}>
              <View style={[styles.modalContent, { 
                backgroundColor: isDark ? colors.cardBackground : 'white',
                borderRadius: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }]}>
                <View style={[styles.modalHeader, { 
                  backgroundColor: isDark ? colors.cardBackground : 'white',
                  borderBottomWidth: 1,
                  borderBottomColor: isDark ? colors.border : '#eee',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                }]}>
                  <Text style={[styles.modalTitle, { color: isDark ? colors.text : '#333' }]}>
                    <Ionicons name="location" size={20} color={isDark ? colors.tint : '#00456C'} /> Select State
                  </Text>
                  <TouchableOpacity onPress={() => setShowStateModal(false)}>
                    <AntDesign name="close" size={24} color={isDark ? colors.text : '#333'} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={[styles.modalScrollView, { backgroundColor: isDark ? colors.cardBackground : 'white' }]}>
                  {states.map((state) => (
                    <TouchableOpacity
                      key={state}
                      style={[styles.modalItem, { 
                        backgroundColor: selectedState === state ? 
                          (isDark ? colors.secondaryBackground : '#f0f0f0') : 
                          (isDark ? colors.cardBackground : 'white'),
                        borderBottomColor: isDark ? colors.border : '#eee'
                      }]}
                      onPress={() => {
                        setSelectedState(state);
                        setShowStateModal(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, { color: isDark ? colors.text : '#333' }]}>{state}</Text>
                      {selectedState === state && (
                        <Ionicons name="checkmark-circle" size={20} color={isDark ? colors.tint : '#00456C'} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
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
  title: {
    color: "rgba(0,0,0,0.78)",
    fontSize: 28,
    fontFamily: "Urbanist-Bold",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Urbanist-Light",
    fontSize: 17,
    color: '#666',
    marginBottom: 20,
  },
  backLink: {
    marginTop: 20,
    marginLeft: 20,
  },
  header: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingVertical: 20,
  },
  logoContainer: {
    marginTop: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  logo: {
    backgroundColor: "white",
    borderRadius: 300,
    resizeMode: "contain",
    marginBottom: 20,
  },
  description: {
    textAlign: 'center',
    fontSize: 18,
    color: '#666',
    fontFamily: "Urbanist-Regular",
    marginHorizontal: 40,
    marginBottom: 10,
  },
  roleSelector: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
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
  roleText: {
    color: 'white',
    fontSize: 16,
    fontFamily: "Urbanist-Bold",
  },
  activeRole: {
    backgroundColor: 'white',
  },
  activeRoleText: {
    color: Colors.primary,
  },
  formContainer: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontFamily: "Urbanist-Medium",
    fontSize: 16,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    overflow: 'hidden',
    height: 50,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 5,
    fontFamily: "Urbanist-Regular",
    fontSize: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    overflow: 'hidden',
    height: 50,
    paddingHorizontal: 10,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 5,
  },
  eyeButton: {
    padding: 10,
  },
  pickerText: {
    flex: 1,
    fontFamily: "Urbanist-Regular",
    fontSize: 16,
    paddingVertical: 12,
  },
  signupButton: {
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 15,
    paddingVertical: 4,
  },
  buttonContent: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: {
    fontFamily: "Urbanist-Regular",
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10
  },
  loginLink: {
    fontFamily: "Urbanist-Bold",
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Urbanist-Bold",
  },
  modalScrollView: {
    maxHeight: '80%',
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: 16,
    fontFamily: "Urbanist-Regular",
  },
  modalSubItem: {
    padding: 15,
    paddingLeft: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalSubItemText: {
    fontSize: 16,
    fontFamily: "Urbanist-Regular",
    color: '#666',
  },
  searchContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInputContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    margin: 10
  },
  searchInput: {
    backgroundColor: 'transparent',
    color: '#333',
    flex: 1,
    height: 40,
    paddingRight: 10,
    fontFamily: "Urbanist-Regular",
    fontSize: 16,
  },
}); 