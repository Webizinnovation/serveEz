import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, Dimensions, Alert, Animated, FlatList, useWindowDimensions, Keyboard, InteractionManager, EmitterSubscription, BackHandler, UIManager, LogBox } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import { ScaledSheet } from 'react-native-size-matters';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../services/supabase';
import { useUserStore } from '../../store/useUserStore';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Provider, ServiceItem } from '../../types/index';
import { MaterialIcons } from '@expo/vector-icons';
import { moderateScale, verticalScale, scale } from 'react-native-size-matters';
import { Checkbox } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { ServiceItem as ServiceItemComponent } from '../../components/ServiceItem';
import { useTheme } from '../../components/ThemeProvider';
import Logo from '../../assets/images/Svg/logo1.svg';
import { sendBookingSuccessNotification } from '../../services/pushNotifications';
import { sendBookingNotificationToAdmin } from '../../services/emailService';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Ignore specific warnings that are related to the white screen issue
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Animated: `useNativeDriver` was not specified',
  'ViewPropTypes will be removed from React Native'
]);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type ToastPosition = 'top' | 'bottom' | 'center';

interface BookingDetails {
  service: string;
  date: string;
  time: string;
  address: string;
  landmark?: string;
  payment_plan: string;
  amount: number;
  services: ServiceItem[];
  total_price: number;
}

const DEFAULT_SERVICES = [
  { name: 'Barbing', price: 5000 },
  { name: 'Catering', price: 12000 },
  { name: 'HairStylist', price: 10000 },
  { name: 'Weldering', price: 10000 },
  { name: 'Plumber', price: 15000 },
  { name: 'Carpentering', price: 20000 }
];

const toastConfig = {
  success: (props: any) => (
    <View style={{
      width: '90%',
      backgroundColor: '#fff',
      padding: moderateScale(20),
      borderRadius: moderateScale(12),
      borderLeftWidth: 4,
      borderLeftColor: '#22C55E',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    }}>
      <MaterialIcons name="check-circle" size={30} color="#22C55E" />
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: scale(18),
          fontFamily: 'Urbanist-Bold',
          color: '#333',
          marginBottom: moderateScale(4),
        }}>
          {props.text1}
        </Text>
        <Text style={{
          fontSize: scale(14),
          fontFamily: 'Urbanist-Regular',
          color: '#666',
        }}>
          {props.text2}
        </Text>
      </View>
    </View>
  ),
};

const createUserNotification = async (userId: string, title: string, message: string, type: string) => {
  try {
    await supabase.rpc('create_user_notification', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type
    });
  } catch (error) {
    console.error('Error creating user notification:', error);
  }
};

// Custom header component for showing logo during loading
interface HeaderComponentProps {
  loading?: boolean;
  title?: string;
  isDark: boolean;
  colors: {
    background: string;
    text: string;
    border: string;
    cardBackground: string;
    tint: string;
    inactive: string;
    subtext: string;
    secondaryBackground: string;
    error: string;
    [key: string]: string;
  };
}

// Memoize the header component for better performance
const HeaderComponent = memo(({ loading, title, isDark, colors }: HeaderComponentProps) => {
  const logoSize = 28;  // Size for logo in header
  
  return (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingLeft: 0
    }}>
      <Logo width={logoSize} height={logoSize} />
    </View>
  );
});

// Memoized ServiceItem renderer for better performance
const MemoizedServiceItem = memo(ServiceItemComponent);

// BookingDetailItem component to improve step 3 visual design
interface BookingDetailItemProps {
  icon: string;
  iconColor?: string;
  label: string;
  value: string | React.ReactNode;
  isDark: boolean;
  colors: any;
  isTotal?: boolean;
}

const BookingDetailItem = memo(({ icon, iconColor, label, value, isDark, colors, isTotal }: BookingDetailItemProps) => {
  return (
    <View style={[
      styles.bookingDetailItem,
      isTotal && styles.bookingDetailItemTotal
    ]}>
      <View style={[
        styles.bookingDetailIconContainer,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,102,204,0.08)' }
      ]}>
        <MaterialIcons 
          name={icon as any} 
          size={18} 
          color={iconColor || (isDark ? colors.tint : Colors.primary)} 
        />
      </View>
      <View style={styles.bookingDetailContent}>
        <Text style={[
          styles.bookingDetailLabel,
          isDark && { color: colors.subtext }
        ]}>
          {label}
        </Text>
        {typeof value === 'string' ? (
          <Text style={[
            styles.bookingDetailValue,
            isDark && { color: colors.text },
            isTotal && styles.totalPriceValue,
            isTotal && isDark && { color: colors.tint }
          ]}>
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
});

// Add this helper function near the top of the file
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
          Something went wrong
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: Colors.primary,
            padding: 12,
            borderRadius: 8,
          }}
          onPress={() => setHasError(false)}
        >
          <Text style={{ color: '#fff' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  try {
    return <>{children}</>;
  } catch (error) {
    console.error("Caught error in ErrorBoundary:", error);
    setHasError(true);
    return null;
  }
};

// Create an optimized TextInput component that prevents re-renders
const OptimizedTextInput = memo(({ 
  value, 
  onChangeText, 
  style, 
  placeholder, 
  placeholderTextColor,
  ...props 
}: any) => {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<any>(null);
  const isMounted = useRef(true);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  
  // Update local value when prop changes
  useEffect(() => {
    if (value !== localValue && isMounted.current) {
      setLocalValue(value);
    }
  }, [value]);
  
  const handleChangeText = useCallback((text: string) => {
    setLocalValue(text);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      if (isMounted.current && onChangeText) {
        requestAnimationFrame(() => {
          if (isMounted.current) onChangeText(text);
        });
      }
    }, 500);
  }, [onChangeText]);
  
  return (
    <TextInput
      value={localValue}
      onChangeText={handleChangeText}
      style={style}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      {...props}
    />
  );
});

// Custom keyboard aware scroll view implementation
const CustomKeyboardAwareScrollView = memo(({ 
  children, 
  style, 
  contentContainerStyle, 
  ...props 
}: any) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
        
        // Need to wait for state to update
        setTimeout(() => {
          if (scrollViewRef.current && contentHeight > scrollViewHeight) {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        }, 50);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );
    
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [contentHeight, scrollViewHeight]);
  
  const handleContentSizeChange = useCallback((width: number, height: number) => {
    setContentHeight(height);
  }, []);
  
  const handleLayout = useCallback((event: any) => {
    setScrollViewHeight(event.nativeEvent.layout.height);
  }, []);
  
  return (
    <ScrollView
      ref={scrollViewRef}
      style={style}
      contentContainerStyle={[
        contentContainerStyle,
        keyboardVisible && Platform.OS === 'android' && { paddingBottom: keyboardHeight }
      ]}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleLayout}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      removeClippedSubviews={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
});

export default function RequestScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation<any>();
  const { profile } = useUserStore();
  const { isDark, colors } = useTheme();
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<string | null>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Animation values
  const confirmAnimation = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  
  // Is screen small
  const isSmallScreen = screenWidth < 360;

  // Add a new state to track keyboard visibility
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardHeight = useRef(0);
  
  // Track if the screen is currently mounted
  const isMounted = useRef(true);
  
  // Add a recovery mechanism for blank screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If keyboard is visible, hide it first
      if (keyboardVisible) {
        Keyboard.dismiss();
        return true;
      }
      return false;
    });
    
    return () => backHandler.remove();
  }, [keyboardVisible]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Optimize keyboard handling for Android
  useEffect(() => {
    let keyboardDidShowListener: EmitterSubscription;
    let keyboardDidHideListener: EmitterSubscription;
    let keyboardWillShowListener: EmitterSubscription;
    let keyboardWillHideListener: EmitterSubscription;
    
    const setupKeyboardListeners = () => {
      if (Platform.OS === 'ios') {
        keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (event) => {
          if (!isMounted.current) return;
          keyboardHeight.current = event.endCoordinates.height;
          setKeyboardVisible(true);
        });
        
        keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
          if (!isMounted.current) return;
          setKeyboardVisible(false);
        });
      } else {
        // Android specific handling
        keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
          if (!isMounted.current) return;
          keyboardHeight.current = event.endCoordinates.height;
          setKeyboardVisible(true);
        });
        
        keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
          if (!isMounted.current) return;
          setKeyboardVisible(false);
        });
      }
    };
    
    // Use a microtask to ensure component is fully mounted
    setTimeout(setupKeyboardListeners, 0);

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, []);
  
  // Optimize fetchProvider function to be more resilient
  const fetchProvider = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching provider with ID:', params.id);

      const { data: providerData, error: providerError } = await supabase
        .from('providers')
        .select(`
          *,
          users:user_id (
            id,
            name,
            email,
            profile_pic,
            phone
          )
        `)
        .eq('id', params.id) 
        .single();

      if (providerError) {
        throw providerError;
      }

      if (!isMounted.current) return;

      setProvider(providerData);

      let serviceItems: ServiceItem[] = [];
      
      if (providerData?.services?.length > 0 && providerData.pricing) {
        serviceItems = providerData.services.map((service: string) => ({
          name: service,
          price: providerData.pricing[service] || 0,
          selected: false
        }));
      } else {
        serviceItems = DEFAULT_SERVICES.map(service => ({
          ...service,
          selected: false
        }));
      }

      if (!isMounted.current) return;
      
      // Use InteractionManager to ensure UI remains responsive
      InteractionManager.runAfterInteractions(() => {
        if (!isMounted.current) return;
        setSelectedServices(serviceItems);
      });

    } catch (error) {
      console.error('Error fetching provider:', error);
      
      if (!isMounted.current) return;

      setSelectedServices(DEFAULT_SERVICES.map(service => ({
        ...service,
        selected: false
      })));
    } finally {
      if (!isMounted.current) return;
      setLoading(false);
    }
  }, [params.id]);

  // Start animation when step 3 is reached
  useEffect(() => {
    if (step === 3) {
      // Start the animations
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }).start();
      
      Animated.timing(confirmAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start();
    } else {
      fadeAnim.setValue(0);
      confirmAnimation.setValue(0);
    }
  }, [step]);

  const dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      day: date.getDate(),
      weekday: date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase(),
      month: date.toLocaleString('en-US', { month: 'long' }),
      year: date.getFullYear(),
      fullDate: date.toISOString().split('T')[0]
    };
  });
  }, []);

  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '12:00 PM', '12:30 PM', '01:30 PM', '02:00 PM',
    '03:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'
  ];

  const services = [
    'Barbing',
    'Hose Replacement',
    'Shower and Faucets Installation',
    'Drain Unclogging',
    'Kitchen Sink Installation',
    'Water System Installation'
  ];

  useEffect(() => {
    fetchProvider();
  }, [params.id]);

  const handleSubmit = async () => {
    if (step === 1) {
      const selectedServicesList = selectedServices.filter(s => s.selected);
      if (selectedServicesList.length > 0) {
      setStep(2);
      }
    } else if (step === 2) {
      if (!selectedDate || !selectedTime || !address) {
        Toast.show({
          type: 'error',
          text1: 'Missing Information',
          text2: 'Please select date, time and enter address',
          position: 'bottom',
        });
        return;
      }
      setStep(3);
    } else if (step === 3 && selectedPaymentPlan && !isSubmitting) {
      try {
        setIsSubmitting(true);

        const selectedServicesList = selectedServices.filter(s => s.selected);
        
        if (!profile?.id || !params.id || !selectedDate || !selectedTime || !address) {
          throw new Error('Please fill in all required fields');
        }

        const formattedDate = new Date(selectedDate).toISOString().split('T')[0];
        const [time, period] = selectedTime.split(' ');
        const [hours, minutes] = time.split(':');
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        const formattedTime = `${hour.toString().padStart(2, '0')}:${minutes}:00`;

        // Prepare service details and agreed amounts
        const serviceDetails = selectedServicesList.map(service => ({
          service_name: service.name,
          details: service.serviceDetails || ''
        }));

        const agreedAmounts = selectedServicesList.map(service => ({
          service_name: service.name,
          amount: service.agreedAmount || service.price
        }));
       
        const bookingData = {
          user_id: profile.id,
          provider_id: params.id,
          service: selectedServicesList.map(s => s.name).join(', '), 
          booking_date: formattedDate,
          booking_time: formattedTime,
          address: address,
          landmark: landmark || '',
          payment_plan: selectedPaymentPlan,
          amount: totalPrice, 
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          service_details: serviceDetails,
          agreed_amounts: agreedAmounts
        };

        console.log('Submitting booking data:', bookingData);

        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .insert([bookingData])
          .select('*')
          .single();

        if (bookingError) {
          console.error('Booking error:', bookingError);
          throw bookingError;
        }

        console.log('Booking created successfully:', booking);

        // Send notification to provider
        try {
          await createUserNotification(
            provider?.user_id!,
            'New Booking Request',
            `You have a new booking request for ${selectedServicesList.map(s => s.name).join(', ')}`,
            'order'
          );
        } catch (notifError) {
          console.error('Failed to send provider notification, but booking was created:', notifError);
          // Continue with the process even if notification fails
        }

        // Also send notification to the user
        try {
          await createUserNotification(
            profile.id,
            'Booking Submitted',
            `Your booking request has been submitted successfully`,
            'order'
          );
        } catch (notifError) {
          console.error('Failed to send user notification, but booking was created:', notifError);
          // Continue with the process even if notification fails
        }

        // Send push notification for successful booking
        try {
          const services = selectedServicesList.map(s => s.name).join(', ');
          await sendBookingSuccessNotification(services);
        } catch (pushError) {
          console.error('Failed to send push notification, but booking was created:', pushError);
          // Continue with the process even if notification fails
        }

        // Send email notification to admin
        try {
          // Add customer and provider information to the booking data
          const bookingWithUserInfo = {
            ...booking,
            customer_name: profile.name || profile.email,
            customer_phone: profile.phone || 'N/A',
            provider_name: provider?.users?.name || 'Provider',
            provider_phone: provider?.users?.phone || 'N/A'
          };
          
          await sendBookingNotificationToAdmin(bookingWithUserInfo);
        } catch (emailError) {
          console.error('Failed to send admin email notification, but booking was created:', emailError);
          // Continue with the process even if email notification fails
        }

        Toast.show({
          type: 'success',
          text1: 'Booking Successful!',
          text2: 'Your booking has been confirmed. You can view the details in Your Bookings.',
          visibilityTime: 2500,
          topOffset: 0,
          onHide: () => router.push('/services'),
          props: {
            style: {
              width: '90%',
            }
          }
        });

      } catch (error: any) {
        console.error('Booking error:', error);
        Toast.show({
          type: 'error',
          text1: 'Booking Failed',
          text2: error.message || 'Failed to create booking. Please try again.',
          position: 'bottom',
          visibilityTime: 4000
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const calculateTotalPrice = (services: ServiceItem[]) => {
    return services
      .filter(service => service.selected)
      .reduce((total, service) => {
        return total + (service.agreedAmount || service.price);
      }, 0);
  };

  const handleServiceSelect = useCallback((index: number) => {
    setSelectedServices(prev => {
      const newServices = [...prev];
      newServices[index] = {
        ...newServices[index],
        selected: !newServices[index].selected
      };

      setTotalPrice(calculateTotalPrice(newServices));
      return newServices;
    });
  }, []);

  const handleAgreedAmountChange = useCallback((index: number, amount: string) => {
    setSelectedServices(prev => {
      const newServices = [...prev];
      newServices[index] = {
        ...newServices[index],
        agreedAmount: amount ? parseInt(amount) : undefined
      };

      setTotalPrice(calculateTotalPrice(newServices));
      return newServices;
    });
  }, []);

  const handleServiceDetailsChange = useCallback((index: number, details: string) => {
    if (index < 0 || index >= selectedServices.length) {
      return; // Ensure index is valid
    }
    
    // Use batch updates and requestAnimationFrame instead of InteractionManager
    requestAnimationFrame(() => {
      if (!isMounted.current) return;
      
      setSelectedServices(prev => {
        // If we're modifying the same service with the same details, avoid re-render
        if (prev[index]?.serviceDetails === details) {
          return prev;
        }
        
        try {
          const newServices = [...prev];
          newServices[index] = {
            ...newServices[index],
            serviceDetails: details || '' // Ensure details is never undefined
          };
          return newServices;
        } catch (err) {
          console.error('Error updating service details:', err);
          return prev; // Return previous state on error
        }
      });
    });
  }, [selectedServices.length]); // Add selectedServices.length as a dependency

  const renderService = useCallback(({ item, index }: { item: ServiceItem; index: number }) => (
    <MemoizedServiceItem
      key={`${item.name}-${index}`}
      service={item}
      onSelect={() => handleServiceSelect(index)}
      onAgreedAmountChange={(amount) => handleAgreedAmountChange(index, amount)}
      onServiceDetailsChange={(details) => handleServiceDetailsChange(index, details)}
      isDark={isDark}
      colors={colors}
    />
  ), [handleServiceSelect, handleAgreedAmountChange, handleServiceDetailsChange, isDark, colors]);

  const renderStep1 = useMemo(() => () => (
    <ErrorBoundary>
      <View style={[styles.stepContainer, isDark && {backgroundColor: colors.background}]}>
        <CustomKeyboardAwareScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.step1Container,
            isSmallScreen && styles.smallScreenContainer
          ]}
        >
        <Text style={[
          styles.title, 
          isDark && {color: colors.text},
          isSmallScreen && styles.smallScreenTitle
        ]}>Select Services</Text>
        
          <View style={styles.servicesListContainer}>
            {selectedServices.map((service, index) => (
              <React.Fragment key={`${service.name}-${index}`}>
                <MemoizedServiceItem
                  service={service}
                  onSelect={() => handleServiceSelect(index)}
                  onAgreedAmountChange={(amount) => handleAgreedAmountChange(index, amount)}
                  onServiceDetailsChange={(details) => handleServiceDetailsChange(index, details)}
                  isDark={isDark}
                  colors={colors}
                />
              </React.Fragment>
            ))}
          </View>

        <View style={[styles.totalPriceContainer, isDark && {backgroundColor: colors.cardBackground}]}>
            <Text style={[styles.totalLabel, isDark && {color: colors.subtext}]}>Total Amount</Text>
          <Text style={[styles.totalPrice, isDark && {color: colors.tint}]}>₦{totalPrice.toLocaleString()}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              selectedServices.filter(s => s.selected).length === 0 && styles.continueButtonDisabled,
              { marginBottom: 32 }
            ]}
            onPress={() => setStep(2)}
            disabled={selectedServices.filter(s => s.selected).length === 0}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </CustomKeyboardAwareScrollView>
      </View>
    </ErrorBoundary>
  ), [selectedServices, totalPrice, isDark, colors, isSmallScreen, handleServiceSelect, handleAgreedAmountChange, handleServiceDetailsChange]);

  const renderStep2 = useMemo(() => () => (
    <ErrorBoundary>
      <View style={[styles.stepContainer, isDark && {backgroundColor: colors.background}]}>
        <CustomKeyboardAwareScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.step2Container,
            isSmallScreen && styles.smallScreenContainer
          ]}
        >
          <Text style={[
            styles.title, 
            isDark && {color: colors.text},
            isSmallScreen && styles.smallScreenTitle
          ]}>Choose your time and place</Text>

          {/* Date Selection */}
          <Text style={[
            styles.sectionTitle, 
            isDark && {color: colors.text},
            isSmallScreen && styles.smallScreenSectionTitle
          ]}>Select Date</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.dateContainer}
          >
            {dates.map((date) => (
              <TouchableOpacity
                key={date.fullDate}
                style={[
                  styles.dateButton,
                  isDark && {borderColor: colors.border},
                  selectedDate === date.fullDate && styles.selectedDate,
                  isSmallScreen && styles.smallScreenDateButton
                ]}
                onPress={() => setSelectedDate(date.fullDate)}
              >
                <Text style={[
                  styles.dateDay,
                  isDark && {color: colors.text},
                  selectedDate === date.fullDate && styles.selectedDateText,
                  isSmallScreen && styles.smallScreenDateDay
                ]}>{date.day}</Text>
                <Text style={[
                  styles.dateWeekday,
                  isDark && {color: colors.subtext},
                  selectedDate === date.fullDate && styles.selectedDateText,
                  isSmallScreen && styles.smallScreenDateWeekday
                ]}>{date.weekday}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Time Selection */}
          <Text style={[
            styles.sectionTitle, 
            isDark && {color: colors.text},
            isSmallScreen && styles.smallScreenSectionTitle
          ]}>Select Time</Text>
          <View style={styles.timeGrid}>
            {timeSlots.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeButton,
                  isDark && {borderColor: colors.border},
                  selectedTime === time && styles.selectedTime,
                  isSmallScreen && styles.smallScreenTimeButton
                ]}
                onPress={() => setSelectedTime(time)}
              >
                <Text style={[
                  styles.timeText,
                  isDark && {color: colors.subtext},
                  selectedTime === time && styles.selectedTimeText,
                  isSmallScreen && styles.smallScreenTimeText
                ]}>{time}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Address Input */}
          <Text style={[
            styles.sectionTitle, 
            isDark && {color: colors.text},
            isSmallScreen && styles.smallScreenSectionTitle
          ]}>Address</Text>
          <OptimizedTextInput
            style={[
              styles.input, 
              isDark && {
                borderColor: colors.border,
                backgroundColor: colors.cardBackground,
                color: colors.text
              },
              isSmallScreen && styles.smallScreenInput
            ]}
            placeholder="Enter your address"
            placeholderTextColor={isDark ? colors.inactive : '#999'}
            value={address}
            onChangeText={setAddress}
            maxLength={200}
          />

          <Text style={[
            styles.sectionTitle, 
            isDark && {color: colors.text},
            isSmallScreen && styles.smallScreenSectionTitle
          ]}>Landmark (Optional)</Text>
          <OptimizedTextInput
            style={[
              styles.input, 
              styles.landmarkInput,
              isDark && {
                borderColor: colors.border,
                backgroundColor: colors.cardBackground,
                color: colors.text
              },
              isSmallScreen && styles.smallScreenInput
            ]}
            placeholder="Enter a landmark"
            placeholderTextColor={isDark ? colors.inactive : '#999'}
            value={landmark}
            onChangeText={setLandmark}
            multiline
            maxLength={100}
          />

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedDate || !selectedTime || !address) && styles.disabledButton,
              { marginTop: 24, marginBottom: 32 }
            ]}
            onPress={handleSubmit}
            disabled={!selectedDate || !selectedTime || !address}
          >
            <Text style={styles.submitButtonText}>Continue</Text>
          </TouchableOpacity>
        </CustomKeyboardAwareScrollView>
      </View>
    </ErrorBoundary>
  ), [
    selectedDate, selectedTime, address, landmark, isDark, colors, 
    isSmallScreen, dates, timeSlots, handleSubmit
  ]);

  const renderPaymentPlans = useMemo(() => () => (
    <View style={styles.plansContainer}>
        <TouchableOpacity
          style={[
            styles.planCard,
            isDark && {
              borderColor: colors.border,
              backgroundColor: colors.cardBackground
            },
            selectedPaymentPlan === 'full_upfront' && [
              styles.selectedPlan,
              isDark && {
                borderColor: colors.tint,
                backgroundColor: 'rgba(51,169,212,0.15)'
              }
            ],
            isSmallScreen && styles.smallScreenPlanCard
          ]}
          onPress={() => setSelectedPaymentPlan('full_upfront')}
        >
          <View style={styles.planHeader}>
            <View style={[
              styles.planIconContainer,
              isDark && {backgroundColor: 'rgba(51,169,212,0.15)'}
            ]}>
              <MaterialIcons name="payment" size={isSmallScreen ? 18 : 20} color={isDark ? colors.tint : Colors.primary} />
            </View>
            <Text style={[
              styles.planTitle,
              isDark && {color: colors.text},
              isSmallScreen && styles.smallScreenPlanTitle
            ]}>Full Payment</Text>
            <Text style={[
              styles.planPrice,
              isDark && {color: colors.tint},
              isSmallScreen && styles.smallScreenPlanPrice
            ]}>₦{totalPrice.toLocaleString()}</Text>
          </View>
          <Text style={[
            styles.planDescription,
            isDark && {color: colors.subtext},
            isSmallScreen && styles.smallScreenPlanDescription
          ]}>
            Pay the full amount upfront
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.planCard,
            isDark && {
              borderColor: colors.border,
              backgroundColor: colors.cardBackground
            },
            selectedPaymentPlan === 'half' && [
              styles.selectedPlan,
              isDark && {
                borderColor: colors.tint,
                backgroundColor: 'rgba(51,169,212,0.15)'
              }
            ],
            isSmallScreen && styles.smallScreenPlanCard
          ]}
          onPress={() => setSelectedPaymentPlan('half')}
        >
          <View style={styles.planHeader}>
            <View style={[
              styles.planIconContainer,
              isDark && {backgroundColor: 'rgba(51,169,212,0.15)'}
            ]}>
              <MaterialIcons name="payments" size={isSmallScreen ? 18 : 20} color={isDark ? colors.tint : Colors.primary} />
            </View>
            <Text style={[
              styles.planTitle,
              isDark && {color: colors.text},
              isSmallScreen && styles.smallScreenPlanTitle
            ]}>Half Payment</Text>
            <Text style={[
              styles.planPrice,
              isDark && {color: colors.tint},
              isSmallScreen && styles.smallScreenPlanPrice
            ]}>₦{Math.floor(totalPrice / 2).toLocaleString()}</Text>
          </View>
          <Text style={[
            styles.planDescription,
            isDark && {color: colors.subtext},
            isSmallScreen && styles.smallScreenPlanDescription
          ]}>
            Pay 50% now and the rest after service completion
          </Text>
        </TouchableOpacity>
    </View>
  ), [selectedPaymentPlan, totalPrice, isDark, colors, isSmallScreen]);

  const renderStep3 = useMemo(() => () => {
    const selectedServicesList = selectedServices.filter(s => s.selected);
    
    // Animation style for the booking card
    const animatedCardStyle = {
      opacity: fadeAnim,
      transform: [
        {
          translateY: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0]
          })
        }
      ]
    };
    
    // Animation for the confirm button
    const confirmButtonStyle = {
      transform: [
        {
          scale: confirmAnimation.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.95, 1.05, 1]
          })
        }
      ]
    };
    
    return (
    <ErrorBoundary>
      <View style={[styles.stepContainer, isDark && {backgroundColor: colors.background}]}>
        <CustomKeyboardAwareScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.step3Container,
            isSmallScreen && styles.smallScreenContainer
          ]}
        >
          <Text style={[
            styles.title, 
            isDark && {color: colors.text},
            isSmallScreen && styles.smallScreenTitle
          ]}>Confirm Booking</Text>
        
          {/* Provider Info */}
          <Animated.View style={[
            styles.providerCard, 
            isDark && {backgroundColor: colors.cardBackground},
            animatedCardStyle
          ]}>
            <Image 
              source={{ uri: provider?.users?.profile_pic || 'https://via.placeholder.com/40' }}
              style={[
                styles.providerImage,
                isSmallScreen && { width: 35, height: 35 }
              ]}
            />
            <View style={styles.providerInfo}>
              <Text style={[
                styles.providerName,
                isDark && {color: colors.text},
                isSmallScreen && { fontSize: 14 }
              ]}>{provider?.users?.name}</Text>
              <Text style={[
                styles.providerService,
                isDark && {color: colors.subtext},
                isSmallScreen && { fontSize: 12 }
              ]}>{selectedServicesList.map(s => s.name).join(', ')}</Text>
            </View>
          </Animated.View>

          {/* Booking Details Card - Enhanced design */}
          <Animated.View style={[
            styles.bookingDetailsCard,
            isDark && {backgroundColor: colors.cardBackground},
            styles.enhancedBookingCard,
            isDark && { borderColor: 'rgba(255,255,255,0.1)' },
            animatedCardStyle
          ]}>
            <View style={styles.bookingHeaderRow}>
              <MaterialIcons name="receipt-long" size={isSmallScreen ? 18 : 22} color={isDark ? colors.tint : Colors.primary} />
              <Text style={[
                styles.bookingDetailsTitle, 
                isDark && {color: colors.text},
                isSmallScreen && { fontSize: 14 }
              ]}>Booking Summary</Text>
            </View>
            
            <View style={styles.bookingDetailDivider} />
            
            {/* Services - Enhanced */}
            <BookingDetailItem 
              icon="home-repair-service"
              label="Services"
              value={
                <View style={styles.servicesDetailContainer}>
                  {selectedServicesList.map((service, i) => (
                    <View key={service.name + i} style={styles.serviceDetailItem}>
                      <Text style={[
                        styles.serviceDetailName,
                        isDark && { color: colors.text },
                        isSmallScreen && { fontSize: 12 }
                      ]}>
                        {service.name}
                      </Text>
                      <Text style={[
                        styles.serviceDetailPrice,
                        isDark && { color: colors.tint },
                        isSmallScreen && { fontSize: 12 }
                      ]}>
                        ₦{(service.agreedAmount || service.price).toLocaleString()}
                      </Text>
                      {service.serviceDetails && (
                        <Text style={[
                          styles.serviceDetailDescription,
                          isDark && { color: colors.subtext },
                          isSmallScreen && { fontSize: 10 }
                        ]}>
                          Details: {service.serviceDetails}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              }
              isDark={isDark}
              colors={colors}
            />

            {/* Date & Time - Enhanced */}
            <BookingDetailItem 
              icon="access-time"
              label="Date & Time"
              value={`${selectedDate} at ${selectedTime}`}
              isDark={isDark}
              colors={colors}
            />

            {/* Address - Enhanced */}
            <BookingDetailItem 
              icon="location-on"
              label="Service Location"
              value={
                <View>
                  <Text style={[
                    styles.addressText,
                    isDark && { color: colors.text },
                    isSmallScreen && { fontSize: 12 }
                  ]}>
                    {address}
                  </Text>
                  {landmark && (
                    <Text style={[
                      styles.landmarkText,
                      isDark && { color: colors.subtext },
                      isSmallScreen && { fontSize: 10 }
                    ]}>
                      Landmark: {landmark}
                    </Text>
                  )}
                </View>
              }
              isDark={isDark}
              colors={colors}
            />

            {/* Total Price - Enhanced */}
            <BookingDetailItem 
              icon="payments"
              label="Total Amount"
              value={`₦${totalPrice.toLocaleString()}`}
              isDark={isDark}
              colors={colors}
              isTotal={true}
            />
          </Animated.View>

          {/* Payment Plans */}
          <Text style={[
            styles.sectionTitle,
            isDark && {color: colors.text},
            isSmallScreen && styles.smallScreenSectionTitle
          ]}>Select Payment Plan</Text>
          {renderPaymentPlans()}

          <Animated.View style={confirmButtonStyle}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedPaymentPlan || isSubmitting) && styles.disabledButton,
                { marginTop: 24, marginBottom: 32 }
              ]}
              onPress={handleSubmit}
              disabled={!selectedPaymentPlan || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Processing...' : 'Confirm Booking'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </CustomKeyboardAwareScrollView>
      </View>
    </ErrorBoundary>
    );
  }, [
    selectedServices, totalPrice, provider, selectedDate, selectedTime, 
    address, landmark, selectedPaymentPlan, isSubmitting, isDark, colors, 
    isSmallScreen, fadeAnim, confirmAnimation, handleSubmit, renderPaymentPlans
  ]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <HeaderComponent 
        isDark={isDark}
        colors={colors}
      />,
      headerStyle: {
        backgroundColor: isDark ? colors.background : '#fff',
      },
      headerTintColor: isDark ? colors.text : '#000',
    });
  }, [isDark, colors]);

  return (
    <View style={[styles.container, isDark && {backgroundColor: colors.background}]}>
      <Stack.Screen 
        options={{
          title: 'Request Service',
          headerShown: true,
        }}
      />

      {/* Progress Steps */}
      <View style={[
        styles.progressContainer, 
        isDark && {backgroundColor: colors.background},
        isSmallScreen && styles.smallScreenProgressContainer,
        keyboardVisible && Platform.OS === 'android' && { paddingVertical: 10 }
      ]}>
        <View style={styles.progressLine}>
          <View style={[
            styles.progressBackground,
            isDark && {backgroundColor: colors.border}
          ]} />
          
          <View style={[
            styles.progressActive,
            { width: `${(step - 1) * 50}%` }
          ]} />
          
          {/* Progress dots */}
          <View style={[
            styles.progressDot, 
            isDark && {backgroundColor: colors.border, borderColor: colors.background},
            step >= 1 && styles.activeDot,
            isSmallScreen && styles.smallScreenProgressDot
          ]}>
            <Text style={[
              styles.progressNumber, 
              isDark && {color: colors.subtext},
              step >= 1 && styles.activeNumber,
              isSmallScreen && styles.smallScreenProgressNumber
            ]}>1</Text>
          </View>
          <View style={[
            styles.progressDot, 
            isDark && {backgroundColor: colors.border, borderColor: colors.background},
            step >= 2 && styles.activeDot,
            isSmallScreen && styles.smallScreenProgressDot
          ]}>
            <Text style={[
              styles.progressNumber,
              isDark && {color: colors.subtext},
              step >= 2 && styles.activeNumber,
              isSmallScreen && styles.smallScreenProgressNumber
            ]}>2</Text>
          </View>
          <View style={[
            styles.progressDot, 
            isDark && {backgroundColor: colors.border, borderColor: colors.background},
            step >= 3 && styles.activeDot,
            isSmallScreen && styles.smallScreenProgressDot
          ]}>
            <Text style={[
              styles.progressNumber,
              isDark && {color: colors.subtext},
              step >= 3 && styles.activeNumber,
              isSmallScreen && styles.smallScreenProgressNumber
            ]}>3</Text>
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={[
        styles.mainContent,
        isDark && {backgroundColor: colors.background}
      ]}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </View>
    </View>
  );
}

const styles = ScaledSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mainContent: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: '16@ms',
    paddingBottom: '32@ms', // Add extra padding at bottom for scroll space
  },
  footerz: {
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    // Add shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: '16@ms',
  },
  step1Container: {
    flexGrow: 1,
    paddingBottom: '50@ms',
  },
  servicesListContainer: {
    marginBottom: '24@ms',
  },
  totalPriceContainer: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '24@ms',
  },
  continueButton: {
    backgroundColor: Colors.primary,
    padding: '16@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    width: '100%',
  },
  progressContainer: {
    paddingVertical: '20@ms',
    paddingHorizontal: '40@ms',
  },
  progressLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  progressBackground: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    height: '2@ms',
    backgroundColor: '#E5E7EB',
    top: '50%',
    transform: [{ translateY: -1 }],
  },
  progressActive: {
    position: 'absolute',
    left: '10%',
    height: '2@ms',
    backgroundColor: Colors.primary,
    top: '50%',
    transform: [{ translateY: -1 }],
    transition: 'width 0.3s ease-in-out',
  },
  progressDot: {
    width: '24@ms',
    height: '24@ms',
    borderRadius: '12@ms',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: '#fff',
  },
  activeDot: {
    backgroundColor: Colors.primary,
    borderColor: '#fff',
  },
  progressNumber: {
    color: '#666',
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Bold',
  },
  activeNumber: {
    color: '#fff',
  },
  title: {
    fontSize: screenWidth * 0.045,
    maxFontSize: '20@ms',
    fontFamily: 'Urbanist-Bold',
    marginBottom: '16@ms',
  },
  dateContainer: {
    marginBottom: '24@ms',
  },
  dateButton: {
    width: screenWidth * 0.15,
    minWidth: '60@ms',
    height: screenWidth * 0.2,
    maxHeight: '80@ms',
    borderRadius: '8@ms',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  selectedDate: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateDay: {
    fontSize: screenWidth * 0.04,
    maxFontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  dateWeekday: {
    fontSize: screenWidth * 0.03,
    maxFontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  selectedDateText: {
    color: '#fff',
  },
  sectionTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-SemiBold',
    marginBottom: '12@ms',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: '8@ms',
    marginBottom: '24@ms',
  },
  timeButton: {
    width: '30%',
    paddingHorizontal: '12@ms',
    paddingVertical: '8@ms',
    borderRadius: '20@ms',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  selectedTime: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  selectedTimeText: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: '8@ms',
    padding: '12@ms',
    marginBottom: '16@ms',
    fontSize: screenWidth * 0.035,
    maxFontSize: '16@ms',
    fontFamily: 'Urbanist-Regular',
    width: '100%',
  },
  landmarkInput: {
    height: screenHeight * 0.12,
    maxHeight: '100@ms',
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: '16@ms',
    borderRadius: '8@ms',
    alignItems: 'center',
    width: '100%',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  subtitle: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginBottom: '24@ms',
  },
  serviceList: {
    paddingBottom: '16@ms',
  },
  totalLabel: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '8@ms',
  },
  totalPrice: {
    fontSize: '24@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '24@ms',
  },
  providerImage: {
    width: '40@ms',
    height: '40@ms',
    borderRadius: '20@ms',
  },
  providerInfo: {
    marginLeft: '12@ms',
  },
  providerName: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  providerService: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  plansContainer: {
    gap: '16@ms',
    marginBottom: '24@ms',
  },
  planCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: '12@ms',
    padding: '16@ms',
    marginBottom: '12@ms',
    width: '100%',
  },
  selectedPlan: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F9FF',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '8@ms',
  },
  planIconContainer: {
    width: '32@ms',
    height: '32@ms',
    borderRadius: '16@ms',
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  planTitle: {
    flex: 1,
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
  },
  planPrice: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  planDescription: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: '20@ms',
  },
  bookingDetailsCard: {
    backgroundColor: '#F8FAFC',
    padding: '16@ms',
    borderRadius: '12@ms',
    marginBottom: '24@ms',
  },
  bookingDetailsTitle: {
    fontSize: '16@ms',
    fontFamily: 'Urbanist-Bold',
    color: '#333',
    marginBottom: '12@ms',
  },
  bookingDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: '8@ms',
    gap: '12@ms',
  },
  bookingDetailText: {
    flex: 1,
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  addressContainer: {
    flex: 1,
  },
  landmarkText: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: '4@ms',
  },
  buttonContainer: {
    paddingTop: '24@ms',
    paddingHorizontal: '16@ms',
    paddingBottom: '24@ms',
  },
  footer: {
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    // Add shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  step2Container: {
    flexGrow: 1,
    paddingBottom: '50@ms', // Extra padding to ensure button is visible
  },
  step3Container: {
    flexGrow: 1,
    paddingBottom: '50@ms', // Extra padding to ensure button is visible
  },
  bottomContainer: {
    padding: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
    // Add shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  // Small screen adaptations
  smallScreenContainer: {
    paddingBottom: '40@ms',
  },
  smallScreenTitle: {
    fontSize: '16@ms',
    marginBottom: '12@ms',
  },
  smallScreenSectionTitle: {
    fontSize: '14@ms',
    marginBottom: '8@ms',
  },
  smallScreenDateButton: {
    minWidth: '50@ms',
    height: '65@ms',
  },
  smallScreenDateDay: {
    fontSize: '14@ms',
  },
  smallScreenDateWeekday: {
    fontSize: '10@ms',
  },
  smallScreenTimeButton: {
    paddingVertical: '6@ms',
    paddingHorizontal: '8@ms',
  },
  smallScreenTimeText: {
    fontSize: '12@ms',
  },
  smallScreenInput: {
    padding: '10@ms',
    fontSize: '14@ms',
  },
  smallScreenProgressContainer: {
    paddingVertical: '15@ms',
  },
  smallScreenProgressDot: {
    width: '20@ms',
    height: '20@ms',
  },
  smallScreenProgressNumber: {
    fontSize: '10@ms',
  },
  smallScreenPlanCard: {
    padding: '12@ms',
    borderRadius: '10@ms',
  },
  smallScreenPlanTitle: {
    fontSize: '14@ms',
  },
  smallScreenPlanPrice: {
    fontSize: '12@ms',
  },
  smallScreenPlanDescription: {
    fontSize: '12@ms',
    lineHeight: '16@ms',
  },
  
  // Enhanced booking card styles
  enhancedBookingCard: {
    borderWidth: 1,
    borderColor: '#E8F4FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8@ms',
    marginBottom: '12@ms',
  },
  bookingDetailDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: '16@ms',
  },
  bookingDetailItem: {
    flexDirection: 'row',
    marginBottom: '16@ms',
  },
  bookingDetailItemTotal: {
    marginTop: '8@ms',
    paddingTop: '16@ms',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bookingDetailIconContainer: {
    width: '36@ms',
    height: '36@ms',
    borderRadius: '18@ms',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: '12@ms',
  },
  bookingDetailContent: {
    flex: 1,
  },
  bookingDetailLabel: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#666',
    marginBottom: '4@ms',
  },
  bookingDetailValue: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  totalPriceValue: {
    fontSize: '18@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
  },
  servicesDetailContainer: {
    gap: '8@ms',
  },
  serviceDetailItem: {
    marginBottom: '8@ms',
  },
  serviceDetailName: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-SemiBold',
    color: '#333',
  },
  serviceDetailPrice: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Bold',
    color: Colors.primary,
    marginTop: '2@ms',
  },
  serviceDetailDescription: {
    fontSize: '12@ms',
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: '4@ms',
  },
  addressText: {
    fontSize: '14@ms',
    fontFamily: 'Urbanist-Medium',
    color: '#333',
  }
}); 